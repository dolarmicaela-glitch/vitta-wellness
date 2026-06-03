const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'index.html'),
  path.join(__dirname, '.netlify', 'index.html')
];

for (const filePath of files) {
  let c = fs.readFileSync(filePath, 'utf8');

  // Fix arrow symbols - use unicode escapes
  c = c.split('â').join('↓'); // â†" -> ↓
  c = c.split('â').join('→'); // â†' -> →
  c = c.split('â').join('✕'); // âœ• -> ✕

  // Fix remaining Spanish accents
  c = c.split('Ã³').join('ó'); // Ã³ -> ó
  c = c.split('Ã©').join('é'); // Ã© -> é
  c = c.split('Ã¡').join('á'); // Ã¡ -> á
  c = c.split('Ã­').join('í'); // Ã­ -> í
  c = c.split('Ãº').join('ú'); // Ãº -> ú
  c = c.split('Ã±').join('ñ'); // Ã± -> ñ
  c = c.split('Â·').join('·'); // Â· -> ·
  c = c.split('Â©').join('©'); // Â© -> ©
  c = c.split('Â¿').join('¿'); // Â¿ -> ¿
  c = c.split('Â¡').join('¡'); // Â¡ -> ¡

  fs.writeFileSync(filePath, c, 'utf8');
  console.log('Fixed:', path.basename(path.dirname(filePath)) + '/' + path.basename(filePath));
  console.log('  Arrow down OK:', c.includes('↓ Obtener'));
}
