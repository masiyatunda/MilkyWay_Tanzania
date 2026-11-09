
/* Phase A: clear errors + account cache hint */
(() => {
  const lang = () => (document.documentElement.lang || 'sw').startsWith('en') ? 'en' : 'sw';
  const copy = {
    sw: { net:'Hakuna mtandao. Jaribu tena.', fail:'Imeshindikana. Jaribu tena.', empty:'Bado hakuna posts.', saved:'Imehifadhiwa.' },
    en: { net:'No network. Try again.', fail:'Failed. Try again.', empty:'No posts yet.', saved:'Saved.' }
  };
  window.mwError = (key) => (copy[lang()][key] || copy.sw[key] || key);
  window.addEventListener('offline', () => {
    if (window.toast) toast(window.mwError('net'));
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#saveProfileBtn, #saveNameBtn, #settingsSaveBtn');
    if (!b) return;
    setTimeout(() => {
      const msg = document.getElementById('profileMsg') || document.getElementById('settingsMsg');
      if (msg && !msg.textContent) msg.textContent = window.mwError('saved');
    }, 600);
  });
})();
