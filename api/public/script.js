(() => {
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => [...p.querySelectorAll(s)];

  // ---------- i18n ----------
  const LANGS = ['de','en','fr'];
  const fallbackLang = 'de';
  let currentDict = {};
  function setHtmlLang(lang){ document.documentElement.setAttribute('lang', lang); }

  async function loadLang(lang){
    if (!LANGS.includes(lang)) lang = fallbackLang;
    try {
      const res = await fetch(`/i18n/${lang}.json`, { cache: 'no-store' });
      currentDict = await res.json();
      localStorage.setItem('lang', lang);
      setHtmlLang(lang);
      applyI18n();
    } catch {
      if (lang !== fallbackLang) return loadLang(fallbackLang);
    }
  }

  function t(key, def=''){ return currentDict[key] ?? def; }

  function applyI18n(){
    // data-i18n -> textContent
    $$('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key, el.textContent);
    });
    // placeholder
    $$('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key, el.getAttribute('placeholder') || ''));
    });
    // Preise-Listen aus Semikolon-Liste bauen (wenn vorhanden)
    const pb = $('#p-basic'), pbu = t('pricing.basic.items','').split(';').filter(Boolean);
    const pbs = $('#p-business'), pbus = t('pricing.business.items','').split(';').filter(Boolean);
    const pp = $('#p-project'), pps = t('pricing.project.items','').split(';').filter(Boolean);
    function fillUL(ul, arr){ if(!ul) return; ul.innerHTML = arr.map(i=>`<li>${i}</li>`).join(''); }
    fillUL(pb, pbu); fillUL(pbs, pbus); fillUL(pp, pps);

    // Formular-Meldung zurücksetzen (damit Sprache passt)
    const msgEl = $('#formMsg'); if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form-msg'; }
  }

  const switcher = $('#langSwitcher');
  if (switcher) {
    const initLang = localStorage.getItem('lang') || (navigator.language || 'de').slice(0,2);
    switcher.value = LANGS.includes(initLang) ? initLang : fallbackLang;
    loadLang(switcher.value);
    switcher.addEventListener('change', () => loadLang(switcher.value));
  } else {
    // Seiten ohne Switcher (z.B. success.html)
    const initLang = localStorage.getItem('lang') || fallbackLang;
    loadLang(initLang);
  }

  // ---------- Mobile Menü ----------
  const burger = $('#burger');
  const menu = $('#navMenu');
  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    });
    $$('#navMenu a').forEach(a => a.addEventListener('click', () => {
      menu.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false');
    }));
  }

  // ---------- Footer-Jahr ----------
  const yearEl = $('#year'); if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---------- Smooth scroll ----------
  $$('#navMenu a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href') || '';
      const el = $(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block:'start' }); }
    });
  });

  // ---------- Kontaktformular ----------
  const form = $('#contactForm');
  const msgEl = $('#formMsg');
  const tsField = $('#ts'); if (tsField) tsField.value = String(Date.now());

  const setMsg = (text, ok=false) => {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = 'form-msg ' + (ok ? 'ok' : 'err');
  };

  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); setMsg('', false);
      const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        msg: form.message.value.trim(),
        hp: form.hp ? form.hp.value.trim() : '',
        ts: tsField ? Number(tsField.value) : 0
      };
      if (!data.name || !data.email || !data.msg) return setMsg(t('form.err.required','Bitte füllen Sie alle Felder aus.'));
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return setMsg(t('form.err.email','Bitte gültige E-Mail eingeben.'));

      submitBtn && (submitBtn.disabled = true);
      try {
        const res = await fetch('/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          form.reset();
          if (tsField) tsField.value = String(Date.now());
          // Redirect auf Success (wird ebenfalls übersetzt)
          window.location.href = '/success.html';
        } else {
          setMsg(json.message || t('form.err.generic','Senden fehlgeschlagen – bitte später erneut.'));
        }
      } catch {
        setMsg(t('form.err.offline','Keine Verbindung zum Server.'));
      } finally {
        submitBtn && (submitBtn.disabled = false);
      }
    });
  }
})();
