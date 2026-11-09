const SUPABASE = 'https://wpclkhgizbvxuvbhbwzs.supabase.co';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_HIDE = 200;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in first' });
  const key = req.headers.apikey || process.env.SUPABASE_ANON_KEY || '';
  if (!key) return res.status(503).json({ error: 'Supabase API key is not configured' });
  const headers = { Authorization: auth, apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  const rest = async (path, init = {}) => {
    const response = await fetch(`${SUPABASE}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const status = response.status === 401 ? 401 : data?.code === 'P0002' ? 404 : data?.code === '22023' ? 400 : response.status === 404 || response.status >= 500 ? 503 : 403;
      throw new HttpError(status, status === 503 ? 'Message service unavailable' : data?.message || 'Not allowed');
    }
    return data;
  };
  try {
    const userRes = await fetch(`${SUPABASE}/auth/v1/user`, { headers: { Authorization: auth, apikey: key } });
    const user = await userRes.json();
    if (!user?.id) return res.status(401).json({ error: 'Invalid session' });

    const params = new URL(req.url, 'http://localhost').searchParams;
    const action = params.get('action') || '';
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const groupId = String(params.get('group') || body.group || '');
    const isGroup = groupId !== '';
    if (isGroup && !UUID.test(groupId)) throw new HttpError(400, 'Invalid group');

    // Messages this person removed with "Delete for me" stay for everyone else.
    const visible = async rows => {
      const hidden = new Set((await rest(`mw_message_hides?select=message_id&user_id=eq.${user.id}&order=created_at.desc&limit=5000`).catch(() => [])).map(row => row.message_id));
      return (rows || []).filter(row => !hidden.has(row.id));
    };

    if (req.method === 'GET') {
      if (isGroup) {
        const rows = await rest(`mw_dm_group_messages?select=id,sender_id,body,created_at,edited_at&group_id=eq.${groupId}&order=created_at.desc&limit=200`);
        return res.status(200).json({ messages: await visible(rows) });
      }
      if (action === 'inbox') {
        const rows = await rest(`mw_messages?select=*&or=(sender_id.eq.${user.id},receiver_id.eq.${user.id})&order=created_at.desc&limit=200`);
        return res.status(200).json({ messages: await visible(rows) });
      }
      const peer = params.get('peer') || '';
      if (!UUID.test(peer)) throw new HttpError(400, 'Invalid conversation');
      const filter = `or=(and(sender_id.eq.${user.id},receiver_id.eq.${peer}),and(sender_id.eq.${peer},receiver_id.eq.${user.id}))`;
      const rows = await rest(`mw_messages?select=*&${filter}&order=created_at.desc&limit=100`);
      return res.status(200).json({ messages: await visible(rows) });
    }

    if (req.method === 'POST' && action === 'hide') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).filter(id => typeof id === 'string' && UUID.test(id)).slice(0, MAX_HIDE);
      if (!ids.length) throw new HttpError(400, 'Nothing to delete');
      const scope = isGroup ? 'group' : 'dm';
      await rest('mw_message_hides?on_conflict=user_id,message_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(ids.map(id => ({ user_id: user.id, message_id: id, scope }))) });
      return res.status(200).json({ ok: true, hidden: ids.length });
    }

    if (req.method === 'POST') {
      const id = String(body.id || '');
      const text = typeof body.message === 'string' ? body.message.trim() : '';
      if (!UUID.test(id)) throw new HttpError(400, 'Invalid message ID');
      if (!text) throw new HttpError(400, 'Write a message first');
      await rest('rpc/mw_message_edit', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ p_id: id, p_group: isGroup, p_body: text }) });
      return res.status(200).json({ ok: true, edited: id });
    }

    if (req.method === 'DELETE') {
      const id = params.get('id') || '';
      if (!UUID.test(id)) throw new HttpError(400, 'Invalid message ID');
      const table = isGroup ? `mw_dm_group_messages?id=eq.${id}&group_id=eq.${groupId}` : `mw_messages?id=eq.${id}`;
      // The sender filter and row-level security both limit "Delete for everyone" to the person who sent it.
      const removed = await rest(`${table}&sender_id=eq.${user.id}`, { method: 'DELETE' });
      if (!Array.isArray(removed) || !removed.length) throw new HttpError(404, 'Message not found or not yours to delete');
      return res.status(200).json({ ok: true, deleted: id });
    }
    return res.status(405).json({ error: 'This message action is not available.' });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    return res.status(503).json({ error: 'Message service unavailable' });
  }
}
