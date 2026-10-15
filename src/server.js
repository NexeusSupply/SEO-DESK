import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, loadSites } from './config.js';
import { overview, siteDetail, issueDetail, allLocations, management, socialComments, allAds, clinicDetail, allAi } from './queries.js';
import { accessMiddleware } from './access.js';
import { spendThisMonth } from './data/dataforseo.js';
import { listAllLocations } from './data/gbp.js';
import { listPages, replyToComment, hideComment, markHandled } from './data/meta.js';
import { draftReply, draftPost, EXAMPLES } from './data/reply-helper.js';
import { listPages as listPlanablePages, createDraft, savedPages } from './data/planable.js';
import { researchClinic, keywordSummary } from './data/keywords.js';
import { suggestForClinic, clinicSnapshot, brandSnapshot } from './data/suggestions.js';
import { setChecklistItem } from './data/checklist.js';
import { listArticles, articleDetail, createArticle, rewriteVersion, addBrands, saveVersion, approveVersion, skipVersion, sendVersion, publishRoute } from './data/articles.js';
import { buildDigest } from './digest.js';
import { connectionList, recipients, saveRecipients, digestRecipients, JOB_LABELS } from './settings.js';
import { SECTIONS, listReports, saveReport, deleteReport, setEnabled, sendReport, buildReport } from './reports.js';
import { jobs } from './jobs.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.set('trust proxy', 1);
app.use(accessMiddleware());
app.use(express.json());
app.use(express.static(path.join(config.root, 'public')));

const site = (req, res) => { const s = loadSites().find((x) => x.slug === req.params.slug); if (!s) res.status(404).json({ error: 'unknown site' }); return s; };

app.get('/api/status', (req, res) => res.json({ dataforseo: config.dfs.enabled, searchConsole: config.gsc.enabled, businessProfile: config.gbp.enabled, meta: config.meta.enabled, planable: config.planable.enabled, claude: config.claude.enabled, email: config.smtp.ready,
  access: config.access.enabled, preview: !config.access.enabled && Boolean(config.access.previewPassword), user: req.user?.email, cron: config.cron, dfsSpendUsd: config.dfs.enabled ? +spendThisMonth().toFixed(2) : null, dfsCapUsd: config.dfs.monthlyCapUsd }));
app.get('/api/management', (_, res) => res.json(management(loadSites())));
app.get('/api/overview', (_, res) => res.json(overview(loadSites())));
app.get('/api/sites/:slug', (req, res) => { const s = site(req, res); if (s) res.json(siteDetail(s)); });
app.get('/api/sites/:slug/issues/:code', (req, res) => { const s = site(req, res); if (s) res.json(issueDetail(s, req.params.code)); });
app.get('/api/sites/:slug/clinics/:loc', (req, res) => {
  const s = site(req, res); if (!s) return;
  const loc = s.locations.find((l) => l.slug === req.params.loc);
  if (!loc) return res.status(404).json({ error: 'unknown clinic' });
  res.json(clinicDetail(s, loc));
});
// Keyword research for one clinic (DataForSEO, a few cents) and Claude's traffic ideas. Both answer when done.
const clinicAction = (fn) => (req, res) => {
  const s = site(req, res); if (!s) return;
  const loc = s.locations.find((l) => l.slug === req.params.loc);
  if (!loc) return res.status(404).json({ error: 'unknown clinic' });
  Promise.resolve().then(() => fn(s, loc, req)).then((r) => res.json(r)).catch((e) => { console.warn(`[${req.path}] ${e.message}`); res.status(502).json({ error: e.message }); });
};
const words = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,\n]/)).map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 10);
app.post('/api/sites/:slug/clinics/:loc/keywords', clinicAction(async (s, loc, req) => { await researchClinic(s, loc, words(req.body?.extra)); return keywordSummary(s, loc); }));
const focus = (req) => String(req.body?.focus || '').slice(0, 500).trim();
app.post('/api/sites/:slug/clinics/:loc/suggestions', clinicAction((s, loc, req) =>
  suggestForClinic(s, loc, clinicSnapshot(clinicDetail(s, loc), keywordSummary(s, loc)), focus(req), req.user?.email)));
// Tick a top-3 checklist item by hand: done true / false, or null to go back to "not checked".
app.post('/api/sites/:slug/clinics/:loc/checklist', clinicAction((s, loc, req) => {
  const done = req.body?.done == null ? null : Boolean(req.body.done);
  setChecklistItem(s, loc, String(req.body?.item || ''), done, req.user?.email);
  return clinicDetail(s, loc).checklist;
}));
// The same two for a whole brand: what Cowsmart, the supply chain businesses and brand websites use.
const brandAction = (fn) => (req, res) => {
  const s = site(req, res); if (!s) return;
  Promise.resolve().then(() => fn(s, req)).then((r) => res.json(r)).catch((e) => { console.warn(`[${req.path}] ${e.message}`); res.status(502).json({ error: e.message }); });
};
app.post('/api/sites/:slug/keywords', brandAction(async (s, req) => { await researchClinic(s, null, words(req.body?.extra)); return keywordSummary(s, null); }));
app.post('/api/sites/:slug/suggestions', brandAction((s, req) =>
  suggestForClinic(s, null, brandSnapshot(s, siteDetail(s), keywordSummary(s, null)), focus(req), req.user?.email)));
app.get('/api/ai', (_, res) => res.json(allAi(loadSites())));
app.get('/api/ads', (_, res) => res.json(allAds(loadSites())));
app.get('/api/locations', (_, res) => res.json(allLocations(loadSites())));
// Finds gbpLocationId values for every listing the signed-in Google account manages
app.get('/api/gbp/listings', (_, res) => listAllLocations().then((r) => res.json(r)).catch((e) => res.status(500).json({ error: e.message })));
// Facebook and Instagram. /api/meta/pages finds the pageId / instagramId values for sites.json.
app.get('/api/meta/pages', (_, res) => listPages().then((r) => res.json(r)).catch((e) => res.status(500).json({ error: e.message })));
app.get('/api/comments', (req, res) => res.json(socialComments(loadSites().filter((s) => !req.query.site || s.slug === req.query.site), { status: req.query.status === 'all' ? 'all' : 'open', limit: 200 })));
const commentAction = (fn) => (req, res) => {
  const s = site(req, res); if (!s) return;
  Promise.resolve().then(() => fn(s, req)).then((r) => res.json(r)).catch((e) => res.status(e.message.startsWith('unknown') ? 404 : 502).json({ error: e.message }));
};
app.post('/api/sites/:slug/comments/:id/reply', commentAction((s, req) => {
  const message = String(req.body?.message || '').trim();
  if (!message) throw new Error('empty reply');
  return replyToComment(s, req.params.id, message, req.user?.email);
}));
app.post('/api/sites/:slug/comments/:id/hide', commentAction((s, req) => hideComment(s, req.params.id, req.body?.hidden !== false)));
app.post('/api/sites/:slug/comments/:id/handled', commentAction((s, req) => markHandled(s, req.params.id, req.user?.email)));
// Claude drafts a reply to a Google review or a Facebook/Instagram comment; a person edits it before it's posted.
const note = (req) => String(req.body?.note || '').slice(0, 500).trim();
app.post('/api/sites/:slug/reviews/:id/draft-reply', commentAction((s, req) => draftReply('review', s, req.params.id, note(req))));
app.post('/api/sites/:slug/comments/:id/draft-reply', commentAction((s, req) => draftReply('comment', s, req.params.id, note(req))));
// Planable. /api/planable/pages finds the workspaceId and pageIds values for sites.json.
app.get('/api/planable/pages', (_, res) => listPlanablePages().then((r) => res.json(r)).catch((e) => res.status(500).json({ error: e.message })));
// Claude writes a social post from a topic; a person edits it, then it goes to Planable as a draft for approval.
const pagePlatforms = (s, ids) => savedPages(s).filter((p) => (ids || []).includes(p.id)).map((p) => p.platform);
app.post('/api/sites/:slug/planable/draft-text', brandAction((s, req) =>
  draftPost(s, String(req.body?.topic || '').slice(0, 2000).trim(), pagePlatforms(s, req.body?.pageIds))));
app.post('/api/sites/:slug/planable/posts', brandAction((s, req) =>
  createDraft(s, { text: String(req.body?.text || '').slice(0, 25000), pageIds: Array.isArray(req.body?.pageIds) ? req.body.pageIds.map(String) : [], user: req.user?.email })));
// Shared articles: one article in, a localised version per brand out, each reviewed and approved before it goes to the website.
app.get('/api/articles', (_, res) => res.json({ articles: listArticles(),
  brands: loadSites().map((s) => ({ slug: s.slug, name: s.name, group: s.group, host: s.host, route: publishRoute(s) })) }));
const slugs = (v) => (Array.isArray(v) ? v : []).map(String).slice(0, 50);
app.post('/api/articles', (req, res) => {
  try {
    const id = createArticle({ title: String(req.body?.title || '').slice(0, 300).trim(), body: String(req.body?.body || '').slice(0, 60000).trim(),
      notes: String(req.body?.notes || '').slice(0, 2000).trim(), sites: slugs(req.body?.sites), user: req.user?.email });
    res.json(articleDetail(id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/articles/:id', (req, res) => { const a = articleDetail(Number(req.params.id)); a ? res.json(a) : res.status(404).json({ error: 'unknown article' }); });
app.post('/api/articles/:id/brands', (req, res) => {
  try { addBrands(Number(req.params.id), slugs(req.body?.sites)); res.json(articleDetail(Number(req.params.id))); } catch (e) { res.status(400).json({ error: e.message }); }
});
const versionAction = (fn) => (req, res) => {
  const s = site(req, res); if (!s) return;
  const id = Number(req.params.id);
  Promise.resolve().then(() => fn(id, s, req)).then((r) => res.json({ ...(r && typeof r === 'object' ? { result: r } : {}), article: articleDetail(id) }))
    .catch((e) => { console.warn(`[${req.path}] ${e.message}`); res.status(/^unknown/.test(e.message) ? 404 : /^WordPress/.test(e.message) ? 502 : 400).json({ error: e.message }); });
};
app.post('/api/articles/:id/versions/:slug', versionAction((id, s, req) => saveVersion(id, s, req.body || {})));
app.post('/api/articles/:id/versions/:slug/rewrite', versionAction((id, s, req) => rewriteVersion(id, s, note(req))));
app.post('/api/articles/:id/versions/:slug/approve', versionAction((id, s, req) => approveVersion(id, s, req.body?.approved !== false, req.user?.email)));
app.post('/api/articles/:id/versions/:slug/skip', versionAction((id, s, req) => skipVersion(id, s, req.body?.skip !== false)));
// Goes to the brand's WordPress site: as a draft unless the person picked publish or a scheduled date.
app.post('/api/articles/:id/versions/:slug/send', versionAction((id, s, req) => sendVersion(id, s, { mode: String(req.body?.mode || 'draft'), date: req.body?.date, user: req.user?.email })));
app.get('/api/reply-examples', (_, res) => res.json(EXAMPLES));
app.get('/api/digest', (_, res) => res.send(buildDigest()));

// Settings: what's connected, who gets emails, and scheduled reports.
app.get('/api/settings', (_, res) => {
  const sites = loadSites();
  res.json({ connections: connectionList(), email: { ready: config.smtp.ready, from: config.smtp.from || config.smtp.user || null },
    recipients: recipients(), envRecipients: String(config.smtp.to || '').split(/[,;\s]+/).filter(Boolean), digestTo: digestRecipients(),
    reports: listReports(), sections: SECTIONS,
    brands: sites.map((s) => ({ slug: s.slug, name: s.name, group: s.group, clinics: s.locations.map((l) => ({ slug: l.slug, name: l.name, town: l.town ?? null })) })),
    schedules: Object.entries({ ...config.cron, reports: config.reportsCron }).map(([job, cron]) => ({ job, cron, label: job === 'reports' ? 'Check for scheduled reports due' : JOB_LABELS[job] || job })) });
});
const settingsAction = (fn) => (req, res) => {
  Promise.resolve().then(() => fn(req)).then((r) => res.json(r ?? { ok: true }))
    .catch((e) => res.status(/^unknown/.test(e.message) ? 404 : 400).json({ error: e.message }));
};
app.post('/api/settings/recipients', settingsAction((req) => saveRecipients(req.body?.recipients, req.user?.email)));
app.post('/api/reports', settingsAction((req) => saveReport(null, req.body, req.user?.email)));
app.post('/api/reports/preview', settingsAction((req) => buildReport(req.body || {})));
app.post('/api/reports/:id', settingsAction((req) => saveReport(Number(req.params.id), req.body, req.user?.email)));
app.post('/api/reports/:id/enabled', settingsAction((req) => setEnabled(Number(req.params.id), req.body?.enabled !== false)));
app.post('/api/reports/:id/send', settingsAction((req) => sendReport(Number(req.params.id))));
app.delete('/api/reports/:id', settingsAction((req) => { deleteReport(Number(req.params.id)); }));

// Run a job now: POST /api/run/audit?site=heartland  (fires in background)
app.post('/api/run/:job', (req, res) => {
  const j = jobs[req.params.job];
  if (!j) return res.status(404).json({ error: 'unknown job' });
  j(req.query.site).then((r) => console.log(`[run] ${req.params.job}:`, r.join(' | '))).catch(console.error);
  res.json({ started: req.params.job, site: req.query.site || 'all' });
});

app.listen(config.port, () => {
  console.log(`SEO Desk on http://localhost:${config.port}`);
  console.log(`DataForSEO: ${config.dfs.enabled ? 'on' : 'off'} · Search Console: ${config.gsc.enabled ? 'on' : 'off'} · Business Profile: ${config.gbp.enabled ? 'on' : 'off'} · Meta: ${config.meta.enabled ? 'on' : 'off'} · Planable: ${config.planable.enabled ? 'on' : 'off'} · Access: ${config.access.enabled ? 'enforced' : config.access.previewPassword ? 'preview password' : 'OFF (open to anyone who can reach this port)'}`);
  const sitesFile = config.sitesPaths.find((f) => fs.existsSync(f));
  console.log(sitesFile ? `Sites: ${path.relative(config.root, sitesFile)} (${loadSites().length} brands)` : 'Sites: none found — add data/sites.json or commit sites.json at the repo root');
  startScheduler();
});
