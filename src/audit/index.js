import { db, tx, now, logJob } from '../db.js';
import { crawlSite } from './crawler.js';
import { evaluate, score } from './rules.js';

export async function runAudit(site) {
  return logJob('audit', site.slug, async () => {
    const started = now();
    const { pages, extras } = await crawlSite(site, (p, n) => { if (n % 25 === 0) console.log(`[audit:${site.slug}] ${n} pages`); });
    const issues = evaluate(pages, extras);
    const s = score(pages, issues);
    const counts = issues.reduce((a, i) => ({ ...a, [i.severity]: (a[i.severity] || 0) + 1 }), {});

    const insertAudit = db.prepare('INSERT INTO audits (site,started_at,finished_at,pages_crawled,score,issue_counts) VALUES (?,?,?,?,?,?)');
    const insertPage = db.prepare(`INSERT OR REPLACE INTO audit_pages
      (audit_id,url,status,title,meta_description,h1_count,word_count,load_ms,bytes,canonical,noindex,images,images_no_alt,internal_links,redirect_chain)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insertIssue = db.prepare('INSERT INTO audit_issues (audit_id,url,severity,code,detail) VALUES (?,?,?,?,?)');

    tx(() => {
      const id = insertAudit.run(site.slug, started, now(), pages.length, s, JSON.stringify(counts)).lastInsertRowid;
      for (const p of pages) {
        const d = p.parsed || {};
        insertPage.run(id, p.url, p.status, d.title || null, d.metaDescription || null, d.h1Count ?? null, d.wordCount ?? null,
          p.loadMs, p.bytes, d.canonical || null, d.noindex ?? null, d.images ?? null, d.imagesNoAlt ?? null, d.internalLinks ?? null,
          p.chain?.length ? JSON.stringify(p.chain) : null);
      }
      for (const i of issues) insertIssue.run(id, i.url, i.severity, i.code, i.detail);
    });
    return `${pages.length} pages, score ${s}, ${issues.length} issues`;
  });
}
