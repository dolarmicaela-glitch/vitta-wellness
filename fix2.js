const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '.netlify', 'index.html');
let c = fs.readFileSync(filePath, 'utf8');

// Fix Ó: UTF-8 0xC3 0x93 -> in Win-1252 0x93 = U+201C (left double quote)
c = c.split('Ã“').join('Ó'); // Ó

// Fix Ñ: UTF-8 0xC3 0x91 -> in Win-1252 0x91 = U+2018 (left single quote)
c = c.split('Ã‘').join('Ñ'); // Ñ

// Fix É: UTF-8 0xC3 0x89 -> in Win-1252 0x89 = U+2030 (per mille sign ‰)
c = c.split('Ã‰').join('É'); // É

// Fix Á: UTF-8 0xC3 0x81 -> 0x81 is undefined in Win-1252, may appear as control char
// Fix Ú: UTF-8 0xC3 0x9A -> in Win-1252 0x9A = U+0161 (š)
c = c.split('Ãš').join('Ú'); // Ú

// Fix Í: UTF-8 0xC3 0x8D -> 0x8D undefined in Win-1252

fs.writeFileSync(filePath, c, 'utf8');

const checks = ['HIDRATACIón','HIDRATACIÓN','HINCHAZÓN','VITTA ·','Hábitos','pequeños'];
checks.forEach(s => console.log(c.includes(s) ? 'OK: ' + s : 'MISSING: ' + s));
console.log('\nSample:', c.substring(31410, 31440));
