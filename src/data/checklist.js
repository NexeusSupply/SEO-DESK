// Top-3 local SEO checklist for each clinic, from Localo's study of what map-pack winners have in common
// (https://localo.com/blog/top-local-seo-ranking-factors). Each item is worked out from data we already sync where we
// can (Google listing, reviews, details check). Anything we can't see, such as citations or social links on the
// listing, starts as "not checked" and someone ticks it by hand. A ticked answer only counts while we have no data
// of our own for that item.
import { db, now } from '../db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS local_checklist (
  site TEXT, location TEXT, item TEXT, done INTEGER, updated_at TEXT, updated_by TEXT,
  PRIMARY KEY (site, location, item)
);
`);

const num = (v) => v == null ? null : Number(v);
const atLeast = (v, min) => v == null ? null : v >= min;
const plural = (v, one, many = `${one}s`) => `${v} ${v === 1 ? one : many}`;

/**
 * group: 'basics' is Localo's eight-point completeness check (only 43% of #1 listings pass all eight);
 * 'top3' is what separates the top three from the rest. check(ctx) returns { done: true|false|null, value }.
 * done null means we can't tell, so a person's tick decides.
 */
export const ITEMS = [
  { key: 'verified', group: 'basics', label: 'Verified listing',
    tip: 'The Google listing is claimed and verified by the clinic. 95% of top-3 listings are verified against 83% of those off page one. If it isn’t, verify it from Google Business Profile (postcard, phone or video) before anything else.',
    check: ({ g }) => ({ done: g?.claimed == null ? null : Boolean(g.claimed), value: g?.claimed == null ? null : g.claimed ? 'Claimed' : 'Not claimed' }) },
  { key: 'website', group: 'basics', label: 'Website linked',
    tip: 'The listing links to the clinic’s website, ideally its own clinic page rather than the brand home page. Add it under Edit profile → Contact.',
    check: ({ g }) => ({ done: g ? Boolean(g.website) : null, value: g?.website ? g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : null }) },
  { key: 'description', group: 'basics', label: 'Business description',
    tip: 'A short, accurate description of the clinic. Length doesn’t matter (100–200 characters does as well as longer), but having one does, and words in it that match what people search for help a little. Write it once and leave it.',
    check: ({ g }) => ({ done: g ? Boolean(g.has_description) : null, value: g ? (g.has_description ? 'Written' : 'Missing') : null }) },
  { key: 'category1', group: 'basics', label: 'At least one extra category',
    tip: 'Besides the main category (Veterinarian), the listing has at least one additional category, such as Animal hospital, Emergency veterinarian service or Pet groomer. Listings with none are much less likely to be in the top 3.',
    check: ({ g }) => ({ done: atLeast(num(g?.additional_categories), 1), value: g?.additional_categories == null ? null : plural(g.additional_categories, 'extra category', 'extra categories') }) },
  { key: 'reviews10', group: 'basics', label: '10+ reviews',
    tip: 'At least 10 Google reviews. Ask happy clients at checkout or in a follow-up text or email with the clinic’s review link.',
    check: ({ g }) => ({ done: atLeast(num(g?.review_count), 10), value: g?.review_count == null ? null : plural(g.review_count, 'review') }) },
  { key: 'photos10', group: 'basics', label: '10+ photos',
    tip: 'At least 10 photos on the listing: outside (so people recognise it), reception, consult rooms, the team and patients.',
    check: ({ g }) => ({ done: atLeast(num(g?.photo_count), 10), value: g?.photo_count == null ? null : plural(g.photo_count, 'photo') }) },
  { key: 'citations10', group: 'basics', label: '10+ citations',
    tip: 'The clinic’s name, address and phone are listed on at least 10 other sites, such as Apple Maps, Bing Places, Facebook, Yellow, Finda, NZ Vets directories and local business directories. We can’t count these automatically yet, so tick it once checked.',
    check: () => ({ done: null, value: null }) },
  { key: 'social1', group: 'basics', label: 'A social link on the listing',
    tip: 'The listing links to at least one social profile (Facebook first). Add it under Edit profile → Contact → Social profiles. We can’t read this from the listing, so tick it once added.',
    check: () => ({ done: null, value: null }) },

  { key: 'reviews80', group: 'top3', label: 'About 80+ reviews',
    tip: 'The typical #1 listing has 79 reviews, #3 has 62 and #11 and below 25. Review count is the strongest factor in the study. Keep asking, aiming for about 100; the gains flatten past a few hundred.',
    check: ({ g }) => ({ done: atLeast(num(g?.review_count), 80), value: g?.review_count == null ? null : `${g.review_count} of 80` }) },
  { key: 'photos40', group: 'top3', label: '40+ photos',
    tip: 'The typical #1 listing has 44 photos against 35 at #3. Photos are the biggest gap between #1 and #2, and more keeps helping with no ceiling found. Add a few fresh ones every month.',
    check: ({ g }) => ({ done: atLeast(num(g?.photo_count), 40), value: g?.photo_count == null ? null : `${g.photo_count} of 40` }) },
  { key: 'rating45', group: 'top3', label: 'Rating 4.5 or higher',
    tip: '84% of #1 listings are rated 4.5 or more; under 4.0, fewer than half make the top 3. 4.7–4.9 does best. A perfect 5.0 usually just means too few reviews, so more reviews matter more than a perfect score.',
    check: ({ g }) => ({ done: g?.rating == null ? null : g.rating >= 4.5, value: g?.rating == null ? null : `${Number(g.rating).toFixed(1)} ★` }) },
  { key: 'categories6', group: 'top3', label: 'Six extra categories',
    tip: 'Top-3 chances peak with six additional categories (the average #1 listing has 3.7). Add every one that honestly fits: Animal hospital, Emergency veterinarian service, Veterinary pharmacy, Pet groomer, Pet boarding service, Livestock veterinarian and so on. Competitors’ categories are public, so check theirs for ideas.',
    check: ({ g }) => ({ done: atLeast(num(g?.additional_categories), 6), value: g?.additional_categories == null ? null : `${g.additional_categories} of 6` }) },
  { key: 'citations21', group: 'top3', label: '21+ citations',
    tip: 'Top-3 listings have 21–27 citations against 14 below page one. Build to about 25, then stop: past 30 adds little. Make sure each one shows the same name, address and phone as the Google listing. Tick it once checked.',
    check: () => ({ done: null, value: null }) },
  { key: 'social3', group: 'top3', label: '3+ social links',
    tip: 'Three social links on the listing reaches the competitive level and five is the plateau. Facebook and YouTube help most, then Instagram and TikTok. Tick it once added.',
    check: () => ({ done: null, value: null }) },
  { key: 'posts', group: 'top3', label: 'Posting on Google (10+ live posts)',
    tip: 'Listings with Google posts are more often in the top 3, and those with 10 or more live posts do best. What the post says, how long it is and how often you post make no measurable difference, so write for clients: news, offers, seasonal reminders.',
    check: ({ g }) => ({ done: atLeast(num(g?.posts), 10), value: g?.posts == null ? null : `${g.posts} live` }) },
  { key: 'nap', group: 'top3', label: 'Name, address and phone match',
    tip: 'The clinic’s name, address and phone are the same on its Google listing, its website and our records. Use the clinic’s real name only: adding keywords or the town to the name breaks Google’s rules. See “Do the details match?” above for what differs.',
    check: ({ nap }) => !nap.length ? { done: null, value: null }
      : nap.every((x) => x.name_ok && x.address_ok && x.phone_ok) ? { done: true, value: 'All match' } : { done: false, value: 'Mismatch found' } },
];
const KEYS = new Set(ITEMS.map((i) => i.key));

/** The checklist for one clinic. g is its latest listing snapshot (or null), nap its latest details checks. */
export function clinicChecklist(site, loc, g, nap = []) {
  const ticks = Object.fromEntries(db.prepare('SELECT item, done, updated_at, updated_by FROM local_checklist WHERE site=? AND location=?')
    .all(site.slug, loc.slug).map((r) => [r.item, r]));
  const items = ITEMS.map(({ key, group, label, tip, check }) => {
    const auto = check({ g, nap });
    const t = ticks[key];
    if (auto.done != null) return { key, group, label, tip, status: auto.done ? 'done' : 'todo', value: auto.value, source: 'auto' };
    return { key, group, label, tip, value: auto.value, source: 'manual',
      status: t?.done == null ? 'unknown' : t.done ? 'done' : 'todo', tickedBy: t?.updated_by ?? null, tickedAt: t?.updated_at ?? null };
  });
  const count = (grp) => { const xs = items.filter((i) => i.group === grp); return { done: xs.filter((i) => i.status === 'done').length, total: xs.length }; };
  return { items, basics: count('basics'), top3: count('top3'), done: items.filter((i) => i.status === 'done').length, total: items.length };
}

/** Tick or untick an item by hand. done: true, false, or null to go back to "not checked". */
export function setChecklistItem(site, loc, item, done, by) {
  if (!KEYS.has(item)) throw new Error('unknown checklist item');
  if (done == null) db.prepare('DELETE FROM local_checklist WHERE site=? AND location=? AND item=?').run(site.slug, loc.slug, item);
  else db.prepare('INSERT OR REPLACE INTO local_checklist (site,location,item,done,updated_at,updated_by) VALUES (?,?,?,?,?,?)')
    .run(site.slug, loc.slug, item, done ? 1 : 0, now(), by || null);
}
