// Claude's ideas for getting a clinic more traffic, from SEO, Google Ads, its Google listing, reviews and AI answers.
// It reads what the dashboard already knows about the clinic (listing, reviews, map-pack checks, AI answers, ads,
// keyword research, website health) and returns a short, prioritised list plus a starter Google search ad. Each run
// is saved so the page shows the latest ideas without asking again; someone presses "Get new ideas" to refresh.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { db, now } from '../db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS clinic_suggestions (
  id INTEGER PRIMARY KEY, site TEXT, location TEXT, created_at TEXT, focus TEXT, model TEXT, result TEXT, created_by TEXT
);
CREATE INDEX IF NOT EXISTS clinic_suggestions_idx ON clinic_suggestions (site, location, created_at);
`);

const CHANNELS = ['seo', 'google_ads', 'google_listing', 'reviews', 'website', 'ai_answers', 'social'];
const LEVEL = { type: 'string', enum: ['low', 'medium', 'high'] };
const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two or three sentences: where this clinic stands and the single biggest opportunity.' },
    ideas: {
      type: 'array',
      description: 'Five to eight ideas, most valuable first.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A short action, starting with a verb.' },
          channel: { type: 'string', enum: CHANNELS },
          impact: LEVEL,
          effort: LEVEL,
          why: { type: 'string', description: 'One or two sentences tying the idea to a specific figure or finding in the data.' },
          steps: { type: 'array', items: { type: 'string' }, description: 'Two to four concrete steps someone at the clinic or the marketing team can do.' },
        },
        required: ['title', 'channel', 'impact', 'effort', 'why', 'steps'],
        additionalProperties: false,
      },
    },
    ad: {
      type: 'object',
      description: 'A starter Google responsive search ad for this clinic.',
      properties: {
        keywords: { type: 'array', items: { type: 'string' }, description: 'Five to ten searches to bid on, taken from the keyword research when there is any.' },
        headlines: { type: 'array', items: { type: 'string' }, description: 'Eight to ten headlines, each 30 characters or fewer.' },
        descriptions: { type: 'array', items: { type: 'string' }, description: 'Three or four descriptions, each 90 characters or fewer.' },
      },
      required: ['keywords', 'headlines', 'descriptions'],
      additionalProperties: false,
    },
  },
  required: ['summary', 'ideas', 'ad'],
  additionalProperties: false,
};

const SYSTEM = `You are a local search and paid search specialist advising a group of New Zealand veterinary clinics on getting more people to find and contact each clinic. You get a snapshot of what our SEO dashboard knows about one clinic and suggest what to do next.

- Base every idea on the data given. Name the figure or finding behind it (a rating, a missing listing field, a search the clinic isn't in the map pack for, a keyword with real volume and low difficulty, an AI answer that named a competitor). Where data is missing or not connected, say what connecting it would show instead of guessing.
- Prefer cheap, high-impact local wins first: Google Business Profile completeness, review volume and replies, consistent name/address/phone, location and service pages on the website for the town's searches, then Google Ads for urgent searches (emergency, after hours, near me) and searches too hard to win organically.
- For Google Ads, keep it small and local: a tight radius around the clinic, call and location assets, and the high-intent searches. Don't recommend bidding on competitors' names.
- Keep it practical for a small clinic team and a shared marketing team. No jargon without a plain explanation.
- Ad copy: New Zealand English, no prices or offers we don't know about, no medical claims, no superlatives like "best vet" that can't be backed up. Headlines 30 characters or fewer, descriptions 90 or fewer.
- Never invent facts about the clinic (services, hours, prices, staff) beyond what the data says.`;

let client = null;
const anthropic = () => (client ||= new Anthropic({ apiKey: config.claude.apiKey }));

const line = (label, v) => v == null || v === '' ? '' : `${label}: ${v}\n`;

/** A compact, plain-text snapshot of the clinic for the prompt, from clinicDetail() and keywordSummary(). */
export function clinicSnapshot(d, kw) {
  const c = d.clinic, g = d.listing, s = d.summary, p = d.performance, a = d.ai;
  let out = `<clinic>\n${line('Clinic', c.name)}${line('Town', c.town)}${line('Brand', `${d.site.name} (${d.site.host})`)}${line('Services', c.services?.join(', '))}${line('Address', c.address)}</clinic>\n\n`;
  out += '<google_listing>\n' + (g
    ? `${line('Rating', g.rating != null ? `${g.rating} from ${g.review_count} reviews` : null)}${line('Listing completeness', `${g.completeness}%`)}${line('Primary category', g.primary_category)}${line('Opening hours set', g.has_hours ? 'yes' : 'no')}${line('Description written', g.has_description ? 'yes' : 'no')}${line('Photos', g.photo_count)}${line('Status', g.open_status)}`
    : 'Not connected yet.\n') + '</google_listing>\n\n';
  out += `<reviews>\n${line('New in last 30 days', s.reviews?.last30)}${line('Low (1-2 star) in last 90 days', s.reviews?.lowRecent)}${line('Unreplied', s.reviews?.unreplied)}`;
  const recent = d.reviews.slice(0, 8).filter((r) => r.comment).map((r) => `- ${r.rating}★ ${r.replied ? '(replied)' : '(not replied)'}: ${r.comment.slice(0, 200).replace(/\s+/g, ' ')}`);
  out += (recent.length ? `Recent reviews:\n${recent.join('\n')}\n` : '') + '</reviews>\n\n';
  out += `<listing_performance_28_days>\n${p.last28 ? `${line('Listing views', p.last28.views)}${line('Calls', p.last28.calls)}${line('Direction requests', p.last28.directions)}${line('Website clicks', p.last28.website)}` : 'Not connected (needs Business Profile API access).\n'}</listing_performance_28_days>\n\n`;
  out += '<local_search_from_town>\n' + (s.ranks?.length
    ? s.ranks.map((r) => `- "${r.keyword}": map pack ${r.map_pack ?? 'not shown'}, organic ${r.organic ?? 'not in top 30'}; pack shows ${r.top_pack.map((x) => `${x.t}${x.r ? ` (${x.r}★)` : ''}`).join(', ') || 'nothing'}`).join('\n') + '\n'
    : 'Not checked yet.\n') + '</local_search_from_town>\n\n';
  if (s.nap?.length) out += `<details_match>\n${s.nap.map((x) => `- ${x.source}: name ${x.name_ok ? 'ok' : 'MISMATCH'}, address ${x.address_ok ? 'ok' : 'MISMATCH'}, phone ${x.phone_ok ? 'ok' : 'MISMATCH'}${x.detail ? ` (${x.detail})` : ''}`).join('\n')}\n</details_match>\n\n`;
  out += '<ai_answers>\n' + (a?.checked
    ? `Named in ${a.mentioned} of ${a.total} AI answers for a vet in the town.\n${a.competitors.length ? `Named instead: ${a.competitors.map((x) => x.name).join(', ')}\n` : ''}${a.overviewsChecked ? `Google AI Overviews: shown ${a.overviewsShown}, naming or citing the clinic ${a.overviewsCiting}\n` : ''}`
    : 'Not checked yet.\n') + '</ai_answers>\n\n';
  out += `<website>\n${line('Audit score (0-100)', d.website.score)}${line('Errors', d.website.errors)}${line('Clicks from Google search, 28 days (whole brand site)', d.website.clicks)}${d.website.sharedWith > 1 ? `Shared by ${d.website.sharedWith} clinics of the brand.\n` : ''}</website>\n\n`;
  out += `<google_ads>\n${d.ads?.checked ? `${line('Ads running now for the website', d.ads.running)}${line('Ads seen in last 90 days', d.ads.total)}` : 'Not checked.\n'}</google_ads>\n\n`;
  out += '<keyword_research note="NZ-wide monthly Google searches; difficulty 0-100 for ranking organically; bids in USD per click">\n' + (kw?.researched
    ? kw.items.filter((k) => k.volume).slice(0, 40).map((k) => `- "${k.keyword}": ${k.volume}/mo, difficulty ${k.difficulty ?? '?'}, competition ${k.competition ?? '?'}, top-of-page bid ${k.lowBid != null ? `${k.lowBid.toFixed(2)}-${(k.highBid ?? k.lowBid).toFixed(2)}` : '?'}, our position ${k.position ?? 'not ranking'}`).join('\n') + '\n'
    : 'Not researched yet.\n') + '</keyword_research>';
  return out;
}

/** Ask Claude for ideas for one clinic, save them, and return the saved row. */
export async function suggestForClinic(site, loc, d, kw, focus, user) {
  if (!config.claude.enabled) throw new Error('Claude is not configured (ANTHROPIC_API_KEY)');
  const msg = await anthropic().beta.messages.create({
    model: config.claude.model,
    max_tokens: 16000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    // On a safety decline, let the API retry on a fallback model instead of returning nothing.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: `${clinicSnapshot(d, kw)}${focus ? `\n\nWhat the team wants to focus on: ${focus}` : ''}\n\nSuggest how this clinic can get more traffic and more enquiries.` }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined to suggest ideas for this clinic');
  if (msg.stop_reason === 'max_tokens') throw new Error('Claude ran out of room; try again');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Claude returned something that wasn’t valid ideas; try again'); }
  db.prepare('INSERT INTO clinic_suggestions (site,location,created_at,focus,model,result,created_by) VALUES (?,?,?,?,?,?,?)')
    .run(site.slug, loc.slug, now(), focus || null, msg.model, JSON.stringify(result), user || null);
  return latestSuggestions(site, loc);
}

/** The clinic's most recent ideas, or null. */
export function latestSuggestions(site, loc) {
  const r = db.prepare('SELECT * FROM clinic_suggestions WHERE site=? AND location=? ORDER BY id DESC LIMIT 1').get(site.slug, loc.slug);
  return r ? { created: r.created_at, focus: r.focus, by: r.created_by, ...JSON.parse(r.result) } : null;
}
