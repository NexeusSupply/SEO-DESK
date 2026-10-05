import { config, loadSites } from './config.js';
import { runAudit } from './audit/index.js';
import { trackRanks } from './data/ranks.js';
import { syncGsc } from './data/gsc.js';
import { refreshCompetitors } from './data/competitors.js';
import { sendDigest } from './digest.js';
import { syncGbp } from './data/gbp.js';
import { trackLocalRanks, checkNap } from './data/local.js';

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
  gbp: (only) => config.gbp.enabled ? forEachSite(syncGbp, only) : Promise.resolve(['Business Profile not configured']),
  local: (only) => forEachSite(async (s) => `${await trackLocalRanks(s)}; ${await checkNap(s)}`, only),
};
