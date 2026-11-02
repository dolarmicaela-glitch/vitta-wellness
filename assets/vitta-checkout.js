'use strict';

(async function () {
  const button = document.getElementById('pay-button');
  const error = document.getElementById('payment-error');
  const contact = document.getElementById('mica-contact');
  const statusBox = document.getElementById('payment-status');
  let apiBase;
  let whatsapp = '543584012123';

  function showError(message) { error.textContent = message; error.hidden = false; }
  function contactMessage(message) { contact.href = 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(message); }
  function showStatus(state, title, text) {
    statusBox.dataset.state = state;
    document.getElementById('status-title').textContent = title;
    document.getElementById('status-text').textContent = text;
    statusBox.hidden = false;
  }
  async function readJson(url, options = {}) {
    const result = await fetch(url, { ...options, cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) });
    let data;
    try { data = await result.json(); } catch { throw new Error('No pudimos completar la consulta. Intentá de nuevo o escribile a Mica.'); }
    if (!result.ok) throw new Error(data.error || 'No pudimos completar la consulta. Escribile a Mica para que te ayude.');
    return data;
  }

  try {
    const site = await readJson(new URL('content/site.json', location.href));
    if (/^\d{10,15}$/.test(String(site.whatsapp))) whatsapp = String(site.whatsapp);
    contactMessage('Hola, Mica. Te escribo por mi compra de VITTA Reset. Quiero coordinar la entrega del programa.');
    if (site.price_vitta_reset) document.getElementById('checkout-price').textContent = site.price_vitta_reset;
    if (site.checkout_api_base_url) {
      const candidate = new URL(site.checkout_api_base_url);
      if (candidate.protocol !== 'https:' || candidate.username || candidate.password) throw new Error('El pago online no está disponible en este momento. Escribile a Mica para comprar.');
      apiBase = candidate.origin;
    } else if (!location.hostname.endsWith('.github.io')) {
      apiBase = location.origin;
    } else {
      throw new Error('El pago online no está disponible en este momento. Escribile a Mica para comprar.');
    }
    button.disabled = false;
    const query = new URLSearchParams(location.search);
    const session = query.get('session');
    const paymentId = query.get('payment_id') || query.get('collection_id');
    if (session && paymentId && /^\d{1,25}$/.test(paymentId)) {
      button.disabled = true;
      showStatus('checking', 'Estamos consultando tu pago', 'Esperá un momento. Estamos comprobando el estado con Mercado Pago.');
      const url = new URL('/.netlify/functions/mp-payment-status', apiBase);
      url.searchParams.set('session', session); url.searchParams.set('payment_id', paymentId);
      try {
        const result = await readJson(url);
        if (result.status === 'approved') {
          showStatus('approved', 'Mercado Pago confirmó tu pago', 'El siguiente paso es comunicarte con Mica para recibir el programa.');
          document.getElementById('purchase-card').hidden = true;
          contactMessage('Hola, Mica. Compré VITTA Reset con Mercado Pago. Mi operación es ' + result.payment_id + '. Quiero coordinar la entrega del programa.');
        } else if (['pending', 'in_process', 'authorized', 'in_mediation'].includes(result.status)) {
          showStatus('pending', 'Tu pago todavía está pendiente', 'Revisá el estado en Mercado Pago antes de volver a pagar. Si necesitás ayuda, escribile a Mica.');
          button.hidden = true;
        } else {
          showStatus('rejected', 'Tu pago no figura aprobado', 'Revisá la operación en Mercado Pago. Podés escribirle a Mica si necesitás ayuda.');
          button.disabled = false;
        }
      } catch (statusError) {
        showStatus('unknown', 'Consultá el estado de tu pago', 'No pudimos confirmar la operación. Revisala en Mercado Pago antes de volver a pagar, o escribile a Mica.');
        button.hidden = true;
      }
    } else if (session || query.has('result')) {
      showStatus('unknown', 'Revisá tu compra con Mica', 'Si ya pagaste, enviá el comprobante por WhatsApp para coordinar la entrega del programa.');
      button.hidden = true;
    }
  } catch (configError) { showError(configError.message); }

  async function openCheckout() {
    if (!apiBase || button.disabled) return;
    button.disabled = true; button.textContent = 'Abriendo Mercado Pago…'; error.hidden = true;
    try {
      const data = await readJson(new URL('/.netlify/functions/mp-create-checkout', apiBase), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const checkout = new URL(data.checkout_url);
      if (checkout.protocol !== 'https:' || !['www.mercadopago.com.ar', 'mercadopago.com.ar', 'www.mercadopago.com', 'mercadopago.com'].includes(checkout.hostname) || checkout.username || checkout.password) throw new Error('No pudimos abrir el pago. Intentá de nuevo.');
      location.assign(checkout.href);
    } catch (paymentError) {
      showError(paymentError.message); button.disabled = false; button.textContent = 'Pagar con Mercado Pago';
    }
  }
  button.addEventListener('click', openCheckout);
  const startQuery = new URLSearchParams(location.search);
  if (startQuery.get('start') === '1' && !startQuery.has('session') && apiBase && !button.disabled) await openCheckout();
})();
