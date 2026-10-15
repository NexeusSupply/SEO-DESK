// Scheduled email reports set up on the Settings page: a chosen set of brands and clinics, a chosen set of sections,
// sent to chosen addresses daily, weekly or monthly. Checked a few minutes past every hour (config.reportsCron),
// in the server's time zone (the Docker image sets Pacific/Auckland).
import { db, now, logJob } from './db.js';
import { config, loadSites } from './config.js';
import { overview, siteDetail, locationRows, socialSummary } from './queries.js';
import { aiSummary } from './data/ai.js';
import { sendMail } from './mail.js';
import { cleanEmails } from './settings.js';

db.exec(`
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY, name TEXT, sites TEXT, clinics TEXT, sections TEXT, frequency TEXT, weekday INTEGER, monthday INTEGER,
  hour INTEGER, recipients TEXT, enabled INTEGER DEFAULT 1, created_at TEXT, created_by TEXT, updated_at TEXT,
  last_slot TEXT, last_sent_at TEXT, last_result TEXT, last_ok INTEGER
);
`);

/** Sections a report can include. brand: one block per chosen brand; clinic: one table across the chosen clinics. */
export const SECTIONS = [
  { key: 'summary', label: 'Headline figures', scope: 'brand', hint: 'Website health score, clicks and impressions from Google, keywords on page one' },
  { key: 'health', label: 'Website problems', scope: 'brand', hint: 'The errors found in the latest website audit' },
  { key: 'search', label: 'Search Console', scope: 'brand', hint: 'Top searches and the ones ranking 8–20, within reach of page one' },
  { key: 'ranks', label: 'Keyword rankings', scope: 'brand', hint: 'Tracked keywords that moved 3 or more places' },
  { key: 'social', label: 'Social media', scope: 'brand', hint: 'Followers per channel and comments waiting for a reply' },
  { key: 'ai', label: 'AI answers', scope: 'brand', hint: 'How often ChatGPT, Gemini and Perplexity name the brand’s clinics' },
  { key: 'clinics', label: 'Clinic listings', scope: 'clinic', hint: 'Rating, new and unreplied reviews, listing completeness, map pack' },
  { key: 'reviews', label: 'New reviews', scope: 'clinic', hint: 'Every Google review since the last report' },
];
const SECTION_KEYS = SECTIONS.map((s) => s.key);
const FREQ = ['daily', 'weekly', 'monthly'];
const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const int = (v, lo, hi, d) => { const x = Number.parseInt(v, 10); return Number.isFinite(x) && x >= lo && x <= hi ? x : d; };

/** Checks and tidies a report from the Settings form. Throws a readable message on anything wrong. */
function normalise(b) {
  const sites = loadSites();
  const name = String(b?.name || '').trim().slice(0, 120);
  if (!name) throw new Error('Give the report a name');
  const all = Array.isArray(b?.sites) && b.sites.includes('*');
  const siteSlugs = all ? ['*'] : (Array.isArray(b?.sites) ? b.sites : []).map(String).filter((x) => sites.some((s) => s.slug === x));
  const clinicKeys = (Array.isArray(b?.clinics) ? b.clinics : []).map(String)
    .filter((k) => { const [s, l] = k.split('/'); return sites.find((x) => x.slug === s)?.locations.some((x) => x.slug === l); });
  if (!siteSlugs.length && !clinicKeys.length) throw new Error('Pick at least one brand or clinic');
  const sections = (Array.isArray(b?.sections) ? b.sections : []).map(String).filter((k) => SECTION_KEYS.includes(k));
  if (!sections.length) throw new Error('Pick at least one thing to include');
  const recipients = cleanEmails(b?.recipients);
  if (!recipients.length) throw new Error('Add at least one email address to send it to');
  if (recipients.length > 50) throw new Error('A report can go to 50 addresses at most');
  const frequency = FREQ.includes(b?.frequency) ? b.frequency : 'weekly';
  return { name, sites: siteSlugs, clinics: [...new Set(clinicKeys)], sections, recipients, frequency,
    weekday: int(b?.weekday, 0, 6, 1), monthday: int(b?.monthday, 1, 28, 1), hour: int(b?.hour, 0, 23, 8), enabled: b?.enabled !== false };
}

const parse = (r) => r && ({ ...r, sites: JSON.parse(r.sites || '[]'), clinics: JSON.parse(r.clinics || '[]'), sections: JSON.parse(r.sections || '[]'),
  recipients: JSON.parse(r.recipients || '[]'), enabled: Boolean(r.enabled), last_ok: r.last_ok == null ? null : Boolean(r.last_ok) });

// ---- When ----
const slotOf = (d) => `${d.toLocaleDateString('en-CA')} ${String(d.getHours()).padStart(2, '0')}`;
const matches = (r, d) => d.getHours() === r.hour && (r.frequency === 'daily' || (r.frequency === 'weekly' && d.getDay() === r.weekday) || (r.frequency === 'monthly' && d.getDate() === r.monthday));
/** The next hour this report goes out, as an ISO time, or null when it's paused. */
export function nextRun(r, from = new Date()) {
  if (!r.enabled) return null;
  const d = new Date(from); d.setMinutes(0, 0, 0);
  for (let i = 0; i < 24 * 32; i += 1) { d.setHours(d.getHours() + 1); if (matches(r, d)) return d.toISOString(); }
  return null;
}
const hourTxt = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
export const whenText = (r) => r.frequency === 'daily' ? `Every day at ${hourTxt(r.hour)}`
  : r.frequency === 'weekly' ? `Every ${DAYS[r.weekday]} at ${hourTxt(r.hour)}` : `The ${ordinal(r.monthday)} of each month at ${hourTxt(r.hour)}`;

// ---- Storage ----
export function listReports() {
  return db.prepare('SELECT * FROM reports ORDER BY name').all().map(parse).map((r) => ({ ...r, when: whenText(r), next: nextRun(r) }));
}
export const getReport = (id) => parse(db.prepare('SELECT * FROM reports WHERE id=?').get(id));
export function saveReport(id, body, user) {
  const r = normalise(body);
  const vals = [r.name, JSON.stringify(r.sites), JSON.stringify(r.clinics), JSON.stringify(r.sections), r.frequency, r.weekday, r.monthday, r.hour, JSON.stringify(r.recipients), r.enabled ? 1 : 0, now()];
  if (id) {
    if (!getReport(id)) throw new Error('unknown report');
    db.prepare('UPDATE reports SET name=?, sites=?, clinics=?, sections=?, frequency=?, weekday=?, monthday=?, hour=?, recipients=?, enabled=?, updated_at=? WHERE id=?').run(...vals, id);
    return getReport(id);
  }
  const res = db.prepare('INSERT INTO reports (name,sites,clinics,sections,frequency,weekday,monthday,hour,recipients,enabled,updated_at,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(...vals, now(), user || null);
  // Don't send straight away if it's saved during its own hour; the first one goes at the next slot.
  db.prepare('UPDATE reports SET last_slot=? WHERE id=?').run(slotOf(new Date()), res.lastInsertRowid);
  return getReport(Number(res.lastInsertRowid));
}
export function setEnabled(id, on) {
  if (!getReport(id)) throw new Error('unknown report');
  db.prepare('UPDATE reports SET enabled=?, updated_at=? WHERE id=?').run(on ? 1 : 0, now(), id);
  return getReport(id);
}
export function deleteReport(id) { db.prepare('DELETE FROM reports WHERE id=?').run(id); }

// ---- The email ----
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 0) => v == null ? '–' : Number(v).toLocaleString('en-NZ', { maximumFractionDigits: d });
const change = (cur, prev) => {
  if (cur == null || prev == null || !prev) return '';
  const p = Math.round(((cur - prev) / prev) * 100);
  return ` <span style="color:${p > 0 ? '#2c7a57' : p < 0 ? '#b0392c' : '#5d717a'}">${p > 0 ? '+' : ''}${p}%</span>`;
};
const C = { ink: '#10262f', muted: '#5d717a', line: '#d5e1e6', brand: '#004860', wash: '#f4f8fa' };
const h2 = (t) => `<h2 style="margin:28px 0 6px;font-size:19px;color:${C.brand}">${t}</h2>`;
const h3 = (t) => `<h3 style="margin:16px 0 4px;font-size:15px;color:${C.ink}">${t}</h3>`;
const p = (t) => `<p style="margin:4px 0;color:${C.ink}">${t}</p>`;
const quiet = (t) => `<p style="margin:4px 0;color:${C.muted}">${t}</p>`;
const table = (head, rows) => `<table style="border-collapse:collapse;width:100%;font-size:13px;margin:6px 0">
<tr>${head.map((h, i) => `<th style="text-align:${i ? 'right' : 'left'};padding:6px 8px;background:${C.wash};color:${C.muted};font-weight:600;border-bottom:1px solid ${C.line}">${h}</th>`).join('')}</tr>
${rows.map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${i ? 'right' : 'left'};padding:6px 8px;border-bottom:1px solid ${C.line};vertical-align:top">${c}</td>`).join('')}</tr>`).join('')}</table>`;

function brandBlock(site, has) {
  const o = overview([site])[0];
  const d = has('health') || has('search') || has('ranks') ? siteDetail(site) : null;
  const out = [];
  if (has('summary')) {
    out.push(p([o.audit ? `Website health <b>${o.audit.score}</b>/100${o.audit.prevScore != null && o.audit.prevScore !== o.audit.score ? ` (was ${o.audit.prevScore})` : ''}` : 'Website not audited yet',
      o.gsc ? `Clicks from Google (28 days) <b>${num(o.gsc.clicks)}</b>${change(o.gsc.clicks, o.gsc.prevClicks)}` : 'Search Console not connected',
      o.gsc ? `Impressions <b>${num(o.gsc.impressions)}</b>${change(o.gsc.impressions, o.gsc.prevImpressions)}` : '',
      o.ranks ? `Keywords on page one <b>${o.ranks.top10}</b> of ${o.ranks.tracked}` : ''].filter(Boolean).join(' &middot; ')));
  }
  if (has('health')) {
    const errors = d.issues.filter((i) => i.severity === 'error');
    const warnings = d.issues.filter((i) => i.severity === 'warning').reduce((a, i) => a + i.n, 0);
    out.push(h3('Website problems'), !d.audit ? quiet('Not audited yet.')
      : errors.length ? p(`${errors.slice(0, 6).map((e) => `${esc(e.label)} (${e.n})`).join(', ')}${warnings ? `. Also ${warnings} warning${warnings === 1 ? '' : 's'}.` : ''}`)
        : quiet(`No errors in the latest audit${warnings ? `, ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}.`));
  }
  if (has('search')) {
    const g = d.gsc;
    out.push(h3('Search Console'));
    if (!g.topQueries.length) out.push(quiet(o.gsc ? 'No search queries yet.' : 'Not connected.'));
    else {
      out.push(table(['Top searches, 28 days', 'Clicks', 'Impressions', 'Position'], g.topQueries.slice(0, 5).map((q) => [esc(q.query), num(q.clicks), num(q.impressions), num(q.position, 1)])));
      if (g.strikingDistance.length) out.push(p(`<b>Within reach of page one:</b> ${g.strikingDistance.slice(0, 5).map((q) => `“${esc(q.query)}” (${Math.round(q.position)})`).join(', ')}`));
    }
  }
  if (has('ranks')) {
    const movers = d.ranks.filter((r) => r.position && r.prev && Math.abs(r.position - r.prev) >= 3).sort((a, b) => (a.position - a.prev) - (b.position - b.prev)).slice(0, 8);
    out.push(h3('Keyword rankings'), !d.ranks.length ? quiet('No keywords tracked.') : movers.length
      ? table(['Keyword', 'Was', 'Now'], movers.map((m) => [esc(m.keyword), m.prev, `<b style="color:${m.position < m.prev ? '#2c7a57' : '#b0392c'}">${m.position}</b>`]))
      : quiet('No keyword moved 3 or more places.'));
  }
  if (has('social')) {
    const s = socialSummary(site);
    out.push(h3('Social media'), s.platforms.length
      ? p(`${s.platforms.map((x) => `${esc(x.platform[0].toUpperCase() + x.platform.slice(1))} <b>${num(x.followers)}</b> followers${x.prevFollowers ? ` (${x.followers - x.prevFollowers >= 0 ? '+' : ''}${num(x.followers - x.prevFollowers)})` : ''}`).join(' &middot; ')}${s.unanswered ? `. <b>${s.unanswered}</b> comment${s.unanswered === 1 ? '' : 's'} waiting for a reply.` : ''}`)
      : quiet('Not connected yet.'));
  }
  if (has('ai')) {
    const a = aiSummary(site);
    out.push(h3('AI answers'), a.total ? p(`Named in <b>${a.mentioned}</b> of ${a.total} AI answers${a.prevTotal ? ` (was ${a.prevMentioned} of ${a.prevTotal})` : ''}.${a.competitors?.length ? ` Named instead: ${a.competitors.slice(0, 4).map((c) => esc(c.name || c)).join(', ')}.` : ''}`)
      : quiet('Not checked yet.'));
  }
  return `${h2(esc(site.name))}${out.join('')}`;
}

function clinicBlocks(rows, has, days) {
  const out = [];
  if (has('clinics')) {
    out.push(h2('Clinic listings'), rows.length ? table(['Clinic', 'Rating', 'New reviews (30d)', 'Unreplied', 'Listing', 'Map pack'], rows.map((l) => [
      `<b>${esc(l.name)}</b><br><span style="color:${C.muted}">${esc(l.brand)}${l.napIssues.length ? ` &middot; details don’t match: ${esc(l.napIssues.join(', '))}` : ''}</span>`,
      l.listing?.rating != null ? `${l.listing.rating} ★ <span style="color:${C.muted}">(${num(l.listing.reviews)})</span>` : '–',
      `${l.reviews.last30}${l.reviews.lowRecent ? ` <span style="color:#b0392c">${l.reviews.lowRecent} low</span>` : ''}`,
      l.reviews.unreplied ? `<b style="color:#b0392c">${l.reviews.unreplied}</b>` : '0',
      l.listing ? `${l.listing.completeness}%` : '–',
      l.ranks.length ? `${l.ranks.filter((r) => r.map_pack != null).length} of ${l.ranks.length}` : '–',
    ])) : quiet('No clinics chosen.'));
  }
  if (has('reviews')) {
    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    const reviews = rows.flatMap((l) => db.prepare('SELECT created_at, rating, reviewer, comment, replied FROM gbp_reviews WHERE site=? AND location=? AND created_at >= ? ORDER BY created_at DESC LIMIT 30')
      .all(l.site, l.slug, since).map((r) => ({ ...r, clinic: l.name }))).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
    out.push(h2(`New reviews, last ${days === 1 ? 'day' : `${days} days`}`), reviews.length ? reviews.map((r) => `<div style="margin:8px 0;padding:8px 10px;border-left:3px solid ${r.rating <= 2 ? '#b0392c' : r.rating >= 4 ? '#2c7a57' : '#a96a12'};background:${C.wash}">
<b>${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</b> ${esc(r.reviewer || 'Someone')} on <b>${esc(r.clinic)}</b> <span style="color:${C.muted}">${esc(r.created_at.slice(0, 10))}${r.replied ? ' &middot; replied' : ' &middot; <span style="color:#b0392c">not replied</span>'}</span>
${r.comment ? `<div style="margin-top:4px;color:${C.ink}">${esc(r.comment.length > 400 ? `${r.comment.slice(0, 400)}…` : r.comment)}</div>` : ''}</div>`).join('') : quiet('No new reviews.'));
  }
  return out.join('');
}

/** The report's subject and HTML. Works for an unsaved report too, so the form can preview it. */
export function buildReport(input) {
  const r = input.id ? input : normalise({ ...input, recipients: ['preview@example.com'] });
  const sites = loadSites();
  const has = (k) => r.sections.includes(k);
  const brands = r.sites.includes('*') ? sites : sites.filter((s) => r.sites.includes(s.slug));
  const clinicRows = sites.flatMap((s) => {
    const locs = brands.includes(s) ? s.locations : s.locations.filter((l) => r.clinics.includes(`${s.slug}/${l.slug}`));
    return locs.length ? locationRows({ ...s, locations: locs }).map((l) => ({ ...l, site: s.slug, brand: s.name })) : [];
  }).sort((a, b) => b.attention - a.attention || a.brand.localeCompare(b.brand));
  const brandSections = SECTIONS.filter((s) => s.scope === 'brand' && has(s.key));
  const date = new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:680px;color:${C.ink};font-size:14px;line-height:1.45">
<h1 style="font-size:24px;margin:0 0 2px;color:${C.brand}">${esc(r.name)}</h1>
<p style="margin:0 0 8px;color:${C.muted}">${esc(date)} &middot; ${esc(whenText(r))}</p>
${brandSections.length ? brands.map((s) => brandBlock(s, has)).join('') : ''}
${clinicBlocks(clinicRows, has, PERIOD_DAYS[r.frequency])}
<p style="margin-top:32px;color:#888;font-size:12px">Sent by SEO Desk. Change what’s in this report, who gets it or when on the dashboard’s Settings page.</p></div>`;
  return { subject: `${r.name} — ${new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`, html };
}

/** Builds and sends one report now. Records the outcome on the report either way. */
export async function sendReport(id, slot = null) {
  const r = getReport(id);
  if (!r) throw new Error('unknown report');
  const mark = (ok, result) => db.prepare(`UPDATE reports SET last_ok=?, last_result=?${ok ? ', last_sent_at=?' : ''}${slot ? ', last_slot=?' : ''} WHERE id=?`)
    .run(...[ok ? 1 : 0, result, ...(ok ? [now()] : []), ...(slot ? [slot] : []), id]);
  if (!config.smtp.ready) { mark(false, 'Not sent: email sending isn’t set up yet (SMTP_HOST)'); return getReport(id); }
  try {
    await logJob('report', `report:${id}`, async () => {
      const { subject, html } = buildReport(r);
      await sendMail({ to: r.recipients, subject, html });
      return `sent to ${r.recipients.length}`;
    });
    mark(true, `Sent to ${r.recipients.join(', ')}`);
  } catch (e) { mark(false, `Not sent: ${e.message}`); }
  return getReport(id);
}

/** Called every hour: sends each report whose day and hour it is, once per slot. */
export async function runDueReports(at = new Date()) {
  const slot = slotOf(at);
  const due = listReports().filter((r) => r.enabled && matches(r, at) && r.last_slot !== slot);
  const out = [];
  for (const r of due) out.push(`${r.name}: ${(await sendReport(r.id, slot)).last_result}`);
  return out.length ? out : ['no reports due'];
}
