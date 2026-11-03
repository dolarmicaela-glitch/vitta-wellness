'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createCheckoutHandler, signSession } = require('../netlify/lib/mercadopago');
const { programAccessHandler, programDownloadHandler } = require('../netlify/lib/program');
const { programUploadHandler } = require('../netlify/lib/program-upload');
const now = 1793620800000;
const env = { MP_ACCESS_TOKEN: 'APP_USR-test-only', VITTA_ACCESS_SECRET: 'test-only-signing-key-with-at-least-32-characters', URL: 'https://vitta-test.netlify.app', VITTA_UPLOAD_KEY: 'test-only-upload-key-with-at-least-32-characters' };
const base = { reference: 'vitta-reset-00000000-0000-4000-8000-000000000001', amount: 49870, currency: 'ARS' };
const token = (purpose = 'purchase', expires = now + 100000) => signSession({ ...base, purpose, expires, ...(purpose === 'purchase' ? {} : { payment_id: '123456' }) }, env.VITTA_ACCESS_SECRET);
const payment = { id: 123456, external_reference: base.reference, currency_id: 'ARS', transaction_amount: 49870, live_mode: true, status: 'approved' };
const weeks = [2, 3, 4].map(week => ({ week, title: 'Etapa ' + week, pillar: 'Hábitos anteriores', label: 'Se suman', habits: ['Contenido privado de prueba'] }));
const manifest = { zipKey: 'programs/' + 'a'.repeat(64) + '.zip', weeksKey: 'programs/' + 'b'.repeat(64) + '.json', size: 5 };
const zip = Buffer.from([0x50,0x4b,0x03,0x04,0x01]);
const ok = body => ({ ok: true, json: async () => body });
const event = body => ({ httpMethod: 'POST', headers: { origin: env.URL }, body: JSON.stringify(body) });
function memoryStore(initial = []) {
  const data = new Map(initial);
  return { data,
    async get(key, options = {}) { const value = data.get(key); if (value === undefined) return null; if (options.type === 'stream') return new ReadableStream({ start(c) { c.enqueue(new Uint8Array(value)); c.close(); } }); return value; },
    async set(key, value) { data.set(key, value); }, async setJSON(key, value) { data.set(key, value); }, async delete(key) { data.delete(key); }
  };
}
const programme = () => memoryStore([['active', manifest], [manifest.weeksKey, weeks], [manifest.zipKey, zip]]);

test('checkout stays closed until the private programme is ready', async () => {
  let calls = 0;
  const response = await createCheckoutHandler({ env, programmeReady: async () => null, fetchImpl: async () => { calls++; } })(event({}));
  assert.equal(response.statusCode, 503); assert.equal(calls, 0);
});

test('pending, rejected, refunded and chargeback payments reveal no paid material', async () => {
  for (const status of ['pending','rejected','refunded','charged_back','in_process']) {
    let reads = 0;
    const result = await programAccessHandler({ env, now: () => now, fetchImpl: async () => ok({ ...payment, status }), getStore: async () => { reads++; return programme(); } })(event({ session: token(), payment_id: '123456' }));
    assert.deepEqual(JSON.parse(result.body), { status }); assert.equal(reads, 0);
  }
});

test('approved payment returns private weeks and a short download ticket', async () => {
  const result = await programAccessHandler({ env, now: () => now, fetchImpl: async () => ok(payment), getStore: async () => programme() })(event({ session: token(), payment_id: '123456' }));
  assert.equal(result.statusCode, 200);
  const data = JSON.parse(result.body);
  assert.deepEqual(data.weeks, weeks); assert.ok(data.access_pass); assert.match(data.download_url, /mp-program-download\?ticket=/);
  assert.equal(result.body.includes(env.MP_ACCESS_TOKEN), false);
  assert.equal(result.body.includes(env.VITTA_ACCESS_SECRET), false);
});

test('forged, expired, wrong-purpose and mismatched claims cannot grant access', async () => {
  let calls = 0;
  const handler = programAccessHandler({ env, now: () => now, fetchImpl: async () => { calls++; return ok(payment); } });
  for (const session of [token() + 'x', token('purchase', now - 1), token('download')]) {
    assert.equal((await handler(event({ session, payment_id: '123456' }))).statusCode, 400);
  }
  assert.equal(calls, 0);
  for (const change of [{ transaction_amount: 1 }, { currency_id: 'USD' }, { external_reference: 'other' }, { live_mode: false }, { id: 222 }]) {
    const mismatch = await programAccessHandler({ env, now: () => now, fetchImpl: async () => ok({ ...payment, ...change }) })(event({ session: token(), payment_id: '123456' }));
    assert.equal(mismatch.statusCode, 409);
  }
});

test('restoring from the purchase receipt rechecks the current payment after search', async () => {
  const calls = [];
  const response = await programAccessHandler({ env, now: () => now, fetchImpl: async url => { calls.push(url); return ok(url.includes('/search?') ? { results: [payment] } : { ...payment, status: 'refunded' }); } })(event({ session: token() }));
  assert.deepEqual(JSON.parse(response.body), { status: 'refunded' });
  assert.equal(calls.length, 2); assert.match(calls[0], /external_reference=vitta-reset-/); assert.match(calls[1], /\/v1\/payments\/123456$/);
});

test('download streams the exact ZIP only while the payment is still approved', async () => {
  const request = value => new Request(env.URL + '/.netlify/functions/mp-program-download?ticket=' + value);
  const success = await programDownloadHandler({ env, now: () => now, fetchImpl: async () => ok(payment), getStore: async () => programme() })(request(token('download')));
  assert.equal(success.status, 200); assert.equal(success.headers.get('content-type'), 'application/zip');
  assert.deepEqual(Buffer.from(await success.arrayBuffer()), zip);
  for (const status of ['pending','refunded','charged_back']) {
    const denied = await programDownloadHandler({ env, now: () => now, fetchImpl: async () => ok({ ...payment, status }) })(request(token('download')));
    assert.equal(denied.status, 403);
  }
  let calls = 0;
  const handler = programDownloadHandler({ env, now: () => now, fetchImpl: async () => { calls++; } });
  for (const ticket of [token('access'),token('download',now-1),token('download')+'x']) assert.equal((await handler(request(ticket))).status,400);
  assert.equal(calls,0);
});

const uploadId = '00000000-0000-4000-8000-000000000002';
function uploadRequest(mode, body, key = env.VITTA_UPLOAD_KEY, origin = env.URL) {
  return new Request(env.URL + '/.netlify/functions/mp-program-upload?mode=' + mode + '&id=' + uploadId + '&index=0', { method: 'POST', headers: { origin, authorization: 'Bearer ' + key }, body });
}
const finish = (changes = {}) => JSON.stringify({ chunks: 1, size: zip.length, sha256: createHash('sha256').update(zip).digest('hex'), weeks, ...changes });

test('private upload rejects missing credentials, other origins and corrupt ZIPs', async () => {
  const store = memoryStore();
  const handler = programUploadHandler({ env, getStore: async () => store });
  assert.equal((await handler(uploadRequest('chunk', zip, 'wrong'))).status,404);
  assert.equal((await handler(uploadRequest('chunk', zip, undefined, 'https://other.example'))).status,403);
  assert.equal(store.data.size,0);
  assert.equal((await handler(uploadRequest('chunk',zip))).status,200);
  assert.equal((await handler(uploadRequest('finish',finish({ sha256: '0'.repeat(64) })))).status,400);
  assert.equal(store.data.has('active'),false);
});

test('successful setup verifies the archive, stores private lessons and disables that upload key', async () => {
  const store = memoryStore();
  const handler = programUploadHandler({ env, getStore: async () => store });
  await handler(uploadRequest('chunk',zip));
  const result = await handler(uploadRequest('finish',finish()));
  assert.equal(result.status,200); assert.equal((await result.json()).ready,true);
  assert.ok(store.data.get('active')); assert.equal(store.data.has('uploads/'+uploadId+'/0'),false);
  assert.equal((await handler(uploadRequest('chunk',zip))).status,404);
});

test('public landing contains placeholders instead of the paid lessons', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(require.resolve('../vitta-reset.html'),'utf8');
  assert.equal((html.match(/data-paid-week=/g)||[]).length,3);
  for (const sentence of ['12 hs de ayuno intermitente','Solo comida natural, sin procesados','Fuerza + cardio integrado en la semana']) assert.equal(html.includes(sentence),false);
});
