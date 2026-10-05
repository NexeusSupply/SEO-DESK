import { google } from 'googleapis';
import { config } from '../config.js';
import { db, tx, today, logJob } from '../db.js';

function client() {
  const auth = new google.auth.GoogleAuth({ credentials: config.gsc.credentials, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  return google.searchconsole({ version: 'v1', auth });
}

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export async function syncGsc(site) {
  if (!site.gscProperty) return 'no gscProperty configured';
  return logJob('gsc', site.slug, async () => {
    const sc = client();
    // GSC data lags ~2 days
    const endDate = daysAgo(2), startDate = daysAgo(92);
    const daily = await sc.searchanalytics.query({ siteUrl: site.gscProperty, requestBody: { startDate, endDate, dimensions: ['date'], rowLimit: 100 } });
    const upDaily = db.prepare('INSERT OR REPLACE INTO gsc_daily (site,date,clicks,impressions,ctr,position) VALUES (?,?,?,?,?,?)');
    for (const r of daily.data.rows || []) upDaily.run(site.slug, r.keys[0], r.clicks, r.impressions, r.ctr, r.position);

    const q = await sc.searchanalytics.query({ siteUrl: site.gscProperty, requestBody: { startDate: daysAgo(30), endDate, dimensions: ['query', 'page'], rowLimit: 500 } });
    const upQ = db.prepare('INSERT OR REPLACE INTO gsc_queries (site,period_end,query,page,clicks,impressions,ctr,position) VALUES (?,?,?,?,?,?,?,?)');
    tx(() => { for (const r of q.data.rows || []) upQ.run(site.slug, endDate, r.keys[0], r.keys[1], r.clicks, r.impressions, r.ctr, r.position); });
    return `${(daily.data.rows || []).length} days, ${(q.data.rows || []).length} query rows`;
  });
}
