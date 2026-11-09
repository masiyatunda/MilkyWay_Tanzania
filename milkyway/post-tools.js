// Post tools: one-tap repost and a photo zoom viewer (pinch, double-tap, pan, reset) for post, comment and gallery photos.
(() => {
  const t = key => window.MilkyWayI18n?.t(key) || key;
  const social = '/api/milkyway-social';
  const node = (tag, props = {}, ...children) => { const element = Object.assign(document.createElement(tag), props); element.append(...children.filter(child => child != null)); return element; };

  /* ---------- Repost: one tap copies the post onto the signed-in user's own feed ---------- */
  const reposting = new Set(), reposted = new Set();
  const paintReposted = () => document.querySelectorAll('#feed [data-repost]').forEach(button => {
    const done = reposted.has(button.dataset.repost);
    button.classList.toggle('on', done);
    button.setAttribute('aria-pressed', String(done));
    button.title = t(done ? 'alreadyReposted' : 'repostPost');
  });
  async function repost(button) {
    if (!requireLogin('kurepost')) return;
    const postId = button.dataset.repost;
    if (button.dataset.authorId === user.id) { toast(t('repostOwn')); return; }
    if (reposted.has(postId)) { toast(t('alreadyReposted')); return; }
    if (reposting.has(postId)) return; // a second tap while the first is still saving does nothing
    reposting.add(postId);
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    try {
      const session = (await sb.auth.getSession()).data.session;
      if (!session) throw new Error(t('signInFirst'));
      const response = await fetch(`${social}?action=repost&id=${encodeURIComponent(postId)}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: sb.supabaseKey || '', 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) { reposted.add(postId); toast(t('alreadyReposted')); return; }
      if (!response.ok) throw new Error(window.MilkyWayI18n?.text(result.error || '') || result.error || t('retry'));
      reposted.add(postId);
      toast(`🔁 ${t('reposted')}`);
      mode = 'feed';
      loadFeed();
    } catch (error) {
      toast(error.name === 'TimeoutError' ? t('retry') : error.message || t('retry'));
    } finally {
      reposting.delete(postId);
      document.querySelectorAll(`#feed [data-repost="${CSS.escape(postId)}"]`).forEach(element => { element.disabled = false; element.removeAttribute('aria-busy'); });
      paintReposted();
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('#feed [data-repost]');
    if (!button) return;
    event.preventDefault();
    repost(button);
  });
  const feed = document.getElementById('feed');
  if (feed) new MutationObserver(paintReposted).observe(feed, { childList: true });
  sb.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') { reposted.clear(); paintReposted(); } });

  /* ---------- Photo zoom viewer ---------- */
  const zoomable = '#feed .post img.post-media,#feed .mw-post-gallery img,#feed .mw-comment-media img,#profilePosts img.post-media,#publicProfile img.post-media';
  const maxScale = 5, tapScale = 2.5;
  const viewer = node('div', { className: 'mw-zoom', hidden: true });
  viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-modal', 'true');
  const stage = node('div', { className: 'mw-zoom-stage' });
  const image = node('img', { alt: '', draggable: false, decoding: 'async' });
  stage.append(image);
  const reset = node('button', { type: 'button', className: 'mw-zoom-reset' }, node('span', { className: 'mw-zoom-icon', textContent: '⟲ ' }), node('span'));
  const close = node('button', { type: 'button', className: 'mw-zoom-close', textContent: '×' });
  const caption = node('p', { className: 'mw-zoom-caption' });
  const hint = node('p', { className: 'mw-zoom-hint' });
  viewer.append(stage, node('div', { className: 'mw-zoom-bar' }, reset, close), caption, hint);
  document.body.append(viewer);

  let scale = 1, x = 0, y = 0, opener = null, lockedOverflow = '';
  const paintLabels = () => {
    viewer.setAttribute('aria-label', t('zoomViewer'));
    reset.lastChild.textContent = t('zoomReset'); reset.setAttribute('aria-label', t('zoomReset'));
    close.setAttribute('aria-label', t('zoomClose')); close.title = t('zoomClose');
    hint.textContent = t('zoomHint');
  };
  const clamp = () => {
    scale = Math.min(maxScale, Math.max(1, scale));
    const box = stage.getBoundingClientRect();
    const limitX = Math.max(0, (image.offsetWidth * scale - box.width) / 2), limitY = Math.max(0, (image.offsetHeight * scale - box.height) / 2);
    x = Math.min(limitX, Math.max(-limitX, x)); y = Math.min(limitY, Math.max(-limitY, y));
    if (scale === 1) { x = 0; y = 0; }
  };
  const paint = (animate = false) => {
    viewer.classList.toggle('is-animating', animate);
    viewer.classList.toggle('is-zoomed', scale > 1.01);
    image.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    reset.hidden = scale <= 1.01;
  };
  // Zoom to `next` keeping the point (px, py) — measured from the stage centre — fixed under the finger.
  const zoomAt = (next, px, py, animate) => {
    const ratio = next / scale;
    x = px - (px - x) * ratio; y = py - (py - y) * ratio; scale = next;
    clamp(); paint(animate);
  };
  const centre = () => { const box = stage.getBoundingClientRect(); return { cx: box.left + box.width / 2, cy: box.top + box.height / 2 }; };
  const resetZoom = () => { scale = 1; x = 0; y = 0; paint(true); };
  reset.onclick = resetZoom;

  function open(src, text = '', from = null) {
    opener = document.activeElement;
    image.src = src; image.alt = text || '';
    caption.textContent = text || ''; caption.hidden = !text;
    paintLabels();
    scale = 1; x = 0; y = 0; paint();
    lockedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    viewer.hidden = false;
    hint.classList.remove('is-faded'); setTimeout(() => hint.classList.add('is-faded'), 2200);
    // Double-tap from the feed: open already zoomed in on the tapped spot.
    if (from) {
      const zoomIn = () => { scale = 1; x = 0; y = 0; zoomAt(tapScale, from.rx * image.offsetWidth, from.ry * image.offsetHeight, true); };
      if (image.complete && image.naturalWidth) requestAnimationFrame(zoomIn); else image.addEventListener('load', zoomIn, { once: true });
    }
    close.focus({ preventScroll: true });
  }
  function shut() {
    if (viewer.hidden) return;
    viewer.hidden = true; gesture = null;
    document.documentElement.style.overflow = lockedOverflow;
    image.removeAttribute('src');
    opener?.focus?.({ preventScroll: true });
  }
  close.onclick = shut;
  document.addEventListener('keydown', event => {
    if (viewer.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); shut(); }
    else if (event.key === '+' || event.key === '=') zoomAt(Math.min(maxScale, scale * 1.4), 0, 0, true);
    else if (event.key === '-') zoomAt(Math.max(1, scale / 1.4), 0, 0, true);
    else if (event.key === '0') resetZoom();
  }, true);

  /* Touch gestures. Listeners sit on the document so a pinch that starts on a feed photo carries on inside the viewer. */
  let gesture = null, lastTap = null;
  const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const midpoint = (a, b) => ({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
  function begin(touches) {
    const { cx, cy } = centre();
    if (touches.length >= 2) {
      const mid = midpoint(touches[0], touches[1]);
      gesture = { type: 'pinch', distance: distance(touches[0], touches[1]) || 1, px: mid.clientX - cx, py: mid.clientY - cy, scale, x, y };
    } else if (touches.length === 1) {
      gesture = { type: 'pan', sx: touches[0].clientX, sy: touches[0].clientY, x, y, moved: false, at: Date.now() };
    } else gesture = null;
  }
  const onBar = target => target instanceof Element && target.closest('.mw-zoom-bar');
  document.addEventListener('touchstart', event => {
    if (viewer.hidden) {
      // Two fingers on a feed or gallery photo: open the viewer and let the same pinch zoom it.
      const photo = event.touches.length === 2 && event.target instanceof Element && event.target.closest(zoomable);
      if (!photo) return;
      event.preventDefault();
      open(photo.currentSrc || photo.src, photo.alt || '');
      begin(event.touches);
      return;
    }
    if (onBar(event.target)) return;
    event.preventDefault();
    begin(event.touches);
  }, { passive: false, capture: true });
  document.addEventListener('touchmove', event => {
    if (viewer.hidden || !gesture) return;
    event.preventDefault();
    const { cx, cy } = centre();
    if (gesture.type === 'pinch' && event.touches.length >= 2) {
      const mid = midpoint(event.touches[0], event.touches[1]);
      const next = Math.min(maxScale, Math.max(0.85, gesture.scale * distance(event.touches[0], event.touches[1]) / gesture.distance));
      const ratio = next / gesture.scale;
      scale = next;
      x = (mid.clientX - cx) - (gesture.px - gesture.x) * ratio;
      y = (mid.clientY - cy) - (gesture.py - gesture.y) * ratio;
      paint();
    } else if (gesture.type === 'pan' && event.touches.length === 1) {
      const dx = event.touches[0].clientX - gesture.sx, dy = event.touches[0].clientY - gesture.sy;
      if (Math.abs(dx) + Math.abs(dy) > 8) gesture.moved = true;
      if (scale > 1.01) { x = gesture.x + dx; y = gesture.y + dy; clamp(); paint(); }
      else { image.style.transform = `translate3d(0,${Math.max(0, dy)}px,0)`; viewer.style.setProperty('--mw-zoom-fade', String(Math.max(0.35, 1 - Math.max(0, dy) / 400))); }
    }
  }, { passive: false, capture: true });
  const finish = event => {
    if (viewer.hidden || !gesture) return;
    const ended = gesture;
    if (event.touches.length) { if (scale < 1) { scale = 1; clamp(); paint(true); } begin(event.touches); return; }
    gesture = null;
    viewer.style.removeProperty('--mw-zoom-fade');
    if (ended.type === 'pan' && scale <= 1.01) {
      const dy = (event.changedTouches[0]?.clientY ?? ended.sy) - ended.sy;
      if (ended.moved && dy > 110) { shut(); return; } // swipe down to close at normal size
    }
    if (ended.type === 'pan' && !ended.moved && Date.now() - ended.at < 260 && !onBar(event.target)) {
      const point = event.changedTouches[0];
      if (lastTap && Date.now() - lastTap.at < 320 && Math.hypot(point.clientX - lastTap.x, point.clientY - lastTap.y) < 34) {
        lastTap = null;
        const { cx, cy } = centre();
        if (scale > 1.01) resetZoom(); else zoomAt(tapScale, point.clientX - cx, point.clientY - cy, true);
        return;
      }
      lastTap = { at: Date.now(), x: point.clientX, y: point.clientY };
    }
    clamp(); paint(true);
  };
  document.addEventListener('touchend', finish, { capture: true });
  document.addEventListener('touchcancel', finish, { capture: true });

  /* Mouse and trackpad: double-click toggles, the wheel zooms at the pointer, drag pans. */
  stage.addEventListener('dblclick', event => { const { cx, cy } = centre(); if (scale > 1.01) resetZoom(); else zoomAt(tapScale, event.clientX - cx, event.clientY - cy, true); });
  stage.addEventListener('wheel', event => { event.preventDefault(); const { cx, cy } = centre(); zoomAt(Math.min(maxScale, Math.max(1, scale * Math.exp(-event.deltaY / 300))), event.clientX - cx, event.clientY - cy, false); }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse' || scale <= 1.01) return; drag = { sx: event.clientX, sy: event.clientY, x, y }; stage.setPointerCapture(event.pointerId); });
  stage.addEventListener('pointermove', event => { if (!drag) return; x = drag.x + event.clientX - drag.sx; y = drag.y + event.clientY - drag.sy; clamp(); paint(); });
  stage.addEventListener('pointerup', () => { drag = null; });
  window.addEventListener('resize', () => { if (!viewer.hidden) { clamp(); paint(); } });

  /* Feed photos: a double tap (or double-click) opens the viewer zoomed in on that spot. One finger still scrolls the feed. */
  let feedTap = null, feedTouch = null;
  const openFrom = (photo, clientX, clientY) => {
    const box = photo.getBoundingClientRect();
    open(photo.currentSrc || photo.src, photo.alt || '', { rx: (clientX - box.left) / box.width - 0.5, ry: (clientY - box.top) / box.height - 0.5 });
  };
  document.addEventListener('touchstart', event => {
    const photo = viewer.hidden && event.touches.length === 1 && event.target instanceof Element && event.target.closest(zoomable);
    feedTouch = photo ? { photo, x: event.touches[0].clientX, y: event.touches[0].clientY, at: Date.now() } : null;
  }, { passive: true });
  document.addEventListener('touchend', event => {
    const start = feedTouch; feedTouch = null;
    if (!start || !viewer.hidden) return;
    const point = event.changedTouches[0];
    if (Date.now() - start.at > 260 || Math.hypot(point.clientX - start.x, point.clientY - start.y) > 12) { feedTap = null; return; }
    if (feedTap && feedTap.photo === start.photo && Date.now() - feedTap.at < 320 && Math.hypot(point.clientX - feedTap.x, point.clientY - feedTap.y) < 34) {
      feedTap = null;
      if (event.cancelable) event.preventDefault();
      openFrom(start.photo, point.clientX, point.clientY);
      return;
    }
    feedTap = { photo: start.photo, at: Date.now(), x: point.clientX, y: point.clientY };
  }, { passive: false });
  document.addEventListener('dblclick', event => {
    const photo = viewer.hidden && event.target instanceof Element && event.target.closest(zoomable);
    if (photo) { event.preventDefault(); openFrom(photo, event.clientX, event.clientY); }
  });
  window.addEventListener('mw-language-change', () => { if (!viewer.hidden) paintLabels(); });

  window.MilkyWayZoom = { open, close: shut, reset: resetZoom };
})();
