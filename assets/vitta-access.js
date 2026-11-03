'use strict';
(function () {
  const keys = { session: 'vitta-reset-purchase', access_pass: 'vitta-reset-access', payment_id: 'vitta-reset-payment' };
  const read = key => { try { return localStorage.getItem(keys[key]); } catch { return null; } };
  const save = (key, value) => { try { localStorage.setItem(keys[key], value); } catch { /* The paid response still works when storage is unavailable. */ } };
  async function json(url, options = {}) {
    const result = await fetch(url, { ...options, cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(30000) });
    let data;
    try { data = await result.json(); } catch { throw new Error('No pudimos completar la consulta. Intentá de nuevo o escribile a Mica.'); }
    if (!result.ok) throw new Error(data.error || 'No pudimos completar la consulta. Escribile a Mica.');
    return data;
  }
  const ready = (async () => {
    const site = await json(new URL('content/site.json', location.href));
    const base = site.checkout_api_base_url || (!location.hostname.endsWith('.github.io') && location.origin);
    if (!base) throw new Error('El pago online no está disponible en este momento. Escribile a Mica.');
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('No pudimos abrir el programa. Escribile a Mica.');
    return { site, apiBase: url.origin };
  })();
  // Attach a rejection handler even on a page that only restores access later.
  ready.catch(() => {});

  function credentials() {
    const access = read('access_pass');
    if (access) return { access_pass: access };
    const session = read('session');
    return session ? { session, payment_id: read('payment_id') || undefined } : null;
  }
  async function claim(explicit) {
    const { apiBase } = await ready;
    const body = explicit || credentials();
    if (!body) throw new Error('No encontramos una compra en este navegador. Abrí la página donde volviste de Mercado Pago o escribile a Mica para recuperar tu acceso.');
    const data = await json(new URL('/.netlify/functions/mp-program-access', apiBase), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (data.status === 'approved') {
      if (!data.access_pass || !Array.isArray(data.weeks) || data.weeks.length !== 3) throw new Error('No pudimos cargar tu programa. Intentá de nuevo o escribile a Mica.');
      save('access_pass', data.access_pass);
      save('payment_id', String(data.payment_id));
    }
    return data;
  }
  async function download(data) {
    const { apiBase } = await ready;
    if (!data || data.status !== 'approved') throw new Error('El pago todavía no está aprobado.');
    const url = new URL(data.download_url);
    if (url.protocol !== 'https:' || url.origin !== apiBase || url.pathname !== '/.netlify/functions/mp-program-download') throw new Error('No pudimos abrir la descarga.');
    const previous = document.getElementById('program-download-frame');
    if (previous) previous.remove();
    const frame = document.createElement('iframe');
    frame.id = 'program-download-frame'; frame.hidden = true; frame.title = 'Descarga del programa VITTA'; frame.referrerPolicy = 'no-referrer'; frame.src = url.href;
    document.body.appendChild(frame);
  }
  function renderWeeks(data) {
    if (!data || data.status !== 'approved' || !Array.isArray(data.weeks)) return;
    for (const week of data.weeks) {
      if (![2, 3, 4].includes(week.week)) continue;
      const card = document.querySelector('[data-paid-week="' + week.week + '"]');
      if (!card) continue;
      const node = (tag, className, text) => { const el = document.createElement(tag); el.className = className; el.textContent = text; return el; };
      const badge = node('div', 'plan30-week-badge', 'Semana ' + week.week);
      const title = node('div', 'plan30-week-title', week.title);
      const pillars = node('div', 'plan30-pillars', '');
      pillars.appendChild(node('span', 'plan30-pillar', week.pillar));
      const label = node('div', 'plan30-habits-label', week.label);
      const list = node('ul', 'plan30-list', '');
      for (const habit of week.habits) list.appendChild(node('li', '', habit));
      card.replaceChildren(badge, title, pillars, label, list);
      card.classList.remove('plan30-card--locked'); card.classList.add('is-unlocked');
    }
  }
  window.VittaAccess = { ready, json, claim, download, renderWeeks, credentials, rememberSession: session => { if (read('session') !== session) { try { localStorage.removeItem(keys.payment_id); } catch {} } save('session', session); }, rememberPayment: id => save('payment_id', id) };

  const panel = document.getElementById('program-access');
  if (!panel) return;
  const message = document.getElementById('program-access-message');
  const restore = document.getElementById('restore-program');
  const downloadButton = document.getElementById('download-program');
  const otherOrigin = document.getElementById('continue-program');
  async function restoreProgramme(startDownload = false) {
    restore.disabled = true; downloadButton.disabled = true;
    message.textContent = 'Estamos comprobando tu acceso…';
    try {
      const data = await claim();
      if (data.status !== 'approved') throw new Error('Tu pago todavía no figura aprobado. Revisalo en Mercado Pago o escribile a Mica.');
      renderWeeks(data);
      message.textContent = 'Tu programa está habilitado. Ya podés ver las semanas 2, 3 y 4 y descargar el ZIP.';
      restore.hidden = true; otherOrigin.hidden = true; downloadButton.hidden = false;
      if (startDownload) await download(data);
    } catch (error) {
      message.textContent = error.message;
      if (location.hostname.endsWith('.github.io')) otherOrigin.hidden = false;
    } finally { restore.disabled = false; downloadButton.disabled = false; }
  }
  restore.addEventListener('click', () => restoreProgramme());
  downloadButton.addEventListener('click', () => restoreProgramme(true));
  if (credentials()) restoreProgramme();
})();
