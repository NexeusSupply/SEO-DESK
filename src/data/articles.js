// Shared articles: someone pastes in one article, Claude writes a localised version for each chosen brand (its towns,
// region, services and the searches its website is missing), and the team reviews, edits and approves each version
// before it goes anywhere. Approved versions go to WordPress sites through the REST API (as a draft by default, or
// published / scheduled when someone chooses that); for Rocketspark, Wix and the rest the page gives copy-ready text.
//
// Why localise instead of copying: the same article on several of our domains competes with itself, and Google shows
// one copy and filters the rest. A version that is genuinely rewritten for each brand's towns and services can rank
// on each site. A similarity check between versions flags any that are still too close to each other.
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { config, loadSites } from '../config.js';
import { db, now } from '../db.js';
import { keywordSummary } from './keywords.js';
import { aiSummary } from './ai.js';
import { keywordGap } from './competitors.js';

db.exec(`
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY, title TEXT, body TEXT, notes TEXT, created_at TEXT, created_by TEXT
);
CREATE TABLE IF NOT EXISTS article_versions (
  article_id INTEGER, site TEXT, status TEXT, title TEXT, slug TEXT, meta_description TEXT, focus_keyword TEXT,
  body_html TEXT, result TEXT, error TEXT, model TEXT, note TEXT, edited INTEGER DEFAULT 0, updated_at TEXT,
  approved_by TEXT, approved_at TEXT, cms_id TEXT, cms_link TEXT, cms_status TEXT, sent_at TEXT, sent_by TEXT,
  PRIMARY KEY (article_id, site)
);
`);
// A version still writing when the server stopped will never finish; let someone run it again.
db.prepare("UPDATE article_versions SET status='failed', error='Interrupted by a restart; write it again' WHERE status IN ('pending','writing')").run();

// ---- What each brand's website runs on, and whether we can post to it ----
export const CMS = {
  wordpress: 'WordPress', rocketspark: 'Rocketspark', wix: 'Wix', storbie: 'Storbie', silverstripe: 'Silverstripe', custom: 'Custom-built',
};
const envKey = (site) => `WP_${site.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
/** "username:application password" from WP_<SLUG>, or null. */
function wpCreds(site) {
  const v = process.env[envKey(site)] || '';
  const i = v.indexOf(':');
  return i > 0 ? { user: v.slice(0, i), pass: v.slice(i + 1).trim() } : null;
}
/** How a version for this brand gets onto its website. */
export function publishRoute(site) {
  const cms = site.cms || null;
  if (cms === 'wordpress') {
    return wpCreds(site) ? { cms, label: CMS[cms], push: true }
      : { cms, label: CMS[cms], push: false, envVar: envKey(site), note: `Add a WordPress application password as ${envKey(site)} on the server to send posts from here. Until then, copy it in.` };
  }
  const how = {
    rocketspark: 'Rocketspark has no API for blog posts. Copy the title, text and description into Blog → Add a post.',
    wix: 'Copy it into the Wix blog editor. (Wix has an API, but this site is dormant and not connected.)',
    storbie: 'Copy it into the Storbie editor. We don’t hold a login for this site yet.',
    silverstripe: 'Copy it into the Silverstripe CMS.',
    custom: 'This site is custom-built, so whoever maintains it adds the post.',
  };
  return { cms, label: CMS[cms] || 'Unknown', push: false, note: how[cms] || 'Set "cms" for this brand in sites.json. Until then, copy it in.' };
}

// ---- Claude ----
const SCHEMA = {
  type: 'object',
  properties: {
    fit: {
      type: 'object',
      description: 'Whether this article suits this brand at all.',
      properties: {
        rating: { type: 'string', enum: ['strong', 'ok', 'weak'] },
        note: { type: 'string', description: 'One sentence. For a weak fit, say why and suggest skipping this brand.' },
      },
      required: ['rating', 'note'], additionalProperties: false,
    },
    title: { type: 'string', description: 'The post title, 60 characters or fewer, with the focus search near the start where it reads naturally.' },
    slug: { type: 'string', description: 'URL slug: lowercase words joined by hyphens, five or six words at most.' },
    metaDescription: { type: 'string', description: 'Meta description, 120 to 155 characters, naming the town or region and ending with a reason to click.' },
    focusKeyword: { type: 'string', description: 'The one search this post should rank for on this website, chosen from the keyword research when it has a fitting one.' },
    bodyHtml: { type: 'string', description: 'The post body as HTML using only p, h2, h3, ul, ol, li, strong, em, a, blockquote. No h1: the title is the h1.' },
    localised: { type: 'array', items: { type: 'string' }, description: 'Three to six short points on what was changed for this brand (towns, services, examples, call to action).' },
    gaps: {
      type: 'array',
      description: 'Two to five SEO or AI-answer holes on this website that this post helps fill.',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The search or question, in a few words.' },
          evidence: { type: 'string', description: 'The figure from the data that shows the hole (monthly searches and difficulty, a query ranking 8-20, a competitor named in AI answers, a keyword competitors rank for).' },
          how: { type: 'string', description: 'One sentence on how this post helps.' },
        },
        required: ['topic', 'evidence', 'how'], additionalProperties: false,
      },
    },
    siteChanges: {
      type: 'array',
      description: 'Two to five changes to make elsewhere on the website so the post works: internal links to add from existing pages, a service or location page to create or update, a page this post could compete with and how to avoid that.',
      items: {
        type: 'object',
        properties: {
          change: { type: 'string', description: 'A short action starting with a verb. Name the page URL when it is one from the list given.' },
          why: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['change', 'why', 'priority'], additionalProperties: false,
      },
    },
    internalLinks: {
      type: 'array',
      description: 'The links to our own website used in bodyHtml.',
      items: { type: 'object', properties: { anchor: { type: 'string' }, url: { type: 'string' } }, required: ['anchor', 'url'], additionalProperties: false },
    },
  },
  required: ['fit', 'title', 'slug', 'metaDescription', 'focusKeyword', 'bodyHtml', 'localised', 'gaps', 'siteChanges', 'internalLinks'],
  additionalProperties: false,
};

const SYSTEM = `You localise blog articles for the websites of a New Zealand group that owns veterinary clinic brands and animal-health businesses (livestock feed, a diagnostic lab, wholesale vet products, a dairy data consultancy), a few of them in Australia. The same source article goes to several of the group's websites, so each version must read as written for that brand and its community, not as a copy with the town name swapped. Google filters near-duplicate pages across sites, and swapping place names alone is treated as spam.

For the brand you're given:
- Keep the article's facts, advice and meaning. Don't add medical, dosage or efficacy claims the source doesn't make. Don't contradict it.
- Rewrite the opening and the closing for this brand: its towns, region and the animals and clients it actually serves (companion, farm, dairy, equine, or trade buyers). Vary the structure and headings; reorder or merge sections where it reads better. Use local context only where it's generally true of the region (farming type, climate, season in the southern hemisphere). Add a short local FAQ when it fits.
- End with a call to action naming the brand's real clinics and towns from the data. Never invent staff, prices, opening hours, offers, phone numbers or services the data doesn't show.
- Aim at one focus search the website is missing, from the keyword research, Search Console or keyword gap data when one fits the article. Work it into the title, the first paragraph and one heading, naturally.
- Link to two to four of the website's existing pages from the list given, where they genuinely help the reader. Use only URLs from that list. Don't link to other brands' websites.
- About the same length as the source, or a little longer with the local sections. New Zealand English, or Australian English for an Australian brand.
- If the article doesn't suit this business (for example pet content for a lab that sells to farmers), say so in fit and still write the best version you can.
- For gaps and siteChanges, name the figure behind each point. Where data is missing or not connected, say what connecting it would show rather than guessing.`;

let client = null;
const anthropic = () => (client ||= new Anthropic({ apiKey: config.claude.apiKey }));
const line = (label, v) => v == null || v === '' ? '' : `${label}: ${v}\n`;
const SERVICES = { companion: 'pets', mixed: 'pets and farm animals', farm: 'farm animals (production)', equine: 'horses' };

/** Keyword research for the brand: its own (brands without clinics) or every clinic's, merged and sorted by volume. */
function brandKeywords(site) {
  const towns = site.locations.filter((l) => l.town);
  const sets = towns.length ? towns.map((l) => keywordSummary(site, l)) : [keywordSummary(site, null)];
  const seen = new Map();
  for (const k of sets.filter((x) => x.researched).flatMap((x) => x.items)) if (k.volume && !seen.has(k.keyword)) seen.set(k.keyword, k);
  return [...seen.values()].sort((a, b) => b.volume - a.volume).slice(0, 50);
}

/** Pages on the website from the latest audit, for internal links and to spot posts that would compete. */
export function sitePages(site, limit = 120) {
  const audit = db.prepare('SELECT id FROM audits WHERE site=? ORDER BY id DESC LIMIT 1').get(site.slug);
  if (!audit) return [];
  return db.prepare(`SELECT url, title, word_count FROM audit_pages WHERE audit_id=? AND status=200 AND COALESCE(noindex,0)=0
    AND url NOT LIKE '%?%' AND url NOT LIKE '%/tag/%' AND url NOT LIKE '%/page/%' AND url NOT LIKE '%/author/%' ORDER BY length(url) LIMIT ?`).all(audit.id, limit);
}

/** Everything the dashboard knows about the brand that matters for a blog post, as plain text for the prompt. */
export function brandContext(site) {
  let out = `<brand>\n${line('Brand', site.name)}${line('Website', site.url)}${line('What it does', site.description)}${line('Market', site.market === 'AU' ? 'Australia' : 'New Zealand')}${line('Group', site.group)}</brand>\n\n`;
  if (site.locations.length) out += `<clinics>\n${site.locations.map((l) => `- ${l.name}${l.town ? `, ${l.town}` : ''}${l.address ? ` (${l.address})` : ''}${l.services?.length ? `: ${l.services.map((s) => SERVICES[s] || s).join(', ')}` : ''}`).join('\n')}\n</clinics>\n\n`;
  const kw = brandKeywords(site);
  out += '<keyword_research note="monthly Google searches; difficulty 0-100; our position now">\n' + (kw.length
    ? kw.map((k) => `- "${k.keyword}": ${k.volume}/mo, difficulty ${k.difficulty ?? '?'}, our position ${k.position ?? (k.mapPack ? `map pack #${k.mapPack}` : 'not ranking')}`).join('\n') + '\n'
    : 'Not researched yet.\n') + '</keyword_research>\n\n';
  const qEnd = db.prepare('SELECT MAX(period_end) d FROM gsc_queries WHERE site=?').get(site.slug)?.d;
  if (qEnd) {
    const top = db.prepare('SELECT query, SUM(clicks) clicks, AVG(position) position FROM gsc_queries WHERE site=? AND period_end=? GROUP BY query ORDER BY clicks DESC LIMIT 15').all(site.slug, qEnd);
    const near = db.prepare('SELECT query, page, impressions, position FROM gsc_queries WHERE site=? AND period_end=? AND position BETWEEN 8 AND 20 AND impressions >= 20 ORDER BY impressions DESC LIMIT 12').all(site.slug, qEnd);
    out += `<search_console note="last 28 days">\n${top.length ? `Top queries: ${top.map((q) => `"${q.query}" (${q.clicks} clicks, pos ${Number(q.position).toFixed(1)})`).join('; ')}\n` : ''}${near.length ? `Ranking 8-20: ${near.map((q) => `"${q.query}" pos ${Number(q.position).toFixed(1)}, ${q.impressions} impressions, page ${q.page}`).join('; ')}\n` : ''}</search_console>\n\n`;
  } else out += '<search_console>Not connected.</search_console>\n\n';
  const gap = keywordGap(site).slice(0, 15);
  if (gap.length) out += `<keyword_gap note="competitors rank top 20, we don't rank">\n${gap.map((k) => `- "${k.keyword}"${k.volume ? ` ${k.volume}/mo` : ''}`).join('\n')}\n</keyword_gap>\n\n`;
  const a = aiSummary(site);
  if (a.checked) {
    const sources = new Map();
    for (const r of a.clinics.flatMap((c) => c.results)) for (const s of r.sources || []) if (s.domain) sources.set(s.domain, (sources.get(s.domain) || 0) + 1);
    out += `<ai_answers note="what ChatGPT, Gemini and Perplexity say when asked for a vet in our towns or about this business">\nNamed in ${a.mentioned} of ${a.total} answers.\n${a.competitors.length ? `Named instead: ${a.competitors.slice(0, 8).map((x) => x.name).join(', ')}\n` : ''}${sources.size ? `Sources the AIs read: ${[...sources.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).map(([d]) => d).join(', ')}\n` : ''}</ai_answers>\n\n`;
  } else out += '<ai_answers>Not checked yet.</ai_answers>\n\n';
  const pages = sitePages(site);
  out += `<existing_pages note="from our latest crawl; the only URLs you may link to">\n${pages.length ? pages.map((p) => `- ${p.url}${p.title ? ` | ${p.title}` : ''}`).join('\n') : 'Not crawled yet, so add no internal links and say in siteChanges that an audit would allow them.'}\n</existing_pages>`;
  return out;
}

// ---- Keeping the HTML we store, show and send to safe, plain blog markup ----
const escapeHtml = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ALLOWED = new Set(['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a', 'blockquote', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
export function cleanHtml(html) {
  const $ = cheerio.load(`<div id="root">${html || ''}</div>`, null, false);
  $('script,style,iframe,object,embed,form,input,button,img,svg,video,audio,link,meta').remove();
  $('#root *').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (tag === 'h1') { el.tagName = 'h2'; }
    else if (tag === 'div' || tag === 'span' || tag === 'font' || tag === 'section') { $(el).replaceWith($(el).contents()); return; }
    else if (!ALLOWED.has(tag)) { $(el).replaceWith(escapeHtml($(el).text())); return; }
    const href = tag === 'a' ? $(el).attr('href') : null;
    for (const name of Object.keys(el.attribs || {})) $(el).removeAttr(name);
    if (href && /^(https?:|\/|#|mailto:|tel:)/i.test(href.trim())) $(el).attr('href', href.trim());
  });
  return $('#root').html().replace(/<p>\s*<\/p>/g, '').trim();
}

// ---- Checks we can do without Claude ----
const text = (html) => cheerio.load(`<div>${html || ''}</div>`, null, false).text().replace(/\s+/g, ' ').trim();
const words = (t) => t.toLowerCase().replace(/[^a-z0-9'āēīōū ]+/g, ' ').split(/\s+/).filter(Boolean);
/** Overlapping five-word runs, the usual way to measure how much two texts share. */
function shingles(t) {
  const w = words(t), out = new Set();
  for (let i = 0; i + 5 <= w.length; i++) out.add(w.slice(i, i + 5).join(' '));
  return out;
}
/** Share of five-word runs two texts have in common (Jaccard), 0-100. */
function overlap(a, b) {
  if (!a.size || !b.size) return null;
  let both = 0; for (const x of a) if (b.has(x)) both++;
  return Math.round((both / (a.size + b.size - both)) * 100);
}
export const SIMILAR_WARN = 40;

function checks(site, v) {
  const body = text(v.body_html), lower = body.toLowerCase(), kw = (v.focus_keyword || '').toLowerCase().trim();
  const $ = cheerio.load(`<div>${v.body_html || ''}</div>`, null, false);
  const first = $('p').first().text().toLowerCase(), heads = $('h2,h3').map((_, e) => $(e).text().toLowerCase()).get();
  const links = $('a[href]').map((_, e) => $(e).attr('href')).get(), own = links.filter((h) => h.startsWith('/') || h.includes(site.host));
  const towns = [...new Set(site.locations.map((l) => l.town).filter(Boolean))];
  const count = words(body).length, tl = (v.title || '').length, ml = (v.meta_description || '').length;
  // Any word of a multi-word focus search counts for headings, which rarely repeat the whole phrase.
  const inHead = kw && heads.some((h) => h.includes(kw) || kw.split(/\s+/).filter((w) => w.length > 3).every((w) => h.includes(w)));
  return [
    { key: 'title', ok: tl >= 20 && tl <= 60, label: `Title ${tl} characters`, tip: 'Google shows about 60 characters of a title.' },
    { key: 'meta', ok: ml >= 110 && ml <= 160, label: `Meta description ${ml} characters`, tip: 'Aim for 120 to 155 so Google shows it whole.' },
    { key: 'kwTitle', ok: Boolean(kw) && (v.title || '').toLowerCase().includes(kw), label: 'Focus search in the title' },
    { key: 'kwIntro', ok: Boolean(kw) && first.includes(kw), label: 'Focus search in the first paragraph' },
    { key: 'kwHead', ok: Boolean(inHead), label: 'Focus search in a heading' },
    { key: 'length', ok: count >= 500, label: `${count.toLocaleString()} words`, tip: 'Posts under about 500 words rarely rank for anything competitive.' },
    { key: 'links', ok: own.length >= 2, label: `${own.length} link${own.length === 1 ? '' : 's'} to our own pages` },
    ...(towns.length ? [{ key: 'local', ok: towns.some((t) => lower.includes(t.toLowerCase())), label: `Names ${towns.length === 1 ? towns[0] : 'one of the brand’s towns'}` }] : []),
  ];
}

// ---- Writing ----
async function writeVersion(articleId, site) {
  const art = db.prepare('SELECT * FROM articles WHERE id=?').get(articleId);
  const v = db.prepare('SELECT note FROM article_versions WHERE article_id=? AND site=?').get(articleId, site.slug);
  db.prepare("UPDATE article_versions SET status='writing', error=NULL, updated_at=? WHERE article_id=? AND site=?").run(now(), articleId, site.slug);
  try {
    const msg = await anthropic().beta.messages.create({
      model: config.claude.model,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `${brandContext(site)}\n\n<source_article>\nTitle: ${art.title}\n\n${art.body}\n</source_article>${art.notes ? `\n\n<team_notes>${art.notes}</team_notes>` : ''}${v?.note ? `\n\n<notes_for_this_brand>${v.note}</notes_for_this_brand>` : ''}\n\nWrite the version of this article for ${site.name}.` }],
    });
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined to write this version');
    if (msg.stop_reason === 'max_tokens') throw new Error('Claude ran out of room; try again');
    const r = JSON.parse(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
    const { title, slug, metaDescription, focusKeyword, bodyHtml, ...rest } = r;
    db.prepare(`UPDATE article_versions SET status='ready', title=?, slug=?, meta_description=?, focus_keyword=?, body_html=?, result=?, model=?, edited=0,
      approved_by=NULL, approved_at=NULL, updated_at=? WHERE article_id=? AND site=?`)
      .run(title, slugify(slug || title), metaDescription, focusKeyword, cleanHtml(bodyHtml), JSON.stringify(rest), msg.model, now(), articleId, site.slug);
  } catch (e) {
    console.warn(`[articles] ${articleId}/${site.slug}: ${e.message}`);
    db.prepare("UPDATE article_versions SET status='failed', error=?, updated_at=? WHERE article_id=? AND site=?").run(String(e.message).slice(0, 500), now(), articleId, site.slug);
  }
}
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Write the given brands' versions in the background, a few at a time. */
function writeAll(articleId, slugs) {
  const sites = loadSites().filter((s) => slugs.includes(s.slug));
  const queue = [...sites];
  const worker = async () => { for (let s; (s = queue.shift());) await writeVersion(articleId, s); };
  Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker)).catch((e) => console.error('[articles]', e));
}

export function createArticle({ title, body, notes, sites, user }) {
  if (!config.claude.enabled) throw new Error('Claude is not configured (ANTHROPIC_API_KEY)');
  if (!title || !body) throw new Error('add a title and the article text');
  const known = new Set(loadSites().map((s) => s.slug)), slugs = [...new Set(sites || [])].filter((s) => known.has(s));
  if (!slugs.length) throw new Error('pick at least one brand');
  const id = Number(db.prepare('INSERT INTO articles (title, body, notes, created_at, created_by) VALUES (?,?,?,?,?)').run(title, body, notes || null, now(), user || null).lastInsertRowid);
  const ins = db.prepare("INSERT INTO article_versions (article_id, site, status, updated_at) VALUES (?,?,'pending',?)");
  for (const s of slugs) ins.run(id, s, now());
  writeAll(id, slugs);
  return id;
}

/** Write one brand's version again, optionally with a note (e.g. "focus on the Gore clinic's farm work"). */
export function rewriteVersion(articleId, site, note) {
  if (!config.claude.enabled) throw new Error('Claude is not configured (ANTHROPIC_API_KEY)');
  const v = getVersion(articleId, site);
  if (v.status === 'writing' || v.status === 'pending') throw new Error('already being written');
  db.prepare("UPDATE article_versions SET status='pending', note=?, updated_at=? WHERE article_id=? AND site=?").run(note || null, now(), articleId, site.slug);
  writeAll(articleId, [site.slug]);
}

/** Add more brands to an existing article. */
export function addBrands(articleId, slugs) {
  if (!config.claude.enabled) throw new Error('Claude is not configured (ANTHROPIC_API_KEY)');
  if (!db.prepare('SELECT 1 FROM articles WHERE id=?').get(articleId)) throw new Error('unknown article');
  const have = new Set(db.prepare('SELECT site FROM article_versions WHERE article_id=?').all(articleId).map((r) => r.site));
  const known = new Set(loadSites().map((s) => s.slug)), add = [...new Set(slugs || [])].filter((s) => known.has(s) && !have.has(s));
  const ins = db.prepare("INSERT INTO article_versions (article_id, site, status, updated_at) VALUES (?,?,'pending',?)");
  for (const s of add) ins.run(articleId, s, now());
  writeAll(articleId, add);
}

function getVersion(articleId, site) {
  const v = db.prepare('SELECT * FROM article_versions WHERE article_id=? AND site=?').get(articleId, site.slug);
  if (!v) throw new Error('unknown version');
  return v;
}

/** Save the team's edits. Any change takes away an approval (even after sending), so what goes out is always what was approved. */
export function saveVersion(articleId, site, { title, slug, metaDescription, focusKeyword, bodyHtml }) {
  const v = getVersion(articleId, site);
  if (v.status !== 'ready' && v.status !== 'approved' && v.status !== 'sent') throw new Error('nothing to edit yet');
  const next = { title: String(title ?? v.title).slice(0, 300), slug: slugify(slug ?? v.slug), meta: String(metaDescription ?? v.meta_description).slice(0, 400),
    kw: String(focusKeyword ?? v.focus_keyword).slice(0, 120), body: cleanHtml(bodyHtml ?? v.body_html) };
  const changed = next.title !== v.title || next.slug !== v.slug || next.meta !== v.meta_description || next.kw !== v.focus_keyword || next.body !== v.body_html;
  if (!changed) return;
  db.prepare(`UPDATE article_versions SET title=?, slug=?, meta_description=?, focus_keyword=?, body_html=?, edited=1, updated_at=?,
    status=CASE WHEN status IN ('approved','sent') THEN 'ready' ELSE status END, approved_by=NULL, approved_at=NULL WHERE article_id=? AND site=?`)
    .run(next.title, next.slug, next.meta, next.kw, next.body, now(), articleId, site.slug);
}

export function approveVersion(articleId, site, approved, user) {
  const v = getVersion(articleId, site);
  if (approved && v.status !== 'ready') throw new Error(v.status === 'approved' ? 'already approved' : 'only a finished version can be approved');
  if (!approved && v.status !== 'approved') return;
  db.prepare('UPDATE article_versions SET status=?, approved_by=?, approved_at=?, updated_at=? WHERE article_id=? AND site=?')
    .run(approved ? 'approved' : 'ready', approved ? user || 'someone' : null, approved ? now() : null, now(), articleId, site.slug);
}

export function skipVersion(articleId, site, skip) {
  const v = getVersion(articleId, site);
  if (v.status === 'sent') throw new Error('already sent to the website');
  if (skip) db.prepare("UPDATE article_versions SET status='skipped', updated_at=? WHERE article_id=? AND site=?").run(now(), articleId, site.slug);
  else if (v.status === 'skipped') db.prepare("UPDATE article_versions SET status=CASE WHEN body_html IS NULL THEN 'failed' ELSE 'ready' END, error=CASE WHEN body_html IS NULL THEN 'Skipped before it was written' END, updated_at=? WHERE article_id=? AND site=?").run(now(), articleId, site.slug);
}

// ---- WordPress ----
async function wp(site, path, { method = 'GET', body } = {}) {
  const c = wpCreds(site);
  const base = (site.wpApi || `${site.url.replace(/\/$/, '')}/wp-json`).replace(/\/$/, '');
  const r = await fetch(`${base}${path}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: { authorization: `Basic ${Buffer.from(`${c.user}:${c.pass}`).toString('base64')}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch((e) => { throw new Error(`WordPress at ${site.host} couldn\u2019t be reached (${e.cause?.code || e.message})`); });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? `WordPress refused the login (${out.code || r.status}). Check ${envKey(site)}, and that no security plugin blocks the REST API.` : `WordPress ${r.status}: ${out.message || 'request failed'}`);
  return out;
}

const STATUS = { draft: 'draft', publish: 'publish', future: 'future' };
/**
 * Send an approved version to the brand's WordPress site: as a draft (default), published now, or scheduled for a
 * date. Sending again updates the same post rather than creating another.
 */
export async function sendVersion(articleId, site, { mode = 'draft', date, user } = {}) {
  const v = getVersion(articleId, site);
  if (v.status !== 'approved' && v.status !== 'sent') throw new Error('approve this version first');
  // Sites we can't post to: someone copied it in by hand and says so here, so the article shows as done.
  if (mode === 'manual') {
    db.prepare("UPDATE article_versions SET status='sent', cms_status='by hand', sent_at=?, sent_by=?, updated_at=? WHERE article_id=? AND site=?").run(now(), user || null, now(), articleId, site.slug);
    return { status: 'by hand' };
  }
  const route = publishRoute(site);
  if (!route.push) throw new Error(route.note);
  const status = STATUS[mode];
  if (!status) throw new Error('unknown publishing choice');
  let when = null;
  if (status === 'future') {
    when = new Date(date);
    if (!date || Number.isNaN(+when) || when < Date.now()) throw new Error('pick a date and time in the future');
  }
  const post = {
    title: v.title, slug: v.slug, content: v.body_html, excerpt: v.meta_description, status,
    ...(when ? { date_gmt: when.toISOString().slice(0, 19) } : {}),
  };
  const r = await wp(site, v.cms_id ? `/wp/v2/posts/${encodeURIComponent(v.cms_id)}` : '/wp/v2/posts', { method: 'POST', body: post });
  db.prepare("UPDATE article_versions SET status='sent', cms_id=?, cms_link=?, cms_status=?, sent_at=?, sent_by=?, updated_at=? WHERE article_id=? AND site=?")
    .run(String(r.id), r.link || null, r.status || status, now(), user || null, now(), articleId, site.slug);
  return { id: r.id, link: r.link, status: r.status };
}

// ---- Reading ----
export function listArticles() {
  return db.prepare(`SELECT a.id, a.title, a.created_at, a.created_by, COUNT(v.site) brands,
    SUM(v.status IN ('pending','writing')) writing, SUM(v.status='ready') ready, SUM(v.status='approved') approved, SUM(v.status='sent') sent, SUM(v.status='failed') failed
    FROM articles a LEFT JOIN article_versions v ON v.article_id=a.id GROUP BY a.id ORDER BY a.id DESC LIMIT 100`).all();
}

export function articleDetail(id) {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(id);
  if (!a) return null;
  const sites = new Map(loadSites().map((s) => [s.slug, s]));
  const rows = db.prepare('SELECT * FROM article_versions WHERE article_id=? ORDER BY site').all(id).filter((v) => sites.has(v.site));
  const source = shingles(`${a.title} ${a.body}`);
  const sh = new Map(rows.filter((v) => v.body_html).map((v) => [v.site, shingles(`${v.title} ${text(v.body_html)}`)]));
  const versions = rows.map((v) => {
    const site = sites.get(v.site), mine = sh.get(v.site);
    // The closest other version (skipped ones don't go out, so they don't count).
    let closest = null;
    if (mine) for (const o of rows) {
      if (o.site === v.site || o.status === 'skipped' || !sh.has(o.site)) continue;
      const p = overlap(mine, sh.get(o.site));
      if (p != null && (!closest || p > closest.pct)) closest = { site: o.site, name: sites.get(o.site).name, pct: p };
    }
    return {
      site: v.site, name: site.name, host: site.host, group: site.group, status: v.status, error: v.error, note: v.note,
      title: v.title, slug: v.slug, metaDescription: v.meta_description, focusKeyword: v.focus_keyword, bodyHtml: v.body_html,
      ...(v.result ? JSON.parse(v.result) : {}), edited: Boolean(v.edited), updated: v.updated_at, model: v.model,
      approvedBy: v.approved_by, approvedAt: v.approved_at, sentAt: v.sent_at, sentBy: v.sent_by, cms: { id: v.cms_id, link: v.cms_link, status: v.cms_status },
      route: publishRoute(site), checks: v.body_html ? checks(site, v) : [],
      similarity: mine ? { source: overlap(mine, source), closest } : null,
    };
  });
  return { id: a.id, title: a.title, body: a.body, notes: a.notes, created: a.created_at, by: a.created_by, similarWarn: SIMILAR_WARN, versions };
}
