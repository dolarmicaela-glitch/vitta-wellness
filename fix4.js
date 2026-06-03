const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'index.html'),
  path.join(__dirname, '.netlify', 'index.html')
];

for (const filePath of files) {
  let c = fs.readFileSync(filePath, 'utf8');

  // Arrow down: UTF-8 0xE2 0x86 0x93 misread as â + dagger(U+2020) + left-dquote(U+201C)
  c = c.split('â†“').join('↓'); // â†" -> ↓

  // Arrow right: UTF-8 0xE2 0x86 0x92 misread as â + dagger(U+2020) + right-squote(U+2019)
  c = c.split('â†’').join('→'); // â†' -> →

  // Cross: UTF-8 0xE2 0x9C 0x95 misread as â + TM(U+2122) + ...
  c = c.split('â•').join('✕'); // âœ• -> ✕

  // Em dash ─: UTF-8 0xE2 0x94 0x80
  c = c.split('â”€').join('─'); // â"€ -> ─

  // Heart ❤: UTF-8 0xE2 0x9D 0xA4
  c = c.split('â¤').join('❤'); // â¤ -> ❤

  fs.writeFileSync(filePath, c, 'utf8');
  console.log('Fixed:', path.basename(filePath));
  console.log('  Arrow down OK:', c.includes('↓ Obtener'));
  console.log('  Sample btn:', c.substring(c.indexOf('Obtener') - 5, c.indexOf('Obtener') + 10));
}
