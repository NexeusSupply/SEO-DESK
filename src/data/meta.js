// Facebook Pages and Instagram (professional accounts) through the Meta Graph API: followers, daily insights,
// recent posts, and a comments inbox the team can reply from. One System User token covers every brand; each
// Page's own token is fetched from it, and Instagram calls use the token of the Page it is linked to.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { db, tx, today, now, logJob } from '../db.js';

const DAY = 864e5;
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const unix = (d) => Math.floor(new Date(d).getTime() / 1000);

async function graph(path, { token = config.meta.token, params = {}, method = 'GET' } = {}) {
  const u = new URL(`${config.meta.graphUrl}/${config.meta.version}/${path.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  u.searchParams.set('access_token', token);
  if (config.meta.appSecret) u.searchParams.set('appsecret_proof', crypto.createHmac('sha256', config.meta.appSecret).update(token).digest('hex'));
  const r = await fetch(u, { method, signal: AbortSignal.timeout(30000) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) throw new Error(`Meta ${r.status} ${path}: ${body.error?.message || 'request failed'}`);
  return body;
}

// Page tokens don't change often; keep them for the life of the process.
const pageCache = new Map();
async function page(pageId) {
  if (!pageCache.has(pageId)) {
    const p = await graph(pageId, { params: { fields: 'id,name,access_token,followers_count,fan_count,instagram_business_account{id,username}' } });
    pageCache.set(pageId, p);
  }
  return pageCache.get(pageId);
}

/** Resolve the Page and Instagram account for a brand, with the token to use for each. */
async function accounts(site) {
  const out = {};
  if (site.meta.pageId) {
    const p = await page(site.meta.pageId);
    const token = p.access_token || config.meta.token;
    out.facebook = { id: p.id, name: p.name, token, followers: p.followers_count ?? p.fan_count ?? null };
    const igId = site.meta.instagramId || p.instagram_business_account?.id;
    if (igId) out.instagram = { id: igId, token };
  } else if (site.meta.instagramId) {
    out.instagram = { id: site.meta.instagramId, token: config.meta.token };
  }
  if (out.instagram) {
    const ig = await graph(out.instagram.id, { token: out.instagram.token, params: { fields: 'id,username,followers_count,media_count' } });
    Object.assign(out.instagram, { name: ig.username, username: ig.username, followers: ig.followers_count ?? null, posts: ig.media_count ?? null });
  }
  return out;
}

/** Every Page the token can see, with its linked Instagram account — use this to fill in sites.json. */
export async function listPages() {
  const out = []; let after;
  do {
    const r = await graph('me/accounts', { params: { fields: 'id,name,instagram_business_account{id,username}', limit: 100, after } });
    for (const p of r.data || []) out.push({ pageId: p.id, name: p.name, instagramId: p.instagram_business_account?.id || null, instagram: p.instagram_business_account?.username || null });
    after = r.paging?.next ? r.paging.cursors?.after : null;
  } while (after);
  return out;
}

// ---- Insights ----

// Page metrics have been renamed repeatedly (impressions became media views in 2025), so each is asked for on its
// own and one Meta has retired just goes missing rather than failing the sync.
const FB_METRICS = { page_media_view: 'views', page_total_media_view_unique: 'reach', page_post_engagements: 'engagements', page_daily_follows_unique: 'follows' };
const IG_TOTALS = { views: 'views', accounts_engaged: 'accounts_engaged', total_interactions: 'engagements', profile_links_taps: 'link_taps' };

async function facebookInsights(acct, days) {
  const out = []; // [date, metric, value]
  const since = unix(Date.now() - days * DAY), until = unix(Date.now());
  for (const [metric, name] of Object.entries(FB_METRICS)) {
    try {
      const r = await graph(`${acct.id}/insights`, { token: acct.token, params: { metric, period: 'day', since, until } });
      for (const s of r.data || []) for (const v of s.values || []) out.push([ymd(new Date(v.end_time).getTime() - DAY), name, Number(v.value) || 0]);
    } catch (e) { console.warn(`[meta] facebook ${metric}: ${e.message}`); }
  }
  return out;
}

async function instagramInsights(acct, days) {
  const out = [];
  // Reach is the one account metric still available as a daily series.
  try {
    const r = await graph(`${acct.id}/insights`, { token: acct.token, params: { metric: 'reach', period: 'day', since: unix(Date.now() - Math.min(days, 29) * DAY), until: unix(Date.now()) } });
    for (const s of r.data || []) for (const v of s.values || []) out.push([ymd(new Date(v.end_time).getTime() - DAY), 'reach', Number(v.value) || 0]);
  } catch (e) { console.warn(`[meta] instagram reach: ${e.message}`); }
  // The rest only come as totals, so ask one day at a time.
  for (let i = days; i >= 1; i--) {
    const start = new Date(ymd(Date.now() - i * DAY) + 'T00:00:00Z');
    try {
      const r = await graph(`${acct.id}/insights`, { token: acct.token, params: { metric: Object.keys(IG_TOTALS).join(','), period: 'day', metric_type: 'total_value', since: unix(start), until: unix(start.getTime() + DAY) } });
      for (const s of r.data || []) out.push([ymd(start), IG_TOTALS[s.name] || s.name, Number(s.total_value?.value) || 0]);
    } catch (e) { console.warn(`[meta] instagram totals ${ymd(start)}: ${e.message}`); break; }
  }
  return out;
}

// ---- Posts and comments ----

async function facebookPosts(acct) {
  const r = await graph(`${acct.id}/posts`, { token: acct.token, params: { limit: 25,
    fields: 'id,message,created_time,permalink_url,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)' } });
  return (r.data || []).map((p) => ({ id: p.id, createdAt: p.created_time, message: p.message || '', permalink: p.permalink_url, mediaType: p.status_type || null,
    likes: p.reactions?.summary?.total_count ?? null, comments: p.comments?.summary?.total_count ?? null, shares: p.shares?.count ?? 0 }));
}

async function instagramPosts(acct) {
  const r = await graph(`${acct.id}/media`, { token: acct.token, params: { limit: 25, fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count' } });
  return (r.data || []).map((p) => ({ id: p.id, createdAt: p.timestamp, message: p.caption || '', permalink: p.permalink, mediaType: p.media_type,
    likes: p.like_count ?? null, comments: p.comments_count ?? null, shares: null }));
}

async function facebookComments(acct, post) {
  const r = await graph(`${post.id}/comments`, { token: acct.token, params: { filter: 'toplevel', order: 'reverse_chronological', limit: 50,
    fields: 'id,from{id,name},message,created_time,permalink_url,is_hidden,comments.limit(25){from{id},message,created_time}' } });
  return (r.data || []).filter((c) => c.from?.id !== acct.id).map((c) => {
    const mine = (c.comments?.data || []).filter((x) => x.from?.id === acct.id).pop();
    // Without pages_read_user_content Meta leaves out who wrote it.
    return { id: c.id, postId: post.id, createdAt: c.created_time, author: c.from?.name || 'Facebook user', message: c.message || '', permalink: c.permalink_url || post.permalink,
      hidden: c.is_hidden ? 1 : 0, replied: mine ? 1 : 0, replyText: mine?.message ?? null, repliedAt: mine?.created_time ?? null };
  });
}

async function instagramComments(acct, post) {
  const r = await graph(`${post.id}/comments`, { token: acct.token, params: { limit: 50, fields: 'id,text,username,timestamp,hidden,replies{id,username,text,timestamp}' } });
  return (r.data || []).filter((c) => c.username !== acct.username).map((c) => {
    const mine = (c.replies?.data || []).filter((x) => x.username === acct.username).pop();
    return { id: c.id, postId: post.id, createdAt: c.timestamp, author: c.username ? `@${c.username}` : 'Instagram user', message: c.text || '', permalink: post.permalink,
      hidden: c.hidden ? 1 : 0, replied: mine ? 1 : 0, replyText: mine?.text ?? null, repliedAt: mine?.timestamp ?? null };
  });
}

const POSTS = { facebook: facebookPosts, instagram: instagramPosts };
const COMMENTS = { facebook: facebookComments, instagram: instagramComments };

function storeComments(site, platform, comments) {
  // A reply sent from SEO Desk keeps its "who replied" even after Meta reports it back on the next sync.
  const up = db.prepare(`INSERT INTO meta_comments (comment_id,site,platform,post_id,created_at,author,message,permalink,hidden,replied,reply_text,replied_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(comment_id) DO UPDATE SET author=excluded.author, message=excluded.message, hidden=excluded.hidden,
    replied=MAX(replied, excluded.replied), reply_text=COALESCE(excluded.reply_text, reply_text), replied_at=COALESCE(replied_at, excluded.replied_at)`);
  tx(() => { for (const c of comments) up.run(c.id, site.slug, platform, c.postId, c.createdAt, c.author, c.message, c.permalink, c.hidden, c.replied, c.replyText, c.repliedAt); });
}

/** Full daily sync: followers, insights, recent posts and their comments. */
export async function syncMeta(site) {
  if (!site.meta) return 'no meta pageId in sites.json';
  return logJob('meta', site.slug, async () => {
    const accts = await accounts(site);
    const parts = [];
    for (const [platform, acct] of Object.entries(accts)) {
      db.prepare('INSERT OR REPLACE INTO meta_snapshots (site,platform,fetched_on,account_id,name,followers,posts) VALUES (?,?,?,?,?,?,?)')
        .run(site.slug, platform, today(), acct.id, acct.name, acct.followers, acct.posts ?? null);
      const have = db.prepare('SELECT 1 FROM meta_daily WHERE site=? AND platform=? LIMIT 1').get(site.slug, platform);
      const days = have ? 3 : 28; // backfill on the first run, then just re-read the last few days (Meta revises them)
      const rows = await (platform === 'facebook' ? facebookInsights : instagramInsights)(acct, days);
      const up = db.prepare('INSERT OR REPLACE INTO meta_daily (site,platform,date,metric,value) VALUES (?,?,?,?,?)');
      tx(() => { for (const [date, metric, value] of rows) up.run(site.slug, platform, date, metric, value); });

      const posts = await POSTS[platform](acct);
      const upPost = db.prepare('INSERT OR REPLACE INTO meta_posts (post_id,site,platform,created_at,message,permalink,media_type,likes,comments,shares,fetched_on) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      tx(() => { for (const p of posts) upPost.run(p.id, site.slug, platform, p.createdAt, p.message, p.permalink, p.mediaType, p.likes, p.comments, p.shares, today()); });
      let n = 0;
      for (const p of posts.filter((p) => p.comments)) {
        try { const c = await COMMENTS[platform](acct, p); storeComments(site, platform, c); n += c.length; }
        catch (e) { console.warn(`[meta] ${platform} comments on ${p.id}: ${e.message}`); }
      }
      parts.push(`${platform}: ${acct.followers ?? '?'} followers, ${posts.length} posts, ${n} comments`);
    }
    return parts.join('; ') || 'no accounts found';
  });
}

/** Lighter, frequent pass: new comments on posts from the last 30 days. */
export async function syncMetaComments(site) {
  if (!site.meta) return 'no meta pageId in sites.json';
  const accts = await accounts(site);
  let n = 0;
  for (const [platform, acct] of Object.entries(accts)) {
    const posts = await POSTS[platform](acct);
    for (const p of posts.filter((p) => p.comments && new Date(p.createdAt) > Date.now() - 30 * DAY)) {
      const c = await COMMENTS[platform](acct, p); storeComments(site, platform, c); n += c.length;
    }
  }
  return `${n} comments`;
}

async function tokenFor(site, platform) {
  const a = await accounts(site);
  if (!a[platform]) throw new Error(`${site.name} has no ${platform} account connected`);
  return a[platform];
}

/** Reply publicly to a comment, as the Page / Instagram account. */
export async function replyToComment(site, commentId, message, user) {
  const c = db.prepare('SELECT * FROM meta_comments WHERE comment_id=? AND site=?').get(commentId, site.slug);
  if (!c) throw new Error('unknown comment');
  const acct = await tokenFor(site, c.platform);
  const r = c.platform === 'facebook'
    ? await graph(`${commentId}/comments`, { token: acct.token, method: 'POST', params: { message } })
    : await graph(`${commentId}/replies`, { token: acct.token, method: 'POST', params: { message } });
  db.prepare('UPDATE meta_comments SET replied=1, reply_text=?, replied_at=?, replied_by=? WHERE comment_id=?').run(message, now(), user || null, commentId);
  return { id: r.id };
}

/** Hide or unhide a comment (hidden comments stay visible to their author and friends, not the public). */
export async function hideComment(site, commentId, hidden) {
  const c = db.prepare('SELECT * FROM meta_comments WHERE comment_id=? AND site=?').get(commentId, site.slug);
  if (!c) throw new Error('unknown comment');
  const acct = await tokenFor(site, c.platform);
  await graph(commentId, { token: acct.token, method: 'POST', params: c.platform === 'facebook' ? { is_hidden: String(hidden) } : { hide: String(hidden) } });
  db.prepare('UPDATE meta_comments SET hidden=? WHERE comment_id=?').run(hidden ? 1 : 0, commentId);
  return { hidden };
}

/** Mark a comment as dealt with without replying publicly (answered by message, spam, a thank-you that needs nothing). */
export function markHandled(site, commentId, user) {
  const r = db.prepare("UPDATE meta_comments SET replied=1, replied_at=?, replied_by=? WHERE comment_id=? AND site=? AND replied=0").run(now(), `${user || 'someone'} (no reply)`, commentId, site.slug);
  if (!r.changes) throw new Error('unknown or already handled comment');
  return { handled: true };
}
