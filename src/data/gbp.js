// Google Business Profile: listing details, reviews and performance for each clinic.
// Uses the Business Information API (v1), Business Profile Performance API (v1) and the v4 reviews endpoint.
import { google } from 'googleapis';
import { config } from '../config.js';
import { db, tx, today, logJob } from '../db.js';

let cachedToken = null;
async function token() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.v;
  const o = new google.auth.OAuth2(config.gbp.clientId, config.gbp.clientSecret);
  o.setCredentials({ refresh_token: config.gbp.refreshToken });
  const { token: t, res } = await o.getAccessToken();
  cachedToken = { v: t, exp: Date.now() + ((res?.data?.expires_in || 3000) * 1000) };
  return t;
}
async function gget(url, params = {}) {
  const u = new URL(url); for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`GBP ${r.status} ${url}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function gpost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`GBP ${r.status} ${url}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** List every location across all accounts the signed-in user manages — use this to find gbpLocationId values. */
export async function listAllLocations() {
  const { accounts = [] } = await gget('https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
  const out = [];
  for (const a of accounts) {
    let pageToken;
    do {
      const r = await gget(`https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations`,
        { readMask: 'name,title,storefrontAddress,phoneNumbers,websiteUri', pageSize: 100, pageToken });
      for (const l of r.locations || []) out.push({ account: a.accountName, id: l.name, title: l.title,
        address: (l.storefrontAddress?.addressLines || []).concat(l.storefrontAddress?.locality || '').join(', '),
        phone: l.phoneNumbers?.primaryPhone, website: l.websiteUri });
      pageToken = r.nextPageToken;
    } while (pageToken);
  }
  return out;
}

const readMask = 'name,title,storefrontAddress,phoneNumbers,websiteUri,categories,regularHours,profile,openInfo,metadata';

async function locationDetails(id) {
  const l = await gget(`https://mybusinessbusinessinformation.googleapis.com/v1/${id}`, { readMask });
  let photoCount = null;
  try { const m = await gget(`https://mybusiness.googleapis.com/v4/${accountPath(id)}/media`, { pageSize: 1 }); photoCount = m.totalMediaItemCount ?? null; } catch {}
  const fields = { title: !!l.title, address: !!l.storefrontAddress, phone: !!l.phoneNumbers?.primaryPhone, website: !!l.websiteUri,
    category: !!l.categories?.primaryCategory, hours: !!l.regularHours?.periods?.length, description: !!l.profile?.description,
    photos: (photoCount ?? 1) > 0 };
  const completeness = Math.round(Object.values(fields).filter(Boolean).length / Object.keys(fields).length * 100);
  return { title: l.title, address: [...(l.storefrontAddress?.addressLines || []), l.storefrontAddress?.locality, l.storefrontAddress?.postalCode].filter(Boolean).join(', '),
    phone: l.phoneNumbers?.primaryPhone || null, website: l.websiteUri || null, primaryCategory: l.categories?.primaryCategory?.displayName || null,
    hasHours: fields.hours ? 1 : 0, hasDescription: fields.description ? 1 : 0, photoCount, completeness,
    openStatus: l.openInfo?.status || null };
}

// The v4 reviews endpoint needs the account-scoped path. We resolve it once per run.
let accountCache = null;
async function accountPath(locationId) {
  if (!accountCache) { const { accounts = [] } = await gget('https://mybusinessaccountmanagement.googleapis.com/v1/accounts'); accountCache = accounts.map((a) => a.name); }
  return `${accountCache[0]}/${locationId}`; // first account; adjust if listings span several
}
async function reviews(id) {
  const out = []; let pageToken;
  do {
    const r = await gget(`https://mybusiness.googleapis.com/v4/${await accountPath(id)}/reviews`, { pageSize: 50, pageToken });
    for (const v of r.reviews || []) out.push({ id: v.reviewId, createdAt: v.createTime, rating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[v.starRating] || null,
      reviewer: v.reviewer?.displayName || '', comment: v.comment || '', replied: v.reviewReply ? 1 : 0 });
    pageToken = r.nextPageToken;
    if (out.length >= 200) break;
  } while (pageToken);
  return { reviews: out, avg: null, total: null };
}
async function performance(id) {
  const end = new Date(Date.now() - 3 * 864e5), start = new Date(Date.now() - 60 * 864e5);
  const ymd = (d) => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
  const metrics = ['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'WEBSITE_CLICKS'];
  const r = await gget(`https://businessprofileperformance.googleapis.com/v1/${id}:fetchMultiDailyMetricsTimeSeries`, {
    dailyMetrics: metrics.join(','), 'dailyRange.startDate.year': ymd(start).year, 'dailyRange.startDate.month': ymd(start).month, 'dailyRange.startDate.day': ymd(start).day,
    'dailyRange.endDate.year': ymd(end).year, 'dailyRange.endDate.month': ymd(end).month, 'dailyRange.endDate.day': ymd(end).day });
  // Some clients need repeated dailyMetrics params; fall back if the API rejects the comma form.
  const days = {};
  for (const m of r.multiDailyMetricTimeSeries || []) for (const s of m.dailyMetricTimeSeries || []) {
    for (const p of s.timeSeries?.datedValues || []) {
      const d = `${p.date.year}-${String(p.date.month).padStart(2, '0')}-${String(p.date.day).padStart(2, '0')}`;
      days[d] ||= { search: 0, maps: 0, calls: 0, directions: 0, website: 0 };
      const v = Number(p.value || 0);
      if (s.dailyMetric.includes('_SEARCH')) days[d].search += v; else if (s.dailyMetric.includes('_MAPS')) days[d].maps += v;
      else if (s.dailyMetric === 'CALL_CLICKS') days[d].calls += v; else if (s.dailyMetric === 'BUSINESS_DIRECTION_REQUESTS') days[d].directions += v;
      else if (s.dailyMetric === 'WEBSITE_CLICKS') days[d].website += v;
    }
  }
  return days;
}

export async function syncGbp(site) {
  const locs = site.locations.filter((l) => l.gbpLocationId);
  if (!locs.length) return 'no locations with gbpLocationId';
  return logJob('gbp', site.slug, async () => {
    let nRev = 0;
    for (const loc of locs) {
      const d = await locationDetails(loc.gbpLocationId);
      let rv = { reviews: [] }; try { rv = await reviews(loc.gbpLocationId); } catch (e) { console.warn(`[gbp:${loc.slug}] reviews: ${e.message}`); }
      const rated = rv.reviews.filter((r) => r.rating);
      const rating = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : null;
      db.prepare(`INSERT OR REPLACE INTO gbp_snapshots (site,location,fetched_on,title,address,phone,website,primary_category,rating,review_count,photo_count,has_hours,has_description,completeness,open_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(site.slug, loc.slug, today(), d.title, d.address, d.phone, d.website, d.primaryCategory, rating, rv.reviews.length, d.photoCount, d.hasHours, d.hasDescription, d.completeness, d.openStatus);
      const up = db.prepare('INSERT OR REPLACE INTO gbp_reviews (site,location,review_id,created_at,rating,reviewer,comment,replied) VALUES (?,?,?,?,?,?,?,?)');
      tx(() => { for (const r of rv.reviews) up.run(site.slug, loc.slug, r.id, r.createdAt, r.rating, r.reviewer, r.comment, r.replied); });
      nRev += rv.reviews.length;
      try {
        const days = await performance(loc.gbpLocationId);
        const upd = db.prepare('INSERT OR REPLACE INTO gbp_daily (site,location,date,impressions_search,impressions_maps,calls,directions,website_clicks) VALUES (?,?,?,?,?,?,?,?)');
        tx(() => { for (const [date, v] of Object.entries(days)) upd.run(site.slug, loc.slug, date, v.search, v.maps, v.calls, v.directions, v.website); });
      } catch (e) { console.warn(`[gbp:${loc.slug}] performance: ${e.message}`); }
    }
    return `${locs.length} listings, ${nRev} reviews`;
  });
}
