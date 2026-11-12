(() => {
  // Inline comments, searchable emoji, people tagging, multi-media composer, post menu extras, account security and the toolbar live pill.
  const byId = id => document.getElementById(id);
  const t = key => window.MilkyWayI18n.t(key);
  const social = '/api/milkyway-social';
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const node = (tag, props = {}, ...children) => { const element = Object.assign(document.createElement(tag), props); element.append(...children.filter(child => child != null)); return element; };
  const i18n = (tag, key, props = {}) => { const element = node(tag, props); element.dataset.mwI18n = key; element.textContent = t(key); return element; };
  async function token() { const session = (await sb.auth.getSession()).data.session; if (!session) throw new Error(t('signInFirst')); return session.access_token; }
  async function api(query, options = {}, auth = true) {
    const response = await fetch(`${social}${query}`, { ...options, headers: { ...options.headers, ...(auth ? { Authorization: `Bearer ${await token()}`, apikey: sb.supabaseKey || '' } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(window.MilkyWayI18n.text(result.error || t('retry'))); }
    return response.status === 204 ? null : response.json();
  }
  const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  /* ---------- Searchable emoji picker ---------- */
  const EMOJI = `😀 grin smile happy furaha|😃 smile happy|😄 laugh smile|😁 beam grin|😆 laugh|😅 sweat relief|😂 joy tears laugh cheka|🤣 rofl laugh|🥲 smile tear|🥹 holding tears grateful|😊 blush smile|😇 angel halo|🙂 slight smile|🙃 upside down|😉 wink|😌 relieved calm|😍 heart eyes love penda|🥰 love hearts|😘 kiss|😗 kiss|😋 yum tasty|😛 tongue|😜 wink tongue|🤪 zany crazy|😝 squint tongue|🤑 money|🤗 hug|🤭 giggle oops|🫢 gasp|🫣 peek|🤫 shush quiet|🤔 think hmm|🫡 salute respect|🤐 zip quiet|🤨 raised eyebrow|😐 neutral|😑 expressionless|😶 silent|🫥 dotted invisible|😏 smirk|😒 unamused|🙄 eye roll|😬 grimace|😮‍💨 exhale|🤥 lying|😔 pensive sad|😪 sleepy|🤤 drool|😴 sleep lala|😷 mask sick|🤒 fever sick|🤕 hurt|🤢 nausea|🤮 vomit|🥵 hot|🥶 cold baridi|🥴 woozy|😵 dizzy|🤯 mind blown|🤠 cowboy|🥳 party celebrate sherehe|🥸 disguise|😎 cool sunglasses|🤓 nerd|🧐 monocle|😕 confused|🫤 diagonal mouth|😟 worried|🙁 frown|😮 open mouth wow|😯 hushed|😲 astonished|😳 flushed|🥺 pleading please|😦 frowning|😧 anguished|😨 fearful|😰 anxious|😥 sad relieved|😢 cry sad lia|😭 sob cry|😱 scream|😖 confounded|😣 persevere|😞 disappointed|😓 sweat|😩 weary|😫 tired|🥱 yawn|😤 triumph huff|😡 angry hasira|😠 angry|🤬 cursing|😈 devil|👿 imp|💀 skull dead|💩 poop|🤡 clown|👻 ghost|👽 alien|🤖 robot|😺 cat smile|😻 cat love|🙈 see no evil monkey|🙉 hear no evil|🙊 speak no evil|💋 kiss lips|💌 love letter|💘 heart arrow|💝 heart gift|💖 sparkling heart|💗 growing heart|💓 beating heart|💞 revolving hearts|💕 two hearts|❣️ heart exclamation|💔 broken heart|❤️‍🔥 heart fire|❤️‍🩹 mending heart|❤️ red heart love moyo|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|🩵 light blue heart|💜 purple heart|🤎 brown heart|🖤 black heart|🩶 grey heart|🤍 white heart|💯 hundred perfect|💢 anger|💥 boom|💫 dizzy star|💦 sweat drops|💨 dash|💬 speech comment|🗨️ speech|💭 thought|💤 zzz sleep|👋 wave hello habari|🤚 raised back hand|🖐️ hand fingers|✋ raised hand|🖖 vulcan|🫱 right hand|🫲 left hand|👌 ok|🤌 pinched fingers|🤏 pinch small|✌️ peace victory|🤞 crossed fingers luck|🫰 heart fingers|🤟 love you|🤘 rock|🤙 call me|👈 point left|👉 point right|👆 point up|👇 point down|☝️ index up|🫵 point you|👍 thumbs up like good|👎 thumbs down|✊ fist|👊 punch|🤛 fist left|🤜 fist right|👏 clap applause hongera|🙌 raise hands praise|🫶 heart hands|👐 open hands|🤲 palms up pray|🤝 handshake deal|🙏 pray thanks asante|✍️ writing|💪 strong muscle nguvu|🦾 mechanical arm|🧠 brain|👀 eyes look|👁️ eye|👶 baby|🧒 child|👦 boy|👧 girl|🧑 person|👨 man|👩 woman|🧓 older person|👴 old man|👵 old woman|👮 police|🕵️ detective|💂 guard|👷 worker|🤴 prince|👸 princess|👳 turban|🧕 headscarf|🤵 tuxedo|👰 bride|🤰 pregnant|🧑‍🍼 feeding baby|👼 angel baby|🎅 santa|🦸 superhero|🧙 mage|🧚 fairy|🧜 merperson|💃 dance woman|🕺 dance man|👯 party dancers|🧘 yoga|🏃 run|🚶 walk|🧎 kneel|👨‍👩‍👧 family|💑 couple love|👪 family|🗣️ speaking|👤 silhouette|🐶 dog|🐱 cat|🦁 lion simba|🐯 tiger|🐘 elephant tembo|🦒 giraffe twiga|🦓 zebra pundamilia|🦏 rhino|🐆 leopard chui|🐒 monkey|🦍 gorilla|🐔 chicken kuku|🐦 bird ndege|🦅 eagle|🦋 butterfly|🐝 bee|🐞 ladybug|🐟 fish samaki|🐬 dolphin|🐳 whale|🐢 turtle|🐍 snake|🌸 blossom flower|🌹 rose|🌻 sunflower|🌺 hibiscus|🌷 tulip|🌱 seedling|🌴 palm|🌳 tree|🍀 clover luck|🍁 maple leaf|🌍 earth africa world dunia|🌎 earth americas|🌏 earth asia|🌕 full moon|🌙 crescent moon|⭐ star nyota|🌟 glowing star|✨ sparkles light|⚡ lightning|🔥 fire moto|🌈 rainbow|☀️ sun jua|🌤️ sun cloud|☁️ cloud|🌧️ rain mvua|❄️ snow|🌊 wave ocean|🌌 milky way galaxy|🪐 planet saturn|☄️ comet|🚀 rocket launch|🛸 ufo|🍎 apple|🍌 banana ndizi|🍉 watermelon tikiti|🍇 grapes|🍓 strawberry|🥭 mango embe|🍍 pineapple nanasi|🥥 coconut nazi|🥑 avocado parachichi|🌽 corn mahindi|🍞 bread mkate|🍔 burger|🍟 fries|🍕 pizza|🍗 chicken leg|🍚 rice wali|🍛 curry|🍜 noodles|🍣 sushi|🍰 cake keki|🎂 birthday cake|🍫 chocolate|🍩 donut|🍿 popcorn|☕ coffee kahawa|🍵 tea chai|🧃 juice|🥤 soda|🍺 beer|🍷 wine|🥂 cheers toast|🍽️ dinner|⚽ football soccer mpira|🏀 basketball|🏈 american football|⚾ baseball|🎾 tennis|🏐 volleyball|🏏 cricket|🥊 boxing|🏆 trophy winner|🥇 gold medal first|🥈 silver medal|🥉 bronze medal|🎯 target bullseye|🎮 game|🎲 dice|🎨 art palette sanaa|🎬 movie clapper|🎤 microphone sing|🎧 headphones music|🎼 music score|🎵 music note|🎶 music notes muziki|🎹 piano|🥁 drum ngoma|🎸 guitar|🎺 trumpet|🎻 violin|📷 camera picha|📸 camera flash|🎥 movie camera|📹 video camera|📺 tv|📻 radio|📱 phone simu|💻 laptop|🖥️ desktop|⌨️ keyboard|🖨️ printer|💡 idea bulb|🔦 flashlight|📚 books|📖 book|📝 memo note|✏️ pencil|🖊️ pen|📌 pin|📎 paperclip attach|✂️ scissors|📅 calendar|📈 chart up growth|📉 chart down|📊 bar chart|💼 briefcase work kazi|💰 money bag pesa|💵 dollar|💳 card|🧾 receipt|✉️ envelope mail|📩 envelope arrow|📨 incoming|📦 package|🏠 home nyumbani|🏡 house garden|🏢 office|🏫 school shule|🏥 hospital|⛪ church kanisa|🕌 mosque msikiti|🏟️ stadium|🗼 tower|🗽 liberty|🏔️ mountain kilimanjaro|🏝️ island|🏖️ beach|🚗 car gari|🚕 taxi|🚌 bus|🚑 ambulance|🚒 fire engine|🚓 police car|🏍️ motorcycle bodaboda|🚲 bicycle|✈️ airplane ndege|🚢 ship|⏰ alarm clock|⌛ hourglass|⏳ hourglass time|🎁 gift zawadi|🎈 balloon|🎉 party popper celebrate|🎊 confetti|🎀 ribbon|🪅 pinata|🎆 fireworks|🎇 sparkler|🕯️ candle|🔔 bell notification|🔕 bell off|📣 megaphone|📢 loudspeaker announce|🔒 lock|🔓 unlock|🔑 key|🛡️ shield security|⚖️ justice balance|🩺 stethoscope|💊 pill|🧪 test tube|🔬 microscope|🔭 telescope|📡 satellite|🧭 compass|🗺️ map|✅ check yes done|☑️ ballot check|✔️ check mark|❌ cross no|⭕ circle|❗ exclamation|❓ question|‼️ double exclamation|⚠️ warning|🚫 prohibited|♻️ recycle|🆗 ok button|🆕 new|🆒 cool|🔝 top|🔴 red circle live|🟢 green circle|🔵 blue circle|🟡 yellow circle|🏳️ white flag|🏴 black flag|🏁 finish flag|🇹🇿 tanzania flag|🇰🇪 kenya flag|🇺🇬 uganda flag|🇷🇼 rwanda flag|🇨🇩 congo flag|🇿🇦 south africa flag|🇳🇬 nigeria flag|🇫🇷 france flag|🇨🇳 china flag|🇬🇧 uk flag|🇺🇸 usa flag`.split('|').map(entry => { const [emoji, ...words] = entry.split(' '); return { emoji, words: words.join(' ') }; });
  const recentKey = 'mw_recent_emoji';
  function emojiPicker(onPick) {
    const panel = node('div', { className: 'mw-emoji-panel', hidden: true });
    panel.setAttribute('role', 'dialog');
    const search = node('input', { type: 'search', className: 'mw-emoji-search', autocomplete: 'off' });
    search.dataset.mwPlaceholder = 'searchEmoji'; search.placeholder = t('searchEmoji'); search.setAttribute('aria-label', t('searchEmoji'));
    const grid = node('div', { className: 'mw-emoji-grid' });
    const paint = () => {
      const query = search.value.trim().toLowerCase();
      const recent = JSON.parse(localStorage.getItem(recentKey) || '[]');
      const list = query ? EMOJI.filter(item => item.words.includes(query) || item.emoji === query) : [...recent.map(emoji => ({ emoji, words: '' })), ...EMOJI.filter(item => !recent.includes(item.emoji))];
      grid.replaceChildren(...list.slice(0, 400).map(item => { const button = node('button', { type: 'button', textContent: item.emoji, title: item.words }); button.setAttribute('aria-label', item.words || item.emoji); button.onclick = () => { localStorage.setItem(recentKey, JSON.stringify([item.emoji, ...recent.filter(value => value !== item.emoji)].slice(0, 16))); onPick(item.emoji); }; return button; }));
      if (!list.length) grid.append(i18n('p', 'noResults', { className: 'muted' }));
    };
    search.oninput = paint;
    panel.append(search, grid);
    panel.toggle = force => { panel.hidden = force === undefined ? !panel.hidden : !force; if (!panel.hidden) { search.placeholder = t('searchEmoji'); paint(); search.focus({ preventScroll: true }); } };
    return panel;
  }
  function insertAtCursor(input, text) {
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? input.value.length;
    input.setRangeText(text, start, end, 'end'); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus({ preventScroll: true });
  }

  /* ---------- People tagging ---------- */
  function tagPicker(onPick) {
    const panel = node('div', { className: 'mw-tag-panel', hidden: true });
    const search = node('input', { type: 'search', autocomplete: 'off' });
    search.placeholder = t('searchPeople'); search.setAttribute('aria-label', t('searchPeople'));
    const results = node('div', { className: 'mw-tag-results' });
    let timer = 0, serial = 0;
    search.oninput = () => { clearTimeout(timer); timer = setTimeout(async () => {
      const query = search.value.trim().replace(/^@/, '').replace(/[%,()*]/g, '');
      const mine = ++serial;
      if (query.length < 2) { results.replaceChildren(); return; }
      const { data, error } = await sb.from('mw_profiles').select('id,display_name,username,avatar_url').or(`username.ilike.%${query}%,display_name.ilike.%${query}%`).limit(8);
      if (mine !== serial) return;
      if (error) { results.textContent = error.message; return; }
      results.replaceChildren(...(data || []).filter(person => person.id !== user?.id).map(person => { const button = node('button', { type: 'button', className: 'mw-tag-result' }, node('b', { textContent: person.display_name || person.username || '' }), node('small', { textContent: person.username ? `@${person.username}` : '' })); button.onclick = () => { onPick({ id: person.id, name: person.display_name || person.username || '', username: person.username || '' }); search.value = ''; results.replaceChildren(); }; return button; }));
      if (!results.children.length) results.append(i18n('p', 'noResults', { className: 'muted' }));
    }, 250); };
    panel.append(search, results);
    panel.toggle = force => { panel.hidden = force === undefined ? !panel.hidden : !force; if (!panel.hidden) { search.placeholder = t('searchPeople'); search.focus({ preventScroll: true }); } };
    return panel;
  }
  function tagChips(tags, onRemove) {
    return node('div', { className: 'mw-tag-chips' }, ...tags.map((tag, index) => { const chip = node('span', { className: 'mw-tag-chip', textContent: `@${tag.username || tag.name}` }); if (onRemove) { const remove = node('button', { type: 'button', textContent: '×' }); remove.setAttribute('aria-label', t('remove')); remove.onclick = () => onRemove(index); chip.append(remove); } return chip; }));
  }

  /* ---------- Uploads to the caller's own public post folder ---------- */
  const VIDEO_MIME_BY_EXTENSION = {
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    ogv: 'video/ogg', ogg: 'video/ogg', '3gp': 'video/3gpp', '3gpp': 'video/3gpp',
    '3g2': 'video/3gpp2', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    mpeg: 'video/mpeg', mpg: 'video/mpeg', mpe: 'video/mpeg', vob: 'video/mpeg',
    ts: 'video/mp2t', mts: 'video/mp2t', m2ts: 'video/mp2t', wmv: 'video/x-ms-wmv',
    asf: 'video/x-ms-asf', flv: 'video/x-flv', qt: 'video/quicktime', mp4v: 'video/mp4',
    divx: 'video/divx'
  };
  const videoMime = file => {
    const type = String(file?.type || '').toLowerCase();
    if (type.startsWith('video/')) return type;
    const extension = /\.([a-z0-9]+)$/i.exec(String(file?.name || ''))?.[1]?.toLowerCase();
    return VIDEO_MIME_BY_EXTENSION[extension] || '';
  };
  const isVideoFile = file => !!(videoMime(file) || window.MilkyWayVideo?.isVideo?.(file));
  // A JPEG frame saved next to each video (<video path>.poster.jpg) becomes the picture in shared-link previews.
  // Best effort: a video whose frame cannot be read is still posted.
  async function uploadPoster(file, path) {
    const source = URL.createObjectURL(file);
    try {
      const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: source });
      const ready = (event) => new Promise((resolve, reject) => { video.addEventListener(event, resolve, { once: true }); video.addEventListener('error', reject, { once: true }); setTimeout(reject, 6000); });
      await ready('loadeddata');
      const seeked = ready('seeked');
      video.currentTime = Math.min(1, (video.duration || 0) / 3);
      await seeked;
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight, 1));
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(video.videoWidth * scale), height: Math.round(video.videoHeight * scale) });
      if (!canvas.width || !canvas.height) return;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const poster = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (poster) await sb.storage.from('portfolio').upload(`${path}.poster.jpg`, poster, { contentType: 'image/jpeg', upsert: false });
    } catch {} finally { URL.revokeObjectURL(source); }
  }
  // Sends the file to Storage with XHR so the composer can show a real percentage.
  async function storageUpload(path, file, onProgress) {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error(t('signInFirst'));
    const base = String(sb.storageUrl || `${typeof SUPABASE_URL === 'string' ? SUPABASE_URL : ''}/storage/v1`).replace(/\/$/, '');
    const url = `${base}/object/portfolio/${path.split('/').map(encodeURIComponent).join('/')}`;
    try {
      const { ok, result } = await window.MilkyWayGallery.sendWithProgress('POST', url, { headers: { Authorization: `Bearer ${session.access_token}`, apikey: sb.supabaseKey || '', 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false', 'cache-control': 'max-age=3600' }, body: file, onProgress });
      if (!ok) throw new Error(result?.message || result?.error || t('retry'));
    } catch (error) {
      if (!error.network) throw error;
      // The direct request was blocked: retry through the regular client, without a percentage.
      const fallback = await sb.storage.from('portfolio').upload(path, file, { contentType: file.type, upsert: false });
      if (fallback.error) throw fallback.error;
    }
  }
  const VIDEO_LIMIT = 100 * 1024 * 1024;
  // Starts shrinking an oversized video as soon as it is picked, so it is often ready by the time Publish is tapped.
  const prepareVideo = file => { if (isVideoFile(file)) window.MilkyWayVideo?.prepare(file, { maxBytes: VIDEO_LIMIT }); };
  async function upload(original, onProgress) {
    const kind = isVideoFile(original) ? 'video' : original.type.startsWith('image/') ? 'image' : 'file';
    if (kind === 'file') throw new Error(t('unsupportedFile'));
    onProgress?.(0);
    // An oversized video is quietly shrunk first; that step fills the first 60% of the same progress bar.
    let shrink = 0;
    const mime = kind === 'video' ? videoMime(original) : '';
    const prepared = kind === 'video' && window.MilkyWayVideo ? await window.MilkyWayVideo.prepare(original, { maxBytes: VIDEO_LIMIT, onProgress: percent => { shrink = 60; onProgress?.(Math.floor(percent * 0.6)); } }) : original;
    const file = mime && !String(prepared.type || '').toLowerCase().startsWith('video/') ? new File([prepared], prepared.name, { type: mime, lastModified: prepared.lastModified }) : prepared;
    if (file.size > (kind === 'video' ? VIDEO_LIMIT : 10 * 1024 * 1024)) throw new Error(t(kind === 'video' ? 'videoTooLarge' : 'photoTooLarge'));
    const path = `milkyway/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-60)}`;
    // A video still saves its preview frame after the upload, so hold at 97% until that is done.
    await storageUpload(path, file, percent => onProgress?.(kind === 'video' ? shrink + Math.floor(Math.min(97, percent) * (100 - shrink) / 100) : percent));
    if (kind === 'video') await uploadPoster(file, path);
    onProgress?.(100);
    return { url: sb.storage.from('portfolio').getPublicUrl(path).data.publicUrl, type: kind, name: file.name.slice(0, 120), path };
  }
  const mediaElement = item => {
    if (item.type === 'video') { const video = node('video', { src: item.url, controls: true, playsInline: true, preload: 'metadata' }); return video; }
    return node('img', { src: window.MilkyWayMedia?.image(item.url, 720) || item.url, alt: item.name || '', loading: 'lazy', decoding: 'async' });
  };

  /* ---------- Inline comments: the thread and input open directly under the post, so posts above and below stay in view ---------- */
  const panels = new Map(); // one panel per post, so an unsent draft survives closing the thread
  let activePostId = null;
  const articleOf = postId => document.getElementById(`post-${postId}`);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && activePostId && articleOf(activePostId)?.contains(document.activeElement) && !document.querySelector('.mw-emoji-panel:not([hidden]),.mw-tag-panel:not([hidden])')) closePanel(); });
  function renderBody(text, tags) {
    const fragment = document.createDocumentFragment();
    const usernames = new Map(tags.map(tag => [`@${(tag.username || '').toLowerCase()}`, tag]));
    text.split(/(@[a-zA-Z0-9_.]{2,40})/g).forEach(part => {
      const tag = usernames.get(part.toLowerCase());
      if (tag) { const link = node('button', { type: 'button', className: 'mw-mention', textContent: part }); link.onclick = () => openPublicProfile(tag.id); fragment.append(link); }
      else fragment.append(part);
    });
    return fragment;
  }
  async function loadComments(state) {
    const { data, error } = await sb.from('mw_echoes').select('*').eq('post_id', state.postId).order('created_at');
    if (error) throw error;
    let extras = [];
    try { extras = (await api(`?action=comments&posts=${state.postId}`, {}, false)).comments; } catch {}
    state.extras = new Map(extras.map(extra => [extra.commentId, extra]));
    // Comments written offline show in the thread (marked as waiting) until they have synced.
    const known = new Set((data || []).map(comment => comment.id));
    const waiting = (window.MilkyWayOutbox?.comments(state.postId) || []).filter(comment => !known.has(comment.id));
    for (const comment of waiting) if (!state.extras.has(comment.id)) state.extras.set(comment.id, { commentId: comment.id, parentId: comment.mw_parent, tags: [], media: [] });
    state.comments = [...(data || []), ...waiting];
  }
  function paintComments(state) {
    const list = state.list;
    list.replaceChildren();
    if (!state.comments.length) { list.append(i18n('p', 'noComments', { className: 'muted mw-comment-empty' })); return; }
    const ids = new Set(state.comments.map(comment => comment.id));
    const roots = state.comments.filter(comment => { const parent = state.extras.get(comment.id)?.parentId; return !parent || !ids.has(parent); });
    const children = parent => state.comments.filter(comment => state.extras.get(comment.id)?.parentId === parent);
    const row = (comment, depth) => {
      const extra = state.extras.get(comment.id) || { tags: [], media: [] };
      const mine = logged() && comment.user_id === user.id;
      const item = node('article', { className: `mw-comment${depth ? ' mw-reply' : ''}${comment.mwPending ? ' mw-comment-pending' : ''}` });
      item.dataset.commentId = comment.id;
      const head = node('header', {}, node('b', { textContent: comment.author_name || 'Msafiri' }), node('small', { textContent: comment.mwPending ? window.MilkyWayOutbox.text('waiting') : ago(comment.created_at) }));
      const body = node('p', { className: 'mw-comment-body' }); body.append(renderBody(comment.body, extra.tags || []));
      const media = (extra.media || []).length ? node('div', { className: 'mw-comment-media' }, ...extra.media.map(mediaElement)) : null;
      const tools = node('div', { className: 'mw-comment-tools' });
      const reply = i18n('button', 'reply', { type: 'button' }); reply.onclick = () => { state.replyTo = comment; state.paintReply(); state.showComposer?.(true); state.input.focus({ preventScroll: true }); };
      if (!comment.mwPending) tools.append(reply);
      if (mine && !comment.mwPending) {
        const edit = i18n('button', 'edit', { type: 'button' }); edit.onclick = () => editComment(state, comment, item, body);
        const remove = i18n('button', 'delete', { type: 'button', className: 'danger' }); remove.onclick = () => deleteComment(state, comment, remove);
        tools.append(edit, remove);
      } else if (logged()) {
        const report = i18n('button', 'report', { type: 'button', className: 'danger' }); report.onclick = () => reportComment(state, comment, report);
        tools.append(report);
      }
      // Facebook-style row: a round initial, then the name and text in one bubble with Reply/Edit links under it.
      const name = comment.author_name || 'Msafiri';
      const avatar = node('span', { className: 'mw-comment-avatar', textContent: name.trim().slice(0, 1).toUpperCase() || 'M' }); avatar.setAttribute('aria-hidden', 'true');
      item.append(avatar, node('div', { className: 'mw-comment-main' }, ...[node('div', { className: 'mw-comment-bubble' }, head, body), media, tools].filter(Boolean)));
      list.append(item);
      if (depth < 3) children(comment.id).forEach(child => row(child, depth + 1));
    };
    roots.forEach(comment => row(comment, 0));
  }
  async function refresh(state, { keepScroll = true } = {}) {
    try { await loadComments(state); paintComments(state); }
    catch (error) {
      // Offline: the thread on screen stays as it is.
      if (window.MilkyWayOutbox?.isNetworkError(error) && state.list.querySelector('.mw-comment')) return;
      state.list.replaceChildren(node('p', { className: 'muted', textContent: window.MilkyWayOffline?.friendly(error.message) || error.message || t('retry') }));
    }
    if (!keepScroll) state.list.scrollTop = state.list.scrollHeight;
    if (typeof refreshPostEchoPreview === 'function') await refreshPostEchoPreview(state.postId).catch(() => {});
  }
  function editComment(state, comment, item, body) {
    if (item.querySelector('.mw-comment-edit')) return;
    const area = node('textarea', { value: comment.body, maxLength: 1000, rows: 3 });
    const save = i18n('button', 'save', { type: 'button', className: 'btn primary' });
    const cancel = i18n('button', 'cancel', { type: 'button', className: 'btn ghost' });
    const form = node('div', { className: 'mw-comment-edit' }, area, node('div', { className: 'row' }, cancel, save));
    body.hidden = true; body.after(form); area.focus();
    cancel.onclick = () => { form.remove(); body.hidden = false; };
    save.onclick = async () => {
      const clean = area.value.trim();
      if (!clean) return toast(t('commentEmpty'));
      if (save.disabled) return;
      save.disabled = true;
      const { error } = await sb.from('mw_echoes').update({ body: clean }).eq('id', comment.id).eq('user_id', user.id);
      save.disabled = false;
      if (error) return toast(error.message);
      toast(t('saved')); await refresh(state);
    };
  }
  async function deleteComment(state, comment, button) {
    if (button.disabled || !(await window.MilkyWayDialog.confirm({ message: t('confirmDeleteComment'), confirmText: t('delete'), danger: true })) || button.disabled) return;
    button.disabled = true;
    const { error } = await sb.from('mw_echoes').delete().eq('id', comment.id).eq('user_id', user.id);
    if (error) { button.disabled = false; return toast(error.message); }
    api(`?action=comment&id=${comment.id}`, { method: 'DELETE' }).catch(() => {});
    toast(t('deleted')); await refresh(state);
  }
  async function reportComment(state, comment, button) {
    const reason = await window.MilkyWayDialog.prompt({ message: t('reportReasonPrompt'), multiline: true, maxLength: 900 });
    if (reason === null || button.disabled) return;
    button.disabled = true;
    const reported = uuid.test(comment.user_id) ? comment.user_id : null;
    const { error } = await sb.from('mw_reports').insert({ reporter_id: user.id, post_id: state.postId, reported_user_id: reported, reason: 'comment', details: `comment:${comment.id} ${reason.trim()}`.slice(0, 1000) });
    button.disabled = false;
    toast(error ? error.message : t('reportSent'));
  }
  function buildPanel(postId) {
    const state = { postId, comments: [], extras: new Map(), media: [], tags: [], replyTo: null, sending: false };
    const panel = node('div', { className: 'mw-inline-comments' });
    panel.dataset.postId = postId;
    const head = node('header', {}, i18n('strong', 'comments'));
    const close = node('button', { type: 'button', className: 'mw-inline-close', textContent: '×' }); close.setAttribute('aria-label', t('hideComments')); close.title = t('hideComments');
    close.onclick = () => closePanel();
    head.append(close);
    state.list = node('div', { className: 'mw-comment-list' });
    state.list.setAttribute('role', 'log'); state.list.setAttribute('aria-live', 'polite');
    state.list.append(i18n('p', 'loading', { className: 'muted' }));
    const replyBar = node('div', { className: 'mw-reply-bar', hidden: true });
    state.paintReply = () => {
      replyBar.hidden = !state.replyTo; replyBar.replaceChildren();
      if (!state.replyTo) return;
      const cancel = node('button', { type: 'button', textContent: '×' }); cancel.setAttribute('aria-label', t('cancel'));
      cancel.onclick = () => { state.replyTo = null; state.paintReply(); };
      replyBar.append(node('span', { textContent: `${t('replyingTo')} ${state.replyTo.author_name || ''}` }), cancel);
    };
    const input = node('textarea', { className: 'mw-comment-input', rows: 2, maxLength: 1000 });
    input.placeholder = t('writeComment'); input.setAttribute('aria-label', t('writeComment'));
    input.onkeydown = event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); send.click(); } };
    state.input = input;
    const previews = node('div', { className: 'mw-attach-previews' });
    const chips = node('div');
    const status = node('p', { className: 'mw-comment-status', role: 'status' });
    const paintAttachments = () => {
      previews.replaceChildren(...state.media.map((item, index) => { const remove = node('button', { type: 'button', textContent: '×' }); remove.setAttribute('aria-label', t('remove')); remove.onclick = () => { if (item.preview) URL.revokeObjectURL(item.preview); window.MilkyWayVideo?.cancel(item.file); state.media.splice(index, 1); paintAttachments(); }; const preview = isVideoFile(item.file) ? node('video', { src: item.preview, controls: true, playsInline: true }) : node('img', { src: item.preview, alt: '' }); return node('div', { className: 'mw-attach-preview' }, preview, remove); }));
      chips.replaceChildren(tagChips(state.tags, index => { state.tags.splice(index, 1); paintAttachments(); }));
    };
    const emoji = emojiPicker(value => { if (!state.sending) insertAtCursor(input, value); });
    state.closePickers = () => { emoji.toggle(false); people.toggle(false); };
    const people = tagPicker(person => { if (state.sending) return;if (!state.tags.some(tag => tag.id === person.id)) state.tags.push(person); insertAtCursor(input, `@${person.username || person.name.replace(/\s+/g, '')} `); people.toggle(false); paintAttachments(); });
    const file = node('input', { type: 'file', accept: 'image/*,video/*,.mkv,.mov,.avi,.wmv,.asf,.flv,.ogv,.vob,.qt,.3gp,.3g2,.mpeg,.mpg,.mpe,.ts,.mts,.m2ts,.mp4v,.divx', multiple: true, hidden: true });
    file.onchange = () => { for (const chosen of [...file.files].slice(0, 4 - state.media.length)) { state.media.push({ file: chosen, preview: URL.createObjectURL(chosen) }); prepareVideo(chosen); } file.value = ''; paintAttachments(); };
    const emojiButton = node('button', { type: 'button', className: 'mw-tool', textContent: '😊' }); emojiButton.setAttribute('aria-label', t('emoji')); emojiButton.title = t('emoji');
    emojiButton.onclick = () => { people.toggle(false); emoji.toggle(); };
    const tagButton = i18n('button', 'tagPeople', { type: 'button', className: 'mw-tool' });
    tagButton.onclick = () => { if (!requireLogin('')) return; emoji.toggle(false); people.toggle(); };
    const attachButton = i18n('button', 'attachImage', { type: 'button', className: 'mw-tool' });
    attachButton.onclick = () => { if (requireLogin('')) file.click(); };
    const send = i18n('button', 'sendComment', { type: 'button', className: 'btn primary mw-comment-send' });
    send.onclick = () => submit(state, send, status, paintAttachments);
    const composer = node('div', { className: 'mw-comment-composer' }, replyBar, input, previews, chips, emoji, people, node('div', { className: 'mw-comment-actions' }, emojiButton, tagButton, attachButton, file, send), status);
    // After a comment is sent the input closes; this button opens it again for another comment.
    const reopen = node('button', { type: 'button', className: 'mw-tool mw-comment-reopen', hidden: true }, node('span', { textContent: '💬 ' }), i18n('span', 'writeComment'));
    reopen.onclick = () => { state.showComposer(true); input.focus({ preventScroll: true }); };
    state.showComposer = open => { composer.hidden = !open; reopen.hidden = open; };
    panel.append(head, state.list, composer, reopen);
    panel.mwState = state;
    state.panel = panel;
    return panel;
  }
  async function submit(state, send, status, paintAttachments) {
    if (state.sending || !requireLogin('')) return;
    const body = state.input.value.trim();
    if (!body && !state.media.length) { status.textContent = t('commentEmpty'); return; }
    const accountId = user.id;
    const controls = [...state.panel.querySelectorAll('input,textarea,select,button')].map(element => ({ element, disabled: element.disabled }));
    controls.forEach(({ element }) => { element.disabled = true; });
    state.sending = true; status.textContent = t('sending'); status.classList.remove('is-error'); status.setAttribute('role', 'status');
    try {
      // Upload once; a retry reuses files that already reached storage.
      for (const [index, item] of state.media.entries()) {
        if (item.uploaded) continue;
        const label = `${t('uploadProgress')} ${index + 1}/${state.media.length}`;
        status.textContent = `${label} · 0%`;
        item.uploaded = await upload(item.file, percent => { status.textContent = `${label} · ${percent}%`; });
      }
      const text = body || '📎';
      if (user?.id !== accountId) throw new Error(t('authExpired'));
      if (!state.pendingId || state.pendingBody !== text || state.pendingUser !== accountId) { state.pendingId = crypto.randomUUID();state.pendingBody = text;state.pendingUser = accountId;state.pendingSaved = false; }
      const outbox = window.MilkyWayOutbox;
      // Offline, a text comment shows in the thread at once and is sent by itself when the connection is back.
      // Attachments need an upload, so those keep the draft and the friendly offline line instead.
      const queue = () => {
        const tags = state.tags.filter(tag => text.includes(`@${tag.username || tag.name.replace(/\s+/g, '')}`));
        const details = tags.length || state.replyTo ? { parentId: state.replyTo?.id, tags } : undefined;
        outbox.queue({ type: 'comment', id: state.pendingId, target: state.postId, author: nameOf(), body: text, details });
        state.input.value = ''; state.tags = []; state.replyTo = null; state.pendingId = null; state.pendingBody = null; state.pendingSaved = false;
        state.paintReply(); paintAttachments(); status.textContent = ''; state.showComposer(true);
        toast(outbox.text('queued'));
        loadComments(state).catch(() => { state.comments = [...state.comments.filter(comment => !comment.mwPending), ...outbox.comments(state.postId)]; }).finally(() => { paintComments(state); state.list.scrollTop = state.list.scrollHeight; });
        if (typeof refreshPostEchoPreview === 'function') refreshPostEchoPreview(state.postId).catch(() => {});
      };
      if (outbox && !state.media.length && !state.pendingSaved && outbox.offline()) { queue(); return; }
      if (!state.pendingSaved) {
        const { error } = await sb.from('mw_echoes').insert({ id: state.pendingId, post_id: state.postId, user_id: accountId, author_name: nameOf(), body: text }).select('id').single();
        if (error && outbox && !state.media.length && outbox.isNetworkError(error)) { queue(); return; }
        if (error?.code === '23505') {
          const existing = await sb.from('mw_echoes').select('id,post_id,user_id,body').eq('id', state.pendingId).single();
          if (existing.error || existing.data?.user_id !== accountId || existing.data?.post_id !== state.postId || existing.data?.body !== text) throw new Error(t('commentRetryConflict'));
        } else if (error) throw error;
        state.pendingSaved = true;
      }
      const media = state.media.map(item => item.uploaded);
      const tags = state.tags.filter(tag => text.includes(`@${tag.username || tag.name.replace(/\s+/g, '')}`));
      // The comment row already exists at this point, so a failure here keeps pendingId and the retry only resends the details.
      if (media.length || tags.length || state.replyTo) await api(`?action=comment&id=${state.pendingId}`, json({ parentId: state.replyTo?.id, media, tags }));
      const sentId = state.pendingId;
      state.media.forEach(item => URL.revokeObjectURL(item.preview));
      state.input.value = ''; state.media = []; state.tags = []; state.replyTo = null; state.pendingId = null; state.pendingBody = null;state.pendingSaved = false;
      state.paintReply(); paintAttachments(); status.textContent = '';
      // Sent: the box stays open and empty under the thread, ready for the next comment, like Facebook.
      state.showComposer(true);
      toast(t('commentSent'));
      refresh(state).then(() => { const sent = state.list.querySelector(`[data-comment-id="${CSS.escape(sentId)}"]`); sent?.classList.add('mw-comment-new'); sent?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }).catch(() => {});
    } catch (error) {
      // Failed: the input stays open with the draft, and the reason is announced.
      status.classList.add('is-error'); status.setAttribute('role', 'alert');
      status.textContent = `${t('commentFailed')} ${error.message || t('retry')} · ${t('tapToRetry')}`;
    } finally { state.sending = false;controls.forEach(({ element, disabled }) => { element.disabled = disabled; }); }
  }
  function mountPanel(article, panel) {
    const actions = article.querySelector(':scope>.actions');
    if (actions) actions.after(panel); else article.append(panel);
    article.classList.add('mw-comments-open');
    article.querySelectorAll(':scope>.actions [data-echo]').forEach(button => button.setAttribute('aria-expanded', 'true'));
  }
  function openPanel(postId) {
    const article = articleOf(postId);
    if (!article) return;
    let panel = panels.get(postId);
    // A second tap on Comments folds the thread away again.
    if (activePostId === postId && panel && article.contains(panel)) { closePanel(); return; }
    closePanel();
    if (!panel) { panel = buildPanel(postId); panels.set(postId, panel); }
    panel.mwState.showComposer(true);
    activePostId = postId;
    mountPanel(article, panel);
    window.MilkyWayI18n.apply();
    refresh(panel.mwState, { keepScroll: false });
    panel.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
    // Keyboards on phones would cover the comments, so only focus the box straight away with a mouse.
    if (matchMedia('(pointer:fine)').matches) setTimeout(() => panel.mwState.input.focus({ preventScroll: true }), 120);
  }
  function closePanel() {
    if (!activePostId) return;
    const panel = panels.get(activePostId), state = panel?.mwState, article = articleOf(activePostId);
    activePostId = null;
    if (panel?.contains(document.activeElement)) document.activeElement.blur();
    state?.closePickers?.();
    panel?.remove();
    article?.classList.remove('mw-comments-open');
    article?.querySelectorAll(':scope>.actions [data-echo]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    // Forget empty panels so the next open starts fresh; keep unsent drafts.
    if (state && !state.sending && !state.input.value.trim() && !state.media.length) panels.delete(state.postId);
  }
  // Intercept comment buttons before the legacy modal handler and open the thread inline instead.
  document.addEventListener('click', event => {
    const button = event.target.closest('#feed .post [data-echo]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    openPanel(button.dataset.echo);
  }, true);
  new MutationObserver(() => decoratePosts()).observe(byId('feed'), { childList: true });

  /* ---------- Post extras: tags, location, extra media, menu actions ---------- */
  const extrasCache = new Map();
  let extrasRequest = null;
  async function loadPostExtras() {
    const ids = [...document.querySelectorAll('#feed .post[data-post-id]')].map(post => post.dataset.postId).filter(id => !extrasCache.has(id)).slice(0, 60);
    if (!ids.length || extrasRequest) return;
    ids.forEach(id => extrasCache.set(id, null));
    extrasRequest = api(`?action=posts&ids=${ids.join(',')}`, {}, logged()).then(({ posts, reposts = [] }) => { posts.forEach(extra => extrasCache.set(extra.postId, extra)); reposts.forEach(row => repostCache.set(row.postId, row)); }).catch(() => ids.forEach(id => extrasCache.delete(id))).finally(() => { extrasRequest = null; document.querySelectorAll('#feed .post[data-post-id]').forEach(paintExtras); });
  }
  const repostCache = new Map();
  function paintRepost(post) {
    const row = repostCache.get(post.dataset.postId);
    if (!row || post.querySelector(':scope .mw-repost-line')) return;
    const line = node('p', { className: 'mw-repost-line' }, node('span', { textContent: '🔁 ' }), i18n('span', 'repostedFrom'), ' ');
    const who = node('button', { type: 'button', className: 'mw-mention', textContent: row.originalAuthorName || '@msafiri' });
    who.onclick = () => openPublicProfile(row.originalAuthorId);
    line.append(who);
    post.querySelector(':scope>.post-head')?.after(line);
  }
  function paintExtras(post) {
    paintRepost(post);
    const extra = extrasCache.get(post.dataset.postId);
    post.querySelector(':scope>.mw-post-extras')?.remove();
    if (!extra || (!extra.location && !extra.tags.length && !extra.media.length)) return;
    const box = node('div', { className: 'mw-post-extras' });
    if (extra.media.length) box.append(node('div', { className: 'mw-post-gallery' }, ...extra.media.map(mediaElement)));
    if (extra.location) box.append(node('p', { className: 'mw-post-location', textContent: `📍 ${extra.location}` }));
    if (extra.tags.length) { const people = node('p', { className: 'mw-post-tags' }, node('span', { textContent: `${t('withPeople')} ` })); extra.tags.forEach(tag => { const link = node('button', { type: 'button', className: 'mw-mention', textContent: `@${tag.username || tag.name}` }); link.onclick = () => openPublicProfile(tag.id); people.append(link, ' '); }); box.append(people); }
    const body = post.querySelector(':scope>.post-body');
    (body || post.querySelector(':scope>.signals,:scope>.actions'))?.before(box);
  }
  function addMenuButton(menu, key, handler, marker) {
    if (menu.querySelector(`[data-mw-${marker}]`)) return;
    const button = i18n('button', key, { type: 'button' });
    button.dataset[`mw${marker[0].toUpperCase()}${marker.slice(1)}`] = '';
    button.onclick = handler;
    (menu.querySelector('.mw-message-menu-items') || menu).append(button);
  }
  async function copyLink(postId) {
    const url = postShareUrl(postId);
    try { await navigator.clipboard.writeText(url); toast(t('linkCopied')); }
    catch { if (typeof fallbackCopy === 'function') fallbackCopy(url); }
  }
  async function download(post) {
    const media = post.querySelector('.post-media');
    if (!media) return;
    const source = media.currentSrc || media.src;
    try {
      const response = await fetch(source, { mode: 'cors' });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const link = node('a', { href: URL.createObjectURL(blob), download: decodeURIComponent(source.split('/').pop().split('?')[0]) || `milkyway-${post.dataset.postId}` });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    } catch { window.open(source, '_blank', 'noopener'); }
  }
  function decoratePosts() {
    // The feed re-renders its cards; put an open comment thread back under its post.
    if (activePostId) { const article = articleOf(activePostId), panel = panels.get(activePostId); if (article && panel && !article.contains(panel)) mountPanel(article, panel); else if (!article) { activePostId = null; } }
    document.querySelectorAll('#feed .post[data-post-id]').forEach(post => {
      const menu = post.querySelector('.actions .mw-message-menu');
      if (!menu) return;
      const postId = post.dataset.postId, mine = logged() && post.dataset.authorId === user?.id;
      addMenuButton(menu, 'copyLink', () => copyLink(postId), 'copy');
      addMenuButton(menu, 'share', () => share(postId), 'sharepost');
      if (post.querySelector(':scope .post-media')) addMenuButton(menu, 'downloadMedia', () => download(post), 'download');
      if (mine) addMenuButton(menu, 'tagAndLocation', () => openPostDetails(postId), 'details');
      // Give icon-only menu entries a readable label.
      for (const [selector, key] of [['[data-save]', 'save'], ['[data-report]', 'report']]) { const button = menu.querySelector(selector); if (button && !button.querySelector('[data-mw-i18n]')) button.append(' ', i18n('span', key)); }
      if (extrasCache.has(postId)) paintExtras(post);
    });
    loadPostExtras();
  }
  // Owners add people tags and an optional location to an existing post.
  const detailsSheet = node('div', { id: 'mwPostDetails', className: 'sheet-bg mw-premium-sheet' });
  detailsSheet.innerHTML = '<section class="sheet" role="dialog" aria-modal="true"><button type="button" class="close" aria-label="Close">×</button><h2 data-mw-i18n="tagAndLocation"></h2><label><span data-mw-i18n="location"></span><input id="mwDetailsLocation" maxlength="120"></label><div id="mwDetailsTags"></div><button type="button" class="btn primary" id="mwDetailsSave" data-mw-i18n="save"></button><p id="mwDetailsStatus" role="status"></p></section>';
  document.body.append(detailsSheet);
  detailsSheet.querySelector('.close').onclick = () => closeSheet('mwPostDetails');
  let detailsState = null;
  function openPostDetails(postId) {
    const extra = extrasCache.get(postId) || { location: '', tags: [], media: [] };
    detailsState = { postId, tags: [...extra.tags], media: extra.media };
    byId('mwDetailsLocation').value = extra.location || '';
    byId('mwDetailsStatus').textContent = '';
    const holder = byId('mwDetailsTags');
    const paint = () => { holder.replaceChildren(i18n('button', 'tagPeople', { type: 'button', className: 'btn ghost', onclick: () => picker.toggle() }), tagChips(detailsState.tags, index => { detailsState.tags.splice(index, 1); paint(); }), picker); };
    const picker = tagPicker(person => { if (!detailsState.tags.some(tag => tag.id === person.id)) detailsState.tags.push(person); paint(); });
    paint();
    openSheet('mwPostDetails');
  }
  byId('mwDetailsSave').onclick = async () => {
    const button = byId('mwDetailsSave');
    if (button.disabled || !detailsState) return;
    button.disabled = true; byId('mwDetailsStatus').textContent = t('uploading');
    try {
      const values = { location: byId('mwDetailsLocation').value.trim(), tags: detailsState.tags, media: detailsState.media };
      await api(`?action=post&id=${detailsState.postId}`, json(values));
      extrasCache.set(detailsState.postId, { postId: detailsState.postId, ...values });
      document.querySelectorAll(`#post-${detailsState.postId}`).forEach(paintExtras);
      closeSheet('mwPostDetails'); toast(t('saved'));
    } catch (error) { byId('mwDetailsStatus').textContent = error.message; }
    finally { button.disabled = false; }
  };

  /* ---------- Composer: multiple media, previews, tags, location, audience, safe cancel ---------- */
  const compose = { files: [], tags: [], publishing: false, postId: null, postSaved: false };
  const mediaInput = byId('media');
  mediaInput.multiple = true;
  const composerExtras = node('div', { className: 'mw-composer-extras' });
  const locationInput = node('input', { id: 'mwComposeLocation', maxLength: 120 });
  const tagsHolder = node('div');
  const composeTags = tagPicker(person => { if (!compose.tags.some(tag => tag.id === person.id)) compose.tags.push(person); paintComposerTags(); composeTags.toggle(false); });
  function paintComposerTags() { tagsHolder.replaceChildren(tagChips(compose.tags, index => { compose.tags.splice(index, 1); paintComposerTags(); })); }
  // Public, Followers only or Only me; the choice is stored before the post exists so it is never briefly public.
  const audience = window.MilkyWayGallery.audienceControl();
  const tagButton = i18n('button', 'tagPeople', { type: 'button', className: 'btn ghost' }); tagButton.onclick = () => composeTags.toggle();
  const emojiCompose = emojiPicker(value => insertAtCursor(byId('caption'), value));
  const emojiButton = node('button', { type: 'button', className: 'btn ghost', textContent: '😊' }); emojiButton.setAttribute('aria-label', t('emoji')); emojiButton.onclick = () => emojiCompose.toggle();
  composerExtras.append(node('div', { className: 'row' }, emojiButton, tagButton), emojiCompose, composeTags, tagsHolder, node('label', {}, i18n('span', 'locationOptional'), locationInput));
  // The visibility choice sits at the top of the composer, right above the text, so it is picked before writing.
  const captionLabel = byId('caption').previousElementSibling;
  (captionLabel?.tagName === 'LABEL' ? captionLabel : byId('caption')).before(audience);
  byId('mediaPreview').before(composerExtras);
  // Live upload percentage for the whole post, weighted by file size.
  const progress = node('div', { className: 'mw-upload-progress', hidden: true });
  progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100');
  const progressFill = node('span', { className: 'mw-upload-progress-fill' });
  const progressLabel = node('span', { className: 'mw-upload-progress-label' });
  const progressValue = node('strong', { className: 'mw-upload-progress-value' });
  progress.append(node('div', { className: 'mw-upload-progress-head' }, progressLabel, progressValue), node('div', { className: 'mw-upload-progress-track' }, progressFill));
  byId('publishBtn').closest('.row').before(progress);
  function paintProgress(percent, text = '') {
    progress.hidden = percent === null;
    if (percent === null) return;
    const value = Math.max(0, Math.min(100, Math.floor(percent)));
    progressFill.style.width = `${value}%`; progressValue.textContent = `${value}%`; progressLabel.textContent = text;
    progress.setAttribute('aria-valuenow', String(value)); progress.setAttribute('aria-valuetext', `${text} ${value}%`);
  }
  function paintComposerMedia() {
    const box = byId('mediaPreview');
    box.replaceChildren(...compose.files.map((item, index) => {
      const remove = node('button', { type: 'button', textContent: '×', className: 'mw-attach-remove' }); remove.setAttribute('aria-label', t('remove'));
      remove.onclick = () => { if (compose.publishing) return;if (item.preview) URL.revokeObjectURL(item.preview); window.MilkyWayVideo?.cancel(item.file); compose.files.splice(index, 1); paintComposerMedia(); };
      const preview = item.document ? window.MilkyWayGallery.documentChip(item.file) : isVideoFile(item.file) ? node('video', { src: item.preview, controls: true, playsInline: true }) : node('img', { src: item.preview, alt: '' });
      const state = node('small', { className: 'mw-attach-state', textContent: item.uploaded ? '✓' : item.error ? `⚠ ${item.error}` : '' });
      item.stateElement = state;
      return node('div', { className: 'mw-compose-preview' }, preview, remove, state);
    }));
    box.classList.toggle('mw-compose-grid', compose.files.length > 0);
  }
  mediaInput.onchange = () => {
    for (const file of mediaInput.files) {
      if (compose.files.length >= 10) { toast(t('maxTenMedia')); break; }
      const isDocument = window.MilkyWayGallery.isDocument(file);
      if (!isDocument && !file.type.startsWith('image/') && !isVideoFile(file)) { toast(t('unsupportedFile')); continue; }
      compose.files.push({ file, document: isDocument, preview: isDocument ? '' : URL.createObjectURL(file) });
      if (!isDocument) prepareVideo(file);
    }
    mediaInput.value = '';
    paintComposerMedia();
  };
  function resetComposer() {
    compose.files.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); if (!item.uploaded) window.MilkyWayVideo?.cancel(item.file); });
    Object.assign(compose, { files: [], tags: [], postId: null, postSaved: false });
    byId('caption').value = ''; locationInput.value = ''; byId('publishMsg').textContent = ''; audience.reset(); paintProgress(null);
    paintComposerMedia(); paintComposerTags();
  }
  const hasDraft = () => byId('caption').value.trim() || compose.files.length || compose.tags.length || locationInput.value.trim();
  document.querySelectorAll('#composeSheet [data-close="composeSheet"]').forEach(button => { button.onclick = async () => { if (compose.publishing) return; if (hasDraft() && !(await window.MilkyWayDialog.confirm({ message: t('discardDraft'), danger: true }))) return; resetComposer(); closeSheet('composeSheet'); }; });
  byId('publishBtn').onclick = async () => {
    if (compose.publishing || !requireLogin('')) return;
    const caption = byId('caption').value.trim();
    if (!caption && !compose.files.length) { byId('publishMsg').textContent = t('postEmpty'); return; }
    const button = byId('publishBtn');
    const accountId = user.id;
    const controls = [...byId('composeSheet').querySelectorAll('input,textarea,select,button')].map(element => ({ element, disabled: element.disabled }));
    controls.forEach(({ element }) => { element.disabled = true; });
    compose.publishing = true;
    try {
      compose.postId ||= crypto.randomUUID();
      if (!compose.postSaved) await window.MilkyWayGallery.setAudience(compose.postId, audience.value);
      const size = item => item.file.size || 1;
      const totalBytes = compose.files.filter(item => !item.uploaded).reduce((sum, item) => sum + size(item), 0);
      let doneBytes = 0;
      for (const [index, item] of compose.files.entries()) {
        if (item.uploaded) continue;
        const label = `${t('uploadProgress')} ${index + 1}/${compose.files.length}`;
        const report = percent => { if (item.stateElement) item.stateElement.textContent = `${percent}%`; paintProgress((doneBytes + size(item) * percent / 100) / totalBytes * 100, label); };
        byId('publishMsg').textContent = '';
        report(0);
        try { item.uploaded = item.document ? await window.MilkyWayGallery.uploadDocument(item.file, compose.postId, report) : await upload(item.file, report); item.error = null; }
        catch (error) { item.error = error.message; paintProgress(null); paintComposerMedia(); throw new Error(`${error.message} · ${t('tapToRetry')}`); }
        doneBytes += size(item);
        paintComposerMedia();
      }
      const documents = compose.files.filter(item => item.document);
      const [first, ...rest] = compose.files.filter(item => !item.document).map(item => item.uploaded);
      if (user?.id !== accountId) throw new Error(t('authExpired'));
      if (!compose.postSaved) {
        byId('publishMsg').textContent = t('publishing');
        const profile = await getProfile(user.id);
        const { error } = await sb.from('mw_posts').insert({ id: compose.postId, author_id: accountId, author_name: profile?.display_name || nameOf(), caption: caption || (documents.length ? `📄 ${documents[0].file.name.slice(0, 120)}` : null), media_url: first?.url || null, media_type: first ? (first.type === 'video' ? 'video' : 'image') : null }).select('id').single();
        if (error?.code === '23505') {
          const existing = await sb.from('mw_posts').select('id,author_id,caption,media_url').eq('id', compose.postId).single();
          if (existing.error || existing.data?.author_id !== accountId || existing.data?.caption !== (caption || (documents.length ? `📄 ${documents[0].file.name.slice(0, 120)}` : null)) || existing.data?.media_url !== (first?.url || null)) throw new Error(t('postRetryConflict'));
        } else if (error) throw error;
        compose.postSaved = true;
      }
      // The post is saved: close the composer straight away. Extra photos, tags and the place finish in the background.
      const location = locationInput.value.trim(), postId = compose.postId, tags = [...compose.tags];
      const extras = rest.length || tags.length || location ? api(`?action=post&id=${postId}`, json({ location, tags, media: rest.map(({ url, type, name }) => ({ url, type, name })) })) : null;
      document.activeElement?.blur?.(); resetComposer(); closeSheet('composeSheet'); toast(t('postPublished'));
      mode = 'feed';
      if (extras) extras.then(() => loadFeed(), error => { toast(`${t('postPublished')} · ${error.message || t('retry')}`); loadFeed(); });
      else loadFeed();
    } catch (error) { paintProgress(null); byId('publishMsg').textContent = error.message || t('retry'); }
    finally { compose.publishing = false;controls.forEach(({ element, disabled }) => { element.disabled = disabled; });button.disabled = false; }
  };

  /* ---------- Account: real password change, guided deletion, help and about ---------- */
  function accountSheet(id, title, html) {
    const element = node('div', { id, className: 'sheet-bg mw-premium-sheet' });
    element.innerHTML = `<section class="sheet" role="dialog" aria-modal="true"><button type="button" class="close" aria-label="Close">×</button><h2 data-mw-i18n="${title}"></h2>${html}</section>`;
    document.body.append(element);
    element.querySelector('.close').onclick = () => closeSheet(id);
    return element;
  }
  accountSheet('mwPasswordSheet', 'changePassword', '<form id="mwPasswordForm" class="mw-ad-form" autocomplete="on"><label><span data-mw-i18n="currentPassword"></span><input id="mwCurrentPassword" type="password" autocomplete="current-password" required></label><label><span data-mw-i18n="newPassword"></span><input id="mwNewPassword" type="password" autocomplete="new-password" minlength="8" required></label><label><span data-mw-i18n="confirmPassword"></span><input id="mwConfirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><p class="muted" data-mw-i18n="passwordRules"></p><button class="btn primary" data-mw-i18n="save"></button><button type="button" class="btn ghost" id="mwSendResetLink" data-mw-i18n="sendResetLink"></button><p id="mwPasswordStatus" role="status"></p></form>');
  byId('mwPasswordForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button.primary'), status = byId('mwPasswordStatus');
    const current = byId('mwCurrentPassword').value, next = byId('mwNewPassword').value, confirmation = byId('mwConfirmPassword').value;
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) { status.textContent = t('passwordRules'); return; }
    if (next !== confirmation) { status.textContent = t('passwordMismatch'); return; }
    if (next === current) { status.textContent = t('passwordSame'); return; }
    if (button.disabled) return;
    button.disabled = true; status.textContent = t('verifying');
    try {
      // Re-authenticate with the current password before Supabase accepts the new one.
      const check = await sb.auth.signInWithPassword({ email: user.email, password: current });
      if (check.error) throw new Error(t('currentPasswordWrong'));
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) throw error;
      form.reset(); status.textContent = t('passwordChanged'); toast(t('passwordChanged'));
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  };
  byId('mwSendResetLink').onclick = async () => {
    const { error } = await sb.auth.resetPasswordForEmail(user.email, { redirectTo: 'https://masiyatunda.com/milkyway/' });
    byId('mwPasswordStatus').textContent = error ? error.message : t('resetLinkSent');
  };
  accountSheet('mwDeleteSheet', 'deleteAccount', '<div class="mw-danger-box"><p data-mw-i18n="deleteConsequences"></p><ul><li data-mw-i18n="deleteItem1"></li><li data-mw-i18n="deleteItem2"></li><li data-mw-i18n="deleteItem3"></li></ul></div><form id="mwDeleteForm" class="mw-ad-form"><label><span data-mw-i18n="currentPassword"></span><input id="mwDeletePassword" type="password" autocomplete="current-password" required></label><label><span data-mw-i18n="typeDelete"></span><input id="mwDeleteConfirm" autocomplete="off" required></label><button class="btn danger" data-mw-i18n="requestDeletion"></button><p id="mwDeleteStatus" role="status"></p></form>');
  byId('mwDeleteForm').onsubmit = async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'), status = byId('mwDeleteStatus');
    if (byId('mwDeleteConfirm').value.trim().toUpperCase() !== 'DELETE') { status.textContent = t('typeDelete'); return; }
    if (button.disabled) return;
    button.disabled = true; status.textContent = t('verifying');
    try {
      const check = await sb.auth.signInWithPassword({ email: user.email, password: byId('mwDeletePassword').value });
      if (check.error) throw new Error(t('currentPasswordWrong'));
      const { error } = await sb.from('mw_account_deletion_requests').insert({ user_id: user.id });
      if (error && error.code !== '23505') throw error;
      status.textContent = t('deletionRequested');
      setTimeout(async () => { closeSheet('mwDeleteSheet'); await sb.auth.signOut(); }, 2500);
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  };
  accountSheet('mwHelpSheet', 'helpSupport', '<p data-mw-i18n="helpIntro"></p><ul class="mw-help-list"><li data-mw-i18n="helpReport"></li><li data-mw-i18n="helpBlock"></li><li data-mw-i18n="helpPassword"></li></ul><a class="btn primary" href="mailto:info@masiyatunda.com?subject=MilkyWay%20support" data-mw-i18n="contactSupport"></a> <a class="btn ghost" href="/" data-mw-i18n="visitMasiyatunda"></a>');
  accountSheet('mwAboutSheet', 'aboutMilkyWay', '<img loading="lazy" decoding="async" src="brand/milkyway-logo-web.png" alt="MilkyWay — Freedom. Truth. Light." width="180" style="display:block;margin:0 auto 10px;max-width:60%;height:auto"><p data-mw-i18n="aboutText"></p><p class="muted">© 2026 Masiyatunda Company Limited</p>');
  const guard = handler => () => { if (requireLogin('')) handler(); };
  if (byId('changePasswordBtn')) byId('changePasswordBtn').onclick = guard(() => { byId('mwPasswordForm').reset(); byId('mwPasswordStatus').textContent = ''; openSheet('mwPasswordSheet'); });
  if (byId('deleteAccountBtn')) byId('deleteAccountBtn').onclick = guard(() => { byId('mwDeleteForm').reset(); byId('mwDeleteStatus').textContent = ''; byId('mwDeleteForm').querySelector('button').disabled = false; openSheet('mwDeleteSheet'); });

  /* ---------- Toolbar: live activity pill ---------- */
  document.body.classList.add('mw-clean-top');
  const pill = node('button', { type: 'button', className: 'mw-top-live', hidden: true });
  pill.setAttribute('aria-live', 'polite');
  document.querySelector('header.top .top-actions')?.prepend(pill);
  // The top LIVE pill is the home screen's only Live indicator. It is fed by Live discovery and one tap
  // takes viewers straight into the room (or into the list of Lives when several are on).
  let topSignature = '', liveNow = window.MilkyWayLive?.liveNow?.() || [];
  const liveFace = record => {
    const face = node('span', { className: 'mw-live-avatar' });
    const photo = record.profile?.avatar_url;
    if (photo) face.append(node('img', { src: window.MilkyWayMedia?.image(photo, 64) || photo, alt: '' }));
    else face.textContent = String(record.profile?.display_name || record.host_name || 'M').trim().charAt(0).toUpperCase() || 'M';
    return face;
  };
  const syncTop = () => {
    const first = liveNow[0];
    const host = first ? String(first.profile?.display_name || first.host_name || '').trim() : '';
    const signature = `${liveNow.map(record => record.room_name).join(',')}|${host}`;
    if (signature === topSignature) return;
    topSignature = signature;
    pill.hidden = !first;
    if (first) {
      pill.replaceChildren(liveFace(first), node('b', { textContent: liveNow.length > 1 ? `LIVE ${liveNow.length}` : 'LIVE' }), node('span', { textContent: host }));
      pill.setAttribute('aria-label', `LIVE · ${host}${liveNow.length > 1 ? ` +${liveNow.length - 1}` : ''}`);
      pill.onclick = () => (liveNow.length > 1 ? window.MilkyWayLive?.browse() : window.MilkyWayLive?.watch(liveNow[0]));
    }
  };
  window.addEventListener('mw-live-discovery', event => { liveNow = event.detail?.records || [];syncTop(); });
  syncTop();

  sb.auth.onAuthStateChange((event, session) => { document.body.classList.toggle('mw-signed-in', !!session?.user); });
  window.MilkyWayEngage = { openComments: openPanel, emojiPicker };
  window.MilkyWayI18n.apply();
})();
