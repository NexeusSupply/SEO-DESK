import { db, today, logJob } from '../db.js';
import { serp, recordSpend, underCap } from './dataforseo.js';
import { config } from '../config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function trackRanks(site) {
  if (!site.keywords.length) return 'no keywords';
  return logJob('ranks', site.slug, async () => {
    if (!underCap(site.keywords.length * 0.002)) return `skipped: monthly DataForSEO cap (US$${config.dfs.monthlyCapUsd}) would be exceeded`;
    const up = db.prepare('INSERT OR REPLACE INTO ranks (site,keyword,checked_on,position,url,serp_top) VALUES (?,?,?,?,?,?)');
    const watch = new Set([site.host, ...site.competitors.map((c) => c.replace(/^www\./, ''))]);
    for (const kw of site.keywords) {
      const results = await serp(kw, 100); recordSpend('serp-live', 0.002, 1);
      const mine = results.find((r) => r.domain === site.host || r.domain.endsWith('.' + site.host));
      const top = results.filter((r) => r.position <= 10 || watch.has(r.domain)).slice(0, 15)
        .map((r) => ({ p: r.position, d: r.domain, u: r.url }));
      up.run(site.slug, kw, today(), mine?.position ?? null, mine?.url ?? null, JSON.stringify(top));
      await sleep(300);
    }
    return `${site.keywords.length} keywords`;
  });
}
