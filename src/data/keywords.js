// Keyword research per clinic: which searches to target with SEO and which to bid on in Google Ads. Seed searches are
// built from the clinic's town and services, Google Ads' Keyword Planner (through DataForSEO) suggests related searches
// with monthly volume, competition and bid ranges, and DataForSEO Labs adds SEO difficulty. Research runs on demand
// (a button on the clinic page, or `npm run keywords [brand]`) and is kept for a month; clinics with the same seeds
// share one result. Whether a keyword suits SEO or Ads, and where we already rank, is worked out when the page reads it.
import { config } from '../config.js';
import { db, today, logJob } from '../db.js';
import { keywordIdeas, keywordsForSite, keywordDifficultyRaw, recordSpend, underCap } from './dataforseo.js';

const COST_EST = 0.1;      // USD per clinic (Keyword Planner ideas + Labs difficulty), for the pre-flight cap check only
const FRESH_DAYS = 30;     // research this recent is reused instead of asking again
const MAX_SEEDS = 20;      // Keyword Planner's limit per request
const MAX_KEEP = 150;

db.exec(`
CREATE TABLE IF NOT EXISTS keyword_research (
  site TEXT, location TEXT, fetched_on TEXT, seeds TEXT, items TEXT, cost REAL,
  PRIMARY KEY (site, location)
);
`);

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// Seed templates by the services a clinic offers (sites.json `services`, from the clinic list's CA/Mixed/PA/Equine columns).
const SEEDS = {
  base: ['vet {town}', 'vets {town}', 'veterinary clinic {town}', 'emergency vet {town}', 'after hours vet {town}'],
  companion: ['dog vet {town}', 'cat vet {town}', 'puppy vaccinations {town}', 'desexing {town}', 'pet dental {town}'],
  farm: ['farm vet {town}', 'large animal vet {town}', 'dairy vet {town}', 'sheep vet {town}'],
  equine: ['equine vet {town}', 'horse vet {town}'],
};
const SERVICE_SEEDS = { companion: ['companion'], mixed: ['companion', 'farm'], farm: ['farm'], equine: ['equine'] };

/** The seed searches for one clinic: town and service templates, then sites.json keywordSeeds, then any extra words. */
export function seedsFor(site, loc, extra = []) {
  if (!loc.town) return [];
  const groups = [...new Set((loc.services?.length ? loc.services : ['companion']).flatMap((s) => SERVICE_SEEDS[s] || []))];
  const tpl = [...(loc.keywordSeeds || site.keywordSeeds || []), ...SEEDS.base, ...groups.flatMap((g) => SEEDS[g])];
  const fill = (t) => norm(t.replace(/\{town\}/gi, loc.town));
  // Extra words go first so they always fit in Google's 20; a bare word like "puppy school" gets the town added.
  const own = extra.map((x) => norm(x)).filter(Boolean).map((x) => x.includes(norm(loc.town)) || /near me/.test(x) ? x : `${x} ${norm(loc.town)}`);
  return [...new Set([...own, ...tpl.map(fill)])].slice(0, MAX_SEEDS);
}

// Searches that have nothing to do with a vet clinic get dropped from Google's suggestions.
const RELEVANT = /vet|veterinar|animal|pet|pupp|kitten|dog|cat\b|cats\b|desex|spay|neuter|vaccin|worm|flea|tick|microchip|horse|equine|farm|dairy|calf|calv|lamb|sheep|cattle|cow|livestock|clinic/;
// ...and so do ones about careers, insurance, shopping or pet services a clinic doesn't sell.
const UNRELATED = /\bjobs?\b|salary|career|course|degree|universit|nurse|insurance|groom|food|toy|for sale|adopt|rescue|spca|shop|store|bunnings|kennel/;

// For a brand-wide search only careers and study get dropped: a feed, lab or wholesale business sells far more than vet visits.
const CAREERS = /\bjobs?\b|salary|career|course|degree|universit/;
const COUNTRY_CODES = { NZ: 2554, AU: 2036 };
/** DataForSEO location for a brand: sites.json `market` ("NZ" or "AU"), else the default market. */
export const marketOf = (site) => COUNTRY_CODES[site.market] || config.dfs.location;

/** Brand-wide seeds: words typed in, then sites.json keywordSeeds and tracked keywords. Empty means "research the website itself". */
export function brandSeeds(site, extra = []) {
  return [...new Set([...extra, ...(site.keywordSeeds || []), ...site.keywords].map(norm).filter((x) => x && !x.includes('{town}')))].slice(0, MAX_SEEDS);
}

const blank = (keyword) => ({ keyword, volume: null, cpc: null, competition: null, competitionIndex: null, lowBid: null, highBid: null, trend: [] });

/**
 * Research one clinic (loc) or the whole brand (loc null) now. A clinic reuses a recent result for the same seeds
 * (another clinic in the same town), so only genuinely new research costs anything. Returns a short message.
 */
export async function researchClinic(site, loc, extra = []) {
  if (!config.dfs.enabled) throw new Error('DataForSEO not configured');
  const seeds = loc ? seedsFor(site, loc, extra) : brandSeeds(site, extra);
  if (loc && !seeds.length) throw new Error('this clinic has no town in sites.json, so there is nothing to search for');
  const where = loc ? loc.slug : '', label = loc ? loc.name : site.name, market = marketOf(site);
  // A brand with no seeds researches its own website, so its key includes the domain.
  const key = JSON.stringify(seeds.length ? (market === config.dfs.location ? seeds : [market, ...seeds]) : [`site:${site.host}`, market]);
  const ins = db.prepare('INSERT OR REPLACE INTO keyword_research (site,location,fetched_on,seeds,items,cost) VALUES (?,?,?,?,?,?)');
  const shared = db.prepare("SELECT items FROM keyword_research WHERE seeds=? AND fetched_on >= date('now', ?) ORDER BY fetched_on DESC LIMIT 1").get(key, `-${FRESH_DAYS} days`);
  if (shared) { ins.run(site.slug, where, today(), key, shared.items, 0); return `${label}: reused this month's research for the same searches`; }
  if (!underCap(COST_EST)) throw new Error(`the monthly DataForSEO cap (US$${config.dfs.monthlyCapUsd}) would be exceeded`);

  const ideas = seeds.length ? await keywordIdeas(seeds, market) : await keywordsForSite(site.host, market);
  let cost = ideas.cost;
  const bySeed = new Set(seeds);
  const fits = (k) => loc ? RELEVANT.test(k) && !UNRELATED.test(k) : !CAREERS.test(k);
  const kept = ideas.items
    .filter((k) => bySeed.has(norm(k.keyword)) || fits(norm(k.keyword)))
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1))
    .slice(0, MAX_KEEP);
  // Seeds Google had too little data on still show, so the page can say "too few searches" rather than hide them.
  for (const s of seeds) if (!kept.some((k) => norm(k.keyword) === s)) kept.push(blank(s));
  try {
    const kd = await keywordDifficultyRaw(kept.map((k) => k.keyword), market);
    cost += kd.cost;
    const map = new Map(kd.items.map((x) => [norm(x.keyword), x.difficulty]));
    for (const k of kept) k.difficulty = map.get(norm(k.keyword)) ?? null;
  } catch (e) { console.warn(`[keywords] difficulty for ${site.slug}/${where}: ${e.message}`); }
  for (const k of kept) { k.seed = bySeed.has(norm(k.keyword)); k.local = loc ? norm(k.keyword).includes(norm(loc.town)) : false; }
  ins.run(site.slug, where, today(), key, JSON.stringify(kept), cost);
  recordSpend('keywords', cost, 1);
  return `${label}: ${kept.length} keywords (US$${cost.toFixed(3)})`;
}

/** Job: research every clinic of a brand, or a brand without clinics as a whole, if missing or over a month old. */
export async function researchSite(site) {
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  const locs = site.locations.filter((l) => l.town);
  return logJob('keywords', site.slug, async () => {
    const fresh = new Set(db.prepare("SELECT location FROM keyword_research WHERE site=? AND fetched_on >= date('now', ?)").all(site.slug, `-${FRESH_DAYS} days`).map((r) => r.location));
    const todo = locs.length ? locs.filter((l) => !fresh.has(l.slug)) : fresh.has('') ? [] : [null];
    const out = [];
    for (const loc of todo) {
      try { out.push(await researchClinic(site, loc)); } catch (e) { out.push(`${loc?.name || site.name}: ${e.message}`); if (/cap/.test(e.message)) break; }
    }
    return out.length ? out.join('; ') : 'already researched this month';
  });
}

// ---- Reading research ----

const URGENT = /emergency|after ?hours|24 ?h(ou)?r|urgent|open now|near me|weekend|sunday|saturday/;

/** Where the clinic's website already shows for a search: its own map-pack checks first, then the brand's rank tracking and Labs data. */
function positions(site, loc) {
  const pos = new Map();
  const set = (kw, p, src) => { const k = norm(kw); if (p != null && (!pos.has(k) || p < pos.get(k).position)) pos.set(k, { position: p, source: src }); };
  const d = loc && db.prepare('SELECT MAX(checked_on) d FROM local_ranks WHERE site=? AND location=?').get(site.slug, loc.slug)?.d;
  if (d) for (const r of db.prepare('SELECT keyword, map_pack, organic FROM local_ranks WHERE site=? AND location=? AND checked_on=?').all(site.slug, loc.slug, d)) {
    set(r.keyword, r.organic, 'organic'); if (r.map_pack != null) pos.set(norm(r.keyword) + '|pack', { position: r.map_pack, source: 'map' });
  }
  for (const r of db.prepare('SELECT keyword, position FROM ranks WHERE site=? AND checked_on=(SELECT MAX(checked_on) FROM ranks WHERE site=?)').all(site.slug, site.slug)) set(r.keyword, r.position, 'organic');
  const ld = db.prepare('SELECT MAX(fetched_on) f FROM domain_keywords WHERE domain=?').get(site.host)?.f;
  if (ld) for (const r of db.prepare('SELECT keyword, position FROM domain_keywords WHERE domain=? AND fetched_on=?').all(site.host, ld)) set(r.keyword, r.position, 'organic');
  return pos;
}

/**
 * SEO, Ads, both, or neither, and why. Simple on purpose:
 * - SEO: people search it (10+ a month) and it isn't too hard (difficulty under 50, or unknown, which for small local
 *   searches usually means easy), and we aren't already in the top 3.
 * - Ads: urgent or "near me" searches (people ready to call now), searches advertisers compete for, or worthwhile
 *   searches too hard to win organically.
 */
function advise(k, pos) {
  const name = norm(k.keyword), vol = k.volume ?? 0, urgent = URGENT.test(name);
  const top3 = pos?.position != null && pos.position <= 3;
  const seo = vol >= 10 && (k.difficulty == null || k.difficulty < 50) && !top3;
  const ads = vol >= 10 && (urgent || ['HIGH', 'MEDIUM'].includes(k.competition) || (k.difficulty ?? 0) >= 50);
  const why = [];
  if (top3) why.push('already in the top 3');
  if (urgent) why.push('people searching this want a vet now');
  if (k.local) why.push('names the town');
  if (k.difficulty != null && k.difficulty >= 50) why.push('hard to rank for');
  else if (vol >= 10 && k.difficulty != null && k.difficulty < 30) why.push('easy to rank for');
  if (vol < 10) why.push(k.volume == null ? 'too few searches for Google to count' : 'very few searches');
  return { advice: seo && ads ? 'both' : seo ? 'seo' : ads ? 'ads' : 'watch', why };
}

/** The clinic's latest research with advice, plus counts for the page. */
export function keywordSummary(site, loc) {
  const row = db.prepare('SELECT * FROM keyword_research WHERE site=? AND location=?').get(site.slug, loc ? loc.slug : '');
  // What a new search would start from; a brand with no seeds researches its own website instead.
  const seeds = loc ? seedsFor(site, loc) : brandSeeds(site);
  const base = { seeds, fromSite: !loc && !seeds.length, market: site.market || 'NZ' };
  if (!row) return { ...base, researched: false, items: [], counts: null, available: loc ? Boolean(loc.town) : true };
  const pos = positions(site, loc);
  const items = JSON.parse(row.items).map((k) => {
    const p = pos.get(norm(k.keyword)), pack = pos.get(norm(k.keyword) + '|pack');
    return { ...k, position: p?.position ?? null, mapPack: pack?.position ?? null, ...advise(k, p) };
  });
  const count = (a) => items.filter((k) => k.advice === a || k.advice === 'both').length;
  return {
    ...base, researched: true, available: true, fetched: row.fetched_on, items,
    counts: { total: items.length, seo: count('seo'), ads: count('ads'), volume: items.reduce((a, k) => a + (k.volume || 0), 0),
      ranking: items.filter((k) => k.position != null && k.position <= 10).length },
  };
}
