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

// ---- Facebook and Instagram ----
const PLATFORM = { facebook: 'Facebook', instagram: 'Instagram' };
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
  const s = d.social, c = d.connections.social;
  if (c === 'coming_soon') return socialPlaceholder(slug);
  if (c === 'not_connected') return `<h2>Facebook and Instagram</h2><p class="empty">Not connected. Add <code>"meta": { "pageId": "…" }</code> to this brand in sites.json and set <code>META_ACCESS_TOKEN</code>.</p>`;
  if (c === 'no_data') return `<h2>Facebook and Instagram</h2><p class="empty">No data yet. <button class="run" onclick="run('meta','${slug}')">Sync now</button></p>`;
  const tot = (k, which = 'last28') => s.platforms.reduce((a, p) => a + (p[which][k] || 0), 0);
  const has = (k) => s.platforms.some((p) => p.last28[k] != null);
  const fol = (p) => `<div><div class="v">${n(p.followers)}${delta(p.followers, p.prevFollowers)}</div><div class="l">${PLATFORM[p.platform]} followers${p.name ? ` · ${esc(p.name)}` : ''}</div></div>`;
  return `<h2>Facebook and Instagram</h2>
  <div class="strip">
    ${s.platforms.map(fol).join('')}
    <div><div class="v">${has('views') ? `${n(tot('views'))}${delta(tot('views'), tot('views', 'prev28'))}` : nc('No data yet')}</div><div class="l">Views, 28 days</div></div>
    <div><div class="v">${has('engagements') ? `${n(tot('engagements'))}${delta(tot('engagements'), tot('engagements', 'prev28'))}` : nc('No data yet')}</div><div class="l">Engagements, 28 days</div></div>
    <div><div class="v ${s.unansweredOld ? 'notok' : ''}">${s.unanswered}</div><div class="l">Comments waiting for a reply</div></div>
  </div>
  <div class="actions"><button class="run" onclick="run('meta','${slug}')">Sync Facebook and Instagram</button></div>
  ${d.comments.length ? `<h3>Comments</h3>${commentsList(d.comments, false)}` : '<p class="empty">No comments waiting.</p>'}
  ${s.posts.length ? `<h3>Recent posts</h3>${postsTable(s.posts.map((p) => `<tr><td>${platformTag(p.platform)} <small class="muted">${dateShort(p.created_at)}</small><br>${p.permalink ? `<a href="${esc(p.permalink)}" target="_blank" rel="noopener">${clip(p.message, 140) || '(no caption)'}</a>` : clip(p.message, 140)}</td>
    <td class="r num">${n(p.likes)}</td><td class="r num">${n(p.comments)}</td><td class="r num">${n(p.shares)}</td></tr>`).join(''))}` : ''}`;
}

const COMING_SOON = `<p class="sub">Followers, reach and engagement for each brand's Facebook Page and Instagram account, plus one inbox to read and reply to comments. This switches on once the Meta app and token are set up.</p>`;
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
  return `<h2>Facebook and Instagram <span class="sig nc">Coming soon</span></h2>${COMING_SOON}
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

  <h2>${tip('Website', 'brandWebsite')}</h2>
  <p class="sub"><a href="${esc(d.site.url)}" target="_blank" rel="noopener">${esc(d.site.host)}</a>${d.website.sharedWith > 1 ? `, shared by ${d.website.sharedWith} ${esc(d.site.name)} clinics` : ''}. <a href="#/${esc(d.site.slug)}">Open the brand page →</a></p>
  <div class="strip">
    <div><div class="v">${d.website.score != null ? `${d.website.score}<small>/100</small>${delta(d.website.score, d.website.prevScore)}` : nc('Not audited')}</div><div class="l">${tip('Audit score', 'auditScore')}</div></div>
    <div><div class="v">${d.website.errors != null ? d.website.errors : dash}</div><div class="l">${tip('Errors', 'errors')}</div></div>
    <div><div class="v">${d.website.clicks != null ? `${n(d.website.clicks)}${delta(d.website.clicks, d.website.prevClicks)}` : nc(d.connections.searchConsole === 'no_data' ? 'No data yet' : undefined)}</div><div class="l">${tip('Clicks from Google, 28 days', 'clicks')}</div></div>
  </div>`;
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
  if (!(await api('/status')).meta) {
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

async function renderManagement() {
  const groups = await api('/management');
  $('#main').innerHTML = `<h1>How things are going</h1><p class="sub">Search visibility and Google listings across the group, updated daily. Green is fine, amber needs a look, red needs a decision.</p>
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
}

async function renderOverview() {
  const sites = await api('/overview');
  const groups = [...new Set(sites.map((s) => s.group))];
  $('#main').innerHTML = `
  <h1>Portfolio</h1><p class="sub">Every brand, last 28 days. Open a brand for the detail.</p>
  ${groups.map((g) => groupBlock(g, sites.filter((s) => s.group === g).length, `
  <div class="wrap"><table class="ledger"><thead><tr>
    <th>Brand</th>${th('Audit score', 'auditScore')}${th('Errors', 'errors', 'num')}${th('Clicks', 'clicks', 'num')}${th('Impressions', 'impressions', 'num')}${th('Keywords in top 10', 'top10')}${th('Referring domains', 'referringDomains', 'num')}
  </tr></thead><tbody>${sites.filter((s) => s.group === g).map((s) => `<tr>
    <td class="brand"><div class="who">${badge(s.slug, s.name)}<div><a href="#/${s.slug}">${esc(s.name)}</a><small>${esc(s.host)}</small></div></div></td>
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
  ${d.connections.searchConsole === 'not_connected' ? '<p class="empty">Search Console is not connected for this brand. Add the service account to its property and set <code>gscProperty</code> in sites.json.</p>' : lineChart(g.daily)}

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

  ${socialSection(d, slug)}

  ${adsSection(d, slug)}

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

async function boot() {
  initTips();
  const [status, sites] = await Promise.all([api('/status'), api('/overview')]);
  $('#status').innerHTML = [['Search Console', status.searchConsole], ['DataForSEO', status.dataforseo], ['Business Profile', status.businessProfile], ['Meta', status.meta || 'soon'], ['Email', status.email]]
    .map(([k, v]) => v === 'soon' ? `<span class="soon">${k} coming soon</span>` : `<span class="${v ? '' : 'off'}">${k} ${v ? 'on' : 'off'}</span>`).join('')
    + (status.dfsSpendUsd != null ? `<span title="DataForSEO spend this month against the cap">US$${status.dfsSpendUsd} / ${status.dfsCapUsd}</span>` : '')
    + (status.access ? `<span>${esc(status.user)}</span>` : '<span class="off">No login</span>');
  const route = async () => {
    const slug = location.hash.replace(/^#\/?/, '');
    const tab = (s) => `<a href="#/${s.slug}" class="${s.slug === slug ? 'active' : ''}">${badge(s.slug, s.name, 'xs')}${esc(s.name)}</a>`;
    const others = [...new Set(sites.map((s) => s.group))].filter((g) => g !== homeGroup);
    $('#brands').innerHTML = `<div class="tabs">${sites.filter((s) => s.group === homeGroup).map(tab).join('')}</div>`
      + others.map((g) => { const list = sites.filter((s) => s.group === g), cur = list.find((s) => s.slug === slug);
        return `<details class="dd${cur ? ' active' : ''}"><summary>${esc(cur ? cur.name : g)}</summary><div class="menu"><div class="menu-title">${esc(g)}</div>${list.map(tab).join('')}</div></details>`; }).join('')
      + `<a href="#/clinics" class="${slug === 'clinics' || slug.startsWith('clinic/') ? 'active' : ''} sep">All clinics</a>`
      + `<a href="#/comments" class="${slug.startsWith('comments') ? 'active' : ''}">Comments</a>`
      + `<a href="#/ads" class="${slug === 'ads' ? 'active' : ''}">Ads</a>`;
    $('#brands .tabs a.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    $('#home').className = slug ? '' : 'active'; $('#portfolio').className = slug === 'portfolio' ? 'active' : '';
    try { slug.startsWith('comments') ? await renderComments(slug.split('/')[1]) : slug === 'clinics' ? await renderLocations() : slug.startsWith('clinic/') ? await renderClinic(...slug.split('/').slice(1, 3).map(decodeURIComponent)) : slug === 'ads' ? await renderAds() : slug === 'portfolio' ? await renderOverview() : slug ? await renderSite(slug) : await renderManagement(); }
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
