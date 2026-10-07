import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL');

/** Run fn inside a transaction (node:sqlite has no .transaction() helper). */
export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

db.exec(`
CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY, site TEXT NOT NULL, started_at TEXT, finished_at TEXT,
  pages_crawled INTEGER, score INTEGER, issue_counts TEXT
);
CREATE TABLE IF NOT EXISTS audit_pages (
  audit_id INTEGER, url TEXT, status INTEGER, title TEXT, meta_description TEXT, h1_count INTEGER,
  word_count INTEGER, load_ms INTEGER, bytes INTEGER, canonical TEXT, noindex INTEGER,
  images INTEGER, images_no_alt INTEGER, internal_links INTEGER, redirect_chain TEXT,
  PRIMARY KEY (audit_id, url)
);
CREATE TABLE IF NOT EXISTS audit_issues (
  audit_id INTEGER, url TEXT, severity TEXT, code TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS audit_issues_idx ON audit_issues (audit_id, severity);

CREATE TABLE IF NOT EXISTS ranks (
  site TEXT, keyword TEXT, checked_on TEXT, position INTEGER, url TEXT, serp_top TEXT,
  PRIMARY KEY (site, keyword, checked_on)
);
CREATE TABLE IF NOT EXISTS gsc_daily (
  site TEXT, date TEXT, clicks INTEGER, impressions INTEGER, ctr REAL, position REAL,
  PRIMARY KEY (site, date)
);
CREATE TABLE IF NOT EXISTS gsc_queries (
  site TEXT, period_end TEXT, query TEXT, page TEXT, clicks INTEGER, impressions INTEGER, ctr REAL, position REAL,
  PRIMARY KEY (site, period_end, query, page)
);
CREATE TABLE IF NOT EXISTS keyword_data (
  keyword TEXT PRIMARY KEY, volume INTEGER, cpc REAL, competition REAL, difficulty INTEGER, fetched_on TEXT
);
CREATE TABLE IF NOT EXISTS domain_snapshots (
  domain TEXT, fetched_on TEXT, organic_keywords INTEGER, organic_etv REAL,
  backlinks INTEGER, referring_domains INTEGER, domain_rank INTEGER,
  PRIMARY KEY (domain, fetched_on)
);
CREATE TABLE IF NOT EXISTS domain_keywords (
  domain TEXT, fetched_on TEXT, keyword TEXT, position INTEGER, volume INTEGER, url TEXT,
  PRIMARY KEY (domain, fetched_on, keyword)
);
CREATE TABLE IF NOT EXISTS job_log (
  id INTEGER PRIMARY KEY, job TEXT, site TEXT, started_at TEXT, finished_at TEXT, ok INTEGER, message TEXT
);
`);

export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => new Date().toISOString();

export async function logJob(job, site, fn) {
  const started = now();
  try {
    const r = await fn();
    db.prepare('INSERT INTO job_log (job,site,started_at,finished_at,ok,message) VALUES (?,?,?,?,1,?)')
      .run(job, site, started, now(), typeof r === 'string' ? r : 'ok');
    return r;
  } catch (e) {
    db.prepare('INSERT INTO job_log (job,site,started_at,finished_at,ok,message) VALUES (?,?,?,?,0,?)')
      .run(job, site, started, now(), String(e.message || e));
    throw e;
  }
}

// ---- Local SEO (added with the locations layer) ----
db.exec(`
CREATE TABLE IF NOT EXISTS gbp_snapshots (
  site TEXT, location TEXT, fetched_on TEXT, title TEXT, address TEXT, phone TEXT, website TEXT,
  primary_category TEXT, rating REAL, review_count INTEGER, photo_count INTEGER, has_hours INTEGER,
  has_description INTEGER, completeness INTEGER, open_status TEXT,
  PRIMARY KEY (site, location, fetched_on)
);
CREATE TABLE IF NOT EXISTS gbp_reviews (
  site TEXT, location TEXT, review_id TEXT PRIMARY KEY, created_at TEXT, rating INTEGER, reviewer TEXT,
  comment TEXT, replied INTEGER
);
CREATE TABLE IF NOT EXISTS gbp_daily (
  site TEXT, location TEXT, date TEXT, impressions_search INTEGER, impressions_maps INTEGER,
  calls INTEGER, directions INTEGER, website_clicks INTEGER,
  PRIMARY KEY (site, location, date)
);
CREATE TABLE IF NOT EXISTS local_ranks (
  site TEXT, location TEXT, keyword TEXT, checked_on TEXT, map_pack INTEGER, organic INTEGER, top_pack TEXT,
  PRIMARY KEY (site, location, keyword, checked_on)
);
CREATE TABLE IF NOT EXISTS nap_checks (
  site TEXT, location TEXT, checked_on TEXT, source TEXT, name_ok INTEGER, address_ok INTEGER, phone_ok INTEGER, detail TEXT,
  PRIMARY KEY (site, location, checked_on, source)
);
`);

// ---- Standard-queue tasks and spend tracking ----
db.exec(`
CREATE TABLE IF NOT EXISTS dfs_tasks (
  task_id TEXT PRIMARY KEY, kind TEXT, site TEXT, location TEXT, keyword TEXT, posted_on TEXT, status TEXT, cost REAL
);
CREATE TABLE IF NOT EXISTS dfs_spend (
  month TEXT, kind TEXT, calls INTEGER, cost REAL, PRIMARY KEY (month, kind)
);
`);

// ---- Facebook and Instagram (Meta Graph API) ----
db.exec(`
CREATE TABLE IF NOT EXISTS meta_snapshots (
  site TEXT, platform TEXT, fetched_on TEXT, account_id TEXT, name TEXT, followers INTEGER, posts INTEGER,
  PRIMARY KEY (site, platform, fetched_on)
);
CREATE TABLE IF NOT EXISTS meta_daily (
  site TEXT, platform TEXT, date TEXT, metric TEXT, value INTEGER,
  PRIMARY KEY (site, platform, date, metric)
);
CREATE TABLE IF NOT EXISTS meta_posts (
  post_id TEXT PRIMARY KEY, site TEXT, platform TEXT, created_at TEXT, message TEXT, permalink TEXT, media_type TEXT,
  likes INTEGER, comments INTEGER, shares INTEGER, fetched_on TEXT
);
CREATE TABLE IF NOT EXISTS meta_comments (
  comment_id TEXT PRIMARY KEY, site TEXT, platform TEXT, post_id TEXT, created_at TEXT, author TEXT, message TEXT,
  permalink TEXT, hidden INTEGER DEFAULT 0, replied INTEGER DEFAULT 0, reply_text TEXT, replied_at TEXT, replied_by TEXT
);
CREATE INDEX IF NOT EXISTS meta_comments_idx ON meta_comments (site, replied, created_at);
`);

// ---- Ads seen in Google's Ads Transparency Center (via DataForSEO) ----
db.exec(`
CREATE TABLE IF NOT EXISTS google_ads (
  site TEXT, creative_id TEXT, advertiser_id TEXT, advertiser TEXT, verified INTEGER, format TEXT, image TEXT, preview_url TEXT,
  url TEXT, first_shown TEXT, last_shown TEXT, fetched_on TEXT,
  PRIMARY KEY (site, creative_id)
);
`);
