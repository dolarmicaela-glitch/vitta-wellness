'use strict';
document.getElementById('upload-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('upload-button');
  const status = document.getElementById('upload-status');
  const key = document.getElementById('upload-key');
  button.disabled = true;
  try {
    const zip = document.getElementById('upload-zip').files[0];
    const weeksFile = document.getElementById('upload-weeks').files[0];
    if (!zip || !weeksFile || zip.size < 4 || zip.size > 19 * 1024 * 1024 || weeksFile.size > 32000) throw new Error('Revisá los archivos seleccionados.');
    const weeks = JSON.parse(await weeksFile.text());
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await zip.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
    const id = crypto.randomUUID();
    const chunkSize = 3 * 1024 * 1024;
    const chunks = Math.ceil(zip.size / chunkSize);
    async function send(mode, index, body, type) {
      const url = new URL('/.netlify/functions/mp-program-upload', location.origin);
      url.searchParams.set('mode', mode); url.searchParams.set('id', id);
      if (index !== null) url.searchParams.set('index', index);
      const result = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + key.value, 'Content-Type': type }, body, cache: 'no-store', referrerPolicy: 'no-referrer' });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'No pudimos guardar el programa.');
      return data;
    }
    for (let i = 0; i < chunks; i++) {
      status.textContent = 'Cargando programa: bloque ' + (i + 1) + ' de ' + chunks + '…';
      await send('chunk', i, zip.slice(i * chunkSize, (i + 1) * chunkSize), 'application/octet-stream');
    }
    status.textContent = 'Verificando el archivo y guardando las semanas…';
    const result = await send('finish', null, JSON.stringify({ chunks, size: zip.size, sha256: checksum, weeks }), 'application/json');
    if (!result.ready || result.sha256 !== checksum) throw new Error('No pudimos verificar el archivo guardado.');
    key.value = '';
    document.getElementById('upload-form').hidden = true;
    status.textContent = 'Programa guardado y verificado. La carga inicial quedó deshabilitada. ZIP: ' + result.size + ' bytes.';
  } catch (error) { status.textContent = error.message; button.disabled = false; }
});
