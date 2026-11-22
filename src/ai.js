// EVIE v10 · Provider-agnostic structured output for the small AI routes (Escuela, Revisión semanal, Dojo…).
// Claude (claude-opus-5-5, structured outputs) when ANTHROPIC_API_KEY exists; OpenAI strict JSON schema meanwhile.
// Every route: session required, daily AI count + global budget enforced, cost metered, errors in Spanish.
import { limits, usage, budget } from './assistant.js'
import { aiProvider, claudeClient, claudeModel, claudeJson, claudeCost, claudeError, claudeRun, webSearchTool, textOf, sourcesOf, searchedUrls, searchesOf } from './claude.js'
import { openaiJson, openaiError } from './openai.js'

export const canonUrl = (u) => { try { const x = new URL(u); x.hash = ''; for (const k of [...x.searchParams.keys()]) if (/^utm_/.test(k)) x.searchParams.delete(k); return x.href.replace(/\/$/, '') } catch { return '' } }
/** Web search + structured output. Returns { json, real: Map(canonUrl → {url,title}), cost, searches }.
 *  Claude: 1) web_search_20260209 → cited findings, 2) structured output over those findings only (citations and JSON
 *  cannot share one call). OpenAI: one call with the hosted web search required + strict schema. Callers must keep
 *  only URLs present in `real` (no invented citations). */
export async function aiSearchJson(env, fetcher, { system, user, schema, name = 'evie_search', timezone = 'America/Mexico_City', city = '', maxUses = 4, maxTokens = 5000 }) {
  const provider = aiProvider(env); if (!provider) throw Object.assign(new Error('no_ai'), { code: 'no_ai' })
  const real = new Map(), keep = (url, title = '') => { const k = canonUrl(url); if (k && /^https:\/\//.test(url)) real.set(k, { url: String(url).slice(0, 600), title: String(title || real.get(k)?.title || '').slice(0, 180) }) }
  if (provider === 'openai') {
    const { json, cost, data, searches } = await openaiJson(env, fetcher, { tier: 'enfoque', system, user, schema, name, maxTokens, web: { timezone, city } })
    for (const o of data?.output || []) { if (o.type === 'web_search_call') for (const s of o.action?.sources || []) keep(s.url, s.title); if (o.type === 'message') for (const p of o.content || []) for (const a of p.annotations || []) if (a?.type === 'url_citation') keep(a.url, a.title) }
    return { json, real, cost, searches }
  }
  const client = claudeClient(env, fetcher), model = claudeModel(env)
  let messages = [{ role: 'user', content: user }], msg = null, cost = 0, searches = 0
  for (let i = 0; i < 3; i++) {
    msg = await claudeRun(client, { model, max_tokens: 8000, system: system + '\nPrimero investiga con web_search. Después escribe tus hallazgos en texto claro y breve, citando las fuentes y la fecha; separa lo confirmado de lo no confirmado.', messages, tools: [webSearchTool({ timezone, city, maxUses })], output_config: { effort: 'low' } })
    cost += claudeCost(env, msg); searches += searchesOf(msg)
    for (const u of searchedUrls(msg)) keep(u); for (const s of sourcesOf(msg)) keep(s.url, s.title)
    if (msg.stop_reason !== 'pause_turn') break
    messages = [...messages, { role: 'assistant', content: msg.content }]
  }
  if (msg?.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { code: 'refusal', cost })
  const list = [...real.values()].map((v) => '- ' + v.url + (v.title ? ' — ' + v.title : '')).join('\n')
  const { json, msg: m2 } = await claudeJson(client, { model, system: 'Conviertes hallazgos de una búsqueda web a JSON en español de México. Usa SOLO lo que dicen los hallazgos y la lista de fuentes; no inventes datos, fechas, precios ni URLs.', user: `Solicitud: ${user}\n\n<hallazgos>\n${textOf(msg).slice(0, 12000)}\n</hallazgos>\n\n<fuentes_consultadas>\n${list || '(ninguna)'}\n</fuentes_consultadas>`, schema, effort: 'low', max_tokens: maxTokens })
  return { json, real, cost: cost + claudeCost(env, m2), searches }
}

const TIER_OF = { low: 'chispa', medium: 'enfoque', high: 'profundo' }
/** One structured call. Returns { json, cost, provider }. Throws (code 'no_ai' when nothing is configured). */
export async function aiJson(env, fetcher, { effort = 'low', system, user, schema, name = 'evie_json', maxTokens = 3000 }) {
  const provider = aiProvider(env)
  if (!provider) throw Object.assign(new Error('no_ai'), { code: 'no_ai' })
  if (provider === 'claude') {
    const { json, msg } = await claudeJson(claudeClient(env, fetcher), { model: claudeModel(env), system, user, schema, effort, max_tokens: Math.max(maxTokens, 2000) })
    return { json, cost: claudeCost(env, msg), provider }
  }
  const { json, cost } = await openaiJson(env, fetcher, { tier: TIER_OF[effort] || 'enfoque', system, user, schema, name, maxTokens })
  return { json, cost, provider }
}
/** Any provider error → { status, message }. */
export function aiError(env, e) {
  if (e?.code === 'no_ai') return { status: 503, message: 'La IA no está configurada en el servidor.' }
  if (e?.code === 'refusal') return { status: 422, message: 'No puedo preparar eso.' }
  if (e?.code === 'max_tokens' || e?.code === 'bad_json' || e instanceof SyntaxError) return { status: 502, message: 'La respuesta llegó incompleta. Intenta de nuevo.' }
  const x = aiProvider(env) === 'claude' ? claudeError(e) : openaiError(e)
  return { status: x.status === 499 ? 502 : x.status, message: x.message }
}
/** Session + JSON body + daily limit + global budget. Returns [ { s, env, b }, null ] or [ null, Response ]. */
export async function aiGate(c, authenticate) {
  const err = (m, s = 400) => c.json({ error: m }, s)
  const s = await authenticate(c); if (!s) return [null, err('Inicia sesión.', 401)]
  const env = c.env || {}
  if (!aiProvider(env)) return [null, err('La IA no está configurada en el servidor.', 503)]
  if (await usage(env, s.user.id, 'chat') >= limits(env, s.user.role).chat) return [null, err('Llegaste al límite diario de IA.', 429)]
  if (await usage(env, '__global__', 'cost_micro') >= budget(env).global_daily_usd * 1e6) return [null, err('Se alcanzó el presupuesto diario de IA.', 429)]
  let b; try { b = await c.req.json() } catch { return [null, err('JSON inválido.')] }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return [null, err('Solicitud inválida.')]
  return [{ s, env, b }, null]
}
export async function aiMeter(x, cost) {
  await usage(x.env, x.s.user.id, 'chat', 1)
  if (cost > 0) { await usage(x.env, x.s.user.id, 'cost_micro', cost); await usage(x.env, '__global__', 'cost_micro', cost) }
}
/** aiJson + metering + error response. Returns [ json, null ] or [ null, Response ]. */
export async function aiRun(c, x, fetcher, opts) {
  try { const { json, cost } = await aiJson(x.env, fetcher, opts); await aiMeter(x, cost); return [json, null] }
  catch (e) {
    if (e?.cost > 0) await aiMeter(x, e.cost).catch(() => {})
    const r = aiError(x.env, e); console.error('AI_ROUTE', opts?.name || '', e?.code || r.status)
    return [null, c.json({ error: r.message }, r.status)]
  }
}
/** Text cleaner for anything the browser sends (no control chars or angle brackets, bounded). */
export const aiClip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n)
