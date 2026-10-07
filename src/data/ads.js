// Ads each brand is running. Google: the public Ads Transparency Center, searched by the brand's website domain through
// DataForSEO's standard queue (weekly post, collected with the other queued tasks). Meta: its Ad Library API only
// returns non-political ads shown in the EU and UK, so NZ and AU ads can't be pulled; the dashboard links to the public
// Ad Library page instead (see metaAdLibraryUrl).
import { config } from '../config.js';
import { db, tx, today, logJob } from '../db.js';
import { postAdsTasks, adsTasksReady, getAdsTask, recordSpend, underCap } from './dataforseo.js';

const ADS_COST_EST = 0.003; // USD per ads search, for the pre-flight cap check only
const WINDOW_DAYS = 90;     // how far back to ask for ads
export const RUNNING_DAYS = 7; // an ad last shown within this many days counts as running now

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

/** Weekly: queue an ads search for the brand's domain. */
export async function syncAds(site) {
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  if (db.prepare("SELECT 1 FROM dfs_tasks WHERE kind='ads' AND site=? AND posted_on >= date('now','-6 days')").get(site.slug)) return 'ads already checked this week';
  if (!underCap(ADS_COST_EST)) return `skipped: monthly DataForSEO cap (US$${config.dfs.monthlyCapUsd}) would be exceeded`;
  return logJob('ads', site.slug, async () => {
    const [p] = await postAdsTasks([{ domain: site.host, dateFrom: daysAgo(WINDOW_DAYS), tag: site.slug }]);
    if (!p?.ok) throw new Error(`ads search rejected: ${p?.message}`);
    db.prepare('INSERT OR REPLACE INTO dfs_tasks (task_id,kind,site,location,keyword,posted_on,status,cost) VALUES (?,?,?,?,?,?,?,?)')
      .run(p.task_id, 'ads', site.slug, null, site.host, today(), 'posted', p.cost);
    recordSpend('ads', p.cost, 1);
    return `Google ads search queued for ${site.host} (US$${p.cost.toFixed(4)})`;
  });
}

/** Collect finished ads searches. Safe to run as often as you like. */
export async function collectAds() {
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  const pending = db.prepare("SELECT * FROM dfs_tasks WHERE kind='ads' AND status='posted'").all();
  if (!pending.length) return 'no ads searches pending';
  const ready = new Set(await adsTasksReady());
  const up = db.prepare(`INSERT OR REPLACE INTO google_ads (site,creative_id,advertiser_id,advertiser,verified,format,image,preview_url,url,first_shown,last_shown,fetched_on)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const clear = db.prepare('DELETE FROM google_ads WHERE site=?');
  const done = db.prepare('UPDATE dfs_tasks SET status=?, cost=cost+? WHERE task_id=?');
  let n = 0, nAds = 0;
  for (const t of pending) {
    // A search with no ads may never be listed as ready, so ask directly once it's a couple of days old.
    if (!ready.has(t.task_id) && t.posted_on > daysAgo(2)) continue;
    try {
      const { items, cost } = await getAdsTask(t.task_id);
      // Each search replaces the brand's list, so ads that dropped out of the 90-day window disappear.
      tx(() => { clear.run(t.site); for (const a of items) up.run(t.site, a.creativeId, a.advertiserId, a.advertiser, a.verified, a.format, a.image, a.previewUrl, a.url, a.firstShown, a.lastShown, today()); });
      done.run('done', cost, t.task_id); recordSpend('ads-get', cost, 1); n++; nAds += items.length;
    } catch (e) { console.warn(`[ads-collect] ${t.task_id}: ${e.message}`); }
  }
  return `${n} ads searches collected (${nAds} ads), ${pending.length - n} still pending`;
}

/** Google's public Ads Transparency Center for the brand's domain. */
export const googleTransparencyUrl = (site) => `https://adstransparency.google.com/?region=anywhere&domain=${encodeURIComponent(site.host)}`;

/** Meta's public Ad Library: the brand's Page if sites.json has its pageId, otherwise a search for the brand's name. */
export const metaAdLibraryUrl = (site) => site.meta?.pageId
  ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${encodeURIComponent(site.meta.pageId)}`
  : `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(site.name)}&search_type=keyword_unordered`;
