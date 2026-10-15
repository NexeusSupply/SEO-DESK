import { google } from 'googleapis';
import { config } from '../config.js';
import { db, tx, today, logJob } from '../db.js';

function client() {
  const auth = new google.auth.GoogleAuth({ credentials: config.gsc.credentials, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  return google.searchconsole({ version: 'v1', auth });
}

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

// Properties the service account has been added to, refreshed by each sync. Lets brands leave gscProperty out.
let known = { urls: [], fetched: 0 };
async function refreshProperties(sc) {
  if (Date.now() - known.fetched < 600_000) return;
  const r = await sc.sites.list();
  known = { urls: (r.data.siteEntry || []).filter((e) => e.permissionLevel !== 'siteUnverifiedUser').map((e) => e.siteUrl), fetched: Date.now() };
}

/** The brand's property: gscProperty if set, else the domain property for its host, else a URL-prefix one. */
export function gscPropertyFor(site) {
  if (site.gscProperty) return site.gscProperty;
  const h = site.host;
  return [`sc-domain:${h}`, `https://www.${h}/`, `https://${h}/`, `http://www.${h}/`, `http://${h}/`].find((u) => known.urls.includes(u)) || null;
}

export async function syncGsc(site) {
  const sc = client();
  if (!site.gscProperty) await refreshProperties(sc);
  const property = gscPropertyFor(site);
  if (!property) return `no Search Console property for ${site.host} shared with the service account`;
  return logJob('gsc', site.slug, async () => {
    // GSC data lags ~2 days
    const endDate = daysAgo(2), startDate = daysAgo(92);
    const daily = await sc.searchanalytics.query({ siteUrl: property, requestBody: { startDate, endDate, dimensions: ['date'], rowLimit: 100 } });
    const upDaily = db.prepare('INSERT OR REPLACE INTO gsc_daily (site,date,clicks,impressions,ctr,position) VALUES (?,?,?,?,?,?)');
    for (const r of daily.data.rows || []) upDaily.run(site.slug, r.keys[0], r.clicks, r.impressions, r.ctr, r.position);

    const q = await sc.searchanalytics.query({ siteUrl: property, requestBody: { startDate: daysAgo(30), endDate, dimensions: ['query', 'page'], rowLimit: 500 } });
    const upQ = db.prepare('INSERT OR REPLACE INTO gsc_queries (site,period_end,query,page,clicks,impressions,ctr,position) VALUES (?,?,?,?,?,?,?,?)');
    tx(() => { for (const r of q.data.rows || []) upQ.run(site.slug, endDate, r.keys[0], r.keys[1], r.clicks, r.impressions, r.ctr, r.position); });
    return `${(daily.data.rows || []).length} days, ${(q.data.rows || []).length} query rows`;
  });
}
