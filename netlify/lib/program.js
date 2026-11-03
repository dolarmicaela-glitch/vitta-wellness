'use strict';

const { settings, readSession, signSession, mercadoRequest, CheckoutError, requestOrigin, response, safeError } = require('./mercadopago');
const { privateStore, programmeManifest } = require('./private-data');

function purchaseClaim(value, config, now, purpose) {
  const claim = readSession(value, config.signingKey, now);
  if (claim.purpose !== purpose || (purpose !== 'purchase' && !/^\d{1,25}$/.test(claim.payment_id || ''))) {
    throw new CheckoutError(400, 'No pudimos identificar tu acceso.');
  }
  return claim;
}

function matchingPayment(payment, claim) {
  return payment && /^\d{1,25}$/.test(String(payment.id)) && payment.external_reference === claim.reference &&
    payment.currency_id === claim.currency && Number(payment.transaction_amount) === claim.amount && payment.live_mode === true;
}

async function findPayment(claim, paymentId, config, fetchImpl) {
  let payment;
  if (paymentId) {
    if (!/^\d{1,25}$/.test(String(paymentId))) throw new CheckoutError(400, 'No pudimos identificar el pago.');
    payment = await mercadoRequest('/v1/payments/' + paymentId, { method: 'GET' }, config, fetchImpl);
    if (String(payment.id) !== String(paymentId)) throw new CheckoutError(409, 'El pago no corresponde a esta compra.');
  } else {
    const query = new URLSearchParams({ external_reference: claim.reference, limit: '50', sort: 'date_created', criteria: 'desc' });
    const search = await mercadoRequest('/v1/payments/search?' + query, { method: 'GET' }, config, fetchImpl);
    const matches = (Array.isArray(search.results) ? search.results : []).filter(p => matchingPayment(p, claim));
    // Read the selected payment again; a cached search result cannot grant access.
    const candidate = matches.find(p => p.status === 'approved') || matches[0];
    if (!candidate) return { status: 'not_found' };
    payment = await mercadoRequest('/v1/payments/' + candidate.id, { method: 'GET' }, config, fetchImpl);
    if (String(payment.id) !== String(candidate.id)) throw new CheckoutError(409, 'El pago no corresponde a esta compra.');
  }
  if (!matchingPayment(payment, claim)) throw new CheckoutError(409, 'El pago no corresponde a esta compra. Escribile a Mica para revisarlo.');
  return payment;
}

function programAccessHandler({ env, fetchImpl, now = () => Date.now(), getStore = privateStore } = {}) {
  return async event => {
    let origin;
    try {
      const config = settings(env);
      origin = requestOrigin(event, config);
      if (event.httpMethod === 'OPTIONS') return { ...response(204, {}, origin), body: '', headers: { ...response(204, {}, origin).headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
      if (event.httpMethod !== 'POST') return response(405, { error: 'Método no permitido.' }, origin);
      if (!origin) throw new CheckoutError(403, 'Solicitud no permitida.');
      if ((event.body || '').length > 5000) throw new CheckoutError(413, 'Solicitud demasiado grande.');
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { throw new CheckoutError(400, 'Solicitud inválida.'); }
      const claim = body.access_pass ? purchaseClaim(body.access_pass, config, now(), 'access') : purchaseClaim(body.session, config, now(), 'purchase');
      const payment = await findPayment(claim, claim.payment_id || body.payment_id, config, fetchImpl);
      if (payment.status !== 'approved') return response(200, { status: payment.status || 'unknown' }, origin);
      const store = await getStore();
      const manifest = await programmeManifest(store);
      if (!manifest) throw new CheckoutError(503, 'Tu pago está aprobado. Estamos preparando la descarga; escribile a Mica para recibir ayuda.');
      const weeks = await store.get(manifest.weeksKey, { type: 'json', consistency: 'strong' });
      if (!validWeeks(weeks)) throw new CheckoutError(503, 'No pudimos cargar tus semanas. Escribile a Mica.');
      const base = { reference: claim.reference, amount: claim.amount, currency: claim.currency, payment_id: String(payment.id) };
      const accessPass = signSession({ ...base, purpose: 'access', expires: now() + 10 * 365 * 24 * 60 * 60 * 1000 }, config.signingKey);
      const ticket = signSession({ ...base, purpose: 'download', expires: now() + 5 * 60 * 1000 }, config.signingKey);
      const download = new URL('/.netlify/functions/mp-program-download', config.origin);
      download.searchParams.set('ticket', ticket);
      return response(200, { status: 'approved', payment_id: String(payment.id), access_pass: accessPass, weeks, download_url: download.href }, origin);
    } catch (error) { return safeError(error, origin); }
  };
}

function validWeeks(weeks) {
  return Array.isArray(weeks) && weeks.length === 3 && weeks.every((w, i) => w && w.week === i + 2 &&
    typeof w.title === 'string' && w.title.length > 0 && w.title.length <= 120 &&
    typeof w.pillar === 'string' && w.pillar.length <= 240 && typeof w.label === 'string' && w.label.length <= 80 &&
    Array.isArray(w.habits) && w.habits.length > 0 && w.habits.length <= 20 && w.habits.every(h => typeof h === 'string' && h.length > 0 && h.length <= 1000));
}

function programDownloadHandler({ env, fetchImpl, now = () => Date.now(), getStore = privateStore } = {}) {
  return async request => {
    const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
    try {
      if (request.method !== 'GET') return new Response('Método no permitido.', { status: 405, headers });
      const config = settings(env);
      const claim = purchaseClaim(new URL(request.url).searchParams.get('ticket'), config, now(), 'download');
      const payment = await findPayment(claim, claim.payment_id, config, fetchImpl);
      if (payment.status !== 'approved') throw new CheckoutError(403, 'El pago todavía no está aprobado o ya no está vigente.');
      const store = await getStore();
      const manifest = await programmeManifest(store);
      if (!manifest) throw new CheckoutError(503, 'La descarga no está disponible. Escribile a Mica.');
      const stream = await store.get(manifest.zipKey, { type: 'stream', consistency: 'strong' });
      if (!stream) throw new CheckoutError(503, 'La descarga no está disponible. Escribile a Mica.');
      // A ReadableStream avoids Netlify's smaller buffered response limit.
      return new Response(stream, { headers: { ...headers, 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="VITTA_Reset_Programa_Completo.zip"' } });
    } catch (error) {
      return new Response(error instanceof CheckoutError ? error.message : 'No pudimos descargar el programa. Intentá de nuevo.', { status: error instanceof CheckoutError ? error.status : 500, headers });
    }
  };
}

module.exports = { programAccessHandler, programDownloadHandler, validWeeks };
