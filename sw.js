// Masiyatunda site pages (home, media, Sanaa, careers, admin). MilkyWay has its own worker under /milkyway/.
importScripts('/sw-cache.js');
self.MWCache.install({
  prefix: 'masiyatunda-',
  version: 'v10',
  precache: ['/', '/manifest.webmanifest', '/placeholder.svg', '/img/masiyatunda-logo-96.webp', '/img/masiyatunda-logo-192.webp', '/img/hero-placeholder.webp', '/slides/33886-720.webp', '/milkyway/media-images.js', '/milkyway/theme.css', '/milkyway/release.css', '/milkyway/themes.css?v=2', '/milkyway/mw-dialog.css', '/milkyway/live-themes.css?v=2', '/milkyway/mw-dialog.js', '/milkyway/shared-theme.js?v=2', '/milkyway/icon-192.png'],
  // MilkyWay pages are left to the MilkyWay worker; the old site cache name is cleared.
  inScope: (address, request) => request.mode === 'navigate' ? !address.pathname.startsWith('/milkyway/') : !new URL(request.referrer || self.location.href).pathname.startsWith('/milkyway/'),
  legacy: [key => key === 'milkyway-v28-5-e2e-key-publish-retry'],
});
