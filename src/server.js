import express from 'express';
import path from 'node:path';
import { config, loadSites } from './config.js';
import { overview, siteDetail, issueDetail, allLocations, management } from './queries.js';
import { accessMiddleware } from './access.js';
import { spendThisMonth } from './data/dataforseo.js';
import { listAllLocations } from './data/gbp.js';
import { buildDigest } from './digest.js';
import { jobs } from './jobs.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.set('trust proxy', 1);
app.use(accessMiddleware());
app.use(express.json());
app.use(express.static(path.join(config.root, 'public')));

const site = (req, res) => { const s = loadSites().find((x) => x.slug === req.params.slug); if (!s) res.status(404).json({ error: 'unknown site' }); return s; };

app.get('/api/status', (req, res) => res.json({ dataforseo: config.dfs.enabled, searchConsole: config.gsc.enabled, businessProfile: config.gbp.enabled, email: config.smtp.enabled,
  access: config.access.enabled, user: req.user?.email, cron: config.cron, dfsSpendUsd: config.dfs.enabled ? +spendThisMonth().toFixed(2) : null, dfsCapUsd: config.dfs.monthlyCapUsd }));
app.get('/api/management', (_, res) => res.json(management(loadSites())));
app.get('/api/overview', (_, res) => res.json(overview(loadSites())));
app.get('/api/sites/:slug', (req, res) => { const s = site(req, res); if (s) res.json(siteDetail(s)); });
app.get('/api/sites/:slug/issues/:code', (req, res) => { const s = site(req, res); if (s) res.json(issueDetail(s, req.params.code)); });
app.get('/api/locations', (_, res) => res.json(allLocations(loadSites())));
// Finds gbpLocationId values for every listing the signed-in Google account manages
app.get('/api/gbp/listings', (_, res) => listAllLocations().then((r) => res.json(r)).catch((e) => res.status(500).json({ error: e.message })));
app.get('/api/digest', (_, res) => res.send(buildDigest()));

// Run a job now: POST /api/run/audit?site=heartland  (fires in background)
app.post('/api/run/:job', (req, res) => {
  const j = jobs[req.params.job];
  if (!j) return res.status(404).json({ error: 'unknown job' });
  j(req.query.site).then((r) => console.log(`[run] ${req.params.job}:`, r.join(' | '))).catch(console.error);
  res.json({ started: req.params.job, site: req.query.site || 'all' });
});

app.listen(config.port, () => {
  console.log(`SEO Desk on http://localhost:${config.port}`);
  console.log(`DataForSEO: ${config.dfs.enabled ? 'on' : 'off'} · Search Console: ${config.gsc.enabled ? 'on' : 'off'} · Business Profile: ${config.gbp.enabled ? 'on' : 'off'} · Access: ${config.access.enabled ? 'enforced' : 'OFF (open to anyone who can reach this port)'}`);
  startScheduler();
});
