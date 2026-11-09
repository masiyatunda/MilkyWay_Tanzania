import { route, ApiError, eq } from './_lib/supa.js';

const ROOM = /^mw-[a-zA-Z0-9_-]{3,120}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const publicKey = () => (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();

function mustUse(method, allowed) {
  if (!allowed.includes(method)) throw new ApiError(405, 'Method not allowed.');
}

async function loadPreferences(ctx) {
  const [row] = await ctx.rest(`mw_notification_preferences?user_id=${eq(ctx.user.id)}&select=live_enabled,sound_enabled,language&limit=1`) || [];
  return { liveEnabled: row ? row.live_enabled !== false : true, soundEnabled: row ? row.sound_enabled !== false : true, language: row?.language || 'en' };
}

export default route({
  alerts: async ({ ctx, method }) => {
    mustUse(method, ['GET']);
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const rows = await ctx.rest(`mw_live_alerts?recipient_id=${eq(ctx.user.id)}&created_at=gte.${encodeURIComponent(since)}&select=id,room_name,host_id,host_name,title,created_at,read_at&order=created_at.desc&limit=50`) || [];
    const alerts = rows.map(row => ({ id: row.id, room: row.room_name, hostId: row.host_id, hostName: row.host_name || '', title: row.title || '', createdAt: row.created_at, read: !!row.read_at }));
    return { alerts, unread: alerts.filter(alert => !alert.read).length };
  },

  read: async ({ ctx, body, method }) => {
    mustUse(method, ['POST']);
    const rooms = Array.isArray(body.rooms) ? [...new Set(body.rooms.filter(room => typeof room === 'string' && ROOM.test(room)))].slice(0, 100) : [];
    if (!rooms.length) throw new ApiError(400, 'No rooms to mark as read.');
    const list = rooms.map(room => encodeURIComponent(room)).join(',');
    await ctx.rest(`mw_live_alerts?recipient_id=${eq(ctx.user.id)}&room_name=in.(${list})&read_at=is.null`, { method: 'PATCH', body: { read_at: new Date().toISOString() } });
    return { ok: true };
  },

  preferences: async ({ ctx, body, method }) => {
    mustUse(method, ['POST']);
    if (typeof body.liveEnabled !== 'boolean') throw new ApiError(400, 'Invalid preferences.');
    const row = {
      user_id: ctx.user.id,
      live_enabled: body.liveEnabled,
      sound_enabled: body.soundEnabled !== false,
      language: typeof body.language === 'string' && LANGUAGE.test(body.language) ? body.language : 'en',
      updated_at: new Date().toISOString(),
    };
    await ctx.rest('mw_notification_preferences?on_conflict=user_id', { method: 'POST', body: row, prefer: 'resolution=merge-duplicates' });
    return { ok: true, preferences: { liveEnabled: row.live_enabled, soundEnabled: row.sound_enabled, language: row.language } };
  },

  settings: async ({ ctx, method }) => {
    mustUse(method, ['GET']);
    const key = publicKey();
    return { preferences: await loadPreferences(ctx), pushAvailable: !!key, ...(key ? { publicKey: key } : {}) };
  },

  subscription: async ({ ctx, body, method }) => {
    mustUse(method, ['POST', 'DELETE']);
    const subscription = body.subscription;
    const endpoint = subscription?.endpoint;
    if (typeof endpoint !== 'string' || endpoint.length > 2048 || !/^https:\/\/[^\s]+$/.test(endpoint)) throw new ApiError(400, 'Invalid push subscription.');
    if (method === 'DELETE') {
      await ctx.rest(`mw_push_subscriptions?user_id=${eq(ctx.user.id)}&endpoint=${eq(endpoint)}`, { method: 'DELETE' });
      return { ok: true };
    }
    const { p256dh, auth } = subscription.keys || {};
    if (typeof p256dh !== 'string' || typeof auth !== 'string' || !p256dh || !auth || p256dh.length > 256 || auth.length > 256) throw new ApiError(400, 'Invalid push subscription.');
    await ctx.rest('mw_push_subscriptions?on_conflict=user_id,endpoint', { method: 'POST', body: { user_id: ctx.user.id, endpoint, p256dh, auth }, prefer: 'resolution=merge-duplicates' });
    return { ok: true };
  },

  'live-started': async ({ ctx, body, method }) => {
    mustUse(method, ['POST']);
    if (typeof body.room !== 'string' || !ROOM.test(body.room)) throw new ApiError(400, 'Invalid room.');
    const result = await ctx.rpc('mw_live_announce', { p_room: body.room });
    return { complete: result?.complete === true, notified: Number(result?.notified) || 0 };
  },
});
