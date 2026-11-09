// Vercel gateway for the existing Supabase LiveKit Edge Function.
// Keep this endpoint in JavaScript so the known-good Vercel build does not
// need to compile TypeScript API handlers.
const DEFAULT_SUPABASE_URL = 'https://wpclkhgizbvxuvbhbwzs.supabase.co';

function getSupabaseConfig(req) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/$/, '');
  const apiKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    req.headers.apikey ||
    'sb_publishable_GCFJ3Is8t8mdia4gLeHApg_M_3ez9xb'
  ).trim();
  return { url, apiKey };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { url, apiKey } = getSupabaseConfig(req);
  if (!url || !apiKey) {
    return res.status(503).json({
      available: false,
      reason: 'supabase_gateway_not_configured',
      error: 'Supabase URL or publishable/anon key is missing from the Vercel gateway.'
    });
  }

  const headers = { apikey: apiKey, Accept: 'application/json' };
  const authorization = req.headers.authorization;
  if (authorization && /^Bearer\s+\S+$/i.test(authorization)) headers.Authorization = authorization;

  const options = { method: req.method, headers, signal: AbortSignal.timeout(15000) };
  if (req.method === 'POST') {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }
    const serialized = JSON.stringify(body);
    if (serialized.length > 4096) return res.status(413).json({ error: 'Request too large.' });
    headers['Content-Type'] = 'application/json';
    options.body = serialized;
  }

  try {
    const upstream = await fetch(`${url}/functions/v1/livekit-token`, options);
    const text = await upstream.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(upstream.ok ? 502 : upstream.status).json({ error: 'Supabase LiveKit function returned an invalid response.' });
    }
    // A successful token reply must carry everything the client needs to connect.
    const tokenReply = upstream.ok && payload.token !== undefined;
    if (tokenReply && (typeof payload.token !== 'string' || !payload.token.trim() || typeof payload.serverUrl !== 'string' || !payload.serverUrl.trim())) {
      return res.status(502).json({ error: 'Supabase LiveKit function did not return a token and LiveKit server URL.' });
    }
    return res.status(upstream.status).json(payload);
  } catch (error) {
    const timedOut = error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return res.status(503).json({
      available: false,
      reason: timedOut ? 'supabase_timeout' : 'supabase_unreachable',
      error: 'Vercel could not reach the Supabase livekit-token function. Check its deployment and Supabase availability.'
    });
  }
}
