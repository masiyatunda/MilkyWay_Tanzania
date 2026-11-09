import { route, ApiError, SUPABASE, requireUuid } from './_lib/supa.js';

const OUTCOMES = ['ended', 'missed', 'cancelled', 'rejected', 'disconnected'];
const RING_WINDOW_MS = 60000;
const COLUMNS = 'id,caller_id,callee_id,status,offer,answer,created_at,ended_at';
const POST_ONLY = method => { if (method !== 'POST') throw new ApiError(405, 'Method not allowed.'); };

async function loadCall(ctx, id) {
  const [call] = await ctx.rest(`mw_dm_calls?id=eq.${requireUuid(id, 'call')}&select=${COLUMNS}&limit=1`) || [];
  if (!call) throw new ApiError(404, 'Call not found.');
  if (![call.caller_id, call.callee_id].includes(ctx.user.id)) throw new ApiError(403, 'Not allowed.');
  return call;
}

// Asks the Supabase LiveKit function (which in turn calls /api/milkyway-media-authorize) for a room token.
async function access(ctx, call, name) {
  const roomName = `mw-conversation-${call.offer?.mode === 'video' ? 'video' : 'audio'}-${call.id}`;
  let response;
  try {
    response = await fetch(`${SUPABASE}/functions/v1/livekit-token`, {
      method: 'POST',
      headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, action: 'token', ...(name ? { name } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new ApiError(503, 'Call service unavailable.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.token !== 'string' || typeof data?.serverUrl !== 'string') {
    throw new ApiError([401, 403, 404].includes(response.status) ? response.status : 503, data?.error || 'Call authorization failed.');
  }
  return { token: data.token, serverUrl: data.serverUrl, roomName };
}

const cleanName = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';

// Best-effort realtime nudge to the other person's open app (dm-calls.js listens on mw-calls-<user id>).
// The signal only names the call; the client re-reads it from this API, and 1-second polling remains the fallback.
async function nudge(ctx, userId, id, kind) {
  try {
    await fetch(`${SUPABASE}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: `mw-calls-${userId}`, event: 'call', payload: { id, kind }, private: false }] }),
      signal: AbortSignal.timeout(4000),
    });
  } catch { /* polling covers it */ }
}

export default route({
  // GET ?id=<call> returns one call (used to check how a ringing call ended).
  '': async ({ ctx, query, method }) => {
    if (method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    return { call: await loadCall(ctx, String(query.id || '')) };
  },

  start: async ({ ctx, body, method }) => {
    POST_ONLY(method);
    const callee = requireUuid(body.callee, 'callee');
    if (callee === ctx.user.id) throw new ApiError(400, 'You cannot call yourself.');
    const mode = body.mode === 'video' ? 'video' : 'audio';
    const name = cleanName(body.name);
    // A caller only ever has one ringing call; older ones are closed as cancelled.
    await ctx.rest(`mw_dm_calls?caller_id=eq.${ctx.user.id}&status=eq.ringing`, { method: 'PATCH', body: { status: 'ended', ended_at: new Date().toISOString(), answer: { outcome: 'cancelled' } } });
    const [call] = await ctx.rest('mw_dm_calls', { method: 'POST', returning: true, body: { caller_id: ctx.user.id, callee_id: callee, status: 'ringing', offer: { transport: 'livekit', mode, name } } }) || [];
    if (!call) throw new ApiError(503, 'Call could not start.');
    // Let the client request its token after opening the call UI; token issuance must not delay ringing.
    void nudge(ctx, callee, call.id, 'ring');
    return { call };
  },

  accept: async ({ ctx, body, method }) => {
    POST_ONLY(method);
    const id = requireUuid(body.id, 'call');
    const since = new Date(Date.now() - RING_WINDOW_MS).toISOString();
    const [call] = await ctx.rest(`mw_dm_calls?id=eq.${id}&callee_id=eq.${ctx.user.id}&status=eq.ringing&created_at=gte.${encodeURIComponent(since)}`, { method: 'PATCH', returning: true, body: { status: 'accepted', answer: { acceptedAt: new Date().toISOString() } } }) || [];
    if (!call) throw new ApiError(409, 'This call is no longer ringing.');
    // The accepted client obtains its own token in connect(), so acceptance stays responsive.
    void nudge(ctx, call.caller_id, call.id, 'accepted');
    return { call };
  },

  decline: async ({ ctx, body, method }) => {
    POST_ONLY(method);
    const id = requireUuid(body.id, 'call');
    const [call] = await ctx.rest(`mw_dm_calls?id=eq.${id}&callee_id=eq.${ctx.user.id}&status=eq.ringing`, { method: 'PATCH', returning: true, body: { status: 'declined', ended_at: new Date().toISOString(), answer: { outcome: 'rejected' } } }) || [];
    if (!call) throw new ApiError(409, 'This call is no longer ringing.');
    await nudge(ctx, call.caller_id, call.id, 'declined');
    return { call };
  },

  end: async ({ ctx, body, method }) => {
    POST_ONLY(method);
    const call = await loadCall(ctx, body.id);
    if (['ended', 'declined'].includes(call.status)) return { call };
    const outcome = OUTCOMES.includes(body.outcome) ? body.outcome : 'ended';
    const [ended] = await ctx.rest(`mw_dm_calls?id=eq.${call.id}&status=in.(ringing,accepted)`, { method: 'PATCH', returning: true, body: { status: 'ended', ended_at: new Date().toISOString(), answer: { ...(call.answer || {}), outcome } } }) || [];
    const result = ended || call;
    await nudge(ctx, call.caller_id === ctx.user.id ? call.callee_id : call.caller_id, call.id, 'ended');
    return { call: result };
  },

  incoming: async ({ ctx, method }) => {
    if (method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    const [call] = await ctx.rest(`mw_dm_calls?callee_id=eq.${ctx.user.id}&status=eq.ringing&select=${COLUMNS}&order=created_at.desc&limit=1`) || [];
    return { call: call || null };
  },

  token: async ({ ctx, body, method }) => {
    POST_ONLY(method);
    const call = await loadCall(ctx, body.id);
    if (!['ringing', 'accepted'].includes(call.status)) throw new ApiError(409, 'This call has ended.');
    return access(ctx, call, cleanName(body.name));
  },
});
