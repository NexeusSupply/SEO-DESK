// Each rule returns issues: { url, severity: 'error'|'warning'|'notice', code, detail }
const E = 'error', W = 'warning', N = 'notice';

export function evaluate(pages, extras) {
  const issues = [];
  const push = (url, severity, code, detail = '') => issues.push({ url, severity, code, detail });
  const titles = new Map(), descs = new Map();

  for (const p of pages) {
    const u = p.url;
    if (p.error) { push(u, E, 'fetch_failed', p.error); continue; }
    if (p.status >= 500) push(u, E, 'server_error', `HTTP ${p.status}`);
    else if (p.status === 404 || p.status === 410) push(u, E, 'broken_page', `HTTP ${p.status}`);
    else if (p.status >= 400) push(u, W, 'client_error', `HTTP ${p.status}`);
    if (p.chain?.length > 1) push(u, W, 'redirect_chain', p.chain.map(c => `${c.status} ${c.url}`).join(' → '));
    if (p.chain?.some(c => c.status === 302 || c.status === 307)) push(u, N, 'temporary_redirect', 'Use 301 for permanent moves');
    if (p.loadMs > 3000) push(u, W, 'slow_response', `${p.loadMs} ms to first byte+body`);
    if (p.bytes > 1_500_000) push(u, N, 'large_html', `${Math.round(p.bytes / 1024)} KB`);

    const d = p.parsed;
    if (!d || p.status !== 200) continue;
    if (d.noindex) { push(u, N, 'noindex', ''); continue; }
    if (!d.title) push(u, E, 'missing_title');
    else {
      if (d.title.length > 60) push(u, W, 'title_too_long', `${d.title.length} chars`);
      if (d.title.length < 15) push(u, W, 'title_too_short', `${d.title.length} chars`);
      titles.set(d.title, [...(titles.get(d.title) || []), u]);
    }
    if (!d.metaDescription) push(u, W, 'missing_meta_description');
    else {
      if (d.metaDescription.length > 160) push(u, N, 'meta_description_too_long', `${d.metaDescription.length} chars`);
      descs.set(d.metaDescription, [...(descs.get(d.metaDescription) || []), u]);
    }
    if (d.h1Count === 0) push(u, W, 'missing_h1');
    if (d.h1Count > 1) push(u, N, 'multiple_h1', `${d.h1Count} H1s`);
    if (d.wordCount < 120) push(u, N, 'thin_content', `${d.wordCount} words`);
    if (d.imagesNoAlt > 0) push(u, W, 'images_missing_alt', `${d.imagesNoAlt} of ${d.images}`);
    if (!d.canonical) push(u, N, 'missing_canonical');
    else if (d.canonical !== p.finalUrl && d.canonical !== u) push(u, N, 'canonical_elsewhere', d.canonical);
    if (!d.hasViewport) push(u, W, 'no_viewport_meta', 'Page is not mobile-ready');
    if (!d.lang) push(u, N, 'missing_html_lang');
    if (d.internalLinks < 3) push(u, N, 'few_internal_links', `${d.internalLinks} links`);
    if (!u.startsWith('https://')) push(u, E, 'not_https');
  }
  for (const [t, urls] of titles) if (urls.length > 1) for (const u of urls) push(u, W, 'duplicate_title', `Shared with ${urls.length - 1} other page(s): "${t}"`);
  for (const [, urls] of descs) if (urls.length > 1) for (const u of urls) push(u, N, 'duplicate_meta_description', `Shared with ${urls.length - 1} other page(s)`);

  if (extras.sitemap === false) push('/', W, 'no_sitemap', '/sitemap.xml not found');
  if (extras.robots === false) push('/', N, 'no_robots_txt');
  if (extras.httpRedirects === false) push('/', E, 'http_not_redirected', 'http:// does not redirect to https://');
  return issues;
}

export function score(pages, issues) {
  const n = Math.max(pages.length, 1);
  // Penalty is per-page issue density, so a 400-page site with 20 warnings isn't punished like a 5-page site with 20.
  const weights = { error: 25, warning: 8, notice: 2 };
  const penalty = issues.reduce((s, i) => s + weights[i.severity], 0) / n;
  return Math.max(0, Math.round(100 - penalty));
}

export const ISSUE_LABELS = {
  fetch_failed: 'Page could not be fetched', server_error: 'Server error', broken_page: 'Broken page (404)',
  client_error: 'Client error', redirect_chain: 'Redirect chain', temporary_redirect: 'Temporary redirect',
  slow_response: 'Slow response', large_html: 'Large HTML', missing_title: 'Missing title',
  title_too_long: 'Title too long', title_too_short: 'Title too short', duplicate_title: 'Duplicate title',
  missing_meta_description: 'Missing meta description', meta_description_too_long: 'Meta description too long',
  duplicate_meta_description: 'Duplicate meta description', missing_h1: 'Missing H1', multiple_h1: 'Multiple H1s',
  thin_content: 'Thin content', images_missing_alt: 'Images missing alt text', missing_canonical: 'No canonical tag',
  canonical_elsewhere: 'Canonical points elsewhere', no_viewport_meta: 'Not mobile-ready', missing_html_lang: 'Missing lang attribute',
  few_internal_links: 'Few internal links', not_https: 'Not served over HTTPS', no_sitemap: 'No sitemap.xml',
  no_robots_txt: 'No robots.txt', http_not_redirected: 'HTTP does not redirect to HTTPS', noindex: 'Page is noindex',
};
