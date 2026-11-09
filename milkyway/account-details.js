// Date of birth and gender: asked on the sign-up form (Day / Month / Year and Male / Female / Other) and recorded
// with the account; the first sign-in saves them to the private profile record on the server and removes them from
// the account's sign-up data. The profile shows them to their owner only, who can correct them there.
(() => {
  const byId = id => document.getElementById(id);
  const t = key => window.MilkyWayI18n?.t(key) || key;
  const endpoint = '/api/milkyway-account?action=details';
  const account = () => (typeof user !== 'undefined' && user?.id ? user : null);
  const minimumAge = 13;
  const pad = number => String(number).padStart(2, '0');

  async function api(method, body) {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error(t('authExpired'));
    const response = await fetch(endpoint, { method, cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}`, apikey: sb.supabaseKey || '', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }

  const monthName = month => {
    try { return new Intl.DateTimeFormat(document.documentElement.lang || navigator.language || 'en', { month: 'long' }).format(new Date(Date.UTC(2000, month - 1, 1))); } catch { return String(month); }
  };
  const options = (placeholder, values, label = String) => `<option value="">${placeholder}</option>${values.map(value => `<option value="${value}">${label(value)}</option>`).join('')}`;
  const range = (from, to) => Array.from({ length: Math.abs(to - from) + 1 }, (_, index) => from < to ? from + index : from - index);

  // One set of fields, used both on the sign-up form and in the profile.
  function build(prefix) {
    const box = document.createElement('div');
    box.className = 'mw-details';
    box.innerHTML = `<label id="${prefix}BirthLabel"></label><div class="mw-birth" role="group" aria-labelledby="${prefix}BirthLabel"><select class="input" data-part="day"></select><select class="input" data-part="month"></select><select class="input" data-part="year"></select></div><label for="${prefix}Gender" data-label="gender"></label><select class="input" id="${prefix}Gender" data-part="gender"></select><small class="muted mw-auth-hint"></small>`;
    paint(box);
    return box;
  }
  function paint(box) {
    const keep = Object.fromEntries([...box.querySelectorAll('select')].map(select => [select.dataset.part, select.value]));
    const year = new Date().getFullYear();
    const part = name => box.querySelector(`[data-part="${name}"]`);
    box.querySelector('label').textContent = t('birthDate');
    box.querySelector('[data-label="gender"]').textContent = t('gender');
    box.querySelector('small').textContent = t('detailsPrivateHint');
    part('day').innerHTML = options(t('birthDay'), range(1, 31));
    part('month').innerHTML = options(t('birthMonth'), range(1, 12), monthName);
    part('year').innerHTML = options(t('birthYear'), range(year - minimumAge, year - 120));
    part('gender').innerHTML = options(t('genderChoose'), ['male', 'female', 'other'], value => t(`gender${value[0].toUpperCase()}${value.slice(1)}`));
    ['day', 'month', 'year', 'gender'].forEach(name => { part(name).setAttribute('aria-label', t({ day: 'birthDay', month: 'birthMonth', year: 'birthYear', gender: 'gender' }[name])); part(name).value = keep[name] || ''; });
  }
  function fill(box, { birthDate = '', gender = '' } = {}) {
    const [year, month, day] = birthDate.split('-').map(Number);
    box.querySelector('[data-part="day"]').value = day || '';
    box.querySelector('[data-part="month"]').value = month || '';
    box.querySelector('[data-part="year"]').value = year || '';
    box.querySelector('[data-part="gender"]').value = gender;
  }
  // Returns the chosen values, or an error message when something is missing or not a real date.
  function read(box) {
    const value = name => Number(box.querySelector(`[data-part="${name}"]`).value);
    const day = value('day'), month = value('month'), year = value('year');
    const gender = box.querySelector('[data-part="gender"]').value;
    const when = new Date(year, month - 1, day), today = new Date();
    const age = today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
    if (!day || !month || !year || when.getDate() !== day || when.getMonth() !== month - 1 || age < minimumAge) return { error: t('birthDateInvalid') };
    if (!gender) return { error: t('genderMissing') };
    return { birthDate: `${year}-${pad(month)}-${pad(day)}`, gender };
  }

  // Sign-up form: shown with the other sign-up fields.
  const signup = byId('authDetailsWrap') ? build('auth') : null;
  if (signup) byId('authDetailsWrap').append(signup);

  // After sign-in: save what the sign-up form recorded, then clear it from the account's sign-up data.
  async function save() {
    const me = account();
    if (!me?.user_metadata?.mw_birth_date) return;
    try {
      await api('POST');
      if (account()?.id !== me.id) return;
      const { data } = await sb.auth.updateUser({ data: { mw_birth_date: null, mw_gender: null } });
      if (data?.user && account()?.id === me.id) user = data.user;
    } catch {}
  }
  sb.auth.onAuthStateChange(event => { if (['INITIAL_SESSION', 'SIGNED_IN'].includes(event)) setTimeout(save, 0); });

  // Profile: the same fields under the country, filled from the private record and saved with the profile.
  const sheet = byId('profileSheet'), phone = byId('profilePhone');
  let profile = null, saved = { birthDate: '', gender: '' };
  if (sheet && phone) {
    profile = build('profile');
    const after = sheet.querySelector('.mw-profile-country') || (phone.nextElementSibling?.matches('small') ? phone.nextElementSibling : phone);
    after.after(profile);
    new MutationObserver(() => {
      if (!sheet.classList.contains('open') || !account()) return;
      const me = account().id;
      api('GET').then(result => { if (account()?.id !== me) return;saved = result;if (!profile.contains(document.activeElement)) fill(profile, result); }).catch(() => {});
    }).observe(sheet, { attributes: true, attributeFilter: ['class'] });
    byId('saveProfileBtn')?.addEventListener('click', async () => {
      if (!account()) return;
      const chosen = read(profile);
      const untouched = [...profile.querySelectorAll('select')].every(select => !select.value);
      if (untouched || (chosen.birthDate === saved.birthDate && chosen.gender === saved.gender)) return;
      if (chosen.error) { toast(chosen.error); return; }
      try {
        saved = await api('POST', chosen);
        document.dispatchEvent(new CustomEvent('mw-account-details-saved'));
      }
      catch (error) { toast(error.message); }
    });
  }
  addEventListener('mw-language-change', () => { if (signup) paint(signup); if (profile) paint(profile); });

  window.MilkyWayDetails = { read: () => (signup ? read(signup) : { error: t('birthDateInvalid') }), reset: () => signup && fill(signup), save };
})();
