// MilkyWay social API: post details (place, tags, extra media), comment details (replies, tags, media), reposts.
// Everything runs as the signed-in user, so row-level security stays the final judge.
import { route, ApiError, requireUuid, isUuid, eq, inList } from './_lib/supa.js';

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

function cleanTags(value) {
  const seen = new Set();
  const tags = [];
  for (const tag of Array.isArray(value) ? value : []) {
    if (!isUuid(tag?.id) || seen.has(tag.id)) continue;
    seen.add(tag.id);
    tags.push({ id: tag.id, name: text(tag.name, 80), username: text(tag.username, 40).replace(/[^a-zA-Z0-9_.]/g, '') });
    if (tags.length >= 10) break;
  }
  return tags;
}

function cleanMedia(value, limit) {
  const media = [];
  for (const item of Array.isArray(value) ? value : []) {
    const url = text(item?.url, 1000);
    if (!/^https:\/\//i.test(url) || !['image', 'video'].includes(item?.type)) continue;
    const entry = { url, type: item.type, name: text(item.name, 120) };
    const path = text(item.path, 300);
    if (path) entry.path = path;
    media.push(entry);
    if (media.length >= limit) break;
  }
  return media;
}

const idList = (value, max) => [...new Set(String(value || '').split(',').map(id => id.trim()).filter(isUuid))].slice(0, max);

async function ownPost(ctx, postId) {
  const rows = await ctx.rest(`mw_posts?id=${eq(postId)}&select=id,author_id&limit=1`);
  if (!rows?.length) throw new ApiError(404, 'Post not found.');
  if (String(rows[0].author_id) !== ctx.user.id) throw new ApiError(403, 'Not allowed.');
}

export default route({
  // Details for the posts on screen: place, tagged people, extra media, and which of them are reposts.
  posts: {
    auth: false,
    run: async ({ ctx, query }) => {
      const ids = idList(query.ids, 60);
      if (!ids.length) return { posts: [], reposts: [] };
      const [extras, reposts] = await Promise.all([
        ctx.rest(`mw_post_extras?post_id=${inList(ids)}&select=post_id,location,tags,media&limit=60`),
        ctx.rest(`mw_reposts?post_id=${inList(ids)}&select=post_id,original_post_id,original_author_id,original_author_name&limit=60`),
      ]);
      return {
        posts: (extras || []).map(row => ({ postId: row.post_id, location: row.location || '', tags: row.tags || [], media: row.media || [] })),
        reposts: (reposts || []).map(row => ({ postId: row.post_id, originalPostId: row.original_post_id, originalAuthorId: row.original_author_id, originalAuthorName: row.original_author_name || '' })),
      };
    },
  },

  // Saves the place, tags and extra media of the caller's own post.
  post: async ({ ctx, query, body, method }) => {
    if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    const postId = requireUuid(query.id, 'post id');
    await ownPost(ctx, postId);
    await ctx.rest('mw_post_extras?on_conflict=post_id', {
      method: 'POST', prefer: 'resolution=merge-duplicates',
      body: { post_id: postId, owner_id: ctx.user.id, location: text(body.location, 120), tags: cleanTags(body.tags), media: cleanMedia(body.media, 10), updated_at: new Date().toISOString() },
    });
    return { ok: true };
  },

  // Reply, tag and media details for the comments of a post.
  comments: {
    auth: false,
    run: async ({ ctx, query }) => {
      const ids = idList(query.posts || query.post, 20);
      if (!ids.length) return { comments: [] };
      const rows = await ctx.rest(`mw_comment_extras?post_id=${inList(ids)}&select=comment_id,post_id,parent_id,tags,media&limit=1000`);
      return { comments: (rows || []).map(row => ({ commentId: row.comment_id, postId: row.post_id, parentId: row.parent_id || null, tags: row.tags || [], media: row.media || [] })) };
    },
  },

  // POST saves reply/tag/media details of the caller's own comment; DELETE removes them.
  comment: async ({ ctx, query, body, method }) => {
    const commentId = requireUuid(query.id, 'comment id');
    if (method === 'DELETE') {
      await ctx.rest(`mw_comment_extras?comment_id=${eq(commentId)}&owner_id=${eq(ctx.user.id)}`, { method: 'DELETE' });
      return { ok: true };
    }
    if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    const rows = await ctx.rest(`mw_echoes?id=${eq(commentId)}&select=id,post_id,user_id&limit=1`);
    if (!rows?.length) throw new ApiError(404, 'Comment not found.');
    if (String(rows[0].user_id) !== ctx.user.id) throw new ApiError(403, 'Not allowed.');
    let parentId = null;
    if (body.parentId) {
      parentId = requireUuid(body.parentId, 'parent id');
      if (parentId === commentId) throw new ApiError(400, 'Invalid parent id.');
      const parent = await ctx.rest(`mw_echoes?id=${eq(parentId)}&select=id,post_id&limit=1`);
      if (!parent?.length || parent[0].post_id !== rows[0].post_id) throw new ApiError(400, 'Invalid parent id.');
    }
    await ctx.rest('mw_comment_extras?on_conflict=comment_id', {
      method: 'POST', prefer: 'resolution=merge-duplicates',
      body: { comment_id: commentId, post_id: rows[0].post_id, owner_id: ctx.user.id, parent_id: parentId, tags: cleanTags(body.tags), media: cleanMedia(body.media, 4), updated_at: new Date().toISOString() },
    });
    return { ok: true };
  },

  // One-tap repost. A second repost of the same post answers 409.
  repost: async ({ ctx, query, method }) => {
    if (method !== 'POST') throw new ApiError(405, 'Method not allowed.');
    const postId = requireUuid(query.id, 'post id');
    const id = await ctx.rpc('mw_repost', { p_post: postId });
    return { ok: true, id };
  },
});
