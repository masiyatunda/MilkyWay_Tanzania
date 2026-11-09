// Configuration self-check: GET /api/milkyway-health. Reports pass/fail per item and never returns secret values.
const EXPECTED_SUPABASE_HOST = 'wpclkhgizbvxuvbhbwzs.supabase.co';
const EXPECTED_LIVEKIT_URL = 'wss://masiyatunda-milkyway-live-mgh6b1np.livekit.cloud';

const first = (...names) => names.map(name => (process.env[name] || '').trim()).find(Boolean) || '';

async function probe(url, init) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch { return { status: 0, body: null }; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).setHeader('Allow', 'GET').json({ error: 'Method not allowed.' });

  const checks = [];
  const add = (name, ok, detail, level = 'fail') => checks.push({ name, status: ok ? 'ok' : level, detail });

  const rawUrl = first('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = first('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  let supabaseUrl = rawUrl.replace(/\/+$/, '') || `https://${EXPECTED_SUPABASE_HOST}`;

  let host = '';
  try { const address = new URL(supabaseUrl); host = address.host; add('SUPABASE_URL format', address.protocol === 'https:' && !address.pathname.replace(/\/$/, ''), rawUrl ? 'Valid https URL.' : `Not set; using ${EXPECTED_SUPABASE_HOST}.`, rawUrl ? 'fail' : 'warn'); }
  catch { add('SUPABASE_URL format', false, 'SUPABASE_URL is not a valid https URL.'); supabaseUrl = ''; }
  if (host) add('SUPABASE_URL matches the project', host === EXPECTED_SUPABASE_HOST, host === EXPECTED_SUPABASE_HOST ? 'Matches the Live token function and storage project.' : `Expected ${EXPECTED_SUPABASE_HOST}, found ${host}. Live tokens and storage use the expected project.`);

  add('SUPABASE_ANON_KEY set', !!anonKey, anonKey ? 'Present.' : 'Missing. Browser requests still work with their own key, but server routes cannot call Supabase on their own.', 'warn');
  if (anonKey) add('SUPABASE_ANON_KEY is a publishable key', /^(sb_publishable_|eyJ)/.test(anonKey) && !/^sb_secret_/.test(anonKey), 'Must be the publishable/anon key, never the service-role or secret key.');

  if (supabaseUrl && anonKey) {
    const auth = await probe(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: anonKey } });
    add('Supabase accepts the key', auth.status === 200, auth.status === 200 ? 'Auth service reachable and key accepted.' : auth.status === 0 ? 'Supabase is unreachable from this server.' : `Supabase answered ${auth.status}; check SUPABASE_URL and SUPABASE_ANON_KEY belong to the same project.`);
    const rest = await probe(`${supabaseUrl}/rest/v1/mw_video_live_sessions?select=id&limit=1`, { headers: { apikey: anonKey } });
    add('Live sessions table readable', rest.status === 200, rest.status === 200 ? 'mw_video_live_sessions is readable.' : `Table query answered ${rest.status}; check the table and its read policy.`);
  }

  // LiveKit credentials live in Supabase Edge Function secrets; the function reports whether they are valid.
  if (supabaseUrl) {
    const live = await probe(`${supabaseUrl}/functions/v1/livekit-token`, { headers: anonKey ? { apikey: anonKey } : {} });
    const body = live.body;
    add('livekit-token function deployed', live.status !== 404 && live.status !== 0, live.status === 404 ? 'Function not deployed: run `supabase functions deploy livekit-token`.' : live.status === 0 ? 'Function unreachable.' : 'Deployed.');
    if (live.status === 200 && body) {
      add('LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL', body.available === true, body.available ? 'Credentials valid and LiveKit reachable.' : `Function reports "${body.reason || 'unavailable'}". Set the three secrets with \`supabase secrets set\` (LIVEKIT_URL must be ${EXPECTED_LIVEKIT_URL}).`);
    }
  }

  add('Gateway routes loaded', true, 'api/ handlers are mounted on this server.');

  const failed = checks.filter(check => check.status === 'fail').length;
  return res.status(failed ? 503 : 200).json({ ok: failed === 0, checks });
}
