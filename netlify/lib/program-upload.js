'use strict';
const { createHash, timingSafeEqual } = require('node:crypto');
const { privateStore } = require('./private-data');
const { validWeeks } = require('./program');

const CHUNK_BYTES = 3 * 1024 * 1024;
const MAX_BYTES = 19 * 1024 * 1024;
const hash = data => createHash('sha256').update(data).digest('hex');

function programUploadHandler({ env = process.env, getStore = privateStore } = {}) {
  return async request => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    try {
      const key = env.VITTA_UPLOAD_KEY;
      const given = request.headers.get('authorization') || '';
      const expected = 'Bearer ' + key;
      if (!key || key.length < 32 || Buffer.byteLength(given) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return reply(404, { error: 'No disponible.' });
      if (request.headers.get('origin') !== new URL(request.url).origin) return reply(403, { error: 'Solicitud no permitida.' });
      if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' });
      const store = await getStore();
      const usedKey = 'setup-used/' + hash(key);
      if (await store.get(usedKey, { consistency: 'strong' })) return reply(404, { error: 'La carga inicial ya se completó.' });
      const url = new URL(request.url);
      const id = url.searchParams.get('id') || '';
      if (!/^[0-9a-f-]{36}$/.test(id)) return reply(400, { error: 'Carga inválida.' });
      if (url.searchParams.get('mode') === 'chunk') {
        const index = Number(url.searchParams.get('index'));
        if (!Number.isInteger(index) || index < 0 || index > 6 || Number(request.headers.get('content-length')) > CHUNK_BYTES) return reply(413, { error: 'Bloque demasiado grande.' });
        const bytes = await request.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > CHUNK_BYTES) return reply(413, { error: 'Bloque inválido.' });
        await store.set('uploads/' + id + '/' + index, bytes);
        return reply(200, { uploaded: index });
      }
      if (url.searchParams.get('mode') !== 'finish' || Number(request.headers.get('content-length')) > 64000) return reply(400, { error: 'Carga inválida.' });
      const raw = await request.text();
      if (raw.length > 64000) return reply(413, { error: 'Carga demasiado grande.' });
      let body;
      try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Datos inválidos.' }); }
      if (!Number.isInteger(body.chunks) || body.chunks < 1 || body.chunks > 7 || !Number.isInteger(body.size) || body.size < 4 || body.size > MAX_BYTES || !/^[a-f0-9]{64}$/.test(body.sha256 || '') || !validWeeks(body.weeks)) return reply(400, { error: 'Revisá el ZIP y las semanas.' });
      const blocks = [];
      for (let i = 0; i < body.chunks; i++) {
        const block = await store.get('uploads/' + id + '/' + i, { type: 'arrayBuffer', consistency: 'strong' });
        if (!block || block.byteLength > CHUNK_BYTES || blocks.reduce((total, b) => total + b.length, 0) + block.byteLength > MAX_BYTES) return reply(400, { error: 'La carga está incompleta.' });
        blocks.push(Buffer.from(block));
      }
      const zip = Buffer.concat(blocks);
      if (zip.length !== body.size || zip.readUInt32LE(0) !== 0x04034b50 || hash(zip) !== body.sha256) return reply(400, { error: 'El ZIP no coincide con el archivo original.' });
      const weeksText = JSON.stringify(body.weeks);
      const zipKey = 'programs/' + body.sha256 + '.zip';
      const weeksKey = 'programs/' + hash(weeksText) + '.json';
      await store.set(zipKey, zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength));
      await store.set(weeksKey, weeksText);
      await store.setJSON('active', { zipKey, weeksKey, size: zip.length, sha256: body.sha256 });
      await store.set(usedKey, 'complete');
      await Promise.allSettled(blocks.map((_, i) => store.delete('uploads/' + id + '/' + i)));
      return reply(200, { ready: true, size: zip.length, sha256: body.sha256 });
    } catch { return reply(500, { error: 'No pudimos completar la carga. Los archivos activos se conservan; intentá de nuevo.' }); }
  };
}

module.exports = { programUploadHandler };
