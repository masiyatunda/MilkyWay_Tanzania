// My Account hub: Balance, the personal and creator tools in the Menu, and the owner-only user administration panel.
(() => {
  const byId = identity => document.getElementById(identity);
  const ownerEmail = 'masiyatunda@gmail.com';
  const offlineCache = 'mw-offline-videos';
  const offlineIndex = 'mw_offline_videos';
  const words = {
    myAccount: ['My Account', 'Akaunti yangu', 'Mon compte', '我的账户'],
    account: ['My Account', 'Akaunti yangu', 'Mon compte', '我的账户'],
    online: ['Online', 'Mtandaoni', 'En ligne', '在线'],
    myMedia: ['My Media', 'Media zangu', 'Mes médias', '我的媒体'],
    helpSupport: ['Help & Support', 'Msaada na huduma', 'Aide et assistance', '帮助与支持'],
    assets: ['Assets', 'Mali', 'Actifs', '资产'],
    balance: ['Balance', 'Salio', 'Solde', '余额'],
    personalTools: ['Personal tools', 'Zana binafsi', 'Outils personnels', '个人工具'],
    activityCentre: ['Activity centre', 'Kituo cha shughuli', 'Centre d’activité', '动态中心'],
    offlineVideos: ['Offline videos', 'Video za nje ya mtandao', 'Vidéos hors ligne', '离线视频'],
    qrCode: ['Your QR code', 'QR code yako', 'Votre code QR', '你的二维码'],
    creationTools: ['Creation & business tools', 'Zana za ubunifu na biashara', 'Outils de création et d’entreprise', '创作与商业工具'],
    studio: ['MilkyWay Studio', 'MilkyWay Studio', 'MilkyWay Studio', 'MilkyWay Studio'],
    studioTagline: ['Your deep-space creator control room', 'Chumba chako cha udhibiti wa ubunifu angani', 'Votre salle de contrôle créateur dans l’espace', '你的深空创作控制中心'],
    studioReady: ['Ready to go LIVE', 'Tayari kwenda LIVE', 'Prêt pour le direct', '准备开播'],
    studioOnAir: ['You are LIVE now', 'Uko LIVE sasa', 'Vous êtes en direct', '你正在直播'],
    returnLive: ['Return to LIVE', 'Rudi kwenye LIVE', 'Revenir au direct', '返回直播'],
    liveLayout: ['Multi-guest layout', 'Mpangilio wa wageni wengi', 'Disposition multi-invités', '多人连线布局'],
    liveLayoutHelp: ['Used the next time you go LIVE.', 'Utatumika utakapoenda LIVE tena.', 'Utilisée lors de votre prochain direct.', '下次开播时使用。'],
    studioCreate: ['Create', 'Unda', 'Créer', '创作'],
    studioInsights: ['Insights', 'Takwimu', 'Statistiques', '数据'],
    cameraMic: ['Camera + microphone', 'Kamera + kipaza sauti', 'Caméra + micro', '摄像头 + 麦克风'],
    voiceOnly: ['Voice only, no camera', 'Sauti tu, bila kamera', 'Voix seule, sans caméra', '仅语音，无摄像头'],
    settingsPrivacy: ['Settings and privacy', 'Mipangilio na faragha', 'Paramètres et confidentialité', '设置和隐私'],
    admin: ['Admin', 'Admin', 'Admin', '管理员'],
    adminPanel: ['Admin · Users', 'Admin · Watumiaji', 'Admin · Utilisateurs', '管理 · 用户'],
    editProfile: ['Edit profile', 'Hariri profile', 'Modifier le profil', '编辑资料'],
    saved: ['Saved', 'Vilivyohifadhiwa', 'Enregistrés', '已收藏'],
    close: ['Close', 'Funga', 'Fermer', '关闭'],
    coins: ['MilkyWay Coins', 'Sarafu za MilkyWay', 'Pièces MilkyWay', 'MilkyWay 币'],
    balanceNote: ['Buy coins with mobile money to send gifts. Coins you earn from gifts can be withdrawn from 50 coins.', 'Nunua sarafu kwa pesa ya simu ili kutuma zawadi. Sarafu unazopata kutoka zawadi zinaweza kutolewa kuanzia sarafu 50.'],
    lastUpdated: ['Last updated', 'Ilisasishwa'],
    neverUpdated: ['No transactions yet', 'Bado hakuna miamala'],
    recentPosts: ['Your recent posts', 'Posts zako za karibuni'],
    recentLives: ['Your recent LIVE sessions', 'LIVE zako za karibuni'],
    openNotifications: ['Open notifications', 'Fungua notifications'],
    nothingYet: ['Nothing here yet.', 'Bado hakuna kitu.'],
    offlineHelp: ['Videos you save stay on this device so you can watch them without a connection. Use “Save offline” under any video post.', 'Video unazohifadhi zinabaki kwenye kifaa hiki ili uzitazame bila mtandao. Tumia “Hifadhi offline” chini ya post yoyote ya video.'],
    saveOffline: ['Save offline', 'Hifadhi offline'],
    savedOffline: ['Saved offline', 'Imehifadhiwa offline'],
    saving: ['Saving…', 'Inahifadhi…'],
    play: ['Play', 'Cheza'],
    remove: ['Remove', 'Ondoa'],
    storageUsed: ['Storage used on this device', 'Hifadhi iliyotumika kwenye kifaa'],
    offlineUnsupported: ['This browser cannot store videos offline.', 'Kivinjari hiki hakiwezi kuhifadhi video offline.'],
    offlineFailed: ['The video could not be saved offline. Check your connection and storage space.', 'Video haikuweza kuhifadhiwa offline. Angalia mtandao na nafasi ya hifadhi.'],
    qrHelp: ['Friends can scan this code to open your MilkyWay profile.', 'Marafiki wanaweza kuskani code hii kufungua profile yako ya MilkyWay.'],
    share: ['Share', 'Shiriki'],
    copyLink: ['Copy link', 'Nakili link'],
    download: ['Download', 'Pakua'],
    copied: ['Link copied.', 'Link imenakiliwa.'],
    qrUnavailable: ['The QR code generator could not load. Check your connection and retry.', 'Kitengeneza QR code hakijapakia. Angalia mtandao na ujaribu tena.'],
    posts: ['Posts', 'Posts'],
    followers: ['Followers', 'Wafuasi'],
    following: ['Following', 'Unaowafuata'],
    liveSessions: ['LIVE sessions', 'Vipindi vya LIVE'],
    goVideoLive: ['Go Video LIVE', 'Anza Video LIVE'],
    goAudioLive: ['Go Audio LIVE', 'Anza Audio LIVE'],
    newPost: ['New post', 'Post mpya'],
    newStory: ['New story', 'Story mpya'],
    sessionHistory: ['Session history', 'Historia ya vipindi'],
    studioHelp: ['Create, go LIVE and track how your content performs.', 'Unda, nenda LIVE na fuatilia maudhui yako yanavyofanya.'],
    users: ['Registered users', 'Watumiaji waliosajiliwa'],
    suspended: ['Suspended', 'Wamesimamishwa'],
    all: ['All', 'Wote'],
    active: ['Active', 'Hai'],
    search: ['Search name or username', 'Tafuta jina au username'],
    suspend: ['Suspend', 'Simamisha'],
    restore: ['Restore', 'Rejesha'],
    reasonPrompt: ['Reason for suspension (shown to the user):', 'Sababu ya kusimamisha (itaonyeshwa kwa mtumiaji):'],
    defaultReason: ['Violation of the MilkyWay terms of use', 'Ukiukaji wa masharti ya matumizi ya MilkyWay'],
    confirmRestore: ['Restore this account?', 'Rejesha akaunti hii?'],
    loadMore: ['Load more', 'Pakia zaidi'],
    joined: ['Joined', 'Alijiunga'],
    you: ['You', 'Wewe'],
    fullDashboard: ['Open full admin dashboard', 'Fungua dashboard kamili ya admin'],
    appealPending: ['Appeal pending', 'Rufaa inasubiri'],
    appealButton: ['Appeal this suspension', 'Kata rufaa'],
    appealPrompt: ['Explain why your account should be unblocked (the MilkyWay team will review it):', 'Eleza kwa nini akaunti yako ifunguliwe (timu ya MilkyWay itakagua):'],
    appealSend: ['Send appeal', 'Tuma rufaa'],
    appealWaiting: ['Your appeal was received and is waiting for review.', 'Rufaa yako imepokelewa na inasubiri kukaguliwa.'],
    appealRejected: ['Your last appeal was declined.', 'Rufaa yako ya mwisho imekataliwa.'],
    adminNote: ['Suspended accounts are signed out of MilkyWay and blocked from going LIVE, joining Live stages, sending messages and posting comments through MilkyWay services.', 'Akaunti zilizosimamishwa zinatolewa MilkyWay na kuzuiwa kwenda LIVE, kujiunga na jukwaa la Live, kutuma ujumbe na kutoa maoni kupitia huduma za MilkyWay.'],
    accountSuspended: ['Account suspended', 'Akaunti imesimamishwa'],
    suspendedBody: ['This account has been suspended for violating the MilkyWay terms. If you believe this is a mistake, contact info@masiyatunda.com.', 'Akaunti hii imesimamishwa kwa kukiuka masharti ya MilkyWay. Kama unaamini ni kosa, wasiliana na info@masiyatunda.com.'],
    signOut: ['Sign out', 'Toka'],
    loading: ['Loading…', 'Inapakia…'],
    retry: ['Retry', 'Jaribu tena'],
    signInFirst: ['Sign in first.', 'Ingia kwanza.'],
  };
  const indexes = { en: 0, sw: 1, fr: 2, zh: 3 };
  const T = key => { const row = words[key];if (!row) return key;const language = window.MilkyWayI18n?.language?.() || 'sw';return row[indexes[language]] || window.MilkyWayLocales?.[language]?.[row[0]] || row[0]; };
  const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  const icons = {
    balance: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h2M3 10h18M7 6l3-3h4l3 3"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    offline: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    studio: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5V8ZM8 21h8M12 17v4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  };
  const signedIn = () => typeof logged === 'function' && logged() && user?.id;
  const ownerSignedIn = () => signedIn() && String(user.email || '').toLowerCase() === ownerEmail;
  let ownerVerified = false;
  async function api(action, { method = 'GET', query = '', body } = {}) {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error(T('signInFirst'));
    const response = await fetch(`/api/milkyway-account?action=${action}${query}`, {
      method, cache: 'no-store', signal: AbortSignal.timeout(15000), body: body ? JSON.stringify(body) : undefined,
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: sb.supabaseKey || '', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(window.MilkyWayI18n?.text(result.error) || result.error || T('retry'));
    return result;
  }
  const safeImage = value => { try { const address = new URL(value, location.origin);return ['https:', 'http:'].includes(address.protocol) ? address.href : ''; } catch { return ''; } };
  function face(element, picture, name) {
    element.textContent = String(name || 'M').slice(0, 1).toUpperCase();
    const source = picture && safeImage(window.MilkyWayMedia?.image ? window.MilkyWayMedia.image(picture, 96) : picture);
    if (!source) return;
    const image = document.createElement('img');image.alt = '';image.loading = 'lazy';image.src = source;
    image.onerror = () => { element.textContent = String(name || 'M').slice(0, 1).toUpperCase(); };
    element.replaceChildren(image);
  }
  const when = value => { try { return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };

  // Generic bottom sheet that matches the existing .sheet-bg/.sheet pattern.
  function sheet(id, titleKey) {
    let backdrop = byId(id);
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');backdrop.className = 'sheet-bg mwx-sheet mwx-no-translate';backdrop.id = id;
    backdrop.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${id}Title"><button type="button" class="close" aria-label="${T('close')}">×</button><h2 id="${id}Title" data-mwx="${titleKey}">${T(titleKey)}</h2><div class="mwx-sheet-body"></div></div>`;
    backdrop.querySelector('.close').onclick = () => closeSheet(id);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeSheet(id); });
    document.body.append(backdrop);
    return backdrop;
  }
  const body = id => byId(id).querySelector('.mwx-sheet-body');

  // ---------- Menu ----------
  // My Account shows only My Profile, Balance, Administration and Log out (static markup); taps on its Balance tile open the wallet.
  function buildMenu() {
    const box = byId('loggedBox');
    const item = (hub, iconName, key, extra = '') => `<button type="button" class="mwx-menu-item" data-hub="${hub}"><span class="mwx-menu-icon">${icon(icons[iconName])}</span><span class="mwx-menu-label" data-mwx="${key}">${T(key)}</span>${extra}<span class="mwx-chevron">${icon(icons.chevron)}</span></button>`;
    // Build the main navigation independently of the sign-in modal. A missing or
    // already-initialized loggedBox must never prevent items appearing in the header menu.
    if (box && !box.dataset.mwxReady) {
      box.dataset.mwxReady = 'true';
      box.addEventListener('click', event => {
        const accountTarget = event.target.closest('[data-account-go]');
        if (accountTarget) {
          event.preventDefault();
          event.stopPropagation();
          const destination = accountTarget.dataset.accountGo;
          closeSheet('authModal');
          // Run navigation on the next microtask after the parent account sheet has
          // started closing, preventing the parent/backdrop click handler from
          // overriding the destination and returning to Orbit.
          if (destination === 'profile') { Promise.resolve().then(() => openProfile()); return; }
          if (destination === 'media') { Promise.resolve().then(() => openGalleryFromMenu()); return; }
          if (destination === 'posts') { Promise.resolve().then(() => openMyPostsFromMenu()); return; }
        }
        const target = event.target.closest('[data-hub]');
        if (target) {
          event.preventDefault();
          event.stopPropagation();
          open(target.dataset.hub);
        }
      });
    }
    buildDrawerTools(item);
    const adminButton = byId('mwxAdminButton');
    if (adminButton) adminButton.onclick = () => { byId('mwMenuClose')?.click();openAdmin(); };
    paintOfflineCount();
  }
  // Personal, content, creation and owner tools go into the Menu's grouped sections (built by release-shell.js).
  function buildDrawerTools(item) {
    const links = byId('mwMenuLinks');
    if (!links) return;
    const place = (sectionId, html) => {
      const section = byId(sectionId);
      if (!section) return;
      const template = document.createElement('template');
      template.innerHTML = html.trim();
      const element = template.content.firstElementChild;
      if (!element) return;
      const hub = element.dataset.hub;
      // Add each menu item independently. Do not let one pre-existing item
      // prevent the other required items from being inserted.
      if (section.querySelector(`[data-hub="${hub}"]`)) return;
      const heading = section.querySelector('h3');
      if (heading) heading.insertAdjacentElement('afterend', element);
      else section.insertAdjacentElement('afterbegin', element);
    };
    place('mwMenuAccount', item('profile', 'user', 'editProfile'));
    place('mwMenuAccount', item('balance', 'balance', 'balance'));
    place('mwMenuAccount', item('saved', 'star', 'saved'));
    place('mwMenuAccount', item('qr', 'qr', 'qrCode'));
    place('mwMenuContent', item('activity', 'activity', 'activityCentre'));
    place('mwMenuContent', item('offline', 'offline', 'offlineVideos', '<small id="mwxOfflineCount" class="mwx-menu-value"></small>'));
    // Gallery is a first-class main-menu item; do not rely on a separate layout script.
    if (!byId('mwFinalGalleryItem') && !byId('mwxGalleryMenuItem')) {
      const gallery = document.createElement('button');
      gallery.type = 'button';gallery.id = 'mwxGalleryMenuItem';gallery.className = 'mwx-menu-item';
      gallery.innerHTML = `<span class="mwx-menu-icon">${icon(icons.user)}</span><span class="mwx-menu-label" data-mwx-final="gallery">Gallery</span><span class="mwx-chevron">${icon(icons.chevron)}</span>`;
      gallery.addEventListener('click', () => { byId('mwMenuClose')?.click();openGalleryFromMenu(); });
      byId('mwMenuContent')?.append(gallery);
    }
    // Studio must always be visible in the main menu, including before login.
    place('mwMenuBusiness', item('studio', 'studio', 'studio'));
    if (!byId('mwxAdminButton')) {
      byId('mwMenuAdmin')?.insertAdjacentHTML('beforeend', `<button type="button" id="mwxAdminButton" class="mwx-menu-item" hidden><span class="mwx-menu-icon">${icon(icons.shield)}</span><span class="mwx-menu-label" data-mwx="adminPanel">${T('adminPanel')}</span><span class="mwx-chevron">${icon(icons.chevron)}</span></button>`);
    }
    const profileLabel = links.querySelector('[data-hub="profile"] .mwx-menu-label');
    if (profileLabel) { delete profileLabel.dataset.mwx;profileLabel.dataset.mwI18n = 'profile';profileLabel.textContent = window.MilkyWayI18n?.t('profile') || 'My profile'; }
    if (!links.dataset.mwxHubClickBound) {
      links.dataset.mwxHubClickBound = 'true';
      links.addEventListener('click', event => {
        const target = event.target.closest('.mwx-menu-item[data-hub]');
        if (!target) return;
        byId('mwMenuClose')?.click();
        open(target.dataset.hub);
      });
    }
    const sync = () => {
      const on = Boolean(signedIn());
      links.querySelectorAll('.mwx-menu-item[data-hub]').forEach(element => {
        const hub = element.dataset.hub;
        // Keep the requested navigation entries visible in the main menu even when
        // signed out. Actions that require an account route to login in open(hub).
        const alwaysVisible = ['offline', 'qr', 'activity', 'studio', 'settings'];
        element.hidden = !on && !alwaysVisible.includes(hub);
      });
      // Gallery is not a data-hub item; keep it visible as a first-class menu entry.
      const gallery = byId('mwxGalleryMenuItem') || byId('mwFinalGalleryItem');
      if (gallery) gallery.hidden = false;
      // Ensure the content and creation sections remain available to the menu renderer.
      ['mwMenuContent', 'mwMenuBusiness', 'mwMenuSession'].forEach(id => {
        const section = byId(id);
        if (section && [...section.children].some(child => child.tagName !== 'H3' && !child.hidden)) section.hidden = false;
      });
    };
    if (!links.dataset.mwxHubSyncBound) {
      links.dataset.mwxHubSyncBound = 'true';
      byId('topMenuBtn')?.addEventListener('click', sync, true);
      sb.auth.onAuthStateChange(() => window.setTimeout(sync, 0));
    }
    sync();
  }
  function openMyPostsFromMenu() {
    if (!signedIn()) { openAuth('login'); return; }
    // Load the existing post list through the current data flow, then move its live
    // DOM node into a dedicated page. Profile and My Posts must never be shown together.
    openProfile().then(() => {
      const posts = byId('profilePosts');
      if (!posts) { toast(T('retry')); return; }
      const id = 'mwxStandalonePostsSheet';
      const backdrop = sheet(id, 'myPosts');
      const panel = body(id);
      if (!posts.dataset.mwxPostsHome) {
        const marker = document.createComment('MilkyWay posts home');
        posts.parentNode?.insertBefore(marker, posts);
        posts.dataset.mwxPostsHome = '1';
        posts._mwxHomeMarker = marker;
      }
      const restorePosts = () => {
        posts.hidden = true;
        const marker = posts._mwxHomeMarker;
        if (marker?.parentNode) marker.parentNode.insertBefore(posts, marker.nextSibling);
        if (marker?.parentNode) marker.remove();
        delete posts.dataset.mwxPostsHome;
        delete posts._mwxHomeMarker;
      };
      if (!backdrop.dataset.mwxPostsRestoreBound) {
        backdrop.dataset.mwxPostsRestoreBound = 'true';
        backdrop.querySelector('.close')?.addEventListener('click', restorePosts);
        backdrop.addEventListener('click', event => { if (event.target === backdrop) restorePosts(); });
        backdrop.addEventListener('transitionend', () => { if (!backdrop.classList.contains('open')) restorePosts(); });
      }
      panel.replaceChildren();
      const nav = document.createElement('div');
      nav.className = 'mwx-gallery-page-nav';
      nav.innerHTML = '<button type="button" class="btn ghost" data-posts-back>← Back to MilkyWay Galaxy</button><button type="button" class="btn ghost" data-posts-orbit>↩ Return to Orbit</button>';
      nav.querySelector('[data-posts-back]').addEventListener('click', () => {
        closeSheet(id); restorePosts(); openProfile();
      });
      nav.querySelector('[data-posts-orbit]').addEventListener('click', () => {
        closeSheet(id); restorePosts(); closeSheet('profileSheet'); closeSheet('settingsSheet');
        document.querySelector('#allFeedBtn, [data-nav="orbit"], #orbitTab, #feedTab')?.click();
      });
      posts.hidden = false;
      panel.append(nav, posts);
      closeSheet('authModal'); closeSheet('profileSheet'); closeSheet('settingsSheet');
      closeSheet('mwxBalanceSheet'); closeSheet('mwxStandaloneGallerySheet');
      openSheet(id);
    }).catch(() => toast(T('retry')));
  }

  function openGalleryFromMenu() {
    if (!signedIn()) { openAuth('login');return; }
    // Gallery is a distinct screen, not a section embedded in the Profile screen.
    // Load the existing gallery first so its original data/events remain intact, then
    // move (never clone) the live DOM node into its own full-screen sheet.
    openProfile().then(() => {
      const gallery = byId('mwProfileGallery');
      if (!gallery) { toast(T('retry'));return; }
      const id = 'mwxStandaloneGallerySheet';
      const backdrop = sheet(id, 'myMedia');
      const panel = body(id);
      if (!gallery.dataset.mwxGalleryHome) {
        const marker = document.createComment('MilkyWay gallery home');
        gallery.parentNode?.insertBefore(marker, gallery);
        gallery.dataset.mwxGalleryHome = '1';
        gallery._mwxHomeMarker = marker;
      }
      const restoreGallery = () => {
        const marker = gallery._mwxHomeMarker;
        if (marker?.parentNode) marker.parentNode.insertBefore(gallery, marker.nextSibling);
        if (marker?.parentNode) marker.remove();
        delete gallery.dataset.mwxGalleryHome;
        delete gallery._mwxHomeMarker;
      };
      if (!backdrop.dataset.mwxGalleryRestoreBound) {
        backdrop.dataset.mwxGalleryRestoreBound = '1';
        backdrop.querySelector('.close')?.addEventListener('click', restoreGallery);
        backdrop.addEventListener('click', event => { if (event.target === backdrop) restoreGallery(); });
        backdrop.addEventListener('transitionend', () => { if (!backdrop.classList.contains('open')) restoreGallery(); });
      }
      panel.replaceChildren();
      const nav = document.createElement('div');
      nav.className = 'mwx-gallery-page-nav';
      nav.innerHTML = '<button type="button" class="btn ghost" data-gallery-back>← Back to MilkyWay Galaxy</button><button type="button" class="btn ghost" data-gallery-orbit>↩ Return to Orbit</button>';
      nav.querySelector('[data-gallery-back]').addEventListener('click', () => {
        closeSheet(id);
        // Return to the account hub/profile parent only after Gallery is closed.
        openProfile();
      });
      nav.querySelector('[data-gallery-orbit]').addEventListener('click', () => {
        closeSheet(id);
        closeSheet('profileSheet');
        closeSheet('settingsSheet');
        document.querySelector('#allFeedBtn, [data-nav="orbit"], #orbitTab, #feedTab')?.click();
      });
      gallery.hidden = false;
      panel.append(nav, gallery);
      closeSheet('authModal');
      // Profile owns the original Gallery container. Once moved, close all account
      // parent sheets so only the independent Gallery page remains visible.
      closeSheet('profileSheet');
      closeSheet('settingsSheet');
      closeSheet('mwxBalanceSheet');
      openSheet(id);
    }).catch(() => toast(T('retry')));
  }
  function openHelp() {
    const id = 'mwxHelpSheet';
    const panel = sheet(id, 'helpSupport');
    panel.classList.add('mws-sheet');
    body(id).innerHTML = `<p style="line-height:1.55;margin:8px 0 14px">MilkyWay Help &amp; Support</p>
      <div class="mwx-list">
        <div class="mwx-list-row"><div><strong>Profile and photo</strong><small>Open Edit Profile to update your name, username details, bio and profile picture.</small></div></div>
        <div class="mwx-list-row"><div><strong>Posts and media</strong><small>Use My Posts or My Media to open the related section of your profile.</small></div></div>
        <div class="mwx-list-row"><div><strong>Account settings</strong><small>Open Settings to manage language, notifications and privacy.</small></div></div>
      </div>
      <p class="mwx-small" style="margin-top:14px;color:var(--muted)">If a feature does not open or save correctly, take a screenshot of the error and share it with the MilkyWay administrator.</p>`;
    openSheet(id);
  }
  function open(hub) {
    if (hub === 'edit' || hub === 'profile') { closeSheet('authModal');return openProfile(); }
    if (hub === 'saved') return openSaved();
    if (hub === 'settings') { closeSheet('authModal');return openSettings(); }
    if (hub === 'help') return openHelp();
    if (hub === 'offline') return openOffline();
    if (!signedIn()) { openAuth('login');return; }
    if (hub === 'balance') return openBalance();
    if (hub === 'activity') return openActivity();
    if (hub === 'qr') return openQr();
    if (hub === 'studio') return openStudio();
  }
  function paint() {
    document.querySelectorAll('[data-mwx]').forEach(element => { const value = T(element.dataset.mwx);if (element.textContent !== value) element.textContent = value; });
    document.querySelectorAll('[data-mwx-aria]').forEach(element => { element.setAttribute('aria-label', T(element.dataset.mwxAria));element.title = T(element.dataset.mwxAria); });
  }

  // ---------- Balance ----------
  // The last known balance is kept on this device per account, so it shows at once (even offline or on a slow
  // connection) while the live figure loads.
  const balanceKey = () => `mw_balance_${user.id}`;
  const savedBalance = () => { try { const saved = localStorage.getItem(balanceKey());return saved === null ? null : Number(saved); } catch { return null; } };
  const saveBalance = coins => { try { localStorage.setItem(balanceKey(), String(Number(coins || 0))); } catch {} };
  async function refreshBalance() {
    const value = byId('mwxBalanceValue');
    if (!value || !signedIn()) return null;
    const saved = savedBalance();
    if (saved !== null && value.textContent === '—') value.textContent = saved.toLocaleString();
    try { const result = await api('balance');if (!signedIn()) return null;value.textContent = Number(result.coins || 0).toLocaleString();saveBalance(result.coins);return result; }
    catch { value.textContent = saved !== null ? saved.toLocaleString() : '—';return null; }
  }
  async function openBalance() {
    if (window.MilkyWayGifts) return window.MilkyWayGifts.openWallet();
    const id = 'mwxBalanceSheet';sheet(id, 'balance');
    const panel = body(id);
    panel.innerHTML = `<div class="mwx-balance"><span class="mwx-coin" aria-hidden="true">✦</span><strong id="mwxBalanceCoins">…</strong><small data-mwx="coins">${T('coins')}</small></div><p class="muted" data-mwx="balanceNote">${T('balanceNote')}</p><p class="muted" id="mwxBalanceUpdated"></p>`;
    openSheet(id);
    const result = await refreshBalance();
    byId('mwxBalanceCoins').textContent = result ? Number(result.coins || 0).toLocaleString() : '—';
    byId('mwxBalanceUpdated').textContent = result ? result.updatedAt ? `${T('lastUpdated')}: ${when(result.updatedAt)}` : T('neverUpdated') : T('retry');
  }

  // ---------- Activity centre ----------
  async function openActivity() {
    const id = 'mwxActivitySheet';sheet(id, 'activityCentre');
    const panel = body(id);const accountId = user.id;
    panel.innerHTML = `<button type="button" class="btn primary mwx-wide" id="mwxOpenNotifications" data-mwx="openNotifications">${T('openNotifications')}</button><h3 data-mwx="recentPosts">${T('recentPosts')}</h3><div id="mwxActivityPosts" class="mwx-list mwx-no-translate"><p class="muted">${T('loading')}</p></div><h3 data-mwx="recentLives">${T('recentLives')}</h3><div id="mwxActivityLives" class="mwx-list mwx-no-translate"><p class="muted">${T('loading')}</p></div>`;
    byId('mwxOpenNotifications').onclick = () => { closeSheet(id);closeSheet('authModal');openSheet('notifySheet');loadNotifications(); };
    openSheet(id);
    const [posts, lives] = await Promise.all([
      sb.from('mw_posts').select('id,caption,media_type,created_at').eq('author_id', accountId).order('created_at', { ascending: false }).limit(8),
      sb.from('mw_video_live_sessions').select('id,title,room_name,is_live,started_at,ended_at').eq('host_id', accountId).order('started_at', { ascending: false }).limit(6),
    ]);
    if (user?.id !== accountId) return;
    const render = (target, rows, line) => {
      const list = byId(target);list.replaceChildren();
      if (!rows?.length) { list.innerHTML = `<p class="muted">${T('nothingYet')}</p>`;return; }
      rows.forEach(row => { const entry = document.createElement('div');entry.className = 'mwx-list-row';const [title, detail] = line(row);const strong = document.createElement('strong');strong.textContent = title;const small = document.createElement('small');small.textContent = detail;entry.append(strong, small);list.append(entry); });
    };
    render('mwxActivityPosts', posts.error ? [] : posts.data, row => [String(row.caption || (row.media_type === 'video' ? '🎬' : row.media_type === 'image' ? '🖼' : '✦')).slice(0, 90), `${row.media_type || 'text'} · ${typeof ago === 'function' ? ago(row.created_at) : when(row.created_at)}`]);
    render('mwxActivityLives', lives.error ? [] : lives.data, row => [String(row.title || 'LIVE').slice(0, 90), `${/audio/.test(row.room_name || '') ? 'Audio' : 'Video'} LIVE · ${row.is_live ? 'LIVE' : when(row.started_at)}`]);
  }

  // ---------- Offline videos ----------
  const readIndex = () => { try { const list = JSON.parse(localStorage.getItem(offlineIndex) || '[]');return Array.isArray(list) ? list.filter(item => typeof item?.url === 'string') : []; } catch { return []; } };
  const writeIndex = list => { localStorage.setItem(offlineIndex, JSON.stringify(list.slice(0, 50)));paintOfflineCount(); };
  function paintOfflineCount() { const count = byId('mwxOfflineCount');if (count) count.textContent = readIndex().length ? String(readIndex().length) : ''; }
  async function saveOffline(video, button) {
    if (!('caches' in window)) { toast(T('offlineUnsupported'));return; }
    const url = video.currentSrc || video.src;
    if (!url || url.startsWith('blob:')) return;
    button.disabled = true;button.textContent = T('saving');
    try {
      navigator.storage?.persist?.().catch(() => {});
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(String(response.status));
      if (Number(response.headers.get('Content-Length')) > 250 * 1024 * 1024) throw new Error('too large');
      await (await caches.open(offlineCache)).put(url, response);
      const post = video.closest('.post');
      const caption = (post?.querySelector('.post-body')?.textContent || '').trim().slice(0, 120);
      const author = (post?.querySelector('.post-head b,.post-head strong')?.textContent || '').trim().slice(0, 60);
      writeIndex([{ url, caption, author, savedAt: new Date().toISOString() }, ...readIndex().filter(item => item.url !== url)]);
      button.textContent = `✓ ${T('savedOffline')}`;button.dataset.saved = 'true';
    } catch { toast(T('offlineFailed'));button.textContent = `⤓ ${T('saveOffline')}`; }
    finally { button.disabled = button.dataset.saved === 'true'; }
  }
  function decorateVideos() {
    const saved = new Set(readIndex().map(item => item.url));
    document.querySelectorAll('#feed video.post-media,#profilePosts video.post-media').forEach(video => {
      const frame = video.closest('.mw-media-frame') || video;
      // "Save offline" always lives inside the post's ••• menu; posts without one (profile lists) get a small ••• menu of their own.
      const post = video.closest('.post');
      const items = post?.querySelector('.actions .mw-message-menu-items') || (post ? offlineMenu(post) : null);
      const existing = video.mwOfflineButton;
      if (existing?.isConnected && (!items || items.contains(existing))) return;
      const button = existing || document.createElement('button');
      if (!existing) {
        button.type = 'button';button.className = 'mwx-offline-save';
        const isSaved = saved.has(video.currentSrc || video.src);
        button.textContent = isSaved ? `✓ ${T('savedOffline')}` : `⤓ ${T('saveOffline')}`;button.disabled = isSaved;button.dataset.saved = String(isSaved);
        button.onclick = () => saveOffline(video, button);
        button.mwVideo = video;video.mwOfflineButton = button;
      }
      if (items) { button.classList.add('mwx-offline-menu');items.append(button); } else frame.after(button);
    });
  }
  function offlineMenu(post) {
    let menu = post.querySelector(':scope>.mwx-offline-menu-host');
    if (!menu) {
      menu = document.createElement('details');menu.className = 'mw-message-menu mwx-offline-menu-host';
      const summary = document.createElement('summary');summary.textContent = '•••';summary.setAttribute('aria-label', T('saveOffline'));
      const items = document.createElement('div');items.className = 'mw-message-menu-items';
      menu.append(summary, items);post.append(menu);
    }
    return menu.querySelector('.mw-message-menu-items');
  }
  let decorateScheduled = false;
  new MutationObserver(() => { if (decorateScheduled) return;decorateScheduled = true;requestAnimationFrame(() => { decorateScheduled = false;decorateVideos(); }); }).observe(document.body, { childList: true, subtree: true });
  async function openOffline() {
    const id = 'mwxOfflineSheet';sheet(id, 'offlineVideos');
    const panel = body(id);
    panel.innerHTML = `<p class="muted" data-mwx="offlineHelp">${T('offlineHelp')}</p><p class="muted" id="mwxOfflineStorage"></p><video id="mwxOfflinePlayer" class="mwx-offline-player" controls playsinline hidden></video><div id="mwxOfflineList" class="mwx-list mwx-no-translate"></div>`;
    openSheet(id);
    if (navigator.storage?.estimate) navigator.storage.estimate().then(estimate => { byId('mwxOfflineStorage').textContent = `${T('storageUsed')}: ${(estimate.usage / 1048576).toFixed(1)} MB`; }).catch(() => {});
    const list = byId('mwxOfflineList');
    const items = readIndex();
    if (!('caches' in window)) { list.innerHTML = `<p class="muted">${T('offlineUnsupported')}</p>`;return; }
    if (!items.length) { list.innerHTML = `<p class="muted">${T('nothingYet')}</p>`;return; }
    const cache = await caches.open(offlineCache);
    for (const item of items) {
      const row = document.createElement('div');row.className = 'mwx-list-row mwx-offline-row';
      const info = document.createElement('div');const strong = document.createElement('strong');strong.textContent = item.caption || '🎬';const small = document.createElement('small');small.textContent = [item.author, when(item.savedAt)].filter(Boolean).join(' · ');info.append(strong, small);
      const play = document.createElement('button');play.type = 'button';play.className = 'btn primary';play.textContent = T('play');
      const remove = document.createElement('button');remove.type = 'button';remove.className = 'btn ghost';remove.textContent = T('remove');
      play.onclick = async () => {
        const response = await cache.match(item.url);
        if (!response) { toast(T('offlineFailed'));return; }
        const player = byId('mwxOfflinePlayer');
        if (player.src.startsWith('blob:')) URL.revokeObjectURL(player.src);
        player.src = URL.createObjectURL(await response.blob());player.hidden = false;player.play().catch(() => {});
      };
      remove.onclick = async () => { await cache.delete(item.url);writeIndex(readIndex().filter(entry => entry.url !== item.url));row.remove();decorateAgain(item.url); };
      row.append(info, play, remove);list.append(row);
    }
  }
  function decorateAgain(url) {
    document.querySelectorAll('.mwx-offline-save[data-saved="true"]').forEach(button => { const video = button.mwVideo || button.previousElementSibling?.querySelector?.('video') || button.previousElementSibling;if ((video?.currentSrc || video?.src) === url) { button.dataset.saved = 'false';button.disabled = false;button.textContent = `⤓ ${T('saveOffline')}`; } });
  }

  // ---------- QR code ----------
  let qrLibrary = null;
  const loadQr = () => qrLibrary ||= new Promise((resolve, reject) => {
    if (window.qrcode) return resolve(window.qrcode);
    const script = document.createElement('script');script.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';script.async = true;
    script.onload = () => window.qrcode ? resolve(window.qrcode) : reject(new Error('missing'));
    script.onerror = () => { qrLibrary = null;reject(new Error('unavailable')); };
    document.head.append(script);
  });
  const profileUrl = () => new URL(`/milkyway/#profile-${user.id}`, location.origin).href;
  async function openQr() {
    const id = 'mwxQrSheet';sheet(id, 'qrCode');
    const panel = body(id);
    const profile = typeof getProfile === 'function' ? await getProfile(user.id).catch(() => null) : null;
    const name = profile?.display_name || (typeof nameOf === 'function' ? nameOf() : 'MilkyWay');
    panel.innerHTML = `<div class="mwx-qr-card"><div class="mwx-qr-head"><span class="mw-live-avatar mwx-qr-avatar" id="mwxQrAvatar"></span><strong class="mwx-no-translate"></strong></div><canvas id="mwxQrCanvas" width="600" height="600" aria-label="QR code"></canvas><small class="mwx-no-translate" id="mwxQrUrl"></small></div><p class="muted" data-mwx="qrHelp">${T('qrHelp')}</p><div class="row mwx-qr-actions"><button type="button" class="btn primary" id="mwxQrShare" data-mwx="share">${T('share')}</button><button type="button" class="btn ghost" id="mwxQrCopy" data-mwx="copyLink">${T('copyLink')}</button><button type="button" class="btn ghost" id="mwxQrDownload" data-mwx="download">${T('download')}</button></div><p class="msg" id="mwxQrStatus" role="status"></p>`;
    panel.querySelector('.mwx-qr-head strong').textContent = name;
    const avatarImage = profile?.avatar_url || '';
    face(byId('mwxQrAvatar'), avatarImage, name);
    byId('mwxQrUrl').textContent = profileUrl().replace(/^https?:\/\//, '');
    openSheet(id);
    byId('mwxQrCopy').onclick = async () => { try { await navigator.clipboard.writeText(profileUrl());toast(T('copied')); } catch { byId('mwxQrStatus').textContent = profileUrl(); } };
    byId('mwxQrShare').onclick = async () => { if (navigator.share) navigator.share({ title: `${name} · MilkyWay`, url: profileUrl() }).catch(() => {});else byId('mwxQrCopy').click(); };
    byId('mwxQrDownload').onclick = () => { const link = document.createElement('a');link.download = 'milkyway-qr.png';link.href = byId('mwxQrCanvas').toDataURL('image/png');link.click(); };
    try {
      const generator = await loadQr();
      const code = generator(0, 'H');code.addData(profileUrl());code.make();
      const canvas = byId('mwxQrCanvas'), context = canvas.getContext('2d');
      const modules = code.getModuleCount(), margin = 4, cell = Math.floor(canvas.width / (modules + margin * 2)), offset = Math.floor((canvas.width - cell * modules) / 2);
      context.fillStyle = '#ffffff';context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#0F172A';
      for (let row = 0; row < modules; row++) for (let column = 0; column < modules; column++) if (code.isDark(row, column)) context.fillRect(offset + column * cell, offset + row * cell, cell, cell);
      const emblem = new Image();emblem.src = 'brand/milkyway-emblem-96.png';
      emblem.onload = () => { const size = canvas.width * .2, start = (canvas.width - size) / 2;context.fillStyle = '#0F172A';context.beginPath();context.arc(canvas.width / 2, canvas.height / 2, size / 2 + 10, 0, Math.PI * 2);context.fill();context.strokeStyle = '#FACC15';context.lineWidth = 6;context.stroke();context.drawImage(emblem, start, start, size, size); };
    } catch { byId('mwxQrStatus').textContent = T('qrUnavailable'); }
  }
  function openProfileFromHash() {
    const match = /^#profile-([a-f0-9-]{36})$/i.exec(location.hash);
    if (match && typeof openPublicProfile === 'function') openPublicProfile(match[1]).then(() => openSheet('publicProfileSheet')).catch(() => {});
  }
  window.addEventListener('hashchange', openProfileFromHash);

  // ---------- Studio ----------
  async function openStudio() {
    const id = 'mwxStudioSheet';sheet(id, 'studio').classList.add('mws-sheet');
    const panel = body(id);const accountId = user.id;
    const glyph = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    const glyphs = {
      video: '<path d="M3 7h12v10H3z"/><path d="m15 10.5 6-3.5v10l-6-3.5"/>', audio: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
      post: '<path d="M12 5v14M5 12h14"/>', story: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
      history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5M12 7.5V12l3 2"/>', offline: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
    };
    const stat = (key, target) => {
  const extra = (key === 'followers' || key === 'following') ? ` style="cursor:pointer" data-follow-list="${key}" data-user-id="me"` : '';
  return `<div class="mws-stat"${extra}><strong id="${target}">…</strong><small data-mwx="${key}">${T(key)}</small></div>`;
};
    const tool = (action, key) => `<button type="button" class="mws-tool" data-studio="${action}"><span>${glyph(glyphs[action])}</span><b data-mwx="${key}">${T(key)}</b></button>`;
    const go = (action, key, hint) => `<button type="button" class="mws-go mws-go-${action}" data-studio="${action}"><span>${glyph(glyphs[action])}</span><b data-mwx="${key}">${T(key)}</b><small data-mwx="${hint}">${T(hint)}</small></button>`;
    panel.innerHTML = `<div class="mws-hero"><span class="mws-orbit" aria-hidden="true"><i></i></span><span class="mws-status" id="mwsStatus"><i aria-hidden="true"></i><span></span></span><p class="mws-wordmark" aria-hidden="true">MilkyWay <em>Studio</em></p><p class="mws-tagline" data-mwx="studioTagline">${T('studioTagline')}</p></div>`
      + `<div class="mws-launch">${go('video', 'goVideoLive', 'cameraMic')}${go('audio', 'goAudioLive', 'voiceOnly')}</div><button type="button" class="mws-return" data-studio="return" data-mwx="returnLive" hidden>${T('returnLive')}</button>`
      + `<h4 class="mws-label" data-mwx="liveLayout">${T('liveLayout')}</h4><button type="button" class="mw-layout-trigger mws-layout" data-studio="layout" aria-haspopup="dialog"></button><p class="mws-hint" data-mwx="liveLayoutHelp">${T('liveLayoutHelp')}</p>`
      + `<h4 class="mws-label" data-mwx="studioInsights">${T('studioInsights')}</h4><div class="mws-stats">${stat('posts', 'mwxStudioPosts')}${stat('followers', 'mwxStudioFollowers')}${stat('following', 'mwxStudioFollowing')}${stat('liveSessions', 'mwxStudioLives')}</div>`
      + `<h4 class="mws-label" data-mwx="studioCreate">${T('studioCreate')}</h4><div class="mws-tools">${tool('post', 'newPost')}${tool('story', 'newStory')}${tool('history', 'sessionHistory')}${tool('offline', 'offlineVideos')}</div>`
      + `<p class="mws-help muted" data-mwx="studioHelp">${T('studioHelp')}</p>`;
    // The status pill and the layout row follow the real Live state, so the Studio works as a launcher and a return point.
    const paint = () => {
      if (!byId(id)) return;
      const active = !!window.MilkyWayLive?.isActive?.();
      const status = byId('mwsStatus');status.dataset.live = String(active);status.querySelector('span').textContent = T(active ? 'studioOnAir' : 'studioReady');
      panel.querySelector('.mws-launch').hidden = active;panel.querySelector('.mws-return').hidden = !active;
      const layouts = window.MilkyWayLiveLayouts;
      const trigger = panel.querySelector('.mws-layout');
      trigger.hidden = !layouts;
      if (layouts) { const setup = layouts.setup();layouts.paintTrigger(trigger, setup.style, setup.seats); }
    };
    if (!panel.dataset.bound) {
      panel.dataset.bound = 'true';
      window.addEventListener('mw-live-layout-change', paint);window.addEventListener('mw-language-change', () => setTimeout(paint));
    }
    panel.querySelectorAll('[data-studio]').forEach(button => button.onclick = () => {
      const action = button.dataset.studio;
      if (action === 'layout') { window.MilkyWayLiveLayouts?.configure();return; }
      closeSheet(id);closeSheet('authModal');
      if (action === 'video' || action === 'audio') window.MilkyWayLive.start(action);
      else if (action === 'return') window.MilkyWayLive.open();
      else if (action === 'post') openCompose();
      else if (action === 'story') openSheet('storyComposeSheet');
      else if (action === 'history') { window.MilkyWayLive.open();const history = document.querySelector('#mwLivePage .mwx-history');if (history) { history.open = true;history.querySelector('[data-action="history"]')?.click();history.scrollIntoView({ block: 'start' }); } }
      else openOffline();
    });
    paint();
    // Earned gift coins sit at the very top of the creator dashboard.
    window.MilkyWayGifts?.mountCard(panel);
    openSheet(id);
    const [summary, lives] = await Promise.all([counts(accountId).catch(() => null), sb.from('mw_video_live_sessions').select('id', { count: 'exact', head: true }).eq('host_id', accountId)]);
    if (user?.id !== accountId) return;
    byId('mwxStudioPosts').textContent = summary ? summary.posts ?? '—' : '—';
    byId('mwxStudioFollowers').textContent = summary ? summary.followers ?? '—' : '—';
    byId('mwxStudioFollowing').textContent = summary ? summary.following ?? '—' : '—';
    byId('mwxStudioLives').textContent = lives.error ? '—' : lives.count ?? 0;
  }

  // ---------- Owner-only user administration ----------
  const adminState = { offset: 0, total: 0, status: 'all', query: '', busy: false, generation: 0 };
  function openAdmin() {
    if (!ownerSignedIn() || !ownerVerified) return;
    const id = 'mwxAdminSheet';sheet(id, 'adminPanel');
    const panel = body(id);
    panel.innerHTML = `<div class="mwx-admin-summary"><div class="mwx-stat"><strong id="mwxAdminTotal">…</strong><small data-mwx="users">${T('users')}</small></div><div class="mwx-stat"><strong id="mwxAdminSuspended">…</strong><small data-mwx="suspended">${T('suspended')}</small></div></div><form id="mwxAdminSearch" class="mwx-admin-search" role="search"><input id="mwxAdminQuery" type="search" maxlength="60" placeholder="${T('search')}" aria-label="${T('search')}"><div class="mwx-segment" role="group"><button type="button" data-status="all" aria-pressed="true" data-mwx="all">${T('all')}</button><button type="button" data-status="suspended" aria-pressed="false" data-mwx="suspended">${T('suspended')}</button></div></form><p class="msg" id="mwxAdminStatus" role="status"></p><div id="mwxAdminUsers" class="mwx-list mwx-no-translate" aria-live="polite"></div><button type="button" class="btn ghost mwx-wide" id="mwxAdminMore" hidden data-mwx="loadMore">${T('loadMore')}</button><p class="muted mwx-small" data-mwx="adminNote">${T('adminNote')}</p>`;
    let searchTimer = null;
    byId('mwxAdminSearch').onsubmit = event => { event.preventDefault();adminState.query = byId('mwxAdminQuery').value.trim();loadUsers(true); };
    byId('mwxAdminQuery').oninput = () => { clearTimeout(searchTimer);searchTimer = setTimeout(() => { adminState.query = byId('mwxAdminQuery').value.trim();loadUsers(true); }, 400); };
    panel.querySelectorAll('[data-status]').forEach(button => button.onclick = () => { adminState.status = button.dataset.status;panel.querySelectorAll('[data-status]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));loadUsers(true); });
    byId('mwxAdminMore').onclick = () => loadUsers(false);
    closeSheet('authModal');openSheet(id);
    adminState.status = 'all';adminState.query = '';
    loadUsers(true);
  }
  async function loadUsers(reset) {
    if (adminState.busy && !reset) return;
    const generation = ++adminState.generation;
    adminState.busy = true;
    if (reset) { adminState.offset = 0;byId('mwxAdminUsers').innerHTML = `<p class="muted">${T('loading')}</p>`; }
    byId('mwxAdminStatus').textContent = '';
    try {
      const query = `&offset=${adminState.offset}${adminState.query ? `&q=${encodeURIComponent(adminState.query)}` : ''}${adminState.status === 'suspended' ? '&status=suspended' : ''}`;
      const result = await api('admin-users', { query });
      if (generation !== adminState.generation) return;
      const list = byId('mwxAdminUsers');
      if (reset) list.replaceChildren();
      if (adminState.status === 'all' && !adminState.query) byId('mwxAdminTotal').textContent = String(result.total);
      byId('mwxAdminSuspended').textContent = String(result.suspendedTotal);
      result.users.forEach(account => list.append(userRow(account)));
      if (!list.children.length) list.innerHTML = `<p class="muted">${T('nothingYet')}</p>`;
      adminState.offset += result.users.length;adminState.total = result.total;
      byId('mwxAdminMore').hidden = adminState.offset >= result.total || !result.users.length;
    } catch (error) { if (generation === adminState.generation) { byId('mwxAdminStatus').textContent = error.message;if (reset) byId('mwxAdminUsers').replaceChildren(); } }
    finally { if (generation === adminState.generation) adminState.busy = false; }
  }
  function userRow(account) {
    const row = document.createElement('article');row.className = 'mwx-user';row.dataset.status = account.status;
    const picture = document.createElement('span');picture.className = 'mw-live-avatar mwx-user-avatar';face(picture, account.avatar, account.name);
    const info = document.createElement('div');info.className = 'mwx-user-info';
    const name = document.createElement('strong');name.textContent = account.name || 'Msafiri';
    const meta = document.createElement('small');meta.textContent = [account.username ? `@${account.username}` : '', `${T('joined')} ${when(account.createdAt)}`].filter(Boolean).join(' · ');
    const pill = document.createElement('span');pill.className = 'mwx-pill';pill.textContent = account.self ? T('you') : account.appealPending ? T('appealPending') : T(account.status === 'suspended' ? 'suspended' : 'active');
    info.append(name, meta);
    if (account.status === 'suspended' && account.reason) { const reason = document.createElement('small');reason.className = 'mwx-user-reason';reason.textContent = account.reason;info.append(reason); }
    row.append(picture, info, pill);
    if (!account.self) {
      const button = document.createElement('button');button.type = 'button';
      const suspended = account.status === 'suspended';
      button.className = `btn ${suspended ? 'primary' : 'danger'}`;button.textContent = T(suspended ? 'restore' : 'suspend');
      button.onclick = async () => {
        let reason = '';
        if (suspended) { if (!(await window.MilkyWayDialog.confirm({ message: T('confirmRestore') }))) return; }
        else { const answer = await window.MilkyWayDialog.prompt({ message: T('reasonPrompt'), value: T('defaultReason'), multiline: true, maxLength: 300, confirmText: T('suspend') });if (answer === null) return;reason = answer.trim().slice(0, 300); }
        button.disabled = true;
        try {
          await api(suspended ? 'admin-restore' : 'admin-suspend', { method: 'POST', body: { userId: account.id, reason } });
          const updated = { ...account, status: suspended ? 'active' : 'suspended', reason };
          if (adminState.status === 'suspended' && suspended) row.remove();else row.replaceWith(userRow(updated));
          const counter = byId('mwxAdminSuspended');counter.textContent = String(Math.max(0, Number(counter.textContent || 0) + (suspended ? -1 : 1)));
        } catch (error) { byId('mwxAdminStatus').textContent = error.message;button.disabled = false; }
      };
      row.append(button);
    }
    row.addEventListener('click', event => { if (!event.target.closest('button') && typeof openPublicProfile === 'function') { closeSheet('mwxAdminSheet');openPublicProfile(account.id).then(() => openSheet('publicProfileSheet')).catch(() => {}); } });
    return row;
  }

  // ---------- Account status: owner verification and suspension lockout ----------
  function lockout(reason, appeal) {
    let screen = byId('mwxSuspended');
    if (!screen) {
      screen = document.createElement('div');screen.id = 'mwxSuspended';screen.className = 'mwx-suspended';screen.setAttribute('role', 'alertdialog');screen.setAttribute('aria-modal', 'true');screen.setAttribute('aria-labelledby', 'mwxSuspendedTitle');
      screen.innerHTML = `<div class="mwx-suspended-card"><img loading="lazy" decoding="async" src="brand/milkyway-emblem-96.png" alt="" width="64" height="64"><h2 id="mwxSuspendedTitle" data-mwx="accountSuspended">${T('accountSuspended')}</h2><p data-mwx="suspendedBody">${T('suspendedBody')}</p><p class="mwx-suspended-reason mwx-no-translate"></p><p class="mwx-appeal-status" role="status"></p><button type="button" class="btn ghost mwx-appeal" data-mwx="appealButton">${T('appealButton')}</button><button type="button" class="btn primary mwx-sign-out" data-mwx="signOut">${T('signOut')}</button></div>`;
      screen.querySelector('.mwx-sign-out').onclick = () => byId('logoutBtn')?.click();
      screen.querySelector('.mwx-appeal').onclick = async () => {
        const message = await window.MilkyWayDialog.prompt({ message: T('appealPrompt'), value: '', multiline: true, maxLength: 1500, confirmText: T('appealSend') });
        if (message === null || !message.trim()) return;
        const button = screen.querySelector('.mwx-appeal');button.disabled = true;
        try { await api('appeal', { method: 'POST', body: { message: message.trim() } });showAppeal({ status: 'pending' }); }
        catch (error) { screen.querySelector('.mwx-appeal-status').textContent = error.message;button.disabled = false; }
      };
      document.body.append(screen);
    }
    screen.querySelector('.mwx-suspended-reason').textContent = reason || '';
    showAppeal(appeal);
    screen.hidden = false;
    window.MilkyWayLive?.disconnect?.().catch(() => {});
  }
  // Pending appeals hide the button; a declined appeal shows the reviewer's note and allows a new one.
  function showAppeal(appeal) {
    const screen = byId('mwxSuspended');if (!screen) return;
    const status = screen.querySelector('.mwx-appeal-status'), button = screen.querySelector('.mwx-appeal');
    button.disabled = false;button.hidden = appeal?.status === 'pending';
    status.textContent = appeal?.status === 'pending' ? T('appealWaiting') : appeal?.status === 'rejected' ? [T('appealRejected'), appeal.adminNote].filter(Boolean).join(' ') : '';
  }
  let statusGeneration = 0;
  async function refreshStatus() {
    const generation = ++statusGeneration;
    ownerVerified = false;
    const adminButton = byId('mwxAdminButton');if (adminButton) adminButton.hidden = true;
    if (byId('mwxSuspended')) byId('mwxSuspended').hidden = true;
    if (!signedIn()) { const value = byId('mwxBalanceValue');if (value) value.textContent = '—';return; }
    // The balance loads alongside the account check instead of waiting for it.
    refreshBalance();
    try {
      const status = await api('account-status');
      if (generation !== statusGeneration) return;
      ownerVerified = status.owner === true && ownerSignedIn();
      if (adminButton) adminButton.hidden = !ownerVerified;
      if (status.suspended) lockout(status.reason, status.appeal);
    } catch {}
  }

  function initialize() {
    buildMenu();paint();decorateVideos();
    sb.auth.onAuthStateChange(() => { window.setTimeout(refreshStatus, 0); });
    window.addEventListener('mw-language-change', () => { paint();document.querySelectorAll('.mwx-offline-save').forEach(button => { button.textContent = button.dataset.saved === 'true' ? `✓ ${T('savedOffline')}` : `⤓ ${T('saveOffline')}`; }); });
    refreshStatus();
    setTimeout(openProfileFromHash, 600);
  }
  window.addEventListener('mw-wallet-change', event => { const value = byId('mwxBalanceValue');if (value && event.detail) value.textContent = Number(event.detail.coins || 0).toLocaleString();if (event.detail && signedIn()) saveBalance(event.detail.coins); });
  window.MilkyWayAccountHub = { open, openAdmin, openGallery: openGalleryFromMenu, openMyPosts: openMyPostsFromMenu, refresh: refreshStatus };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);else initialize();
})();
