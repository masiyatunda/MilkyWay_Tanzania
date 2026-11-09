import { route, ApiError, requireUuid } from './_lib/supa.js';

const ROOM = /^mw-conversation-(audio|video)-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

async function loadCall(ctx, id) {
  const [call] = await ctx.rest(`mw_dm_calls?id=eq.${id}&select=id,caller_id,callee_id,status,offer&limit=1`) || [];
  return call || null;
}

async function authorize({ request, ctx, body }) {
  if (request.method !== 'POST') throw new ApiError(405, 'Method not allowed.');
  const roomName = typeof body.roomName === 'string' ? body.roomName : '';
  const action = body.action || 'token';
  if (!['token', 'participants', 'sync', 'end'].includes(action)) throw new ApiError(400, 'Unsupported room action.');
  const match = ROOM.exec(roomName);
  if (!match) throw new ApiError(400, 'Invalid conversation room.');
  const audio = match[1].toLowerCase() === 'audio';
  const id = requireUuid(match[2].toLowerCase(), 'call');
  const me = ctx.user.id;

  const call = await loadCall(ctx, id);
  if (!call) throw new ApiError(404, 'Call not found.');
  if (![call.caller_id, call.callee_id].includes(me)) throw new ApiError(403, 'Not allowed.');
  if ((call.offer?.mode === 'video') === audio) throw new ApiError(403, 'Not allowed.');
  const sources = audio ? [2] : [1, 2];

  if (action === 'end') {
    if (['ringing', 'accepted'].includes(call.status)) {
      await ctx.rest(`mw_dm_calls?id=eq.${id}&status=in.(ringing,accepted)`, { method: 'PATCH', body: { status: 'ended', ended_at: new Date().toISOString() } });
    }
    return { roomName, hostId: me };
  }

  if (action === 'participants') return { roomName, identity: me, permissions: { canPublish: false, canPublishSources: [] } };

  if (action === 'token') {
    if (!['ringing', 'accepted'].includes(call.status)) throw new ApiError(403, 'This call is no longer active.');
    return { roomName, identity: me, name: typeof body.name === 'string' ? body.name.slice(0, 80) : undefined, permissions: { canPublish: true, canPublishSources: sources } };
  }

  const target = typeof body.target === 'string' ? body.target.toLowerCase() : '';
  const other = call.caller_id === me ? call.callee_id : call.caller_id;
  if (target !== other) throw new ApiError(403, 'Not allowed.');
  const accepted = call.status === 'accepted';
  return { roomName, identity: target, permissions: { canPublish: accepted, canPublishSources: accepted ? sources : [] } };
}

export default route({ '': authorize, token: authorize, participants: authorize, sync: authorize, end: authorize });
