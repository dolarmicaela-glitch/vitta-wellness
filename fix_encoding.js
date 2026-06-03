const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '.netlify', 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

// All replacements use \u escapes to avoid any encoding issues in this script
const fixes = [
  // Lowercase accented vowels/n
  ['Ã¡', 'á'], // Ã¡ -> á
  ['Ã©', 'é'], // Ã© -> é
  ['Ã­', 'í'], // Ã­ -> í
  ['Ã³', 'ó'], // Ã³ -> ó
  ['Ãº', 'ú'], // Ãº -> ú
  ['Ã±', 'ñ'], // Ã± -> ñ
  ['Ã¼', 'ü'], // Ã¼ -> ü
  // Uppercase
  ['Ã', 'É'], // Ã‰ -> É
  ['Ã', 'Ó'], // Ã" -> Ó
  ['Ã', 'Ú'], // Ãš -> Ú
  ['Ã', 'Ñ'], // Ã' -> Ñ
  ['Ã', 'Á'], // Ã  -> Á
  ['Ã', 'Í'], // Ã  -> Í
  // Punctuation
  ['Â©', '©'], // Â© -> ©
  ['Â·', '·'], // Â· -> ·
  ['Â¿', '¿'], // Â¿ -> ¿
  ['Â¡', '¡'], // Â¡ -> ¡
  // Arrow ->
  ['â', '→'], // â†' -> →
  // Copyright already as ©
  // Heart
  ['â¤', '❤'], // â¤ -> ❤
];

let count = 0;
for (const [bad, good] of fixes) {
  if (content.includes(bad)) {
    content = content.split(bad).join(good);
    count++;
    console.log('Fixed:', JSON.stringify(bad), '->', good);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\nTotal fixed:', count);

// Spot checks
['Hábitos','HIDRATACIÓN','HINCHAZÓN','pequeños','©','VITTA ·'].forEach(s => {
  if (content.includes(s)) console.log('OK:', s);
  else console.log('MISSING:', s);
});
