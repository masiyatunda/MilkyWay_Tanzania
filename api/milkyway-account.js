import { route, ApiError, SUPABASE, isUuid, requireUuid, eq, inList } from './_lib/supa.js';

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const uuidList = (value, max) => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map(item => String(item).trim().toLowerCase()).filter(isUuid))].slice(0, max);
const needPost = method => { if (method !== 'POST') throw new ApiError(405, 'Use POST.'); };
const clamp = (value, low, high, fallback) => { const number = Math.round(Number(value)); return Number.isFinite(number) ? Math.min(high, Math.max(low, number)) : fallback; };
const header = (request, name) => String(request.headers?.[name] || '').trim();

async function requireAdmin(ctx) {
  if ((await ctx.rpc('mw_is_admin')) !== true) throw new ApiError(403, 'Not allowed.');
}

// Network country (from the hosting edge) first, then the region the device reports.
function detectCountry(request) {
  for (const name of ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country', 'x-appengine-country', 'x-country-code']) {
    const code = header(request, name).toUpperCase();
    if (/^[A-Z]{2}$/.test(code) && !['XX', 'T1'].includes(code)) return { country: code, source: 'network' };
  }
  const device = header(request, 'x-mw-region').toUpperCase();
  return /^[A-Z]{2}$/.test(device) ? { country: device, source: 'device' } : { country: '', source: '' };
}

const privateRow = async (ctx, columns) => (await ctx.rest(`mw_account_private?select=${columns}&user_id=${eq(ctx.user.id)}&limit=1`))?.[0] || null;
const savePrivate = (ctx, values) => ctx.rest('mw_account_private?on_conflict=user_id', {
  method: 'POST', prefer: 'resolution=merge-duplicates', body: { user_id: ctx.user.id, ...values, updated_at: new Date().toISOString() },
});

// ---------- details ----------
function validDetails(source) {
  const birthDate = String(source?.birthDate ?? source?.mw_birth_date ?? '');
  const gender = String(source?.gender ?? source?.mw_gender ?? '');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) throw new ApiError(400, 'Enter a valid date of birth.');
  const [year, month, day] = match.slice(1).map(Number);
  const born = new Date(Date.UTC(year, month - 1, day));
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) throw new ApiError(400, 'Enter a valid date of birth.');
  const today = new Date();
  const age = today.getUTCFullYear() - year - (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day) ? 1 : 0);
  if (age < 13 || age > 120) throw new ApiError(400, 'You must be at least 13 years old.');
  if (!['male', 'female', 'other'].includes(gender)) throw new ApiError(400, 'Choose a gender.');
  return { birthDate, gender };
}

// ---------- campaigns ----------
const IMAGE_OR_VIDEO = ['image', 'video'];
const httpsUrl = (value, max = 1000) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const address = new URL(raw);
    if (address.protocol !== 'https:' || address.username || address.password || raw.length > max) throw new Error();
    return address.href;
  } catch { throw new ApiError(400, 'Links must be valid HTTPS addresses.'); }
};
const MANAGED_MEDIA = '/api/milkyway-account?action=campaign-media&key=';
const mediaUrl = value => {
  const raw = String(value ?? '').trim();
  return raw.startsWith(MANAGED_MEDIA) && raw.length <= 400 ? raw : httpsUrl(raw);
};
const choice = (value, allowed, label) => { if (!allowed.includes(value)) throw new ApiError(400, `Invalid ${label}.`); return value; };
const dateValue = (value, label) => {
  if (value === null || value === '') return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new ApiError(400, `Invalid ${label}.`);
  return new Date(time).toISOString();
};
const csv = (value, pattern, transform) => [...new Set(String(value ?? '').split(',').map(item => transform(item.trim())).filter(item => pattern.test(item)))].join(',');

const CAMPAIGN_FIELDS = {
  business: ['business', value => { const name = text(value, 100); if (!name) throw new ApiError(400, 'Business name is required.'); return name; }],
  title: ['title', value => text(value, 140)],
  description: ['description', value => text(value, 1000)],
  mediaUrl: ['media_url', value => { const url = mediaUrl(value); if (!url) throw new ApiError(400, 'Media link is required.'); return url; }],
  mediaType: ['media_type', value => choice(value, IMAGE_OR_VIDEO, 'media type')],
  destination: ['destination', value => httpsUrl(value, 500)],
  ctaLabel: ['cta_label', value => text(value, 40)],
  audience: ['audience', value => choice(value, ['all', 'members'], 'audience')],
  frequency: ['frequency', value => clamp(value, 3, 20, 6)],
  dismissDays: ['dismiss_days', value => clamp(value, 1, 365, 7)],
  status: ['status', value => choice(value, ['draft', 'approved', 'paused'], 'status')],
  placement: ['placement', value => choice(value, ['feed', 'banner', 'video'], 'placement')],
  skipAfter: ['skip_after', value => clamp(value, 0, 60, 5)],
  paid: ['paid', value => value === true],
  amountPaid: ['amount_paid', value => { const amount = Number(value); return Number.isFinite(amount) && amount >= 0 ? Math.min(amount, 1e12) : 0; }],
  currency: ['currency', value => { const code = text(value, 3).toUpperCase(); return /^[A-Z]{3}$/.test(code) ? code : 'TZS'; }],
  paymentRef: ['payment_ref', value => text(value, 120)],
  startsAt: ['starts_at', value => dateValue(value, 'start date')],
  endsAt: ['ends_at', value => dateValue(value, 'end date')],
  targetLanguages: ['target_languages', value => csv(value, /^[a-z]{2}$/, item => item.toLowerCase())],
  targetCountries: ['target_countries', value => csv(value, /^[A-Z]{2}$/, item => item.toUpperCase())],
};
const NULLABLE = new Set(['startsAt', 'endsAt']);

const campaignOut = row => ({
  id: row.id, business: row.business, title: row.title, description: row.description, mediaUrl: row.media_url, mediaType: row.media_type,
  destination: row.destination, ctaLabel: row.cta_label, audience: row.audience, frequency: row.frequency, dismissDays: row.dismiss_days,
  status: row.status, placement: row.placement, skipAfter: row.skip_after, paid: row.paid === true, amountPaid: Number(row.amount_paid) || 0,
  currency: row.currency, paymentRef: row.payment_ref, startsAt: row.starts_at, endsAt: row.ends_at,
  targetLanguages: row.target_languages, targetCountries: row.target_countries,
  impressions: Number(row.impressions) || 0, clicks: Number(row.clicks) || 0, createdAt: row.created_at,
});

// ---------- storage ----------
const PUBLIC_PREFIX = `${SUPABASE}/storage/v1/object/public/portfolio/`;
const fileKeyAllowed = (userId, key) => typeof key === 'string' && key.length <= 300 && !key.includes('..') && !key.includes('\\')
  && [`milkyway/${userId}/`, `milkyway-avatars/${userId}/`, `avatars/${userId}/`].some(prefix => key.startsWith(prefix) && key.length > prefix.length);
const keyFromPublicUrl = url => {
  if (typeof url !== 'string' || !url.startsWith(PUBLIC_PREFIX)) return '';
  try { return decodeURIComponent(url.slice(PUBLIC_PREFIX.length).split('?')[0]); } catch { return ''; }
};
async function removeObject(ctx, key) {
  try {
    const response = await fetch(`${SUPABASE}/storage/v1/object/portfolio/${key.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'DELETE', headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.token}` }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null);
    return Array.isArray(data) ? data.length > 0 : true;
  } catch { return false; }
}

export default route({
  // ----- account & wallet -----
  balance: async ({ ctx }) => {
    try { return { coins: Number(await ctx.rpc('mw_wallet_coins')) || 0 }; } catch { return { coins: 0 }; }
  },

  preferences: async ({ ctx, method, body }) => {
    if (method === 'GET') return { preferences: await ctx.rpc('mw_get_preferences') };
    needPost(method);
    const patch = {};
    for (const key of ['isPrivate', 'notifyFollow', 'notifyEcho', 'notifySignal']) {
      if (key in body) { if (typeof body[key] !== 'boolean') throw new ApiError(400, `Invalid ${key}.`); patch[key] = body[key]; }
    }
    if ('allowMessages' in body) patch.allowMessages = choice(body.allowMessages, ['everyone', 'followers', 'nobody'], 'message setting');
    return { preferences: await ctx.rpc('mw_set_preferences', { p: patch }) };
  },

  privacy: {
    auth: false,
    run: async ({ ctx, query }) => {
      const ids = uuidList(query.ids, 100);
      return { accounts: ids.length ? await ctx.rpc('mw_privacy_flags', { p_ids: ids }) : {} };
    },
  },

  details: async ({ ctx, method, body }) => {
    if (method === 'GET') {
      const row = await privateRow(ctx, 'birth_date,gender');
      return { birthDate: row?.birth_date || '', gender: row?.gender || '' };
    }
    needPost(method);
    const details = validDetails(body.birthDate || body.gender ? body : ctx.user.user_metadata);
    await savePrivate(ctx, { birth_date: details.birthDate, gender: details.gender });
    return details;
  },

  'detect-country': { auth: false, run: async ({ request }) => detectCountry(request) },

  country: async ({ ctx, request, method }) => {
    const row = await privateRow(ctx, 'country');
    if (method === 'GET') return { country: row?.country || '' };
    needPost(method);
    if (row?.country) return { country: row.country };
    const metadata = String(ctx.user.user_metadata?.mw_country || '').toUpperCase();
    const found = /^[A-Z]{2}$/.test(metadata) ? { country: metadata, source: 'signup' } : detectCountry(request);
    if (!found.country) return { country: '' };
    await savePrivate(ctx, { country: found.country });
    return { country: found.country, source: found.source };
  },

  phone: async ({ ctx, method, body }) => {
    if (method === 'GET') return { phone: (await privateRow(ctx, 'phone'))?.phone || '' };
    needPost(method);
    const phone = text(body.phone, 24);
    if (!phone) { await savePrivate(ctx, { phone: null, phone_digits: null }); return { phone: '' }; }
    const digits = phone.replace(/\D/g, '');
    if (!/^\+?[\d\s().-]{6,24}$/.test(phone) || digits.length < 8 || digits.length > 15) throw new ApiError(400, 'Enter a valid phone number.');
    try { await savePrivate(ctx, { phone, phone_digits: digits }); }
    catch (error) { if (error instanceof ApiError && error.status === 409) throw new ApiError(409, 'This number is already linked to another account.'); throw error; }
    return { phone };
  },

  'phone-lookup': async ({ ctx, query }) => {
    const raw = text(query.q, 30);
    const digits = raw.replace(/\D/g, '');
    if (!/^\+?[\d\s().-]{6,30}$/.test(raw) || digits.length < 8 || digits.length > 15) throw new ApiError(400, 'Enter a valid phone number.');
    const accounts = await ctx.rpc('mw_find_accounts_by_phone', { p_digits: digits });
    return { accounts: Array.isArray(accounts) ? accounts : [], phone: raw.startsWith('+') ? `+${digits}` : digits };
  },

  // ----- administration, suspensions and appeals -----
  'admin-status': async ({ ctx }) => {
    const isAdmin = (await ctx.rpc('mw_is_admin')) === true;
    return { isAdmin, owner: isAdmin };
  },

  'account-status': ({ ctx }) => ctx.rpc('mw_account_status'),

  appeal: async ({ ctx, method, body }) => {
    needPost(method);
    const message = text(body.message, 1000);
    if (!message) throw new ApiError(400, 'Write your appeal first.');
    await ctx.rpc('mw_submit_appeal', { p_message: message });
    return { ok: true };
  },

  'admin-users': ({ ctx, query }) => ctx.rpc('mw_admin_users', {
    p_offset: clamp(query.offset, 0, 1e7, 0), p_q: text(query.q, 60), p_suspended: query.status === 'suspended',
  }),

  'admin-appeals': ({ ctx, query }) => ctx.rpc('mw_admin_appeals', { p_status: String(query.status || 'pending') }),

  'admin-suspend': async ({ ctx, method, body }) => {
    needPost(method);
    await ctx.rpc('mw_admin_suspend', { p_user: requireUuid(String(body.userId || ''), 'user'), p_reason: text(body.reason, 300) });
    return { ok: true };
  },

  'admin-restore': async ({ ctx, method, body }) => {
    needPost(method);
    await ctx.rpc('mw_admin_restore', { p_user: requireUuid(String(body.userId || ''), 'user') });
    return { ok: true };
  },

  'admin-appeal': async ({ ctx, method, body }) => {
    needPost(method);
    await ctx.rpc('mw_admin_resolve_appeal', {
      p_id: requireUuid(String(body.id || ''), 'appeal'), p_decision: choice(String(body.decision || ''), ['approve', 'reject'], 'decision'), p_note: text(body.note, 500),
    });
    return { ok: true };
  },

  // ----- advertising -----
  campaigns: async ({ ctx, method, query, body }) => {
    await requireAdmin(ctx);
    if (method === 'GET') {
      const rows = await ctx.rest('mw_ad_campaigns?select=*&order=created_at.desc&limit=500');
      return { campaigns: (rows || []).map(campaignOut) };
    }
    if (method === 'DELETE') {
      await ctx.rest(`mw_ad_campaigns?id=${eq(requireUuid(String(query.id || ''), 'campaign'))}`, { method: 'DELETE' });
      return { ok: true };
    }
    needPost(method);
    const row = {};
    for (const [key, [column, clean]] of Object.entries(CAMPAIGN_FIELDS)) {
      const value = body[key];
      if (value === undefined || (value === null && !NULLABLE.has(key))) continue;
      row[column] = clean(value);
    }
    if (body.id) {
      const id = requireUuid(String(body.id), 'campaign');
      const rows = await ctx.rest(`mw_ad_campaigns?id=${eq(id)}`, { method: 'PATCH', returning: true, body: { ...row, updated_at: new Date().toISOString() } });
      if (!rows?.length) throw new ApiError(404, 'Campaign not found.');
      return { campaign: campaignOut(rows[0]) };
    }
    if (!row.business || !row.media_url) throw new ApiError(400, 'Business name and media are required.');
    const rows = await ctx.rest('mw_ad_campaigns', { method: 'POST', returning: true, body: { ...row, created_by: ctx.user.id } });
    return { campaign: campaignOut(rows[0]) };
  },

  // Files are uploaded straight to Supabase storage by the admin page; this action validates the stored file's address.
  // The JSON body parser cannot receive multipart uploads.
  'campaign-media': {
    auth: false,
    run: async ({ ctx, request, method, query, body }) => {
      if (method === 'GET') {
        const key = String(query.key || '');
        if (!/^milkyway\/[a-f0-9-]{36}\/campaigns\/[\w.-]{1,120}$/i.test(key)) throw new ApiError(400, 'Invalid media key.');
        request.res.redirect(302, PUBLIC_PREFIX + key.split('/').map(encodeURIComponent).join('/'));
        return undefined;
      }
      needPost(method);
      if (!ctx.user) throw new ApiError(401, 'Sign in first.');
      await requireAdmin(ctx);
      const url = String(body.url || body.mediaUrl || '').trim();
      if (!url.startsWith(`${PUBLIC_PREFIX}milkyway/`)) throw new ApiError(415, 'Upload the file to storage and send its public address as { "url": ... }.');
      const type = IMAGE_OR_VIDEO.includes(body.type) ? body.type : /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? 'video' : 'image';
      return { mediaUrl: httpsUrl(url), mediaType: type };
    },
  },

  advertisements: {
    auth: false,
    run: async ({ ctx, request, query }) => {
      let country = detectCountry(request).country;
      if (!country && ctx.user) { try { country = (await privateRow(ctx, 'country'))?.country || ''; } catch { country = ''; } }
      const language = text(query.lang, 12).toLowerCase().split('-')[0];
      const campaigns = await ctx.rpc('mw_active_ads', { p_lang: language, p_country: country });
      return { campaigns: Array.isArray(campaigns) ? campaigns : [] };
    },
  },

  'ad-event': {
    auth: false,
    run: async ({ ctx, method, query }) => {
      needPost(method);
      await ctx.rpc('mw_ad_event', { p_id: requireUuid(String(query.id || ''), 'campaign'), p_type: choice(String(query.type || ''), ['impression', 'click'], 'event') });
      return { ok: true };
    },
  },

  'dismiss-ad': async ({ ctx, method, query }) => {
    needPost(method);
    await ctx.rpc('mw_dismiss_ad', { p_id: requireUuid(String(query.id || ''), 'campaign') });
    return { ok: true };
  },

  // ----- stories, watermarks, files -----
  stories: async ({ ctx, method, body }) => {
    if (method === 'GET') {
      const rows = await ctx.rest(`mw_story_views?select=story_id&user_id=${eq(ctx.user.id)}&order=viewed_at.desc&limit=1000`);
      return { viewed: (rows || []).map(row => ({ storyId: row.story_id })) };
    }
    needPost(method);
    await ctx.rest('mw_story_views?on_conflict=user_id,story_id', {
      method: 'POST', prefer: 'resolution=ignore-duplicates', body: { user_id: ctx.user.id, story_id: requireUuid(String(body.id || ''), 'story') },
    });
    return { ok: true };
  },

  watermarks: {
    auth: false,
    run: async ({ ctx, query }) => {
      const ids = uuidList(query.ids, 60);
      if (!ids.length) return { ids: [] };
      const rows = await ctx.rest(`mw_post_watermarks?select=post_id&post_id=${inList(ids)}`);
      return { ids: (rows || []).map(row => row.post_id) };
    },
  },

  watermark: async ({ ctx, method, query }) => {
    const id = requireUuid(String(query.id || ''), 'post');
    if (method === 'POST') {
      await ctx.rest('mw_post_watermarks?on_conflict=post_id', { method: 'POST', prefer: 'resolution=ignore-duplicates', body: { post_id: id, owner_id: ctx.user.id } });
    } else if (method === 'DELETE') {
      await ctx.rest(`mw_post_watermarks?post_id=${eq(id)}&owner_id=${eq(ctx.user.id)}`, { method: 'DELETE' });
    } else throw new ApiError(405, 'Use POST or DELETE.');
    return { ok: true };
  },

  files: async ({ ctx }) => {
    const files = await ctx.rpc('mw_my_files');
    return { files: (Array.isArray(files) ? files : []).map(file => ({ ...file, retained: false })) };
  },

  file: async ({ ctx, method, query }) => {
    if (method !== 'DELETE') throw new ApiError(405, 'Use DELETE.');
    const key = String(query.key || '');
    if (!fileKeyAllowed(ctx.user.id, key)) throw new ApiError(400, 'Invalid file.');
    if (!(await removeObject(ctx, key))) throw new ApiError(403, 'This file could not be deleted.');
    const profile = (await ctx.rest(`mw_profiles?select=avatar_url&id=${eq(ctx.user.id)}&limit=1`))?.[0];
    if (keyFromPublicUrl(profile?.avatar_url) === key) await ctx.rest(`mw_profiles?id=${eq(ctx.user.id)}`, { method: 'PATCH', body: { avatar_url: null } });
    return { ok: true };
  },

  avatar: async ({ ctx, method }) => {
    if (method !== 'DELETE') throw new ApiError(405, 'Use DELETE.');
    const profile = (await ctx.rest(`mw_profiles?select=avatar_url&id=${eq(ctx.user.id)}&limit=1`))?.[0];
    await ctx.rest(`mw_profiles?id=${eq(ctx.user.id)}`, { method: 'PATCH', body: { avatar_url: null } });
    const key = keyFromPublicUrl(profile?.avatar_url);
    const cleanupPending = fileKeyAllowed(ctx.user.id, key) ? !(await removeObject(ctx, key)) : false;
    return { ok: true, cleanupPending };
  },

  // ----- live history -----
  'live-history': async ({ ctx, method, query, body }) => {
    if (method === 'POST') {
      const sessions = (Array.isArray(body.sessions) ? body.sessions : [])
        .filter(item => item && isUuid(item.id) && ['audio', 'video'].includes(item.source)).slice(0, 200)
        .map(item => ({ user_id: ctx.user.id, source: item.source, session_id: item.id.toLowerCase() }));
      if (sessions.length) await ctx.rest('mw_live_history_archive?on_conflict=user_id,source,session_id', { method: 'POST', prefer: 'resolution=ignore-duplicates', body: sessions });
      return { ok: true, archived: sessions.length };
    }
    const ids = uuidList(query.ids, 100);
    const calls = new Map();
    for (const room of String(query.rooms || '').split(',').slice(0, 100)) {
      const match = /^mw-conversation-(?:audio|video)-([a-f0-9-]{36})$/i.exec(room.trim());
      if (match && isUuid(match[1])) calls.set(match[1].toLowerCase(), room.trim());
    }
    const [archivedRows, callRows] = await Promise.all([
      ids.length ? ctx.rest(`mw_live_history_archive?select=session_id,source&user_id=${eq(ctx.user.id)}&session_id=${inList(ids)}`) : [],
      calls.size ? ctx.rest(`mw_dm_calls?select=id,status,answer,created_at,ended_at&id=${inList([...calls.keys()])}`).catch(() => []) : [],
    ]);
    return {
      archived: (archivedRows || []).map(row => ({ id: row.session_id, source: row.source })),
      metadata: (callRows || []).map(call => {
        const outcome = String(call.answer?.outcome || '');
        return {
          room: calls.get(String(call.id).toLowerCase()), startedAt: call.answer?.acceptedAt || call.created_at, endedAt: call.ended_at || null,
          lifecycleStatus: ['failed', 'error'].includes(outcome) ? 'failed' : outcome === 'interrupted' ? 'interrupted' : 'ended',
        };
      }).filter(item => item.room),
    };
  },
});
