// Offline data for MilkyWay: feed posts, profiles, stories, counts and other reads are saved on the device (IndexedDB).
// Loaded before the Supabase client is created, so every read the app makes goes through here:
//   - online with a saved copy: render it immediately, then refresh storage and notify the UI only when data changes
//   - online without a saved copy: wait briefly for the network, then let it populate the device cache
//   - offline or failed: the saved copy answers at once (or an empty list), never a network error
// When the connection drops, the app checks again quietly (2 s, 4 s, 8 s … up to 30 s, and on "online" / app focus)
// and fires "mw-reconnected" once it is back, so the feed and account refresh by themselves.
// Writes are never replayed here; they fail with a short, friendly offline message instead. Reactions, saves, follows
// and text comments are made optimistic and synced later by offline-actions.js, which only queues actions safe to send twice.
// Saved data is per account and is cleared on sign-out.
(() => {
  const SUPABASE = 'https://wpclkhgizbvxuvbhbwzs.supabase.co';
  const DB = 'milkyway-offline';
  const STORE = 'responses';
  const LIMIT = 800;
  const MAX_AGE = 14 * 24 * 60 * 60 * 1000;
  const MAX_BODY = 1024 * 1024;
  const TIMEOUT = 6000;
  const SLOW_TIMEOUT = 2500;
  // Functions whose reads are safe to keep on the device (no one-time tokens or signed links).
  const FUNCTIONS = /^\/api\/milkyway-(?:social|discovery|gallery|account|wallet|notifications|groups|post-share|message)(?:\/|$)/;
  const NETWORK = /failed to fetch|networkerror|network error|load failed|network request failed|err_internet|err_network|err_connection|err_name_not_resolved|timed? ?out|timeout|haijibu|aborted due to timeout|fetcherror/i;
  const order = ['en', 'sw', 'fr', 'zh', 'ar', 'pt', 'hi', 'de'];
  const words = {
    offline: ['You are offline. Showing saved posts; MilkyWay reconnects by itself.', 'Huna intaneti. Tunaonyesha machapisho yaliyohifadhiwa; MilkyWay itaunganisha yenyewe.', 'Vous êtes hors ligne. Publications enregistrées affichées ; MilkyWay se reconnecte tout seul.', '当前离线。正在显示已保存的内容，MilkyWay 会自动重新连接。', 'أنت غير متصل. نعرض المنشورات المحفوظة؛ سيعيد MilkyWay الاتصال تلقائيًا.', 'Você está offline. Mostrando publicações salvas; o MilkyWay reconecta sozinho.', 'आप ऑफ़लाइन हैं। सहेजी गई पोस्ट दिख रही हैं; MilkyWay अपने आप फिर से जुड़ जाएगा।', 'Du bist offline. Gespeicherte Beiträge werden gezeigt; MilkyWay verbindet sich von selbst neu.'],
    action: ['No connection right now. Try again once you are back online.', 'Hakuna mtandao kwa sasa. Jaribu tena ukirudi mtandaoni.', 'Pas de connexion pour le moment. Réessayez une fois reconnecté.', '暂时没有网络。恢复连接后请重试。', 'لا يوجد اتصال الآن. حاول مرة أخرى عند عودة الاتصال.', 'Sem conexão agora. Tente de novo quando voltar a ficar online.', 'अभी कनेक्शन नहीं है। ऑनलाइन होने पर फिर से कोशिश करें।', 'Gerade keine Verbindung. Versuche es erneut, sobald du wieder online bist.'],
    empty: ['Nothing saved on this device yet. Posts appear here as soon as the connection is back.', 'Bado hakuna kilichohifadhiwa kwenye kifaa hiki. Machapisho yataonekana mtandao ukirudi.', 'Rien n’est encore enregistré sur cet appareil. Les publications apparaîtront dès le retour de la connexion.', '此设备上还没有保存内容。网络恢复后即会显示。', 'لا يوجد شيء محفوظ على هذا الجهاز بعد. ستظهر المنشورات فور عودة الاتصال.', 'Nada salvo neste aparelho ainda. As publicações aparecem assim que a conexão voltar.', 'इस डिवाइस पर अभी कुछ सहेजा नहीं गया है। कनेक्शन लौटते ही पोस्ट दिखेंगी।', 'Auf diesem Gerät ist noch nichts gespeichert. Beiträge erscheinen, sobald die Verbindung zurück ist.'],
  };
  const language = () => { try { return window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch { return 'sw'; } };
  const word = key => words[key][Math.max(0, order.indexOf(language()))] || words[key][0];
  const native = window.fetch.bind(window);

  // ---- Device storage (IndexedDB). Without it (private mode, old WebView) the app simply runs online-only.
  let opening = null;
  const open = () => opening ||= new Promise(resolve => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => { const store = request.result.createObjectStore(STORE, { keyPath: 'key' });store.createIndex('savedAt', 'savedAt'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  const run = (mode, work) => open().then(db => db && new Promise(resolve => {
    try {
      const transaction = db.transaction(STORE, mode);
      const result = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(result?.result);
      transaction.onerror = transaction.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  }));
  const read = key => run('readonly', store => store.get(key)).then(entry => entry && Date.now() - entry.savedAt < MAX_AGE ? entry : undefined).catch(() => undefined);
  let writes = 0;
  const write = (entry, generation = cacheGeneration) => run('readwrite', store => generation === cacheGeneration ? store.put(entry) : undefined).then(() => { if (++writes % 25 === 1) prune(); }).catch(() => {});
  const remove = key => run('readwrite', store => store.delete(key)).catch(() => {});
  // Oldest entries go first once the store passes its limit.
  const prune = () => run('readwrite', store => {
    const count = store.count();
    count.onsuccess = () => {
      let extra = count.result - LIMIT;
      const cursor = store.index('savedAt').openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        if (extra > 0 || Date.now() - item.value.savedAt > MAX_AGE) { item.delete();extra--;item.continue(); }
      };
    };
  });
  let cacheGeneration = 0;
  const revalidating = new Map();
  const clear = () => { cacheGeneration++;recent.clear();revalidating.clear();return run('readwrite', store => store.clear()); };

  // ---- Which requests are saved, and under which key.
  const headerOf = (input, init, name) => {
    try { return new Headers(init?.headers || (input instanceof Request ? input.headers : undefined)).get(name) || ''; } catch { return ''; }
  };
  const methodOf = (input, init) => String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const addressOf = input => { try { return new URL(input instanceof Request ? input.url : String(input), location.href); } catch { return null; } };
  const tracked = address => !!address && ((address.origin === SUPABASE && /^\/(?:rest|functions|storage)\/v1\//.test(address.pathname)) || (address.origin === location.origin && address.pathname.startsWith('/api/')));
  const cacheable = (address, method) => ['GET', 'HEAD'].includes(method) && ((address.origin === SUPABASE && address.pathname.startsWith('/rest/v1/')) || (address.origin === location.origin && FUNCTIONS.test(address.pathname)));
  // Each account keeps its own copies: the signed-in user's id comes from the access token.
  const accountOf = authorization => {
    try {
      const payload = authorization.replace(/^Bearer\s+/i, '').split('.')[1];
      if (!payload) return 'guest';
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return claims.sub || 'guest';
    } catch { return 'guest'; }
  };

  // ---- Connection state and quiet reconnecting.
  let offline = navigator.onLine === false;
  let retry = null, delay = 2000, probing = false;
  const root = document.documentElement;
  const announce = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {} };
  const setOffline = () => {
    if (!offline) { offline = true;root.dataset.mwOffline = '1';announce('mw-offline');backgroundSync(); }
    schedule();
  };
  const setOnline = () => {
    delay = 2000;clearTimeout(retry);retry = null;
    if (!offline) return;
    offline = false;delete root.dataset.mwOffline;
    // Let the connection settle for a moment before everything refreshes at once.
    setTimeout(() => announce('mw-reconnected'), 400);
  };
  const schedule = () => {
    if (retry) return;
    retry = setTimeout(() => { retry = null;probe(); }, delay);
    delay = Math.min(delay * 2, 30000);
  };
  // A tiny same-origin file, never served from the service worker ("no-store"), proves the connection is back.
  async function probe() {
    if (probing) return;
    probing = true;
    try {
      const response = await timeout(native(`/milkyway/manifest.json?mw-probe=${Date.now()}`, { cache: 'no-store' }), 5000);
      if (response.status < 500) setOnline(); else schedule();
    } catch { schedule(); } finally { probing = false; }
  }
  // Where supported (Chrome, installed web app), the browser also wakes the service worker when the network returns.
  function backgroundSync() {
    try { navigator.serviceWorker?.ready.then(registration => registration.sync?.register('mw-reconnect')).catch(() => {}); } catch {}
  }
  navigator.serviceWorker?.addEventListener?.('message', event => { if (event.data?.type === 'mw-reconnect' && offline) probe(); });
  window.addEventListener('online', () => { delay = 2000;probe(); });
  window.addEventListener('offline', setOffline);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && offline) probe(); });
  if (offline) { root.dataset.mwOffline = '1';schedule(); }

  const timeout = (promise, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(value => { clearTimeout(timer);resolve(value); }, error => { clearTimeout(timer);reject(error); });
  });
  const slowNetwork = () => {
    try { const c = navigator.connection;return !!c && (c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '')); } catch { return false; }
  };
  const aborted = (input, init, error) => error?.name === 'AbortError' && (init?.signal?.aborted || (input instanceof Request && input.signal?.aborted));

  const replay = (entry, method) => new Response(method === 'HEAD' || entry.status === 204 ? null : entry.body, { status: entry.status, headers: { ...entry.headers, 'x-mw-offline': 'saved' } });
  // Nothing saved yet: lists come back empty (and counts as zero) instead of throwing, so screens stay calm.
  const empty = (address, method, accept) => {
    if (address.origin !== SUPABASE) return null;
    const single = /vnd\.pgrst\.object/.test(accept);
    return new Response(method === 'HEAD' ? null : single ? 'null' : '[]', { status: 200, headers: { 'content-type': 'application/json', 'content-range': '*/0', 'x-mw-offline': 'empty' } });
  };
  const recent = new Map();
  function invalidateTable(table, account) {
    if (!/^[a-z_]+$/.test(table) || !account) throw new TypeError('Invalid cache table or account.');
    cacheGeneration++;
    revalidating.clear();
    const prefix = `${account} GET ${SUPABASE}/rest/v1/${table}?`;
    for (const key of recent.keys()) if (key.startsWith(prefix)) recent.delete(key);
    return run('readwrite', store => {
      const cursor = store.index('savedAt').openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        if (String(row.value.key).startsWith(prefix)) row.delete();
        row.continue();
      };
      return cursor;
    });
  }
  const keep = async (key, response, method, body, generation = cacheGeneration) => {
    try {
      body ??= method === 'HEAD' ? '' : await response.text();
      if (generation !== cacheGeneration) return;
      if (body.length > MAX_BODY) return;
      const savedAt=Date.now(),previous=recent.get(key);
      // Refresh unchanged records periodically without rewriting them on every background poll.
      if (previous?.body === body && savedAt-previous.savedAt < 60000) return;
      recent.delete(key);recent.set(key,{body,savedAt});
      if (recent.size > 300) recent.delete(recent.keys().next().value);
      const headers = {};
      for (const name of ['content-type', 'content-range', 'preference-applied']) { const value = response.headers.get(name);if (value) headers[name] = value; }
      await write({ key, status: response.status, headers, body, savedAt }, generation);
    } catch {}
  };

  function revalidate(input, init, address, method, key, authorization, previous) {
    if (revalidating.has(key)) return revalidating.get(key);
    const generation = cacheGeneration;
    const promise = native(input, { ...init, signal: null }).then(async response => {
      setOnline();
      if (response.ok) {
        const body = method === 'HEAD' ? '' : await response.clone().text();
        if (body.length <= MAX_BODY) {
          await keep(key, response.clone(), method, body, generation);
          if (previous && previous.body !== body && generation === cacheGeneration) {
            announce('mw-cache-updated', { account: accountOf(authorization), url: address.href });
          }
        }
      } else if ([401, 403, 404].includes(response.status) && generation === cacheGeneration) {
        recent.delete(key);
        await remove(key);
        announce('mw-cache-invalidated', { account: accountOf(authorization), url: address.href });
      }
      return response;
    }).catch(error => {
      if (!aborted(input, init, error)) setOffline();
      throw error;
    }).finally(() => { if (revalidating.get(key) === promise) revalidating.delete(key); });
    revalidating.set(key, promise);
    return promise;
  }

  async function cachedFetch(input, init, address, method) {
    const authorization = headerOf(input, init, 'authorization');
    const accept = headerOf(input, init, 'accept');
    const key = [accountOf(authorization), method, address.href, accept, headerOf(input, init, 'prefer'), headerOf(input, init, 'range')].join(' ');
    const saved = read(key);
    if (offline || navigator.onLine === false) {
      const entry = await saved;
      if (entry) { if (!offline) setOffline(); else schedule();return replay(entry, method); }
    }
    const entry = await saved;
    if (init?.signal?.aborted || input instanceof Request && input.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    if (entry) {
      revalidate(input, init, address, method, key, authorization, entry).catch(() => {});
      return replay(entry, method);
    }
    try {
      return await timeout(revalidate(input, init, address, method, key, authorization, entry), offline || slowNetwork() ? SLOW_TIMEOUT : TIMEOUT);
    } catch (error) {
      if (aborted(input, init, error)) throw error;
      if (error?.message !== 'timeout') setOffline();
      const fallback = empty(address, method, accept);
      if (fallback) return fallback;
      throw error;
    }
  }

  window.fetch = function milkyWayFetch(input, init) {
    const address = addressOf(input);
    if (!tracked(address)) return native(input, init);
    const method = methodOf(input, init);
    if (cacheable(address, method)) return cachedFetch(input, init, address, method);
    return native(input, init).then(response => { setOnline();return response; }, error => {
      if (!aborted(input, init, error)) setOffline();
      throw error;
    });
  };

  // Network failures read as a calm "you are offline" line instead of raw browser errors.
  const isNetworkError = message => NETWORK.test(String(message?.message ?? message ?? ''));
  const friendly = message => (isNetworkError(message) ? word('action') : message);
  // Promise rejections that are only a dropped connection are expected offline and handled by the retry loop.
  window.addEventListener('unhandledrejection', event => { if (isNetworkError(event.reason)) { event.preventDefault();setOffline(); } });

  // Signed-in sessions stay usable offline. An expired access token can't be refreshed without a network, and the
  // auth client would retry for about 30 seconds first, holding back every read (and the whole start of the app).
  // While offline, a saved session close to expiry reads as valid for a few more minutes, so reads answer at once
  // from the saved copies above (kept per account, by the id in the token). Back online, the real expiry is read
  // again and the token refreshes as usual. What is stored on the device keeps its real expiry.
  const HELD = 'mw_real_expires_at';
  const authStorage = {
    getItem(key) {
      let value = null;
      try { value = localStorage.getItem(key); } catch { return null; }
      if (!value || !(offline || navigator.onLine === false)) return value;
      try {
        const session = JSON.parse(value);
        if (!session?.access_token || !session.refresh_token || !session.expires_at) return value;
        const now = Math.floor(Date.now() / 1000);
        if (session.expires_at - now > 5 * 60) return value;
        return JSON.stringify({ ...session, expires_at: now + 10 * 60, [HELD]: session.expires_at });
      } catch { return value; }
    },
    setItem(key, value) {
      try {
        const session = JSON.parse(value);
        if (session && typeof session === 'object' && HELD in session) { session.expires_at = session[HELD];delete session[HELD];value = JSON.stringify(session); }
      } catch {}
      try { localStorage.setItem(key, value); } catch {}
    },
    removeItem(key) { try { localStorage.removeItem(key); } catch {} },
  };

  window.MilkyWayOffline = {
    get offline() { return offline; },
    isNetworkError, friendly, clear, invalidateTable, probe, authStorage,
    text: key => word(key),
  };
})();
