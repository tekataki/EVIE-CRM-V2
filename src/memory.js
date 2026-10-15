// EVIE memory ("Memoria de Ivi"): private, per-account, user-controlled.
// Two kinds of data, both in D1 (AUTH_DB) and keyed ONLY by the authenticated session's owner id:
//  1. evie_memories  — explicit facts/preferences the user asked EVIE to keep ("Ivi, recuerda que…").
//  2. evie_sessions  — OPTIONAL bounded summaries of past EVIE conversations (opt-in, never Kisha, never
//                      private-mode turns), used to answer "¿recuerdas lo que te pregunté ayer?".
// Text is sealed with AES-GCM (EVIE_SESSION_KEY). Search keys/topics are truncated HMAC-SHA-256 hashes of
// normalized keywords, so D1 never holds plaintext. Retrieved items reach the model as quoted user data
// with source + date — never as instructions.
import { Hono } from 'hono'

export const MEMORY_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS evie_memory_settings (owner_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS evie_memories (owner_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('preference','fact','priority','person','other')), category TEXT NOT NULL DEFAULT 'general', topic TEXT NOT NULL DEFAULT '', data TEXT NOT NULL, keys TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'explicit', source_session TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id))",
  "CREATE INDEX IF NOT EXISTS idx_evie_memories_owner_topic ON evie_memories(owner_id, topic)",
  "CREATE TABLE IF NOT EXISTS evie_sessions (owner_id TEXT NOT NULL, id TEXT NOT NULL, day TEXT NOT NULL, started_at INTEGER NOT NULL, data TEXT NOT NULL, keys TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id))",
  "CREATE INDEX IF NOT EXISTS idx_evie_sessions_owner_day ON evie_sessions(owner_id, day)"
]
const ready = new WeakMap()
export function ensureMemorySchema(db) { if (!db) return Promise.resolve(); let p = ready.get(db); if (!p) { p = (async () => { for (const sql of MEMORY_SCHEMA) await db.prepare(sql).bind().run() })().catch((e) => { ready.delete(db); throw e }); ready.set(db, p) } return p }

export const LIMITS = { memories: 200, memoryText: 280, sessions: 400, sessionSummary: 600, questions: 6, questionText: 200, contextFacts: 6, contextSessions: 2, contextChars: 1800 }
export const KINDS = ['preference', 'fact', 'priority', 'person', 'other']
export const SENSITIVE = ['health', 'emotional', 'location', 'kisha']
export const DEFAULT_SETTINGS = { enabled: true, use_memories: true, reference_history: false, save_history: false, allow_health: false, allow_emotional: false, timezone: 'America/Mexico_City' }

// ---------- pure helpers (exported for tests) ----------
const STOP = new Set('a al ante bajo con de del desde el en entre es esta este esto hacia hasta la las lo los me mi mis para por que se sin sobre su sus te tu tus un una uno unos unas y o u ya yo tú él ella nos le les ivi ivy evie recuerda recuerdas olvida que qué cual cuál como cómo cuando cuándo donde dónde hoy ayer mañana favor porfa'.split(' '))
export function normalize(text) { return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim() }
export function keywords(text, max = 24) { const out = []; for (const w of normalize(text).split(' ')) { if (w.length < 3 || STOP.has(w)) continue; const k = w.length > 5 ? w.slice(0, w.length - (/(es|s)$/.test(w) ? (w.endsWith('es') ? 2 : 1) : 0)) : w; if (!out.includes(k)) out.push(k); if (out.length >= max) break } return out }
export function clean(text, max) { return String(text ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) }
// Conservative sensitivity detector: health, emotions or a precise place.
export function sensitivity(text) {
  const t = normalize(text)
  if (/\b(diabet|presion arterial|medicament|pastilla|diagnost|enfermedad|alergi|embaraz|terapia|psiquiatr|depresi|ansiedad|cirugia|sintoma|peso|kilos|calori|dieta|salud)/.test(t)) return 'health'
  if (/\b(me siento|triste|llore|deprimid|angusti|enojad|sola|solo y|me duele el alma|suicid|autoles)/.test(t)) return 'emotional'
  if (/\b(vivo en|mi casa esta|mi direccion|calle\s+\w+\s+\d+|numero exterior|coordenada|latitud|longitud|ubicacion exacta)/.test(t)) return 'location'
  return null
}
// Topic = stable key used to supersede contradictory facts ("mi color favorito es azul" → "…es verde").
export function topicOf(text) {
  const t = normalize(text)
  const m = t.match(/^(?:que\s+)?(?:mi|mis)\s+([a-zñ]+(?:\s+(?:favorit[oa]s?|preferid[oa]s?|de\s+[a-zñ]+))?)\s+(?:es|son|sera|se llama|esta)\b/)
  if (m) return 'mi ' + m[1].trim()
  if (/^(?:que\s+)?(?:me llamo|me gusta que me digan|prefiero que me digas|dime|llamame)\b/.test(t)) return 'nombre preferido'
  const r = t.match(/^(?:que\s+)?(?:prefiero|me gusta|no me gusta|odio)\s+([a-zñ]+(?:\s+[a-zñ]+)?)/); if (r) return 'gusto ' + r[1]
  if (/^(?:que\s+)?(?:trabajo|estudio)\s+(?:en|como)\b/.test(t)) return 'ocupacion'
  return ''
}
export function kindOf(text) { const t = normalize(text); if (/^(?:que\s+)?(?:prefiero|me gusta|no me gusta|dime|llamame|hablame|responde)/.test(t)) return 'preference'; if (/priorid|meta|objetivo|quiero lograr/.test(t)) return 'priority'; if (/\b(mi (mama|papa|herman|novi|espos|amig|jefe|hij))/.test(t)) return 'person'; return 'fact' }
export function localDay(tz, now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now) }
export function shiftDay(day, delta) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10) }
const DAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }
/** Day a recall question points to, in the user's zone; null when it names no day. */
export function recallDay(question, tz, now = new Date()) {
  const t = normalize(question), today = localDay(tz, now)
  if (/\banteayer\b/.test(t)) return shiftDay(today, -2)
  if (/\bayer\b/.test(t)) return shiftDay(today, -1)
  if (/\bhoy\b|\besta manana\b|\bhace rato\b/.test(t)) return today
  const m = t.match(/\bel (domingo|lunes|martes|miercoles|jueves|viernes|sabado)( pasado)?\b/)
  if (m) { const wd = new Date(today + 'T12:00:00Z').getUTCDay(); let back = (wd - DAYS[m[1]] + 7) % 7; if (back === 0) back = 7; return shiftDay(today, -back) }
  const d = t.match(/\bhace (\d{1,2}) dias\b/); if (d) return shiftDay(today, -Number(d[1]))
  return null
}
const hmacKeys = new Map()
async function hkey(secret) { let k = hmacKeys.get(secret); if (!k) { k = await crypto.subtle.importKey('raw', new TextEncoder().encode('evie-memory-index:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); hmacKeys.set(secret, k) } return k }
export async function hashKeys(words, secret) { const k = await hkey(secret), out = []; for (const w of words) { const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(w))); out.push([...sig.slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('')) } return out }
const hk = async (env, text, max) => (await hashKeys(keywords(text, max), env.EVIE_SESSION_KEY)).join(' ')
const ht = async (env, topic) => topic ? (await hashKeys([topic], env.EVIE_SESSION_KEY))[0] : ''
export function score(queryKeys, rowKeys) { if (!queryKeys.length) return 0; const set = new Set(String(rowKeys || '').split(' ').filter(Boolean)); let s = 0; for (const k of queryKeys) if (set.has(k)) s += 1; return s / Math.sqrt(queryKeys.length) }
export function cleanSettings(input) { const o = { ...DEFAULT_SETTINGS }; if (input && typeof input === 'object' && !Array.isArray(input)) { for (const k of ['enabled', 'use_memories', 'reference_history', 'save_history', 'allow_health', 'allow_emotional']) if (typeof input[k] === 'boolean') o[k] = input[k]; if (typeof input.timezone === 'string' && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(input.timezone)) { try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); o.timezone = input.timezone } catch {} } } if (!o.enabled) { o.use_memories = false; o.reference_history = false; o.save_history = false } return o }
export function contextBlock({ facts = [], sessions = [] }, max = LIMITS.contextChars) {
  const lines = []
  for (const f of facts) lines.push(`- [recuerdo ${f.updated_day}${f.source === 'conversation' ? ', de una conversación' : ''}] ${f.text}`)
  for (const s of sessions) lines.push(`- [conversación del ${s.day}] Preguntaste: ${s.questions.map((q) => '«' + q + '»').join('; ')}.${s.summary ? ' Resumen: ' + s.summary : ''}`)
  let out = ''; for (const l of lines) { if ((out + l + '\n').length > max) break; out += l + '\n' }
  return out.trim() || null
}
export const ID = /^[a-z0-9][a-z0-9-]{7,63}$/
const newId = (p) => p + '-' + crypto.randomUUID()
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function human(day) { const [y, m, d] = day.split('-').map(Number); return `${d} de ${MONTHS[m - 1]} de ${y}` }

// ---------- storage ----------
export async function settingsOf(env, owner, unseal) { const row = await env.AUTH_DB.prepare('SELECT data FROM evie_memory_settings WHERE owner_id=?').bind(owner).first(); if (!row?.data) return { ...DEFAULT_SETTINGS }; try { return cleanSettings(await unseal(row.data, env.EVIE_SESSION_KEY)) } catch { return { ...DEFAULT_SETTINGS } } }
export async function listMemories(env, owner, unseal) {
  const { results = [] } = await env.AUTH_DB.prepare('SELECT id,kind,category,data,keys,source,source_session,created_at,updated_at FROM evie_memories WHERE owner_id=? ORDER BY updated_at DESC LIMIT ?').bind(owner, LIMITS.memories).all()
  const out = []; for (const r of results) { try { const d = await unseal(r.data, env.EVIE_SESSION_KEY); out.push({ id: r.id, kind: r.kind, category: r.category, topic: topicOf(d.text), text: d.text, source: r.source, source_session: r.source_session || null, created_at: r.created_at, updated_at: r.updated_at, keys: r.keys }) } catch {} }
  return out
}
export async function listSessions(env, owner, unseal, { day = null, limit = 60 } = {}) {
  const q = day ? env.AUTH_DB.prepare('SELECT id,day,started_at,data,keys FROM evie_sessions WHERE owner_id=? AND day=? ORDER BY started_at ASC LIMIT ?').bind(owner, day, limit) : env.AUTH_DB.prepare('SELECT id,day,started_at,data,keys FROM evie_sessions WHERE owner_id=? ORDER BY started_at DESC LIMIT ?').bind(owner, limit)
  const { results = [] } = await q.all(); const out = []
  for (const r of results) { try { const d = await unseal(r.data, env.EVIE_SESSION_KEY); out.push({ id: r.id, day: r.day, started_at: r.started_at, questions: d.questions || [], summary: d.summary || '', keys: r.keys }) } catch {} }
  return out
}
/** Upsert an explicit memory. Same topic ⇒ old fact superseded in place; exact duplicates touched, not stacked. */
export async function remember(env, owner, seal, unseal, { text, kind, category = 'general', source = 'explicit', source_session = null, confirm_sensitive = false }, settings) {
  const t = clean(text, LIMITS.memoryText); if (t.length < 3) return { error: 'Dime qué quieres que recuerde.' }
  const sens = sensitivity(t)
  if (sens) {
    if (sens === 'location') return { refused: true, category: sens, error: 'Por privacidad no guardo ubicaciones exactas ni direcciones como recuerdo. Puedes guardar un lugar favorito en Mapa si quieres.' }
    const allowed = (sens === 'health' && settings.allow_health) || (sens === 'emotional' && settings.allow_emotional)
    if (!allowed) return { needs_permission: true, category: sens, error: sens === 'health' ? 'Eso parece información de salud. Para guardarla, activa «Recordar datos de salud» en Configuración personalizada → Memoria y vuelve a pedírmelo.' : 'Eso parece algo emocional o personal. Para guardarlo, activa «Recordar temas emocionales» en Memoria y vuelve a pedírmelo.' }
    if (!confirm_sensitive) return { needs_confirmation: true, category: sens, text: t, error: 'Es un dato sensible. Revísalo y confírmalo en pantalla antes de guardarlo.' }
    category = sens
  }
  const k = KINDS.includes(kind) ? kind : kindOf(t), topic = topicOf(t), topicH = await ht(env, topic), keys = await hk(env, t), now = Date.now(), sealed = await seal({ text: t }, env.EVIE_SESSION_KEY)
  if (topicH) {
    const prev = await env.AUTH_DB.prepare('SELECT id FROM evie_memories WHERE owner_id=? AND topic=?').bind(owner, topicH).first()
    if (prev) { await env.AUTH_DB.prepare('UPDATE evie_memories SET data=?,keys=?,kind=?,category=?,source=?,source_session=?,updated_at=? WHERE owner_id=? AND id=?').bind(sealed, keys, k, category, source, source_session, now, owner, prev.id).run(); return { id: prev.id, text: t, topic, superseded: true } }
  }
  for (const m of await listMemories(env, owner, unseal)) if (normalize(m.text) === normalize(t)) { await env.AUTH_DB.prepare('UPDATE evie_memories SET updated_at=? WHERE owner_id=? AND id=?').bind(now, owner, m.id).run(); return { id: m.id, text: t, duplicate: true } }
  const count = await env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM evie_memories WHERE owner_id=?').bind(owner).first()
  if ((count?.n || 0) >= LIMITS.memories) return { error: 'Llegaste al máximo de recuerdos. Borra alguno en Configuración personalizada → Memoria.' }
  const id = newId('m'); await env.AUTH_DB.prepare('INSERT INTO evie_memories(owner_id,id,kind,category,topic,data,keys,source,source_session,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(owner, id, k, category, topicH, sealed, keys, source, source_session, now, now).run()
  return { id, text: t, topic, created: true }
}
/** Forget by id, or by best keyword match. Ambiguous ⇒ candidates instead of deleting a guess. */
export async function forget(env, owner, unseal, { id, query }) {
  if (id) { if (!ID.test(id)) return { error: 'Recuerdo inválido.' }; const r = await env.AUTH_DB.prepare('DELETE FROM evie_memories WHERE owner_id=? AND id=?').bind(owner, id).run(); return r.meta?.changes ? { deleted: [id] } : { error: 'Ese recuerdo no existe.' } }
  const words = keywords(query || ''); if (!words.length) return { error: 'Dime qué quieres que olvide.' }
  const qk = await hashKeys(words, env.EVIE_SESSION_KEY), all = await listMemories(env, owner, unseal)
  const ranked = all.map((m) => ({ m, s: score(qk, m.keys) + (m.topic && normalize(query).includes(m.topic) ? 1 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
  if (!ranked.length) return { not_found: true, error: 'No tengo guardado nada sobre eso.' }
  if (ranked.length > 1 && ranked[1].s >= ranked[0].s * 0.85) return { ambiguous: true, candidates: ranked.slice(0, 4).map((x) => ({ id: x.m.id, text: x.m.text })) }
  await env.AUTH_DB.prepare('DELETE FROM evie_memories WHERE owner_id=? AND id=?').bind(owner, ranked[0].m.id).run()
  return { deleted: [ranked[0].m.id], text: ranked[0].m.text }
}
/** Retrieval for one assistant request: a few relevant facts + (opt-in) at most 2 past sessions. */
export async function retrieve(env, owner, unseal, question, settings, now = new Date()) {
  if (!settings.enabled) return { facts: [], sessions: [] }
  const qk = await hashKeys(keywords(question), env.EVIE_SESSION_KEY), facts = []
  if (settings.use_memories) {
    const all = (await listMemories(env, owner, unseal)).filter((m) => !SENSITIVE.includes(m.category) || (m.category === 'health' && settings.allow_health && /salud|gym|comida|dieta|peso|ejercicio|medic/i.test(question)) || (m.category === 'emotional' && settings.allow_emotional))
    const pref = all.filter((m) => m.kind === 'preference').slice(0, 2)
    const ranked = all.filter((m) => !pref.includes(m)).map((m) => ({ m, s: score(qk, m.keys) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, LIMITS.contextFacts - pref.length).map((x) => x.m)
    for (const m of [...pref, ...ranked]) facts.push({ id: m.id, text: m.text, source: m.source, source_session: m.source_session, updated_day: localDay(settings.timezone, new Date(m.updated_at)) })
  }
  const sessions = []
  if (settings.reference_history) {
    const day = recallDay(question, settings.timezone, now)
    if (day) { for (const s of (await listSessions(env, owner, unseal, { day, limit: 20 })).slice(0, LIMITS.contextSessions)) sessions.push(s) }
    else if (/recuerdas|te pregunte|te pregunté|te dije|hablamos|platicamos|la otra vez/i.test(question)) { for (const x of (await listSessions(env, owner, unseal, { limit: 60 })).map((s) => ({ s, sc: score(qk, s.keys) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, LIMITS.contextSessions)) sessions.push(x.s) }
  }
  return { facts, sessions: sessions.map((s) => ({ id: s.id, day: s.day, questions: s.questions.slice(0, LIMITS.questions), summary: s.summary })) }
}
/** Deterministic, grounded answer for "¿recuerdas lo que te pregunté ayer?" — never generated by a model. */
export async function recall(env, owner, unseal, question, settings, now = new Date()) {
  const day = recallDay(question, settings.timezone, now) || shiftDay(localDay(settings.timezone, now), -1)
  if (!settings.enabled || !settings.save_history) return { day, stored: false, text: `No guardo un historial de nuestras conversaciones, así que no puedo saber qué me preguntaste el ${human(day)}. Si quieres, activa «Guardar resúmenes de mis conversaciones» en Configuración personalizada → Memoria.` }
  if (!settings.reference_history) return { day, stored: true, text: 'Tus resúmenes de conversación están guardados, pero tienes desactivado que los consulte. Actívalo en Memoria si quieres que te responda con ellos.' }
  const list = await listSessions(env, owner, unseal, { day, limit: 20 })
  if (!list.length) return { day, stored: true, sessions: [], text: `No tengo guardada ninguna conversación del ${human(day)}. Puede que fuera en modo privado o antes de activar la memoria.` }
  const qs = list.flatMap((s) => s.questions).slice(0, 4)
  return { day, stored: true, sessions: list.map((s) => ({ id: s.id, day: s.day, questions: s.questions, summary: s.summary })), text: `El ${human(day)} me preguntaste: ${qs.map((q) => '«' + q + '»').join(', ')}.` }
}

// ---------- API ----------
export function createMemory({ authenticate, seal, unseal }) {
  const api = new Hono()
  const err = (c, m, s = 400) => c.json({ error: m }, s)
  const body = async (c) => { try { const b = await c.req.json(); if (!b || typeof b !== 'object' || Array.isArray(b) || 'owner_id' in b || 'user_id' in b) return null; return b } catch { return null } }
  api.use('*', async (c, next) => { const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401); if (!c.env?.AUTH_DB || !c.env.EVIE_SESSION_KEY) return err(c, 'La memoria no está configurada en el servidor.', 503); await ensureMemorySchema(c.env.AUTH_DB); c.set('owner', s.user.id); await next() })
  api.get('/', async (c) => { const o = c.get('owner'); return c.json({ settings: await settingsOf(c.env, o, unseal), memories: (await listMemories(c.env, o, unseal)).map(({ keys, ...m }) => m), sessions: (await listSessions(c.env, o, unseal, { limit: 100 })).map(({ keys, ...s }) => s) }) })
  api.put('/settings', async (c) => { const b = await body(c); if (!b) return err(c, 'Ajustes inválidos.'); const st = cleanSettings(b.settings ?? b); await c.env.AUTH_DB.prepare('INSERT INTO evie_memory_settings(owner_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(c.get('owner'), await seal(st, c.env.EVIE_SESSION_KEY), Date.now()).run(); return c.json({ settings: st }) })
  api.post('/items', async (c) => { const b = await body(c); if (!b || typeof b.text !== 'string') return err(c, 'Recuerdo inválido.'); const o = c.get('owner'), st = await settingsOf(c.env, o, unseal); if (!st.enabled) return err(c, 'La memoria está desactivada. Actívala en Configuración personalizada → Memoria.', 409); const r = await remember(c.env, o, seal, unseal, { text: b.text, kind: b.kind, source: b.source === 'conversation' ? 'conversation' : 'explicit', source_session: typeof b.source_session === 'string' && ID.test(b.source_session) ? b.source_session : null, confirm_sensitive: b.confirm_sensitive === true }, st); return c.json(r, r.error && !r.needs_permission && !r.needs_confirmation && !r.refused ? 400 : 200) })
  api.patch('/items/:id', async (c) => { const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Recuerdo inválido.'); const b = await body(c); const t = clean(b?.text, LIMITS.memoryText); if (t.length < 3) return err(c, 'Escribe el recuerdo.'); const o = c.get('owner'), st = await settingsOf(c.env, o, unseal), sens = sensitivity(t); if (sens === 'location') return err(c, 'Por privacidad no guardo ubicaciones exactas.'); if (sens && !((sens === 'health' && st.allow_health) || (sens === 'emotional' && st.allow_emotional))) return err(c, 'Ese texto parece sensible; activa la categoría en Memoria para guardarlo.', 409); const r = await c.env.AUTH_DB.prepare('UPDATE evie_memories SET data=?,keys=?,topic=?,category=?,updated_at=? WHERE owner_id=? AND id=?').bind(await seal({ text: t }, c.env.EVIE_SESSION_KEY), await hk(c.env, t), await ht(c.env, topicOf(t)), sens || 'general', Date.now(), o, id).run(); return r.meta?.changes ? c.json({ id, text: t }) : err(c, 'Ese recuerdo no existe.', 404) })
  api.delete('/items/:id', async (c) => { const r = await forget(c.env, c.get('owner'), unseal, { id: c.req.param('id') }); return c.json(r, r.error ? 404 : 200) })
  api.post('/forget', async (c) => { const b = await body(c); if (!b) return err(c, 'Solicitud inválida.'); return c.json(await forget(c.env, c.get('owner'), unseal, { query: clean(b.query, 200) })) })
  api.post('/sessions', async (c) => {
    const b = await body(c); const o = c.get('owner'), st = await settingsOf(c.env, o, unseal)
    if (!st.enabled || !st.save_history) return c.json({ stored: false, reason: 'history_off' })
    if (!b || b.private === true || b.source === 'kisha') return c.json({ stored: false, reason: 'private' })
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : null; if (!id) return err(c, 'Conversación inválida.')
    const questions = (Array.isArray(b.questions) ? b.questions : []).map((q) => clean(q, LIMITS.questionText)).filter((q) => q.length >= 3 && !sensitivity(q)).slice(0, LIMITS.questions)
    if (!questions.length) return c.json({ stored: false, reason: 'empty' })
    const summary = clean(b.summary || '', LIMITS.sessionSummary), started = Number.isSafeInteger(b.started_at) && b.started_at > 0 ? b.started_at : Date.now(), day = localDay(st.timezone, new Date(started))
    await c.env.AUTH_DB.prepare('INSERT INTO evie_sessions(owner_id,id,day,started_at,data,keys,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET data=excluded.data,keys=excluded.keys').bind(o, id, day, started, await seal({ questions, summary }, c.env.EVIE_SESSION_KEY), await hk(c.env, questions.join(' ') + ' ' + summary, 40), Date.now()).run()
    const n = await c.env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM evie_sessions WHERE owner_id=?').bind(o).first()
    if ((n?.n || 0) > LIMITS.sessions) await c.env.AUTH_DB.prepare('DELETE FROM evie_sessions WHERE owner_id=? AND id IN (SELECT id FROM evie_sessions WHERE owner_id=? ORDER BY started_at ASC LIMIT ?)').bind(o, o, n.n - LIMITS.sessions).run()
    return c.json({ stored: true, id, day })
  })
  api.delete('/sessions/:id', async (c) => { const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Conversación inválida.'); const o = c.get('owner'); const r = await c.env.AUTH_DB.prepare('DELETE FROM evie_sessions WHERE owner_id=? AND id=?').bind(o, id).run(); const { results = [] } = await c.env.AUTH_DB.prepare('SELECT id FROM evie_memories WHERE owner_id=? AND source_session=?').bind(o, id).all(); return c.json({ deleted: !!r.meta?.changes, derived_memories: results.map((x) => x.id) }) })
  api.post('/recall', async (c) => { const b = await body(c); const o = c.get('owner'); return c.json(await recall(c.env, o, unseal, clean(b?.question, 300), await settingsOf(c.env, o, unseal))) })
  api.get('/export', async (c) => { const o = c.get('owner'); return c.json({ format: 'evie.memory', version: 1, exported_at: new Date().toISOString(), settings: await settingsOf(c.env, o, unseal), memories: (await listMemories(c.env, o, unseal)).map(({ keys, ...m }) => m), sessions: (await listSessions(c.env, o, unseal, { limit: LIMITS.sessions })).map(({ keys, ...s }) => s) }) })
  api.delete('/', async (c) => { const o = c.get('owner'); for (const t of ['evie_memories', 'evie_sessions', 'evie_memory_settings']) await c.env.AUTH_DB.prepare(`DELETE FROM ${t} WHERE owner_id=?`).bind(o).run(); return c.json({ deleted: true }) })
  return api
}
