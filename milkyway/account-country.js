// Country detection: the sign-up form looks up where a new member is joining from (their network location,
// then the region their device reports) and records it with the account; the first sign-in saves it to the
// profile on the server. The profile shows it read-only. Prices and currencies are not affected here.
(() => {
  const byId = id => document.getElementById(id);
  const t = key => window.MilkyWayI18n?.t(key) || key;
  const endpoint = '/api/milkyway-account';
  const region = () => window.MilkyWayGifts?.region?.() || '';
  const account = () => (typeof user !== 'undefined' && user?.id ? user : null);

  async function detect() {
    try {
      const response = await fetch(`${endpoint}?action=detect-country`, { cache: 'no-store', signal: AbortSignal.timeout(4000), headers: { 'X-MW-Region': region() } });
      const found = response.ok ? await response.json() : null;
      if (/^[A-Z]{2}$/.test(found?.country || '')) return found;
    } catch {}
    return region() ? { country: region(), source: 'device' } : null;
  }

  async function api(method) {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error(t('authExpired'));
    const response = await fetch(`${endpoint}?action=country`, { method, cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}`, apikey: sb.supabaseKey || '', 'X-MW-Region': region() } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }

  // Saved once per account; accounts that confirmed their email first are saved on their first sign-in.
  let known = null;
  async function save() {
    const me = account();
    if (!me) return;
    const key = `mw_country_${me.id}`;
    if (localStorage.getItem(key)) { known = { country: localStorage.getItem(key) };paint();return; }
    try {
      const result = await api('POST');
      if (account()?.id !== me.id) return;
      known = result;
      if (result.country) localStorage.setItem(key, result.country);
      paint();
    } catch {}
  }
  sb.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { known = null;paint(); }
    if (['INITIAL_SESSION', 'SIGNED_IN'].includes(event)) setTimeout(save, 0);
  });

  const name = code => {
    try { return new Intl.DisplayNames([document.documentElement.lang || navigator.language || 'en'], { type: 'region' }).of(code) || code; } catch { return code; }
  };
  const flag = code => String.fromCodePoint(...[...code].map(letter => 0x1f1a5 + letter.charCodeAt(0)));

  // Profile: a read-only line under the phone number.
  const sheet = byId('profileSheet'), phone = byId('profilePhone');
  let row = null;
  function paint() {
    if (!row) return;
    const code = known?.country || '';
    row.hidden = !code;
    if (!code) return;
    row.querySelector('label').textContent = t('profileCountry');
    row.querySelector('.mw-country-value').textContent = `${flag(code)} ${name(code)}`;
    row.querySelector('small').textContent = t('profileCountryHint');
  }
  if (sheet && phone) {
    row = document.createElement('div');
    row.className = 'mw-profile-country';
    row.hidden = true;
    row.innerHTML = '<label></label><div class="input mw-country-value" aria-readonly="true"></div><small class="muted mw-auth-hint"></small>';
    const hint = phone.nextElementSibling?.matches('small') ? phone.nextElementSibling : phone;
    hint.after(row);
    new MutationObserver(() => {
      if (!sheet.classList.contains('open') || !account()) return;
      const me = account().id;
      api('GET').then(result => { if (account()?.id !== me) return;known = result;if (result.country) localStorage.setItem(`mw_country_${me}`, result.country);paint(); }).catch(() => {});
    }).observe(sheet, { attributes: true, attributeFilter: ['class'] });
    addEventListener('mw-language-change', paint);
  }

  window.MilkyWayCountry = { detect, save, current: () => known?.country || '' };
})();
