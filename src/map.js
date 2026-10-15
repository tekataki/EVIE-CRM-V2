// EVIE Mapa · server side (Cloudflare Worker). Thin, authenticated proxy to ONE hosted provider:
// Stadia Maps (OpenStreetMap data; Valhalla routing; Pelias-based geocoding). The routing engine runs at
// Stadia, not inside the Worker. The secret (STADIA_API_KEY) stays here; the browser only talks to /api/map.
//   GET  /api/map/config  → what is configured (never the key), area, attribution, quotas used.
//   POST /api/map/search  → geocode restricted to the supported area (boundary rect + focus point).
//   POST /api/map/route   → Valhalla route (auto | pedestrian | bicycle | motor_scooter), Spanish maneuvers.
// No location is stored: requests are proxied; only a per-account daily COUNTER is written (ai_usage).
// Without STADIA_API_KEY every endpoint answers 503 with exactly what is missing — never a fake route.
import { Hono } from 'hono'
import { usage } from './assistant.js'

export const AREA = { name: 'Ciudad Guzmán (Zapotlán el Grande), Jalisco', center: { lat: 19.7045, lon: -103.46 }, bbox: { min_lon: -103.54, min_lat: 19.642, max_lon: -103.388, max_lat: 19.756 } }
export const MAP_DEFAULTS = { limits: { map_search: 200, map_route: 120 }, base: 'https://api.stadiamaps.com' }
const MODES = new Set(['auto', 'pedestrian', 'bicycle', 'motor_scooter'])
export const inBox = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon) && p.lat >= AREA.bbox.min_lat && p.lat <= AREA.bbox.max_lat && p.lon >= AREA.bbox.min_lon && p.lon <= AREA.bbox.max_lon
const coord = (p) => (p && typeof p === 'object' && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180) ? { lat: Math.round(Number(p.lat) * 1e6) / 1e6, lon: Math.round(Number(p.lon) * 1e6) / 1e6 } : null
export function mapLimits(env) { try { return { ...MAP_DEFAULTS.limits, ...JSON.parse(env?.EVIE_MAP_LIMITS || '{}') } } catch { return MAP_DEFAULTS.limits } }
export function mapStatus(env) {
  const key = !!env?.STADIA_API_KEY, traffic = env?.EVIE_MAP_TRAFFIC === 'on'
  return { configured: key, provider: 'Stadia Maps', data: 'OpenStreetMap', routing: key, geocoding: key, traffic: key && traffic,
    styleDark: env?.EVIE_MAP_STYLE_URL_DARK || 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json', styleLight: env?.EVIE_MAP_STYLE_URL || 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    missing: key ? [] : ['STADIA_API_KEY (secreto de Cloudflare) para rutas y búsqueda de lugares', 'Dominio de producción autorizado en Stadia Maps (autenticación por dominio) para el mapa base'],
    attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors', area: AREA }
}
export function createMap({ fetcher = fetch, authenticate }) {
  const api = new Hono()
  const err = (c, m, s = 400, extra = {}) => c.json({ error: m, ...extra }, s)
  const body = async (c) => { try { const b = await c.req.json(); return b && typeof b === 'object' && !Array.isArray(b) ? b : null } catch { return null } }
  api.use('*', async (c, next) => { const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401); c.set('owner', s.user.id); await next() })
  api.get('/config', async (c) => { const env = c.env || {}, o = c.get('owner'); return c.json({ ...mapStatus(env), limits: mapLimits(env), used: { map_search: await usage(env, o, 'map_search'), map_route: await usage(env, o, 'map_route') } }) })
  const guard = async (c, kind) => {
    const env = c.env || {}
    if (!env.STADIA_API_KEY) return err(c, 'El mapa no está configurado: falta STADIA_API_KEY en Cloudflare. No puedo calcular rutas ni buscar lugares todavía.', 503, { code: 'not_configured', missing: mapStatus(env).missing })
    if (await usage(env, c.get('owner'), kind) >= mapLimits(env)[kind]) return err(c, 'Llegaste al límite diario de ' + (kind === 'map_route' ? 'rutas' : 'búsquedas') + ' del mapa.', 429, { code: 'quota' })
    return null
  }
  const call = async (env, path, init) => {
    let r; try { r = await fetcher((env.STADIA_BASE_URL || MAP_DEFAULTS.base) + path, { ...init, headers: { ...(init?.headers || {}), Authorization: 'Stadia-Auth ' + env.STADIA_API_KEY }, signal: AbortSignal.timeout(12000) }) } catch { return { error: 'El proveedor de mapas no respondió a tiempo.', status: 504, code: 'provider_timeout' } }
    if (r.status === 401 || r.status === 403) return { error: 'La clave de Stadia Maps no es válida o no tiene permiso para este servicio.', status: 502, code: 'provider_auth' }
    if (r.status === 429) return { error: 'El proveedor de mapas limitó las solicitudes. Intenta en un momento.', status: 429, code: 'provider_rate' }
    let j = null; try { j = await r.json() } catch {}
    if (!r.ok) return { error: (j && typeof j.error === 'string' ? j.error.slice(0, 200) : '') || 'El proveedor de rutas no pudo atender la solicitud.', status: r.status === 400 ? 422 : 502, code: 'provider_error' }
    return { json: j }
  }
  api.post('/search', async (c) => {
    const g = await guard(c, 'map_search'); if (g) return g
    const b = await body(c), text = String(b?.text || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 140); if (text.length < 2) return err(c, 'Escribe el lugar que buscas.')
    const q = new URLSearchParams({ text, size: '8', lang: 'es', 'boundary.country': 'MX', 'focus.point.lat': String(AREA.center.lat), 'focus.point.lon': String(AREA.center.lon) })
    for (const [k, v] of Object.entries(AREA.bbox)) q.set('boundary.rect.' + k, String(v))
    const r = await call(c.env, '/geocoding/v1/search?' + q, { method: 'GET' }); if (r.error) return err(c, r.error, r.status, { code: r.code })
    await usage(c.env, c.get('owner'), 'map_search', 1)
    const results = (r.json?.features || []).map((f) => ({ id: String(f.properties?.gid || '').slice(0, 120), name: String(f.properties?.name || f.properties?.label || '').slice(0, 120), label: String(f.properties?.label || '').slice(0, 200), layer: String(f.properties?.layer || '').slice(0, 30), confidence: Number(f.properties?.confidence) || 0.5, lon: Number(f.geometry?.coordinates?.[0]), lat: Number(f.geometry?.coordinates?.[1]) })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon))
    return c.json({ results, area: AREA.name, attribution: mapStatus(c.env).attribution })
  })
  api.post('/route', async (c) => {
    const g = await guard(c, 'map_route'); if (g) return g
    const b = await body(c), from = coord(b?.from), to = coord(b?.to); if (!from || !to) return err(c, 'Origen o destino inválido.')
    if (!inBox(to)) return err(c, 'Ese destino está fuera de la zona del mapa de EVIE (' + AREA.name + '). Para viajes fuera de la ciudad usa una app de navegación.', 422, { code: 'outside_area' })
    if (!inBox(from)) return err(c, 'Tu origen está fuera de la zona del mapa (' + AREA.name + '). Indica un origen dentro de la ciudad o usa una app de navegación.', 422, { code: 'origin_outside_area' })
    const mode = MODES.has(b?.mode) ? b.mode : 'auto', traffic = mode === 'auto' && c.env.EVIE_MAP_TRAFFIC === 'on'
    const start = { ...from, type: 'break', ...(Number.isFinite(b?.heading) ? { heading: Math.round(b.heading) % 360, heading_tolerance: 60 } : {}) }
    const req = { locations: [start, { ...to, type: 'break' }], costing: traffic ? 'auto_traffic' : mode, units: 'kilometers', language: 'es-ES', directions_type: 'instructions' }
    const r = await call(c.env, '/route/v1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }); if (r.error) return err(c, r.error, r.status, { code: r.code })
    await usage(c.env, c.get('owner'), 'map_route', 1)
    if (r.json?.trip?.status !== 0) return err(c, r.json?.trip?.status_message || 'El proveedor no encontró una ruta.', 422, { code: 'no_route' })
    // The provider's trip is returned as-is (parsed client-side by EvieMapCore.parseValhalla): never edited.
    return c.json({ trip: r.json.trip, mode, traffic, provider: 'Stadia Maps (Valhalla, OpenStreetMap)', attribution: mapStatus(c.env).attribution, computed_at: new Date().toISOString() })
  })
  return api
}
