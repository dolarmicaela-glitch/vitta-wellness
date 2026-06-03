const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index_original.html');
let html = fs.readFileSync(filePath, 'utf16le');

// Fix plan 6 ansiedad: 52.000 → 14.990
html = html.replace(/>52\.000</, '>14.990<');

fs.writeFileSync(filePath, html, 'utf16le');
console.log('Done!');
