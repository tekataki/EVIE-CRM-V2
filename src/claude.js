// EVIE v10 · Claude (Anthropic API) adapter for the Worker. Official SDK (@anthropic-ai/sdk) with an injectable
// fetch so tests can mock the API. Everything goes through the BETA messages endpoint because it carries:
//   - server-side refusal fallbacks   (betas server-side-fallback-2026-07-01, fallbacks:'default')
//   - thinking block binding controls (betas thinking-binding-controls-2026-08-01, drop_block = degrade, never 400)
// Model rules for claude-opus-5-5 (checked against the Claude API docs, 2026-11):
//   - thinking is always on: send {type:'adaptive'} (never 'disabled' / budget_tokens → 400)
//   - depth = output_config.effort (low | medium | high); default is 'medium', so it is always set explicitly
//   - no temperature/top_p/top_k, no assistant prefill, tool_choice only 'auto'
//   - always stream (stream().finalMessage()); check stop_reason before reading content
import Anthropic from '@anthropic-ai/sdk'

export const CLAUDE_MODEL = 'claude-opus-5-5'
export const BETAS = ['server-side-fallback-2026-07-01', 'thinking-binding-controls-2026-08-01']
// USD per 1M tokens. Cache writes (5-min TTL) are 1.25× input; reads are a flat $0.20 on Opus 5.5.
export const CLAUDE_PRICES = Object.freeze({
  'claude-opus-5-5': { input: 4, cache_write: 5, cache_read: 0.2, output: 20 },
  'claude-opus-5': { input: 5, cache_write: 6.25, cache_read: 0.5, output: 25 },
  'claude-opus-4-8': { input: 5, cache_write: 6.25, cache_read: 0.5, output: 25 }
})
export const WEB_SEARCH_USD = 0.01 // $10 per 1,000 searches (result tokens are billed as input)
/** Tier → effort. Opus 5.5 defaults to 'medium', so every tier sets it explicitly. */
export const TIER_EFFORT = Object.freeze({ chispa: 'low', enfoque: 'medium', profundo: 'high' })
/** max_tokens per tier (thinking counts against it; streaming avoids HTTP timeouts). */
export const TIER_MAX_TOKENS = Object.freeze({ chispa: 4000, enfoque: 8000, profundo: 20000 })

/** Which reasoning provider serves AI requests: Claude by default once ANTHROPIC_API_KEY exists. */
export function aiProvider(env = {}) {
  const pref = String(env.EVIE_AI_PROVIDER || '').toLowerCase()
  if (pref === 'openai' && env.OPENAI_API_KEY) return 'openai'
  if (env.ANTHROPIC_API_KEY) return 'claude'
  return env.OPENAI_API_KEY ? 'openai' : null
}
export function claudeModel(env = {}) { const m = String(env.EVIE_CLAUDE_MODEL || ''); return /^claude-[a-z0-9.-]{3,40}$/.test(m) ? m : CLAUDE_MODEL }
export function claudeClient(env, fetcher) {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, fetch: fetcher, maxRetries: 1, timeout: 120000 })
}
function priceFor(env, model) {
  try { const o = JSON.parse(env?.EVIE_PRICES || '{}'); const p = o[model]; if (p && typeof p === 'object' && ['input', 'cache_write', 'cache_read', 'output'].every((k) => Number.isFinite(p[k]))) return p } catch {}
  return CLAUDE_PRICES[model] || CLAUDE_PRICES[CLAUDE_MODEL]
}
/** Cost in micro-USD of one Messages API response (tokens × $/1M = micro-USD), web searches included. */
export function claudeCost(env, msg) {
  const u = msg?.usage; if (!u) return 0
  const p = priceFor(env, msg.model)
  const micro = (Number(u.input_tokens) || 0) * p.input + (Number(u.cache_creation_input_tokens) || 0) * p.cache_write + (Number(u.cache_read_input_tokens) || 0) * p.cache_read + (Number(u.output_tokens) || 0) * p.output
  const searches = Number(u.server_tool_use?.web_search_requests) || 0
  return Math.round(micro + searches * WEB_SEARCH_USD * 1e6)
}
export function searchesOf(msg) { return Number(msg?.usage?.server_tool_use?.web_search_requests) || 0 }

/**
 * One streamed request. `onText(delta)` receives text deltas as they arrive; returns the final message.
 * Callers pass model/system/messages/tools/max_tokens/output_config; the betas, fallbacks and thinking
 * config are fixed here so every route behaves the same.
 */
export async function claudeRun(client, params, { onText = null, signal = null } = {}) {
  const body = {
    ...params,
    betas: BETAS,
    fallbacks: 'default',
    thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } }
  }
  const stream = client.beta.messages.stream(body, signal ? { signal } : undefined)
  if (onText) stream.on('text', (t) => { try { onText(t) } catch {} })
  return await stream.finalMessage()
}

/** Typed SDK errors → user-facing Spanish message + HTTP status (never leaks provider details). */
export function claudeError(e) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { status: 502, code: 'claude_auth', message: 'La clave de Claude (ANTHROPIC_API_KEY) no es válida o no tiene permiso.' }
  if (e instanceof Anthropic.RateLimitError) return { status: 429, code: 'claude_rate', message: 'Claude limitó las solicitudes o no hay saldo en la cuenta de API. Intenta en un momento.' }
  if (e instanceof Anthropic.BadRequestError) return { status: 502, code: 'claude_bad_request', message: 'Claude rechazó la solicitud.' }
  if (e instanceof Anthropic.APIConnectionTimeoutError) return { status: 504, code: 'claude_timeout', message: 'Claude no respondió a tiempo.' }
  if (e instanceof Anthropic.InternalServerError) return { status: 502, code: 'claude_unavailable', message: 'Claude está saturado o no disponible. Intenta de nuevo.' }
  if (e instanceof Anthropic.APIConnectionError) return { status: 502, code: 'claude_connection', message: 'No se pudo conectar con Claude.' }
  if (e?.name === 'AbortError' || e instanceof Anthropic.APIUserAbortError) return { status: 499, code: 'aborted', message: 'Respuesta detenida.' }
  return { status: 502, code: 'claude_error', message: 'Ivi no pudo responder.' }
}

/** Plain text of the final answer (text blocks only, in order). */
export function textOf(msg) { return (msg?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim() }
/** Up to 8 https sources cited from web search (citations) or returned by it. */
export function sourcesOf(msg) {
  const seen = new Set(), out = []
  const add = (url, title) => { if (typeof url !== 'string' || !/^https:\/\//.test(url) || seen.has(url) || out.length >= 8) return; seen.add(url); let host = ''; try { host = new URL(url).hostname.replace(/^www\./, '') } catch {} out.push({ url: url.slice(0, 500), title: String(title || host).slice(0, 160), host }) }
  for (const b of msg?.content || []) if (b.type === 'text') for (const c of b.citations || []) if (c?.type === 'web_search_result_location') add(c.url, c.title)
  return out
}
/** URLs the web_search tool actually returned (to verify model-cited sources). */
export function searchedUrls(msg) {
  const urls = new Set()
  for (const b of msg?.content || []) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r?.type === 'web_search_result' && typeof r.url === 'string') urls.add(r.url)
  return urls
}
export function toolUses(msg) { return (msg?.content || []).filter((b) => b.type === 'tool_use') }
/** A short, honest line for stop reasons that are not a normal end. */
export function stopNote(msg) {
  switch (msg?.stop_reason) {
    case 'refusal': return 'No puedo ayudar con eso.'
    case 'max_tokens': return 'La respuesta se cortó por longitud; pídeme que continúe.'
    default: return ''
  }
}
/** Did a fallback model serve this turn? (usage.iterations carries a fallback_message entry.) */
export function servedByFallback(msg) { return (msg?.usage?.iterations || []).some((x) => x?.type === 'fallback_message') }

/** OpenAI-style function tool definitions ({name,description,parameters}) → Claude tools. */
export function claudeTools(defs) {
  return defs.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }))
}
const DROP = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'maxItems', 'pattern'])
const FORMATS = new Set(['date-time', 'time', 'date', 'duration', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'uuid'])
/** JSON Schema → the subset structured outputs accept (no numeric/length/array-size limits; type arrays → anyOf).
 *  The dropped limits are re-applied in code by each caller. */
export function claudeSchema(s) {
  if (Array.isArray(s)) return s.map(claudeSchema)
  if (!s || typeof s !== 'object') return s
  const out = {}
  for (const [k, v] of Object.entries(s)) {
    if (DROP.has(k)) continue
    if (k === 'minItems' && !(v === 0 || v === 1)) continue
    if (k === 'format' && !FORMATS.has(v)) continue
    if (k === 'properties') out[k] = Object.fromEntries(Object.entries(v).map(([p, d]) => [p, claudeSchema(d)]))
    else if (k === 'items' || k === 'anyOf' || k === 'allOf') out[k] = claudeSchema(v)
    else out[k] = v
  }
  if (Array.isArray(out.type)) { const types = out.type, { type: _t, description, enum: en, ...rest } = out; return { ...(description ? { description } : {}), anyOf: types.map((t) => t === 'null' ? { type: 'null' } : { type: t, ...rest, ...(en ? { enum: en.filter((x) => x !== null) } : {}) }) } }
  return out
}
/** One structured-output call: returns the parsed JSON object (throws on refusal / truncation / bad JSON). */
export async function claudeJson(client, { model, system, user, schema, effort = 'low', max_tokens = 4000, signal = null }) {
  const msg = await claudeRun(client, { model, max_tokens, system, messages: [{ role: 'user', content: user }], output_config: { effort, format: { type: 'json_schema', schema: claudeSchema(schema) } } }, { signal })
  if (msg.stop_reason === 'refusal') throw Object.assign(Error('refusal'), { code: 'refusal', msg })
  if (msg.stop_reason === 'max_tokens') throw Object.assign(Error('truncated'), { code: 'max_tokens', msg })
  return { json: JSON.parse(textOf(msg)), msg }
}
export function webSearchTool({ timezone, city, maxUses = 3 } = {}) {
  return { type: 'web_search_20260209', name: 'web_search', max_uses: maxUses, user_location: { type: 'approximate', country: 'MX', ...(timezone ? { timezone } : {}), ...(city ? { city: String(city).slice(0, 60) } : {}) } }
}
