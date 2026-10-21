# SEO Desk

A self-hosted SEO dashboard for a portfolio of brand websites. It covers the parts of Semrush that matter day to day:

| Module | What it does | Data source | Cost |
|---|---|---|---|
| Site audit | Crawls each site and flags broken pages, redirect chains, missing/duplicate titles and metas, missing H1s, thin content, images without alt text, canonical problems, mobile-readiness, sitemap/robots/HTTPS checks. Scores each site and keeps history. | Built-in crawler | Free |
| Search performance | Clicks, impressions, position over 90 days; top queries and pages; "within reach" queries ranking 8–20 that are cheap wins. | Google Search Console API | Free |
| Rank tracking | Daily NZ Google positions for your keyword list, with 30-day sparklines and which competitors appear in the same results. | DataForSEO SERP API | ~US$0.002 per keyword check |
| Competitors | Organic keyword count, estimated traffic, backlinks and referring domains for you and each competitor; keyword gap (what they rank for that you don't); volume and difficulty for your tracked keywords. | DataForSEO Labs + Backlinks | A few cents per domain refresh |
| Local SEO | Per-clinic Business Profile listing (rating, review count, completeness, open status), reviews with unreplied and low-rating flags, listing performance (search/maps views, calls, direction requests), map-pack rankings checked from each town, and name/address/phone consistency between config, website and listing. A group-wide "All clinics" view sorts by who needs attention, and each clinic has its own page (pick one from the clinic menu or click its name) with its listing details, reviews, listing performance, map-pack trend and website figures. | Google Business Profile APIs + DataForSEO | Free + ~US$0.003 per local check |
| Facebook and Instagram | Followers, views and engagements over 28 days against the 28 before, recent posts with likes, comments and shares, and a comments inbox: read every comment across brands, reply publicly as the brand, hide spam, or mark it as needing no reply. Unanswered comments over a day old count towards a brand's Watch signal. | Meta Graph API | Free |
| WhatsApp | Each message to a brand's WhatsApp number is emailed to its support address (photos and files attached), so it lands in the shared mailbox rather than on one person's phone. A "WhatsApp" page shows every conversation, with replies sent as the brand's number and Claude drafts. | WhatsApp Cloud API (Meta) | Receiving is free; replies within 24 hours of the customer's last message are free or very cheap (check Meta's current rates) |
| Ads | Google ads each brand's website is running (image, text and video, with first and last shown dates) from Google's public Ads Transparency Center, checked weekly, plus a link to each brand's Facebook and Instagram ads in Meta's public Ad Library. An "Ads" page lists every brand. | DataForSEO (Google Ads Transparency) | A fraction of a cent per brand per week |
| AI answers | Once a month, asks ChatGPT, Gemini and Perplexity (with web search, as someone in New Zealand) which vet they'd recommend in each clinic's town, and checks Google's AI Overview on the town's local search. Shows whether each clinic was named and in what position, whether its website was cited, who was named instead, and the sources the AI read. Brands without clinics (Cowsmart, the supply chain businesses, the Australian brands) get brand-level questions instead, such as "Who supplies animal health products to vet clinics in New Zealand?", asked as someone in the brand's country. There's an "AI answers" page for every brand, plus a section on each brand and clinic page. | DataForSEO AI Optimization (LLM Responses) + SERP API | About US$0.02–0.04 per question per AI, plus US$0.004 per AI Overview check. Roughly US$5–7 a month for 54 towns |
| Keyword research | Per clinic, and per brand for businesses without clinics: searches to target on the website (SEO) and to bid on in Google Ads. Starts from the clinic's town and services (`vet feilding`, `farm vet feilding`, `emergency vet feilding`…) plus any words you add, pulls Google's related suggestions with monthly searches, a 12-month trend, ad competition and top-of-page bids, adds SEO difficulty, and marks each one SEO, Ads, both or low priority, with where the site already ranks. Download as CSV for Google Ads. Brands start from their `keywordSeeds` (or, with none, from what Google thinks the website is about), with Australian volumes for Australian brands. Runs when someone presses the button and is kept for a month; clinics in the same town share results. | DataForSEO (Google Ads Keyword Planner + Labs difficulty) | About US$0.09 per clinic, about US$5 for all 54 |
| Ideas to grow traffic | Per clinic, and per brand for businesses without clinics (reading the website audit, Search Console, rankings and competitors instead of the listing): Claude reads everything the dashboard knows about the clinic (listing, reviews, map pack, AI answers, ads, keyword research, website health) and suggests five to eight prioritised SEO, Google Ads, listing and review ideas, each tied to a figure, plus a starter Google search ad (headlines, descriptions, keywords to bid on). Add an optional focus such as "more puppy bookings". The latest ideas are saved on the page. | Claude (Anthropic API) | A few US cents per run |
| Shared articles | Paste in one article and Claude writes a version for each brand you pick: rewritten around its towns, region and services, aimed at a search its website is missing, with internal links to its own pages. Each version shows the SEO holes it fills, the changes to make elsewhere on the site, on-page checks, and how much text it shares with the other brands' versions. Someone edits and approves each one; WordPress sites then get it as a draft (or published or scheduled, if chosen), and the rest get copy-ready text. | Claude (Anthropic API) + WordPress REST API | Roughly US$0.10–0.30 per brand (an estimate; longer articles cost more) |
| Digest | Weekly email summarising score changes, errors, rank movers and within-reach queries across all brands. | SMTP | Free |
| Settings | Every connection and whether it's working, partly linked or missing (with the server variable to set), a light/dark/match-device switch, the report address book, and scheduled email reports: chosen brands and clinics, chosen sections, daily, weekly or monthly. | SMTP for sending | Free |

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

`gscProperty` is optional. Leave it out and the app finds the property itself among those the service account has been added to: the domain property (`sc-domain:example.co.nz`) first, then a URL-prefix one (`https://www.example.co.nz/`). Set it only to force a particular property, spelled exactly as Search Console shows it.

### Locations (clinic brands)

Add a `locations` list to any brand. Each location needs `slug` and `name`; the rest switches features on:

| Field | Enables |
|---|---|
| `town`, `lat`, `lng` (optional `zoom`, default 14) | Map-pack rank checks run from that point on the map, weekly, via DataForSEO's standard queue |
| `placeId` or `cid` | Exact matching of the clinic in results (otherwise matched by phone, then name). Get the place ID from the listing's Maps URL or `GET /api/gbp/listings` |
| `address`, `phone`, `url` | Name/address/phone consistency check against the clinic's web page |
| `gbpLocationId` | Business Profile sync (listing, reviews, performance) |
| `services` | Which keyword-research seeds the clinic gets: any of `companion`, `mixed`, `farm`, `equine` (from the clinic list's CA/Mixed/PA/Equine columns). Defaults to companion |
| `keywordSeeds` | Extra keyword-research seeds, as templates like `"puppy school {town}"`. Can also go on the brand |

`localKeywords` on the brand are templates: `"vet {town}"` becomes `vet feilding`, `vet otaki`, and so on. A location can add its own `keywords` too.

### Brands without clinics

Businesses with no clinic towns (Cowsmart, Heartland Feeds, Agilis, Fortis, DRL, TasVets, The Vet Group) get keyword research, ideas and AI answers for the brand as a whole. These brand fields drive them:

| Field | Used for |
|---|---|
| `description` | One line on what the business does, given to Claude so its ideas fit |
| `market` | `"AU"` for Australian brands: keyword volumes, bids and AI questions use Australia. Defaults to New Zealand |
| `keywordSeeds` | Searches keyword research starts from, without `{town}`, e.g. `"calf meal"`. With none, it starts from the website itself |
| `aiPrompts` | Questions to ask the AIs each month. Ones without `{town}` are asked once for the brand; `{brand}` is filled in with its name |
| `aiNames` | Other names the business goes by, so answers that use them still count (DRL is too short to match on its own, so it lists "Disease Research Limited") |

### AI answers

Brands with `localKeywords` get one question per clinic town each month: `Which vet clinic would you recommend in {town}, New Zealand?` (change it for everyone with `AI_PROMPTS`, separating several with `|`). A brand or a single location can set its own list with `"aiPrompts": ["…{town}…"]`, and `"aiNames": ["…"]` adds other names the clinic goes by, so answers that use them still count. Clinics in the same town share one answer. Google's AI Overview is checked on the same local searches as the map pack (`vet {town}`); Google often shows the map instead of an overview for these, which the dashboard reports as "none shown".

`AI_ENGINES` picks the AIs and models as `engine:model` pairs (default `chat_gpt:gpt-5-mini,gemini:gemini-2.5-flash,perplexity:sonar`). Model names come from DataForSEO's `/v3/ai_optimization/<engine>/llm_responses/models`. `AI_OVERVIEWS=off` skips the Google check. Answers are stored as given, and whether a clinic was named is worked out when the page loads. A question answered in the last 25 days isn't asked again, so pressing "Ask the AIs again" doesn't spend twice. The job stops asking once the monthly spend cap is reached; raise `DFS_MONTHLY_CAP_USD` to about 20 to leave room for everything else.

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

### Facebook and Instagram (Meta)

Add a `meta` block to each brand that has a Facebook Page. The linked Instagram professional account is found automatically; set `instagramId` only to override it.

```json
"meta": { "pageId": "123456789012345" }
```

One token covers every brand. The steps all need someone who is an admin of the Meta Business portfolio that owns the Pages:

1. **Business portfolio.** Make sure every brand's Facebook Page (and its Instagram account) sits in the same Meta Business portfolio, or is shared into it as a partner asset.
2. **App.** At developers.facebook.com create an app of type **Business**, owned by that portfolio. Add the **Facebook Login for Business** and **Instagram** (Instagram API with Facebook Login) products.
3. **System user.** Business Settings → Users → System users → add one (Admin role). Assign it the Pages and Instagram accounts with full control, and add the app under Apps.
4. **Token.** Generate a token for that system user, choosing the app and these permissions, then paste it into `META_ACCESS_TOKEN`. System user tokens don't expire.

   | Permission | Used for |
   |---|---|
   | `pages_show_list`, `business_management` | Finding the Pages (`/api/meta/pages`) |
   | `pages_read_engagement`, `read_insights` | Page followers, posts and insights |
   | `pages_read_user_content` | Reading comments and who wrote them |
   | `pages_manage_engagement` | Replying to and hiding Facebook comments |
   | `instagram_basic`, `instagram_manage_insights` | Instagram followers, posts and insights |
   | `instagram_manage_comments` | Reading, replying to and hiding Instagram comments |

5. **App review.** Because the app only touches Pages owned by the business that owns the app, Standard Access is enough and no App Review is needed. If Meta asks for one anyway (for example if a Page is owned by a different business), the same permissions above go through App Review with Business Verification.
6. If the app's settings require **appsecret_proof** (Settings → Advanced), also set `META_APP_SECRET`.
7. With the server running, open `/api/meta/pages` to list every Page the token can see with its Instagram ID, and copy the IDs into sites.json.

Comments are checked every 30 minutes (`CRON_META_COMMENTS`) and insights daily (`CRON_META`). Replies go out publicly straight away, as the Page or Instagram account, and the dashboard records which signed-in person sent them. Meta keeps changing which insight metrics exist; each is requested on its own, so a retired one just disappears from the numbers rather than breaking the sync.

### WhatsApp

A brand's WhatsApp number can live on Meta's servers instead of a phone. Meta sends each incoming message to `/webhooks/whatsapp`; SEO Desk saves it and emails it to the brand's `forwardTo` address, with any photo or file attached. The **WhatsApp** page lists the conversations, and replies typed there go to the customer on WhatsApp as the brand. Replying to the forwarded email sends an email, not a WhatsApp. WhatsApp only delivers a normal reply within 24 hours of the customer's last message; after that the page says to call or email them instead.

```json
"whatsapp": { "phoneNumberId": "123456789012345", "forwardTo": "support@cowsmart.co.nz" }
```

It uses the same Meta app and system user as Facebook and Instagram above. Someone who is an admin of the Meta Business portfolio does these steps:

1. **Pick the number.** Any number that can take a text or a call, including a landline, as long as it isn't already on WhatsApp (if it is, delete that WhatsApp account first). Once added it can't also be used in the WhatsApp phone app.
2. **Add WhatsApp to the app.** developers.facebook.com → the app → Add product → **WhatsApp**, and choose the business portfolio. This creates a WhatsApp Business Account.
3. **Add the number.** WhatsApp → API Setup → Add phone number. Enter the display name (the brand's name; Meta checks it) and verify the number by text or voice call. If it then shows as not registered, register it from the same page with a six-digit PIN you choose. Copy the **Phone number ID** (not the phone number) into `phoneNumberId` in sites.json.
4. **Token.** In Business Settings → System users, give the system user the WhatsApp account with full control, then generate a new token that also has `whatsapp_business_messaging` and `whatsapp_business_management`. Put it in `META_ACCESS_TOKEN`, or in `WHATSAPP_TOKEN` to keep it separate.
5. **Server variables.** `META_APP_SECRET` (app → App settings → Basic → App secret; required here, because it's how SEO Desk knows a message really came from Meta), `WHATSAPP_VERIFY_TOKEN` (any long random string you make up) and `PUBLIC_URL` (`https://seo.comhlavet.com`, for the link in the emails). Email sending (`SMTP_*`) must be set up too.
6. **Let Meta past the login.** Cloudflare Zero Trust → Access → Applications → Add → *Self-hosted*: domain `seo.comhlavet.com`, path `webhooks/whatsapp`, with one policy whose action is **Bypass** and which includes **Everyone**. Only that path is opened, and SEO Desk refuses any request on it without Meta's signature.
7. **Webhook.** App → WhatsApp → Configuration → Webhook: callback URL `https://seo.comhlavet.com/webhooks/whatsapp`, verify token the same as `WHATSAPP_VERIFY_TOKEN`, then **Verify and save** and subscribe to the **messages** field.
8. **Go live.** Switch the app to Live mode (Meta only sends real customers' messages to live apps). Meta may also ask for Business Verification and a payment method in WhatsApp Manager before the number can message freely.
9. **Test.** Send the number a WhatsApp from your own phone. It should appear on the WhatsApp page within seconds and in the support mailbox shortly after. Settings shows WhatsApp as working, or the reason the last email failed.

### Planable

[Planable](https://planable.io) is where the group schedules its social posts. Its Public API gives follower and engagement figures for every channel connected there (Facebook, Instagram, LinkedIn, TikTok, YouTube, Threads, X and Google Business Profile), plus recent posts and their metrics, and it lets the dashboard create draft posts. The API needs Planable's **Pro or Enterprise** plan.

1. **Token.** A Planable Owner or Admin creates one under Company settings → API tokens. **Write** scope lets the dashboard create drafts as well as read; **Read** is enough for the figures alone. Give it access to all workspaces and a long expiry (it has to be replaced by hand when it runs out). Paste it into `PLANABLE_API_TOKEN`.
2. With the server running, open `/api/planable/pages` to list every connected channel with its `workspaceId`, and add each brand's workspace to sites.json. Add `pageIds` only if a workspace holds channels for more than one brand.

```json
"planable": { "workspaceId": "ws_abc123", "pageIds": ["optional", "list"] }
```

The sync runs daily (`CRON_PLANABLE`, `npm run planable`). The first run backfills 90 days, then each run re-reads the last week. Figures land in the same Social section as the Meta sync: followers per channel, views, engagements and new followers over 28 days, a by-channel table, and calls, website clicks and directions from the Google Business Profile channels. If a brand also has `meta` set and `META_ACCESS_TOKEN` is on, Facebook and Instagram come from Meta (which has the comments) and Planable fills in the rest.

**Draft a post in Planable** sits under the Social section. Tick the channels, type the post or a topic and press **Write with Claude** (it writes in the brand's voice from its recent posts and leaves [placeholders] for details it doesn't know), then **Send to Planable as a draft**. Several channels make one grouped post. Drafts are never marked approved, so they wait in Planable for the usual review and scheduling. If a workspace auto-publishes on approval, approving the draft in Planable publishes it. Claude's ideas tagged **Social** get a **Draft a post in Planable** button that starts the same thing from the idea.

What Planable's API can't do: there are no comments or messages (replies happen in Planable's Social Inbox add-on, or here through Meta), no webhooks (hence the daily sync), and published posts can't be edited. Planable doesn't document whether each metrics snapshot holds one day's figures or a running total. The sync treats them as daily (the latest snapshot each day wins), so check the first real run's 28-day totals against Planable's own analytics.

### WP Umbrella

[WP Umbrella](https://wp-umbrella.com) monitors the group's WordPress sites. With its Public API token in `WP_UMBRELLA_API_KEY`, each WordPress brand's page gets a **Website uptime and upkeep** section: uptime and outages over 30 days, Lighthouse speed (mobile and desktop), WordPress, plugin and theme updates waiting, known security holes (Patchstack), PHP errors, broken links, HTTPS, whether WordPress is blocking search engines, and the last backup. The Dashboard flags any brand that is down, hidden from Google or has security alerts.

1. **Token.** In WP Umbrella go to Profile → Public API (for developers) and generate a token. This is an account-level token, not the connection key you paste into the plugin on each site. Paste it into `WP_UMBRELLA_API_KEY`.
2. **Sites.** Each WordPress site needs the WP Umbrella plugin installed and connected. Sites are matched to brands by domain (www or not). Open `/api/wpumbrella/projects` to see what matched; if a brand's site is listed under another address, add its id to sites.json:

```json
"wpUmbrella": { "projectId": 123 }
```

The sync runs every three hours (`CRON_WPUMBRELLA`, `npm run wpumbrella`). WP Umbrella's API is for reading and maintenance only; it can't create posts, so sending shared articles still needs each site's WordPress application password (`WP_<SLUG>`). WP Umbrella's own down alerts are faster than this sync, so keep those on in WP Umbrella.

### Shared articles

The **Articles** page turns one article into a version for each brand. Claude reads what the dashboard knows about each brand (its clinics and towns, keyword research, Search Console queries ranking 8–20, keyword gap, AI answers, and the pages found by the latest audit) and rewrites the article for it: a new opening and close, local context and FAQ, a call to action naming its clinics, a focus search the site is missing, and links to two to four of its existing pages. It also lists the SEO holes the post fills and the changes to make elsewhere on the site (pages to link from, pages it could compete with). Versions are written three at a time in the background.

Why not post the same article everywhere: Google shows one copy of duplicated text and filters the rest, and the same page with only the town swapped counts as spam. Each version's **Closest version** figure is the share of five-word runs it has in common with the most similar other brand's version; over 40% is flagged. For something that really has to be word-for-word (a group announcement), publish it once on the main site and link to it from the others instead.

Nothing goes out without a person: each version is edited and **approved** first, and any later edit takes the approval away. Then:

- **WordPress** sites get it through the REST API: as a draft by default, or published now or scheduled for a date if that's chosen. The meta description goes into the post excerpt; paste it into Yoast or Rank Math too if the site uses one. Sending again updates the same post.
  1. In WordPress, go to Users → Profile → **Application Passwords**, name it "SEO Desk" and copy the password. Use an account that can publish posts (Editor or Administrator).
  2. Set `WP_<SLUG>` on the server to `username:application password`, for example `WP_FIRSTVETS=mike:abcd efgh ijkl mnop qrst uvwx`. The slug is the brand's `slug` in sites.json, upper-cased, with anything that isn't a letter or digit as `_`.
  3. If a security plugin or the host blocks `/wp-json/`, allow it for that account. If the site has no `/wp-json/` at all, set `"wpApi": "https://example.co.nz/index.php?rest_route="` on the brand in sites.json.
- **Rocketspark, Wix, Storbie, Silverstripe and custom sites** have no API we can post through, so the page gives **Copy title / article / meta description** buttons (the article copies with its headings and lists) and a **Mark as posted** button.

Each brand's `"cms"` in sites.json says which applies: `wordpress`, `rocketspark`, `wix`, `storbie`, `silverstripe` or `custom` (taken from the Digital Asset Tracker).

### Ads

Google ads are found by each brand's website domain, so nothing needs adding to sites.json. They come from Google's public Ads Transparency Center through DataForSEO, so they include ads run by anyone pointing at that domain (an agency, for example), shown with the advertiser's name. Searches go out weekly (`CRON_ADS`) through DataForSEO's standard queue and are collected with the other queued tasks, usually within a couple of hours. An ad last shown in the past 7 days counts as running.

Meta's Ad Library API only returns non-political ads that were shown in the EU or UK, so NZ and Australian ads can't be pulled into the dashboard. Instead each brand links to Meta's public Ad Library: straight to the brand's Page when `meta.pageId` is set in sites.json, otherwise a search by brand name.

Posting replies to Google reviews from the dashboard is shown as a mock-up marked "coming soon". It needs the Business Profile API (see above), because DataForSEO can only read reviews.

### Reply drafts (Claude)

Set `ANTHROPIC_API_KEY` (from console.anthropic.com → API keys) and each unreplied review gets a **Draft with Claude** button. Claude writes a short reply in the clinic's voice from the review, the star rating and an optional note you type ("mention our new puppy classes"). Edit it, click Copy, and paste it into the reply box on the clinic's Google listing. The prompt keeps replies short, uses NZ spelling, never reveals anything about an animal or client that the review doesn't already say, and steers negative reviews towards contacting the clinic, without promises. The same button sits on every Facebook and Instagram comment in the comments inbox, where the draft fills the reply box and you send it from there (written as the brand's account, one or two sentences, with no made-up hours or prices). Until real reviews or comments arrive, or while Meta is still "coming soon", a couple of clearly labelled made-up examples are shown so drafting can be demonstrated. `ANTHROPIC_MODEL` overrides the model (default `claude-opus-5-5`). Each draft costs roughly one or two US cents.

### Keyword research and ideas

Each clinic page, and the page of each brand without clinics, has a **Keyword research** section. Press **Research keywords** and it asks Google Ads' Keyword Planner (through DataForSEO, so no Google Ads account is needed) for searches related to the clinic's seeds, keeps the vet-related ones (for brands, everything except job and course searches), and checks SEO difficulty. Volumes and bids are New Zealand-wide (Australia-wide for `"market": "AU"` brands) (Google doesn't break them down by town), and bids are in US dollars as DataForSEO reports them. The advice is deliberately simple: **SEO** when people search it (10+ a month), difficulty is under 50 and we aren't already top 3; **Ads** for urgent or "near me" searches, searches advertisers compete for, and worthwhile searches too hard to win organically. Research counts towards `DFS_MONTHLY_CAP_USD` and is refused past it.

**Ideas to grow traffic** uses the same `ANTHROPIC_API_KEY` as reply drafts. Without it the section says it's not connected.

### Top-3 checklist

Each clinic page has a **Top-3 checklist** built from [Localo's study of local ranking factors](https://localo.com/blog/top-local-seo-ranking-factors): their eight-point "basics" (verified listing, website, description, an extra category, 10+ reviews, 10+ photos, 10+ citations, a social link) and what the top three pull ahead on (about 80+ reviews, 40+ photos, a 4.5+ rating, six extra categories, 21+ citations, 3+ social links, 10+ live Google posts, matching name/address/phone). Hover an item for what's needed to tick it. Items tick themselves from the latest listing sync and details check. Citations and social links can't be read from the listing, and Google posts only come through the Business Profile API, so those start as **Not checked** and someone sets them to Done or Not done (saved with who and when). Any item we have no data for yet, for instance before the first listing sync, can be set by hand the same way; once synced data exists it takes over. Claude's traffic ideas see the checklist too.

### Google Search Console

1. In Google Cloud Console create a project, enable the **Search Console API**, create a **service account** and download its JSON key to `data/gsc-service-account.json`.
2. In Search Console, add the service account's email address as a user on every property.
3. Set `GSC_SERVICE_ACCOUNT_JSON` in `.env`.

### DataForSEO

Create an account at dataforseo.com, top up a small balance (pay-as-you-go, no subscription), and put the API login/password in `.env`. `DFS_LOCATION_CODE=2554` is New Zealand.

Rough monthly cost at 5 brands × 20 keywords checked daily plus a monthly competitor refresh: US$10–20.

### Email digest

Any SMTP account works (Google Workspace, Microsoft 365, Postmark, etc.). Leave `SMTP_HOST` blank to skip sending; `/api/digest` still shows a preview. The digest goes to `DIGEST_TO` plus every address ticked for it on the Settings page.

### Scheduled reports

On the **Settings** page, add the addresses reports go to, then **New report**: pick brands (or all brands, including ones added later) and single clinics, the sections to include (headline figures, website problems, Search Console, keyword rankings, social, AI answers, clinic listings, new reviews) and when it goes (daily, a weekday, or a day of the month, at an hour). **Preview** shows the email; **Send now** sends it straight away. Reports are checked a few minutes past every hour (`CRON_REPORTS`, default `3 * * * *`) in the server's time zone. Until `SMTP_HOST` is set they can be set up and previewed, and the page says sending is coming soon.

## Running jobs

The server schedules everything via the cron expressions in `.env`. You can also run any job by hand:

```bash
npm run audit               # all sites
npm run audit -- heartland  # one site
npm run ranks
npm run gsc
npm run competitors
npm run digest
npm run reports             # send any scheduled report due this hour
npm run gbp                 # Business Profile sync (API, and/or DataForSEO public listing + reviews)
npm run meta                # Facebook and Instagram sync
npm run planable            # Planable channels: followers, figures and recent posts
npm run ads                 # queue this week's Google ads search per brand (collected by local-collect)
npm run local               # post this week's map-pack checks + name/address/phone check
npm run keywords -- vetlife # keyword research for every clinic of a brand not researched this month (no schedule)
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
  settings.js         Settings page: connection status, saved settings, report address book
  reports.js          Scheduled email reports
  mail.js             SMTP sending
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
  data/meta.js        Facebook and Instagram insights, posts, comments and replies
  data/whatsapp.js    WhatsApp webhook, emailing messages on, replies
  data/planable.js    Planable channels' figures and posts, and creating draft posts
  data/reply-helper.js  Claude drafts replies to Google reviews, Facebook/Instagram comments and WhatsApp messages, and social posts
  data/ads.js         Google ads via the Ads Transparency Center, Meta Ad Library links
  data/keywords.js    Keyword research per clinic or brand and the SEO / Ads advice
  data/suggestions.js Claude's traffic ideas and starter search ad per clinic
  data/checklist.js   Top-3 local SEO checklist per clinic (auto-detected, or ticked by hand)
public/               Dashboard (no build step)
data/                 sites.json, SQLite database, GSC key
```

## Extending

- Add an audit rule: append to `evaluate()` in `src/audit/rules.js` and give it a label in `ISSUE_LABELS`.
- Add a data source (Bing Webmaster, PageSpeed Insights…): a module in `src/data/`, a table in `db.js`, a job in `jobs.js`, a section in `queries.js` and `public/app.js`.
- The API is plain JSON (`/api/overview`, `/api/sites/:slug`), so it can feed a Zoho Analytics or Looker Studio report if you'd rather chart there.
