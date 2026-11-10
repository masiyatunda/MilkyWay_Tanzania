/* MilkyWay Live v3 — single module: lobby, LiveKit room, snap-to-slot grid, host box control, chat feed.
   Public API (window.MilkyWayLive) is unchanged so gifts, feed, notifications and calls keep working. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tokenEndpoint = '/api/milkyway-livekit-token';
  const directTokenEndpoint = 'https://wpclkhgizbvxuvbhbwzs.supabase.co/functions/v1/livekit-token';
  const roomEndpoint = '/api/milkyway-live-room';
  const roomPattern = /^mw-(audio|video)-live-/;
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  const COPY = {
    live: ['LIVE', 'LIVE'], liveNow: ['Live now', 'Live sasa'], videoLive: ['Video LIVE', 'Video LIVE'], audioLive: ['Audio LIVE', 'Sauti LIVE'],
    titlePh: ['Add a title to your LIVE', 'Weka kichwa cha LIVE yako'], seats: ['Guest seats', 'Viti vya wageni'], auto: ['Auto-accept guests', 'Kubali wageni moja kwa moja'],
    none: ['Nobody is live right now.', 'Hakuna aliye live sasa hivi.'], unavailable: ['Live list unavailable.', 'Orodha ya Live haipatikani.'],
    history: ['Live history', 'Historia ya Live'], menu: ['Menu', 'Menyu'], back: ['Back', 'Rudi'], noHistory: ['No past LIVE sessions.', 'Hakuna historia ya LIVE bado.'],
    historySignIn: ['Sign in to view your LIVE history.', 'Ingia ili kuona historia yako ya LIVE.'],
    historyUnavailable: ['Could not load LIVE history.', 'Historia ya LIVE haikuweza kupakiwa.'],
    historyRemove: ['Remove from history', 'Ondoa kwenye historia'], historyRemoveConfirm: ['Remove this LIVE from your history? This will not delete it for anyone else.', 'Ondoa LIVE hii kwenye historia yako? Haitaondolewa kwa watu wengine.'],
    watch: ['Watch', 'Tazama'], you: ['You', 'Wewe'], host: ['HOST', 'MWENYEJI'], away: ['Away', 'Hayupo'], connecting: ['Connecting…', 'Inaunganisha…'],
    connected: ['LIVE', 'LIVE'], reconnecting: ['Reconnecting…', 'Inaunganisha tena…'], comment: ['Add comment…', 'Andika maoni…'], send: ['Send', 'Tuma'],
    newMsgs: ['New comments ↓', 'Maoni mapya ↓'], enterBox: ['Enter my box', 'Ingia kwenye boksi'], leaveBox: ['Leave my box', 'Toka kwenye boksi'],
    guests: ['Guests', 'Wageni'], requests: ['Requests', 'Maombi'], onStage: ['On stage', 'Jukwaani'], people: ['Watching', 'Wanaotazama'], settings: ['Live settings', 'Mipangilio ya Live'],
    join: ['Join', 'Omba kujiunga'], pending: ['Requested', 'Umeomba'], leaveStage: ['Leave stage', 'Toka jukwaani'], joinNow: ['Join now', 'Jiunge sasa'],
    approve: ['Approve', 'Kubali'], reject: ['Decline', 'Kataa'], remove: ['Remove from box', 'Ondoa kwenye boksi'], mute: ['Mute mic', 'Zima maikrofoni'], unmute: ['Allow mic', 'Ruhusu maikrofoni'],
    makeBig: ['Make big', 'Kuza boksi'], equal: ['Equal grid', 'Gridi sawa'], earlier: ['Move earlier', 'Sogeza mbele'], later: ['Move later', 'Sogeza nyuma'],
    admission: ['Who can join', 'Nani anaweza kujiunga'], approval: ['Approval', 'Idhini'], direct: ['Direct', 'Moja kwa moja'], closed: ['Closed', 'Imefungwa'],
    seatCount: ['Guest boxes', 'Mabox ya wageni'], noRequests: ['No requests yet.', 'Hakuna maombi bado.'], noGuests: ['No guests on stage.', 'Hakuna wageni jukwaani.'],
    volume: ['Volume', 'Sauti'], output: ['Speaker', 'Spika'], defaultOut: ['Default', 'Chaguo-msingi'], endConfirm: ['End this LIVE for everyone?', 'Maliza LIVE hii kwa kila mtu?'],
    ended: ['This LIVE has ended.', 'LIVE hii imeisha.'], joinFailed: ['Could not join the LIVE.', 'Imeshindikana kujiunga na LIVE.'], startFailed: ['Could not start the LIVE.', 'Imeshindikana kuanza LIVE.'],
    signIn: ['Sign in to use LIVE.', 'Ingia ili kutumia LIVE.'], secure: ['LIVE needs a secure (HTTPS) page with camera and microphone access.', 'LIVE inahitaji ukurasa salama (HTTPS) wenye ruhusa ya kamera na maikrofoni.'],
    wants: ['wants to join', 'anaomba kujiunga'], approved: ['You are on stage', 'Uko jukwaani'], share: ['Link copied', 'Link imenakiliwa'], offline: ['No network connection.', 'Hakuna mtandao.'],
    removed: ['Comment removed', 'Maoni yameondolewa'], delConfirm: ['Remove this comment?', 'Ondoa maoni haya?'], full: ['All guest boxes are full.', 'Mabox yote ya wageni yamejaa.'],
    micOff: ['Mic off', 'Maikrofoni imezimwa'], seatEmpty: ['Empty seat', 'Kiti wazi'], leaveRoom: ['Leave', 'Toka'], requestJoin: ['Request to Join', 'Omba kuingia'], cancelRequest: ['Cancel request', 'Futa ombi'],
    addSeat: ['Add box', 'Ongeza boksi'], removeSeat: ['Remove box', 'Punguza boksi'], camOff: ['Camera off', 'Kamera imezimwa'], camOn: ['Camera on', 'Washa kamera'],
    flipCam: ['Flip camera', 'Geuza kamera'], soundMute: ['Mute audio', 'Zima sauti'], soundEnable: ['Enable audio', 'Washa sauti'],
    liveControls: ['Live controls', 'Vidhibiti vya Live'], close: ['Close', 'Funga'], refresh: ['Refresh', 'Onyesha upya'],
  };
  const lang = () => { try { return window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch { return 'sw'; } };
  const t = key => { const row = COPY[key]; return row ? (lang().startsWith('sw') ? row[1] : row[0]) : key; };

  const icon = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const ICONS = {
    mic: icon('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>'),
    micOff: icon('<path d="m3 3 18 18M9 9v2a3 3 0 0 0 5 2m1-3V5a3 3 0 0 0-6-.7M5 11a7 7 0 0 0 11 5.7M12 18v4"/>'),
    cam: icon('<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/>'),
    camOff: icon('<path d="m3 3 18 18M15 10l6-3v10l-3.5-1.7M7 6h5a3 3 0 0 1 3 3v5M3 8v7a3 3 0 0 0 3 3h7"/>'),
    flip: icon('<path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h7"/><circle cx="10" cy="13" r="3"/><path d="m17 14 2 2 2-2m-2 2v-5"/>'),
    sound: icon('<path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14"/>'),
    soundOff: icon('<path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/>'),
    guests: icon('<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-2a5 5 0 0 1 10 0v2m2-15a3.2 3.2 0 0 1 0 6m3 9v-2a5 5 0 0 0-3-4.6"/>'),
    plus: icon('<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-2a5 5 0 0 1 10 0v2M19 8v6m-3-3h6"/>'),
    share: icon('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12m-4-8 4-4 4 4"/>'),
    gear: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.4C.9 8 2.9 4.5 6.3 4.5c2 0 3.5 1 4.4 2.5l1.3 2 1.3-2c.9-1.5 2.4-2.5 4.4-2.5 3.4 0 5.4 3.5 3.9 7.1C19.5 16.4 12 21 12 21Z"/></svg>',
    eye: icon('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    send: icon('<path d="m22 2-7 20-4-9-9-4 20-7Zm0 0L11 13"/>'),
    close: icon('<path d="M6 6l12 12M18 6 6 18"/>'),
    box: icon('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6m-3-3v6"/>'),
  };

  const S = {
    page: null, room: null, sdk: null, session: null, host: false, mode: 'video', state: null, gen: 0, joining: false,
    sound: true, volume: 1, inBox: true, staged: false, staging: false, stageTries: 0, facing: 'user', records: [],
    pollTimer: null, polling: false, pollQueued: false, sheet: '', auth: null, ending: null, consumedHash: '', seenPending: new Set(),
    seenGift: new Set(), chatKey: '', firstChat: true, profiles: new Map(), roster: '', tiles: new Map(), audio: new Map(), discovering: false, lastDiscovery: 0, profileKey: '', historyRecords: [],
  };
  const tiles = S.tiles;
  const mePublishing = () => !!S.room && S.room.localParticipant.permissions?.canPublish !== false;
  const myId = () => user?.id;
  const nameOf2 = () => (typeof nameOf === 'function' ? nameOf() : 'Msafiri');
  const modeOf = record => (String(record?.room_name || '').startsWith('mw-audio-') ? 'audio' : 'video');
  const safe = value => String(value ?? '');

  // ---------- small helpers ----------
  let messageTimer = null;
  function say(text, problem = false) {
    const box = $('mwLiveMessage');
    if (!box) return;
    clearTimeout(messageTimer);
    box.textContent = text || '';
    box.classList.toggle('is-error', !!problem);
    box.classList.toggle('is-on', !!text);
    if (text) messageTimer = setTimeout(() => box.classList.remove('is-on'), problem ? 6000 : 3200);
  }
  const initial = name => (Array.from(safe(name).trim())[0] || 'M').toUpperCase();
  function paintAvatar(node, profileOrUrl, name) {
    if (!node) return;
    const url = typeof profileOrUrl === 'string' ? profileOrUrl : profileOrUrl?.avatar_url;
    node.textContent = '';
    if (url && /^(https:|blob:|data:image\/)/.test(url)) {
      const img = new Image();
      img.alt = '';img.decoding = 'async';img.referrerPolicy = 'no-referrer';
      img.onerror = () => { img.remove();node.textContent = initial(name); };
      img.src = url;node.append(img);
    } else node.textContent = initial(name);
  }

  // ---------- network ----------
  async function authHeaders() {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(t('signIn'));
    S.auth = { token, user: data.session.user };
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: sb.supabaseKey || '' };
  }
  const jsonReply = res => !!res && res.status !== 404 && res.status !== 405 && /\bjson\b/i.test(res.headers.get('content-type') || '');
  // `direct` is the Supabase function used when the site gateway is absent (static hosts answer unknown /api paths with HTML).
  async function post(url, body, { direct = '', signal, retry = true } = {}) {
    const init = { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body), signal };
    let res = null;
    try { res = await fetch(url, init); } catch (error) { if (signal?.aborted) throw error; console.error('[MilkyWay Live] request failed', url, error); }
    if (direct && !jsonReply(res)) { console.warn(`[MilkyWay Live] ${url} gave no JSON (HTTP ${res?.status ?? 'none'}); using ${direct}`);res = await fetch(direct, init); }
    if (!res) throw new Error(t('offline'));
    if (res.status === 401 && retry) {
      const refreshed = await sb.auth.refreshSession();
      if (!refreshed.error) return post(url, body, { direct, signal, retry: false });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object' || Array.isArray(data)) {
      console.error('[MilkyWay Live] bad reply', { url, status: res.status, data });
      throw Object.assign(new Error((data && typeof data.error === 'string' && data.error.slice(0, 300)) || `HTTP ${res.status}`), { status: res.status });
    }
    return data;
  }
  const roomAction = (action, values = {}, record = S.session) => post(roomEndpoint, { room: record.room_name, action, ...values }, { signal: AbortSignal.timeout(15000) });

  async function fetchToken(record, asHost) {
    const body = { room: record.room_name, roomName: record.room_name, identity: myId(), name: nameOf2(), participantName: nameOf2(), role: asHost ? 'host' : 'viewer', title: record.title, scope: record.scope, action: 'token' };
    const payload = await post(tokenEndpoint, body, { direct: directTokenEndpoint, signal: AbortSignal.timeout(30000) });
    if (payload.roomName && payload.roomName !== record.room_name) throw new Error('The token service returned a different room.');
    if (typeof payload.token !== 'string' || !payload.token || typeof payload.serverUrl !== 'string') throw new Error('The token service did not return a LiveKit server URL and token.');
    let address;
    try { address = new URL(payload.serverUrl); } catch { throw new Error('The token service returned an invalid LiveKit URL.'); }
    if (address.protocol !== 'wss:') throw new Error(`LiveKit URL must use wss:// (got ${address.protocol}//). Check LIVEKIT_URL.`);
    return payload;
  }

  // ---------- discovery (Live now list) ----------
  const discoveryFetch = async init => {
    let res = null;
    try { res = await fetch('/api/milkyway-discovery', init); } catch (error) { if (init?.signal?.aborted) throw error; }
    if (jsonReply(res)) return res;
    return fetch(directTokenEndpoint, { ...init, method: 'POST', headers: { ...init.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discovery' }) });
  };
  async function accessible(records) {
    const restricted = record => (record.scope || record.audience_scope) === 'followers';
    if (!user) return records.filter(record => !restricted(record));
    const ids = [...new Set(records.filter(record => restricted(record) && record.host_id !== user.id).map(record => record.host_id))];
    if (!ids.length || !window.MilkyWayFollows?.query) return ids.length ? records.filter(record => !restricted(record) || record.host_id === user.id) : records;
    const follows = await window.MilkyWayFollows.query(q => q.select('following_id').eq('follower_id', user.id).in('following_id', ids));
    if (follows.error) throw new Error('Could not verify follower-only access.');
    const allowed = new Set((follows.data || []).map(row => row.following_id));
    return records.filter(record => !restricted(record) || record.host_id === user.id || allowed.has(record.host_id));
  }
  function uniqueLiveRecords(records) {
    const rooms = new Set(), hosts = new Set(), ids = new Set();
    return records.filter(record => {
      const room = String(record.room_name || '').trim();
      const host = String(record.host_id || '').trim();
      const id = String(record.id || '').trim();
      if (!room || !host || rooms.has(room) || hosts.has(host) || (id && ids.has(id))) return false;
      rooms.add(room);hosts.add(host);
      if (id) ids.add(id);
      return true;
    });
  }
  let listKey = '';
  async function refresh(force = true) {
    if (typeof sb === 'undefined' || S.discovering) return;
    if (!force && Date.now() - S.lastDiscovery < Math.max(4000, window.mwSyncPeriod?.() ?? 0)) return;
    S.discovering = true;
    try {
      const result = await sb.from('mw_video_live_sessions').select('id,room_name,host_id,host_name,title,scope,is_live,started_at').eq('is_live', true).order('started_at', { ascending: false }).limit(100);
      if (result.error) throw new Error(t('unavailable'));
      const records = uniqueLiveRecords(await accessible(result.data || []));
      const authSession = (await sb.auth.getSession()).data.session;
      const res = await discoveryFetch({ headers: { apikey: sb.supabaseKey || '', ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      const verified = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(verified?.sessions)) throw new Error(t('unavailable'));
      const verifiedRooms = new Map(verified.sessions.filter(item => item?.room_name).map(item => [item.room_name, item]));
      const active = records.filter(record => verifiedRooms.has(record.room_name));
      active.forEach(record => { record.verified = true;record.connectedCount = verifiedRooms.get(record.room_name)?.connectedCount; });
      const ids = [...new Set(records.map(record => record.host_id))].sort();
      const key = ids.join(',');
      if (ids.length && key !== S.profileKey) {
        const profiles = await sb.from('mw_profiles').select('id,display_name,username,avatar_url').in('id', ids);
        if (!profiles.error) { S.profiles = new Map((profiles.data || []).map(row => [row.id, row]));S.profileKey = key; }
      }
      records.forEach(record => { record.profile = S.profiles.get(record.host_id); });
      const visible = records.filter(record => record.verified || record.host_id === user?.id);
      paintList(visible, active.length);
      const signature = JSON.stringify([user?.id, active]);
      if (signature !== listKey) { listKey = signature;S.records = active;window.dispatchEvent(new CustomEvent('mw-live-discovery', { detail: { records: active } })); }
      consumeHash(records);
    } catch (error) {
      console.error('[MilkyWay Live] discovery failed', error);
      const list = $('mwLiveSessions');
      if (list) list.textContent = error.message || t('unavailable');
    } finally { S.lastDiscovery = Date.now();S.discovering = false; }
  }
  function consumeHash(records) {
    const hash = location.hash;
    const id = hash.startsWith('#mw-live-') ? hash.slice(9) : hash.startsWith('#live=') ? decodeURIComponent(hash.slice(6)) : '';
    if (!id || !user || S.consumedHash === hash) return;
    S.consumedHash = hash;
    const shared = records.find(record => record.id === id || record.room_name === id);
    if (shared) watch(shared); else { open({ entry: 'viewer' });say(t('ended'), true); }
  }
  let cardKey = '';
  function paintList(records, activeCount) {
    const list = $('mwLiveSessions');
    if (!list) return;
    records = uniqueLiveRecords(records);
    const key = JSON.stringify([lang(), user?.id, activeCount, records.map(r => [r.id, r.title, r.verified, r.connectedCount, r.profile?.display_name, r.profile?.avatar_url])]);
    const badge = $('mwLiveNowCount');
    if (badge) { badge.hidden = !activeCount;badge.textContent = String(activeCount); }
    if (key === cardKey && list.childElementCount) return;
    cardKey = key;
    list.replaceChildren();
    if (!records.length) { const empty = document.createElement('p');empty.className = 'lv-empty';empty.textContent = t('none');list.append(empty);return; }
    for (const record of records) {
      const card = document.createElement('button');card.type = 'button';card.className = 'lv-card mw-live-session';
      card.dataset.liveKey = record.id || record.room_name;
      card.dataset.room = record.room_name;
      const face = document.createElement('span');face.className = 'lv-avatar';
      const name = record.profile?.display_name || record.host_name || 'MilkyWay';
      paintAvatar(face, record.profile, name);
      const info = document.createElement('span');info.className = 'lv-card-info';
      const strong = document.createElement('strong');strong.textContent = record.title || name;
      const small = document.createElement('small');
      small.textContent = `${modeOf(record) === 'audio' ? '🎙' : '🎥'} ${name}${record.connectedCount ? ` · ${record.connectedCount}` : ''}`;
      info.append(strong, small);
      const go = document.createElement('span');go.className = 'lv-card-go';go.textContent = t('watch');
      card.append(face, info, go);
      card.onclick = () => watch(record);
      list.append(card);
    }
  }

  async function loadHistory() {
    const list = $('mwLiveHistoryList');
    if (!list) return;
    list.replaceChildren();
    if (!user?.id || typeof sb === 'undefined') {
      const empty = document.createElement('p');empty.className = 'lv-empty';empty.textContent = t('historySignIn');list.append(empty);return;
    }
    const loading = document.createElement('p');loading.className = 'lv-empty';loading.textContent = '…';list.append(loading);
    try {
      const result = await sb.from('mw_video_live_sessions')
        .select('id,room_name,host_id,host_name,title,is_live,started_at,ended_at')
        .eq('host_id', user.id).eq('is_live', false)
        .order('ended_at', { ascending: false, nullsFirst: false }).limit(100);
      if (result.error) throw result.error;
      const records = result.data || [];
      let archived = [];
      if (records.length) {
        const ids = records.map(record => record.id).join(',');
        const response = await fetch(`/api/milkyway-account?action=live-history&ids=${encodeURIComponent(ids)}`, {
          headers: await authHeaders(), cache: 'no-store', signal: AbortSignal.timeout(12000),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || t('historyUnavailable'));
        archived = data.archived || [];
      }
      const hidden = new Set(archived.map(item => `${item.source}:${item.id}`));
      S.historyRecords = records.filter(record => !hidden.has(`${modeOf(record)}:${record.id}`));
      paintHistory();
    } catch (error) {
      console.error('[MilkyWay Live] history load failed', error);
      list.replaceChildren();
      const message = document.createElement('p');message.className = 'lv-empty';message.textContent = error.message || t('historyUnavailable');list.append(message);
    }
  }
  function paintHistory() {
    const list = $('mwLiveHistoryList');
    if (!list) return;
    list.replaceChildren();
    if (!S.historyRecords.length) {
      const empty = document.createElement('p');empty.className = 'lv-empty';empty.textContent = t('noHistory');list.append(empty);return;
    }
    for (const record of S.historyRecords) {
      const row = document.createElement('article');row.className = 'lv-history-item';
      const info = document.createElement('span');info.className = 'lv-history-info';
      const title = document.createElement('strong');title.textContent = record.title || (modeOf(record) === 'audio' ? t('audioLive') : t('videoLive'));
      const date = document.createElement('small');date.textContent = `${modeOf(record) === 'audio' ? '🎙' : '🎥'} ${new Date(record.ended_at || record.started_at).toLocaleString(lang().startsWith('sw') ? 'sw-TZ' : 'en')}`;
      info.append(title, date);
      const remove = document.createElement('button');remove.type = 'button';remove.className = 'lv-history-delete';remove.dataset.action = 'history-delete';remove.dataset.id = record.id;remove.dataset.source = modeOf(record);remove.textContent = t('historyRemove');remove.setAttribute('aria-label', `${t('historyRemove')}: ${title.textContent}`);
      row.append(info, remove);list.append(row);
    }
  }
  async function removeHistory(recordId, source, button) {
    const record = S.historyRecords.find(item => item.id === recordId && modeOf(item) === source);
    if (!record) return;
    const confirmed = await (window.MilkyWayDialog?.confirm
      ? window.MilkyWayDialog.confirm({ message: t('historyRemoveConfirm'), danger: true })
      : Promise.resolve(confirm(t('historyRemoveConfirm'))));
    if (!confirmed) return;
    button.disabled = true;
    try {
      const response = await fetch('/api/milkyway-account?action=live-history', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ sessions: [{ id: record.id, source }] }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('historyUnavailable'));
      await loadHistory();
    } catch (error) {
      console.error('[MilkyWay Live] history removal failed', error);
      say(error.message || t('historyUnavailable'), true);
      button.disabled = false;
    }
  }
  function openHistory() {
    $('mwLiveLobbyMenu').hidden = true;
    $('mwLiveLobbyMenuButton')?.setAttribute('aria-expanded', 'false');
    $('mwLiveSetup').hidden = true;
    document.querySelector('#mwLiveLobby .lv-now').hidden = true;
    $('mwLiveHistory').hidden = false;
    loadHistory();
  }
  function closeHistory() {
    $('mwLiveHistory').hidden = true;
    $('mwLiveSetup').hidden = false;
    document.querySelector('#mwLiveLobby .lv-now').hidden = false;
  }
  function closeLobbyMenu() {
    const menu = $('mwLiveLobbyMenu');
    if (menu) menu.hidden = true;
    $('mwLiveLobbyMenuButton')?.setAttribute('aria-expanded', 'false');
  }

  // ---------- page open / close ----------
  let focusBefore = null;
  function open(options = {}) {
    const page = S.page;
    const viewer = options.entry === 'viewer' || (/^#(mw-live-|live=)/.test(location.hash) && S.consumedHash !== location.hash);
    if (!S.room && !S.joining) page.dataset.entry = viewer ? 'viewer' : 'host';
    if (!page.hidden) return;
    focusBefore = document.activeElement;
    document.body.classList.add('lv-open');
    page.hidden = false;
    page.classList.add('open');
    window.MilkyWayLoadLiveKit?.().catch(() => {});
    if (!options.start) refresh();
  }
  function hidePage() {
    S.page.hidden = true;S.page.classList.remove('open');
    document.body.classList.remove('lv-open');
    closeLobbyMenu();
    if (!$('mwLiveHistory').hidden) closeHistory();
    try { focusBefore?.focus?.({ preventScroll: true }); } catch {}
    focusBefore = null;
  }
  async function close() {
    if (S.room || S.joining) {
      if (S.host && S.room) {
        const ok = await (window.MilkyWayDialog?.confirm ? window.MilkyWayDialog.confirm({ message: t('endConfirm'), danger: true }) : Promise.resolve(confirm(t('endConfirm'))));
        if (!ok) return;
      }
      await disconnect();
    }
    hidePage();
  }

  // ---------- start / watch ----------
  function start(nextMode) {
    if (S.joining || S.room) return;
    open({ start: true });
    connect(true, null, nextMode === 'audio' ? 'audio' : 'video');
  }
  function watch(record) {
    if (!record?.room_name) return;
    if (S.joining || S.room) { if (S.session?.room_name === record.room_name) { open(); return; } return; }
    const own = record.host_id === user?.id;
    open(own ? {} : { entry: 'viewer' });
    connect(own, record);
  }

  function showStage(record, asHost, mode) {
    const stage = $('mwLiveStage');
    stage.dataset.role = asHost ? 'host' : 'viewer';stage.dataset.mode = mode;stage.dataset.count = '1';
    stage.classList.toggle('tt-audio-stage', mode === 'audio');
    $('mwLiveLobby').hidden = true;stage.hidden = false;
    S.page.dataset.view = 'stage';
    const name = record.profile?.display_name || record.host_name || nameOf2();
    $('mwLiveHostName').textContent = name;
    paintAvatar($('mwLiveHostAvatar'), asHost ? user?.user_metadata?.avatar_url : record.profile, name);
    $('mwLiveStatus').textContent = t('connecting');
    stage.classList.remove('is-live');
    syncRoster();paintControls();bindKeyboard();
  }
  function showLobby() {
    $('mwLiveStage').hidden = true;$('mwLiveLobby').hidden = false;
    S.page.dataset.view = 'lobby';
    S.page.style.removeProperty('--lv-kb');
  }

  async function connect(asHost, record, startMode) {
    if (S.joining || S.room) return;
    const attempt = ++S.gen;
    S.joining = true;
    let createdRecord = null;
    let sdk = null;
    let phase = 'preflight';
    try {
      if (typeof sb === 'undefined' || !user) throw new Error(t('signIn'));
      if (asHost && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) throw new Error(t('secure'));
      await authHeaders();
      const sdkLoading = (window.MilkyWayLoadLiveKit?.() || Promise.resolve(window.LivekitClient || window.LiveKitClient)).catch(error => { console.error('[MilkyWay Live] LiveKit SDK failed to load (network, CSP or ad blocker?)', error);return null; });
      let mode = record ? modeOf(record) : startMode;
      if (asHost && !record) {
        const roomName = `mw-${mode}-live-${uuid()}`;
        const title = $('mwLiveTitle')?.value.trim() || (mode === 'audio' ? t('audioLive') : t('videoLive'));
        const row = { room_name: roomName, host_id: user.id, host_name: nameOf2(), title, scope: 'public', is_live: true, started_at: new Date().toISOString(), ended_at: null };
        phase = 'listing';
        const saved = await sb.from('mw_video_live_sessions').insert(row).select('id').single();
        if (saved.error) { console.error('[MilkyWay Live] could not save the session row', saved.error);throw new Error('The room could not be saved. Check live-session permissions.'); }
        createdRecord = record = { ...row, id: saved.data.id };
      }
      S.session = record;S.host = asHost;S.mode = mode;S.inBox = true;S.state = null;
      showStage(record, asHost, mode);
      phase = 'token';
      const payload = await fetchToken(record, asHost);
      sdk = await sdkLoading;
      if (!sdk?.Room) throw new Error('LiveKit did not load. Check your connection and retry.');
      if (attempt !== S.gen) { if (createdRecord) await endRecord(createdRecord);return; }
      S.sdk = sdk;
      const room = new sdk.Room({
        adaptiveStream: true, dynacast: true,
        videoCaptureDefaults: { resolution: { width: 960, height: 540, frameRate: 24 }, facingMode: S.facing },
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        publishDefaults: { simulcast: true, videoEncoding: { maxBitrate: 1200000, maxFramerate: 24 }, backupCodec: false },
      });
      S.room = room;
      wireRoom(room, sdk, attempt);
      phase = 'connection';
      try { await room.connect(payload.serverUrl, payload.token); }
      catch (error) {
        console.error('[MilkyWay Live] LiveKit connect failed', { name: error?.name, message: error?.message, reason: error?.reason, status: error?.status, code: error?.code, serverUrl: payload.serverUrl, origin: location.origin, online: navigator.onLine }, error);
        throw Object.assign(new Error(`LiveKit connection failed${error?.status ? ` (HTTP ${error.status})` : ''}: ${error?.message || 'unknown error'}`), { cause: error });
      }
      if (attempt !== S.gen) { await room.disconnect(true);if (createdRecord) await endRecord(createdRecord);return; }
      room.startAudio?.().catch(() => {});
      if (asHost) {
        phase = 'publication';
        if (room.localParticipant.permissions?.canPublish === false) throw new Error('The server issued a viewer token to the host. Deploy the corrected token function.');
        await room.localParticipant.setMicrophoneEnabled(true);
        if (mode === 'video') await room.localParticipant.setCameraEnabled(true, { facingMode: S.facing });
        const seats = Math.max(1, Math.min(8, Number($('mwLiveSeatCount')?.value) || 3));
        await roomAction('started');
        await roomAction('settings', { layout: seats + 1, admission: $('mwLiveAutoAccept')?.checked ? 'direct' : 'approval', layoutStyle: 'grid', hostPosition: 'start', mobileLayout: 'stack', featuredId: null, order: [] }).catch(error => console.warn('[MilkyWay Live] settings', error));
        announce(record.room_name);
      }
      S.joining = false;
      $('mwLiveStage').classList.add('is-live');
      $('mwLiveStatus').textContent = t('connected');
      syncRoster();syncTracks();paintControls();
      S.pollTimer = setInterval(() => { if (document.visibilityState !== 'hidden') poll(); }, 1200);
      await poll();
    } catch (error) {
      console.error(`[MilkyWay Live] ${asHost ? 'start' : 'join'} failed during "${phase}"`, error);
      if (attempt === S.gen) {
        const detail = error?.message || '';
        const created = createdRecord;
        await teardown();
        if (created) await endRecord(created).catch(() => {});
        say(`${asHost ? t('startFailed') : t('joinFailed')} ${detail}`.trim(), true);
      } else if (S.room && attempt !== S.gen) await S.room.disconnect(true).catch(() => {});
    } finally { if (attempt === S.gen) S.joining = false; }
  }

  async function announce(roomName) {
    for (let tries = 0; tries < 4; tries++) {
      await new Promise(resolve => setTimeout(resolve, tries ? 4000 : 5500));
      if (!S.room || S.session?.room_name !== roomName) return;
      try { const result = await window.MilkyWayLiveNotifications?.api?.('live-started', { room: roomName });if (!result || result.complete) return; } catch { /* follower alerts retry quietly */ }
    }
  }

  function wireRoom(room, sdk, attempt) {
    const E = sdk.RoomEvent;
    const live = () => S.room === room && attempt === S.gen;
    const refreshTracks = () => { if (live()) { syncTracks();paintControls(); } };
    room.on(E.TrackSubscribed, refreshTracks).on(E.TrackUnsubscribed, refreshTracks)
      .on(E.LocalTrackPublished, refreshTracks).on(E.LocalTrackUnpublished, refreshTracks)
      .on(E.TrackMuted, refreshTracks).on(E.TrackUnmuted, refreshTracks);
    if (E.TrackSubscriptionFailed) room.on(E.TrackSubscriptionFailed, (sid, participant) => console.error('[MilkyWay Live] subscription failed', sid, participant?.identity));
    room.on(E.ParticipantConnected, () => { if (live()) { syncRoster();paintCount();queuePoll(); } });
    room.on(E.ParticipantDisconnected, participant => {
      if (!live()) return;
      syncRoster();paintCount();queuePoll();
      if (!S.host && participant.identity === S.session?.host_id) hostEnded();
    });
    room.on(E.ActiveSpeakersChanged, speakers => {
      if (!live()) return;
      const ids = new Set(speakers.map(p => p.identity));
      tiles.forEach((tile, id) => tile.el.classList.toggle('is-speaking', ids.has(id)));
      paintAudioRoom();
    });
    room.on(E.DataReceived, payload => {
      if (!live()) return;
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message?.type === 'lv-heart') floatHeart(1);
        else if (message?.type === 'lv-sync') queuePoll();
      } catch { /* ignore foreign packets */ }
    });
    room.on(E.ParticipantPermissionsChanged, () => { if (live()) { queuePoll();paintControls(); } });
    room.on(E.ConnectionStateChanged, state => {
      if (!live()) return;
      $('mwLiveStatus').textContent = state === 'connected' ? t('connected') : state === 'connecting' ? t('connecting') : t('reconnecting');
    });
    room.on(E.Disconnected, reason => {
      if (!live() || S.joining) return;
      console.warn('[MilkyWay Live] disconnected from LiveKit', reason);
      if (S.host) say(t('reconnecting'), true);
      disconnect().then(() => say(t('ended'), true));
    });
  }

  // ---------- teardown ----------
  async function endRecord(record) {
    if (!record?.host_id || record.host_id !== user?.id) return;
    await roomAction('end', {}, record).catch(() => {});
    const result = await sb.from('mw_video_live_sessions').update({ is_live: false, ended_at: new Date().toISOString() }).eq('room_name', record.room_name).eq('host_id', user.id);
    if (result.error) throw new Error('The LIVE ended, but its listing could not be closed.');
  }
  async function teardown() {
    clearInterval(S.pollTimer);S.pollTimer = null;
    const room = S.room;
    S.room = null;S.state = null;S.staged = false;S.staging = false;S.stageTries = 0;S.sheet = '';S.roster = '';S.chatKey = '';S.firstChat = true;S.seenPending.clear();S.seenGift.clear();
    if (room) { try { room.localParticipant.trackPublications.forEach(pub => pub.track?.stop()); } catch {} await room.disconnect(true).catch(() => {}); }
    tiles.forEach(tile => tile.el.remove());tiles.clear();
    S.audio.forEach(item => { try { item.el.remove(); } catch {} });S.audio.clear();
    $('mwLiveGrid')?.replaceChildren();$('mwLiveComments')?.replaceChildren();$('mwLiveHearts')?.replaceChildren();$('mwLiveRemoteAudio')?.replaceChildren();
    closeSheet();closeMenu();
    $('mwLiveSettings').hidden = true;
    showLobby();
    S.session = null;S.host = false;
  }
  async function disconnect() {
    if (S.ending) return S.ending;
    S.ending = (async () => {
      S.gen++;
      const record = S.session, wasHost = S.host, state = S.state?.self?.state;
      let error = '';
      if (record) {
        try {
          if (wasHost) await endRecord(record);
          else if (['speaker', 'pending'].includes(state)) await roomAction('leave-stage', {}, record).catch(() => {});
        } catch (e) { error = e.message || String(e); }
      }
      await teardown();
      S.joining = false;
      return { clean: !error, error };
    })().finally(() => { S.ending = null; });
    return S.ending;
  }
  function hostEnded() {
    const record = S.session;
    if (!record || S.ending) return;
    say(t('ended'), true);
    window.dispatchEvent(new CustomEvent('mw-live-host-ended', { detail: { room_name: record.room_name } }));
    disconnect();
  }
  addEventListener('pagehide', () => {
    if (!S.host || !S.session || !S.auth) return;
    try { fetch(roomEndpoint, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${S.auth.token}`, apikey: sb.supabaseKey || '' }, body: JSON.stringify({ room: S.session.room_name, action: 'end' }) }).catch(() => {}); } catch {}
  });

  // ---------- room state polling ----------
  const queuePoll = () => { if (S.pollQueued) return;S.pollQueued = true;setTimeout(() => { S.pollQueued = false;poll(); }, 150); };
  async function poll() {
    if (!S.room || S.polling) return;
    S.polling = true;
    const gen = S.gen;
    try {
      const result = await roomAction('status');
      if (gen !== S.gen || !S.room) return;
      if (!result.settings || !result.self || !Array.isArray(result.members) || !Array.isArray(result.messages)) throw new Error('Unexpected room status.');
      S.state = result;
      paintAll();
    } catch (error) {
      if (gen !== S.gen) return;
      if (!S.host && (error.status === 404 || /no longer available|has ended/i.test(error.message))) hostEnded();
      else console.warn('[MilkyWay Live] status poll failed', error);
    } finally { S.polling = false; }
  }
  function paintAll() {
    syncRoster();syncTracks();paintComments();paintCount();paintControls();paintSheet();
    stageSelf();
    notifyRequests();
  }

  // Guest publishing: LiveKit permissions change a moment after the host approves, so retry on every poll.
  async function stageSelf() {
    if (S.host || !S.room) return;
    const mine = S.state?.self?.state === 'speaker';
    if (mine && !S.staged && !S.staging && S.stageTries < 12) {
      if (!mePublishing()) { S.stageTries++;return; }
      S.staging = true;
      try {
        await S.room.localParticipant.setMicrophoneEnabled(true);
        if (S.mode === 'video') await S.room.localParticipant.setCameraEnabled(true, { facingMode: S.facing });
        S.staged = true;S.stageTries = 0;say(t('approved'));
      } catch (error) { S.stageTries++;console.warn('[MilkyWay Live] could not publish as a guest', error);if (S.stageTries === 12) say(error.message, true); }
      finally { S.staging = false;syncTracks();paintControls(); }
    } else if (!mine && S.staged) {
      S.staged = false;S.stageTries = 0;
      try { await S.room.localParticipant.setMicrophoneEnabled(false);await S.room.localParticipant.setCameraEnabled(false); } catch {}
      syncTracks();paintControls();
    }
  }
  function notifyRequests() {
    if (!S.host) return;
    const pending = new Set((S.state?.members || []).filter(m => m.state === 'pending').map(m => m.userId));
    for (const member of S.state.members) if (member.state === 'pending' && !S.seenPending.has(member.userId)) say(`${member.name || '…'} ${t('wants')}`);
    S.seenPending = pending;
  }

  // ---------- roster / tiles ----------
  const settingsOf = () => S.state?.settings || { layout: 3, admission: 'approval', order: [], featuredId: null, hostPosition: 'start' };
  const guestCap = () => Math.max(1, settingsOf().layout - 1);
  const nameFor = id => id === S.session?.host_id ? ($('mwLiveHostName')?.textContent || 'Host') : S.state?.members.find(m => m.userId === id)?.name || S.room?.remoteParticipants.get(id)?.name || (id === myId() ? nameOf2() : 'MilkyWay');
  const avatarFor = id => id === S.session?.host_id ? (S.host ? user?.user_metadata?.avatar_url : S.profiles.get(id)?.avatar_url || S.session?.profile?.avatar_url) : S.state?.members.find(m => m.userId === id)?.avatar;
  function here(id) { return id === myId() || !!S.room?.remoteParticipants.has(id); }
  function rosterIds() {
    const hostId = S.session?.host_id;
    if (!hostId) return [];
    const settings = settingsOf();
    const order = Array.isArray(settings.order) ? settings.order : [];
    const speakers = (S.state?.members || []).filter(m => m.state === 'speaker' && here(m.userId)).map(m => m.userId);
    if (!S.host && S.state?.self?.state === 'speaker' && !speakers.includes(myId())) speakers.push(myId());
    const rank = id => { const index = order.indexOf(id);return index < 0 ? 1000 + speakers.indexOf(id) : index; };
    const guests = speakers.filter(id => id !== hostId).sort((a, b) => rank(a) - rank(b)).slice(0, guestCap());
    return settings.hostPosition === 'end' && guests.length ? [...guests, hostId] : [hostId, ...guests];
  }
  function makeTile(id) {
    const el = document.createElement('div');
    el.className = 'lv-tile';el.dataset.id = id;
    el.innerHTML = '<div class="lv-tile-bg"><span class="lv-avatar"></span></div><video playsinline autoplay muted></video><div class="lv-tile-shade"></div><div class="lv-tile-label"><b></b><span class="lv-tile-mic"></span></div><span class="lv-tile-badge" hidden></span>';
    const tile = { el, video: el.querySelector('video'), track: null, sid: '', avatar: el.querySelector('.lv-avatar'), label: el.querySelector('b'), mic: el.querySelector('.lv-tile-mic'), badge: el.querySelector('.lv-tile-badge') };
    el.addEventListener('click', () => tapTile(id));
    el.addEventListener('dblclick', event => { event.preventDefault();sendHeart(); });
    return tile;
  }
  function syncRoster() {
    const grid = $('mwLiveGrid');
    if (!grid || !S.session) return;
    const ids = rosterIds();
    const signature = ids.join('|') + '|' + JSON.stringify([settingsOf().featuredId, settingsOf().layoutStyle]);
    for (const id of ids) {
      let tile = tiles.get(id);
      if (!tile) { tile = makeTile(id);tiles.set(id, tile);grid.append(tile.el); }
      const name = nameFor(id);
      tile.label.textContent = name;
      if (tile.nameKey !== name + avatarFor(id)) { tile.nameKey = name + avatarFor(id);paintAvatar(tile.avatar, avatarFor(id), name); }
      tile.badge.textContent = t('host');
      tile.badge.hidden = id !== S.session.host_id;
    }
    tiles.forEach((tile, id) => { if (!ids.includes(id)) { clearTile(tile);tile.el.remove();tiles.delete(id); } });
    S.ids = ids;
    if (signature !== S.roster) { S.roster = signature;layoutTiles(); }
    $('mwLiveStage').dataset.count = String(ids.length);
    paintAudioRoom();
  }
  function clearTile(tile) { try { tile.track?.detach(tile.video); } catch {} tile.track = null;tile.sid = '';tile.video.srcObject = null; }

  function syncTracks() {
    const room = S.room, sdk = S.sdk;
    if (!room || !sdk) return;
    const Source = sdk.Track.Source;
    const wanted = new Set();
    const people = [room.localParticipant, ...room.remoteParticipants.values()];
    for (const person of people) {
      const local = person === room.localParticipant;
      const tile = tiles.get(person.identity);
      const cam = person.getTrackPublication(Source.Camera);
      const mic = person.getTrackPublication(Source.Microphone);
      if (tile) {
        const track = cam?.track && !cam.isMuted ? cam.track : null;
        if (track && tile.track !== track) { clearTile(tile);track.attach(tile.video);tile.track = track;tile.sid = cam.trackSid; }
        else if (!track && tile.track) clearTile(tile);
        tile.el.classList.toggle('has-video', !!tile.track);
        tile.el.classList.toggle('is-mirror', local && S.facing === 'user');
        const silent = !mic || mic.isMuted;
        tile.el.classList.toggle('is-muted', silent);
        tile.mic.innerHTML = silent ? ICONS.micOff : '';
        const away = local && S.host && !S.inBox;
        tile.el.classList.toggle('is-away', away);
        tile.badge.textContent = away ? t('away') : t('host');
        tile.badge.hidden = !(person.identity === S.session?.host_id || away);
      }
      if (!local && mic?.track) {
        wanted.add(mic.trackSid);
        if (!S.audio.has(mic.trackSid)) {
          const el = mic.track.attach();
          el.autoplay = true;el.dataset.sid = mic.trackSid;
          $('mwLiveRemoteAudio').append(el);
          S.audio.set(mic.trackSid, { el, track: mic.track });
        }
      }
    }
    S.audio.forEach((item, sid) => { if (!wanted.has(sid)) { try { item.track.detach(item.el); } catch {} item.el.remove();S.audio.delete(sid); } });
    applySound();
  }
  function applySound() {
    S.audio.forEach(item => { item.el.muted = !S.sound;item.el.volume = S.volume; });
    const button = $('mwLiveSound');
    if (button) {
      button.innerHTML = S.sound ? ICONS.sound : ICONS.soundOff;
      button.setAttribute('aria-pressed', String(S.sound));
      button.setAttribute('aria-label', S.sound ? t('soundMute') : t('soundEnable'));
    }
  }

  // Slot engine: every tile is snapped to a computed rectangle, so tiles resize and re-arrange as people join or leave.
  function slotRects(count, W, H, featuredIndex, zone) {
    if (count === 1) return [{ x: 0, y: 0, w: W, h: H, full: true }];
    const gap = 4, pad = 4, top = 58 + (S.safeTop || 0);
    const area = { x: pad, y: top, w: W - pad * 2, h: Math.max(140, H - top - zone) };
    const columnsFor = (n, strip) => (strip ? Math.min(n, 4) : n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4);
    const grid = (n, box, ratio, strip) => {
      const cols = columnsFor(n, strip), rows = Math.ceil(n / cols);
      const w = (box.w - gap * (cols - 1)) / cols;
      const h = Math.min((box.h - gap * (rows - 1)) / rows, w * ratio);
      const y0 = box.y + (box.h - (rows * h + gap * (rows - 1))) / 2;
      return Array.from({ length: n }, (_, i) => {
        const row = Math.floor(i / cols), inRow = row === rows - 1 ? n - row * cols : cols;
        const rowW = inRow * w + gap * (inRow - 1);
        return { x: box.x + (box.w - rowW) / 2 + (i - row * cols) * (w + gap), y: y0 + row * (h + gap), w, h };
      });
    };
    if (featuredIndex < 0) return grid(count, area, 1.6, false);
    const bigH = Math.round(area.h * .56);
    const strip = grid(count - 1, { x: area.x, y: area.y + bigH + gap, w: area.w, h: area.h - bigH - gap }, 1.3, true);
    const rects = [];let next = 0;
    for (let i = 0; i < count; i++) rects.push(i === featuredIndex ? { x: area.x, y: area.y, w: area.w, h: bigH, big: true } : strip[next++]);
    return rects;
  }
  function layoutTiles() {
    const stage = $('mwLiveStage'), grid = $('mwLiveGrid');
    if (!stage || stage.hidden || !grid) return;
    const W = grid.clientWidth, H = grid.clientHeight;
    if (!W || !H) return;
    const ids = S.ids || [];
    const style = getComputedStyle(stage);
    S.safeTop = parseFloat(style.getPropertyValue('--lv-safe-top')) || 0;
    const zone = Math.round(Math.min(H * .3, 250) + (S.barH ? S.barH + 8 : 0) + (parseFloat(style.getPropertyValue('--lv-safe-bottom')) || 0));
    stage.style.setProperty('--lv-zone', `${zone}px`);
    const featuredId = settingsOf().featuredId;
    const featuredIndex = ids.length > 1 && featuredId && ids.includes(featuredId) ? ids.indexOf(featuredId) : -1;
    const rects = slotRects(ids.length, W, H, featuredIndex, zone);
    ids.forEach((id, index) => {
      const tile = tiles.get(id), r = rects[index];
      if (!tile || !r) return;
      Object.assign(tile.el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, zIndex: r.big ? 2 : 1 });
      tile.el.classList.toggle('is-full', !!r.full);
      tile.el.classList.toggle('is-big', !!r.big);
      tile.el.dataset.slot = String(index + 1);
    });
  }
  addEventListener('resize', () => layoutTiles());

  // ---------- host box control ----------
  async function saveSettings(patch) {
    const current = settingsOf();
    const next = { layout: current.layout, admission: current.admission, layoutStyle: current.layoutStyle || 'grid', hostPosition: current.hostPosition || 'start', mobileLayout: current.mobileLayout || 'stack', featuredId: current.featuredId || null, order: current.order || [], ...patch };
    if (S.state) S.state.settings = { ...current, ...next };
    syncRoster();layoutTiles();paintSheet();
    try { const result = await roomAction('settings', next);if (S.state) S.state.settings = { ...S.state.settings, ...result.settings }; }
    catch (error) { say(error.message, true);queuePoll(); }
    syncRoster();layoutTiles();paintSheet();
    S.room?.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'lv-sync' })), { reliable: true }).catch(() => {});
  }
  async function moveGuest(id, delta) {
    const guests = (S.ids || []).filter(item => item !== S.session.host_id);
    const index = guests.indexOf(id), target = index + delta;
    if (index < 0 || target < 0 || target >= guests.length) return;
    [guests[index], guests[target]] = [guests[target], guests[index]];
    await saveSettings({ order: guests });
  }
  async function toggleBox() {
    if (!S.host || !S.room || S.mediaBusy) return;
    S.mediaBusy = true;
    const next = !S.inBox;
    const person = S.room.localParticipant;
    const jobs = [person.setMicrophoneEnabled(next)];
    if (S.mode === 'video') jobs.push(person.setCameraEnabled(next, next ? { facingMode: S.facing } : undefined));
    try {
      const results = await Promise.allSettled(jobs);
      const failed = results.find(r => r.status === 'rejected');
      if (failed) { console.error('[MilkyWay Live] toggle box failed', failed.reason);say(failed.reason?.message || t('joinFailed'), true); }
      // Truth comes from the real tracks, so one denied device never leaves the UI out of sync.
      S.inBox = !!person.isMicrophoneEnabled || !!person.isCameraEnabled;
    } finally { S.mediaBusy = false; }
    syncTracks();paintControls();closeMenu();
  }
  function syncBoxState() {
    const person = S.room?.localParticipant;
    if (S.host && person) S.inBox = !!person.isMicrophoneEnabled || !!person.isCameraEnabled;
  }
  async function flipCamera() {
    const pub = S.room?.localParticipant.getTrackPublication(S.sdk.Track.Source.Camera);
    const track = pub?.videoTrack;
    if (!track) return;
    const next = S.facing === 'user' ? 'environment' : 'user';
    try { await track.restartTrack({ facingMode: next });S.facing = next; } catch (error) { console.error('[MilkyWay Live] flip failed', error);say(error.message, true); }
    syncTracks();
  }
  async function hostAct(action, target) {
    try { await roomAction(action, { target });await poll();S.room?.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'lv-sync' })), { reliable: true }).catch(() => {}); }
    catch (error) { say(error.status === 409 ? t('full') : error.message, true); }
  }
  function tapTile(id) {
    if (!S.host || !S.room) return;
    openMenu(id);
  }
  function openMenu(id) {
    const menu = $('mwLiveMenu');
    const isHostTile = id === S.session.host_id;
    const member = S.state?.members.find(m => m.userId === id);
    const featured = settingsOf().featuredId === id;
    const items = [];
    if (isHostTile) {
      items.push([S.inBox ? t('leaveBox') : t('enterBox'), toggleBox, 'primary']);
      if (S.mode === 'video' && S.inBox) items.push([ICONS.flip + ' Flip', flipCamera]);
      if ((S.ids || []).length > 1) items.push([featured ? t('equal') : t('makeBig'), () => saveSettings({ featuredId: featured ? null : id })]);
    } else {
      items.push([featured ? t('equal') : t('makeBig'), () => saveSettings({ featuredId: featured ? null : id })]);
      items.push([t('earlier'), () => moveGuest(id, -1)]);
      items.push([t('later'), () => moveGuest(id, 1)]);
      items.push([member?.hostMuted ? t('unmute') : t('mute'), () => hostAct(member?.hostMuted ? 'allow-mic' : 'mute', id)]);
      items.push([t('remove'), () => hostAct('remove', id), 'danger']);
    }
    menu.replaceChildren();
    const title = document.createElement('p');title.className = 'lv-menu-title';title.textContent = isHostTile ? t('you') : nameFor(id);
    menu.append(title);
    for (const [label, handler, kind] of items) {
      const button = document.createElement('button');button.type = 'button';button.innerHTML = label;
      if (kind) button.dataset.kind = kind;
      button.onclick = async () => { closeMenu();await handler(); };
      menu.append(button);
    }
    menu.hidden = false;$('mwLiveSheetBackdrop').hidden = false;
  }
  function closeMenu() { const menu = $('mwLiveMenu');if (menu) menu.hidden = true;if (!S.sheet && $('mwLiveSheetBackdrop')) $('mwLiveSheetBackdrop').hidden = true; }

  // ---------- sheets: guests (host), people ----------
  function openSheet(name) { S.sheet = name;$('mwLiveSheetBackdrop').hidden = false;paintSheet(); }
  function closeSheet() { S.sheet = '';const sheet = $('mwLiveSheet');if (sheet) sheet.hidden = true;const backdrop = $('mwLiveSheetBackdrop');if (backdrop) backdrop.hidden = true;const menu = $('mwLiveMenu');if (menu) menu.hidden = true; }
  function section(title) { const wrap = document.createElement('section');const h = document.createElement('h3');h.textContent = title;wrap.append(h);return wrap; }
  function personRow(name, avatar, actions) {
    const row = document.createElement('div');row.className = 'lv-row';
    const face = document.createElement('span');face.className = 'lv-avatar';paintAvatar(face, avatar, name);
    const label = document.createElement('b');label.textContent = name;
    row.append(face, label);
    const box = document.createElement('span');box.className = 'lv-row-actions';
    for (const [text, handler, kind] of actions) { const b = document.createElement('button');b.type = 'button';b.textContent = text;if (kind) b.dataset.kind = kind;b.onclick = handler;box.append(b); }
    row.append(box);
    return row;
  }
  function paintSheet() {
    const sheet = $('mwLiveSheet');
    if (!sheet) return;
    if (!S.sheet || !S.state) { sheet.hidden = true;return; }
    sheet.hidden = false;
    const key = JSON.stringify([S.sheet, S.state.settings, S.state.members.map(m => [m.userId, m.state, m.hostMuted]), S.state.connected, lang()]);
    if (sheet.dataset.key === key) return;
    sheet.dataset.key = key;
    sheet.replaceChildren();
    const head = document.createElement('header');
    const h = document.createElement('h2');h.textContent = S.sheet === 'guests' ? t('guests') : t('people');
    const x = document.createElement('button');x.type = 'button';x.className = 'lv-sheet-x';x.innerHTML = ICONS.close;x.setAttribute('aria-label', t('close'));x.onclick = closeSheet;
    head.append(h, x);sheet.append(head);
    const members = S.state.members;
    if (S.sheet === 'guests' && S.host) {
      const settings = S.state.settings;
      const pending = members.filter(m => m.state === 'pending');
      const speakers = members.filter(m => m.state === 'speaker');
      const requests = section(`${t('requests')} (${pending.length})`);
      if (!pending.length) { const p = document.createElement('p');p.className = 'lv-empty';p.textContent = t('noRequests');requests.append(p); }
      pending.forEach(m => requests.append(personRow(m.name || '…', m.avatar, [[t('reject'), () => hostAct('reject', m.userId), 'danger'], [t('approve'), () => hostAct('approve', m.userId), 'primary']])));
      const stage = section(`${t('onStage')} (${speakers.length}/${guestCap()})`);
      if (!speakers.length) { const p = document.createElement('p');p.className = 'lv-empty';p.textContent = t('noGuests');stage.append(p); }
      speakers.forEach(m => stage.append(personRow(m.name || '…', m.avatar, [['↑', () => moveGuest(m.userId, -1)], ['↓', () => moveGuest(m.userId, 1)], [m.hostMuted ? t('unmute') : t('mute'), () => hostAct(m.hostMuted ? 'allow-mic' : 'mute', m.userId)], [t('remove'), () => hostAct('remove', m.userId), 'danger']])));
      const config = section(t('settings'));
      const seats = document.createElement('div');seats.className = 'lv-stepper';
      const minus = document.createElement('button');minus.type = 'button';minus.textContent = '−';
      const plus = document.createElement('button');plus.type = 'button';plus.textContent = '+';
      const value = document.createElement('b');value.textContent = `${t('seatCount')}: ${guestCap()}`;
      minus.onclick = () => saveSettings({ layout: Math.max(2, Math.max(settings.layout - 1, speakers.length + 1)) });
      plus.onclick = () => saveSettings({ layout: Math.min(9, settings.layout + 1) });
      seats.append(minus, value, plus);
      const modes = document.createElement('div');modes.className = 'lv-seg';
      const caption = document.createElement('small');caption.textContent = t('admission');
      for (const [mode, label] of [['approval', t('approval')], ['direct', t('direct')], ['broadcast', t('closed')]]) {
        const b = document.createElement('button');b.type = 'button';b.textContent = label;b.setAttribute('aria-pressed', String(settings.admission === mode));
        b.onclick = () => saveSettings({ admission: mode });modes.append(b);
      }
      config.append(seats, caption, modes);
      sheet.append(requests, stage, config);
    } else {
      const people = section(`${t('people')} (${S.state.connected.length || S.room.remoteParticipants.size + 1})`);
      const seen = new Set();
      [S.session.host_id, ...S.state.connected].forEach(id => {
        if (seen.has(id)) return;seen.add(id);
        people.append(personRow(nameFor(id), avatarFor(id), []));
      });
      sheet.append(people);
    }
  }

  // ---------- controls ----------
  function paintControls() {
    const stage = $('mwLiveStage');
    if (!stage || stage.hidden) return;
    const publishing = !!S.room && (S.host || S.state?.self?.state === 'speaker') && mePublishing();
    const person = S.room?.localParticipant;
    const micOn = !!person?.isMicrophoneEnabled, camOn = !!person?.isCameraEnabled;
    const tools = { mwLiveMic: publishing && S.mode === 'video', mwLiveCamera: publishing && S.mode === 'video', mwLiveFlip: publishing && S.mode === 'video' && camOn };
    for (const [id, visible] of Object.entries(tools)) { const node = $(id);if (node) node.hidden = !visible; }
    $('mwLiveMic').innerHTML = micOn ? ICONS.mic : ICONS.micOff;$('mwLiveMic').setAttribute('aria-pressed', String(micOn));
    $('mwLiveCamera').innerHTML = camOn ? ICONS.cam : ICONS.camOff;$('mwLiveCamera').setAttribute('aria-pressed', String(camOn));
    $('mwLiveFlip').innerHTML = ICONS.flip;
    $('mwLiveMic').setAttribute('aria-label', micOn ? t('mute') : t('unmute'));
    $('mwLiveCamera').setAttribute('aria-label', camOn ? t('camOff') : t('camOn'));
    $('mwLiveFlip').setAttribute('aria-label', t('flipCam'));
    $('mwLiveSound').setAttribute('aria-label', S.sound ? t('soundMute') : t('soundEnable'));
    $('mwLiveSettingsBtn').setAttribute('aria-label', t('settings'));
    const toggle = $('mwLiveBoxToggle');
    toggle.hidden = !(S.host && S.room);
    toggle.dataset.state = S.inBox ? 'in' : 'out';
    toggle.innerHTML = `${ICONS.box}<span>${S.inBox ? t('leaveBox') : t('enterBox')}</span>`;
    toggle.setAttribute('aria-label', S.inBox ? t('leaveBox') : t('enterBox'));
    // Guest bar: labeled actions. Hosts manage boxes and requests, viewers request a seat.
    const self = S.state?.self?.state;
    const settings = settingsOf();
    const closedToGuests = settings.admission === 'broadcast';
    const members = S.state?.members || [];
    const pendingList = members.filter(m => m.state === 'pending');
    const speakerCount = members.filter(m => m.state === 'speaker').length;
    const join = $('mwLiveJoin'), manage = $('mwLiveManage'), seats = $('mwLiveSeats'), card = $('mwLiveRequestCard'), bar = $('mwLiveGuestBar');
    const canJoin = !S.host && !!S.room && !(closedToGuests && self !== 'speaker') && !['rejected', 'banned', 'removed'].includes(self);
    const audio = S.mode === 'audio';
    join.hidden = !canJoin || audio;
    const joinLabel = self === 'speaker' ? t('leaveStage') : self === 'pending' ? t('cancelRequest') : settings.admission === 'direct' ? t('joinNow') : t('requestJoin');
    const joinIcon = self === 'speaker' || self === 'pending' ? ICONS.close : ICONS.plus;
    if (canJoin && !audio) { join.dataset.state = self || 'viewer';join.innerHTML = `${joinIcon}<span>${joinLabel}</span>`; }
    // Audio room bottom bar: mic, request/leave seat, leave room.
    const audioMic = $('mwLiveAudioMic'), audioJoin = $('mwLiveAudioJoin'), audioLeave = $('mwLiveAudioLeave');
    if (audioMic && audioJoin && audioLeave) {
      audioMic.hidden = !(audio && publishing);
      audioMic.innerHTML = micOn ? ICONS.mic : ICONS.micOff;audioMic.setAttribute('aria-pressed', String(micOn));audioMic.setAttribute('aria-label', micOn ? t('mute') : t('unmute'));
      audioJoin.hidden = !(audio && canJoin);
      if (audio && canJoin) { audioJoin.dataset.state = self || 'viewer';audioJoin.innerHTML = `${joinIcon}<span>${joinLabel}</span>`; }
      audioLeave.hidden = !audio;
      audioLeave.innerHTML = `${ICONS.close}<span>${t('leaveRoom')}</span>`;
    }
    manage.hidden = !(S.host && S.room);
    if (S.host) manage.innerHTML = `${ICONS.guests}<span>${t('guests')}</span>${pendingList.length ? `<i class="lv-dot">${pendingList.length}</i>` : ''}`;
    seats.hidden = !(S.host && S.room);
    if (S.host) {
      $('mwLiveSeatValue').textContent = `${t('seatCount')}: ${speakerCount}/${guestCap()}`;
      $('mwLiveSeatMinus').disabled = settings.layout <= Math.max(2, speakerCount + 1);
      $('mwLiveSeatPlus').disabled = settings.layout >= 9;
    }
    const first = S.host ? pendingList[0] : null;
    const cardKey = first ? `${first.userId}|${pendingList.length}|${lang()}` : '';
    if (card.dataset.key !== cardKey) {
      card.dataset.key = cardKey;
      card.hidden = !first;
      card.replaceChildren();
      if (first) {
        const who = document.createElement('span');who.className = 'lv-req-name';
        who.textContent = `${first.name || '…'} ${t('wants')}${pendingList.length > 1 ? ` (+${pendingList.length - 1})` : ''}`;
        const no = document.createElement('button');no.type = 'button';no.className = 'lv-req-no';no.textContent = t('reject');no.onclick = () => hostAct('reject', first.userId);
        const yes = document.createElement('button');yes.type = 'button';yes.className = 'lv-req-yes';yes.textContent = t('approve');yes.onclick = () => hostAct('approve', first.userId);
        card.append(who, no, yes);
      }
    }
    const barShown = !card.hidden || !toggle.hidden || !join.hidden || !manage.hidden;
    bar.hidden = !barShown;
    const barH = barShown ? bar.offsetHeight : 0;
    if (barH !== S.barH) { S.barH = barH;layoutTiles(); }
    stage.dataset.guest = self || '';
    paintAudioRoom();
  }
  // Audio Live: a host seat plus numbered guest seats; empty seats invite requests (guest) or open the manager (host).
  function paintAudioRoom() {
    const room = $('mwLiveAudioRoom');
    if (!room) return;
    const audio = S.mode === 'audio' && !!S.session;
    room.hidden = !audio;
    if (!audio) return;
    const hostId = S.session.host_id, cap = guestCap();
    const guests = (S.ids || []).filter(id => id !== hostId).slice(0, cap);
    const info = id => { const tile = tiles.get(id);return { id, name: nameFor(id), avatar: avatarFor(id) || '', speaking: !!tile?.el.classList.contains('is-speaking'), muted: !!tile?.el.classList.contains('is-muted') }; };
    const seats = [hostId, ...guests].map(info);
    const self = S.state?.self?.state, closed = settingsOf().admission === 'broadcast';
    const key = JSON.stringify([seats, cap, S.host, self, closed, lang()]);
    if (room.dataset.key === key) return;
    room.dataset.key = key;
    room.style.setProperty('--tt-cols', String(cap <= 3 ? cap : cap === 4 ? 2 : cap <= 6 ? 3 : 4));
    room.replaceChildren();
    const build = (seat, empty, index) => {
      const el = document.createElement('button');el.type = 'button';el.className = 'tt-audio-seat';
      const face = document.createElement('div');face.className = 'tt-audio-avatar';
      const name = document.createElement('span');name.className = 'tt-audio-name';
      if (empty) {
        face.classList.add('empty');face.textContent = '+';name.textContent = `${index}`;
        el.setAttribute('aria-label', `${t('seatEmpty')} ${index}`);
        el.disabled = !S.host && (closed || !!self);
        el.onclick = () => { if (S.host) openSheet('guests'); else guestButton(); };
      } else {
        paintAvatar(face, seat.avatar, seat.name);
        if (seat.id === hostId) { face.classList.add('host');el.classList.add('is-host-seat'); }
        if (seat.speaking) face.classList.add('speaking');
        name.textContent = seat.name;
        if (seat.muted) { const mic = document.createElement('i');mic.className = 'tt-audio-mic';mic.innerHTML = ICONS.micOff;face.append(mic); }
        el.onclick = () => tapTile(seat.id);
      }
      el.append(face, name);room.append(el);
    };
    seats.forEach(seat => build(seat, false));
    for (let i = guests.length; i < cap; i++) build(null, true, i + 1);
  }
  async function guestButton() {
    if (S.host) { S.sheet === 'guests' ? closeSheet() : openSheet('guests');return; }
    const self = S.state?.self?.state;
    if (['rejected', 'banned', 'removed'].includes(self)) return;
    try {
      if (self === 'speaker' || self === 'pending') await roomAction('leave-stage');
      else { const result = await roomAction('request');if (result.state === 'pending') say(t('pending')); }
      await poll();
    } catch (error) { say(error.status === 409 ? t('full') : error.message, true); }
  }
  function changeSeats(delta) {
    const settings = settingsOf();
    const speakers = (S.state?.members || []).filter(m => m.state === 'speaker').length;
    const layout = Math.min(9, Math.max(2, speakers + 1, settings.layout + delta));
    if (layout !== settings.layout) saveSettings({ layout });
  }
  async function toggleMic() {
    const person = S.room?.localParticipant;
    if (!person || S.mediaBusy) return;
    S.mediaBusy = true;
    try { await person.setMicrophoneEnabled(!person.isMicrophoneEnabled); } catch (error) { console.error('[MilkyWay Live] mic toggle failed', error);say(error.message, true); }
    finally { S.mediaBusy = false; }
    syncBoxState();syncTracks();paintControls();
  }
  async function toggleCamera() {
    const person = S.room?.localParticipant;
    if (!person || S.mediaBusy) return;
    S.mediaBusy = true;
    try { await person.setCameraEnabled(!person.isCameraEnabled, person.isCameraEnabled ? undefined : { facingMode: S.facing }); } catch (error) { console.error('[MilkyWay Live] camera toggle failed', error);say(error.message, true); }
    finally { S.mediaBusy = false; }
    syncBoxState();syncTracks();paintControls();
  }
  function paintCount() {
    const button = $('mwLiveCount');
    if (!button || !S.room) return;
    const count = Math.max(S.state?.connected?.length || 0, S.room.remoteParticipants.size + 1);
    button.hidden = false;
    button.querySelector('b').textContent = String(count);
  }
  async function share() {
    if (!S.session) return;
    const url = `${location.origin}${location.pathname}#live=${encodeURIComponent(S.session.room_name)}`;
    try { if (navigator.share) { await navigator.share({ title: S.session.title || 'MilkyWay LIVE', url });return; } } catch (error) { if (error?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url);say(t('share')); } catch { say(url); }
  }

  // ---------- chat feed, hearts ----------
  const feedNode = () => $('mwLiveComments');
  const atBottom = list => list.scrollHeight - list.scrollTop - list.clientHeight < 48;
  function commentRow(item) {
    const row = document.createElement('div');row.className = 'mw-live-comment lv-c';row.dataset.messageId = item.id;row.dataset.deleted = String(!!item.deleted);
    const system = item.kind === 'system';
    let text = item.deleted ? t('removed') : item.body;
    let giftKey = '';
    if (item.kind === 'system' && !item.deleted) { try { const event = JSON.parse(item.body);if (event.mwSystem === 1) text = `${event.name} · ${window.MilkyWayI18n?.t?.(event.key) || event.key}`; } catch {} }
    if (item.kind === 'gift' && !item.deleted) { try { const event = JSON.parse(item.body);if (event.mwGift === 1) { giftKey = event.gift;text = window.MilkyWayGifts?.chatText?.(giftKey) || '🎁'; } } catch {} }
    if (giftKey) { row.classList.add('mw-live-gift');row.dataset.gift = giftKey; }
    if (system) row.classList.add('is-system');
    if (item.deleted) row.classList.add('is-deleted');
    const face = document.createElement('span');face.className = 'lv-avatar lv-c-face';paintAvatar(face, item.avatar, item.name);
    const body = document.createElement('span');body.className = 'lv-c-body';
    if (!system) { const who = document.createElement('b');who.textContent = item.name || 'MilkyWay';body.append(who); }
    const message = document.createElement('span');message.textContent = text;body.append(message);
    if (!system) row.append(face);
    row.append(body);
    if (S.host && !item.deleted && !system && item.userId !== myId()) {
      const del = document.createElement('button');del.type = 'button';del.className = 'lv-c-del';del.innerHTML = '×';del.setAttribute('aria-label', t('removed'));
      del.onclick = async () => {
        const ok = await (window.MilkyWayDialog?.confirm ? window.MilkyWayDialog.confirm({ message: t('delConfirm'), danger: true }) : Promise.resolve(confirm(t('delConfirm'))));
        if (!ok) return;
        try { await roomAction('delete-message', { id: item.id });await poll(); } catch (error) { say(error.message, true); }
      };
      row.append(del);
    }
    return row;
  }
  function paintComments() {
    const list = feedNode();
    if (!list || !S.state) return;
    const messages = S.state.messages.filter(item => item.kind !== 'reaction');
    const key = JSON.stringify(messages.map(item => [item.id, item.deleted]));
    if (key === S.chatKey) return;
    S.chatKey = key;
    const stick = atBottom(list) || S.firstChat;
    const known = new Map([...list.querySelectorAll('[data-message-id]')].map(row => [row.dataset.messageId, row]));
    const visible = new Set();
    let added = 0;
    for (const item of messages) {
      visible.add(item.id);
      const existing = known.get(item.id);
      if (existing && existing.dataset.deleted === String(!!item.deleted) && !existing.classList.contains('is-pending')) continue;
      if (item.kind === 'gift' && !item.deleted && !existing && !S.firstChat && item.userId !== myId() && !S.seenGift.has(item.id)) { try { const event = JSON.parse(item.body);if (event.mwGift === 1) window.MilkyWayGifts?.celebrate?.(event.gift, item.name); } catch {} }
      S.seenGift.add(item.id);
      const row = commentRow(item);
      if (S.firstChat) row.classList.add('is-history');
      if (existing) existing.replaceWith(row); else { list.append(row);added++; }
    }
    known.forEach((row, id) => { if (!visible.has(id) && !row.classList.contains('is-pending')) row.remove(); });
    const rows = list.querySelectorAll('.lv-c');
    for (let i = 0; i < rows.length - 100; i++) rows[i].remove();
    S.firstChat = false;
    if (stick) scrollFeed(list, added > 0); else if (added) showNew();
  }
  function scrollFeed(list, smooth) {
    requestAnimationFrame(() => { list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });$('mwLiveNew').hidden = true; });
  }
  const showNew = () => { $('mwLiveNew').hidden = false; };
  async function sendComment(text) {
    const id = uuid();
    const list = feedNode();
    const mine = { id, userId: myId(), name: nameOf2(), avatar: user?.user_metadata?.avatar_url, kind: 'chat', body: text, deleted: false };
    const row = commentRow(mine);row.classList.add('is-pending');list.append(row);scrollFeed(list, true);
    try {
      await roomAction('message', { id, message: text });
      row.classList.remove('is-pending');
      S.room?.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'lv-sync' })), { reliable: false }).catch(() => {});
      await poll();
    } catch (error) { row.remove();say(error.message, true);throw error; }
  }
  function floatHeart(count = 1) {
    const layer = $('mwLiveHearts');
    if (!layer || !S.room) return;
    for (let i = 0; i < Math.min(count, 6); i++) {
      const heart = document.createElement('span');heart.className = 'lv-heart';heart.innerHTML = ICONS.heart;
      heart.style.setProperty('--dx', `${Math.round((Math.random() - .5) * 70)}px`);
      heart.style.setProperty('--rot', `${Math.round((Math.random() - .5) * 40)}deg`);
      heart.style.setProperty('--hue', String(Math.round(330 + Math.random() * 40)));
      heart.style.animationDelay = `${i * 90}ms`;
      heart.addEventListener('animationend', () => heart.remove());
      layer.append(heart);
      if (layer.childElementCount > 40) layer.firstElementChild.remove();
    }
  }
  let lastHeart = 0;
  function sendHeart() {
    if (!S.room) return;
    floatHeart(1);
    if (Date.now() - lastHeart < 160) return;
    lastHeart = Date.now();
    S.room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'lv-heart' })), { reliable: false }).catch(() => {});
  }

  // ---------- keyboard: the dock follows the keyboard, the video grid never moves ----------
  let keyboardBound = false;
  function bindKeyboard() {
    if (keyboardBound) return;
    keyboardBound = true;
    const vv = window.visualViewport;
    const input = $('mwLiveCommentInput');
    let lockedHeight = 0;
    const apply = () => {
      const page = S.page;
      if (!vv || !lockedHeight) { page.style.removeProperty('--lv-kb');page.style.removeProperty('--lv-shift');return; }
      const keyboard = Math.max(0, Math.round(lockedHeight - vv.height));
      page.style.setProperty('--lv-kb', `${keyboard}px`);
      page.style.setProperty('--lv-shift', `${Math.round(vv.offsetTop)}px`);
      page.classList.toggle('is-typing', keyboard > 80);
      if (keyboard > 80) requestAnimationFrame(() => { const list = feedNode();if (list) list.scrollTop = list.scrollHeight; });
    };
    input.addEventListener('focus', () => { lockedHeight = S.page.clientHeight;S.page.style.setProperty('--lv-h', `${lockedHeight}px`);apply();setTimeout(apply, 300); });
    input.addEventListener('blur', () => { lockedHeight = 0;S.page.style.removeProperty('--lv-h');apply();S.page.classList.remove('is-typing');layoutTiles(); });
    vv?.addEventListener('resize', apply);vv?.addEventListener('scroll', apply);
  }

  // ---------- settings panel (volume, output, language hook for premium.js) ----------
  async function paintSettings() {
    const panel = $('mwLiveSettings');
    panel.hidden = !panel.hidden;
    $('mwLiveSheetBackdrop').hidden = panel.hidden && !S.sheet;
    if (panel.hidden) return;
    const select = $('mwLiveOutput');
    if (select && !select.dataset.ready && 'setSinkId' in HTMLMediaElement.prototype && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
        select.innerHTML = `<option value="">${t('defaultOut')}</option>` + devices.map(d => `<option value="${d.deviceId}">${safe(d.label || d.deviceId).replace(/[<>&"]/g, '')}</option>`).join('');
        select.dataset.ready = '1';
      } catch {}
    } else if (select && !('setSinkId' in HTMLMediaElement.prototype)) select.closest('label').hidden = true;
  }

  // ---------- static text + wiring ----------
  function paintStatic() {
    const set = (id, key, attr) => { const node = $(id);if (!node) return;if (attr) node.setAttribute(attr, t(key));else node.textContent = t(key); };
    set('mwLiveTitle', 'titlePh', 'placeholder');set('mwLiveCommentInput', 'comment', 'placeholder');set('mwLiveNew', 'newMsgs');
    set('mwLiveStartLabel', 'videoLive');set('mwLiveStartAudioLabel', 'audioLive');set('mwLiveAutoLabel', 'auto');set('mwLiveSeatLabel', 'seats');set('mwLiveNowTitle', 'liveNow');
    set('mwLiveHistoryTitle', 'history');
    const historyMenuItem = document.querySelector('#mwLiveLobbyMenu [data-action="history"]');
    if (historyMenuItem) historyMenuItem.textContent = t('history');
    $('mwLiveLobbyMenuButton')?.setAttribute('aria-label', t('menu'));
    document.querySelector('#mwLiveHistory [data-action="history-back"]')?.setAttribute('aria-label', t('back'));
    set('mwLiveSettingsTitle', 'settings');set('mwLiveVolumeLabel', 'volume');set('mwLiveOutputLabel', 'output');
    $('mwLiveCommentSend')?.setAttribute('aria-label', t('send'));
    paintControls();
  }
  function init() {
    S.page = $('mwLivePage');
    if (!S.page) return;
    const page = S.page;
    $('mwLiveCommentSend').innerHTML = ICONS.send;
    $('mwLiveCount').insertAdjacentHTML('afterbegin', ICONS.eye);
    $('mwLiveShare').innerHTML = ICONS.share;
    $('mwLiveSettingsBtn').innerHTML = ICONS.gear;
    $('mwLiveHeart').innerHTML = ICONS.heart;
    $('mwLiveSound').innerHTML = ICONS.sound;
    $('mwLiveFlip').innerHTML = ICONS.flip;
    $('mwLiveSound').setAttribute('aria-label', t('soundMute'));
    $('mwLiveSettingsBtn').setAttribute('aria-label', t('settings'));
    document.querySelector('.lv-control-panel')?.setAttribute('aria-label', t('liveControls'));
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => layoutTiles()).observe($('mwLiveGrid'));
    page.addEventListener('pointerdown', () => { if (S.room && S.room.canPlaybackAudio === false) S.room.startAudio().catch(() => {}); }, { passive: true });
    page.addEventListener('click', event => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'close') close();
      else if (action === 'lobby-menu') {
        const menu = $('mwLiveLobbyMenu');menu.hidden = !menu.hidden;
        target.setAttribute('aria-expanded', String(!menu.hidden));
      }
      else if (action === 'history') openHistory();
      else if (action === 'history-back') closeHistory();
      else if (action === 'history-delete') removeHistory(target.dataset.id, target.dataset.source, target);
      else if (action === 'refresh') refresh();
      else if (action === 'start-video') start('video');
      else if (action === 'start-audio') start('audio');
      else if (action === 'viewers') (S.sheet === 'people' ? closeSheet() : openSheet('people'));
      else if (action === 'guests') guestButton();
      else if (action === 'join') guestButton();
      else if (action === 'seat-minus') changeSeats(-1);
      else if (action === 'seat-plus') changeSeats(1);
      else if (action === 'mic') toggleMic();
      else if (action === 'camera') toggleCamera();
      else if (action === 'flip') flipCamera();
      else if (action === 'sound') { S.sound = !S.sound;if (S.sound) S.room?.startAudio?.().catch(() => {});applySound(); }
      else if (action === 'share') share();
      else if (action === 'settings') paintSettings();
      else if (action === 'reaction') sendHeart();
      else if (action === 'box') toggleBox();
      else if (action === 'new') scrollFeed(feedNode(), true);
    });
    $('mwLiveSetup').addEventListener('submit', event => { event.preventDefault();start('video'); });
    $('mwLiveSheetBackdrop').addEventListener('click', () => { closeSheet();$('mwLiveSettings').hidden = true; });
    $('mwLiveVolume').addEventListener('input', event => { S.volume = Number(event.target.value) / 100;applySound(); });
    $('mwLiveOutput').addEventListener('change', event => { S.audio.forEach(item => item.el.setSinkId?.(event.target.value).catch(() => {})); });
    const list = feedNode();
    list.addEventListener('scroll', () => { if (atBottom(list)) $('mwLiveNew').hidden = true; }, { passive: true });
    const form = $('mwLiveCommentForm'), input = $('mwLiveCommentInput');
    $('mwLiveCommentSend').addEventListener('pointerdown', event => event.preventDefault());
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || !S.room) return;
      input.value = '';
      try { await sendComment(text); } catch { if (!input.value) input.value = text; }
      input.focus({ preventScroll: true });
    });
    page.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('mwLiveSheetBackdrop').hidden) { closeSheet();$('mwLiveSettings').hidden = true; } });
    window.addEventListener('mw-language-change', () => { paintStatic();cardKey = '';refresh();if (!$('mwLiveHistory').hidden) paintHistory();if (S.state) { $('mwLiveSheet').dataset.key = '';paintSheet(); } });
    window.addEventListener('hashchange', () => { if (!S.room) refresh(); });
    try { sb.channel('mw-live-discovery-v3').on('postgres_changes', { event: '*', schema: 'public', table: 'mw_video_live_sessions' }, () => refresh()).subscribe(); } catch (error) { console.warn('[MilkyWay Live] realtime unavailable', error); }
    setInterval(() => { if (document.visibilityState !== 'hidden') refresh(false); }, 5000);
    paintStatic();
    refresh();
  }

  window.MilkyWayLive = {
    open, close, refresh: () => refresh(), disconnect, watch, start,
    current: () => S.session, isHost: () => S.host, browse: () => open({ entry: 'viewer' }), liveNow: () => S.records,
    openSettings: () => { open(); if (S.room) { S.host ? openSheet('guests') : paintSettings(); } else $('mwLiveTitle')?.focus(); },
    isActive: () => !!S.room || S.joining || !!S.ending,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
