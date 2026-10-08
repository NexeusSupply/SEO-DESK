// Drafts replies with Claude: to Google reviews and to Facebook and Instagram comments. It only drafts; a person edits
// the text and posts it (from the dashboard once that platform is connected, or by pasting it in). The review or
// comment is read from our own database by id, or from the fixed examples below; the browser only adds an optional
// short note from the person drafting.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { db } from '../db.js';

const RULES = `- Never confirm or reveal anything about an animal's medical history, treatment, diagnosis or the person's account that their message doesn't already say. Replies are public.
- For a complaint: acknowledge the experience without arguing or admitting fault, don't make promises (refunds, discounts, outcomes), and invite them to contact the clinic directly to talk it through.
- Don't give medical advice in public. If someone asks a health question, suggest they call or book in.
- Write only the reply text, as plain text with no placeholders. Use New Zealand English spelling.`;

const SYSTEM = {
  review: `You draft public replies to Google reviews for New Zealand and Australian veterinary clinics, on behalf of the clinic team.

- Keep it short: two to four sentences for a positive review, up to five for a negative one.
- Sound like a warm, professional local vet team, not a corporation. Vary the wording; don't open with "Thank you for your review".
- Use the reviewer's first name if one is given and it looks like a real name.
- Mention a specific detail from the review so it doesn't read as a template.
- If the review has no text, write a brief, friendly thank-you based on the star rating.
- Sign off as "The team at <clinic name>".
${RULES}`,
  comment: `You draft public replies to comments on the Facebook and Instagram posts of New Zealand and Australian brands, mostly veterinary clinics plus a few animal-feed and supply businesses, written as the brand's account.

- Keep it to one or two short sentences, conversational and friendly, like a real person on the clinic's social team.
- Answer a question directly if the post or the comment gives you the answer; otherwise point them to call the clinic or send a direct message. Never make up opening hours, prices or availability.
- Use the commenter's first name when it reads naturally. An emoji is fine on Instagram if it fits; no hashtags and no sign-off.
${RULES}`,
};

// Fixed examples so the drafting can be shown before Google or Meta is connected.
export const EXAMPLES = {
  review: [
    { id: 'example-1', rating: 5, reviewer: 'Sarah M', comment: 'Brought our 14 year old cat Milo in after hours and the vet was so calm and kind with him. Thank you for squeezing us in.' },
    { id: 'example-2', rating: 2, reviewer: 'Daniel R', comment: 'Waited 40 minutes past our appointment time and nobody told us why. The vet was fine once we got in but the wait was frustrating.' },
  ],
  comment: [
    { id: 'example-1', platform: 'facebook', author: 'Jess Taylor', message: 'Do you do puppy vaccinations on Saturdays?', post_message: 'Puppy preschool starts again next month! Five weeks of socialisation, training basics and lots of treats.' },
    { id: 'example-2', platform: 'instagram', author: 'kiwi_and_the_cat', message: 'omg the little face 😍 is he up for adoption??', post_message: 'Meet Pickle, who came in for his first check-up this week. He was a very good boy.' },
  ],
};

let client = null;
const anthropic = () => (client ||= new Anthropic({ apiKey: config.claude.apiKey }));

function reviewPrompt(site, id) {
  const r = id.startsWith('example-') ? EXAMPLES.review.find((x) => x.id === id)
    : db.prepare('SELECT location, rating, reviewer, comment FROM gbp_reviews WHERE site=? AND review_id=?').get(site.slug, id);
  if (!r) throw new Error('unknown review');
  const loc = site.locations.find((l) => l.slug === r.location) || site.locations[0];
  return `<review>
Clinic: ${loc?.name || site.name}${loc?.town ? `, ${loc.town}` : ''} (part of ${site.name})
Reviewer: ${r.reviewer || '(no name)'}
Rating: ${r.rating ?? '?'} out of 5 stars
Review: ${r.comment?.trim() || '(no text, rating only)'}
</review>`;
}

function commentPrompt(site, id) {
  const c = id.startsWith('example-') ? EXAMPLES.comment.find((x) => x.id === id)
    : db.prepare('SELECT c.platform, c.author, c.message, p.message post_message FROM meta_comments c LEFT JOIN meta_posts p ON p.post_id=c.post_id WHERE c.site=? AND c.comment_id=?').get(site.slug, id);
  if (!c) throw new Error('unknown comment');
  return `<comment>
Brand: ${site.name} (${site.group} group)
Platform: ${c.platform === 'instagram' ? 'Instagram' : 'Facebook'}
The post it's on: ${c.post_message?.trim() || '(not available)'}
Commenter: ${c.author || '(no name)'}
Comment: ${c.message?.trim() || '(no text, probably a sticker or photo)'}
</comment>`;
}

/** Draft a reply to one review or comment ('review' | 'comment'). Returns { reply }. */
export async function draftReply(kind, site, id, note) {
  if (!config.claude.enabled) throw new Error('Claude is not configured (ANTHROPIC_API_KEY)');
  const item = kind === 'review' ? reviewPrompt(site, id) : commentPrompt(site, id);
  const msg = await anthropic().beta.messages.create({
    model: config.claude.model,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    // On a safety decline, let the API retry on a fallback model instead of returning nothing.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM[kind],
    messages: [{ role: 'user', content: `${item}${note ? `\n\nGuidance from the team for this reply: ${note}` : ''}\n\nDraft the reply.` }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined to draft a reply to this one');
  const reply = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!reply) throw new Error('Claude returned an empty draft');
  return { reply };
}
