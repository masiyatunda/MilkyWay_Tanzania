// MilkyWay Coins administration inside the full admin dashboard (/admin.html): confirm mobile money coin purchases,
// send creator payouts (already net of the 40% company commission) and edit the payment instructions. Owner account only.
(() => {
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const endpoint = '/api/milkyway-wallet';
  const tzs = value => `${Number(value || 0).toLocaleString()} TZS`;
  // What the member saw in their own currency (saved from the country detected when they joined).
  const localAmount = (minor, currency, digits = 2) => {
    if (!currency || currency === 'TZS' || !minor) return '';
    try { return ` <small class="muted">≈ ${esc(new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: digits }).format(minor / 10 ** digits))} (${esc(currency)})</small>`; } catch { return ''; }
  };
  const coins = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const when = value => { try { return value ? new Date(value).toLocaleString() : '—'; } catch { return '—'; } };
  const NETWORKS = { mpesa: 'M-Pesa', mixx: 'Mixx by Yas (Tigo Pesa)', airtel: 'Airtel Money', halopesa: 'HaloPesa' };
  const STATUSES = {
    withdrawals: [['pending', 'Zinasubiri kulipwa / Waiting'], ['paid', 'Zimelipwa / Paid'], ['rejected', 'Zimekataliwa / Rejected']],
    topups: [['pending', 'Zinasubiri uthibitisho / Waiting'], ['approved', 'Code imetolewa / Code issued'], ['redeemed', 'Code imetumika / Redeemed'], ['rejected', 'Zimekataliwa / Rejected']],
  };

  async function api(action, body) {
    const current = (await sb.auth.getSession()).data.session;
    if (!current) throw new Error('Ingia kama Admin kwanza / Sign in as admin first.');
    const response = await fetch(`${endpoint}?action=${action}`, {
      method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(30000), body: body ? JSON.stringify(body) : undefined,
      headers: { Authorization: `Bearer ${current.access_token}`, apikey: sb.supabaseKey || '', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || 'Imeshindikana. Jaribu tena / Failed, retry.'), { status: response.status });
    return result;
  }
  const ask = (message, danger = false) => window.MilkyWayDialog ? window.MilkyWayDialog.confirm({ message, danger }) : Promise.resolve(confirm(message));
  const write = (message, value = '', confirmText) => window.MilkyWayDialog ? window.MilkyWayDialog.prompt({ message, value, maxLength: 300, confirmText }) : Promise.resolve(prompt(message, value));
  const set = (id, value) => { const element = el(id);if (element) element.textContent = value; };

  let owner = false, view = 'withdrawals', rows = [], generation = 0;
  async function summary() {
    const result = await api('admin-summary');
    set('mwwGifts', Number(result.gifts).toLocaleString());set('mwwGross', tzs(result.giftsGrossTzs));set('mwwCommission', tzs(result.commissionTzs));
    set('mwwOwed', tzs(result.creatorsOwedTzs));set('mwwCompany', tzs(result.companyWalletTzs));set('mwwPaid', tzs(result.paidOutTzs));
    set('mwwPayoutCount', result.pendingWithdrawals ? `(${result.pendingWithdrawals})` : '');set('mwwTopupCount', result.pendingTopups ? `(${result.pendingTopups})` : '');
    const badge = el('mwwBadge'), waiting = result.pendingWithdrawals + result.pendingTopups;
    if (badge) { badge.textContent = waiting;badge.style.display = waiting > 0 ? 'inline' : 'none'; }
    if (document.activeElement !== el('mwwInstructions')) el('mwwInstructions').value = result.paymentInstructions || '';
    const lipa = result.lipa || {};
    [['mwwLipaNumber', 'number'], ['mwwLipaName', 'name'], ['mwwLipaNetwork', 'network'], ['mwwLipaQr', 'qr']].forEach(([id, field]) => { if (el(id) && !el('mwwSettings').contains(document.activeElement)) el(id).value = lipa[field] || ''; });
  }
  const person = row => `<strong>${esc(row.name || 'Msafiri')}</strong>${row.username ? ` <small class="muted">@${esc(row.username)}</small>` : ''}`;
  function withdrawalRow(row) {
    const actions = row.status === 'pending' ? `<button class="btn" type="button" data-paid="${esc(row.id)}">✅ Nimelipa / Mark paid</button><button class="btn danger" type="button" data-reject="${esc(row.id)}">Kataa / Reject</button>` : `<span class="status-pill">${esc(row.status)}</span>`;
    return `<article class="item" data-id="${esc(row.id)}"><div style="flex:1;min-width:0">${person(row)}<br>`
      + `<b style="font-size:1.15rem">Lipa / Send: ${esc(tzs(row.payoutTzs))}</b>${localAmount(row.payoutLocalMinor, row.currency, row.localDigits)} <small class="muted">(${esc(coins(row.coins))} coins)</small><br>`
      + `<small>${esc(NETWORKS[row.network] || row.network)} · <b>+${esc(row.phone)}</b> · ${esc(row.accountName)}</small><br>`
      + `<small class="muted">Thamani ya zawadi / Gift value ${esc(tzs(row.grossTzs))} · Kamisheni / Commission 40% ${esc(tzs(row.commissionTzs))} · ${esc(when(row.createdAt))}</small>`
      + `${row.payoutRef ? `<br><small>Ref: ${esc(row.payoutRef)}</small>` : ''}${row.adminNote ? `<br><small class="muted">${esc(row.adminNote)}</small>` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div></article>`;
  }
  function topupRow(row) {
    const statusLabels = { pending: 'Inasubiri uthibitisho', approved: 'Code imetolewa', redeemed: 'Code imetumika', rejected: 'Imekataliwa' };
    const actions = row.status === 'pending' ? `<button class="btn" type="button" data-approve="${esc(row.id)}">✅ Idhinisha / Approve</button><button class="btn danger" type="button" data-reject="${esc(row.id)}">Kataa / Reject</button>` : `<span class="status-pill">${esc(statusLabels[row.status] || row.status)}</span>`;
    return `<article class="item" data-id="${esc(row.id)}"><div style="flex:1;min-width:0">${person(row)}<br>`
      + `<b style="font-size:1.1rem">${esc(Number(row.coins).toLocaleString())} coins · ${esc(tzs(row.amountTzs))}</b>${localAmount(row.amountLocalMinor, row.currency, row.localDigits)}<br>`
      + `<small>${esc(NETWORKS[row.network] || row.network)} · +${esc(row.phone)} · Ref: <b>${esc(row.reference)}</b></small><br><small class="muted">${esc(when(row.createdAt))}${row.adminNote ? ` · ${esc(row.adminNote)}` : ''}</small>`
      + `${row.status === 'approved' && row.verificationCode ? `<div style="margin-top:10px;padding:10px;border:1px solid var(--border,#888);border-radius:10px"><b>Namba ya mteja / Customer redemption code</b><div style="font-size:1.3rem;letter-spacing:.12em;font-weight:800;user-select:all">${esc(row.verificationCode)}</div><small class="muted">Mpe mteja aliyehusika tu baada ya kuthibitisha malipo. Itatumika mara moja.</small><button type="button" class="btn" data-copy-code="${esc(row.verificationCode)}">Nakili code / Copy code</button></div>` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${actions}</div></article>`;
  }
  async function load() {
    if (!owner) return;
    const serial = ++generation, list = el('mwwList');
    el('mwwMessage').textContent = '';
    summary().catch(error => { el('mwwMessage').textContent = error.message; });
    if (view === 'settings') { list.innerHTML = '';return; }
    list.innerHTML = '<p class="muted">Inapakia… / Loading…</p>';
    try {
      const status = el('mwwStatus').value || 'pending';
      const result = await api(`admin-${view}&status=${encodeURIComponent(status)}`);
      if (serial !== generation) return;
      rows = result[view] || [];
      list.innerHTML = rows.map(view === 'withdrawals' ? withdrawalRow : topupRow).join('') || '<p class="muted">Hakuna kitu hapa / Nothing here.</p>';
    } catch (error) { if (serial === generation) list.innerHTML = `<p class="muted">${esc(error.message)}</p>`; }
  }
  function setView(next) {
    view = next;
    document.querySelectorAll('[data-mww-view]').forEach(button => button.classList.toggle('active', button.dataset.mwwView === view));
    el('mwwSettings').hidden = view !== 'settings';el('mwwFilter').hidden = view === 'settings';
    if (view !== 'settings') el('mwwStatus').innerHTML = STATUSES[view].map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('');
    load();
  }
  function bind() {
    document.querySelectorAll('[data-mww-view]').forEach(button => button.onclick = () => setView(button.dataset.mwwView));
    el('mwwStatus').onchange = load;el('mwwRefresh').onclick = load;
    el('mwwSettings').onsubmit = async event => {
      event.preventDefault();
      try { await api('admin-settings', { paymentInstructions: el('mwwInstructions').value, lipa: { number: el('mwwLipaNumber').value, name: el('mwwLipaName').value, network: el('mwwLipaNetwork').value, qr: el('mwwLipaQr').value } });el('mwwMessage').textContent = 'Imehifadhiwa / Saved.'; }
      catch (error) { el('mwwMessage').textContent = error.message; }
    };
    el('mwwList').addEventListener('click', async event => {
      const copyButton = event.target.closest('button[data-copy-code]');
      if (copyButton) {
        const code = copyButton.dataset.copyCode || '';
        try { await navigator.clipboard.writeText(code); copyButton.textContent = 'Imenakili / Copied'; }
        catch { window.prompt('Nakili namba hii / Copy this code', code); }
        return;
      }
      const button = event.target.closest('button[data-paid],button[data-approve],button[data-reject]');
      if (!button) return;
      const row = rows.find(item => item.id === button.closest('[data-id]')?.dataset.id);
      if (!row) return;
      try {
        if (view === 'withdrawals' && button.hasAttribute('data-paid')) {
          const reference = await write(`Tuma ${tzs(row.payoutTzs)} kwa ${NETWORKS[row.network] || row.network} +${row.phone} (${row.accountName}), kisha weka namba ya muamala. / Send ${tzs(row.payoutTzs)} to +${row.phone}, then enter the payout transaction reference.`, '', 'Nimelipa / Mark paid');
          if (!reference) return;
          button.disabled = true;await api('admin-withdrawal', { id: row.id, decision: 'paid', payoutRef: reference });
        } else if (view === 'withdrawals') {
          const note = await write('Sababu ya kukataa (sarafu zitarudishwa kwa msanii) / Reason (the coins go back to the creator)', '', 'Kataa / Reject');
          if (note === null) return;
          button.disabled = true;await api('admin-withdrawal', { id: row.id, decision: 'reject', note });
        } else if (button.hasAttribute('data-approve')) {
          if (!(await ask(`Umethibitisha kupokea ${tzs(row.amountTzs)} (Ref ${row.reference})? Sarafu ${row.coins} zitaongezwa. / Confirm you verified this payment in the official M-Pesa Business history? A one-time code will be generated; coins are credited only when the customer redeems it.`))) return;
          button.disabled = true;await api('admin-topup', { id: row.id, decision: 'approve' });
        } else {
          const note = await write('Sababu ya kukataa / Reason for rejecting', '', 'Kataa / Reject');
          if (note === null) return;
          button.disabled = true;await api('admin-topup', { id: row.id, decision: 'reject', note });
        }
        await load();
      } catch (error) { el('mwwMessage').textContent = error.message;button.disabled = false; }
    });
  }

  let started = false, bound = false;
  async function start() {
    if (started || el('app').style.display === 'none') return;
    started = true;
    if (!bound) { bound = true;bind(); }
    try { await api('admin-summary');owner = true; } catch (error) { owner = false; }
    el('mwwOwnerOnly').hidden = owner;el('mwwTools').hidden = !owner;
    if (owner) setView(view);
    if (['#coins', '#payouts'].includes(location.hash)) openPanel('mwWallet');
  }
  document.querySelector('.tab[data-panel="mwWallet"]')?.addEventListener('click', () => { if (started && owner) load(); });
  sb.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { started = false;owner = false;rows = []; } });
  new MutationObserver(start).observe(el('app'), { attributes: true, attributeFilter: ['style'] });
  start();
})();
