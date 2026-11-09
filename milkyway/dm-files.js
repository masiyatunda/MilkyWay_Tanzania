(() => {
  // Attachments live in the 'portfolio' bucket under milkyway/<account id>/dm/, which the storage policies already allow.
  const bucket = 'portfolio';
  const validKey = key => typeof key === 'string' && /^milkyway\/[a-f0-9-]{36}\/dm\/[^/]+$/i.test(key);
  async function session() {
    const current = (await sb.auth.getSession()).data.session;
    if (!current) throw new Error(mwLang() === 'en' ? 'Sign in again to send files.' : 'Ingia tena kutuma faili.');
    return current;
  }
  function release() {}
  async function resolve(key) {
    if (!validKey(key)) throw new Error('Private file unavailable.');
    return sb.storage.from(bucket).getPublicUrl(key).data.publicUrl;
  }
  async function upload(file, recipient, progress) {
    const current = await session();
    const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-60) || 'file';
    const key = `milkyway/${current.user.id}/dm/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
    progress?.(null);
    const { error } = await sb.storage.from(bucket).upload(key, file, { contentType: file.type || 'application/octet-stream', upsert: false, cacheControl: '3600' });
    if (error) throw new Error(error.message || (mwLang() === 'en' ? 'Upload failed. Retry.' : 'Upakiaji umeshindikana. Jaribu tena.'));
    progress?.(100);
    return { key, name: (file.name || 'file').slice(0, 120), type: file.type || 'application/octet-stream' };
  }
  async function removeUnsent(key) {
    if (validKey(key)) await sb.storage.from(bucket).remove([key]).catch(() => {});
  }
  window.MilkyWayFiles = { resolve, upload, removeUnsent, release };
  window.addEventListener('pagehide', release);
})();
