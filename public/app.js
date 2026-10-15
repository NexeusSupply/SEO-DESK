const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v, d = 0) => v == null ? '<span class="dash">—</span>' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d });
const delta = (cur, prev, invert = false) => {
  if (cur == null || prev == null || prev === 0) return '';
  const d = cur - prev; if (d === 0) return '<span class="delta flat">±0</span>';
  const good = invert ? d < 0 : d > 0;
  return `<span class="delta ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${Number.isInteger(d) ? d : d.toFixed(1)}</span>`;
};
const scoreColour = (s) => s >= 80 ? 'var(--good)' : s >= 60 ? 'var(--warn)' : 'var(--bad)';
const scoreBar = (s) => s == null ? '<span class="dash">—</span>' : `<span class="score"><b>${s}</b><i style="--w:${s}%;--c:${scoreColour(s)}"></i></span>`;
// Plain-English explanations shown when hovering, tapping or tabbing to a heading.
const TIPS = {
  auditScore: 'A 0–100 health check of the website from our own crawl. It starts at 100 and loses points for every problem found, weighted by how serious it is and by the size of the site. 80+ is healthy, 60–79 needs some fixes, under 60 needs attention.',
  errors: 'Serious website problems found in the last audit, such as broken pages or pages that fail to load. These hurt visitors and Google rankings, so fix them first.',
  clicks: 'How many times someone clicked through to the website from a Google search result. From Google Search Console. The small +/− figure is the change on the previous 28 days.',
  impressions: 'How many times the website appeared in Google search results, whether or not anyone clicked. Rising impressions mean Google is showing the site more often.',
  top10: 'Of the keywords we track for this brand, how many rank on the first page of Google (positions 1–10). Most clicks go to the first page, and most of those to the top 3.',
  referringDomains: 'How many different websites link to this one. Links from other sites act like votes of confidence and help rankings. More, from reputable sites, is better.',
  status: 'Overall signal for the brand. Good: nothing needs attention. Watch: worth a look soon. Problem: needs a decision. Not connected: we can\u2019t see its data yet.',
  why: 'The plain-English reasons behind the status.',
  sinceLastMonth: 'What has moved compared with the month before: search clicks, website health score, Google rating, new reviews and local rankings.',
  reporting: 'Brands we can currently see data for (Search Console, Google listings or an audit), out of all brands in this group.',
  listingsConnected: 'Clinic Google Business Profile listings we have access to, out of all clinics in this group.',
  visits: 'Clicks from Google search results to the group\u2019s websites over the last 28 days, with the change on the 28 days before.',
  avgRating: 'Average Google star rating (out of 5) across the clinics we can see.',
  health: 'Average website audit score (0–100) across the group. 80+ is healthy, under 60 needs attention.',
  needingAttention: 'Brands showing Problem (needs a decision) or Watch (worth a look).',
  clinic: 'Clinics needing the most attention are listed first and marked with a red edge. Low ratings, poor or unanswered reviews, an incomplete listing, mismatched details or missing from the map all push a clinic up.',
  rating: 'The clinic\u2019s average star rating on its Google listing, out of 5.',
  reviews30: 'New Google reviews in the last 30 days. Any \u201clow\u201d figure counts 1–2 star reviews from the last 90 days.',
  unreplied: 'Google reviews the clinic hasn\u2019t replied to yet. Replying to every review, good or bad, builds trust and helps local rankings.',
  listing: 'How complete the clinic\u2019s Google listing is: name, address, phone, website, category, opening hours, description and photos. Under 80% is flagged red.',
  mapPack: 'The map pack is the box of three businesses shown with a map at the top of Google for local searches like \u201cvet near me\u201d. This shows how many of the clinic\u2019s checked searches it appears in, and its best position.',
  callsDirections: 'Phone calls and requests for directions made straight from the clinic\u2019s Google listing in the last 28 days.',
  detailsMatch: 'Whether the clinic\u2019s name, address and phone number match across its Google listing, our records and its website. Mismatches confuse both Google and customers.',
  query: 'The words people typed into Google before seeing the site.',
  position: 'Average position in Google results. 1 is the top result; 10 is the bottom of page one; 11–20 is page two.',
  queryImpressions: 'How many times the site appeared in Google results for this search in the last 28 days.',
  queryClicks: 'How many of those appearances led to a click through to the site.',
  issue: 'A problem found when we crawled the site. Click an issue to see example pages.',
  severity: 'Error: fix first, it hurts rankings or visitors. Warning: should be fixed. Notice: a minor tidy-up.',
  pages: 'How many pages on the site have this issue.',
  keyword: 'A search term we track for this brand, checked in Google New Zealand.',
  rankPosition: 'Where the site currently ranks in Google NZ for this keyword. 1 is the top result; \u201c>100\u201d means not in the top 100. The small figure is the change since the previous check (green means moved up).',
  trend: 'Position over the last 30 checks. The line going up means the ranking is improving.',
  rankingPage: 'The page on the site that Google shows for this keyword.',
  volume: 'Roughly how many times a month people search for this keyword in Google.',
  difficulty: 'How hard it is to reach Google\u2019s first page for this keyword, from 0 (easy) to 100 (very hard).',
  competitorsInSerp: 'Competitors we track that also appear in Google\u2019s results for this keyword, with their position. (SERP means search engine results page.)',
  pagePath: 'A page on the site that got clicks from Google search.',
  domain: 'The website address. Ours is in bold, followed by the competitors we track.',
  organicKeywords: 'How many search terms this website ranks for in Google (top 100), not counting paid ads.',
  traffic: 'An estimate of monthly visits from Google search, based on rankings and how often those terms are searched. Good for comparing sites, not an exact count.',
  backlinks: 'The total number of links pointing to this website from other sites. One site can link many times, so referring domains is often the better measure.',
  domainRank: 'A 0–1,000 score of the strength of the links pointing to the website. Higher is stronger. Most useful for comparing against competitors.',
  gapVolume: 'Roughly how many times a month people search for this term.',
  whoRanks: 'Competitors in Google\u2019s top 20 for this term, with their position, when our site isn\u2019t ranking at all.',
  townSearch: 'The local search we check, as if someone searched from that town.',
  packPosition: 'The clinic\u2019s position in the map box of three at the top of Google. \u201cNot shown\u201d means it didn\u2019t appear.',
  organic: 'Where the clinic\u2019s website appears in the normal Google results below the map.',
  whoInPack: 'The businesses Google shows in the map box for this search, with their star ratings.',
  replied: 'Whether the clinic has replied to the review on Google.',
  draftComment: 'Claude writes a draft reply from the comment and the post it\u2019s on. Edit it before you send it. Add a note first if there\u2019s something it should mention.',
  metaSoon: 'Coming soon. Replying from here goes live once the Meta app and token are set up. Until then, copy the draft and reply on Facebook or Instagram.',
  example: 'A made-up example, so you can try drafting a reply before real data comes in.',
  draftReply: 'Claude writes a draft reply from the review. Edit it, copy it, and post it on the clinic\u2019s Google listing. Add a note first if there\u2019s something it should mention.',
  draftOff: 'Drafting replies with Claude needs an Anthropic API key (ANTHROPIC_API_KEY) set on the server.',
  replySoon: 'Coming soon. Replying to Google reviews from here needs Google\u2019s Business Profile API, and Google hasn\u2019t approved our access yet. Until then, reply from the clinic\u2019s Google listing.',
  adsRunning: 'Google ads for this brand\u2019s website shown in the last 7 days, from Google\u2019s public Ads Transparency Center. Checked weekly.',
  adsSeen: 'Every Google ad for this website seen in the last 90 days, including ones that have stopped.',
  pickClinic: 'Jump straight to one clinic\u2019s page: its Google listing, reviews, map-pack rankings and whether its details match. Type to search.',
  clinicViews: 'How many times the clinic\u2019s Google listing was seen in Google Search and Maps in the last 28 days, with the change on the 28 days before. Needs Business Profile API access for this clinic.',
  websiteClicks: 'Clicks from the clinic\u2019s Google listing through to its website in the last 28 days.',
  calls: 'Phone calls made by tapping Call on the clinic\u2019s Google listing in the last 28 days.',
  directions: 'Requests for directions to the clinic from its Google listing in the last 28 days.',
  reviewCount: 'The clinic\u2019s star rating on Google and how many reviews it has in total.',
  ratingSpread: 'How the clinic\u2019s synced Google reviews split across 1 to 5 stars.',
  onGoogle: 'What the clinic\u2019s Google Business Profile shows today, from the latest sync.',
  ourRecords: 'What we have on file for the clinic in sites.json. Differences are worth fixing on whichever side is wrong.',
  sources: 'Where we checked the clinic\u2019s name, address and phone: its Google listing, our records and its website.',
  brandWebsite: 'Search and audit figures for the website this clinic shares with its brand. Open the brand page for the full picture.',
  aiNamed: 'Each month we ask ChatGPT, Gemini and Perplexity which vet they would recommend in each clinic\u2019s town (or, for a business without clinics, the questions set for it), with web search on, as someone in New Zealand or Australia. This counts the answers that name the clinic or business.',
  aiEngine: 'How many of the questions we asked this AI named the clinic or business in. The small \u201c#2\u201d is where it came in the answer, counting other businesses named before it.',
  aiOverview: 'Google\u2019s AI Overview is the AI summary at the top of some Google searches. We check each town\u2019s local search (like \u201cvet Feilding\u201d). It counts when the overview names the clinic or links to its website. Google often shows the map instead of an overview for local searches.',
  aiNamedInstead: 'Other businesses the AI recommended in its answer. These are who AI sees as the competition in that town.',
  aiCited: 'The AI linked to the clinic\u2019s website as a source. Being a cited source is how websites earn their place in AI answers.',
  aiSources: 'The websites the AI read to write its answer. Getting listed or mentioned on these sites (directories, review sites, local news) is the main way to appear in AI answers.',
  kwResearch: 'Asks Google Ads\u2019 Keyword Planner (through DataForSEO) for searches related to this clinic\u2019s town and services (or, on a brand page, the brand\u2019s products or website), then checks how hard each is to rank for. Costs about US$0.10 and counts towards the monthly DataForSEO cap. Clinics in the same town share results.',
  kwFound: 'Searches Google suggested from the words we started with (the clinic\u2019s town and services, or the brand\u2019s products), plus those words themselves.',
  kwSeo: 'Searches with real volume that aren\u2019t too hard to rank for (difficulty under 50) and where we aren\u2019t already in the top 3. Write or improve a page on the website for these.',
  kwAds: 'Urgent or \u201cnear me\u201d searches (people ready to call), searches other advertisers compete for, and worthwhile searches too hard to win organically. Bid on these in Google Ads.',
  kwRanking: 'Of these searches, how many the website already shows on Google\u2019s first page for, from our rank checks.',
  kwTrend: 'Monthly searches over the last 12 months.',
  kwBid: 'What advertisers typically pay per click to show at the top of the page, low to high range, from Google Ads (in US dollars).',
  kwCompetition: 'How many advertisers bid on this search in Google Ads: low, medium or high.',
  kwPosition: 'Where the website ranks in Google for this search now. \u201cmap #2\u201d means it isn\u2019t in the normal results but the clinic shows second in the map box.',
  kwAdvice: 'Our suggestion: SEO (target it on the website), Ads (bid on it), or both. The reasons are underneath.',
  adDraft: 'A starting point for a Google responsive search ad: Google mixes the headlines and descriptions. Headlines can be 30 characters, descriptions 90. Check every line before using it.',
  planableGoogle: 'From the Google Business Profile channels connected in Planable: taps on Call, clicks through to the website and direction requests in the last 28 days, with the change on the 28 days before.',
  planableInbox: 'Planable\u2019s API doesn\u2019t include comments or messages, so replies are made in Planable\u2019s Social Inbox (a paid add-on) or on the platform itself. Connecting Meta here as well brings Facebook and Instagram comments into this page.',
  writePost: 'Claude writes a post for the ticked channels from your topic, in the brand\u2019s voice from its recent posts. Edit it before you send it.',
  checklist: 'The things that most often separate clinics in Google\u2019s top 3 map results from the rest, from Localo\u2019s study of over 130,000 local searches. They go together with rankings rather than guaranteeing them, and distance from the searcher still matters most. Reviews and photos count far more than anything else.',
  ckBasics: 'Localo\u2019s eight-point completeness check. Only 43% of #1 listings tick all eight, against 17% of those below page one, so start here.',
  ckTop3: 'Where the top three pull ahead: more reviews and photos, a strong rating, more categories, citations and social links, and regular Google posts. Each tooltip gives the figure the top listings reach.',
  artSimilar: 'How much of this version\u2019s text it shares with the closest other brand\u2019s version, measured in runs of five words. Versions that share a lot compete with each other in Google, which shows one and filters the rest. Over 40% is flagged; rewrite more of it, or skip one of the brands.',
  artSource: 'How much text this version still shares with the article you pasted in. It\u2019s expected to be fairly high, since the facts and advice stay the same; what matters most is how different the brands\u2019 versions are from each other.',
  artChecks: 'Basic on-page checks we can do without Claude: title and meta description length, whether the focus search is in the title, first paragraph and a heading, length, links to the brand\u2019s own pages, and whether it names the brand\u2019s towns.',
  wpUptime: 'Share of WP Umbrella\u2019s checks over the last 30 days that found the website up, and how many outages it saw. Repeated downtime costs visitors and, if it lasts, Google rankings.',
  wpSpeed: 'WP Umbrella\u2019s latest Google Lighthouse performance score, 0 to 100, for desktop and mobile. 90+ is fast, 50\u201389 needs work, under 50 is slow. Google uses page speed as a ranking signal, especially on mobile.',
  wpUpdates: 'Plugins and themes with a newer version available. Out-of-date plugins are the most common way WordPress sites get hacked. Updates are done in WP Umbrella or WordPress.',
  wpVulns: 'Known security holes in the installed WordPress version, plugins or themes, from WP Umbrella\u2019s Patchstack scan. Updating to the \u201cfixed in\u201d version closes them.',
  wpBroken: 'Links on the website that lead to an error page, from WP Umbrella\u2019s link checker. Broken internal links waste Google\u2019s crawl and send visitors to dead ends; fix or remove them.',
  wpIndexable: 'Whether WordPress lets search engines index the site (Settings \u2192 Reading). If it says No, Google is being asked to keep the whole site out of its results.',
  metaAds: 'Meta only lets apps pull ads that were shown in Europe, so New Zealand and Australian ads can\u2019t be listed here. This opens Meta\u2019s public Ad Library, which shows every ad the brand\u2019s Facebook Page is running right now.',
};
// The "i" marker is glued to the last word so it never wraps onto a line by itself.
const tip = (label, key, icon = true) => `<span class="tip" tabindex="0" data-tip="${esc(TIPS[key])}">${icon ? label.replace(/(\S+)$/, '<span class="nw">$1<i class="ti" aria-hidden="true">i</i></span>') : label}</span>`;
const th = (label, key, cls = '') => `<th${cls ? ` class="${cls}"` : ''}>${tip(label, key)}</th>`;
const dateShort = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
const host = (u) => { try { return new URL(u).pathname || '/'; } catch { return u; } };

function spark(values, invert) {
  const v = values.filter((x) => x != null); if (v.length < 2) return '';
  const max = Math.max(...v), min = Math.min(...v), w = 90, h = 22;
  const pts = values.map((y, i) => y == null ? null : [i / (values.length - 1) * w, invert
    ? ((y - min) / (max - min || 1)) * (h - 4) + 2 : h - 2 - ((y - min) / (max - min || 1)) * (h - 4)]);
  let d = '', pen = false;
  for (const p of pts) { if (!p) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; pen = true; }
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/></svg>`;
}

function lineChart(daily, { a = 'impressions', b = 'clicks', label = '<b>Clicks</b> and impressions', empty = 'No Search Console data yet.' } = {}) {
  if (!daily.length) return `<p class="empty">${empty}</p>`;
  const w = 1000, h = 160, pad = 8;
  const line = (key, cls) => {
    const max = Math.max(...daily.map((d) => d[key])) || 1;
    return `<path class="${cls}" d="${daily.map((d, i) => `${i ? 'L' : 'M'}${(pad + i / (daily.length - 1) * (w - 2 * pad)).toFixed(1)},${(h - pad - d[key] / max * (h - 2 * pad)).toFixed(1)}`).join('')}"/>`;
  };
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label.replace(/<[^>]+>/g, ''))} over the last 90 days">${line(a, 'imp')}${line(b, 'clicks')}</svg>
  <p class="legend">${label}, ${dateShort(daily[0].date)} to ${dateShort(daily[daily.length - 1].date)}</p>`;
}

const stars = (r) => r == null ? '<span class="dash">—</span>' : `<span class="num">${Number(r).toFixed(1)}</span> <span class="star">★</span>`;
const okmark = (v) => v ? '<span class="ok">✓</span>' : '<span class="notok">✗</span>';

const clinicHref = (site, loc) => `#/clinic/${encodeURIComponent(site)}/${encodeURIComponent(loc)}`;
function locationsTable(rows, showBrand, site) {
  if (!rows.length) return '';
  return `<div class="wrap"><table class="data"><thead><tr>${showBrand ? '<th>Brand</th>' : ''}${th('Clinic', 'clinic')}${th('Rating', 'rating')}${th('Reviews (30d)', 'reviews30', 'r')}${th('Unreplied', 'unreplied', 'r')}${th('Listing', 'listing', 'r')}${th('Map pack', 'mapPack')}${th('Calls / directions (28d)', 'callsDirections', 'r')}${th('Details match', 'detailsMatch')}</tr></thead><tbody>
  ${rows.map((l) => {
    const packs = l.ranks.filter((r) => r.map_pack != null);
    const pack = !l.ranks.length ? '<span class="dash">—</span>' : packs.length ? `${packs.length} of ${l.ranks.length} <span class="delta flat">best #${Math.min(...packs.map((r) => r.map_pack))}</span>` : '<span class="notok">not in pack</span>';
    return `<tr class="${l.attention >= 5 ? 'attn' : ''}">${showBrand ? `<td><div class="who">${badge(l.site, l.brand, 'sm')}<a href="#/${l.site}">${esc(l.brand)}</a></div></td>` : ''}
    <td><a class="clinic-link" href="${clinicHref(l.site || site, l.slug)}"><b>${esc(l.name)}</b></a>${l.town ? `<br><small class="muted">${esc(l.town)}</small>` : ''}</td>
    <td>${l.listing ? stars(l.listing.rating) : l.hasGbp ? '<span class="dash">—</span>' : '<small class="muted">no listing ID</small>'}</td>
    <td class="r num">${l.listing ? `${l.reviews.last30}${l.reviews.lowRecent ? ` <span class="delta down">${l.reviews.lowRecent} low</span>` : ''}` : n(null)}</td>
    <td class="r num ${l.reviews.unreplied ? 'notok' : ''}">${l.listing ? l.reviews.unreplied : n(null)}</td>
    <td class="r num ${l.listing && l.listing.completeness < 80 ? 'notok' : ''}">${l.listing ? `${l.listing.completeness}%` : n(null)}</td>
    <td>${pack}</td>
    <td class="r num">${l.performance ? `${n(l.performance.calls)} / ${n(l.performance.directions)}` : n(null)}</td>
    <td>${l.nap.length ? (l.napIssues.length ? `<span class="notok">✗</span> <small class="muted">${esc(l.napIssues.join(', '))}</small>` : '<span class="ok">✓</span>') : '<span class="dash">—</span>'}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}

// Every clinic, for the picker. Fetched once; it only changes when sites.json does.
let clinicList = null;
const loadClinics = async () => clinicList ||= await api('/locations');
function clinicPicker(rows, current = '') {
  const brands = [...new Map(rows.map((l) => [l.site, l.brand])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  return `<label class="picker"><span>${tip('Go to a clinic', 'pickClinic')}</span>
  <select onchange="if (this.value) location.hash = this.value"><option value="">Choose a clinic…</option>
  ${brands.map(([site, brand]) => `<optgroup label="${esc(brand)}">${rows.filter((l) => l.site === site).sort((a, b) => a.name.localeCompare(b.name))
    .map((l) => { const h = clinicHref(site, l.slug); return `<option value="${h}"${h === current ? ' selected' : ''}>${esc(l.name)}${l.town && !l.name.includes(l.town) ? ` (${esc(l.town)})` : ''}</option>`; }).join('')}</optgroup>`).join('')}
  </select></label>`;
}

async function renderLocations() {
  const rows = await api('/locations'); clinicList = rows;
  $('#main').innerHTML = `<div class="page-head"><div><h1>Clinics</h1><p class="sub">Every location across the group, the ones needing attention first. Open a clinic for its own page.</p></div>${rows.length ? clinicPicker(rows) : ''}</div>
  ${rows.length ? locationsTable(rows, true) : '<p class="empty">No locations configured. Add a <code>locations</code> list to a brand in data/sites.json.</p>'}
  <div class="actions"><button class="run" onclick="run('gbp')">Sync Business Profiles</button><button class="run" onclick="run('local')">Check map-pack ranks and details</button></div>`;
}

async function api(p, opts) {
  const r = await fetch('/api' + p, opts);
  if (!r.ok) { let m = `${r.status} ${p}`; try { m = (await r.json()).error || m; } catch {} throw new Error(m); }
  return r.json();
}
const post = (p, body) => api(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });

// ---- Social: Facebook and Instagram from Meta, every channel from Planable ----
const PLATFORM = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube', threads: 'Threads', x: 'X', google: 'Google Business', pinterest: 'Pinterest' };
const platformTag = (p) => `<span class="plat ${p}">${PLATFORM[p] || p}</span>`;
const clip = (t, len) => `${esc((t || '').slice(0, len))}${(t || '').length > len ? '…' : ''}`;
const ago = (iso) => { const h = (Date.now() - new Date(iso)) / 36e5; return h < 1 ? 'just now' : h < 24 ? `${Math.floor(h)}h ago` : h < 24 * 14 ? `${Math.floor(h / 24)}d ago` : dateShort(iso); };

function commentRow(c, showBrand) {
  const done = c.replied || c.hidden;
  return `<li class="cmt ${done ? 'done' : ''}" id="c-${esc(c.comment_id)}" data-draft="comment" data-site="${esc(c.site)}" data-id="${esc(c.comment_id)}">
    <div class="cmt-head">${platformTag(c.platform)}${showBrand ? ` <a href="#/${esc(c.site)}">${esc(c.brand)}</a>` : ''} <b>${esc(c.author)}</b> <span class="muted">${ago(c.created_at)}</span>
      ${c.permalink ? `<a class="muted" href="${esc(c.permalink)}" target="_blank" rel="noopener">open</a>` : ''}</div>
    <p class="cmt-body">${esc(c.message) || '<span class="muted">(no text, probably a sticker or photo)</span>'}</p>
    ${c.post_message ? `<p class="cmt-post muted">On: ${clip(c.post_message, 120)}</p>` : ''}
    ${c.hidden ? '<p class="cmt-state muted">Hidden from the public</p>' : ''}
    ${c.replied ? `<p class="cmt-state"><span class="ok">✓</span> ${c.reply_text ? `Replied: ${esc(c.reply_text)}` : 'Marked as handled'}${c.replied_by ? ` <span class="muted">· ${esc(c.replied_by)}</span>` : ''}</p>` : ''}
    ${!done ? `<form class="cmt-reply" onsubmit="return replyComment(event)">${claudeOn ? noteInput : ''}<textarea name="m" rows="2" placeholder="Reply publicly as the ${PLATFORM[c.platform]} account…" required></textarea>
      <div class="actions"><button class="run primary-btn" type="submit">Reply</button>${claudeOn ? `<button class="run" type="button" onclick="draftReply(this)" data-tip="${esc(TIPS.draftComment)}">Draft with Claude</button>` : ''}<button class="run" type="button" onclick="commentAction(this,'handled')">No reply needed</button><button class="run" type="button" onclick="commentAction(this,'hide')">Hide</button></div></form>`
      : c.hidden ? `<div class="actions"><button class="run" type="button" onclick="commentAction(this,'unhide')">Unhide</button></div>` : ''}
    <p class="cmt-err notok" hidden></p>
  </li>`;
}
const commentsList = (rows, showBrand) => `<ul class="cmts">${rows.map((c) => commentRow(c, showBrand)).join('')}</ul>`;

async function refreshComment(li, update) {
  const rows = await api(`/comments?site=${li.dataset.site}&status=all`);
  const c = rows.find((r) => r.comment_id === li.dataset.id) || update;
  li.outerHTML = commentRow(c, Boolean(li.querySelector('.cmt-head > a[href^="#/"]')));
}
async function replyComment(ev) {
  ev.preventDefault();
  const form = ev.target, li = form.closest('.cmt'), err = li.querySelector('.cmt-err');
  const message = form.m.value.trim(); if (!message) return false;
  form.querySelectorAll('button,textarea').forEach((x) => { x.disabled = true; });
  try { await post(`/sites/${li.dataset.site}/comments/${encodeURIComponent(li.dataset.id)}/reply`, { message }); await refreshComment(li); }
  catch (e) { err.textContent = `Couldn't send: ${e.message}`; err.hidden = false; form.querySelectorAll('button,textarea').forEach((x) => { x.disabled = false; }); }
  return false;
}
async function commentAction(btn, action) {
  const li = btn.closest('.cmt'), err = li.querySelector('.cmt-err');
  btn.disabled = true;
  try {
    const path = `/sites/${li.dataset.site}/comments/${encodeURIComponent(li.dataset.id)}`;
    await (action === 'handled' ? post(`${path}/handled`) : post(`${path}/hide`, { hidden: action === 'hide' }));
    await refreshComment(li);
  } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; }
}
window.replyComment = replyComment; window.commentAction = commentAction;

function socialSection(d, slug) {
  const s = d.social, c = d.connections.social, src = d.socialSources || {};
  if (c === 'coming_soon') return socialPlaceholder(slug);
  const title = src.planable ? 'Social' : 'Facebook and Instagram';
  const sync = `<div class="actions">${src.planable ? `<button class="run" onclick="run('planable','${slug}')">Sync from Planable</button>` : ''}${src.meta ? `<button class="run" onclick="run('meta','${slug}')">Sync Facebook and Instagram</button>` : ''}</div>`;
  if (c === 'no_data') return `<h2>${title}</h2><p class="empty">No data yet.</p>${sync}${src.planable ? planableComposer(d, slug) : ''}`;
  // Google listing views and actions have their own tiles, so the social totals leave them out.
  const google = s.platforms.find((p) => p.platform === 'google');
  const pick = (k) => ['calls', 'website_clicks', 'directions'].includes(k) ? [google].filter(Boolean) : s.platforms.filter((p) => p !== google);
  const tot = (k, which = 'last28') => pick(k).reduce((a, p) => a + (p[which][k] || 0), 0);
  const has = (k) => pick(k).some((p) => p.last28[k] != null);
  const tile = (k, label, tipKey) => `<div><div class="v">${has(k) ? `${n(tot(k))}${delta(tot(k), tot(k, 'prev28'))}` : nc('No data yet')}</div><div class="l">${tipKey ? tip(label, tipKey) : label}</div></div>`;
  const fol = (p) => `<div><div class="v">${n(p.followers)}${delta(p.followers, p.prevFollowers)}</div><div class="l">${PLATFORM[p.platform] || esc(p.platform)} followers${p.name ? ` · ${esc(p.name)}` : ''}</div></div>`;
  const byChannel = s.platforms.length > 1 ? `<h3>By channel, last 28 days</h3><div class="wrap"><table class="data"><thead><tr><th>Channel</th><th class="r">Followers</th><th class="r">Views</th><th class="r">Engagements</th><th class="r">New followers</th></tr></thead><tbody>
    ${s.platforms.map((p) => `<tr><td>${platformTag(p.platform)} ${esc(p.name || '')}</td><td class="r num">${n(p.followers)}${delta(p.followers, p.prevFollowers)}</td><td class="r num">${n(p.last28.views)}</td><td class="r num">${n(p.last28.engagements)}</td><td class="r num">${n(p.last28.follows)}</td></tr>`).join('')}</tbody></table></div>` : '';
  return `<h2>${title}</h2>${src.planable ? `<p class="sub">From Planable${src.meta ? ', with Facebook and Instagram straight from Meta' : ''}. Synced daily.</p>` : ''}
  <div class="strip">
    ${s.platforms.filter((p) => p.followers != null).map(fol).join('')}
    ${tile('views', 'Views, 28 days')}
    ${tile('engagements', 'Engagements, 28 days')}
    ${google ? `${tile('calls', 'Calls from Google', 'planableGoogle')}${tile('website_clicks', 'Website clicks from Google', 'planableGoogle')}${tile('directions', 'Directions from Google', 'planableGoogle')}` : ''}
    ${src.meta ? `<div><div class="v ${s.unansweredOld ? 'notok' : ''}">${s.unanswered}</div><div class="l">Comments waiting for a reply</div></div>` : ''}
  </div>
  ${sync}
  ${byChannel}
  ${src.meta ? (d.comments.length ? `<h3>Comments</h3>${commentsList(d.comments, false)}` : '<p class="empty">No comments waiting.</p>')
    : `<p class="muted"><small>${tip('Replying to comments', 'planableInbox')} happens in Planable. <a href="https://app.planable.io" target="_blank" rel="noopener">Open Planable ↗</a></small></p>`}
  ${s.posts.length ? `<h3>Recent posts</h3>${postsTable(s.posts.map((p) => `<tr><td>${platformTag(p.platform)} <small class="muted">${dateShort(p.created_at)}</small><br>${p.permalink ? `<a href="${esc(p.permalink)}" target="_blank" rel="noopener">${clip(p.message, 140) || '(no caption)'}</a>` : clip(p.message, 140)}</td>
    <td class="r num">${n(p.likes)}</td><td class="r num">${n(p.comments)}</td><td class="r num">${n(p.shares)}</td></tr>`).join(''))}` : ''}
  ${src.planable ? planableComposer(d, slug) : ''}`;
}

// Write a post (by hand or with Claude) and send it to the brand's Planable workspace as a draft. Nothing is
// published from here: it waits in Planable for the team's usual review, approval and scheduling.
function planableComposer(d, slug) {
  const pages = d.planablePages || [];
  const head = `<h3 id="draft-post">Draft a post in Planable</h3>`;
  if (!pages.length) return `${head}<p class="empty">Sync from Planable first to load this brand's channels.</p>`;
  return `${head}<p class="sub">It goes to Planable as a draft for the team to review, approve and schedule. Nothing is published from here.</p>
  <form class="post-form" data-site="${esc(slug)}" onsubmit="return sendToPlanable(event)">
    <div class="chans">${pages.map((p) => `<label><input type="checkbox" name="page" value="${esc(p.id)}" checked> ${platformTag(p.platform)} ${esc(p.name)}</label>`).join('')}</div>
    ${claudeOn ? `<div class="kw-form"><input class="draft-note" name="topic" type="text" maxlength="1000" placeholder="What's it about? e.g. puppy preschool starts again in March">
      <button class="run" type="button" onclick="writePost(this)" data-tip="${esc(TIPS.writePost)}">Write with Claude</button></div>` : ''}
    <textarea name="text" rows="6" maxlength="25000" placeholder="Post text…" required></textarea>
    <div class="actions"><button class="run primary-btn" type="submit">Send to Planable as a draft</button></div>
    <p class="cmt-err notok" hidden></p><p class="post-ok" hidden></p>
  </form>`;
}
const checkedPages = (f) => [...f.querySelectorAll('input[name=page]:checked')].map((x) => x.value);
async function writePost(btn) {
  const f = btn.closest('form'), err = f.querySelector('.cmt-err'), topic = f.topic.value.trim();
  if (!topic) { f.topic.focus(); return; }
  btn.disabled = true; btn.textContent = 'Writing…'; err.hidden = true;
  try { f.text.value = (await post(`/sites/${f.dataset.site}/planable/draft-text`, { topic, pageIds: checkedPages(f) })).text; btn.textContent = 'Rewrite'; }
  catch (e) { err.textContent = `Couldn't write a draft: ${e.message}`; err.hidden = false; btn.textContent = 'Write with Claude'; }
  btn.disabled = false;
}
async function sendToPlanable(ev) {
  ev.preventDefault();
  const f = ev.target, btn = f.querySelector('button[type=submit]'), err = f.querySelector('.cmt-err'), ok = f.querySelector('.post-ok');
  const pageIds = checkedPages(f);
  err.hidden = true; ok.hidden = true;
  if (!pageIds.length) { err.textContent = 'Pick at least one channel.'; err.hidden = false; return false; }
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await post(`/sites/${f.dataset.site}/planable/posts`, { text: f.text.value, pageIds });
    ok.innerHTML = `<span class="ok">✓</span> Sent to Planable as a draft. <a href="https://app.planable.io" target="_blank" rel="noopener">Open Planable ↗</a> to review and schedule it.`;
    ok.hidden = false; f.text.value = ''; if (f.topic) f.topic.value = '';
  } catch (e) { err.textContent = `Couldn't send: ${e.message}`; err.hidden = false; }
  btn.disabled = false; btn.textContent = 'Send to Planable as a draft';
  return false;
}
// "Draft a post" on one of Claude's social ideas: carry the idea into the Planable form and have Claude write it.
function ideaToPost(btn) {
  const f = document.querySelector('.post-form'); if (!f) return;
  f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (f.topic) { f.topic.value = btn.dataset.topic; writePost(f.querySelector('[onclick^="writePost"]')); } else f.text.focus();
}
window.writePost = writePost; window.sendToPlanable = sendToPlanable; window.ideaToPost = ideaToPost;

const COMING_SOON = `<p class="sub">Followers, views and engagement for each brand's social channels (Facebook, Instagram, LinkedIn, TikTok, YouTube and Google Business Profile), recent posts, and drafting posts with Claude to send to Planable. This switches on once the Planable API token is added and the brand's Planable workspace is linked.</p>`;
const dash = '<span class="dash">—</span>';
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="muted">${text}</td></tr>`;
const postsTable = (body) => `<div class="wrap"><table class="data"><thead><tr><th>Post</th><th class="r">Likes</th><th class="r">Comments</th><th class="r">Shares</th></tr></thead><tbody>${body}</tbody></table></div>`;
const commentsTable = (showBrand, body) => `<div class="wrap"><table class="data"><thead><tr>${showBrand ? '<th>Brand</th>' : ''}<th>Platform</th><th>From</th><th>Comment</th><th>Received</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;

// The layout the live section will have, with no data in it, while Meta isn't set up yet.
// Made-up comments with a working Claude draft, so replying can be shown before Meta is connected.
const exampleComment = (c, site) => `<li class="cmt" data-draft="comment" data-site="${esc(site)}" data-id="${esc(c.id)}">
  <div class="cmt-head">${platformTag(c.platform)} <b>${esc(c.author)}</b> <span class="sig nc" tabindex="0" data-tip="${esc(TIPS.example)}">Example</span></div>
  <p class="cmt-body">${esc(c.message)}</p><p class="cmt-post muted">On: ${clip(c.post_message, 120)}</p>
  <div class="cmt-reply">${claudeOn ? noteInput : ''}<textarea rows="2" ${claudeOn ? '' : 'disabled'} placeholder="Reply publicly as the ${PLATFORM[c.platform]} account…"></textarea>
  <div class="actions">${draftButtons('draftComment')}<span tabindex="0" data-tip="${esc(TIPS.metaSoon)}"><button class="run primary-btn" type="button" disabled>Reply</button></span></div></div>
  <p class="cmt-err notok" hidden></p></li>`;
const exampleComments = (site) => examples?.comment?.length && site ? `<h3>Try replying <span class="sig nc" tabindex="0" data-tip="${esc(TIPS.example)}">Examples</span></h3>
  <ul class="cmts">${examples.comment.map((c) => exampleComment(c, site)).join('')}</ul>` : '';

function socialPlaceholder(slug) {
  return `<h2>Social <span class="sig nc">Coming soon</span></h2>${COMING_SOON}
  <div class="strip placeholder">
    <div><div class="v">${dash}</div><div class="l">Facebook followers</div></div>
    <div><div class="v">${dash}</div><div class="l">Instagram followers</div></div>
    <div><div class="v">${dash}</div><div class="l">Views, 28 days</div></div>
    <div><div class="v">${dash}</div><div class="l">Engagements, 28 days</div></div>
    <div><div class="v">${dash}</div><div class="l">Comments waiting for a reply</div></div>
  </div>
  ${exampleComments(slug)}
  <h3>Comments</h3>${commentsTable(false, emptyRow(5, 'Comments will appear here.'))}
  <h3>Recent posts</h3>${postsTable(emptyRow(4, 'Recent posts will appear here.'))}`;
}

// Replying to a Google review. Claude can draft a reply to copy into Google; posting from here waits on the
// Business Profile API being approved, so that part stays a mock-up.
let claudeOn = false, examples = null, homeSlug = null;
const noteInput = '<input class="draft-note" type="text" maxlength="300" placeholder="Anything to mention? (optional)">';
const draftButtons = (tipKey) => claudeOn ? `<button class="run" type="button" onclick="draftReply(this)" data-tip="${esc(TIPS[tipKey])}">Draft with Claude</button><button class="run copy-btn" type="button" onclick="copyReply(this)" hidden>Copy</button>`
  : `<span tabindex="0" data-tip="${esc(TIPS.draftOff)}"><button class="run" type="button" disabled>Draft with Claude</button></span>`;
const mockReply = (r, site, clinic) => `<details class="mock-reply" data-draft="review" data-site="${esc(site)}" data-id="${esc(r.review_id)}"><summary class="run" data-tip="${esc(claudeOn ? TIPS.draftReply : TIPS.replySoon)}">Reply</summary>
  ${claudeOn ? noteInput : ''}
  <textarea rows="4" ${claudeOn ? '' : 'disabled'} placeholder="Reply publicly as ${esc(clinic || 'the clinic')} on Google…"></textarea>
  <div class="actions">${draftButtons('draftReply')}
  <span tabindex="0" data-tip="${esc(TIPS.replySoon)}"><button class="run primary-btn" type="button" disabled>Post reply</button></span><span class="sig nc">Posting coming soon</span></div>
  <p class="cmt-err notok" hidden></p></details>`;
async function draftReply(btn) {
  const box = btn.closest('[data-draft]'), ta = box.querySelector('textarea'), err = box.querySelector('.cmt-err');
  const kind = box.dataset.draft === 'review' ? 'reviews' : 'comments';
  btn.disabled = true; btn.textContent = 'Drafting…'; err.hidden = true;
  try {
    const { reply } = await post(`/sites/${box.dataset.site}/${kind}/${encodeURIComponent(box.dataset.id)}/draft-reply`, { note: box.querySelector('.draft-note')?.value || '' });
    ta.value = reply; const copy = box.querySelector('.copy-btn'); if (copy) copy.hidden = false; btn.textContent = 'Redraft';
  } catch (e) { err.textContent = `Couldn't draft a reply: ${e.message}`; err.hidden = false; btn.textContent = 'Draft with Claude'; }
  btn.disabled = false;
}
async function copyReply(btn) {
  const ta = btn.closest('[data-draft]').querySelector('textarea');
  try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand('copy'); }
  btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
}
window.draftReply = draftReply; window.copyReply = copyReply;

// ---- Ads on Google and Meta ----
const fmtTag = (f) => f ? `<span class="plat ad-${esc(f)}">${esc(f[0].toUpperCase() + f.slice(1))}</span>` : '';
const adCard = (a) => `<a class="ad" href="${esc(a.url || '#')}" target="_blank" rel="noopener">
  <span class="ad-img">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="muted">No preview</span>'}</span>
  <span class="ad-meta">${fmtTag(a.format)} ${a.running ? '<span class="sig good">Running</span>' : `<small class="muted">last shown ${dateShort(a.last_shown)}</small>`}</span>
  <small class="muted">${esc(a.advertiser)}${a.first_shown ? ` · since ${dateShort(a.first_shown)}` : ''}</small></a>`;
const adLinks = (a) => `<a class="run" href="${esc(a.googleUrl)}" target="_blank" rel="noopener">Google Ads Transparency ↗</a>
  <a class="run" href="${esc(a.metaUrl)}" target="_blank" rel="noopener" data-tip="${esc(TIPS.metaAds)}">Meta Ad Library ↗</a>`;

function adsSection(d, slug) {
  const a = d.ads, c = d.connections.ads;
  const note = c === 'not_connected' ? '<p class="empty">Google ads are checked through DataForSEO, which isn\u2019t configured.</p>'
    : c === 'no_data' ? `<p class="empty">${a.pending ? 'Checking Google now. Results usually arrive within a couple of hours.' : `Not checked yet. <button class="run" onclick="run('ads','${slug}')">Check now</button>`}</p>` : '';
  return `<h2>Ads</h2><p class="sub">Ads running for ${esc(d.site.host)}. Google ads come from Google\u2019s public Ads Transparency Center, checked weekly; Meta\u2019s are in its public Ad Library.</p>
  <div class="strip">
    <div><div class="v">${c === 'connected' ? a.running : dash}</div><div class="l">${tip('Google ads running now', 'adsRunning')}</div></div>
    <div><div class="v">${c === 'connected' ? a.total : dash}</div><div class="l">${tip('Google ads, last 90 days', 'adsSeen')}</div></div>
    <div><div class="v"><a href="${esc(a.metaUrl)}" target="_blank" rel="noopener">View ↗</a></div><div class="l">${tip('Facebook and Instagram ads', 'metaAds')}${a.metaByPage ? '' : ' <small>(search by name)</small>'}</div></div>
  </div>
  <div class="actions">${adLinks(a)}${c !== 'not_connected' ? `<button class="run" onclick="run('ads','${slug}')">Check Google ads</button>` : ''}</div>
  ${note}${c === 'connected' ? (a.ads.length ? `<div class="ads">${a.ads.map(adCard).join('')}</div>${a.total > a.ads.length ? `<p class="foot"><a href="${esc(a.googleUrl)}" target="_blank" rel="noopener">All ${a.total} on Google ↗</a></p>` : ''}`
    : `<p class="empty">No Google ads seen for this website in the last 90 days${a.checked ? ` (checked ${dateShort(a.checked)})` : ''}.</p>`) : ''}`;
}

// ---- One clinic ----
const pct = (cur, prev) => cur == null || !prev ? '' : (() => { const p = Math.round(((cur - prev) / prev) * 100); return `<span class="delta ${p > 0 ? 'up' : p < 0 ? 'down' : 'flat'}">${p > 0 ? '+' : ''}${p}%</span>`; })();
const yes = (v, text) => v == null ? dash : v ? `<span class="ok">✓</span> ${text || 'Yes'}` : '<span class="notok">✗</span> Missing';

function ratingBars(spread) {
  const total = Object.values(spread).reduce((a, b) => a + b, 0);
  if (!total) return '';
  return `<div class="spread">${[5, 4, 3, 2, 1].map((s) => `<div><span>${s} <span class="star">★</span></span><i style="--w:${(spread[s] / total * 100).toFixed(1)}%;--c:${s >= 4 ? 'var(--good)' : s === 3 ? 'var(--warn)' : 'var(--bad)'}"></i><b class="num">${spread[s]}</b></div>`).join('')}</div>`;
}

async function renderClinic(siteSlug, locSlug) {
  const [d, rows] = await Promise.all([api(`/sites/${encodeURIComponent(siteSlug)}/clinics/${encodeURIComponent(locSlug)}`), loadClinics().catch(() => [])]);
  const c = d.clinic, s = d.summary, g = d.listing, p = d.performance, cn = d.connections;
  const here = clinicHref(siteSlug, locSlug);
  // Until real reviews arrive, made-up ones show how drafting a reply works.
  const reviews = d.reviews.length ? d.reviews : (examples?.review || []).map((x) => ({ ...x, review_id: x.id, location: c.slug, replied: 0, example: true }));
  const packs = s.ranks.filter((r) => r.map_pack != null);
  const listingNote = cn.listings === 'not_connected'
    ? `<p class="empty">We can\u2019t read this clinic\u2019s Google listing yet. ${c.placeId || c.cid ? 'It has a place ID, so it will sync once DataForSEO or the Business Profile API is switched on.' : 'Add its <code>placeId</code> or <code>cid</code> in sites.json.'}</p>`
    : `<p class="empty">Not synced yet. <button class="run" onclick="run('gbp','${siteSlug}')">Sync ${esc(d.site.name)} listings</button></p>`;
  const detailRow = (label, google, ours, ok) => `<tr><th scope="row">${label}</th><td>${google ?? dash}</td><td>${ours ?? dash}${ok === false ? ' <span class="notok">✗</span>' : ''}</td></tr>`;
  // The ✗ beside our records only reflects the Google listing check; the website check has its own table below.
  const gbpNap = s.nap.find((x) => x.source === 'business-profile');
  const napFor = (field) => gbpNap ? Boolean(gbpNap[`${field}_ok`]) : undefined;
  const NAP_SOURCE = { 'business-profile': 'Google listing', website: 'Website' };

  $('#main').innerHTML = `
  <div class="page-head">
    <div class="site-head">${badge(d.site.slug, d.site.name, 'lg')}<div><h1>${esc(c.name)}</h1>
      <p class="sub">${c.town ? `${esc(c.town)} · ` : ''}<a href="#/${esc(d.site.slug)}">${esc(d.site.name)}</a>${c.mapsUrl ? ` · <a href="${esc(c.mapsUrl)}" target="_blank" rel="noopener">Google Maps ↗</a>` : ''}${c.url || d.site.url ? ` · <a href="${esc(c.url || d.site.url)}" target="_blank" rel="noopener">Website ↗</a>` : ''}</p></div></div>
    ${rows.length ? clinicPicker(rows, here) : ''}
  </div>

  <div class="strip">
    <div><div class="v">${g ? `${g.rating != null ? Number(g.rating).toFixed(1) : '—'} <span class="star">★</span><small>${n(g.review_count)} reviews</small>` : nc(cn.listings === 'no_data' ? 'No data yet' : 'Not connected')}</div><div class="l">${tip('Google rating', 'reviewCount')}</div></div>
    <div><div class="v">${g ? `${s.reviews.last30}${s.reviews.lowRecent ? `<small class="notok">${s.reviews.lowRecent} low</small>` : ''}` : dash}</div><div class="l">${tip('New reviews, 30 days', 'reviews30')}</div></div>
    <div><div class="v ${s.reviews.unreplied ? 'notok' : ''}">${g ? s.reviews.unreplied : dash}</div><div class="l">${tip('Unreplied reviews', 'unreplied')}</div></div>
    <div><div class="v ${g && g.completeness < 80 ? 'notok' : ''}">${g ? `${g.completeness}<small>%</small>` : dash}</div><div class="l">${tip('Listing complete', 'listing')}</div></div>
    <div><div class="v">${s.ranks.length ? `${packs.length}<small>of ${s.ranks.length} searches</small>` : nc(cn.localRanks === 'no_data' ? 'No data yet' : 'Not checked')}</div><div class="l">${tip('In the map pack', 'mapPack')}</div></div>
  </div>
  <div class="actions"><button class="run" onclick="run('gbp','${siteSlug}')">Sync Business Profiles</button><button class="run" onclick="run('local','${siteSlug}')">Check map-pack ranks and details</button></div>

  <h2>Google Business Profile${g?.open_status && g.open_status !== 'OPEN' ? ` <span class="sig problem">${esc(g.open_status.replace(/_/g, ' ').toLowerCase())}</span>` : ''}</h2>
  ${g ? `<p class="sub">Last synced ${dateShort(g.fetched_on)}.${c.gbpLinked ? '' : ' Read from Google\u2019s public listing; performance figures need Business Profile API access.'}</p>
  <div class="wrap"><table class="data details"><thead><tr><th></th>${th('On Google', 'onGoogle')}${th('Our records', 'ourRecords')}</tr></thead><tbody>
    ${detailRow('Name', esc(g.title), esc(c.name), napFor('name'))}
    ${detailRow('Category', esc(g.primary_category), null)}
    ${detailRow('Address', esc(g.address), esc(c.address), napFor('address'))}
    ${detailRow('Phone', esc(g.phone), esc(c.phone), napFor('phone'))}
    ${detailRow('Website', g.website ? `<a href="${esc(g.website)}" target="_blank" rel="noopener">${esc(g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : null, c.url || d.site.url ? esc((c.url || d.site.url).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) : null)}
    ${detailRow('Opening hours', yes(g.has_hours, 'Set'), null)}
    ${detailRow('Description', yes(g.has_description, 'Written'), null)}
    ${detailRow('Photos', g.photo_count != null ? n(g.photo_count) : null, null)}
    ${detailRow('Status', g.open_status ? esc(g.open_status.replace(/_/g, ' ').toLowerCase()) : null, null)}
  </tbody></table></div>` : listingNote}
  ${d.listingHistory.length > 1 ? `<p class="legend">Rating over time ${spark(d.listingHistory.map((h) => h.rating))} · reviews ${spark(d.listingHistory.map((h) => h.review_count))}</p>` : ''}

  ${s.nap.length ? `<h3>${tip('Do the details match?', 'detailsMatch')}</h3><div class="wrap"><table class="data"><thead><tr>${th('Source', 'sources')}<th>Name</th><th>Address</th><th>Phone</th><th>Notes</th></tr></thead><tbody>
    ${s.nap.map((x) => `<tr><td>${esc(NAP_SOURCE[x.source] || x.source)}</td><td>${okmark(x.name_ok)}</td><td>${okmark(x.address_ok)}</td><td>${okmark(x.phone_ok)}</td><td><small class="muted">${esc(x.detail || '')}</small></td></tr>`).join('')}
  </tbody></table></div>` : ''}

  ${checklistSection(d, siteSlug)}

  <h2>How people find the listing</h2>
  ${cn.performance === 'not_connected' ? '<p class="empty">Views, calls and direction requests come from the Business Profile API, which isn\u2019t connected for this clinic yet.</p>' : `
  <div class="strip">
    <div><div class="v">${p.last28 ? `${n(p.last28.views)}${pct(p.last28.views, p.prev28?.views)}` : nc('No data yet')}</div><div class="l">${tip('Listing views, 28 days', 'clinicViews')}</div></div>
    <div><div class="v">${p.last28 ? `${n(p.last28.calls)}${pct(p.last28.calls, p.prev28?.calls)}` : dash}</div><div class="l">${tip('Calls', 'calls')}</div></div>
    <div><div class="v">${p.last28 ? `${n(p.last28.directions)}${pct(p.last28.directions, p.prev28?.directions)}` : dash}</div><div class="l">${tip('Direction requests', 'directions')}</div></div>
    <div><div class="v">${p.last28 ? `${n(p.last28.website)}${pct(p.last28.website, p.prev28?.website)}` : dash}</div><div class="l">${tip('Website clicks', 'websiteClicks')}</div></div>
  </div>
  ${p.daily.length ? `<div style="margin-top:16px">${lineChart(p.daily, { a: 'views', b: 'calls', label: '<b>Calls</b> and listing views' })}</div>` : ''}`}

  <h2>Local search</h2>
  ${s.ranks.length ? `<p class="sub">Searched as if from ${esc(c.town || c.name)}${d.rankDate ? `, checked ${dateShort(d.rankDate)}` : ''}.</p><div class="wrap"><table class="data"><thead><tr>${th('Search', 'townSearch')}${th('Map pack', 'packPosition', 'r')}${th('Trend', 'trend')}${th('Organic', 'organic', 'r')}${th('Who\'s in the pack', 'whoInPack')}</tr></thead><tbody>
  ${s.ranks.map((r) => `<tr><td>${esc(r.keyword)}</td><td class="r"><span class="pos ${r.map_pack == null ? 'none' : r.map_pack <= 3 ? 'top3' : ''}">${r.map_pack ?? 'not shown'}</span>${delta(r.map_pack, r.prev, true)}</td>
    <td>${spark(d.rankHistory[r.keyword] || [], true)}</td><td class="r num">${r.organic ?? dash}</td>
    <td><small class="muted">${r.top_pack.map((x) => `#${x.p} ${esc(x.t)}${x.r ? ` (${x.r})` : ''}`).join(' · ')}</small></td></tr>`).join('')}</tbody></table></div>`
    : `<p class="empty">${cn.localRanks === 'not_connected' ? (c.lat == null ? 'Add this clinic\u2019s <code>lat</code> and <code>lng</code> in sites.json to check where it shows on the map.' : 'Map-pack checks run through DataForSEO, which isn\u2019t configured.') : `Not checked yet. <button class="run" onclick="run('local','${siteSlug}')">Check now</button>`}</p>`}

  <h2>Reviews${reviews.length ? ` <span class="sig nc" tabindex="0" data-tip="${esc(TIPS.replySoon)}">Posting replies coming soon</span>` : ''}</h2>
  ${d.reviews.length ? `<div class="reviews-head"><div>${tip('Star split', 'ratingSpread')}${ratingBars(d.ratingSpread)}</div></div>` : reviews.length ? '<p class="sub">No reviews synced for this clinic yet, so here are two made-up ones to try drafting a reply.</p>' : ''}
  ${reviews.length ? `<div class="wrap"><table class="data"><thead><tr><th>Date</th>${th('Rating', 'rating')}<th>Review</th>${th('Replied', 'replied')}</tr></thead><tbody>
  ${reviews.map((r) => `<tr><td>${r.example ? `<span class="sig nc" tabindex="0" data-tip="${esc(TIPS.example)}">Example</span>` : `<small class="muted">${dateShort(r.created_at)}</small>`}</td><td>${stars(r.rating)}</td>
    <td>${esc((r.comment || '').slice(0, 400))}${(r.comment || '').length > 400 ? '…' : ''}${r.reviewer ? `<br><small class="muted">${esc(r.reviewer)}</small>` : ''}${r.replied ? '' : mockReply(r, siteSlug, c.name)}</td><td>${okmark(r.replied)}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="empty">No reviews yet.</p>'}

  ${aiSection(d, siteSlug, true)}

  ${keywordSection(d, siteSlug)}

  ${ideasSection(d, siteSlug)}

  <h2>${tip('Website', 'brandWebsite')}</h2>
  <p class="sub"><a href="${esc(d.site.url)}" target="_blank" rel="noopener">${esc(d.site.host)}</a>${d.website.sharedWith > 1 ? `, shared by ${d.website.sharedWith} ${esc(d.site.name)} clinics` : ''}. <a href="#/${esc(d.site.slug)}">Open the brand page →</a></p>
  <div class="strip">
    <div><div class="v">${d.website.score != null ? `${d.website.score}<small>/100</small>${delta(d.website.score, d.website.prevScore)}` : nc('Not audited')}</div><div class="l">${tip('Audit score', 'auditScore')}</div></div>
    <div><div class="v">${d.website.errors != null ? d.website.errors : dash}</div><div class="l">${tip('Errors', 'errors')}</div></div>
    <div><div class="v">${d.website.clicks != null ? `${n(d.website.clicks)}${delta(d.website.clicks, d.website.prevClicks)}` : nc(d.connections.searchConsole === 'no_data' ? 'No data yet' : undefined)}</div><div class="l">${tip('Clicks from Google, 28 days', 'clicks')}</div></div>
  </div>`;
}

// ---- Top-3 local SEO checklist (one clinic) ----
const CK_MARK = { done: '<span class="ok">✓</span>', todo: '<span class="notok">✗</span>', unknown: '<span class="ck-q">?</span>' };
const ckItem = (i) => `<li class="ck ${i.status}"><span class="ck-mark" aria-label="${i.status === 'done' ? 'Done' : i.status === 'todo' ? 'Not done' : 'Not checked'}">${CK_MARK[i.status]}</span>
  <div class="ck-body"><span class="tip" tabindex="0" data-tip="${esc(i.tip)}">${esc(i.label).replace(/(\S+)$/, '<span class="nw">$1<i class="ti" aria-hidden="true">i</i></span>')}</span>
  ${i.value ? `<small class="muted">${esc(i.value)}</small>` : ''}
  ${i.source === 'manual' ? `<select class="ck-set" aria-label="${esc(i.label)}" data-item="${esc(i.key)}" onchange="tickItem(this)">
    ${[['', 'Not checked'], ['1', 'Done'], ['0', 'Not done']].map(([v, l]) => `<option value="${v}"${(i.status === 'unknown' ? '' : i.status === 'done' ? '1' : '0') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
    ${i.tickedBy || i.tickedAt ? `<small class="muted">${i.tickedBy ? esc(i.tickedBy.split('@')[0]) : 'Ticked'}, ${dateShort(i.tickedAt)}</small>` : ''}` : ''}</div></li>`;
function checklistSection(d, siteSlug) {
  const k = d.checklist; if (!k) return '';
  const list = (grp) => `<ul class="checklist">${k.items.filter((i) => i.group === grp).map(ckItem).join('')}</ul>`;
  return `<h2>${tip('Top-3 checklist', 'checklist')} <span class="sig ${k.done === k.total ? 'good' : k.basics.done === k.basics.total ? 'watch' : 'nc'}">${k.done} of ${k.total} done</span></h2>
  <p class="sub">What listings in Google’s top 3 map results have in common, from <a href="https://localo.com/blog/top-local-seo-ranking-factors" target="_blank" rel="noopener">Localo’s study of local rankings</a>. Hover an item for what’s needed. Items we can read from the listing tick themselves; set the rest by hand.</p>
  <div class="ck-cols" data-site="${esc(siteSlug)}" data-loc="${esc(d.clinic.slug)}">
    <div><h3>${tip('The basics', 'ckBasics')} <small class="muted">${k.basics.done} of ${k.basics.total}</small></h3>${list('basics')}</div>
    <div><h3>${tip('To win a top-3 spot', 'ckTop3')} <small class="muted">${k.top3.done} of ${k.top3.total}</small></h3>${list('top3')}</div>
  </div>`;
}
async function tickItem(sel) {
  const box = sel.closest('.ck-cols'), y = scrollY;
  sel.disabled = true;
  try {
    await post(`/sites/${box.dataset.site}/clinics/${box.dataset.loc}/checklist`, { item: sel.dataset.item, done: sel.value === '' ? null : sel.value === '1' });
    await renderClinic(box.dataset.site, box.dataset.loc); scrollTo(0, y);
  } catch (e) { sel.disabled = false; alert(`Couldn’t save: ${e.message}`); }
}
window.tickItem = tickItem;

// ---- Keyword research and Claude's traffic ideas (one clinic) ----
const ADVICE = {
  both: ['SEO + Ads', 'good', 'Worth targeting on the website and bidding on in Google Ads.'],
  seo: ['SEO', 'good', 'Worth targeting on the website: people search for it and it isn’t too hard to rank for.'],
  ads: ['Ads', 'watch', 'Worth bidding on in Google Ads: urgent or “near me” searches, ones advertisers compete for, or ones too hard to win organically.'],
  watch: ['Low priority', 'nc', 'Too few searches to be worth much effort right now, or already in the top 3.'],
};
const usd = (v) => v == null ? null : `$${Number(v).toFixed(2)}`;
const kdBar = (k) => k == null ? '<small class="muted">?</small>' : `<span class="score"><b>${k}</b><i style="--w:${k}%;--c:${k < 30 ? 'var(--good)' : k < 50 ? 'var(--warn)' : 'var(--bad)'}"></i></span>`;
const kwRow = (k) => `<tr data-advice="${k.advice}"><td>${esc(k.keyword)}${k.seed ? '' : ' <small class="muted">suggested</small>'}</td>
  <td class="r num">${k.volume == null ? '<small class="muted">too few</small>' : n(k.volume)}</td><td>${spark(k.trend || [])}</td>
  <td>${kdBar(k.difficulty)}</td>
  <td class="r num">${k.lowBid != null ? `${usd(k.lowBid)}–${usd(k.highBid ?? k.lowBid)}` : k.cpc ? usd(k.cpc) : dash}</td>
  <td><small class="muted">${k.competition ? esc(k.competition.toLowerCase()) : '—'}</small></td>
  <td class="r">${k.position != null ? `<span class="pos ${k.position <= 3 ? 'top3' : ''}">${k.position}</span>` : k.mapPack != null ? `<small class="muted">map #${k.mapPack}</small>` : '<small class="muted">not ranking</small>'}</td>
  <td><span class="sig ${ADVICE[k.advice][1]}" tabindex="0" data-tip="${esc(ADVICE[k.advice][2])}">${ADVICE[k.advice][0]}</span>${k.why.length ? `<br><small class="muted">${esc(k.why.join(', '))}</small>` : ''}</td></tr>`;

// Keyword research and Claude ideas run for a clinic or, on brand pages, for the brand itself.
const scopeAttrs = (d, siteSlug) => `data-site="${esc(siteSlug)}" data-loc="${esc(d.clinic ? d.clinic.slug : '')}"`;
const COUNTRY = { NZ: 'New Zealand', AU: 'Australia' };
function keywordSection(d, siteSlug) {
  const k = d.keywords, c = d.connections.keywords, here = scopeAttrs(d, siteSlug);
  const where = COUNTRY[k.market] || 'New Zealand';
  const from = d.clinic ? `built from ${esc(d.clinic.town || 'the clinic’s town')} and the clinic’s services`
    : k.fromSite ? `built from what Google thinks ${esc(d.site.host)} is about` : 'built from what the business sells';
  const head = `<h2>Keyword research</h2><p class="sub">Searches to target on the website (SEO) and to bid on in Google Ads, ${from}. Monthly searches and bids are ${where}-wide figures from Google Ads’ Keyword Planner; difficulty is from DataForSEO.</p>`;
  if (!k.available) return `${head}<p class="empty">Add this clinic’s <code>town</code> in sites.json to research keywords for it.</p>`;
  if (c === 'not_connected') return `${head}<p class="empty">Keyword research runs through DataForSEO, which isn’t configured.</p>`;
  const form = (label) => `<form class="kw-form" ${here} onsubmit="return researchKeywords(event)">
    <input class="draft-note" name="extra" type="text" maxlength="300" placeholder="Add your own words, separated by commas (optional), e.g. ${d.clinic ? 'puppy school, cat boarding' : 'a product or service you want found for'}">
    <button class="run" type="submit" data-tip="${esc(TIPS.kwResearch)}">${label}</button><p class="cmt-err notok" hidden></p></form>`;
  const start = k.seeds.length ? `We’ll start from: ${k.seeds.map((x) => `<code>${esc(x)}</code>`).join(' ')}` : `We’ll start from the searches Google matches to <code>${esc(d.site.host)}</code>.`;
  if (!k.researched) return `${head}<p class="empty">Not researched yet. ${start}</p>${form('Research keywords')}`;
  const ct = k.counts, top = 40;
  return `${head}
  <div class="strip">
    <div><div class="v">${ct.total}</div><div class="l">${tip('Keywords found', 'kwFound')}</div></div>
    <div><div class="v">${n(ct.volume)}</div><div class="l">${tip('Searches a month', 'volume')}</div></div>
    <div><div class="v">${ct.seo}</div><div class="l">${tip('Worth targeting with SEO', 'kwSeo')}</div></div>
    <div><div class="v">${ct.ads}</div><div class="l">${tip('Worth bidding on in Ads', 'kwAds')}</div></div>
    <div><div class="v">${ct.ranking}</div><div class="l">${tip('Already on page one', 'kwRanking')}</div></div>
  </div>
  <div class="actions inbox-tabs kw-tabs"><a class="run on" onclick="kwFilter(this,'')">All</a><a class="run" onclick="kwFilter(this,'seo')">SEO</a><a class="run" onclick="kwFilter(this,'ads')">Google Ads</a>
    <button class="run" type="button" onclick="kwCsv(this)" ${here}>Download CSV</button><small class="muted">Researched ${dateShort(k.fetched)}</small></div>
  <div class="wrap kw-table"><table class="data"><thead><tr>${th('Search', 'keyword')}${th('Monthly searches', 'volume', 'r')}${th('Trend', 'kwTrend')}${th('Difficulty', 'difficulty')}${th('Top-of-page bid (US$)', 'kwBid', 'r')}${th('Ad competition', 'kwCompetition')}${th('Our position', 'kwPosition', 'r')}${th('Suggested for', 'kwAdvice')}</tr></thead>
  <tbody>${k.items.map((x, i) => kwRow(x).replace('<tr ', `<tr${i >= top ? ' hidden data-more' : ''} `)).join('')}</tbody></table></div>
  ${k.items.length > top ? `<p class="foot"><button class="run" type="button" onclick="kwMore(this)">Show all ${k.items.length}</button></p>` : ''}
  <details class="kw-again"><summary class="run">Research again with more words</summary>${form('Research again')}</details>`;
}

const CHANNEL = { seo: 'SEO', google_ads: 'Google Ads', google_listing: 'Google listing', reviews: 'Reviews', website: 'Website', ai_answers: 'AI answers', social: 'Social' };
// Green is the good end: high impact, low effort.
const level = (v, label, lowIsGood = false) => `<span class="sig ${v === (lowIsGood ? 'low' : 'high') ? 'good' : v === 'medium' ? 'watch' : 'nc'}">${label} ${esc(v)}</span>`;
const charCount = (t, max) => `<small class="${t.length > max ? 'notok' : 'muted'}">${t.length}/${max}</small>`;

function ideasSection(d, siteSlug) {
  const s = d.suggestions, on = d.connections.claude === 'connected', here = scopeAttrs(d, siteSlug);
  const reads = d.clinic ? 'listing, reviews, map pack, AI answers, ads and keyword research' : 'website audit, Search Console, rankings, competitors, AI answers, ads and keyword research';
  const head = `<h2>Ideas to grow traffic <span class="sig nc">Claude</span></h2><p class="sub">Claude reads everything on this page (${reads}) and suggests what to do next for SEO and Google Ads, with a starter search ad.${d.keywords.researched ? '' : ' Research keywords first for sharper Ads ideas.'}</p>`;
  if (!on) return `${head}<p class="empty">Ideas from Claude need an Anthropic API key (<code>ANTHROPIC_API_KEY</code>) set on the server.</p>`;
  const form = `<form class="kw-form" ${here} onsubmit="return getIdeas(event)"><input class="draft-note" name="focus" type="text" maxlength="300" placeholder="Anything to focus on? (optional), e.g. ${d.clinic ? 'more puppy bookings, a new vet starting' : 'more trade enquiries, a new product launch'}">
    <button class="run" type="submit">${s ? 'Get new ideas' : 'Get ideas'}</button><p class="cmt-err notok" hidden></p></form>`;
  if (!s) return `${head}${form}`;
  const copyList = (items, label) => `<button class="run copy-btn" type="button" data-copy="${esc(items.join('\n'))}" onclick="copyText(this)">Copy ${label}</button>`;
  return `${head}
  <p class="ideas-summary">${esc(s.summary)}</p>
  <ol class="ideas">${s.ideas.map((i) => `<li class="idea"><div class="idea-head"><b>${esc(i.title)}</b><span class="plat ad-text">${esc(CHANNEL[i.channel] || i.channel)}</span>${level(i.impact, 'impact')}${level(i.effort, 'effort', true)}</div>
    <p class="muted">${esc(i.why)}</p>${i.steps.length ? `<ul>${i.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${i.channel === 'social' && d.planablePages?.length ? `<div class="actions"><button class="run" type="button" onclick="ideaToPost(this)" data-topic="${esc(`${i.title}. ${i.why}`)}">Draft a post in Planable</button></div>` : ''}</li>`).join('')}</ol>
  <h3>${tip('Starter Google search ad', 'adDraft')}</h3>
  <div class="ad-draft">
    <div><h4>Headlines</h4><ul>${s.ad.headlines.map((h) => `<li>${esc(h)} ${charCount(h, 30)}</li>`).join('')}</ul>${copyList(s.ad.headlines, 'headlines')}</div>
    <div><h4>Descriptions</h4><ul>${s.ad.descriptions.map((h) => `<li>${esc(h)} ${charCount(h, 90)}</li>`).join('')}</ul>${copyList(s.ad.descriptions, 'descriptions')}</div>
    <div><h4>Keywords to bid on</h4><ul>${s.ad.keywords.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>${copyList(s.ad.keywords, 'keywords')}</div>
  </div>
  <p class="foot muted"><small>Generated ${dateShort(s.created)}${s.focus ? ` with the focus “${esc(s.focus)}”` : ''}${s.by ? ` by ${esc(s.by)}` : ''}. Check ideas and ad copy before using them.</small></p>
  ${form}`;
}

async function busy(ev, label, fn) {
  ev.preventDefault();
  const f = ev.target, btn = f.querySelector('button'), err = f.querySelector('.cmt-err'), was = btn.textContent;
  btn.disabled = true; btn.textContent = label; err.hidden = true;
  try { await fn(f); } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = was; }
  return false;
}
// Re-render only this page once new research or ideas are saved, keeping the scroll position.
const rerender = async (f) => { const y = scrollY; await (f.dataset.loc ? renderClinic(f.dataset.site, f.dataset.loc) : renderSite(f.dataset.site)); scrollTo(0, y); };
const scopePath = (f) => `/sites/${f.dataset.site}${f.dataset.loc ? `/clinics/${f.dataset.loc}` : ''}`;
function researchKeywords(ev) {
  return busy(ev, 'Researching… (up to a minute)', async (f) => { await post(`${scopePath(f)}/keywords`, { extra: f.extra.value }); await rerender(f); });
}
function getIdeas(ev) {
  return busy(ev, 'Claude is thinking… (up to a minute)', async (f) => { await post(`${scopePath(f)}/suggestions`, { focus: f.focus.value }); await rerender(f); });
}
function kwFilter(a, advice) {
  a.parentElement.querySelectorAll('a.run').forEach((x) => x.classList.toggle('on', x === a));
  const rows = document.querySelectorAll('.kw-table tbody tr');
  rows.forEach((r) => { r.hidden = advice ? !(r.dataset.advice === advice || r.dataset.advice === 'both') : r.hasAttribute('data-more'); });
}
function kwMore(btn) { document.querySelectorAll('.kw-table tr[data-more]').forEach((r) => { r.hidden = false; r.removeAttribute('data-more'); }); btn.remove(); }
function kwCsv(btn) {
  const cells = (tr) => [...tr.children].map((td) => `"${td.innerText.replace(/\s+/g, ' ').trim().replace(/"/g, '""')}"`).join(',');
  const rows = [...document.querySelectorAll('.kw-table tr')].map(cells).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' })); a.download = `keywords-${[btn.dataset.site, btn.dataset.loc].filter(Boolean).join('-')}.csv`; a.click();
}
async function copyText(btn) {
  try { await navigator.clipboard.writeText(btn.dataset.copy); } catch { /* clipboard blocked */ }
  const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 1500);
}
Object.assign(window, { researchKeywords, getIdeas, kwFilter, kwMore, kwCsv, copyText });

// ---- AI answers ----
const aiCell = (r) => {
  if (!r || !r.checked) return dash;
  if (r.engine === 'google_aio' && !r.present) return '<small class="muted">no overview</small>';
  const cited = r.cited ? ` <span class="sig good" tabindex="0" data-tip="${esc(TIPS.aiCited)}">cites site</span>` : '';
  return r.mentioned ? `<span class="ok">✓</span> <span class="num">#${r.rank}</span>${r.prevMentioned === false ? ' <span class="delta up">new</span>' : ''}${cited}`
    : `<span class="notok">✗</span>${r.prevMentioned ? ' <span class="delta down">dropped</span>' : ''}${cited}`;
};
// Google often shows the map instead of an AI Overview for local searches, so say so rather than "0 of 0".
const aioTally = (a, big) => !a.overviewsChecked ? dash : !a.overviewsShown ? `<small class="muted">none shown</small>`
  : big ? `${a.overviewsCiting}<small>of ${a.overviewsShown} shown</small>` : `${a.overviewsCiting} of ${a.overviewsShown}`;
const aiTally = (e) => e && e.checked ? `${e.mentioned}<small>of ${e.checked}</small>` : dash;
const aiAnswer = (r, label) => r.checked && (r.engine !== 'google_aio' || r.present) ? `<details class="ai-answer"><summary>${esc(label)} ${r.mentioned ? '<span class="ok">✓</span>' : '<span class="notok">✗</span>'} <small class="muted">${esc(r.prompt)} · ${dateShort(r.checked)}</small></summary>
  <div class="ai-text">${esc(r.answer).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</div>
  ${r.sources.length ? `<p class="muted"><small>${tip('Sources', 'aiSources')}: ${r.sources.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.domain || x.title)}</a>`).join(' · ')}</small></p>` : ''}</details>` : '';

// A brand-wide question gets a table row of its own; clinics keep one row each.
const aiRows = (a) => a.clinics.flatMap((cl) => cl.brand ? [...new Set(cl.results.map((r) => r.prompt))].map((p) => ({ brand: true, name: p, results: cl.results.filter((r) => r.prompt === p) })) : [cl]);
// The brand page shows every clinic; a clinic page passes its own one (oneClinic) and the brand's slug for the run button.
function aiSection(d, slug, oneClinic = false) {
  const a = d.ai, c = d.connections.ai;
  if (!a.questions) return '';
  const brandOnly = a.clinics.every((cl) => cl.brand), brandQs = a.clinics.find((cl) => cl.brand)?.results.map((r) => r.prompt).filter((x, i, l) => l.indexOf(x) === i) || [];
  const head = `<h2>AI answers</h2><p class="sub">${brandOnly ? 'What ChatGPT, Gemini and Perplexity say when asked the questions below, with web search on, and whether they name or cite us. Checked monthly.'
    : `What ChatGPT, Gemini and Perplexity say when someone asks for a vet in ${oneClinic ? 'this clinic\u2019s town' : 'each clinic\u2019s town'}, and whether Google\u2019s AI Overview names or links to the clinic.${brandQs.length ? ' The last rows are brand-wide questions.' : ''} Checked monthly.`}</p>`;
  if (c === 'not_connected') return `${head}<p class="empty">AI answers come through DataForSEO, which isn\u2019t configured.</p>`;
  if (c === 'no_data' || !a.checked) return `${head}<p class="empty">Not checked yet. <button class="run" onclick="run('ai','${slug}')">Ask the AIs now</button></p>`;
  const engines = a.engines.filter((e) => e.key !== 'google_aio'), aio = a.engines.find((e) => e.key === 'google_aio');
  const res = (cl, key) => cl.results.find((r) => r.engine === key);
  return `${head}
  <div class="strip">
    <div><div class="v">${a.mentioned}<small>of ${a.total}</small>${a.prevTotal ? delta(a.mentioned, a.prevMentioned) : ''}</div><div class="l">${tip(oneClinic ? 'AI answers naming the clinic' : brandOnly ? 'AI answers naming us' : 'AI answers naming a clinic', 'aiNamed')}</div></div>
    ${engines.map((e) => `<div><div class="v">${aiTally(a.byEngine[e.key])}</div><div class="l">${tip(`Named by ${e.label}`, 'aiEngine')}</div></div>`).join('')}
    ${aio ? `<div><div class="v">${aioTally(a, true)}</div><div class="l">${tip('Google AI Overviews naming or citing us', 'aiOverview')}</div></div>` : ''}
  </div>
  <div class="actions"><button class="run" onclick="run('ai','${slug}')">Ask the AIs again</button></div>
  <div class="wrap"><table class="data"><thead><tr><th>${brandOnly ? 'Asked about' : 'Clinic'}</th>${engines.map((e) => th(e.label, 'aiEngine')).join('')}${aio && !brandOnly ? th('AI Overview', 'aiOverview') : ''}${th('Named instead', 'aiNamedInstead')}</tr></thead><tbody>
  ${aiRows(a).map((cl) => { const named = [...new Set(cl.results.flatMap((r) => r.named || []))].slice(0, 5); return `<tr><td>${cl.brand ? `\u201c${esc(cl.name)}\u201d<br><small class="muted">Brand question</small>` : `${oneClinic ? `<b>${esc(cl.name)}</b>` : `<a class="clinic-link" href="${clinicHref(slug, cl.slug)}"><b>${esc(cl.name)}</b></a>`}<br><small class="muted">${esc(cl.town)}</small>`}</td>
    ${engines.map((e) => `<td>${aiCell(res(cl, e.key))}</td>`).join('')}${aio && !brandOnly ? `<td>${aiCell(res(cl, 'google_aio'))}</td>` : ''}
    <td><small class="muted">${named.length ? named.map(esc).join(' · ') : '—'}</small></td></tr>`; }).join('')}
  </tbody></table></div>
  ${a.competitors.length ? `<p class="sub">Named most often instead: ${a.competitors.map((x) => `${esc(x.name)} <span class="num muted">×${x.n}</span>`).join(' · ')}</p>` : ''}
  <details class="ai-answers"><summary class="run">Read the answers</summary>
  ${a.clinics.map((cl) => `${oneClinic ? '' : `<h3>${esc(cl.name)}</h3>`}${cl.results.map((r) => aiAnswer(r, a.engines.find((e) => e.key === r.engine)?.label || r.engine)).join('') || '<p class="muted">Not checked yet.</p>'}`).join('')}</details>`;
}

async function renderAi() {
  const { engines, brands } = await api('/ai');
  const groups = [...new Set(brands.map((r) => r.group))];
  const llms = engines.filter((e) => e.key !== 'google_aio'), aio = engines.find((e) => e.key === 'google_aio');
  $('#main').innerHTML = `<h1>AI answers</h1><p class="sub">Each month we ask ${llms.map((e) => e.label).join(', ').replace(/, ([^,]*)$/, ' and $1')} which vet they would recommend in every clinic\u2019s town, and check Google\u2019s AI Overview for the town\u2019s local search. Businesses without clinics get their own questions, such as where to buy what they sell. Open a brand to read the answers.</p>
  ${brands.length ? groups.map((g) => groupBlock(g, brands.filter((r) => r.group === g).length, `<div class="wrap"><table class="ledger"><thead><tr><th>Brand</th>${th('Named in AI answers', 'aiNamed')}${llms.map((e) => th(e.label, 'aiEngine')).join('')}${aio ? th('AI Overview', 'aiOverview') : ''}${th('Named instead', 'aiNamedInstead')}</tr></thead><tbody>
  ${brands.filter((r) => r.group === g).map((r) => `<tr>
    <td class="brand"><div class="who">${badge(r.slug, r.name)}<div><a href="#/${r.slug}">${esc(r.name)}</a><small>${r.clinics ? `${r.clinics} clinic${r.clinics === 1 ? '' : 's'}` : 'Brand questions'}${r.checked ? ` · checked ${dateShort(r.checked)}` : ''}</small></div></div></td>
    <td class="num">${r.total ? `${r.mentioned} of ${r.total}${r.prevTotal ? delta(r.mentioned, r.prevMentioned) : ''}` : nc('Not checked')}</td>
    ${llms.map((e) => `<td class="num">${r.byEngine[e.key]?.checked ? `${r.byEngine[e.key].mentioned} of ${r.byEngine[e.key].checked}` : dash}</td>`).join('')}
    ${aio ? `<td class="num">${aioTally(r)}</td>` : ''}
    <td class="why"><small class="muted">${r.competitors.slice(0, 3).map((x) => esc(x.name)).join(' · ') || '—'}</small></td>
  </tr>`).join('')}</tbody></table></div>`)).join('') : '<p class="empty">No brands have AI questions. Clinics need a <code>town</code>, and the brand needs <code>localKeywords</code> or <code>aiPrompts</code> in sites.json.</p>'}
  <div class="actions"><button class="run" onclick="run('ai')">Ask the AIs for every brand</button></div>`;
}

async function renderAds() {
  const rows = await api('/ads');
  const groups = [...new Set(rows.map((r) => r.group))];
  $('#main').innerHTML = `<h1>Ads</h1><p class="sub">Ads each brand is running on Google, from Google\u2019s public Ads Transparency Center (checked weekly), with a link to each brand\u2019s Facebook and Instagram ads in Meta\u2019s Ad Library.</p>
  ${groups.map((g) => groupBlock(g, rows.filter((r) => r.group === g).length, `<div class="wrap"><table class="ledger"><thead><tr><th>Brand</th>${th('Google, running', 'adsRunning')}${th('Google, 90 days', 'adsSeen')}<th>Latest Google ads</th><th>Ad libraries</th></tr></thead><tbody>
  ${rows.filter((r) => r.group === g).map((r) => `<tr>
    <td class="brand"><div class="who">${badge(r.slug, r.name)}<div><a href="#/${r.slug}">${esc(r.name)}</a><small>${esc(r.host)}</small></div></div></td>
    <td class="num">${r.checked ? r.running : r.pending ? nc('Checking') : nc('Not checked')}</td><td class="num">${r.checked ? r.total : dash}</td>
    <td><div class="ads mini">${r.ads.filter((x) => x.image).slice(0, 4).map((x) => `<a class="ad" href="${esc(x.url || '#')}" target="_blank" rel="noopener"><span class="ad-img"><img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span></a>`).join('') || '<span class="dash">—</span>'}</div></td>
    <td class="links"><a href="${esc(r.googleUrl)}" target="_blank" rel="noopener">Google ↗</a> <a href="${esc(r.metaUrl)}" target="_blank" rel="noopener" data-tip="${esc(TIPS.metaAds)}">Meta ↗</a></td>
  </tr>`).join('')}</tbody></table></div>`)).join('')}
  <div class="actions"><button class="run" onclick="run('ads')">Check Google ads for every brand</button></div>`;
}

async function renderComments(status) {
  const st = await api('/status');
  if (!st.meta && st.planable) {
    $('#main').innerHTML = `<h1>Comments</h1><p class="sub">Planable\u2019s API doesn\u2019t include comments or messages, so reply to them in Planable\u2019s Social Inbox. <a href="https://app.planable.io" target="_blank" rel="noopener">Open Planable ↗</a></p>
    <p class="sub">Connecting the Meta app here as well would bring Facebook and Instagram comments into this inbox, with Claude drafting replies.</p>${exampleComments(homeSlug)}`;
    return;
  }
  if (!st.meta) {
    $('#main').innerHTML = `<h1>Comments <span class="sig nc">Coming soon</span></h1>${COMING_SOON}
    ${exampleComments(homeSlug)}
    <h3>Inbox</h3><div class="actions inbox-tabs"><a class="run on">Waiting for a reply</a><a class="run">All recent</a></div>
    ${commentsTable(true, emptyRow(6, 'Facebook and Instagram comments from every brand will appear here, with a reply box on each.'))}`;
    return;
  }
  const rows = await api(`/comments${status === 'all' ? '?status=all' : ''}`);
  $('#main').innerHTML = `<h1>Comments</h1><p class="sub">Facebook and Instagram comments across every brand. Replies go out publicly as the brand's account.</p>
  <div class="actions inbox-tabs"><a class="run ${status === 'all' ? '' : 'on'}" href="#/comments">Waiting for a reply</a><a class="run ${status === 'all' ? 'on' : ''}" href="#/comments/all">All recent</a>
    <button class="run" onclick="run('meta-comments')">Check for new comments</button></div>
  ${rows.length ? commentsList(rows, true) : `<p class="empty">${status === 'all' ? 'No comments synced yet.' : 'Nothing waiting. All caught up.'}</p>`}`;
}

async function run(job, site) {
  await api(`/run/${job}${site ? `?site=${site}` : ''}`, { method: 'POST' });
  const b = document.activeElement; if (b?.tagName === 'BUTTON') { b.textContent = 'Running in background…'; b.disabled = true; }
}
window.run = run;

const SIGNAL = {
  good: ['Good', 'good', 'Nothing needs attention right now.'],
  watch: ['Watch', 'watch', 'Something is worth a look soon, such as traffic slipping 5% or more, website issues, a poor or unanswered review, or clinics missing from the local map.'],
  problem: ['Problem', 'problem', 'Needs a decision: search traffic down 20% or more, website health under 60, several poor reviews, or a listing showing as closed.'],
  not_connected: ['Not connected', 'nc', 'We don\u2019t have access to this brand\u2019s Search Console or Google listings yet, so there is nothing to report.'],
};
const sig = (k) => `<span class="sig ${SIGNAL[k][1]}" tabindex="0" data-tip="${esc(SIGNAL[k][2])}">${SIGNAL[k][0]}</span>`;
const nc = (label = 'Not connected') => `<span class="nc-text">${label}</span>`;
const conn = (status, value) => status === 'not_connected' ? nc() : status === 'no_data' ? nc('No data yet') : value;
// The first group in sites.json is the home group; the others are tucked away (menu dropdown, collapsed sections).
let homeGroup = null;
// Brand badge: the circular logo, or the brand's initials when there isn't one
const logos = {};
const badge = (slug, name, cls = '') => logos[slug]
  ? `<img class="badge ${cls}" src="${esc(logos[slug])}" alt="" loading="lazy">`
  : `<span class="badge mono ${cls}" aria-hidden="true">${esc((name || slug).replace(/\(.*?\)/g, '').split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase())}</span>`;
const groupBlock = (name, count, body) => name === homeGroup
  ? `<section class="group"><h2 class="group-title">${esc(name)}</h2>${body}</section>`
  : `<details class="group fold"><summary><h2 class="group-title">${esc(name)}<span class="count">${count} brand${count === 1 ? '' : 's'}</span></h2></summary>${body}</details>`;
const pctTxt = (p) => p == null ? '' : `<span class="delta ${p > 0 ? 'up' : p < 0 ? 'down' : 'flat'}">${p > 0 ? '+' : ''}${p}%</span>`;

// Overview map: every clinic as a circle on New Zealand, coloured by how its Google reviews are going.
const SENTIMENT = { negative: ['Unhappy', 'Rated under 4, or two or more 1–2 star reviews (or recent reviews averaging under 3.5) in the last 90 days.'],
  mixed: ['Mixed', 'Rated 4 to 4.4, or one 1–2 star review (or recent reviews averaging under 4.3) in the last 90 days.'],
  positive: ['Happy', 'Rated 4.5 or more with no poor reviews in the last 90 days.'],
  unknown: ['No data yet', 'We haven’t read this clinic’s Google listing yet.'] };
const pinTip = (c) => `${c.name}, ${c.town}. ${c.rating != null ? `Rated ${c.rating}${c.reviews ? ` from ${n(c.reviews)} reviews` : ''}.` : 'No rating yet.'}${c.recent.n ? ` Last 90 days: ${c.recent.n} review${c.recent.n === 1 ? '' : 's'} averaging ${c.recent.avg}.` : ''}${c.reasons.length ? ` Watch: ${c.reasons.join(', ')}.` : ''} Click to open.`;
// Clinics in the same town sit on top of each other at map scale, so push overlapping circles apart until each one shows.
function spreadPins(spots) {
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i], b = spots[j], gap = a.r + b.r - 1;
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= gap) continue;
      if (d < 0.01) { dx = Math.cos(j * 2.4); dy = Math.sin(j * 2.4); d = 1; } // same spot: split them in a fixed direction
      const push = (gap - d) / 2 + 0.05;
      a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; moved = true;
    }
    if (!moved) break;
  }
  return spots;
}
// Groups of clinics close enough to crowd each other; hovering one zooms the map in on it.
function pinClusters(spots, link = 13) {
  const parent = spots.map((_, i) => i), find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++)
    if (Math.hypot(spots[i].x0 - spots[j].x0, spots[i].y0 - spots[j].y0) < link) parent[find(i)] = find(j);
  const groups = Object.values(spots.reduce((m, p, i) => ((m[find(i)] ||= []).push(p), m), {})).filter((g) => g.length > 1);
  return groups.map((members) => {
    const x = members.reduce((a, p) => a + p.x0, 0) / members.length, y = members.reduce((a, p) => a + p.y0, 0) / members.length;
    let gap = Infinity; for (const a of members) for (const b of members) if (a !== b) gap = Math.min(gap, Math.hypot(a.x0 - b.x0, a.y0 - b.y0));
    return { members, x, y, gap, R: Math.max(14, ...members.map((p) => Math.hypot(p.x0 - x, p.y0 - y) + p.r + 5)) };
  });
}
let mapSpots = [];
// Hover zoom: the map glides in on a crowded spot, puts each clinic back at its real position and labels it with its
// town; moving away (or off the map) glides back out. On touch, the first tap on a crowded spot zooms instead of opening.
function initClinicMap() {
  const svg = $('.nzmap > svg'); if (!svg) return;
  const vb = svg.viewBox.baseVal, full = [vb.x, vb.y, vb.width, vb.height];
  const clusters = pinClusters(mapSpots), byK = new Map(mapSpots.map((p) => [p.k, p]));
  const circles = [...svg.querySelectorAll('.pin')].map((a) => ({ el: a.firstElementChild, p: byK.get(+a.dataset.k) }));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let zoomed = null, busy = false, cur = { view: full, pins: circles.map(({ p }) => [p.x, p.y, p.r]) };
  const point = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const layout = (g) => {
    if (!g) return { view: full, pins: circles.map(({ p }) => [p.x, p.y, p.r]) };
    // Zoom far enough that the closest two clinics sit well apart with room for their names (3x to 12x).
    const w = Math.max(full[2] / Math.min(12, Math.max(3, 34 / g.gap)), g.R * 2.4), h = w * full[3] / full[2], k = full[2] / w;
    // Spread again at the zoomed scale so clinics at the same address still both show.
    const near = spreadPins(g.members.map((p) => ({ p, x: p.x0 * k, y: p.y0 * k, r: p.r * 1.15 })));
    const at = new Map(near.map((n) => [n.p, [n.x / k, n.y / k, n.r / k]]));
    return { view: [g.x - w / 2, g.y - h / 2, w, h], k, pins: circles.map(({ p }) => at.get(p) || [p.x, p.y, p.r / k]) };
  };
  const paint = (s) => {
    svg.setAttribute('viewBox', s.view.map((v) => v.toFixed(2)).join(' '));
    circles.forEach(({ el }, i) => { const [x, y, r] = s.pins[i]; el.setAttribute('cx', x.toFixed(2)); el.setAttribute('cy', y.toFixed(2)); el.setAttribute('r', r.toFixed(2)); });
  };
  // Town names go right of each circle, else left, above or below, wherever they don't hit another name or circle.
  const labels = (g, s) => {
    const box = svg.querySelector('.zlabels'); box.innerHTML = '';
    if (!g) return;
    const k = s.k, dots = g.members.map((p) => s.pins[circles.findIndex((c) => c.p === p)].map((v) => v * k)), placed = [];
    const clash = (b) => placed.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1])
      || dots.some(([x, y, r]) => b[0] < x + r && b[2] > x - r && b[1] < y + r && b[3] > y - r);
    box.innerHTML = g.members.map((p, i) => [p, dots[i]]).sort((a, b) => a[1][1] - b[1][1]).map(([p, [x, y, r]]) => {
      const name = p.c.town || p.c.name, w = name.length * 6.6 + 2, h = 13;
      const spots = [[x + r + 3, y - h / 2], [x - r - 3 - w, y - h / 2], [x - w / 2, y - r - 2 - h], [x - w / 2, y + r + 2]];
      const [lx, ly] = spots.find(([a, b]) => !clash([a, b, a + w, b + h])) || spots[0];
      placed.push([lx, ly, lx + w, ly + h]);
      return `<text x="${(lx / k).toFixed(2)}" y="${((ly + h - 3) / k).toFixed(2)}" font-size="${(12 / k).toFixed(2)}" stroke-width="${(3 / k).toFixed(2)}">${esc(name)}</text>`;
    }).join('');
  };
  const go = (g) => {
    if (g === zoomed) return;
    zoomed = g; busy = true; labels(null); svg.classList.toggle('zoomed', Boolean(g));
    const from = cur, to = layout(g), t0 = performance.now(), ms = still ? 0 : 420;
    const step = (now) => {
      const t = ms ? Math.min(1, (now - t0) / ms) : 1, e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const mix = (a, b) => a + (b - a) * e;
      paint({ view: from.view.map((v, i) => mix(v, to.view[i])), pins: from.pins.map((q, i) => q.map((v, j) => mix(v, to.pins[i][j]))) });
      if (t < 1) return requestAnimationFrame(step);
      cur = to; busy = false; labels(g, to);
    };
    requestAnimationFrame(step);
  };
  const hit = (pt) => clusters.filter((g) => Math.hypot(pt.x - g.x, pt.y - g.y) < g.R).sort((a, b) => Math.hypot(pt.x - a.x, pt.y - a.y) - Math.hypot(pt.x - b.x, pt.y - b.y))[0];
  // Hover only for a real mouse; a tap goes through the click handler (touch also fires a stray mouseleave).
  svg.addEventListener('pointermove', (e) => {
    if (busy || e.pointerType !== 'mouse') return;
    const pt = point(e);
    if (!zoomed) { const g = hit(pt); if (g) go(g); } else if (Math.hypot(pt.x - zoomed.x, pt.y - zoomed.y) > zoomed.R * 1.25) go(hit(pt) || null);
  });
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') go(null); });
  svg.addEventListener('click', (e) => {
    if (busy) { e.preventDefault(); return; } // a tap that just started a zoom shouldn't also open a clinic
    if (zoomed) { if (!e.target.closest('.pin')) go(null); return; }
    const g = hit(point(e)); if (g) { e.preventDefault(); go(g); }
  }, true);
}
function clinicMapSection(pins) {
  if (!pins.length) return '';
  // Australian clinics (west of 160°E) go on a south-east Australia inset in the empty top-left corner of the NZ map.
  const P = NZ_OUTLINE, A = AU_INSET, AX = 0, AY = 20, inAu = (c) => c.lng < 160;
  const at = (c) => inAu(c) ? [AX + (c.lng - A.W0) * A.K * A.SC, AY + (A.N0 - c.lat) * A.SC] : [(c.lng - P.W0) * P.K * P.SC, (P.N0 - c.lat) * P.SC];
  const spots = spreadPins(pins.map((c, k) => { const [x0, y0] = at(c), r = inAu(c) ? 5.5 : 7; return { k, c, x0, y0, x: x0, y: y0, r }; }));
  mapSpots = spots;
  const hot = pinClusters(spots).map((g) => `<circle class="hot" cx="${g.x.toFixed(1)}" cy="${g.y.toFixed(1)}" r="${g.R.toFixed(1)}"/>`).join('');
  const order = ['unknown', 'positive', 'mixed', 'negative'];
  const count = Object.fromEntries(order.map((k) => [k, pins.filter((c) => c.sentiment === k).length]));
  const watch = pins.filter((c) => c.sentiment === 'negative' || c.sentiment === 'mixed')
    .sort((a, b) => order.indexOf(b.sentiment) - order.indexOf(a.sentiment) || (a.rating ?? 5) - (b.rating ?? 5));
  // Worst last so they draw on top where clinics sit close together.
  // Clinics nudged apart to stay visible keep a thin line back to their real spot.
  const leaders = '<g class="leaders">' + spots.filter((p) => Math.hypot(p.x - p.x0, p.y - p.y0) > 3).map((p) => `<line class="leader" x1="${p.x0.toFixed(1)}" y1="${p.y0.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/><circle class="spot" cx="${p.x0.toFixed(1)}" cy="${p.y0.toFixed(1)}" r="1.6"/>`).join('') + '</g>';
  const dots = leaders + [...spots].sort((a, b) => order.indexOf(a.c.sentiment) - order.indexOf(b.c.sentiment)).map(({ k, c, x, y, r }) => `<a href="${clinicHref(c.site, c.slug)}" class="pin ${c.sentiment}" data-k="${k}" data-tip="${esc(pinTip(c))}" aria-label="${esc(`${c.name}: ${SENTIMENT[c.sentiment][0]}`)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/></a>`).join('');
  const inset = pins.some(inAu) ? `<g class="inset"><text x="${AX + 2}" y="${AY - 6}">South-east Australia</text><clipPath id="au-clip"><rect x="${AX}" y="${AY}" width="${A.w}" height="${A.h}" rx="6"/></clipPath><rect class="sea" x="${AX}" y="${AY}" width="${A.w}" height="${A.h}" rx="6"/><path class="land" clip-path="url(#au-clip)" transform="translate(${AX} ${AY})" d="${A.d}"/><rect class="frame" x="${AX}" y="${AY}" width="${A.w}" height="${A.h}" rx="6"/></g>` : '';
  const nz = pins.filter((c) => !inAu(c)).length, au = pins.length - nz;
  return `<h2>Clinic sentiment</h2><div class="nzmap">
    <svg viewBox="-6 -6 ${P.w + 12} ${P.h + 12}" role="img" aria-label="Map of New Zealand${au ? ' with a south-east Australia inset' : ''} showing ${pins.length} clinics coloured by review sentiment"><path class="land" d="${P.d}"/>${inset}<g class="hots">${hot}</g>${dots}<g class="zlabels"></g></svg>
    <div class="nzmap-side">
      <p class="sub">${pins.length} clinics${au ? ` (${nz} in New Zealand, ${au} in Australia)` : ''}, coloured by their Google rating and the tone of the last 90 days of reviews. Hover a circle for the detail, click to open the clinic. Where clinics sit close together, hover the dashed ring to zoom in.</p>
      <ul class="legend">${[...order].reverse().map((k) => `<li class="${k}"><i></i><span class="tip" tabindex="0" data-tip="${esc(SENTIMENT[k][1])}">${SENTIMENT[k][0]}</span><b>${count[k]}</b></li>`).join('')}</ul>
      ${watch.length ? `<h3>Worth a look</h3><ul class="watchlist">${watch.slice(0, 8).map((c) => `<li class="${c.sentiment}"><i></i><a href="${clinicHref(c.site, c.slug)}">${esc(c.name)}</a><small>${esc(c.reasons.join(', '))}</small></li>`).join('')}</ul>${watch.length > 8 ? `<p class="foot"><a href="#/clinics">and ${watch.length - 8} more in Clinics →</a></p>` : ''}`
        : count.unknown === pins.length ? '<p class="empty">Ratings appear once the clinics’ Google listings have been read.</p>' : '<p class="empty">Every clinic with reviews is doing well.</p>'}
    </div></div>`;
}

async function renderManagement() {
  const [groups, pins] = await Promise.all([api('/management'), api('/clinic-map').catch(() => [])]);
  $('#main').innerHTML = `<h1>How things are going</h1><p class="sub">Search visibility and Google listings across the group, updated daily. Green is fine, amber needs a look, red needs a decision.</p>
  ${clinicMapSection(pins)}
  ${groups.map((g) => { const h = g.headline; return groupBlock(g.group, g.brands.length, `
    <div class="strip mgmt">
      <div><div class="v">${h.brandsConnected}<small>of ${h.brands} brands</small></div><div class="l">${tip('Reporting', 'reporting')}</div></div>
      ${h.listingsTotal ? `<div><div class="v">${h.listingsConnected}<small>of ${h.listingsTotal} listings</small></div><div class="l">${tip('Google listings connected', 'listingsConnected')}</div></div>` : ''}
      <div><div class="v">${h.clicks != null ? n(h.clicks) : nc()}${pctTxt(h.clicksChange)}</div><div class="l">${tip('Visits from Google search, 28 days', 'visits')}</div></div>
      ${h.listingsTotal ? `<div><div class="v">${h.rating != null ? `${h.rating} <span class="star">★</span>` : nc()}</div><div class="l">${tip('Average clinic rating', 'avgRating')}</div></div>` : ''}
      <div><div class="v">${h.health != null ? `${h.health}<small>/100</small>` : nc()}</div><div class="l">${tip('Average website health', 'health')}</div></div>
      <div><div class="v ${h.problems ? 'notok' : ''}">${h.problems}<small>problem${h.problems === 1 ? '' : 's'}</small> <span class="muted">·</span> ${h.watch}<small>to watch</small></div><div class="l">${tip('Brands needing attention', 'needingAttention')}</div></div>
    </div>
    <div class="wrap"><table class="ledger mgmt-table"><thead><tr><th>Brand</th>${th('Status', 'status')}${th('Why', 'why')}${th('Since last month', 'sinceLastMonth')}</tr></thead><tbody>
    ${g.brands.map((b) => `<tr>
      <td class="brand"><div class="who">${badge(b.slug, b.name)}<div><a href="#/${b.slug}">${esc(b.name)}</a>${b.metrics.clinics ? `<small>${b.metrics.clinicsConnected} of ${b.metrics.clinics} clinics connected</small>` : ''}</div></div></td>
      <td>${sig(b.signal)}</td>
      <td class="why">${b.signal === 'not_connected' ? '<span class="muted">Waiting on access to this brand\u2019s Search Console or Google listings</span>' : b.reasons.length ? esc(b.reasons.join('; ')) : '<span class="muted">Nothing needs attention</span>'}</td>
      <td class="why">${b.changes.length ? esc(b.changes.join(' · ')) : '<span class="muted">—</span>'}</td>
    </tr>`).join('')}</tbody></table></div>`); }).join('')}
  <p class="foot"><a href="#/portfolio">Open the detailed dashboard →</a></p>`;
  initClinicMap();
}

// WP Umbrella's red flags next to a brand on the Portfolio page.
const webFlags = (w) => !w ? '' : [w.down && '<span class="sig problem">Down</span>', w.hidden && '<span class="sig problem">Hidden from Google</span>',
  w.vulnerabilities && `<span class="sig problem">${w.vulnerabilities} security alert${w.vulnerabilities === 1 ? '' : 's'}</span>`].filter(Boolean).map((x) => ` ${x}`).join('');
async function renderOverview() {
  const sites = await api('/overview');
  const groups = [...new Set(sites.map((s) => s.group))];
  $('#main').innerHTML = `
  <h1>Portfolio</h1><p class="sub">Every brand, last 28 days. Open a brand for the detail.</p>
  ${groups.map((g) => groupBlock(g, sites.filter((s) => s.group === g).length, `
  <div class="wrap"><table class="ledger"><thead><tr>
    <th>Brand</th>${th('Audit score', 'auditScore')}${th('Errors', 'errors', 'num')}${th('Clicks', 'clicks', 'num')}${th('Impressions', 'impressions', 'num')}${th('Keywords in top 10', 'top10')}${th('Referring domains', 'referringDomains', 'num')}
  </tr></thead><tbody>${sites.filter((s) => s.group === g).map((s) => `<tr>
    <td class="brand"><div class="who">${badge(s.slug, s.name)}<div><a href="#/${s.slug}">${esc(s.name)}</a><small>${esc(s.host)}</small>${webFlags(s.web)}</div></div></td>
    <td>${scoreBar(s.audit?.score)}${delta(s.audit?.score, s.audit?.prevScore)}</td>
    <td class="num">${s.audit ? (s.audit.issue_counts.error || 0) : n(null)}</td>
    <td class="num">${s.gsc ? `${n(s.gsc.clicks)}${delta(s.gsc.clicks, s.gsc.prevClicks)}` : nc()}</td>
    <td class="num">${s.gsc ? `${n(s.gsc.impressions)}${delta(s.gsc.impressions, s.gsc.prevImpressions)}` : nc()}</td>
    <td>${s.ranks ? `${s.ranks.top10} of ${s.ranks.tracked}${s.ranks.top3 ? ` <span class="delta up">${s.ranks.top3} in top 3</span>` : ''}` : nc('Not tracked')}</td>
    <td class="num">${n(s.domain?.referring_domains)}</td>
  </tr>`).join('')}</tbody></table></div>`)).join('')}
  <div class="actions">
    <button class="run" onclick="run('audit')">Audit all sites</button>
    <button class="run" onclick="run('ranks')">Check rankings</button>
    <button class="run" onclick="run('gsc')">Sync Search Console</button>
    <button class="run" onclick="run('competitors')">Refresh competitor data</button>
    <a class="run" href="/api/digest" target="_blank" style="display:inline-block">Preview digest</a>
  </div>`;
}

// ---- Website uptime and upkeep, from WP Umbrella (WordPress brands only) ----
const yesNo = (v, good = true) => v == null ? dash : v === good ? '<span class="ok">✓</span>' : '<span class="notok">✗</span>';
const speedCls = (v) => v == null ? '' : v >= 90 ? 'good' : v >= 50 ? 'watch' : 'problem';
const WPU_DOWN = { http_status_error: 'error page', dns_resolution_failed: 'domain didn’t resolve', timeout: 'timed out' };
function websiteSection(d, slug) {
  const w = d.website;
  if (!w) return '';
  const h = `<h2>Website uptime and upkeep${w.state === 'coming_soon' ? ' <span class="sig nc">Coming soon</span>' : ''}</h2>`;
  const what = 'Uptime, speed, plugin and WordPress updates, security alerts, PHP errors, broken links and backups for this WordPress site, from WP Umbrella.';
  if (w.state === 'coming_soon') return `${h}<p class="sub">${what} This switches on once the WP Umbrella API token is added on the server (WP_UMBRELLA_API_KEY) and the site is in the WP Umbrella account.</p>
  <div class="strip placeholder">${['Up, last 30 days', 'Speed (mobile)', 'Updates waiting', 'Security alerts', 'Broken links'].map((l) => `<div><div class="v">${dash}</div><div class="l">${l}</div></div>`).join('')}</div>`;
  const sync = `<div class="actions"><button class="run" onclick="run('wpumbrella','${slug}')">Sync from WP Umbrella</button><a class="run" href="https://app.wp-umbrella.com" target="_blank" rel="noopener" style="display:inline-block">Open WP Umbrella ↗</a></div>`;
  if (w.state === 'no_data') return `${h}<p class="empty">No data yet. It syncs every few hours, or sync it now.</p>${sync}`;
  if (w.state === 'not_linked') return `${h}<p class="empty">${esc(d.site.host)} isn’t in WP Umbrella yet. Add the site there (install the WP Umbrella plugin and paste the connection key), or, if it’s listed under another address, set <code>"wpUmbrella": { "projectId": … }</code> for this brand in sites.json.${w.message ? ` <small class="muted">Last check: ${esc(w.message)}</small>` : ''}</p>${sync}`;
  const updates = w.plugins.outdated.length + w.themes.outdated.length + (w.wordpress.upToDate === false ? 1 : 0);
  const alerts = [
    w.down && '<span class="sig problem">Down right now</span>',
    w.disconnected && '<span class="sig watch">WP Umbrella has lost its connection to this site</span>',
    w.indexable === false && `<span class="sig problem" tabindex="0" data-tip="${esc(TIPS.wpIndexable)}">Hidden from Google: search engines are blocked in WordPress</span>`,
    w.ssl === false && '<span class="sig problem">No HTTPS</span>',
    w.debug && '<span class="sig watch">Debug mode is on</span>',
    w.php.supported === false && `<span class="sig watch">PHP ${esc(w.php.version)} is no longer supported</span>`,
  ].filter(Boolean);
  const uptime = w.uptime?.pct != null ? `${Number(w.uptime.pct).toFixed(2)}<small>%</small>` : nc(w.uptime?.monitoring === false ? 'Not monitored' : 'No data yet');
  const speed = (v) => v == null ? dash : `<span class="sig ${speedCls(v)}">${v}</span>`;
  return `${h}<p class="sub">From WP Umbrella, synced ${dateShort(w.fetchedAt)}${w.lastSync ? `; it last read the site ${dateShort(w.lastSync)}` : ''}.</p>
  ${alerts.length ? `<p>${alerts.join(' ')}</p>` : ''}
  <div class="strip">
    <div><div class="v">${uptime}</div><div class="l">${tip(`Up, last 30 days${w.uptime ? ` · ${w.uptime.incidents} outage${w.uptime.incidents === 1 ? '' : 's'}` : ''}`, 'wpUptime')}</div></div>
    <div><div class="v">${speed(w.performance.mobile)} ${speed(w.performance.desktop)}</div><div class="l">${tip('Speed, mobile and desktop', 'wpSpeed')}</div></div>
    <div><div class="v">${updates}</div><div class="l">${tip('Updates waiting', 'wpUpdates')}</div></div>
    <div><div class="v">${w.vulnerabilities.length ? `<span class="notok">${w.vulnerabilities.length}</span>` : 0}</div><div class="l">${tip('Security alerts', 'wpVulns')}</div></div>
    <div><div class="v">${w.brokenLinks.count}${w.brokenLinks.more ? '+' : ''}</div><div class="l">${tip('Broken links', 'wpBroken')}</div></div>
  </div>
  <div class="two">
    <div><h3>Setup</h3><div class="wrap"><table class="data"><tbody>
      <tr><td>WordPress</td><td>${esc(w.wordpress.version || '—')} ${w.wordpress.upToDate === false ? '<span class="sig watch">Update available</span>' : w.wordpress.upToDate ? '<span class="ok">✓</span>' : ''}</td></tr>
      <tr><td>PHP</td><td>${esc(w.php.version || '—')}${w.php.recommended && w.php.recommended !== w.php.version ? ` <small class="muted">(${esc(w.php.recommended)} recommended)</small>` : ''}</td></tr>
      <tr><td>${tip('Search engines allowed', 'wpIndexable')}</td><td>${yesNo(w.indexable)}</td></tr>
      <tr><td>HTTPS</td><td>${yesNo(w.ssl)}</td></tr>
      <tr><td>Response time</td><td>${w.responseMs != null ? `${n(w.responseMs)} ms` : dash}</td></tr>
      <tr><td>PHP errors logged</td><td>${n(w.phpIssues)}</td></tr>
      <tr><td>Last backup</td><td>${w.backup ? `${dateShort(w.backup.at)} <small class="muted">${esc(String(w.backup.status || '').toLowerCase())}</small>` : dash}</td></tr>
      <tr><td>Last outage</td><td>${w.lastDowntime ? dateShort(w.lastDowntime) : dash}</td></tr>
    </tbody></table></div></div>
    <div><h3>Updates waiting</h3>${updates ? `<ul class="examples">${w.wordpress.upToDate === false ? '<li>WordPress itself</li>' : ''}${w.plugins.outdated.map((x) => `<li>Plugin: ${esc(x)}</li>`).join('')}${w.themes.outdated.map((x) => `<li>Theme: ${esc(x)}</li>`).join('')}</ul>` : `<p class="empty">Everything is up to date${w.plugins.total ? ` (${w.plugins.total} plugins)` : ''}.</p>`}
    ${w.uptime?.recent?.length ? `<h3>Recent outages</h3><ul class="examples">${w.uptime.recent.map((i) => `<li>${dateShort(i.at)}${i.mins != null ? `, ${i.mins} min` : ''}${i.why ? ` <small class="muted">${esc(WPU_DOWN[i.why] || i.why.replace(/_/g, ' '))}${i.status ? ` (${i.status})` : ''}</small>` : ''}</li>`).join('')}</ul>` : ''}</div>
  </div>
  ${w.vulnerabilities.length ? `<h3>Security alerts</h3><div class="wrap"><table class="data"><thead><tr><th>Issue</th><th>In</th><th class="r">Severity</th><th>Fixed in</th></tr></thead><tbody>
    ${w.vulnerabilities.map((v) => `<tr><td>${v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a>` : esc(v.title)}</td><td>${esc(v.what)}</td><td class="r num">${v.cvss ?? dash}</td><td>${esc(v.fixedIn || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
  ${w.brokenLinks.count ? `<h3>Broken links</h3><div class="wrap"><table class="data"><thead><tr><th>Link</th><th>On page</th><th class="r">Status</th></tr></thead><tbody>
    ${w.brokenLinks.list.map((b) => `<tr><td><a href="${esc(b.href)}" target="_blank" rel="noopener">${clip(b.href, 70)}</a>${b.anchor ? `<br><small class="muted">“${clip(b.anchor, 60)}”</small>` : ''}${b.internal ? '' : ' <small class="muted">external</small>'}</td><td>${b.page ? `<a href="${esc(b.page)}" target="_blank" rel="noopener">${esc(host(b.page))}</a>` : ''}</td><td class="r num">${b.status ?? esc(b.error || '—')}</td></tr>`).join('')}</tbody></table></div>
    ${w.brokenLinks.count > w.brokenLinks.list.length || w.brokenLinks.more ? '<p class="muted"><small>The full list is in WP Umbrella.</small></p>' : ''}` : ''}
  ${w.errors ? `<p class="muted"><small>Some of it couldn’t be read: ${esc(w.errors)}</small></p>` : ''}
  ${sync}`;
}

async function renderSite(slug) {
  const d = await api(`/sites/${slug}`);
  const g = d.gsc, last28 = g.daily.slice(-28), prev28 = g.daily.slice(-56, -28);
  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const top10 = d.ranks.filter((r) => r.position && r.position <= 10).length;
  const mine = d.domains[0] || {};
  // Until real reviews arrive, made-up ones show how drafting a reply works.
  const reviews = d.recentReviews.length || !d.locations.length ? d.recentReviews
    : (examples?.review || []).map((x) => ({ ...x, review_id: x.id, location: d.locations[0].slug, replied: 0, example: true }));
  $('#main').innerHTML = `
  <div class="site-head">${badge(d.site.slug, d.site.name, 'lg')}<div><h1>${esc(d.site.name)}</h1><p class="sub"><a href="${esc(d.site.url)}" target="_blank">${esc(d.site.host)}</a>${d.audit ? ` · audited ${dateShort(d.audit.finished_at)}, ${d.audit.pages_crawled} pages` : ' · not audited yet'}</p></div></div>

  <div class="strip">
    <div><div class="v">${d.audit?.score ?? '—'}<small>/100</small></div><div class="l">${tip('Audit score', 'auditScore')}${d.scoreHistory.length > 1 ? ` · ${spark(d.scoreHistory.map((s) => s.score))}` : ''}</div></div>
    <div><div class="v">${conn(d.connections.searchConsole, last28.length ? `${n(sum(last28, 'clicks'))}${prev28.length ? delta(sum(last28, 'clicks'), sum(prev28, 'clicks')) : ''}` : nc('No data yet'))}</div><div class="l">${tip('Clicks, 28 days', 'clicks')}</div></div>
    <div><div class="v">${conn(d.connections.searchConsole, last28.length ? `${n(sum(last28, 'impressions'))}${prev28.length ? delta(sum(last28, 'impressions'), sum(prev28, 'impressions')) : ''}` : nc('No data yet'))}</div><div class="l">${tip('Impressions, 28 days', 'impressions')}</div></div>
    <div><div class="v">${conn(d.connections.ranks, d.ranks.length ? `${top10}<small>of ${d.ranks.length}</small>` : nc('No data yet'))}</div><div class="l">${tip('Tracked keywords in top 10', 'top10')}</div></div>
    <div><div class="v">${n(mine.referring_domains)}</div><div class="l">${tip('Referring domains', 'referringDomains')}</div></div>
  </div>
  <div class="actions">
    <button class="run" onclick="run('audit','${slug}')">Re-audit</button>
    <button class="run" onclick="run('ranks','${slug}')">Check rankings</button>
    <button class="run" onclick="run('gsc','${slug}')">Sync Search Console</button>
    <button class="run" onclick="run('competitors','${slug}')">Refresh competitors</button>
  </div>

  <h2>Search performance</h2>
  ${d.connections.searchConsole === 'not_connected' ? '<p class="empty">Search Console is not connected for this brand. Add the service account as a user on this brand\u2019s Search Console property; it is picked up on the next sync.</p>' : lineChart(g.daily)}

  ${g.strikingDistance.length ? `<h2>Within reach</h2><p class="sub">Queries ranking 8–20 with real impressions. Improving these pages is usually the cheapest traffic available.</p>
  <div class="wrap"><table class="data"><thead><tr>${th('Query', 'query')}${th('Page', 'rankingPage')}${th('Position', 'position', 'r')}${th('Impressions', 'queryImpressions', 'r')}${th('Clicks', 'queryClicks', 'r')}</tr></thead><tbody>
  ${g.strikingDistance.map((q) => `<tr><td>${esc(q.query)}</td><td><a href="${esc(q.page)}" target="_blank">${esc(host(q.page))}</a></td><td class="r num">${q.position.toFixed(1)}</td><td class="r num">${n(q.impressions)}</td><td class="r num">${n(q.clicks)}</td></tr>`).join('')}
  </tbody></table></div>` : ''}

  <h2>Site health</h2>
  ${d.issues.length ? `<div class="wrap"><table class="data"><thead><tr>${th('Issue', 'issue')}${th('Severity', 'severity')}${th('Pages', 'pages', 'r')}</tr></thead><tbody>
  ${d.issues.map((i) => `<tr><td><details><summary>${esc(i.label)}</summary><ul class="examples">${i.examples.map((e) => `<li><a href="${esc(e.url)}" target="_blank">${esc(e.url)}</a>${e.detail ? ` — ${esc(e.detail)}` : ''}</li>`).join('')}${i.n > i.examples.length ? `<li><a href="/api/sites/${slug}/issues/${i.code}" target="_blank">all ${i.n} pages</a></li>` : ''}</ul></details></td>
    <td>${tip(`<span class="sev ${i.severity}">${i.severity}</span>`, 'severity', false)}</td><td class="r num">${n(i.n)}</td></tr>`).join('')}
  </tbody></table></div>` : d.audit ? '<p class="empty">No issues found. Nice.</p>' : '<p class="empty">Run an audit to see site issues.</p>'}

  <h2>Rank tracking</h2>
  ${d.ranks.length ? `<div class="wrap"><table class="data"><thead><tr>${th('Keyword', 'keyword')}${th('Position', 'rankPosition', 'r')}${th('30 days', 'trend')}${th('Ranking page', 'rankingPage')}${th('Volume', 'volume', 'r')}${th('Difficulty', 'difficulty', 'r')}${th('Competitors in SERP', 'competitorsInSerp')}</tr></thead><tbody>
  ${d.ranks.map((r) => `<tr><td>${esc(r.keyword)}</td>
    <td class="r"><span class="pos ${r.position == null ? 'none' : r.position <= 3 ? 'top3' : ''}">${r.position ?? (r.history.length ? '>100' : '—')}</span>${delta(r.position, r.prev, true)}</td>
    <td>${spark(r.history, true)}</td><td>${r.url ? `<a href="${esc(r.url)}" target="_blank">${esc(host(r.url))}</a>` : ''}</td>
    <td class="r num">${n(r.volume)}</td><td class="r num">${n(r.difficulty)}</td>
    <td>${r.competitorsInSerp.map((c) => `${esc(c.d)} <span class="num">#${c.p}</span>`).join(', ')}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="empty">Add keywords to this site in data/sites.json to track rankings.</p>'}

  <div class="two">
    <div><h2>Top queries</h2>${g.topQueries.length ? `<div class="wrap"><table class="data"><thead><tr>${th('Query', 'query')}${th('Clicks', 'queryClicks', 'r')}${th('Pos', 'position', 'r')}</tr></thead><tbody>
      ${g.topQueries.slice(0, 20).map((q) => `<tr><td>${esc(q.query)}</td><td class="r num">${n(q.clicks)}</td><td class="r num">${q.position.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Connect Search Console to see queries.</p>'}</div>
    <div><h2>Top pages</h2>${g.topPages.length ? `<div class="wrap"><table class="data"><thead><tr>${th('Page', 'pagePath')}${th('Clicks', 'queryClicks', 'r')}${th('Impr.', 'queryImpressions', 'r')}</tr></thead><tbody>
      ${g.topPages.slice(0, 20).map((p) => `<tr><td><a href="${esc(p.page)}" target="_blank">${esc(host(p.page))}</a></td><td class="r num">${n(p.clicks)}</td><td class="r num">${n(p.impressions)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Connect Search Console to see pages.</p>'}</div>
  </div>

  ${d.locations.length ? `<h2>Clinics</h2>${locationsTable(d.locations, false, slug)}
  <div class="actions"><button class="run" onclick="run('gbp','${slug}')">Sync Business Profiles</button><button class="run" onclick="run('local','${slug}')">Check map-pack ranks and details</button></div>
  ${d.locations.some((l) => l.ranks.length) ? `<h2>Map-pack rankings by town</h2><div class="wrap"><table class="data"><thead><tr><th>Clinic</th>${th('Search', 'townSearch')}${th('Map pack', 'packPosition', 'r')}${th('Organic', 'organic', 'r')}${th('Who\'s in the pack', 'whoInPack')}</tr></thead><tbody>
  ${d.locations.flatMap((l) => l.ranks.map((r) => `<tr><td>${esc(l.name)}</td><td>${esc(r.keyword)}</td><td class="r"><span class="pos ${r.map_pack == null ? 'none' : r.map_pack <= 3 ? 'top3' : ''}">${r.map_pack ?? 'not shown'}</span>${delta(r.map_pack, r.prev, true)}</td><td class="r num">${r.organic ?? '<span class="dash">—</span>'}</td>
    <td><small class="muted">${r.top_pack.map((p) => `#${p.p} ${esc(p.t)}${p.r ? ` (${p.r})` : ''}`).join(' · ')}</small></td></tr>`)).join('')}</tbody></table></div>` : ''}
  ${reviews.length ? `<h2>Recent reviews <span class="sig nc" tabindex="0" data-tip="${esc(TIPS.replySoon)}">Posting replies coming soon</span></h2>${d.recentReviews.length ? '' : '<p class="sub">No reviews synced for this brand yet, so here are two made-up ones to try drafting a reply.</p>'}<div class="wrap"><table class="data"><thead><tr><th>Clinic</th>${th('Rating', 'rating')}<th>Review</th>${th('Replied', 'replied')}</tr></thead><tbody>
  ${reviews.slice(0, 15).map((r) => { const loc = d.locations.find((l) => l.slug === r.location); return `<tr><td>${esc(loc?.name || r.location)}<br>${r.example ? `<span class="sig nc" tabindex="0" data-tip="${esc(TIPS.example)}">Example</span>` : `<small class="muted">${dateShort(r.created_at)}</small>`}</td><td>${stars(r.rating)}</td><td>${esc((r.comment || '').slice(0, 220))}${(r.comment || '').length > 220 ? '…' : ''}${r.reviewer ? `<br><small class="muted">${esc(r.reviewer)}</small>` : ''}${r.replied ? '' : mockReply(r, slug, loc?.name)}</td><td>${okmark(r.replied)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}` : ''}

  ${websiteSection(d, slug)}

  ${aiSection(d, slug)}

  ${socialSection(d, slug)}

  ${adsSection(d, slug)}

  ${!d.brandLevel ? '' : `${keywordSection(d, slug)}

  ${ideasSection(d, slug)}`}

  <h2>Competitors</h2>
  ${d.domains.some((x) => x.fetched_on) ? `<div class="wrap"><table class="data"><thead><tr>${th('Domain', 'domain')}${th('Organic keywords', 'organicKeywords', 'r')}${th('Est. monthly traffic', 'traffic', 'r')}${th('Backlinks', 'backlinks', 'r')}${th('Referring domains', 'referringDomains', 'r')}${th('Domain rank', 'domainRank', 'r')}</tr></thead><tbody>
  ${d.domains.map((x, i) => `<tr><td>${i === 0 ? '<b>' : ''}${esc(x.domain)}${i === 0 ? '</b>' : ''}</td><td class="r num">${n(x.organic_keywords)}</td><td class="r num">${n(x.organic_etv)}</td><td class="r num">${n(x.backlinks)}</td><td class="r num">${n(x.referring_domains)}</td><td class="r num">${n(x.domain_rank)}</td></tr>`).join('')}
  </tbody></table></div>` : `<p class="empty">${d.site.competitors.length ? 'Refresh competitor data to compare domains.' : 'Add competitor domains in data/sites.json.'}</p>`}

  ${d.gap.length ? `<h2>Keyword gap</h2><p class="sub">Keywords competitors rank in the top 20 for that you don't rank for at all.</p>
  <div class="wrap"><table class="data"><thead><tr><th>Keyword</th>${th('Volume', 'gapVolume', 'r')}${th('Who ranks', 'whoRanks')}</tr></thead><tbody>
  ${d.gap.slice(0, 40).map((k) => `<tr><td>${esc(k.keyword)}</td><td class="r num">${n(k.volume)}</td><td>${k.competitors.map((c) => `${esc(c.domain)} <span class="num">#${c.position}</span>`).join(', ')}</td></tr>`).join('')}
  </tbody></table></div>` : ''}

  ${d.jobs.length ? `<h2>Recent jobs</h2><p class="jobs">${d.jobs.map((j) => `<span class="${j.ok ? '' : 'fail'}">${esc(j.job)} ${dateShort(j.finished_at)}: ${esc(j.message)}</span>`).join('<br>')}</p>` : ''}`;
}

// ---- Shared articles: one article in, a localised version per brand, reviewed and approved before it goes out ----
const VSTATUS = {
  pending: ['Waiting', 'nc'], writing: ['Writing…', 'nc'], ready: ['To review', 'watch'], approved: ['Approved', 'good'],
  sent: ['Sent', 'good'], failed: ['Failed', 'problem'], skipped: ['Skipped', 'nc'],
};
const FIT = { strong: ['Strong fit', 'good'], ok: ['OK fit', 'watch'], weak: ['Weak fit', 'problem'] };
const vsig = (v) => {
  const [label, cls] = VSTATUS[v.status] || [v.status, 'nc'];
  const sent = v.status === 'sent' ? (v.cms.status === 'by hand' ? 'Posted by hand' : v.cms.status === 'publish' ? 'Published' : v.cms.status === 'future' ? 'Scheduled' : 'Draft in WordPress') : label;
  return `<span class="sig ${cls}">${sent}</span>`;
};
const sharedGuide = (warn) => `<details class="guide"><summary class="run">How shared articles avoid competing with each other</summary>
  <ul>
    <li><b>Each brand gets its own version, not a copy.</b> When the same text sits on several of our sites, Google picks one to show and filters the rest, so the copies earn almost nothing. Claude rewrites the opening, structure, examples, local FAQ and call to action around each brand’s towns and services.</li>
    <li><b>Swapping place names isn’t enough.</b> Google treats near-identical pages with only the town changed as spam (“scaled content”). The <i>Closest version</i> column measures how much text two versions share; over ${warn}% is flagged for more rewriting.</li>
    <li><b>Each version aims at a different search.</b> Claude picks the focus search from that brand’s own keyword research, Search Console and keyword gap, so the versions target what each site is missing.</li>
    <li><b>Word-for-word copies</b> (a group announcement, say) are better published once on the main site, with the other sites linking to it or using a canonical tag pointing to it, rather than localised.</li>
    <li><b>Stagger publishing</b> over a few days to a few weeks rather than putting every version live on the same day.</li>
  </ul></details>`;

async function renderArticles() {
  const { articles, brands } = await api('/articles');
  const groups = [...new Set(brands.map((b) => b.group))];
  $('#main').innerHTML = `<h1>Articles</h1><p class="sub">Paste in one article and Claude writes a version for each brand you pick, using its towns, region and services, and aimed at searches its website is missing. You review, edit and approve each version before it goes to the website. Nothing is published without someone choosing to.</p>
  ${sharedGuide(40)}
  ${claudeOn ? `<h2>New article</h2>
  <form class="post-form art-form" onsubmit="return newArticle(event)">
    <label class="fld"><span>Title</span><input name="title" type="text" maxlength="300" required placeholder="e.g. Keeping your dog safe from 1080 and other poisons"></label>
    <label class="fld"><span>Article</span><textarea name="body" rows="12" maxlength="60000" required placeholder="Paste the full article here. Headings and lists can stay as they are."></textarea></label>
    <label class="fld"><span>Notes for Claude <small class="muted">(optional)</small></span><input name="notes" type="text" maxlength="2000" placeholder="e.g. keep the vaccination schedule exactly as written; aim at dog owners"></label>
    <h3>Brands</h3>
    ${groups.map((g) => `<div class="art-group"><div class="art-group-head"><b>${esc(g)}</b> <a class="muted" href="#" onclick="return tickGroup(this, true)">all</a> · <a class="muted" href="#" onclick="return tickGroup(this, false)">none</a></div>
      <div class="chans">${brands.filter((b) => b.group === g).map((b) => `<label><input type="checkbox" name="site" value="${esc(b.slug)}"> ${badge(b.slug, b.name, 'xs')} ${esc(b.name)} <small class="muted">${esc(b.route.label)}${b.route.push ? ' · sends from here' : ''}</small></label>`).join('')}</div></div>`).join('')}
    <div class="actions"><button class="run primary-btn" type="submit">Write the versions</button><small class="muted">Claude writes three at a time, about a minute each.</small></div>
    <p class="cmt-err notok" hidden></p>
  </form>` : '<p class="empty">Writing versions with Claude needs an Anthropic API key (<code>ANTHROPIC_API_KEY</code>) set on the server.</p>'}
  <h2>Articles so far</h2>
  ${articles.length ? `<div class="wrap"><table class="data"><thead><tr><th>Article</th><th>Started</th><th class="r">Brands</th><th>Progress</th></tr></thead><tbody>
  ${articles.map((a) => `<tr><td><a href="#/article/${a.id}"><b>${esc(a.title)}</b></a></td><td><small class="muted">${dateShort(a.created_at)}${a.created_by ? ` · ${esc(a.created_by)}` : ''}</small></td><td class="r num">${a.brands}</td>
    <td>${[['writing', 'writing', 'nc'], ['ready', 'to review', 'watch'], ['approved', 'approved', 'good'], ['sent', 'sent', 'good'], ['failed', 'failed', 'problem']].filter(([k]) => a[k]).map(([k, l, c]) => `<span class="sig ${c}">${a[k]} ${l}</span>`).join(' ') || dash}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="empty">No articles yet.</p>'}`;
}
function tickGroup(a, on) { a.closest('.art-group').querySelectorAll('input[type=checkbox]').forEach((x) => { x.checked = on; }); return false; }
async function newArticle(ev) {
  ev.preventDefault();
  const f = ev.target, btn = f.querySelector('button[type=submit]'), err = f.querySelector('.cmt-err');
  const sites = [...f.querySelectorAll('input[name=site]:checked')].map((x) => x.value);
  err.hidden = true;
  if (!sites.length) { err.textContent = 'Pick at least one brand.'; err.hidden = false; return false; }
  btn.disabled = true; btn.textContent = 'Starting…';
  try { const a = await post('/articles', { title: f.title.value, body: f.body.value, notes: f.notes.value, sites }); location.hash = `#/article/${a.id}`; }
  catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Write the versions'; }
  return false;
}

const busyStatus = (v) => v.status === 'pending' || v.status === 'writing';
function articleTable(a) {
  return `<div class="wrap"><table class="data art-table"><thead><tr><th>Brand</th><th>Fit</th><th>Focus search</th>${th('Closest version', 'artSimilar', 'r')}${th('Checks', 'artChecks', 'r')}<th>Status</th><th>Website</th></tr></thead><tbody>
  ${a.versions.map((v) => { const c = v.similarity?.closest, ok = v.checks.filter((x) => x.ok).length; return `<tr>
    <td><a href="#v-${esc(v.site)}" onclick="return openVersion('${esc(v.site)}')"><div class="who">${badge(v.site, v.name, 'sm')}<b>${esc(v.name)}</b></div></a></td>
    <td>${v.fit ? `<span class="sig ${FIT[v.fit.rating][1]}" tabindex="0" data-tip="${esc(v.fit.note)}">${FIT[v.fit.rating][0]}</span>` : dash}</td>
    <td>${v.focusKeyword ? esc(v.focusKeyword) : dash}</td>
    <td class="r num ${c && c.pct > a.similarWarn ? 'notok' : ''}">${c ? `${c.pct}% <small class="muted">${esc(c.name)}</small>` : dash}</td>
    <td class="r num">${v.checks.length ? `${ok}/${v.checks.length}` : dash}</td>
    <td>${vsig(v)}</td>
    <td><small class="muted">${esc(v.route.label)}</small>${v.cms.link ? ` <a href="${esc(v.cms.link)}" target="_blank" rel="noopener">open ↗</a>` : ''}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}

function versionCard(a, v) {
  const head = `<summary><div class="who">${badge(v.site, v.name, 'sm')}<b>${esc(v.name)}</b> <small class="muted">${esc(v.host)}</small></div> ${vsig(v)}${v.fit ? ` <span class="sig ${FIT[v.fit.rating][1]}">${FIT[v.fit.rating][0]}</span>` : ''}</summary>`;
  const wrap = (body) => `<details class="vcard" id="v-${esc(v.site)}" data-site="${esc(v.site)}" data-status="${esc(v.status)}" data-updated="${esc(v.updated)}">${head}<div class="vbody">${body}</div></details>`;
  const again = `<form class="kw-form" onsubmit="return rewriteVersion(event)"><input class="draft-note" name="note" type="text" maxlength="500" placeholder="Anything to change? (optional), e.g. more on farm dogs, mention the Gore clinic">
    <button class="run" type="submit">Write again</button><p class="cmt-err notok" hidden></p></form>`;
  if (busyStatus(v)) return wrap(`<p class="empty">${v.status === 'writing' ? 'Claude is writing this version…' : 'Waiting its turn…'}</p>`);
  if (v.status === 'failed') return wrap(`<p class="notok">${esc(v.error || 'Something went wrong.')}</p>${again}`);
  if (v.status === 'skipped') return wrap(`<p class="empty">Skipped: this brand won’t get the article. <button class="run" type="button" onclick="skipVersion(this,false)">Include it again</button></p><p class="cmt-err notok" hidden></p>`);
  const sim = v.similarity, c = sim?.closest;
  const list = (items, fn) => items?.length ? `<ul>${items.map(fn).join('')}</ul>` : '<p class="muted">None.</p>';
  const PRI = { high: 'problem', medium: 'watch', low: 'nc' };
  const approved = v.status === 'approved' || v.status === 'sent';
  return wrap(`
  ${v.fit && v.fit.rating !== 'strong' ? `<p class="ideas-summary">${esc(v.fit.note)}</p>` : ''}
  <div class="art-grid">
    <form class="art-edit" onsubmit="return saveVersion(event)">
      <label class="fld"><span>Title ${charCount(v.title || '', 60)}</span><input name="title" type="text" maxlength="300" value="${esc(v.title)}" oninput="countChars(this,60)"></label>
      <div class="fld-row"><label class="fld"><span>Focus search</span><input name="focusKeyword" type="text" maxlength="120" value="${esc(v.focusKeyword)}"></label>
        <label class="fld"><span>Web address</span><input name="slug" type="text" maxlength="80" value="${esc(v.slug)}"></label></div>
      <label class="fld"><span>Meta description ${charCount(v.metaDescription || '', 155)}</span><textarea name="metaDescription" rows="2" maxlength="400" oninput="countChars(this,155)">${esc(v.metaDescription)}</textarea></label>
      <div class="fld"><span>Article <small class="muted">click into the text to edit it</small></span><div class="art-body" contenteditable="true">${v.bodyHtml || ''}</div></div>
      <div class="actions"><button class="run" type="submit">Save changes</button>
        ${v.status === 'ready' ? '<button class="run primary-btn" type="button" onclick="approveVersion(this,true)">Approve</button>' : approved && v.status === 'approved' ? '<button class="run" type="button" onclick="approveVersion(this,false)">Take back approval</button>' : ''}
        ${v.status !== 'sent' ? '<button class="run" type="button" onclick="skipVersion(this,true)">Skip this brand</button>' : ''}
        <small class="muted">${v.edited ? 'Edited' : 'Written by Claude'} ${dateShort(v.updated)}${v.approvedBy ? ` · approved by ${esc(v.approvedBy)}` : ''}</small></div>
      <p class="cmt-err notok" hidden></p>
    </form>
    <div class="art-side">
      <h4>${tip('Checks', 'artChecks')}</h4>
      <ul class="checks">${v.checks.map((x) => `<li>${x.ok ? '<span class="ok">✓</span>' : '<span class="notok">✗</span>'} ${x.tip ? `<span tabindex="0" data-tip="${esc(x.tip)}">${esc(x.label)}</span>` : esc(x.label)}</li>`).join('')}
        ${c ? `<li>${c.pct > a.similarWarn ? '<span class="notok">✗</span>' : '<span class="ok">✓</span>'} ${tip(`${c.pct}% shared with ${esc(c.name)}`, 'artSimilar')}</li>` : ''}
        ${sim?.source != null ? `<li><span class="muted">·</span> ${tip(`${sim.source}% shared with the original`, 'artSource')}</li>` : ''}</ul>
      <h4>SEO holes it helps fill</h4>${list(v.gaps, (g) => `<li><b>${esc(g.topic)}</b>: ${esc(g.how)}<br><small class="muted">${esc(g.evidence)}</small></li>`)}
      <h4>Changes to make on the website</h4>${list(v.siteChanges, (g) => `<li><span class="sig ${PRI[g.priority]}">${esc(g.priority)}</span> <b>${esc(g.change)}</b><br><small class="muted">${esc(g.why)}</small></li>`)}
      <h4>What Claude changed for this brand</h4>${list(v.localised, (x) => `<li>${esc(x)}</li>`)}
    </div>
  </div>
  <h3>Put it on the website</h3>${publishBlock(v)}
  <details class="kw-again"><summary class="run">Write this version again</summary>${again}</details>`);
}

function publishBlock(v) {
  const r = v.route, approved = v.status === 'approved' || v.status === 'sent';
  const sent = v.status === 'sent' ? `<p><span class="ok">✓</span> ${v.cms.status === 'by hand' ? 'Marked as posted by hand' : `Sent to WordPress as ${v.cms.status === 'publish' ? 'a published post' : v.cms.status === 'future' ? 'a scheduled post' : 'a draft'}`} ${dateShort(v.sentAt)}${v.sentBy ? ` by ${esc(v.sentBy)}` : ''}.${v.cms.link ? ` <a href="${esc(v.cms.link)}" target="_blank" rel="noopener">Open it ↗</a>` : ''}</p>` : '';
  const resent = v.status === 'ready' && v.cms.id ? '<p class="muted">Changed since it was sent. Approve it again to update the post in WordPress.</p>' : '';
  if (!approved) return `${resent}<p class="empty">Approve this version first.</p>`;
  const copy = `<div class="actions"><button class="run" type="button" onclick="copyVersion(this,'title')">Copy title</button><button class="run" type="button" onclick="copyVersion(this,'body')">Copy article</button><button class="run" type="button" onclick="copyVersion(this,'meta')">Copy meta description</button></div>`;
  if (!r.push) return `${sent}<p class="sub">${esc(r.note)}</p>${copy}${v.status !== 'sent' ? '<div class="actions"><button class="run" type="button" onclick="sendVersion(this,\'manual\')">Mark as posted</button></div><p class="cmt-err notok" hidden></p>' : ''}`;
  return `${sent}<form class="kw-form send-form" onsubmit="return sendVersion(event)">
    <select name="mode" onchange="this.form.date.hidden = this.value !== 'future'">
      <option value="draft">As a draft in WordPress (someone publishes it there)</option>
      <option value="future">Scheduled for a date</option>
      <option value="publish">Published now</option></select>
    <input name="date" type="datetime-local" hidden>
    <button class="run primary-btn" type="submit">${v.cms.id ? 'Update in WordPress' : 'Send to WordPress'}</button><p class="cmt-err notok" hidden></p></form>${copy}`;
}

let articlePoll = null;
async function renderArticle(id) {
  clearTimeout(articlePoll);
  const a = await api(`/articles/${id}`);
  $('#main').innerHTML = `<p class="crumb"><a href="#/articles">← Articles</a></p><h1>${esc(a.title)}</h1>
  <p class="sub">Started ${dateShort(a.created)}${a.by ? ` by ${esc(a.by)}` : ''}. Review each brand’s version, edit it if you like, approve it, then send it to the website.</p>
  <details class="guide"><summary class="run">The original article</summary><div class="art-source">${esc(a.body).replace(/\n/g, '<br>')}</div>${a.notes ? `<p class="muted">Notes: ${esc(a.notes)}</p>` : ''}</details>
  ${sharedGuide(a.similarWarn)}
  <div id="art-table">${articleTable(a)}</div>
  <div class="vcards" data-article="${a.id}">${a.versions.map((v) => versionCard(a, v)).join('')}</div>`;
  const first = a.versions.find((v) => v.status === 'ready') || a.versions.find((v) => !busyStatus(v));
  if (first) document.getElementById(`v-${first.site}`).open = true;
  pollArticle(a);
}
// While versions are being written, check back every few seconds and redraw only the ones that changed, so edits
// someone is making to a finished version aren't lost.
function pollArticle(a) {
  if (!a.versions.some(busyStatus)) return;
  articlePoll = setTimeout(async () => {
    if (location.hash !== `#/article/${a.id}`) return;
    try { const next = await api(`/articles/${a.id}`); refreshArticle(next); pollArticle(next); } catch { pollArticle(a); }
  }, 5000);
}
function refreshArticle(a) {
  $('#art-table').innerHTML = articleTable(a);
  for (const v of a.versions) {
    const card = document.getElementById(`v-${v.site}`);
    if (!card) { document.querySelector('.vcards').insertAdjacentHTML('beforeend', versionCard(a, v)); continue; }
    if (card.dataset.status !== v.status || card.dataset.updated !== v.updated) { const open = card.open; card.outerHTML = versionCard(a, v); document.getElementById(`v-${v.site}`).open = open; }
  }
}
const vpath = (el) => `/articles/${el.closest('.vcards').dataset.article}/versions/${el.closest('.vcard').dataset.site}`;
async function vAction(el, path, body) {
  const card = el.closest('.vcard'), err = card.querySelector('.cmt-err');
  if (err) err.hidden = true;
  el.disabled = true;
  try { const r = await post(`${vpath(el)}${path}`, body); refreshArticle(r.article); const c = document.getElementById(card.id); c.open = true; pollArticle(r.article); return r; }
  catch (e) { if (err) { err.textContent = e.message; err.hidden = false; } else alert(e.message); el.disabled = false; return null; }
}
const editFields = (f) => ({ title: f.title.value, slug: f.slug.value, focusKeyword: f.focusKeyword.value, metaDescription: f.metaDescription.value, bodyHtml: f.querySelector('.art-body').innerHTML });
function saveVersion(ev) { ev.preventDefault(); vAction(ev.target.querySelector('button[type=submit]'), '', editFields(ev.target)); return false; }
async function approveVersion(btn, on) {
  const f = btn.closest('form');
  // Save any edits first, so what's approved is what's on screen.
  if (on) { btn.disabled = true; try { await post(vpath(btn), editFields(f)); } catch (e) { const err = f.querySelector('.cmt-err'); err.textContent = e.message; err.hidden = false; btn.disabled = false; return; } }
  vAction(btn, '/approve', { approved: on });
}
function skipVersion(btn, on) { vAction(btn, '/skip', { skip: on }); }
function rewriteVersion(ev) {
  ev.preventDefault();
  if (ev.target.closest('.vcard').dataset.status !== 'failed' && !confirm('Write this version again? Your edits to it will be replaced.')) return false;
  vAction(ev.target.querySelector('button'), '/rewrite', { note: ev.target.note.value });
  return false;
}
async function sendVersion(evOrBtn, manual) {
  if (manual) { vAction(evOrBtn, '/send', { mode: 'manual' }); return false; }
  evOrBtn.preventDefault();
  const f = evOrBtn.target, mode = f.mode.value, host = f.closest('.vcard').querySelector('summary small').textContent;
  let date = null;
  if (mode === 'future') {
    if (!f.date.value) { f.date.hidden = false; f.date.focus(); return false; }
    date = new Date(f.date.value).toISOString();
    if (!confirm(`Schedule this on ${host} for ${new Date(date).toLocaleString()}? It goes live by itself at that time.`)) return false;
  }
  if (mode === 'publish' && !confirm(`Publish this on ${host} now? It goes live straight away.`)) return false;
  const btn = f.querySelector('button'); btn.textContent = 'Sending…';
  const r = await vAction(btn, '/send', { mode, date });
  if (!r) btn.textContent = 'Send to WordPress';
  return false;
}
async function copyVersion(btn, what) {
  const card = btn.closest('.vcard'), body = card.querySelector('.art-body');
  try {
    if (what === 'body') {
      // Rich copy, so pasting into Rocketspark, Wix or Silverstripe keeps the headings and lists.
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body.innerHTML], { type: 'text/html' }), 'text/plain': new Blob([body.innerText], { type: 'text/plain' }) })]);
    } else await navigator.clipboard.writeText(card.querySelector(what === 'title' ? 'input[name=title]' : 'textarea[name=metaDescription]').value);
  } catch { /* clipboard blocked */ }
  const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 1500);
}
function openVersion(site) { const c = document.getElementById(`v-${site}`); if (c) { c.open = true; c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return false; }
function countChars(el, max) { const s = el.closest('label').querySelector('small'); s.textContent = `${el.value.length}/${max}`; s.className = el.value.length > max ? 'notok' : 'muted'; }
Object.assign(window, { newArticle, tickGroup, saveVersion, approveVersion, skipVersion, rewriteVersion, sendVersion, copyVersion, openVersion, countChars });

// ---- Settings: connections, appearance, report emails and scheduled reports ----
// Dark mode is a per-browser preference; index.html applies it before the page draws so there's no flash.
const THEME_KEY = 'seo-desk-theme';
const themePref = () => { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; } };
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(pref = themePref()) {
  document.documentElement.dataset.theme = pref === 'dark' || (pref === 'auto' && darkQuery.matches) ? 'dark' : 'light';
}
darkQuery.addEventListener('change', () => applyTheme());
function setTheme(pref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch {}
  applyTheme(pref);
  document.querySelectorAll('.theme-pick button').forEach((b) => { const on = b.dataset.theme === pref; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
}

let settings = null;
const CONN_STATE = { on: ['Working', 'good'], partial: ['Partly connected', 'watch'], error: ['Failing', 'problem'], off: ['Not set up', 'nc'] };
const codes = (vars) => vars.map((v) => `<code>${esc(v)}</code>`).join(' ');
function connCard(c) {
  const [label, cls] = CONN_STATE[c.state];
  return `<div class="conn ${c.state}">
    <div class="conn-head"><b>${esc(c.name)}</b><span class="sig ${cls}">${label}</span></div>
    <p class="conn-what">${esc(c.what)}</p>
    <p>${esc(c.detail)}</p>
    ${c.coverage ? `<p><b>${esc(c.coverage)}</b></p>` : ''}
    ${c.missing.length ? `<details class="conn-more"><summary>Not linked yet (${c.missing.length})</summary><p class="muted">${c.missing.map(esc).join(', ')}</p></details>` : ''}
    ${c.lastError ? `<p class="notok small">Latest problem ${ago(c.lastError.at)}${c.lastError.site && c.lastError.site !== 'all' ? ` (${esc(c.lastError.site)})` : ''}: ${esc(c.lastError.message)}</p>` : ''}
    ${c.lastOk ? `<p class="muted small">Last worked ${ago(c.lastOk)}</p>` : ''}
    ${c.vars.length ? `<p class="conn-vars small">${c.state === 'off' ? 'To switch on, set' : 'Still to set'} ${codes(c.vars)}</p>` : ''}
  </div>`;
}

const emailSoon = (d) => d.email.ready ? '' : `<p class="notice"><span class="sig watch">Coming soon</span> Sending needs an email account: set ${codes(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'])} on the server (the README has Gmail and Microsoft 365 settings). You can set reports up and preview them now; they start going out once it’s set.</p>`;

function recipientsBlock(d) {
  return `<p class="sub">The address book for reports. Ticked addresses also get the weekly digest${(() => { const t = cronText(d.schedules.find((s) => s.job === 'digest')?.cron || ''); return t ? `, sent ${esc(t)}` : ''; })()}.</p>
  ${d.recipients.length ? `<div class="wrap"><table class="data rcpts"><thead><tr><th>Email</th><th>Name</th><th>Weekly digest</th><th></th></tr></thead><tbody>
    ${d.recipients.map((r, i) => `<tr><td>${esc(r.email)}</td><td>${esc(r.name) || '<span class="muted">—</span>'}</td>
      <td><label><input type="checkbox" ${r.digest ? 'checked' : ''} onchange="toggleDigest(${i}, this.checked)"> gets it</label></td>
      <td class="r"><button class="run" type="button" onclick="removeRecipient(${i})">Remove</button></td></tr>`).join('')}
  </tbody></table></div>` : '<p class="empty">No addresses yet.</p>'}
  ${d.envRecipients.length ? `<p class="muted small">Also gets the digest, set on the server in <code>DIGEST_TO</code>: ${d.envRecipients.map(esc).join(', ')}</p>` : ''}
  <form class="post-form rcpt-form" onsubmit="return addRecipient(event)">
    <div class="fld-row"><label class="fld"><span>Email</span><input name="email" type="email" required placeholder="name@comhlavet.com"></label>
    <label class="fld"><span>Name <small class="muted">(optional)</small></span><input name="name" type="text" maxlength="80"></label></div>
    <div class="actions"><label><input name="digest" type="checkbox" checked> Send them the weekly digest</label><button class="run primary-btn" type="submit">Add address</button></div>
    <p class="cmt-err notok" hidden></p>
  </form>`;
}
async function saveRecipientList(list, errEl) {
  try { settings.recipients = await post('/settings/recipients', { recipients: list }); await renderSettings(); }
  catch (e) { if (errEl) { errEl.textContent = e.message; errEl.hidden = false; } else alert(e.message); }
}
function addRecipient(ev) {
  ev.preventDefault();
  const f = ev.target;
  saveRecipientList([...settings.recipients, { email: f.email.value, name: f.name.value, digest: f.digest.checked }], f.querySelector('.cmt-err'));
  return false;
}
function toggleDigest(i, on) { saveRecipientList(settings.recipients.map((r, k) => k === i ? { ...r, digest: on } : r)); }
function removeRecipient(i) { saveRecipientList(settings.recipients.filter((_, k) => k !== i)); }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const nth = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
function reportCovers(r) {
  const b = r.sites.includes('*') ? 'All brands' : r.sites.length ? `${r.sites.length} brand${r.sites.length === 1 ? '' : 's'}` : '';
  const c = r.clinics.length ? `${r.clinics.length} clinic${r.clinics.length === 1 ? '' : 's'}` : '';
  return [b, c].filter(Boolean).join(' + ');
}
function reportsBlock(d) {
  const label = Object.fromEntries(d.sections.map((s) => [s.key, s.label]));
  return `<p class="sub">Email a chosen set of brands or clinics, with just the parts you pick, on a schedule.</p>${emailSoon(d)}
  ${d.reports.length ? `<div class="wrap"><table class="data reports"><thead><tr><th>Report</th><th>Covers</th><th>When</th><th>Sends to</th><th>Last sent</th><th></th></tr></thead><tbody>
  ${d.reports.map((r) => `<tr class="${r.enabled ? '' : 'paused'}">
    <td><b>${esc(r.name)}</b><small class="muted">${r.sections.map((k) => esc(label[k] || k)).join(', ')}</small></td>
    <td>${reportCovers(r)}</td>
    <td>${r.enabled ? esc(r.when) : '<span class="sig nc">Paused</span>'}${r.enabled && r.next ? `<small class="muted">Next ${new Date(r.next).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric' })}</small>` : ''}</td>
    <td><span tabindex="0" data-tip="${esc(r.recipients.join(', '))}">${r.recipients.length} address${r.recipients.length === 1 ? '' : 'es'}</span></td>
    <td>${r.last_sent_at ? ago(r.last_sent_at) : '<span class="muted">Not yet</span>'}${r.last_ok === false ? `<small class="notok">${esc(r.last_result)}</small>` : ''}</td>
    <td class="r rep-acts"><button class="run" type="button" onclick="editReport(${r.id})">Edit</button><button class="run" type="button" onclick="previewReport(${r.id})">Preview</button>
      <button class="run" type="button" onclick="sendReportNow(this, ${r.id})" ${d.email.ready ? '' : `disabled data-tip="${esc('Needs email sending set up first (SMTP_HOST).')}"`}>Send now</button>
      <button class="run" type="button" onclick="pauseReport(${r.id}, ${!r.enabled})">${r.enabled ? 'Pause' : 'Resume'}</button><button class="run" type="button" onclick="deleteReport(${r.id})">Delete</button></td>
  </tr>`).join('')}</tbody></table></div>` : '<p class="empty">No scheduled reports yet.</p>'}
  <div class="actions"><button class="run primary-btn" type="button" onclick="editReport()">New report</button></div>
  <div id="report-form"></div>`;
}

function reportForm(d, r) {
  r ||= { name: '', sites: [], clinics: [], sections: ['summary', 'clinics'], frequency: 'weekly', weekday: 1, monthday: 1, hour: 8, recipients: d.recipients.map((x) => x.email) };
  const groups = [...new Set(d.brands.map((b) => b.group))];
  const all = r.sites.includes('*');
  const opt = (v, l, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`;
  const extra = r.recipients.filter((e) => !d.recipients.some((x) => x.email === e));
  const sectionBox = (s) => `<label data-tip="${esc(s.hint)}"><input type="checkbox" name="section" value="${s.key}" ${r.sections.includes(s.key) ? 'checked' : ''}> ${esc(s.label)}</label>`;
  return `<form class="post-form art-form rep-form" onsubmit="return saveReportForm(event, ${r.id || 'null'})">
    <h3>${r.id ? `Edit “${esc(r.name)}”` : 'New report'}</h3>
    <label class="fld"><span>Name</span><input name="name" type="text" maxlength="120" required value="${esc(r.name)}" placeholder="e.g. VetSouth clinics weekly"></label>
    <h4>Brands</h4>
    <label class="all-brands"><input type="checkbox" name="all" ${all ? 'checked' : ''} onchange="this.form.querySelectorAll('input[name=site]').forEach((x) => { x.disabled = this.checked; })"> <b>All brands</b>, including any added later</label>
    ${groups.map((g) => `<div class="art-group"><div class="art-group-head"><b>${esc(g)}</b> <a class="muted" href="#" onclick="return tickGroup(this, true)">all</a> · <a class="muted" href="#" onclick="return tickGroup(this, false)">none</a></div>
      <div class="chans">${d.brands.filter((b) => b.group === g).map((b) => `<label><input type="checkbox" name="site" value="${esc(b.slug)}" ${r.sites.includes(b.slug) ? 'checked' : ''} ${all ? 'disabled' : ''}> ${badge(b.slug, b.name, 'xs')} ${esc(b.name)}</label>`).join('')}</div></div>`).join('')}
    <h4>Clinics <small class="muted">A brand ticked above already includes all its clinics. Pick single clinics here.</small></h4>
    ${d.brands.filter((b) => b.clinics.length).map((b) => { const n = b.clinics.filter((c) => r.clinics.includes(`${b.slug}/${c.slug}`)).length;
      return `<details class="art-group clinic-pick" ${n ? 'open' : ''}><summary class="art-group-head">${badge(b.slug, b.name, 'xs')} <b>${esc(b.name)}</b> <span class="muted">${b.clinics.length} clinic${b.clinics.length === 1 ? '' : 's'}${n ? `, ${n} picked` : ''}</span></summary>
      <div class="art-group-head"><a class="muted" href="#" onclick="return tickGroup(this, true)">all</a> · <a class="muted" href="#" onclick="return tickGroup(this, false)">none</a></div>
      <div class="chans">${b.clinics.map((c) => `<label><input type="checkbox" name="clinic" value="${esc(`${b.slug}/${c.slug}`)}" ${r.clinics.includes(`${b.slug}/${c.slug}`) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div></details>`; }).join('')}
    <h4>What to include</h4>
    <div class="chans"><span class="muted">For each brand:</span> ${d.sections.filter((s) => s.scope === 'brand').map(sectionBox).join('')}</div>
    <div class="chans"><span class="muted">For the clinics:</span> ${d.sections.filter((s) => s.scope === 'clinic').map(sectionBox).join('')}</div>
    <h4>When</h4>
    <div class="send-form when" data-freq="${r.frequency}">
      <select name="frequency" onchange="this.parentNode.dataset.freq = this.value">${opt('daily', 'Every day', r.frequency)}${opt('weekly', 'Every week', r.frequency)}${opt('monthly', 'Every month', r.frequency)}</select>
      <select name="weekday" class="w">${DAY_NAMES.map((n, i) => opt(i, `on ${n}`, r.weekday)).join('')}</select>
      <select name="monthday" class="m">${Array.from({ length: 28 }, (_, i) => opt(i + 1, `on the ${nth(i + 1)}`, r.monthday)).join('')}</select>
      <select name="hour">${Array.from({ length: 24 }, (_, h) => opt(h, `at ${hourLabel(h)}`, r.hour)).join('')}</select>
    </div>
    <h4>Send to</h4>
    ${d.recipients.length ? `<div class="chans">${d.recipients.map((x) => `<label><input type="checkbox" name="to" value="${esc(x.email)}" ${r.recipients.includes(x.email) ? 'checked' : ''}> ${esc(x.name || x.email)}${x.name ? ` <small class="muted">${esc(x.email)}</small>` : ''}</label>`).join('')}</div>` : ''}
    <label class="fld"><span>${d.recipients.length ? 'Other addresses' : 'Addresses'} <small class="muted">separate with commas</small></span><input name="extra" type="text" value="${esc(extra.join(', '))}" placeholder="someone@example.com"></label>
    <div class="actions"><button class="run primary-btn" type="submit">${r.id ? 'Save changes' : 'Save report'}</button><button class="run" type="button" onclick="previewReport(null, this.form)">Preview</button><button class="run" type="button" onclick="$('#report-form').innerHTML = ''">Cancel</button></div>
    <p class="cmt-err notok" hidden></p>
  </form>`;
}
function reportBody(f) {
  const vals = (name) => [...f.querySelectorAll(`input[name=${name}]:checked`)].map((x) => x.value);
  return { name: f.name.value, sites: f.all.checked ? ['*'] : vals('site'), clinics: vals('clinic'), sections: vals('section'),
    frequency: f.frequency.value, weekday: f.weekday.value, monthday: f.monthday.value, hour: f.hour.value,
    recipients: [...vals('to'), ...f.extra.value.split(/[,;\s]+/).filter(Boolean)] };
}
function editReport(id) {
  const box = $('#report-form');
  box.innerHTML = reportForm(settings, id ? settings.reports.find((r) => r.id === id) : null);
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  box.querySelector('input[name=name]').focus({ preventScroll: true });
}
async function saveReportForm(ev, id) {
  ev.preventDefault();
  const f = ev.target, btn = f.querySelector('button[type=submit]'), err = f.querySelector('.cmt-err');
  btn.disabled = true; err.hidden = true;
  try { await post(id ? `/reports/${id}` : '/reports', reportBody(f)); await renderSettings(); $('h2#reports')?.scrollIntoView({ block: 'start' }); }
  catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; }
  return false;
}
// Opens the window straight away (inside the click, so it isn't blocked) and fills it once the report is built.
async function previewReport(id, form) {
  const w = window.open('', '_blank');
  const body = form ? reportBody(form) : settings.reports.find((r) => r.id === id);
  try {
    const { subject, html } = await post('/reports/preview', body);
    if (w) { w.document.open(); w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(subject)}</title><body style="margin:24px;background:#fff">${html}</body>`); w.document.close(); }
  } catch (e) {
    w?.close();
    const err = form?.querySelector('.cmt-err'); if (err) { err.textContent = e.message; err.hidden = false; } else alert(e.message);
  }
}
async function sendReportNow(btn, id) {
  btn.disabled = true; btn.textContent = 'Sending…';
  try { await post(`/reports/${id}/send`); } catch (e) { alert(e.message); }
  await renderSettings();
}
async function pauseReport(id, on) { try { await post(`/reports/${id}/enabled`, { enabled: on }); } catch (e) { alert(e.message); } await renderSettings(); }
async function deleteReport(id) {
  const r = settings.reports.find((x) => x.id === id);
  if (!confirm(`Delete the report “${r?.name}”? It stops being sent.`)) return;
  try { await api(`/reports/${id}`, { method: 'DELETE' }); } catch (e) { alert(e.message); }
  await renderSettings();
}

async function renderSettings() {
  const d = settings = await api('/settings');
  const working = d.connections.filter((c) => c.state === 'on' || c.state === 'partial').length;
  const pref = themePref();
  const themeBtn = (v, l) => `<button type="button" role="radio" data-theme="${v}" class="${pref === v ? 'on' : ''}" aria-checked="${pref === v}" onclick="setTheme('${v}')">${l}</button>`;
  $('#main').innerHTML = `<h1>Settings</h1><p class="sub">What the dashboard is connected to, how it looks, and who gets emailed what.</p>
  <h2 id="connections">Connections</h2>
  <p class="sub">${working} of ${d.connections.length} connected. Server settings are variables on Railway (the SEO-DESK service → Variables); it redeploys by itself after a change.</p>
  <div class="conns">${d.connections.map(connCard).join('')}</div>
  <h2 id="appearance">Appearance</h2>
  <div class="theme-pick" role="radiogroup" aria-label="Colour theme">${themeBtn('light', '☀️ Light')}${themeBtn('dark', '🌙 Dark')}${themeBtn('auto', '🖥️ Match this device')}</div>
  <p class="muted small">Saved in this browser, so each person picks their own.</p>
  <h2 id="addresses">Report email addresses</h2>
  ${recipientsBlock(d)}
  <h2 id="reports">Scheduled reports</h2>
  ${reportsBlock(d)}
  <h2 id="schedule">Automatic updates</h2>
  <p class="sub">When the dashboard fetches new data, in New Zealand time. Each one can be changed with its <code>CRON_</code> variable on the server.</p>
  <div class="wrap"><table class="data"><thead><tr><th>What</th><th>Schedule</th></tr></thead><tbody>
  ${d.schedules.map((s) => `<tr><td>${esc(s.label)}</td><td><code>${esc(s.cron)}</code> <span class="muted">${esc(cronText(s.cron))}</span></td></tr>`).join('')}
  </tbody></table></div>`;
}
// Reads the common cron shapes aloud ("Mondays at 2am"); anything else just shows the code.
function cronText(c) {
  const [m, h, dom, , dow] = c.trim().split(/\s+/);
  const at = /^\d+$/.test(h) && /^\d+$/.test(m) ? `at ${Number(h) % 12 || 12}${m !== '0' ? `:${m.padStart(2, '0')}` : ''}${Number(h) < 12 ? 'am' : 'pm'}` : '';
  if (/^\*\/\d+$/.test(m) && h === '*') return `every ${m.slice(2)} minutes`;
  if (/^\d+$/.test(m) && /^\*\/\d+$/.test(h)) return `every ${h.slice(2)} hours`;
  if (/^\d+$/.test(m) && h === '*') return 'every hour';
  if (!at) return '';
  if (dom === '*' && dow === '*') return `daily ${at}`;
  if (dom === '*' && /^\d$/.test(dow)) return `${DAY_NAMES[Number(dow) % 7]}s ${at}`;
  if (/^\d+$/.test(dom) && dow === '*') return `monthly on the ${nth(Number(dom))} ${at}`;
  return '';
}
Object.assign(window, { setTheme, addRecipient, toggleDigest, removeRecipient, editReport, saveReportForm, previewReport, sendReportNow, pauseReport, deleteReport });

// One floating tooltip for every [data-tip] element. It lives on <body> so table overflow can't clip it.
function initTips() {
  const box = document.createElement('div'); box.className = 'tipbox'; box.setAttribute('role', 'tooltip'); document.body.append(box);
  let cur = null;
  const hide = () => { cur = null; box.classList.remove('on'); };
  const show = (t) => {
    if (t === cur) return; cur = t; box.textContent = t.dataset.tip; box.style.left = box.style.top = '0'; box.classList.add('on');
    const r = t.getBoundingClientRect(), b = box.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left + r.width / 2 - b.width / 2, innerWidth - b.width - 8));
    const top = r.bottom + 8 + b.height > innerHeight - 8 ? r.top - b.height - 8 : r.bottom + 8;
    box.style.left = `${left}px`; box.style.top = `${top}px`;
  };
  document.addEventListener('mouseover', (e) => { const t = e.target.closest('[data-tip]'); const f = document.activeElement; t ? show(t) : f?.dataset?.tip ? show(f) : hide(); });
  document.addEventListener('focusin', (e) => { const t = e.target.closest('[data-tip]'); t ? show(t) : hide(); });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, true);
}

// Jump menu: a sticky row of chips under the header, one per section (h2) on the current page,
// rebuilt whenever #main is re-rendered. Uses buttons, not #anchors, because the hash is the router.
const JUMP_ICON = [[/connections/i, '🔌'], [/appearance/i, '🌓'], [/email address/i, '📬'], [/scheduled report/i, '🗓️'], [/automatic/i, '⏱️'],
  [/how people find/i, '🧭'], [/business profile|listing/i, '📍'], [/local search|map.pack/i, '🗺️'], [/review/i, '⭐'], [/sentiment/i, '🇳🇿'],
  [/site health/i, '🩺'], [/uptime/i, '🛟'], [/website/i, '🌐'], [/checklist/i, '✅'], [/keyword gap/i, '🕳️'], [/keyword/i, '🔑'], [/idea/i, '💡'], [/ai answer/i, '🤖'],
  [/social/i, '📣'], [/ads/i, '💸'], [/search performance/i, '📈'], [/within reach/i, '🎯'], [/rank/i, '🏆'], [/top quer/i, '🔍'],
  [/top pages/i, '📄'], [/clinic/i, '🏥'], [/competitor/i, '🥊'], [/job/i, '⚙️'], [/article/i, '📝'], [/supply/i, '🚚'], [/comhla/i, '🐾']];
const jumpIcon = (label) => JUMP_ICON.find(([re]) => re.test(label))?.[1] || '✨';
function initJump() {
  const nav = document.createElement('nav'); nav.className = 'jump'; nav.id = 'jump'; nav.setAttribute('aria-label', 'Jump to a section'); nav.hidden = true;
  $('.top').append(nav);
  let heads = [], cur = -1;
  const offset = () => $('.top').offsetHeight + 16;
  const label = (h) => { const c = h.cloneNode(true); c.querySelectorAll('.sig, .count, .ti').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
  const mark = () => {
    const y = offset() + 8; let i = -1;
    heads.forEach((h, k) => { if (h.getBoundingClientRect().top <= y) i = k; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) i = heads.length - 1;
    const max = document.documentElement.scrollHeight - innerHeight;
    $('.top').style.setProperty('--progress', max > 0 ? `${Math.min(100, (scrollY / max) * 100)}%` : '0%');
    if (i === cur) return; cur = i;
    nav.querySelectorAll('.chip').forEach((b, k) => { b.classList.toggle('on', k === i); b.toggleAttribute('aria-current', k === i); });
    const on = nav.querySelector('.chip.on');
    if (on) nav.scrollTo({ left: on.offsetLeft - nav.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' });
  };
  const build = () => {
    heads = [...$('#main').querySelectorAll('h2')].filter((h) => h.getClientRects().length && label(h) && !h.closest('.art-body'));
    cur = -1; nav.hidden = heads.length < 2;
    nav.innerHTML = heads.map((h, k) => { const t = label(h); return `<button type="button" class="chip" data-k="${k}" style="--i:${k}"><span class="em" aria-hidden="true">${jumpIcon(t)}</span>${esc(t)}</button>`; }).join('');
    heads.forEach((h) => { h.style.scrollMarginTop = `${offset()}px`; });
    mark();
  };
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const h = heads[b.dataset.k], fold = h.closest('details.fold');
    if (fold && !fold.open) fold.open = true;
    h.style.scrollMarginTop = `${offset()}px`;
    h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash');
  });
  let tick = false;
  const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(() => { tick = false; mark(); }); } };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
  new MutationObserver(build).observe($('#main'), { childList: true });
  $('#main').addEventListener('toggle', build, true);
}

async function boot() {
  initTips();
  initJump();
  const [status, sites] = await Promise.all([api('/status'), api('/overview')]);
  $('#status').innerHTML = [['Search Console', status.searchConsole], ['DataForSEO', status.dataforseo], ['Business Profile', status.businessProfile], ['Meta', status.meta || 'soon'], ['Planable', status.planable || 'soon'], ['WP Umbrella', status.wpUmbrella || 'soon'], ['Email', status.email]]
    .map(([k, v]) => v === 'soon' ? `<span class="soon">${k} coming soon</span>` : `<span class="${v ? '' : 'off'}">${k} ${v ? 'on' : 'off'}</span>`).join('')
    + (status.dfsSpendUsd != null ? `<span title="DataForSEO spend this month against the cap">US$${status.dfsSpendUsd} / ${status.dfsCapUsd}</span>` : '')
    + (status.access ? `<span>${esc(status.user)}</span>` : status.preview ? '<span>Preview password</span>' : '<span class="off">No login</span>');
  const route = async () => {
    const slug = location.hash.replace(/^#\/?/, '');
    const tab = (s) => `<a href="#/${s.slug}" class="${s.slug === slug ? 'active' : ''}">${badge(s.slug, s.name, 'xs')}${esc(s.name)}</a>`;
    const dd = (title, list, cls = '') => { const cur = list.find((s) => s.slug === slug);
      return `<details class="dd${cls}${cur ? ' active' : ''}"><summary>${esc(cur ? cur.name : title)}</summary><div class="menu"><div class="menu-title">${esc(title)}</div>${list.map(tab).join('')}</div></details>`; };
    // Clinics sit under their brand in the menus; the brand's own page is the first link.
    const inBrand = (s) => slug === s.slug || slug.startsWith(`clinic/${s.slug}/`);
    const clinicLinks = (s) => s.clinics.map((c) => { const h = clinicHref(s.slug, c.slug);
      return `<a href="${h}" class="clinic${h === `#/${slug}` ? ' active' : ''}">${s.clinics.length === 1 ? 'Clinic page' : esc(c.name)}</a>`; }).join('');
    const brandDd = (s) => `<details class="dd home${inBrand(s) ? ' active' : ''}"><summary>${badge(s.slug, s.name, 'xs')}${esc(s.name)}</summary><div class="menu">
      <a href="#/${s.slug}" class="${slug === s.slug ? 'active' : ''}">${esc(s.name)} overview</a><div class="menu-title">Clinics</div>${clinicLinks(s)}</div></details>`;
    const groupDd = (title, list) => { const cur = list.find(inBrand);
      return `<details class="dd home${cur ? ' active' : ''}"><summary>${esc(cur ? cur.name : title)}</summary><div class="menu"><div class="menu-title">${esc(title)}</div>
      ${list.map((s) => tab(s) + clinicLinks(s)).join('')}</div></details>`; };
    // Home brands with several clinics get their own dropdown; brands with a "menu" in sites.json share one (Independent clinics); the rest are tabs.
    const home = sites.filter((s) => s.group === homeGroup), menus = [...new Set(home.map((s) => s.menu).filter(Boolean))];
    const others = [...new Set(sites.map((s) => s.group))].filter((g) => g !== homeGroup);
    const solo = home.filter((s) => !s.menu);
    $('#brands').innerHTML = solo.filter((s) => s.clinics.length > 1).sort((a, b) => b.clinics.length - a.clinics.length).map(brandDd).join('')
      + menus.map((m) => groupDd(m, home.filter((s) => s.menu === m))).join('')
      + `<div class="tabs">${solo.filter((s) => s.clinics.length <= 1).map(tab).join('')}</div>`
      + '<span class="gap"></span>'
      + others.map((g) => dd(g, sites.filter((s) => s.group === g))).join('')
      + `<a href="#/clinics" class="${slug === 'clinics' || slug.startsWith('clinic/') ? 'active' : ''} sep">All clinics</a>`
      + `<a href="#/comments" class="${slug.startsWith('comments') ? 'active' : ''}">Comments</a>`
      + `<a href="#/ads" class="${slug === 'ads' ? 'active' : ''}">Ads</a>`
      + `<a href="#/ai" class="${slug === 'ai' ? 'active' : ''}">AI answers</a>`
      + `<a href="#/articles" class="${slug === 'articles' || slug.startsWith('article/') ? 'active' : ''}">Articles</a>`;
    $('#brands .tabs a.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    $('#home').className = slug ? '' : 'active'; $('#portfolio').className = slug === 'portfolio' ? 'active' : ''; $('#settings').className = slug === 'settings' ? 'active' : '';
    try { slug.startsWith('comments') ? await renderComments(slug.split('/')[1]) : slug === 'clinics' ? await renderLocations() : slug.startsWith('clinic/') ? await renderClinic(...slug.split('/').slice(1, 3).map(decodeURIComponent)) : slug === 'ads' ? await renderAds() : slug === 'ai' ? await renderAi() : slug === 'articles' ? await renderArticles() : slug.startsWith('article/') ? await renderArticle(Number(slug.split('/')[1])) : slug === 'settings' ? await renderSettings() : slug === 'portfolio' ? await renderOverview() : slug ? await renderSite(slug) : await renderManagement(); }
    catch (e) { $('#main').innerHTML = `<p class="empty">Couldn't load that view: ${esc(e.message)}. <a href="#/">Back to portfolio</a></p>`; }
  };
  homeGroup = sites[0]?.group ?? null;
  claudeOn = Boolean(status.claude);
  homeSlug = sites.find((s) => s.group === homeGroup)?.slug ?? null;
  examples = await api('/reply-examples').catch(() => null);
  for (const s of sites) logos[s.slug] = s.logo;
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => { for (const d of document.querySelectorAll('details.dd[open]')) if (!d.contains(e.target)) d.open = false; });
  route();
}
boot();
