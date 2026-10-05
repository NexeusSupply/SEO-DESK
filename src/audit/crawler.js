import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { config } from '../config.js';

const SKIP_EXT = /\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|mp4|mp3|css|js|woff2?|ttf|xml|json)(\?|$)/i;

function normalise(href, base) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    // strip common tracking params
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(p)) u.searchParams.delete(p);
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

async function fetchPage(url) {
  const chain = [];
  let current = url;
  const t0 = Date.now();
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': config.crawl.userAgent, accept: 'text/html,*/*;q=0.8' },
      signal: AbortSignal.timeout(20000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      chain.push({ url: current, status: res.status });
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    const type = res.headers.get('content-type') || '';
    const html = type.includes('text/html') ? await res.text() : '';
    return { finalUrl: current, status: res.status, html, loadMs: Date.now() - t0, bytes: html.length, chain, contentType: type };
  }
  return { finalUrl: current, status: 0, html: '', loadMs: Date.now() - t0, bytes: 0, chain, contentType: '', error: 'redirect loop' };
}

export function parsePage(html, pageUrl, siteHost) {
  const $ = cheerio.load(html);
  const links = new Set();
  let internalLinks = 0;
  $('a[href]').each((_, a) => {
    const n = normalise($(a).attr('href'), pageUrl);
    if (!n) return;
    const h = new URL(n).host.replace(/^www\./, '');
    if (h === siteHost) { internalLinks++; if (!SKIP_EXT.test(n)) links.add(n); }
  });
  const robots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  const text = $('body').clone().find('script,style,nav,footer,header').remove().end().text();
  const imgs = $('img');
  return {
    title: ($('title').first().text() || '').trim(),
    metaDescription: ($('meta[name="description"]').attr('content') || '').trim(),
    h1Count: $('h1').length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    canonical: normalise($('link[rel="canonical"]').attr('href') || '', pageUrl),
    noindex: robots.includes('noindex') ? 1 : 0,
    images: imgs.length,
    imagesNoAlt: imgs.filter((_, i) => !($(i).attr('alt') || '').trim()).length,
    internalLinks,
    links: [...links],
    hasViewport: $('meta[name="viewport"]').length > 0,
    lang: $('html').attr('lang') || '',
    structuredData: $('script[type="application/ld+json"]').length,
  };
}

export async function crawlSite(site, onPage) {
  const start = normalise(site.url, site.url);
  const robotsUrl = new URL('/robots.txt', site.url).toString();
  let robots = null;
  try { robots = robotsParser(robotsUrl, await (await fetch(robotsUrl, { signal: AbortSignal.timeout(10000) })).text()); } catch {}

  const queue = [start];
  const seen = new Set([start]);
  const pages = [];
  let active = 0;

  await new Promise((resolve) => {
    const pump = () => {
      while (active < config.crawl.concurrency && queue.length && pages.length + active < config.crawl.maxPages) {
        const url = queue.shift();
        active++;
        (async () => {
          let page;
          try {
            if (robots && robots.isDisallowed(url, config.crawl.userAgent)) return;
            const r = await fetchPage(url);
            const parsed = r.html ? parsePage(r.html, r.finalUrl, site.host) : null;
            page = { url, ...r, parsed };
            if (parsed) for (const l of parsed.links) if (!seen.has(l)) { seen.add(l); queue.push(l); }
          } catch (e) {
            page = { url, status: 0, html: '', loadMs: 0, bytes: 0, chain: [], parsed: null, error: e.message };
          } finally {
            if (page) { pages.push(page); onPage?.(page, pages.length); }
            active--;
            if (!queue.length && active === 0) resolve(); else pump();
          }
        })();
      }
      if (!queue.length && active === 0) resolve();
    };
    pump();
  });

  // Extra checks
  const extras = {};
  try { extras.sitemap = (await fetch(new URL('/sitemap.xml', site.url), { signal: AbortSignal.timeout(10000) })).ok; } catch { extras.sitemap = false; }
  extras.robots = Boolean(robots);
  try { const r = await fetch(site.url.replace(/^https:/, 'http:'), { redirect: 'manual', signal: AbortSignal.timeout(10000) }); extras.httpRedirects = r.status >= 300 && r.status < 400 && (r.headers.get('location') || '').startsWith('https'); } catch { extras.httpRedirects = null; }
  return { pages, extras };
}
