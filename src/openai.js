// EVIE v10 · OpenAI (Responses API) for the features that also run on Claude: Chat, Cabina SOMA, memory learning…
// Used while the provider is OpenAI (no ANTHROPIC_API_KEY yet, or EVIE_AI_PROVIDER=openai). Once the key exists the
// Claude path is the default again. Raw fetch, like the rest of the OpenAI code in this Worker; the key never leaves it.
import { tierConfig, costMicro, WEB_SEARCH_USD } from './tiers.js'

export const OPENAI_URL = 'https://api.openai.com/v1/responses'
/** Output budgets for long-form text (chat answers, dossiers). Reasoning tokens count toward them. */
export const OPENAI_CHAT_TOKENS = Object.freeze({ chispa: 1600, enfoque: 4000, profundo: 8000 })

export class OpenAIError extends Error {
  constructor(status, code = '', detail = '') { super(detail || code || 'openai_error'); this.name = 'OpenAIError'; this.status = status; this.code = code }
}
/** Any failure → { status, code, message } in Spanish (same wording as the voice assistant). */
export function openaiError(e) {
  const code = e?.code || ''
  if (code === 'aborted') return { status: 499, code, message: 'Respuesta detenida.' }
  if (code === 'timeout') return { status: 504, code, message: 'La IA tardó demasiado en responder. Intenta de nuevo.' }
  if (e?.status === 429) return { status: 429, code: 'rate_limited', message: 'OpenAI limitó las solicitudes o no hay saldo en la cuenta de API.' }
  if (e?.status === 401) return { status: 502, code: 'auth', message: 'La clave de OpenAI no es válida.' }
  if (code === 'refusal') return { status: 502, code, message: 'La IA prefirió no responder eso. Prueba con otras palabras.' }
  if (code === 'max_tokens') return { status: 502, code, message: 'La respuesta salió demasiado larga. Intenta de nuevo.' }
  if (code === 'bad_json' || e instanceof SyntaxError) return { status: 502, code: 'bad_json', message: 'La IA respondió en un formato inesperado. Intenta de nuevo.' }
  return { status: 502, code: code || 'provider_error', message: 'La IA no pudo responder ahora.' }
}

const DROP = new Set(['minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'format', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'default', 'examples', '$schema', 'title', 'uniqueItems'])
/** JSON Schema → OpenAI strict subset: objects closed and fully required; length/range keywords dropped
 *  (the server clamps and validates every field anyway). */
export function strictSchema(s) {
  if (Array.isArray(s)) return s.map(strictSchema)
  if (!s || typeof s !== 'object') return s
  const out = {}
  for (const [k, v] of Object.entries(s)) {
    if (DROP.has(k)) continue
    out[k] = k === 'properties' || k === '$defs' || k === 'definitions' ? Object.fromEntries(Object.entries(v || {}).map(([n, x]) => [n, strictSchema(x)])) : strictSchema(v)
  }
  if (out.type === 'object' || out.properties) { out.properties = out.properties || {}; out.required = Object.keys(out.properties); out.additionalProperties = false }
  return out
}

const signalFor = (signal, ms) => { const t = AbortSignal.timeout(ms); return signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, t]) : signal || t }
async function post(env, fetcher, payload, ms, signal) {
  let r
  try { r = await fetcher(OPENAI_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: signalFor(signal, ms) }) }
  catch (e) { throw new OpenAIError(e?.name === 'TimeoutError' ? 504 : e?.name === 'AbortError' ? 499 : 502, e?.name === 'TimeoutError' ? 'timeout' : e?.name === 'AbortError' ? 'aborted' : 'network') }
  if (!r.ok) { let code = '', msg = ''; try { const j = await r.json(); code = j?.error?.code || j?.error?.type || ''; msg = j?.error?.message || '' } catch {} throw new OpenAIError(r.status, String(code).slice(0, 60), String(msg).slice(0, 200)) }
  return r
}

export const outputText = (data) => (Array.isArray(data?.output) ? data.output : []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((p) => p.type === 'output_text').map((p) => p.text).join('')
const refused = (data) => (Array.isArray(data?.output) ? data.output : []).some((o) => o.type === 'message' && (o.content || []).some((p) => p.type === 'refusal'))
/** Cited sources (url_citation annotations first, then the search call's own list), deduped, max 8. Same shape as Claude's. */
export function openaiSources(data) {
  const seen = new Set(), out = []
  const add = (url, title) => { if (typeof url !== 'string' || !/^https:\/\//.test(url) || seen.has(url) || out.length >= 8) return; seen.add(url); let host = ''; try { host = new URL(url).hostname.replace(/^www\./, '') } catch {} out.push({ url: url.slice(0, 500), title: String(title || host).slice(0, 160), host }) }
  const items = Array.isArray(data?.output) ? data.output : []
  for (const o of items) if (o.type === 'message') for (const p of o.content || []) for (const a of p.annotations || []) if (a?.type === 'url_citation') add(a.url, a.title)
  for (const o of items) if (o.type === 'web_search_call') for (const s of o.action?.sources || []) add(s.url, s.title)
  return out
}
export const openaiSearches = (data) => (Array.isArray(data?.output) ? data.output : []).filter((o) => o.type === 'web_search_call').length

/** Structured output (strict JSON schema). `web` adds the hosted web search (required) — sources come back in `data`.
 *  Returns { json, cost, model, data, searches }. Throws OpenAIError. */
export async function openaiJson(env, fetcher, { tier = 'enfoque', system, user, schema, name = 'evie_json', maxTokens = 3000, timeoutMs = 60000, signal = null, web = null }) {
  const cfg = tierConfig(env, tier)
  const payload = { model: cfg.model, instructions: system, input: [{ role: 'user', content: user }], max_output_tokens: Math.max(maxTokens, cfg.max_output_tokens), store: false, reasoning: { effort: cfg.effort }, text: { format: { type: 'json_schema', name: String(name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64), schema: strictSchema(schema), strict: true } } }
  if (web) Object.assign(payload, { tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'MX', ...(web.timezone ? { timezone: web.timezone } : {}), ...(web.city ? { city: String(web.city).slice(0, 60) } : {}) } }], tool_choice: 'required', include: ['web_search_call.action.sources'] })
  const data = await (await post(env, fetcher, payload, web ? Math.max(timeoutMs, 90000) : timeoutMs, signal)).json()
  const searches = openaiSearches(data), cost = costMicro(env, cfg.model, data?.usage) + searches * WEB_SEARCH_USD * 1e6
  if (refused(data)) throw Object.assign(new OpenAIError(502, 'refusal'), { cost })
  if (data?.status === 'incomplete') throw Object.assign(new OpenAIError(502, 'max_tokens'), { cost })
  let json; try { json = JSON.parse(outputText(data)) } catch { throw Object.assign(new OpenAIError(502, 'bad_json'), { cost }) }
  return { json, cost, model: cfg.model, data, searches }
}

/** Streams a text answer (SSE from the Responses API). onText(delta) per chunk. Optional hosted web search.
 *  Returns { text, sources, searches, cost, model, stop_reason }. Throws OpenAIError (code 'aborted' on client stop). */
export async function openaiStream(env, fetcher, { tier = 'enfoque', instructions, input, web = null, onText = null, signal = null, timeoutMs = 120000 }) {
  const cfg = tierConfig(env, tier)
  const tools = web ? [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'MX', ...(web.timezone ? { timezone: web.timezone } : {}), ...(web.city ? { city: String(web.city).slice(0, 60) } : {}) } }] : []
  const payload = { model: cfg.model, instructions, input, max_output_tokens: OPENAI_CHAT_TOKENS[cfg.id] || 4000, store: false, reasoning: { effort: cfg.effort }, stream: true, ...(tools.length ? { tools, include: ['web_search_call.action.sources'] } : {}) }
  const r = await post(env, fetcher, payload, timeoutMs, signal)
  let text = '', final = null, buf = ''
  const handle = (raw) => {
    const data = raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n')
    if (!data || data === '[DONE]') return
    let ev; try { ev = JSON.parse(data) } catch { return }
    if (ev.type === 'response.output_text.delta' && typeof ev.delta === 'string') { text += ev.delta; if (onText) try { onText(ev.delta) } catch {} }
    else if (ev.type === 'response.completed' || ev.type === 'response.incomplete') final = ev.response || final
    else if (ev.type === 'response.failed' || ev.type === 'error') throw new OpenAIError(502, String(ev.response?.error?.code || ev.error?.code || ev.code || 'failed').slice(0, 60))
  }
  try {
    const reader = r.body.getReader(), dec = new TextDecoder()
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let i; while ((i = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2); handle(chunk) }
    }
    if (buf.trim()) handle(buf)
  } catch (e) {
    if (e instanceof OpenAIError) throw Object.assign(e, { partial: text })
    throw Object.assign(new OpenAIError(e?.name === 'TimeoutError' ? 504 : 499, e?.name === 'TimeoutError' ? 'timeout' : 'aborted'), { partial: text })
  }
  if (!text && final) text = outputText(final)
  const searches = openaiSearches(final)
  return { text, sources: openaiSources(final), searches, cost: costMicro(env, cfg.model, final?.usage) + searches * WEB_SEARCH_USD * 1e6, model: final?.model || cfg.model, stop_reason: final?.status === 'incomplete' ? 'max_tokens' : refused(final) ? 'refusal' : 'end_turn' }
}
