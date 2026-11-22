// E2E v10 (browser): conexiones entre módulos e Ivi proactiva. SOMA cobra → «Apartar» para la Misión; prospecto ganado
// → «Registrar cobro»; seguimiento → Agenda (sin duplicar); ficha → «Practicar esta visita» en el Dojo; avisos del Radar
// en el briefing; «Ivi te avisa» (salida con tráfico, lluvia por hora, aviso local, seguimientos) y check-in ~30 min
// antes; la situación viaja como DATOS al chat. Weather/map/chat APIs are emulated here.
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), THEME = process.env.THEME || 'dark', SHOT = process.env.SHOT || ''
const b = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept())
const pad = (n) => String(n).padStart(2, '0'), now = new Date(), hh = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const inMin = (m) => new Date(now.getTime() + m * 60000), ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hours = Array.from({ length: 24 }, (_, i) => { const d = new Date(now.getTime() + i * 3600000); return { time: `${ymd(d)}T${pad(d.getHours())}:00`, rain_prob: i === 0 ? 72 : 10, condition: i === 0 ? 'Lluvia' : 'Nublado' } })
await p.route('**/api/info/weather', (r) => r.fulfill({ json: { place: 'Ciudad de prueba', current: { temperature_c: 19, condition: 'Nublado' }, days: [{ date: ymd(now), rain_prob: 72 }], hours } }))
await p.route('**/api/map/route', (r) => r.fulfill({ json: { trip: { status: 0, summary: { time: 20 * 60, length: 6 } }, traffic: true } }))
const chatBodies = []
await p.route('**/api/chat/**', async (r) => { const u = new URL(r.request().url()), m = r.request().method(), path = u.pathname.replace('/api/chat/', ''), body = r.request().postData() ? JSON.parse(r.request().postData()) : {}
  if (path === 'conversations' && m === 'GET') return r.fulfill({ json: { conversations: [] } })
  if (path === 'conversations' && m === 'POST') return r.fulfill({ status: 201, json: { conversation: { id: '00000000-0000-4000-8000-0000000000c1', title: '', pinned: false, archived: false, private: false, tier: 'enfoque', message_count: 0, created_at: now.toISOString(), updated_at: now.toISOString() } } })
  if (/messages$/.test(path) && m === 'GET') return r.fulfill({ json: { conversation: { id: '00000000-0000-4000-8000-0000000000c1', title: 'Prueba' }, messages: [] } })
  if (/messages$/.test(path) && m === 'POST') { chatBodies.push(body); const ev = (t, d) => `event: ${t}\ndata: ${JSON.stringify(d)}\n\n`; return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ev('meta', { user_message: { id: 'u1', seq: 1 }, tier: { id: 'enfoque', label: 'Enfoque' } }) + ev('delta', { t: 'Sí, jefe.' }) + ev('done', { message: { id: 'a1', seq: 2 }, text: 'Sí, jefe.', sources: [], model: 'x', stop_reason: 'end_turn', title: 'Prueba', tier: { id: 'enfoque', label: 'Enfoque', effort: 'medium' }, memory_used: [] }) }) }
  if (path.startsWith('memories')) return r.fulfill({ json: { memories: [], profile: '', kinds: [] } })
  return r.fulfill({ json: { stamp: '' } }) })
await p.goto('http://localhost:3000/index.html?qa=connect' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
const soon = hh(inMin(30))
await p.evaluate(({ theme, soon }) => {
  window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove(); const t = Domain.today(), base = { date: t, amount: 0, contact: '', phone: '', email: '', project: 'Menú y pedidos', payments: [], deliverables: [], notes: [], installments: [] }
  Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme; s.profile.preferred = 'Sam'
    s.preferences.iviBriefing = { wake: '05:00', gymMinutes: 30, travelMinutes: 15, auto: false }; s.preferences.iviHome = { name: 'Casa de prueba', lat: 19.69, lon: -103.47 }
    s.preferences.iviCommitments = [{ id: 'cm-aaaaaaaa', label: 'Clase de prueba', time: soon, days: [0, 1, 2, 3, 4, 5, 6], place: { name: 'Campus de prueba', lat: 19.7, lon: -103.46 }, alert: true, buffer: 5 }]
    s.preferences.iviProactive = { enabled: true, voice: true, minutes: 30, callMe: 'jefe' }
    s.preferences.mission = { name: 'Laptop', target_cents: 3000000, deadline: V2Domain.addDays(t, 365), saved_cents: 300000, soma_share: 50 }
    s.preferences.somaCabin = { packages: [{ id: 'menu', name: 'Menú digital QR', includes: [], one_time: 350000, monthly: 25000 }] }
    s.preferences.radar = { budget: 300, auto: false, news: { date: t, city: 'Ciudad de prueba', items: [], avisos: [{ titulo: 'Cierre de calle por desfile', detalle: 'Centro cerrado', cuando: '9 a 13 h', url: 'https://eventos.example.org/x', confirmado: true }] } }
    s.clients = [{ ...base, id: 'c1-aaaaaaaa', title: 'Café Prueba', stage: 'Diagnóstico', nextDate: t, nextAction: 'Llamar', cabin: { needs: [], tasks: [], packages: ['menu'], dossier: null, outcome: null, place: null } }] })
  const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: true, provider: 'openai', stt: true, tts: true }; cfg.map = { configured: true, traffic: true }
  EvieAccounts.current = () => ({ id: 'aaaaaaaa-0000-4000-8000-000000000005' }); EvieAccounts.storageKey = () => k
  EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j })
  window.__said = []; if (window.EvieAssistant) window.EvieAssistant = { ...window.EvieAssistant, say: async (x) => { window.__said.push(x) } }
  App.render() }, { theme: THEME, soon })
const until = async (fn, a, ms = 12000) => { try { return await p.waitForFunction(fn, a, { timeout: ms }) } catch (e) { console.log('STUCK', JSON.stringify(await p.evaluate(() => ({ hash: location.hash, dialog: document.querySelector('#app-dialog[open]')?.textContent?.slice(0, 160), toasts: [...document.querySelectorAll('#toast-region .toast')].map((x) => x.textContent.slice(0, 90)) })))); throw e } }
const out = {}
// 1) SOMA income → Misión
await p.evaluate(() => { const t = Domain.today(); Store.save((s) => { s.transactions.push({ id: crypto.randomUUID(), title: 'Pago Café Prueba', amount: 400000, type: 'income', date: t, category: 'Clientes', business_unit: 'soma', note: '', created_at: t + 'T12:00:00Z', updated_at: t + 'T12:00:00Z' }) }) })
await until(() => [...document.querySelectorAll('#toast-region .ec-toast')].some((x) => /Apartar/.test(x.textContent))); await p.click('#toast-region .ec-toast button')
await until(() => EvieMission.cfg().saved_cents === 500000); out.somaToMission = true
// 2) Follow-up → Agenda (idempotent)
await p.evaluate(() => { location.hash = 'soma' }); await until(() => document.getElementById('sc-cabin')); await p.click('[data-sc="tab"][data-tab="follow"]'); await until(() => document.querySelector('[data-ec="fu-agenda"]'))
await p.click('[data-ec="fu-agenda"]'); await until(() => Store.list('agendaItems').some((x) => x.source === 'soma' && /Seguimiento: Café Prueba/.test(x.title)))
await p.click('[data-ec="fu-agenda"]'); await p.waitForTimeout(300); out.followAgenda = await p.evaluate(() => Store.list('agendaItems').filter((x) => x.source === 'soma').length === 1)
// 3) Prospect → practice in the Dojo with the package as offer
await p.evaluate(() => { location.hash = 'soma/c1-aaaaaaaa' }); await until(() => document.querySelector('#sc-prospect [data-ec="practice"]')); await p.click('#sc-prospect [data-ec="practice"]')
await until(() => location.hash === '#dojo' && document.querySelector('[data-dj="offer"]')); out.practice = await p.evaluate(() => document.querySelector('[data-dj="offer"]').value === 'Menú digital QR')
// 4) Won → «Registrar cobro»
await p.evaluate(() => { location.hash = 'soma/c1-aaaaaaaa' }); await until(() => document.querySelector('#sc-prospect [data-sc="won"]')); await p.click('#sc-prospect [data-sc="won"]')
await until(() => document.getElementById('sc-form')); await p.click('#sc-form button.primary')
await until(() => [...document.querySelectorAll('#toast-region .ec-toast')].some((x) => /Registrar cobro/.test(x.textContent))); await p.click('#toast-region .ec-toast:last-child button')
await until(() => /Registrar cobro/.test(document.querySelector('#app-dialog[open]')?.textContent || '')); out.wonPayment = true; await p.evaluate(() => App.closeDialog(true))
// 5) Briefing shows the local alert and speaks it
out.briefing = await p.evaluate(() => { const html = EvieCards.R.briefing.render({ b: EvieBriefing.build(), weather: null }); return /Avisos locales/.test(html) && /Cierre de calle por desfile/.test(html) && /Aviso local: Cierre de calle/.test(EvieBriefing.speech(EvieBriefing.build(), null)) })
// 6) Ivi te avisa: nudges, card, check-in ~30 min before, situation for chat
await p.evaluate(() => { IviProactive._reset(); location.hash = 'inicio' }); await until(() => document.getElementById('ivi-systems'))
out.nudges = await p.evaluate(async () => (await IviProactive.nudges()).map((n) => n.kind))
await until(() => document.querySelector('.hud-card[data-type=proactive] .ivp-list li'), null, 15000); out.card = true
if (SHOT) { await p.waitForTimeout(600); await p.screenshot({ path: `${SHOT}-avisos.png` }) }
await p.evaluate(() => IviProactive.tick()); await until(() => window.__said.some((x) => /vas a salir/.test(x)))
out.checkin = await p.evaluate(() => window.__said.find((x) => /vas a salir/.test(x)))
await p.evaluate(() => IviProactive.tick()); out.once = await p.evaluate(() => window.__said.filter((x) => /vas a salir/.test(x)).length === 1)
out.situation = await p.evaluate(() => { const s = IviProactive.situation(); return s.address === 'jefe' && s.upcoming[0]?.label === 'Clase de prueba' && Number.isFinite(s.upcoming[0]?.eta_min) && s.rain.length >= 1 && s.alerts.length === 1 })
// 7) The chat sends the situation as data
await p.evaluate(() => { location.hash = 'chat' }); await until(() => document.getElementById('ch-input')); await p.fill('#ch-input', '¿Qué tengo al rato?'); await p.click('.ch-send')
await until(() => /Sí, jefe/.test(document.body.textContent)); out.chatContext = chatBodies.at(-1)?.context?.situation?.upcoming?.[0]?.label === 'Clase de prueba'
const checks = { somaToMission: out.somaToMission, followAgenda: out.followAgenda, practice: out.practice, wonPayment: out.wonPayment, briefing: out.briefing, nudges: ['go', 'alert', 'mission'].every((k) => out.nudges.includes(k)) && !out.nudges.includes('rain') && !out.nudges.includes('soma') /* rain is folded into the departure note; the won prospect is no longer a follow-up */, card: out.card, checkin: /Jefe, ¿vas a salir a las/.test(out.checkin || '') && /lleva paraguas/.test(out.checkin) && /Ojo: Cierre de calle/.test(out.checkin) && /Con tráfico son 20 min/.test(out.checkin), once: out.once, situation: out.situation, chatContext: out.chatContext, errors: !errors.length }
console.log(JSON.stringify(out), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
await b.close()
if (failed.length) { console.log('FAILED:', failed.join(', ')); process.exit(1) }
console.log(`${Object.keys(checks).length}/${Object.keys(checks).length} E2E CONEXIONES OK`)
