// Thin client for the DataForSEO v3 REST API (live endpoints only — no callbacks needed).
import { config } from '../config.js';

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
