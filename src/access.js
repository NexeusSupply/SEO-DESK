// Verifies the Cloudflare Access JWT on every request. With CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD unset
// (local development) it lets everything through and reports the user as "local".
import crypto from 'node:crypto';
import { config } from './config.js';

let jwks = { keys: [], fetched: 0 };
async function keys() {
  if (Date.now() - jwks.fetched < 3600_000 && jwks.keys.length) return jwks.keys;
  const r = await fetch(`https://${config.access.teamDomain}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Access certs ${r.status}`);
  jwks = { keys: (await r.json()).keys || [], fetched: Date.now() };
  return jwks.keys;
}
const b64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export async function verifyAccessJwt(token) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('malformed token');
  const header = JSON.parse(b64(h)), payload = JSON.parse(b64(p));
  const jwk = (await keys()).find((k) => k.kid === header.kid);
  if (!jwk) { jwks.fetched = 0; throw new Error('unknown signing key'); }
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64(s));
  if (!ok) throw new Error('bad signature');
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('expired');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(config.access.aud)) throw new Error('wrong audience');
  if (payload.iss !== `https://${config.access.teamDomain}`) throw new Error('wrong issuer');
  return payload;
}

export function accessMiddleware() {
  return async (req, res, next) => {
    if (!config.access.enabled) { req.user = { email: 'local' }; return next(); }
    const token = req.get('Cf-Access-Jwt-Assertion') || req.cookies?.CF_Authorization;
    if (!token) return res.status(403).send('Forbidden: open this site through its Cloudflare Access address.');
    try { const p = await verifyAccessJwt(token); req.user = { email: p.email || p.sub }; next(); }
    catch (e) { res.status(403).send(`Forbidden: ${e.message}`); }
  };
}
