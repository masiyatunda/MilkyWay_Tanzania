// Live in the Orbit feed: ongoing Lives appear as cards between regular posts, and inside a Live a
// vertical swipe (or wheel / arrow keys / the side arrows) moves straight to the previous or next Live.
(() => {
  const byId = identity => document.getElementById(identity);
  const languages = ['en', 'sw', 'fr', 'zh', 'ar', 'pt', 'hi', 'de'];
  const copy = {
    liveNow: ['LIVE', 'LIVE', 'LIVE', '直播', 'مباشر', 'AO VIVO', 'लाइव', 'LIVE'],
    watching: ['watching', 'wanatazama', 'regardent', '人在看', 'يشاهدون', 'assistindo', 'देख रहे हैं', 'schauen zu'],
    tapToWatch: ['Tap to watch', 'Gusa kutazama', 'Touchez pour regarder', '点击观看', 'اضغط للمشاهدة', 'Toque para assistir', 'देखने के लिए टैप करें', 'Zum Ansehen tippen'],
    tapToListen: ['Tap to listen', 'Gusa kusikiliza', 'Touchez pour écouter', '点击收听', 'اضغط للاستماع', 'Toque para ouvir', 'सुनने के लिए टैप करें', 'Zum Anhören tippen'],
    video: ['Video Live', 'Video Live', 'Live vidéo', '视频直播', 'بث فيديو', 'Live em vídeo', 'वीडियो लाइव', 'Video-Live'],
    audio: ['Audio Live', 'Audio Live', 'Live audio', '语音直播', 'بث صوتي', 'Live em áudio', 'ऑडियो लाइव', 'Audio-Live'],
    more: ['more Lives · swipe inside to switch', 'Live zaidi · telezesha ndani kubadili', 'autres Lives · glissez pour changer', '个直播 · 上下滑动切换', 'بث آخر · اسحب للتبديل', 'outras Lives · deslize para trocar', 'और लाइव · बदलने के लिए स्वाइप करें', 'weitere Lives · wischen zum Wechseln'],
    swipeHint: ['Swipe up or down for more Lives', 'Telezesha juu au chini kwa Live zaidi', 'Glissez vers le haut ou le bas pour d’autres Lives', '上下滑动查看更多直播', 'اسحب لأعلى أو لأسفل لمزيد من البث', 'Deslize para cima ou para baixo para mais Lives', 'और लाइव के लिए ऊपर या नीचे स्वाइप करें', 'Nach oben oder unten wischen für weitere Lives'],
    previous: ['Previous Live', 'Live iliyotangulia', 'Live précédent', '上一个直播', 'البث السابق', 'Live anterior', 'पिछला लाइव', 'Vorheriges Live'],
    next: ['Next Live', 'Live inayofuata', 'Live suivant', '下一个直播', 'البث التالي', 'Próxima Live', 'अगला लाइव', 'Nächstes Live'],
    joining: ['Joining…', 'Inajiunga…', 'Connexion…', '正在加入…', 'جارٍ الانضمام…', 'Entrando…', 'जुड़ रहे हैं…', 'Verbinde…'],
    ended: ['Live ended · up next', 'Live imeisha · inayofuata', 'Live terminé · à suivre', '直播已结束 · 下一个', 'انتهى البث · التالي', 'Live encerrada · a seguir', 'लाइव खत्म · अगला', 'Live beendet · als Nächstes'],
    onlyOne: ['This is the only Live right now', 'Hii ndiyo Live pekee sasa hivi', 'C’est le seul Live en ce moment', '目前只有这一个直播', 'هذا هو البث الوحيد الآن', 'Esta é a única Live agora', 'अभी यही एकमात्र लाइव है', 'Gerade ist nur dieses Live aktiv'],
    feedLabel: ['Live now in your Orbit', 'Live sasa kwenye Orbit yako', 'En direct dans votre Orbit', '你的 Orbit 正在直播', 'مباشر الآن في Orbit', 'Ao vivo agora no seu Orbit', 'आपके Orbit में अभी लाइव', 'Jetzt live in deinem Orbit']
  };
  const say = key => {
    let language = 'sw';
    try { language = window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch {}
    const row = copy[key] || [key];
    return row[Math.max(0, languages.indexOf(language))] || row[0];
  };
  const modeFor = record => /^(mw-audio-live-|mw-conversation-audio-)/.test(record.room_name || '') ? 'audio' : 'video';
  // First Live card after the 2nd post, then one after every 4 posts.
  const firstSlot = 2;
  const slotGap = 4;
  let records = [];
  let painting = false;
  let switching = false;
  let hintShownFor = '';

  const currentUser = () => (typeof user !== 'undefined' ? user : null);
  const feedMode = () => (typeof mode !== 'undefined' ? mode : 'feed');
  // Lives others are hosting, in discovery order; this is the order the in-Live swipe walks through.
  const watchable = () => records.filter(record => record.room_name && record.host_id !== currentUser()?.id);

  function avatarNode(profile, fallback, size) {
    const element = document.createElement('span');
    element.className = 'mwlf-avatar';
    const initial = (profile?.display_name || fallback || 'M').slice(0, 1).toUpperCase();
    element.textContent = initial;
    try {
      if (profile?.avatar_url) {
        const address = new URL(profile.avatar_url, location.origin);
        if (['https:', 'http:'].includes(address.protocol)) {
          const image = document.createElement('img');
          image.src = window.MilkyWayMedia?.image(address.href, size) || address.href;
          image.alt = '';image.loading = 'lazy';image.decoding = 'async';
          image.addEventListener('error', () => { element.textContent = initial; });
          element.replaceChildren(image);
        }
      }
    } catch {}
    return element;
  }

  function card(record, extra) {
    const name = record.profile?.display_name || record.host_name || 'MilkyWay';
    const audio = modeFor(record) === 'audio';
    const article = document.createElement('article');
    article.className = 'mwlf-card';
    article.dataset.mwLiveFeed = record.room_name;
    article.dataset.mode = modeFor(record);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mwlf-open';
    button.setAttribute('aria-label', `${say('liveNow')} · ${name} · ${record.title || ''} · ${say(audio ? 'tapToListen' : 'tapToWatch')}`);
    if (record.profile?.avatar_url) {
      const backdrop = avatarNode(record.profile, name, 480);
      backdrop.className = 'mwlf-backdrop';backdrop.setAttribute('aria-hidden', 'true');
      button.append(backdrop);
    }
    const top = document.createElement('span');top.className = 'mwlf-top';
    const badge = document.createElement('span');badge.className = 'mwlf-badge';badge.textContent = say('liveNow');
    top.append(badge);
    if (Number.isInteger(record.connectedCount)) {
      const count = document.createElement('span');count.className = 'mwlf-count';
      count.textContent = `${record.connectedCount} ${say('watching')}`;
      top.append(count);
    }
    const kind = document.createElement('span');kind.className = 'mwlf-kind';kind.textContent = say(audio ? 'audio' : 'video');
    top.append(kind);
    const center = document.createElement('span');center.className = 'mwlf-center';
    const ring = document.createElement('span');ring.className = 'mwlf-ring';ring.setAttribute('aria-hidden', 'true');
    ring.append(avatarNode(record.profile, name, 200));
    if (audio) { const bars = document.createElement('span');bars.className = 'mwlf-bars';bars.innerHTML = '<i></i><i></i><i></i><i></i>';center.append(ring, bars); }
    else center.append(ring);
    const info = document.createElement('span');info.className = 'mwlf-info';
    const title = document.createElement('strong');title.textContent = record.title || name;
    const host = document.createElement('small');host.textContent = `${name}${record.profile?.username ? ' · @' + record.profile.username : ''}`;
    const cta = document.createElement('span');cta.className = 'mwlf-cta';cta.textContent = say(audio ? 'tapToListen' : 'tapToWatch');
    info.append(title, host, cta);
    if (extra > 0) { const more = document.createElement('span');more.className = 'mwlf-more';more.textContent = `+${extra} ${say('more')}`;info.append(more); }
    button.append(top, center, info);
    button.addEventListener('click', () => window.MilkyWayLive?.watch(record));
    article.append(button);
    article.classList.add('is-away');
    sightings()?.observe(article);
    return article;
  }

  // A Live card scrolling into view starts loading the LiveKit SDK, so the tap opens the room at once;
  // cards out of view pause their animations.
  let sightingObserver = null;
  function sightings() {
    if (sightingObserver || !('IntersectionObserver' in window)) return sightingObserver;
    sightingObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.classList.toggle('is-away', !entry.isIntersecting);
        if (entry.isIntersecting) window.MilkyWayLoadLiveKit?.().catch(() => {});
      }
    }, { rootMargin: '200px 0px' });
    return sightingObserver;
  }

  function slotCount(postCount, liveCount) {
    if (!postCount) return Math.min(1, liveCount);
    let count = 0;
    for (let slot = firstSlot; count < liveCount; slot += slotGap) { count++;if (slot >= postCount) break; }
    return count;
  }

  // loadFeed() rewrites the feed's HTML on every refresh, so the Live cards are re-inserted afterwards.
  function paintFeed() {
    const feed = byId('feed');
    if (!feed || painting) return;
    painting = true;
    try {
      const list = feedMode() === 'feed' ? watchable() : [];
      const signature = JSON.stringify([document.documentElement.lang, list.map(record => [record.room_name, record.title, record.connectedCount, record.host_name, record.profile?.display_name, record.profile?.avatar_url])]);
      const posts = [...feed.children].filter(child => child.classList.contains('post'));
      const existing = [...feed.querySelectorAll(':scope > .mwlf-card')];
      const ready = posts.length || feed.querySelector(':scope > .empty');
      if (!ready) { existing.forEach(node => node.remove());return; }
      // Leave untouched cards in place when nothing changed, so the reader's scroll does not jump.
      if (feed.dataset.mwLiveFeed === signature && existing.length === slotCount(posts.length, list.length)) return;
      feed.dataset.mwLiveFeed = signature;
      existing.forEach(node => { sightingObserver?.unobserve(node);node.remove(); });
      if (!list.length) return;
      if (!posts.length) { feed.prepend(card(list[0], list.length - 1));return; }
      let index = 0;
      for (let slot = firstSlot; index < list.length; slot += slotGap) {
        const anchor = posts[Math.min(slot, posts.length) - 1];
        const last = slot >= posts.length;
        anchor.after(card(list[index], last ? list.length - index - 1 : 0));
        index++;
        if (last) break;
      }
    } finally { painting = false; }
  }

  function observeFeed() {
    const feed = byId('feed');
    if (!feed) return;
    let queued = false;
    new MutationObserver(() => {
      if (painting || queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false;paintFeed(); });
    }).observe(feed, { childList: true });
  }

  // ---- Switching between Lives from inside the Live view ----
  const page = () => byId('mwLivePage');
  const onStage = () => {
    const live = window.MilkyWayLive;
    return !!live && !page()?.hidden && page()?.dataset.view === 'stage' && !live.isHost() && !!live.current();
  };

  function neighbour(direction) {
    const list = watchable();
    if (!list.length) return null;
    const current = window.MilkyWayLive?.current();
    const index = list.findIndex(record => record.room_name === current?.room_name);
    if (index < 0) return list[direction > 0 ? 0 : list.length - 1];
    if (list.length < 2) return null;
    return list[(index + direction + list.length) % list.length];
  }

  function flash(text) {
    const stage = byId('mwLiveStage');
    if (!stage) return;
    let note = byId('mwlfNotice');
    if (!note) { note = document.createElement('p');note.id = 'mwlfNotice';note.className = 'mwlf-notice';note.setAttribute('role', 'status');stage.append(note); }
    note.textContent = text;
    note.classList.remove('is-on');void note.offsetWidth;note.classList.add('is-on');
  }

  // A full-screen preview of a neighbouring Live. While dragging it follows the finger in from the
  // top or bottom edge; once a switch is committed it stays as the cover until the new room shows.
  function preview(record, direction) {
    const element = document.createElement('div');
    element.className = 'mwlf-switch';element.dataset.room = record.room_name;element.setAttribute('aria-hidden', 'true');
    const name = record.profile?.display_name || record.host_name || 'MilkyWay';
    if (record.profile?.avatar_url) { const backdrop = avatarNode(record.profile, name, 480);backdrop.className = 'mwlf-backdrop';element.append(backdrop); }
    const top = document.createElement('span');top.className = 'mwlf-top';
    const badge = document.createElement('span');badge.className = 'mwlf-badge';badge.textContent = say('liveNow');
    top.append(badge);
    if (Number.isInteger(record.connectedCount)) { const count = document.createElement('span');count.className = 'mwlf-count';count.textContent = `${record.connectedCount} ${say('watching')}`;top.append(count); }
    const ring = document.createElement('span');ring.className = 'mwlf-ring';ring.append(avatarNode(record.profile, name, 200));
    const label = document.createElement('strong');label.textContent = name;
    const title = document.createElement('small');title.textContent = record.title || say(modeFor(record) === 'audio' ? 'audio' : 'video');
    const joining = document.createElement('span');joining.className = 'mwlf-cta';joining.textContent = say('joining');
    element.append(top, ring, label, title, joining);
    place(element, direction > 0 ? '100%' : '-100%');
    return element;
  }
  const place = (element, offset, animate = false) => {
    if (!element) return;
    element.style.transition = animate ? `transform ${slideTime}ms cubic-bezier(.2,.8,.2,1)` : 'none';
    element.style.transform = offset ? `translate3d(0,${typeof offset === 'number' ? offset + 'px' : offset},0)` : '';
  };
  const slideTime = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 260;
  const settle = () => new Promise(resolve => setTimeout(resolve, slideTime + 20));

  function bounce(direction) {
    flash(say('onlyOne'));
    byId('mwLiveStage')?.animate?.([{ transform: 'translateY(0)' }, { transform: `translateY(${direction > 0 ? -18 : 18}px)` }, { transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
  }

  // Leave the current room and join `next`, with the cover hiding the lobby in between. `peek` is the
  // preview the finger was already dragging, so the slide carries on from where the finger let go.
  async function switchTo(next, direction, peek = null, notice = '') {
    switching = true;
    const shell = page();
    const stage = byId('mwLiveStage');
    const cover = peek?.dataset.room === next.room_name ? peek : preview(next, direction);
    if (cover !== peek) peek?.remove();
    if (!cover.isConnected) shell.append(cover);
    if (notice) cover.querySelector('.mwlf-cta').textContent = notice;
    void cover.offsetWidth;
    place(cover, 0, true);
    if (stage && !stage.hidden) place(stage, direction > 0 ? '-100%' : '100%', true);
    const started = Date.now();
    try {
      await settle();
      await window.MilkyWayLive.disconnect();
      place(stage, 0);
      window.MilkyWayLive.watch(next);
      // Keep the cover until the next room's stage is showing, so the lobby never flashes in between.
      await new Promise(resolve => {
        const check = () => (shell.dataset.view === 'stage' && Date.now() - started > 320) || Date.now() - started > 6000 ? resolve() : requestAnimationFrame(check);
        check();
      });
    } finally {
      place(stage, 0);
      cover.classList.add('is-leaving');
      setTimeout(() => cover.remove(), 260);
      switching = false;
      paintNav();
    }
  }

  async function go(direction, peek = null) {
    if (switching || !onStage()) { peek?.remove();return; }
    const next = neighbour(direction);
    if (!next) { peek?.remove();bounce(direction);return; }
    await switchTo(next, direction, peek);
  }

  // When the host ends the Live being watched, carry on to the next ongoing one, as a For You feed does.
  async function advanceAfterEnd(endedRoom) {
    if (switching || window.MilkyWayLive?.isHost()) return;
    const list = watchable();
    const index = list.findIndex(record => record.room_name === endedRoom);
    const rest = list.filter(record => record.room_name !== endedRoom);
    if (!rest.length) return;
    const next = index >= 0 ? list.slice(index + 1).concat(list.slice(0, index)).find(record => record.room_name !== endedRoom) : rest[0];
    await switchTo(next, 1, null, say('ended'));
  }

  // Avatars of the Lives one swipe away are fetched ahead of time, so the preview is never blank.
  const warmed = new Set();
  function warmNeighbours() {
    if (!onStage()) return;
    for (const record of [neighbour(-1), neighbour(1)]) {
      const address = record?.profile?.avatar_url;
      if (!address || warmed.has(address)) continue;
      warmed.add(address);
      for (const size of [200, 480]) { const image = new Image();image.decoding = 'async';image.src = window.MilkyWayMedia?.image(address, size) || address; }
    }
  }

  function paintNav() {
    const stage = byId('mwLiveStage');
    if (!stage) return;
    let nav = byId('mwlfNav');
    if (!nav) {
      nav = document.createElement('div');nav.id = 'mwlfNav';nav.className = 'mwlf-nav';
      for (const [direction, path] of [[-1, 'm6 15 6-6 6 6'], [1, 'm6 9 6 6 6-6']]) {
        const button = document.createElement('button');
        button.type = 'button';button.dataset.direction = String(direction);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
        button.addEventListener('click', () => go(direction));
        nav.append(button);
      }
      const position = document.createElement('span');position.className = 'mwlf-position';
      nav.insertBefore(position, nav.lastChild);
      stage.append(nav);
    }
    const list = watchable();
    const current = window.MilkyWayLive?.current();
    const index = list.findIndex(record => record.room_name === current?.room_name);
    const visible = onStage() && (list.length > 1 || (list.length === 1 && index < 0));
    nav.hidden = !visible;
    const [up, down] = nav.querySelectorAll('button');
    up.setAttribute('aria-label', say('previous'));up.title = say('previous');
    down.setAttribute('aria-label', say('next'));down.title = say('next');
    nav.querySelector('.mwlf-position').textContent = index >= 0 ? `${index + 1}/${list.length}` : `${list.length}`;
    if (visible && current?.room_name && !hintShownFor) { hintShownFor = current.room_name;flash(say('swipeHint')); }
    if (visible) warmNeighbours();
  }

  // Swipes only count when they start on the video / audio stage itself, never on comments, the
  // composer, the action bar or an open sheet, so those keep scrolling and sliding as before.
  const swipeSurface = target => {
    if (!(target instanceof Element)) return false;
    if (target.closest('input,textarea,select,button,a,label,form,aside,.mw-live-comments,.mw-live-glass,.mwx-bar,#mwlfNav')) return false;
    if (byId('mwLiveSheetBackdrop') && !byId('mwLiveSheetBackdrop').hidden) return false;
    return !!target.closest('#mwLiveStage');
  };

  function bindGestures() {
    const shell = page();
    if (!shell) return;
    // The stage tracks the finger vertically and the neighbouring Live slides in behind it. Releasing
    // past a fifth of the screen, or flicking, switches; anything shorter springs back.
    let drag = null;
    const release = () => {
      if (!drag) return;
      const { peek, height, direction } = drag;
      drag = null;
      place(byId('mwLiveStage'), 0, true);
      if (peek) { place(peek, direction > 0 ? height : -height, true);setTimeout(() => peek.remove(), slideTime + 20); }
    };
    shell.addEventListener('touchstart', event => {
      if (drag) release();
      drag = event.touches.length === 1 && !switching && onStage() && swipeSurface(event.target)
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY, at: Date.now(), axis: '', direction: 0, next: null, peek: null, height: shell.clientHeight || innerHeight }
        : null;
    }, { passive: true });
    shell.addEventListener('touchmove', event => {
      if (!drag || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - drag.x, dy = event.touches[0].clientY - drag.y;
      if (!drag.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
        drag.axis = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : 'x';
        if (drag.axis === 'x') { drag = null;return; }
      }
      event.preventDefault();
      const direction = dy < 0 ? 1 : -1;
      if (direction !== drag.direction) {
        drag.peek?.remove();
        drag.direction = direction;
        drag.next = neighbour(direction);
        drag.peek = drag.next ? preview(drag.next, direction) : null;
        if (drag.peek) shell.append(drag.peek);
      }
      // With nowhere to go the stage only gives a little, so the end of the list feels solid.
      const offset = drag.next ? dy : Math.max(-60, Math.min(60, dy * 0.25));
      place(byId('mwLiveStage'), offset);
      if (drag.peek) place(drag.peek, direction > 0 ? drag.height + offset : -drag.height + offset);
    }, { passive: false });
    shell.addEventListener('touchend', event => {
      if (!drag) return;
      if (drag.axis !== 'y') { drag = null;return; }
      const dy = event.changedTouches[0].clientY - drag.y;
      const flick = Math.abs(dy) > 40 && Math.abs(dy) / Math.max(1, Date.now() - drag.at) > 0.5;
      if (!drag.next) { const direction = drag.direction;release();if (Math.abs(dy) > 60) bounce(direction);return; }
      if (Math.sign(dy) === -drag.direction && (Math.abs(dy) > drag.height * 0.2 || flick)) {
        const { direction, peek } = drag;
        drag = null;
        go(direction, peek);
      } else release();
    }, { passive: true });
    shell.addEventListener('touchcancel', release, { passive: true });
    let wheel = 0, wheelTimer = null, wheelLock = 0;
    shell.addEventListener('wheel', event => {
      if (!onStage() || !swipeSurface(event.target) || Date.now() < wheelLock) return;
      wheel += event.deltaY;
      clearTimeout(wheelTimer);wheelTimer = setTimeout(() => { wheel = 0; }, 180);
      if (Math.abs(wheel) > 80) { const direction = wheel > 0 ? 1 : -1;wheel = 0;wheelLock = Date.now() + 900;go(direction); }
    }, { passive: true });
    document.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key) || !onStage()) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      go(event.key === 'ArrowDown' || event.key === 'PageDown' ? 1 : -1);
    });
    // The stage switches between lobby and stage views; keep the arrows in step with it.
    new MutationObserver(paintNav).observe(shell, { attributes: true, attributeFilter: ['data-view', 'hidden'] });
  }

  function receive(next) {
    records = Array.isArray(next) ? next : [];
    paintFeed();
    paintNav();
  }

  function initialize() {
    observeFeed();
    bindGestures();
    window.addEventListener('mw-live-discovery', event => receive(event.detail?.records));
    window.addEventListener('mw-live-host-ended', event => advanceAfterEnd(event.detail?.room_name));
    window.addEventListener('mw-language-change', () => { if (byId('feed')) byId('feed').dataset.mwLiveFeed = '';paintFeed();paintNav(); });
    receive(window.MilkyWayLive?.liveNow?.() || []);
    window.MilkyWayLiveFeed = { refresh: paintFeed, next: () => go(1), previous: () => go(-1) };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
