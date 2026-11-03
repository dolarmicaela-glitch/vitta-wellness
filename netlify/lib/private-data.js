'use strict';

// The store has no public route. Neither the ZIP nor paid lessons enter Git.
async function privateStore() {
  const { getStore } = await import('@netlify/blobs');
  return getStore('vitta-program-private');
}

async function programmeManifest(store) {
  store ||= await privateStore();
  const manifest = await store.get('active', { type: 'json', consistency: 'strong' });
  if (!manifest || !/^programs\/[a-f0-9]{64}\.zip$/.test(manifest.zipKey || '') ||
      !/^programs\/[a-f0-9]{64}\.json$/.test(manifest.weeksKey || '') ||
      !Number.isInteger(manifest.size) || manifest.size < 4 || manifest.size > 19 * 1024 * 1024) return null;
  return manifest;
}

module.exports = { privateStore, programmeManifest };
