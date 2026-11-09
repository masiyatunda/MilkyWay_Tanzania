import { AccessToken, RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';

const projectUrl = 'https://wpclkhgizbvxuvbhbwzs.supabase.co';
const serverUrl = 'wss://masiyatunda-milkyway-live-mgh6b1np.livekit.cloud';
const authorizationUrl = 'https://www.masiyatunda.com/api/milkyway-media-authorize';

export async function milkywayToken(request: Request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = !origin || /^https:\/\/(www\.)?masiyatunda\.com$/.test(origin) || /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):(8889|3000|10000)$/.test(origin);
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin', ...(origin && allowedOrigin ? { 'Access-Control-Allow-Origin': origin } : {}), 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
  const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify({ contractVersion: 2, ...body }), { status, headers });
  if (!allowedOrigin) return json({ error: 'Origin not allowed.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  const apiKey = Deno.env.get('LIVEKIT_API_KEY')?.trim();
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')?.trim();
  const configuredUrl = Deno.env.get('LIVEKIT_URL')?.trim();
  let validUrl = false;
  try { const address = new URL(configuredUrl || '');validUrl = address.origin === serverUrl && address.pathname === '/' && !address.username && !address.password && !address.search && !address.hash; } catch {}
  const available = !!apiKey && !!apiSecret && validUrl;
  if (request.method === 'GET') {
    if (!available) return json({ available: false, reason: configuredUrl && !validUrl ? 'configuration_invalid' : 'configuration_missing', service: 'supabase' });
    try {
      const service = new RoomServiceClient(serverUrl.replace('wss:', 'https:'), apiKey!, apiSecret!, { requestTimeout: 8, failover: false });
      await service.listRooms(['milkyway-health-probe']);
      return json({ available: true, reason: 'service_ready', service: 'supabase' });
    } catch (error) {
      const code = (error as { code?: string }).code;
      return json({ available: false, reason: ['unauthenticated', 'permission_denied'].includes(code || '') ? 'provider_authentication' : code === 'resource_exhausted' ? 'platform_restricted' : 'provider_unavailable', service: 'supabase' });
    }
  }
  if (!available) return json({ error: 'The Supabase Live service configuration is unavailable.' }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'Request too large.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid request.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400);
    const roomName = body.roomName || body.room;
    const { target } = body;
    const action = body.action || 'token';
    if (!['token', 'participants', 'sync', 'end', 'discovery'].includes(action)) return json({ error: 'Invalid room action.' }, 400);
    const authorization = request.headers.get('Authorization') || '';
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || request.headers.get('apikey') || '';
    if (!publishableKey) return json({ error: 'The account service is unavailable.' }, 503);
    const queryHeaders = { apikey: publishableKey, ...(authorization.startsWith('Bearer ') ? { Authorization: authorization } : {}) };
    const query = async (path: string) => {
      const response = await fetch(`${projectUrl}/${path}`, { headers: queryHeaders, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Object.assign(new Error('Account access denied'), { status: path === 'auth/v1/user' && [401, 403].includes(response.status) ? 401 : [401, 402, 403, 429].includes(response.status) ? response.status : 503 });
      return response.json();
    };
    const account = authorization.startsWith('Bearer ') ? await query('auth/v1/user') : null;
    if (action !== 'discovery' && !account?.id) return json({ error: 'Sign in first.' }, 401);
    const service = new RoomServiceClient(serverUrl.replace('wss:', 'https:'), apiKey!, apiSecret!, { requestTimeout: 8, failover: false });
    if (action === 'discovery') {
      const records = await query('rest/v1/mw_video_live_sessions?is_live=eq.true&select=id,room_name,host_id,host_name,title,scope,is_live,started_at&order=started_at.desc&limit=100');
      const follows = account ? await query(`rest/v1/mw_follows?follower_id=eq.${account.id}&select=following_id`) : [];
      const allowed = records.filter((record: { scope: string; host_id: string }) => ['public', 'everyone'].includes(record.scope) || record.host_id === account?.id || record.scope === 'followers' && follows.some((follow: { following_id: string }) => follow.following_id === record.host_id));
      if (!allowed.length) return json({ sessions: [] });
      const rooms = await service.listRooms(allowed.map((record: { room_name: string }) => record.room_name));
      const verified = await Promise.all(allowed.filter((record: { room_name: string }) => rooms.some(room => room.name === record.room_name)).map(async (record: { room_name: string; host_id: string }) => {
        const participants = await service.listParticipants(record.room_name).catch((error: { code?: string }) => { if (error.code === 'not_found') return [];throw error; });
        return participants.some(participant => participant.identity === record.host_id && participant.tracks.some(track => track.source === 1 || track.source === 2)) ? { ...record, connectedCount: participants.length } : null;
      }));
      return json({ sessions: verified.filter(Boolean) });
    }
    if (typeof roomName !== 'string' || !/^mw-[a-zA-Z0-9_-]{3,120}$/.test(roomName)) return json({ error: 'Invalid room name.' }, 400);
    if (!roomName.startsWith('mw-conversation-')) {
      if (action !== 'token' || !['host', 'viewer', 'call'].includes(body.role)) return json({ error: 'Invalid room action.' }, 400);
      if (body.identity !== account.id) return json({ error: 'Identity does not match the signed-in account.' }, 403);
      let canPublish = false;
      let audioOnly = roomName.startsWith('mw-audio-live-') || body.mode === 'audio';
      if (body.role === 'call') {
        if (!/^mw-call-[a-f0-9-]{36}$/i.test(roomName)) return json({ error: 'Invalid call room.' }, 400);
        const [call] = await query(`rest/v1/mw_dm_calls?id=eq.${roomName.slice(8)}&select=caller_id,callee_id,status,offer&limit=1`);
        if (!call || ![call.caller_id, call.callee_id].includes(account.id) || call.status !== 'accepted' || call.offer?.transport !== 'livekit') return json({ error: 'Only participants in an accepted call can join.' }, 403);
        canPublish = true;audioOnly = call.offer.mode !== 'video';
      } else {
        if (roomName.startsWith('mw-call-')) return json({ error: 'Call rooms require call authorization.' }, 403);
        const [record] = await query(`rest/v1/mw_video_live_sessions?room_name=eq.${encodeURIComponent(roomName)}&select=host_id,scope,is_live&limit=1`);
        if (!record?.is_live) return json({ error: 'This Live session is no longer available.' }, 404);
        if (body.role === 'host' && record.host_id !== account.id) return json({ error: 'Only the host can broadcast.' }, 403);
        if (record.scope === 'followers' && record.host_id !== account.id) {
          const follows = await query(`rest/v1/mw_follows?follower_id=eq.${account.id}&following_id=eq.${record.host_id}&select=follower_id&limit=1`);
          if (!follows.length) return json({ error: 'This session is for followers only.' }, 403);
        }
        canPublish = body.role === 'host' && record.host_id === account.id;
      }
      const token = new AccessToken(apiKey!, apiSecret!, { identity: account.id, name: String(body.name || 'MilkyWay user').slice(0, 80), ttl: '10m' });
      token.addGrant({ roomJoin: true, room: roomName, canSubscribe: true, canPublish, canPublishData: true, canPublishSources: canPublish ? audioOnly ? [2] : [1, 2] : [] });
      return json({ token: await token.toJwt(), serverUrl, roomName, room: roomName });
    }
    if (!/^mw-conversation-(audio|video)-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(roomName)) return json({ error: 'Invalid conversation room.' }, 400);
    if (action === 'sync' && (typeof target !== 'string' || !/^[a-f0-9-]{36}$/i.test(target))) return json({ error: 'Invalid participant.' }, 400);
    const response = await fetch(authorizationUrl, { method: 'POST', headers: { ...queryHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ roomName, action, target }), signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) return json({ error: 'Live room authorization was denied or unavailable.' }, [401, 403, 404].includes(response.status) ? response.status : 503);
    const grant = await response.json();
    if (grant.roomName !== roomName || action !== 'end' && (!grant.permissions || grant.identity !== (action === 'sync' ? target : account.id))) return json({ error: 'Invalid room authorization response.' }, 503);
    const permissions = action === 'end' ? null : { canSubscribe: true, canPublishData: false, canPublish: grant.permissions.canPublish === true, canPublishSources: grant.permissions.canPublishSources };
    if (permissions && (!Array.isArray(permissions.canPublishSources) || permissions.canPublishSources.some((source: number) => ![1, 2].includes(source)))) return json({ error: 'Invalid room media permissions.' }, 503);
    if (action === 'token') {
      const token = new AccessToken(apiKey!, apiSecret!, { identity: account.id, name: grant.name, metadata: JSON.stringify({ avatar: grant.avatar || '' }), ttl: '10m' });
      token.addGrant({ roomJoin: true, room: roomName, ...permissions });
      return json({ token: await token.toJwt(), serverUrl, roomName });
    }
    if (action === 'participants') {
      try {
        const participants = await service.listParticipants(roomName);
        return json({ participants: participants.map(participant => ({ identity: participant.identity, permission: participant.permission, tracks: (participant.tracks || []).map(track => ({ source: track.source, muted: track.muted })) })) });
      } catch (error) { if ((error as { code?: string }).code === 'not_found') return json({ participants: [] });throw error; }
    }
    if (action === 'end') {
      if (grant.hostId !== account.id) return json({ error: 'Only the host can end Live.' }, 403);
      try { await service.deleteRoom(roomName); } catch (error) { if ((error as { code?: string }).code !== 'not_found') throw error; }
    } else {
      try {
        if (grant.remove) await service.removeParticipant(roomName, target, { revokeTokenTs: BigInt(Math.ceil(Date.now() / 1000)) });
        else await service.updateParticipant(roomName, target, { permission: permissions! });
      } catch (error) { if ((error as { code?: string }).code !== 'not_found') throw error; }
    }
    return json({ ok: true });
  } catch (error) { return json({ error: 'The Live service could not complete this request. Check session access, deployment, and Supabase quota.' }, (error as { status?: number }).status || 503); }
}
