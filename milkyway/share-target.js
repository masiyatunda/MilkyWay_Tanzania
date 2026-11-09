// Share target for the Android app (Capacitor). Photos, videos and text shared to MilkyWay from the
// phone gallery or any other app arrive through the MilkyWayNative plugin and open in the post composer,
// ready to publish. In a browser, or in an APK older than the share target, this script does nothing.
// It also lets the existing "Share" buttons use the native Android share sheet (@capacitor/share),
// because the Android WebView has no navigator.share.
(() => {
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  if (!native) return;

  const share = cap.Plugins?.Share || cap.registerPlugin?.('Share');
  if (share && !navigator.share) {
    navigator.share = data => share.share({ title: data?.title, text: data?.text, url: data?.url, dialogTitle: data?.title }).then(() => {}).catch(error => {
      if (/cancel/i.test(error?.message || '')) throw new DOMException('Share canceled', 'AbortError');
      throw error;
    });
  }

  const bridge = cap.Plugins?.MilkyWayNative || cap.registerPlugin?.('MilkyWayNative');
  if (!bridge || !bridge.getSharedMedia) return;

  const copy = {
    sw: { loading: 'Inaandaa media uliyoshiriki…', several: 'Post moja inabeba media moja — tumechagua ya kwanza.', skipped: 'Baadhi ya faili hazikuweza kuongezwa (picha/video tu, hadi 100 MB).', failed: 'Imeshindikana kufungua media uliyoshiriki.' },
    en: { loading: 'Preparing your shared media…', several: 'A post holds one photo or video — the first one is selected.', skipped: 'Some files could not be added (photos and videos only, up to 100 MB).', failed: 'Could not open the shared media.' },
  };
  const text = key => { let lang = 'sw';try { lang = window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch {}return (copy[lang] || copy.en)[key]; };
  const notify = message => { if (typeof toast === 'function') toast(message); };
  const byId = id => document.getElementById(id);
  const signedIn = () => (typeof logged === 'function' ? logged() : true);

  const handled = new Set();
  let waiting = null;

  // Rebuilds a shared file from the native cache in 1 MB base64 chunks.
  async function readFile(item) {
    const parts = [];
    for (let offset = 0; ; ) {
      const chunk = await bridge.readSharedFile({ id: item.id, offset, length: 1024 * 1024 });
      const binary = atob(chunk.data || '');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      parts.push(bytes);
      offset += bytes.length;
      if (chunk.done || !bytes.length) break;
    }
    return new File(parts, item.name || 'shared', { type: item.mimeType || '' });
  }

  // Fills the post composer: the first photo/video goes into the media field, shared text into the caption.
  function fillComposer(files, message) {
    const media = byId('media');
    const caption = byId('caption');
    if (message && caption) caption.value = caption.value ? `${caption.value}\n${message}` : message;
    if (files.length && media) {
      const transfer = new DataTransfer();
      transfer.items.add(files[0]);
      media.files = transfer.files;
      media.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof openSheet === 'function') openSheet('composeSheet');
    if (files.length > 1) notify(text('several'));
  }

  function deliver(files, message) {
    if (signedIn()) { fillComposer(files, message); return; }
    // Keeps the share until the user signs in, then opens the composer with it.
    waiting = { files, message };
    if (typeof requireLogin === 'function') requireLogin('kupost');
  }

  async function receive(data) {
    if (!data || !data.shareId || handled.has(data.shareId)) return;
    handled.add(data.shareId);
    const items = Array.isArray(data.items) ? data.items : [];
    const message = [data.subject, data.text].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join('\n').trim();
    if (!items.length && !message) { if (data.skipped) notify(text('skipped')); return; }
    if (items.length) notify(text('loading'));
    try {
      const files = [];
      for (const item of items) files.push(await readFile(item));
      bridge.clearSharedMedia().catch(() => {});
      deliver(files, message);
      if (data.skipped) setTimeout(() => notify(text('skipped')), 2600);
    } catch {
      notify(text('failed'));
    }
  }

  function start() {
    if (typeof sb !== 'undefined' && sb?.auth?.onAuthStateChange) {
      sb.auth.onAuthStateChange(event => {
        if (!waiting || !['SIGNED_IN', 'INITIAL_SESSION'].includes(event)) return;
        setTimeout(() => { if (!waiting || !signedIn()) return; const { files, message } = waiting;waiting = null;fillComposer(files, message); }, 0);
      });
    }
    try { bridge.addListener('shareReceived', data => receive(data)); } catch {}
    bridge.getSharedMedia().then(receive).catch(() => {});
  }

  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
