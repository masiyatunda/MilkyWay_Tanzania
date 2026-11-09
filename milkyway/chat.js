// MilkyWay Chat: WhatsApp-inspired conversation view (header, bubbles, menus, deletion, search, composer).
(() => {
  const byId = id => document.getElementById(id);
  const t = key => window.MilkyWayI18n?.t(key) || key;
  const sheet = byId('threadSheet'), list = byId('threadList'), input = byId('threadInput');
  const headMenu = byId('waMenu'), headMenuButton = byId('waMenuBtn'), msgMenu = byId('waMsgMenu');
  const dialogBg = byId('waDialog'), searchBar = byId('waSearchBar'), searchInput = byId('waSearchInput');
  if (!sheet || !list || !input) return;
  const svg = (body, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${body}</svg>`;
  const icons = {
    check: svg('<path d="m5 12.6 4 4L19 6.8"/>'),
    checks: svg('<path d="m2.6 12.8 4 4 9.4-9.6"/><path d="m11.6 16.5.4.3 9.4-9.6"/>'),
    chevron: svg('<path d="m7 10 5 5 5-5"/>'),
    group: svg('<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.6 14.6c1.8.7 3 2.3 3.4 4.9"/>'),
    file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>'),
  };
  const locale = () => (typeof mwLang === 'function' ? mwLang() : 'sw');
  const initial = name => esc(Array.from(String(name || '?').trim())[0] || '?');
  const avatarInner = (url, name) => url ? `<img src="${esc(window.MilkyWayMedia?.image(url, 160) || url)}" alt="" loading="lazy">` : initial(name);
  const time = iso => new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const dayKey = iso => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  function dayLabel(iso) {
    const d = new Date(iso), now = new Date(), yesterday = new Date(now);yesterday.setDate(now.getDate() - 1);
    if (dayKey(d) === dayKey(now)) return t('today');
    if (dayKey(d) === dayKey(yesterday)) return t('yesterday');
    return d.toLocaleDateString(locale(), { day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
  }
  function shortTime(iso) {
    const d = new Date(iso), now = new Date();
    if (dayKey(d) === dayKey(now)) return time(iso);
    if (now - d < 6 * 864e5) return d.toLocaleDateString(locale(), { weekday: 'short' });
    return d.toLocaleDateString(locale(), { day: 'numeric', month: 'numeric', year: '2-digit' });
  }
  const senderColor = id => { let h = 0;for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;return `hsl(${h} 70% 68%)`; };

  // ---- Header -------------------------------------------------------------
  const avatars = new Map();
  async function profileAvatar(id) {
    if (avatars.has(id)) return avatars.get(id);
    const pending = sb.from('mw_profiles').select('avatar_url').eq('id', id).maybeSingle().then(({ data }) => data?.avatar_url || null).catch(() => null);
    avatars.set(id, pending);return pending;
  }
  function setPeer({ kind, id, name, members }) {
    sheet.classList.toggle('wa-group', kind === 'group');
    sheet.dataset.peer = id;
    byId('threadTitle').textContent = name || t('chatsTitle');
    byId('waPeerStatus').textContent = kind === 'group' ? t('groupLabel') : '';
    const avatar = byId('waPeerAvatar');avatar.innerHTML = kind === 'group' ? icons.group : initial(name);
    input.placeholder = t('typeMessage');
    closeMenus();closeSearch();
    if (kind === 'group') {
      if (Number.isFinite(members)) byId('waPeerStatus').textContent = t('groupMembersCount').replace('{n}', members);
    } else {
      profileAvatar(id).then(url => { if (url && sheet.dataset.peer === id) avatar.innerHTML = avatarInner(url, name); });
    }
  }
  function setStatus(html) { byId('waPeerStatus').innerHTML = html; }

  // ---- Bubbles ------------------------------------------------------------
  function media(attachment) {
    if (!attachment?.url) return '';
    const url = esc(attachment.url), name = esc(attachment.name || 'File'), type = attachment.type || '';
    if (type.startsWith('image/')) return `<a class="wa-media" href="${url}" target="_blank" rel="noopener"><img src="${esc(window.MilkyWayMedia?.image(attachment.url, 480) || attachment.url)}" alt="${name}" loading="lazy" decoding="async"></a>`;
    if (type.startsWith('video/')) return `<div class="wa-media"><video src="${url}" controls playsinline preload="metadata"></video></div>`;
    if (type.startsWith('audio/')) return `<div class="wa-media"><audio src="${url}" controls preload="metadata"></audio></div>`;
    return `<a class="wa-file" href="${url}" target="_blank" rel="noopener" download="${name}">${icons.file}<span data-mw-user-content>${name}</span></a>`;
  }
  function bubble({ id, own, at, text = '', attachment = null, edited = false, read = false, editable = false, legacy = false, senderId = '', senderName = '' }) {
    const ticks = own ? `<span class="${read ? 'wa-read' : ''}" title="${esc(t(read ? 'read' : 'sent'))}" aria-label="${esc(t(read ? 'read' : 'sent'))}">${read ? icons.checks : icons.check}</span>` : '';
    const meta = `${edited ? `<span>${esc(t('edited'))}</span> ` : ''}<time datetime="${esc(at)}">${time(at)}</time>${ticks}`;
    return `<div class="wa-msg" data-message-id="${esc(id)}" data-own="${own}" data-at="${esc(at)}" data-sender="${esc(senderId)}" data-editable="${editable}">`
      + (senderName && !own ? `<span class="wa-sender" style="color:${senderColor(senderId)}" data-mw-user-content>${esc(senderName)}</span>` : '')
      + (legacy ? `<span class="wa-tag">${esc(t('olderEncrypted'))}</span>` : '')
      + media(attachment)
      + `<div class="wa-msg-text"><span class="wa-body" data-mw-user-content>${esc(text)}</span><span class="wa-meta-spacer" aria-hidden="true">${meta}</span><span class="wa-meta">${meta}</span></div>`
      + `<button type="button" class="wa-msg-more" data-wa-more aria-haspopup="menu" aria-label="${esc(t('messageActions'))}">${icons.chevron}</button></div>`;
  }
  // Day chips, tails on the first bubble of each run, sender names only once per run.
  function decorate() {
    list.querySelectorAll('.wa-day').forEach(chip => chip.remove());
    let previous = null;
    for (const item of [...list.querySelectorAll('.wa-msg')]) {
      const day = dayKey(item.dataset.at);
      const newDay = !previous || dayKey(previous.dataset.at) !== day;
      if (newDay) item.insertAdjacentHTML('beforebegin', `<div class="wa-day"><span>${esc(dayLabel(item.dataset.at))}</span></div>`);
      const first = newDay || previous.dataset.sender !== item.dataset.sender || previous.dataset.own !== item.dataset.own;
      item.classList.toggle('wa-first', first);
      const sender = item.querySelector('.wa-sender');if (sender) sender.hidden = !first;
      previous = item;
    }
    if (!list.querySelector('.wa-msg') && !list.querySelector('.wa-empty,.wa-note')) list.insertAdjacentHTML('beforeend', `<div class="wa-empty">${esc(t('noChatMessages'))}</div>`);
    if (searchInput?.value) runSearch();
  }
  function empty() { return `<div class="wa-empty">${esc(t('noChatMessages'))}</div>`; }
  function note(text) { return `<p class="wa-note">${esc(text)}</p>`; }

  // ---- Menus --------------------------------------------------------------
  let menuTarget = null;
  function closeMenus() {
    headMenu.hidden = true;headMenuButton.setAttribute('aria-expanded', 'false');
    msgMenu.hidden = true;menuTarget?.classList.remove('wa-menu-open');menuTarget = null;
  }
  headMenuButton.addEventListener('click', event => {
    event.stopPropagation();
    const opening = headMenu.hidden;closeMenus();
    if (opening) { headMenu.hidden = false;headMenuButton.setAttribute('aria-expanded', 'true');headMenu.querySelector('button:not([hidden])')?.focus(); }
  });
  function openMessageMenu(item, x, y) {
    closeMenus();
    menuTarget = item;item.classList.add('wa-menu-open');
    const own = item.dataset.own === 'true', text = item.querySelector('.wa-body')?.textContent || '';
    msgMenu.querySelector('[data-wa-msg="copy"]').hidden = !text;
    msgMenu.querySelector('[data-wa-msg="edit"]').hidden = !(own && item.dataset.editable === 'true' && window.MilkyWayPremium?.editingAvailable !== false);
    msgMenu.hidden = false;
    const width = msgMenu.offsetWidth, height = msgMenu.offsetHeight, margin = 8;
    const rect = item.getBoundingClientRect();
    let left = x ?? (own ? rect.right - width : rect.left), top = y ?? rect.top + 28;
    left = Math.max(margin, Math.min(left, innerWidth - width - margin));
    if (top + height > innerHeight - margin) top = Math.max(margin, (y ?? rect.top) - height);
    msgMenu.style.left = `${left}px`;msgMenu.style.top = `${top}px`;
    msgMenu.querySelector('button:not([hidden])')?.focus({ preventScroll: true });
  }
  list.addEventListener('click', event => {
    const more = event.target.closest('[data-wa-more]');
    if (!more) return;
    event.stopPropagation();
    const item = more.closest('.wa-msg');
    if (menuTarget === item) closeMenus();else openMessageMenu(item);
  });
  list.addEventListener('contextmenu', event => {
    const item = event.target.closest('.wa-msg');
    if (!item || event.target.closest('a,video,audio')) return;
    event.preventDefault();openMessageMenu(item, event.clientX, event.clientY);
  });
  // Touch long-press opens the same menu (iOS never fires contextmenu); a quick drag or lift cancels it.
  let pressTimer = null, pressX = 0, pressY = 0, pressOpenedAt = 0;
  const cancelPress = () => { clearTimeout(pressTimer);pressTimer = null; };
  list.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    const item = event.target.closest('.wa-msg');
    if (!item || event.target.closest('a,video,audio,button')) return;
    pressX = event.clientX;pressY = event.clientY;cancelPress();
    pressTimer = setTimeout(() => { pressTimer = null;pressOpenedAt = Date.now();openMessageMenu(item, pressX, pressY);navigator.vibrate?.(15); }, 500);
  });
  list.addEventListener('pointermove', event => { if (pressTimer && Math.hypot(event.clientX - pressX, event.clientY - pressY) > 10) cancelPress(); });
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) list.addEventListener(name, cancelPress);
  list.addEventListener('contextmenu', event => { if (Date.now() - pressOpenedAt < 900) event.preventDefault(); }, true);
  list.addEventListener('scroll', () => { cancelPress();if (!msgMenu.hidden) closeMenus(); }, { passive: true });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.wa-menu,#waMenuBtn,[data-wa-more]')) closeMenus(); });
  addEventListener('resize', () => closeMenus());
  sheet.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!dialogBg.hidden) return;
    if (!headMenu.hidden || !msgMenu.hidden) { event.stopPropagation();closeMenus();headMenuButton.focus(); }
    else if (!searchBar.hidden) { event.stopPropagation();closeSearch(); }
  });
  for (const menu of [headMenu, msgMenu]) menu.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const items = [...menu.querySelectorAll('button:not([hidden])')], index = items.indexOf(document.activeElement);
    items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  });

  // ---- Dialog -------------------------------------------------------------
  let dialogResolve = null;
  function ask({ title, note: text, actions }) {
    dialogResolve?.('cancel');
    byId('waDialogTitle').textContent = title;byId('waDialogNote').textContent = text || '';
    const box = byId('waDialogActions');box.replaceChildren();
    for (const action of actions) {
      const button = document.createElement('button');button.type = 'button';button.textContent = action.label;button.dataset.key = action.key;
      if (action.danger) button.className = 'wa-danger';
      button.onclick = () => finish(action.key);box.append(button);
    }
    dialogBg.hidden = false;box.querySelector('button')?.focus();
    return new Promise(resolve => { dialogResolve = resolve; });
  }
  function finish(key) { dialogBg.hidden = true;const resolve = dialogResolve;dialogResolve = null;resolve?.(key); }
  dialogBg.addEventListener('click', event => { if (event.target === dialogBg) finish('cancel'); });
  dialogBg.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation();finish('cancel'); }
    if (event.key === 'Tab') {
      const buttons = [...dialogBg.querySelectorAll('button')], first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault();last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault();first.focus(); }
    }
  });

  // ---- Deleting -----------------------------------------------------------
  const currentTitle = () => byId('threadTitle').textContent.trim();
  async function reload() {
    if (activeGroupId) await loadGroupMessages();
    else if (threadWith) await openThread(threadWith, currentTitle());
  }
  const hide = (ids, group) => window.MilkyWayPremium.messageRequest('?action=hide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, group: group || undefined }) });
  async function deleteMessage(item) {
    const id = item.dataset.messageId, own = item.dataset.own === 'true', group = activeGroupId;
    const choice = await ask({
      title: t('deleteMessageTitle'),
      note: t(own ? 'deleteOwnNote' : 'deleteOtherNote'),
      actions: own
        ? [{ key: 'everyone', label: t('deleteForEveryone'), danger: true }, { key: 'me', label: t('deleteForMe') }, { key: 'cancel', label: t('cancel') }]
        : [{ key: 'me', label: t('deleteForMe'), danger: true }, { key: 'cancel', label: t('cancel') }],
    });
    if (choice === 'cancel') return;
    try {
      if (choice === 'everyone') {
        try { await window.MilkyWayPremium.messageRequest(`?action=message&id=${encodeURIComponent(id)}${group ? `&group=${encodeURIComponent(group)}` : ''}`, { method: 'DELETE' }); }
        catch (error) {
          if (group) throw error;
          // The gateway route is unavailable: delete the row directly; row-level security still limits it to the sender.
          const { data, error: failure } = await sb.from('mw_messages').delete().eq('id', id).select('id');
          if (failure || !data?.length) throw error;
        }
      }
      else await hide([id], group);
      item.remove();decorate();toast(t('messageDeleted'));
      await reload();
    } catch (error) { toast(error.message || t('retry')); }
  }
  async function clearChat() {
    const choice = await ask({ title: t('clearChatTitle'), note: t('clearChatNote'), actions: [{ key: 'clear', label: t('clearChat'), danger: true }, { key: 'cancel', label: t('cancel') }] });
    if (choice !== 'clear') return;
    const group = activeGroupId, peer = threadWith;
    try {
      while (true) {
        if (group !== activeGroupId || peer !== threadWith) return;
        const { messages } = await window.MilkyWayPremium.messageRequest(group ? `?group=${encodeURIComponent(group)}` : `?peer=${encodeURIComponent(peer)}`);
        const ids = (messages || []).map(message => message.id);
        if (!ids.length) break;
        await hide(ids, group);
      }
      toast(t('chatCleared'));await reload();
    } catch (error) { toast(error.message || t('retry')); }
  }
  msgMenu.addEventListener('click', async event => {
    const action = event.target.closest('[data-wa-msg]')?.dataset.waMsg, item = menuTarget;
    if (!action || !item) return;
    closeMenus();
    const text = item.querySelector('.wa-body')?.textContent || '';
    if (action === 'copy') { try { await navigator.clipboard.writeText(text);toast(t('messageCopied')); } catch { toast(t('retry')); } }
    if (action === 'edit') window.MilkyWayPremium?.editMessage(item.dataset.messageId, text);
    if (action === 'delete') deleteMessage(item);
  });

  // ---- Header menu actions -----------------------------------------------
  function closeThread() { closeMenus();closeSearch();closeSheet('threadSheet');threadWith = null;activeGroupId = null;delete sheet.dataset.peer; }
  function viewContact() { const peer = threadWith;if (!peer) return;closeThread();openPublicProfile(peer); }
  headMenu.addEventListener('click', event => {
    const action = event.target.closest('[data-wa-action]')?.dataset.waAction;
    if (!action) return;
    closeMenus();
    if (action === 'contact') viewContact();
    if (action === 'search') openSearch();
    if (action === 'member' && activeGroupId) inviteGroupMember(activeGroupId);
    if (action === 'group-info' && activeGroupId) window.MilkyWayGroups?.open(activeGroupId);
    if (action === 'clear') clearChat();
    if (action === 'close') closeThread();
  });
  byId('waPeerBtn').addEventListener('click', () => { if (activeGroupId) window.MilkyWayGroups?.open(activeGroupId);else viewContact(); });

  // ---- Search -------------------------------------------------------------
  function openSearch() { searchBar.hidden = false;searchInput.focus(); }
  function closeSearch() { if (!searchBar) return;searchBar.hidden = true;searchInput.value = '';runSearch(); }
  function runSearch() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    list.classList.toggle('wa-searching', !!query);
    list.querySelectorAll('.wa-msg').forEach(item => item.classList.toggle('wa-match', !!query && (item.querySelector('.wa-body')?.textContent || '').toLocaleLowerCase().includes(query)));
    if (query) [...list.querySelectorAll('.wa-match')].at(-1)?.scrollIntoView({ block: 'nearest' });
  }
  searchInput.addEventListener('input', runSearch);
  byId('waSearchClose').addEventListener('click', closeSearch);

  // ---- Composer -----------------------------------------------------------
  function autosize() { input.style.height = 'auto';input.style.height = `${Math.min(Math.max(input.scrollHeight, 40), 140)}px`; }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !event.ctrlKey && !event.metaKey && matchMedia('(hover:hover) and (pointer:fine)').matches) { event.preventDefault();byId('threadSend').click(); }
  });

  // ---- Inbox rows ---------------------------------------------------------
  function chatRow({ id, name, avatar, preview, at, unread = 0, own = false, read = false, online = false }) {
    const tick = own ? `<span class="${read ? 'wa-read' : ''}">${read ? icons.checks : icons.check}</span>` : '';
    return `<button type="button" class="wa-chat-row dm-inbox-row${unread ? ' wa-has-unread' : ''}" data-open="${esc(id)}" data-name="${esc(name)}"><span class="wa-avatar" data-online="${online}">${avatarInner(avatar, name)}</span><span class="wa-row-main"><span class="wa-row-top dm-peer-top"><span class="wa-row-name dm-peer-name" data-mw-user-content>${esc(name)}</span>${at ? `<time class="wa-row-time" datetime="${esc(at)}">${esc(shortTime(at))}</time>` : ''}</span><span class="wa-row-bottom"><span class="wa-row-preview">${tick}<span data-mw-user-content>${esc(preview)}</span></span>${unread ? `<span class="wa-unread">${unread > 99 ? '99+' : unread}</span>` : ''}</span></span></button>`;
  }
  function groupRow({ id, name, caption = '', admin = false }) {
    return `<button type="button" class="wa-chat-row" data-group-open="${esc(id)}"><span class="wa-avatar">${icons.group}</span><span class="wa-row-main"><span class="wa-row-top"><span class="wa-row-name" data-mw-user-content>${esc(name)}</span>${admin ? `<span class="wa-row-badge">${esc(t('groupAdminLabel'))}</span>` : ''}</span><span class="wa-row-bottom"><span class="wa-row-preview">${caption ? `<span data-mw-user-content>${esc(caption)}</span>` : `<span>${esc(t('groupLabel'))}</span>`}</span></span></span></button>`;
  }

  // ---- Labels -------------------------------------------------------------
  function applyLabels() {
    for (const element of document.querySelectorAll('#threadSheet [data-mw-i18n-aria],#msgSheet [data-mw-i18n-aria]')) if (element.hasAttribute('title')) element.title = t(element.dataset.mwI18nAria);
    input.placeholder = t('typeMessage');
    if (searchInput) searchInput.placeholder = t('chatSearch');
    const people = byId('dmPeopleSearch');if (people) { people.placeholder = t('searchChats');people.setAttribute('aria-label', t('searchChats')); }
  }
  addEventListener('mw-language-change', applyLabels);applyLabels();

  window.MilkyWayChat = {
    setPeer, setStatus, bubble, decorate, empty, note, autosize, chatRow, groupRow, closeThread,
    busy: () => !headMenu.hidden || !msgMenu.hidden || !dialogBg.hidden,
  };
})();
