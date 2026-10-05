import nodemailer from 'nodemailer';
import { config, loadSites } from './config.js';
import { overview, siteDetail, allLocations } from './queries.js';

const pct = (a, b) => (a != null && b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : '');

export function buildDigest() {
  const sites = loadSites();
  const rows = overview(sites).map((o) => {
    const d = siteDetail(sites.find((s) => s.slug === o.slug));
    const movers = d.ranks.filter((r) => r.position && r.prev && Math.abs(r.position - r.prev) >= 3)
      .sort((a, b) => (a.position - a.prev) - (b.position - b.prev)).slice(0, 5);
    const errors = d.issues.filter((i) => i.severity === 'error').slice(0, 5);
    return `
<h2 style="margin:24px 0 4px;font-size:18px">${o.name}</h2>
<p style="margin:0 0 8px;color:#555">
  Audit score ${o.audit?.score ?? '–'}${o.audit?.prevScore != null ? ` (was ${o.audit.prevScore})` : ''} ·
  Clicks (28d) ${o.gsc?.clicks ?? '–'} ${pct(o.gsc?.clicks, o.gsc?.prevClicks)} ·
  Top-10 keywords ${o.ranks ? `${o.ranks.top10}/${o.ranks.tracked}` : '–'}
</p>
${errors.length ? `<p style="margin:4px 0"><b>Errors to fix:</b> ${errors.map((e) => `${e.label} (${e.n})`).join(', ')}</p>` : ''}
${movers.length ? `<p style="margin:4px 0"><b>Rank movers:</b> ${movers.map((m) => `${m.keyword} ${m.prev}→${m.position}`).join(', ')}</p>` : ''}
${d.gsc.strikingDistance.length ? `<p style="margin:4px 0"><b>Within reach (pos 8–20):</b> ${d.gsc.strikingDistance.slice(0, 4).map((q) => `“${q.query}” (${Math.round(q.position)})`).join(', ')}</p>` : ''}`;
  });
  const clinics = allLocations(sites).filter((l) => l.attention > 0).slice(0, 8);
  const clinicBlock = clinics.length ? `<h2 style="margin:32px 0 4px;font-size:18px">Clinics needing attention</h2><ul style="margin:0;padding-left:18px;color:#333">${clinics.map((l) => {
    const why = [l.reviews.lowRecent ? `${l.reviews.lowRecent} low review${l.reviews.lowRecent > 1 ? 's' : ''} in 90 days` : '', l.reviews.unreplied ? `${l.reviews.unreplied} unreplied` : '',
      l.listing && l.listing.completeness < 80 ? `listing ${l.listing.completeness}% complete` : '', l.napIssues.length ? `NAP mismatch (${l.napIssues.join(', ')})` : '',
      l.ranks.length && l.ranks.every((r) => r.map_pack == null) ? 'not in map pack' : ''].filter(Boolean).join(', ');
    return `<li><b>${l.name}</b> — ${why}</li>`; }).join('')}</ul>` : '';
  return `<div style="font-family:system-ui,sans-serif;max-width:640px;color:#222"><h1 style="font-size:22px">Weekly SEO digest</h1>${rows.join('')}${clinicBlock}
  <p style="margin-top:32px;color:#888;font-size:12px">Open the dashboard for full detail.</p></div>`;
}

export async function sendDigest() {
  const html = buildDigest();
  if (!config.smtp.enabled) return ['SMTP not configured — digest built but not sent'];
  const t = nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined });
  await t.sendMail({ from: config.smtp.from, to: config.smtp.to, subject: `SEO digest — ${new Date().toDateString()}`, html });
  return [`sent to ${config.smtp.to}`];
}
