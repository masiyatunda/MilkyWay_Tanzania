(() => {
  // Chats screen search: filters the existing chats and groups instantly while the people search
  // (in index.html) looks up other MilkyWay accounts to start a new conversation with.
  const byId = id => document.getElementById(id);
  const input = byId('dmPeopleSearch');
  const clear = byId('dmSearchClear');
  const empty = byId('dmSearchEmpty');
  const results = byId('dmPeopleSearchResults');
  const lists = [byId('groupList'), byId('msgList')].filter(Boolean);
  if (!input || !lists.length) return;
  const t = key => window.MilkyWayI18n?.t(key) || key;
  const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^@/, '').trim();

  function apply() {
    const term = fold(input.value);
    clear.hidden = !input.value;
    let matches = 0;
    for (const list of lists) {
      let shown = 0;
      for (const row of list.querySelectorAll('.wa-chat-row')) {
        const name = fold(row.dataset.name || row.querySelector('.wa-row-name')?.textContent);
        const preview = fold(row.querySelector('.wa-row-preview')?.textContent);
        const hit = !term || name.includes(term) || preview.includes(term);
        row.hidden = !hit;
        if (hit) shown++;
      }
      // Hide a section heading (and its "no chats yet" note) while searching if nothing in it matches.
      const heading = list.previousElementSibling?.matches('.wa-section') ? list.previousElementSibling : null;
      const searching = !!term;
      list.classList.toggle('mw-search-miss', searching && !shown);
      if (heading) heading.hidden = searching && !shown;
      matches += shown;
    }
    empty.hidden = !term || matches > 0 || isPhone(input.value);
    if (!empty.hidden) empty.textContent = t('noChatsMatch').replace('{q}', input.value.trim());
  }

  function reset() {
    input.value = '';
    results.innerHTML = '';
    apply();
  }

  input.addEventListener('input', apply);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && input.value) { event.preventDefault(); event.stopPropagation(); reset(); }
    if (event.key === 'Enter') {
      event.preventDefault();
      // Enter opens the first visible chat, or the first person found.
      const first = lists.flatMap(list => [...list.querySelectorAll('.wa-chat-row:not([hidden])')])[0] || results.querySelector('[data-dm-search-user]');
      first?.click();
    }
  });
  clear.addEventListener('click', () => { reset(); input.focus({ preventScroll: true }); });
  // The inbox re-renders while it is open; keep the current filter applied to new rows.
  const observer = new MutationObserver(() => { if (input.value) apply(); });
  lists.forEach(list => observer.observe(list, { childList: true }));
  // Opening a chat from the list leaves a clean search for next time.
  lists.forEach(list => list.addEventListener('click', event => { if (event.target.closest('.wa-chat-row') && input.value) setTimeout(reset); }));
  addEventListener('mw-language-change', apply);
  window.MilkyWayChatSearch = { clear: reset, apply };

  // Phone numbers: typing a number looks it up exactly on the server (numbers are never listed), then offers
  // Connect (follow request) and Message for an account that uses it, or an SMS / WhatsApp / share invite if none does.
  const accountApi = async (query, body) => {
    const auth = (await sb.auth.getSession()).data.session;
    if (!auth) throw new Error(t('authExpired'));
    const response = await fetch(`/api/milkyway-account?action=${query}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.access_token}`, apikey: sb.supabaseKey || '' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || `HTTP ${response.status}`), { status: response.status });
    return result;
  };
  function isPhone(value) {
    const raw = String(value || '').trim();
    return /^\+?[\d\s().-]{6,24}$/.test(raw) && raw.replace(/\D/g, '').length >= 8;
  }
  const savePhone = phone => accountApi('phone', { phone: String(phone || '').trim() });
  // A number given at sign-up is kept in the account metadata until it reaches the server, so accounts that
  // confirm their email first still get it saved on their first sign-in.
  async function syncSignupPhone() {
    const account = logged() ? user : null;
    const phone = account?.user_metadata?.mw_phone;
    if (!phone) return;
    const key = `mw_phone_synced_${account.id}`;
    if (localStorage.getItem(key) === phone) return;
    try { await savePhone(phone); localStorage.setItem(key, phone); }
    catch (error) { if (error.status === 400 || error.status === 409) localStorage.setItem(key, phone); }
  }
  sb.auth.onAuthStateChange(() => setTimeout(syncSignupPhone, 0));
  let phoneQuery = 0;
  function inviteLink() { return new URL('/milkyway/', location.origin).href; }
  async function searchPhone() {
    const query = input.value.trim();
    if (!isPhone(query) || !logged()) return;
    const ticket = ++phoneQuery;
    results.innerHTML = `<p class="muted">${esc(t('phoneSearching'))}</p>`;
    let found;
    try { found = await accountApi(`phone-lookup&q=${encodeURIComponent(query)}`); }
    catch { if (ticket === phoneQuery) results.innerHTML = `<p class="muted">${esc(t('phoneSearchFailed'))}</p>`; return; }
    const profiles = (await Promise.all((found.accounts || []).map(id => getProfile(id).catch(() => null)))).filter(Boolean);
    if (ticket !== phoneQuery || input.value.trim() !== query) return;
    const heading = `<h3 class="wa-section">${esc(t('phoneSearchTitle'))}</h3>`;
    if (profiles.length) {
      results.innerHTML = heading + profiles.map(p => `<div class="mw-phone-hit" data-account="${esc(p.id)}">${p.avatar_url ? `<img loading="lazy" decoding="async" src="${esc(window.MilkyWayMedia?.image(p.avatar_url, 160) || p.avatar_url)}" alt="">` : `<span class="wa-avatar" aria-hidden="true">${esc((p.display_name || p.username || 'M').trim().charAt(0).toUpperCase())}</span>`}<span class="mw-phone-who"><b data-mw-user-content>${esc(p.display_name || p.username || 'MilkyWay')}</b><small>@${esc(p.username || 'msafiri')}</small></span><span class="mw-phone-actions"><button type="button" class="btn primary" data-phone-connect>${esc(t('phoneConnect'))}</button><button type="button" class="btn ghost" data-phone-message>${esc(t('phoneMessage'))}</button></span></div>`).join('');
      results.querySelectorAll('.mw-phone-hit').forEach(row => {
        const id = row.dataset.account, name = row.querySelector('b').textContent, connect = row.querySelector('[data-phone-connect]');
        const show = following => { connect.textContent = t(following ? 'phoneConnected' : 'phoneConnect');connect.classList.toggle('primary', !following);connect.classList.toggle('ghost', following);connect.setAttribute('aria-pressed', String(following)); };
        const paintConnect = async () => {
          const { data, error } = await window.MilkyWayFollows.query(q => q.select('follower_id').eq('follower_id', user.id).eq('following_id', id).limit(1));
          if (!error) show(!!data?.length);
        };
        paintConnect().catch(() => {});
        // Following sends the person a follow notification, which is MilkyWay's connection request. The label changes
        // at once with every other follow button for this person, and goes back if the follow fails.
        const changed = event => { if (!connect.isConnected) { window.removeEventListener('mw-follow-change', changed);return; } if (event.detail?.id === id) show(!!event.detail.on); };
        window.addEventListener('mw-follow-change', changed);
        connect.onclick = () => toggleFollow(id, connect);
        row.querySelector('[data-phone-message]').onclick = () => { reset();openThread(id, name); };
      });
      return;
    }
    const shown = found.phone || query;
    const message = t('inviteText').replace('{url}', inviteLink());
    const digits = (found.phone || query).replace(/\D/g, '');
    results.innerHTML = `${heading}<div class="mw-phone-invite"><p class="muted">${esc(t('phoneNotOnMilkyWay').replace('{q}', shown))}</p><span class="mw-phone-actions"><a class="btn primary" data-invite="sms" href="sms:${esc(found.phone || query.replace(/[^\d+]/g, ''))}?&body=${encodeURIComponent(message)}">${esc(t('inviteSms'))}</a>${found.phone ? `<a class="btn ghost" data-invite="whatsapp" href="https://wa.me/${esc(digits)}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">${esc(t('inviteWhatsApp'))}</a>` : ''}<button type="button" class="btn ghost" data-invite="share">${esc(t('inviteShare'))}</button></span></div>`;
    results.querySelector('[data-invite="share"]').onclick = async () => {
      try {
        if (navigator.share) await navigator.share({ title: 'MilkyWay', text: message, url: inviteLink() });
        else { await navigator.clipboard.writeText(message); toast(t('inviteCopied')); }
      } catch (error) { if (error.name !== 'AbortError') toast(error.message); }
    };
  }
  let phoneTimer = null;
  input.addEventListener('input', () => { clearTimeout(phoneTimer); phoneQuery++; if (isPhone(input.value)) phoneTimer = setTimeout(searchPhone, 350); });
  // Profile: the same optional number can be added, changed or removed later.
  const profileSheet = byId('profileSheet'), profilePhone = byId('profilePhone');
  let savedPhone = '';
  if (profileSheet && profilePhone) {
    new MutationObserver(() => {
      if (!profileSheet.classList.contains('open') || !logged()) return;
      accountApi('phone').then(result => { savedPhone = result.phone || '';if (document.activeElement !== profilePhone) profilePhone.value = savedPhone; }).catch(() => {});
    }).observe(profileSheet, { attributes: true, attributeFilter: ['class'] });
    byId('saveProfileBtn')?.addEventListener('click', async () => {
      const phone = profilePhone.value.trim();
      if (phone === savedPhone || !logged()) return;
      if (phone && !isPhone(phone)) { toast(t('phoneInvalid')); return; }
      try { savedPhone = (await savePhone(phone)).phone || '';profilePhone.value = savedPhone; }
      catch (error) { toast(error.message || t('phoneInvalid')); }
    });
  }
  window.MilkyWayPhone = { isPhone, save: savePhone, sync: syncSignupPhone };

  // Call alerts: offers to register this device so calls ring when MilkyWay is closed.
  const alerts = byId('mwCallAlerts');
  const alertsButton = byId('mwCallAlertsBtn');
  const sheet = byId('msgSheet');
  let pushAvailable = null;
  async function refreshAlerts() {
    if (!alerts) return;
    const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const dismissed = sessionStorage.getItem('mw_call_alerts_dismissed') === '1';
    if (!supported || dismissed || !logged() || Notification.permission === 'denied') { alerts.hidden = true; return; }
    // Only offer the button once the server can actually send call pushes.
    pushAvailable ??= await window.MilkyWayLiveNotifications?.api('settings').then(result => !!result.pushAvailable, () => null);
    if (!pushAvailable) { alerts.hidden = true; return; }
    alerts.hidden = await window.MilkyWayLiveNotifications?.subscribed?.().catch(() => false) ?? true;
  }
  alertsButton?.addEventListener('click', async () => {
    alertsButton.disabled = true;
    try {
      await window.MilkyWayCalls.enableAlerts();
      alerts.hidden = true;
      toast(t('callAlertsOn'));
    } catch (error) { toast(error.message || t('callAlertsFailed')); }
    finally { alertsButton.disabled = false; }
  });
  byId('mwCallAlertsClose')?.addEventListener('click', () => { sessionStorage.setItem('mw_call_alerts_dismissed', '1'); alerts.hidden = true; });
  if (sheet) new MutationObserver(() => { if (sheet.classList.contains('open')) refreshAlerts(); else if (input.value) reset(); }).observe(sheet, { attributes: true, attributeFilter: ['class'] });
})();
