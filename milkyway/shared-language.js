(() => {
  const language = window.MilkyWayI18n;
  if (!language) return;
  let select = document.querySelector('#lang,#langSel,#adminLang');
  if (!select) {
    const label = document.createElement('label');label.className = 'mw-shared-language';
    const text = document.createElement('span');text.dataset.mwI18n = 'language';select = document.createElement('select');select.id = 'mwSharedLanguage';label.append(text, select);
    (document.querySelector('.wrap,main,.container') || document.body).prepend(label);
  }
  select.innerHTML = '<option value="sw">Kiswahili</option><option value="en">English</option><option value="fr">Français</option><option value="zh">中文</option><option value="ar">العربية</option><option value="pt">Português</option><option value="hi">हिन्दी</option><option value="de">Deutsch</option>';
  select.value = language.language();select.setAttribute('aria-label', language.t('language'));
  const administratorLanguage = document.getElementById('adminLanguage');
  if (administratorLanguage) { administratorLanguage.innerHTML = select.innerHTML;administratorLanguage.value = language.language(); }
  window.addEventListener('mw-language-change', () => { select.value = language.language();if (administratorLanguage) administratorLanguage.value = language.language(); });
  select.onchange = event => {
    localStorage.setItem('mw_lang', event.target.value);
    localStorage.setItem('masiyatunda_lang', event.target.value);
    localStorage.setItem('masiyatunda_admin_lang', event.target.value);
    language.apply();select.setAttribute('aria-label', language.t('language'));
  };
  document.documentElement.classList.add('mw-shared-page');
  const theme = document.createElement('label');theme.className = 'mw-shared-language';
  theme.innerHTML = '<span data-mw-i18n="appearance"></span><select data-mw-theme-selector aria-label="Appearance">' + window.MilkyWayTheme.options + '</select>';
  select.closest('label') ? select.closest('label').after(theme) : select.after(theme);
  window.MilkyWayTheme.apply();
  language.apply();
})();
