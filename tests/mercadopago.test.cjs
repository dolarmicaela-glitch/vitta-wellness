'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCheckoutHandler: originalCreateCheckoutHandler, paymentStatusHandler, signSession } = require('../netlify/lib/mercadopago');
const createCheckoutHandler = options => originalCreateCheckoutHandler({ programmeReady: async () => ({ ready: true }), ...options });
const env = { MP_ACCESS_TOKEN: 'APP_USR-test-only-placeholder', VITTA_ACCESS_SECRET: 'test-only-signing-key-with-at-least-32-characters', URL: 'https://vitta-test.netlify.app' };
const now = 1793620800000;
const uuid = '00000000-0000-4000-8000-000000000001';
const reference = 'vitta-reset-' + uuid;
const event = { httpMethod: 'POST', headers: { origin: 'https://dolarmicaela-glitch.github.io' }, body: '{"amount":1,"currency":"USD"}' };
const session = () => signSession({ purpose: 'purchase', reference, amount: 49870, currency: 'ARS', expires: now + 10000 }, env.VITTA_ACCESS_SECRET);
const paymentEvent = () => ({ httpMethod: 'GET', headers: { origin: env.URL }, queryStringParameters: { session: session(), payment_id: '123456' } });
const payment = { id: 123456, external_reference: reference, transaction_amount: 49870, currency_id: 'ARS', live_mode: true, status: 'approved' };
const ok = body => ({ ok: true, json: async () => body });

test('server fixes the ARS price and returns only the Mercado Pago URL', async () => {
  let request;
  const handler = createCheckoutHandler({ env, now: () => now, uuid: () => uuid, fetchImpl: async (url, options) => { request = { url, options, body: JSON.parse(options.body) }; return ok({ init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test' }); } });
  const result = await handler(event);
  assert.equal(result.statusCode, 200);
  assert.equal(request.body.items[0].unit_price, 49870);
  assert.equal(request.body.items[0].currency_id, 'ARS');
  assert.equal(request.body.items[0].quantity, 1);
  assert.equal(request.body.payment_methods.installments, 1);
  assert.equal(request.body.external_reference, reference);
  assert.match(request.body.back_urls.success, /^https:\/\/vitta-test\.netlify\.app\/pagar-vitta\.html\?/);
  assert.equal(result.body.includes(env.MP_ACCESS_TOKEN), false);
  assert.equal(result.headers['Access-Control-Allow-Origin'], event.headers.origin);
});

test('missing secret or an untrusted origin never contacts Mercado Pago', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('must not run'); };
  const notConfigured = await createCheckoutHandler({ env: {}, fetchImpl })(event);
  assert.equal(notConfigured.statusCode, 503);
  const forbidden = await createCheckoutHandler({ env, fetchImpl })({ ...event, headers: { origin: 'https://evil.example' } });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(calls, 0);
});

test('GET cannot create a checkout and preflight is allowed only for known origins', async () => {
  const handler = createCheckoutHandler({ env });
  assert.equal((await handler({ ...event, httpMethod: 'GET' })).statusCode, 405);
  const preflight = await handler({ ...event, httpMethod: 'OPTIONS' });
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');
});

test('provider errors and unexpected redirect hosts are sanitized', async () => {
  const failure = await createCheckoutHandler({ env, fetchImpl: async () => ({ ok: false, json: async () => ({ access_token: env.MP_ACCESS_TOKEN }) }) })(event);
  assert.equal(failure.statusCode, 502);
  assert.equal(failure.body.includes(env.MP_ACCESS_TOKEN), false);
  const redirect = await createCheckoutHandler({ env, fetchImpl: async () => ok({ init_point: 'https://evil.example/pay' }) })(event);
  assert.equal(redirect.statusCode, 502);
});

test('payment approval is checked with the provider, including amount, currency and reference', async () => {
  const result = await paymentStatusHandler({ env, now: () => now, fetchImpl: async () => ok(payment) })(paymentEvent());
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { status: 'approved', payment_id: '123456', amount: 49870, currency: 'ARS' });
  for (const changes of [{ transaction_amount: 1 }, { currency_id: 'USD' }, { external_reference: 'another-order' }, { live_mode: false }]) {
    const mismatch = await paymentStatusHandler({ env, now: () => now, fetchImpl: async () => ok({ ...payment, ...changes }) })(paymentEvent());
    assert.equal(mismatch.statusCode, 409);
  }
});

test('forged and expired sessions cannot query payment information', async () => {
  let calls = 0;
  const handler = paymentStatusHandler({ env, now: () => now, fetchImpl: async () => { calls++; return ok(payment); } });
  const forged = paymentEvent(); forged.queryStringParameters.session += 'a';
  assert.equal((await handler(forged)).statusCode, 400);
  const expired = paymentEvent(); expired.queryStringParameters.session = signSession({ purpose: 'purchase', reference, amount: 49870, currency: 'ARS', expires: now - 1 }, env.VITTA_ACCESS_SECRET);
  assert.equal((await handler(expired)).statusCode, 400);
  assert.equal(calls, 0);
});

test('pending payments remain pending and are never reported as approved', async () => {
  const result = await paymentStatusHandler({ env, now: () => now, fetchImpl: async () => ok({ ...payment, status: 'pending' }) })(paymentEvent());
  assert.equal(JSON.parse(result.body).status, 'pending');
});

const fs = require('node:fs');
const vm = require('node:vm');
const frontendSource = fs.readFileSync(require.resolve('../assets/vitta-checkout.js'), 'utf8');
const accessSource = fs.readFileSync(require.resolve('../assets/vitta-access.js'), 'utf8');
async function runFrontend(search, status, hostname = 'vitta-test.netlify.app') {
  const nodes = new Map();
  const node = id => {
    if (id === 'program-access' || id === 'program-download-frame') return null;
    if (!nodes.has(id)) nodes.set(id, { id, textContent: '', hidden: ['programme-card', 'download-program'].includes(id), disabled: id === 'pay-button', dataset: {}, addEventListener(name, handler) { this[name] = handler; } });
    return nodes.get(id);
  };
  const navigations = [];
  const downloads = [];
  const requests = [];
  const values = new Map();
  const storage = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const context = vm.createContext({
    document: { getElementById: node, createElement: tag => ({ tag }), body: { appendChild: n => downloads.push(n) } },
    location: { search, hostname, origin: 'https://' + hostname, pathname: '/pagar-vitta.html', href: 'https://' + hostname + '/pagar-vitta.html' + search, assign: url => navigations.push(url) },
    history: { replaceState() {} }, localStorage: storage, sessionStorage: storage,
    URL, URLSearchParams, AbortSignal, encodeURIComponent,
    fetch: async (url, options) => {
      requests.push(String(url));
      if (String(url).includes('content/site.json')) return ok({ whatsapp: '543584012123', price_vitta_reset: '49.870' });
      if (String(url).includes('mp-program-access')) return ok({ status, payment_id: '123456', access_pass: 'signed-access', weeks: [{week:2},{week:3},{week:4}], download_url: 'https://vitta-test.netlify.app/.netlify/functions/mp-program-download?ticket=signed' });
      throw new Error('provider unavailable');
    }
  });
  context.window = context;
  vm.runInContext(accessSource, context);
  await vm.runInContext(frontendSource, context);
  return { node, requests, navigations, downloads };
}

test('a forged success query cannot unlock content or trigger a download', async () => {
  const ui = await runFrontend('?result=success');
  assert.equal(ui.node('payment-status').dataset.state, 'unknown');
  assert.equal(ui.node('pay-button').hidden, true);
  assert.equal(ui.node('programme-card').hidden, true);
  assert.equal(ui.downloads.length, 0);
  assert.equal(ui.requests.length, 1);
});

test('only a verified approved response enables the ZIP and starts the download', async () => {
  const pending = await runFrontend('?session=signed&payment_id=123456', 'pending');
  assert.equal(pending.node('payment-status').dataset.state, 'pending');
  assert.equal(pending.node('pay-button').hidden, true);
  assert.equal(pending.node('programme-card').hidden, true);
  assert.equal(pending.downloads.length, 0);
  const approved = await runFrontend('?session=signed&payment_id=123456', 'approved');
  assert.equal(approved.node('payment-status').dataset.state, 'approved');
  assert.equal(approved.node('purchase-card').hidden, true);
  assert.equal(approved.node('programme-card').hidden, false);
  assert.match(approved.node('mica-contact').href, /123456/);
  assert.equal(approved.downloads.length, 1);
  assert.equal(approved.navigations.length, 0);
});

test('an unconfigured GitHub Pages copy keeps payment disabled', async () => {
  const ui = await runFrontend('', undefined, 'dolarmicaela-glitch.github.io');
  assert.equal(ui.node('pay-button').disabled, true);
  assert.equal(ui.node('payment-error').hidden, false);
});

test('a checkout network failure allows retry without navigating', async () => {
  const ui = await runFrontend('');
  await ui.node('pay-button').click();
  assert.equal(ui.node('pay-button').disabled, false);
  assert.equal(ui.node('payment-error').hidden, false);
  assert.equal(ui.navigations.length, 0);
});
