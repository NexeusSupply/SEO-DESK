import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  root,
  port: num(process.env.PORT, 3040),
  dbPath: path.resolve(root, process.env.DB_PATH || './data/seo-desk.sqlite'),
  // First match wins: data/sites.json (local, or on a Railway volume), then sites.json at the repo root
  // (committed, so it ships in the image — the volume mounted at /app/data hides anything committed under data/).
  sitesPaths: [path.resolve(root, './data/sites.json'), path.resolve(root, './sites.json'), path.resolve(root, './data/sites.example.json')],
  dfs: {
    login: process.env.DATAFORSEO_LOGIN || '',
    password: process.env.DATAFORSEO_PASSWORD || '',
    location: num(process.env.DFS_LOCATION_CODE, 2554),
    language: process.env.DFS_LANGUAGE_CODE || 'en',
    monthlyCapUsd: num(process.env.DFS_MONTHLY_CAP_USD, 10),
    get enabled() { return Boolean(this.login && this.password); },
  },
  gbp: {
    clientId: process.env.GBP_CLIENT_ID || '',
    clientSecret: process.env.GBP_CLIENT_SECRET || '',
    refreshToken: process.env.GBP_REFRESH_TOKEN || '',
    get enabled() { return Boolean(this.clientId && this.clientSecret && this.refreshToken); },
  },
  gsc: {
    keyPath: process.env.GSC_SERVICE_ACCOUNT_JSON ? path.resolve(root, process.env.GSC_SERVICE_ACCOUNT_JSON) : '',
    keyContent: process.env.GSC_SERVICE_ACCOUNT_JSON_CONTENT || '',
    get credentials() {
      if (this.keyContent) return JSON.parse(this.keyContent);
      if (this.keyPath && fs.existsSync(this.keyPath)) return JSON.parse(fs.readFileSync(this.keyPath, 'utf8'));
      return null;
    },
    get enabled() { try { return Boolean(this.credentials); } catch { return false; } },
  },
  access: {
    teamDomain: (process.env.CF_ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    aud: process.env.CF_ACCESS_AUD || '',
    get enabled() { return Boolean(this.teamDomain && this.aud); },
  },
  crawl: {
    maxPages: num(process.env.CRAWL_MAX_PAGES, 500),
    concurrency: num(process.env.CRAWL_CONCURRENCY, 4),
    userAgent: process.env.CRAWL_USER_AGENT || 'SEODeskBot/0.1',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.DIGEST_FROM || '',
    to: process.env.DIGEST_TO || '',
    get enabled() { return Boolean(this.host && this.to); },
  },
  cron: {
    audit: process.env.CRON_AUDIT || '0 2 * * 1',
    ranks: process.env.CRON_RANKS || '0 6 * * *',
    gsc: process.env.CRON_GSC || '30 6 * * *',
    competitors: process.env.CRON_COMPETITORS || '0 3 1 * *',
    digest: process.env.CRON_DIGEST || '0 8 * * 1',
    gbp: process.env.CRON_GBP || '15 7 * * *',
    local: process.env.CRON_LOCAL || '0 5 * * 1',
    'local-collect': process.env.CRON_LOCAL_COLLECT || '0 */2 * * *',
  },
};

export function loadSites() {
  const p = config.sitesPaths.find((f) => fs.existsSync(f));
  if (!p) return [];
  const sites = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const s of sites) {
    s.group ||= 'Ungrouped';
    if (!s.slug || !s.url) throw new Error(`Site entry missing slug or url: ${JSON.stringify(s)}`);
    s.host = new URL(s.url).host.replace(/^www\./, '');
    s.keywords ||= [];
    s.competitors ||= [];
    s.localKeywords ||= [];
    s.locations = (s.locations || []).map((l) => {
      if (!l.slug || !l.name) throw new Error(`Location in ${s.slug} missing slug or name`);
      return { keywords: [], ...l };
    });
  }
  return sites;
}
