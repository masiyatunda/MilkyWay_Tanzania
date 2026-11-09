// Cloudflare Pages Function: serves every api/<name>.js handler at /api/<name>, exactly like server.js does on Render.
// The handlers are written for Express (req, res), so this file adapts the Fetch Request/Response to that shape.
// Requires the nodejs_compat flag (see wrangler.toml) for process.env, Buffer and node:crypto.
import account from '../../api/milkyway-account.js';
import call from '../../api/milkyway-call.js';
import discovery from '../../api/milkyway-discovery.js';
import gallery from '../../api/milkyway-gallery.js';
import groups from '../../api/milkyway-groups.js';
import health from '../../api/milkyway-health.js';
import liveRoom from '../../api/milkyway-live-room.js';
import livekitToken from '../../api/milkyway-livekit-token.js';
import mediaAuthorize from '../../api/milkyway-media-authorize.js';
import message from '../../api/milkyway-message.js';
import notifications from '../../api/milkyway-notifications.js';
import social from '../../api/milkyway-social.js';
import wallet from '../../api/milkyway-wallet.js';

const handlers = {
  'milkyway-account': account,
  'milkyway-call': call,
  'milkyway-discovery': discovery,
  'milkyway-gallery': gallery,
  'milkyway-groups': groups,
  'milkyway-health': health,
  'milkyway-live-room': liveRoom,
  'milkyway-livekit-token': livekitToken,
  'milkyway-media-authorize': mediaAuthorize,
  'milkyway-message': message,
  'milkyway-notifications': notifications,
  'milkyway-social': social,
  'milkyway-wallet': wallet,
};

const JSON_LIMIT = 16 * 1024;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function makeResponse() {
  const state = { status: 200, headers: new Headers(), body: null, sent: false };
  const finish = body => {
    if (!state.sent) { state.sent = true;state.body = body; }
    return res;
  };
  const res = {
    get headersSent() { return state.sent; },
    status(code) { state.status = code; return res; },
    setHeader(name, value) { state.headers.set(name, String(value)); return res; },
    json(value) { state.headers.set('Content-Type', 'application/json'); return finish(JSON.stringify(value)); },
    send(value) { return finish(value ?? null); },
    end(value) { return finish(value ?? null); },
    redirect(code, location) { state.status = code; state.headers.set('Location', location); return finish(null); },
  };
  return { res, state };
}

export async function onRequest({ request, params }) {
  const handler = handlers[params.name];
  if (!handler) return json(404, { error: 'Not found.' });

  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers);
  const query = Object.fromEntries(url.searchParams);
  let body;
  let raw = null;
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    if (/\bjson\b/i.test(headers['content-type'] || '')) {
      const text = await request.text();
      if (text.length > JSON_LIMIT) return json(413, { error: 'Request too large.' });
      try { body = text ? JSON.parse(text) : undefined; } catch { return json(400, { error: 'Invalid request body.' }); }
    } else {
      raw = request.body;
    }
  }

  const { res, state } = makeResponse();
  const req = {
    method: request.method, headers, query, body, res, url: url.pathname + url.search,
    // Multipart uploads read the raw body as a stream, as with a Node request.
    async *[Symbol.asyncIterator]() { if (raw) for await (const chunk of raw) yield chunk; },
  };
  try {
    await handler(req, res);
  } catch (error) {
    console.error(`[api/${params.name}] unhandled error`, error);
  }
  if (!state.sent) return json(500, { error: 'Service unavailable.' });
  return new Response(request.method === 'HEAD' ? null : state.body, { status: state.status, headers: state.headers });
}
