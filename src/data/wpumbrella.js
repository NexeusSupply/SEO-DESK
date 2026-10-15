// WP Umbrella (wp-umbrella.com) watches the group's WordPress sites: uptime, speed, plugin and core updates, known
// security holes, PHP errors, broken links and backups. Its Public API (https://public-api.wp-umbrella.com, Bearer
// token) is read-only for our purposes. It can't create posts, so sending articles still uses each site's own
// WordPress application password (WP_<SLUG>, see articles.js).
//
// One account token covers every site. Sites are matched to WP Umbrella "projects" by domain; if a domain doesn't
// match (a staging URL, say), set "wpUmbrella": { "projectId": 123 } on the brand in sites.json.
import { config } from '../config.js';
import { db, now, logJob } from '../db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS wpu_sites (
  site TEXT PRIMARY KEY, project_id INTEGER, project TEXT, uptime TEXT, vulns TEXT, broken TEXT, broken_more INTEGER,
  backup TEXT, errors TEXT, fetched_at TEXT
);
`);

async function api(path, params = {}) {
  const u = new URL(`${config.wpUmbrella.apiUrl}/${path.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  const r = await fetch(u, { signal: AbortSignal.timeout(30000), headers: { authorization: `Bearer ${config.wpUmbrella.token}`, accept: 'application/json' } })
    .catch((e) => { throw new Error(`WP Umbrella couldn’t be reached (${e.cause?.code || e.message})`); });
  const out = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new Error(`WP Umbrella refused the token (${r.status}). WP_UMBRELLA_API_KEY must be the Public API token from Profile → Public API, not a site connection key.`);
  if (!r.ok) throw new Error(`WP Umbrella ${r.status} ${path}: ${out.message || out.code || 'request failed'}`);
  return out;
}

/** Every project (site) in the WP Umbrella account. */
export async function listProjects() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await api('projects', { page, per_page: 50 });
    out.push(...(r.data || []));
    if (!r.data?.length || r.data.length < 50) break;
  }
  return out;
}

const hostOf = (u) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).host.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
export const projectFor = (site, projects) => site.wpUmbrella?.projectId != null
  ? projects.find((p) => String(p.id) === String(site.wpUmbrella.projectId))
  : projects.find((p) => [p.base_url, p.source_domain].some((u) => u && hostOf(u) === site.host.toLowerCase()));

/** The projects with the brand each one matched, for /api/wpumbrella/projects (to check the matching or find a projectId). */
export function matchProjects(sites, projects) {
  return projects.map((p) => ({ id: p.id, name: p.name, url: p.base_url, brand: sites.find((s) => projectFor(s, [p]))?.slug || null }));
}

const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();

/** Read one brand's site from WP Umbrella. `projects` is the account's list, fetched once per run. */
export function syncWpUmbrella(site, projects) {
  return logJob('wpumbrella', site.slug, async () => {
    const p = projectFor(site, projects);
    if (!p) {
      db.prepare('DELETE FROM wpu_sites WHERE site=?').run(site.slug);
      return site.wpUmbrella?.projectId != null ? `project ${site.wpUmbrella.projectId} not found in WP Umbrella` : `${site.host} is not in WP Umbrella`;
    }
    // The project record has most of it; the rest are extra reads, each allowed to fail on its own.
    const errors = [];
    const extra = (path, params) => api(`projects/${p.id}/${path}`, params).then((r) => r.data).catch((e) => { errors.push(e.message); return null; });
    const [full, uptime, vulns, brokenR, backups] = await Promise.all([
      api(`projects/${p.id}`).then((r) => r.data).catch((e) => { errors.push(e.message); return null; }),
      extra('uptime', { from: ago(30), to: now(), limit: 20 }),
      extra('vulnerabilities'),
      api(`projects/${p.id}/broken-links`, { page: 1, per_page: 50 }).catch((e) => { errors.push(e.message); return null; }),
      extra('backups', { page: 1, per_page: 1 }),
    ]);
    const lastPage = Number(new URL(brokenR?.links?.pagination?.last || 'https://x/?page=1', 'https://x').searchParams.get('page')) || 1;
    db.prepare(`INSERT INTO wpu_sites (site,project_id,project,uptime,vulns,broken,broken_more,backup,errors,fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(site) DO UPDATE SET project_id=excluded.project_id, project=excluded.project, uptime=excluded.uptime, vulns=excluded.vulns,
      broken=excluded.broken, broken_more=excluded.broken_more, backup=excluded.backup, errors=excluded.errors, fetched_at=excluded.fetched_at`)
      .run(site.slug, p.id, JSON.stringify(full || p), JSON.stringify(uptime), JSON.stringify(vulns), JSON.stringify(brokenR?.data ?? null),
        lastPage > 1 ? 1 : 0, JSON.stringify(backups?.[0] ?? null), errors.length ? errors.join('; ') : null, now());
    return errors.length ? `synced with gaps: ${errors.join('; ')}` : 'synced';
  });
}

const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
const needsUpdate = (v) => v === true || (v != null && typeof v === 'object' && Object.keys(v).length > 0);
// WP Umbrella's examples show performance as both 85.5 and 0.95; treat anything up to 1 as a fraction.
const score = (v) => v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) <= 1 ? Number(v) * 100 : Number(v));

function vulnList(v, project) {
  if (!v) {
    // No scan detail: fall back to the counts on the project record.
    const pv = project?.vulnerabilities || {};
    const n = ['plugins', 'themes', 'wordpress'].reduce((a, k) => a + (pv[k]?.length || 0), 0);
    return Array.from({ length: n }, () => ({ title: 'Known vulnerability', what: '', cvss: null, fixedIn: null, url: null }));
  }
  const rows = [];
  const add = (what, version, list) => (list || []).forEach((x) => rows.push({ title: x.title, what: `${what} ${version || ''}`.trim(), cvss: x.cvss_score ?? null, fixedIn: x.version_fixed_in || null, url: x.patchstack_url || null }));
  (v.plugin_vulnerabilities || []).forEach((x) => add(`Plugin ${x.plugin?.name || ''}`, x.plugin?.version, x.vulnerabilities));
  (v.theme_vulnerabilities || []).forEach((x) => add(`Theme ${x.theme?.name || ''}`, x.theme?.version, x.vulnerabilities));
  const wp = v.wordpress_vulnerabilities;
  if (wp) add('WordPress', wp.wordpress?.version, wp.vulnerabilities);
  return rows.sort((a, b) => (b.cvss ?? 0) - (a.cvss ?? 0));
}

/** What the site page shows: null when the brand isn't WordPress and isn't in WP Umbrella. */
export function websiteHealth(site) {
  const row = db.prepare('SELECT * FROM wpu_sites WHERE site=?').get(site.slug);
  const wordpress = site.cms === 'wordpress';
  if (!row && !wordpress) return null;
  if (!config.wpUmbrella.enabled) return { state: 'coming_soon' };
  if (!row) {
    const tried = db.prepare("SELECT message FROM job_log WHERE job='wpumbrella' AND site=? ORDER BY id DESC LIMIT 1").get(site.slug);
    return { state: tried ? 'not_linked' : 'no_data', message: tried?.message || null };
  }
  const p = parse(row.project) || {}, w = p.warnings || {}, up = parse(row.uptime), backup = parse(row.backup);
  const plugins = p.plugins || [], themes = p.themes || [];
  const broken = (parse(row.broken) || []).filter((b) => !b.isIgnored);
  return {
    state: 'connected', projectId: row.project_id, fetchedAt: row.fetched_at, errors: row.errors,
    down: Boolean(up?.is_currently_down ?? p.is_currently_down), disconnected: Boolean(p.is_disconnected),
    lastSync: p.last_synchronization?.date_with_success || null,
    uptime: up ? { pct: up.uptime_percentage ?? null, monitoring: up.monitoring_enabled !== false, incidents: up.incidents_total ?? (up.incidents || []).length,
      recent: (up.incidents || []).slice(0, 5).map((i) => ({ at: i.started_at, mins: i.duration_seconds != null ? Math.round(i.duration_seconds / 60) : null, why: i.description, status: i.http_status })) } : null,
    lastDowntime: p.latest_downtime || null, responseMs: p.latest_ping != null ? Math.round(p.latest_ping) : null,
    performance: { desktop: score(p.latest_performance_score), mobile: score(p.latest_performance_score_mobile) },
    wordpress: { version: w.wordpress_version || null, upToDate: w.is_up_to_date ?? null },
    php: { version: w.php_current_version || null, recommended: w.php_recommended_version || null, supported: w.php_is_supported ?? null, secure: w.php_is_secure ?? null },
    ssl: w.is_ssl ?? null, indexable: w.is_indexable ?? null, debug: w.defined_wp_debug ?? null,
    plugins: { total: plugins.length, outdated: plugins.filter((x) => needsUpdate(x.need_update)).map((x) => x.slug || x.key) },
    themes: { outdated: themes.filter((t) => t.latest_version && t.version && t.latest_version !== t.version).map((t) => `${t.stylesheet || t.id} ${t.version} → ${t.latest_version}`) },
    vulnerabilities: vulnList(parse(row.vulns), p),
    phpIssues: p.count_php_issues ?? null,
    brokenLinks: { count: broken.length, more: Boolean(row.broken_more),
      list: broken.sort((a, b) => Number(b.isInternal) - Number(a.isInternal)).slice(0, 15)
        .map((b) => ({ href: b.href, page: b.pageUrl, status: b.httpStatus, error: b.checkError, anchor: b.anchorText, internal: Boolean(b.isInternal) })) },
    backup: backup ? { at: backup.date_finished || backup.date, status: backup.status } : null,
  };
}

/** The few things worth flagging on the Portfolio page. */
export function healthFlags(site) {
  if (!config.wpUmbrella.enabled) return null;
  const h = websiteHealth(site);
  if (h?.state !== 'connected') return null;
  return { down: h.down, vulnerabilities: h.vulnerabilities.length, hidden: h.indexable === false };
}
