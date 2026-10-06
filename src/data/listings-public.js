// Clinic listings and reviews from the public Google listing via DataForSEO, for clinics the Business Profile API
// doesn't cover (no API approval yet, or no gbpLocationId). Writes the same gbp_snapshots / gbp_reviews tables, so the
// dashboard doesn't care which source a clinic came from. Performance stats (views, calls, directions) are API-only.
import { config } from '../config.js';
import { db, tx, today, logJob } from '../db.js';
import { businessInfo, postReviewTasks, reviewTasksReady, getReviewTask, recordSpend, underCap } from './dataforseo.js';

const INFO_COST_EST = 0.006;   // USD per live listing lookup, for the pre-flight cap check only
const REVIEWS_COST_EST = 0.004; // USD per reviews task at REVIEWS_DEPTH
const REVIEWS_DEPTH = 50;
const STATUS = { closed_forever: 'CLOSED_PERMANENTLY', temporarily_closed: 'CLOSED_TEMPORARILY' };

/** Locations this source handles: not covered by the API, and identifiable by place_id, cid or name plus coordinates. */
export const publicLocations = (site) => site.locations.filter((l) => !(config.gbp.enabled && l.gbpLocationId)
  && (l.placeId || l.cid || (l.lat != null && l.lng != null)));

/** Weekly: refresh each listing's public details and queue a fetch of its newest reviews. */
export async function syncPublicListings(site) {
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  const recent = new Set(db.prepare("SELECT location FROM gbp_snapshots WHERE site=? AND fetched_on >= date('now','-6 days')").all(site.slug).map((r) => r.location));
  const locs = publicLocations(site).filter((l) => !recent.has(l.slug));
  if (!locs.length) return publicLocations(site).length ? 'listings already refreshed this week' : 'no locations with placeId, cid or lat/lng';
  if (!underCap(locs.length * (INFO_COST_EST + REVIEWS_COST_EST))) return `skipped: monthly DataForSEO cap (US$${config.dfs.monthlyCapUsd}) would be exceeded`;
  return logJob('listings-public', site.slug, async () => {
    const snap = db.prepare(`INSERT OR REPLACE INTO gbp_snapshots (site,location,fetched_on,title,address,phone,website,primary_category,rating,review_count,photo_count,has_hours,has_description,completeness,open_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let n = 0, cost = 0; const found = [];
    for (const loc of locs) {
      try {
        const { info: i, cost: c } = await businessInfo(loc); cost += c;
        if (!i) { console.warn(`[listings:${loc.slug}] no listing found for ${loc.placeId || loc.cid || loc.name}`); continue; }
        if (!loc.placeId && !loc.cid) found.push(`${loc.slug} → placeId ${i.placeId}`);
        const fields = [i.title, i.address, i.phone, i.website, i.category, i.hasHours, i.description, (i.photoCount ?? 1) > 0];
        snap.run(site.slug, loc.slug, today(), i.title, i.address, i.phone, i.website, i.category, i.rating, i.reviewCount, i.photoCount,
          i.hasHours ? 1 : 0, i.description ? 1 : 0, Math.round(fields.filter(Boolean).length / fields.length * 100), STATUS[i.status] || 'OPEN');
        n++;
      } catch (e) { console.warn(`[listings:${loc.slug}] ${e.message}`); }
    }
    recordSpend('business-info', cost, locs.length);
    const posted = await postReviewTasks(locs.map((loc) => ({ loc, depth: REVIEWS_DEPTH, tag: `${site.slug}|${loc.slug}` })));
    const ins = db.prepare('INSERT OR REPLACE INTO dfs_tasks (task_id,kind,site,location,keyword,posted_on,status,cost) VALUES (?,?,?,?,?,?,?,?)');
    let q = 0, qc = 0;
    for (const p of posted) {
      if (!p.ok) { console.warn(`[listings:${site.slug}] reviews task rejected: ${p.message}`); continue; }
      ins.run(p.task_id, 'reviews', site.slug, p.tag.split('|')[1], null, today(), 'posted', p.cost); q++; qc += p.cost;
    }
    recordSpend('reviews', qc, q);
    if (found.length) console.log(`[listings:${site.slug}] matched by name; add these to sites.json to pin them: ${found.join(', ')}`);
    return `${n} listings refreshed, ${q} review fetches queued (US$${(cost + qc).toFixed(3)})`;
  });
}

/** Collect finished review fetches. Safe to run as often as you like. */
export async function collectPublicReviews() {
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  const pending = db.prepare("SELECT * FROM dfs_tasks WHERE kind='reviews' AND status='posted'").all();
  if (!pending.length) return 'no reviews pending';
  const ready = new Set(await reviewTasksReady());
  const up = db.prepare('INSERT OR REPLACE INTO gbp_reviews (site,location,review_id,created_at,rating,reviewer,comment,replied) VALUES (?,?,?,?,?,?,?,?)');
  const done = db.prepare('UPDATE dfs_tasks SET status=?, cost=cost+? WHERE task_id=?');
  let n = 0, nRev = 0;
  for (const t of pending) {
    if (!ready.has(t.task_id)) continue;
    try {
      const { items, cost } = await getReviewTask(t.task_id);
      tx(() => { for (const r of items) up.run(t.site, t.location, r.id, r.createdAt, r.rating, r.reviewer, r.comment, r.replied); });
      done.run('done', cost, t.task_id); recordSpend('reviews-get', cost, 1); n++; nRev += items.length;
    } catch (e) { console.warn(`[reviews-collect] ${t.task_id}: ${e.message}`); }
  }
  return `${n} review fetches collected (${nRev} reviews), ${pending.length - n} still pending`;
}
