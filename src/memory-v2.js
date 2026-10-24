// EVIE v5 · Memoria v2 (aditiva sobre evie_memories; misma cifra AES-GCM y mismos índices HMAC).
// Tipos: fact | project_context | current_plan | dated_summary. Proyecto (hash HMAC, etiqueta sellada),
// procedencia, confianza, sensibilidad e HISTORIAL DE EDICIONES (sellado, máx. 10). Recuperación léxica híbrida:
// coincidencia exacta de claves + prefijos (raíces) + proyecto + recencia + tipo. Admite incertidumbre: devuelve
// `confidence` y `uncertain`. Respeta opt-ins (settings) y el modo incógnito (private:true ⇒ no lee ni escribe).
// Registros v1 existentes siguen funcionando: columnas nuevas con DEFAULT ('fact', confianza 1).
import { Hono } from 'hono'
import { ensureV5, clean, readBody } from './v5-schema.js'
import { settingsOf, sensitivity, keywords, hashKeys, localDay, recallDay, human, normalize, ID, LIMITS } from './memory.js'

export const MTYPES = ['fact', 'project_context', 'current_plan', 'dated_summary']
export const TYPE_LABEL = { fact: 'Dato', project_context: 'Contexto de proyecto', current_plan: 'Plan actual', dated_summary: 'Resumen fechado' }
const HISTORY_MAX = 10
const prefixes = (words) => [...new Set(words.filter((w) => w.length >= 5).map((w) => 'p:' + w.slice(0, 5)))]
async function index(env, text) { const w = keywords(text, 30); return (await hashKeys([...w, ...prefixes(w)], env.EVIE_SESSION_KEY)).join(' ') }
export async function projectKey(env, label) { const p = normalize(label).slice(0, 60); return p ? (await hashKeys(['project:' + p], env.EVIE_SESSION_KEY))[0] : '' }
/** Detects "sobre SOMA", "del proyecto Alvento", "de SOMA" → project label (or null). */
export function projectOf(text) { const m = String(text || '').match(/\b(?:sobre|del proyecto|proyecto|de|para)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ-]{1,30})/); return m ? m[1] : null }
/** Hybrid lexical score in [0, ~3]: exact keys, stem prefixes, project match, recency (30-day half-life), type weight. */
export function hybridScore({ qKeys, qPrefix, rowKeys, projectMatch, ageDays, mtype, confidence = 1 }) {
  const set = new Set(String(rowKeys || '').split(' ').filter(Boolean))
  const exact = qKeys.length ? qKeys.filter((k) => set.has(k)).length / Math.sqrt(qKeys.length) : 0
  const pre = qPrefix.length ? qPrefix.filter((k) => set.has(k)).length / Math.sqrt(qPrefix.length) * 0.5 : 0
  const base = exact + pre + (projectMatch ? 1 : 0)
  if (base <= 0) return 0
  const recency = Math.pow(0.5, Math.max(0, ageDays) / 30)
  const tw = mtype === 'current_plan' ? 1.15 : mtype === 'project_context' ? 1.1 : 1
  return (base + 0.3 * recency) * tw * (0.5 + 0.5 * confidence)
}
async function rows(env, owner, unseal) {
  const { results = [] } = await env.AUTH_DB.prepare('SELECT id,kind,category,data,keys,source,source_session,created_at,updated_at,mtype,project,confidence,sensitivity FROM evie_memories WHERE owner_id=? ORDER BY updated_at DESC LIMIT ?').bind(owner, LIMITS.memories).all()
  const out = []
  for (const r of results) { try { const d = await unseal(r.data, env.EVIE_SESSION_KEY); out.push({ ...r, text: d.text, project_label: d.project_label || null, history: Array.isArray(d.history) ? d.history : [], day: d.day || null }) } catch {} }
  return out
}
const view = (r, tz) => ({ id: r.id, type: r.mtype || 'fact', type_label: TYPE_LABEL[r.mtype || 'fact'], text: r.text, project: r.project_label, day: r.day, source: r.source, confidence: r.confidence ?? 1, sensitivity: r.sensitivity || 'normal', edits: r.history.length, created_day: localDay(tz, new Date(r.created_at)), updated_day: localDay(tz, new Date(r.updated_at)) })

/** Search for the assistant / "¿te acuerdas…?" with uncertainty. */
export async function search(env, owner, unseal, question, settings, now = new Date()) {
  if (!settings.enabled || !settings.use_memories) return { items: [], disabled: true }
  const w = keywords(question), qKeys = await hashKeys(w, env.EVIE_SESSION_KEY), qPrefix = await hashKeys(prefixes(w), env.EVIE_SESSION_KEY)
  const plabel = projectOf(question), pk = plabel ? await projectKey(env, plabel) : ''
  const day = recallDay(question, settings.timezone, now)
  const all = (await rows(env, owner, unseal)).filter((m) => !['health', 'emotional'].includes(m.category) || (m.category === 'health' && settings.allow_health) || (m.category === 'emotional' && settings.allow_emotional))
  const scored = all.map((m) => {
    const ageDays = (now.getTime() - m.updated_at) / 86400000
    let s = hybridScore({ qKeys, qPrefix, rowKeys: m.keys, projectMatch: !!pk && m.project === pk, ageDays, mtype: m.mtype, confidence: m.confidence ?? 1 })
    if (day && s > 0) s *= (m.day === day || localDay(settings.timezone, new Date(m.updated_at)) === day) ? 1.5 : 0.6
    return { m, s }
  }).filter((x) => x.s > 0.35).sort((a, b) => b.s - a.s).slice(0, 6)
  const items = scored.map(({ m, s }) => ({ ...view(m, settings.timezone), score: Math.round(s * 100) / 100 }))
  const best = scored[0]?.s || 0
  return { items, project: plabel, day, uncertain: !items.length || best < 0.9 || (scored[1] && scored[1].s > best * 0.9 && scored[1].m.text !== scored[0].m.text), note: !items.length ? 'No tengo nada guardado que coincida; no lo voy a inventar.' : best < 0.9 ? 'Coincidencia débil: confírmalo antes de usarlo.' : null }
}

export function createMemoryV2({ authenticate, seal, unseal }) {
  const api = new Hono()
  const err = (c, m, s = 400, extra = {}) => c.json({ error: m, ...extra }, s)
  api.use('*', async (c, next) => { const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401); if (!c.env?.AUTH_DB || !c.env.EVIE_SESSION_KEY) return err(c, 'La memoria no está configurada.', 503); await ensureV5(c.env.AUTH_DB); c.set('owner', s.user.id); await next() })
  const settings = (c) => settingsOf(c.env, c.get('owner'), unseal)
  api.get('/', async (c) => {
    const st = await settings(c), list = await rows(c.env, c.get('owner'), unseal), q = c.req.query()
    let items = list.map((r) => view(r, st.timezone))
    if (q.type && MTYPES.includes(q.type)) items = items.filter((x) => x.type === q.type)
    if (q.project) items = items.filter((x) => normalize(x.project || '') === normalize(q.project))
    return c.json({ settings: st, types: MTYPES.map((t) => ({ id: t, label: TYPE_LABEL[t] })), projects: [...new Set(list.map((r) => r.project_label).filter(Boolean))], items })
  })
  // Create a typed memory. Incognito (private:true) never writes. Sensitive content needs the opt-in + confirmation.
  api.post('/items', async (c) => {
    const b = await readBody(c); if (!b || typeof b.text !== 'string') return err(c, 'Recuerdo inválido.')
    if (b.private === true) return c.json({ stored: false, reason: 'incognito', say: 'Estás en modo incógnito: no guardo nada.' })
    const st = await settings(c); if (!st.enabled) return err(c, 'La memoria está desactivada.', 409)
    const text = clean(b.text, LIMITS.memoryText); if (text.length < 3) return err(c, 'Dime qué quieres que recuerde.')
    const type = MTYPES.includes(b.type) ? b.type : 'fact'
    const sens = sensitivity(text)
    if (sens === 'location') return c.json({ refused: true, error: 'Por privacidad no guardo direcciones ni ubicaciones exactas.' })
    if (sens && !((sens === 'health' && st.allow_health) || (sens === 'emotional' && st.allow_emotional))) return c.json({ needs_permission: true, category: sens, error: 'Es un dato sensible: activa esa categoría en Memoria para guardarlo.' })
    if (sens && b.confirm_sensitive !== true) return c.json({ needs_confirmation: true, category: sens, text })
    const plabel = b.project ? clean(b.project, 40) : projectOf(text), pk = plabel ? await projectKey(c.env, plabel) : ''
    const day = type === 'dated_summary' ? (/^\d{4}-\d{2}-\d{2}$/.test(b.day || '') ? b.day : localDay(st.timezone)) : null
    const conf = Number.isFinite(b.confidence) ? Math.max(0.1, Math.min(1, b.confidence)) : (b.source === 'inferred' ? 0.6 : 1)
    const count = await c.env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM evie_memories WHERE owner_id=?').bind(c.get('owner')).first()
    if ((count?.n || 0) >= LIMITS.memories) return err(c, 'Llegaste al máximo de recuerdos.', 409)
    const id = 'm-' + crypto.randomUUID(), now = Date.now()
    await c.env.AUTH_DB.prepare('INSERT INTO evie_memories(owner_id,id,kind,category,topic,data,keys,source,source_session,created_at,updated_at,mtype,project,confidence,sensitivity) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(c.get('owner'), id, 'fact', sens || 'general', '', await seal({ text, project_label: plabel || null, history: [], day }, c.env.EVIE_SESSION_KEY), await index(c.env, text + ' ' + (plabel || '')), ['explicit', 'conversation', 'inferred'].includes(b.source) ? b.source : 'explicit', null, now, now, type, pk, conf, sens || 'normal').run()
    return c.json({ id, type, project: plabel || null, confidence: conf, created: true }, 201)
  })
  // "Ivi, corrige: …" — replaces the text, keeps a sealed edit history (provenance), bumps confidence to 1.
  api.post('/items/:id/correct', async (c) => {
    const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Recuerdo inválido.')
    const b = await readBody(c); const text = clean(b?.text, LIMITS.memoryText); if (text.length < 3) return err(c, 'Escribe la corrección.')
    const st = await settings(c), sens = sensitivity(text)
    if (sens === 'location') return err(c, 'Por privacidad no guardo ubicaciones exactas.')
    if (sens && !((sens === 'health' && st.allow_health) || (sens === 'emotional' && st.allow_emotional))) return err(c, 'Ese texto parece sensible; activa la categoría en Memoria.', 409)
    const r = (await rows(c.env, c.get('owner'), unseal)).find((x) => x.id === id); if (!r) return err(c, 'Ese recuerdo no existe.', 404)
    const history = [...r.history, { text: r.text, at: r.updated_at, source: r.source }].slice(-HISTORY_MAX)
    await c.env.AUTH_DB.prepare('UPDATE evie_memories SET data=?,keys=?,confidence=1,category=?,sensitivity=?,source=?,updated_at=? WHERE owner_id=? AND id=?')
      .bind(await seal({ text, project_label: r.project_label, history, day: r.day }, c.env.EVIE_SESSION_KEY), await index(c.env, text + ' ' + (r.project_label || '')), sens || 'general', sens || 'normal', 'corrected', Date.now(), c.get('owner'), id).run()
    return c.json({ id, text, previous: r.text, edits: history.length })
  })
  api.get('/items/:id/history', async (c) => { const r = (await rows(c.env, c.get('owner'), unseal)).find((x) => x.id === c.req.param('id')); return r ? c.json({ id: r.id, text: r.text, history: r.history }) : err(c, 'Ese recuerdo no existe.', 404) })
  // "¿Te acuerdas de lo que hablamos ayer sobre SOMA?" — grounded, with uncertainty, never invented.
  api.post('/search', async (c) => {
    const b = await readBody(c); const q = clean(b?.question, 300); if (q.length < 2) return err(c, 'Pregunta vacía.')
    if (b.private === true) return c.json({ items: [], incognito: true, say: 'En modo incógnito no consulto tu memoria.' })
    const st = await settings(c), r = await search(c.env, c.get('owner'), unseal, q, st)
    const when = r.day ? ' del ' + human(r.day) : ''
    const say = r.disabled ? 'Tienes desactivado que use tus recuerdos.' : !r.items.length ? `No tengo nada guardado${when}${r.project ? ' sobre ' + r.project : ''}. No lo voy a inventar.` : (r.uncertain ? 'No estoy segura, pero creo que es esto: ' : 'Esto tengo guardado: ') + r.items.slice(0, 2).map((x) => '«' + x.text + '»').join(' y ') + '.'
    return c.json({ ...r, say })
  })
  api.get('/export', async (c) => { const st = await settings(c); const list = await rows(c.env, c.get('owner'), unseal); return c.json({ format: 'evie.memory', version: 2, exported_at: new Date().toISOString(), items: list.map((r) => ({ ...view(r, st.timezone), history: r.history })) }) })
  return api
}
