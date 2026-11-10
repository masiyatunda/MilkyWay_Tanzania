import { createHmac } from 'node:crypto';
import { route, ApiError, requireUuid, isUuid } from './_lib/supa.js';

// Co-host Live rooms (TikTok-style guests). The client polls `status`; request/approve/mute/remove change who may
// publish. Publish rights are changed in LiveKit itself with the server secret, so a guest cannot grant themselves
// camera/mic access by editing database rows. Needs LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET on Render.

const ROOM = /^mw-(audio|video)-live-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ADMISSIONS = ['approval', 'direct', 'broadcast'];
const DEFAULTS = { layout: 3, admission: 'approval', layoutStyle: 'fullscreen', hostPosition: 'start', mobileLayout: 'stack', featuredId: null };
const CAMERA = 1, MIC = 2;

const env = name => (process.env[name] || '').trim();
const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function livekitConfigured() { return !!(env('LIVEKIT_URL') && env('LIVEKIT_API_KEY') && env('LIVEKIT_API_SECRET')); }

async function livekit(method, room, body) {
  if (!livekitConfigured()) throw new ApiError(503, 'LiveKit is not configured on the server (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).');
  const now = Math.floor(Date.now() / 1000);
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: env('LIVEKIT_API_KEY'), sub: 'milkyway-render', nbf: now - 5, exp: now + 60, video: { roomAdmin: true, room } })}`;
  const jwt = `${head}.${createHmac('sha256', env('LIVEKIT_API_SECRET')).update(head).digest('base64url')}`;
  const origin = env('LIVEKIT_URL').replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/+$/, '');
  let result;
  try {
    result = await fetch(`${origin}/twirp/livekit.RoomService/${method}`, {
      method: 'POST', headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, ...body }), signal: AbortSignal.timeout(8000),
    });
  } catch { throw new ApiError(503, 'LiveKit is unreachable.'); }
  const data = await result.json().catch(() => ({}));
  if (result.status === 404) return null; // participant or room is not connected right now
  if (!result.ok) throw new ApiError(503, data?.msg || 'LiveKit rejected the request.');
  return data;
}

const sourcesFor = (audioRoom, micAllowed) => audioRoom ? (micAllowed ? [MIC] : []) : (micAllowed ? [CAMERA, MIC] : [CAMERA]);
const setPublish = (room, identity, allowed, audioRoom, micAllowed = true) => livekit('UpdateParticipant', room, {
  identity,
  permission: { canSubscribe: true, canPublish: allowed, canPublishData: true, canPublishSources: allowed ? sourcesFor(audioRoom, micAllowed) : [] },
});

// Short cache so every viewer polling does not hit LiveKit each time.
const presence = new Map();
async function connectedIds(room) {
  const cached = presence.get(room);
  if (cached && Date.now() - cached.at < 2000) return cached.ids;
  let ids = cached?.ids || [];
  try {
    const data = await livekit('ListParticipants', room, {});
    ids = (data?.participants || []).map(participant => participant.identity);
  } catch { /* keep the last known list */ }
  presence.set(room, { at: Date.now(), ids });
  if (presence.size > 500) presence.delete(presence.keys().next().value);
  return ids;
}

const profiles = new Map();
async function whoAmI(ctx) {
  const cached = profiles.get(ctx.user.id);
  if (cached && Date.now() - cached.at < 60000) return cached.value;
  const [row] = await ctx.rest(`mw_profiles?id=eq.${ctx.user.id}&select=display_name,username,avatar_url&limit=1`).catch(() => []) || [];
  const value = { name: String(row?.display_name || row?.username || ctx.user.user_metadata?.name || 'MilkyWay user').slice(0, 80), avatar: String(row?.avatar_url || '').slice(0, 500) };
  profiles.set(ctx.user.id, { at: Date.now(), value });
  if (profiles.size > 1000) profiles.delete(profiles.keys().next().value);
  return value;
}

async function loadRoom(ctx, body) {
  const roomName = typeof body.room === 'string' ? body.room : typeof body.roomName === 'string' ? body.roomName : '';
  if (!ROOM.test(roomName)) throw new ApiError(400, 'Invalid Live room.');
  const [record] = await ctx.rest(`mw_video_live_sessions?room_name=eq.${encodeURIComponent(roomName)}&select=id,host_id,is_live,title&limit=1`) || [];
  if (!record) throw new ApiError(404, 'This Live session is no longer available.');
  return { roomName, record, host: record.host_id === ctx.user.id, audio: roomName.startsWith('mw-audio-') };
}

async function loadSettings(ctx, roomName) {
  const [row] = await ctx.rest(`mw_live_room_settings?room_name=eq.${encodeURIComponent(roomName)}&select=settings&limit=1`).catch(() => []) || [];
  return { ...DEFAULTS, ...(row?.settings || {}) };
}

const requireHost = room => { if (!room.host) throw new ApiError(403, 'Only the host can do this.'); };
const memberPath = (roomName, userId) => `mw_live_room_members?room_name=eq.${encodeURIComponent(roomName)}&user_id=eq.${userId}`;
const upsertMember = (ctx, roomName, userId, fields) => ctx.rest('mw_live_room_members?on_conflict=room_name,user_id', {
  method: 'POST', prefer: 'resolution=merge-duplicates', body: { room_name: roomName, user_id: userId, updated_at: new Date().toISOString(), ...fields },
});

async function status(ctx, room) {
  const me = await whoAmI(ctx);
  const [settings, rows, messages, connected] = await Promise.all([
    loadSettings(ctx, room.roomName),
    ctx.rest(`mw_live_room_members?room_name=eq.${encodeURIComponent(room.roomName)}&select=room_name,user_id,name,avatar,state,host_muted&order=updated_at.desc&limit=200`),
    ctx.rest(`mw_live_room_messages?room_name=eq.${encodeURIComponent(room.roomName)}&select=id,user_id,name,avatar,kind,body,deleted,created_at&order=created_at.desc&limit=100`),
    connectedIds(room.roomName),
  ]);
  let own = (rows || []).find(row => row.user_id === ctx.user.id);
  if (!room.host && !own) {
    await upsertMember(ctx, room.roomName, ctx.user.id, { name: me.name, avatar: me.avatar, state: 'viewer' }).catch(() => {});
    own = { room_name: room.roomName, user_id: ctx.user.id, name: me.name, avatar: me.avatar, state: 'viewer', host_muted: false };
  }
  if (room.host && !(await ctx.rest(`mw_live_room_settings?room_name=eq.${encodeURIComponent(room.roomName)}&select=room_name&limit=1`).catch(() => [null]))?.length) {
    await ctx.rest('mw_live_room_settings', { method: 'POST', prefer: 'resolution=ignore-duplicates', body: { room_name: room.roomName, host_id: ctx.user.id, settings: DEFAULTS } }).catch(() => {});
  }
  const toMember = row => ({ roomName: row.room_name, userId: row.user_id, name: row.name, avatar: row.avatar, state: row.state, hostMuted: !!row.host_muted });
  const self = room.host ? { userId: ctx.user.id, name: me.name, avatar: me.avatar, state: 'speaker', hostMuted: false } : toMember(own);
  return {
    settings, self,
    members: (rows || []).filter(row => row.user_id !== room.record.host_id).map(toMember),
    messages: (messages || []).reverse().map(row => ({ id: row.id, userId: row.user_id, name: row.name, avatar: row.avatar, kind: row.kind, body: row.deleted ? '' : row.body, deleted: !!row.deleted, createdAt: row.created_at })),
    connected,
  };
}

async function handle({ ctx, body, method }) {
  if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
  const action = String(body.action || 'status');
  const room = await loadRoom(ctx, body);
  const target = () => requireUuid(typeof body.target === 'string' ? body.target.toLowerCase() : '', 'participant');

  if (action === 'status') return status(ctx, room);
  if (action === 'started') return { ok: true };
  if (!room.record.is_live && action !== 'end') throw new ApiError(404, 'This Live session has ended.');

  if (action === 'request') {
    if (room.host) throw new ApiError(400, 'The host is already on stage.');
    const settings = await loadSettings(ctx, room.roomName);
    if (settings.admission === 'broadcast') throw new ApiError(403, 'Guests cannot join this Live.');
    const me = await whoAmI(ctx);
    const [existing] = await ctx.rest(`${memberPath(room.roomName, ctx.user.id)}&select=state,host_muted&limit=1`) || [];
    if (existing?.state === 'speaker') return { state: 'speaker' };
    const direct = settings.admission === 'direct';
    if (direct) {
      const seated = await ctx.rest(`mw_live_room_members?room_name=eq.${encodeURIComponent(room.roomName)}&state=eq.speaker&select=user_id`) || [];
      if (seated.length >= settings.layout - 1) throw new ApiError(409, 'All guest seats are full.');
    }
    await upsertMember(ctx, room.roomName, ctx.user.id, { name: me.name, avatar: me.avatar, state: direct ? 'speaker' : 'pending' });
    if (direct) await setPublish(room.roomName, ctx.user.id, true, room.audio).catch(async error => {
      await upsertMember(ctx, room.roomName, ctx.user.id, { state: 'viewer' }).catch(() => {});
      throw error;
    });
    return { state: direct ? 'speaker' : 'pending' };
  }

  if (action === 'leave-stage') {
    if (room.host) throw new ApiError(400, 'The host cannot leave the stage.');
    await upsertMember(ctx, room.roomName, ctx.user.id, { state: 'viewer' });
    await setPublish(room.roomName, ctx.user.id, false, room.audio).catch(() => {});
    return { state: 'viewer' };
  }

  if (action === 'message') {
    const id = requireUuid(body.id, 'message');
    const text = typeof body.message === 'string' ? body.message.trim().slice(0, 300) : '';
    if (!text) throw new ApiError(400, 'Write a message first.');
    const me = await whoAmI(ctx);
    await ctx.rest('mw_live_room_messages', { method: 'POST', prefer: 'resolution=ignore-duplicates', body: { id, room_name: room.roomName, user_id: ctx.user.id, name: me.name, avatar: me.avatar, kind: 'chat', body: text } });
    return { ok: true };
  }

  requireHost(room);

  if (action === 'approve') {
    const userId = target();
    const settings = await loadSettings(ctx, room.roomName);
    const speakers = await ctx.rest(`mw_live_room_members?room_name=eq.${encodeURIComponent(room.roomName)}&state=eq.speaker&select=user_id`) || [];
    if (!speakers.some(row => row.user_id === userId) && speakers.length >= settings.layout - 1) throw new ApiError(409, 'All guest seats are full. Raise the seat count in Live settings.');
    const [member] = await ctx.rest(`${memberPath(room.roomName, userId)}&select=user_id&limit=1`) || [];
    if (!member) throw new ApiError(404, 'That person is not in this Live.');
    await setPublish(room.roomName, userId, true, room.audio);
    await ctx.rest(memberPath(room.roomName, userId), { method: 'PATCH', body: { state: 'speaker', host_muted: false, updated_at: new Date().toISOString() } });
    return { ok: true, state: 'speaker' };
  }

  if (action === 'reject' || action === 'remove') {
    const userId = target();
    await ctx.rest(memberPath(room.roomName, userId), { method: 'PATCH', body: { state: 'viewer', host_muted: false, updated_at: new Date().toISOString() } });
    await setPublish(room.roomName, userId, false, room.audio).catch(() => {});
    return { ok: true };
  }

  if (action === 'mute' || action === 'allow-mic') {
    const userId = target();
    const muted = action === 'mute';
    await setPublish(room.roomName, userId, true, room.audio, !muted);
    await ctx.rest(memberPath(room.roomName, userId), { method: 'PATCH', body: { host_muted: muted, updated_at: new Date().toISOString() } });
    return { ok: true };
  }

  if (action === 'settings') {
    const current = await loadSettings(ctx, room.roomName);
    const layout = Number.isInteger(body.layout) ? Math.max(2, Math.min(21, body.layout)) : current.layout;
    const speakers = await ctx.rest(`mw_live_room_members?room_name=eq.${encodeURIComponent(room.roomName)}&state=eq.speaker&select=user_id`);
    if (speakers.length > layout - 1) throw new ApiError(409, 'Remove a guest from the stage before reducing the number of guest boxes.');
    const next = {
      layout,
      admission: ADMISSIONS.includes(body.admission) ? body.admission : current.admission,
      layoutStyle: typeof body.layoutStyle === 'string' && /^[a-z-]{3,30}$/.test(body.layoutStyle) ? body.layoutStyle : current.layoutStyle,
      hostPosition: body.hostPosition === 'end' ? 'end' : 'start',
      mobileLayout: body.mobileLayout === 'compact' ? 'compact' : 'stack',
      featuredId: isUuid(body.featuredId) ? body.featuredId : null,
      order: Array.isArray(body.order) ? body.order.filter(isUuid).slice(0, 21) : current.order || [],
    };
    await ctx.rest('mw_live_room_settings?on_conflict=room_name', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { room_name: room.roomName, host_id: ctx.user.id, settings: next, updated_at: new Date().toISOString() } });
    return { ok: true, settings: next };
  }

  if (action === 'title') {
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    await ctx.rest(`mw_video_live_sessions?id=eq.${room.record.id}`, { method: 'PATCH', body: { title } });
    return { ok: true };
  }

  if (action === 'delete-message') {
    await ctx.rest(`mw_live_room_messages?id=eq.${requireUuid(body.id, 'message')}&room_name=eq.${encodeURIComponent(room.roomName)}`, { method: 'PATCH', body: { deleted: true } });
    return { ok: true };
  }

  if (action === 'end') {
    await ctx.rest(`mw_video_live_sessions?id=eq.${room.record.id}`, { method: 'PATCH', body: { is_live: false, ended_at: new Date().toISOString() } });
    await livekit('DeleteRoom', room.roomName, {}).catch(() => {});
    return { ok: true };
  }

  throw new ApiError(400, 'Unsupported room action.');
}

export default route({ '': handle });
