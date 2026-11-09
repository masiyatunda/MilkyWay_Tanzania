// Platform-wide "Everyone" Live broadcast: every active member sees a tappable banner on any screen
// as soon as a public Live is on air, and one tap takes them straight into the room as a viewer.
(() => {
  const indexes = { en: 0, sw: 1, fr: 2, zh: 3, ar: 4, pt: 5, hi: 6, de: 7 };
  const words = {
    isLive: ['is LIVE now', 'yuko LIVE sasa', 'est en direct', '正在直播', 'في بث مباشر الآن', 'está ao vivo agora', 'अभी LIVE है', 'ist jetzt LIVE'],
    everyoneLive: ['Live for everyone', 'Live kwa kila mtu', 'Direct pour tout le monde', '面向所有人的直播', 'بث للجميع', 'Ao vivo para todos', 'सभी के लिए LIVE', 'LIVE für alle'],
    watch: ['Watch', 'Tazama', 'Regarder', '观看', 'شاهد', 'Assistir', 'देखें', 'Ansehen'],
    listen: ['Listen', 'Sikiliza', 'Écouter', '收听', 'استمع', 'Ouvir', 'सुनें', 'Zuhören'],
    more: ['+{n} more live', '+{n} zaidi LIVE', '+{n} autres en direct', '另有 {n} 场直播', '+{n} بث آخر', '+{n} ao vivo', '+{n} और LIVE', '+{n} weitere LIVE'],
    dismiss: ['Dismiss', 'Ondoa', 'Ignorer', '关闭', 'تجاهل', 'Dispensar', 'हटाएं', 'Ausblenden'],
  };
  const T = (key, values = {}) => { const row = words[key];const language = window.MilkyWayI18n?.language?.() || 'sw';return (row[indexes[language]] || row[0]).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? ''); };
  const node = (tag, props = {}, ...children) => { const element = Object.assign(document.createElement(tag), props);element.append(...children.filter(child => child != null));return element; };
  const seenKey = 'mw_broadcast_seen';
  const seen = new Set((() => { try { return JSON.parse(sessionStorage.getItem(seenKey) || '[]'); } catch { return []; } })());
  const markSeen = room => { seen.add(room);try { sessionStorage.setItem(seenKey, JSON.stringify([...seen].slice(-100))); } catch {} };
  const forEveryone = record => ['public', 'everyone'].includes(record?.scope || 'public');
  const audio = record => /audio/.test(record.room_name || '');

  const banner = node('div', { className: 'mw-broadcast', hidden: true });
  banner.setAttribute('role', 'status');banner.setAttribute('aria-live', 'polite');
  document.body.append(banner);
  let current = null, timer = 0, records = [];
  const hide = () => { clearTimeout(timer);banner.hidden = true;banner.classList.remove('is-in');current = null; };
  function show(record, others) {
    current = record;
    const name = String(record.profile?.display_name || record.host_name || 'MilkyWay').trim();
    const face = record.profile?.avatar_url ? node('img', { src: window.MilkyWayMedia?.image ? window.MilkyWayMedia.image(record.profile.avatar_url, 96) : record.profile.avatar_url, alt: '' }) : node('span', { textContent: name.slice(0, 1).toUpperCase() });
    const open = node('button', { type: 'button', className: 'mw-broadcast-open' },
      node('span', { className: 'mw-broadcast-face' }, face, node('i', { textContent: 'LIVE' })),
      node('span', { className: 'mw-broadcast-text' }, node('b', { textContent: `${name} ${T('isLive')}` }), node('small', { textContent: [`🌍 ${T('everyoneLive')}`, record.title, others ? T('more', { n: others }) : ''].filter(Boolean).join(' · ') })),
      node('span', { className: 'mw-broadcast-cta', textContent: T(audio(record) ? 'listen' : 'watch') }));
    open.onclick = () => { markSeen(record.room_name);hide();window.MilkyWayLive?.watch(record); };
    const close = node('button', { type: 'button', className: 'mw-broadcast-close', textContent: '×' });
    close.setAttribute('aria-label', T('dismiss'));
    close.onclick = () => { markSeen(record.room_name);hide(); };
    banner.replaceChildren(open, close);
    banner.hidden = false;requestAnimationFrame(() => banner.classList.add('is-in'));
    clearTimeout(timer);timer = setTimeout(() => { markSeen(record.room_name);hide(); }, 15000);
  }
  function evaluate() {
    const inLive = window.MilkyWayLive?.isActive?.() || !document.getElementById('mwLivePage')?.hidden;
    const candidates = records.filter(record => forEveryone(record) && record.host_id !== user?.id && !seen.has(record.room_name));
    if (current && !records.some(record => record.room_name === current.room_name)) hide();
    if (inLive) { if (current) hide();return; }
    if (current || !candidates.length) return;
    show(candidates[0], records.filter(record => forEveryone(record) && record.host_id !== user?.id).length - 1);
  }
  window.addEventListener('mw-live-discovery', event => { records = event.detail?.records || [];evaluate(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') evaluate(); });
  window.MilkyWayBroadcast = { refresh: evaluate };
})();
