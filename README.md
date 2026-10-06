# SEO Desk

A self-hosted SEO dashboard for a portfolio of brand websites. It covers the parts of Semrush that matter day to day:

| Module | What it does | Data source | Cost |
|---|---|---|---|
| Site audit | Crawls each site and flags broken pages, redirect chains, missing/duplicate titles and metas, missing H1s, thin content, images without alt text, canonical problems, mobile-readiness, sitemap/robots/HTTPS checks. Scores each site and keeps history. | Built-in crawler | Free |
| Search performance | Clicks, impressions, position over 90 days; top queries and pages; "within reach" queries ranking 8–20 that are cheap wins. | Google Search Console API | Free |
| Rank tracking | Daily NZ Google positions for your keyword list, with 30-day sparklines and which competitors appear in the same results. | DataForSEO SERP API | ~US$0.002 per keyword check |
| Competitors | Organic keyword count, estimated traffic, backlinks and referring domains for you and each competitor; keyword gap (what they rank for that you don't); volume and difficulty for your tracked keywords. | DataForSEO Labs + Backlinks | A few cents per domain refresh |
| Local SEO | Per-clinic Business Profile listing (rating, review count, completeness, open status), reviews with unreplied and low-rating flags, listing performance (search/maps views, calls, direction requests), map-pack rankings checked from each town, and name/address/phone consistency between config, website and listing. A group-wide "All clinics" view sorts by who needs attention. | Google Business Profile APIs + DataForSEO | Free + ~US$0.003 per local check |
| Digest | Weekly email summarising score changes, errors, rank movers and within-reach queries across all brands. | SMTP | Free |

Everything is optional. Brands without a `locations` list simply don't show the clinic sections. A brand whose Search Console property or Google listing the account can't reach shows as **Not connected** everywhere — never as zero.

## Two audiences, two views

- **Overview** (the home page) is for management: a block per group (`group` in sites.json — e.g. Comhla and Nexeus Supply Chain are never mixed), a handful of headline figures, then each brand with a Good / Watch / Problem / Not connected signal, the reason in plain words, and what changed since last month. Readable in under a minute.
- **Dashboard** and the per-brand pages are the marketing team's detail: audits, Search Console, rank tracking, competitors, clinics, reviews.

Signal rules live in `brandSignal()` in `src/queries.js` and are deliberately simple: Problem = search traffic down 20%+, site health under 60, several poor reviews, or a listing showing as closed. Watch = traffic slipping 5%+, site issues, a poor or many unanswered reviews, fewer than half of clinics in the local top 3, or mismatched contact details.

## Login (Cloudflare Access)

The app has no login of its own. Put it behind Cloudflare Access and set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`; the app then verifies Cloudflare's signed header on every request and refuses anything that didn't come through Access (so the host's raw URL is a dead end). With those unset it runs open, for local development only — the startup log says so loudly.

**Previewing before Access is ready:** set `PREVIEW_PASSWORD` and the browser asks for a password (any username) instead. It's a stopgap for trying the app on Railway's own `*.up.railway.app` address; once the two Access values are set it is ignored.

## DataForSEO spend cap

`DFS_MONTHLY_CAP_USD` (default 10) is a hard ceiling. Every job estimates its cost before posting and skips with a logged message if the month's total would exceed it; actual costs reported by the API are recorded per month in the `dfs_spend` table and shown in the dashboard header. Local map-pack checks use the **standard queue** (posted Monday, collected over the following hours) at a fraction of the live price; brand rank checks and competitor refreshes use live endpoints because they're small. With no API keys at all you still get the site audit and dashboard.

## Setup

Requires Node 22.13 or newer. There are no native dependencies, so Node does not need to be *installed* — see "No admin rights?" below.

```bash
npm install
cp .env.example .env                          # fill in what you have
cp data/sites.example.json data/sites.json    # add your brands
npm start                                     # dashboard on http://localhost:3040
```

### Sites file

`data/sites.json` is the single place brands are configured:

```json
{
  "slug": "heartland",
  "name": "Heartland Feeds",
  "url": "https://www.heartlandfeeds.co.nz",
  "gscProperty": "sc-domain:heartlandfeeds.co.nz",
  "keywords": ["mineral supplements for cattle nz", "calf feed nz"],
  "competitors": ["competitor-one.co.nz"]
}
```

`gscProperty` must match the property exactly as it appears in Search Console (`sc-domain:example.co.nz` for domain properties, `https://www.example.co.nz/` for URL-prefix properties).

### Locations (clinic brands)

Add a `locations` list to any brand. Each location needs `slug` and `name`; the rest switches features on:

| Field | Enables |
|---|---|
| `town`, `lat`, `lng` (optional `zoom`, default 14) | Map-pack rank checks run from that point on the map, weekly, via DataForSEO's standard queue |
| `placeId` or `cid` | Exact matching of the clinic in results (otherwise matched by phone, then name). Get the place ID from the listing's Maps URL or `GET /api/gbp/listings` |
| `address`, `phone`, `url` | Name/address/phone consistency check against the clinic's web page |
| `gbpLocationId` | Business Profile sync (listing, reviews, performance) |

`localKeywords` on the brand are templates: `"vet {town}"` becomes `vet feilding`, `vet otaki`, and so on. A location can add its own `keywords` too.

### Google Business Profile

Clinic listings and reviews come from one of two places, chosen per clinic:

- **Without API approval (DataForSEO).** If DataForSEO is configured, any clinic with a `placeId`, `cid`, or `lat`/`lng` gets its public listing (rating, review count, open status, completeness) and its newest 50 reviews (including whether the owner replied) once a week. That costs about US$0.01 per clinic per week and counts towards the spend cap. A clinic found by name and coordinates logs its place ID, so you can paste that into `sites.json` and pin it. This route can't get the listing's private stats: search and Maps views, calls, and direction requests.
- **With API approval (Business Profile API).** Clinics with a `gbpLocationId` use the API once it is set up below, and that adds the performance stats. The API takes over from DataForSEO for those clinics automatically.

The API is the one that needs a formal request, because Google gates Business Profile API access per Cloud project. The form checks the signed-in account straight away: it has to own a listing that has been verified for at least 60 days, ideally with an email address on the listing's website domain. Otherwise it rejects the request immediately.

1. In the same Cloud project, enable **My Business Account Management**, **My Business Business Information**, **Business Profile Performance** and **My Business API** (v4, for reviews), then submit the [access request form](https://developers.google.com/my-business/content/prereqs). Approval typically takes a few days.
2. Create an **OAuth client** of type *Desktop app* and put its ID and secret in `.env`. (Service accounts do not work for Business Profile — it has to be a Google account that is an owner or manager of the listings.)
3. `npm run gbp:auth`, sign in as that account, paste the code, and put the printed refresh token in `.env`.
4. `GET /api/gbp/listings` (or open it in a browser once the server is running) lists every listing that account manages with its ID — paste those into `gbpLocationId`.

This ties directly into the access-transfer work: a clinic whose listing isn't managed by the central account won't appear until it is.

### Google Search Console

1. In Google Cloud Console create a project, enable the **Search Console API**, create a **service account** and download its JSON key to `data/gsc-service-account.json`.
2. In Search Console, add the service account's email address as a user on every property.
3. Set `GSC_SERVICE_ACCOUNT_JSON` in `.env`.

### DataForSEO

Create an account at dataforseo.com, top up a small balance (pay-as-you-go, no subscription), and put the API login/password in `.env`. `DFS_LOCATION_CODE=2554` is New Zealand.

Rough monthly cost at 5 brands × 20 keywords checked daily plus a monthly competitor refresh: US$10–20.

### Email digest

Any SMTP account works (Google Workspace, Microsoft 365, Postmark, etc.). Leave `SMTP_HOST` blank to skip sending; `/api/digest` still shows a preview.

## Running jobs

The server schedules everything via the cron expressions in `.env`. You can also run any job by hand:

```bash
npm run audit               # all sites
npm run audit -- heartland  # one site
npm run ranks
npm run gsc
npm run competitors
npm run digest
npm run gbp                 # Business Profile sync (API, and/or DataForSEO public listing + reviews)
npm run local               # post this week's map-pack checks + name/address/phone check
node src/cli.js local-collect   # collect finished map-pack and review results (cron runs this every 2h)
```

Or click the buttons in the dashboard, which fire the same jobs in the background.

## Deploying on Railway (the current plan)

Do these in order. Setting up Access (step 3) before the first deploy means the app is never reachable without a login.

1. **Sites file.** Commit your real brands as `sites.json` at the repo root (it holds no secrets). Don't rely on `data/sites.json` there: the volume mounted at `/app/data` hides anything committed under `data/`. The app reads `data/sites.json` first, then `sites.json`, then the example.
2. **Project.** Railway → New Project → Deploy from GitHub repo → `NexeusSupply/SEO-DESK`. The `Dockerfile` is detected. Then right-click the service → **Attach volume**, mount path `/app/data` (the SQLite database lives there). Don't add a healthcheck path; Access would refuse it.
3. **Cloudflare Access.** Zero Trust → Access → Applications → Add → *Self-hosted*. Domain `seo.comhlavet.com`, a policy that allows your team's emails. From the application's Overview tab copy the **Application Audience (AUD) tag**; the team domain is under Settings → Custom pages (looks like `yourteam.cloudflareaccess.com`).
4. **Variables.** Service → Variables → Raw Editor, paste from `.env.example` and fill in at least `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`. Leave `PORT` and `DB_PATH` out (Railway sets `PORT`; the image sets `DB_PATH` and `TZ`). For Search Console paste the key file's whole contents into `GSC_SERVICE_ACCOUNT_JSON_CONTENT`. Anything left blank just switches that module off.
5. **Domain.** Service → Settings → Networking → Custom domain `seo.comhlavet.com`. Railway shows a CNAME target (and sometimes a TXT verification record); IT adds them in Cloudflare with the CNAME proxied, and the zone's SSL/TLS mode must be **Full**, not Flexible (Flexible causes a redirect loop). Skip "Generate domain": the `*.up.railway.app` address would only ever answer 403.
6. **Check.** The deploy log should say `Access: enforced` and `Sites: sites.json (N brands)`. Open `https://seo.comhlavet.com`, sign in through Access, and `/api/status` shows your email and which modules are on.

## No admin rights on your PC?

**Option A — portable, no installer.** On nodejs.org pick the Windows **Binary (.zip)**, not the .msi. Unzip it into a folder named `node` inside the SEO Desk folder, then double-click `run.cmd`. It installs the npm packages into the project folder (no admin needed), creates `.env` and `sites.json` if missing, and opens the dashboard. If your PC blocks unsigned executables entirely, go with option B.

**Option B — skip the PC and host it from day one.** This is where it should end up anyway, because the scheduled jobs need something that stays on:

- *Railway / Render / Fly.io* — connect a GitHub repo containing this folder; the `Dockerfile` is picked up automatically. Attach a persistent volume at `/app/data` (Railway: Volumes; Fly: `fly volumes create`). Set the `.env` values as environment variables in their dashboard instead of a file. Expect NZ$8–15/month.
- *Any VPS* — `docker run -d -p 3040:3040 -v $PWD/data:/app/data --env-file .env seo-desk` after `docker build -t seo-desk .`, or run with pm2 as below.

Either way, put the dashboard behind a login (Cloudflare Access, or the host's built-in auth) before sharing the URL — it has none of its own.

## Hosting

- **Your own machine** — fine to start; jobs only run while `npm start` is running.
- **A small VPS** (any ~NZ$10/month box) — run under `pm2` or a systemd unit so it stays up.
- **Docker** — `Dockerfile` included; mount `data/` as a volume so the SQLite file and keys persist.
- **Zoho Catalyst** — AppSail can host the Express app, but Catalyst's filesystem is not persistent, so you would swap the built-in SQLite (`node:sqlite`) for Catalyst Data Store or an external Postgres. Worth doing only once the tool has earned its place.

## Layout

```
src/
  server.js           Express API + static dashboard + scheduler
  access.js           Cloudflare Access JWT verification
  config.js           .env and sites.json loading
  db.js               SQLite schema
  queries.js          Read models for dashboard and digest
  jobs.js             One entry point per job
  scheduler.js        node-cron wiring
  digest.js           Weekly email
  cli.js              Run jobs from the shell
run.cmd               Portable Windows launcher
Dockerfile            For Railway / Render / Fly / any VPS
  audit/crawler.js    Polite crawler (robots.txt, concurrency, redirect chains)
  audit/rules.js      Issue rules, labels, scoring
  audit/index.js      Runs a crawl and stores results
  data/dataforseo.js  Thin API client
  data/ranks.js       Rank tracking
  data/gsc.js         Search Console sync
  data/competitors.js Domain snapshots, keyword enrichment, keyword gap
  data/gbp.js         Business Profile listings, reviews, performance
  data/listings-public.js  Public listing + reviews via DataForSEO when the API isn't available
  data/gbp-auth.js    One-time OAuth helper
  data/local.js       Map-pack rank checks and NAP consistency
public/               Dashboard (no build step)
data/                 sites.json, SQLite database, GSC key
```

## Extending

- Add an audit rule: append to `evaluate()` in `src/audit/rules.js` and give it a label in `ISSUE_LABELS`.
- Add a data source (Bing Webmaster, PageSpeed Insights…): a module in `src/data/`, a table in `db.js`, a job in `jobs.js`, a section in `queries.js` and `public/app.js`.
- The API is plain JSON (`/api/overview`, `/api/sites/:slug`), so it can feed a Zoho Analytics or Looker Studio report if you'd rather chart there.
