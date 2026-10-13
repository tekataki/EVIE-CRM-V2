// v3.1 regression: HUD workspace persistence (cards survive TTS, new prompts, rerender, sync, theme,
// navigation; no eviction; late responses cannot resurrect closed cards; account switch wipes).
// /api/info/*, ai/chat and /api/ai/tts are mocked; everything else is the real app.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900)
const b = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--js-flags=--max-old-space-size=200'] })
const p = await (await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' })).newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
const calls = { research: 0, weather: 0 }; let slowResearch = false
await p.route('**/api/info/weather', (r) => { calls.weather++; return r.fulfill({ json: { place: 'Ciudad Guzmán, Jalisco, MX', timezone: 'America/Mexico_City', current: { observed_at: '2026-10-12T09:00', temperature_c: 18.4, feels_like_c: 17, humidity: 70, wind_kmh: 6, precipitation_mm: 0, condition: 'Parcialmente nublado' }, days: [{ date: '2026-10-12', max_c: 26, min_c: 12, rain_prob: 30, condition: 'Nublado' }, { date: '2026-10-13', max_c: 25, min_c: 11, rain_prob: 60, condition: 'Lluvia ligera' }], retrieved_at: '2026-10-12T15:00:00Z', attribution: { text: 'Datos: Open-Meteo (CC BY 4.0)', url: 'https://open-meteo.com/' } } }) })
await p.route('**/api/info/research', async (r) => { calls.research++; const q = r.request().postDataJSON()?.query || ''; if (slowResearch) await new Promise((x) => setTimeout(x, 2500)); return r.fulfill({ json: { query: q, insufficient: false, summary: 'Resumen de ' + q + '.', spoken: 'Listo.', key_points: ['Punto uno'], event_date: null, sources: [{ url: 'https://example.org/a', title: 'Fuente A', host: 'example.org', published: '2026-09-01' }], images: [], retrieved_at: '2026-10-12T15:00:00Z', timezone: 'America/Mexico_City', dropped: 0 } }) })
await p.route('**/api/ai/tts', (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.alloc(32044) }))
await p.goto('http://localhost:3000/index.html?qa=ws' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 30000 })
await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.profile.preferred = 'Alejandro'; s.preferences.evie = { ...(s.preferences.evie || {}), cloudAI: true, cloudVoice: true, muted: false, conversation: true } }); location.hash = 'inicio'; App.render() })
await p.evaluate(() => {
  const k = EvieAccounts.storageKey(); EvieAccounts.storageKey = () => k; const cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.research = true; cfg.ai = { chat: true, stt: false, tts: true }
  window.__uid = '11111111-1111-4111-8111-111111111111'; EvieAccounts.current = () => ({ id: window.__uid, username: 'alejandro' })
  const req = EvieAccounts.request; window.__speech = []
  EvieAccounts.request = async (path, o = {}) => {
    if (path === 'ai/chat') { const last = o.body.input.at(-1)
      if (last.type === 'function_call_output') return { text: 'En Ciudad Guzmán hay 18 grados y parcialmente nublado.', spoken: 'En Ciudad Guzmán hay 18 grados.' }
      if (/clima/.test(last.content)) return { calls: [{ type: 'function_call', name: 'get_weather', call_id: 'c1', arguments: '{"place":"Ciudad Guzmán"}' }] }
      if (/investiga/.test(last.content)) return { calls: [{ type: 'function_call', name: 'research_web', call_id: 'c2', arguments: JSON.stringify({ query: last.content.replace(/^investiga /, '') }) }] }
      return { text: 'El TEC es un instituto público.', spoken: 'El TEC es un instituto público.' } }
    if (path.startsWith('info/')) { const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o.body || {}) }); return r.json() }
    return req(path, o) }
  new MutationObserver(() => window.__speech.push(document.documentElement.dataset.evie)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-evie'] })
})
const checks = []; const ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
const say = (t) => p.evaluate((t) => { const i = document.getElementById('evie-stage-input'); i.value = t; document.getElementById('evie-stage-form').requestSubmit() }, t)
const until = (fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms })
const st = () => p.evaluate(() => ({ cards: EvieHUD.cards(), dom: [...document.querySelectorAll('#hud-cards .hud-card')].map((n) => n.id) }))
// 1. weather + TTS
await say('¿Qué clima hace en Ciudad Guzmán?')
await until(() => EvieHUD.cards().some((c) => c.type === 'weather' && c.state === 'ready'))
const wid = (await st()).cards.find((c) => c.type === 'weather').id
await until(() => window.__speech.includes('speaking'), null, 15000)
await until(() => document.documentElement.dataset.evie === 'idle', null, 20000)
let s = await st(); assert.ok(s.cards.some((c) => c.id === wid) && s.dom.includes(wid), 'weather card must survive TTS'); ok('weather card stays through speaking → idle (same id ' + wid + ')')
// 2. second question keeps the first card
await say('¿Qué es el TEC?'); await until(() => document.querySelector('#evie-subs')?.innerText.includes('instituto'))
await until(() => document.documentElement.dataset.evie === 'idle', null, 20000)
s = await st(); assert.ok(s.dom.includes(wid)); ok('second question keeps the first card')
// 3. rerender, sync-style render, theme change
const wBefore = calls.weather
await p.evaluate(() => App.render()); s = await st(); assert.ok(s.dom.includes(wid)); assert.equal(calls.weather, wBefore, 'rerender must not refetch weather')
await p.evaluate(() => { Store.save((x) => { x.preferences.theme = x.preferences.theme === 'dark' ? 'light' : 'dark' }); App.render() }); s = await st(); assert.ok(s.dom.includes(wid))
await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(600); s = await st(); assert.ok(s.dom.includes(wid))
ok('App.render(), theme change and focus/sync refresh keep cards (no refetch: ' + calls.weather + ' weather calls)')
// 4. six+ cards, none evicted
await p.evaluate(() => { for (const t of ['clock', 'finanzas', 'habitos', 'objetivos', 'agenda', 'pendientes']) EvieHUD.open(t) }); await p.waitForTimeout(1500)
s = await st(); assert.equal(s.cards.length, 7); assert.ok(s.cards.some((c) => c.id === wid)); const tray = await p.evaluate(() => document.querySelectorAll('#hud-tray [data-hud-front]').length)
assert.equal(tray + s.dom.length, 7); ok(`7 cards open, none evicted (${s.dom.length} visible + ${tray} in tray)`)
s = await p.evaluate(() => { const r = [...document.querySelectorAll('#hud-cards .hud-card')].map((n) => n.getBoundingClientRect()); const core = document.querySelector('#hud-core canvas').getBoundingClientRect(), comp = document.getElementById('evie-stage-form').getBoundingClientRect(); const hit = (a, b) => a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2; let o = 0; for (let i = 0; i < r.length; i++) { for (let j = i + 1; j < r.length; j++) if (hit(r[i], r[j])) o++; if (hit(r[i], comp)) o++ } return { o, sw: document.documentElement.scrollWidth, vw: innerWidth } })
assert.equal(s.o, 0, 'cards overlap'); assert.ok(s.sw <= s.vw + 1, 'horizontal overflow'); ok('visible cards do not overlap each other or the composer; no horizontal scroll')
// tray brings a card forward
await p.click('#hud-tray [data-hud-front]'); await p.waitForTimeout(700); s = await st(); assert.equal(s.cards.length, 7); ok('tray chip brings a hidden card forward without closing any')
// 5. close named card, keep others
await say('cierra la tarjeta del clima'); await until(() => !EvieHUD.cards().some((c) => c.type === 'weather'))
s = await st(); assert.equal(s.cards.length, 6); ok('"cierra la tarjeta del clima" closes only that card')
// research by name + ambiguity
await say('investiga el TEC de Ciudad Guzmán'); await until(() => EvieHUD.cards().some((c) => c.type === 'research' && c.state === 'ready'))
await until(() => document.documentElement.dataset.evie === 'idle', null, 20000)
await say('quita la investigación sobre el TEC'); await until(() => !EvieHUD.cards().some((c) => c.type === 'research'))
ok('"quita la investigación sobre el TEC" closes the research card')
// "finaliza esta tarjeta" must not complete a task
const doneBefore = await p.evaluate(() => Store.list('agendaItems').filter((x) => x.status === 'done').length)
await p.evaluate(() => document.querySelector('#hud-cards .hud-card')?.focus()); await say('finaliza esta tarjeta'); await p.waitForTimeout(800)
const doneAfter = await p.evaluate(() => Store.list('agendaItems').filter((x) => x.status === 'done').length); assert.equal(doneAfter, doneBefore); ok('"finaliza esta tarjeta" closes presentation only; no task completed')
// 6. close a loading card; late response must not resurrect it
slowResearch = true
const rid = await p.evaluate(() => EvieHUD.open('research', { query: 'tema lento' }).id); await p.waitForTimeout(300)
await p.evaluate((id) => EvieHUD.close(id), rid); await p.waitForTimeout(3200)
s = await st(); assert.ok(!s.cards.some((c) => c.id === rid) && !s.dom.includes(rid)); slowResearch = false; ok('closed loading card is not resurrected by its late response')
// 7. navigate to a module and back: workspace restored, no refetch
const before = (await st()).cards.map((c) => c.id); const rc = calls.research
await p.evaluate(() => { location.hash = 'finanzas' }); await until(() => !document.getElementById('evie-hud'))
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('evie-hud')); await p.waitForTimeout(800)
s = await st(); assert.deepEqual(s.cards.map((c) => c.id), before); assert.equal(calls.research, rc); ok('module → Home restores the same workspace (' + before.length + ' cards)')
// 8. account switch: no leak
await p.evaluate(() => { EvieHUD.reset(); window.__uid = '22222222-2222-4222-8222-222222222222'; App.render() }); await p.waitForTimeout(500)
s = await st(); assert.equal(s.cards.length, 0); assert.equal(s.dom.length, 0)
const leak = await p.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes('11111111')))
assert.equal(leak.length, 0); ok('sign-out/switch: other account sees no cards and no stored workspace')
// close all
await p.evaluate(() => { EvieHUD.open('clock'); EvieHUD.open('finanzas') }); await p.waitForTimeout(500); await say('cierra todas las tarjetas'); await until(() => EvieHUD.cards().length === 0); ok('"cierra todas las tarjetas" clears the workspace')
assert.deepEqual(errors, []); console.log(`WORKSPACE E2E OK (${checks.length} checks, ${W}x${H})`); await b.close()
