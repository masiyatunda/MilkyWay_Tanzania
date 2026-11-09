// Optimistic actions for MilkyWay: reactions, saves, follows and text comments show on screen at once, even offline.
// When the network is missing (or drops mid-request) the action waits in a small queue on this device and is sent
// quietly once the connection is back ("mw-reconnected", "online", app focus, and a gentle retry while waiting).
// Every queued action is safe to send twice, so a retry never doubles anything:
//   - reactions, saves and follows store the wanted end state (on/off); turning on is an insert that treats
//     "already there" as done, turning off is a delete, and toggling twice offline keeps only the last choice
//   - comments carry their own id, so a second insert of the same comment is recognised and skipped
// Posting, messages, uploads and gifts are never queued (duplicates or double charges); they keep the friendly offline line.
// Queued actions belong to the account that made them and only that account sends them.
(() => {
  const KEY = 'mw_outbox';
  const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
  const LIMIT = 300;
  const RETRY = 20000;
  const SOCIAL = '/api/milkyway-social';
  const TABLES = { signal: 'mw_signals', save: 'mw_saves', follow: 'mw_follows' };
  const order = ['en', 'sw', 'fr', 'zh', 'ar', 'pt', 'hi', 'de'];
  const words = {
    queued: ['Saved on this device. It will be sent when you are back online.', 'Imehifadhiwa kwenye kifaa. Itatumwa ukirudi mtandaoni.', 'Enregistré sur cet appareil. Envoi dès le retour en ligne.', '已保存在此设备上，恢复联网后自动发送。', 'تم الحفظ على هذا الجهاز. سيُرسل عند عودة الاتصال.', 'Salvo neste aparelho. Será enviado quando você voltar a ficar online.', 'इस डिवाइस पर सहेजा गया। ऑनलाइन होते ही भेजा जाएगा।', 'Auf diesem Gerät gespeichert. Wird gesendet, sobald du wieder online bist.'],
    waiting: ['Waiting for connection', 'Inasubiri mtandao', 'En attente de connexion', '等待网络', 'بانتظار الاتصال', 'Aguardando conexão', 'कनेक्शन की प्रतीक्षा', 'Wartet auf Verbindung'],
  };
  const language = () => { try { return window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch { return 'sw'; } };
  const word = key => words[key][Math.max(0, order.indexOf(language()))] || words[key][0];
  // "user" and "sb" are created by the app script that loads after this file; read them only when needed.
  const me = () => { try { return user?.id || null; } catch { return null; } };
  const client = () => { try { return sb; } catch { return null; } };
  const offline = () => !!window.MilkyWayOffline?.offline || navigator.onLine === false;
  const isNetworkError = error => !!window.MilkyWayOffline?.isNetworkError(error) || (error instanceof TypeError && /fetch/i.test(error.message));

  const load = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter(op => op && (op.type in TABLES || op.type === 'comment') && Date.now() - op.at < MAX_AGE) : [];
    } catch { return []; }
  };
  let ops = load();
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(ops.slice(-LIMIT))); } catch {} };
  const keyOf = op => op.type === 'comment' ? `comment:${op.id}` : `${op.type}:${op.account}:${op.target}:${op.kind || ''}`;
  const announce = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {} };

  // Toggles keep only the latest wanted state; comments are added as they are.
  function queue(op) {
    const account = op.account || me();
    if (!account) return null;
    const entry = { ...op, account, at: Date.now() };
    entry.key = keyOf(entry);
    ops = ops.filter(item => item.key !== entry.key);
    ops.push(entry);
    store();schedule();paint();
    announce('mw-outbox-change', { size: ops.length });
    return entry;
  }
  const mine = () => { const account = me();return account ? ops.filter(op => op.account === account) : []; };
  const state = (type, target, kind = '') => mine().find(op => op.type === type && op.target === target && (op.kind || '') === kind)?.on;
  // Comments still waiting to be sent, shaped like saved comments so threads and previews can show them.
  const comments = postId => mine().filter(op => op.type === 'comment' && op.target === postId)
    .map(op => ({ id: op.id, post_id: op.target, user_id: op.account, author_name: op.author, body: op.body, created_at: new Date(op.at).toISOString(), mw_parent: op.details?.parentId || null, mwPending: true }));

  // Screens re-render from saved or server data; queued choices are laid back on top so nothing flickers back.
  function paint(root = document) {
    const pending = mine();
    root.querySelectorAll?.('[data-mw-pending]').forEach(element => { delete element.dataset.mwPending;element.removeAttribute('title'); });
    for (const op of pending) {
      if (op.type === 'signal') {
        root.querySelectorAll(`[data-sig="${CSS.escape(op.kind)}"][data-id="${CSS.escape(op.target)}"]`).forEach(button => {
          if (button.classList.contains('on') !== op.on) {
            button.classList.toggle('on', op.on);button.setAttribute('aria-pressed', String(op.on));
            const count = button.querySelector('.sig-count');
            if (count) count.textContent = String(Math.max(0, (parseInt(count.textContent, 10) || 0) + (op.on ? 1 : -1)));
          }
          mark(button);
        });
      } else if (op.type === 'save') {
        root.querySelectorAll(`[data-save="${CSS.escape(op.target)}"]`).forEach(button => { button.classList.toggle('on', op.on);button.textContent = op.on ? '⭐' : '☆';mark(button); });
      } else if (op.type === 'follow') {
        root.querySelectorAll(`[data-follow="${CSS.escape(op.target)}"]`).forEach(button => { window.paintFollowButton?.(button, op.on);mark(button); });
      }
    }
  }
  const mark = element => { element.dataset.mwPending = '1';element.title = word('waiting'); };

  // ---- Sending queued actions.
  const must = result => { if (result?.error) throw result.error;return result; };
  async function replay(op, db) {
    if (op.type === 'comment') {
      const { error } = await db.from('mw_echoes').insert({ id: op.id, post_id: op.target, user_id: op.account, author_name: op.author, body: op.body });
      if (error && error.code !== '23505') throw error;
      if (op.details) await details(op, db);
      return;
    }
    const match = op.type === 'follow' ? { follower_id: op.account, following_id: op.target } : op.type === 'save' ? { post_id: op.target, user_id: op.account } : { post_id: op.target, user_id: op.account, kind: op.kind };
    // Follows go through the app's table resolver (mw_follows, or follows where that is the table's name).
    const from = build => op.type === 'follow' && window.MilkyWayFollows ? window.MilkyWayFollows.query(build) : build(db.from(TABLES[op.type]));
    if (!op.on) { must(await from(q => q.delete().match(match)));return; }
    const { error } = await from(q => q.insert(match));
    if (error && error.code !== '23505') throw error;
  }
  // Replies and tagged people for a queued comment (no attachments: those need an upload and are never queued).
  async function details(op, db) {
    const session = (await db.auth.getSession()).data.session;
    if (!session || session.user?.id !== op.account) throw new Error('signed out');
    const response = await fetch(`${SOCIAL}?action=comment&id=${encodeURIComponent(op.id)}`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: db.supabaseKey || '' }, body: JSON.stringify({ media: [], ...op.details }) });
    if (response.status >= 500) throw new TypeError('Failed to fetch');
  }
  const remove = op => { ops = ops.filter(item => !(item.key === op.key && item.at === op.at));store(); };

  let flushing = null;
  function flush() {
    if (flushing) return flushing;
    const account = me(), db = client();
    if (!account || !db || offline() || !mine().length) return Promise.resolve({ synced: 0, dropped: 0 });
    flushing = (async () => {
      let synced = 0, dropped = 0;
      for (const op of mine()) {
        if (me() !== account) break;
        try { await replay(op, db);remove(op);synced++; }
        catch (error) {
          // Still offline: keep this and everything after it for the next try.
          if (isNetworkError(error)) { schedule();break; }
          // Refused by the server (post deleted, not allowed): the next refresh shows the real state.
          remove(op);dropped++;
          console.warn('outbox', op.type, error?.message || error);
        }
      }
      if (synced || dropped) announce('mw-outbox-synced', { synced, dropped, remaining: mine().length });
      return { synced, dropped };
    })().finally(() => { flushing = null;paint();announce('mw-outbox-change', { size: ops.length }); });
    return flushing;
  }
  let timer = null;
  function schedule() {
    if (timer || !ops.length) return;
    timer = setTimeout(() => { timer = null;if (offline()) schedule(); else flush(); }, RETRY);
  }

  window.addEventListener('mw-reconnected', () => flush());
  window.addEventListener('online', () => setTimeout(() => { if (!offline()) flush(); }, 1500));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !offline()) flush(); });
  // Sends whatever an earlier visit left waiting, once the app has signed in.
  window.addEventListener('load', () => setTimeout(flush, 3000), { once: true });
  // Feed and profile lists re-render often; queued choices are painted back each time.
  const watch = () => {
    for (const id of ['feed', 'profilePosts']) {
      const element = document.getElementById(id);
      if (element && !element.mwOutboxWatched) { element.mwOutboxWatched = true;new MutationObserver(() => paint(element)).observe(element, { childList: true }); }
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once: true }); else watch();
  if (ops.length) schedule();

  window.MilkyWayOutbox = {
    queue, state, comments, paint, flush, isNetworkError,
    offline,
    get size() { return mine().length; },
    text: key => word(key),
  };
})();
