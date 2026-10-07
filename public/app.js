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
  return `<div class="wrap"><table class="data"><thead><tr>${showBrand ? '<th>Brand</th>' : ''}<th>Clinic</th><th>Rating</th><th class="r">Reviews (30d)</th><th class="r">Unreplied</th><th class="r">Listing</th><th>Map pack</th><th class="r">Calls / directions (28d)</th><th>Details match</th></tr></thead><tbody>
  ${rows.map((l) => {
    const packs = l.ranks.filter((r) => r.map_pack != null);
    const pack = !l.ranks.length ? '<span class="dash">—</span>' : packs.length ? `${packs.length} of ${l.ranks.length} <span class="delta flat">best #${Math.min(...packs.map((r) => r.map_pack))}</span>` : '<span class="notok">not in pack</span>';
    return `<tr class="${l.attention >= 5 ? 'attn' : ''}">${showBrand ? `<td><a href="#/${l.site}">${esc(l.brand)}</a></td>` : ''}
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
  return `<li class="cmt ${done ? 'done' : ''}" id="c-${esc(c.comment_id)}" data-site="${esc(c.site)}" data-id="${esc(c.comment_id)}">
    <div class="cmt-head">${platformTag(c.platform)}${showBrand ? ` <a href="#/${esc(c.site)}">${esc(c.brand)}</a>` : ''} <b>${esc(c.author)}</b> <span class="muted">${ago(c.created_at)}</span>
      ${c.permalink ? `<a class="muted" href="${esc(c.permalink)}" target="_blank" rel="noopener">open</a>` : ''}</div>
    <p class="cmt-body">${esc(c.message) || '<span class="muted">(no text, probably a sticker or photo)</span>'}</p>
    ${c.post_message ? `<p class="cmt-post muted">On: ${clip(c.post_message, 120)}</p>` : ''}
    ${c.hidden ? '<p class="cmt-state muted">Hidden from the public</p>' : ''}
    ${c.replied ? `<p class="cmt-state"><span class="ok">✓</span> ${c.reply_text ? `Replied: ${esc(c.reply_text)}` : 'Marked as handled'}${c.replied_by ? ` <span class="muted">· ${esc(c.replied_by)}</span>` : ''}</p>` : ''}
    ${!done ? `<form class="cmt-reply" onsubmit="return replyComment(event)"><textarea name="m" rows="2" placeholder="Reply publicly as the ${PLATFORM[c.platform]} account…" required></textarea>
      <div class="actions"><button class="run primary-btn" type="submit">Reply</button><button class="run" type="button" onclick="commentAction(this,'handled')">No reply needed</button><button class="run" type="button" onclick="commentAction(this,'hide')">Hide</button></div></form>`
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
  if (c === 'coming_soon') return socialPlaceholder();
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
function socialPlaceholder() {
  return `<h2>Facebook and Instagram <span class="sig nc">Coming soon</span></h2>${COMING_SOON}
  <div class="strip placeholder">
    <div><div class="v">${dash}</div><div class="l">Facebook followers</div></div>
    <div><div class="v">${dash}</div><div class="l">Instagram followers</div></div>
    <div><div class="v">${dash}</div><div class="l">Views, 28 days</div></div>
    <div><div class="v">${dash}</div><div class="l">Engagements, 28 days</div></div>
    <div><div class="v">${dash}</div><div class="l">Comments waiting for a reply</div></div>
  </div>
  <h3>Comments</h3>${commentsTable(false, emptyRow(5, 'Comments will appear here.'))}
  <h3>Recent posts</h3>${postsTable(emptyRow(4, 'Recent posts will appear here.'))}`;
}

async function renderComments(status) {
  if (!(await api('/status')).meta) {
    $('#main').innerHTML = `<h1>Comments <span class="sig nc">Coming soon</span></h1>${COMING_SOON}
    <div class="actions inbox-tabs"><a class="run on">Waiting for a reply</a><a class="run">All recent</a></div>
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

const SIGNAL = { good: ['Good', 'good'], watch: ['Watch', 'watch'], problem: ['Problem', 'problem'], not_connected: ['Not connected', 'nc'] };
const sig = (k) => `<span class="sig ${SIGNAL[k][1]}">${SIGNAL[k][0]}</span>`;
const nc = (label = 'Not connected') => `<span class="nc-text">${label}</span>`;
const conn = (status, value) => status === 'not_connected' ? nc() : status === 'no_data' ? nc('No data yet') : value;
// The first group in sites.json is the home group; the others are tucked away (menu dropdown, collapsed sections).
let homeGroup = null;
const groupBlock = (name, count, body) => name === homeGroup
  ? `<section class="group"><h2 class="group-title">${esc(name)}</h2>${body}</section>`
  : `<details class="group fold"><summary><h2 class="group-title">${esc(name)}<span class="count">${count} brand${count === 1 ? '' : 's'}</span></h2></summary>${body}</details>`;
const pctTxt = (p) => p == null ? '' : `<span class="delta ${p > 0 ? 'up' : p < 0 ? 'down' : 'flat'}">${p > 0 ? '+' : ''}${p}%</span>`;

async function renderManagement() {
  const groups = await api('/management');
  $('#main').innerHTML = `<h1>How things are going</h1><p class="sub">Search visibility and Google listings across the group, updated daily. Green is fine, amber needs a look, red needs a decision.</p>
  ${groups.map((g) => { const h = g.headline; return groupBlock(g.group, g.brands.length, `
    <div class="strip mgmt">
      <div><div class="v">${h.brandsConnected}<small>of ${h.brands} brands</small></div><div class="l">Reporting</div></div>
      ${h.listingsTotal ? `<div><div class="v">${h.listingsConnected}<small>of ${h.listingsTotal} listings</small></div><div class="l">Google listings connected</div></div>` : ''}
      <div><div class="v">${h.clicks != null ? n(h.clicks) : nc()}${pctTxt(h.clicksChange)}</div><div class="l">Visits from Google search, 28 days</div></div>
      ${h.listingsTotal ? `<div><div class="v">${h.rating != null ? `${h.rating} <span class="star">★</span>` : nc()}</div><div class="l">Average clinic rating</div></div>` : ''}
      <div><div class="v">${h.health != null ? `${h.health}<small>/100</small>` : nc()}</div><div class="l">Average website health</div></div>
      <div><div class="v ${h.problems ? 'notok' : ''}">${h.problems}<small>problem${h.problems === 1 ? '' : 's'}</small> <span class="muted">·</span> ${h.watch}<small>to watch</small></div><div class="l">Brands needing attention</div></div>
    </div>
    <div class="wrap"><table class="ledger mgmt-table"><thead><tr><th>Brand</th><th>Status</th><th>Why</th><th>Since last month</th></tr></thead><tbody>
    ${g.brands.map((b) => `<tr>
      <td class="brand"><a href="#/${b.slug}">${esc(b.name)}</a>${b.metrics.clinics ? `<small>${b.metrics.clinicsConnected} of ${b.metrics.clinics} clinics connected</small>` : ''}</td>
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
    <th>Brand</th><th>Audit score</th><th class="num">Errors</th><th class="num">Clicks</th><th class="num">Impressions</th><th>Keywords in top 10</th><th class="num">Referring domains</th>
  </tr></thead><tbody>${sites.filter((s) => s.group === g).map((s) => `<tr>
    <td class="brand"><a href="#/${s.slug}">${esc(s.name)}</a><small>${esc(s.host)}</small></td>
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
  <h1>${esc(d.site.name)}</h1><p class="sub"><a href="${esc(d.site.url)}" target="_blank">${esc(d.site.host)}</a>${d.audit ? ` · audited ${dateShort(d.audit.finished_at)}, ${d.audit.pages_crawled} pages` : ' · not audited yet'}</p>

  <div class="strip">
    <div><div class="v">${d.audit?.score ?? '—'}<small>/100</small></div><div class="l">Audit score${d.scoreHistory.length > 1 ? ` · ${spark(d.scoreHistory.map((s) => s.score))}` : ''}</div></div>
    <div><div class="v">${conn(d.connections.searchConsole, last28.length ? `${n(sum(last28, 'clicks'))}${prev28.length ? delta(sum(last28, 'clicks'), sum(prev28, 'clicks')) : ''}` : nc('No data yet'))}</div><div class="l">Clicks, 28 days</div></div>
    <div><div class="v">${conn(d.connections.searchConsole, last28.length ? `${n(sum(last28, 'impressions'))}${prev28.length ? delta(sum(last28, 'impressions'), sum(prev28, 'impressions')) : ''}` : nc('No data yet'))}</div><div class="l">Impressions, 28 days</div></div>
    <div><div class="v">${conn(d.connections.ranks, d.ranks.length ? `${top10}<small>of ${d.ranks.length}</small>` : nc('No data yet'))}</div><div class="l">Tracked keywords in top 10</div></div>
    <div><div class="v">${n(mine.referring_domains)}</div><div class="l">Referring domains</div></div>
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
  <div class="wrap"><table class="data"><thead><tr><th>Query</th><th>Page</th><th class="r">Position</th><th class="r">Impressions</th><th class="r">Clicks</th></tr></thead><tbody>
  ${g.strikingDistance.map((q) => `<tr><td>${esc(q.query)}</td><td><a href="${esc(q.page)}" target="_blank">${esc(host(q.page))}</a></td><td class="r num">${q.position.toFixed(1)}</td><td class="r num">${n(q.impressions)}</td><td class="r num">${n(q.clicks)}</td></tr>`).join('')}
  </tbody></table></div>` : ''}

  <h2>Site health</h2>
  ${d.issues.length ? `<div class="wrap"><table class="data"><thead><tr><th>Issue</th><th>Severity</th><th class="r">Pages</th></tr></thead><tbody>
  ${d.issues.map((i) => `<tr><td><details><summary>${esc(i.label)}</summary><ul class="examples">${i.examples.map((e) => `<li><a href="${esc(e.url)}" target="_blank">${esc(e.url)}</a>${e.detail ? ` — ${esc(e.detail)}` : ''}</li>`).join('')}${i.n > i.examples.length ? `<li><a href="/api/sites/${slug}/issues/${i.code}" target="_blank">all ${i.n} pages</a></li>` : ''}</ul></details></td>
    <td><span class="sev ${i.severity}">${i.severity}</span></td><td class="r num">${n(i.n)}</td></tr>`).join('')}
  </tbody></table></div>` : d.audit ? '<p class="empty">No issues found. Nice.</p>' : '<p class="empty">Run an audit to see site issues.</p>'}

  <h2>Rank tracking</h2>
  ${d.ranks.length ? `<div class="wrap"><table class="data"><thead><tr><th>Keyword</th><th class="r">Position</th><th>30 days</th><th>Ranking page</th><th class="r">Volume</th><th class="r">Difficulty</th><th>Competitors in SERP</th></tr></thead><tbody>
  ${d.ranks.map((r) => `<tr><td>${esc(r.keyword)}</td>
    <td class="r"><span class="pos ${r.position == null ? 'none' : r.position <= 3 ? 'top3' : ''}">${r.position ?? (r.history.length ? '>100' : '—')}</span>${delta(r.position, r.prev, true)}</td>
    <td>${spark(r.history, true)}</td><td>${r.url ? `<a href="${esc(r.url)}" target="_blank">${esc(host(r.url))}</a>` : ''}</td>
    <td class="r num">${n(r.volume)}</td><td class="r num">${n(r.difficulty)}</td>
    <td>${r.competitorsInSerp.map((c) => `${esc(c.d)} <span class="num">#${c.p}</span>`).join(', ')}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="empty">Add keywords to this site in data/sites.json to track rankings.</p>'}

  <div class="two">
    <div><h2>Top queries</h2>${g.topQueries.length ? `<div class="wrap"><table class="data"><thead><tr><th>Query</th><th class="r">Clicks</th><th class="r">Pos</th></tr></thead><tbody>
      ${g.topQueries.slice(0, 20).map((q) => `<tr><td>${esc(q.query)}</td><td class="r num">${n(q.clicks)}</td><td class="r num">${q.position.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Connect Search Console to see queries.</p>'}</div>
    <div><h2>Top pages</h2>${g.topPages.length ? `<div class="wrap"><table class="data"><thead><tr><th>Page</th><th class="r">Clicks</th><th class="r">Impr.</th></tr></thead><tbody>
      ${g.topPages.slice(0, 20).map((p) => `<tr><td><a href="${esc(p.page)}" target="_blank">${esc(host(p.page))}</a></td><td class="r num">${n(p.clicks)}</td><td class="r num">${n(p.impressions)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Connect Search Console to see pages.</p>'}</div>
  </div>

  ${d.locations.length ? `<h2>Clinics</h2>${locationsTable(d.locations, false)}
  <div class="actions"><button class="run" onclick="run('gbp','${slug}')">Sync Business Profiles</button><button class="run" onclick="run('local','${slug}')">Check map-pack ranks and details</button></div>
  ${d.locations.some((l) => l.ranks.length) ? `<h2>Map-pack rankings by town</h2><div class="wrap"><table class="data"><thead><tr><th>Clinic</th><th>Search</th><th class="r">Map pack</th><th class="r">Organic</th><th>Who's in the pack</th></tr></thead><tbody>
  ${d.locations.flatMap((l) => l.ranks.map((r) => `<tr><td>${esc(l.name)}</td><td>${esc(r.keyword)}</td><td class="r"><span class="pos ${r.map_pack == null ? 'none' : r.map_pack <= 3 ? 'top3' : ''}">${r.map_pack ?? 'not shown'}</span>${delta(r.map_pack, r.prev, true)}</td><td class="r num">${r.organic ?? '<span class="dash">—</span>'}</td>
    <td><small class="muted">${r.top_pack.map((p) => `#${p.p} ${esc(p.t)}${p.r ? ` (${p.r})` : ''}`).join(' · ')}</small></td></tr>`)).join('')}</tbody></table></div>` : ''}
  ${d.recentReviews.length ? `<h2>Recent reviews</h2><div class="wrap"><table class="data"><thead><tr><th>Clinic</th><th>Rating</th><th>Review</th><th>Replied</th></tr></thead><tbody>
  ${d.recentReviews.slice(0, 15).map((r) => { const loc = d.locations.find((l) => l.slug === r.location); return `<tr><td>${esc(loc?.name || r.location)}<br><small class="muted">${dateShort(r.created_at)}</small></td><td>${stars(r.rating)}</td><td>${esc((r.comment || '').slice(0, 220))}${(r.comment || '').length > 220 ? '…' : ''}${r.reviewer ? `<br><small class="muted">${esc(r.reviewer)}</small>` : ''}</td><td>${okmark(r.replied)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}` : ''}

  ${socialSection(d, slug)}

  <h2>Competitors</h2>
  ${d.domains.some((x) => x.fetched_on) ? `<div class="wrap"><table class="data"><thead><tr><th>Domain</th><th class="r">Organic keywords</th><th class="r">Est. monthly traffic</th><th class="r">Backlinks</th><th class="r">Referring domains</th><th class="r">Domain rank</th></tr></thead><tbody>
  ${d.domains.map((x, i) => `<tr><td>${i === 0 ? '<b>' : ''}${esc(x.domain)}${i === 0 ? '</b>' : ''}</td><td class="r num">${n(x.organic_keywords)}</td><td class="r num">${n(x.organic_etv)}</td><td class="r num">${n(x.backlinks)}</td><td class="r num">${n(x.referring_domains)}</td><td class="r num">${n(x.domain_rank)}</td></tr>`).join('')}
  </tbody></table></div>` : `<p class="empty">${d.site.competitors.length ? 'Refresh competitor data to compare domains.' : 'Add competitor domains in data/sites.json.'}</p>`}

  ${d.gap.length ? `<h2>Keyword gap</h2><p class="sub">Keywords competitors rank in the top 20 for that you don't rank for at all.</p>
  <div class="wrap"><table class="data"><thead><tr><th>Keyword</th><th class="r">Volume</th><th>Who ranks</th></tr></thead><tbody>
  ${d.gap.slice(0, 40).map((k) => `<tr><td>${esc(k.keyword)}</td><td class="r num">${n(k.volume)}</td><td>${k.competitors.map((c) => `${esc(c.domain)} <span class="num">#${c.position}</span>`).join(', ')}</td></tr>`).join('')}
  </tbody></table></div>` : ''}

  ${d.jobs.length ? `<h2>Recent jobs</h2><p class="jobs">${d.jobs.map((j) => `<span class="${j.ok ? '' : 'fail'}">${esc(j.job)} ${dateShort(j.finished_at)}: ${esc(j.message)}</span>`).join('<br>')}</p>` : ''}`;
}

async function boot() {
  const [status, sites] = await Promise.all([api('/status'), api('/overview')]);
  $('#status').innerHTML = [['Search Console', status.searchConsole], ['DataForSEO', status.dataforseo], ['Business Profile', status.businessProfile], ['Meta', status.meta || 'soon'], ['Email', status.email]]
    .map(([k, v]) => v === 'soon' ? `<span class="soon">${k} coming soon</span>` : `<span class="${v ? '' : 'off'}">${k} ${v ? 'on' : 'off'}</span>`).join('')
    + (status.dfsSpendUsd != null ? `<span title="DataForSEO spend this month against the cap">US$${status.dfsSpendUsd} / ${status.dfsCapUsd}</span>` : '')
    + (status.access ? `<span>${esc(status.user)}</span>` : '<span class="off">No login</span>');
  const route = async () => {
    const slug = location.hash.replace(/^#\/?/, '');
    const tab = (s) => `<a href="#/${s.slug}" class="${s.slug === slug ? 'active' : ''}">${esc(s.name)}</a>`;
    const others = [...new Set(sites.map((s) => s.group))].filter((g) => g !== homeGroup);
    $('#brands').innerHTML = `<div class="tabs">${sites.filter((s) => s.group === homeGroup).map(tab).join('')}</div>`
      + others.map((g) => { const list = sites.filter((s) => s.group === g), cur = list.find((s) => s.slug === slug);
        return `<details class="dd${cur ? ' active' : ''}"><summary>${esc(cur ? cur.name : g)}</summary><div class="menu"><div class="menu-title">${esc(g)}</div>${list.map(tab).join('')}</div></details>`; }).join('')
      + `<a href="#/clinics" class="${slug === 'clinics' ? 'active' : ''} sep">All clinics</a>`
      + `<a href="#/comments" class="${slug.startsWith('comments') ? 'active' : ''}">Comments</a>`;
    $('#home').className = slug ? '' : 'active'; $('#portfolio').className = slug === 'portfolio' ? 'active' : '';
    try { slug.startsWith('comments') ? await renderComments(slug.split('/')[1]) : slug === 'clinics' ? await renderLocations() : slug === 'portfolio' ? await renderOverview() : slug ? await renderSite(slug) : await renderManagement(); }
    catch (e) { $('#main').innerHTML = `<p class="empty">Couldn't load that view: ${esc(e.message)}. <a href="#/">Back to portfolio</a></p>`; }
  };
  homeGroup = sites[0]?.group ?? null;
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => { for (const d of document.querySelectorAll('details.dd[open]')) if (!d.contains(e.target)) d.open = false; });
  route();
}
boot();
