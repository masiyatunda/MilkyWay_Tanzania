/* Load only the extra locale catalog selected by the user. The four catalogs are
   separate files so English, Swahili, French and Chinese do not download them. */
(() => {
  const supported = new Set(['ar', 'pt', 'hi', 'de']);
  const loaded = new Set();
  const loading = new Map();
  const scriptUrl = (locale, extra = false) =>
    `./locales/${locale}${extra ? '-extra' : ''}.js?v=1`;
  function load(locale) {
    if (!supported.has(locale) || loaded.has(locale)) return Promise.resolve();
    if (loading.has(locale)) return loading.get(locale);
    const task = new Promise((resolve, reject) => {
      const add = (url) => new Promise((ok, fail) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = ok;
        script.onerror = () => fail(new Error('Locale catalog could not be loaded'));
        document.head.appendChild(script);
      });
      add(scriptUrl(locale))
        .then(() => add(scriptUrl(locale, true)))
        .then(() => { loaded.add(locale); resolve(); })
        .catch(reject);
    }).finally(() => loading.delete(locale));
    loading.set(locale, task);
    return task;
  }
  window.MilkyWayLocaleLoader = { load, supported: [...supported] };
  const selected = localStorage.getItem('mw_lang') || localStorage.getItem('masiyatunda_lang') || 'sw';
  if (supported.has(selected)) {
    // Parser-blocking scripts ensure the selected catalog is ready before translations.js.
    document.write(`<script src="${scriptUrl(selected)}"><\/script><script src="${scriptUrl(selected, true)}"><\/script>`);
    loaded.add(selected);
  }
})();
