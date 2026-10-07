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

function lineChart(daily) {
  if (!daily.length) return '<p class="empty">No Search Console data yet.</p>';
  const w = 1000, h = 160, pad = 8;
  const line = (key, cls) => {
    const max = Math.max(...daily.map((d) => d[key])) || 1;
    return `<path class="${cls}" d="${daily.map((d, i) => `${i ? 'L' : 'M'}${(pad + i / (daily.length - 1) * (w - 2 * pad)).toFixed(1)},${(h - pad - d[key] / max * (h - 2 * pad)).toFixed(1)}`).join('')}"/>`;
  };
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Clicks and impressions over the last 90 days">${line('impressions', 'imp')}${line('clicks', 'clicks')}</svg>
  <p class="legend"><b>Clicks</b> and impressions, ${dateShort(daily[0].date)} to ${dateShort(daily[daily.length - 1].date)}</p>`;
}

const stars = (r) => r == null ? '<span class="dash">—</span>' : `<span class="num">${Number(r).toFixed(1)}</span> <span class="star">★</span>`;
const okmark = (v) => v ? '<span class="ok">✓</span>' : '<span class="notok">✗</span>';

function locationsTable(rows, showBrand) {
  if (!rows.length) return '';
  return `<div class="wrap"><table class="data"><thead><tr>${showBrand ? '<th>Brand</th>' : ''}${th('Clinic', 'clinic')}${th('Rating', 'rating')}${th('Reviews (30d)', 'reviews30', 'r')}${th('Unreplied', 'unreplied', 'r')}${th('Listing', 'listing', 'r')}${th('Map pack', 'mapPack')}${th('Calls / directions (28d)', 'callsDirections', 'r')}${th('Details match', 'detailsMatch')}</tr></thead><tbody>
  ${rows.map((l) => {
    const packs = l.ranks.filter((r) => r.map_pack != null);
    const pack = !l.ranks.length ? '<span class="dash">—</span>' : packs.length ? `${packs.length} of ${l.ranks.length} <span class="delta flat">best #${Math.min(...packs.map((r) => r.map_pack))}</span>` : '<span class="notok">not in pack</span>';
    return `<tr class="${l.attention >= 5 ? 'attn' : ''}">${showBrand ? `<td><div class="who">${badge(l.site, l.brand, 'sm')}<a href="#/${l.site}">${esc(l.brand)}</a></div></td>` : ''}
    <td><b>${esc(l.name)}</b>${l.town ? `<br><small class="muted">${esc(l.town)}</small>` : ''}</td>
    <td>${l.listing ? stars(l.listing.rating) : l.hasGbp ? '<span class="dash">—</span>' : '<small class="muted">no listing ID</small>'}</td>
    <td class="r num">${l.listing ? `${l.reviews.last30}${l.reviews.lowRecent ? ` <span class="delta down">${l.reviews.lowRecent} low</span>` : ''}` : n(null)}</td>
    <td class="r num ${l.reviews.unreplied ? 'notok' : ''}">${l.listing ? l.reviews.unreplied : n(null)}</td>
    <td class="r num ${l.listing && l.listing.completeness < 80 ? 'notok' : ''}">${l.listing ? `${l.listing.completeness}%` : n(null)}</td>
    <td>${pack}</td>
    <td class="r num">${l.performance ? `${n(l.performance.calls)} / ${n(l.performance.directions)}` : n(null)}</td>
    <td>${l.nap.length ? (l.napIssues.length ? `<span class="notok">✗</span> <small class="muted">${esc(l.napIssues.join(', '))}</small>` : '<span class="ok">✓</span>') : '<span class="dash">—</span>'}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}

async function renderLocations() {
  const rows = await api('/locations');
  $('#main').innerHTML = `<h1>Clinics</h1><p class="sub">Every location across the group, the ones needing attention first.</p>
  ${rows.length ? locationsTable(rows, true) : '<p class="empty">No locations configured. Add a <code>locations</code> list to a brand in data/sites.json.</p>'}
  <div class="actions"><button class="run" onclick="run('gbp')">Sync Business Profiles</button><button class="run" onclick="run('local')">Check map-pack ranks and details</button></div>`;
}

async function api(p, opts) { const r = await fetch('/api' + p, opts); if (!r.ok) throw new Error(`${r.status} ${p}`); return r.json(); }

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

  ${d.locations.length ? `<h2>Clinics</h2>${locationsTable(d.locations, false)}
  <div class="actions"><button class="run" onclick="run('gbp','${slug}')">Sync Business Profiles</button><button class="run" onclick="run('local','${slug}')">Check map-pack ranks and details</button></div>
  ${d.locations.some((l) => l.ranks.length) ? `<h2>Map-pack rankings by town</h2><div class="wrap"><table class="data"><thead><tr><th>Clinic</th>${th('Search', 'townSearch')}${th('Map pack', 'packPosition', 'r')}${th('Organic', 'organic', 'r')}${th('Who\'s in the pack', 'whoInPack')}</tr></thead><tbody>
  ${d.locations.flatMap((l) => l.ranks.map((r) => `<tr><td>${esc(l.name)}</td><td>${esc(r.keyword)}</td><td class="r"><span class="pos ${r.map_pack == null ? 'none' : r.map_pack <= 3 ? 'top3' : ''}">${r.map_pack ?? 'not shown'}</span>${delta(r.map_pack, r.prev, true)}</td><td class="r num">${r.organic ?? '<span class="dash">—</span>'}</td>
    <td><small class="muted">${r.top_pack.map((p) => `#${p.p} ${esc(p.t)}${p.r ? ` (${p.r})` : ''}`).join(' · ')}</small></td></tr>`)).join('')}</tbody></table></div>` : ''}
  ${d.recentReviews.length ? `<h2>Recent reviews</h2><div class="wrap"><table class="data"><thead><tr><th>Clinic</th>${th('Rating', 'rating')}<th>Review</th>${th('Replied', 'replied')}</tr></thead><tbody>
  ${d.recentReviews.slice(0, 15).map((r) => { const loc = d.locations.find((l) => l.slug === r.location); return `<tr><td>${esc(loc?.name || r.location)}<br><small class="muted">${dateShort(r.created_at)}</small></td><td>${stars(r.rating)}</td><td>${esc((r.comment || '').slice(0, 220))}${(r.comment || '').length > 220 ? '…' : ''}${r.reviewer ? `<br><small class="muted">${esc(r.reviewer)}</small>` : ''}</td><td>${okmark(r.replied)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}` : ''}

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
  $('#status').innerHTML = [['Search Console', status.searchConsole], ['DataForSEO', status.dataforseo], ['Business Profile', status.businessProfile], ['Email', status.email]]
    .map(([k, v]) => `<span class="${v ? '' : 'off'}">${k} ${v ? 'on' : 'off'}</span>`).join('')
    + (status.dfsSpendUsd != null ? `<span title="DataForSEO spend this month against the cap">US$${status.dfsSpendUsd} / ${status.dfsCapUsd}</span>` : '')
    + (status.access ? `<span>${esc(status.user)}</span>` : '<span class="off">No login</span>');
  const route = async () => {
    const slug = location.hash.replace(/^#\/?/, '');
    const tab = (s) => `<a href="#/${s.slug}" class="${s.slug === slug ? 'active' : ''}">${badge(s.slug, s.name, 'xs')}${esc(s.name)}</a>`;
    const others = [...new Set(sites.map((s) => s.group))].filter((g) => g !== homeGroup);
    $('#brands').innerHTML = `<div class="tabs">${sites.filter((s) => s.group === homeGroup).map(tab).join('')}</div>`
      + others.map((g) => { const list = sites.filter((s) => s.group === g), cur = list.find((s) => s.slug === slug);
        return `<details class="dd${cur ? ' active' : ''}"><summary>${esc(cur ? cur.name : g)}</summary><div class="menu"><div class="menu-title">${esc(g)}</div>${list.map(tab).join('')}</div></details>`; }).join('')
      + `<a href="#/clinics" class="${slug === 'clinics' ? 'active' : ''} sep">All clinics</a>`;
    $('#brands .tabs a.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    $('#home').className = slug ? '' : 'active'; $('#portfolio').className = slug === 'portfolio' ? 'active' : '';
    try { slug === 'clinics' ? await renderLocations() : slug === 'portfolio' ? await renderOverview() : slug ? await renderSite(slug) : await renderManagement(); }
    catch (e) { $('#main').innerHTML = `<p class="empty">Couldn't load that view: ${esc(e.message)}. <a href="#/">Back to portfolio</a></p>`; }
  };
  homeGroup = sites[0]?.group ?? null;
  for (const s of sites) logos[s.slug] = s.logo;
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => { for (const d of document.querySelectorAll('details.dd[open]')) if (!d.contains(e.target)) d.open = false; });
  route();
}
boot();
