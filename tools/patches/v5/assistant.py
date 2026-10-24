# Idempotent v5 patch for src/assistant.js: tiers, budget, metrics, STT bounds, TTS cache privacy fix.
import sys, os
here=os.path.dirname(os.path.abspath(__file__))
p='src/assistant.js';s=open(p).read()
if 'readTier' in s: print('already'); sys.exit()
def rep(old,new):
    global s
    assert s.count(old)==1,(old[:70],s.count(old)); s=s.replace(old,new)
rep("import { retrieve, settingsOf, contextBlock, ensureMemorySchema } from './memory.js'\n",
"import { retrieve, settingsOf, contextBlock, ensureMemorySchema } from './memory.js'\nimport { tierConfig, isTier, DEFAULT_TIER, TIER_IDS, TIER_LABELS, fallbackOf, costMicro, parseTierCommand, suggestTier, WEB_SEARCH_USD } from './tiers.js'\nimport { ensureV5, getSetting, putSetting, observe, rid, percentiles } from './v5-schema.js'\n")
rep("  limits: { chat: 150, stt_seconds: 1800, tts_chars: 40000, web_search: 25, weather: 60 }\n})",
"  limits: { chat: 150, stt_seconds: 1800, tts_chars: 40000, web_search: 25, weather: 60, profundo: 25 },\n  // Spend guardrails (USD). Per account per UTC day, and for the whole deployment per UTC day.\n  budget: { account_daily_usd: 0.40, global_daily_usd: 1.00 },\n  guestLimits: { chat: 40, stt_seconds: 600, tts_chars: 8000, web_search: 5, weather: 20, profundo: 0 }\n})")
rep("export function limits(env) { try { return { ...DEFAULTS.limits, ...JSON.parse(env.EVIE_DAILY_LIMITS || '{}') } } catch { return DEFAULTS.limits } }",
"export function limits(env, role = 'owner') { let o = {}; try { o = JSON.parse(env.EVIE_DAILY_LIMITS || '{}') } catch {} const base = { ...DEFAULTS.limits, ...o }; return role === 'guest' ? { ...base, ...DEFAULTS.guestLimits } : base }\nexport function budget(env) { const a = Number(env?.EVIE_BUDGET_ACCOUNT_DAILY_USD), g = Number(env?.EVIE_BUDGET_GLOBAL_DAILY_USD); return { account_daily_usd: Number.isFinite(a) && a > 0 ? a : DEFAULTS.budget.account_daily_usd, global_daily_usd: Number.isFinite(g) && g > 0 ? g : DEFAULTS.budget.global_daily_usd } }\n/** Stored reasoning tier for the account (never the work mode). */\nexport async function readTier(env, owner) { if (!env?.AUTH_DB) return DEFAULT_TIER; try { await ensureV5(env.AUTH_DB); const v = await getSetting(env, owner, 'ai_reasoning_tier'); return isTier(v) ? v : DEFAULT_TIER } catch { return DEFAULT_TIER } }")
a=s.index("  api.post('/chat', async (c) => {"); b=s.index("  api.post('/stt'")
s=s[:a]+open(os.path.join(here,'chat_block.js')).read()+s[b:]
rep("export function instructions({ name, today, timezone, currency, profile = null, web = false, memory = null, privateMode = false }) {",
"export function instructions({ name, today, timezone, currency, profile = null, web = false, memory = null, privateMode = false, tier = 'enfoque', guest = false }) {")
rep("  if (privateMode) lines.push(",
"""  if (tier === 'chispa') lines.push('Nivel de IA: Chispa (rápido). Responde en 1–2 frases; usa herramientas solo si son necesarias.')
  else if (tier === 'profundo') lines.push('Nivel de IA: Profundo. Razona con cuidado, considera alternativas y riesgos; aun así, la respuesta hablada debe ser clara y breve, con detalle opcional en texto.')
  lines.push('Si te preguntan por el nivel de IA: hay tres (Chispa, Enfoque, Profundo) y son independientes de los modos de trabajo (enfoque, gym, negocio, cierre, noche). Nunca cambies el nivel por tu cuenta.')
  if (guest) lines.push('Esta es una cuenta de INVITADO temporal (72 h). No tiene acceso a datos del propietario; sus datos se borrarán al expirar. No ofrezcas automatizaciones del propietario.')
  if (privateMode) lines.push(""")
rep("    const env = c.env || {}, lim = limits(env), used = {}","    const env = c.env || {}, lim = limits(env, s.user.role), used = {}")
rep("    // Groq bills a minimum of 10 seconds per request.\n    const seconds = Math.min(60, Math.max(10, Math.ceil(Number(c.req.header('X-Evie-Duration')) || 10)))\n    if (await usage(env, s.user.id, 'stt_seconds') + seconds > limits(env).stt_seconds) return err(c, 'Llegaste al límite diario de voz. Puedes escribirle a EVIE.', 429)\n    const audio = await c.req.arrayBuffer(); if (audio.byteLength < 200) return err(c, 'No se escuchó audio.')",
"""    // Groq bills a minimum of 10 seconds per request. v5: metering uses the LARGER of the declared duration and a
    // conservative size estimate (1 s per 32 KB), so long clips are no longer under-reported (old cap: 60 s).
    // One request is bounded to STT_MAX_SECONDS; longer dictation is sent as overlapping chunks by the client.
    const audio = await c.req.arrayBuffer(); if (audio.byteLength < 200) return err(c, 'No se escuchó audio.')
    const declared = Math.ceil(Number(c.req.header('X-Evie-Duration')) || 0), bySize = Math.ceil(audio.byteLength / 32768)
    if (declared > STT_MAX_SECONDS + 5) return c.json({ error: `Cada fragmento de audio puede durar hasta ${STT_MAX_SECONDS} s. Para dictados largos EVIE lo divide en partes automáticamente.`, code: 'chunk_too_long', max_seconds: STT_MAX_SECONDS }, 413)
    const seconds = Math.max(10, declared, Math.min(bySize, STT_MAX_SECONDS))
    if (await usage(env, s.user.id, 'stt_seconds') + seconds > limits(env, s.user.role).stt_seconds) return err(c, 'Llegaste al límite diario de voz. Puedes escribirle a EVIE.', 429)
    const chunk = Number(c.req.header('X-Evie-Chunk')), ts0 = Date.now()""")
rep("    const j = await r.json(); return c.json({ text: String(j.text || '').trim().slice(0, 4000) })",
"""    const j = await r.json(); await observe(env, s.user.id, 'stt', Date.now() - ts0)
    // Audio is never stored (request memory only). Full transcript returned, bounded by STT_MAX_CHARS (was 4000).
    return c.json({ text: String(j.text || '').trim().slice(0, STT_MAX_CHARS), billed_seconds: seconds, ...(Number.isInteger(chunk) && chunk >= 0 && chunk < 200 ? { chunk } : {}) })""")
rep("    if (await usage(env, s.user.id, 'tts_chars') + text.length > limits(env).tts_chars)","    if (await usage(env, s.user.id, 'tts_chars') + text.length > limits(env, s.user.role).tts_chars)")
rep("    const cache = globalThis.caches?.default\n    const key = new Request('https://evie-tts.cache/' + model + '/' + voice + '/' + encodeURIComponent(text))\n    const hit = cache ? await cache.match(key) : null",
"""    // Privacy fix (v5): the cache key used to contain the spoken text (URL-encoded) in a deployment-wide cache.
    // Now ONLY generic allow-listed phrases are cached, under an HMAC key (no text, not reversible).
    const cache = cacheablePhrase(text) && env.EVIE_SESSION_KEY ? globalThis.caches?.default : null
    const key = cache ? new Request('https://evie-tts.cache/v2/' + await ttsCacheKey(env.EVIE_SESSION_KEY, model, voice, text)) : null
    const hit = cache ? await cache.match(key) : null""")
rep("    if (cache && text.length <= 160) {","    if (cache && key) {")
rep("const OPENAI_URL = 'https://api.openai.com/v1/responses'",
"""const OPENAI_URL = 'https://api.openai.com/v1/responses'
export const STT_MAX_SECONDS = 90
export const STT_MAX_CHARS = 12000
// Generic phrases safe to cache (no names, numbers, amounts, places or user content).
const TTS_CACHEABLE = /^(?:listo\\.?|hecho\\.?|de acuerdo\\.?|claro\\.?|perfecto\\.?|un momento\\.?|dame un segundo\\.?|no te escuché bien\\.?|¿me lo repites\\?|te dejé la propuesta en pantalla\\.?(?: confírmala para guardarla\\.)?|cerré la tarjeta\\.?|no hay tarjetas abiertas\\.?|listo, cerré todas las tarjetas\\. tus datos siguen intactos\\.|estoy pensando\\.?|buscando\\.?)$/i
export function cacheablePhrase(text) { const t = String(text || '').trim(); return t.length <= 80 && !/\\d/.test(t) && TTS_CACHEABLE.test(t) }
export async function ttsCacheKey(secret, model, voice, text) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('evie-tts-cache:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(model + '\\n' + voice + '\\n' + text.trim().toLowerCase())))
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('')
}""")
open(p,'w').write(s); print('patched')
