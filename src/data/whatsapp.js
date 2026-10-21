// WhatsApp through Meta's WhatsApp Cloud API. Meta posts every incoming message to /webhooks/whatsapp; each one is
// saved, then emailed to the brand's forwardTo address (with any photo or file attached) so it lands in the shared
// support mailbox rather than on someone's phone. Replies are typed on the WhatsApp page and sent as the brand's number.
// WhatsApp only allows free-form replies within 24 hours of the customer's last message; after that it needs an
// approved template, which this doesn't send.
import crypto from 'node:crypto';
import { config, loadSites } from '../config.js';
import { db, now } from '../db.js';
import { sendMail } from '../mail.js';

const WINDOW = 24 * 36e5;
const MAX_ATTACH = 15 * 1024 * 1024;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

db.exec(`
CREATE TABLE IF NOT EXISTS wa_messages (
  message_id TEXT PRIMARY KEY, site TEXT, wa_id TEXT, direction TEXT, type TEXT, body TEXT,
  media_id TEXT, media_mime TEXT, media_name TEXT, created_at TEXT, sent_by TEXT, status TEXT,
  emailed_at TEXT, email_error TEXT
);
CREATE INDEX IF NOT EXISTS wa_messages_idx ON wa_messages (site, wa_id, created_at);
CREATE TABLE IF NOT EXISTS wa_contacts (
  site TEXT, wa_id TEXT, name TEXT, handled_at TEXT, handled_by TEXT, PRIMARY KEY (site, wa_id)
);
`);

const token = () => config.whatsapp.token;
function proof(t) { return config.meta.appSecret ? crypto.createHmac('sha256', config.meta.appSecret).update(t).digest('hex') : null; }

async function cloud(path, { method = 'GET', body } = {}) {
  const u = new URL(`${config.meta.graphUrl}/${config.meta.version}/${path.replace(/^\//, '')}`);
  const p = proof(token()); if (p) u.searchParams.set('appsecret_proof', p);
  const r = await fetch(u, { method, signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.error) throw new Error(`WhatsApp ${r.status}: ${json.error?.error_data?.details || json.error?.message || 'request failed'}`);
  return json;
}

/** A photo, voice note or file someone sent: { data: Buffer, mime }. Meta keeps media for 30 days. */
export async function fetchMedia(mediaId) {
  const m = await cloud(mediaId);
  const r = await fetch(m.url, { headers: { Authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`WhatsApp media ${r.status}`);
  return { data: Buffer.from(await r.arrayBuffer()), mime: m.mime_type || r.headers.get('content-type') || 'application/octet-stream', size: m.file_size };
}

/** True when the request really came from Meta: X-Hub-Signature-256 is an HMAC of the raw body with the app secret. */
export function validSignature(raw, header) {
  if (!config.meta.appSecret || !header?.startsWith('sha256=')) return false;
  const want = Buffer.from(crypto.createHmac('sha256', config.meta.appSecret).update(raw).digest('hex'));
  const got = Buffer.from(header.slice(7));
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// What a message says, in words, for the inbox and the email. Media keeps its caption; the file itself is attached.
function describe(m) {
  switch (m.type) {
    case 'text': return m.text?.body || '';
    case 'image': case 'video': case 'document': case 'audio': case 'sticker': {
      const label = { image: 'Photo', video: 'Video', document: 'File', audio: 'Voice message', sticker: 'Sticker' }[m.type];
      const x = m[m.type] || {};
      return [x.caption, `[${label}${x.filename ? `: ${x.filename}` : ''}]`].filter(Boolean).join('\n');
    }
    case 'location': { const l = m.location || {}; return `[Location: ${[l.name, l.address].filter(Boolean).join(', ') || `${l.latitude}, ${l.longitude}`}] https://maps.google.com/?q=${l.latitude},${l.longitude}`; }
    case 'contacts': return `[Contact card: ${(m.contacts || []).map((c) => [c.name?.formatted_name, ...(c.phones || []).map((p) => p.phone)].filter(Boolean).join(' ')).join('; ')}]`;
    case 'button': return m.button?.text || '';
    case 'interactive': return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
    case 'reaction': return `[Reacted ${m.reaction?.emoji || ''} to a message]`;
    default: return `[A ${m.type} message SEO Desk can't show. Open WhatsApp to see it.]`;
  }
}

const siteForNumber = (phoneNumberId) => loadSites().find((s) => s.whatsapp?.phoneNumberId === String(phoneNumberId));

/** Handle one webhook body from Meta. Saves new messages, emails them on, and records delivery updates on replies. */
export async function handleWebhook(body) {
  for (const entry of body?.entry || []) for (const change of entry.changes || []) {
    if (change.field !== 'messages') continue;
    const v = change.value || {};
    const site = siteForNumber(v.metadata?.phone_number_id);
    if (!site) { console.warn(`[whatsapp] message for number ${v.metadata?.phone_number_id}, which no brand in sites.json has as whatsapp.phoneNumberId`); continue; }
    for (const s of v.statuses || []) db.prepare('UPDATE wa_messages SET status=? WHERE message_id=?').run(s.status, s.id);
    const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
    for (const m of v.messages || []) {
      const media = m[m.type]?.id ? m[m.type] : null;
      const added = db.prepare(`INSERT OR IGNORE INTO wa_messages (message_id,site,wa_id,direction,type,body,media_id,media_mime,media_name,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(m.id, site.slug, m.from, 'in', m.type, describe(m), media?.id || null, media?.mime_type || null, media?.filename || null,
        new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString());
      db.prepare('INSERT INTO wa_contacts (site,wa_id,name) VALUES (?,?,?) ON CONFLICT(site,wa_id) DO UPDATE SET name=COALESCE(excluded.name, name)')
        .run(site.slug, m.from, names[m.from] || null);
      // Meta resends a message it thinks wasn't received; only the first copy is emailed.
      if (added.changes) await forward(site, m.id).catch((e) => console.warn(`[whatsapp] emailing ${m.id}: ${e.message}`));
    }
  }
}

const contactName = (site, waId) => db.prepare('SELECT name FROM wa_contacts WHERE site=? AND wa_id=?').get(site.slug, waId)?.name || null;
const phone = (waId) => `+${waId}`;

/** Email one incoming message to the brand's forwardTo address. Records when it went, or why it didn't. */
export async function forward(site, messageId) {
  const m = db.prepare('SELECT * FROM wa_messages WHERE message_id=?').get(messageId);
  const to = site.whatsapp?.forwardTo;
  try {
    if (!to) throw new Error(`${site.name} has no whatsapp.forwardTo address in sites.json`);
    const who = contactName(site, m.wa_id);
    const attachments = [];
    if (m.media_id && m.type !== 'sticker') {
      try {
        const f = await fetchMedia(m.media_id);
        if (f.data.length <= MAX_ATTACH) attachments.push({ filename: m.media_name || `whatsapp-${m.type}.${(f.mime.split('/')[1] || 'bin').split(';')[0]}`, content: f.data, contentType: f.mime });
      } catch (e) { console.warn(`[whatsapp] media ${m.media_id}: ${e.message}`); }
    }
    const link = config.whatsapp.publicUrl ? `${config.whatsapp.publicUrl}/#/whatsapp` : null;
    await sendMail({
      to, subject: `WhatsApp from ${who ? `${who} (${phone(m.wa_id)})` : phone(m.wa_id)}`,
      html: `<p style="font-family:sans-serif;color:#555;margin:0 0 8px">New WhatsApp message to ${esc(site.name)} from <b>${esc(who || 'someone')}</b>, ${esc(phone(m.wa_id))}:</p>
        <blockquote style="font-family:sans-serif;font-size:15px;white-space:pre-wrap;margin:0 0 12px;padding:10px 14px;border-left:3px solid #25d366;background:#f4f6f5">${esc(m.body)}</blockquote>
        <p style="font-family:sans-serif;color:#555;font-size:13px">Reply on WhatsApp${link ? ` from <a href="${esc(link)}">SEO Desk</a>` : ' from the WhatsApp page in SEO Desk'} within 24 hours of their last message. Replying to this email sends an email, not a WhatsApp.</p>`,
      attachments,
    });
    db.prepare('UPDATE wa_messages SET emailed_at=?, email_error=NULL WHERE message_id=?').run(now(), messageId);
  } catch (e) {
    db.prepare('UPDATE wa_messages SET email_error=? WHERE message_id=?').run(String(e.message).slice(0, 300), messageId);
    throw e;
  }
}

/** Conversations for the WhatsApp page, newest first, each with its messages. status 'open' = waiting for a reply. */
export function conversations(sites, { status = 'open', limit = 100 } = {}) {
  const bySlug = Object.fromEntries(sites.map((s) => [s.slug, s]));
  const rows = db.prepare(`SELECT c.site, c.wa_id, c.name, c.handled_at, c.handled_by,
      MAX(CASE WHEN m.direction='in' THEN m.created_at END) last_in, MAX(CASE WHEN m.direction='out' THEN m.created_at END) last_out, MAX(m.created_at) last_at
    FROM wa_contacts c JOIN wa_messages m ON m.site=c.site AND m.wa_id=c.wa_id GROUP BY c.site, c.wa_id ORDER BY last_at DESC`).all()
    .filter((r) => bySlug[r.site]);
  const msgs = db.prepare('SELECT * FROM (SELECT rowid seq, * FROM wa_messages WHERE site=? AND wa_id=? ORDER BY created_at DESC, rowid DESC LIMIT 30) ORDER BY created_at, seq');
  return rows.map((r) => {
    const waiting = Boolean(r.last_in && r.last_in > (r.last_out || '') && r.last_in > (r.handled_at || ''));
    return { site: r.site, brand: bySlug[r.site].name, wa_id: r.wa_id, phone: phone(r.wa_id), name: r.name, waiting, handled_by: waiting ? null : r.handled_by,
      last_at: r.last_at, can_reply: Boolean(r.last_in && Date.now() - Date.parse(r.last_in) < WINDOW), messages: msgs.all(r.site, r.wa_id) };
  }).filter((c) => status === 'all' || c.waiting).slice(0, limit);
}

/** Send a text reply as the brand's WhatsApp number. */
export async function sendReply(site, waId, text, user) {
  if (!site.whatsapp?.phoneNumberId) throw new Error(`${site.name} has no WhatsApp number set up`);
  const last = db.prepare("SELECT MAX(created_at) t FROM wa_messages WHERE site=? AND wa_id=? AND direction='in'").get(site.slug, waId)?.t;
  if (!last) throw new Error('unknown conversation');
  if (Date.now() - Date.parse(last) >= WINDOW) throw new Error('It’s been more than 24 hours since their last message, so WhatsApp won’t deliver a normal reply. Call or email them instead, or wait for them to message again.');
  const r = await cloud(`${site.whatsapp.phoneNumberId}/messages`, { method: 'POST', body: { messaging_product: 'whatsapp', recipient_type: 'individual', to: waId, type: 'text', text: { body: text, preview_url: true } } });
  const id = r.messages?.[0]?.id || `local-${crypto.randomUUID()}`;
  db.prepare("INSERT OR REPLACE INTO wa_messages (message_id,site,wa_id,direction,type,body,created_at,sent_by,status) VALUES (?,?,?,'out','text',?,?,?,'sent')")
    .run(id, site.slug, waId, text, now(), user || null);
  return { id };
}

/** Mark a conversation as dealt with without replying on WhatsApp (answered by phone or email, or nothing to say). */
export function markHandled(site, waId, user) {
  const r = db.prepare('UPDATE wa_contacts SET handled_at=?, handled_by=? WHERE site=? AND wa_id=?').run(now(), `${user || 'someone'} (no reply)`, site.slug, waId);
  if (!r.changes) throw new Error('unknown conversation');
  return { handled: true };
}

/** The last few messages of a conversation, oldest first, for Claude's draft. */
export const recentMessages = (site, waId) => db.prepare('SELECT * FROM (SELECT rowid seq, direction, body, created_at FROM wa_messages WHERE site=? AND wa_id=? ORDER BY created_at DESC, rowid DESC LIMIT 12) ORDER BY created_at, seq').all(site.slug, waId);
export const knownMedia = (mediaId) => Boolean(db.prepare('SELECT 1 FROM wa_messages WHERE media_id=?').get(mediaId));
export { contactName };
