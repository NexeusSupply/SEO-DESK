// Local SEO checks that don't need Business Profile access: map-pack rankings per town, and NAP consistency.
import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { db, today, logJob } from '../db.js';
import { localSerp } from './dataforseo.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const normPhone = (s) => (s || '').replace(/\D/g, '').replace(/^64/, '0');
const streetPart = (addr) => norm((addr || '').split(',')[0]);

export function keywordsFor(site, loc) {
  const tpl = [...site.localKeywords, ...loc.keywords];
  return [...new Set(tpl.map((k) => k.replace(/\{town\}/gi, loc.town || loc.name)))];
}

export async function trackLocalRanks(site) {
  const locs = site.locations.filter((l) => l.lat != null && l.lng != null);
  if (!locs.length) return 'no locations with lat/lng';
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  return logJob('local-ranks', site.slug, async () => {
    const up = db.prepare('INSERT OR REPLACE INTO local_ranks (site,location,keyword,checked_on,map_pack,organic,top_pack) VALUES (?,?,?,?,?,?,?)');
    let n = 0;
    for (const loc of locs) for (const kw of keywordsFor(site, loc)) {
      const { pack, organic } = await localSerp(kw, loc.lat, loc.lng);
      const isMine = (x) => norm(x.title).includes(norm(loc.name).slice(0, 12)) || norm(x.title).includes(norm(site.name)) || normPhone(x.phone) === normPhone(loc.phone)
        || (x.domain && x.domain === site.host);
      const packPos = pack.find(isMine)?.position ?? null;
      const orgPos = organic.find((o) => o.domain === site.host || o.domain.endsWith('.' + site.host))?.position ?? null;
      up.run(site.slug, loc.slug, kw, today(), packPos, orgPos, JSON.stringify(pack.slice(0, 5).map((p) => ({ p: p.position, t: p.title, r: p.rating }))));
      n++; await sleep(300);
    }
    return `${n} local checks across ${locs.length} locations`;
  });
}

/** Does the location's own web page and its Business Profile show the same name / address / phone as configured? */
export async function checkNap(site) {
  const locs = site.locations.filter((l) => l.address || l.phone);
  if (!locs.length) return 'no locations with address/phone';
  return logJob('nap', site.slug, async () => {
    const up = db.prepare('INSERT OR REPLACE INTO nap_checks (site,location,checked_on,source,name_ok,address_ok,phone_ok,detail) VALUES (?,?,?,?,?,?,?,?)');
    for (const loc of locs) {
      if (loc.url) {
        try {
          const html = await (await fetch(loc.url, { headers: { 'user-agent': config.crawl.userAgent }, signal: AbortSignal.timeout(20000) })).text();
          const $ = cheerio.load(html);
          const text = $('body').text();
          const tel = $('a[href^="tel:"]').map((_, a) => $(a).attr('href').replace('tel:', '')).get().join(' ') + ' ' + text;
          const ld = $('script[type="application/ld+json"]').map((_, s) => $(s).html()).get().join(' ');
          const nameOk = norm(text + ld).includes(norm(loc.name)) || norm(text).includes(norm(site.name));
          const addrOk = !loc.address || norm(text + ld).includes(streetPart(loc.address));
          const phoneOk = !loc.phone || normPhone(tel).includes(normPhone(loc.phone));
          const hasLocalSchema = /LocalBusiness|VeterinaryCare|Veterinary/.test(ld);
          up.run(site.slug, loc.slug, today(), 'website', nameOk ? 1 : 0, addrOk ? 1 : 0, phoneOk ? 1 : 0, hasLocalSchema ? 'LocalBusiness schema present' : 'No LocalBusiness/VeterinaryCare schema markup');
        } catch (e) { up.run(site.slug, loc.slug, today(), 'website', 0, 0, 0, `Page fetch failed: ${e.message}`); }
      }
      const g = db.prepare('SELECT title,address,phone FROM gbp_snapshots WHERE site=? AND location=? ORDER BY fetched_on DESC LIMIT 1').get(site.slug, loc.slug);
      if (g) up.run(site.slug, loc.slug, today(), 'business-profile', norm(g.title) === norm(loc.name) ? 1 : 0,
        !loc.address || norm(g.address).includes(streetPart(loc.address)) ? 1 : 0, !loc.phone || normPhone(g.phone) === normPhone(loc.phone) ? 1 : 0,
        [g.title !== loc.name ? `Listing name: "${g.title}"` : '', normPhone(g.phone) !== normPhone(loc.phone) ? `Listing phone: ${g.phone}` : ''].filter(Boolean).join('; '));
    }
    return `${locs.length} locations checked`;
  });
}
