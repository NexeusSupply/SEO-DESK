// AI visibility: does ChatGPT, Gemini or Perplexity name the clinic when someone asks for a vet in its town, and does
// Google's AI Overview for "vet {town}" name or cite it? Each question is asked once a month per engine and the raw
// answer stored; whether a clinic was named, and who was named instead, is worked out when the dashboard reads it,
// so the matching can improve without asking again.
import { config } from '../config.js';
import { db, today, logJob } from '../db.js';
import { llmAnswer, aiOverview, recordSpend, underCap } from './dataforseo.js';
import { keywordsFor } from './local.js';

export const ENGINE_LABELS = { chat_gpt: 'ChatGPT', gemini: 'Gemini', perplexity: 'Perplexity', claude: 'Claude', google_aio: 'Google AI Overview' };
const COST_EST = { llm: 0.04, google_aio: 0.004 }; // USD per question, for the pre-flight cap check only
const FRESH_DAYS = 25;  // a question answered this recently isn't asked again
const PARALLEL = 4;

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The questions for one clinic: [{ engine, prompt }]. Brands without localKeywords or aiPrompts get none. */
export function questionsFor(site, loc) {
  if (!loc.town) return [];
  const fill = (t) => t.replace(/\{town\}/gi, loc.town).replace(/\{brand\}/gi, site.name.replace(/\s*\(.*?\)/g, ''));
  const tpl = loc.aiPrompts || site.aiPrompts || (site.localKeywords.length ? config.ai.prompts : []);
  const prompts = [...new Set(tpl.map(fill))];
  return [
    ...prompts.flatMap((prompt) => config.ai.engines.map(({ engine }) => ({ engine, prompt }))),
    ...(config.ai.overviews && prompts.length ? keywordsFor(site, loc).map((prompt) => ({ engine: 'google_aio', prompt })) : []),
  ];
}

/** Monthly: ask every clinic's questions not answered in the last FRESH_DAYS. Questions shared by clinics are asked once. */
export async function checkAi(sites, only) {
  if (!config.dfs.enabled) return 'DataForSEO not configured';
  const scope = sites.filter((s) => !only || s.slug === only);
  const all = [...new Map(scope.flatMap((s) => s.locations.flatMap((l) => questionsFor(s, l))).map((q) => [`${q.engine}|${q.prompt}`, q])).values()];
  if (!all.length) return 'no AI questions (needs clinics with a town, and localKeywords or aiPrompts)';
  const recent = new Set(db.prepare("SELECT engine||'|'||prompt k FROM ai_answers WHERE checked_on >= date('now', ?)").all(`-${FRESH_DAYS} days`).map((r) => r.k));
  const todo = all.filter((q) => !recent.has(`${q.engine}|${q.prompt}`));
  if (!todo.length) return `all ${all.length} AI questions already checked this month`;
  return logJob('ai', only || 'all', async () => {
    const models = Object.fromEntries(config.ai.engines.map((e) => [e.engine, e.model]));
    const ins = db.prepare('INSERT OR REPLACE INTO ai_answers (engine,prompt,checked_on,model,present,answer,sources,cost) VALUES (?,?,?,?,?,?,?,?)');
    let done = 0, failed = 0, capped = 0, spent = 0, inflight = 0; // inflight: estimated cost of questions still being answered
    const ask = async (q) => {
      const est = q.engine === 'google_aio' ? COST_EST.google_aio : COST_EST.llm;
      if (!underCap(est + inflight)) { capped++; return; }
      inflight += est;
      try {
        const r = q.engine === 'google_aio' ? await aiOverview(q.prompt) : await llmAnswer(q.engine, models[q.engine], q.prompt);
        ins.run(q.engine, q.prompt, today(), r.model || null, r.present === false ? 0 : 1, r.text.slice(0, 20000), JSON.stringify(r.sources.slice(0, 30)), r.cost);
        recordSpend(`ai-${q.engine}`, r.cost, 1); spent += r.cost; done++;
      } catch (e) { failed++; console.warn(`[ai] ${q.engine} "${q.prompt}": ${e.message}`); }
      finally { inflight -= est; }
    };
    for (let i = 0; i < todo.length; i += PARALLEL) await Promise.all(todo.slice(i, i + PARALLEL).map(ask));
    if (!done && failed) throw new Error(`all ${failed} AI questions failed; see the server log`);
    return `${done} AI answers saved (US$${spent.toFixed(2)})${failed ? `, ${failed} failed` : ''}${capped ? `, ${capped} skipped: monthly DataForSEO cap (US$${config.dfs.monthlyCapUsd}) reached` : ''}`;
  });
}

// ---- Reading answers ----

/** Ways the clinic might be written: its name and brand, each with and without the town. */
function nameVariants(site, loc) {
  const town = loc.town ? new RegExp(`\\b${reEsc(loc.town)}\\b`, 'i') : null;
  const names = [loc.name, site.name, ...(loc.aiNames || []), ...(site.aiNames || [])].map((x) => x.replace(/\(.*?\)/g, ''));
  return [...new Set(names.flatMap((x) => [x, town ? x.replace(town, '') : x]).map(norm).filter((v) => v.length >= 5))];
}

/** Business names an answer lists: bold text and list-item leads, kept only if they look like a vet business. */
export function namedBusinesses(text) {
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  const raw = [
    ...[...text.matchAll(/\*\*([^*\n]{3,80}?)\*\*/g)].map((m) => m[1]),
    ...[...text.matchAll(/^\s*(?:\d+[.)]|[-*•])\s+(?:\*\*)?([A-Z][^\n:–—(*]{2,70}?)(?:\*\*)?(?=\s*[-–—:(]|\s*$)/gm)].map((m) => m[1]),
  ].map((x) => x.replace(/[\s.,:;–—-]+$/, '').trim());
  const seen = new Set();
  return raw.filter((x) => /vet|veterinar|animal|clinic|hospital|\bpet/i.test(x) && x.split(/\s+/).length <= 8)
    .filter((x) => { const k = norm(x); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

/** Was the clinic named or cited in one stored answer, where, and who was named instead. */
function judge(row, site, loc, packNames) {
  const sources = JSON.parse(row.sources || '[]');
  const body = norm(row.answer);
  const ours = nameVariants(site, loc);
  const hosts = new Set([site.host, hostOf(loc.url)].filter(Boolean));
  const isOurs = (n) => { const k = norm(n); return ours.some((v) => k.includes(v) || (k.length >= 5 && v.includes(k))); };
  const others = [...namedBusinesses(row.answer || ''), ...packNames.filter((p) => norm(p).length >= 5 && body.includes(norm(p)))]
    .filter((x, i, a) => !isOurs(x) && a.findIndex((y) => norm(y) === norm(x)) === i);
  const at = (k) => { const i = body.indexOf(k); return i < 0 ? Infinity : i; };
  const ourAt = Math.min(...ours.map(at));
  const mentioned = ourAt !== Infinity;
  const otherAt = others.map((x) => at(norm(x))).filter((i) => i !== Infinity);
  return {
    engine: row.engine, prompt: row.prompt, checked: row.checked_on, model: row.model, present: Boolean(row.present),
    mentioned, rank: mentioned ? 1 + otherAt.filter((i) => i < ourAt).length : null,
    cited: sources.some((x) => [...hosts].some((h) => x.domain === h || x.domain?.endsWith('.' + h))),
    named: others.slice(0, 8), sources: sources.slice(0, 8), answer: (row.answer || '').slice(0, 4000),
  };
}

const latestAnswers = (engine, prompt) => db.prepare('SELECT * FROM ai_answers WHERE engine=? AND prompt=? ORDER BY checked_on DESC LIMIT 2').all(engine, prompt);

/** Per-clinic AI results for one brand, with a brand-level tally. */
export function aiSummary(site) {
  const packOf = (loc) => {
    const d = db.prepare('SELECT MAX(checked_on) d FROM local_ranks WHERE site=? AND location=?').get(site.slug, loc.slug)?.d;
    return d ? db.prepare('SELECT top_pack FROM local_ranks WHERE site=? AND location=? AND checked_on=?').all(site.slug, loc.slug, d).flatMap((r) => JSON.parse(r.top_pack || '[]').map((p) => p.t)).filter(Boolean) : [];
  };
  const clinics = site.locations.map((loc) => {
    const qs = questionsFor(site, loc);
    if (!qs.length) return null;
    const pack = packOf(loc);
    const results = qs.map((q) => {
      const [cur, prev] = latestAnswers(q.engine, q.prompt);
      if (!cur) return { engine: q.engine, prompt: q.prompt, checked: null };
      const r = judge(cur, site, loc, pack);
      return { ...r, prevMentioned: prev ? judge(prev, site, loc, pack).mentioned : null };
    });
    return { slug: loc.slug, name: loc.name, town: loc.town, results };
  }).filter(Boolean);
  const answers = clinics.flatMap((c) => c.results).filter((r) => r.checked && r.engine !== 'google_aio');
  const overviews = clinics.flatMap((c) => c.results).filter((r) => r.checked && r.engine === 'google_aio');
  const byEngine = Object.fromEntries([...config.ai.engines.map((e) => e.engine), ...(config.ai.overviews ? ['google_aio'] : [])].map((e) => {
    const rs = clinics.flatMap((c) => c.results).filter((r) => r.engine === e && r.checked && (e !== 'google_aio' || r.present));
    return [e, { checked: rs.length, mentioned: rs.filter((r) => r.mentioned || (e === 'google_aio' && r.cited)).length }];
  }));
  return {
    questions: clinics.length > 0, clinics, byEngine,
    checked: [...answers, ...overviews].reduce((a, r) => (!a || r.checked > a ? r.checked : a), null),
    mentioned: answers.filter((r) => r.mentioned).length, total: answers.length,
    prevMentioned: answers.filter((r) => r.prevMentioned).length, prevTotal: answers.filter((r) => r.prevMentioned != null).length,
    overviewsShown: overviews.filter((r) => r.present).length, overviewsCiting: overviews.filter((r) => r.present && (r.cited || r.mentioned)).length, overviewsChecked: overviews.length,
    competitors: topCompetitors(clinics),
  };
}

/** Businesses AI names most often instead of this brand's clinics. */
function topCompetitors(clinics) {
  const count = new Map();
  for (const r of clinics.flatMap((c) => c.results)) for (const x of r.named || []) {
    const k = norm(x); const cur = count.get(k) || { name: x, n: 0 }; cur.n++; count.set(k, cur);
  }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 8);
}

export const engineList = () => [...config.ai.engines.map((e) => e.engine), ...(config.ai.overviews ? ['google_aio'] : [])]
  .map((e) => ({ key: e, label: ENGINE_LABELS[e] || e }));
