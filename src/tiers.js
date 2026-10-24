// EVIE v5 · Niveles de IA (ai_reasoning_tier). NO confundir con los "modos de trabajo" (enfoque, gym,
// negocio, cierre, noche, normal) que solo cambian la interfaz. Un nivel decide modelo, esfuerzo de
// razonamiento, tokens, tiempo límite y política de herramientas — siempre en el SERVIDOR.
// Precios y esfuerzos verificados en la documentación oficial de OpenAI (2026-10; ver docs/PROVIDERS.md).
export const TIER_IDS = ['chispa', 'enfoque', 'profundo']
export const DEFAULT_TIER = 'enfoque'
export const TIER_LABELS = { chispa: 'Chispa', enfoque: 'Enfoque', profundo: 'Profundo' }
const BASE = Object.freeze({
  chispa: { model: 'gpt-6-luna', effort: 'none', max_output_tokens: 450, timeout_ms: 20000, hops: 2, web: 'explicit', research: false, summary: 'Rápido: respuestas cortas, comandos y consultas simples.' },
  enfoque: { model: 'gpt-6-luna', effort: 'medium', max_output_tokens: 700, timeout_ms: 30000, hops: 3, web: 'auto', research: true, summary: 'Equilibrado: el predeterminado para el día a día.' },
  profundo: { model: 'gpt-6.1-sol', effort: 'high', max_output_tokens: 1600, timeout_ms: 60000, hops: 4, web: 'auto', research: true, summary: 'El más capaz: análisis, planes y preguntas difíciles. Más lento y caro.' }
})
// Efforts each model family accepts (gpt-6.1-sol has no none/minimal). Unknown models: pass through.
const EFFORTS = { 'gpt-6-luna': ['none', 'low', 'medium', 'high', 'xhigh', 'max'], 'gpt-6.1-sol': ['low', 'medium', 'high', 'xhigh', 'max'] }
// USD per 1M tokens: [input, cached input, output]. Override with EVIE_PRICES='{"model":[in,cached,out]}'.
export const PRICES = Object.freeze({ 'gpt-6-luna': [0.10, 0.01, 0.50], 'gpt-6.1-sol': [2, 0.10, 10], 'gpt-6-astra': [10, 1, 50] })
export const WEB_SEARCH_USD = 0.01 // $10 / 1k calls (content tokens billed separately as input)

export function isTier(t) { return TIER_IDS.includes(t) }
/** Server config for a tier. Env overrides: EVIE_TIER_<ID>_MODEL / _EFFORT / _TOKENS. Legacy EVIE_MODEL_FAST/SMART respected. */
export function tierConfig(env = {}, tier = DEFAULT_TIER) {
  const id = isTier(tier) ? tier : DEFAULT_TIER, up = id.toUpperCase(), b = BASE[id]
  const legacy = id === 'profundo' ? env.EVIE_MODEL_SMART : env.EVIE_MODEL_FAST
  const model = env['EVIE_TIER_' + up + '_MODEL'] || legacy || b.model
  let effort = env['EVIE_TIER_' + up + '_EFFORT'] || b.effort
  const allowed = EFFORTS[model]
  if (allowed && !allowed.includes(effort)) effort = effort === 'none' && allowed.includes('low') ? 'low' : allowed[Math.min(1, allowed.length - 1)]
  const tokens = Number(env['EVIE_TIER_' + up + '_TOKENS'])
  return { id, label: TIER_LABELS[id], ...b, model, effort, max_output_tokens: Number.isInteger(tokens) && tokens >= 128 && tokens <= 8000 ? tokens : b.max_output_tokens }
}
/** Fallback chain when a tier's model is unavailable (model_not_found, unsupported effort, 5xx): profundo→enfoque→chispa. */
export function fallbackOf(tier) { return tier === 'profundo' ? 'enfoque' : tier === 'enfoque' ? 'chispa' : null }
export function priceOf(env, model) { try { const o = JSON.parse(env?.EVIE_PRICES || '{}'); if (Array.isArray(o[model]) && o[model].length === 3) return o[model] } catch {} return PRICES[model] || PRICES['gpt-6-luna'] }
/** Cost in micro-USD from a Responses API usage object (tokens × $/1M = micro-USD). */
export function costMicro(env, model, u) {
  if (!u) return 0
  const [pin, pcached, pout] = priceOf(env, model)
  const cached = Number(u.input_tokens_details?.cached_tokens) || 0, input = Math.max(0, (Number(u.input_tokens) || 0) - cached), out = Number(u.output_tokens) || 0
  return Math.round(input * pin + cached * pcached + out * pout)
}

const n = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,;]+/g, ' ').replace(/\s+/g, ' ').trim()
const TIER_WORD = { chispa: 'chispa|rapido|rapida', enfoque: 'enfoque|equilibrado|equilibrada|normal|medio', profundo: 'profundo|profunda' }
const ONCE_RX = /(?:solo|nada mas) (?:para |por )?(?:esta|esa) (?:pregunta|vez|respuesta|consulta)|solo esta vez|por esta vez|para esta pregunta/
/**
 * Parses tier commands (strict, at the start of the utterance). "modo enfoque" alone is the WORK MODE → null.
 *   "Ivi, usa nivel Profundo"                              → { tier:'profundo', scope:'persistent', rest:'' }
 *   "usa Profundo solo para esta pregunta: ¿conviene…?"    → { tier:'profundo', scope:'once', rest:'¿conviene…?' }
 *   "piensa a fondo: ¿…?"                                  → { tier:'profundo', scope:'once', rest:'¿…?' }
 */
export function parseTierCommand(text) {
  const raw = String(text || '').replace(/^\s*(?:oye |hey |ok )?(?:ivi|ivy|evie|evi|libi|liby)[\s,.:]*/i, '').trim()
  const t = n(raw); if (!t) return null
  const colon = raw.indexOf(':'), head = n(colon >= 0 ? raw.slice(0, colon) : raw)
  let tier = null, explicitLevel = false
  if (/^piensa (?:muy )?a fondo\b/.test(head) || /^(?:razona|analiza) (?:a fondo|en profundo)\b/.test(head)) tier = 'profundo'
  else {
    for (const id of TIER_IDS) {
      const lvl = new RegExp('^(?:por favor )?(?:usa|usar|cambia(?: a| al)?|cambiate a|pasa(?: a| al)?|pon(?:te)?(?: en)?|activa|responde(?: en| con)?|razona(?: en| con)?|configura|quiero)? ?(?:el |la )?(nivel|ia|razonamiento|modo)? ?(?:de ia |de razonamiento )?(?:en |a )?(' + TIER_WORD[id] + ')\\b')
      const m = head.match(lvl)
      if (!m) continue
      const kind = m[1] || ''
      if (id === 'enfoque' && (kind === 'modo' || !kind)) continue // "modo enfoque" / "enfoque" = work mode
      if (/^(?:normal|medio|rapido|rapida|equilibrad[oa])$/.test(m[2]) && !['nivel', 'ia', 'razonamiento'].includes(kind)) continue
      if (!kind && !/^(?:usa|usar|cambia|cambiate|pasa|pon|activa|responde|razona|configura|quiero)/.test(head) && head !== m[2]) continue
      tier = id; explicitLevel = !!kind; break
    }
  }
  if (!tier) return null
  const once = ONCE_RX.test(t) || (/^piensa/.test(head) && colon >= 0)
  let rest = colon >= 0 ? raw.slice(colon + 1).trim() : ''
  if (!rest && once) { const m = raw.match(/(?:solo|nada m[aá]s) (?:para |por )?(?:esta|esa) (?:pregunta|vez|respuesta|consulta)[\s,]*(.*)$|(?:solo esta vez|por esta vez|para esta pregunta)[\s,]*(.*)$/i); rest = (m?.[1] || m?.[2] || '').trim() }
  return { tier, scope: once ? 'once' : 'persistent', rest: rest.slice(0, 4000), explicit_level: explicitLevel }
}
/** Optional suggestion (never an override): a quick tier on a question that looks complex. */
export function suggestTier(tier, text) {
  if (tier === 'profundo') return null
  const t = n(text)
  const complex = t.length > 260 || /\b(analiza|analisis|compara|estrategia|plan de negocio|pros y contras|explica a detalle|paso a paso|optimiza|diagnostica|proyeccion|presupuesto anual|por que crees)\b/.test(t)
  return complex ? 'profundo' : null
}
