'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'dist');
const excluded = new Set(['dist', 'netlify', 'tests', 'docs', 'scripts', 'node_modules', 'package.json', 'package-lock.json']);
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target);
for (const name of fs.readdirSync(root)) {
  if (name.startsWith('.') || name.startsWith('draft-') || excluded.has(name) || name.endsWith('.zip')) continue;
  fs.cpSync(path.join(root, name), path.join(target, name), { recursive: true });
}
console.log('Publicación estática preparada en dist. El programa permanece en el almacén privado.');
