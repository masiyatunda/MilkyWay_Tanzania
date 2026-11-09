// MilkyWay gallery API: post audiences (Public / Followers only / Only me), post documents and the profile gallery.
// Runs as the signed-in user; row-level security, SECURITY DEFINER functions and storage policies decide access.
import { route, authenticate, ApiError, SUPABASE, requireUuid, isUuid, eq, inList } from './_lib/supa.js';
import { randomUUID } from 'node:crypto';

const BUCKET = 'mw-documents';
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES_PER_POST = 10;
const MIME = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv',
};
const KEY = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,200}$/i;

const idList = (value, max) => [...new Set(String(value || '').split(',').map(id => id.trim()).filter(isUuid))].slice(0, max);
const fileRow = row => ({ id: row.id, postId: row.post_id, key: row.key, name: row.name, size: Number(row.size) || 0, mime: row.mime, createdAt: row.created_at });
const FILE_COLUMNS = 'id,post_id,key,name,size,mime,created_at';

async function removeObjects(ctx, keys) {
  if (!keys.length) return;
  await fetch(`${SUPABASE}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: keys }), signal: AbortSignal.timeout(15000),
  }).catch(() => {});
}

const table = route({
  // Which of the given posts are hidden from the caller, and the caller's own audiences.
  audiences: {
    auth: false,
    run: async ({ ctx, query }) => {
      const ids = idList(query.ids, 100);
      if (!ids.length) return { private: [], own: {} };
      const rows = (await ctx.rpc('mw_post_audiences', { p_ids: ids })) || [];
      const me = ctx.user?.id;
      const own = {};
      for (const id of ids) own[id] = 'everyone';
      for (const row of rows) if (me && row.owner_id === me) own[row.post_id] = row.audience;
      return { private: rows.filter(row => !row.can_see).map(row => ({ postId: row.post_id, ownerId: row.owner_id })), own };
    },
  },

  // Sets who can see the caller's post: everyone, followers or only_me.
  audience: async ({ ctx, query, body, method }) => {
    if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    const postId = requireUuid(query.id, 'post id');
    const audience = String(body.audience || '');
    if (!['everyone', 'followers', 'only_me'].includes(audience)) throw new ApiError(400, 'Invalid audience.');
    await ctx.rpc('mw_set_post_audience', { p_post: postId, p_audience: audience });
    return { ok: true, audience };
  },

  // DELETE: forgets the documents attached to the caller's post.
  post: async ({ ctx, query, method }) => {
    if (method !== 'DELETE') throw new ApiError(405, 'Method not allowed.');
    const postId = requireUuid(query.id, 'post id');
    const rows = await ctx.rest(`mw_post_files?post_id=${eq(postId)}&owner_id=${eq(ctx.user.id)}&select=key&limit=100`);
    await ctx.rest(`mw_post_files?post_id=${eq(postId)}&owner_id=${eq(ctx.user.id)}`, { method: 'DELETE' });
    await removeObjects(ctx, (rows || []).map(row => row.key));
    return { ok: true };
  },

  // Documents attached to the given posts.
  files: {
    auth: false,
    run: async ({ ctx, query }) => {
      const ids = idList(query.ids, 60);
      if (!ids.length) return { files: [] };
      const rows = await ctx.rest(`mw_post_files?post_id=${inList(ids)}&select=${FILE_COLUMNS}&order=created_at&limit=300`);
      return { files: (rows || []).map(fileRow) };
    },
  },

  // The documents and audiences behind a profile gallery. `mine` tells the UI the caller owns this gallery.
  gallery: {
    auth: false,
    run: async ({ ctx, query }) => {
      const owner = requireUuid(query.owner, 'owner');
      const mine = !!ctx.user && ctx.user.id === owner;
      const [files, audiences] = await Promise.all([
        ctx.rest(`mw_post_files?owner_id=${eq(owner)}&select=${FILE_COLUMNS}&order=created_at.desc&limit=200`),
        mine ? ctx.rpc('mw_owner_audiences', { p_owner: owner }) : Promise.resolve([]),
      ]);
      const map = {};
      for (const row of audiences || []) map[row.post_id] = row.audience;
      return {
        mine,
        private: Object.keys(map).filter(id => map[id] === 'only_me'),
        ...(mine ? { audiences: map } : {}),
        files: (files || []).map(fileRow),
      };
    },
  },
});

async function readBody(request, limit) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) throw new ApiError(413, 'File is too large (20 MB maximum).');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Extracts the "file" part of a multipart/form-data body.
function parseFile(buffer, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!boundary) throw new ApiError(400, 'Invalid upload.');
  const marker = Buffer.from(`--${boundary[1] || boundary[2]}`);
  let start = buffer.indexOf(marker);
  while (start !== -1) {
    const headerStart = start + marker.length + 2;
    const headerEnd = buffer.indexOf('\r\n\r\n', headerStart);
    if (headerEnd === -1) break;
    const headers = buffer.subarray(headerStart, headerEnd).toString('utf8');
    const next = buffer.indexOf(Buffer.concat([Buffer.from('\r\n'), marker]), headerEnd + 4);
    if (next === -1) break;
    if (/name="file"/i.test(headers)) {
      const name = /filename="([^"]*)"/i.exec(headers)?.[1] || '';
      return { name, data: buffer.subarray(headerEnd + 4, next) };
    }
    start = next + 2;
  }
  throw new ApiError(400, 'No file received.');
}

async function upload(request, response) {
  const ctx = await authenticate(request, response);
  if (!ctx) return;
  try {
    if (request.method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    const postId = requireUuid(String(request.query?.post || ''), 'post id');
    const declared = Number(request.headers['content-length']);
    if (declared > MAX_BYTES + 4096) throw new ApiError(413, 'File is too large (20 MB maximum).');
    const { name: rawName, data } = parseFile(await readBody(request, MAX_BYTES + 4096), request.headers['content-type']);
    const name = rawName.replace(/[\u0000-\u001f\u007f\\/]/g, ' ').trim().slice(-180);
    const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (!MIME[extension]) throw new ApiError(400, 'This file type is not supported.');
    if (!data.length) throw new ApiError(400, 'The file is empty.');
    if (data.length > MAX_BYTES) throw new ApiError(413, 'File is too large (20 MB maximum).');

    const post = await ctx.rest(`mw_posts?id=${eq(postId)}&select=author_id&limit=1`);
    if (post?.length && String(post[0].author_id) !== ctx.user.id) throw new ApiError(403, 'Not allowed.');
    const existing = await ctx.rest(`mw_post_files?post_id=${eq(postId)}&owner_id=${eq(ctx.user.id)}&select=id&limit=${MAX_FILES_PER_POST}`);
    if ((existing || []).length >= MAX_FILES_PER_POST) throw new ApiError(400, 'Too many documents on this post.');

    const key = `${ctx.user.id}/${postId}/${randomUUID().slice(0, 8)}-${name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || `file.${extension}`}`;
    const stored = await fetch(`${SUPABASE}/storage/v1/object/${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', body: data, signal: AbortSignal.timeout(60000),
      headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.token}`, 'Content-Type': MIME[extension], 'x-upsert': 'false' },
    }).catch(() => null);
    if (!stored) throw new ApiError(503, 'Storage unavailable.');
    if (!stored.ok) throw new ApiError(stored.status === 403 || stored.status === 401 ? 403 : 503, stored.status === 403 || stored.status === 401 ? 'Not allowed.' : 'Upload failed.');
    let rows;
    try {
      rows = await ctx.rest('mw_post_files', { method: 'POST', returning: true, body: { post_id: postId, owner_id: ctx.user.id, name, size: data.length, mime: MIME[extension], key } });
    } catch (error) { await removeObjects(ctx, [key]); throw error; }
    response.status(200).json(fileRow(rows[0]));
  } catch (error) {
    if (response.headersSent) return;
    if (error instanceof ApiError) return response.status(error.status).json({ error: error.message });
    response.status(500).json({ error: 'Service unavailable.' });
  }
}

async function download(request, response) {
  const ctx = await authenticate(request, response, { optional: true });
  if (!ctx) return;
  try {
    const key = String(request.query?.key || '');
    if (!KEY.test(key)) throw new ApiError(400, 'Invalid file.');
    const rows = await ctx.rest(`mw_post_files?key=${eq(key)}&select=name,mime&limit=1`);
    if (!rows?.length) throw new ApiError(404, 'File not found.');
    const stored = await fetch(`${SUPABASE}/storage/v1/object/${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`, {
      headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.token || ctx.key}` }, signal: AbortSignal.timeout(60000),
    }).catch(() => null);
    if (!stored) throw new ApiError(503, 'Storage unavailable.');
    if (!stored.ok) throw new ApiError(stored.status === 404 ? 404 : 503, stored.status === 404 ? 'File not found.' : 'Download failed.');
    const safeName = String(rows[0].name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    response.setHeader('Content-Type', rows[0].mime || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(rows[0].name)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.status(200).send(Buffer.from(await stored.arrayBuffer()));
  } catch (error) {
    if (response.headersSent) return;
    if (error instanceof ApiError) return response.status(error.status).json({ error: error.message });
    response.status(500).json({ error: 'Service unavailable.' });
  }
}

export default async function handler(request, response) {
  const action = String(request.query?.action || '').toLowerCase();
  if (action === 'upload') return upload(request, response);
  if (action === 'file') return download(request, response);
  return table(request, response);
}
