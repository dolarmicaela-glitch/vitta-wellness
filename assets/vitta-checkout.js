'use strict';
(async function () {
  const access = window.VittaAccess;
  const button = document.getElementById('pay-button');
  const error = document.getElementById('payment-error');
  const contact = document.getElementById('mica-contact');
  const statusBox = document.getElementById('payment-status');
  const downloadButton = document.getElementById('download-program');
  let apiBase;
  let whatsapp = '543584012123';
  let purchase;
  function showError(message) { error.textContent = message; error.hidden = false; }
  function contactMessage(message) { contact.href = 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(message); }
  function showStatus(state, title, text) {
    statusBox.dataset.state = state;
    document.getElementById('status-title').textContent = title;
    document.getElementById('status-text').textContent = text;
    statusBox.hidden = false;
  }
  async function verifyPurchase(autoDownload = false) {
    button.disabled = true;
    document.getElementById('check-payment').disabled = true;
    showStatus('checking', 'Estamos consultando tu pago', 'Esperá un momento. Mercado Pago está comprobando la operación.');
    try {
      const result = await access.claim(purchase);
      if (result.status === 'approved') {
        showStatus('approved', 'Mercado Pago confirmó tu pago', 'Tu programa está habilitado. Si la descarga no comienza, tocá «Descargar ZIP completo».');
        document.getElementById('purchase-card').hidden = true;
        document.getElementById('programme-card').hidden = false;
        document.getElementById('check-payment').hidden = true;
        contactMessage('Hola, Mica. Compré VITTA Reset con Mercado Pago. Mi operación es ' + result.payment_id + '. Quiero hablar con vos sobre el programa.');
        let alreadyDownloaded = false;
        try { alreadyDownloaded = sessionStorage.getItem('vitta-download-' + result.payment_id) === 'started'; } catch { /* Optional convenience. */ }
        if (autoDownload && !alreadyDownloaded) {
          await access.download(result);
          try { sessionStorage.setItem('vitta-download-' + result.payment_id, 'started'); } catch { /* Optional convenience. */ }
        }
      } else if (['pending', 'in_process', 'authorized', 'in_mediation', 'not_found'].includes(result.status)) {
        showStatus('pending', 'Tu pago todavía está pendiente', 'El ZIP y las semanas se habilitan cuando se acredita. Podés volver a consultar el estado sin pagar otra vez.');
        button.hidden = true;
        document.getElementById('check-payment').hidden = false;
      } else {
        showStatus('rejected', 'Tu pago no figura aprobado', 'Revisá la operación en Mercado Pago o escribile a Mica si necesitás ayuda.');
        button.disabled = false;
      }
    } catch (verificationError) {
      showStatus('unknown', 'No pudimos confirmar tu acceso', verificationError.message);
      button.hidden = true;
      document.getElementById('check-payment').hidden = false;
    } finally { document.getElementById('check-payment').disabled = false; }
  }
  try {
    const config = await access.ready;
    apiBase = config.apiBase;
    if (/^\d{10,15}$/.test(String(config.site.whatsapp))) whatsapp = String(config.site.whatsapp);
    contactMessage('Hola, Mica. Te escribo por VITTA Reset. Quiero hacerte una consulta.');
    if (config.site.price_vitta_reset) document.getElementById('checkout-price').textContent = config.site.price_vitta_reset;
    button.disabled = false;
    const query = new URLSearchParams(location.search);
    const session = query.get('session');
    const paymentId = query.get('payment_id') || query.get('collection_id');
    if (session) {
      access.rememberSession(session);
      if (paymentId && /^\d{1,25}$/.test(paymentId)) access.rememberPayment(paymentId);
      purchase = { session, payment_id: paymentId || undefined };
      try { history.replaceState(null, '', location.pathname); } catch { /* Does not control access. */ }
      await verifyPurchase(true);
    } else if (query.has('result')) {
      showStatus('unknown', 'Revisá tu compra con Mica', 'No encontramos la identificación de la compra. Escribile a Mica para recuperar tu acceso.');
      button.hidden = true;
    } else if (query.get('start') !== '1' && access.credentials()) {
      await verifyPurchase();
    }
  } catch (configError) { showError(configError.message); }

  async function openCheckout() {
    if (!apiBase || button.disabled) return;
    button.disabled = true; button.textContent = 'Abriendo Mercado Pago…'; error.hidden = true;
    try {
      const data = await access.json(new URL('/.netlify/functions/mp-create-checkout', apiBase), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const checkout = new URL(data.checkout_url);
      if (!data.session || checkout.protocol !== 'https:' || !['www.mercadopago.com.ar', 'mercadopago.com.ar', 'www.mercadopago.com', 'mercadopago.com'].includes(checkout.hostname) || checkout.username || checkout.password) throw new Error('No pudimos abrir el pago. Intentá de nuevo.');
      access.rememberSession(data.session);
      location.assign(checkout.href);
    } catch (paymentError) { showError(paymentError.message); button.disabled = false; button.textContent = 'Pagar con Mercado Pago'; }
  }
  button.addEventListener('click', openCheckout);
  document.getElementById('check-payment').addEventListener('click', () => verifyPurchase(true));
  downloadButton.addEventListener('click', async () => {
    downloadButton.disabled = true;
    try { await access.download(await access.claim(purchase)); } catch (downloadError) { showError(downloadError.message); }
    finally { downloadButton.disabled = false; }
  });
  const startQuery = new URLSearchParams(location.search);
  if (startQuery.get('start') === '1' && !startQuery.has('session') && apiBase && !button.disabled) await openCheckout();
})();
