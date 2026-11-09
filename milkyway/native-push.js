// Push notification permission and device registration.
// Inside the Android app (Capacitor) devices register with Firebase Cloud Messaging; the FCM token is sent
// to /api/fcm with the Supabase session so it is linked to the signed-in account (admins included).
// In a browser the same prompt turns on Web Push through MilkyWayLiveNotifications.
// Permission is never requested at launch: a short in-app explanation appears right after a meaningful
// action (follow, like, comment, message) or after the first sign-in, and only then the system dialog.
(() => {
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const push = native ? cap.Plugins?.PushNotifications || cap.registerPlugin?.('PushNotifications') : null;
  if (native && !push) return;
  const webCapable = !native && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  if (!native && !webCapable) return;

  const ASKED = 'mw_push_prompt_at';
  const DECLINED = 'mw_push_prompt_declined';
  const COOLDOWN = 3 * 24 * 60 * 60 * 1000;
  const TRIGGERS = '[data-follow],#publicFollow,#mwLiveFollowHost,[data-sig],[data-echo],#echoSend,#threadSend,[data-repost],#msgUserBtn,#mwLiveCommentForm button[type=submit]';
  const copy = {
    sw: { title: 'Washa arifa?', message: 'Pata taarifa papo hapo za ujumbe mpya, likes, maoni na wafuasi wapya — hata app ikiwa imefungwa.', yes: 'Ruhusu arifa', no: 'Si sasa', on: 'Arifa zimewashwa.', off: 'Arifa zimezimwa. Unaweza kuziwasha kwenye mipangilio ya simu.' },
    en: { title: 'Turn on notifications?', message: 'Get instant alerts for new messages, likes, comments and followers — even when the app is closed.', yes: 'Allow notifications', no: 'Not now', on: 'Notifications are on.', off: 'Notifications are blocked. You can turn them on in your phone settings.' },
  };
  const text = key => { let lang = 'sw';try { lang = window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch {}return (copy[lang] || copy.en)[key]; };
  const store = { get: key => { try { return localStorage.getItem(key); } catch { return null; } }, set: (key, value) => { try { localStorage.setItem(key, value); } catch {} } };
  const client = () => (typeof sb !== 'undefined' ? sb : null);
  const idle = task => (window.requestIdleCallback ? requestIdleCallback(task, { timeout: 2000 }) : setTimeout(task, 200));

  let token = '';
  let saved = '';
  let prompting = false;

  async function permission() {
    if (!native) return Notification.permission === 'default' ? 'prompt' : Notification.permission;
    try { return (await push.checkPermissions()).receive; } catch { return 'denied'; }
  }

  // Sends the FCM token with the current session; retries when the network comes back.
  async function save() {
    if (!token) return;
    const headers = { 'Content-Type': 'application/json' };
    let account = '';
    try {
      const current = client() && (await client().auth.getSession()).data.session;
      if (current) { account = current.user.id;Object.assign(headers, { Authorization: `Bearer ${current.access_token}`, apikey: client().supabaseKey || '' }); }
    } catch {}
    const key = `${token}|${account}`;
    if (key === saved) return;
    try {
      const response = await fetch('/api/fcm?action=register', { method: 'POST', headers, body: JSON.stringify({ token }), keepalive: true });
      if (response.ok) saved = key;
    } catch { addEventListener('online', () => save(), { once: true }); }
  }

  // Firebase must be running before register(), or the native layer crashes. APKs built without
  // google-services.json receive the client config from /api/fcm instead.
  async function firebaseReady() {
    const bridge = cap.Plugins?.MilkyWayNative || cap.registerPlugin?.('MilkyWayNative');
    if (!bridge) return true;
    try {
      if ((await bridge.getInfo()).firebaseReady) return true;
      const response = await fetch('/api/fcm?action=config', { cache: 'no-store' });
      const firebase = response.ok ? (await response.json()).firebase : null;
      return !!(firebase && (await bridge.configureFirebase(firebase)).firebaseReady);
    } catch { return false; }
  }

  async function register() {
    if (native) { if (await firebaseReady()) await push.register(); return; }
    const live = window.MilkyWayLiveNotifications;
    if (live && typeof user !== 'undefined' && user && !await live.subscribed().catch(() => false)) await live.subscribe({ prompt: false }).catch(() => {});
  }

  // Asks the system for permission (after the in-app explanation) and registers the device.
  async function request() {
    if (native) {
      let status = await push.checkPermissions();
      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') status = await push.requestPermissions();
      if (status.receive === 'granted') await register();
      return status.receive;
    }
    const live = window.MilkyWayLiveNotifications;
    if (live && typeof user !== 'undefined' && user) { try { await live.subscribe();return 'granted'; } catch { return Notification.permission; } }
    return Notification.requestPermission();
  }

  async function offer(force = false) {
    if (prompting) return;
    const state = await permission();
    if (state === 'granted') { register().catch(() => {});return; }
    if (state === 'denied' && !force) return;
    if (!force) {
      const last = Number(store.get(ASKED) || 0);
      if (Date.now() - last < COOLDOWN || Number(store.get(DECLINED) || 0) >= 3) return;
    }
    const dialog = window.MilkyWayDialog;
    if (dialog?.open) return;
    prompting = true;
    try {
      store.set(ASKED, String(Date.now()));
      const yes = dialog ? await dialog.confirm({ title: text('title'), message: text('message'), confirmText: text('yes'), cancelText: text('no') }) : true;
      if (!yes) { store.set(DECLINED, String(Number(store.get(DECLINED) || 0) + 1));return; }
      const result = await request();
      if (result !== 'granted' && dialog) dialog.alert(text('off'));
    } catch {} finally { prompting = false; }
  }

  if (native) {
    push.addListener('registration', result => { token = result.value;save(); });
    push.addListener('pushNotificationActionPerformed', action => {
      const url = action && action.notification && action.notification.data && action.notification.data.url;
      if (typeof url === 'string' && url.startsWith('/')) location.href = url;
    });
    // Off the critical path: the channel and a silent re-registration (only when already granted).
    idle(async () => {
      try {
        await push.createChannel({ id: 'milkyway_default', name: 'MilkyWay', description: 'Ujumbe, likes, maoni na taarifa za Admin', importance: 5, sound: 'default', vibration: true, visibility: 1 }).catch(() => {});
        if (await permission() === 'granted') await register();
      } catch {}
    });
  }

  // Key interactions: offer notifications shortly after the action itself has gone through.
  document.addEventListener('click', event => {
    if (!event.target.closest?.(TRIGGERS)) return;
    if (typeof user !== 'undefined' && !user) return;
    setTimeout(() => offer(), 1200);
  }, { passive: true, capture: true });

  // Initial setup: the first sign-in on this device also offers notifications; every auth change re-links the token.
  setTimeout(() => {
    try {
      client() && client().auth.onAuthStateChange(event => {
        save();
        if (event === 'SIGNED_IN' && !store.get(ASKED)) setTimeout(() => offer(), 2500);
        else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') idle(() => permission().then(state => state === 'granted' && register()).catch(() => {}));
      });
    } catch {}
  }, 0);

  window.MilkyWayPush = { offer: () => offer(true), permission };
})();
