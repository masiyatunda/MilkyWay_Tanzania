(() => {
  const byId = identity => document.getElementById(identity);
  const translate = key => window.MilkyWayI18n.t(key);
  // The header's three-line button is the one way into the Menu; My Account keeps only its four essentials.
  const trigger = byId('topMenuBtn');
  trigger.dataset.mwI18nAria = 'menu';trigger.setAttribute('aria-haspopup', 'dialog');trigger.setAttribute('aria-expanded', 'false');trigger.setAttribute('aria-controls', 'mwMainMenu');
  // Grouped sections; the account hub and the final layout pass add their existing tools to the same sections.
  const section = (id, key, hidden) => `<section class="mw-menu-section" id="${id}"${hidden ? ' hidden' : ''}>${key ? `<h3 data-mw-i18n="${key}"></h3>` : ''}</section>`;
  const overlay = document.createElement('div');overlay.id = 'mwMainMenu';overlay.className = 'mw-menu-overlay';overlay.hidden = true;
  overlay.innerHTML = '<section class="mw-menu-panel" role="dialog" aria-modal="true" aria-labelledby="mwMenuTitle"><header><h2 id="mwMenuTitle" data-mw-i18n="menu"></h2><button type="button" class="btn ghost" data-mw-i18n="close" id="mwMenuClose"></button></header><nav class="mw-menu-links mwx-no-translate" id="mwMenuLinks" aria-labelledby="mwMenuTitle">'
    + section('mwMenuAccount', 'menuAccount') + section('mwMenuContent', 'menuContent') + section('mwMenuBusiness', 'menuBusiness') + section('mwMenuHelp', 'menuHelp') + section('mwMenuAdmin', 'menuAdministration', true) + section('mwMenuSession')
    + '</nav><p id="mwMenuStatus" class="muted" role="status"></p></section>';
  document.body.append(overlay);
  let previousOverflow = '';
  const close = () => { if (overlay.hidden) return;overlay.hidden = true;trigger.setAttribute('aria-expanded', 'false');document.body.style.overflow = previousOverflow;trigger.focus({ preventScroll: true }); };
  trigger.addEventListener('click', () => { if (!overlay.hidden) return close();previousOverflow = document.body.style.overflow;overlay.hidden = false;trigger.setAttribute('aria-expanded', 'true');document.body.style.overflow = 'hidden';byId('mwMenuClose').focus(); });
  byId('mwMenuClose').onclick = close;overlay.onclick = event => { if (event.target === overlay) close(); };
  // Listen on the document so Escape still works after a click moves focus out of the panel.
  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') { event.preventDefault();close(); }
    if (event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('button,a,select')].filter(element => !element.hidden && !element.disabled && element.getClientRects().length);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault();controls.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault();controls[0].focus(); }
    else if (!overlay.contains(document.activeElement)) { event.preventDefault();controls[0]?.focus(); }
  });
  window.addEventListener('popstate', close);
  // Language stays in the header and, with Appearance, in Settings > Language & appearance, so the Menu repeats neither.
  const icon = path => `<span class="mwx-menu-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></span>`;
  const chevron = '<span class="mwx-chevron"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>';
  const icons = {
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1ZM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
    about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
    logout: '<path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
    addAccount: '<circle cx="10" cy="8.5" r="3.5"/><path d="M3.5 19.5a6.5 6.5 0 0 1 12.2-3.1M18.5 13.5v6M15.5 16.5h6"/>',
  };
  const fill = (element, key, iconName) => { element.classList.add('mwx-menu-item');element.innerHTML = `${icon(icons[iconName])}<span class="mwx-menu-label" data-mw-i18n="${key}"></span>${chevron}`;return element; };
  const action = (sectionId, key, iconName, callback) => { const button = fill(document.createElement('button'), key, iconName);button.type = 'button';button.onclick = () => { close();closeSheet('authModal');callback(); };byId(sectionId).append(button);return button; };
  const link = (sectionId, key, iconName, href) => { const anchor = fill(document.createElement('a'), key, iconName);anchor.href = href;anchor.onclick = close;byId(sectionId).append(anchor);return anchor; };
  // Account: "Sign up another account" keeps its existing handler and moves here from My Account.
  const another = byId('newAccountBtn');
  if (another) { fill(another, 'anotherAccount', 'addAccount');another.dataset.mwSignedIn = '';another.addEventListener('click', close);byId('mwMenuAccount').append(another); }
  // Business & services: campaigns (administrators only) and the Android app.
  const ads = action('mwMenuBusiness', 'manageAds', 'megaphone', () => window.MilkyWayPremium.openAdvertisements());ads.id = 'mwMenuAds';ads.hidden = true;
  const androidApp = link('mwMenuBusiness', 'getAndroidApp', 'download', 'download/MilkyWay.apk?v=7');androidApp.dataset.mwApk = '';androidApp.download = 'MilkyWay.apk';androidApp.type = 'application/vnd.android.package-archive';androidApp.dataset.mwI18nAria = 'downloadAndroidApp';
  const brandDownload = byId('mwApkLink');if (brandDownload) new MutationObserver(() => { androidApp.hidden = brandDownload.hidden; }).observe(brandDownload, { attributes: true, attributeFilter: ['hidden'] });
  // Help.
  const sheetAction = (key, iconName, sheet) => action('mwMenuHelp', key, iconName, () => { if (byId(sheet)) openSheet(sheet); });
  sheetAction('helpSupport', 'help', 'mwHelpSheet');sheetAction('aboutMilkyWay', 'about', 'mwAboutSheet');
  // Administration: the full dashboard, for verified administrators only (the owner's user panel joins from the account hub).
  const administrator = link('mwMenuAdmin', 'adminDashboard', 'shield', '/admin.html');administrator.id = 'mwAdminNavigation';administrator.hidden = true;
  // Settings (every preference lives there) and Log out close the Menu.
  action('mwMenuSession', 'settingsPrivacy', 'settings', () => openSettings());
  const signOut = action('mwMenuSession', 'logOut', 'logout', () => byId('logoutBtn').click());
  // Account tools (marked data-mw-signed-in) and Log out appear only while someone is signed in.
  const syncSignedIn = () => { overlay.querySelectorAll('[data-mw-signed-in]').forEach(item => { item.hidden = !logged(); });signOut.hidden = !logged(); };
  // A section with nothing visible in it (signed out, or no administrator access) is hidden with its heading.
  const sections = [...overlay.querySelectorAll('.mw-menu-section')];
  const tidySections = () => sections.forEach(group => { const empty = ![...group.children].some(child => child.tagName !== 'H3' && !child.hidden);if (group.hidden !== empty) group.hidden = empty; });
  new MutationObserver(tidySections).observe(byId('mwMenuLinks'), { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  tidySections();
  const accountAdministrator = byId('mwAccountAdmin');
  let authorizationGeneration = 0;
  async function verifyAccess() {
    const generation = ++authorizationGeneration;administrator.hidden = true;ads.hidden = true;if (accountAdministrator) accountAdministrator.hidden = true;syncSignedIn();
    byId('mwMenuStatus').textContent = '';
    try {
      const session = (await sb.auth.getSession()).data.session;
      if (!session) { window.MilkyWayPremium.setAdministrator(false);return; }
      const response = await fetch('/api/milkyway-account?action=admin-status', { headers: { Authorization: `Bearer ${session.access_token}`, apikey: sb.supabaseKey || '' }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(translate('adminAccessUnavailable'));
      const access = (await response.json()).isAdmin === true;
      if (generation !== authorizationGeneration) return;
      administrator.hidden = !access;ads.hidden = !access;if (accountAdministrator) accountAdministrator.hidden = !access;window.MilkyWayPremium.setAdministrator(access);
      if (access && location.hash === '#advertisements') window.MilkyWayPremium.openAdvertisements();
    } catch { if (generation === authorizationGeneration) { window.MilkyWayPremium.setAdministrator(false);byId('mwMenuStatus').textContent = translate('adminAccessUnavailable'); } }
  }
  sb.auth.onAuthStateChange(() => { window.setTimeout(verifyAccess, 0); });
  window.addEventListener('hashchange', () => { if (location.hash === '#advertisements' && !ads.hidden) window.MilkyWayPremium.openAdvertisements(); });
  window.addEventListener('mw-language-change', () => { if (byId('mwMenuStatus').textContent) byId('mwMenuStatus').textContent = translate('adminAccessUnavailable'); });
  verifyAccess();window.MilkyWayI18n.apply();
})();
