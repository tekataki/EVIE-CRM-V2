import sys
p='src/map.js';s=open(p).read()
if 'route-query' in s: print('already'); sys.exit()
def rep(old,new):
    global s
    assert s.count(old)==1,(old[:70],s.count(old)); s=s.replace(old,new)
rep("import { usage } from './assistant.js'\n","import { usage } from './assistant.js'\nimport { parseRouteQuery, pickPlace, spokenRoute, MODE_ES } from './map-query.js'\n")
rep("""    return c.json({ trip: r.json.trip, mode, traffic, provider: 'Stadia Maps (Valhalla, OpenStreetMap)', attribution: mapStatus(c.env).attribution, computed_at: new Date().toISOString() })
  })
  return api""","""    return c.json({ trip: r.json.trip, mode, traffic, provider: 'Stadia Maps (Valhalla, OpenStreetMap)', attribution: mapStatus(c.env).attribution, computed_at: new Date().toISOString() })
  })
  // v5 · Voice route question → geocode origin/destination (area-bounded) → real Valhalla route.
  // Body: { text } (the utterance) or { origin, destination, mode }, plus optional here:{lat,lon} (device location,
  // only when the user said "desde aquí" and granted permission) and choice:{origin|destination:{lat,lon}} after a
  // disambiguation. Nothing about the places is stored or logged; only the daily counters move.
  api.post('/route-query', async (c) => {
    const b = await body(c); if (!b) return err(c, 'Solicitud inválida.')
    const q = typeof b.text === 'string' ? parseRouteQuery(b.text.slice(0, 300)) : { intent: 'route', origin: typeof b.origin === 'string' ? b.origin.slice(0, 120) : 'here', destination: typeof b.destination === 'string' ? b.destination.slice(0, 120) : null, mode: MODES.has(b.mode) ? b.mode : 'auto' }
    if (q.intent === 'open_section') return c.json({ intent: 'open_section', say: 'Abriendo el mapa.' })
    if (q.intent === 'show_card') return c.json({ intent: 'show_card', say: 'Te dejé la tarjeta del mapa.' })
    if (q.intent !== 'route') return err(c, 'No entendí una pregunta de ruta.', 422, { code: 'not_route' })
    if (!q.destination) return c.json({ intent: 'route', status: 'needs_destination', say: '¿A dónde quieres ir?' })
    const g = await guard(c, 'map_route'); if (g) return g
    const env = c.env, owner = c.get('owner')
    const resolve = async (label, which) => {
      const chosen = coord(b.choice?.[which]); if (chosen) return { place: { ...chosen, name: label === 'here' ? 'tu ubicación' : label, label } }
      if (label === 'here') { const h = coord(b.here); return h ? { place: { ...h, name: 'tu ubicación', label: 'tu ubicación' } } : { needs_location: true } }
      if (await usage(env, owner, 'map_search') >= mapLimits(env).map_search) return { error: 'Llegaste al límite diario de búsquedas del mapa.', status: 429, code: 'quota' }
      const qs = new URLSearchParams({ text: label, size: '5', lang: 'es', 'boundary.country': 'MX', 'focus.point.lat': String(AREA.center.lat), 'focus.point.lon': String(AREA.center.lon) })
      for (const [k, v] of Object.entries(AREA.bbox)) qs.set('boundary.rect.' + k, String(v))
      const r = await call(env, '/geocoding/v1/search?' + qs, { method: 'GET' }); if (r.error) return r
      await usage(env, owner, 'map_search', 1)
      const results = (r.json?.features || []).map((f) => ({ id: String(f.properties?.gid || '').slice(0, 120), name: String(f.properties?.name || f.properties?.label || '').slice(0, 120), label: String(f.properties?.label || '').slice(0, 200), confidence: Number(f.properties?.confidence) || 0.5, lon: Number(f.geometry?.coordinates?.[0]), lat: Number(f.geometry?.coordinates?.[1]) })).filter((x) => inBox(x))
      return pickPlace(results)
    }
    const from = await resolve(q.origin, 'origin'); if (from.error) return err(c, from.error, from.status || 502, { code: from.code })
    if (from.needs_location) return c.json({ intent: 'route', status: 'needs_location', destination_text: q.destination, mode: q.mode, say: 'Para calcular desde donde estás necesito tu ubicación. Permite la ubicación o dime desde dónde sales.' })
    if (from.none) return c.json({ intent: 'route', status: 'not_found', which: 'origin', say: `No encontré «${q.origin}» dentro de ${AREA.name}. ¿Me das otra referencia?` })
    if (from.candidates) return c.json({ intent: 'route', status: 'ambiguous', which: 'origin', candidates: from.candidates, say: `Encontré varios lugares para «${q.origin}». ¿Cuál es?` })
    const to = await resolve(q.destination, 'destination'); if (to.error) return err(c, to.error, to.status || 502, { code: to.code })
    if (to.none) return c.json({ intent: 'route', status: 'not_found', which: 'destination', say: `No encontré «${q.destination}» dentro de ${AREA.name}. Si está fuera de la ciudad, usa una app de navegación.` })
    if (to.candidates) return c.json({ intent: 'route', status: 'ambiguous', which: 'destination', candidates: to.candidates, say: `Hay varios lugares que coinciden con «${q.destination}». ¿Cuál?` })
    const A = from.place, B = to.place
    if (!inBox(A)) return err(c, 'Tu origen está fuera de la zona del mapa (' + AREA.name + ').', 422, { code: 'origin_outside_area' })
    if (!inBox(B)) return err(c, 'Ese destino está fuera de la zona del mapa (' + AREA.name + '). Para viajes fuera de la ciudad usa una app de navegación.', 422, { code: 'outside_area' })
    const mode = q.mode, traffic = mode === 'auto' && env.EVIE_MAP_TRAFFIC === 'on'
    const req = { locations: [{ lat: A.lat, lon: A.lon, type: 'break' }, { lat: B.lat, lon: B.lon, type: 'break' }], costing: traffic ? 'auto_traffic' : mode, units: 'kilometers', language: 'es-ES', directions_type: 'instructions' }
    const r = await call(env, '/route/v1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }); if (r.error) return err(c, r.error, r.status, { code: r.code })
    await usage(env, owner, 'map_route', 1)
    if (r.json?.trip?.status !== 0) return err(c, 'El proveedor no encontró una ruta entre esos puntos.', 422, { code: 'no_route' })
    const km = Number(r.json.trip.summary?.length) || 0, minutes = (Number(r.json.trip.summary?.time) || 0) / 60
    const originLabel = A.name || 'el origen', destLabel = B.name || 'el destino'
    return c.json({ intent: 'route', status: 'ok', origin: { name: originLabel, lat: A.lat, lon: A.lon }, destination: { name: destLabel, lat: B.lat, lon: B.lon }, mode, mode_label: MODE_ES[mode], distance_km: Math.round(km * 100) / 100, duration_min: Math.round(minutes * 10) / 10, traffic, traffic_note: mode === 'auto' && !traffic ? 'El tiempo no incluye tráfico en tiempo real.' : null, trip: r.json.trip, provider: 'Stadia Maps (Valhalla, OpenStreetMap)', attribution: mapStatus(env).attribution, say: spokenRoute({ km, minutes, mode, traffic, originLabel, destLabel }), computed_at: new Date().toISOString() })
  })
  return api""")
open(p,'w').write(s); print('patched')
