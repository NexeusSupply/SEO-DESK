// The Settings page: what's connected and what's missing, and the few settings people change from the dashboard
// (who gets emails). Everything else is set as environment variables on the server.
import { db, now } from './db.js';
import { config, loadSites } from './config.js';
import { spendThisMonth } from './data/dataforseo.js';
import { envKey, wpCreds } from './data/articles.js';

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT, updated_at TEXT, updated_by TEXT
);
`);

export function getSetting(key, fallback = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return r ? JSON.parse(r.value) : fallback;
}
export function setSetting(key, value, user) {
  db.prepare('INSERT INTO settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by')
    .run(key, JSON.stringify(value), now(), user || null);
}

// ---- Email addresses ----
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
/** A list of addresses from an array or a comma/space separated string, lower-cased and de-duplicated. Throws on a bad one. */
export function cleanEmails(v) {
  const list = (Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/)).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const bad = list.find((x) => !EMAIL.test(x) || x.length > 200);
  if (bad) throw new Error(`"${bad}" isn’t an email address`);
  return [...new Set(list)];
}
const envDigest = () => String(config.smtp.to || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

/** The address book on the Settings page: [{ email, name, digest }]. */
export const recipients = () => getSetting('recipients', []);
export function saveRecipients(list, user) {
  const seen = new Set();
  const out = (Array.isArray(list) ? list : []).slice(0, 100).map((r) => ({
    email: cleanEmails([r?.email])[0], name: String(r?.name || '').trim().slice(0, 80), digest: Boolean(r?.digest),
  })).filter((r) => r.email && !seen.has(r.email) && seen.add(r.email));
  setSetting('recipients', out, user);
  return out;
}
/** Who gets the weekly digest: DIGEST_TO on the server plus every address ticked for it on the Settings page. */
export const digestRecipients = () => [...new Set([...envDigest(), ...recipients().filter((r) => r.digest).map((r) => r.email)])];

// ---- Connections ----
const lastRun = (jobs) => {
  const marks = jobs.map(() => '?').join(',');
  const ok = db.prepare(`SELECT MAX(finished_at) t FROM job_log WHERE ok=1 AND job IN (${marks})`).get(...jobs)?.t ?? null;
  const fail = db.prepare(`SELECT finished_at t, site, message FROM job_log WHERE ok=0 AND job IN (${marks}) ORDER BY id DESC LIMIT 1`).get(...jobs);
  // Jobs run brand by brand, so one brand failing near the end of a run that worked for the others isn't the service
  // failing. It counts as failing when nothing has worked in the hour before its latest failure.
  const failing = fail && (!ok || Date.parse(fail.t) - Date.parse(ok) > 36e5);
  return { lastOk: ok, failing: Boolean(failing),
    lastError: fail && (!ok || fail.t > ok) ? { at: fail.t, site: fail.site, message: String(fail.message || '').slice(0, 300) } : null };
};
const withData = (sql, slugs) => new Set(db.prepare(sql).all().map((r) => r.site).filter((s) => slugs.includes(s)));
const names = (sites) => sites.map((s) => s.name);

/**
 * One row per outside service: is it set up, how much of the portfolio it covers, when it last worked, and which
 * server variables would switch it on. state: on (working) | partial (set up, some brands or clinics not linked yet) |
 * off (not set up) | error (the latest run failed).
 */
export function connectionList() {
  const sites = loadSites();
  const slugs = sites.map((s) => s.slug);
  const clinics = sites.flatMap((s) => s.locations.map((l) => ({ ...l, site: s })));
  const out = [];
  const add = (c) => {
    const run = c.jobs ? lastRun(c.jobs) : {};
    let state = !c.ready ? 'off' : c.missing?.length ? 'partial' : 'on';
    if (c.ready && run.failing) state = 'error';
    // Variables to add: all of them while it's off; for WordPress and login only the ones still missing.
    const vars = state === 'off' || c.missingVars ? c.vars : [];
    out.push({ ...c, state, vars, lastOk: run.lastOk ?? null, lastError: run.lastError ?? null, jobs: undefined, missingVars: undefined });
  };

  {
    let account = null;
    try { account = config.gsc.credentials?.client_email ?? null; } catch { account = null; }
    const have = withData('SELECT DISTINCT site FROM gsc_daily', slugs);
    add({ key: 'gsc', name: 'Google Search Console', ready: config.gsc.enabled, jobs: ['gsc'],
      what: 'Clicks, impressions and the searches people use to find each brand’s website.',
      vars: ['GSC_SERVICE_ACCOUNT_JSON_CONTENT'],
      detail: config.gsc.enabled
        ? (account ? `Signs in as ${account}. Add that address as a user on a brand’s Search Console property to bring it in.` : 'Service account key loaded.')
        : 'Paste the service account’s JSON key into GSC_SERVICE_ACCOUNT_JSON_CONTENT on the server.',
      coverage: config.gsc.enabled ? `${have.size} of ${sites.length} brands sending data` : null,
      missing: config.gsc.enabled ? names(sites.filter((s) => !have.has(s.slug))) : [] });
  }
  add({ key: 'dataforseo', name: 'DataForSEO', ready: config.dfs.enabled, jobs: ['ranks', 'competitors', 'local-ranks', 'listings-public', 'ads', 'ai', 'keywords'],
    what: 'Keyword rankings, map-pack checks, competitors, public Google listings and reviews, ads, AI answers and keyword research.',
    vars: ['DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD'],
    detail: config.dfs.enabled ? `US$${spendThisMonth().toFixed(2)} spent this month of the US$${config.dfs.monthlyCapUsd} cap (DFS_MONTHLY_CAP_USD).` : 'Add the DataForSEO API login and password on the server.',
    coverage: null, missing: [] });
  {
    const linked = clinics.filter((l) => l.gbpLocationId);
    add({ key: 'gbp', name: 'Google Business Profile', ready: config.gbp.enabled, jobs: ['gbp'],
      what: 'Each clinic’s own listing figures (views, calls, directions) and replying to Google reviews from here.',
      vars: ['GBP_CLIENT_ID', 'GBP_CLIENT_SECRET', 'GBP_REFRESH_TOKEN'],
      detail: config.gbp.enabled ? 'Signed in to Google. Clinics need a gbpLocationId in sites.json to be read through it.'
        : `Waiting on Google to approve Business Profile API access. Until then listings and reviews come from public Google data through DataForSEO${config.dfs.enabled ? '' : ' (also not set up)'}.`,
      coverage: config.gbp.enabled ? `${linked.length} of ${clinics.length} clinics linked` : null,
      missing: config.gbp.enabled ? clinics.filter((l) => !l.gbpLocationId).map((l) => `${l.name} (${l.site.name})`) : [] });
  }
  {
    const linked = sites.filter((s) => s.meta);
    add({ key: 'meta', name: 'Facebook and Instagram (Meta)', ready: config.meta.enabled, jobs: ['meta', 'meta-comments'],
      what: 'Followers, reach and posts, and the comments inbox with replies from here.',
      vars: ['META_ACCESS_TOKEN'],
      detail: config.meta.enabled ? 'Token set. Brands need a Facebook pageId in sites.json.' : 'Needs a System User token from Meta Business Settings (see the README).',
      coverage: config.meta.enabled ? `${linked.length} of ${sites.length} brands linked` : null,
      missing: config.meta.enabled ? names(sites.filter((s) => !s.meta)) : [] });
  }
  {
    const linked = sites.filter((s) => s.planable);
    add({ key: 'planable', name: 'Planable', ready: config.planable.enabled, jobs: ['planable'],
      what: 'Social figures for every channel in Planable, and sending draft posts there for approval.',
      vars: ['PLANABLE_API_TOKEN'],
      detail: config.planable.enabled ? 'Token set. Brands need a Planable workspaceId in sites.json.' : 'Needs a company API token from Planable (Pro or Enterprise plan).',
      coverage: config.planable.enabled ? `${linked.length} of ${sites.length} brands linked` : null,
      missing: config.planable.enabled ? names(sites.filter((s) => !s.planable)) : [] });
  }
  {
    const wp = sites.filter((s) => s.cms === 'wordpress');
    const set = wp.filter((s) => wpCreds(s));
    add({ key: 'wordpress', name: 'WordPress websites', ready: set.length > 0, missingVars: true,
      what: 'Sending approved articles straight to a brand’s website as a draft, post or scheduled post.',
      vars: wp.filter((s) => !wpCreds(s)).map(envKey),
      detail: !wp.length ? 'No brand is marked "cms": "wordpress" in sites.json.'
        : `One application password per brand, as username:password. ${set.length} of ${wp.length} WordPress brands can be sent to.`,
      coverage: wp.length ? `${set.length} of ${wp.length} WordPress sites` : null,
      missing: names(wp.filter((s) => !wpCreds(s))) });
  }
  add({ key: 'claude', name: 'Claude (Anthropic)', ready: config.claude.enabled,
    what: 'Drafting review and comment replies, social posts, traffic ideas and the per-brand article versions.',
    vars: ['ANTHROPIC_API_KEY'],
    detail: config.claude.enabled ? `Using ${config.claude.model} (ANTHROPIC_MODEL).` : 'Add an Anthropic API key on the server.',
    coverage: null, missing: [] });
  add({ key: 'email', name: 'Email sending', ready: config.smtp.ready, jobs: ['report'],
    what: 'The weekly digest and the scheduled reports below.',
    vars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'DIGEST_FROM'],
    detail: config.smtp.ready ? `Sends through ${config.smtp.host} from ${config.smtp.from || config.smtp.user || 'the SMTP account'}.`
      : 'Add the SMTP details for the mailbox it should send from (Gmail and Microsoft 365 both work; see the README).',
    coverage: null, missing: [] });
  add({ key: 'access', name: 'Login protection', ready: config.access.enabled || Boolean(config.access.previewPassword), missingVars: true,
    what: 'Who can open the dashboard.',
    vars: config.access.enabled ? [] : ['CF_ACCESS_TEAM_DOMAIN', 'CF_ACCESS_AUD'],
    detail: config.access.enabled ? 'Cloudflare Access is on: people sign in with their work account.'
      : config.access.previewPassword ? 'Protected by the preview password. Cloudflare Access replaces it once IT sets it up.'
        : 'Open to anyone with the link. Set PREVIEW_PASSWORD now, or Cloudflare Access.',
    coverage: null, missing: config.access.enabled ? [] : config.access.previewPassword ? ['Cloudflare Access'] : [] });
  return out;
}

// What each automatic job does, in plain words, for the schedule list on the Settings page.
export const JOB_LABELS = {
  audit: 'Website health audit', ranks: 'Keyword rankings', gsc: 'Search Console sync', competitors: 'Competitor figures',
  digest: 'Weekly digest email', gbp: 'Google listings and reviews', local: 'Map-pack checks and contact details', 'local-collect': 'Collect map-pack results',
  ads: 'Google ads', meta: 'Facebook and Instagram figures', 'meta-comments': 'New Facebook and Instagram comments', planable: 'Planable figures', ai: 'AI answers',
};
