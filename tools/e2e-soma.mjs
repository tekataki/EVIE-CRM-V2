// E2E v10 Fase 3 (browser): Cabina SOMA (matriz, paquetes con precio, objeciones si/entonces, seguimientos con mensaje
// sugerido, dossier de visita, propuesta imprimible, tareas del socio, ubicación, perdido con motivo → resultados) and
// Briefing del día (tarjeta del HUD, «Mi horario», «Escuchar», aviso «Sal ahora» con tráfico). /api/soma, /api/map and
// /api/info/weather are emulated here (server side: tests/soma-briefing.test.cjs).
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), THEME = process.env.THEME || 'dark', SHOT = process.env.SHOT || ''
const b = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
await p.route('**/api/soma/dossier', (r) => r.fulfill({ json: { dossier: { resumen: 'Café con mucho WhatsApp.', problema_probable: 'Contesta precios todo el día.', solucion: 'Menú digital QR.', paquete_recomendado: { nombre: 'Menú digital QR', por_que: 'Resuelve lo urgente.' }, objeciones: [{ si: 'Es caro', entonces: 'Pago dividido' }], preguntas: ['¿Cuántos mensajes recibes al día?'], cierre: '¿Arrancamos el lunes?', siguiente_paso: 'Enviar propuesta.', supuestos: ['Tiene WhatsApp Business'] }, generated_at: new Date().toISOString() } }))
await p.route('**/api/soma/followup', (r) => r.fulfill({ json: { mensajes: [{ tono: 'cercano', texto: 'Hola, ¿cómo va todo?' }, { tono: 'directo', texto: '¿Agendamos?' }, { tono: 'valor', texto: 'Te comparto una idea.' }] } }))
await p.route('**/api/map/search', (r) => r.fulfill({ json: { results: [{ name: 'Lugar de prueba', label: 'Lugar de prueba, Centro', lat: 19.7, lon: -103.46 }] } }))
await p.route('**/api/map/route', (r) => r.fulfill({ json: { trip: { status: 0, summary: { time: 35 * 60, length: 9 } }, traffic: true } }))
await p.route('**/api/info/weather', (r) => r.fulfill({ json: { place: 'Ciudad de prueba', current: { temperature_c: 18.4, condition: 'Despejado' }, days: [] } }))
await p.goto('http://localhost:3000/index.html?qa=soma' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
await p.evaluate((theme) => {
  window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove(); const t = Domain.today(), y = V2Domain.addDays(t, -1)
  Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme; s.profile.preferred = 'Sam'; s.preferences.iviBriefing = { wake: '06:00', gymMinutes: 60, travelMinutes: 15, auto: false }
    s.clients = [{ id: 'c1-aaaaaaaa', title: 'Café Prueba', date: t, stage: 'Diagnóstico', amount: 0, contact: 'Ana', phone: '3411234567', email: '', project: 'Menú y pedidos', payments: [], deliverables: [], notes: [], installments: [], nextDate: y, nextAction: 'Llamar' }, { id: 'c2-bbbbbbbb', title: 'Taller Uno', date: t, stage: 'Prospecto', amount: 0, contact: '', phone: '3410000000', email: '', project: '', payments: [], deliverables: [], notes: [], installments: [] }] })
  const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: true, provider: 'claude', stt: true, tts: true }; cfg.map = { configured: true, traffic: true }
  EvieAccounts.current = () => ({ id: 'aaaaaaaa-0000-4000-8000-000000000001' }); EvieAccounts.storageKey = () => k
  EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j })
  window.__said = []; if (window.EvieAssistant) window.EvieAssistant = { ...window.EvieAssistant, say: (x) => window.__said.push(x) }
  window.__printed = 0; window.print = () => { window.__printed++; window.__printHTML = document.getElementById('sc-print')?.innerHTML || '' }
  App.render() }, THEME)
const until = async (fn, a, ms = 12000) => { try { return await p.waitForFunction(fn, a, { timeout: ms }) } catch (e) { console.log('STUCK', JSON.stringify(await p.evaluate(() => ({ hash: location.hash, dialog: document.querySelector('#app-dialog[open]')?.textContent?.slice(0, 160), toasts: [...document.querySelectorAll('#toast-region .toast')].map((x) => x.textContent.slice(0, 80)) })))); throw e } }
const out = {}
// ---- Cabina (list)
await p.evaluate(() => { location.hash = 'soma' }); await until(() => document.getElementById('sc-cabin'))
out.cabin = await p.evaluate(() => ({ tabs: document.querySelectorAll('[data-sc="tab"]').length, rows: document.querySelectorAll('.sc-mrow:not(.sc-mhead)').length, pkgs: document.querySelectorAll('.sc-pkgcard:not(.is-add)').length }))
await p.click('.sc-pkgcard[data-id="menu"]'); await until(() => document.getElementById('sc-form')); await p.fill('#sc-form [name=one_time]', '3500'); await p.fill('#sc-form [name=monthly]', '250'); await p.click('#sc-form .button.primary')
await until(() => /3,500/.test(document.querySelector('.sc-pkgcard[data-id="menu"]')?.textContent || '')); out.price = await p.evaluate(() => /250/.test(document.querySelector('.sc-pkgcard[data-id="menu"]').textContent))
await p.click('[data-sc="tab"][data-tab="objections"]'); await until(() => document.querySelectorAll('.sc-obj').length === 6)
await p.fill('#sc-q', 'caro'); await until(() => document.querySelectorAll('.sc-obj').length === 1); out.search = true; await p.fill('#sc-q', '')
await p.click('[data-sc="obj-add"]'); await until(() => document.getElementById('sc-form')); await p.fill('#sc-form [name=if]', 'No confío en internet'); await p.fill('#sc-form [name=then]', 'Muéstrale un caso local que ya funciona.'); await p.click('#sc-form .button.primary')
await p.evaluate(() => document.querySelector('[data-sc="tab"][data-tab="objections"]').click()); await until(() => document.querySelectorAll('.sc-obj').length === 7); out.objAdd = true
await p.click('[data-sc="tab"][data-tab="follow"]'); await until(() => document.querySelectorAll('.sc-fu').length === 2)
out.follow = await p.evaluate(() => /Café Prueba/.test(document.querySelectorAll('.sc-fus')[0].textContent) && /Taller Uno/.test(document.querySelectorAll('.sc-fus')[1].textContent))
await p.evaluate(() => [...document.querySelectorAll('.sc-fu')].find((x) => /Taller Uno/.test(x.textContent)).querySelector('[data-days="5"]').click()); await until(() => Store.list('clients').find((c) => c.title === 'Taller Uno').nextDate)
out.snooze = await p.evaluate(() => Store.list('clients').find((c) => c.title === 'Taller Uno').nextDate === V2Domain.addDays(Domain.today(), 5))
await p.evaluate(() => { document.querySelector('[data-sc="tab"][data-tab="follow"]')?.click() }); await until(() => document.querySelector('.sc-fu [data-sc="msg"]'))
await p.click('.sc-fu [data-sc="msg"]'); await until(() => document.querySelectorAll('.sc-msg').length === 3); out.messages = await p.evaluate(() => !!document.querySelector('.sc-msg [data-sc="wa"]')); await p.evaluate(() => App.closeDialog(true))
if (SHOT) { await p.evaluate(() => { location.hash = 'soma' }); await p.waitForTimeout(900); await p.evaluate(() => document.getElementById('toast-region')?.replaceChildren()); await p.evaluate(() => document.getElementById('sc-cabin')?.scrollIntoView()); await p.waitForTimeout(400); await p.screenshot({ path: SHOT + '-cabina.png' }) }
// ---- Prospect
await p.evaluate(() => { location.hash = 'soma/c1-aaaaaaaa' }); await until(() => document.getElementById('sc-prospect'))
await p.evaluate(() => document.querySelector('[data-sc="need-toggle"][data-need="n0"]').click()); await until(() => document.querySelector('[data-sc="pkg-toggle"][data-pkg="menu"]')?.checked)
out.recommend = await p.evaluate(() => document.querySelector('[data-sc="pkg-toggle"][data-pkg="menu"]').closest('.sc-need').classList.contains('is-rec'))
await p.click('[data-sc="dossier"]'); await until(() => /Arrancamos el lunes/.test(document.querySelector('.sc-dos')?.textContent || '')); out.dossier = await p.evaluate(() => !!Store.list('clients').find((c) => c.id === 'c1-aaaaaaaa').cabin.dossier)
await p.click('[data-sc="print"]'); await until(() => window.__printed === 1); out.print = await p.evaluate(() => /Café Prueba/.test(window.__printHTML) && /Menú digital QR/.test(window.__printHTML) && /3,500/.test(window.__printHTML))
await p.fill('.sc-taskform [name=title]', 'Montar el menú de prueba'); await p.selectOption('.sc-taskform [name=owner]', 'socio'); await p.click('.sc-taskform .button'); await until(() => /Montar el menú/.test(document.querySelector('#sc-prospect .sc-tasks')?.textContent || ''))
await p.click('[data-sc="place"]'); await until(() => document.getElementById('sc-form')); await p.click('#sc-form .button.primary'); await until(() => document.querySelector('[data-sc="map"]')); out.place = true
if (SHOT) { await p.waitForTimeout(400); await p.evaluate(() => document.getElementById('toast-region')?.replaceChildren()); await p.evaluate(() => document.getElementById('sc-prospect')?.scrollIntoView()); await p.waitForTimeout(400); await p.screenshot({ path: SHOT + '-prospecto.png' }) }
await p.click('[data-sc="lost"]'); await until(() => document.getElementById('sc-form')); await p.selectOption('#sc-form [name=reason]', 'Precio'); await p.click('#sc-form .button.primary'); await until(() => document.querySelector('.sc-badge[data-r="lost"]'))
out.lost = await p.evaluate(() => Store.list('clients').find((c) => c.id === 'c1-aaaaaaaa').stage === 'Perdido')
await p.evaluate(() => { location.hash = 'soma' }); await until(() => document.getElementById('sc-cabin')); await p.click('[data-sc="tab"][data-tab="results"]'); await until(() => document.querySelector('.sc-stats'))
out.results = await p.evaluate(() => /Perdidos\s*1/.test(document.querySelector('.sc-stats').textContent) && /Precio/.test(document.querySelector('.sc-two').textContent))
await p.click('[data-sc="tab"][data-tab="partner"]'); await until(() => /Montar el menú/.test(document.getElementById('sc-body').textContent)); out.partner = true
out.overflowSoma = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
// ---- Briefing
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => window.EvieHUD && UI.section === 'inicio')
await p.evaluate(() => EvieHUD.open('briefing')); await until(() => document.querySelector('.hud-card[data-type="briefing"] .bf'))
out.card = await p.evaluate(() => { const c = document.querySelector('.hud-card[data-type="briefing"]').textContent; return /PROTOCOLO MATUTINO/i.test(c) && /18°/.test(c) && /Entreno/i.test(c) && !/Seguimientos/.test(c) && /Frase en inglés/i.test(c) })
await p.evaluate(() => document.querySelector('[data-bf="schedule"]').click()); await until(() => document.getElementById('bf-form'))
const inForty = await p.evaluate(() => { const d = new Date(Date.now() + 40 * 60000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') })
await p.fill('#bf-form [name=home]', 'Casa de prueba'); await p.click('#bf-form .bf-home [data-bf="find"]'); await until(() => document.querySelector('#bf-form [name=home]').dataset.lat === '19.7')
await p.fill('#bf-form .bf-commit [name=label]', 'Escuela'); await p.fill('#bf-form .bf-commit [name=time]', inForty); await p.evaluate(() => { const dow = new Date().getDay(); document.querySelectorAll('#bf-form .bf-commit [type=checkbox]').forEach((c, k) => { c.checked = k === dow }) })
await p.fill('#bf-form .bf-commit [name=place]', 'Lugar de prueba'); await p.click('#bf-form .bf-commit [data-bf="find"]'); await until(() => document.querySelector('#bf-form .bf-commit [name=place]').dataset.lat === '19.7')
await p.click('#bf-form .button.primary'); await until(() => (Store.get().preferences.iviCommitments || []).length === 1)
out.schedule = await p.evaluate(() => Store.get().preferences.iviCommitments[0].place?.lat === 19.7 && Store.get().preferences.iviHome?.lat === 19.7)
await p.evaluate(() => EvieBriefing.tick()); await until(() => [...document.querySelectorAll('#toast-region .toast')].some((t) => /Sal ahora/.test(t.textContent)))
out.depart = await p.evaluate(() => [...document.querySelectorAll('#toast-region .toast')].some((t) => /35 min con tráfico/.test(t.textContent)))
await p.evaluate(() => { EvieHUD.open('briefing') }); await until(() => document.querySelector('[data-bf="speak"]')); await p.evaluate(() => document.querySelector('[data-bf="speak"]').click()); await until(() => window.__said.length > 0)
out.speak = await p.evaluate(() => /Protocolo matutino/.test(window.__said[0]) && /Escuela/.test(window.__said[0]))
if (SHOT) { await p.evaluate(() => document.getElementById('toast-region')?.replaceChildren()); await p.waitForTimeout(700); await p.screenshot({ path: SHOT + '-briefing.png' }) }
out.overflowHome = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
console.log(JSON.stringify(out), errors.length ? errors : 'no errors')
const checks = { cabin: out.cabin.tabs === 5 && out.cabin.rows === 6 && out.cabin.pkgs === 6, price: out.price, search: out.search, objection: out.objAdd, follow: out.follow, snooze: out.snooze, messages: out.messages, recommend: out.recommend, dossier: out.dossier, print: out.print, place: out.place, lost: out.lost, results: out.results, partner: out.partner, briefingCard: out.card, schedule: out.schedule, depart: out.depart, speak: out.speak, overflow: !out.overflowSoma && !out.overflowHome, errors: !errors.length }
const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
console.log(Object.keys(checks).length - bad.length + '/' + Object.keys(checks).length, bad.length ? 'FAIL ' + bad.join(',') : 'E2E SOMA OK'); await b.close(); process.exitCode = bad.length ? 1 : 0
