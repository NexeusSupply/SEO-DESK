import { db, tx, today, logJob } from '../db.js';
import { rankedKeywords, domainOverview, backlinkSummary, searchVolume, keywordDifficulty, recordSpend, underCap } from './dataforseo.js';
import { config } from '../config.js';

async function snapshotDomain(domain) {
  const [ov, bl, kws] = await Promise.all([domainOverview(domain), backlinkSummary(domain), rankedKeywords(domain, 300)]);
  tx(() => {
    db.prepare('INSERT OR REPLACE INTO domain_snapshots (domain,fetched_on,organic_keywords,organic_etv,backlinks,referring_domains,domain_rank) VALUES (?,?,?,?,?,?,?)')
      .run(domain, today(), ov.organicKeywords, ov.organicEtv, bl.backlinks, bl.referringDomains, bl.domainRank);
    const up = db.prepare('INSERT OR REPLACE INTO domain_keywords (domain,fetched_on,keyword,position,volume,url) VALUES (?,?,?,?,?,?)');
    for (const k of kws) up.run(domain, today(), k.keyword, k.position, k.volume, k.url);
  });
  return kws.length;
}

export async function refreshCompetitors(site) {
  return logJob('competitors', site.slug, async () => {
    const domains = [site.host, ...site.competitors];
    if (!underCap(domains.length * 0.1)) return `skipped: monthly DataForSEO cap (US$${config.dfs.monthlyCapUsd}) would be exceeded`;
    let n = 0;
    for (const d of domains) { n += await snapshotDomain(d); recordSpend('labs', 0.1, 3); }
    // enrich the tracked keyword list with volume + difficulty
    const kws = site.keywords.filter(Boolean);
    if (kws.length) {
      const [vol, kd] = await Promise.all([searchVolume(kws), keywordDifficulty(kws)]);
      const kdMap = new Map(kd.map((k) => [k.keyword, k.difficulty]));
      const up = db.prepare('INSERT OR REPLACE INTO keyword_data (keyword,volume,cpc,competition,difficulty,fetched_on) VALUES (?,?,?,?,?,?)');
      for (const v of vol) up.run(v.keyword, v.volume, v.cpc, v.competition, kdMap.get(v.keyword) ?? null, today());
    }
    return `${domains.length} domains, ${n} ranked keywords`;
  });
}

/** Keywords competitors rank for (top 20) that this site doesn't rank for at all. */
export function keywordGap(site) {
  const latest = (d) => db.prepare('SELECT MAX(fetched_on) f FROM domain_keywords WHERE domain=?').get(d)?.f;
  const mineDate = latest(site.host);
  const mine = new Set(mineDate ? db.prepare('SELECT keyword FROM domain_keywords WHERE domain=? AND fetched_on=?').all(site.host, mineDate).map((r) => r.keyword) : []);
  const gap = new Map();
  for (const c of site.competitors) {
    const d = latest(c); if (!d) continue;
    for (const r of db.prepare('SELECT keyword,position,volume,url FROM domain_keywords WHERE domain=? AND fetched_on=? AND position<=20').all(c, d)) {
      if (mine.has(r.keyword)) continue;
      const g = gap.get(r.keyword) || { keyword: r.keyword, volume: r.volume, competitors: [] };
      g.competitors.push({ domain: c, position: r.position, url: r.url });
      gap.set(r.keyword, g);
    }
  }
  return [...gap.values()].sort((a, b) => b.volume - a.volume).slice(0, 200);
}
