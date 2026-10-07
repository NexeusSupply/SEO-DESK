// Read-side queries that feed the dashboard and digest.
import { db } from './db.js';
import { config } from './config.js';
import { ISSUE_LABELS } from './audit/rules.js';
import { keywordGap } from './data/competitors.js';
import { googleTransparencyUrl, metaAdLibraryUrl, RUNNING_DAYS } from './data/ads.js';

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
      slug: s.slug, name: s.name, url: s.url, host: s.host, group: s.group, logo: s.logo,
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
    locations: locationRows(site), recentReviews: recentReviews(site), connections: connections(site),
    social: socialSummary(site), comments: socialComments([site], { limit: 40 }), ads: adsSummary(site) };
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
    return { slug: loc.slug, name: loc.name, town: loc.town, url: loc.url, hasGbp: Boolean(listingSource(loc)),
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

// ---- Ads ----

/** Google ads seen for the brand's domain in the last search, running ones first, plus links to both public ad libraries. */
export function adsSummary(site, limit = 24) {
  const checked = db.prepare("SELECT MAX(posted_on) d FROM dfs_tasks WHERE kind='ads' AND site=? AND status='done'").get(site.slug)?.d ?? null;
  const pending = Boolean(db.prepare("SELECT 1 FROM dfs_tasks WHERE kind='ads' AND site=? AND status='posted'").get(site.slug));
  const rows = checked ? db.prepare(`SELECT creative_id, advertiser, advertiser_id, verified, format, image, preview_url, url, first_shown, last_shown,
    last_shown >= strftime('%Y-%m-%dT%H:%M:%S', fetched_on, '-${RUNNING_DAYS} days') running
    FROM google_ads WHERE site=? ORDER BY running DESC, last_shown DESC`).all(site.slug) : [];
  return { checked, pending, running: rows.filter((r) => r.running).length, total: rows.length, ads: rows.slice(0, limit),
    googleUrl: googleTransparencyUrl(site), metaUrl: metaAdLibraryUrl(site), metaByPage: Boolean(site.meta?.pageId) };
}

/** Every brand's ads at a glance, for the Ads page. */
export function allAds(sites) {
  return sites.map((s) => { const a = adsSummary(s, 6); return { slug: s.slug, name: s.name, group: s.group, host: s.host, ...a }; });
}

// ---- Facebook and Instagram ----

/** Followers, 28-day insight totals against the 28 days before, and recent posts, per platform. */
export function socialSummary(site) {
  const platforms = db.prepare('SELECT DISTINCT platform FROM meta_snapshots WHERE site=? ORDER BY platform').all(site.slug).map((r) => r.platform);
  const out = platforms.map((platform) => {
    const snap = db.prepare('SELECT * FROM meta_snapshots WHERE site=? AND platform=? ORDER BY fetched_on DESC LIMIT 1').get(site.slug, platform);
    const prev = db.prepare(`SELECT followers FROM meta_snapshots WHERE site=? AND platform=? AND fetched_on <= date(?, '-28 days') ORDER BY fetched_on DESC LIMIT 1`).get(site.slug, platform, snap.fetched_on);
    const end = db.prepare('SELECT MAX(date) d FROM meta_daily WHERE site=? AND platform=?').get(site.slug, platform)?.d;
    const totals = (from, to) => Object.fromEntries(db.prepare(`SELECT metric, SUM(value) v FROM meta_daily WHERE site=? AND platform=? AND date > date(?, ?) AND date <= date(?, ?) GROUP BY metric`)
      .all(site.slug, platform, end, `-${from} days`, end, `-${to} days`).map((r) => [r.metric, r.v]));
    const daily = end ? db.prepare(`SELECT date, SUM(CASE WHEN metric='views' THEN value END) views, SUM(CASE WHEN metric='engagements' THEN value END) engagements
      FROM meta_daily WHERE site=? AND platform=? AND date > date(?, '-90 days') GROUP BY date ORDER BY date`).all(site.slug, platform, end) : [];
    return { platform, name: snap.name, followers: snap.followers, prevFollowers: prev?.followers ?? null, fetched: snap.fetched_on,
      last28: end ? totals(28, 0) : {}, prev28: end ? totals(56, 28) : {}, daily };
  });
  const posts = db.prepare('SELECT post_id, platform, created_at, message, permalink, media_type, likes, comments, shares FROM meta_posts WHERE site=? ORDER BY created_at DESC LIMIT 20').all(site.slug);
  const unanswered = db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN created_at < strftime('%Y-%m-%dT%H:%M:%S','now','-1 day') THEN 1 ELSE 0 END) old FROM meta_comments WHERE site=? AND replied=0 AND hidden=0`).get(site.slug);
  return { platforms: out, posts, unanswered: unanswered?.n ?? 0, unansweredOld: unanswered?.old ?? 0 };
}

/** The comments inbox: unanswered first, newest first within that. */
export function socialComments(sites, { status = 'open', limit = 100 } = {}) {
  if (!sites.length) return [];
  const names = Object.fromEntries(sites.map((s) => [s.slug, s.name]));
  const where = status === 'open' ? 'AND c.replied=0 AND c.hidden=0' : '';
  return db.prepare(`SELECT c.*, p.message post_message, p.permalink post_permalink FROM meta_comments c LEFT JOIN meta_posts p ON p.post_id=c.post_id
    WHERE c.site IN (${sites.map(() => '?').join(',')}) ${where} ORDER BY c.replied, c.created_at DESC LIMIT ?`).all(...sites.map((s) => s.slug), limit)
    .map((c) => ({ ...c, brand: names[c.site] }));
}

// ---- Connection status, groups and the management view ----

const lastOk = (job, site) => db.prepare('SELECT finished_at FROM job_log WHERE job=? AND site=? AND ok=1 ORDER BY id DESC LIMIT 1').get(job, site)?.finished_at;

/** Can any configured source read this clinic's listing? The API needs gbpLocationId; DataForSEO needs a way to find it. */
const listingSource = (l) => (config.gbp.enabled && l.gbpLocationId) || (config.dfs.enabled && (l.placeId || l.cid || (l.lat != null && l.lng != null)));

/** Per-module status for a brand: connected | not_connected | no_data (connected but nothing fetched yet). */
export function connections(site) {
  const has = (q, ...a) => Boolean(db.prepare(q).get(...a));
  const st = (configured, enabled, hasData) => hasData ? 'connected' : configured && enabled ? 'no_data' : 'not_connected';
  return {
    audit: has('SELECT 1 FROM audits WHERE site=?', site.slug) ? 'connected' : 'no_data',
    searchConsole: st(Boolean(site.gscProperty), config.gsc.enabled, has('SELECT 1 FROM gsc_daily WHERE site=?', site.slug)),
    ranks: st(site.keywords.length > 0, config.dfs.enabled, has('SELECT 1 FROM ranks WHERE site=?', site.slug)),
    listings: st(site.locations.some(listingSource), config.gbp.enabled || config.dfs.enabled, has('SELECT 1 FROM gbp_snapshots WHERE site=?', site.slug)),
    localRanks: st(site.locations.some((l) => l.lat != null), config.dfs.enabled, has('SELECT 1 FROM local_ranks WHERE site=?', site.slug)),
    // Until the Meta token exists the whole feature is "coming soon" rather than "not connected" per brand.
    ads: st(true, config.dfs.enabled, has("SELECT 1 FROM dfs_tasks WHERE kind='ads' AND site=? AND status='done'", site.slug)),
    social: !config.meta.enabled ? 'coming_soon' : st(Boolean(site.meta), config.meta.enabled, has('SELECT 1 FROM meta_snapshots WHERE site=?', site.slug)),
    listingsConnected: site.locations.filter(listingSource).length, listingsTotal: site.locations.length,
  };
}

const pctChange = (cur, prev) => cur == null || prev == null || prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

/** One brand row for the management page. */
export function brandSignal(site) {
  const o = overview([site])[0];
  const conn = connections(site);
  const locs = locationRows(site);
  const connectedLocs = locs.filter((l) => l.listing);
  const changes = [];
  const reasons = [];
  let level = 0; // 0 good, 1 watch, 2 problem

  const clicks = o.gsc ? pctChange(o.gsc.clicks, o.gsc.prevClicks) : null;
  if (clicks != null) {
    changes.push(`${clicks >= 0 ? '+' : ''}${clicks}% search clicks`);
    if (clicks <= -20) { level = Math.max(level, 2); reasons.push('search traffic down sharply'); }
    else if (clicks <= -5) { level = Math.max(level, 1); reasons.push('search traffic slipping'); }
  }
  if (o.audit) {
    if (o.audit.prevScore != null && o.audit.score !== o.audit.prevScore) changes.push(`site health ${o.audit.prevScore} → ${o.audit.score}`);
    const errors = o.audit.issue_counts.error || 0;
    if (o.audit.score < 60 || errors >= 10) { level = Math.max(level, 2); reasons.push('site health poor'); }
    else if (o.audit.score < 80 || errors > 0) { level = Math.max(level, 1); reasons.push('site issues to fix'); }
  }
  if (connectedLocs.length) {
    const rating = connectedLocs.reduce((a, l) => a + (l.listing.rating || 0), 0) / connectedLocs.filter((l) => l.listing.rating).length || null;
    const prevRating = db.prepare(`SELECT AVG(rating) r FROM gbp_snapshots WHERE site=? AND fetched_on <= date('now','-28 days') AND fetched_on > date('now','-42 days')`).get(site.slug)?.r;
    if (rating && prevRating && Math.abs(rating - prevRating) >= 0.05) changes.push(`rating ${prevRating.toFixed(1)} → ${rating.toFixed(1)}`);
    const lowReviews = connectedLocs.reduce((a, l) => a + l.reviews.lowRecent, 0);
    const unreplied = connectedLocs.reduce((a, l) => a + l.reviews.unreplied, 0);
    const newReviews = connectedLocs.reduce((a, l) => a + l.reviews.last30, 0);
    if (newReviews) changes.push(`${newReviews} new review${newReviews > 1 ? 's' : ''}`);
    if (lowReviews >= 3 || connectedLocs.some((l) => l.listing.openStatus && l.listing.openStatus !== 'OPEN')) { level = Math.max(level, 2); reasons.push(lowReviews >= 3 ? 'several poor reviews' : 'a listing shows as closed'); }
    else if (lowReviews || unreplied >= 5) { level = Math.max(level, 1); reasons.push(lowReviews ? 'a poor review' : `${unreplied} reviews unanswered`); }
    const inPack = locs.filter((l) => l.ranks.some((r) => r.map_pack != null && r.map_pack <= 3)).length;
    const checked = locs.filter((l) => l.ranks.length).length;
    if (checked) {
      changes.push(`${inPack} of ${checked} clinics in the top 3 locally`);
      if (inPack / checked < 0.5) level = Math.max(level, 1);
    }
    const nap = locs.filter((l) => l.napIssues.length).length;
    if (nap) { level = Math.max(level, 1); reasons.push(`${nap} clinic${nap > 1 ? 's' : ''} with mismatched contact details`); }
  }
  if (conn.social === 'connected') {
    const social = socialSummary(site);
    const gained = social.platforms.reduce((a, p) => a + (p.followers != null && p.prevFollowers != null ? p.followers - p.prevFollowers : 0), 0);
    if (social.platforms.some((p) => p.prevFollowers != null) && gained) changes.push(`${gained > 0 ? '+' : ''}${gained} social followers`);
    if (social.unansweredOld >= 5) { level = Math.max(level, 1); reasons.push(`${social.unansweredOld} Facebook/Instagram comments unanswered`); }
  }
  const anyConnected = ['searchConsole', 'ranks', 'listings', 'localRanks', 'social'].some((k) => conn[k] === 'connected') || conn.audit === 'connected';
  return {
    slug: site.slug, name: site.name, group: site.group, host: site.host,
    signal: !anyConnected ? 'not_connected' : ['good', 'watch', 'problem'][level],
    reasons, changes: changes.slice(0, 3), connections: conn,
    metrics: { clicks: o.gsc?.clicks ?? null, clicksChange: clicks, score: o.audit?.score ?? null,
      rating: connectedLocs.length ? +(connectedLocs.reduce((a, l) => a + (l.listing.rating || 0), 0) / (connectedLocs.filter((l) => l.listing.rating).length || 1)).toFixed(1) : null,
      clinics: site.locations.length, clinicsConnected: connectedLocs.length },
  };
}

/** The management landing page: one block per group. */
export function management(sites) {
  const groups = [...new Set(sites.map((s) => s.group))];
  return groups.map((g) => {
    const brands = sites.filter((s) => s.group === g).map(brandSignal);
    const connected = brands.filter((b) => b.signal !== 'not_connected');
    const withClicks = connected.filter((b) => b.metrics.clicks != null);
    const clicks = withClicks.reduce((a, b) => a + b.metrics.clicks, 0);
    const prevClicks = withClicks.reduce((a, b) => a + (b.metrics.clicksChange != null ? b.metrics.clicks / (1 + b.metrics.clicksChange / 100) : b.metrics.clicks), 0);
    const rated = connected.filter((b) => b.metrics.rating);
    const listingsConnected = brands.reduce((a, b) => a + b.connections.listingsConnected, 0);
    const listingsTotal = brands.reduce((a, b) => a + b.connections.listingsTotal, 0);
    const scored = connected.filter((b) => b.metrics.score != null);
    return {
      group: g,
      headline: {
        brands: brands.length, brandsConnected: connected.length,
        clinics: brands.reduce((a, b) => a + b.metrics.clinics, 0), listingsConnected, listingsTotal,
        clicks: withClicks.length ? clicks : null, clicksChange: withClicks.length && prevClicks ? Math.round(((clicks - prevClicks) / prevClicks) * 100) : null,
        rating: rated.length ? +(rated.reduce((a, b) => a + b.metrics.rating, 0) / rated.length).toFixed(1) : null,
        health: scored.length ? Math.round(scored.reduce((a, b) => a + b.metrics.score, 0) / scored.length) : null,
        problems: brands.filter((b) => b.signal === 'problem').length, watch: brands.filter((b) => b.signal === 'watch').length,
      },
      brands: brands.sort((a, b) => ({ problem: 0, watch: 1, good: 2, not_connected: 3 }[a.signal] - { problem: 0, watch: 1, good: 2, not_connected: 3 }[b.signal]) || a.name.localeCompare(b.name)),
    };
  });
}
