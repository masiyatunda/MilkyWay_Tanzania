// MilkyWay administration inside the full admin dashboard (/admin.html):
// members (suspend / unblock), suspension appeals, and paid advertising (feed orbit posts, banners, video pre-rolls).
(() => {
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const endpoint =   '/api/milkyway-account';
    const managedMedia = '/api/milkyway-account?action=campaign-media&key=';
  const when = value => { try { return value ? new Date(value).toLocaleString() : '—'; } catch { return '—'; } };
  const day = value => { try { return new Date(value).toLocaleDateString(); } catch { return ''; } };
  const LANGUAGES = { sw: 'Kiswahili', en: 'English', fr: 'Français', zh: '中文', ar: 'العربية', pt: 'Português', hi: 'हिन्दी', de: 'Deutsch' };
  const PLACEMENTS = { feed: '🪐 Orbit post (feed)', banner: '🏷 Banner (top of feed)', video: '▶ Video pre-roll' };

  async function session() {
    const current = (await sb.auth.getSession()).data.session;
    if (!current) throw new Error('Ingia kama Admin kwanza / Sign in as admin first.');
    return current;
  }
  async function api(action, { method = 'GET', query = '', body, form } = {}) {
    const current = await session();
    const response = await fetch(`${endpoint}?action=${action}${query}`, {
      method, cache: 'no-store', signal: AbortSignal.timeout(30000), body: form || (body ? JSON.stringify(body) : undefined),
      headers: { Authorization: `Bearer ${current.access_token}`, apikey: sb.supabaseKey || '', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Imeshindikana. Jaribu tena / Failed, retry.');
    return result;
  }
  const ask = (message, danger = false) => window.MilkyWayDialog ? window.MilkyWayDialog.confirm({ message, danger }) : Promise.resolve(confirm(message));
  const write = (message, value = '', confirmText) => window.MilkyWayDialog ? window.MilkyWayDialog.prompt({ message, value, multiline: true, maxLength: 300, confirmText }) : Promise.resolve(prompt(message, value));
  const badge = (identity, count) => { const element = el(identity);if (!element) return;element.textContent = count;element.style.display = count > 0 ? 'inline' : 'none'; };
  const stat = (identity, value) => { const element = el(identity);if (element) element.textContent = value; };

  let owner = false;

  // ---------- Members, suspensions and appeals ----------
  const members = { view: 'all', query: '', offset: 0, generation: 0 };
  function memberRow(account) {
    const suspended = account.status === 'suspended';
    const avatar = account.avatar && /^https:\/\//.test(account.avatar) ? `<img class="mwa-avatar" src="${esc(window.MilkyWayMedia?.image(account.avatar, 96) || account.avatar)}" alt="" loading="lazy">` : `<span class="mwa-avatar">${esc((account.name || 'M').slice(0, 1).toUpperCase())}</span>`;
    const pill = account.self ? '<span class="status-pill">Wewe / You</span>' : account.appealPending ? '<span class="status-pill mwa-warn">Rufaa inasubiri / Appeal pending</span>' : suspended ? '<span class="status-pill mwa-bad">Suspended</span>' : '<span class="status-pill mwa-good">Active</span>';
    const action = account.self ? '' : suspended ? `<button class="btn" type="button" data-unblock="${esc(account.id)}">🔓 Unblock</button>` : `<button class="btn danger" type="button" data-suspend="${esc(account.id)}">⛔ Suspend</button>`;
    const appeal = account.appealPending ? '<button class="btn" type="button" data-view-appeals style="background:#dfe7f1">View appeal</button>' : '';
    return `<article class="item mwa-member" data-id="${esc(account.id)}">${avatar}<div style="flex:1;min-width:0"><strong>${esc(account.name || 'Msafiri')}</strong> ${pill}<br><small class="muted">${account.username ? '@' + esc(account.username) + ' · ' : ''}Joined ${esc(day(account.createdAt))}${suspended && account.suspendedAt ? ' · Suspended ' + esc(when(account.suspendedAt)) : ''}</small>${suspended && account.reason ? `<br><small class="mwa-reason">${esc(account.reason)}</small>` : ''}</div><div class="mwa-actions">${appeal}${action}</div></article>`;
  }
  async function loadMembers(reset = true) {
    if (!owner) return;
    const generation = ++members.generation;
    const list = el('mwaMemberList'), status = el('mwaMemberStatus');
    if (reset) { members.offset = 0;list.innerHTML = '<p class="muted">Inapakia… / Loading…</p>'; }
    status.textContent = '';
    try {
      const result = await api('admin-users', { query: `&offset=${members.offset}${members.query ? `&q=${encodeURIComponent(members.query)}` : ''}${members.view === 'suspended' ? '&status=suspended' : ''}` });
      if (generation !== members.generation) return;
      if (reset) list.innerHTML = '';
      if (members.view === 'all' && !members.query) stat('mwaTotalUsers', result.total);
      stat('mwaSuspendedUsers', result.suspendedTotal);stat('mwaDashSuspended', result.suspendedTotal);
      list.insertAdjacentHTML('beforeend', result.users.map(memberRow).join(''));
      if (!list.children.length) list.innerHTML = `<p class="muted">${members.view === 'suspended' ? 'Hakuna akaunti iliyosimamishwa / No suspended accounts.' : 'Hakuna mtumiaji / No members found.'}</p>`;
      members.offset += result.users.length;
      el('mwaMemberMore').hidden = members.offset >= result.total || !result.users.length;
    } catch (error) { if (generation === members.generation) { status.textContent = error.message;if (reset) list.innerHTML = ''; } }
  }
  function appealCard(appeal) {
    const pending = appeal.status === 'pending';
    return `<article class="reg-card ${pending ? '' : appeal.status === 'approved' ? 'st-approved' : 'st-rejected'}" data-appeal="${esc(appeal.id)}"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><h3 style="margin:0">${esc(appeal.name || 'Msafiri')} ${appeal.username ? `<small class="muted">@${esc(appeal.username)}</small>` : ''}</h3><span class="reg-status">${esc({ pending: 'Inasubiri / Pending', approved: 'Imekubaliwa / Unblocked', rejected: 'Imekataliwa / Rejected' }[appeal.status] || appeal.status)}</span></div><div class="reg-meta"><div><b>Sent:</b> ${esc(when(appeal.createdAt))}</div><div><b>Suspension reason:</b> ${esc(appeal.reason || (appeal.suspended ? '—' : 'Not suspended any more'))}</div>${appeal.resolvedAt ? `<div><b>Reviewed:</b> ${esc(when(appeal.resolvedAt))}</div>` : ''}</div><p class="mwa-appeal-text">${esc(appeal.message)}</p>${pending ? `<div class="reg-actions"><textarea maxlength="500" placeholder="Note to the member (optional) / Ujumbe kwa mtumiaji"></textarea><button class="btn" type="button" data-decision="approve">🔓 Unblock account</button><button class="btn danger" type="button" data-decision="reject">Reject appeal</button></div>` : appeal.adminNote ? `<p class="muted"><b>Note:</b> ${esc(appeal.adminNote)}</p>` : ''}</article>`;
  }
  async function loadAppeals() {
    if (!owner) return;
    const list = el('mwaMemberList'), status = el('mwaMemberStatus');
    list.innerHTML = '<p class="muted">Inapakia… / Loading…</p>';status.textContent = '';el('mwaMemberMore').hidden = true;
    try {
      const result = await api('admin-appeals', { query: `&status=${members.view === 'history' ? el('mwaAppealHistory').value : 'pending'}` });
      stat('mwaPendingAppeals', result.pendingTotal);stat('mwaDashAppeals', result.pendingTotal);badge('mwaAppealBadge', result.pendingTotal);
      list.innerHTML = result.appeals.map(appealCard).join('') || `<p class="muted">${members.view === 'appeals' ? 'Hakuna rufaa mpya / No appeals waiting.' : 'Hakuna rufaa / No appeals.'}</p>`;
    } catch (error) { status.textContent = error.message;list.innerHTML = ''; }
  }
  const refreshMembers = () => ['appeals', 'history'].includes(members.view) ? loadAppeals() : loadMembers(true);
  function setView(view) {
    members.view = view;
    document.querySelectorAll('[data-mwa-view]').forEach(button => button.classList.toggle('active', button.dataset.mwaView === view));
    el('mwaMemberSearch').hidden = ['appeals', 'history'].includes(view);
    el('mwaAppealHistory').hidden = view !== 'history';
    refreshMembers();
  }
  async function appealCount() {
    try { const result = await api('admin-appeals', { query: '&status=pending' });stat('mwaPendingAppeals', result.pendingTotal);stat('mwaDashAppeals', result.pendingTotal);badge('mwaAppealBadge', result.pendingTotal); } catch {}
  }
  function bindMembers() {
    document.querySelectorAll('[data-mwa-view]').forEach(button => button.onclick = () => setView(button.dataset.mwaView));
    let timer = null;
    el('mwaMemberSearch').oninput = event => { clearTimeout(timer);timer = setTimeout(() => { members.query = event.target.value.trim();loadMembers(true); }, 400); };
    el('mwaMemberMore').onclick = () => loadMembers(false);
    el('mwaAppealHistory').onchange = loadAppeals;
    el('mwaMemberRefresh').onclick = () => { refreshMembers();appealCount(); };
    el('mwaMemberList').addEventListener('click', async event => {
      const button = event.target.closest('button');if (!button) return;
      const status = el('mwaMemberStatus');
      if (button.hasAttribute('data-view-appeals')) { setView('appeals');return; }
      try {
        if (button.dataset.suspend) {
          const reason = await write('Sababu ya kusimamisha (itaonyeshwa kwa mtumiaji) / Reason for suspension (shown to the member):', 'Ukiukaji wa masharti ya matumizi ya MilkyWay / Violation of the MilkyWay terms of use', '⛔ Suspend');
          if (reason === null) return;
          button.disabled = true;await api('admin-suspend', { method: 'POST', body: { userId: button.dataset.suspend, reason: reason.trim().slice(0, 300) } });
          status.textContent = 'Akaunti imesimamishwa / Account suspended.';
        } else if (button.dataset.unblock) {
          if (!(await ask('Fungua akaunti hii? Rufaa zinazosubiri zitakubaliwa. / Unblock this account? Any waiting appeal is approved.'))) return;
          button.disabled = true;await api('admin-restore', { method: 'POST', body: { userId: button.dataset.unblock } });
          status.textContent = 'Akaunti imefunguliwa / Account unblocked.';
        } else if (button.dataset.decision) {
          const card = button.closest('[data-appeal]');
          const approve = button.dataset.decision === 'approve';
          if (!(await ask(approve ? 'Kubali rufaa na ufungue akaunti? / Approve the appeal and unblock the account?' : 'Kataa rufaa hii? Akaunti itabaki imesimamishwa. / Reject this appeal? The account stays suspended.', !approve))) return;
          button.disabled = true;await api('admin-appeal', { method: 'POST', body: { id: card.dataset.appeal, decision: button.dataset.decision, note: card.querySelector('textarea')?.value || '' } });
          status.textContent = approve ? 'Rufaa imekubaliwa, akaunti imefunguliwa / Appeal approved, account unblocked.' : 'Rufaa imekataliwa / Appeal rejected.';
        } else return;
        refreshMembers();appealCount();
      } catch (error) { status.textContent = error.message;button.disabled = false; }
    });
  }

  // ---------- Paid advertising ----------
  let campaigns = [];
  const objectUrls = [];
  const isLive = campaign => campaign.status === 'approved' && campaign.paid && (!campaign.startsAt || Date.parse(campaign.startsAt) <= Date.now()) && (!campaign.endsAt || Date.parse(campaign.endsAt) > Date.now());
  function campaignState(campaign) {
    if (campaign.status === 'draft') return ['Draft', ''];
    if (campaign.status === 'paused') return ['Paused', 'mwa-warn'];
    if (!campaign.paid) return ['Awaiting payment', 'mwa-bad'];
    if (campaign.endsAt && Date.parse(campaign.endsAt) <= Date.now()) return ['Expired', ''];
    if (campaign.startsAt && Date.parse(campaign.startsAt) > Date.now()) return ['Scheduled', 'mwa-warn'];
    return ['● Live', 'mwa-good'];
  }
  // Uploaded media is private until the campaign is live, so previews are fetched with the admin session.
  async function preview(url, type, holder) {
    if (!url) { holder.innerHTML = '';return; }
    let source = url;
    if (url.startsWith(managedMedia)) {
      try { const current = await session();const response = await fetch(url, { headers: { Authorization: `Bearer ${current.access_token}`, apikey: sb.supabaseKey || '' } });if (!response.ok) throw new Error();source = URL.createObjectURL(await response.blob());objectUrls.push(source); }
      catch { holder.textContent = '⚠';return; }
    }
    const media = document.createElement(type === 'video' ? 'video' : 'img');media.src = source;media.className = 'thumb';
    if (type === 'video') { media.muted = true;media.preload = 'metadata';media.playsInline = true; } else media.alt = '';
    holder.replaceChildren(media);
  }
  function renderCampaigns() {
    objectUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
    const filter = el('mwaAdFilter').value;
    const shown = campaigns.filter(campaign => filter === 'all' || (filter === 'live' ? isLive(campaign) : filter === 'unpaid' ? !campaign.paid : (campaign.placement || 'feed') === filter));
    stat('mwaLiveAds', campaigns.filter(isLive).length);stat('mwaDashAds', campaigns.filter(isLive).length);
    stat('mwaUnpaidAds', campaigns.filter(campaign => !campaign.paid).length);
    const impressions = campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0), clicks = campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
    stat('mwaImpressions', impressions.toLocaleString());stat('mwaClicks', clicks.toLocaleString());
    el('mwaAdList').innerHTML = shown.map(campaign => {
      const [label, tone] = campaignState(campaign);
      const ctr = campaign.impressions ? `${((campaign.clicks || 0) / campaign.impressions * 100).toFixed(1)}%` : '—';
      const target = [campaign.targetLanguages ? `🗣 ${campaign.targetLanguages.split(',').map(code => LANGUAGES[code] || code).join(', ')}` : '', campaign.targetCountries ? `🌍 ${campaign.targetCountries.toUpperCase()}` : '', campaign.audience === 'members' ? '👤 Members only' : ''].filter(Boolean).join(' · ') || 'Everyone';
      return `<article class="item mwa-ad" data-id="${esc(campaign.id)}"><span class="mwa-preview" data-url="${esc(campaign.mediaUrl)}" data-type="${esc(campaign.mediaType)}"></span><div style="flex:1;min-width:0"><strong>${esc(campaign.business)}${campaign.title ? ' — ' + esc(campaign.title) : ''}</strong> <span class="status-pill ${tone}">${label}</span><br><small class="muted">${esc(PLACEMENTS[campaign.placement || 'feed'])} · ${esc(target)} · ${esc(day(campaign.startsAt || campaign.createdAt))}${campaign.endsAt ? ' → ' + esc(day(campaign.endsAt)) : ''}</small><br><small>${campaign.paid ? `💰 Paid ${esc(campaign.currency)} ${Number(campaign.amountPaid || 0).toLocaleString()}${campaign.paymentRef ? ' · Ref ' + esc(campaign.paymentRef) : ''}` : '<b class="mwa-reason">Not paid — will not be shown</b>'} · 👁 ${Number(campaign.impressions || 0).toLocaleString()} · 👆 ${Number(campaign.clicks || 0).toLocaleString()} · CTR ${ctr}</small></div><div class="mwa-actions"><button class="btn" type="button" data-edit style="background:#dfe7f1">Edit</button><button class="btn" type="button" data-toggle>${campaign.status === 'approved' ? 'Pause' : 'Approve'}</button><button class="btn danger" type="button" data-delete>Delete</button></div></article>`;
    }).join('') || '<p class="muted">Hakuna matangazo / No advertisements yet.</p>';
    el('mwaAdList').querySelectorAll('.mwa-preview').forEach(holder => preview(holder.dataset.url, holder.dataset.type, holder));
  }
  async function loadCampaigns() {
    const status = el('mwaAdStatus');
    try { campaigns = (await api('campaigns')).campaigns || [];renderCampaigns(); }
    catch (error) { status.textContent = error.message; }
  }
  const localTime = value => { if (!value) return '';const date = new Date(value);return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  function fillForm(campaign = null) {
    const form = el('mwaAdForm');form.reset();
    const values = campaign || { placement: 'feed', mediaType: 'image', status: 'draft', audience: 'all', frequency: 6, dismissDays: 7, skipAfter: 5, currency: 'TZS', amountPaid: 0, paid: false };
    for (const name of ['id', 'business', 'title', 'description', 'mediaUrl', 'mediaType', 'destination', 'ctaLabel', 'audience', 'frequency', 'dismissDays', 'status', 'placement', 'skipAfter', 'amountPaid', 'currency', 'paymentRef', 'targetCountries']) if (form.elements[name]) form.elements[name].value = values[name] ?? '';
    form.elements.paid.checked = values.paid === true;
    form.elements.startsAt.value = localTime(values.startsAt);form.elements.endsAt.value = localTime(values.endsAt);
    const languages = (values.targetLanguages || '').split(',');
    form.querySelectorAll('[name="lang"]').forEach(box => { box.checked = languages.includes(box.value); });
    el('mwaAdFormTitle').textContent = campaign ? `Edit: ${campaign.business}` : 'New advertisement / Tangazo jipya';
    el('mwaAdCancel').hidden = !campaign;
    placementHelp();preview(values.mediaUrl, values.mediaType, el('mwaAdPreview'));
  }
  function placementHelp() {
    const form = el('mwaAdForm'), placement = form.elements.placement.value;
    el('mwaSkipField').hidden = placement !== 'video';
    el('mwaFrequencyLabel').textContent = placement === 'video' ? 'Show before every Nth video played' : placement === 'banner' ? 'Rotation weight (3–20)' : 'Show after every N posts';
    el('mwaPlacementHelp').textContent = { feed: 'Appears as a sponsored post between members’ posts in the MilkyWay feed.', banner: 'A compact banner strip at the top of the feed. Several banners rotate every 30 seconds.', video: 'A skippable video (like YouTube) that plays before a feed video a member taps to watch. Needs an MP4/WebM video.' }[placement];
  }
  function bindAds() {
    const form = el('mwaAdForm'), status = el('mwaAdStatus');
    form.elements.placement.onchange = () => { if (form.elements.placement.value === 'video') form.elements.mediaType.value = 'video';placementHelp(); };
    form.elements.mediaUrl.onchange = () => preview(form.elements.mediaUrl.value, form.elements.mediaType.value, el('mwaAdPreview'));
    el('mwaAdFile').onchange = async event => {
      const file = event.target.files[0];if (!file) return;
      status.textContent = 'Inapakia faili… / Uploading…';
      try {
        const owner = (await session()).user.id;
        const extension = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
        const path = `milkyway/${owner}/campaigns/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await sb.storage.from('portfolio').upload(path, file, { contentType: file.type || undefined, cacheControl: '3600', upsert: false });
        if (uploadError) throw new Error(uploadError.message || 'Upload failed.');
        const result = await api('campaign-media', { method: 'POST', body: { url: sb.storage.from('portfolio').getPublicUrl(path).data.publicUrl, type: file.type.startsWith('video/') ? 'video' : 'image' } });
        form.elements.mediaUrl.value = result.mediaUrl;form.elements.mediaType.value = result.mediaType;
        status.textContent = 'Faili limepakiwa / File uploaded.';preview(result.mediaUrl, result.mediaType, el('mwaAdPreview'));
      } catch (error) { status.textContent = error.message;event.target.value = ''; }
    };
    el('mwaAdCancel').onclick = () => fillForm();
    el('mwaAdFilter').onchange = renderCampaigns;
    el('mwaAdRefresh').onclick = loadCampaigns;
    form.onsubmit = async event => {
      event.preventDefault();
      const field = name => form.elements[name].value.trim();
      const body = {
        id: field('id') || undefined, business: field('business'), title: field('title'), description: form.elements.description.value, mediaUrl: field('mediaUrl'), mediaType: field('mediaType'),
        destination: field('destination'), ctaLabel: field('ctaLabel'), status: field('status'), audience: field('audience'), frequency: Number(field('frequency')), dismissDays: Number(field('dismissDays')),
        startsAt: form.elements.startsAt.value ? new Date(form.elements.startsAt.value).toISOString() : null, endsAt: form.elements.endsAt.value ? new Date(form.elements.endsAt.value).toISOString() : null,
        placement: field('placement'), skipAfter: Number(field('skipAfter')), paid: form.elements.paid.checked, amountPaid: Number(field('amountPaid')), currency: field('currency').toUpperCase() || 'TZS', paymentRef: field('paymentRef'),
        targetLanguages: [...form.querySelectorAll('[name="lang"]:checked')].map(box => box.value).join(','), targetCountries: field('targetCountries'),
      };
      if (!body.mediaUrl) { status.textContent = 'Pakia picha/video au weka kiungo cha HTTPS / Upload media or paste an HTTPS link.';return; }
      if (body.status === 'approved' && !body.paid && !(await ask('Tangazo hili halijalipiwa, halitaonekana hadi malipo yarekodiwe. Endelea? / This ad is not marked paid and will not be shown until payment is recorded. Continue?'))) return;
      const submit = form.querySelector('[type="submit"]');submit.disabled = true;status.textContent = 'Inahifadhi… / Saving…';
      try { await api('campaigns', { method: 'POST', body });status.textContent = 'Tangazo limehifadhiwa / Advertisement saved.';fillForm();await loadCampaigns(); }
      catch (error) { status.textContent = error.message; }
      finally { submit.disabled = false; }
    };
    el('mwaAdList').addEventListener('click', async event => {
      const button = event.target.closest('button'), row = event.target.closest('[data-id]');if (!button || !row) return;
      const campaign = campaigns.find(item => item.id === row.dataset.id);if (!campaign) return;
      try {
        if (button.hasAttribute('data-edit')) { fillForm(campaign);el('mwaAdForm').scrollIntoView({ behavior: 'smooth', block: 'start' });return; }
        if (button.hasAttribute('data-toggle')) {
          const approve = campaign.status !== 'approved';
          if (approve && !campaign.paid && !(await ask('Tangazo hili halijalipiwa, halitaonekana hadi malipo yarekodiwe. Endelea? / Not paid yet, so it stays hidden until payment is recorded. Approve anyway?'))) return;
          button.disabled = true;
          const { id, business, title, description, mediaUrl, mediaType, destination, ctaLabel, audience, frequency, dismissDays, startsAt, endsAt } = campaign;
          await api('campaigns', { method: 'POST', body: { id, business, title, description, mediaUrl, mediaType, destination, ctaLabel, audience, frequency, dismissDays, startsAt, endsAt, status: approve ? 'approved' : 'paused' } });
        } else if (button.hasAttribute('data-delete')) {
          if (!(await ask(`Futa tangazo "${campaign.business}"? / Delete this advertisement?`, true))) return;
          button.disabled = true;await api('campaigns', { method: 'DELETE', query: `&id=${encodeURIComponent(campaign.id)}` });
        }
        await loadCampaigns();
      } catch (error) { status.textContent = error.message;button.disabled = false; }
    });
  }

  // ---------- Start once the dashboard has verified administrator access ----------
  let started = false, bound = false;
  const HASH = { '#users': 'mwUsers', '#appeals': 'mwUsers', '#suspended': 'mwUsers', '#ads': 'mwAds', '#advertisements': 'mwAds' };
  async function start() {
    if (started || el('app').style.display === 'none') return;
    started = true;
    el('mwaLanguages').innerHTML = Object.entries(LANGUAGES).map(([code, name]) => `<label class="mwa-check"><input type="checkbox" name="lang" value="${code}"> ${esc(name)}</label>`).join('');
    if (!bound) { bound = true;bindMembers();bindAds(); }
    fillForm();
    try { owner = (await api('admin-status')).owner === true; } catch { owner = false; }
    el('mwaOwnerOnly').hidden = owner;el('mwaMemberTools').hidden = !owner;
    if (owner) { setView(location.hash === '#appeals' ? 'appeals' : location.hash === '#suspended' ? 'suspended' : 'all');appealCount(); }
    loadCampaigns();
    const panel = HASH[location.hash];if (panel) openPanel(panel);
  }
  window.addEventListener('hashchange', () => { const panel = HASH[location.hash];if (panel && started) openPanel(panel); });
  document.querySelector('.tab[data-panel="mwUsers"]')?.addEventListener('click', () => { if (started && owner) { refreshMembers();appealCount(); } });
  document.querySelector('.tab[data-panel="mwAds"]')?.addEventListener('click', () => { if (started) loadCampaigns(); });
  // Signing out resets the module so the next administrator gets fresh data.
  sb.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { started = false;owner = false;campaigns = []; } });
  new MutationObserver(start).observe(el('app'), { attributes: true, attributeFilter: ['style'] });
  start();
})();
