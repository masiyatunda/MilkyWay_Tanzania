const PROJECT_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wpclkhgizbvxuvbhbwzs.supabase.co').replace(/\/+$/, '');
function keyFor(req) { return req.headers.apikey || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''; }
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).setHeader('Allow','GET').json({ error: 'Method not allowed.' });
  const apikey = keyFor(req);
  if (!apikey) return res.status(503).json({ error: 'Supabase connection is not configured.' });
  try {
    const authorization = req.headers.authorization || '';
    const upstream = await fetch(`${PROJECT_URL}/functions/v1/livekit-token`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', apikey, ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify({ action: 'discovery' }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await upstream.json().catch(() => ({ error:'Invalid Live discovery response.' }));
    return res.status(upstream.status).setHeader('Cache-Control','no-store').json(data);
  } catch {
    return res.status(503).json({ error:'Live discovery service is unavailable.' });
  }
}
