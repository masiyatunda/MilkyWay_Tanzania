// Points every "APK" download button at the newest MilkyWay build. The file name stays the same between
// releases, so the version from download/version.json is added to the link; a browser or proxy that kept an
// older copy of MilkyWay.apk can never hand it out again.
(() => {
  const links = document.querySelectorAll('#appDownload, #mwApkLink, a[data-mw-apk]');
  if (!links.length) return;
  const base = new URL('.', document.baseURI);
  fetch(new URL('download/version.json', base), { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(latest => {
      if (!latest || !latest.versionCode) return;
      const target = String(latest.url || '/milkyway/download/MilkyWay.apk');
      const url = new URL(target, location.origin);
      url.searchParams.set('v', latest.versionCode);
      links.forEach(link => { link.href = url.pathname + url.search; });
    })
    .catch(() => {});
})();
