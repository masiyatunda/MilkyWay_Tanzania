(() => {
  // Call signalling and LiveKit call tokens are served by the MilkyWay call function (Render API route).
  // The callee is reached three ways: the call function signals this page over a realtime websocket the moment a
  // call is placed or answered, the page polls as a fallback, and a Web Push rings the phone when MilkyWay is closed.
  const endpoint = '/api/milkyway-call';
  async function callApi(query, body, signal) {
    const auth = (await sb.auth.getSession()).data.session;
    if (!auth) throw new Error(text('Sign in again.', 'Ingia tena.'));
    const response = await fetch(`${endpoint}${query}`, { method: body ? 'POST' : 'GET', signal, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.access_token}`, apikey: sb.supabaseKey || '' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || `HTTP ${response.status}`), { status: response.status });
    return result;
  }
  const serverUrl = 'wss://masiyatunda-milkyway-live-mgh6b1np.livekit.cloud';
  const callId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const ringWindow = 45000;
  const text = (english, swahili) => mwLang() === 'en' ? english : swahili;
  const say = key => window.MilkyWayI18n?.t(key) || key;
  let call = null;
  let room = null;
  let busy = false;
  let epoch = 0;
  let accountId = null;
  let polling = false;
  let request = null;
  let panel = null;
  let invitation = null;
  let joined = false;
  let disconnectedAt = null;
  let finishing = false;
  let lastIncomingCheck = 0;
  let reconnects = 0;
  let peerLeftTimer = null;
  let wakeLock = null;
  let subscribedFor = null;
  let registrationTried = null;
  let pollAgain = false;
  let signals = null;
  let signalsFor = null;

  // Ringtone for the person being called and ringback for the caller, generated so no audio file is needed.
  const tone = (() => {
    let context = null;
    let timer = null;
    const volume = () => Math.max(0, Math.min(1, Number(localStorage.getItem('mw_notify_volume') ?? '0.7')));
    function beep(at, frequencies, length, level) {
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), at + 0.03);
      gain.gain.setValueAtTime(Math.max(0.0001, level), at + length - 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      gain.connect(context.destination);
      for (const frequency of frequencies) {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, at);
        oscillator.connect(gain);
        oscillator.start(at);
        oscillator.stop(at + length + 0.02);
      }
    }
    function cycle(kind) {
      const now = context.currentTime + 0.02;
      if (kind === 'incoming') { beep(now, [988, 1319], 0.38, 0.22 * volume()); beep(now + 0.52, [988, 1319], 0.38, 0.22 * volume()); }
      else beep(now, [440, 480], 1.5, 0.05);
    }
    function stop() {
      clearInterval(timer);
      timer = null;
      try { navigator.vibrate?.(0); } catch {}
    }
    function start(kind) {
      stop();
      const audible = kind !== 'incoming' || (localStorage.getItem('mw_notify_sound') !== 'off' && volume() > 0);
      const step = () => {
        try {
          if (audible) {
            context ||= new (window.AudioContext || window.webkitAudioContext)();
            if (context.state === 'suspended') context.resume().catch(() => {});
            cycle(kind);
          }
        } catch {}
        if (kind === 'incoming') try { navigator.vibrate?.([700, 350, 700]); } catch {}
      };
      step();
      timer = setInterval(step, kind === 'incoming' ? 2600 : 4000);
    }
    return { start, stop };
  })();

  function showPanel(title) {
    if (!panel) {
      mainView = 'remote';
      panel = document.createElement('section');
      panel.className = 'mw-call-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'MilkyWay call');
      panel.innerHTML = `<header><strong id="mwCallTitle"></strong><span id="mwCallStatus" role="status"></span></header><div id="mwCallMedia" class="mw-call-media"></div><div class="mw-call-controls"><button type="button" id="mwCallMic"></button><button type="button" id="mwCallCamera"></button><button type="button" id="mwCallSound"></button><button type="button" id="mwCallHangup" class="danger"></button></div>`;
      document.body.append(panel);
      panel.querySelector('#mwCallHangup').onclick = () => finish(joined ? 'ended' : 'cancelled');
      panel.querySelector('#mwCallMic').onclick = async () => {
        try { if (room) { await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled); controls(); } }
        catch { status(text('Microphone unavailable. Check device permissions.', 'Maikrofoni haipatikani. Angalia ruhusa.')); }
      };
      panel.querySelector('#mwCallCamera').onclick = async () => {
        try { if (room) { await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled); controls(); } }
        catch { status(text('Camera unavailable. Check device permissions.', 'Kamera haipatikani. Angalia ruhusa.')); }
      };
      panel.querySelector('#mwCallSound').onclick = async () => {
        try { await room?.startAudio(); for (const media of panel.querySelectorAll('audio,video')) await media.play(); }
        catch { status(text('Playback blocked. Tap Listen again.', 'Sauti imezuiwa. Gusa Sikiliza tena.')); }
      };
    }
    panel.hidden = false;
    panel.dataset.title = title;
    panel.querySelector('#mwCallTitle').textContent = title;
    controls();
    panel.querySelector('#mwCallHangup').focus();
    keepAlive(true);
  }

  function status(value) { if (panel) panel.querySelector('#mwCallStatus').textContent = value; }

  // Call control buttons: an icon above a clear label, painted only when the content changes.
  const controlIcon = {
    mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/>',
    micOff: '<path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v3a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.2 5.6M19 11a7 7 0 0 1-.6 2.8M12 18v3m-4 0h8M3 3l18 18"/>',
    camera: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="m15.5 10.2 5-3v9.6l-5-3"/>',
    cameraOff: '<path d="M10 6h2.5a3 3 0 0 1 3 3v1.2l5-3v9.6l-2-1.2M15.5 15.5V15a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V9a3 3 0 0 1 2.4-2.9M3 3l18 18"/>',
    sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    hangup: '<path d="M3.3 14.7c4.9-4.6 12.5-4.6 17.4 0 .6.6.6 1.5 0 2.1l-1.6 1.6a1.3 1.3 0 0 1-1.7.1l-2.3-1.7a1.3 1.3 0 0 1-.5-1.2l.2-1.6a11 11 0 0 0-5.6 0l.2 1.6c.1.5-.1.9-.5 1.2l-2.3 1.7a1.3 1.3 0 0 1-1.7-.1l-1.6-1.6a1.5 1.5 0 0 1 0-2.1Z"/>'
  };
  function paintControl(button, icon, label) {
    const signature = `${icon}|${label}`;
    if (button.dataset.paint === signature) return;
    button.dataset.paint = signature;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${controlIcon[icon]}</svg><span></span>`;
    button.querySelector('span').textContent = label;
    button.setAttribute('aria-label', label);
  }

  function controls() {
    if (!panel) return;
    const mic = panel.querySelector('#mwCallMic');
    const camera = panel.querySelector('#mwCallCamera');
    mic.disabled = !room || room.state !== 'connected';
    camera.disabled = mic.disabled;
    paintControl(mic, room?.localParticipant.isMicrophoneEnabled ? 'mic' : 'micOff', room?.localParticipant.isMicrophoneEnabled ? text('Mute', 'Nyamazisha') : text('Unmute', 'Washa sauti'));
    mic.setAttribute('aria-pressed', String(!!room?.localParticipant.isMicrophoneEnabled));
    camera.hidden = call?.offer?.mode !== 'video';
    paintControl(camera, room?.localParticipant.isCameraEnabled ? 'camera' : 'cameraOff', room?.localParticipant.isCameraEnabled ? text('Camera off', 'Zima kamera') : text('Camera on', 'Washa kamera'));
    camera.setAttribute('aria-pressed', String(!!room?.localParticipant.isCameraEnabled));
    paintControl(panel.querySelector('#mwCallSound'), 'sound', text('Listen', 'Sikiliza'));
    paintControl(panel.querySelector('#mwCallHangup'), 'hangup', text('Hang up', 'Maliza simu'));
    try { navigator.mediaSession?.setMicrophoneActive?.(!!room?.localParticipant.isMicrophoneEnabled); navigator.mediaSession?.setCameraActive?.(!!room?.localParticipant.isCameraEnabled); } catch {}
  }

  function attach(track, local = false) {
    if (!panel || (track.kind === 'audio' && local)) return;
    if (track.sid && [...panel.querySelectorAll('[data-track-sid]')].some(element => element.dataset.trackSid === track.sid)) return;
    const element = track.attach();
    element.autoplay = true;
    element.playsInline = true;
    element.muted = local || track.kind === 'video';
    element.className = local ? 'mw-call-local' : 'mw-call-remote';
    element.dataset.trackSid = track.sid || '';
    if (track.kind === 'video') {
      // Any video can be tapped to become the large view; the other one shrinks into the picture-in-picture corner.
      element.tabIndex = 0;
      element.setAttribute('role', 'button');
      element.onclick = () => { if (element.classList.contains('is-pip')) { mainView = local ? 'local' : 'remote'; layoutVideos(); } };
      element.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); element.click(); } };
    }
    panel.querySelector('#mwCallMedia').append(element);
    if (track.kind === 'video') { track.once?.('ended', () => setTimeout(layoutVideos)); layoutVideos(); }
    element.play().catch(() => status(text('Tap Listen to enable sound.', 'Gusa Sikiliza kuwasha sauti.')));
  }
  // Manual call layout: the person called is large by default, and the user can swap to self-view large and back at any time.
  let mainView = 'remote';
  function layoutVideos() {
    const media = panel?.querySelector('#mwCallMedia');
    if (!media) return;
    const videos = [...media.querySelectorAll('video')].filter(video => video.isConnected);
    const remote = videos.find(video => video.classList.contains('mw-call-remote')), self = videos.find(video => video.classList.contains('mw-call-local'));
    const main = (mainView === 'local' ? self : remote) || remote || self;
    media.classList.toggle('mw-call-pip-layout', !!(remote && self));
    for (const video of videos) {
      const isMain = video === main, isPip = !isMain && (video === remote || video === self);
      video.classList.toggle('is-main', isMain);
      video.classList.toggle('is-pip', isPip);
      const whose = video.classList.contains('mw-call-local') ? text('your camera', 'kamera yako') : text('the other person', 'mwenzako');
      video.setAttribute('aria-label', isPip ? text(`Show ${whose} large`, `Onyesha ${whose} kubwa`) : text(`Video of ${whose}`, `Video ya ${whose}`));
      video.setAttribute('aria-pressed', String(isMain));
    }
    let swap = media.querySelector('.mw-call-swap');
    if (remote && self) {
      if (!swap) {
        swap = document.createElement('button');
        swap.type = 'button'; swap.className = 'mw-call-swap';
        media.append(swap);
      }
      const label = text('Swap videos', 'Badili video');
      swap.innerHTML = `<span aria-hidden="true">⇄</span> <span>${label}</span>`;
      swap.setAttribute('aria-label', main === self ? text('Swap: show the other person large', 'Badili: onyesha mwenzako kubwa') : text('Swap: show your camera large', 'Badili: onyesha kamera yako kubwa'));
      swap.onclick = () => { mainView = main === self ? 'remote' : 'local'; layoutVideos(); };
    } else swap?.remove();
  }

  // Keeps an answered call going while the app is in the background: the Media Session shows the call
  // in the system controls (with hang up), a screen wake lock keeps video calls awake, and a quiet
  // "call in progress" notification brings the user back to the call.
  async function keepAlive(on) {
    const session = navigator.mediaSession;
    if (session) {
      try {
        if (on && window.MediaMetadata) session.metadata = new MediaMetadata({ title: panel?.dataset.title || 'MilkyWay', artist: 'MilkyWay', artwork: [{ src: '/milkyway/icon-192.png', sizes: '192x192', type: 'image/png' }] });
        if (!on) session.metadata = null;
        session.playbackState = on ? 'playing' : 'none';
      } catch {}
      for (const [action, handler] of [['hangup', () => finish(joined ? 'ended' : 'cancelled')], ['togglemicrophone', () => panel?.querySelector('#mwCallMic')?.click()], ['togglecamera', () => panel?.querySelector('#mwCallCamera')?.click()]]) {
        try { session.setActionHandler(action, on ? handler : null); } catch {}
      }
    }
    if (on && call?.offer?.mode === 'video' && document.visibilityState === 'visible' && !wakeLock) {
      try { wakeLock = await navigator.wakeLock?.request('screen'); wakeLock?.addEventListener('release', () => { wakeLock = null; }); } catch { wakeLock = null; }
    }
    if (!on) { wakeLock?.release().catch(() => {}); wakeLock = null; backgroundNotice(false); }
  }

  async function backgroundNotice(show) {
    try {
      const registration = await navigator.serviceWorker?.getRegistration('/milkyway/');
      if (!registration) return;
      if (!show || !call || !('Notification' in window) || Notification.permission !== 'granted') {
        (await registration.getNotifications({ tag: 'mw-call-active' })).forEach(notice => notice.close());
        return;
      }
      await registration.showNotification(panel?.dataset.title || 'MilkyWay', { tag: 'mw-call-active', body: say('callInProgress'), silent: true, renotify: false, requireInteraction: true, icon: './icon-192.png', badge: './brand/milkyway-emblem-96.png', data: { url: new URL(`/milkyway/#call=${call.id}`, location.origin).href, call: { id: call.id, kind: 'active' } } });
    } catch {}
  }

  async function connect() {
    // The caller joins the room while it rings so the call connects the moment it is answered.
    const waiting = call?.status === 'ringing' && call.caller_id === user?.id;
    if (!call || busy || room || (call.status !== 'accepted' && !waiting)) return;
    busy = true;
    if (!waiting) tone.stop();
    const attempt = epoch;
    let pendingRoom = null;
    try {
      if (!waiting) status(reconnects ? text('Reconnecting…', 'Inaunganisha tena…') : text('Connecting…', 'Inaunganisha…'));
      const sdk = await window.MilkyWayLoadLiveKit?.().catch(() => null) || window.LivekitClient || window.LiveKitClient;
      if (!sdk?.Room) throw new Error(text('LiveKit did not load. Retry.', 'LiveKit haijapakia. Jaribu tena.'));
      request = new AbortController();
      const timeout = setTimeout(() => request?.abort(), 15000);
      // Access handed back with the start / accept request is used once; reconnects ask for a fresh token.
      let access = call.access;
      delete call.access;
      try { access ||= await callApi('?action=token', { id: call.id, name: nameOf() }, request.signal); }
      catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new Error(text(`Call authorization failed (${error.status || 503}). Retry in a moment.`, `Ruhusa ya simu imeshindikana (${error.status || 503}). Jaribu tena baada ya muda.`));
      } finally { clearTimeout(timeout); request = null; }
      if (epoch !== attempt) return;
      if (!access.token || access.serverUrl?.replace(/\/$/, '') !== serverUrl) throw new Error(text('Invalid MilkyWay call configuration.', 'Mipangilio ya simu si sahihi.'));
      pendingRoom = new sdk.Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      room = pendingRoom;
      let established = false;
      pendingRoom.on(sdk.RoomEvent.TrackSubscribed, track => { if (room === pendingRoom) attach(track); });
      pendingRoom.on(sdk.RoomEvent.TrackUnsubscribed, track => { track.detach().forEach(element => element.remove()); layoutVideos(); });
      pendingRoom.on(sdk.RoomEvent.LocalTrackPublished, publication => { if (room === pendingRoom && publication.track) attach(publication.track, true); });
      pendingRoom.on(sdk.RoomEvent.LocalTrackUnpublished, publication => { publication.track?.detach().forEach(element => element.remove()); layoutVideos(); });
      pendingRoom.on(sdk.RoomEvent.ParticipantConnected, () => {
        if (room !== pendingRoom) return;
        clearTimeout(peerLeftTimer); peerLeftTimer = null;
        tone.stop();
        joined = true; status(text('Connected', 'Imeunganishwa'));
      });
      // The other side may only be switching networks; give them a moment to rejoin before ending the call.
      pendingRoom.on(sdk.RoomEvent.ParticipantDisconnected, () => {
        if (room !== pendingRoom) return;
        status(say('callPeerReconnecting'));
        clearTimeout(peerLeftTimer);
        peerLeftTimer = setTimeout(() => { if (room === pendingRoom && !pendingRoom.remoteParticipants.size) finish('disconnected'); }, 12000);
      });
      pendingRoom.on(sdk.RoomEvent.Reconnecting, () => status(text('Reconnecting…', 'Inaunganisha tena…')));
      pendingRoom.on(sdk.RoomEvent.Reconnected, () => status(text('Connected', 'Imeunganishwa')));
      pendingRoom.on(sdk.RoomEvent.Disconnected, () => {
        if (room !== pendingRoom || !established) return;
        // LiveKit gave up resuming (e.g. the network dropped for a while): join the call room again.
        room = null;
        pendingRoom.removeAllListeners?.();
        panel?.querySelectorAll('#mwCallMedia > *').forEach(element => { element.srcObject = null; element.remove(); });
        if (call && reconnects < 3) { reconnects++; status(text('Reconnecting…', 'Inaunganisha tena…')); setTimeout(() => connect(), 1200 * reconnects); }
        else finish('disconnected');
      });
      await pendingRoom.connect(access.serverUrl, access.token);
      if (epoch !== attempt) { await pendingRoom.disconnect(true); return; }
      established = true;
      await pendingRoom.localParticipant.setMicrophoneEnabled(true, { echoCancellation: true, noiseSuppression: true });
      if (call.offer.mode === 'video') await pendingRoom.localParticipant.setCameraEnabled(true, { facingMode: 'user' });
      if (epoch !== attempt) { await pendingRoom.disconnect(true); return; }
      if (!pendingRoom.localParticipant.isMicrophoneEnabled) throw new Error(text('Microphone publication failed.', 'Kutuma sauti kumeshindikana.'));
      pendingRoom.remoteParticipants.forEach(participant => participant.trackPublications.forEach(publication => { if (publication.track) attach(publication.track); }));
      joined = joined || pendingRoom.remoteParticipants.size > 0;
      reconnects = 0;
      if (pendingRoom.remoteParticipants.size) tone.stop();
      status(pendingRoom.remoteParticipants.size ? text('Connected', 'Imeunganishwa') : call?.status === 'ringing' ? text('Ringing…', 'Inaita…') : text('Waiting for the other participant…', 'Inasubiri mshiriki mwingine…'));
      pendingRoom.startAudio?.().catch(() => {});
      controls();
      if (document.visibilityState === 'hidden') backgroundNotice(true);
    } catch (error) {
      if (epoch === attempt) {
        toast(error.name === 'NotAllowedError' ? text('Allow microphone/camera access in site settings.', 'Ruhusu maikrofoni/kamera kwenye mipangilio.') : error.name === 'AbortError' ? text('Call authorization timed out.', 'Muda wa ruhusa ya simu umeisha.') : error.message);
        await finish('disconnected');
      }
    } finally { if (epoch === attempt) busy = false; }
  }

  // Background ringing needs this device registered for push. Once the user has allowed notifications this
  // happens silently; otherwise the Chats screen offers a "Turn on call alerts" button.
  function registerDevice(prompt = false) {
    if (!logged() || !window.MilkyWayLiveNotifications?.subscribe) return Promise.resolve(false);
    if (!prompt && subscribedFor === user.id) return Promise.resolve(true);
    const account = user.id;
    return window.MilkyWayLiveNotifications.subscribe({ prompt }).then(done => { if (done && user?.id === account) subscribedFor = account; return done; });
  }

  async function start(withVideo = false) {
    if (!logged() || !threadWith || activeGroupId) return;
    if (call || busy || invitation || window.MilkyWayLive?.isActive()) return toast(text('Finish the current call or Live first.', 'Maliza simu au Live kwanza.'));
    busy = true;
    accountId = user.id;
    const attempt = ++epoch;
    // Unlock audio during the tap so the ringback and the other person's voice can play.
    try { ensureNotificationAudio?.(); } catch {}
    window.MilkyWayLoadLiveKit?.().catch(() => {});
    try {
      let data;
      try { const started = await callApi('?action=start', { callee: threadWith, mode: withVideo ? 'video' : 'audio', name: nameOf() }); data = { ...started.call, access: started.access || undefined }; }
      catch (failure) { throw new Error(`${text('Call could not start.', 'Simu haijaanza.')} ${failure.message || ''}`.trim()); }
      if (attempt !== epoch) { await callApi('?action=end', { id: data.id, outcome: 'cancelled' }).catch(() => {}); return; }
      call = data;
      reconnects = 0;
      showPanel(withVideo ? text('Video call', 'Simu ya video') : text('Audio call', 'Simu ya sauti'));
      status(text('Ringing…', 'Inaita…'));
      tone.start('outgoing');
    } catch (error) { toast(error.message); }
    finally { if (attempt === epoch) busy = false; }
    if (attempt === epoch && call) connect();
  }

  async function finish(outcome = 'ended', update = true) {
    if (finishing) return;
    finishing = true;
    ++epoch;
    request?.abort();
    tone.stop();
    clearTimeout(peerLeftTimer);
    peerLeftTimer = null;
    const endingCall = call;
    const endingRoom = room;
    call = null;
    room = null;
    busy = false;
    joined = false;
    accountId = null;
    disconnectedAt = null;
    reconnects = 0;
    try {
      keepAlive(false);
      if (endingRoom) await endingRoom.disconnect(true);
      if (panel) {
        panel.querySelectorAll('audio,video').forEach(element => { element.pause(); element.srcObject = null; });
        panel.remove();
        panel = null;
      }
      if (endingCall && update) {
        const error = await callApi('?action=end', { id: endingCall.id, outcome }).then(() => null, failure => failure);
        if (error) toast(text('Call closed locally; the server status could not be updated.', 'Simu imefungwa hapa; hali ya seva haijabadilika.'));
      }
      if (endingCall) toast(({ ended: text('Call ended', 'Simu imeisha'), missed: text('Missed call', 'Simu haikupokelewa'), cancelled: text('Call cancelled', 'Simu imeghairiwa'), rejected: text('Call declined', 'Simu imekataliwa'), disconnected: text('Call disconnected', 'Simu imekatika') })[outcome]);
    } finally { finishing = false; }
  }

  function removeInvitation() {
    tone.stop();
    if (invitation) { clearInterval(invitation.mwRealert); closeRingNotification(invitation.dataset.callId); }
    invitation?.remove();
    invitation = null;
    flashTitle(null);
  }
  // A ringing card that goes away because the caller hung up or the call timed out leaves a missed-call card
  // (and a system notification when MilkyWay is not in front) instead of vanishing without a trace.
  async function invitationEnded() {
    const card = invitation;
    if (!card) return;
    const id = card.dataset.callId;
    const data = await callApi(`?id=${encodeURIComponent(id)}`).then(result => result.call, () => null);
    if (invitation !== card) return;
    if (data?.status === 'ringing' && Date.now() - Date.parse(data.created_at) <= ringWindow) return;
    const missed = !data || data.status === 'ended' && ['missed', 'cancelled'].includes(data.answer?.outcome || 'missed');
    removeInvitation();
    if (missed) rememberMissed({ id, callerId: card.dataset.callerId, name: card.dataset.name, avatar: card.dataset.avatar || '', video: card.dataset.video === 'true', at: Date.now() });
  }

  const missedKey = () => `mw_missed_calls_${user?.id || ''}`;
  const missedList = () => { try { return JSON.parse(localStorage.getItem(missedKey()) || '[]').filter(item => callId.test(item.id)); } catch { return []; } };
  function rememberMissed(item) {
    const list = [item, ...missedList().filter(entry => entry.id !== item.id)].slice(0, 10);
    try { localStorage.setItem(missedKey(), JSON.stringify(list)); } catch {}
    paintMissed();
    if (document.visibilityState !== 'visible' || !document.hasFocus()) {
      navigator.serviceWorker?.ready.then(registration => registration.showNotification(say('missedCallFrom'), { tag: `mw-call-${item.id}`, body: `${item.name} · ${item.video ? text('Video call', 'Simu ya video') : text('Audio call', 'Simu ya sauti')}`, icon: './icon-192.png', badge: './brand/milkyway-emblem-96.png', data: { url: new URL(`/milkyway/#call=${item.id}&do=missed`, location.origin).href, call: { id: item.id, kind: 'missed' } } })).catch(() => {});
    }
  }
  function dismissMissed(all = false) {
    const list = all ? [] : missedList().slice(1);
    try { localStorage.setItem(missedKey(), JSON.stringify(list)); } catch {}
    paintMissed();
  }
  function paintMissed() {
    let card = document.getElementById('mwMissedCall');
    const list = logged() ? missedList() : [];
    if (!list.length) { card?.remove(); return; }
    const latest = list[0];
    if (!card) { card = document.createElement('section'); card.id = 'mwMissedCall'; card.className = 'mw-call-missed'; card.setAttribute('role', 'status'); document.body.append(card); }
    const face = latest.avatar ? `<img loading="lazy" decoding="async" src="${esc(window.MilkyWayMedia?.image(latest.avatar, 120) || latest.avatar)}" alt="">` : `<span>${esc((latest.name || 'M').trim().charAt(0).toUpperCase())}</span>`;
    const when = new Date(latest.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    card.innerHTML = `<span class="mw-call-missed-face">${face}</span><span class="mw-call-missed-who"><small>${esc(say('missedCallFrom'))}${list.length > 1 ? ` · ${list.length}` : ''}</small><b data-mw-user-content>${esc(latest.name)}</b><small>${latest.video ? icons.video : icons.accept}${esc(latest.video ? text('Video call', 'Simu ya video') : text('Audio call', 'Simu ya sauti'))} · ${esc(when)}</small></span><span class="mw-call-missed-actions"><button type="button" class="mw-call-missed-back">${latest.video ? icons.video : icons.accept}<small>${esc(say('callBack'))}</small></button><button type="button" class="mw-call-missed-close" aria-label="${esc(say('dismiss'))}">×</button></span>`;
    card.querySelector('.mw-call-missed-close').onclick = () => dismissMissed();
    card.querySelector('.mw-call-missed-back').onclick = async () => {
      if (!latest.callerId || typeof openThread !== 'function') return;
      dismissMissed();
      await openThread(latest.callerId, latest.name);
      start(latest.video);
    };
  }

  // While a call rings, the tab title blinks so the call still shows when MilkyWay sits in a background tab.
  let titleTimer = null, restTitle = '';
  function flashTitle(message) {
    clearInterval(titleTimer); titleTimer = null;
    if (restTitle) { document.title = restTitle; restTitle = ''; }
    if (!message) return;
    restTitle = document.title;
    let on = false;
    titleTimer = setInterval(() => { on = !on; document.title = on ? `📞 ${message}` : restTitle; }, 900);
  }

  // While MilkyWay is open but hidden (another app or tab in front), ring through a system notification
  // with Answer / Decline, the same one a Web Push would show, so nobody has to open the app first.
  async function ringNotification(incoming, title) {
    if (document.visibilityState === 'visible' && document.hasFocus() || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (!registration || invitation?.dataset.callId !== incoming.id) return;
      await registration.showNotification(title, { tag: `mw-call-${incoming.id}`, body: text('Tap to answer on MilkyWay', 'Gusa kupokea kwenye MilkyWay'), renotify: true, requireInteraction: true, silent: false, vibrate: [700, 350, 700, 350, 700, 350, 700], icon: './icon-192.png', badge: './brand/milkyway-emblem-96.png', actions: [{ action: 'answer', title: text('Answer', 'Pokea') }, { action: 'decline', title: text('Decline', 'Kataa') }], data: { url: new URL(`/milkyway/#call=${incoming.id}`, location.origin).href, call: { id: incoming.id, kind: 'ring' } } });
    } catch {}
  }
  function closeRingNotification(id) {
    navigator.serviceWorker?.ready.then(registration => registration.getNotifications({ tag: `mw-call-${id}` })).then(items => items.forEach(item => item.close())).catch(() => {});
  }

  async function answer(incoming) {
    if (busy || call || !invitation) return;
    if (incoming.offer?.transport !== 'livekit') return toast(text('The caller uses the old call engine. Both participants need the updated Preview.', 'Mpigaji anatumia toleo la zamani. Wote tumieni Preview mpya.'));
    const title = invitation.dataset.title;
    busy = true;
    tone.stop();
    invitation.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { ensureNotificationAudio?.(); } catch {}
    window.MilkyWayLoadLiveKit?.().catch(() => {});
    const { data: accepted, error: updateError } = await callApi('?action=accept', { id: incoming.id, name: nameOf() }).then(result => ({ data: { ...result.call, access: result.access || undefined } }), failure => ({ error: failure }));
    busy = false;
    removeInvitation();
    if (updateError) { toast(text('Call expired or acceptance failed.', 'Simu imeisha au kukubali kumeshindikana.')); return; }
    call = accepted;
    accountId = user.id;
    reconnects = 0;
    ++epoch;
    showPanel(title);
    registerDevice(true).catch(() => {});
    await connect();
  }

  async function decline(incoming) {
    if (!invitation) return;
    const buttons = [...invitation.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; });
    tone.stop();
    const updateError = await callApi('?action=decline', { id: incoming.id }).then(() => null, failure => failure);
    if (updateError && updateError.status !== 409) { toast(text('Could not decline. Retry.', 'Kukataa kumeshindikana. Jaribu tena.')); buttons.forEach(button => { button.disabled = false; }); return; }
    removeInvitation();
  }

  const icons = {
    accept: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.8 3.5h2.6l1.5 4.2-2 1.5a12 12 0 0 0 5.9 5.9l1.5-2 4.2 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.8 5.7a2 2 0 0 1 2-2.2Z"/></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="m15.5 10.2 5-3v9.6l-5-3"/></svg>',
  };

  async function showInvitation(incoming) {
    if (invitation?.dataset.callId === incoming.id) return;
    removeInvitation();
    const card = document.createElement('section');
    invitation = card;
    card.className = 'mw-call-incoming mw-call-ringing';
    card.dataset.callId = incoming.id;
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-labelledby', 'mwIncomingName');
    card.setAttribute('aria-describedby', 'mwIncomingKind');
    const profile = await getProfile(incoming.caller_id).catch(() => null);
    if (invitation !== card || !logged()) return;
    const name = profile?.display_name || profile?.username || text('MilkyWay user', 'Mtumiaji wa MilkyWay');
    const video = incoming.offer?.mode === 'video';
    const kind = video ? text('Incoming video call', 'Simu ya video inayoingia') : text('Incoming audio call', 'Simu ya sauti inayoingia');
    card.dataset.title = `${name} · ${kind}`;
    Object.assign(card.dataset, { callerId: incoming.caller_id, name, video: String(video), avatar: profile?.avatar_url || '' });
    const avatar = profile?.avatar_url ? `<img loading="lazy" decoding="async" src="${esc(window.MilkyWayMedia?.image(profile.avatar_url, 160) || profile.avatar_url)}" alt="">` : `<span>${esc(name.trim().charAt(0).toUpperCase() || 'M')}</span>`;
    card.innerHTML = `<div class="mw-call-ringer" aria-hidden="true"><i></i><i></i><span class="mw-call-face">${avatar}</span></div><div class="mw-call-who"><strong id="mwIncomingName" data-mw-user-content>${esc(name)}</strong><span id="mwIncomingKind">${video ? icons.video : icons.accept}${esc(kind)}</span></div><div class="mw-call-answer"><button type="button" class="mw-call-decline" aria-label="${esc(text('Decline', 'Kataa'))}">${icons.accept}<small>${esc(text('Decline', 'Kataa'))}</small></button><button type="button" class="mw-call-accept" aria-label="${esc(text('Accept', 'Kubali'))}">${video ? icons.video : icons.accept}<small>${esc(text('Accept', 'Kubali'))}</small></button></div>`;
    card.querySelector('.mw-call-decline').onclick = () => decline(incoming);
    card.querySelector('.mw-call-accept').onclick = () => answer(incoming);
    document.body.append(card);
    tone.start('incoming');
    card.querySelector('.mw-call-accept').focus({ preventScroll: true });
    // Warm up the call engine while it rings so answering connects straight away.
    window.MilkyWayLoadLiveKit?.().catch(() => {});
    try { navigator.vibrate?.([700, 350, 700, 350, 700]); } catch {}
    ringNotification(incoming, card.dataset.title);
    flashTitle(card.dataset.title);
    // Keep alerting until the call is answered, declined or ends: the system notification re-rings while
    // MilkyWay is not in front, and the ringtone keeps going inside the app.
    card.mwRealert = setInterval(() => { if (invitation === card) ringNotification(incoming, card.dataset.title); }, 6000);
  }

  // Answer / Decline / tap on a call notification, either posted by the service worker or passed in the URL.
  async function handleAction(id, action) {
    if (!callId.test(id || '')) return;
    if (action === 'return') { if (call?.id === id) panel?.querySelector('#mwCallHangup')?.focus(); return; }
    for (let wait = 0; wait < 60 && !logged(); wait++) await new Promise(resolve => setTimeout(resolve, 250));
    if (!logged()) return;
    if (action === 'missed') { window.openDMInbox?.(); return; }
    if (call?.id === id) return;
    const data = await callApi(`?id=${encodeURIComponent(id)}`).then(result => result.call, () => null);
    if (!data || data.status !== 'ringing' || data.callee_id !== user.id || Date.now() - Date.parse(data.created_at) > ringWindow) { toast(say('callAlreadyEnded')); return; }
    if (call || busy) return toast(text('Finish the current call or Live first.', 'Maliza simu au Live kwanza.'));
    await showInvitation(data);
    if (action === 'decline') await decline(data);
    else if (action === 'answer') await answer(data);
  }

  async function poll() {
    if (polling || finishing) { pollAgain = true; return; }
    polling = true;
    pollAgain = false;
    try {
      if (accountId && accountId !== user?.id) { await finish('disconnected', false); return; }
      if (!logged()) { removeInvitation(); subscribedFor = registrationTried = null; return; }
      if (registrationTried !== user.id) { registrationTried = user.id; registerDevice(false).catch(() => {}); }
      listen();
      if (call) {
        const currentId = call.id;
        const { data, error } = await callApi(`?id=${encodeURIComponent(currentId)}`).then(result => ({ data: result.call }), failure => ({ error: failure }));
        if (call?.id !== currentId) return;
        if (error || !data) {
          // A connected call keeps going on LiveKit even if the signalling check briefly fails (background, weak network).
          if (room?.state === 'connected') return;
          disconnectedAt ||= Date.now();
          status(text('Checking call connection…', 'Inakagua muunganisho…'));
          if (Date.now() - disconnectedAt > 15000) await finish('disconnected');
          return;
        }
        disconnectedAt = null;
        call = data;
        if (['ended', 'declined'].includes(data.status)) { await finish(data.answer?.outcome || (data.status === 'declined' ? 'rejected' : 'ended'), false); return; }
        if (data.status === 'ringing' && Date.now() - Date.parse(data.created_at) > ringWindow) { await finish('missed'); return; }
        if (data.status === 'accepted') {
          if (room?.state === 'connected' && !joined) { tone.stop(); status(text('Connecting…', 'Inaunganisha…')); }
          await connect();
        }
        return;
      }
      if (busy) return;
      // Incoming calls are checked every second, on top of the realtime ring signal and call pushes.
      // A hidden app checks every few seconds and an offline one waits for the 'online' event.
      const gap = document.visibilityState === 'hidden' && !invitation ? 4000 : 900;
      if (navigator.onLine === false || Date.now() - lastIncomingCheck < gap) return;
      lastIncomingCheck = Date.now();
      const { data: incoming, error } = await callApi('?action=incoming').then(result => ({ data: result.call }), failure => ({ error: failure }));
      // A failed check (weak network, background) keeps the ringing card; only a confirmed end removes it.
      if (error) return;
      if (!incoming || incoming.id !== invitation?.dataset.callId) await invitationEnded();
      if (!incoming) return;
      if (Date.now() - Date.parse(incoming.created_at) > ringWindow) {
        await callApi('?action=end', { id: incoming.id, outcome: 'missed' }).catch(() => {});
        if (invitation?.dataset.callId === incoming.id) await invitationEnded(); return;
      }
      if (invitation?.dataset.callId === incoming.id || window.MilkyWayLive?.isActive()) return;
      await showInvitation(incoming);
    } catch { if (call) status(text('Call service unavailable. Retrying…', 'Huduma ya simu haipatikani. Inajaribu tena…')); }
    finally { polling = false; if (pollAgain) { pollAgain = false; setTimeout(poll, 0); } }
  }

  // Realtime websocket for this account's call signals. Each signal only names a call; poll() and
  // handleAction() re-read it from the call function, so a forged message cannot fake a call.
  function listen(force = false) {
    const account = logged() ? user.id : null;
    if (!force && signalsFor === account && (!signals || ['joined', 'joining'].includes(signals.state))) return;
    if (signals) { sb.removeChannel?.(signals); signals = null; }
    signalsFor = account;
    if (!account || !sb.channel) return;
    signals = sb.channel(`mw-calls-${account}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'call' }, ({ payload }) => {
        const id = String(payload?.id || '');
        if (!callId.test(id) || user?.id !== account) return;
        if (payload.kind === 'ring' && !call && !busy && !invitation && !window.MilkyWayLive?.isActive()) { lastIncomingCheck = Date.now(); ringFromSignal(id); }
        else { lastIncomingCheck = 0; poll(); }
      })
      .subscribe(state => { if (state === 'SUBSCRIBED') { lastIncomingCheck = 0; poll(); } });
  }
  async function ringFromSignal(id) {
    const data = await callApi(`?id=${encodeURIComponent(id)}`).then(result => result.call, () => null);
    if (!data || data.status !== 'ringing' || data.callee_id !== user?.id || Date.now() - Date.parse(data.created_at) > ringWindow) return;
    if (call || busy || invitation?.dataset.callId === id || window.MilkyWayLive?.isActive()) return;
    await showInvitation(data);
  }

  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'mw-call-push') { lastIncomingCheck = 0; poll(); }
    else if (event.data?.type === 'mw-call-action') handleAction(String(event.data.id || ''), String(event.data.action || 'open'));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastIncomingCheck = 0;
      backgroundNotice(false);
      if (call) { keepAlive(true); room?.startAudio?.().catch(() => {}); }
      if (invitation) closeRingNotification(invitation.dataset.callId);
      listen();
      poll();
    } else if (call && room) backgroundNotice(true);
  });
  window.addEventListener('blur', () => { if (invitation) ringNotification({ id: invitation.dataset.callId }, invitation.dataset.title); });
  window.addEventListener('focus', () => { if (invitation) closeRingNotification(invitation.dataset.callId); });
  sb.auth.onAuthStateChange(() => setTimeout(paintMissed, 0));
  window.addEventListener('mw-language-change', paintMissed);
  const opened = /^#call=([a-f0-9-]{36})(?:&do=(answer|decline|open|missed|return))?$/i.exec(location.hash);
  if (opened) {
    history.replaceState(null, '', location.pathname + location.search);
    handleAction(opened[1], opened[2] || 'open');
  }

  window.startDMVoiceCall = start;
  window.endDMVoiceCall = () => finish(joined ? 'ended' : 'cancelled');
  window.MilkyWayCalls = { isActive: () => !!call || busy || !!invitation, disconnect: () => finish('disconnected', false), translate: controls, enableAlerts: () => registerDevice(true) };
  window.addEventListener('pagehide', () => finish('disconnected'));
  window.addEventListener('online', () => { listen(true); lastIncomingCheck = 0; poll(); });
  sb.auth.onAuthStateChange(() => setTimeout(() => { listen(); lastIncomingCheck = 0; poll(); }, 0));
  setInterval(poll, 1000);
})();
