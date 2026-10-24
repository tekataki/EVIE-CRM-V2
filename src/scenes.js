// EVIE v5 · Escenas de automatización ("Ivi, modo SOMA"). Pure core: typed action registry, validation,
// trigger normalization, conflict detection and matching. UI steps execute in the browser (it owns the
// screen); the server validates, stores (sealed), resolves the trigger, applies server-side steps
// (AI tier) and records per-step results honestly.
import { norm } from './v5-schema.js'
import { TIER_IDS } from './tiers.js'

export const WORK_MODES = ['enfoque', 'gym', 'negocio', 'cierre', 'noche', 'normal']
export const THEMES = ['dark', 'light', 'system']
export const SECTIONS = ['inicio', 'mapa', 'agenda', 'finanzas', 'negocios', 'fisico', 'habitos', 'tendencias', 'logros', 'objetivos', 'bitacora', 'aprendizaje', 'libros', 'automatizaciones', 'configuracion', 'perfil']
export const CARDS = ['finanzas', 'automatizaciones', 'mapa', 'agenda', 'pendientes', 'habitos', 'objetivos', 'gimnasio', 'soma', 'today', 'clock', 'weather', 'timer', 'kisha', 'learning', 'research', 'capabilities']
const SID = /^[a-zA-Z0-9-]{1,80}$/
/** Typed action registry: each action declares one parameter, its validator and where it runs. */
export const ACTIONS = Object.freeze({
  set_work_mode: { param: 'mode', label: 'Modo de trabajo', where: 'client', check: (v) => WORK_MODES.includes(v) },
  set_ai_tier: { param: 'tier', label: 'Nivel de IA', where: 'server', check: (v) => TIER_IDS.includes(v) },
  set_theme: { param: 'theme', label: 'Tema', where: 'client', check: (v) => THEMES.includes(v) },
  navigate: { param: 'section', label: 'Ir a sección', where: 'client', check: (v) => SECTIONS.includes(v) },
  open_shortcut: { param: 'shortcut_id', label: 'Abrir atajo web', where: 'client', check: (v) => SID.test(v) },
  open_client: { param: 'client_id', label: 'Abrir cliente SOMA', where: 'client', check: (v) => SID.test(v) },
  show_card: { param: 'card', label: 'Mostrar tarjeta', where: 'client', check: (v) => CARDS.includes(v) },
  close_card: { param: 'card', label: 'Cerrar tarjeta', where: 'client', check: (v) => v === 'all' || CARDS.includes(v) }
})
export const LIMITS = { scenes: 30, steps: 8, triggers: 4, name: 60, trigger: 50 }
// Phrases that can never be a trigger: wake words, safety words and core commands.
export const RESERVED = ['ivi', 'ivy', 'evie', 'evi', 'libi', 'liby', 'oye ivi', 'cancela', 'cancelar', 'para', 'detente', 'stop', 'callate', 'silencio', 'ayuda', 'si', 'no', 'confirmar', 'confirma', 'deshacer', 'olvida', 'recuerda', 'modo normal', 'modo enfoque', 'modo gym', 'modo negocio', 'modo cierre', 'modo noche', 'nivel chispa', 'nivel enfoque', 'nivel profundo', 'abre el mapa', 'que sigue', 'prepara mi dia']

/** Canonical trigger: lowercase, no accents/punctuation, wake word and launch verbs removed. */
export function canonTrigger(text) {
  return norm(text).replace(/^(?:oye |hey |ok )?(?:ivi|ivy|evie|evi|libi|liby)\s+/, '').replace(/^(?:activa|activar|inicia|iniciar|corre|ejecuta|lanza)\s+(?:el |la )?(?:escena\s+)?/, '').trim()
}
/** Validates and normalizes a scene. Returns { scene } or { error, code }. existing = the owner's other scenes. */
export function validateScene(input, existing = []) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Escena inválida.' }
  const name = String(input.name ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, LIMITS.name)
  if (name.length < 2) return { error: 'Ponle un nombre a la escena.', code: 'bad_name' }
  const raw = Array.isArray(input.triggers) ? input.triggers : []
  if (raw.length > LIMITS.triggers * 2) return { error: `Máximo ${LIMITS.triggers} frases por escena.`, code: 'too_many_triggers' }
  const triggers = []
  for (const t of raw) {
    const c = canonTrigger(t)
    if (!c) continue
    if (c.length < 3 || c.length > LIMITS.trigger) return { error: `La frase «${String(t).slice(0, 40)}» debe tener entre 3 y ${LIMITS.trigger} caracteres.`, code: 'bad_trigger' }
    if (RESERVED.includes(c)) return { error: `«${c}» está reservada (palabra de activación o comando del sistema). Elige otra frase.`, code: 'reserved' }
    if (!triggers.includes(c)) triggers.push(c)
  }
  if (!triggers.length) return { error: 'Agrega al menos una frase de activación, por ejemplo «modo SOMA».', code: 'no_trigger' }
  if (triggers.length > LIMITS.triggers) return { error: `Máximo ${LIMITS.triggers} frases por escena.`, code: 'too_many_triggers' }
  for (const other of existing) {
    if (other.id === input.id) continue
    const clash = triggers.find((t) => (other.triggers || []).includes(t))
    if (clash) return { error: `La frase «${clash}» ya activa la escena «${other.name}».`, code: 'trigger_conflict', conflict: { id: other.id, name: other.name } }
  }
  const steps = Array.isArray(input.steps) ? input.steps : []
  if (!steps.length) return { error: 'La escena necesita al menos un paso.', code: 'no_steps' }
  if (steps.length > LIMITS.steps) return { error: `Máximo ${LIMITS.steps} pasos por escena.`, code: 'too_many_steps' }
  const out = []
  for (const [i, st] of steps.entries()) {
    const def = ACTIONS[st?.action]
    if (!def) return { error: `Paso ${i + 1}: acción no permitida.`, code: 'bad_action' }
    const v = st[def.param]
    if (typeof v !== 'string' || !def.check(v)) return { error: `Paso ${i + 1} (${def.label}): valor inválido.`, code: 'bad_param' }
    if (Object.keys(st).some((k) => k !== 'action' && k !== def.param)) return { error: `Paso ${i + 1}: campos no permitidos.`, code: 'bad_fields' }
    out.push({ action: st.action, [def.param]: v })
  }
  // Exact consecutive duplicates collapse (idempotent by design).
  const dedup = out.filter((s, i) => i === 0 || JSON.stringify(s) !== JSON.stringify(out[i - 1]))
  return { scene: { name, triggers, steps: dedup, enabled: input.enabled !== false } }
}
/** Exact canonical match only ("modo soma" ≠ "modo somatico"). Two hits (imported data) ⇒ ambiguity, never a guess. */
export function matchScene(scenes, text) {
  const c = canonTrigger(text)
  if (!c) return { match: null }
  const hits = scenes.filter((s) => s.enabled !== false && (s.triggers || []).includes(c))
  if (hits.length > 1) return { match: null, ambiguous: hits.map((s) => ({ id: s.id, name: s.name })) }
  return { match: hits[0] || null }
}
/** Per-step results → honest summary (partial results are reported as partial, never as full success). */
export function summarize(name, results) {
  const ok = results.filter((r) => r.ok).length
  if (ok === results.length) return { status: 'completed', say: `Listo, activé «${name}» (${ok} paso${ok > 1 ? 's' : ''}).` }
  if (!ok) return { status: 'failed', say: `No pude ejecutar «${name}»: ${results[0]?.error || 'ningún paso funcionó'}.` }
  const bad = results.filter((r) => !r.ok).map((r) => (ACTIONS[r.action]?.label || r.action) + (r.error ? ': ' + r.error : ''))
  return { status: 'partial', say: `Activé «${name}» a medias: ${ok} de ${results.length} pasos. Falló ${bad.slice(0, 2).join('; ')}.` }
}
