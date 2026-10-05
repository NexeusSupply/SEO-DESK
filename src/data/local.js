// Local SEO checks that don't need Business Profile access: map-pack rankings per town, and NAP consistency.
import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { db, today, logJob } from '../db.js';
import { postMapsTasks, mapsTasksReady, getMapsTask, recordSpend, underCap } from './dataforseo.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const normPhone = (s) => (s || '').replace(/\D/g, '').replace(/^64/, '0');
const streetPart = (addr) => norm((addr || '').split(',')[0]);

export function keywordsFor(site, loc) {
  const tpl = [...site.localKeywords, ...loc.keywords];
  return [...new Set(tpl.map((k) => k.replace(/\{town\}/gi, loc.town || loc.name)))];
}

const MAPS_COST_EST = 0.002; // USD per standard-queue Maps task, used only for the pre-flight cap check

/** Monday job: post this week's map-pack checks to the standard queue. Results are collected by collectLocalRanks. */
export async function trackLocalRanks(site) {
  const locs = site.locations.filter((l) => l.lat != null && l.lng != null);
  if (!locs.length) return 'no locations with lat/lng';
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  return logJob('local-ranks', site.slug, async () => {
    const items = locs.flatMap((loc) => keywordsFor(site, loc).map((kw) => ({ keyword: kw, lat: loc.lat, lng: loc.lng, zoom: loc.zoom ?? 14, tag: `${site.slug}|${loc.slug}|${kw}` })));
    if (!items.length) return 'no local keywords';
    if (!underCap(items.length * MAPS_COST_EST)) return `skipped: monthly DataForSEO cap (US$${config.dfs.monthlyCapUsd}) would be exceeded`;
    // skip anything already posted this week
    const already = new Set(db.prepare("SELECT site||'|'||location||'|'||keyword k FROM dfs_tasks WHERE kind='maps' AND posted_on >= date('now','-6 days')").all().map((r) => r.k));
    const fresh = items.filter((i) => !already.has(i.tag));
    if (!fresh.length) return 'all checks already posted this week';
    const posted = await postMapsTasks(fresh);
    const ins = db.prepare('INSERT OR REPLACE INTO dfs_tasks (task_id,kind,site,location,keyword,posted_on,status,cost) VALUES (?,?,?,?,?,?,?,?)');
    let n = 0, cost = 0;
    for (const p of posted) {
      if (!p.ok) { console.warn(`[local:${site.slug}] task rejected: ${p.message}`); continue; }
      const [, loc, kw] = p.tag.split('|');
      ins.run(p.task_id, 'maps', site.slug, loc, kw, today(), 'posted', p.cost); n++; cost += p.cost;
    }
    recordSpend('maps', cost, n);
    return `${n} map-pack checks queued (US$${cost.toFixed(3)})`;
  });
}

/** Collect finished standard-queue tasks and store positions. Safe to run as often as you like. */
export async function collectLocalRanks(sites) {
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  const pending = db.prepare("SELECT * FROM dfs_tasks WHERE kind='maps' AND status='posted'").all();
  if (!pending.length) return 'nothing pending';
  const ready = new Set(await mapsTasksReady());
  const up = db.prepare('INSERT OR REPLACE INTO local_ranks (site,location,keyword,checked_on,map_pack,organic,top_pack) VALUES (?,?,?,?,?,?,?)');
  const done = db.prepare("UPDATE dfs_tasks SET status=?, cost=cost+? WHERE task_id=?");
  let n = 0;
  for (const t of pending) {
    if (!ready.has(t.task_id)) continue;
    const site = sites.find((s) => s.slug === t.site); const loc = site?.locations.find((l) => l.slug === t.location);
    if (!site || !loc) { done.run('orphaned', 0, t.task_id); continue; }
    try {
      const { items, cost } = await getMapsTask(t.task_id);
      const mine = items.find((i) => (loc.placeId && i.place_id === loc.placeId) || (loc.cid && String(i.cid) === String(loc.cid)))
        || items.find((i) => normPhone(i.phone) && normPhone(i.phone) === normPhone(loc.phone))
        || items.find((i) => norm(i.title).includes(norm(loc.name).slice(0, 14)));
      up.run(t.site, t.location, t.keyword, t.posted_on, mine?.position ?? null, null,
        JSON.stringify(items.slice(0, 5).map((i) => ({ p: i.position, t: i.title, r: i.rating, id: i.place_id }))));
      done.run('done', cost, t.task_id); recordSpend('maps-get', cost, 1); n++;
      await sleep(150);
    } catch (e) { console.warn(`[local-collect] ${t.task_id}: ${e.message}`); }
  }
  return `${n} results collected, ${pending.length - n} still pending`;
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
