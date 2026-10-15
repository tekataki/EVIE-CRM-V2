// E2E Mapa (browser). /api/map/* is emulated here (the real proxy is covered by tests/map-server.test.cjs);
// the route returned is a synthetic Valhalla trip encoded with our own polyline6 encoder over central
// Ciudad Guzmán, so this checks the UI contract: honest "not configured" state, disambiguation, outside area,
// denied GPS → manual origin, provider-only route data, simulated foreground navigation (weak GPS, off-route
// reroute, arrival), voice intents, Stop control, HUD card, attribution, no horizontal overflow, nothing stored.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const W = Number(process.env.W || 1440), H = W < 700 ? 844 : 900, SHOT = process.env.SHOT
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=220', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: W < 700, hasTouch: W < 700, locale: 'es-MX', timezoneId: 'America/Mexico_City' })
const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept())
const checks = []; const ok = (m) => { checks.push(m); console.log('  ✓', m) }
let configured = false; const calls = { search: [], route: [] }
const A = { lat: 19.7000, lon: -103.4650 }, B = { lat: 19.7054, lon: -103.4650 }, D = { lat: 19.7054, lon: -103.4612 }
await p.route('https://tiles.stadiamaps.com/**', (r) => r.request().url().endsWith('.json') ? r.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#16203a' } }] } }) : r.fulfill({ status: 204 }))
await p.route('**/api/map/**', async (r) => {
  const u = new URL(r.request().url()), path = u.pathname.replace('/api/map', ''), body = r.request().postData() ? JSON.parse(r.request().postData()) : {}
  if (path === '/config') return r.fulfill({ json: configured ? { configured: true, provider: 'Stadia Maps', traffic: false, styleDark: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json', styleLight: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json', missing: [], attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors' } : { configured: false, missing: ['STADIA_API_KEY (secreto de Cloudflare) para rutas y búsqueda de lugares', 'Dominio de producción autorizado en Stadia Maps'], attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors' } })
  if (!configured) return r.fulfill({ status: 503, json: { error: 'El mapa no está configurado.', code: 'not_configured' } })
  if (path === '/search') {
    calls.search.push(body.text)
    if (/tecnol/i.test(body.text)) return r.fulfill({ json: { results: [
      { id: 'a', name: 'Instituto Tecnológico de Ciudad Guzmán', label: 'Av. Tecnológico 100, Ciudad Guzmán, JAL', confidence: 0.8, lat: D.lat, lon: D.lon },
      { id: 'b', name: 'Tecnológico Nacional de México campus norte', label: 'Ciudad Guzmán, JAL', confidence: 0.78, lat: 19.712, lon: -103.455 },
      { id: 'c', name: 'Tecnológico de Guadalajara', label: 'Guadalajara, JAL', confidence: 0.9, lat: 20.6767, lon: -103.3475 }] } })
    if (/guadalajara/i.test(body.text)) return r.fulfill({ json: { results: [{ id: 'g', name: 'Guadalajara', label: 'Guadalajara, JAL', confidence: 0.9, lat: 20.6767, lon: -103.3475 }] } })
    return r.fulfill({ json: { results: [] } })
  }
  if (path === '/route') { calls.route.push(body); const trip = await p.evaluate(([A, B, D, from]) => { const C = EvieMapCore, line = (p, q, n) => Array.from({ length: n + 1 }, (_, i) => ({ lat: p.lat + (q.lat - p.lat) * i / n, lon: p.lon + (q.lon - p.lon) * i / n })); const start = from || A; const pts = [...line(start, B, 12), ...line(B, D, 8).slice(1)]; let L = 0; for (let i = 1; i < pts.length; i++)L += C.dist(pts[i - 1], pts[i]); return { status: 0, status_message: 'Found route', units: 'kilometers', summary: { length: L / 1000, time: 180 }, legs: [{ shape: C.encode(pts, 6), maneuvers: [{ type: 1, instruction: 'Dirígete al norte por Avenida Cristóbal Colón.', verbal_pre_transition_instruction: 'Dirígete al norte por Avenida Cristóbal Colón.', length: 0.6, time: 110, begin_shape_index: 0 }, { type: 10, instruction: 'Gira a la derecha en Calle Federico del Toro.', verbal_pre_transition_instruction: 'Gira a la derecha en Calle Federico del Toro.', length: 0.4, time: 70, begin_shape_index: 12 }, { type: 4, instruction: 'Llegaste a tu destino.', verbal_pre_transition_instruction: 'Llegaste a tu destino.', length: 0, time: 0, begin_shape_index: pts.length - 1 }] }] } }, [A, B, D, body.from]); return r.fulfill({ json: { trip, mode: body.mode, traffic: false, provider: 'Stadia Maps (Valhalla, OpenStreetMap)' } }) }
  return r.fulfill({ status: 404, json: { error: 'no' } })
})
const until = async (fn, a, ms = 15000) => { try { return await p.waitForFunction(fn, a, { timeout: ms }) } catch (e) { console.log('STUCK', JSON.stringify(await p.evaluate(() => ({ hash: location.hash, stats: window.EvieMap?.stats(), panel: document.getElementById('map-panel')?.innerText.slice(0, 300) })))); throw e } }
const stats = () => p.evaluate(() => EvieMap.stats())
const noOverflow = async (label) => { const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, wide: [...document.querySelectorAll('#map-page *')].filter((n) => n.getBoundingClientRect().right > innerWidth + 1).map((n) => n.className || n.tagName).slice(0, 4) })); assert.ok(o.sw <= o.w + 1 && !o.wide.length, label + ' overflow ' + JSON.stringify(o)) }
await p.goto('http://localhost:3000/index.html?qa=map' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 30000 })
await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true }); const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: false, stt: false, tts: false }; EvieAccounts.current = () => ({ id: '11111111-1111-4111-8111-111111111111', username: 'ale' }); EvieAccounts.storageKey = () => k; EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status, code: j.code }); return j }); EvieMap.reset(); window.__said = []; location.hash = 'mapa' })
// 1) navigation/search/capabilities wiring
assert.ok(await p.evaluate(() => DALI_CONFIG.sections.some((s) => s.route === 'mapa' && s.searchTerms.includes('ruta'))))
assert.ok(await p.evaluate(() => EvieCards.capabilities().flatMap((g) => g.items).some((x) => x.card === 'mapa')))
ok('Mapa is a navigation section (searchable by «ruta») and a capability')
// 2) not configured: honest state, no route
await until(() => document.querySelector('#map-panel [data-state=not_configured]'))
let t = await p.innerText('#map-panel'); assert.match(t, /STADIA_API_KEY/); assert.match(t, /no inventa rutas/); assert.match(t, /OpenStreetMap/)
const sayMap = (q) => p.evaluate((q) => new Promise((res) => { const out = EvieMap.intent(q, { say: (x) => res(x) }); if (out !== '') res(out) }), q)
assert.match(await sayMap('Ivi, calcula la ruta al Tecnológico'), /no está configurado/); assert.equal(calls.route.length, 0); assert.equal((await stats()).route, null)
ok('without provider credentials: panel lists what is missing, voice says so, no route is invented')
if (SHOT) await p.screenshot({ path: `${SHOT}-notconfigured.png` })
// 3) configured
configured = true; await p.evaluate(async () => { EvieMap.reset(); location.hash = 'inicio'; await new Promise((r) => setTimeout(r, 200)); location.hash = 'mapa' })
await until(() => document.getElementById('map-q'))
const r1 = await p.evaluate(() => EvieMap.search('el tecnológico'))
assert.equal(r1.status, 'ambiguous'); await until(() => document.querySelectorAll('[data-map-cand]').length === 2)
t = await p.innerText('.map-cands'); assert.doesNotMatch(t, /Guadalajara/); ok('«el tecnológico» → disambiguation with only in-area candidates (Guadalajara result filtered)')
const r2 = await p.evaluate(() => EvieMap.search('Guadalajara')); assert.equal(r2.status, 'outside_area'); assert.equal(await p.getAttribute('#map-status', 'data-state'), 'outside'); ok('destination outside Ciudad Guzmán → explicit unsupported-destination state')
// 4) GPS denied → manual origin (no permission granted in this context)
await p.evaluate(() => EvieMap.search('tecnológico')); await until(() => document.querySelectorAll('[data-map-cand]').length === 2)
await p.click('[data-map=me]'); await until(() => document.querySelector('#map-status')?.dataset.state === 'denied')
assert.match(await p.innerText('#map-status'), /Elige el origen en el mapa/); ok('location permission denied → clear message + manual origin offered')
await p.click('[data-map=pick-origin]'); assert.equal(await p.getAttribute('[data-map=pick-origin]', 'aria-pressed'), 'true')
const mapReady = (await stats()).mapReady
await p.evaluate((A) => EvieMap.setOrigin({ ...A, label: 'Punto elegido en el mapa', manual: true }), A)
await p.click('[data-map-cand="0"]'); await until(() => document.querySelector('[data-map=start]'))
const s1 = await stats(); assert.equal(calls.route.length, 1); assert.deepEqual(calls.route[0].from, A); assert.equal(s1.route.maneuvers, 3); assert.equal(s1.route.timeS, 180)
t = await p.innerText('#map-panel'); assert.match(t, /3 min/); assert.match(t, /Gira a la derecha en Calle Federico del Toro/); assert.match(t, /sin tráfico en vivo/); assert.match(t, /no equivale a tráfico en vivo/); assert.match(t, /Abrir en una app de navegación/)
ok('route shows ONLY provider distance/time/maneuvers, labelled «sin tráfico en vivo», with handoff link')
await noOverflow('route'); ok(`no horizontal overflow at ${W}px; WebGL map ${mapReady ? 'rendered' : 'unavailable (text route still works)'}`)
if (mapReady) { await until(() => /OpenStreetMap/.test(document.querySelector('.maplibregl-ctrl-attrib')?.innerText || '')); ok('MapLibre attribution control shows Stadia / OpenMapTiles / OpenStreetMap') } else assert.match(await p.innerText('.map-attr'), /OpenStreetMap/)
if (SHOT) await p.screenshot({ path: `${SHOT}-route.png` })
// 5) foreground navigation with a simulated track
await ctx.grantPermissions(['geolocation']); await ctx.setGeolocation({ latitude: A.lat, longitude: A.lon, accuracy: 8 })
await p.click('[data-map=start]'); await until(() => document.querySelector('[data-map=stop]'))
assert.equal((await stats()).status, 'navigating'); assert.equal(await p.evaluate(() => document.documentElement.dataset.mapNav), '1'); ok('«Iniciar navegación» starts a foreground session with a visible Stop control')
const fix = (pt, acc = 8) => p.evaluate(([pt, acc]) => EvieMap._onFix({ lat: pt.lat, lon: pt.lon, accuracy: acc, speed: 8, timestamp: Date.now() }), [pt, acc])
let ev = await fix({ lat: 19.7010, lon: -103.4650 }, 90); assert.equal(ev.kind, 'gps'); assert.equal((await stats()).status, 'weak'); assert.match(await p.innerText('#map-status'), /impreciso/)
ok('weak GPS (±90 m) → says so, no confident instruction')
ev = await fix({ lat: 19.7012, lon: -103.4650 }); assert.equal(ev.kind, 'progress'); assert.match(await p.innerText('.map-gps'), /Posición en vivo · GPS ±8 m/)
assert.match(await sayMap('Ivi, ¿cuánto falta?'), /^Faltan .*sin tráfico en vivo/); ok('«¿cuánto falta?» answers from the provider route + live position, accuracy shown')
const before = calls.route.length
for (const lon of [-103.4600, -103.4598, -103.4596]) ev = await fix({ lat: 19.7020, lon })
await until((n) => window.EvieMap.stats().status === 'navigating', null); assert.equal(calls.route.length, before + 1, 'exactly one reroute after 3 consecutive off-route fixes'); assert.equal(calls.route.at(-1).from.lon, -103.4596)
ok('off-route (3 consecutive fixes > 35 m) → one debounced reroute from the live position')
await fix({ lat: 19.7020, lon: -103.4594 }); await fix({ lat: 19.7020, lon: -103.4592 }); assert.equal(calls.route.length, before + 1); ok('reroute debounce: no second provider call within 20 s')
assert.match(await sayMap('Ivi, silencia'), /silenciada/); assert.equal((await stats()).muted, true); assert.match(await p.innerText('[data-map=mute]'), /Activar voz/)
assert.match(await sayMap('repite'), /.+/); ok('«silencia» mutes guidance (button reflects it); «repite» repeats the last instruction')
const pts = await p.evaluate(([A, B, D]) => { const line = (p, q, n) => Array.from({ length: n + 1 }, (_, i) => ({ lat: p.lat + (q.lat - p.lat) * i / n, lon: p.lon + (q.lon - p.lon) * i / n })); return [...line({ lat: 19.7020, lon: -103.4596 }, B, 12), ...line(B, D, 8).slice(1)] }, [A, B, D])
for (const pt of pts) { ev = await fix(pt); if (ev?.kind === 'arrived') break }
assert.equal(ev.kind, 'arrived'); assert.equal((await stats()).status, 'arrived'); assert.equal((await stats()).nav, false); assert.equal(await p.$('[data-map=stop]'), null)
ok('simulated drive reaches the destination → «Llegaste», session closed, GPS watch stopped')
// 6) stop control + voice stop
await p.click('[data-map=start]'); await until(() => document.querySelector('[data-map=stop]'))
assert.equal(await sayMap('Ivi, termina la navegación'), 'Terminé la navegación.'); assert.equal((await stats()).nav, false)
await p.click('[data-map=start]'); await p.click('[data-map=stop]'); await until(() => document.querySelector('#map-status')?.dataset.state === 'stopped'); ok('«termina la navegación» and the Stop button both end guidance')
// 7) voice open + HUD card
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('evie-stage-input'))
assert.equal(await p.evaluate(() => EvieAssistant.tryLocal('Ivi, abre el mapa')), 'Abrí el mapa de Ciudad Guzmán.'); await until(() => location.hash === '#mapa'); ok('«Ivi, abre el mapa» (local intent) opens the section')
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('evie-stage-input'))
await p.evaluate(() => EvieHUD.open('mapa')); await until(() => /Instituto Tecnológico/.test([...document.querySelectorAll('.hud-card')].map((n) => n.innerText).join(' ')))
ok('HUD card «Mapa · Ciudad Guzmán» shows the current destination and route')
// 8) no location history persisted
const stored = await p.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join('|') + Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)).join('|'))
assert.ok(!/19\.70[0-9]|-103\.4[0-9]{2}/.test(stored), 'coordinates found in storage'); ok('no coordinates in localStorage/sessionStorage (no location history)')
assert.deepEqual(errors, []); console.log(`MAP E2E OK (${checks.length} checks, ${W}x${H})`); await b.close()
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ W, checks }, null, 1))
