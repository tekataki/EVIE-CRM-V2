// EVIE v5 · "Preparar mi día": pure, deterministic planning core (no network, no model).
// Inputs: natural-language batch, open tasks, Pendientes from the client, FIXED agenda events (constraints).
// Output: a proposal with time slots, labeled estimates, conflict warnings and unscheduled items.
import { norm } from './v5-schema.js'

export const DEFAULT_HOURS = { start: '09:00', end: '19:00' }
export const DEFAULT_ESTIMATE = 30
export const toMin = (hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '')); if (!m) return null; const h = +m[1], mi = +m[2]; return h < 24 && mi < 60 ? h * 60 + mi : null }
export const toHM = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0')
const WORDNUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, diez: 10, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, noventa: 90 }

/** "a las 5 de la tarde", "17:30", "a las 9", "al mediodía" → minutes or null. */
export function parseTime(text) {
  const t = norm(text)
  if (/\bmediodia\b/.test(t)) return 12 * 60
  const hm = String(text || '').toLowerCase().match(/\b(\d{1,2}):(\d{2})\b\s*(am|pm|de la mañana|de la tarde|de la noche)?/)
  let m = hm ? [hm[0], hm[1], hm[2], (hm[3] || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')] : null
  if (!m) m = t.match(/\ba las? (\d{1,2})(?: y (media|cuarto))?\b(?:\s*(am|pm|de la manana|de la tarde|de la noche))?/)
  if (!m) return null
  let h = +m[1]
  const min = m[2] === 'media' ? 30 : m[2] === 'cuarto' ? 15 : /^\d{2}$/.test(m[2] || '') ? +m[2] : 0
  const suf = m[3] || ''
  if (/pm|tarde|noche/.test(suf) && h < 12) h += 12
  else if (!suf && h >= 1 && h <= 7) h += 12 // "a las 5" during a working day ⇒ 17:00
  return h < 24 && min < 60 ? h * 60 + min : null
}
/** "30 min", "1 hora", "hora y media", "dos horas" → minutes or null (null ⇒ estimate). */
export function parseDuration(text) {
  const t = norm(text)
  if (/\bhora y media\b/.test(t)) return 90
  if (/\bmedia hora\b/.test(t)) return 30
  let m = t.match(/\b(\d{1,3}|un|una|dos|tres|cuatro|cinco)\s*(?:h|hr|hrs|hora|horas)\b/); if (m) return (WORDNUM[m[1]] || +m[1]) * 60
  m = t.match(/\b(\d{1,3}|diez|quince|veinte|treinta|cuarenta|noventa)\s*(?:m|min|mins|minuto|minutos)\b/); if (m) return WORDNUM[m[1]] || +m[1]
  return null
}
const PRIORITY_WORDS = [['urgent', /\burgente\b|\bsin falta\b/], ['high', /\bimportante\b|\bprioridad\b|\bprimero\b/], ['low', /\bsi da tiempo\b|\bsi puedo\b|\bopcional\b/]]
const VERBS = 'llamar|hacer|ir|revisar|enviar|mandar|pagar|comprar|terminar|preparar|escribir|estudiar|entrenar|gym|junta|reunion|reunión|cita|contestar|responder|cobrar|visitar|lavar|limpiar|leer'
/** Splits "llamar a Intensity 30 min, gym a las 6 y revisar facturas" into items. */
export function parseBatch(text) {
  const raw = String(text || '').replace(/^\s*(?:oye\s+)?(?:ivi|ivy|evie|libi)[\s,]*/i, '')
    .replace(/^(?:prepara(?:me)?|organiza(?:me)?|reorganiza(?:me)?|planea(?:me)?)\s+(?:mi|el)?\s*(?:d[ií]a|ma[ñn]ana)(?:\s+de\s+(?:hoy|ma[ñn]ana))?[\s,:]*/i, '')
    .replace(/^(?:hoy|ma[ñn]ana)\s+(?:tengo que|quiero|debo)[\s,:]*/i, '')
  const parts = raw.split(new RegExp('\\s*(?:[,;\\n]|\\by luego\\b|\\by despu[eé]s\\b|\\bdespu[eé]s\\b|\\by tambi[eé]n\\b|\\btambi[eé]n\\b|\\by\\s+(?=(?:' + VERBS + ')\\b))\\s*', 'i'))
  const items = []
  for (const p0 of parts) {
    const p = String(p0 || '').trim().replace(/^(?:tengo que|quiero|debo|necesito)\s+/i, '').replace(/[.]+$/, '')
    if (p.length < 3) continue
    const time = parseTime(p), dur = parseDuration(p)
    let priority = 'normal'; for (const [k, rx] of PRIORITY_WORDS) if (rx.test(norm(p))) { priority = k; break }
    const title = p.replace(/(?:\ba las? \d{1,2}(?::\d{2})?(?: y (?:media|cuarto))?(?:\s*(?:am|pm|de la mañana|de la manana|de la tarde|de la noche))?|\b\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\bal mediod[ií]a)/gi, '')
      .replace(/\b(?:\d{1,3}|un|una|dos|tres|cuatro|cinco)\s*(?:h|hr|hrs|horas?|m|min|mins|minutos?)\b|\bhora y media\b|\bmedia hora\b/gi, '')
      .replace(/\b(?:urgente|importante|si da tiempo|opcional|sin falta)\b/gi, '').replace(/\s{2,}/g, ' ').replace(/^[\s,-]+|[\s,-]+$/g, '').slice(0, 140)
    if (title.length < 2) continue
    items.push({ title: title.charAt(0).toUpperCase() + title.slice(1), start_min: time, duration_min: dur || DEFAULT_ESTIMATE, estimated: !dur, priority, source: 'dictado' })
    if (items.length >= 20) break
  }
  return items
}
const PRANK = { urgent: 0, high: 1, normal: 2, low: 3 }, SRANK = { red: 0, yellow: 1, green: 2 }
const pick = (m) => ({ item_id: m.item_id, kind: m.kind, title: m.title, duration_min: m.duration_min, estimated: !!m.estimated, priority: m.priority || 'normal', source: m.source, ...(m.task_id ? { task_id: m.task_id } : {}), ...(m.pendiente_key ? { pendiente_key: m.pendiente_key } : {}) })
/**
 * Builds the proposal. fixed = [{title,start:'HH:MM',end:'HH:MM'}] are constraints (never moved).
 * movable = [{item_id,kind,title,duration_min,estimated,priority,severity,start_min?,source}].
 * nowMin = current minute when planning today (nothing scheduled in the past).
 */
export function schedule({ fixed = [], movable = [], hours = DEFAULT_HOURS, nowMin = null, gap = 5 }) {
  const ws = toMin(hours.start) ?? 540, we = toMin(hours.end) ?? 1140
  const start0 = Math.max(ws, nowMin == null ? 0 : Math.ceil((nowMin + 5) / 5) * 5)
  const busy = fixed.map((f) => ({ s: toMin(f.start), e: toMin(f.end) ?? (toMin(f.start) ?? 0) + 30, title: String(f.title || 'Evento').slice(0, 140) })).filter((b) => b.s != null && b.e > b.s).sort((a, b) => a.s - b.s)
  const slots = [], warnings = [], unscheduled = []
  for (const b of busy) slots.push({ kind: 'fixed', title: b.title, start: toHM(b.s), end: toHM(b.e), estimated: false, fixed: true })
  const taken = busy.map((b) => [b.s, b.e])
  const free = (s, e) => !taken.some(([a, z]) => s < z + gap && e + gap > a)
  const timed = movable.filter((m) => m.start_min != null), loose = movable.filter((m) => m.start_min == null)
  // 1) requested times are honored; a clash with a FIXED event is warned about, never silently moved.
  for (const m of timed) {
    const s = m.start_min, e = s + m.duration_min
    if (nowMin != null && s < nowMin) { warnings.push({ code: 'past', title: m.title, message: `«${m.title}» era a las ${toHM(s)} y esa hora ya pasó; la reacomodé.` }); loose.push({ ...m, start_min: null }); continue }
    const clash = busy.find((b) => s < b.e && e > b.s)
    if (clash) warnings.push({ code: 'conflict', title: m.title, message: `«${m.title}» (${toHM(s)}) se cruza con «${clash.title}» (${toHM(clash.s)}–${toHM(clash.e)}), que es fijo.` })
    if (s < ws || e > we) warnings.push({ code: 'outside_hours', title: m.title, message: `«${m.title}» queda fuera de tu horario (${hours.start}–${hours.end}).` })
    slots.push({ ...pick(m), start: toHM(s), end: toHM(e), conflict: !!clash }); taken.push([s, e])
  }
  // 2) the rest by priority then severity, in the earliest free gap inside working hours.
  loose.sort((a, b) => (PRANK[a.priority] ?? 2) - (PRANK[b.priority] ?? 2) || (SRANK[a.severity] ?? 3) - (SRANK[b.severity] ?? 3))
  for (const m of loose) {
    let placed = false
    for (let s = start0; s + m.duration_min <= we; s += 5) if (free(s, s + m.duration_min)) { slots.push({ ...pick(m), start: toHM(s), end: toHM(s + m.duration_min) }); taken.push([s, s + m.duration_min]); placed = true; break }
    if (!placed) unscheduled.push({ ...pick(m), reason: 'no_space' })
  }
  if (unscheduled.length) warnings.push({ code: 'overflow', message: `No cupieron ${unscheduled.length} pendiente${unscheduled.length > 1 ? 's' : ''} en tu horario; quedan sin hora.` })
  slots.sort((a, b) => a.start.localeCompare(b.start))
  const est = slots.filter((x) => x.estimated).length
  if (est) warnings.push({ code: 'estimates', message: `${est} ${est > 1 ? 'duraciones son estimaciones' : 'duración es una estimación'} (${DEFAULT_ESTIMATE} min); ajústalas si no te cuadran.` })
  return { slots, warnings, unscheduled }
}
/** "¿qué sigue?": current block (if any) and the next one after now. */
export function nextOf(slots, nowMin) {
  const cur = slots.find((s) => toMin(s.start) <= nowMin && toMin(s.end) > nowMin) || null
  const nxt = slots.find((s) => toMin(s.start) > nowMin) || null
  return { current: cur, next: nxt }
}
