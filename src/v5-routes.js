// EVIE v5 routes: /tasks (SOMA client tasks + personal tasks), /scenes (automation scenes), /plan (Preparar mi día).
// Every route: bound session (cookie + X-Evie-User), rows keyed ONLY by the session owner, private text sealed.
import { Hono } from 'hono'
import { ensureV5, once, newId, STABLE_ID, clean, norm, readBody, putSetting, observe } from './v5-schema.js'
import { validateScene, matchScene, summarize, ACTIONS, LIMITS as SCENE_LIMITS } from './scenes.js'
import { parseBatch, schedule, nextOf, toMin, toHM, DEFAULT_HOURS } from './planner.js'
import { validTimeZone, currentTime } from './assistant.js'

export const TASK_LIMITS = { tasks: 1000, title: 140, notes: 2000, list: 200 }
const PRIORITIES = ['low', 'normal', 'high', 'urgent'], STATUSES = ['open', 'done', 'cancelled']
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const ID = /^[a-z]-[0-9a-f-]{36}$/
const FIELDS = ['title', 'notes', 'client_id', 'due_date', 'due_time', 'tz', 'duration_min', 'priority', 'status', 'agenda_link', 'op_id', 'source']
export function validDate(d) { if (!DATE.test(d || '')) return false; const x = new Date(d + 'T12:00:00Z'); return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d }

/** Validates a task create/patch. full=true for create (title required). Returns { value } or { error }. */
export function taskInput(b, full) {
  const v = {}
  for (const k of Object.keys(b)) if (!FIELDS.includes(k)) return { error: 'Campo no permitido: ' + String(k).slice(0, 30) }
  if (full || 'title' in b) { const t = clean(b.title, TASK_LIMITS.title); if (t.length < 2) return { error: 'Escribe el título de la tarea.' }; v.title = t }
  if ('notes' in b) v.notes = b.notes == null ? '' : String(b.notes).replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').trim().slice(0, TASK_LIMITS.notes)
  if ('client_id' in b) { if (b.client_id !== null && !STABLE_ID.test(String(b.client_id))) return { error: 'Cliente inválido.' }; v.client_id = b.client_id }
  if ('due_date' in b) { if (b.due_date !== null && !validDate(b.due_date)) return { error: 'Fecha inválida (AAAA-MM-DD).' }; v.due_date = b.due_date }
  if ('due_time' in b) { if (b.due_time !== null && !TIME.test(String(b.due_time))) return { error: 'Hora inválida (HH:MM).' }; v.due_time = b.due_time }
  if (full && v.due_time && !v.due_date) return { error: 'Una hora necesita fecha.' }
  if ('tz' in b) { if (!validTimeZone(b.tz)) return { error: 'Zona horaria inválida.' }; v.tz = b.tz }
  if ('duration_min' in b) { if (b.duration_min !== null && !(Number.isInteger(b.duration_min) && b.duration_min >= 5 && b.duration_min <= 720)) return { error: 'Duración inválida (5 a 720 minutos).' }; v.duration_min = b.duration_min }
  if ('priority' in b) { if (!PRIORITIES.includes(b.priority)) return { error: 'Prioridad inválida.' }; v.priority = b.priority }
  if ('status' in b) { if (!STATUSES.includes(b.status)) return { error: 'Estado inválido.' }; v.status = b.status }
  if ('agenda_link' in b) { if (b.agenda_link !== null && !STABLE_ID.test(String(b.agenda_link))) return { error: 'Enlace de agenda inválido.' }; v.agenda_link = b.agenda_link }
  return { value: v }
}

export function createV5({ authenticate, seal, unseal }) {
  const api = new Hono()
  const err = (c, m, s = 400, extra = {}) => c.json({ error: m, ...extra }, s)
  const auth = async (c, next) => { const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401); if (!c.env?.AUTH_DB || !c.env.EVIE_SESSION_KEY) return err(c, 'Almacenamiento no configurado.', 503); await ensureV5(c.env.AUTH_DB); c.set('owner', s.user.id); c.set('role', s.user.role || 'member'); await next() }
  for (const p of ['/tasks', '/tasks/*', '/scenes', '/scenes/*', '/plan', '/plan/*']) api.use(p, auth)
  const K = (c) => c.env.EVIE_SESSION_KEY

  // ======================= TASKS =======================
  const rowToTask = async (c, r) => { let d = { title: '', notes: '' }; try { d = await unseal(r.data, K(c)) } catch {} return { id: r.id, client_id: r.client_id, title: d.title, notes: d.notes || '', due_date: r.due_date, due_time: r.due_time, tz: r.tz, duration_min: r.duration_min, priority: r.priority, status: r.status, completed_at: r.completed_at, agenda_link: r.agenda_link, source: r.source, created_at: r.created_at, updated_at: r.updated_at } }
  const getTask = async (c, id) => { if (!ID.test(id || '')) return null; const r = await c.env.AUTH_DB.prepare('SELECT * FROM evie_tasks WHERE owner_id=? AND id=?').bind(c.get('owner'), id).first(); return r ? rowToTask(c, r) : null }
  async function createTask(c, b, source = 'manual') {
    const { value, error } = taskInput(b, true); if (error) return { error }
    const owner = c.get('owner'), n = await c.env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM evie_tasks WHERE owner_id=?').bind(owner).first()
    if ((n?.n || 0) >= TASK_LIMITS.tasks) return { error: 'Llegaste al máximo de tareas. Completa o borra algunas.' }
    const id = newId('t'), now = Date.now()
    await c.env.AUTH_DB.prepare('INSERT INTO evie_tasks(owner_id,id,client_id,data,due_date,due_time,tz,duration_min,priority,status,completed_at,agenda_link,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(owner, id, value.client_id ?? null, await seal({ title: value.title, notes: value.notes || '' }, K(c)), value.due_date ?? null, value.due_date ? value.due_time ?? null : null, value.tz || 'America/Mexico_City', value.duration_min ?? null, value.priority || 'normal', 'open', null, value.agenda_link ?? null, ['manual', 'voice', 'plan', 'ivi-ai'].includes(source) ? source : 'manual', now, now).run()
    return { task: await getTask(c, id), created: true }
  }
  async function patchTask(c, id, b) {
    if (!ID.test(id || '')) return { error: 'Tarea inválida.', status: 400 }
    const cur = await getTask(c, id); if (!cur) return { error: 'Esa tarea no existe.', status: 404 }
    const { value, error } = taskInput(b, false); if (error) return { error }
    const next = { ...cur, ...value }
    if (next.due_time && !next.due_date) return { error: 'Una hora necesita fecha.' }
    if ('status' in value) next.completed_at = value.status === 'done' ? (cur.status === 'done' ? cur.completed_at : Date.now()) : null
    await c.env.AUTH_DB.prepare('UPDATE evie_tasks SET client_id=?,data=?,due_date=?,due_time=?,tz=?,duration_min=?,priority=?,status=?,completed_at=?,agenda_link=?,updated_at=? WHERE owner_id=? AND id=?')
      .bind(next.client_id ?? null, await seal({ title: next.title, notes: next.notes || '' }, K(c)), next.due_date ?? null, next.due_time ?? null, next.tz, next.duration_min ?? null, next.priority, next.status, next.completed_at ?? null, next.agenda_link ?? null, Date.now(), c.get('owner'), id).run()
    return { task: await getTask(c, id), previous: { status: cur.status, due_date: cur.due_date, due_time: cur.due_time } }
  }
  api.get('/tasks', async (c) => {
    const q = c.req.query(), where = ['owner_id=?'], args = [c.get('owner')]
    if (q.status) { if (!STATUSES.includes(q.status)) return err(c, 'Estado inválido.'); where.push('status=?'); args.push(q.status) }
    if (q.client_id) { if (!STABLE_ID.test(q.client_id)) return err(c, 'Cliente inválido.'); where.push('client_id=?'); args.push(q.client_id) }
    if (q.from) { if (!validDate(q.from)) return err(c, 'Fecha inválida.'); where.push('due_date>=?'); args.push(q.from) }
    if (q.to) { if (!validDate(q.to)) return err(c, 'Fecha inválida.'); where.push('due_date<=?'); args.push(q.to) }
    const { results = [] } = await c.env.AUTH_DB.prepare(`SELECT * FROM evie_tasks WHERE ${where.join(' AND ')} ORDER BY status='open' DESC, due_date IS NULL, due_date, due_time IS NULL, due_time, created_at LIMIT ?`).bind(...args, TASK_LIMITS.list).all()
    const tasks = []; for (const r of results) tasks.push(await rowToTask(c, r))
    return c.json({ tasks })
  })
  // Voice lookup: find tasks by words (+ optional client), for "completa la tarea de cotizar a Intensity".
  api.post('/tasks/find', async (c) => {
    const b = await readBody(c); if (!b) return err(c, 'Solicitud inválida.')
    const words = norm(b.query || '').split(' ').filter((w) => w.length > 2 && !['tarea', 'tareas', 'del', 'las', 'los', 'para', 'con', 'que'].includes(w))
    const where = ['owner_id=?'], args = [c.get('owner')]
    if (b.client_id) { if (!STABLE_ID.test(b.client_id)) return err(c, 'Cliente inválido.'); where.push('client_id=?'); args.push(b.client_id) }
    if (b.status && STATUSES.includes(b.status)) { where.push('status=?'); args.push(b.status) }
    const { results = [] } = await c.env.AUTH_DB.prepare(`SELECT * FROM evie_tasks WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 300`).bind(...args).all()
    const scored = []
    for (const r of results) { const t = await rowToTask(c, r); const tt = norm(t.title + ' ' + t.notes); const sc = words.length ? words.filter((w) => tt.includes(w)).length / words.length : 0; if (sc > 0) scored.push([sc, t]) }
    scored.sort((x, y) => y[0] - x[0])
    const top = scored.filter((x) => x[0] === scored[0]?.[0]).map((x) => x[1])
    return c.json({ matches: top.slice(0, 5), unique: top.length === 1 ? top[0] : null })
  })
  api.get('/tasks/:id', async (c) => { const t = await getTask(c, c.req.param('id')); return t ? c.json({ task: t }) : err(c, 'Esa tarea no existe.', 404) })
  api.post('/tasks', async (c) => {
    const b = await readBody(c); if (!b) return err(c, 'Tarea inválida.')
    const opId = typeof b.op_id === 'string' ? b.op_id : c.req.header('Idempotency-Key') || null
    const r = await once(c.env, c.get('owner'), opId ? 'task:create:' + opId : null, () => createTask(c, b, b.source))
    return c.json(r, r.error ? (r.status || 400) : (r.replay ? 200 : 201))
  })
  api.patch('/tasks/:id', async (c) => { const b = await readBody(c); if (!b) return err(c, 'Solicitud inválida.'); const r = await patchTask(c, c.req.param('id'), b); return c.json(r, r.error ? (r.status || 400) : 200) })
  // Assistant-friendly verbs (idempotent: completing a done task is a no-op that reports already_done).
  api.post('/tasks/:id/complete', async (c) => { const t = await getTask(c, c.req.param('id')); if (!t) return err(c, 'Esa tarea no existe.', 404); if (t.status === 'done') return c.json({ task: t, already_done: true }); return c.json(await patchTask(c, t.id, { status: 'done' })) })
  api.post('/tasks/:id/reopen', async (c) => { const t = await getTask(c, c.req.param('id')); if (!t) return err(c, 'Esa tarea no existe.', 404); if (t.status === 'open') return c.json({ task: t, already_open: true }); return c.json(await patchTask(c, t.id, { status: 'open' })) })
  api.post('/tasks/:id/reschedule', async (c) => { const b = await readBody(c); if (!b || !validDate(b.due_date)) return err(c, 'Dime la nueva fecha (AAAA-MM-DD).'); const r = await patchTask(c, c.req.param('id'), { due_date: b.due_date, due_time: b.due_time ?? null }); return c.json(r, r.error ? (r.status || 400) : 200) })
  api.delete('/tasks/:id', async (c) => { const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Tarea inválida.'); const r = await c.env.AUTH_DB.prepare('DELETE FROM evie_tasks WHERE owner_id=? AND id=?').bind(c.get('owner'), id).run(); return r.meta?.changes ? c.json({ deleted: id }) : err(c, 'Esa tarea no existe.', 404) })

  // ======================= SCENES =======================
  const noGuest = (c) => c.get('role') === 'guest' ? err(c, 'Las escenas de automatización no están disponibles para invitados.', 403) : null
  const listScenes = async (c) => { const { results = [] } = await c.env.AUTH_DB.prepare('SELECT id,data,created_at,updated_at FROM evie_scenes WHERE owner_id=? ORDER BY created_at').bind(c.get('owner')).all(); const out = []; for (const r of results) { try { out.push({ id: r.id, ...(await unseal(r.data, K(c))), created_at: r.created_at, updated_at: r.updated_at }) } catch {} } return out }
  const saveScene = async (c, id, scene, created) => { const now = Date.now(); await c.env.AUTH_DB.prepare('INSERT INTO evie_scenes(owner_id,id,data,trigger_keys,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET data=excluded.data,trigger_keys=excluded.trigger_keys,updated_at=excluded.updated_at').bind(c.get('owner'), id, await seal(scene, K(c)), String(scene.triggers.length), created || now, now).run() }
  api.get('/scenes', async (c) => { const g = noGuest(c); if (g) return g; return c.json({ scenes: await listScenes(c), actions: Object.entries(ACTIONS).map(([k, v]) => ({ action: k, param: v.param, label: v.label })), limits: SCENE_LIMITS }) })
  // Resolve an utterance → scene (exact trigger). The client then executes UI steps and reports results.
  api.post('/scenes/resolve', async (c) => {
    const g = noGuest(c); if (g) return g
    const b = await readBody(c); if (!b || typeof b.text !== 'string') return err(c, 'Solicitud inválida.')
    const m = matchScene(await listScenes(c), b.text.slice(0, 200))
    if (m.ambiguous) return c.json({ status: 'ambiguous', options: m.ambiguous, say: '¿Cuál escena? ' + m.ambiguous.map((x) => '«' + x.name + '»').join(' o ') + '.' })
    if (!m.match) return c.json({ status: 'no_match' })
    return c.json({ status: 'match', scene: m.match })
  })
  api.post('/scenes', async (c) => {
    const g = noGuest(c); if (g) return g
    const b = await readBody(c); if (!b) return err(c, 'Escena inválida.')
    const all = await listScenes(c); if (all.length >= SCENE_LIMITS.scenes) return err(c, `Máximo ${SCENE_LIMITS.scenes} escenas.`, 409)
    if (all.some((s) => norm(s.name) === norm(b.name))) return err(c, 'Ya tienes una escena con ese nombre.', 409, { code: 'duplicate_name' })
    const v = validateScene(b, all); if (v.error) return c.json(v, v.code === 'trigger_conflict' ? 409 : 400)
    const id = newId('s'); await saveScene(c, id, v.scene); return c.json({ scene: { id, ...v.scene } }, 201)
  })
  api.put('/scenes/:id', async (c) => {
    const g = noGuest(c); if (g) return g
    const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Escena inválida.')
    const b = await readBody(c); if (!b) return err(c, 'Escena inválida.')
    const all = await listScenes(c), cur = all.find((s) => s.id === id); if (!cur) return err(c, 'Esa escena no existe.', 404)
    if (all.some((s) => s.id !== id && norm(s.name) === norm(b.name))) return err(c, 'Ya tienes una escena con ese nombre.', 409, { code: 'duplicate_name' })
    const v = validateScene({ ...b, id }, all); if (v.error) return c.json(v, v.code === 'trigger_conflict' ? 409 : 400)
    await saveScene(c, id, v.scene, cur.created_at); return c.json({ scene: { id, ...v.scene } })
  })
  api.delete('/scenes/:id', async (c) => { const g = noGuest(c); if (g) return g; const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Escena inválida.'); const r = await c.env.AUTH_DB.prepare('DELETE FROM evie_scenes WHERE owner_id=? AND id=?').bind(c.get('owner'), id).run(); return r.meta?.changes ? c.json({ deleted: id }) : err(c, 'Esa escena no existe.', 404) })
  // Run: server-side steps (AI tier) are applied here; client steps' results come in body.client_results.
  // run_id makes the whole run idempotent (a replay returns the first result and re-applies nothing).
  api.post('/scenes/:id/run', async (c) => {
    const g = noGuest(c); if (g) return g
    const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Escena inválida.')
    const b = (await readBody(c)) || {}
    const runId = typeof b.run_id === 'string' ? b.run_id : null
    const scene = (await listScenes(c)).find((s) => s.id === id); if (!scene) return err(c, 'Esa escena no existe.', 404)
    if (scene.enabled === false) return err(c, 'Esa escena está desactivada.', 409)
    const t0 = Date.now()
    const r = await once(c.env, c.get('owner'), runId ? 'scene:' + id + ':' + runId : null, async () => {
      const client = Array.isArray(b.client_results) ? b.client_results : []
      const results = []
      for (const [i, st] of scene.steps.entries()) {
        const def = ACTIONS[st.action]
        if (def.where === 'server') {
          try { if (st.action === 'set_ai_tier') await putSetting(c.env, c.get('owner'), 'ai_reasoning_tier', st.tier); results.push({ step: i, action: st.action, ok: true }) } catch (e) { results.push({ step: i, action: st.action, ok: false, error: String(e?.message || 'falló').slice(0, 80) }) }
        } else {
          const cr = client.find((x) => x && x.step === i)
          results.push(cr ? { step: i, action: st.action, ok: cr.ok === true, ...(cr.ok === true ? {} : { error: clean(cr.error || 'no se pudo', 80) }) } : { step: i, action: st.action, ok: false, error: 'no ejecutado en este dispositivo' })
        }
      }
      return { scene_id: id, name: scene.name, results, ...summarize(scene.name, results) }
    })
    await observe(c.env, c.get('owner'), 'scene_run', Date.now() - t0)
    return c.json(r, r.error ? 400 : 200)
  })

  // ======================= PLAN (Preparar mi día) =======================
  const planDay = (tz, which) => { const now = currentTime(tz); if (which === 'tomorrow') { const d = new Date(now.date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return { day: d.toISOString().slice(0, 10), nowMin: null } } return { day: now.date, nowMin: toMin(now.time_24h) } }
  const cleanFixed = (list) => (Array.isArray(list) ? list : []).slice(0, 40).map((f) => ({ title: clean(f?.title || 'Evento', 140), start: TIME.test(f?.start || '') ? f.start : null, end: TIME.test(f?.end || '') ? f.end : null })).filter((f) => f.start)
  const cleanPend = (list) => (Array.isArray(list) ? list : []).slice(0, 40).map((p) => ({ key: clean(p?.key, 120), title: clean(p?.title, 140), severity: ['red', 'yellow', 'green'].includes(p?.severity) ? p.severity : 'green', kind: clean(p?.kind || 'Pendiente', 30), time: TIME.test(p?.time || '') ? p.time : null })).filter((p) => p.key && p.title)
  // Propose: never writes anything except the sealed proposal itself (24 h).
  api.post('/plan/propose', async (c) => {
    const b = await readBody(c); if (!b) return err(c, 'Solicitud inválida.')
    const tz = validTimeZone(b.timezone) ? b.timezone : 'America/Mexico_City'
    const { day, nowMin } = planDay(tz, b.day === 'tomorrow' ? 'tomorrow' : 'today')
    const hours = { start: TIME.test(b.hours?.start || '') ? b.hours.start : DEFAULT_HOURS.start, end: TIME.test(b.hours?.end || '') ? b.hours.end : DEFAULT_HOURS.end }
    if (toMin(hours.end) <= toMin(hours.start)) return err(c, 'Tu horario de trabajo no es válido.')
    const dictated = parseBatch(String(b.text || '').slice(0, 4000)).map((x, i) => ({ ...x, item_id: 'd' + i, kind: 'nuevo' }))
    // Open SOMA/personal tasks due on/before the day (or undated high/urgent): the canonical records.
    const { results = [] } = await c.env.AUTH_DB.prepare("SELECT * FROM evie_tasks WHERE owner_id=? AND status='open' AND (due_date<=? OR (due_date IS NULL AND priority IN ('high','urgent'))) ORDER BY due_date LIMIT 30").bind(c.get('owner'), day).all()
    const tasks = []
    for (const r of results) { const t = await rowToTask(c, r); tasks.push({ item_id: 't:' + t.id, task_id: t.id, kind: 'tarea', title: t.title, duration_min: t.duration_min || 30, estimated: !t.duration_min, priority: t.priority, severity: t.due_date && t.due_date < day ? 'red' : 'yellow', start_min: t.due_date === day && t.due_time ? toMin(t.due_time) : null, source: t.client_id ? 'SOMA' : 'Tarea' }) }
    // Pendientes from the client (agenda tasks, bills, follow-ups…): skip those already represented by a task.
    const pend = cleanPend(b.pendientes).filter((p) => !p.key.startsWith('task:')).map((p, i) => ({ item_id: 'p' + i, pendiente_key: p.key, kind: 'pendiente', title: p.title, duration_min: 30, estimated: true, priority: p.severity === 'red' ? 'high' : 'normal', severity: p.severity, start_min: p.time ? toMin(p.time) : null, source: p.kind }))
    const seen = new Set(), movable = []
    for (const m of [...dictated, ...tasks, ...pend]) { const k = norm(m.title); if (seen.has(k)) continue; seen.add(k); movable.push(m) }
    const plan = schedule({ fixed: cleanFixed(b.fixed), movable, hours, nowMin })
    const id = newId('p'), now = Date.now()
    await c.env.AUTH_DB.prepare('INSERT INTO evie_plans(owner_id,id,day,data,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(c.get('owner'), id, day, await seal({ ...plan, hours, tz }, K(c)), 'proposed', now, now + 86400000).run()
    await c.env.AUTH_DB.prepare('DELETE FROM evie_plans WHERE owner_id=? AND expires_at<?').bind(c.get('owner'), now).run()
    const blocks = plan.slots.filter((s) => s.kind !== 'fixed')
    const say = blocks.length ? `Te propongo ${blocks.length} bloque${blocks.length > 1 ? 's' : ''} para ${b.day === 'tomorrow' ? 'mañana' : 'hoy'}, empezando a las ${blocks[0].start}. ${plan.warnings.some((w) => w.code === 'conflict') ? 'Ojo: hay choques con eventos fijos. ' : ''}Revísalo y confírmalo en pantalla; no guardo nada hasta que apruebes.` : 'No encontré pendientes para acomodar. Dime qué quieres hacer.'
    return c.json({ plan_id: id, day, hours, timezone: tz, ...plan, needs_approval: true, google_calendar: 'no_write', say })
  })
  // Apply: explicit approval with the item ids the user kept. Idempotent per (plan, item): re-applying never duplicates.
  api.post('/plan/:id/apply', async (c) => {
    const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Propuesta inválida.')
    const b = await readBody(c); if (!b || b.approved !== true) return err(c, 'Necesito tu aprobación explícita (approved: true).', 400, { code: 'not_approved' })
    const row = await c.env.AUTH_DB.prepare('SELECT * FROM evie_plans WHERE owner_id=? AND id=?').bind(c.get('owner'), id).first()
    if (!row) return err(c, 'Esa propuesta no existe.', 404)
    if (row.expires_at < Date.now()) return err(c, 'La propuesta caducó. Pídeme preparar el día otra vez.', 410)
    const plan = await unseal(row.data, K(c))
    const keep = Array.isArray(b.items) ? new Set(b.items.map(String)) : null
    const edits = b.edits && typeof b.edits === 'object' ? b.edits : {}
    const results = []
    for (const s of plan.slots.filter((x) => x.kind !== 'fixed')) {
      if (keep && !keep.has(s.item_id)) { results.push({ item_id: s.item_id, title: s.title, status: 'skipped' }); continue }
      const e = edits[s.item_id] || {}, start = TIME.test(e.start || '') ? e.start : s.start, dur = Number.isInteger(e.duration_min) && e.duration_min >= 5 && e.duration_min <= 720 ? e.duration_min : s.duration_min
      const r = await once(c.env, c.get('owner'), 'plan:' + id + ':' + s.item_id, async () => {
        if (s.task_id) { const p = await patchTask(c, s.task_id, { due_date: row.day, due_time: start, duration_min: dur }); return p.error ? { error: p.error } : { status: 'scheduled', task_id: s.task_id } }
        if (s.kind === 'nuevo') { const cr = await createTask(c, { title: s.title, due_date: row.day, due_time: start, duration_min: dur, priority: s.priority, tz: plan.tz }, 'plan'); return cr.error ? { error: cr.error } : { status: 'created', task_id: cr.task.id } }
        // Pendientes owned by other modules (agenda, bills…) get a timed block reference only; their owner module is untouched.
        return { status: 'time_block', pendiente_key: s.pendiente_key, end: toHM(toMin(start) + dur) }
      })
      results.push({ item_id: s.item_id, title: s.title, start, ...(r.error ? { status: 'failed', error: r.error } : r) })
    }
    const ok = results.filter((x) => !['failed', 'skipped'].includes(x.status)).length, failed = results.filter((x) => x.status === 'failed').length
    if (!failed) await c.env.AUTH_DB.prepare("UPDATE evie_plans SET status='applied' WHERE owner_id=? AND id=?").bind(c.get('owner'), id).run()
    return c.json({ plan_id: id, day: row.day, results, applied: ok, failed, say: failed ? `Guardé ${ok} y fallaron ${failed}. Revisa los marcados.` : `Listo, programé ${ok} bloque${ok === 1 ? '' : 's'} en tu Agenda de EVIE. No toqué Google Calendar.` })
  })
  api.post('/plan/:id/discard', async (c) => { const id = c.req.param('id'); if (!ID.test(id)) return err(c, 'Propuesta inválida.'); await c.env.AUTH_DB.prepare("UPDATE evie_plans SET status='discarded' WHERE owner_id=? AND id=?").bind(c.get('owner'), id).run(); return c.json({ discarded: id }) })
  // "¿Qué sigue?": from today's applied/proposed plan, else from today's timed open tasks.
  api.get('/plan/next', async (c) => {
    const tz = validTimeZone(c.req.query('tz')) ? c.req.query('tz') : 'America/Mexico_City', now = currentTime(tz), nowMin = toMin(now.time_24h)
    const row = await c.env.AUTH_DB.prepare("SELECT data FROM evie_plans WHERE owner_id=? AND day=? AND status IN ('applied','proposed') ORDER BY status='applied' DESC, created_at DESC LIMIT 1").bind(c.get('owner'), now.date).first()
    let slots = []
    if (row) { try { slots = (await unseal(row.data, K(c))).slots || [] } catch {} }
    if (slots.length) { const { results: done = [] } = await c.env.AUTH_DB.prepare("SELECT id FROM evie_tasks WHERE owner_id=? AND status<>'open'").bind(c.get('owner')).all(); const ids = new Set(done.map((d) => d.id)); slots = slots.filter((s) => !s.task_id || !ids.has(s.task_id)) }
    else { const { results = [] } = await c.env.AUTH_DB.prepare("SELECT * FROM evie_tasks WHERE owner_id=? AND status='open' AND due_date=? AND due_time IS NOT NULL ORDER BY due_time").bind(c.get('owner'), now.date).all(); for (const r of results) { const t = await rowToTask(c, r); slots.push({ kind: 'tarea', task_id: t.id, title: t.title, start: t.due_time, end: toHM(toMin(t.due_time) + (t.duration_min || 30)) }) } }
    const { current, next } = nextOf(slots, nowMin)
    const say = current ? `Ahora toca «${current.title}» hasta las ${current.end}.${next ? ` Después: «${next.title}» a las ${next.start}.` : ''}` : next ? `Lo siguiente es «${next.title}» a las ${next.start}.` : 'No tienes nada más programado para hoy.'
    return c.json({ now: now.time_24h, current, next, source: row ? 'plan' : 'tasks', say })
  })
  return api
}
