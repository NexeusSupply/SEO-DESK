// Drafts a reply to a Google review with Claude. It only drafts: a person edits it and posts it themselves, because
// posting needs the Business Profile API (not approved yet). The review itself is read from our own database by id;
// the browser only adds an optional short note from the person drafting.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { db } from '../db.js';

const SYSTEM = `You draft public replies to Google reviews for New Zealand and Australian veterinary clinics, on behalf of the clinic team.

Write only the reply text, as plain text with no subject line and no placeholders. Use New Zealand English spelling.

- Keep it short: two to four sentences for a positive review, up to five for a negative one.
- Sound like a warm, professional local vet team, not a corporation. Vary the wording; don't open with "Thank you for your review".
- Use the reviewer's first name if one is given and it looks like a real name.
- Mention a specific detail from the review so it doesn't read as a template.
- Never confirm or reveal anything about an animal's medical history, treatment, diagnosis or the reviewer's account that the review itself doesn't already say. Replies are public.
- For a negative or mixed review: acknowledge the experience without arguing or admitting fault, don't make promises (refunds, discounts, outcomes), and invite them to contact the clinic directly to talk it through.
- If the review has no text, write a brief, friendly thank-you based on the star rating.
- Sign off as "The team at <clinic name>".`;

let client = null;
const anthropic = () => (client ||= new Anthropic({ apiKey: config.claude.apiKey }));

/** Draft a reply to one stored review. Returns { reply }. */
export async function draftReviewReply(site, reviewId, note) {
  if (!config.claude.enabled) throw new Error('Claude is not configured (ANTHROPIC_API_KEY)');
  const r = db.prepare('SELECT location, rating, reviewer, comment FROM gbp_reviews WHERE site=? AND review_id=?').get(site.slug, reviewId);
  if (!r) throw new Error('unknown review');
  const loc = site.locations.find((l) => l.slug === r.location);
  const review = [
    `Clinic: ${loc?.name || site.name}${loc?.town ? `, ${loc.town}` : ''} (part of ${site.name})`,
    `Reviewer: ${r.reviewer || '(no name)'}`,
    `Rating: ${r.rating ?? '?'} out of 5 stars`,
    `Review: ${r.comment?.trim() || '(no text, rating only)'}`,
  ].join('\n');
  const msg = await anthropic().beta.messages.create({
    model: config.claude.model,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    // On a safety decline, let the API retry on a fallback model instead of returning nothing.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: `<review>\n${review}\n</review>${note ? `\n\nGuidance from the clinic team for this reply: ${note}` : ''}\n\nDraft the reply.` }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined to draft a reply to this review');
  const reply = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!reply) throw new Error('Claude returned an empty draft');
  return { reply };
}
