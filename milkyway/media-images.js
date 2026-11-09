// Pictures sized for the connection, shared by the Masiyatunda site and MilkyWay.
// Uploaded photos (Supabase storage) and the app's own pictures are served as-is;
// the size and quality tier below is kept so an image proxy can be added later.
//   slow   (Data Saver, 2G/3G, under 1.5 Mbps or offline): smaller, more compressed pictures
//   normal (unknown or average connection): the requested size
//   fast   (4G at 5 Mbps or more): sharper pictures for high-density screens
// When the connection improves, pictures already on screen are quietly swapped for the sharper version.
(() => {
  const origin = 'https://wpclkhgizbvxuvbhbwzs.supabase.co';
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const RASTER = /\.(?:png|jpe?g|webp|avif|gif)$/i;
  const RANK = { slow: 0, normal: 1, fast: 2 };
  const PROFILE = { slow: { scale: 0.6, quality: 45 }, normal: { scale: 1, quality: 70 }, fast: { scale: 2, quality: 80 } };
  const MAX_WIDTH = 1600;

  const tier = () => {
    try {
      if (navigator.onLine === false) return 'slow';
      if (!connection) return 'normal';
      const type = connection.effectiveType || '';
      if (connection.saveData || /(^|-)2g$|^3g$/.test(type) || (connection.downlink && connection.downlink < 1.5)) return 'slow';
      if (type === '4g' && (!connection.downlink || connection.downlink >= 5)) return 'fast';
    } catch {}
    return 'normal';
  };

  // Widths are rounded to steps of 40 px so the CDN and the device cache reuse the same files.
  const sized = (address, width, level, largest = MAX_WIDTH) => {
    const profile = PROFILE[level];
    const density = level === 'fast' ? Math.min(window.devicePixelRatio || 1, profile.scale) : profile.scale;
    const target = Math.min(largest, MAX_WIDTH, Math.max(64, Math.ceil(width * density / 40) * 40));
    return address;
  };

  // Generated addresses remember their source so they can be upgraded later.
  const sources = new Map();
  const remember = (url, source, width, local, largest) => {
    if (sources.size > 600) sources.delete(sources.keys().next().value);
    sources.set(url, { source, width, local, largest });
    return url;
  };

  const image = (source, width = 640) => {
    // Photos are served as-is from Supabase storage.
    return source;
  };

  // The app's own pictures (backgrounds, logos) from this site: the display width, then the file's own width so
  // sharp screens never ask for an enlarged copy, e.g. asset('brand/milkyway-logo-web.png', 180, 276).
  const asset = (path, width, largest) => {
    try {
      const address = new URL(path, location.href);
      if (address.origin !== location.origin || !RASTER.test(address.pathname) || !/^https?:$/.test(address.protocol)) return path;
      return remember(sized(address.pathname, width, tier(), largest), path, width, true, largest);
    } catch { return path; }
  };

  const root = document.documentElement;
  let current = tier();
  root.dataset.mwNet = current;
  const listeners = new Set();

  // Swaps each on-screen picture only after the sharper file has loaded, so nothing flickers or goes blank.
  function upgrade() {
    document.querySelectorAll('img[data-mw-sized]').forEach(img => {
      const known = sources.get(img.getAttribute('src'));
      if (!known) return;
      const next = known.local ? asset(known.source, known.width, known.largest) : image(known.source, known.width);
      if (next === img.getAttribute('src')) return;
      const loader = new Image();
      loader.onload = () => { if (img.isConnected) img.src = next; };
      loader.src = next;
    });
  }

  function changed() {
    const next = tier();
    if (next === current) return;
    const better = RANK[next] > RANK[current];
    current = next;
    root.dataset.mwNet = next;
    if (better) upgrade();
    listeners.forEach(listener => { try { listener(next); } catch {} });
  }
  connection?.addEventListener?.('change', changed);
  addEventListener('online', changed);
  addEventListener('offline', changed);

  // Non-essential scripts: right after the page finishes loading on a good connection; on a slow one,
  // only once the page is idle (or on the first tap) so the app shell and balance get the bandwidth first.
  const later = src => new Promise((resolve, reject) => {
    const start = () => {
      if (document.querySelector(`script[data-mw-later="${CSS.escape(src)}"]`)) { resolve();return; }
      const script = document.createElement('script');
      script.src = src;script.async = false;script.dataset.mwLater = src;
      script.onload = () => resolve();script.onerror = () => { script.remove();reject(new Error(`${src} did not load.`)); };
      document.body.append(script);
    };
    const whenIdle = () => {
      if (current !== 'slow') { start();return; }
      let done = false;
      const go = () => { if (done) return;done = true;removeEventListener('pointerdown', go, true);start(); };
      addEventListener('pointerdown', go, { capture: true, passive: true, once: true });
      (window.requestIdleCallback || (task => setTimeout(task, 3000)))(go, { timeout: 6000 });
    };
    if (document.readyState === 'complete') whenIdle(); else addEventListener('load', whenIdle, { once: true });
  });

  window.MilkyWayMedia = { image, asset };
  window.MilkyWayNetwork = {
    tier: () => current,
    slow: () => current === 'slow',
    fast: () => current === 'fast',
    onChange(listener) { listeners.add(listener);return () => listeners.delete(listener); },
    later,
  };
})();
