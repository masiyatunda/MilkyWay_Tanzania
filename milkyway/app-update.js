// Inside the native Android app: web changes load live from the site, so only native changes need a
// new APK. Compares the installed version with milkyway/download/version.json and offers the download.
(() => {
  const cap = window.Capacitor;
  const native = cap && cap.isNativePlatform && cap.isNativePlatform()
    ? cap.Plugins?.MilkyWayNative || cap.registerPlugin?.('MilkyWayNative')
    : null;
  if (!native) return;
  const appBase = new URL('.', document.baseURI || location.href);
  const rootBase = new URL('/', location.origin);
  const resolveApp = path => new URL(String(path || '').replace(/^\/+/, ''), appBase).href;
  const resolveRoot = path => new URL(String(path || '').replace(/^\/+/, ''), rootBase).href;
  (async () => {
    try {
      const [info, latest] = await Promise.all([
        native.getInfo(),
        fetch(resolveRoot('milkyway/download/version.json'), { cache: 'no-store' }).then(response => response.ok ? response.json() : null),
      ]);
      if (!latest || !(Number(latest.versionCode) > Number(info.versionCode))) return;
      const skipKey = `mw_skip_apk_${latest.versionCode}`;
      if (!latest.required && sessionStorage.getItem(skipKey)) return;
      const bar = document.createElement('div');
      bar.setAttribute('role', 'alert');
      bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483000;display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;background:#0b1636;color:#eef4ff;border:1px solid #d4af37;box-shadow:0 10px 30px rgba(0,0,0,.45);font:600 14px/1.35 system-ui,sans-serif';
      const text = document.createElement('span');
      text.style.flex = '1';
      text.textContent = `Toleo jipya la MilkyWay (${latest.versionName || latest.versionCode}) lipo tayari. / A new app version is available.`;
      const target = latest.url ? new URL(String(latest.url).replace(/^\/+/, ''), rootBase).href : resolveApp('download/MilkyWay.apk');
      const get = document.createElement('a');
      get.href = target;
      get.textContent = 'Pakua / Update';
      get.style.cssText = 'background:#d4af37;color:#030A20;padding:8px 12px;border-radius:10px;text-decoration:none;font-weight:800;white-space:nowrap';
      get.onclick = event => {
        event.preventDefault();
        native.openExternal({ url: new URL(get.getAttribute('href'), location.href).href }).catch(() => { location.href = get.href; });
      };
      bar.append(text, get);
      if (!latest.required) {
        const later = document.createElement('button');
        later.type = 'button';
        later.textContent = '✕';
        later.setAttribute('aria-label', 'Baadaye / Later');
        later.style.cssText = 'background:none;border:0;color:#eef4ff;font-size:18px;padding:4px 6px';
        later.onclick = () => { sessionStorage.setItem(skipKey, '1'); bar.remove(); };
        bar.append(later);
      }
      document.body.append(bar);
    } catch {}
  })();
})();
