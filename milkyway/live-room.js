(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const API = '/api/milkyway-livekit-token';
  const DIRECT_API = 'https://wpclkhgizbvxuvbhbwzs.supabase.co/functions/v1/livekit-token';
  const ROOM_API = '/api/milkyway-live-room';
  const state = {
    room: null,
    sdk: null,
    session: null,
    roomState: null,
    records: [],
    host: false,
    mode: 'video',
    joining: false,
    refreshing: false,
    sound: true,
    volume: 1,
    facing: 'user',
    generation: 0,
    polling: false,
    pollTimer: 0,
    refreshTimer: 0,
    audio: new Map(),
    tiles: new Map(),
    toastTimer: 0
  };

  const text = {
    signIn: 'Ingia ili kutumia Live.',
    liveNow: 'Live sasa',
    noLive: 'Hakuna Live inayoendelea sasa hivi.',
    connecting: 'Inaunganisha…',
    connected: 'LIVE',
    audioLive: 'Sauti LIVE',
    videoLive: 'Video LIVE',
    join: 'Jiunge na jukwaa',
    leaveStage: 'Toka jukwaani',
    requested: 'Ombi limetumwa',
    leaveBox: 'Toka kwenye boksi',
    enterBox: 'Rudi kwenye boksi',
    comment: 'Andika maoni…',
    endConfirm: 'Maliza Live hii kwa kila mtu?',
    offline: 'Hakuna mtandao. Jaribu tena.',
    invalidToken: 'Huduma ya Live haikurudisha tokeni halali.',
    secure: 'Live inahitaji HTTPS na ruhusa ya kamera na maikrofoni.'
  };
  const english = {
    signIn: 'Sign in to use Live.',
    liveNow: 'Live now',
    noLive: 'Nobody is live right now.',
    connecting: 'Connecting…',
    connected: 'LIVE',
    audioLive: 'Audio LIVE',
    videoLive: 'Video LIVE',
    join: 'Join stage',
    leaveStage: 'Leave stage',
    requested: 'Request sent',
    leaveBox: 'Leave box',
    enterBox: 'Return to box',
    comment: 'Add a comment…',
    endConfirm: 'End this Live for everyone?',
    offline: 'No network connection. Try again.',
    invalidToken: 'The Live service returned an invalid token.',
    secure: 'Live requires HTTPS and camera and microphone access.'
  };
  const language = () => {
    try { return window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; }
    catch { return 'sw'; }
  };
  const t = key => (language().startsWith('sw') ? text : english)[key] || key;
  const currentUser = () => typeof user === 'undefined' ? null : user;
  const supabase = () => typeof sb === 'undefined' ? null : sb;
  const userId = () => currentUser()?.id || '';
  const userName = () => currentUser()?.user_metadata?.display_name || currentUser()?.email?.split('@')[0] || 'MilkyWay';
  const roomMode = record => /^mw-audio-live-/.test(record?.room_name || '') ? 'audio' : 'video';
  const makeId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const icons = {
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M9 9v2a3 3 0 0 0 5 2m1-3V5a3 3 0 0 0-6-.7M5 11a7 7 0 0 0 11 5.7M12 18v4"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/></svg>',
    cameraOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M15 10l6-3v10l-3.5-1.7M7 6h5a3 3 0 0 1 3 3v5M3 8v7a3 3 0 0 0 3 3h7"/></svg>',
    flip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h7"/><circle cx="10" cy="13" r="3"/><path d="m17 14 2 2 2-2m-2 2v-5"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    box: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6m-3-3v6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 2.9 4.5 6.3 4.5c2 0 3.5 1 4.4 2.5l1.3 2 1.3-2c.9-1.5 2.4-2.5 4.4-2.5 3.4 0 5.4 3.5 3.9 7.1C19.5 16.4 12 21 12 21Z"/></svg>'
  };

  function showMessage(message, error = false) {
    const node = $('mwLiveMessage');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', error);
    node.classList.add('is-visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => node.classList.remove('is-visible'), 3500);
  }

  async function headers() {
    const client = supabase();
    if (!client) throw new Error(t('offline'));
    const result = await client.auth.getSession();
    const token = result.data?.session?.access_token;
    if (!token) throw new Error(t('signIn'));
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: client.supabaseKey || ''
    };
  }

  function isJsonResponse(response) {
    return response && response.status !== 404 && response.status !== 405 &&
      /\bjson\b/i.test(response.headers.get('content-type') || '');
  }

  async function post(url, body, direct = '') {
    const requestHeaders = await headers();
    const init = { method: 'POST', headers: requestHeaders, body: JSON.stringify(body) };
    let response;
    try { response = await fetch(url, init); }
    catch (error) {
      console.error('[MilkyWay Live] request failed', url, error);
    }
    if (direct && !isJsonResponse(response)) response = await fetch(direct, init);
    if (!response) throw new Error(t('offline'));
    if (response.status === 401) {
      const client = supabase();
      const refreshed = await client.auth.refreshSession();
      if (!refreshed.error && refreshed.data?.session) {
        init.headers = await headers();
        response = await fetch(url, init);
        if (direct && !isJsonResponse(response)) response = await fetch(direct, init);
      }
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error(payload?.error || `Live service returned HTTP ${response.status}.`);
    }
    return payload;
  }

  function uniqueRecords(records) {
    const ids = new Set(), rooms = new Set(), hosts = new Set();
    return records.filter(record => {
      const id = String(record?.id || '').trim();
      const room = String(record?.room_name || '').trim();
      const host = String(record?.host_id || '').trim();
      if (!room || !host || rooms.has(room) || hosts.has(host) || (id && ids.has(id))) return false;
      rooms.add(room);
      hosts.add(host);
      if (id) ids.add(id);
      return true;
    });
  }

  async function visibleRecords(records) {
    const client = supabase();
    const restricted = records.filter(record => record.scope === 'followers' && record.host_id !== userId());
    if (!restricted.length) return records;
    if (!userId() || !window.MilkyWayFollows?.query) {
      return records.filter(record => record.scope !== 'followers' || record.host_id === userId());
    }
    const result = await window.MilkyWayFollows.query(query =>
      query.select('following_id').eq('follower_id', userId()).in('following_id', restricted.map(record => record.host_id)));
    if (result.error) throw new Error('Could not verify access to follower-only Lives.');
    const allowed = new Set((result.data || []).map(row => row.following_id));
    return records.filter(record => record.scope !== 'followers' || record.host_id === userId() || allowed.has(record.host_id));
  }

  async function refresh() {
    const client = supabase();
    if (!client || state.refreshing) return state.records;
    state.refreshing = true;
    try {
      const result = await client.from('mw_video_live_sessions')
        .select('id,room_name,host_id,host_name,title,scope,is_live,started_at')
        .eq('is_live', true).order('started_at', { ascending: false }).limit(100);
      if (result.error) throw result.error;
      let records = uniqueRecords(await visibleRecords(result.data || []));
      const hostIds = [...new Set(records.map(record => record.host_id))];
      if (hostIds.length) {
        const profiles = await client.from('mw_profiles').select('id,display_name,username,avatar_url').in('id', hostIds);
        if (profiles.error) console.warn('[MilkyWay Live] profile lookup failed', profiles.error);
        else {
          const byId = new Map((profiles.data || []).map(profile => [profile.id, profile]));
          records = records.map(record => ({ ...record, profile: byId.get(record.host_id) || null }));
        }
      }
      state.records = records;
      renderList(records);
      window.dispatchEvent(new CustomEvent('mw-live-discovery', { detail: { records } }));
      return records;
    } catch (error) {
      console.error('[MilkyWay Live] discovery failed', error);
      const list = $('mwLiveSessions');
      if (list) list.textContent = error.message || 'Live list is unavailable.';
      return [];
    } finally { state.refreshing = false; }
  }

  function avatar(element, url, name) {
    const initial = (name || 'M').trim().slice(0, 1).toUpperCase();
    element.replaceChildren();
    element.textContent = initial;
    if (!url) return;
    const image = document.createElement('img');
    image.alt = '';
    image.loading = 'lazy';
    image.src = url;
    image.addEventListener('error', () => { element.textContent = initial; }, { once: true });
    element.replaceChildren(image);
  }

  function renderList(records) {
    const list = $('mwLiveSessions');
    if (!list) return;
    const unique = uniqueRecords(records);
    $('mwLiveNowCount').textContent = String(unique.length);
    list.replaceChildren();
    if (!unique.length) {
      const empty = document.createElement('p');
      empty.className = 'lv-empty';
      empty.textContent = t('noLive');
      list.append(empty);
      return;
    }
    for (const record of unique) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'lv-card';
      card.dataset.liveKey = record.id || record.room_name;
      const face = document.createElement('span');
      face.className = 'lv-avatar';
      const hostName = record.profile?.display_name || record.host_name || 'MilkyWay';
      avatar(face, record.profile?.avatar_url, hostName);
      const details = document.createElement('span');
      details.className = 'lv-card-info';
      const title = document.createElement('strong');
      title.textContent = record.title || hostName;
      const meta = document.createElement('small');
      meta.textContent = `${roomMode(record) === 'audio' ? 'Audio' : 'Video'} · ${hostName}`;
      details.append(title, meta);
      const watch = document.createElement('span');
      watch.className = 'lv-card-watch';
      watch.textContent = 'Watch';
      card.append(face, details, watch);
      card.addEventListener('click', () => watchLive(record));
      list.append(card);
    }
  }

  function open(options = {}) {
    const page = $('mwLivePage');
    if (!page) return;
    page.hidden = false;
    page.classList.add('is-open');
    document.body.classList.add('lv-open');
    if (!state.room && !state.joining) page.dataset.view = options.entry === 'viewer' ? 'viewer' : 'lobby';
    if (!options.start) refresh();
    window.MilkyWayLoadLiveKit?.().catch(error => console.warn('[MilkyWay Live] LiveKit preloading failed', error));
  }

  function showStage(record) {
    $('mwLiveLobby').hidden = true;
    $('mwLiveStage').hidden = false;
    $('mwLivePage').dataset.view = 'stage';
    const hostName = record.profile?.display_name || record.host_name || userName();
    $('mwLiveHostName').textContent = hostName;
    avatar($('mwLiveHostAvatar'), record.profile?.avatar_url || currentUser()?.user_metadata?.avatar_url, hostName);
    $('mwLiveStatus').textContent = t('connecting');
    $('mwLiveStage').dataset.mode = state.mode;
    $('mwLiveStage').classList.toggle('is-audio', state.mode === 'audio');
    renderControls();
  }

  function showLobby() {
    const stage = $('mwLiveStage');
    stage.hidden = true;
    $('mwLiveLobby').hidden = false;
    $('mwLivePage').dataset.view = 'lobby';
    $('mwLiveGrid').replaceChildren();
    $('mwLiveComments').replaceChildren();
    $('mwLiveRemoteAudio').replaceChildren();
    $('mwLiveGuestBar').hidden = true;
    $('mwLiveSettings').hidden = true;
  }

  async function fetchToken(record, host) {
    const name = userName();
    const payload = await post(API, {
      room: record.room_name,
      roomName: record.room_name,
      identity: userId(),
      name,
      participantName: name,
      role: host ? 'host' : 'viewer',
      title: record.title,
      scope: record.scope,
      action: 'token'
    }, DIRECT_API);
    if (!payload.token || !payload.serverUrl || (payload.roomName && payload.roomName !== record.room_name)) {
      throw new Error(t('invalidToken'));
    }
    const url = new URL(payload.serverUrl);
    if (url.protocol !== 'wss:') throw new Error('The LiveKit server URL must use wss://.');
    return payload;
  }

  const roomAction = (action, values = {}, record = state.session) =>
    post(ROOM_API, { room: record.room_name, action, ...values });

  async function start(mode = 'video') {
    if (state.room || state.joining) return;
    if (!currentUser()) { open();showMessage(t('signIn'), true);return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      open();showMessage(t('secure'), true);return;
    }
    const client = supabase();
    if (!client) { showMessage(t('offline'), true);return; }
    try {
      const roomName = `mw-${mode}-live-${makeId()}`;
      const title = $('mwLiveTitle').value.trim() || (mode === 'audio' ? t('audioLive') : t('videoLive'));
      const record = {
        room_name: roomName,
        host_id: userId(),
        host_name: userName(),
        title,
        scope: 'public',
        is_live: true,
        started_at: new Date().toISOString(),
        ended_at: null
      };
      const saved = await client.from('mw_video_live_sessions').insert(record).select('id').single();
      if (saved.error) throw saved.error;
      record.id = saved.data.id;
      await connect(record, true, mode);
    } catch (error) {
      console.error('[MilkyWay Live] could not create room', error);
      showMessage(error.message || 'Could not start Live.', true);
    }
  }

  async function watchLive(record) {
    if (!record?.room_name || state.room || state.joining) return;
    await connect(record, record.host_id === userId(), roomMode(record));
  }

  async function connect(record, host, mode) {
    if (state.joining || state.room) return;
    const generation = ++state.generation;
    state.joining = true;
    state.session = record;
    state.host = host;
    state.mode = mode;
    showStage(record);
    open({ start: true });
    try {
      const sdkPromise = window.MilkyWayLoadLiveKit?.() ||
        Promise.resolve(window.LivekitClient || window.LiveKitClient);
      const [token, sdk] = await Promise.all([fetchToken(record, host), sdkPromise]);
      if (generation !== state.generation) return;
      if (!sdk?.Room) throw new Error('LiveKit failed to load. Check the connection and try again.');
      state.sdk = sdk;
      const room = new sdk.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: { width: 1280, height: 720, frameRate: 30 }, facingMode: state.facing },
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      state.room = room;
      bindRoom(room, sdk, generation);
      await room.connect(token.serverUrl, token.token);
      if (generation !== state.generation) { await room.disconnect();return; }
      await room.startAudio?.().catch(() => {});
      if (host) {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (mode === 'video') await room.localParticipant.setCameraEnabled(true, { facingMode: state.facing });
        await roomAction('started');
        await roomAction('settings', { layout: 4, admission: 'direct', order: [] }).catch(error => {
          console.warn('[MilkyWay Live] could not set default room layout', error);
        });
        try {
          Promise.resolve(window.MilkyWayLiveNotifications?.api?.('live-started', { room: record.room_name })).catch(error => {
            console.warn('[MilkyWay Live] notification request failed', error);
          });
        } catch (error) { console.warn('[MilkyWay Live] notification request failed', error); }
      }
      state.joining = false;
      $('mwLiveStatus').textContent = t('connected');
      await poll();
      state.pollTimer = setInterval(poll, 1500);
    } catch (error) {
      console.error('[MilkyWay Live] connection failed', error);
      if (generation === state.generation) {
        const failedHost = state.host;
        await cleanup();
        if (failedHost) await endRecord(record).catch(endError => console.error('[MilkyWay Live] cleanup failed', endError));
        showMessage(error.message || 'Could not connect to Live.', true);
      }
    } finally {
      if (generation === state.generation) state.joining = false;
    }
  }

  function bindRoom(room, sdk, generation) {
    const event = sdk.RoomEvent;
    const live = () => room === state.room && generation === state.generation;
    const update = () => { if (live()) { renderRoster();renderControls(); } };
    room.on(event.TrackSubscribed, (track, publication, participant) => {
      if (live()) { attachTrack(track, publication, participant);renderRoster(); }
    });
    room.on(event.TrackUnsubscribed, (track, publication, participant) => {
      if (live()) { detachTrack(track, publication, participant);renderRoster(); }
    });
    room.on(event.LocalTrackPublished, update);
    room.on(event.LocalTrackUnpublished, update);
    room.on(event.TrackMuted, update);
    room.on(event.TrackUnmuted, update);
    room.on(event.ParticipantConnected, () => { if (live()) { renderRoster();poll(); } });
    room.on(event.ParticipantDisconnected, participant => {
      if (!live()) return;
      renderRoster();
      poll();
      if (!state.host && participant.identity === state.session.host_id) endByHost();
    });
    room.on(event.DataReceived, payload => {
      if (!live()) return;
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === 'lv-heart') heart(false);
        if (message.type === 'lv-sync') poll();
      } catch (error) { console.warn('[MilkyWay Live] ignored invalid room event', error); }
    });
    room.on(event.ConnectionStateChanged, connection => {
      if (live()) $('mwLiveStatus').textContent = connection === 'connected' ? t('connected') : t('connecting');
    });
    room.on(event.Disconnected, () => {
      if (live() && !state.joining) endByHost();
    });
  }

  function participantTile(participant, local) {
    const grid = $('mwLiveGrid');
    let tile = state.tiles.get(participant.identity);
    if (tile) return tile;
    const element = document.createElement('article');
    element.className = 'lv-tile';
    element.dataset.identity = participant.identity;
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = local;
    const placeholder = document.createElement('div');
    placeholder.className = 'lv-placeholder';
    const label = document.createElement('span');
    label.className = 'lv-tile-label';
    label.textContent = participant.name || (local ? userName() : 'MilkyWay');
    element.append(video, placeholder, label);
    tile = { element, video, track: null, local };
    state.tiles.set(participant.identity, tile);
    grid.append(element);
    return tile;
  }

  function renderRoster() {
    const room = state.room;
    if (!room) return;
    const hostId = state.session.host_id;
    const speakers = new Set([hostId]);
    for (const member of state.roomState?.members || []) if (member.state === 'speaker') speakers.add(member.userId);
    const participants = [room.localParticipant, ...room.remoteParticipants.values()]
      .filter(participant => speakers.has(participant.identity));
    const visible = new Set();
    for (const participant of participants) {
      visible.add(participant.identity);
      const tile = participantTile(participant, participant === room.localParticipant);
      tile.element.querySelector('.lv-tile-label').textContent = participant.name || (participant.identity === hostId ? state.session.host_name : 'Guest');
      const publication = participant.getTrackPublication(state.sdk.Track.Source.Camera);
      const track = publication?.track && !publication.isMuted ? publication.track : null;
      if (tile.track !== track) {
        if (tile.track) tile.track.detach(tile.video);
        tile.track = track;
        tile.element.classList.toggle('has-video', !!track);
        if (track) track.attach(tile.video);
      }
      tile.element.classList.toggle('is-mirrored', participant === room.localParticipant && state.facing === 'user');
      const microphone = participant.getTrackPublication(state.sdk.Track.Source.Microphone);
      tile.element.classList.toggle('is-muted', !microphone || microphone.isMuted);
    }
    for (const [id, tile] of state.tiles) {
      if (!visible.has(id)) {
        if (tile.track) tile.track.detach(tile.video);
        tile.element.remove();
        state.tiles.delete(id);
      }
    }
    $('mwLiveCount').textContent = String(Math.max(participants.length, room.remoteParticipants.size + 1));
  }

  function attachTrack(track, publication, participant) {
    if (publication.source === state.sdk.Track.Source.Camera) {
      const tile = participantTile(participant, participant === state.room.localParticipant);
      tile.track = track;
      track.attach(tile.video);
      tile.element.classList.add('has-video');
      renderRoster();
      return;
    }
    if (publication.source === state.sdk.Track.Source.Microphone && participant !== state.room.localParticipant) {
      const element = track.attach();
      element.autoplay = true;
      element.dataset.trackSid = publication.trackSid;
      element.volume = state.volume;
      element.muted = !state.sound;
      $('mwLiveRemoteAudio').append(element);
      state.audio.set(publication.trackSid, { track, element });
    }
  }

  function detachTrack(track, publication) {
    if (publication.source === state.sdk.Track.Source.Camera) {
      for (const tile of state.tiles.values()) {
        if (tile.track === track) {
          track.detach(tile.video);
          tile.track = null;
          tile.element.classList.remove('has-video');
        }
      }
    }
    if (publication.source === state.sdk.Track.Source.Microphone) {
      const item = state.audio.get(publication.trackSid);
      if (item) { item.track.detach(item.element);item.element.remove();state.audio.delete(publication.trackSid); }
    }
  }

  async function poll() {
    if (!state.room || state.polling) return;
    state.polling = true;
    try {
      const result = await roomAction('status');
      if (!Array.isArray(result.messages) || !Array.isArray(result.members)) throw new Error('Live status response is invalid.');
      state.roomState = result;
      renderComments(result.messages);
      renderRoster();
      renderControls();
      if (result.self?.state === 'removed' || result.self?.state === 'banned') {
        showMessage('You are no longer in this Live.', true);
        await disconnect();
      }
    } catch (error) {
      if (error.status === 404 || /no longer available|has ended/i.test(error.message || '')) endByHost();
      else console.warn('[MilkyWay Live] status refresh failed', error);
    } finally { state.polling = false; }
  }

  function renderComments(messages) {
    const list = $('mwLiveComments');
    const known = new Set([...list.querySelectorAll('[data-message-id]')].map(row => row.dataset.messageId));
    for (const message of messages.filter(item => item.kind !== 'reaction').slice(-80)) {
      if (known.has(String(message.id))) continue;
      const row = document.createElement('p');
      row.className = 'lv-comment';
      row.dataset.messageId = String(message.id);
      const name = document.createElement('strong');
      name.textContent = message.name || 'MilkyWay';
      const body = document.createElement('span');
      body.textContent = message.deleted ? 'Comment removed' : message.body || '';
      row.append(name, body);
      list.append(row);
    }
    while (list.children.length > 80) list.firstElementChild.remove();
    list.scrollTop = list.scrollHeight;
  }

  function renderControls() {
    const room = state.room;
    const hostOrSpeaker = state.host || state.roomState?.self?.state === 'speaker';
    const person = room?.localParticipant;
    const mic = $('mwLiveMic');
    const camera = $('mwLiveCamera');
    const flip = $('mwLiveFlip');
    mic.hidden = !hostOrSpeaker;
    camera.hidden = !hostOrSpeaker || state.mode !== 'video';
    flip.hidden = camera.hidden || !person?.isCameraEnabled;
    mic.innerHTML = person?.isMicrophoneEnabled ? icons.mic : icons.micOff;
    camera.innerHTML = person?.isCameraEnabled ? icons.camera : icons.cameraOff;
    flip.innerHTML = icons.flip;
    mic.setAttribute('aria-pressed', String(!!person?.isMicrophoneEnabled));
    camera.setAttribute('aria-pressed', String(!!person?.isCameraEnabled));
    $('mwLiveSound').innerHTML = state.sound ? icons.sound : icons.soundOff;
    $('mwLiveSound').setAttribute('aria-pressed', String(state.sound));
    $('mwLiveSettingsBtn').innerHTML = icons.settings;
    const bar = $('mwLiveGuestBar');
    const join = $('mwLiveJoin');
    const box = $('mwLiveBoxToggle');
    const self = state.roomState?.self?.state || '';
    join.hidden = state.host || hostOrSpeaker || !room;
    join.textContent = self === 'pending' ? (language().startsWith('sw') ? 'Futa ombi' : 'Cancel request') : t('join');
    join.disabled = false;
    box.hidden = !hostOrSpeaker || !room;
    const inBox = !!person?.isMicrophoneEnabled || !!person?.isCameraEnabled;
    box.innerHTML = icons.box;
    box.setAttribute('aria-label', inBox ? t('leaveBox') : t('enterBox'));
    box.setAttribute('aria-pressed', String(inBox));
    bar.hidden = join.hidden;
  }

  async function mediaAction(action) {
    const participant = state.room?.localParticipant;
    if (!participant) return;
    try {
      if (action === 'mic') await participant.setMicrophoneEnabled(!participant.isMicrophoneEnabled);
      if (action === 'camera') await participant.setCameraEnabled(!participant.isCameraEnabled, { facingMode: state.facing });
      if (action === 'flip') {
        const publication = participant.getTrackPublication(state.sdk.Track.Source.Camera);
        const next = state.facing === 'user' ? 'environment' : 'user';
        await publication?.videoTrack?.restartTrack({ facingMode: next });
        state.facing = next;
      }
      if (action === 'box') {
        if (!state.host && state.roomState?.self?.state === 'speaker') {
          await roomAction('leave-stage');
          await poll();
          return;
        }
        const off = !!participant.isMicrophoneEnabled || !!participant.isCameraEnabled;
        await participant.setMicrophoneEnabled(!off);
        if (state.mode === 'video') await participant.setCameraEnabled(!off, { facingMode: state.facing });
      }
    } catch (error) {
      console.error(`[MilkyWay Live] ${action} failed`, error);
      showMessage(error.message, true);
    }
    renderRoster();
    renderControls();
  }

  async function guestAction() {
    if (!state.room) return;
    const self = state.roomState?.self?.state;
    try {
      if (self === 'speaker' || self === 'pending') await roomAction('leave-stage');
      else await roomAction('request');
      await poll();
    } catch (error) { showMessage(error.message, true); }
  }

  async function sendComment(value) {
    if (!state.room || !value) return;
    await roomAction('message', { id: makeId(), message: value });
    await state.room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: 'lv-sync' })),
      { reliable: false }
    ).catch(error => console.warn('[MilkyWay Live] comment sync signal failed', error));
    await poll();
  }

  function heart(send = true) {
    const layer = $('mwLiveHearts');
    const item = document.createElement('span');
    item.className = 'lv-heart';
    item.innerHTML = icons.heart;
    item.style.left = `${25 + Math.random() * 50}%`;
    item.addEventListener('animationend', () => item.remove(), { once: true });
    layer.append(item);
    if (send && state.room) {
      state.room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'lv-heart' })),
        { reliable: false }
      ).catch(error => console.warn('[MilkyWay Live] reaction failed', error));
    }
  }

  async function share() {
    if (!state.session) return;
    const url = `${location.origin}${location.pathname}#live=${encodeURIComponent(state.session.room_name)}`;
    try {
      if (navigator.share) { await navigator.share({ title: state.session.title || 'MilkyWay Live', url });return; }
      await navigator.clipboard.writeText(url);
      showMessage('Link copied');
    } catch (error) {
      if (error.name !== 'AbortError') showMessage(url);
    }
  }

  async function endRecord(record) {
    if (!record || record.host_id !== userId()) return;
    try { await roomAction('end', {}, record); }
    catch (error) { console.warn('[MilkyWay Live] room end request failed', error); }
    const result = await supabase().from('mw_video_live_sessions')
      .update({ is_live: false, ended_at: new Date().toISOString() })
      .eq('room_name', record.room_name).eq('host_id', userId());
    if (result.error) throw new Error(`Could not close the Live listing: ${result.error.message}`);
  }

  async function cleanup() {
    clearInterval(state.pollTimer);
    state.pollTimer = 0;
    const room = state.room;
    state.room = null;
    state.roomState = null;
    for (const tile of state.tiles.values()) {
      if (tile.track) tile.track.detach(tile.video);
      tile.element.remove();
    }
    state.tiles.clear();
    for (const item of state.audio.values()) {
      item.track.detach(item.element);
      item.element.remove();
    }
    state.audio.clear();
    if (room) {
      try { room.localParticipant.trackPublications.forEach(publication => publication.track?.stop()); }
      catch (error) { console.warn('[MilkyWay Live] media cleanup failed', error); }
      await room.disconnect(true).catch(error => console.warn('[MilkyWay Live] disconnect failed', error));
    }
    state.session = null;
    state.host = false;
    state.joining = false;
    showLobby();
    await refresh();
  }

  async function disconnect() {
    if (!state.session && !state.room && !state.joining) return { clean: true };
    const record = state.session;
    const host = state.host;
    const self = state.roomState?.self?.state;
    ++state.generation;
    let failure = '';
    if (host && record) {
      try { await endRecord(record); }
      catch (error) { failure = error.message; }
    } else if (record && ['speaker', 'pending'].includes(self)) {
      await roomAction('leave-stage', {}, record).catch(error => console.warn('[MilkyWay Live] leave stage failed', error));
    }
    await cleanup();
    return { clean: !failure, error: failure };
  }

  async function close() {
    if (state.host && state.room) {
      const confirmed = window.MilkyWayDialog?.confirm
        ? await window.MilkyWayDialog.confirm({ message: t('endConfirm'), danger: true })
        : window.confirm(t('endConfirm'));
      if (!confirmed) return;
    }
    if (state.room || state.joining) await disconnect();
    const page = $('mwLivePage');
    page.hidden = true;
    page.classList.remove('is-open');
    document.body.classList.remove('lv-open');
  }

  function endByHost() {
    const roomName = state.session?.room_name;
    if (!roomName) return;
    window.dispatchEvent(new CustomEvent('mw-live-host-ended', { detail: { room_name: roomName } }));
    showMessage('This Live has ended.');
    disconnect();
  }

  function toggleSettings() {
    const panel = $('mwLiveSettings');
    panel.hidden = !panel.hidden;
    $('mwLiveSettingsBtn').setAttribute('aria-expanded', String(!panel.hidden));
  }

  function bindKeyboard() {
    const page = $('mwLivePage');
    const input = $('mwLiveCommentInput');
    const viewport = window.visualViewport;
    let height = 0;
    const resize = () => {
      if (!height || !viewport) return;
      const keyboard = Math.max(0, Math.round(height - viewport.height - viewport.offsetTop));
      page.style.setProperty('--lv-keyboard', `${keyboard}px`);
      page.classList.toggle('is-typing', keyboard > 80);
      if (keyboard > 80) $('mwLiveComments').scrollTop = $('mwLiveComments').scrollHeight;
    };
    input.addEventListener('focus', () => {
      height = page.clientHeight;
      page.style.height = `${height}px`;
      resize();
      setTimeout(resize, 250);
    });
    input.addEventListener('blur', () => {
      height = 0;
      page.style.removeProperty('height');
      page.style.removeProperty('--lv-keyboard');
      page.classList.remove('is-typing');
    });
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
  }

  function bind() {
    const page = $('mwLivePage');
    if (!page) return;
    $('mwLiveSound').innerHTML = icons.sound;
    $('mwLiveSettingsBtn').innerHTML = icons.settings;
    $('mwLiveHeart').innerHTML = icons.heart;
    $('mwLiveCommentInput').placeholder = t('comment');
    page.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      switch (button.dataset.action) {
        case 'close': close();break;
        case 'refresh': refresh();break;
        case 'start-video': start('video');break;
        case 'start-audio': start('audio');break;
        case 'mic':
        case 'camera':
        case 'flip':
        case 'box': mediaAction(button.dataset.action);break;
        case 'sound':
          state.sound = !state.sound;
          for (const { element } of state.audio.values()) element.muted = !state.sound;
          renderControls();
          break;
        case 'settings': toggleSettings();break;
        case 'join': guestAction();break;
        case 'reaction': heart();break;
        case 'share': share();break;
      }
    });
    $('mwLiveSetup').addEventListener('submit', event => { event.preventDefault();start('video'); });
    $('mwLiveCommentForm').addEventListener('submit', async event => {
      event.preventDefault();
      const input = $('mwLiveCommentInput');
      const value = input.value.trim();
      if (!value) return;
      input.value = '';
      try { await sendComment(value); }
      catch (error) { input.value = value;showMessage(error.message, true); }
      input.focus({ preventScroll: true });
    });
    bindKeyboard();
    $('mwLiveVolume').addEventListener('input', event => {
      state.volume = Number(event.target.value) / 100;
      for (const { element } of state.audio.values()) element.volume = state.volume;
    });
    page.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        $('mwLiveSettings').hidden = true;
        $('mwLiveSettingsBtn').setAttribute('aria-expanded', 'false');
        close();
      }
    });
    window.addEventListener('mw-language-change', () => {
      $('mwLiveCommentInput').placeholder = t('comment');
      renderList(state.records);
      renderControls();
    });
    window.addEventListener('hashchange', () => {
      if (state.room || state.joining) return;
      const target = location.hash.startsWith('#live=') ? decodeURIComponent(location.hash.slice(6)) : '';
      if (!target) return;
      refresh().then(records => {
        const record = records.find(item => item.id === target || item.room_name === target);
        if (record) watchLive(record);
        else { open({ entry: 'viewer' });showMessage('This Live has ended.', true); }
      });
    });
    window.addEventListener('pagehide', () => {
      if (!state.host || !state.session) return;
      headers().then(requestHeaders => fetch(ROOM_API, {
        method: 'POST',
        keepalive: true,
        headers: requestHeaders,
        body: JSON.stringify({ room: state.session.room_name, action: 'end' })
      })).catch(error => console.warn('[MilkyWay Live] page exit cleanup failed', error));
    });
    const client = supabase();
    if (client) {
      try {
        client.channel('mw-live-discovery-v4')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'mw_video_live_sessions' }, refresh)
          .subscribe();
      } catch (error) { console.warn('[MilkyWay Live] realtime discovery unavailable', error); }
    }
    state.refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 5000);
    refresh();
  }

  window.MilkyWayLive = {
    open,
    close,
    refresh,
    disconnect,
    watch: watchLive,
    start,
    current: () => state.session,
    isHost: () => state.host,
    browse: () => open({ entry: 'viewer' }),
    liveNow: () => state.records,
    openSettings: () => { open();if (state.room) toggleSettings(); },
    isActive: () => !!state.room || state.joining,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
