// Profile Gallery / Media Archive: photos, videos and documents grouped per account, with a Public / Followers only / Only me audience per post.
(() => {
  const byId = id => document.getElementById(id);
  const service =   '/api/milkyway-gallery';
    const social = '/api/milkyway-social';
  const indexes = { en: 0, sw: 1, fr: 2, zh: 3, ar: 4, pt: 5, hi: 6, de: 7 };
  const words = {
    gallery: ['Gallery · Media archive', 'Gallery · Hifadhi ya media', 'Galerie · Archives média', '相册 · 媒体档案', 'المعرض · أرشيف الوسائط', 'Galeria · Arquivo de mídia', 'गैलरी · मीडिया संग्रह', 'Galerie · Medienarchiv'],
    all: ['All', 'Zote', 'Tout', '全部', 'الكل', 'Tudo', 'सभी', 'Alle'],
    photos: ['Photos', 'Picha', 'Photos', '照片', 'الصور', 'Fotos', 'फ़ोटो', 'Fotos'],
    videos: ['Videos', 'Video', 'Vidéos', '视频', 'الفيديوهات', 'Vídeos', 'वीडियो', 'Videos'],
    documents: ['Documents', 'Nyaraka', 'Documents', '文档', 'المستندات', 'Documentos', 'दस्तावेज़', 'Dokumente'],
    audience: ['Who can see this post', 'Nani anaweza kuona post hii', 'Qui peut voir cette publication', '谁可以看到此帖子', 'من يمكنه رؤية هذا المنشور', 'Quem pode ver esta publicação', 'यह पोस्ट कौन देख सकता है', 'Wer diesen Beitrag sehen kann'],
    everyone: ['🌍 Everyone (Public)', '🌍 Kila mtu (Wazi)', '🌍 Tout le monde (Public)', '🌍 所有人（公开）', '🌍 الجميع (عام)', '🌍 Todos (Público)', '🌍 सभी (सार्वजनिक)', '🌍 Alle (Öffentlich)'],
    everyoneShort: ['Everyone', 'Kila mtu', 'Tout le monde', '所有人', 'الجميع', 'Todos', 'सभी', 'Alle'],
    visibility: ['Who can see this?', 'Nani ataona?', 'Qui peut voir ?', '谁可以看到？', 'من يمكنه الرؤية؟', 'Quem pode ver?', 'कौन देख सकता है?', 'Wer kann das sehen?'],
    publicChip: ['🌍 Public', '🌍 Wazi', '🌍 Public', '🌍 公开', '🌍 عام', '🌍 Público', '🌍 सार्वजनिक', '🌍 Öffentlich'],
    followersChip: ['👥 Followers only', '👥 Wafuasi tu', '👥 Abonnés uniquement', '👥 仅粉丝', '👥 المتابعون فقط', '👥 Só seguidores', '👥 केवल फ़ॉलोअर्स', '👥 Nur Follower'],
    onlyMeChip: ['🔒 Only me', '🔒 Mimi tu', '🔒 Moi uniquement', '🔒 仅自己', '🔒 أنا فقط', '🔒 Só eu', '🔒 केवल मैं', '🔒 Nur ich'],
    followersShort: ['Followers', 'Wafuasi', 'Abonnés', '粉丝', 'المتابعون', 'Seguidores', 'फ़ॉलोअर्स', 'Follower'],
    audienceFailed: ['The audience could not be saved, so nothing was posted. Retry.', 'Hadhira haikuhifadhiwa, kwa hiyo hakuna kilichochapishwa. Jaribu tena.', 'L’audience n’a pas pu être enregistrée, rien n’a été publié. Réessayez.', '无法保存可见范围，因此未发布。请重试。', 'تعذر حفظ الجمهور، لذلك لم يُنشر شيء. أعد المحاولة.', 'Não foi possível guardar o público, por isso nada foi publicado. Tente de novo.', 'दर्शक सहेजे नहीं जा सके, इसलिए कुछ पोस्ट नहीं हुआ। फिर कोशिश करें।', 'Die Sichtbarkeit konnte nicht gespeichert werden, daher wurde nichts gepostet. Erneut versuchen.'],
    onlyMeShort: ['Only me', 'Mimi tu', 'Moi uniquement', '仅自己', 'أنا فقط', 'Só eu', 'केवल मैं', 'Nur ich'],
    makePrivate: ['Privacy: make Only me', 'Faragha: weka Mimi tu', 'Confidentialité : Moi uniquement', '隐私：设为仅自己', 'الخصوصية: أنا فقط', 'Privacidade: só eu', 'गोपनीयता: केवल मैं', 'Privatsphäre: Nur ich'],
    makePublic: ['Privacy: make Everyone', 'Faragha: weka Kila mtu', 'Confidentialité : Tout le monde', '隐私：设为所有人', 'الخصوصية: الجميع', 'Privacidade: todos', 'गोपनीयता: सभी', 'Privatsphäre: Alle'],
    privacySaved: ['Privacy updated.', 'Faragha imesasishwa.', 'Confidentialité mise à jour.', '隐私已更新。', 'تم تحديث الخصوصية.', 'Privacidade atualizada.', 'गोपनीयता अपडेट हुई।', 'Privatsphäre aktualisiert.'],
    privacyHint: ['Tap 🌍 / 🔒 on any file to choose who can see its post.', 'Gusa 🌍 / 🔒 kwenye faili kuchagua nani aone post yake.', 'Touchez 🌍 / 🔒 sur un fichier pour choisir qui voit sa publication.', '点击文件上的 🌍 / 🔒 选择谁能看到该帖子。', 'المس 🌍 / 🔒 على أي ملف لتختار من يرى منشوره.', 'Toque em 🌍 / 🔒 num ficheiro para escolher quem vê a publicação.', 'किसी फ़ाइल पर 🌍 / 🔒 दबाकर चुनें कि उसकी पोस्ट कौन देखे।', 'Tippe auf 🌍 / 🔒 bei einer Datei, um festzulegen, wer den Beitrag sieht.'],
    emptyMine: ['Your gallery is empty. Photos, videos and documents you post appear here.', 'Gallery yako haina kitu. Picha, video na nyaraka unazoposti zitaonekana hapa.', 'Votre galerie est vide. Vos photos, vidéos et documents publiés apparaîtront ici.', '你的相册是空的。你发布的照片、视频和文档会显示在这里。', 'معرضك فارغ. ستظهر هنا الصور والفيديوهات والمستندات التي تنشرها.', 'A sua galeria está vazia. As fotos, vídeos e documentos que publicar aparecem aqui.', 'आपकी गैलरी खाली है। आपकी पोस्ट की गई फ़ोटो, वीडियो और दस्तावेज़ यहाँ दिखेंगे।', 'Deine Galerie ist leer. Fotos, Videos und Dokumente, die du postest, erscheinen hier.'],
    emptyTab: ['Nothing of this type yet.', 'Bado hakuna aina hii.', 'Rien de ce type pour l’instant.', '还没有此类内容。', 'لا يوجد شيء من هذا النوع بعد.', 'Ainda não há nada deste tipo.', 'इस प्रकार का अभी कुछ नहीं है।', 'Noch nichts von dieser Art.'],
    empty: ['Nothing here yet.', 'Bado hakuna kitu hapa.', 'Rien pour l’instant.', '这里还没有内容。', 'لا يوجد شيء هنا بعد.', 'Ainda não há nada aqui.', 'यहाँ अभी कुछ नहीं है।', 'Hier ist noch nichts.'],
    loading: ['Loading…', 'Inapakia…', 'Chargement…', '加载中…', 'جارٍ التحميل…', 'A carregar…', 'लोड हो रहा है…', 'Wird geladen…'],
    unavailable: ['The gallery is unavailable. Retry.', 'Gallery haipatikani. Jaribu tena.', 'La galerie est indisponible. Réessayez.', '相册暂不可用，请重试。', 'المعرض غير متاح. أعد المحاولة.', 'A galeria está indisponível. Tente novamente.', 'गैलरी उपलब्ध नहीं है। फिर कोशिश करें।', 'Die Galerie ist nicht verfügbar. Versuche es erneut.'],
    privateCount: ['{n} private', '{n} binafsi', '{n} privés', '{n} 个私密', '{n} خاصة', '{n} privados', '{n} निजी', '{n} privat'],
    close: ['Close', 'Funga', 'Fermer', '关闭', 'إغلاق', 'Fechar', 'बंद करें', 'Schließen'],
    download: ['Download', 'Pakua', 'Télécharger', '下载', 'تنزيل', 'Transferir', 'डाउनलोड', 'Herunterladen'],
    privateFailed: ['Only me could not be saved, so nothing was posted. Retry.', 'Mimi tu haikuhifadhiwa, kwa hiyo hakuna kilichochapishwa. Jaribu tena.', 'Moi uniquement n’a pas pu être enregistré, rien n’a été publié. Réessayez.', '“仅自己”未能保存，因此未发布任何内容。请重试。', 'تعذر حفظ “أنا فقط”، لذلك لم يُنشر شيء. أعد المحاولة.', 'Não foi possível guardar “Só eu”, por isso nada foi publicado. Tente novamente.', '“केवल मैं” सहेजा नहीं जा सका, इसलिए कुछ पोस्ट नहीं हुआ। फिर कोशिश करें।', '„Nur ich“ konnte nicht gespeichert werden, daher wurde nichts veröffentlicht. Versuche es erneut.'],
  };
  const language = () => window.MilkyWayI18n?.language?.() || 'sw';
  const T = (key, values = {}) => { const row = words[key];const text = row ? row[indexes[language()]] || row[0] : key;return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? ''); };
  const node = (tag, props = {}, ...children) => { const element = Object.assign(document.createElement(tag), props);element.append(...children.filter(child => child != null));return element; };
  const label = (tag, key, props = {}) => { const element = node(tag, props, T(key));element.dataset.mwGallery = key;return element; };
  const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
  const extension = name => String(name || '').split('.').pop().toLowerCase();
  const isDocument = file => documentExtensions.includes(extension(file?.name));
  const sizeText = bytes => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const docIcon = name => ({ pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', csv: '📗', ppt: '📙', pptx: '📙' }[extension(name)] || '📄');

  async function headers(auth) {
    const result = { apikey: sb.supabaseKey || '' };
    const session = auth ? (await sb.auth.getSession()).data.session : null;
    if (session) result.Authorization = `Bearer ${session.access_token}`;
    else if (auth === 'required') throw new Error(window.MilkyWayI18n?.t('signInFirst') || 'Sign in first.');
    return result;
  }
  async function api(query, options = {}, auth = true) {
    const response = await fetch(`${service}${query}`, { ...options, headers: { ...options.headers, ...(await headers(auth)) }, cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!response.ok) { const result = await response.json().catch(() => ({}));throw new Error(window.MilkyWayI18n?.text(result.error || T('unavailable')) || T('unavailable')); }
    return response.status === 204 ? null : response.json();
  }

  /* ---------- Audience state: post id → owner id for every "Only me" post seen so far ---------- */
  const storageKey = 'mw_private_posts';
  const privatePosts = new Map(Object.entries((() => { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; } })()));
  const remember = () => { try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries([...privatePosts].slice(-500)))); } catch {} };
  const isPrivate = post => privatePosts.get(post.id) === post.author_id;
  // The audience of the signed-in person's own posts (post id → 'followers' | 'only_me'), used for the badge on their posts.
  const ownKey = 'mw_own_post_audiences';
  const ownAudiences = new Map(Object.entries((() => { try { return JSON.parse(localStorage.getItem(ownKey) || '{}'); } catch { return {}; } })()));
  const rememberOwn = () => { try { localStorage.setItem(ownKey, JSON.stringify(Object.fromEntries([...ownAudiences].slice(-500)))); } catch {} };
  async function visible(posts) {
    const list = (posts || []).filter(Boolean);
    const ids = list.map(post => post.id).filter(Boolean);
    try {
      for (let index = 0; index < ids.length; index += 100) {
        const chunk = ids.slice(index, index + 100);
        // Signed in, the service also knows whose "Followers only" posts this person may see.
        const result = await api(`?action=audiences&ids=${chunk.join(',')}`, {}, true);
        chunk.forEach(id => privatePosts.delete(id));
        result.private.forEach(row => privatePosts.set(row.postId, row.ownerId));
        for (const [id, value] of Object.entries(result.own || {})) if (value === 'everyone') ownAudiences.delete(id);else ownAudiences.set(id, value);
      }
      remember();rememberOwn();
    } catch {} // Offline: fall back to the last known private posts rather than revealing them.
    return list.filter(post => !isPrivate(post) || post.author_id === user?.id);
  }
  async function setAudience(postId, audience) {
    try {
      await api(`?action=audience&id=${postId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audience }) }, 'required');
    } catch (error) {
      // A public post is public by default, so only a failed "Only me" or "Followers only" must stop publishing.
      if (audience === 'only_me') throw new Error(`${T('privateFailed')} (${error.message})`);
      if (audience === 'followers') throw new Error(`${T('audienceFailed')} (${error.message})`);
      return;
    }
    if (audience === 'only_me') privatePosts.set(postId, user.id);else privatePosts.delete(postId);
    if (audience === 'everyone') ownAudiences.delete(postId);else ownAudiences.set(postId, audience);
    remember();rememberOwn();
    document.querySelectorAll(`#feed #post-${CSS.escape(postId)}`).forEach(decorate);
  }
  // fetch() cannot report upload progress, so uploads that show a percentage go through XHR.
  function sendWithProgress(method, url, { headers = {}, body, onProgress, timeout = 0 } = {}) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(method, url);
      for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
      request.timeout = timeout;
      request.upload.onprogress = event => { if (event.lengthComputable && event.total) onProgress?.(Math.min(100, Math.round(event.loaded / event.total * 100))); };
      request.onload = () => { let result = null;try { result = request.responseText ? JSON.parse(request.responseText) : null; } catch {} resolve({ ok: request.status >= 200 && request.status < 300, status: request.status, result }); };
      request.onerror = request.ontimeout = () => reject(Object.assign(new Error(T('unavailable')), { network: true }));
      request.send(body);
    });
  }
  async function uploadDocument(file, postId, onProgress) {
    const form = new FormData();form.append('file', file);
    onProgress?.(0);
    const { ok, status, result } = await sendWithProgress('POST', `${service}?action=upload&post=${postId}`, { headers: await headers('required'), body: form, onProgress, timeout: 180000 });
    if (!ok) throw new Error(window.MilkyWayI18n?.text(result?.error || T('unavailable')) || T('unavailable'));
    onProgress?.(100);
    return status === 204 ? null : result;
  }
  function forget(postId) {
    privatePosts.delete(postId);remember();filesCache.delete(postId);
    api(`?action=post&id=${postId}`, { method: 'DELETE' }, 'required').catch(() => {});
  }

  /* ---------- Composer audience picker ---------- */
  // One tap picks who sees the post: Public, Followers only or Only me.
  function audienceControl() {
    let value = 'everyone';
    const chips = [['everyone', 'publicChip'], ['followers', 'followersChip'], ['only_me', 'onlyMeChip']].map(([audience, key]) => {
      const chip = label('button', key, { type: 'button', className: 'mw-audience-chip' });
      chip.dataset.audience = audience;
      chip.setAttribute('role', 'radio');
      chip.onclick = () => select(audience);
      return chip;
    });
    const group = node('div', { className: 'mw-audience-chips' }, ...chips);
    group.setAttribute('role', 'radiogroup');
    const heading = label('span', 'visibility', { className: 'mw-audience-title' });
    heading.id = 'mwComposeAudienceTitle';group.setAttribute('aria-labelledby', heading.id);
    const wrapper = node('div', { className: 'mw-audience-picker', id: 'mwComposeAudience' }, heading, group);
    function select(audience) {
      value = audience;
      chips.forEach(chip => { const on = chip.dataset.audience === audience;chip.setAttribute('aria-checked', String(on));chip.classList.toggle('on', on); });
    }
    select('everyone');
    Object.defineProperty(wrapper, 'value', { get: () => value });
    wrapper.reset = () => select('everyone');
    return wrapper;
  }
  function documentChip(file, onOpen) {
    const chip = node(onOpen ? 'button' : 'div', { className: 'mw-doc-chip', title: file.name }, node('span', { className: 'mw-doc-icon', textContent: docIcon(file.name) }), node('span', { className: 'mw-doc-name', textContent: file.name }), node('small', { textContent: sizeText(file.size || 0) }));
    if (onOpen) { chip.type = 'button';chip.onclick = onOpen; }
    return chip;
  }
  async function openDocument(file, download = false) {
    try {
      const response = await fetch(`${service}?action=file&key=${encodeURIComponent(file.key)}`, { headers: await headers(true), cache: 'no-store', signal: AbortSignal.timeout(60000) });
      if (!response.ok) { const result = await response.json().catch(() => ({}));throw new Error(window.MilkyWayI18n?.text(result.error || T('unavailable'))); }
      const url = URL.createObjectURL(await response.blob());
      if (!download && file.mime === 'application/pdf') { if (!window.open(url, '_blank', 'noopener')) download = true; }
      else download = true;
      if (download) { const link = node('a', { href: url, download: file.name });document.body.append(link);link.click();link.remove(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { toast(error.message || T('unavailable')); }
  }

  /* ---------- Feed: documents under posts, a private badge and an owner privacy switch ---------- */
  const filesCache = new Map();
  let filesRequest = null;
  function loadFiles() {
    const ids = [...document.querySelectorAll('#feed .post[data-post-id]')].map(post => post.dataset.postId).filter(id => !filesCache.has(id)).slice(0, 60);
    if (!ids.length || filesRequest) return;
    ids.forEach(id => filesCache.set(id, []));
    filesRequest = api(`?action=files&ids=${ids.join(',')}`, {}, true)
      .then(({ files }) => files.forEach(file => filesCache.set(file.postId, [...(filesCache.get(file.postId) || []), file])))
      .catch(() => ids.forEach(id => filesCache.delete(id)))
      .finally(() => { filesRequest = null;ids.forEach(id => document.querySelectorAll(`#feed #post-${CSS.escape(id)}`).forEach(decorate)); });
  }
  function decorate(post) {
    const postId = post.dataset.postId, mine = !!user && post.dataset.authorId === user.id;
    const hidden = privatePosts.get(postId) === post.dataset.authorId;
    const followersOnly = mine && !hidden && ownAudiences.get(postId) === 'followers';
    let badge = post.querySelector(':scope .mw-private-badge');
    const badgeText = hidden && mine ? `🔒 ${T('onlyMeShort')}` : followersOnly ? `👥 ${T('followersShort')}` : '';
    if (badgeText && !badge) { badge = node('span', { className: 'mw-private-badge' });post.querySelector('.post-meta')?.append(badge); }
    if (badge) { if (badgeText) badge.textContent = badgeText;else badge.remove(); }
    const menu = post.querySelector('.actions .mw-message-menu');
    if (menu && mine) {
      let toggle = menu.querySelector('[data-mw-privacy]');
      if (!toggle) { toggle = node('button', { type: 'button' });toggle.dataset.mwPrivacy = '';(menu.querySelector('.mw-message-menu-items') || menu).append(toggle); }
      const limited = hidden || followersOnly;
      toggle.textContent = T(limited ? 'makePublic' : 'makePrivate');
      toggle.onclick = async () => { try { await setAudience(postId, limited ? 'everyone' : 'only_me');toast(T('privacySaved')); } catch (error) { toast(error.message); } };
    }
    const files = filesCache.get(postId) || [];
    post.querySelector(':scope>.mw-post-docs')?.remove();
    if (files.length) {
      const box = node('div', { className: 'mw-post-docs' }, ...files.map(file => documentChip(file, () => openDocument(file))));
      (post.querySelector(':scope>.post-body') || post.querySelector(':scope>.signals,:scope>.actions'))?.before(box);
    }
  }
  let scheduled = false;
  const decorateAll = () => { scheduled = false;document.querySelectorAll('#feed .post[data-post-id]').forEach(decorate);loadFiles(); };
  if (byId('feed')) new MutationObserver(() => { if (!scheduled) { scheduled = true;requestAnimationFrame(decorateAll); } }).observe(byId('feed'), { childList: true });

  /* ---------- Profile gallery ---------- */
  const viewer = node('div', { className: 'mw-gallery-viewer', hidden: true });
  viewer.setAttribute('role', 'dialog');viewer.setAttribute('aria-modal', 'true');
  document.body.append(viewer);
  const closeViewer = () => { viewer.hidden = true;viewer.querySelectorAll('video').forEach(video => video.pause());viewer.replaceChildren(); };
  viewer.addEventListener('click', event => { if (event.target === viewer) closeViewer(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !viewer.hidden) { event.stopPropagation();closeViewer(); } }, true);
  function openViewer(item) {
    // Photos open in the zoom viewer (pinch, double-tap, reset); videos keep the plain player.
    if (item.type !== 'video' && window.MilkyWayZoom) { window.MilkyWayZoom.open(item.url, item.caption || ''); return; }
    const close = node('button', { type: 'button', className: 'mw-gallery-viewer-close', textContent: '×' });close.setAttribute('aria-label', T('close'));close.onclick = closeViewer;
    const media = item.type === 'video' ? node('video', { src: item.url, controls: true, autoplay: true, playsInline: true }) : node('img', { src: window.MilkyWayMedia?.image(item.url, 1080) || item.url, alt: item.caption || '' });
    viewer.replaceChildren(close, media, item.caption ? node('p', { textContent: item.caption }) : null);
    viewer.hidden = false;close.focus();
  }

  const renders = new WeakMap();
  // Galleries on screen, so a sign-in or token refresh repaints them with the owner's full library straight away.
  const shown = new Map();
  sb.auth.onAuthStateChange(event => {
    if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
    setTimeout(() => { for (const [container, ownerId] of shown) { if (container.isConnected) render(container, ownerId); else shown.delete(container); } }, 0);
  });
  async function render(container, ownerId) {
    if (!container || !ownerId) return;
    const serial = (renders.get(container) || 0) + 1;renders.set(container, serial);
    shown.set(container, ownerId);
    container.replaceChildren(label('h3', 'gallery', { className: 'mw-gallery-title' }), label('p', 'loading', { className: 'muted' }));
    try {
      // The signed-in owner always sees their whole library. Owner status comes from the local session, not only from the
      // gallery service: a slow or expired token check there used to hide the owner's own private posts and documents.
      const self = !!user?.id && user.id === ownerId;
      const loadGallery = async () => {
        let result = await api(`?action=gallery&owner=${ownerId}`, {}, true);
        // The service did not recognise the owner (stale token): refresh the session once and ask again.
        if (self && !result.mine && (await sb.auth.refreshSession().catch(() => ({}))).data?.session) result = await api(`?action=gallery&owner=${ownerId}`, {}, true);
        return result;
      };
      const [posts, gallery] = await Promise.all([
        sb.from('mw_posts').select('id,author_id,caption,media_url,media_type,created_at').eq('author_id', ownerId).order('created_at', { ascending: false }).limit(60),
        // Photos and videos live in Supabase, so the owner's gallery still opens when the document service is down.
        loadGallery().catch(error => { if (!self) throw error; return { mine: true, private: [...privatePosts].filter(([, owner]) => owner === ownerId).map(([id]) => id), files: [], offline: true }; }),
      ]);
      if (posts.error) throw posts.error;
      const mine = self;
      gallery.private.forEach(id => privatePosts.set(id, ownerId));remember();
      if (mine && gallery.audiences) { for (const [id, value] of Object.entries(gallery.audiences)) if (value === 'everyone') ownAudiences.delete(id);else ownAudiences.set(id, value);rememberOwn(); }
      const rows = (posts.data || []).filter(post => mine || !gallery.private.includes(post.id));
      const ids = rows.map(post => post.id);
      const extras = ids.length ? await fetch(`${social}?action=posts&ids=${ids.join(',')}`, { headers: await headers(true), cache: 'no-store', signal: AbortSignal.timeout(15000) }).then(response => response.ok ? response.json() : { posts: [] }).catch(() => ({ posts: [] })) : { posts: [] };
      if (renders.get(container) !== serial) return;
      const byPost = new Map(rows.map(post => [post.id, post]));
      // Reposts are copies of someone else's post, so they stay out of the reposter's media library.
      const reposted = new Set((extras.reposts || []).map(row => row.postId));
      const items = [];
      for (const post of rows) {
        if (reposted.has(post.id)) continue;
        if (post.media_url) items.push({ postId: post.id, type: post.media_type === 'video' ? 'video' : 'image', url: post.media_url, caption: post.caption || '', at: post.created_at });
        for (const media of extras.posts.find(extra => extra.postId === post.id)?.media || []) if (['image', 'video'].includes(media.type)) items.push({ postId: post.id, type: media.type, url: media.url, caption: post.caption || '', at: post.created_at });
      }
      for (const file of gallery.files) if (byPost.has(file.postId) && !reposted.has(file.postId)) items.push({ postId: file.postId, type: 'document', file, caption: byPost.get(file.postId).caption || '', at: file.createdAt });
      paintGallery(container, items, mine, ownerId);
    } catch (error) {
      if (renders.get(container) !== serial) return;
      container.replaceChildren(label('h3', 'gallery', { className: 'mw-gallery-title' }), node('p', { className: 'muted', textContent: error.message || T('unavailable') }));
    }
  }
  function paintGallery(container, items, mine, ownerId) {
    let tab = container.dataset.tab || 'all';
    const tabs = [['all', 'all'], ['image', 'photos'], ['video', 'videos'], ['document', 'documents']];
    const bar = node('div', { className: 'mw-gallery-tabs', role: 'tablist' });
    const grid = node('div', { className: 'mw-gallery-grid' });
    const privateTotal = new Set(items.filter(item => privatePosts.get(item.postId) === ownerId).map(item => item.postId)).size;
    const head = node('div', { className: 'mw-gallery-head' }, label('h3', 'gallery', { className: 'mw-gallery-title' }), mine && privateTotal ? node('span', { className: 'mw-gallery-private-count', textContent: `🔒 ${T('privateCount', { n: privateTotal })}` }) : null);
    const paint = () => {
      container.dataset.tab = tab;
      bar.replaceChildren(...tabs.map(([type, key]) => {
        const count = type === 'all' ? items.length : items.filter(item => item.type === type).length;
        const button = node('button', { type: 'button', className: `mw-gallery-tab${tab === type ? ' active' : ''}` }, node('span', { textContent: T(key) }), node('small', { textContent: String(count) }));
        button.setAttribute('role', 'tab');button.setAttribute('aria-selected', String(tab === type));
        button.onclick = () => { tab = type;paint(); };
        return button;
      }));
      const shown = items.filter(item => tab === 'all' || item.type === tab);
      grid.classList.toggle('mw-gallery-docs', tab === 'document');
      grid.replaceChildren(...shown.map(item => tile(item, mine, ownerId, () => paintGallery(container, items, mine, ownerId))));
      if (!shown.length) grid.append(node('div', { className: 'mw-gallery-empty' }, node('span', { className: 'mw-gallery-empty-icon', textContent: { image: '🖼️', video: '🎬', document: '📄' }[tab] || '🌌' }), label('p', items.length ? 'emptyTab' : mine ? 'emptyMine' : 'empty', { className: 'muted' })));
    };
    paint();
    container.replaceChildren(head, mine ? label('p', 'privacyHint', { className: 'muted mw-gallery-hint' }) : null, bar, grid);
  }
  function tile(item, mine, ownerId, repaint) {
    const hidden = privatePosts.get(item.postId) === ownerId;
    const element = node('div', { className: `mw-gallery-tile mw-gallery-${item.type}${hidden ? ' is-private' : ''}` });
    if (item.type === 'document') element.append(documentChip(item.file, () => openDocument(item.file)));
    else {
      const open = node('button', { type: 'button', className: 'mw-gallery-open' });
      open.setAttribute('aria-label', item.caption || T(item.type === 'video' ? 'videos' : 'photos'));
      open.append(item.type === 'video' ? node('video', { src: `${item.url}#t=0.1`, muted: true, playsInline: true, preload: 'metadata' }) : node('img', { src: window.MilkyWayMedia?.image ? window.MilkyWayMedia.image(item.url, 360) : item.url, alt: '', loading: 'lazy', decoding: 'async' }));
      if (item.type === 'video') open.append(node('span', { className: 'mw-gallery-play', textContent: '▶' }));
      open.onclick = () => openViewer(item);
      element.append(open);
      // Every photo and video exposes the gift action; self-gifting is explained by the picker.
      if (window.MilkyWayGifts) element.insertAdjacentHTML('beforeend', window.MilkyWayGifts.buttonHtml(item.postId, ownerId).replace('class="act mwg-gift-act"', 'class="mwg-gift-act mwg-tile-gift"'));
    }
    if (mine) {
      const followersOnly = !hidden && ownAudiences.get(item.postId) === 'followers', limited = hidden || followersOnly;
      const privacy = node('button', { type: 'button', className: 'mw-gallery-privacy', textContent: hidden ? `🔒 ${T('onlyMeShort')}` : followersOnly ? `👥 ${T('followersShort')}` : `🌍 ${T('everyoneShort')}` });
      privacy.title = T(limited ? 'makePublic' : 'makePrivate');privacy.setAttribute('aria-label', privacy.title);
      privacy.onclick = async () => {
        privacy.disabled = true;
        try { await setAudience(item.postId, limited ? 'everyone' : 'only_me');toast(T('privacySaved'));repaint(); }
        catch (error) { toast(error.message);privacy.disabled = false; }
      };
      element.append(privacy);
    }
    return element;
  }

  window.addEventListener('mw-language-change', () => document.querySelectorAll('[data-mw-gallery]').forEach(element => { if (element.childElementCount === 0) element.textContent = T(element.dataset.mwGallery); }));
  window.MilkyWayGallery = { visible, setAudience, uploadDocument, sendWithProgress, forget, audienceControl, documentChip, isDocument, render, words, T };
})();
