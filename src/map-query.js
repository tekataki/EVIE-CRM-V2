// EVIE v5 · Rutas por voz: pure parser for "¿cuánto me tardo de Bijiá 58 al Tecnológico en carro?".
// Distinguishes "abre el mapa" (open the SECTION) from a route question and from "abre la tarjeta del mapa" (card).
// Addresses are only used in-request: never stored, never logged.
const n = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!]/g, ' ').replace(/\s+/g, ' ').trim()
const MODE_WORDS = [['pedestrian', /\b(?:a pie|caminando|andando|caminar)\b/], ['bicycle', /\b(?:en bici(?:cleta)?|pedaleando)\b/], ['motor_scooter', /\b(?:en moto(?:cicleta)?|en scooter)\b/], ['auto', /\b(?:en (?:carro|coche|auto|automovil|taxi|uber|camioneta)|manejando)\b/]]
export const HERE = /^(?:aqui|donde estoy|mi ubicacion(?: actual)?|mi posicion|este lugar)$/
/** Classifies a map utterance: { intent:'open_section'|'show_card'|'route'|null, origin, destination, mode }. */
export function parseRouteQuery(text) {
  const raw = String(text || '').replace(/^\s*(?:oye\s+)?(?:ivi|ivy|evie|libi|liby)[\s,]*/i, '')
  const t = n(raw)
  if (!t) return { intent: null }
  if (/^(?:abre|abrir|abreme|muestrame|muestra|pon)(?: (?:el|al|la))? (?:tarjeta|ventana) (?:del?|de la) mapa$/.test(t)) return { intent: 'show_card' }
  if (/^(?:abre|abrir|abreme|ve a|vamos a|llevame a|entra a)(?: (?:el|al|la))? (?:mapa|seccion (?:del?|de la) mapa)$/.test(t)) return { intent: 'open_section' }
  let mode = 'auto', modeSaid = false
  for (const [m, rx] of MODE_WORDS) if (rx.test(t)) { mode = m; modeSaid = true; break }
  const body = t.replace(/\b(?:a pie|caminando|andando|en bici(?:cleta)?|en moto(?:cicleta)?|en scooter|en (?:carro|coche|auto|automovil|taxi|uber|camioneta)|manejando)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const isRoute = /\b(?:cuanto (?:me )?(?:tardo|tarda|hago|hay|falta|se hace)|cuanto tiempo|que tan lejos|a que distancia|como (?:llego|me voy|voy)|ruta|distancia|llevame|indicaciones)\b/.test(body)
  if (!isRoute) return { intent: null }
  let origin = null, destination = null
  let m = body.match(/\b(?:de|desde)\s+(.+?)\s+(?:a|al|hasta|hacia)\s+(?:la |el )?(.+?)$/)
  if (m) { origin = m[1]; destination = m[2] }
  else { m = body.match(/\b(?:a|al|hasta|hacia|para)\s+(?:la |el )?(.+?)(?:\s+(?:desde|de)\s+(.+))?$/); if (m) { destination = m[1]; origin = m[2] || null } }
  if (!destination) { m = body.match(/\b(?:que tan lejos|a que distancia|donde)\s+(?:esta|queda)\s+(?:la |el )?(.+?)(?:\s+(?:desde|de)\s+(.+))?$/); if (m) { destination = m[1]; origin = m[2] || null } }
  const tidy = (s) => s ? s.replace(/^(?:cuanto (?:me )?(?:tardo|tarda|hago|hay|se hace)|cuanto tiempo (?:hago|me hago|hay)?|que tan lejos (?:esta|queda)?|como (?:llego|me voy|voy))\s*/, '').replace(/^(?:la|el|los|las)\s+/, '').replace(/\s+(?:en|por)$/, '').trim().slice(0, 120) : null
  origin = tidy(origin); destination = tidy(destination)
  if (origin && HERE.test(origin)) origin = 'here'
  if (!destination || destination.length < 2) return { intent: 'route', origin, destination: null, mode, mode_said: modeSaid, missing: 'destination' }
  return { intent: 'route', origin: origin || 'here', destination, mode, mode_said: modeSaid }
}
/** Disambiguation: confident single best result, or a short candidate list (never a silent guess). */
export function pickPlace(results) {
  const list = (results || []).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
  if (!list.length) return { none: true }
  const [a, b] = list, ca = a.confidence || 0, cb = b ? b.confidence || 0 : 0
  if (!b || (ca >= 0.9 && ca - cb >= 0.15) || ca - cb >= 0.3) return { place: a }
  return { candidates: list.slice(0, 4).map((r) => ({ id: r.id, name: r.name, label: r.label, lat: r.lat, lon: r.lon })) }
}
export const MODE_ES = { auto: 'en carro', pedestrian: 'a pie', bicycle: 'en bici', motor_scooter: 'en moto' }
export function spokenRoute({ km, minutes, mode, traffic, originLabel, destLabel }) {
  const d = km < 1 ? Math.round(km * 1000) + ' metros' : (Math.round(km * 10) / 10).toString().replace('.', ',') + ' km'
  const rm = Math.max(1, Math.round(minutes))
  const tm = rm < 60 ? rm + ' minuto' + (rm === 1 ? '' : 's') : Math.floor(rm / 60) + ' h ' + (rm % 60) + ' min'
  const tr = mode === 'auto' ? (traffic ? ' con el tráfico estimado del proveedor' : ', sin considerar el tráfico en tiempo real') : ''
  return `De ${originLabel} a ${destLabel} ${MODE_ES[mode] || ''} son unos ${tm} (${d})${tr}.`
}
