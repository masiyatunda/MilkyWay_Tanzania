// Points every "APK" download button at the newest MilkyWay build. The file name stays the same between
// releases, so the version from download/version.json is added to the link; a browser or proxy that kept an
// older copy of MilkyWay.apk can never hand it out again.
(() => {
  const links = document.querySelectorAll('#appDownload, #mwApkLink, a[data-mw-apk]');
  if (!links.length) return;
  fetch('/milkyway/download/version.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(latest => {
      if (!latest || !latest.versionCode) return;
      const url = new URL(latest.url || '/milkyway/download/MilkyWay.apk', location.origin);
      url.searchParams.set('v', latest.versionCode);
      links.forEach(link => { link.href = url.pathname + url.search; });
    })
    .catch(() => {});
})();
