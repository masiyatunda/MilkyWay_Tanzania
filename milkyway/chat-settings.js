// Chats screen: the three-dots menu (Groups, New Chat, Message Settings) and the Message Settings panel.
(() => {
  const byId = id => document.getElementById(id);
  const t = key => window.MilkyWayI18n?.t(key) || key;
  const inbox = byId('msgSheet'), menu = byId('waInboxMenu'), menuButton = byId('waInboxMenuBtn');
  if (!inbox || !menu || !menuButton) return;
  const scroll = inbox.querySelector('.wa-inbox-scroll');

  function setMenu(open) {
    menu.hidden = !open;menuButton.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('button')?.focus({ preventScroll: true });
  }
  menuButton.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', event => { if (event.target.closest('button')) setMenu(false); });
  document.addEventListener('pointerdown', event => { if (!menu.hidden && !event.target.closest('#waInboxMenu,#waInboxMenuBtn')) setMenu(false); });
  inbox.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { event.stopPropagation();setMenu(false);menuButton.focus(); } });

  // Groups narrows the inbox to group chats; "All chats" brings the full list back.
  function groupsView(on) {
    scroll?.classList.toggle('mw-groups-view', on);inbox.classList.toggle('mw-groups-view', on);
    byId('inboxAllChatsBtn').hidden = !on;
    if (on && scroll) scroll.scrollTop = 0;
  }
  byId('inboxGroupsBtn').addEventListener('click', () => groupsView(true));
  byId('inboxAllChatsBtn').addEventListener('click', () => groupsView(false));
  // Every fresh visit to Chats starts on the full list.
  new MutationObserver(() => { if (!inbox.classList.contains('open')) { groupsView(false);setMenu(false); } }).observe(inbox, { attributes: true, attributeFilter: ['class'] });

  const panel = document.createElement('div');
  panel.id = 'mwMessageSettings';panel.className = 'sheet-bg mw-msg-settings';
  const toggle = (id, label, help) => `<label class="mw-ms-row"><span><b data-mw-i18n="${label}"></b><small data-mw-i18n="${help}"></small></span><input type="checkbox" id="${id}" role="switch"></label>`;
  panel.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="mwMsgSettingsTitle">
    <header class="mw-ms-head"><button type="button" class="mw-ms-back" data-ms-close data-mw-i18n-aria="back" title="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button><h2 id="mwMsgSettingsTitle" data-mw-i18n="messageSettings">Message Settings</h2></header>
    <div class="mw-ms-body">
      <p class="mw-ms-status" id="mwMsStatus" role="status" hidden></p>
      <section class="mw-ms-group"><h3 data-mw-i18n="chatPrivacy"></h3><div class="mw-ms-card">
        <label class="mw-ms-row mw-ms-select"><span><b data-mw-i18n="whoCanMessage"></b><small data-mw-i18n="whoCanMessageHelp"></small></span><select id="mwMsAllow"><option value="everyone" data-mw-i18n="everyone"></option><option value="followers" data-mw-i18n="followersOnly"></option><option value="nobody" data-mw-i18n="nobody"></option></select></label>
        ${toggle('mwMsReceipts', 'readReceipts', 'readReceiptsHelp')}
      </div></section>
      <section class="mw-ms-group"><h3 data-mw-i18n="notifications"></h3><div class="mw-ms-card">
        ${toggle('mwMsNotify', 'messageNotifications', 'messageNotificationsHelp')}
        ${toggle('mwMsSound', 'messageSound', 'messageSoundHelp')}
      </div></section>
      <section class="mw-ms-group"><h3 data-mw-i18n="chatHistory"></h3><div class="mw-ms-card"><p class="mw-ms-help" data-mw-i18n="clearAllHistoryNote"></p><button type="button" id="mwMsClearHistory" class="mw-ms-danger" data-mw-i18n="clearAllHistory"></button></div></section>
      <section class="mw-ms-group"><h3 data-mw-i18n="blockedContacts"></h3><div class="mw-ms-card"><p class="mw-ms-help" data-mw-i18n="blockedContactsHelp"></p><div id="mwMsBlocked" class="mw-ms-blocked"></div></div></section>
    </div></section>`;
  document.body.append(panel);
  const fields = { allowMessages: byId('mwMsAllow'), readReceipts: byId('mwMsReceipts'), notifyMessages: byId('mwMsNotify'), messageSound: byId('mwMsSound') };
  const status = byId('mwMsStatus');
  const say = (text = '', tone = '') => { status.textContent = text;status.dataset.tone = tone;status.hidden = !text; };
  const close = () => closeSheet(panel.id);
  panel.querySelector('[data-ms-close]').onclick = close;
  panel.addEventListener('click', event => { if (event.target === panel) close(); });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation();close(); } });

  function paint(preferences) {
    fields.allowMessages.value = preferences.allowMessages || 'everyone';
    for (const key of ['readReceipts', 'notifyMessages', 'messageSound']) fields[key].checked = preferences[key] !== false;
  }
  const lock = on => Object.values(fields).forEach(field => { field.disabled = on; });

  // Each change saves straight away; on failure the previous choice comes back.
  let saving = Promise.resolve();
  function save() {
    saving = saving.then(async () => {
      const accountId = user?.id, base = accountPreferences?.owner === accountId ? accountPreferences : await loadAccountPreferences();
      if (!base || user?.id !== accountId) { say(t('settingsNotSaved'), 'error');return; }
      const patch = { isPrivate: !!base.isPrivate, allowMessages: fields.allowMessages.value, notifyFollow: base.notifyFollow !== false, notifyEcho: base.notifyEcho !== false, notifySignal: base.notifySignal !== false, readReceipts: fields.readReceipts.checked, notifyMessages: fields.notifyMessages.checked, messageSound: fields.messageSound.checked };
      try {
        const preferences = await accountPreferencesRequest('POST', patch);
        if (user?.id !== accountId) return;
        accountPreferences = { ...preferences, owner: accountId };say(t('saved'), 'ok');
        setTimeout(() => { if (status.textContent === t('saved')) say(); }, 1800);
      } catch (error) { if (user?.id === accountId) { paint(base);say(error.message || t('settingsNotSaved'), 'error'); } }
    });
  }
  Object.values(fields).forEach(field => field.addEventListener('change', save));

  async function loadBlocked() {
    const list = byId('mwMsBlocked'), accountId = user.id;
    list.innerHTML = `<p class="mw-ms-empty">${esc(t('loading'))}</p>`;
    const { data, error } = await sb.from('mw_blocks').select('blocked_id').eq('blocker_id', accountId);
    if (user?.id !== accountId) return;
    if (error) { list.innerHTML = `<p class="mw-ms-empty">${esc(window.MilkyWayOffline?.friendly(error.message) || error.message)}</p>`;return; }
    if (!data.length) { list.innerHTML = `<p class="mw-ms-empty">${esc(t('noBlockedAccounts'))}</p>`;return; }
    const profiles = await Promise.all(data.map(row => getProfile(row.blocked_id).catch(() => null)));
    if (user?.id !== accountId) return;
    list.replaceChildren(...data.map((row, index) => {
      const profile = profiles[index] || {}, name = profile.display_name || profile.username || t('account');
      const item = document.createElement('div');item.className = 'mw-ms-contact';
      item.innerHTML = `<span class="mw-ms-avatar" aria-hidden="true">${profile.avatar_url ? `<img src="${esc(window.MilkyWayMedia?.image(profile.avatar_url, 96) || profile.avatar_url)}" alt="" loading="lazy">` : esc(Array.from(name)[0] || '?')}</span><span class="mw-ms-name"><b>${esc(name)}</b>${profile.username ? `<small>@${esc(profile.username)}</small>` : ''}</span><button type="button" class="mw-pill ghost">${esc(t('unblock'))}</button>`;
      const unblock = item.querySelector('button');
      unblock.onclick = async () => {
        if (user?.id !== accountId || !(await window.MilkyWayDialog.confirm({ message: t('confirmUnblock') }))) return;
        unblock.disabled = true;
        const result = await sb.from('mw_blocks').delete().eq('blocker_id', accountId).eq('blocked_id', row.blocked_id).select('blocked_id');
        if (result.error || !result.data?.length) { toast(result.error?.message || t('permissionDenied'));unblock.disabled = false;return; }
        loadBlocked();if (typeof loadFeed === 'function') loadFeed();
      };
      return item;
    }));
  }

  // "Delete for me" on every message: DMs come from the inbox feed, groups from the memberships of this account.
  async function clearAllHistory() {
    const accountId = user?.id, button = byId('mwMsClearHistory');
    if (!accountId || !(await window.MilkyWayDialog.confirm({ title: t('clearAllHistoryTitle'), message: t('clearAllHistoryNote'), danger: true }))) return;
    const request = window.MilkyWayPremium.messageRequest;
    const hide = (ids, group) => request('?action=hide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, group }) });
    const sweep = async (query, group) => {
      for (let round = 0; round < 30; round++) {
        const { messages } = await request(query);
        const ids = (messages || []).map(message => message.id);
        if (!ids.length) return;
        await hide(ids, group);
      }
    };
    button.disabled = true;
    try {
      await sweep('?action=inbox');
      const { data } = await sb.from('mw_dm_group_members').select('group_id').eq('user_id', accountId);
      for (const row of data || []) await sweep(`?group=${encodeURIComponent(row.group_id)}`, row.group_id);
      if (user?.id !== accountId) return;
      say(t('chatCleared'), 'ok');
      if (typeof loadInbox === 'function') loadInbox();
    } catch (error) { say(error.message || t('retry'), 'error'); }
    finally { button.disabled = false; }
  }
  byId('mwMsClearHistory').addEventListener('click', clearAllHistory);

  byId('messageSettingsBtn').addEventListener('click', async () => {
    if (!requireLogin(t('messageSettings'))) return;
    const accountId = user.id;
    say();openSheet(panel.id);lock(true);
    paint(accountPreferences?.owner === accountId ? accountPreferences : {});
    loadBlocked();
    const preferences = await loadAccountPreferences();
    if (user?.id !== accountId) return;
    if (preferences) paint(preferences);else say(t('profileSettingsUnavailable'), 'error');
    lock(!preferences);
    panel.querySelector('.mw-ms-back').focus({ preventScroll: true });
  });
})();
