(() => {
  const pairs = [
    ['Close','Funga'],['Save','Hifadhi'],['Send','Tuma'],['Search','Tafuta'],['Messages','Ujumbe'],['Account','Akaunti'],['Notifications','Arifa'],['Settings','Mipangilio'],['Refresh','Onyesha upya'],['Loading…','Inapakia…'],['Loading...','Inapakia...'],['Loading live sessions…','Inapakia Live…'],['Start Audio Live','Anza Audio Live'],['Start Video Live','Anza Video Live'],['Go Live','Anza Live'],['Not connected','Haijaunganishwa'],['Connecting…','Inaunganisha…'],['Connected','Imeunganishwa'],['Disconnected','Muunganisho umekatika'],['Reconnecting…','Inaunganisha tena…'],['Live · Connected','Live · Imeunganishwa'],['Connected · Preparing Live…','Imeunganishwa · Inaandaa Live…'],['Your space. Your voice.','Nafasi yako. Sauti yako.'],['Give your Live a title (optional)','Ipe Live yako jina (si lazima)'],['Who can join?','Nani anaweza kujiunga?'],['Everyone','Kila mtu'],['Followers only','Wafuasi pekee'],['Camera + microphone.','Kamera + maikrofoni.'],['Let them see your world.','Waonyeshe ulimwengu wako.'],['Just your voice.','Sauti yako pekee.'],['No camera permission needed.','Ruhusa ya kamera haihitajiki.'],['Preview microphone / camera','Hakiki maikrofoni / kamera'],['Stop preview','Simamisha uhakiki'],['Session history','Historia ya Live'],['Load history','Pakia historia'],['Across the galaxy','Katika galaksi'],['Make space','Toa nafasi'],['for connection.','ya kuungana.'],['A LITTLE CLOSER, ACROSS THE GALAXY','KARIBU ZAIDI, KATIKA GALAKSI'],['Show your world, or let your voice lead. One shared space for real conversations, wherever you are.','Onyesha ulimwengu wako au acha sauti yako iongoze. Nafasi ya pamoja kwa mazungumzo halisi, popote ulipo.'],['Preview checks your devices without broadcasting. Listeners and viewers do not need a camera or microphone.','Uhakiki hujaribu vifaa vyako bila kutangaza. Wasikilizaji na watazamaji hawahitaji kamera au maikrofoni.'],['Microphone captured. Speak to check the input level. Nothing is broadcast yet.','Maikrofoni iko tayari. Zungumza kuona kiwango cha sauti. Hakuna kinachotangazwa bado.'],['Devices ready. Start Live when you are ready.','Vifaa viko tayari. Anza Live ukiwa tayari.'],['Galaxy controls','Vidhibiti vya Galaksi'],['Listening volume','Kiwango cha sauti'],['Audio output','Kifaa cha sauti'],['Default speaker','Spika ya kawaida'],['Connected participants','Washiriki waliounganishwa'],['Tap the sound button to enable playback.','Gusa kitufe cha sauti kuanza kusikiliza.'],['Waiting for the host’s camera','Inasubiri kamera ya mwenyeji'],['Waiting for the host’s track','Inasubiri sauti au video ya mwenyeji'],['MICROPHONE-ONLY BROADCAST','MATANGAZO YA SAUTI PEKEE'],['HOST MICROPHONE MUTED','MAIKROFONI YA MWENYEJI IMENYAMAZISHWA'],['Requesting secure access…','Inaomba ruhusa salama…'],['Connecting to LiveKit…','Inaunganisha LiveKit…'],['Say hello. The conversation starts here.','Salimia. Mazungumzo yanaanza hapa.'],['The host disconnected.','Mwenyeji amekatika.'],['Live connection ended. Rejoin to continue.','Muunganisho wa Live umeisha. Jiunge tena kuendelea.'],['Finish your DM call before joining Live.','Maliza simu ya DM kabla ya kujiunga na Live.'],['Your sign-in expired. Sign in again before starting Live.','Muda wa kuingia umeisha. Ingia tena kabla ya kuanza Live.'],['Your sign-in expired. Please sign in again.','Muda wa kuingia umeisha. Tafadhali ingia tena.'],['LiveKit did not load. Check your connection and retry.','LiveKit haijapakia. Angalia intaneti na ujaribu tena.'],['Device access requires HTTPS and the loaded LiveKit SDK. Open Preview in a separate tab.','Vifaa vinahitaji HTTPS na LiveKit SDK. Fungua Preview kwenye kichupo tofauti.'],['Choose Video Live or Audio Live first.','Chagua Video Live au Audio Live kwanza.'],['Mute microphone','Nyamazisha maikrofoni'],['Unmute microphone','Washa maikrofoni'],['Turn camera off','Zima kamera'],['Turn camera on','Washa kamera'],['Share Live','Shiriki Live'],['Live settings','Mipangilio ya Live'],['Leave Live and return','Ondoka Live na urudi'],['Leave or end Live','Ondoka au maliza Live'],['What’s on your mind?','Unafikiria nini?'],['Write a comment…','Andika maoni…'],['Andika ujumbe…','Write a message…'],['Mazungumzo','Conversation'],['Mazungumzo binafsi','Private conversations'],['Anza mazungumzo.','Start a conversation.'],['Inapakia...','Loading...'],['Sauti ya arifa','Notification sound'],['Test Sauti','Test sound'],['Ruhusu Arifa','Enable notifications'],['Jina linaloonekana','Display name'],['Hifadhi','Save'],['Badilisha password','Change password'],['Badilisha email','Change email'],['Futa akaunti','Delete account'],['Ingia kwanza.','Sign in first.'],['Pakia','Upload'],['☎ Sauti','☎ Audio'],['✕ Funga','✕ Close']
  ];
  const swFirst = new Set(['Andika ujumbe…','Mazungumzo','Mazungumzo binafsi','Anza mazungumzo.','Inapakia...','Sauti ya arifa','Test Sauti','Ruhusu Arifa','Jina linaloonekana','Hifadhi','Badilisha password','Badilisha email','Futa akaunti','Ingia kwanza.','Pakia','☎ Sauti','✕ Funga']);
  const dictionary = new Map();
  pairs.push(['Live across the galaxy','Live katika galaksi'],['Listen','Sikiliza'],['Watch','Tazama'],['Resume Live','Rudi Live'],['Close listing','Funga tangazo']);
  for (const pair of pairs) {
    const [english, swahili] = swFirst.has(pair[0]) ? [pair[1], pair[0]] : pair;
    dictionary.set(english, { en: english, sw: swahili });
    dictionary.set(swahili, { en: english, sw: swahili });
  }
  const excluded = '[data-mw-user-content],.post-body,.post-head,.post-meta,.mw-comment-body,.mw-comment header b,.mw-post-extras,.mw-ad-copy,.mw-ad-business,.mw-emoji-grid,.mw-tag-results,.mw-tag-chips,.story-card,.echo p,.echo strong,.dm-inbox-row,#notifications,#dmAttachmentPreview,#threadTitle,#mwCallTitle,#mwLiveHostName,#mwLiveAboutHost,#mwLiveBroadcastTitle,#mwLiveParticipants,.mw-stage-caption,.mw-live-comment,.mw-live-session-list,#profilePosts,#publicProfile,#storyViewerCaption,#storyViewerUser,#profileName,#myName,#searchResults';
  const eligible = 'button,label,option,h1,h2,h3,.muted,.mw-live-eyebrow,.mw-live-status,.mw-live-intro p,#mwLiveMessage,#mwLiveMediaStatus,#mwLiveAudioNotice,#mwLivePreviewStatus,#mwLiveCount';
  function translate(value) {
    const language = mwLang();
    if (window.MilkyWayI18n) {
      const canonical = dictionary.get(value)?.en || value;
      const translated = window.MilkyWayI18n.text(canonical);
      return translated !== canonical ? translated : dictionary.get(value)?.[language] || canonical;
    }
    return dictionary.get(value)?.[language] || value;
  }
  function apply(roots) {
    for (const root of Array.isArray(roots) ? roots : [document.body]) translateTree(root);
    finish();
  }
  function translateTree(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (!element || element.closest(excluded) || !element.closest(eligible)) continue;
      const original = node.nodeValue.trim();
      const translated = translate(original);
      if (translated !== original) node.nodeValue = node.nodeValue.replace(original, translated);
    }
    const fields = 'button,input,select,textarea';
    for (const element of [...(root.matches?.(fields) ? [root] : []), ...(root.querySelectorAll?.(fields) || [])]) {
      if (element.closest(excluded)) continue;
      for (const attribute of ['aria-label','title','placeholder']) {
        const value = element.getAttribute(attribute);
        const translated = value && translate(value);
        if (value && translated !== value) element.setAttribute(attribute, translated);
      }
    }
  }
  function finish() {
    document.documentElement.lang = mwLang();
    document.documentElement.dir = mwLang() === 'ar' ? 'rtl' : 'ltr';
    const label = document.getElementById('mwNotificationVolumeText');
    const volumeText = window.MilkyWayI18n?.t('notificationVolume') || (mwLang() === 'en' ? 'Notification volume' : 'Kiwango cha sauti ya arifa');
    if (label && label.textContent !== volumeText) label.textContent = volumeText;
    const limit = document.getElementById('mwPrivateFileLimit');
    const limitText = window.MilkyWayI18n?.t('privateLimit') || (mwLang() === 'en' ? 'Private attachments · up to 4 MB per file. Only you and the recipient can open new uploads.' : 'Viambatisho binafsi · hadi MB 4 kwa faili. Wewe na mpokeaji pekee mnaweza kufungua faili mpya.');
    if (limit && limit.textContent !== limitText) limit.textContent = limitText;
  }
  const volumeRow = document.createElement('label');
  volumeRow.className = 'setting-row';
  volumeRow.innerHTML = '<span id="mwNotificationVolumeText"></span><input id="mwNotificationVolume" type="range" min="0" max="100" aria-label="Notification volume">';
  document.getElementById('notifySound').closest('label').after(volumeRow);
  const volume = document.getElementById('mwNotificationVolume');
  volume.value = String(Number(localStorage.getItem('mw_notify_volume') ?? '0.7') * 100);
  volume.oninput = () => localStorage.setItem('mw_notify_volume', String(Number(volume.value) / 100));
  const limit = document.createElement('p');
  limit.id = 'mwPrivateFileLimit';
  limit.className = 'mw-file-limit';
  document.getElementById('dmAttachmentPreview').after(limit);
  window.MilkyWayLanguage = { apply, translate };
  let scheduled = false;
  // Re-translate only what changed instead of walking the whole page on every update.
  const changed = new Set();
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') changed.add(record.target);
      else if (record.type === 'characterData') { if (record.target.parentElement) changed.add(record.target.parentElement); }
      else for (const node of record.addedNodes) { const element = node.nodeType === 1 ? node : node.parentElement; if (element) changed.add(element); }
    }
    if (scheduled || !changed.size) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const roots = [...changed].filter(element => element.isConnected);
      changed.clear();
      apply(roots.filter(element => !roots.some(other => other !== element && other.contains(element))));
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  apply();
})();
