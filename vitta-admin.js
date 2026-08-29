(() => {
  const setText = (selector, value) => {
    if (value == null || value === '') return;
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  const setHTML = (selector, value) => {
    if (value == null || value === '') return;
    const el = document.querySelector(selector);
    if (el) el.innerHTML = value;
  };

  fetch('content/site.json?v=' + Date.now(), { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('No se pudo cargar content/site.json');
      return r.json();
    })
    .then((site) => {
      setText('.hero-eyebrow', site.hero_eyebrow);
      setHTML('.hero-title', site.hero_title);
      setText('.hero-sub', site.hero_subtitle);

      const about = document.querySelectorAll('#about .about-body');
      [site.about_1, site.about_2, site.about_3].forEach((value, i) => {
        if (about[i] && value != null && value !== '') about[i].textContent = value;
      });

      const stats = document.querySelectorAll('#about .stat-number');
      [site.stat_people, site.stat_years, site.stat_programs].forEach((value, i) => {
        if (stats[i] && value != null && value !== '') stats[i].textContent = value;
      });

      const prices = document.querySelectorAll('#planes .plan-price');
      const managedPrices = [
        site.price_plan_1,
        site.price_plan_2,
        site.price_plan_3,
        site.price_plan_4,
        site.price_plan_5,
        site.price_plan_6,
        site.price_plan_7,
        site.price_vitta_reset
      ];
      managedPrices.forEach((value, i) => {
        if (prices[i] && value != null && value !== '') prices[i].textContent = value;
      });

      if (site.main_cta_text) {
        const heroPrimary = document.querySelector('#hero .btn-primary');
        if (heroPrimary) heroPrimary.textContent = site.main_cta_text;
      }

      if (site.consult_cta_text) {
        const heroConsult = document.querySelector('#hero .btn-outline');
        if (heroConsult) heroConsult.textContent = site.consult_cta_text;
        const navConsult = document.querySelector('.nav-cta');
        if (navConsult) navConsult.textContent = site.consult_cta_text;
      }

      if (site.whatsapp) {
        document.querySelectorAll('a[href*="wa.me/"]').forEach((a) => {
          a.href = a.href.replace(/wa\.me\/\d+/, 'wa.me/' + site.whatsapp);
        });
      }

      if (site.instagram) {
        document.querySelectorAll('a[href*="instagram.com"]').forEach((a) => {
          a.href = site.instagram;
        });
      }
    })
    .catch((err) => console.error('VITTA CMS:', err));
})();
