(() => {
  const byId = id => document.getElementById(id);
  const translate = key => window.MilkyWayI18n.t(key);
  let draftPeer = null;
  let pendingMessage = null;
  let editingMessage = null;
  let editingGroup = null;
  let avatarSource = null;
  let avatarObjectUrl = null;
  let savingAvatar = false;
  let avatarCleanupPending = false;
  const viewedStories = new Set();
  let storyRequest = false;
  const endpoint = '/api/milkyway-account';
  async function authorization(expectedAccount = user?.id) {
    const session = (await sb.auth.getSession()).data.session;
    if (!session || session.user.id !== expectedAccount || user?.id !== expectedAccount) throw new Error(translate('signInFirst'));
    return `Bearer ${session.access_token}`;
  }
  async function request(path, options = {}, publicRequest = false) {
    const actor = user?.id;
    const response = await fetch(path, { ...options, headers: { ...options.headers, ...(!publicRequest ? { Authorization: await authorization(actor), apikey: sb.supabaseKey || '' } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!publicRequest && user?.id !== actor) throw new Error(translate('accountChanged'));
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(window.MilkyWayI18n.text(result.error || translate('retry')));
    }
    return response.status === 204 ? null : response.json();
  }
  const accountRequest = (action, options) => request(`${endpoint}?action=${action}`, options);
  const messageRequest = (query, options) => request(`/api/milkyway-message${query}`, options);
  const groupRequest = (action, body, query = '') => request(`/api/milkyway-groups?action=${action}${query}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  function paintStories() {
    byId('stories').querySelectorAll('[data-story-id]').forEach(tile => {
      const viewed = viewedStories.has(tile.dataset.storyId);tile.dataset.viewed = String(viewed);
      let badge = tile.querySelector('.mw-story-state');
      if (!badge) { badge = document.createElement('span');badge.className = 'mw-story-state';tile.append(badge); }
      badge.dataset.mwI18n = viewed ? 'viewedStory' : 'newStory';badge.textContent = translate(badge.dataset.mwI18n);
      tile.setAttribute('role', 'button');tile.tabIndex = 0;tile.onkeydown = event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault();tile.click(); } };
    });
  }
  async function storyStates() {
    if (!logged() || storyRequest) { paintStories();return; }
    storyRequest = true;
    try { const { viewed } = await accountRequest('stories');viewed.forEach(item => viewedStories.add(item.storyId));paintStories(); }
    catch { paintStories(); }
    finally { storyRequest = false; }
  }
  async function markStoryViewed(id) {
    if (!logged() || viewedStories.has(id)) return;
    try { await accountRequest('stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });viewedStories.add(id);paintStories(); } catch {}
  }
  function sheet(id, title, content) {
    const element = document.createElement('div');
    element.id = id;
    element.className = 'sheet-bg mw-premium-sheet';
    element.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="${id}Title"><button type="button" class="close" aria-label="Close">×</button><h2 id="${id}Title" data-mw-i18n="${title}"></h2>${content}</section>`;
    document.body.append(element);
    element.querySelector('.close').onclick = () => closeSheet(id);
    element.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeSheet(id);
      if (event.key !== 'Tab') return;
      const focusable = [...element.querySelectorAll('button,input,textarea,select,a[href]')].filter(item => item.getClientRects().length && !item.disabled);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    return element;
  }
  function draftKey(peer) { return `mw-draft:${user?.id || 'guest'}:${peer}`; }
  function switchDraft(peer) {
    if (draftPeer === peer) return;
    if (draftPeer) sessionStorage.setItem(draftKey(draftPeer), byId('threadInput').value);
    draftPeer = peer;
    byId('threadInput').value = sessionStorage.getItem(draftKey(peer)) || '';
  }
  function clearDraft(peer) { sessionStorage.removeItem(draftKey(peer)); }
  function acknowledgeMessage(body, peer, account, sentDraft) {
    if (pendingMessage?.body === body && pendingMessage.peer === peer && pendingMessage.account === account) pendingMessage = null;
    if (sentDraft.trim() !== body) return;
    const key = `mw-draft:${account}:${peer}`;
    if (user?.id === account && draftPeer === peer) {
      if (byId('threadInput').value !== sentDraft) return;
      byId('threadInput').value = '';sessionStorage.removeItem(key);
    } else if (sessionStorage.getItem(key) === sentDraft) sessionStorage.removeItem(key);
  }
  byId('threadInput').addEventListener('input', () => { if (draftPeer) sessionStorage.setItem(draftKey(draftPeer), byId('threadInput').value); });
  byId('threadInput').addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); byId('threadSend').click(); }
  });
  function messageId(body, peer) {
    if (!pendingMessage || pendingMessage.body !== body || pendingMessage.peer !== peer || pendingMessage.account !== user.id) pendingMessage = { body, peer, account: user.id, id: crypto.randomUUID() };
    return pendingMessage.id;
  }
  const editSheet = sheet('mwEditMessage', 'edit', '<form id="mwEditMessageForm"><textarea id="mwEditMessageText" maxlength="1000" rows="5" required></textarea><button class="btn primary" data-mw-i18n="save"></button><p id="mwEditMessageStatus" role="status"></p></form>');
  function editMessage(id, text) {
    editingMessage = id;
    editingGroup = activeGroupId;
    byId('mwEditMessageText').value = text || '';
    byId('mwEditMessageStatus').textContent = '';
    openSheet(editSheet.id);
    byId('mwEditMessageText').focus();
  }
  function bindMessages() {
    byId('threadList').querySelectorAll('[data-edit-message]').forEach(button => {
      button.onclick = () => editMessage(button.dataset.editMessage, button.closest('.wa-msg')?.querySelector('.wa-body')?.textContent);
    });
  }
  byId('mwEditMessageForm').onsubmit = async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    if (button.disabled) return;
    button.disabled = true;
    try {
      await messageRequest('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingMessage, group: editingGroup || undefined, message: byId('mwEditMessageText').value.trim() }) });
      closeSheet(editSheet.id);
      toast(translate('saved'));
      if (threadWith) await openThread(threadWith, byId('threadTitle').textContent.trim());
      else if (activeGroupId) await loadGroupMessages();
    } catch (error) { byId('mwEditMessageStatus').textContent = error.message; }
    finally { button.disabled = false; }
  };
  const language = byId('langSel');
  language.innerHTML = '<option value="sw">Kiswahili</option><option value="en">English</option><option value="fr">Français</option><option value="zh">中文</option><option value="ar">العربية</option><option value="pt">Português</option><option value="hi">हिन्दी</option><option value="de">Deutsch</option>';
  language.dataset.mwI18nAria = 'language';
  // The header language control wraps the app's one language select and is placed at the end of the toolbar, where it stays.
  const headerLanguage = document.createElement('label');headerLanguage.className = 'mw-header-language';
  headerLanguage.append(language);
  document.querySelector('.top-actions').append(headerLanguage);
  const liveLanguage = document.createElement('label');liveLanguage.className = 'mw-header-language';
  liveLanguage.innerHTML = '<span data-mw-i18n="language"></span><select id="mwLiveLanguage" data-mw-i18n-aria="language"></select>';
  byId('mwLiveSettings').append(liveLanguage);
  byId('mwLiveLanguage').innerHTML = language.innerHTML;
  byId('mwLiveLanguage').onchange = event => { language.value = event.target.value;language.dispatchEvent(new Event('change', { bubbles: true })); };
  const authLogo = document.createElement('img');authLogo.className = 'mw-auth-logo';authLogo.src = window.MilkyWayMedia?.asset('brand/milkyway-logo-web.png', 276, 276) || 'brand/milkyway-logo-web.png';authLogo.decoding = 'async';authLogo.alt = 'MilkyWay — Freedom. Truth. Light.';authLogo.width = 276;authLogo.height = 360;byId('authModal').querySelector('.sheet').prepend(authLogo);
  const signedOutLanguage = document.createElement('label');
  signedOutLanguage.innerHTML = '<span data-mw-i18n="language"></span><select id="mwAuthLanguage"></select>';
  byId('authModal').querySelector('.sheet').append(signedOutLanguage);
  byId('mwAuthLanguage').innerHTML = language.innerHTML;
  byId('mwAuthLanguage').onchange = event => { language.value = event.target.value; language.dispatchEvent(new Event('change', { bubbles: true })); };
  const originalOpenAuth = openAuth;
  openAuth = (...args) => { originalOpenAuth(...args);signedOutLanguage.hidden = logged(); };
  byId('accountTopBtn').onclick = () => openAuth('login');
  for (const id of ['logoutBtn', 'newAccountBtn']) {
    const button = byId(id), signOut = button.onclick;
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      let cleanupError = null;
      try { const result = await window.MilkyWayLive?.disconnect();if (result?.clean === false) cleanupError = new Error(result.error || translate('retry')); } catch (error) { cleanupError = error; }
      try { await signOut();if (cleanupError) toast(cleanupError.message); }
      finally { button.disabled = false; }
    };
  }
  const settingsLanguage = document.createElement('label');
  settingsLanguage.className = 'setting-row';
  settingsLanguage.innerHTML = '<span data-mw-i18n="language"></span><select id="mwSettingsLanguage" data-mw-i18n-aria="language"></select>';
  byId('settingsSheet').querySelector('.sheet').append(settingsLanguage);
  byId('mwSettingsLanguage').innerHTML = language.innerHTML;
  byId('mwSettingsLanguage').onchange = event => { language.value = event.target.value;language.dispatchEvent(new Event('change', { bubbles: true })); };
  const appearance = document.createElement('label');appearance.className = 'setting-row';
  appearance.innerHTML = '<span data-mw-i18n="appearance"></span><select id="mwAppearance" data-mw-i18n-aria="appearance">' + window.MilkyWayTheme.options + '</select>';
  settingsLanguage.after(appearance);
  // The shared theme script saves and applies the choice for every theme selector, so this one only syncs its value.
  window.MilkyWayTheme.apply();
  // These triggers stay detached: the My Account panel opens their sheets through them.
  const fileButton = document.createElement('button');
  fileButton.type = 'button';fileButton.className = 'btn ghost';fileButton.dataset.mwI18n = 'myFiles';
  const blockedButton = document.createElement('button');
  blockedButton.type = 'button';blockedButton.className = 'btn ghost';blockedButton.dataset.mwI18n = 'blockedAccounts';
  const filesSheet = sheet('mwFilesSheet', 'myFiles', '<p class="muted" data-mw-i18n="fileManagementHelp"></p><div id="mwManagedFiles" role="status"></div>');
  async function loadFiles() {
    byId('mwManagedFiles').textContent = translate('loading');
    try {
      const accountId = user.id;
      const { files } = await accountRequest('files');
      if (user?.id !== accountId) return;
      byId('mwManagedFiles').replaceChildren();
      if (!files.length) byId('mwManagedFiles').textContent = translate('noFiles');
      for (const file of files) {
        const row = document.createElement('div');row.className = 'mw-file-row';
        const title = document.createElement('span');title.textContent = `${file.name} · ${file.purpose === 'avatar' ? translate('profilePhoto') : translate('messages')}`;
        const remove = document.createElement('button');remove.className = 'btn danger';remove.type = 'button';remove.textContent = translate('delete');remove.disabled = file.retained;
        remove.onclick = async () => {
          if (!(await window.MilkyWayDialog.confirm({ message: translate('confirmDeleteFile'), danger: true }))) return;
          remove.disabled = true;
          try { await accountRequest(`file&key=${encodeURIComponent(file.key)}`, { method: 'DELETE' });await refreshAvatar();await updateAccountCard();await loadFiles();toast(translate('deleted')); }
          catch (error) { toast(error.message);remove.disabled = false; }
        };
        row.append(title, remove);byId('mwManagedFiles').append(row);
      }
    } catch (error) { byId('mwManagedFiles').textContent = error.message;const retry = document.createElement('button');retry.className = 'btn';retry.textContent = translate('retry');retry.onclick = loadFiles;byId('mwManagedFiles').append(retry); }
  }
  fileButton.onclick = () => { openSheet(filesSheet.id);loadFiles(); };
  const blockedSheet = sheet('mwBlockedSheet', 'blockedAccounts', '<div id="mwBlockedAccounts" role="status"></div>');
  async function loadBlocked() {
    const list = byId('mwBlockedAccounts');list.textContent = translate('loading');
    const accountId = user.id;
    const { data, error } = await sb.from('mw_blocks').select('blocked_id').eq('blocker_id', accountId);
    if (user?.id !== accountId) return;
    if (error) { list.textContent = error.message;return; }
    list.replaceChildren();
    if (!data.length) list.textContent = translate('noBlockedAccounts');
    for (const block of data) {
      const profile = await getProfile(block.blocked_id);
      if (user?.id !== accountId) return;
      const row = document.createElement('div');row.className = 'mw-file-row';
      const title = document.createElement('span');title.textContent = profile?.display_name || profile?.username || translate('account');
      const unblock = document.createElement('button');unblock.type = 'button';unblock.className = 'btn';unblock.textContent = translate('unblock');
      unblock.onclick = async () => { if (user?.id !== accountId || !(await window.MilkyWayDialog.confirm({ message: translate('confirmUnblock') }))) return;unblock.disabled = true;const result = await sb.from('mw_blocks').delete().eq('blocker_id', accountId).eq('blocked_id', block.blocked_id).select('blocked_id');if (result.error || !result.data?.length) { toast(result.error?.message || translate('permissionDenied'));unblock.disabled = false; } else { loadBlocked();loadFeed(); } };
      row.append(title, unblock);list.append(row);
    }
  }
  blockedButton.onclick = () => { openSheet(blockedSheet.id);loadBlocked(); };
  const photoSheet = sheet('mwPhotoSheet', 'profilePhoto', '<div class="mw-avatar-preview"><img id="mwPhotoPreview" alt="Photo preview"><label><span data-mw-i18n="zoom"></span><input id="mwPhotoZoom" type="range" min="1" max="3" value="1" step=".05"></label><label><span data-mw-i18n="horizontalPosition"></span><input id="mwPhotoX" type="range" min="0" max="100" value="50"></label><label><span data-mw-i18n="verticalPosition"></span><input id="mwPhotoY" type="range" min="0" max="100" value="50"></label><button type="button" class="btn primary" id="mwSavePhoto" data-mw-i18n="savePhoto"></button><button type="button" class="btn danger" id="mwRemovePhoto" data-mw-i18n="removePhoto"></button><p id="mwPhotoStatus" role="status"></p></div>');
  for (const id of ['myAvatar', 'accountAvatar'].filter(byId)) {
    const avatar = byId(id);avatar.classList.add('mw-avatar-button');avatar.setAttribute('role', 'button');avatar.tabIndex = 0;avatar.dataset.mwI18nAria = 'choosePhoto';
    const choose = () => { if (requireLogin('')) byId('avatarFile').click(); };
    avatar.onclick = choose;
    avatar.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault();choose(); } };
  }
  const removePhoto = document.createElement('button');removePhoto.type = 'button';removePhoto.className = 'btn danger';removePhoto.dataset.mwI18n = 'removePhoto';removePhoto.onclick = () => { avatarSource = null;byId('mwPhotoPreview').removeAttribute('src');byId('mwSavePhoto').hidden = true;byId('mwPhotoStatus').textContent = '';openSheet(photoSheet.id); };
  byId('avatarChooseBtn').parentElement.append(removePhoto);
  async function previewPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return toast(translate('choosePhoto'));
    if (file.size > 10 * 1024 * 1024) return toast(translate('photoTooLarge'));
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = URL.createObjectURL(file);
    const image = new Image();image.src = avatarObjectUrl;
    try { await image.decode(); } catch { return toast(translate('photoUnsupported')); }
    if (image.width * image.height > 40000000) return toast(translate('photoTooLarge'));
    avatarSource = image;byId('mwPhotoPreview').src = avatarObjectUrl;byId('mwPhotoZoom').value = '1';byId('mwPhotoX').value = byId('mwPhotoY').value = '50';byId('mwSavePhoto').hidden = false;byId('mwPhotoStatus').textContent = '';openSheet(photoSheet.id);
  }
  byId('avatarFile').addEventListener('change', event => previewPhoto(event.target.files?.[0]));
  for (const id of ['avatarCameraInput', 'avatarSelfieInput']) byId(id).addEventListener('change', event => previewPhoto(event.target.files?.[0]));
  for (const id of ['mwPhotoZoom', 'mwPhotoX', 'mwPhotoY']) byId(id).oninput = () => {
    if (!avatarSource) return;
    const crop = croppedCanvas();byId('mwPhotoPreview').src = crop.toDataURL('image/jpeg', .8);
  };
  function croppedCanvas() {
    const canvas = document.createElement('canvas');canvas.width = canvas.height = 512;
    const side = Math.min(avatarSource.width, avatarSource.height) / Number(byId('mwPhotoZoom').value);
    const offsetX = (avatarSource.width - side) * Number(byId('mwPhotoX').value) / 100;
    const offsetY = (avatarSource.height - side) * Number(byId('mwPhotoY').value) / 100;
    const context = canvas.getContext('2d');context.fillStyle = '#fff';context.fillRect(0, 0, 512, 512);context.drawImage(avatarSource, offsetX, offsetY, side, side, 0, 0, 512, 512);
    return canvas;
  }
  async function saveAvatar(file) {
    // Persist the avatar in Supabase Storage, then verify the database write.
    // This avoids relying on a server-only endpoint.
    const accountId = user?.id;
    if (!accountId) throw new Error(translate('signInFirst'));
    if (!(file instanceof File) || !file.size || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error(translate('photoUnsupported'));
    }
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `avatars/${accountId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await sb.storage.from('portfolio').upload(path, file, {
      contentType: file.type, cacheControl: '3600', upsert: false
    });
    if (uploadError) throw new Error(`Picha haikupakiwa kwenye hifadhi: ${uploadError.message || 'Jaribu tena.'}`);
    const { data: publicData } = sb.storage.from('portfolio').getPublicUrl(path);
    const avatarUrl = publicData?.publicUrl;
    if (!avatarUrl || !/^https:\/\//i.test(avatarUrl)) {
      await sb.storage.from('portfolio').remove([path]).catch(() => {});
      throw new Error('Supabase haikutoa anwani halali ya picha.');
    }
    const { data: savedProfile, error: profileError } = await sb.from('mw_profiles')
      .update({ avatar_url: avatarUrl }).eq('id', accountId).select('id,avatar_url').maybeSingle();
    if (profileError || !savedProfile || savedProfile.id !== accountId || savedProfile.avatar_url !== avatarUrl) {
      await sb.storage.from('portfolio').remove([path]).catch(() => {});
      throw new Error(`Picha imepakiwa lakini haikuhifadhiwa kwenye profile: ${profileError?.message || 'Rekodi ya profile haikuthibitishwa.'}`);
    }
    avatarCleanupPending = false;
    window._mwCachedProfile = { ...(window._mwCachedProfile || {}), ...savedProfile };
    try { saveLocalAccount(user, window._mwCachedProfile); } catch (_) {}
    return avatarUrl;
  }
  const saveProfile = byId('saveProfileBtn').onclick;
  byId('saveProfileBtn').onclick = async () => { const button = byId('saveProfileBtn');if (button.disabled) return;button.disabled = true;try { await saveProfile(); } finally { button.disabled = false; } };
  async function refreshAvatar() {
    const accountId = user?.id;
    if (!accountId) throw new Error(translate('signInFirst'));
    // Do not use getProfile() here: it can return the cached pre-upload avatar.
    const { data: profile, error } = await sb.from('mw_profiles')
      .select('id,display_name,username,avatar_url')
      .eq('id', accountId)
      .maybeSingle();
    if (error) throw error;
    if (!profile || profile.id !== accountId) throw new Error(translate('retry'));
    if (user?.id !== accountId) throw new Error(translate('accountChanged'));
    window._mwCachedProfile = { ...(window._mwCachedProfile || {}), ...profile };
    try { saveLocalAccount(user, window._mwCachedProfile); } catch (_) {}
    for (const id of ['myAvatar', 'accountAvatar'].filter(byId)) {
      const box = byId(id);box.replaceChildren();
      if (profile.avatar_url) {
        const image = document.createElement('img');
        image.src = window.MilkyWayMedia?.image(profile.avatar_url, 160) || profile.avatar_url;
        image.alt = translate('profilePhoto');
        image.onerror = () => { if (user?.id === accountId) box.textContent = (profile.display_name || 'M').slice(0, 1).toUpperCase(); };
        box.append(image);
      } else box.textContent = (profile.display_name || 'M').slice(0, 1).toUpperCase();
    }
    // Keep the bottom My Account button in sync immediately after upload and on reopen.
    if (typeof setNavAvatar === 'function') setNavAvatar({ avatar_url: profile.avatar_url, name: profile.display_name || user?.user_metadata?.display_name || 'M' });
    if (typeof updateAccountCard === 'function') await updateAccountCard();
    const navLabel = document.querySelector('.orbit [data-tab="profile"] b');
    if (navLabel) navLabel.textContent = profile.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'My Account';
  }
  byId('mwSavePhoto').onclick = async () => {
    if (!avatarSource || savingAvatar) return;
    savingAvatar = true;byId('mwSavePhoto').disabled = true;byId('mwPhotoStatus').textContent = translate('uploading');
    try {
      const blob = await new Promise(resolve => croppedCanvas().toBlob(resolve, 'image/jpeg', .88));
      if (!blob) throw new Error(translate('photoUnsupported'));
      await saveAvatar(new File([blob], 'profile.jpg', { type: 'image/jpeg' }));byId('avatarFile').value = '';await refreshAvatar();closeSheet(photoSheet.id);toast(translate(avatarCleanupPending ? 'photoCleanupPending' : 'saved'));
    } catch (error) { byId('mwPhotoStatus').textContent = error.message; }
    finally { savingAvatar = false;byId('mwSavePhoto').disabled = false; }
  };
  byId('mwRemovePhoto').onclick = async () => {
    if (!(await window.MilkyWayDialog.confirm({ message: translate('confirmRemovePhoto'), danger: true }))) return;
    byId('mwRemovePhoto').disabled = true;
    try { const result = await accountRequest('avatar', { method: 'DELETE' });byId('avatarFile').value = '';await refreshAvatar();await updateAccountCard();closeSheet(photoSheet.id);toast(translate(result.cleanupPending ? 'photoCleanupPending' : 'photoRemoved')); }
    catch (error) { byId('mwPhotoStatus').textContent = error.message; }
    finally { byId('mwRemovePhoto').disabled = false; }
  };
  // Approved, in-schedule campaigns come from the database; each one is placed at most once, every `frequency` posts.
  let activeCampaigns = [];
  let advertisingUnavailable = false;
  const dismissKey = 'mw_dismissed_ads';
  const guestDismissed = () => { try { return JSON.parse(localStorage.getItem(dismissKey) || '{}'); } catch { return {}; } };
  function adCard(campaign) {
    const card = document.createElement('section');card.className = 'mw-ad-slot';card.dataset.campaignId = campaign.id;card.setAttribute('aria-label', translate('advertisement'));
    const header = document.createElement('header');
    const badge = document.createElement('span');badge.className = 'mw-ad-badge';badge.dataset.mwI18n = 'sponsoredLabel';badge.textContent = translate('sponsoredLabel');
    const business = document.createElement('b');business.className = 'mw-ad-business';business.textContent = campaign.business;
    const dismiss = document.createElement('button');dismiss.type = 'button';dismiss.className = 'mw-ad-dismiss';dismiss.textContent = '×';dismiss.setAttribute('aria-label', translate('dismissAd'));dismiss.title = translate('dismissAd');
    dismiss.onclick = () => dismissCampaign(campaign, dismiss);
    header.append(badge, business, dismiss);
    const media = document.createElement(campaign.mediaType === 'video' ? 'video' : 'img');
    adMedia(campaign, media);
    if (media instanceof HTMLVideoElement) { media.controls = true;media.playsInline = true;media.preload = 'metadata';media.muted = true; } else { media.alt = campaign.title || campaign.business;media.loading = 'lazy'; }
    const copy = document.createElement('div');copy.className = 'mw-ad-copy';
    const title = document.createElement('h3');title.textContent = campaign.title || campaign.business;
    const description = document.createElement('p');description.textContent = campaign.description;
    copy.append(title, description);
    if (campaign.destination) { const action = document.createElement('a');action.className = 'btn primary';action.href = campaign.destination;action.target = '_blank';action.rel = 'noopener noreferrer sponsored';if (campaign.ctaLabel) action.textContent = campaign.ctaLabel; else { action.dataset.mwI18n = 'visitBusiness';action.textContent = translate('visitBusiness'); }copy.append(action); }
    card.append(header, media, copy);
    trackAd(card);
    return card;
  }
  // Members-only uploads are fetched with the session; everything else loads directly.
  function adMedia(campaign, media) {
    if (campaign.mediaUrl.startsWith('/api/milkyway-account?action=campaign-media&key=') && campaign.audience === 'members') {
      authorization().then(authorization => fetch(campaign.mediaUrl, { headers: { Authorization: authorization, apikey: sb.supabaseKey || '' }, signal: AbortSignal.timeout(15000) })).then(response => { if (!response.ok) throw new Error(translate('mediaUnavailable'));return response.blob(); }).then(blob => { if (!media.isConnected) return;media.src = URL.createObjectURL(blob);media.dataset.objectUrl = 'true'; }).catch(() => { media.alt = translate('mediaUnavailable');media.dispatchEvent(new Event('error')); });
    } else media.src = media instanceof HTMLImageElement ? window.MilkyWayMedia?.image(campaign.mediaUrl, 720) || campaign.mediaUrl : campaign.mediaUrl;
  }
  // Impressions count once per visit when half the ad is on screen; clicks count taps on the call to action.
  const countedAds = new Set();
  const adEvent = (id, type) => { if (id) fetch(`${endpoint}?action=ad-event&id=${encodeURIComponent(id)}&type=${type}`, { method: 'POST', keepalive: true }).catch(() => {}); };
  const impression = id => { if (id && !countedAds.has(id)) { countedAds.add(id);adEvent(id, 'impression'); } };
  const adViews = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { adViews.unobserve(entry.target);impression(entry.target.dataset.campaignId); } }), { threshold: 0.5 }) : null;
  function trackAd(element) {
    adViews?.observe(element);
    element.addEventListener('click', event => { if (event.target.closest('a[href]')) adEvent(element.dataset.campaignId, 'click'); });
  }
  const adWords = {
    skip: { en: 'Skip ad', sw: 'Ruka tangazo', fr: 'Passer l’annonce', zh: '跳过广告', ar: 'تخطي الإعلان', pt: 'Pular anúncio', hi: 'विज्ञापन छोड़ें', de: 'Werbung überspringen' },
    skipIn: { en: 'Skip in {n}s', sw: 'Ruka baada ya {n}s', fr: 'Passer dans {n} s', zh: '{n} 秒后可跳过', ar: 'تخطٍ بعد {n} ث', pt: 'Pular em {n}s', hi: '{n} से. में छोड़ें', de: 'Überspringen in {n} s' },
  };
  const adText = (key, n = 0) => { const row = adWords[key];return (row[window.MilkyWayI18n.language?.() || 'sw'] || row.en).replace('{n}', String(n)); };
  const placementOf = campaign => campaign.placement || 'feed';
  const liveCampaign = campaign => campaign.status === 'approved' && (!campaign.startsAt || Date.parse(campaign.startsAt) <= Date.now()) && (!campaign.endsAt || Date.parse(campaign.endsAt) > Date.now());
  const revokeAds = root => root.querySelectorAll('[data-object-url]').forEach(media => URL.revokeObjectURL(media.src));
  // Banner ads sit in a strip above the feed; several paid banners take turns every 30 seconds.
  let bannerTurn = 0;
  function placeBanner() {
    const feed = byId('feed');if (!feed) return;
    const banners = activeCampaigns.filter(campaign => liveCampaign(campaign) && placementOf(campaign) === 'banner');
    let holder = byId('mwAdBanner');
    if (!banners.length) { if (holder) { revokeAds(holder);holder.remove(); } return; }
    const campaign = banners[bannerTurn % banners.length];
    if (!holder) { holder = document.createElement('div');holder.id = 'mwAdBanner';holder.className = 'mw-ad-banner'; }
    if (holder.dataset.campaignId !== campaign.id || !holder.firstElementChild) { revokeAds(holder);holder.replaceChildren(adCard(campaign));holder.dataset.campaignId = campaign.id; }
    if (holder.nextElementSibling !== feed) feed.before(holder);
  }
  window.setInterval(() => { if (document.visibilityState === 'visible') { bannerTurn++;placeBanner(); } }, 30000);
  // Video ads play before a feed video someone taps to watch (not scroll autoplay), on the first play and then every `frequency` plays.
  let videoPlays = 0, prerollTarget = null;
  document.addEventListener('play', event => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || video.dataset.mwPreroll) return;
    if (prerollTarget === video) { video.pause();return; }
    if (prerollTarget || video.mwAutoPlaying || video.dataset.mwPrerollDone || !video.closest('#feed>.post')) return;
    const rolls = activeCampaigns.filter(campaign => liveCampaign(campaign) && placementOf(campaign) === 'video' && campaign.mediaType === 'video');
    if (!rolls.length) return;
    video.dataset.mwPrerollDone = 'true';
    const campaign = rolls[videoPlays % rolls.length];
    if (videoPlays++ % Math.max(1, campaign.frequency) !== 0) return;
    video.pause();showPreroll(video, campaign);
  }, true);
  function showPreroll(target, campaign) {
    prerollTarget = target;
    const host = target.parentElement;host.classList.add('mw-preroll-host');
    const overlay = document.createElement('div');overlay.className = 'mw-preroll';overlay.dataset.campaignId = campaign.id;overlay.setAttribute('role', 'region');overlay.setAttribute('aria-label', translate('advertisement'));
    const ad = document.createElement('video');ad.dataset.mwPreroll = 'true';ad.playsInline = true;ad.preload = 'auto';ad.muted = target.muted;
    const badge = document.createElement('span');badge.className = 'mw-preroll-badge';badge.textContent = `${translate('sponsoredLabel')} · ${campaign.business}`;
    const skip = document.createElement('button');skip.type = 'button';skip.className = 'mw-preroll-skip';skip.disabled = true;
    overlay.append(ad, badge, skip);
    if (campaign.destination) { const action = document.createElement('a');action.className = 'mw-preroll-cta';action.href = campaign.destination;action.target = '_blank';action.rel = 'noopener noreferrer sponsored';action.textContent = campaign.ctaLabel || translate('visitBusiness');action.onclick = () => adEvent(campaign.id, 'click');overlay.append(action); }
    // The ad covers exactly the post video's box; the post becomes the positioning parent.
    target.before(overlay);
    const fit = () => Object.assign(overlay.style, { top: `${target.offsetTop}px`, left: `${target.offsetLeft}px`, width: `${target.offsetWidth}px`, height: `${Math.max(200, target.offsetHeight)}px` });
    fit();
    let finished = false;
    const wait = Math.max(0, Number(campaign.skipAfter ?? 5));
    const finish = () => {
      if (finished) return;finished = true;clearInterval(timer);clearTimeout(stall);
      ad.pause();revokeAds(overlay);overlay.remove();host.classList.remove('mw-preroll-host');prerollTarget = null;
      if (target.isConnected) target.play().catch(() => {});
    };
    const update = () => {
      const remaining = Math.ceil(wait - ad.currentTime);
      skip.disabled = remaining > 0;skip.textContent = remaining > 0 ? adText('skipIn', remaining) : adText('skip');
      if (!overlay.isConnected) finish();else fit();
    };
    const timer = setInterval(update, 250);update();
    // An ad that cannot start within 8 seconds is skipped so the chosen video always plays.
    const stall = setTimeout(() => { if (ad.currentTime === 0) finish(); }, 8000);
    skip.onclick = finish;ad.onended = finish;ad.onerror = finish;
    ad.onplaying = () => impression(campaign.id);
    ad.onloadeddata = () => ad.play().catch(() => { ad.muted = true;ad.play().catch(finish); });
    adMedia(campaign, ad);
  }
  async function dismissCampaign(campaign, button) {
    button.disabled = true;
    try {
      if (logged()) await accountRequest(`dismiss-ad&id=${campaign.id}`, { method: 'POST' });
      else { const map = guestDismissed();map[campaign.id] = Date.now() + campaign.dismissDays * 86400000;localStorage.setItem(dismissKey, JSON.stringify(map)); }
      activeCampaigns = activeCampaigns.filter(item => item.id !== campaign.id);
      document.querySelectorAll(`.mw-ad-slot[data-campaign-id="${campaign.id}"]`).forEach(card => { card.querySelectorAll('[data-object-url]').forEach(media => URL.revokeObjectURL(media.src));card.remove(); });
      placeAdvertisement();toast(translate('adDismissed'));
    } catch (error) { toast(error.message || translate('retry'));button.disabled = false; }
  }
  function placeAdvertisement() {
    const feed = byId('feed');
    const posts = [...feed.querySelectorAll(':scope>.post')];
    const wanted = new Map();
    let index = 0, position = 0;
    placeBanner();
    for (const campaign of activeCampaigns.filter(campaign => liveCampaign(campaign) && placementOf(campaign) === 'feed')) {
      position += index === 0 ? Math.min(2, campaign.frequency) : campaign.frequency;
      if (index >= 3) break;
      wanted.set(campaign.id, posts[Math.min(position, posts.length) - 1] || null);index++;
    }
    feed.querySelectorAll(':scope>.mw-ad-slot[data-campaign-id]').forEach(card => { if (!wanted.has(card.dataset.campaignId)) card.remove(); });
    for (const [id, anchor] of wanted) {
      let card = feed.querySelector(`:scope>.mw-ad-slot[data-campaign-id="${id}"]`);
      if (!card) card = adCard(activeCampaigns.find(item => item.id === id));
      if (!anchor) { if (card.parentElement !== feed) feed.append(card); }
      else if (anchor.nextElementSibling !== card) anchor.after(card);
    }
    let placement = byId('mwBusinessPlacement');
    if (!wanted.size && !byId('mwAdBanner')) {
      if (!placement) { placement = document.createElement('section');placement.id = 'mwBusinessPlacement';placement.className = 'mw-business-placement mw-ad-slot';placement.innerHTML = '<h3 data-mw-i18n="businessAdvertising"></h3><p></p>'; }
      const description = placement.querySelector('p');description.dataset.mwI18n = advertisingUnavailable ? 'businessAdvertisingUnavailable' : 'businessAdvertisingHelp';description.textContent = translate(description.dataset.mwI18n);
      placement.querySelector('h3').textContent = translate('businessAdvertising');
      const anchor = posts[Math.min(2, posts.length) - 1];if (anchor && anchor.nextElementSibling !== placement) anchor.after(placement);else if (!anchor && placement.parentElement !== feed) feed.append(placement);
    } else placement?.remove();
  }
  let advertisementRequest = null;
  let advertisementAccount = null;
  let advertisementSignature = '';
  function loadAdvertisements() {
    const actor = user?.id || null;
    if (advertisementRequest && advertisementAccount === actor) return advertisementRequest;
    advertisementAccount = actor;
    const pending = (async () => {
      try {
        const { campaigns } = await request(`${endpoint}?action=advertisements&lang=${encodeURIComponent(window.MilkyWayI18n.language?.() || '')}`, logged() ? { headers: { Authorization: await authorization(), apikey: sb.supabaseKey || '' } } : {}, true);
        if ((user?.id || null) !== actor) return;
        const hidden = guestDismissed();advertisingUnavailable = false;
        activeCampaigns = campaigns.filter(campaign => actor || !(hidden[campaign.id] > Date.now()));
        const signature = JSON.stringify([actor, activeCampaigns]);
        if (signature !== advertisementSignature) {
          advertisementSignature = signature;
          byId('feed').querySelectorAll(':scope>.mw-ad-slot').forEach(card => { revokeAds(card);card.remove(); });
          const banner = byId('mwAdBanner');if (banner) { revokeAds(banner);banner.remove(); }
        }
        placeAdvertisement();window.MilkyWayI18n.apply();
      } catch { if ((user?.id || null) === actor) { activeCampaigns = [];advertisementSignature = '';advertisingUnavailable = true;placeAdvertisement(); } }
      finally { if (advertisementRequest === pending) advertisementRequest = null; }
    })();
    advertisementRequest = pending;return pending;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadAdvertisements(); });
  // Ads can target languages, so a language switch asks for the matching set.
  window.addEventListener('mw-language-change', () => { advertisementRequest = null;loadAdvertisements(); });
  window.setInterval(() => { if (document.visibilityState === 'visible') loadAdvertisements(); }, 120000);
  const adButton = document.createElement('button');adButton.className = 'btn ghost';adButton.type = 'button';adButton.dataset.mwI18n = 'manageAds';adButton.hidden = true;
  const adsSheet = sheet('mwAdsSheet', 'manageAds', '<p class="muted" data-mw-i18n="adminAdsHelp"></p><div id="mwCampaignList"></div><form class="mw-ad-form" id="mwCampaignForm"><input name="id" type="hidden"><label><span data-mw-i18n="businessName"></span><input name="business" maxlength="100" required></label><label><span data-mw-i18n="adTitle"></span><input name="title" maxlength="140"></label><label><span data-mw-i18n="description"></span><textarea name="description" maxlength="1000"></textarea></label><label><span data-mw-i18n="mediaUrl"></span><input name="mediaUrl" type="url" pattern="https://.*" required></label><label><span data-mw-i18n="mediaType"></span><select name="mediaType"><option value="image" data-mw-i18n="image"></option><option value="video" data-mw-i18n="video"></option></select></label><label><span data-mw-i18n="destination"></span><input name="destination" type="url" pattern="https://.*"></label><label><span data-mw-i18n="ctaLabel"></span><input name="ctaLabel" maxlength="40"></label><label><span data-mw-i18n="startDate"></span><input name="startsAt" type="datetime-local"></label><label><span data-mw-i18n="endDate"></span><input name="endsAt" type="datetime-local"></label><label><span data-mw-i18n="targetAudience"></span><select name="audience"><option value="all" data-mw-i18n="audienceAll"></option><option value="members" data-mw-i18n="audienceMembers"></option></select></label><label><span data-mw-i18n="adFrequency"></span><input name="frequency" type="number" min="3" max="20" value="6"></label><label><span data-mw-i18n="dismissDays"></span><input name="dismissDays" type="number" min="1" max="365" value="7"></label><label><span data-mw-i18n="status"></span><select name="status"><option value="draft" data-mw-i18n="draft"></option><option value="approved" data-mw-i18n="approved"></option><option value="paused" data-mw-i18n="paused"></option></select></label><div class="row"><button class="btn primary" data-mw-i18n="save"></button><button type="button" class="btn ghost" id="mwCampaignNew" data-mw-i18n="newCampaign"></button></div><p id="mwCampaignStatus" role="status"></p></form>');
  const localDate = value => { if (!value) return '';const date = new Date(value);date.setMinutes(date.getMinutes() - date.getTimezoneOffset());return date.toISOString().slice(0, 16); };
  const mediaUpload = document.createElement('label');
  mediaUpload.innerHTML = '<span data-mw-i18n="uploadAdMedia"></span><input type="file" id="mwAdMediaUpload" accept="image/jpeg,image/png,image/webp"><p class="muted" id="mwAdUploadStatus" role="status"></p>';
  byId('mwCampaignForm').elements.namedItem('mediaUrl').closest('label').before(mediaUpload);
  const mediaUrlInput = byId('mwCampaignForm').elements.namedItem('mediaUrl');mediaUrlInput.type = 'text';mediaUrlInput.removeAttribute('pattern');
  const previewButton = document.createElement('button');previewButton.type = 'button';previewButton.className = 'btn ghost';previewButton.dataset.mwI18n = 'preview';
  const previewPanel = document.createElement('div');previewPanel.className = 'mw-ad-preview';previewPanel.id = 'mwAdPreview';previewPanel.hidden = true;
  byId('mwCampaignForm').querySelector('.row').append(previewButton);byId('mwCampaignForm').append(previewPanel);
  let previewObjectUrl = null;
  async function previewCampaign() {
    const values = Object.fromEntries(new FormData(byId('mwCampaignForm')));
    try {
      const address = new URL(values.mediaUrl, location.origin);
      if (address.protocol !== 'https:' && address.origin !== location.origin || address.username || address.password) throw new Error(translate('mediaUnavailable'));
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      if (values.mediaUrl.startsWith('/api/milkyway-account?action=campaign-media&key=')) {
        const response = await fetch(values.mediaUrl, { headers: { Authorization: await authorization(), apikey: sb.supabaseKey || '' }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(translate('mediaUnavailable'));
        previewObjectUrl = URL.createObjectURL(await response.blob());values.mediaUrl = previewObjectUrl;
      }
      previewPanel.replaceChildren(adCard({ ...values, id: 'preview' }));previewPanel.querySelector('button')?.remove();previewPanel.hidden = false;
    } catch (error) { byId('mwCampaignStatus').textContent = error.message; }
  }
  previewButton.onclick = previewCampaign;
  byId('mwAdMediaUpload').onchange = async event => {
    const file = event.target.files[0];if (!file) return;
    if (file.size > 4 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { byId('mwAdUploadStatus').textContent = translate('adMediaLimit');return; }
    const button = byId('mwCampaignForm').querySelector('button.primary');button.disabled = true;event.target.disabled = true;byId('mwAdUploadStatus').textContent = translate('loading');
    try {
      const owner = (await sb.auth.getSession()).data.session?.user?.id;
      if (!owner) throw new Error(translate('signInRequired') || 'Sign in first.');
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `milkyway/${owner}/campaigns/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await sb.storage.from('portfolio').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(uploadError.message || 'Upload failed.');
      const result = await accountRequest('campaign-media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: sb.storage.from('portfolio').getPublicUrl(path).data.publicUrl, type: 'image' }) });
      mediaUrlInput.value = result.mediaUrl;byId('mwCampaignForm').elements.namedItem('mediaType').value = result.mediaType;byId('mwAdUploadStatus').textContent = translate('saved');await previewCampaign();
    }
    catch (error) { byId('mwAdUploadStatus').textContent = error.message; }
    finally { button.disabled = false;event.target.disabled = false; }
  };
  async function saveCampaign(values) {
    await accountRequest('campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  }
  async function loadCampaigns() {
    const list = byId('mwCampaignList');list.textContent = translate('loading');
    try {
      const { campaigns } = await accountRequest('campaigns');list.replaceChildren();byId('mwCampaignForm').hidden = false;
      if (!campaigns.length) { const empty = document.createElement('p');empty.className = 'muted';empty.textContent = translate('noCampaigns');list.append(empty); }
      const now = Date.now();
      for (const campaign of campaigns) {
        const row = document.createElement('div');row.className = 'mw-file-row mw-campaign-row';
        const expired = campaign.endsAt && Date.parse(campaign.endsAt) <= now, scheduled = campaign.startsAt && Date.parse(campaign.startsAt) > now;
        const title = document.createElement('span');title.textContent = `${campaign.business}${campaign.title ? ' — ' + campaign.title : ''} · ${translate(expired ? 'expired' : scheduled ? 'scheduled' : campaign.status)}`;
        const edit = document.createElement('button');edit.type = 'button';edit.className = 'btn';edit.textContent = translate('edit');
        edit.onclick = () => { const form = byId('mwCampaignForm');for (const field of ['id', 'business', 'title', 'description', 'mediaUrl', 'mediaType', 'destination', 'ctaLabel', 'audience', 'frequency', 'dismissDays', 'status']) form.elements.namedItem(field).value = campaign[field] ?? '';form.elements.namedItem('startsAt').value = localDate(campaign.startsAt);form.elements.namedItem('endsAt').value = localDate(campaign.endsAt);form.scrollIntoView({ block: 'start' }); };
        const toggle = document.createElement('button');toggle.type = 'button';toggle.className = 'btn ghost';toggle.textContent = translate(campaign.status === 'approved' ? 'pause' : 'activate');
        toggle.onclick = async () => { if (campaign.status !== 'approved' && !(await window.MilkyWayDialog.confirm({ message: translate('confirmPublish') }))) return;toggle.disabled = true;try { await saveCampaign({ ...campaign, status: campaign.status === 'approved' ? 'paused' : 'approved' });await loadCampaigns();await loadAdvertisements(); } catch (error) { toast(error.message);toggle.disabled = false; } };
        const remove = document.createElement('button');remove.type = 'button';remove.className = 'btn danger';remove.textContent = translate('delete');
        remove.onclick = async () => { if (!(await window.MilkyWayDialog.confirm({ message: translate('confirmDeleteCampaign'), danger: true }))) return;remove.disabled = true;try { await accountRequest(`campaigns&id=${campaign.id}`, { method: 'DELETE' });await loadCampaigns();await loadAdvertisements();toast(translate('deleted')); } catch (error) { toast(error.message);remove.disabled = false; } };
        row.append(title, edit, toggle, remove);list.append(row);
      }
    } catch (error) { list.textContent = error.message;byId('mwCampaignForm').hidden = true; }
  }
  adButton.onclick = () => { openSheet(adsSheet.id);loadCampaigns(); };
  byId('mwCampaignNew').onclick = () => { byId('mwCampaignForm').reset();byId('mwCampaignForm').elements.namedItem('id').value = '';byId('mwCampaignStatus').textContent = '';byId('mwAdUploadStatus').textContent = '';previewPanel.hidden = true;if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);previewObjectUrl = null; };
  byId('mwCampaignForm').onsubmit = async event => {
    event.preventDefault();const form = event.currentTarget;const button = form.querySelector('button.primary');if (button.disabled) return;button.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    if (values.status === 'approved' && !(await window.MilkyWayDialog.confirm({ message: translate('confirmPublish') }))) { button.disabled = false;return; }
    for (const field of ['startsAt', 'endsAt']) values[field] = values[field] ? new Date(values[field]).toISOString() : null;
    if (!values.id) delete values.id;
    try { await saveCampaign(values);form.reset();form.elements.namedItem('id').value = '';await loadCampaigns();await loadAdvertisements();byId('mwCampaignStatus').textContent = translate('saved'); }
    catch (error) { byId('mwCampaignStatus').textContent = error.message; }
    finally { button.disabled = false; }
  };
  const network = document.createElement('div');network.className = 'mw-network-banner';network.setAttribute('role', 'status');network.dataset.mwI18n = 'offline';network.hidden = true;document.body.append(network);
  // A calm strip when the connection drops; it also follows the offline data layer, which notices a dead connection the
  // browser still reports as online. It fades after a few seconds so saved posts can be watched without it in the way;
  // posts not saved on the device carry their own quiet line instead.
  let networkTimer = null;
  const updateNetwork = () => {
    const off = !navigator.onLine || !!window.MilkyWayOffline?.offline;
    clearTimeout(networkTimer);
    if (!off) { network.hidden = true;return; }
    if (!network.hidden) return;
    network.hidden = false;networkTimer = setTimeout(() => { network.hidden = true; }, 4000);
  };
  window.addEventListener('online', updateNetwork);window.addEventListener('offline', updateNetwork);window.addEventListener('mw-offline', updateNetwork);
  window.addEventListener('mw-reconnected', () => { updateNetwork();loadAdvertisements(); });updateNetwork();
  function viewport() { document.documentElement.style.setProperty('--mw-viewport', `${window.visualViewport?.height || window.innerHeight}px`);document.documentElement.style.setProperty('--mw-viewport-top', `${window.visualViewport?.offsetTop || 0}px`); }
  window.visualViewport?.addEventListener('resize', viewport);window.visualViewport?.addEventListener('scroll', viewport);window.addEventListener('resize', viewport);viewport();
  document.addEventListener('click', event => { document.querySelectorAll('.mw-message-menu[open]').forEach(menu => { if (!menu.contains(event.target) || event.target.closest('button')) menu.open = false; }); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('.mw-message-menu[open]').forEach(menu => { menu.open = false; }); });
  document.addEventListener('play', event => { if (event.target instanceof HTMLVideoElement && !event.target.closest('#mwLivePage,.mw-call-panel')) document.querySelectorAll('.post video,.mw-ad-slot video').forEach(video => { if (video !== event.target) video.pause(); }); }, true);
  // Posts published from this release onward are branded automatically; older posts can opt in from the author's post menu.
  const watermarkSince = Date.parse('2026-10-11T00:00:00Z');
  const watermarkSource = 'brand/milkyway-watermark.png';
  const brandedPosts = new Set();
  const checkedPosts = new Set();
  let brandingRequest = null;
  const eligibleMedia = post => post.querySelector(':scope>.post-media,:scope>.mw-media-frame>.post-media');
  const autoBranded = post => Date.parse(post.dataset.createdAt || '') >= watermarkSince;
  function paintWatermark(post) {
    const media = eligibleMedia(post);
    if (!media) return;
    let frame = media.parentElement.classList.contains('mw-media-frame') ? media.parentElement : null;
    if (!frame) { frame = document.createElement('div');frame.className = 'mw-media-frame';media.before(frame);frame.append(media); }
    frame.dataset.kind = media.tagName === 'VIDEO' ? 'video' : 'image';
    const branded = autoBranded(post) || brandedPosts.has(post.dataset.postId);
    let mark = frame.querySelector(':scope>.mw-watermark');
    if (branded && !mark) { mark = document.createElement('img');mark.className = 'mw-watermark';mark.src = watermarkSource;mark.alt = '';mark.setAttribute('aria-hidden', 'true');mark.decoding = 'async';frame.append(mark); }
    if (!branded && mark) mark.remove();
    if (mark && !frame.mwSized) { frame.mwSized = true;const fit = () => fitWatermark(frame, media);media.addEventListener(media.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', fit);watermarkSizer?.observe(frame);fit(); }
    post.dataset.watermarked = String(branded);
    const menu = post.querySelector('.actions .mw-message-menu');
    if (!menu || post.dataset.authorId !== user?.id) return;
    let toggle = menu.querySelector('[data-mw-watermark]');
    if (!autoBranded(post)) {
      if (!toggle) { toggle = document.createElement('button');toggle.type = 'button';toggle.dataset.mwWatermark = '';(menu.querySelector('.mw-message-menu-items') || menu).append(toggle);toggle.onclick = () => toggleWatermark(post, toggle); }
      toggle.dataset.mwI18n = branded ? 'removeWatermark' : 'addWatermark';toggle.textContent = translate(toggle.dataset.mwI18n);
    }
    if (frame.dataset.kind === 'image' && branded && !menu.querySelector('[data-mw-export]')) {
      const exporter = document.createElement('button');exporter.type = 'button';exporter.dataset.mwExport = '';exporter.dataset.mwI18n = 'downloadBranded';exporter.textContent = translate('downloadBranded');exporter.onclick = () => exportBranded(post, exporter);(menu.querySelector('.mw-message-menu-items') || menu).append(exporter);
    }
  }
  // Keep the mark on the visible picture, not on letterbox bars, for portrait, landscape and square media.
  function fitWatermark(frame, media) {
    const mark = frame.querySelector(':scope>.mw-watermark');
    const naturalWidth = media.naturalWidth || media.videoWidth, naturalHeight = media.naturalHeight || media.videoHeight;
    if (!mark || !naturalWidth || !naturalHeight) return;
    const width = frame.clientWidth, height = media.clientHeight || frame.clientHeight;
    const scale = Math.min(width / naturalWidth, height / naturalHeight);
    const shownWidth = naturalWidth * scale, shownHeight = naturalHeight * scale;
    const size = Math.max(44, Math.min(110, Math.min(shownWidth, shownHeight) * .17)), pad = Math.max(8, Math.min(16, size * .16));
    mark.style.width = `${Math.round(size)}px`;
    mark.style.right = `${Math.round((width - shownWidth) / 2 + pad)}px`;
    mark.style.bottom = `${Math.round((frame.clientHeight - height) + (height - shownHeight) / 2 + pad + (media.tagName === 'VIDEO' ? 40 : 0))}px`;
  }
  const watermarkSizer = 'ResizeObserver' in window ? new ResizeObserver(entries => entries.forEach(entry => { const media = entry.target.querySelector(':scope>.post-media');if (media) fitWatermark(entry.target, media); })) : null;
  async function toggleWatermark(post, button) {
    if (button.disabled) return;
    button.disabled = true;
    const id = post.dataset.postId, enabled = brandedPosts.has(id);
    try {
      await accountRequest(`watermark&id=${encodeURIComponent(id)}`, { method: enabled ? 'DELETE' : 'POST' });
      if (enabled) brandedPosts.delete(id); else brandedPosts.add(id);
      paintWatermark(post);toast(translate('saved'));
    } catch (error) { toast(error.message); }
    finally { button.disabled = false; }
  }
  async function exportBranded(post, button) {
    const media = eligibleMedia(post);
    if (!media || media.tagName !== 'IMG' || button.disabled) return;
    button.disabled = true;
    try {
      const load = src => new Promise((resolve, reject) => { const image = new Image();image.crossOrigin = 'anonymous';image.onload = () => resolve(image);image.onerror = () => reject(new Error(translate('exportFailed')));image.src = src; });
      const [photo, mark] = await Promise.all([load(media.currentSrc || media.src), load(watermarkSource)]);
      const canvas = document.createElement('canvas');canvas.width = photo.naturalWidth;canvas.height = photo.naturalHeight;
      const context = canvas.getContext('2d');context.drawImage(photo, 0, 0);
      const width = Math.max(48, Math.min(canvas.width, canvas.height) * .22), height = width * mark.naturalHeight / mark.naturalWidth, pad = Math.min(canvas.width, canvas.height) * .035;
      context.globalAlpha = .85;context.shadowColor = 'rgba(0,20,60,.5)';context.shadowBlur = width * .05;context.drawImage(mark, canvas.width - width - pad, canvas.height - height - pad, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
      if (!blob) throw new Error(translate('exportFailed'));
      const link = document.createElement('a');link.href = URL.createObjectURL(blob);link.download = `milkyway-${post.dataset.postId}.jpg`;document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    } catch (error) { toast(error.message === translate('exportFailed') ? error.message : translate('exportFailed')); }
    finally { button.disabled = false; }
  }
  async function loadBranding() {
    if (brandingRequest) return brandingRequest;
    const pending = [...document.querySelectorAll('#feed .post[data-post-id]')].filter(post => !autoBranded(post) && eligibleMedia(post) && !checkedPosts.has(post.dataset.postId)).map(post => post.dataset.postId).slice(0, 60);
    if (!pending.length) return;
    pending.forEach(id => checkedPosts.add(id));
    brandingRequest = request(`${endpoint}?action=watermarks&ids=${pending.join(',')}`, {}, true)
      .then(({ ids }) => { ids.forEach(id => brandedPosts.add(id));document.querySelectorAll('#feed .post[data-post-id]').forEach(paintWatermark); })
      .catch(() => pending.forEach(id => checkedPosts.delete(id)))
      .finally(() => { brandingRequest = null; });
    return brandingRequest;
  }
  // One compact line right under the post: reactions, then Comments, Share, Repost, Save and •••, as small icons with counts.
  const actionIcon = path => `<svg class="mw-act-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
  const actionIcons = {
    echo: actionIcon('M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.4A8.4 8.4 0 1 1 21 11.5z'),
    share: actionIcon('M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z'),
    repost: actionIcon('M17 2l4 4-4 4M3 11V10a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3'),
    save: actionIcon('M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z')
  };
  function compactAction(button, icon, key, count) {
    if (!button) return;
    button.innerHTML = icon + (count == null ? '' : `<span class="mw-act-count">${count}</span>`);
    const name = document.createElement('span');name.className = 'mw-sr';name.dataset.mwI18n = key;name.textContent = translate(key);button.prepend(name);
    button.title = translate(key);button.classList.add('mw-act-compact');
  }
  function compactActions(post, actions) {
    const signals = post.querySelector(':scope>.signals');
    if (signals) { signals.replaceWith(actions);actions.prepend(signals); }
    const echo = actions.querySelector(':scope>[data-echo]');
    compactAction(echo, actionIcons.echo, 'comments', (echo?.textContent.match(/\d+/) || ['0'])[0]);
    compactAction(actions.querySelector(':scope>[data-share]'), actionIcons.share, 'share');
    compactAction(actions.querySelector(':scope>[data-repost]'), actionIcons.repost, 'repost');
    const save = actions.querySelector(':scope>[data-save]');
    compactAction(save, actionIcons.save, 'savedPosts');
    save?.setAttribute('aria-pressed', String(save.classList.contains('on')));
    // Save sits just before ••• so the right-hand group reads Share · Repost · Save · •••.
    if (save) actions.insertBefore(save, actions.querySelector(':scope>.mw-message-menu'));
  }
  function enhanceFeed() {
    document.querySelectorAll('#feed .post:not([data-premium])').forEach(post => {
      post.dataset.premium = 'true';
      const actions = post.querySelector('.actions');
      if (actions) {
        const menu = document.createElement('details');menu.className = 'mw-message-menu';
        const summary = document.createElement('summary');summary.textContent = '•••';summary.setAttribute('aria-label', translate('postActions'));
        // The options open as a popover above the ••• button, so the action bar itself never changes size.
        const items = document.createElement('div');items.className = 'mw-message-menu-items';menu.append(summary, items);
        for (const button of actions.querySelectorAll('[data-report],[data-edit],[data-delete]')) {
          if (button.hasAttribute('data-report')) { button.title = translate('report');button.setAttribute('aria-label', translate('report')); }
          items.append(button);
        }
        actions.append(menu);
        compactActions(post, actions);
      }
      const avatar = post.querySelector('.post-head .avatar');
      if (avatar && post.dataset.authorId) { avatar.setAttribute('role', 'button');avatar.tabIndex = 0;avatar.setAttribute('aria-label', translate('viewProfile'));avatar.onclick = () => openPublicProfile(post.dataset.authorId);avatar.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault();avatar.click(); } }; }
      // A hidden name (not aria-label) so screen readers announce both the reaction and its live count.
      for (const button of post.querySelectorAll('[data-sig]')) { button.title = translate(button.dataset.sig);if (!button.querySelector('.mw-sr')) { const name = document.createElement('span');name.className = 'mw-sr';name.dataset.mwI18n = button.dataset.sig;name.textContent = translate(button.dataset.sig);button.prepend(name); } }
    });
    document.querySelectorAll('#feed .post[data-post-id]').forEach(paintWatermark);
    loadBranding();
  }
  new MutationObserver(() => { enhanceFeed();placeAdvertisement(); }).observe(byId('feed'), { childList: true });enhanceFeed();
  let draftAccount = null;
  sb.auth.onAuthStateChange((event, session) => {
    const account = session?.user?.id || null;
    if (account !== draftAccount) {
      activeCampaigns = [];advertisementSignature = '';
      byId('feed').querySelectorAll(':scope>.mw-ad-slot').forEach(card => { card.querySelectorAll('[data-object-url]').forEach(media => URL.revokeObjectURL(media.src));card.remove(); });
    }
    if (account !== draftAccount) { if (draftAccount) Object.keys(sessionStorage).filter(key => key.startsWith(`mw-draft:${draftAccount}:`)).forEach(key => sessionStorage.removeItem(key));draftPeer = null;pendingMessage = null;viewedStories.clear();byId('threadInput').value = '';draftAccount = account;paintStories();loadAdvertisements(); }
    adButton.hidden = true;
  });
  window.addEventListener('pagehide', () => { if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl); });
  window.MilkyWayPremium = { messageRequest, groupRequest, bindMessages, editMessage, saveAvatar, switchDraft, clearDraft, acknowledgeMessage, messageId, clearMessageId: () => { pendingMessage = null; }, loadAdvertisements, storyStates, markStoryViewed, setAdministrator: allowed => { adButton.hidden = !allowed; }, openAdvertisements: () => { if (!adButton.hidden) adButton.click(); } };
  window.MilkyWayI18n.apply();loadAdvertisements();
})();
