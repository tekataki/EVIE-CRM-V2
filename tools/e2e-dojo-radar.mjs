// E2E v10 Fase 5 (browser): Dojo de ventas (escenario, dueño en personaje, texto y dictado, calificación con modo
// inglés, historial, acceso desde la Cabina, intención de voz) y Radar local (tarjeta del HUD: avisos, noticias con
// confirmado/no confirmado, planes del finde con tope, cambio de presupuesto, intención de voz, avisos para Ivi).
// /api/dojo and /api/radar are emulated here (server side: tests/dojo-radar.test.cjs).
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), THEME = process.env.THEME || 'dark', SHOT = process.env.SHOT || ''
const b = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept())
const calls = { turn: [], score: 0, news: 0, plans: [] }
const lines = ['Buenas. Tengo poco tiempo, ¿qué vende?', 'Suena caro. Ya me ofrecieron algo parecido.', 'Bueno… ¿y cuándo empezaríamos?']
await p.route('**/api/dojo/turn', (r) => { const body = JSON.parse(r.request().postData() || '{}'); calls.turn.push(body); const i = Math.min(calls.turn.length - 1, 2); r.fulfill({ json: { reply: lines[i], objection: i === 1 ? 'precio' : '', mood: ['frio', 'neutral', 'interesado'][i], ended: i === 2 } }) })
await p.route('**/api/dojo/score', (r) => { calls.score++; r.fulfill({ json: { score: { claridad: 8, objeciones: 6, cierre: 7, total: 70, resumen: 'Buen inicio; faltó validar la objeción.', fortalezas: ['Fuiste al grano'], mejoras: ['Valida antes de responder'], frase_modelo: 'Entiendo que el precio importa, ¿qué le preocupa más?', nivel_ingles: 'B2', correcciones: [{ dije: 'I help you to sell', mejor: 'I can help you sell' }] } } }) })
await p.route('**/api/radar/news', (r) => { calls.news++; r.fulfill({ json: { city: 'Ciudad de prueba', date: null, items: [{ titulo: 'Nueva ley para pymes', resumen: 'Cambios en facturación.', categoria: 'negocios', url: 'https://noticias.example.org/a', fuente: 'noticias.example.org', fecha: '2026-11-21', confirmado: true }, { titulo: 'Rumor de nueva plaza', resumen: 'Sin confirmar.', categoria: 'local', url: '', fuente: '', fecha: '', confirmado: false }], avisos: [{ titulo: 'Cierre de calle por desfile', detalle: 'Centro cerrado de 9 a 13 h.', cuando: 'hoy', url: 'https://eventos.example.org/b', confirmado: true }], generated_at: new Date().toISOString() } }) })
await p.route('**/api/radar/plans', (r) => { const body = JSON.parse(r.request().postData() || '{}'); calls.plans.push(body.budget); r.fulfill({ json: { city: 'Ciudad de prueba', weekend: { from: '2026-11-27', to: '2026-11-29' }, budget: body.budget, planes: [{ titulo: 'Feria del libro', cuando: 'sábado 11:00', donde: 'Centro', costo_mxn: 0, url: 'https://eventos.example.org/c', por_que: 'Gratis', confirmado: true }, { titulo: 'Cine al aire libre', cuando: 'viernes 20:00', donde: 'Parque', costo_mxn: 80, url: '', por_que: '', confirmado: false }], generated_at: new Date().toISOString() } }) })
await p.route('**/api/info/weather', (r) => r.fulfill({ json: { place: 'Ciudad de prueba', current: { temperature_c: 21, condition: 'Despejado' }, days: [] } }))
await p.goto('http://localhost:3000/index.html?qa=dojo' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
await p.evaluate((theme) => {
  window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove()
  Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme; s.profile.preferred = 'Sam'; s.preferences.iviBriefing = { wake: '06:00', gymMinutes: 60, travelMinutes: 15, auto: false }; s.preferences.somaCabin = { packages: [{ id: 'p1', name: 'Menú digital QR', includes: [], one_time: null, monthly: null }] } })
  const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: true, provider: 'openai', stt: true, tts: true }
  EvieAccounts.current = () => ({ id: 'aaaaaaaa-0000-4000-8000-000000000004' }); EvieAccounts.storageKey = () => k
  EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j })
  window.__said = []; if (window.EvieAssistant) window.EvieAssistant = { ...window.EvieAssistant, say: async (x) => { window.__said.push(x) } }
  window.__dict = null; window.EvieDictation = { start: async (o) => { window.__dict = o; return { ok: true } }, stop: () => { window.__dict?.onDone?.({ text: 'Le ayudo a vender más con un menú QR, ¿lo dejamos listo el lunes?' }) }, cancel() {} }
  App.render() }, THEME)
const until = async (fn, a, ms = 12000) => { try { return await p.waitForFunction(fn, a, { timeout: ms }) } catch (e) { console.log('STUCK', JSON.stringify(await p.evaluate(() => ({ hash: location.hash, root: document.getElementById('dj-root')?.textContent?.slice(0, 200), toasts: [...document.querySelectorAll('#toast-region .toast')].map((x) => x.textContent.slice(0, 80)) })))); throw e } }
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
const out = {}
// ---- Cabina → Dojo
await p.evaluate(() => { location.hash = 'soma' }); await until(() => document.querySelector('#sc-cabin a[href="#dojo"]')); await p.click('#sc-cabin a[href="#dojo"]'); await until(() => document.getElementById('dj-setup'))
out.offer = await p.evaluate(() => document.querySelector('[data-dj="offer"]').value === 'Menú digital QR')
await p.selectOption('[data-dj="business"]', 'cafetería')
// The fixed bottom bar can cover the target point on phones; activate the radios directly (users scroll first).
for (const sel of ['input[name="dj-style"][value="precio"]', 'input[name="dj-lang"][value="en"]']) await p.$eval(sel, (el) => { el.scrollIntoView({ block: 'center' }); el.click() })
if (SHOT) { await p.waitForTimeout(400); await p.screenshot({ path: `${SHOT}-dojo.png` }) }
await p.click('[data-dj="start"]'); await until(() => document.querySelectorAll('#dj-arena .dj-msg.owner:not(.typing)').length === 1)
out.opener = await p.evaluate(() => ({ text: document.querySelector('#dj-arena .dj-msg.owner:not(.typing)').textContent, said: window.__said.length }))
out.turnBody = calls.turn[0]?.scenario?.business === 'cafetería' && calls.turn[0]?.scenario?.style === 'precio' && calls.turn[0]?.lang === 'en' && calls.turn[0]?.turns.length === 0
await p.fill('#dj-arena [name=text]', 'Hi! I help restaurants stop answering prices on WhatsApp.'); await p.press('#dj-arena [name=text]', 'Enter')
await until(() => document.querySelectorAll('#dj-arena .dj-msg.owner:not(.typing)').length === 2); out.objection = await p.evaluate(() => /precio/.test(document.querySelector('#dj-arena .dj-obj')?.textContent || ''))
// voz: dictado emulado
await p.click('#dj-arena [data-dj="mic"]'); await until(() => window.__dict && document.querySelector('#dj-arena .dj-mic.is-on')); out.dictLang = await p.evaluate(() => window.__dict.lang === 'en')
await p.click('#dj-arena [data-dj="mic"]'); await until(() => document.querySelectorAll('#dj-arena .dj-msg.owner:not(.typing)').length === 3)
out.ended = await p.evaluate(() => !!document.querySelector('#dj-arena .dj-ended'))
if (SHOT) { await p.waitForTimeout(400); await p.screenshot({ path: `${SHOT}-arena.png` }) }
await p.click('#dj-arena [data-dj="score"]'); await until(() => document.getElementById('dj-score'))
out.score = await p.evaluate(() => ({ gauges: document.querySelectorAll('#dj-score .dj-g').length, en: !!document.querySelector('#dj-score .dj-en li'), saved: (Store.get().preferences.dojo?.sessions || []).length, total: Store.get().preferences.dojo?.sessions?.[0]?.score?.total }))
await p.waitForTimeout(1000); if (SHOT) await p.screenshot({ path: `${SHOT}-score.png` })
out.overflowDojo = await overflow()
await p.click('#dj-score [data-dj="new"]'); await until(() => document.querySelector('#dj-setup .dj-list li')); out.history = true
// ---- Radar en Inicio
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('ivi-systems'))
out.intentDojo = await p.evaluate(() => /Dojo/.test(EvieAssistant.tryLocal('Ivi, quiero practicar mi pitch') || '')); await until(() => location.hash === '#dojo')
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('ivi-systems'))
await p.evaluate(() => EvieHUD.open('radar')); await until(() => document.querySelector('.hud-card[data-type=radar] .rd-avisos'))
out.radarNews = await p.evaluate(() => { const c = document.querySelector('.hud-card[data-type=radar]'); return { ok: c.querySelectorAll('.rd-badge.ok').length, no: c.querySelectorAll('.rd-badge.no').length, links: [...c.querySelectorAll('a.rd-src')].every((a) => a.rel.includes('noopener') && a.target === '_blank'), alerts: EvieRadar.alerts().length } })
if (SHOT) { await p.waitForTimeout(400); await p.screenshot({ path: `${SHOT}-radar.png` }) }
await p.click('.hud-card[data-type=radar] [data-rd="tab"][data-tab="plans"]'); await until(() => document.querySelector('.hud-card[data-type=radar] .rd-plans li'))
out.plans = await p.evaluate(() => document.querySelector('.hud-card[data-type=radar] .rd-cost.free')?.textContent === 'Gratis')
await p.selectOption('.hud-card[data-type=radar] [data-rd="budget"]', '500'); await until(() => Store.get().preferences.radar?.budget === 500)
await until(() => document.querySelector('.hud-card[data-type=radar] .rd-plans li')); await until((n) => window.__plansDone || true, null)
out.budget = calls.plans.includes(500)
out.cache = await p.evaluate(() => { const n = calls => calls; return !!Store.get().preferences.radar?.news?.items?.length })
const newsBefore = calls.news; await p.evaluate(() => EvieAssistant.tryLocal('¿qué hay para el fin de semana?')); await p.waitForTimeout(800); out.noRefetch = calls.news === newsBefore
out.overflowHome = await overflow()
const checks = { offerFromCabina: out.offer, opener: /poco tiempo/.test(out.opener.text) && out.opener.said >= 1, turnBody: out.turnBody, objection: out.objection, dictation: out.dictLang, ended: out.ended, score: out.score.gauges === 3 && out.score.en && out.score.saved === 1 && out.score.total === 70, history: out.history, intentDojo: out.intentDojo, radarNews: out.radarNews.ok >= 2 && out.radarNews.no === 1 && out.radarNews.links && out.radarNews.alerts === 1, plans: out.plans, budget: out.budget, cache: out.cache, noRefetch: out.noRefetch, overflow: !out.overflowDojo && !out.overflowHome, errors: !errors.length }
console.log(JSON.stringify(out), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
await b.close()
if (failed.length) { console.log('FAILED:', failed.join(', ')); process.exit(1) }
console.log(`${Object.keys(checks).length}/${Object.keys(checks).length} E2E DOJO+RADAR OK`)
