// Shared helpers for the Render API handlers. Every call runs as the signed-in user (their JWT + the public
// anon key), so Supabase row-level security and SECURITY DEFINER functions decide what is allowed.
// No service-role key is used or required.
const pick = (...names) => names.map(name => (process.env[name] || '').trim()).find(Boolean) || '';
export const SUPABASE = (pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL') || 'https://wpclkhgizbvxuvbhbwzs.supabase.co').replace(/\/+$/, '');
// Public publishable key (already shipped in the browser bundle); used only when no env var or request header supplies one.
const PUBLIC_KEY = 'sb_publishable_GCFJ3Is8t8mdia4gLeHApg_M_3ez9xb';
const envKey = () => pick('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const isUuid = value => typeof value === 'string' && UUID.test(value);

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const fail = (response, status, error) => response.status(status).json({ error });

// Returns a context for a valid session, otherwise answers 401 and returns null.
export async function authenticate(request, response, { optional = false } = {}) {
  const auth = request.headers.authorization || '';
  const key = envKey() || String(request.headers.apikey || '') || PUBLIC_KEY;
  if (!key) { fail(response, 503, 'Supabase API key is not configured.'); return null; }
  if (!/^Bearer\s+\S+/.test(auth)) {
    if (optional) return makeContext(null, '', key);
    fail(response, 401, 'Sign in first.');
    return null;
  }
  const token = auth.replace(/^Bearer\s+/i, '');
  let user = null;
  try {
    const result = await fetch(`${SUPABASE}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: key }, signal: AbortSignal.timeout(10000) });
    if (result.ok) user = await result.json();
  } catch { fail(response, 503, 'Sign-in service unavailable.'); return null; }
  if (!user?.id) {
    if (optional) return makeContext(null, '', key);
    fail(response, 401, 'Invalid or expired session.');
    return null;
  }
  return makeContext(user, token, key);
}

function makeContext(user, token, key) {
  const headers = (extra = {}) => ({ apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json', ...extra });
  const send = async (url, init = {}) => {
    let result;
    try { result = await fetch(url, { ...init, headers: headers(init.headers), signal: AbortSignal.timeout(15000) }); }
    catch { throw new ApiError(503, 'Database unavailable.'); }
    const text = await result.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!result.ok) {
      const message = typeof data === 'object' && data ? data.message || data.error || data.hint : '';
      const status = result.status === 401 ? 401 : result.status === 404 ? 404 : [400, 403, 409, 422].includes(result.status) ? result.status : 503;
      throw new ApiError(status, status === 403 ? 'Not allowed.' : message || 'Request failed.');
    }
    return data;
  };
  return {
    user, token, key,
    // rest('mw_posts?select=*&limit=5') returns rows; rest(path, { method: 'POST', body, returning: true })
    rest: (path, { method = 'GET', body, returning = false, prefer = '' } = {}) => send(`${SUPABASE}/rest/v1/${path}`, {
      method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: { Prefer: [returning ? 'return=representation' : '', prefer].filter(Boolean).join(',') || 'return=minimal' },
    }),
    rpc: (name, args = {}) => send(`${SUPABASE}/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }),
  };
}

// Builds a handler from { action: fn | { run, auth:false, methods:[...] } }. Errors are always JSON.
export function route(table) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const action = String(request.query?.action || '').toLowerCase();
    const entry = table[action];
    if (!entry) return fail(response, 400, `Unknown action "${action}".`);
    const run = typeof entry === 'function' ? entry : entry.run;
    const needsAuth = typeof entry === 'function' ? true : entry.auth !== false;
    try {
      const ctx = await authenticate(request, response, { optional: !needsAuth });
      if (!ctx) return;
      const result = await run({ request, ctx, query: request.query || {}, body: request.body && typeof request.body === 'object' ? request.body : {}, method: request.method });
      if (!response.headersSent) response.status(200).json(result ?? { ok: true });
    } catch (error) {
      if (response.headersSent) return;
      if (error instanceof ApiError) return fail(response, error.status, error.message);
      fail(response, 500, 'Service unavailable.');
    }
  };
}

export const eq = value => `eq.${encodeURIComponent(value)}`;
export const inList = values => `in.(${values.map(value => encodeURIComponent(value)).join(',')})`;
export function requireUuid(value, label = 'id') { if (!isUuid(value)) throw new ApiError(400, `Invalid ${label}.`); return value; }
