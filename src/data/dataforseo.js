// Thin client for the DataForSEO v3 REST API (live endpoints only — no callbacks needed).
import { config } from '../config.js';
import { db } from '../db.js';

const BASE = 'https://api.dataforseo.com/v3';

async function post(path, tasks) {
  if (!config.dfs.enabled) throw new Error('DataForSEO not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)');
  const auth = Buffer.from(`${config.dfs.login}:${config.dfs.password}`).toString('base64');
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(90000),
  });
  const json = await res.json();
  if (json.status_code !== 20000) throw new Error(`DataForSEO ${json.status_code}: ${json.status_message}`);
  return json.tasks.map((t) => {
    if (t.status_code !== 20000) throw new Error(`DataForSEO task ${t.status_code}: ${t.status_message}`);
    return t.result?.[0] ?? null;
  });
}

const loc = () => ({ location_code: config.dfs.location, language_code: config.dfs.language });

/** Google organic SERP for one keyword. Returns [{position, domain, url, title}] for organic results. */
export async function serp(keyword, depth = 50) {
  const [r] = await post('/serp/google/organic/live/regular', [{ keyword, depth, device: 'desktop', ...loc() }]);
  return (r?.items || []).filter((i) => i.type === 'organic').map((i) => ({
    position: i.rank_group, domain: (i.domain || '').replace(/^www\./, ''), url: i.url, title: i.title,
  }));
}

/** Volume / CPC / competition for up to 1000 keywords (Google Ads data). */
export async function searchVolume(keywords) {
  if (!keywords.length) return [];
  const [r] = await post('/keywords_data/google_ads/search_volume/live', [{ keywords, ...loc() }]);
  return (r ? [r] : []).flatMap((x) => x.items || x).map((k) => ({
    keyword: k.keyword, volume: k.search_volume ?? 0, cpc: k.cpc ?? 0, competition: k.competition_index ?? null,
  }));
}

/** Keyword difficulty (0-100) for up to 1000 keywords. */
export async function keywordDifficulty(keywords) {
  if (!keywords.length) return [];
  const [r] = await post('/dataforseo_labs/google/bulk_keyword_difficulty/live', [{ keywords, ...loc() }]);
  return (r?.items || []).map((k) => ({ keyword: k.keyword, difficulty: k.keyword_difficulty ?? null }));
}

/** Organic keywords a domain ranks for, ordered by traffic value. */
export async function rankedKeywords(domain, limit = 200) {
  const [r] = await post('/dataforseo_labs/google/ranked_keywords/live', [{ target: domain, limit, ...loc(),
    order_by: ['ranked_serp_element.serp_item.etv,desc'] }]);
  return (r?.items || []).map((i) => ({
    keyword: i.keyword_data?.keyword, volume: i.keyword_data?.keyword_info?.search_volume ?? 0,
    position: i.ranked_serp_element?.serp_item?.rank_group ?? null, url: i.ranked_serp_element?.serp_item?.url,
  })).filter((k) => k.keyword);
}

/** Domain overview: organic keyword count and estimated traffic value. */
export async function domainOverview(domain) {
  const [r] = await post('/dataforseo_labs/google/domain_rank_overview/live', [{ target: domain, ...loc() }]);
  const m = r?.items?.[0]?.metrics?.organic || {};
  return { organicKeywords: m.count ?? 0, organicEtv: m.etv ?? 0 };
}

/** Backlink summary for a domain. */
export async function backlinkSummary(domain) {
  const [r] = await post('/backlinks/summary/live', [{ target: domain, include_subdomains: true }]);
  return { backlinks: r?.backlinks ?? 0, referringDomains: r?.referring_domains ?? 0, domainRank: r?.rank ?? null };
}

/** Local SERP from a point on the map: map-pack (local_pack) positions plus organic. */
export async function localSerp(keyword, lat, lng, zoom = 14) {
  const [r] = await post('/serp/google/organic/live/advanced', [{ keyword, depth: 30, device: 'mobile',
    location_coordinate: `${lat},${lng},${zoom}`, language_code: config.dfs.language }]);
  const items = r?.items || [];
  const pack = items.filter((i) => i.type === 'local_pack').map((i) => ({ position: i.rank_group, title: i.title, rating: i.rating?.value ?? null, phone: i.phone, domain: (i.domain || '').replace(/^www\./, ''), url: i.url }));
  const organic = items.filter((i) => i.type === 'organic').map((i) => ({ position: i.rank_group, domain: (i.domain || '').replace(/^www\./, ''), url: i.url }));
  return { pack, organic };
}

// ---- Spend tracking & standard queue ----
const month = () => new Date().toISOString().slice(0, 7);

export function recordSpend(kind, cost, calls = 1) {
  db.prepare(`INSERT INTO dfs_spend (month,kind,calls,cost) VALUES (?,?,?,?)
    ON CONFLICT(month,kind) DO UPDATE SET calls=calls+excluded.calls, cost=cost+excluded.cost`).run(month(), kind, calls, cost || 0);
}
export function spendThisMonth() {
  return db.prepare('SELECT COALESCE(SUM(cost),0) c FROM dfs_spend WHERE month=?').get(month()).c;
}
export function underCap(extraUsd = 0) {
  return spendThisMonth() + extraUsd <= config.dfs.monthlyCapUsd;
}

/** Raw POST returning full task objects (for queue endpoints we need ids and costs, not just result[0]). */
async function postRaw(path, body) {
  if (!config.dfs.enabled) throw new Error('DataForSEO not configured');
  const auth = Buffer.from(`${config.dfs.login}:${config.dfs.password}`).toString('base64');
  const res = await fetch(BASE + path, { method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  const json = await res.json();
  if (json.status_code !== 20000) throw new Error(`DataForSEO ${json.status_code}: ${json.status_message}`);
  return json.tasks || [];
}
async function getRaw(path) {
  const auth = Buffer.from(`${config.dfs.login}:${config.dfs.password}`).toString('base64');
  const res = await fetch(BASE + path, { headers: { authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(60000) });
  const json = await res.json();
  if (json.status_code !== 20000) throw new Error(`DataForSEO ${json.status_code}: ${json.status_message}`);
  return json.tasks || [];
}

/**
 * Post Google Maps searches to the standard (cheap, async) queue. Each item: { keyword, lat, lng, zoom, tag }.
 * Returns [{ task_id, tag, cost }]. Up to 100 per call.
 */
export async function postMapsTasks(items) {
  const out = [];
  for (let i = 0; i < items.length; i += 100) {
    const tasks = await postRaw('/serp/google/maps/task_post', items.slice(i, i + 100).map((it) => ({
      keyword: it.keyword, language_code: config.dfs.language, location_coordinate: `${it.lat},${it.lng},${it.zoom ?? 14}z`,
      device: 'mobile', depth: 20, priority: 1, tag: it.tag })));
    for (const t of tasks) out.push({ task_id: t.id, tag: t.data?.tag, cost: t.cost || 0, ok: t.status_code === 20100, message: t.status_message });
  }
  return out;
}

/** Ids of standard-queue Maps tasks that have finished. */
export async function mapsTasksReady() {
  const [t] = await getRaw('/serp/google/maps/tasks_ready');
  return (t?.result || []).map((r) => r.id);
}

/** Fetch one finished Maps task: [{ position, title, place_id, cid, rating, phone, domain, url }]. */
export async function getMapsTask(id) {
  const [t] = await getRaw(`/serp/google/maps/task_get/advanced/${id}`);
  const items = t?.result?.[0]?.items || [];
  return { cost: t?.cost || 0, items: items.filter((i) => i.type === 'maps_search').map((i) => ({
    position: i.rank_group, title: i.title, place_id: i.place_id, cid: i.cid, rating: i.rating?.value ?? null,
    phone: i.phone, domain: (i.domain || '').replace(/^www\./, ''), url: i.url, address: i.address })) };
}

// ---- Business data: the public Google listing and its reviews (no Business Profile API approval needed) ----

/** Identify a listing for the business_data endpoints: place_id, then cid, then name near its coordinates. */
function listingTarget(loc) {
  if (loc.placeId) return { keyword: `place_id:${loc.placeId}`, location_code: config.dfs.location };
  if (loc.cid) return { keyword: `cid:${loc.cid}`, location_code: config.dfs.location };
  return { keyword: loc.name, location_coordinate: `${loc.lat},${loc.lng},5000` };
}

/** Live lookup of one public listing. Returns { cost, info } where info is null if Google returned nothing. */
export async function businessInfo(loc) {
  const [t] = await postRaw('/business_data/google/my_business_info/live', [{ ...listingTarget(loc), language_code: config.dfs.language }]);
  if (t?.status_code !== 20000) throw new Error(`DataForSEO task ${t?.status_code}: ${t?.status_message}`);
  const i = t.result?.[0]?.items?.[0];
  return { cost: t.cost || 0, info: i ? {
    title: i.title, address: i.address, phone: i.phone, website: i.url, category: i.category, description: i.description,
    rating: i.rating?.value ?? null, reviewCount: i.rating?.votes_count ?? null, photoCount: i.total_photos ?? null,
    hasHours: Boolean(i.work_time?.work_hours?.timetable), status: i.work_time?.work_hours?.current_status || null,
    placeId: i.place_id, cid: i.cid, claimed: i.is_claimed } : null };
}

/** Post review fetches to the task queue (reviews have no live endpoint). Each item: { loc, depth, tag }. */
export async function postReviewTasks(items) {
  if (!items.length) return [];
  // The reviews endpoint takes place_id / cid as their own fields rather than the keyword prefix.
  const target = (l) => l.placeId ? { place_id: l.placeId, location_code: config.dfs.location } : l.cid ? { cid: String(l.cid), location_code: config.dfs.location } : listingTarget(l);
  const tasks = await postRaw('/business_data/google/reviews/task_post', items.map((it) => ({
    ...target(it.loc), language_code: config.dfs.language, depth: it.depth, sort_by: 'newest', tag: it.tag })));
  return tasks.map((t) => ({ task_id: t.id, tag: t.data?.tag, cost: t.cost || 0, ok: t.status_code === 20100, message: t.status_message }));
}

export async function reviewTasksReady() {
  const [t] = await getRaw('/business_data/google/reviews/tasks_ready');
  return (t?.result || []).map((r) => r.id);
}

/** Fetch one finished reviews task: [{ id, createdAt, rating, reviewer, comment, replied }]. */
export async function getReviewTask(id) {
  const [t] = await getRaw(`/business_data/google/reviews/task_get/${id}`);
  const items = t?.result?.[0]?.items || [];
  const iso = (s) => { const d = new Date(String(s || '').replace(' ', 'T').replace(' ', '')); return isNaN(d) ? s : d.toISOString(); };
  return { cost: t?.cost || 0, status: t?.status_code, items: items.filter((i) => i.review_id).map((i) => ({
    id: i.review_id, createdAt: iso(i.timestamp), rating: i.rating?.value ?? null, reviewer: i.profile_name || '',
    comment: i.review_text || '', replied: i.owner_answer ? 1 : 0 })) };
}

// ---- Google Ads Transparency Center: ads an advertiser is running (standard queue only, no live endpoint) ----

/** Queue one ads search per brand. Each item: { domain, dateFrom, tag }. Returns [{ task_id, tag, cost, ok, message }]. */
export async function postAdsTasks(items) {
  if (!items.length) return [];
  const tasks = await postRaw('/serp/google/ads_search/task_post', items.map((it) => ({
    target: it.domain, location_code: config.dfs.location, platform: 'all', format: 'all', date_from: it.dateFrom, depth: 40, priority: 1, tag: it.tag })));
  return tasks.map((t) => ({ task_id: t.id, tag: t.data?.tag, cost: t.cost || 0, ok: t.status_code === 20100, message: t.status_message }));
}

export async function adsTasksReady() {
  const [t] = await getRaw('/serp/google/ads_search/tasks_ready');
  return (t?.result || []).map((r) => r.id);
}

/** Fetch one finished ads search: [{ creativeId, advertiserId, advertiser, verified, format, image, previewUrl, url, firstShown, lastShown }]. */
export async function getAdsTask(id) {
  const [t] = await getRaw(`/serp/google/ads_search/task_get/advanced/${id}`);
  const iso = (s) => { const d = new Date(String(s || '').replace(' ', 'T').replace(' ', '')); return isNaN(d) ? null : d.toISOString(); };
  // 40102 is "No Search Results": the advertiser simply has no ads in the window.
  if (t?.status_code !== 20000 && t?.status_code !== 40102) throw new Error(`DataForSEO task ${t?.status_code}: ${t?.status_message}`);
  return { cost: t?.cost || 0, items: (t?.result?.[0]?.items || []).filter((i) => i.creative_id).map((i) => ({
    creativeId: i.creative_id, advertiserId: i.advertiser_id, advertiser: i.title || '', verified: i.verified ? 1 : 0, format: i.format || '',
    image: i.preview_image?.url || null, previewUrl: i.preview_url || null, url: i.url || null, firstShown: iso(i.first_shown), lastShown: iso(i.last_shown) })) };
}
