import { config, loadSites } from './config.js';
import { runAudit } from './audit/index.js';
import { trackRanks } from './data/ranks.js';
import { syncGsc } from './data/gsc.js';
import { refreshCompetitors } from './data/competitors.js';
import { sendDigest } from './digest.js';
import { syncGbp } from './data/gbp.js';
import { syncMeta, syncMetaComments } from './data/meta.js';
import { trackLocalRanks, collectLocalRanks, checkNap } from './data/local.js';
import { syncPublicListings, collectPublicReviews } from './data/listings-public.js';
import { syncAds, collectAds } from './data/ads.js';

const forEachSite = async (fn, only) => {
  const sites = loadSites().filter((s) => !only || s.slug === only);
  const out = [];
  for (const s of sites) {
    try { out.push(`${s.slug}: ${await fn(s)}`); } catch (e) { out.push(`${s.slug}: FAILED ${e.message}`); console.error(e); }
  }
  return out;
};

export const jobs = {
  audit: (only) => forEachSite(runAudit, only),
  ranks: (only) => config.dfs.enabled ? forEachSite(trackRanks, only) : Promise.resolve(['DataForSEO not configured']),
  gsc: (only) => config.gsc.enabled ? forEachSite(syncGsc, only) : Promise.resolve(['Search Console not configured']),
  competitors: (only) => config.dfs.enabled ? forEachSite(refreshCompetitors, only) : Promise.resolve(['DataForSEO not configured']),
  digest: () => sendDigest(),
  // Business Profile API for linked clinics; DataForSEO's public listing data for the rest (see listings-public.js).
  gbp: (only) => config.gbp.enabled || config.dfs.enabled
    ? forEachSite(async (s) => [config.gbp.enabled && await syncGbp(s), config.dfs.enabled && await syncPublicListings(s)].filter(Boolean).join('; '), only)
    : Promise.resolve(['Business Profile and DataForSEO not configured']),
  local: (only) => forEachSite(async (s) => `${await trackLocalRanks(s)}; ${await checkNap(s)}`, only),
  'local-collect': async () => [await collectLocalRanks(loadSites()), await collectPublicReviews(), await collectAds()],
  ads: (only) => config.dfs.enabled ? forEachSite(syncAds, only) : Promise.resolve(['DataForSEO not configured']),
  meta: (only) => config.meta.enabled ? forEachSite(syncMeta, only) : Promise.resolve(['Meta not configured']),
  'meta-comments': (only) => config.meta.enabled ? forEachSite((s) => s.meta ? syncMetaComments(s) : 'not set up', only) : Promise.resolve(['Meta not configured']),
};
