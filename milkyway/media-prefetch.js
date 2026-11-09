// TikTok-style prefetching for the MilkyWay feed: while someone scrolls, the videos and pictures of the next posts
// are downloaded quietly into device storage, so they start at once and keep playing when the connection drops.
//   - fast connection: the next 10 posts; normal: the next 6; 2G/3G: the next 3 (videos skipped on Data Saver)
//   - videos go into the "mw-feed-videos" cache; the MilkyWay service worker plays them from there (seeking included)
//   - pictures go through the service worker's picture cache, at the exact size the feed shows
//   - at most 2 videos and 4 pictures download at a time; nothing downloads while offline or with little free space
//   - the cache keeps the 40 most recent videos (about 600 MB at most); older ones are removed first
// Offline, posts that were saved play normally. A post that was never saved shows one quiet line under it
// ("Not saved on this device yet…") instead of an error, and loads by itself when the connection is back.
(() => {
  const CACHE = 'mw-feed-videos';
  const SAVED = 'mw-offline-videos';
  const INDEX = 'mw_prefetch_videos';
  const SAVED_INDEX = 'mw_offline_videos';
  const STORAGE = 'https://wpclkhgizbvxuvbhbwzs.supabase.co/storage/v1/object/public/';
  // More aggressive prefetch so the feed keeps playing smoothly even if the connection drops (TikTok-style).
  const AHEAD = { fast: 10, normal: 10, slow: 10 };
  const VIDEO_LIMIT = { fast: 120, normal: 80, slow: 40 }; // MB per video
  const MAX_VIDEOS = 80;
  const MAX_BYTES = 1200 * 1024 * 1024;
  const MIN_FREE = 300 * 1024 * 1024;
  const POSTS = '#feed .post';
  const MEDIA = 'video.post-media,img.post-media,.mw-post-gallery video,.mw-post-gallery img';
  const order = ['en', 'sw', 'fr', 'zh', 'ar', 'pt', 'hi', 'de'];
  const words = {
    video: ['Not saved on this device yet. It plays as soon as you are back online.', 'Bado haijahifadhiwa kwenye kifaa hiki. Itacheza ukirudi mtandaoni.', 'Pas encore enregistrée sur cet appareil. Lecture dès le retour en ligne.', '此视频尚未保存到本设备，恢复联网后即可播放。', 'لم يُحفظ على هذا الجهاز بعد. سيعمل فور عودة الاتصال.', 'Ainda não salvo neste aparelho. Vai tocar assim que você voltar a ficar online.', 'अभी इस डिवाइस पर सहेजा नहीं गया। ऑनलाइन होते ही चलेगा।', 'Noch nicht auf diesem Gerät gespeichert. Wird abgespielt, sobald du wieder online bist.'],
    image: ['Not saved on this device yet. It appears when you are back online.', 'Bado haijahifadhiwa kwenye kifaa hiki. Itaonekana ukirudi mtandaoni.', 'Pas encore enregistrée sur cet appareil. Elle s’affichera au retour en ligne.', '此图片尚未保存到本设备，恢复联网后显示。', 'لم تُحفظ على هذا الجهاز بعد. ستظهر عند عودة الاتصال.', 'Ainda não salva neste aparelho. Aparece quando você voltar a ficar online.', 'अभी इस डिवाइस पर सहेजी नहीं गई। ऑनलाइन होते ही दिखेगी।', 'Noch nicht auf diesem Gerät gespeichert. Erscheint, sobald du wieder online bist.'],
  };
  const language = () => { try { return window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch { return 'sw'; } };
  const word = key => words[key][Math.max(0, order.indexOf(language()))] || words[key][0];
  const supported = 'caches' in window && 'fetch' in window;
  const offline = () => !!window.MilkyWayOffline?.offline || navigator.onLine === false;
  const tier = () => window.MilkyWayNetwork?.tier?.() || 'normal';
  const saveData = () => { try { return !!navigator.connection?.saveData; } catch { return false; } };
  const isVideo = url => typeof url === 'string' && url.startsWith(STORAGE);

  // ---- Which videos are on this device (prefetched here, or saved by the person under "Offline videos").
  const readList = key => { try { const list = JSON.parse(localStorage.getItem(key) || '[]');return Array.isArray(list) ? list : []; } catch { return []; } };
  const index = new Map(readList(INDEX).filter(item => typeof item?.url === 'string').map(item => [item.url, { size: Number(item.size) || 0, at: Number(item.at) || 0 }]));
  const storeIndex = () => { try { localStorage.setItem(INDEX, JSON.stringify([...index].map(([url, item]) => ({ url, ...item })))); } catch {} };
  const savedByPerson = () => new Set(readList(SAVED_INDEX).map(item => item?.url).filter(Boolean));
  const has = url => !!url && (index.has(url) || savedByPerson().has(url));
  // The index can drift from the real cache (cleared site data, another tab); the cache is the truth.
  const reconcile = supported ? caches.open(CACHE).then(async cache => {
    const keys = new Set((await cache.keys()).map(request => request.url));
    for (const url of index.keys()) if (!keys.has(url)) index.delete(url);
    for (const url of keys) if (!index.has(url)) index.set(url, { size: 0, at: 0 });
    storeIndex();
  }).catch(() => {}) : Promise.resolve();
  const cachedAnywhere = async url => {
    if (has(url)) return true;
    if (!supported) return false;
    try { return !!((await (await caches.open(CACHE)).match(url, { ignoreVary: true })) || (await (await caches.open(SAVED)).match(url, { ignoreVary: true }))); } catch { return false; }
  };

  // ---- Upcoming posts: the one in the middle of the screen, then the next few below it.
  function upcoming() {
    const posts = [...document.querySelectorAll(POSTS)];
    if (!posts.length) return [];
    const middle = innerHeight / 2;
    let current = posts.findIndex(post => post.getBoundingClientRect().bottom > middle);
    if (current < 0) current = posts.length - 1;
    return posts.slice(current, current + 1 + AHEAD[tier()]);
  }
  const sourceOf = element => element.currentSrc || element.getAttribute('src') || '';
  function mediaOf(posts) {
    const videos = [], images = [], current = [];
    posts.forEach((post, position) => post.querySelectorAll('video,img').forEach(element => {
      const url = sourceOf(element);
      if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;
      // The post on screen is already streaming its video; downloading it again would only double the data.
      if (element.tagName === 'VIDEO') { if (isVideo(url)) (position > 0 ? videos : current).push(url); }
    }));
    return { videos: [...new Set(videos)], images: [...new Set(images)], current };
  }

  // ---- Downloads.
  const imagesDone = new Set();
  const active = new Map();
  let imageQueue = [], videoQueue = [], imageRunning = 0;
  async function room() {
    try {
      const estimate = await navigator.storage?.estimate?.();
      return !estimate?.quota || estimate.quota - estimate.usage > MIN_FREE;
    } catch { return true; }
  }
  function pumpImages() {
    while (imageRunning < 6 && imageQueue.length && !offline()) {
      const url = imageQueue.shift();
      if (imagesDone.has(url)) continue;
      imagesDone.add(url);imageRunning++;
      // The service worker saves the picture on its way through; the page only needs to read it.
      fetch(url, { credentials: 'same-origin', priority: 'low' }).then(response => response.blob()).catch(() => imagesDone.delete(url))
        .finally(() => { imageRunning--;pumpImages(); });
    }
    if (imagesDone.size > 800) imagesDone.clear();
  }
  let pumping = false;
  async function pumpVideos() {
    if (pumping) return;
    pumping = true;
    try {
      while (active.size < 3 && videoQueue.length && !offline()) {
        const url = videoQueue.shift();
        if (index.has(url) || active.has(url) || savedByPerson().has(url)) continue;
        if (!(await room())) { videoQueue = [];return; }
        const controller = new AbortController();
        active.set(url, controller);
        download(url, controller).catch(() => {}).finally(() => { active.delete(url);pumpVideos(); });
      }
    } finally { pumping = false; }
  }
  async function download(url, controller) {
    const limit = VIDEO_LIMIT[tier()] * 1024 * 1024;
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal: controller.signal, priority: 'low' });
    if (!response.ok || !response.body) throw new Error(String(response.status));
    const declared = Number(response.headers.get('content-length')) || 0;
    if (declared > limit) { controller.abort();throw new Error('too large'); }
    let size = 0;
    // Counted as it streams, so a file without a declared size still stops at the limit instead of filling the phone.
    const counted = response.body.pipeThrough(new TransformStream({
      transform(chunk, stream) { size += chunk.byteLength;if (size > limit) { stream.error(new Error('too large'));controller.abort(); } else stream.enqueue(chunk); },
    }));
    const type = response.headers.get('content-type') || 'video/mp4';
    await (await caches.open(CACHE)).put(url, new Response(counted, { status: 200, headers: { 'Content-Type': type, 'x-mw-saved-at': String(Date.now()) } }));
    index.set(url, { size, at: Date.now() });
    await evict();
    storeIndex();
    // A video that already failed offline on screen can now play.
    document.querySelectorAll('video').forEach(video => { if (sourceOf(video) === url) clearMark(video); });
  }
  // Oldest first, never one of the posts coming up next.
  async function evict(keep = new Set(mediaOf(upcoming()).videos)) {
    let total = [...index.values()].reduce((sum, item) => sum + item.size, 0);
    const oldest = [...index].sort((a, b) => a[1].at - b[1].at);
    const cache = await caches.open(CACHE);
    for (const [url, item] of oldest) {
      if (index.size <= MAX_VIDEOS && total <= MAX_BYTES) break;
      if (keep.has(url)) continue;
      await cache.delete(url).catch(() => {});
      index.delete(url);total -= item.size;
    }
  }

  let planned = null;
  function plan() {
    planned = null;
    if (!supported || offline() || document.hidden) return;
    const posts = upcoming();
    if (!posts.length) return;
    const { videos, images, current } = mediaOf(posts);
    // Videos coming up stay fresh in the cache order, so they are the last to be removed.
    const now = Date.now();
    videos.forEach((url, position) => { const item = index.get(url);if (item) item.at = now - position; });
    imageQueue = images.filter(url => !imagesDone.has(url));
    pumpImages();
    const allowVideos = !(tier() === 'slow' && saveData());
    const wanted = allowVideos ? videos : [];
    // Scrolled far past a download: stop it so the bandwidth goes to what is next (one reaching the screen finishes).
    for (const [url, controller] of active) if (!wanted.includes(url) && !current.includes(url)) controller.abort();
    videoQueue = wanted.filter(url => !index.has(url) && !active.has(url));
    reconcile.then(pumpVideos);
  }
  const soon = (delay = 350) => { if (!planned) planned = setTimeout(plan, delay); };

  // ---- Offline: one quiet line under media that is not on this device yet.
  const lineFor = element => {
    const next = element.nextElementSibling;
    return next?.classList.contains('mw-uncached-note') ? next : null;
  };
  function markUncached(element) {
    if (lineFor(element)) return;
    element.classList.add('mw-uncached');
    const note = document.createElement('p');
    note.className = 'mw-uncached-note';note.setAttribute('role', 'status');
    note.textContent = `☁︎ ${word(element.tagName === 'VIDEO' ? 'video' : 'image')}`;
    element.after(note);
  }
  function clearMark(element) { element.classList.remove('mw-uncached');lineFor(element)?.remove(); }
  async function check(element) {
    if (!offline() || !element.isConnected) return;
    const url = sourceOf(element);
    if (!url) return;
    if (element.tagName === 'VIDEO') { if (isVideo(url) && !(await cachedAnywhere(url))) markUncached(element);return; }
    if (element.complete && !element.naturalWidth) markUncached(element);
  }
  const seen = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) check(entry.target);
  }, { threshold: 0.25 }) : null;
  const watched = new WeakSet();
  function watchMedia() {
    document.querySelectorAll(`#feed ${MEDIA.split(',').join(',#feed ')}`).forEach(element => {
      if (watched.has(element)) return;
      watched.add(element);seen?.observe(element);
    });
  }
  // A video that cannot load while offline gets the quiet line instead of a broken player.
  document.addEventListener('error', event => {
    const element = event.target;
    if (offline() && element instanceof HTMLVideoElement && element.closest('#feed')) markUncached(element);
  }, true);

  window.addEventListener('mw-offline', () => {
    for (const controller of active.values()) controller.abort();
    document.querySelectorAll(`#feed ${MEDIA.split(',').join(',#feed ')}`).forEach(element => { seen?.unobserve(element);seen?.observe(element); });
  });
  // Back online: the quiet lines go, media that missed out loads again, and prefetching carries on.
  window.addEventListener('mw-reconnected', () => {
    document.querySelectorAll('.mw-uncached').forEach(element => {
      clearMark(element);
      if (element.tagName === 'VIDEO') { if (element.error || element.networkState === 3) element.load(); }
      else { const src = element.getAttribute('src');element.removeAttribute('src');requestAnimationFrame(() => element.setAttribute('src', src)); }
    });
    soon(1200);
  });
  addEventListener('scroll', () => soon(), { passive: true });
  addEventListener('resize', () => soon());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(); });
  window.MilkyWayNetwork?.onChange?.(() => soon());
  let scanning = false;
  const feedChanged = () => { if (scanning) return;scanning = true;requestAnimationFrame(() => { scanning = false;watchMedia();soon(600); }); };
  const feed = document.getElementById('feed');
  if (feed) new MutationObserver(feedChanged).observe(feed, { childList: true, subtree: true });
  feedChanged();

  // Signing out removes the prefetched videos, so a shared phone keeps nothing from the last account's feed.
  async function clear() {
    for (const controller of active.values()) controller.abort();
    videoQueue = [];index.clear();storeIndex();
    if (supported) await caches.delete(CACHE).catch(() => {});
  }

  window.MilkyWayPrefetch = { has, cached: cachedAnywhere, clear, refresh: plan };

  // Quiet background: keep downloading the next 10 while the user watches
  setInterval(() => { if (!document.hidden && !offline()) plan(); }, 8000);
})();
