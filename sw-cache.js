// Shared caching for the site and MilkyWay service workers (loaded with importScripts).
// Pages: network first, but a slow or missing connection falls back to the saved copy after a short wait
// (shorter still on 2G/3G and Data Saver, where the saved app shell opens at once and refreshes in the background).
// Scripts, styles and pictures: shown straight from the saved copy and refreshed quietly in the background.
// Pictures that were never saved show as a blank tile while offline.
// When a page arrives from the network with new content (a new deploy), its scripts and styles are fetched
// fresh for a short window so a new page never runs with old code.
// Never cached here: non-GET requests, signed-in API calls, functions, uploads, video ranges and app downloads.
// (Feed videos prefetched by milkyway/media-prefetch.js are played from the device by the MilkyWay worker.)
// (MilkyWay's feed, profile and count reads are saved per account in IndexedDB by milkyway/offline-data.js.)
(() => {
  const PAGE_TIMEOUT = 3500;
  const SLOW_PAGE_TIMEOUT = 1200;
  const ASSET_TIMEOUT = 4000;
  const PRECACHE_TIMEOUT = 5000;
  const FRESH_WINDOW = 20000;
  const IMAGE_LIMIT = 400;
  const IMAGE_MAX_AGE = 24 * 60 * 60 * 1000;
  const CDN_HOSTS = ['cdn.jsdelivr.net'];
  const STATIC = /(?:\.(?:js|css|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|webmanifest)|\/manifest\.json)$/i;

  function install(options) {
    const pages = `${options.prefix}pages-${options.version}`;
    const assets = `${options.prefix}assets-${options.version}`;
    const images = `${options.prefix}images`;
    const cdn = `${options.prefix}cdn`;
    const own = [pages, assets, images, cdn];
    const slowNetwork = () => {
      try {
        const connection = self.navigator.connection;
        return !!connection && (connection.saveData || /(^|-)2g$|^3g$/.test(connection.effectiveType || '') || (connection.downlink > 0 && connection.downlink < 1.5));
      } catch { return false; }
    };
    const inScope = options.inScope || (() => true);
    const isAsset = options.isAsset || (address => STATIC.test(address.pathname));
    let freshUntil = 0;

    const timeout = (promise, ms) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
    // waitUntil throws once the event has settled; late background work just runs without it.
    const keep = (event, promise) => { try { event.waitUntil(promise); } catch {} return promise; };
    const keyFor = request => {
      const address = new URL(request.url);
      address.hash = '';
      return address.href;
    };
    const save = (name, key, response) => {
      if (!response || !(response.ok || response.type === 'opaque')) return Promise.resolve();
      return caches.open(name).then(cache => cache.put(key, response)).catch(() => {});
    };
    const trim = async (name, limit) => {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map(key => cache.delete(key)));
    };

    async function page(event) {
      const request = event.request;
      const key = keyFor(request).replace(/\?.*$/, '');
      const cache = await caches.open(pages);
      const saved = usable(await cache.match(key) || await caches.match(key));
      const network = fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
          const previous = saved && saved.headers.get('etag');
          if (!saved || !previous || previous !== response.headers.get('etag')) freshUntil = Date.now() + FRESH_WINDOW;
          const copy = response.clone();
          keep(event, cache.put(key, copy).catch(() => {}));
        }
        return response;
      });
      // No network at all: the saved page opens at once (and refreshes in the background once possible).
      if (saved && self.navigator.onLine === false) { keep(event, network.catch(() => {})); return saved; }
      try {
        return await (saved ? timeout(network, slowNetwork() ? SLOW_PAGE_TIMEOUT : PAGE_TIMEOUT) : network);
      } catch {
        if (saved) { keep(event, network.catch(() => {})); return saved; }
        // Never an error screen: any saved copy of the app shell boots instead and loads its saved data.
        return (await shell(cache)) || new Response(STARTING_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
    }

    // A navigation can't be answered with a redirected response (e.g. a saved /index.html), so it is copied first.
    function usable(response) {
      if (!response || !response.redirected) return response;
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
    async function shell(cache) {
      const scope = self.registration.scope;
      for (const path of ['./', options.offlinePage, './index.html'].filter(Boolean)) {
        const found = await caches.match(new URL(path, scope).href, { ignoreSearch: true });
        if (found) return usable(found);
      }
      const keys = await cache.keys();
      return keys.length ? usable(await cache.match(keys[keys.length - 1])) : undefined;
    }

    async function staleWhileRevalidate(event, name) {
      const request = event.request;
      const key = keyFor(request);
      const saved = await caches.open(name).then(cache => cache.match(key));
      const network = fetch(request).then(response => {
        const copy = response.clone();
        keep(event, save(name, key, copy));
        return response;
      });
      if (saved && Date.now() > freshUntil) { keep(event, network.catch(() => {})); return saved; }
      try {
        return await (saved ? timeout(network, ASSET_TIMEOUT) : network);
      } catch (error) {
        if (saved) { keep(event, network.catch(() => {})); return saved; }
        throw error;
      }
    }

    // Without a connection, any saved size of the same picture (or the app's own original file) stands in.
    async function anySize(cache, request) {
      const source = new URL(request.url).searchParams.get('url');
      if (!source) return undefined;
      const keys = await cache.keys();
      const match = keys.reverse().find(key => new URL(key.url).searchParams.get('url') === source);
      if (match) return cache.match(match);
      const original = new URL(source, self.location.origin);
      return original.origin === self.location.origin ? caches.match(original.href) : undefined;
    }

    // A picture never saved on this device shows as a soft blank tile offline instead of a broken image
    // (the header lets the feed add its quiet "not saved yet" line).
    const placeholder = () => new Response('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9"><rect width="16" height="9" fill="#0b1c38"/></svg>', { status: 200, headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store', 'x-mw-placeholder': '1' } });

    // Optimised pictures are no longer proxied; photos load straight from Supabase storage.
    async function optimizedImage(event) {
      const request = event.request;
      const cache = await caches.open(images);
      const saved = await cache.match(request);
      const refresh = () => fetch(request).then(async response => {
        if (response.ok) {
          const headers = new Headers(response.headers);
          headers.set('x-mw-saved-at', String(Date.now()));
          const body = await response.clone().blob();
          await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
          await trim(images, IMAGE_LIMIT);
        }
        return response;
      });
      if (!saved) return refresh().catch(async () => (await anySize(cache, request)) || placeholder());
      if (Date.now() - Number(saved.headers.get('x-mw-saved-at') || 0) > IMAGE_MAX_AGE) keep(event, refresh().catch(() => {}));
      return saved;
    }

    self.addEventListener('install', event => {
      event.waitUntil(caches.open(assets)
        .then(cache => Promise.all((options.precache || []).map(path => {
          const url = new URL(path, self.registration.scope);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), PRECACHE_TIMEOUT);
          return cache.add(new Request(url, { cache: 'reload', signal: controller.signal }))
            .catch(() => {})
            .finally(() => clearTimeout(timer));
        })))
        .then(() => self.skipWaiting()));
    });

    self.addEventListener('activate', event => {
      event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(key => (key.startsWith(options.prefix) && !own.includes(key)) || (options.legacy || []).some(test => test(key))).map(key => caches.delete(key))))
        .then(() => self.clients.claim()));
    });

    self.addEventListener('fetch', event => {
      const request = event.request;
      if (request.method !== 'GET' || request.headers.has('Authorization') || request.headers.has('Range')) return;
      if (request.mode !== 'navigate' && ['no-store', 'reload', 'no-cache'].includes(request.cache)) return;
      const address = new URL(request.url);
      if (address.origin !== self.location.origin) {
        if (CDN_HOSTS.includes(address.hostname)) event.respondWith(staleWhileRevalidate(event, cdn));
        return;
      }
      if (!inScope(address, request) || /\/download\//.test(address.pathname)) return;
      if (address.pathname.startsWith('/api/')) return;
      if (request.mode === 'navigate') { event.respondWith(page(event)); return; }
      if (isAsset(address)) event.respondWith(staleWhileRevalidate(event, assets));
    });
  }

  // Last resort when nothing was ever saved on this device: a calm start page (no error message) that opens
  // the real page by itself as soon as the connection works.
  const STARTING_HTML = '<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MilkyWay</title>'
    + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#030A20;color:#eef4ff;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px">'
    + '<div><h1 style="color:#d4af37;font-size:1.5rem;margin:0">Masiyatunda</h1></div>'
    + '<script>(()=>{let d=2000;const go=()=>fetch(location.href,{cache:"no-store"}).then(()=>location.reload(),()=>{setTimeout(go,d);d=Math.min(d*2,30000)});'
    + 'addEventListener("online",()=>{d=2000;go()});setTimeout(go,d)})()</script></body></html>';

  self.MWCache = { install };
})();
