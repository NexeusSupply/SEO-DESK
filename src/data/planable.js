// Planable (planable.io), where the group schedules its social posts. Its Public API gives follower and engagement
// figures for every channel connected there (Facebook, Instagram, LinkedIn, TikTok, YouTube, Threads, X and Google
// Business Profile), recent posts with their metrics, and lets us create draft posts. It has no comments inbox and no
// webhooks, so we poll once a day. One company API token covers every brand; a brand opts in with
// "planable": { "workspaceId": "..." } in sites.json, optionally narrowed to some "pageIds".
//
// Planable's figures go into the same tables as the Meta Graph sync (meta_snapshots, meta_daily, meta_posts), keyed
// by platform, so the Social section shows both. When a brand also has Meta connected directly, Meta keeps Facebook
// and Instagram (it has the comments) and Planable fills in the other channels.
import { config } from '../config.js';
import { db, tx, today, logJob } from '../db.js';

const DAY = 864e5;
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

db.exec(`
CREATE TABLE IF NOT EXISTS planable_pages (
  page_id TEXT PRIMARY KEY, site TEXT, workspace_id TEXT, platform TEXT, name TEXT, link TEXT, picture TEXT, connected INTEGER, fetched_on TEXT
);
`);

async function api(path, { method = 'GET', params = {}, body } = {}) {
  const u = new URL(`${config.planable.apiUrl}/${path.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  const r = await fetch(u, {
    method, signal: AbortSignal.timeout(30000),
    headers: { authorization: `Bearer ${config.planable.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Planable ${r.status} ${path}: ${out.error?.message || out.error?.code || 'request failed'}`);
  return out;
}

/** Every item of an offset-paginated list ({ data, pagination: { hasMore } }), up to max. */
async function all(path, params = {}, { limit = 50, max = 1000 } = {}) {
  const out = [];
  for (let offset = 0; out.length < max; offset += limit) {
    const r = await api(path, { params: { ...params, offset, limit } });
    out.push(...(r.data || []));
    if (!r.pagination?.hasMore || !r.data?.length) break;
  }
  return out;
}

// Planable's platform names aren't a fixed list in its spec, so normalise the likely spellings.
const PLATFORMS = { facebook: 'facebook', instagram: 'instagram', linkedin: 'linkedin', tiktok: 'tiktok', youtube: 'youtube', threads: 'threads',
  twitter: 'x', x: 'x', googlemybusiness: 'google', google_my_business: 'google', gmb: 'google', google: 'google', googlebusiness: 'google', pinterest: 'pinterest', bluesky: 'bluesky' };
export const platformOf = (p) => PLATFORMS[String(p || '').toLowerCase().replace(/[\s-]/g, '')] || String(p || 'other').toLowerCase();
// The key each platform's figures sit under in a metrics snapshot.
const METRIC_KEY = { facebook: 'facebook', instagram: 'instagram', linkedin: 'linkedin', tiktok: 'tiktok', youtube: 'youtube', threads: 'threads', x: 'twitter', google: 'googleMyBusiness' };

/** Every channel connected in Planable, across all workspaces — use this to fill in sites.json. */
export async function listPages() {
  const pages = await all('pages', {}, { limit: 100 });
  return pages.map((p) => ({ pageId: p.id, workspaceId: p.workspaceId, platform: platformOf(p.platform), name: p.name, link: p.link, connected: p.isConnected }));
}

/** The Planable channels that belong to a brand. */
async function brandPages(site) {
  const pages = await all('pages', { workspaceId: site.planable.workspaceId }, { limit: 100 });
  return pages.filter((p) => !site.planable.pageIds?.length || site.planable.pageIds.includes(p.id));
}

// ---- Turning a metrics snapshot into our figures ----

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const first = (...v) => v.map(num).find((x) => x != null) ?? null;

/** Total followers (or subscribers) on the account, where the platform reports one. */
function followersOf(platform, m) {
  if (!m) return null;
  if (platform === 'tiktok') return first(m.followers_count);
  if (platform === 'youtube') return first(m.totalSubscribers, m.subscribers);
  return first(m.totalFollowers, m.followers);
}

/** The daily figures we chart: views, reach, engagements, new followers, and the Google listing's actions. */
function dailyOf(platform, m) {
  if (!m) return {};
  const out = {
    views: platform === 'tiktok' ? first(m.video_views) : platform === 'linkedin' || platform === 'x' || platform === 'google' ? first(m.impressions) : first(m.views, m.impressions),
    reach: first(m.reach),
    engagements: platform === 'threads' ? ['likes', 'replies', 'reposts', 'quotes'].reduce((a, k) => a + (num(m[k]) || 0), 0) : first(m.engagement),
    follows: platform === 'youtube' ? first(m.subscribersGained) : first(m.gainedFollowers),
  };
  if (platform === 'google') Object.assign(out, { calls: first(m.callClicks), website_clicks: first(m.websiteClicks), directions: first(m.businessDirectionRequests) });
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null));
}

// ---- Sync ----

/** Is this platform for this brand covered by the direct Meta sync instead (it has the comments inbox)? */
const metaCovers = (site, platform) => config.meta.enabled && Boolean(site.meta) && (platform === 'facebook' || platform === 'instagram');

/** Daily: the brand's Planable channels, their figures, and recent posts with metrics. */
export async function syncPlanable(site) {
  if (!site.planable) return 'no planable workspaceId in sites.json';
  return logJob('planable', site.slug, async () => {
    const pages = await brandPages(site);
    const upPage = db.prepare('INSERT OR REPLACE INTO planable_pages (page_id,site,workspace_id,platform,name,link,picture,connected,fetched_on) VALUES (?,?,?,?,?,?,?,?,?)');
    tx(() => {
      db.prepare('DELETE FROM planable_pages WHERE site=?').run(site.slug);
      for (const p of pages) upPage.run(p.id, site.slug, p.workspaceId, platformOf(p.platform), p.name, p.link, p.profilePicture, p.isConnected ? 1 : 0, today());
    });

    // A brand can have more than one channel on a platform (two LinkedIn pages, say); their figures are added together.
    const byPlatform = {};
    const parts = [];
    for (const p of pages.filter((x) => x.isConnected !== false)) {
      const platform = platformOf(p.platform);
      if (metaCovers(site, platform)) continue;
      const agg = (byPlatform[platform] ||= { names: [], followers: null, daily: {}, posts: 0, ids: [] });
      agg.names.push(p.name); agg.ids.push(p.id);

      const have = db.prepare('SELECT 1 FROM meta_daily WHERE site=? AND platform=? LIMIT 1').get(site.slug, platform);
      const days = have ? 7 : 90; // backfill on the first run, then re-read the last week (platforms revise recent days)
      let snaps = [];
      try {
        snaps = await all(`pages/${p.id}/metrics`, { startDate: new Date(Date.now() - days * DAY).toISOString(), endDate: new Date().toISOString() }, { limit: 90, max: 500 });
      } catch (e) { console.warn(`[planable] ${site.slug} ${p.name} metrics: ${e.message}`); }
      // Oldest first, so when one day has several snapshots the latest wins.
      snaps.sort((a, b) => String(a.fetchedAt).localeCompare(String(b.fetchedAt)));
      let followers = null;
      for (const s of snaps) {
        const m = s[METRIC_KEY[platform]] || s[platform];
        const date = ymd(s.fetchedAt);
        followers = followersOf(platform, m) ?? followers;
        const day = (agg.daily[date] ||= {});
        for (const [k, v] of Object.entries(dailyOf(platform, m))) day[`${p.id}|${k}`] = v;
      }
      if (followers != null) agg.followers = (agg.followers ?? 0) + followers;
      agg.posts += await syncPosts(site, p, platform);
    }

    const upSnap = db.prepare('INSERT OR REPLACE INTO meta_snapshots (site,platform,fetched_on,account_id,name,followers,posts) VALUES (?,?,?,?,?,?,?)');
    const upDaily = db.prepare('INSERT OR REPLACE INTO meta_daily (site,platform,date,metric,value) VALUES (?,?,?,?,?)');
    tx(() => {
      for (const [platform, a] of Object.entries(byPlatform)) {
        upSnap.run(site.slug, platform, today(), `planable:${a.ids.join(',')}`, a.names.join(', '), a.followers, null);
        for (const [date, vals] of Object.entries(a.daily)) {
          const sums = {};
          for (const [key, v] of Object.entries(vals)) { const metric = key.split('|')[1]; sums[metric] = (sums[metric] || 0) + v; }
          for (const [metric, v] of Object.entries(sums)) upDaily.run(site.slug, platform, date, metric, Math.round(v));
        }
        parts.push(`${platform}: ${a.followers != null ? `${a.followers} followers, ` : ''}${Object.keys(a.daily).length} days, ${a.posts} posts`);
      }
    });
    const skipped = pages.filter((p) => metaCovers(site, platformOf(p.platform))).length;
    return (parts.join('; ') || 'no connected channels in this workspace') + (skipped ? ` (Facebook/Instagram from Meta)` : '');
  });
}

/** Published posts from the last 60 days on one channel, with each one's latest metrics. */
async function syncPosts(site, page, platform) {
  let posts;
  try {
    posts = await all('posts', { workspaceId: page.workspaceId, pageId: page.id, createdAfter: new Date(Date.now() - 60 * DAY).toISOString() }, { limit: 50, max: 200 });
  } catch (e) { console.warn(`[planable] ${site.slug} ${page.name} posts: ${e.message}`); return 0; }
  const published = posts.filter((p) => p.published || p.publishedPostLink || String(p.status).toLowerCase() === 'published')
    .sort((a, b) => String(b.scheduledAt || b.createdAt).localeCompare(String(a.scheduledAt || a.createdAt))).slice(0, 25);
  const up = db.prepare('INSERT OR REPLACE INTO meta_posts (post_id,site,platform,created_at,message,permalink,media_type,likes,comments,shares,fetched_on) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const rows = [];
  for (const p of published) {
    let m = null;
    try { m = (await api(`posts/${p.id}/metrics`)).data; } catch (e) { if (!/ 404 /.test(e.message)) console.warn(`[planable] post ${p.id} metrics: ${e.message}`); }
    const own = m?.[METRIC_KEY[platform]] || {};
    rows.push([`planable:${p.id}`, site.slug, platform, p.scheduledAt || p.createdAt, p.plainText || '', p.publishedPostLink || null, p.mediaType || p.classification || null,
      first(m?.reactions, own.likes, own.reactions), first(own.comments, own.replies), first(own.shares, own.reposts, own.reshares), today()]);
  }
  tx(() => { for (const r of rows) up.run(...r); });
  return rows.length;
}

// ---- Drafting posts ----

/** The brand's channels from the last sync, for the "Draft a post" form. */
export function savedPages(site) {
  return db.prepare('SELECT page_id id, platform, name, link FROM planable_pages WHERE site=? AND connected=1 ORDER BY platform, name').all(site.slug);
}

/**
 * Create a draft post in the brand's Planable workspace. Several channels make one grouped post. It is never marked
 * approved, so it waits in Planable for the team's normal review and scheduling.
 */
export async function createDraft(site, { text, pageIds, user }) {
  if (!site.planable) throw new Error(`${site.name} isn't linked to a Planable workspace`);
  const mine = new Set(savedPages(site).map((p) => p.id));
  const ids = [...new Set(pageIds || [])].filter((id) => mine.has(id));
  if (!ids.length) throw new Error('pick at least one channel');
  if (!text?.trim()) throw new Error('the post is empty');
  const body = { workspaceId: site.planable.workspaceId, text: text.trim(), internalNote: `Drafted in SEO Desk${user ? ` by ${user}` : ''}.`, notify: true,
    ...(ids.length === 1 ? { pageId: ids[0] } : { pageIds: ids }) };
  const r = await api('posts', { method: 'POST', body });
  return { created: (r.posts || []).length || ids.length, workspaceId: site.planable.workspaceId };
}
