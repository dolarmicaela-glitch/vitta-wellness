const fs = require('fs');
const path = require('path');

// Read original as UTF-16 LE
const originalBytes = fs.readFileSync(path.join(__dirname, 'index_original.html'));
let html = originalBytes.toString('utf16le').replace(/^﻿/, ''); // strip BOM

// ── 1. HOTMART LINKS ──────────────────────────────────────────────────────────
// Replace the 1st, 2nd, and 4th openModal() buttons with Hotmart links
let count = 0;
html = html.replace(/(<div class="ebook-price-row">[\s\S]*?)<button([^>]*)onclick="openModal\(\)"([^>]*)>([\s\S]*?)<\/button>/g, (match, pre, a, b, inner) => {
  count++;
  if (count === 1) return pre + '<a href="https://go.hotmart.com/X105904056E" target="_blank" class="ebook-dl-btn">↓ Obtener</a>';
  if (count === 2) return pre + '<a href="https://go.hotmart.com/F105908243A?dp=1" target="_blank" class="ebook-dl-btn">↓ Obtener</a>';
  if (count === 4) return pre + '<a href="https://go.hotmart.com/T105921721W?dp=1" target="_blank" class="ebook-dl-btn">↓ Obtener</a>';
  if (count === 5) return pre + '<a href="https://go.hotmart.com/I105977321P?dp=1" target="_blank" class="ebook-dl-btn">↓ Obtener</a>';
  if (count === 6) return pre + '<a href="https://go.hotmart.com/O105938866T?dp=1" target="_blank" class="ebook-dl-btn">↓ Obtener</a>';
  return match;
});
console.log('Hotmart buttons replaced:', count, '(1, 2, 4 should be links)');

// ── 2. HAMBURGER + RESPONSIVE CSS ─────────────────────────────────────────────
const responsiveCss = `
  /* ─── HAMBURGER ─── */
  .hamburger {
    display: none;
    flex-direction: column; gap: 5px;
    background: none; border: none; cursor: pointer; padding: 4px;
  }
  .hamburger span {
    display: block; width: 24px; height: 2px;
    background: var(--dark-brown); border-radius: 2px;
    transition: all 0.3s;
  }
  .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .hamburger.open span:nth-child(2) { opacity: 0; }
  .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* ─── MOBILE MENU ─── */
  .mobile-menu {
    display: none;
    position: fixed; top: 65px; left: 0; right: 0;
    background: var(--warm-white);
    border-bottom: 1px solid var(--sand);
    z-index: 99; padding: 20px 30px 28px;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(61,43,31,0.08);
  }
  .mobile-menu.open { display: flex; }
  .mobile-menu a {
    padding: 14px 0; font-size: 1rem; font-weight: 400;
    color: var(--text-dark); text-decoration: none;
    border-bottom: 1px solid var(--sand);
  }
  .mobile-menu a:last-child { border-bottom: none; color: var(--gold); font-weight: 500; }

  /* ─── TABLET 960px ─── */
  @media (max-width: 960px) {
    nav { padding: 20px 30px; }
    .nav-links { display: none; }
    .hamburger { display: flex; }
    .scroll-dot { display: none; }
    #hero, #about, #contacto { grid-template-columns: 1fr; padding: 80px 30px; }
    #pillars, #planes, #ebooks, #recetas { padding: 80px 30px; }
    .pillars-grid { grid-template-columns: repeat(2, 1fr); }
    .planes-grid, .ebooks-grid, .recipes-grid { grid-template-columns: 1fr; }
    footer { padding: 40px 30px; flex-direction: column; }
  }

  /* ─── MOBILE 480px ─── */
  @media (max-width: 480px) {
    nav { padding: 14px 20px; }
    .nav-logo { font-size: 1.3rem; }
    .mobile-menu { top: 56px; }
    #hero { padding: 100px 20px 50px; gap: 24px; }
    .hero-title { font-size: 2.2rem; }
    .hero-btns { flex-direction: column; gap: 12px; }
    .hero-btns a { text-align: center; }
    .hero-visual img { max-width: 240px !important; }
    #pillars, #planes, #ebooks, #recetas, #contacto { padding: 50px 20px; }
    .pillars-grid { grid-template-columns: 1fr; }
    .section-title { font-size: 1.9rem; }
    .ebook-body { padding: 18px; }
    footer { padding: 28px 20px; text-align: center; }
  }
`;
html = html.replace('</style>', responsiveCss + '\n</style>');

// ── 3. HAMBURGER BUTTON + MOBILE MENU HTML ─────────────────────────────────────
html = html.replace(
  '</ul>\n</nav>',
  `</ul>
  <button class="hamburger" id="hamburger" aria-label="Menú">
    <span></span><span></span><span></span>
  </button>
</nav>

<!-- MOBILE MENU -->
<div class="mobile-menu" id="mobileMenu">
  <a href="#pillars" onclick="closeMobileMenu()">Enfoque</a>
  <a href="#planes" onclick="closeMobileMenu()">Planes</a>
  <a href="#ebooks" onclick="closeMobileMenu()">E-books</a>
  <a href="#recetas" onclick="closeMobileMenu()">Recetas</a>
  <a href="#contacto" onclick="closeMobileMenu()">Contacto</a>
  <a href="#contacto" onclick="closeMobileMenu()">Agendar Consulta →</a>
</div>`
);

// ── 4. HAMBURGER JS ────────────────────────────────────────────────────────────
html = html.replace(
  '<script>',
  `<script>
  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });
  }
  function closeMobileMenu() {
    if (hamburger) hamburger.classList.remove('open');
    if (mobileMenu) mobileMenu.classList.remove('open');
  }
`
);

// ── SAVE ────────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(__dirname, '.netlify', 'index.html'), html, 'utf8');

console.log('\nAll done!');
console.log('Hotmart 1:', html.includes('X105904056E') ? 'OK' : 'MISSING');
console.log('Hotmart 2:', html.includes('F105908243A') ? 'OK' : 'MISSING');
console.log('Hotmart 4:', html.includes('T105921721W') ? 'OK' : 'MISSING');
console.log('Hotmart 5:', html.includes('I105977321P') ? 'OK' : 'MISSING');
console.log('Hamburger CSS:', html.includes('.hamburger') ? 'OK' : 'MISSING');
console.log('Mobile menu HTML:', html.includes('mobileMenu') ? 'OK' : 'MISSING');
console.log('Accents:', html.includes('á') && html.includes('ó') ? 'OK' : 'MISSING');
console.log('Symbols:', html.includes('★') && html.includes('↓') ? 'OK' : 'MISSING');
