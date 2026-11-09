// Hides the APK download pill where it makes no sense: inside the installed
// Android app itself (Capacitor, or the older android-app:// launcher) and on iPhone/iPad.
(() => {
  const link = document.getElementById('mwApkLink');
  if (!link) return;
  try { if (document.referrer.startsWith('android-app://com.masiyatunda.milkyway')) sessionStorage.setItem('mw_android_app', '1'); } catch {}
  let insideApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  try { insideApp = insideApp || sessionStorage.getItem('mw_android_app') === '1'; } catch {}
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  link.hidden = insideApp || apple;
  if (!insideApp) return;

  const cap = window.Capacitor;
  const bridge = cap?.Plugins?.MilkyWayNative || cap?.registerPlugin?.('MilkyWayNative');
  if (!bridge || typeof bridge.getInfo !== 'function') return;
  bridge.getInfo().then(info => {
    if (Number(info.versionCode) < 8) return;
    const topActions = document.querySelector('.top-actions');
    if (!topActions || document.getElementById('mwNativeBackButton')) return;
    const backButton = document.createElement('button');
    backButton.id = 'mwNativeBackButton';
    backButton.type = 'button';
    backButton.className = 'btn ghost';
    backButton.textContent = '← Back / Exit';
    backButton.title = 'Back or exit MilkyWay';
    backButton.setAttribute('aria-label', 'Back or exit MilkyWay');
    backButton.addEventListener('click', () => {
      if (history.length > 1) {
        history.back();
        return;
      }

      bridge.exitApp().catch(error => {
        console.error('MilkyWay could not exit:', error);
        if (typeof window.toast === 'function') window.toast('Unable to exit the app right now.');
      });
    });
    topActions.prepend(backButton);
  }).catch(error => {
    console.error('MilkyWay native app information is unavailable:', error);
  });
})();
