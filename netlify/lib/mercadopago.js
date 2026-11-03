'use strict';

const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const site = require('../../content/site.json');
const API = 'https://api.mercadopago.com';
const SOURCE_ORIGIN = 'https://dolarmicaela-glitch.github.io';

class CheckoutError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function settings(env = process.env) {
  const accessToken = env.MP_ACCESS_TOKEN;
  const signingKey = env.VITTA_ACCESS_SECRET;
  const rawUrl = env.CHECKOUT_SITE_URL || env.URL || site.checkout_api_base_url;
  const amount = Number(String(site.price_vitta_reset).replace(/\./g, '').replace(',', '.'));
  if (!accessToken || !signingKey || signingKey.length < 32 || !rawUrl) throw new CheckoutError(503, 'El pago online no está disponible en este momento.');
  let url;
  try { url = new URL(rawUrl); } catch { throw new CheckoutError(503, 'El pago online no está disponible en este momento.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !Number.isFinite(amount) || amount <= 0) {
    throw new CheckoutError(503, 'El pago online no está disponible en este momento.');
  }
  return { accessToken, signingKey, origin: url.origin, amount, currency: 'ARS', whatsapp: site.whatsapp };
}

function response(statusCode, data, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return { statusCode, headers, body: JSON.stringify(data) };
}

function requestOrigin(event, config) {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin;
  if (origin && origin !== SOURCE_ORIGIN && origin !== config.origin) throw new CheckoutError(403, 'Solicitud no permitida.');
  return origin;
}

function signSession(payload, key) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + createHmac('sha256', key).update(body).digest('base64url');
}

function readSession(value, key, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 1600) throw new CheckoutError(400, 'No pudimos identificar esta compra.');
  const parts = value.split('.');
  if (parts.length !== 2 || !parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) throw new CheckoutError(400, 'No pudimos identificar esta compra.');
  const expected = createHmac('sha256', key).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], 'base64url');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new CheckoutError(400, 'No pudimos identificar esta compra.');
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { throw new CheckoutError(400, 'No pudimos identificar esta compra.'); }
  if (!/^vitta-reset-[0-9a-f-]{36}$/.test(payload.reference || '') || payload.currency !== 'ARS' || !Number.isFinite(payload.amount) || payload.amount <= 0 || !Number.isFinite(payload.expires) || payload.expires < now) {
    throw new CheckoutError(400, 'El enlace de esta compra venció. Escribile a Mica para consultar tu pago.');
  }
  return payload;
}

async function mercadoRequest(path, options, config, fetchImpl = fetch) {
  let result;
  try {
    result = await fetchImpl(API + path, {
      ...options,
      headers: { 'Authorization': 'Bearer ' + config.accessToken, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
  } catch { throw new CheckoutError(502, 'No pudimos comunicarnos con Mercado Pago. Intentá de nuevo o escribile a Mica.'); }
  if (!result.ok) throw new CheckoutError(502, 'Mercado Pago no pudo completar la consulta. Intentá de nuevo o escribile a Mica.');
  try { return await result.json(); } catch { throw new CheckoutError(502, 'No pudimos leer la respuesta de Mercado Pago.'); }
}

function safeError(error, origin) {
  return response(error instanceof CheckoutError ? error.status : 500,
    { error: error instanceof CheckoutError ? error.message : 'No pudimos procesar la solicitud. Escribile a Mica para que te ayude.' }, origin);
}

function createCheckoutHandler({ env, fetchImpl, now = () => Date.now(), uuid = randomUUID, programmeReady = () => require('./private-data').programmeManifest() } = {}) {
  return async function handler(event) {
    let origin;
    try {
      const config = settings(env);
      origin = requestOrigin(event, config);
      if (event.httpMethod === 'OPTIONS') return { ...response(204, {}, origin), body: '', headers: { ...response(204, {}, origin).headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
      if (event.httpMethod !== 'POST') return response(405, { error: 'Método no permitido.' }, origin);
      if (!origin) throw new CheckoutError(403, 'Solicitud no permitida.');
      if ((event.body || '').length > 2048) throw new CheckoutError(413, 'Solicitud demasiado grande.');
      if (!await programmeReady()) throw new CheckoutError(503, 'Estamos preparando el programa. Escribile a Mica para consultar.');
      const reference = 'vitta-reset-' + uuid();
      const expires = now() + 24 * 60 * 60 * 1000;
      const session = signSession({ purpose: 'purchase', reference, amount: config.amount, currency: config.currency, expires: now() + 10 * 365 * 24 * 60 * 60 * 1000 }, config.signingKey);
      const returnUrl = new URL('/pagar-vitta.html', config.origin);
      returnUrl.searchParams.set('session', session);
      const backUrls = {};
      for (const status of ['success', 'pending', 'failure']) {
        const back = new URL(returnUrl); back.searchParams.set('result', status); backUrls[status] = back.href;
      }
      const preference = await mercadoRequest('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ id: 'vitta-reset', title: 'VITTA Reset', description: 'Programa digital VITTA Reset · pago único', quantity: 1, currency_id: config.currency, unit_price: config.amount }],
          external_reference: reference,
          metadata: { product: 'vitta-reset' },
          back_urls: backUrls,
          auto_return: 'approved',
          payment_methods: { installments: 1, default_installments: 1 },
          statement_descriptor: 'VITTA RESET',
          expires: true,
          expiration_date_to: new Date(expires).toISOString()
        })
      }, config, fetchImpl);
      let checkoutUrl;
      try { checkoutUrl = new URL(preference.init_point); } catch { throw new CheckoutError(502, 'No pudimos abrir el pago. Intentá de nuevo.'); }
      if (checkoutUrl.protocol !== 'https:' || !['www.mercadopago.com.ar', 'mercadopago.com.ar', 'www.mercadopago.com', 'mercadopago.com'].includes(checkoutUrl.hostname) || checkoutUrl.username || checkoutUrl.password) {
        throw new CheckoutError(502, 'No pudimos abrir el pago. Intentá de nuevo.');
      }
      return response(200, { checkout_url: checkoutUrl.href, session }, origin);
    } catch (error) { return safeError(error, origin); }
  };
}

function paymentStatusHandler({ env, fetchImpl, now = () => Date.now() } = {}) {
  return async function handler(event) {
    let origin;
    try {
      const config = settings(env);
      origin = requestOrigin(event, config);
      if (event.httpMethod !== 'GET') return response(405, { error: 'Método no permitido.' }, origin);
      const query = event.queryStringParameters || {};
      if (!/^\d{1,25}$/.test(query.payment_id || '')) throw new CheckoutError(400, 'No pudimos identificar el pago.');
      const session = readSession(query.session, config.signingKey, now());
      if (session.purpose !== 'purchase') throw new CheckoutError(400, 'No pudimos identificar esta compra.');
      const payment = await mercadoRequest('/v1/payments/' + query.payment_id, { method: 'GET' }, config, fetchImpl);
      if (payment.external_reference !== session.reference || payment.currency_id !== session.currency || Number(payment.transaction_amount) !== session.amount || payment.live_mode !== true) {
        throw new CheckoutError(409, 'El pago no corresponde a esta compra. Escribile a Mica para revisarlo.');
      }
      const statuses = new Set(['approved', 'pending', 'in_process', 'rejected', 'cancelled', 'refunded', 'charged_back', 'in_mediation', 'authorized']);
      const status = statuses.has(payment.status) ? payment.status : 'unknown';
      return response(200, { status, payment_id: String(payment.id), amount: session.amount, currency: session.currency }, origin);
    } catch (error) { return safeError(error, origin); }
  };
}

module.exports = { createCheckoutHandler, paymentStatusHandler, signSession, readSession, settings, CheckoutError, mercadoRequest, requestOrigin, response, safeError };
