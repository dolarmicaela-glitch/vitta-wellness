const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');

// The file has been double-encoded: original UTF-8 was read as latin1/windows-1252
// and then saved again as UTF-8, creating mojibake.
// To fix: read as UTF-8 (current state), encode each char back to latin1 bytes,
// then re-decode those bytes as UTF-8.
const currentContent = fs.readFileSync(filePath, 'utf8');

// Convert: treat the current UTF-8 string as if each char is a Latin-1 byte value
// then re-decode as UTF-8
const bytes = Buffer.alloc(currentContent.length);
for (let i = 0; i < currentContent.length; i++) {
  bytes[i] = currentContent.charCodeAt(i) & 0xFF;
}

let fixed;
try {
  fixed = bytes.toString('utf8');
} catch(e) {
  console.error('UTF-8 decode failed:', e.message);
  process.exit(1);
}

// Spot checks
const good = ['↓', '→', '★', 'á', 'é', 'ó', 'ñ', '·', '©', '—'];
const names = ['down-arrow', 'right-arrow', 'star', 'a-acute', 'e-acute', 'o-acute', 'n-tilde', 'middle-dot', 'copyright', 'em-dash'];
good.forEach((ch, i) => {
  console.log((fixed.includes(ch) ? 'OK' : 'MISSING') + ': ' + names[i] + ' (' + ch + ')');
});

fs.writeFileSync(filePath, fixed, 'utf8');
fs.writeFileSync(path.join(__dirname, '.netlify', 'index.html'), fixed, 'utf8');
console.log('\nDone - size:', fixed.length, 'chars');
