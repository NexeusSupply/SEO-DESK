// Read-side queries that feed the dashboard and digest.
import { db } from './db.js';
import { ISSUE_LABELS } from './audit/rules.js';
import { keywordGap } from './data/competitors.js';

export function overview(sites) {
  return sites.map((s) => {
    const audit = db.prepare('SELECT id,finished_at,pages_crawled,score,issue_counts FROM audits WHERE site=? ORDER BY id DESC LIMIT 1').get(s.slug);
    const prevAudit = audit ? db.prepare('SELECT score FROM audits WHERE site=? AND id<? ORDER BY id DESC LIMIT 1').get(s.slug, audit.id) : null;
    const gsc28 = db.prepare(`SELECT SUM(clicks) clicks, SUM(impressions) impressions, AVG(position) position FROM gsc_daily
      WHERE site=? AND date >= date((SELECT MAX(date) FROM gsc_daily WHERE site=?), '-27 days')`).get(s.slug, s.slug);
    const gscPrev = db.prepare(`SELECT SUM(clicks) clicks, SUM(impressions) impressions FROM gsc_daily
      WHERE site=? AND date < date((SELECT MAX(date) FROM gsc_daily WHERE site=?), '-27 days')
      AND date >= date((SELECT MAX(date) FROM gsc_daily WHERE site=?), '-55 days')`).get(s.slug, s.slug, s.slug);
    const rankDate = db.prepare('SELECT MAX(checked_on) d FROM ranks WHERE site=?').get(s.slug)?.d;
    const ranks = rankDate ? db.prepare('SELECT position FROM ranks WHERE site=? AND checked_on=?').all(s.slug, rankDate) : [];
    const snap = db.prepare('SELECT * FROM domain_snapshots WHERE domain=? ORDER BY fetched_on DESC LIMIT 1').get(s.host);
    return {
      slug: s.slug, name: s.name, url: s.url, host: s.host,
      audit: audit ? { ...audit, issue_counts: JSON.parse(audit.issue_counts || '{}'), prevScore: prevAudit?.score ?? null } : null,
      gsc: gsc28?.clicks != null ? { ...gsc28, prevClicks: gscPrev?.clicks ?? null, prevImpressions: gscPrev?.impressions ?? null } : null,
      ranks: ranks.length ? {
        tracked: ranks.length, top3: ranks.filter((r) => r.position && r.position <= 3).length,
        top10: ranks.filter((r) => r.position && r.position <= 10).length, unranked: ranks.filter((r) => !r.position).length, date: rankDate,
      } : null,
      domain: snap || null,
    };
  });
}

export function siteDetail(site) {
  const audit = db.prepare('SELECT * FROM audits WHERE site=? ORDER BY id DESC LIMIT 1').get(site.slug);
  const issues = audit ? db.prepare(`SELECT code, severity, COUNT(*) n FROM audit_issues WHERE audit_id=? GROUP BY code, severity
    ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, n DESC`).all(audit.id)
    .map((r) => ({ ...r, label: ISSUE_LABELS[r.code] || r.code,
      examples: db.prepare('SELECT url, detail FROM audit_issues WHERE audit_id=? AND code=? LIMIT 8').all(audit.id, r.code) })) : [];
  const scoreHistory = db.prepare('SELECT finished_at, score, pages_crawled FROM audits WHERE site=? ORDER BY id DESC LIMIT 12').all(site.slug).reverse();
  const gscDaily = db.prepare('SELECT date, clicks, impressions, ctr, position FROM gsc_daily WHERE site=? ORDER BY date').all(site.slug);
  const qEnd = db.prepare('SELECT MAX(period_end) d FROM gsc_queries WHERE site=?').get(site.slug)?.d;
  const topQueries = qEnd ? db.prepare(`SELECT query, SUM(clicks) clicks, SUM(impressions) impressions, AVG(position) position FROM gsc_queries
    WHERE site=? AND period_end=? GROUP BY query ORDER BY clicks DESC LIMIT 40`).all(site.slug, qEnd) : [];
  const topPages = qEnd ? db.prepare(`SELECT page, SUM(clicks) clicks, SUM(impressions) impressions FROM gsc_queries
    WHERE site=? AND period_end=? GROUP BY page ORDER BY clicks DESC LIMIT 25`).all(site.slug, qEnd) : [];
  // striking distance: positions 8-20 with decent impressions — the cheapest wins
  const strikingDistance = qEnd ? db.prepare(`SELECT query, page, clicks, impressions, position FROM gsc_queries
    WHERE site=? AND period_end=? AND position BETWEEN 8 AND 20 AND impressions >= 50 ORDER BY impressions DESC LIMIT 25`).all(site.slug, qEnd) : [];

  const ranks = site.keywords.map((kw) => {
    const hist = db.prepare('SELECT checked_on, position, url FROM ranks WHERE site=? AND keyword=? ORDER BY checked_on DESC LIMIT 30').all(site.slug, kw);
    const latest = hist[0], prev = hist[7] || hist[hist.length - 1];
    const kd = db.prepare('SELECT volume, difficulty, cpc FROM keyword_data WHERE keyword=?').get(kw);
    const top = latest?.serp_top ? JSON.parse(db.prepare('SELECT serp_top FROM ranks WHERE site=? AND keyword=? AND checked_on=?').get(site.slug, kw, latest.checked_on).serp_top) : [];
    return { keyword: kw, position: latest?.position ?? null, prev: prev?.position ?? null, url: latest?.url ?? null,
      history: hist.map((h) => h.position).reverse(), volume: kd?.volume ?? null, difficulty: kd?.difficulty ?? null,
      competitorsInSerp: top.filter((t) => site.competitors.includes(t.d)) };
  });

  const domains = [site.host, ...site.competitors].map((d) => db.prepare('SELECT * FROM domain_snapshots WHERE domain=? ORDER BY fetched_on DESC LIMIT 1').get(d) || { domain: d });
  const jobs = db.prepare('SELECT job, finished_at, ok, message FROM job_log WHERE site=? ORDER BY id DESC LIMIT 10').all(site.slug);
  return { site: { slug: site.slug, name: site.name, url: site.url, host: site.host, competitors: site.competitors },
    audit: audit ? { ...audit, issue_counts: JSON.parse(audit.issue_counts || '{}') } : null, issues, scoreHistory,
    gsc: { daily: gscDaily, topQueries, topPages, strikingDistance, periodEnd: qEnd },
    ranks, domains, gap: keywordGap(site), jobs,
    locations: locationRows(site), recentReviews: recentReviews(site) };
}

export function issueDetail(site, code) {
  const audit = db.prepare('SELECT id FROM audits WHERE site=? ORDER BY id DESC LIMIT 1').get(site.slug);
  if (!audit) return [];
  return db.prepare('SELECT url, detail, severity FROM audit_issues WHERE audit_id=? AND code=? ORDER BY url').all(audit.id, code);
}

// ---- Local SEO ----
export function locationRows(site) {
  return site.locations.map((loc) => {
    const g = db.prepare('SELECT * FROM gbp_snapshots WHERE site=? AND location=? ORDER BY fetched_on DESC LIMIT 1').get(site.slug, loc.slug);
    const rev30 = db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN replied=0 THEN 1 ELSE 0 END) unreplied, AVG(rating) avg FROM gbp_reviews
      WHERE site=? AND location=? AND created_at >= date('now','-30 days')`).get(site.slug, loc.slug);
    const unreplied = db.prepare('SELECT COUNT(*) n FROM gbp_reviews WHERE site=? AND location=? AND replied=0').get(site.slug, loc.slug)?.n ?? 0;
    const low = db.prepare(`SELECT COUNT(*) n FROM gbp_reviews WHERE site=? AND location=? AND rating<=2 AND created_at >= date('now','-90 days')`).get(site.slug, loc.slug)?.n ?? 0;
    const perf = db.prepare(`SELECT SUM(impressions_search+impressions_maps) views, SUM(calls) calls, SUM(directions) directions, SUM(website_clicks) website
      FROM gbp_daily WHERE site=? AND location=? AND date >= date((SELECT MAX(date) FROM gbp_daily WHERE site=? AND location=?), '-27 days')`).get(site.slug, loc.slug, site.slug, loc.slug);
    const rankDate = db.prepare('SELECT MAX(checked_on) d FROM local_ranks WHERE site=? AND location=?').get(site.slug, loc.slug)?.d;
    const ranks = rankDate ? db.prepare('SELECT keyword, map_pack, organic, top_pack FROM local_ranks WHERE site=? AND location=? AND checked_on=?').all(site.slug, loc.slug, rankDate)
      .map((r) => ({ ...r, top_pack: JSON.parse(r.top_pack || '[]'), prev: db.prepare('SELECT map_pack FROM local_ranks WHERE site=? AND location=? AND keyword=? AND checked_on<? ORDER BY checked_on DESC LIMIT 1').get(site.slug, loc.slug, r.keyword, rankDate)?.map_pack ?? null })) : [];
    const napDate = db.prepare('SELECT MAX(checked_on) d FROM nap_checks WHERE site=? AND location=?').get(site.slug, loc.slug)?.d;
    const nap = napDate ? db.prepare('SELECT source,name_ok,address_ok,phone_ok,detail FROM nap_checks WHERE site=? AND location=? AND checked_on=?').all(site.slug, loc.slug, napDate) : [];
    const napIssues = nap.flatMap((c) => [!c.name_ok && `${c.source}: name`, !c.address_ok && `${c.source}: address`, !c.phone_ok && `${c.source}: phone`].filter(Boolean));
    // Attention score: what most needs a human. Higher = worse.
    let attention = 0;
    if (g && g.completeness < 80) attention += 2;
    if (low) attention += 3 * low;
    if (unreplied) attention += Math.min(unreplied, 5);
    if (g && g.rating != null && g.rating < 4.3) attention += 2;
    if (napIssues.length) attention += 2 * napIssues.length;
    if (ranks.length && ranks.every((r) => r.map_pack == null)) attention += 3;
    if (g?.open_status && g.open_status !== 'OPEN') attention += 5;
    return { slug: loc.slug, name: loc.name, town: loc.town, url: loc.url, hasGbp: Boolean(loc.gbpLocationId),
      listing: g ? { rating: g.rating, reviews: g.review_count, completeness: g.completeness, category: g.primary_category, photos: g.photo_count, openStatus: g.open_status, fetched: g.fetched_on } : null,
      reviews: { last30: rev30?.n ?? 0, avg30: rev30?.avg ?? null, unreplied, lowRecent: low },
      performance: perf?.views != null ? perf : null, ranks, nap, napIssues, attention };
  });
}

export function allLocations(sites) {
  return sites.flatMap((s) => locationRows(s).map((l) => ({ ...l, site: s.slug, brand: s.name })))
    .sort((a, b) => b.attention - a.attention || a.brand.localeCompare(b.brand));
}

export function recentReviews(site, limit = 30) {
  return db.prepare('SELECT location, created_at, rating, reviewer, comment, replied FROM gbp_reviews WHERE site=? ORDER BY created_at DESC LIMIT ?').all(site.slug, limit);
}
