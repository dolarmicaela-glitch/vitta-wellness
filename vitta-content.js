(function () {
  async function loadVittaContent() {
    try {
      const response = await fetch('content/site.json?v=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar content/site.json');
      const data = await response.json();

      const setText = (selector, value) => {
        const el = document.querySelector(selector);
        if (el && value !== undefined && value !== null) el.textContent = value;
      };
      const setHTML = (selector, value) => {
        const el = document.querySelector(selector);
        if (el && value !== undefined && value !== null) el.innerHTML = value;
      };

      setText('.hero-eyebrow', data.hero_eyebrow);
      setHTML('.hero-title', data.hero_title);
      setText('.hero-sub', data.hero_subtitle);

      const about = document.querySelectorAll('#about .about-body');
      if (about[0]) about[0].textContent = data.about_1 || '';
      if (about[1]) about[1].textContent = data.about_2 || '';
      if (about[2]) about[2].textContent = data.about_3 || '';

      const stats = document.querySelectorAll('#about .stat-number');
      if (stats[0]) stats[0].textContent = data.stat_people || '';
      if (stats[1]) stats[1].textContent = data.stat_years || '';
      if (stats[2]) stats[2].textContent = data.stat_programs || '';

      const prices = document.querySelectorAll('#planes .plan-price');
      const priceValues = [
        data.price_plan_1,
        data.price_plan_2,
        data.price_plan_3,
        data.price_plan_4,
        data.price_plan_5,
        data.price_plan_6,
        data.price_plan_7,
        data.price_vitta_reset
      ];
      priceValues.forEach((value, index) => {
        if (prices[index] && value !== undefined && value !== null) prices[index].textContent = value;
      });

      const primary = document.querySelector('#hero .btn-primary');
      if (primary && data.main_cta_text) primary.textContent = data.main_cta_text;

      const consultButtons = document.querySelectorAll('#hero .btn-outline, .nav-cta');
      consultButtons.forEach(el => {
        if (data.consult_cta_text) el.textContent = data.consult_cta_text;
      });

      if (data.whatsapp) {
        document.querySelectorAll('a[href*="wa.me/"]').forEach(link => {
          try {
            const href = link.getAttribute('href') || '';
            link.setAttribute('href', href.replace(/wa\.me\/\d+/, 'wa.me/' + data.whatsapp));
          } catch (_) {}
        });
      }

      if (data.instagram) {
        document.querySelectorAll('a[href*="instagram.com"]').forEach(link => {
          link.setAttribute('href', data.instagram);
        });
      }

      document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.setAttribute('contenteditable', 'false');
        el.removeAttribute('title');
      });
    } catch (error) {
      console.error('VITTA admin:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadVittaContent);
  } else {
    loadVittaContent();
  }
})();
