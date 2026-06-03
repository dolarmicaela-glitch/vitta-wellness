const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index_original.html');
let html = fs.readFileSync(filePath, 'utf16le');

// Ebook section prices (shown as plain numbers in contenteditable spans within ebook-price)
// Plan 1 - Despertá tu metabolismo: 49 → 12.990
html = html.replace(
  /(<div class="ebook-price-row">[\s\S]*?<span contenteditable="true" ?>)49(<\/span>)/,
  '$112.990$2'
);

// Plan 2 - Equilibrio hormonal: 65 → 12.990
html = html.replace(
  /(<div class="ebook-price-row">[\s\S]*?<span contenteditable="true" ?>)65(<\/span>)/,
  '$112.990$2'
);

// Plan 3 - Fuerza & Metabolismo: 55 → 12.990
html = html.replace(
  /(<div class="ebook-price-row">[\s\S]*?<span contenteditable="true" ?>)55(<\/span>)/,
  '$112.990$2'
);

// Plan 4 - Adiós hinchazón: 59 → 14.990
html = html.replace(
  /(<div class="ebook-price-row">[\s\S]*?<span contenteditable="true" ?>)59(<\/span>)/,
  '$114.990$2'
);

// Plan 5 - Guía SIBO: 45 → 14.990
html = html.replace(
  /(<div class="ebook-price-row">[\s\S]*?<span contenteditable="true" ?>)45(<\/span>)/,
  '$114.990$2'
);

// Plan 6 - Adiós ansiedad: 52 → 14.990
html = html.replace(
  /(<div class="ebook-price-row">[\s\S]*?<span contenteditable="true" ?>)52(<\/span>)/,
  '$114.990$2'
);

// Plan cards section prices
html = html.replace(/>49\.000</, '>12.990<');
html = html.replace(/>65\.000</, '>12.990<');
html = html.replace(/>55\.000</, '>12.990<');
html = html.replace(/>59\.000</, '>14.990<');
html = html.replace(/>45\.000</, '>14.990<');

// Check for plan 6 ansiedad price
const ansiedad = html.match(/Adiós Ansiedad[\s\S]{0,500}?plan-price[\s\S]{0,100}?>([\d\.]+)</);
if (ansiedad) console.log('Ansiedad price found:', ansiedad[1]);

fs.writeFileSync(filePath, html, 'utf16le');
console.log('Prices updated!');

// Verify
const check = html.match(/ebook-price[\s\S]{0,100}?contenteditable[\s\S]{0,50}?>([\d\.]+)</g);
if (check) {
  console.log('Ebook prices now:', check.map(m => m.match(/>([^<]+)<$/)?.[1]).join(', '));
}
