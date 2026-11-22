// E2E v10 Fase 4 (browser): Misión (crear, holograma que se arma, aportes, escenarios, serie de contenido, objetivo
// espejo, tarjeta en Finanzas), Independencia (autonomía, renta sola vs. compartida → escenarios de la misión) y
// Revisión del domingo (panel en Objetivos, prioridades, análisis de Ivi emulado, volverlas objetivos, intención de voz,
// tarjeta del HUD). /api/weekly/review is emulated here (server side: tests/mission-weekly.test.cjs).
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), THEME = process.env.THEME || 'dark', SHOT = process.env.SHOT || ''
const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept())
await p.route('**/api/weekly/review', (r) => { const body = JSON.parse(r.request().postData() || '{}'); r.fulfill({ json: { review: { resumen: `Semana con ${body.fisico?.sessions ?? 0} entrenos y ventas en marcha.`, logros: ['Aportaste a tu misión'], alertas: ['Un seguimiento atrasado'], prioridades: [{ titulo: 'Llamar al prospecto atrasado', por_que: 'Lleva días sin respuesta' }, { titulo: 'Aportar $1,000 a la misión', por_que: 'Para ir a tiempo' }, { titulo: 'Entrenar 3 veces', por_que: 'Constancia' }] }, generated_at: new Date().toISOString() } }) })
await p.route('**/api/info/weather', (r) => r.fulfill({ json: { place: 'Ciudad de prueba', current: { temperature_c: 20, condition: 'Despejado' }, days: [] } }))
await p.goto('http://localhost:3000/index.html?qa=mission' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
await p.evaluate((theme) => {
  window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove(); const t = Domain.today(), d = (n) => V2Domain.addDays(t, n)
  const tx = (title, amount, type, date, bu = 'personal') => ({ id: crypto.randomUUID(), title, amount, type, date, category: type === 'income' ? 'Clientes' : 'Personal', business_unit: bu, note: '', created_at: date + 'T12:00:00Z', updated_at: date + 'T12:00:00Z' })
  Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme; s.profile.preferred = 'Sam'; s.preferences.iviBriefing = { wake: '06:00', gymMinutes: 60, travelMinutes: 15, auto: false }
    s.transactions = [tx('Pago cliente', 600000, 'income', d(-10), 'soma'), tx('Pago cliente', 600000, 'income', d(-40), 'soma'), tx('Pago cliente', 600000, 'income', d(-70), 'soma'), tx('Súper', 400000, 'expense', d(-2)), tx('Renta de equipo', 500000, 'expense', d(-35)), tx('Gasolina', 300000, 'expense', d(-65))]
    s.clients = [{ id: 'c1-aaaaaaaa', title: 'Café Prueba', date: t, stage: 'Diagnóstico', amount: 0, contact: '', phone: '', email: '', project: '', payments: [], deliverables: [], notes: [], installments: [], nextDate: d(-2), nextAction: 'Llamar' }] })
  const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: true, provider: 'openai', stt: true, tts: true }
  EvieAccounts.current = () => ({ id: 'aaaaaaaa-0000-4000-8000-000000000002' }); EvieAccounts.storageKey = () => k
  EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j })
  window.__said = []; if (window.EvieAssistant) window.EvieAssistant = { ...window.EvieAssistant, say: (x) => window.__said.push(x) }
  App.render() }, THEME)
const until = async (fn, a, ms = 12000) => { try { return await p.waitForFunction(fn, a, { timeout: ms }) } catch (e) { console.log('STUCK', JSON.stringify(await p.evaluate(() => ({ hash: location.hash, dialog: document.querySelector('#app-dialog[open]')?.textContent?.slice(0, 200), err: document.querySelector('.ch-error:not([hidden])')?.textContent, toasts: [...document.querySelectorAll('#toast-region .toast')].map((x) => x.textContent.slice(0, 80)) })))); throw e } }
const fill = async (sel, v) => { await p.fill(sel, ''); await p.fill(sel, v) }
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
const out = {}
// ---- Misión: crear
await p.evaluate(() => { location.hash = 'objetivos' }); await until(() => document.querySelector('#ms-panel.ms-empty'))
await p.click('#ms-panel [data-ms="edit"]'); await until(() => document.getElementById('ms-form'))
const deadline = await p.evaluate(() => V2Domain.addDays(Domain.today(), 365))
await fill('#ms-form [name=name]', 'Laptop gamer'); await fill('#ms-form [name=target]', '30,000'); await fill('#ms-form [name=deadline]', deadline); await fill('#ms-form [name=saved]', '6000')
await fill('#ms-form [name=soma_share]', '50'); await fill('#ms-form [name=extra]', '1000'); await fill('#ms-form [name=series]', 'Serie de prueba')
await p.click('#ms-form button.primary'); await until(() => document.querySelector('#ms-panel .ms-count'))
out.created = await p.evaluate(() => { const g = Store.list('goals').find((x) => x.title === 'Misión: Laptop gamer'); return { pct: EvieMission.plan().pct, cap: document.querySelector('#ms-panel .ms-kpis').textContent.includes('$4,000.00'), goal: g && g.target === 30000 && g.progress === 6000 } })
await p.waitForFunction(() => window.MissionHologram?.stats?.().frames > 2, null, { timeout: 20000 }).catch(() => {})
out.holo = await p.evaluate(() => ({ ...MissionHologram.stats(), canvas: !!document.querySelector('.ms-visual canvas'), fallback: !document.querySelector('.ms-visual .ms-silhouette')?.hasAttribute('hidden') }))
// ---- Aportar
await p.click('#ms-panel [data-ms="add"]'); await until(() => document.querySelector('#ms-form [name=amount]')); await fill('#ms-form [name=amount]', '3000'); await p.click('#ms-form button.primary')
await until(() => EvieMission.plan().pct === 30)
out.contribution = await p.evaluate(() => { const m = EvieMission.cfg(), g = Store.list('goals').find((x) => x.id === m.goal_id); return g.progress === 9000 && m.history.at(-1).saved_cents === 900000 && /30 %/.test(document.querySelector('#ms-panel .ms-eyebrow').textContent) })
// ---- Escenarios
await p.click('#ms-panel [data-ms="scen-add"]'); await until(() => document.querySelector('#ms-form [name=kind]'))
await fill('#ms-form [name=name]', 'Renta sola'); await p.selectOption('#ms-form [name=kind]', 'expense'); await fill('#ms-form [name=amount]', '3500'); await p.click('#ms-form button.primary')
await until(() => document.querySelector('#ms-panel .ms-scen li')); out.scenLate = await p.evaluate(() => /tarde/.test(document.querySelector('#ms-panel .ms-scen li').textContent))
await p.click('#ms-panel .ms-scen .ms-switch'); await until(() => document.querySelector('#ms-panel .ms-scen li.on'))
out.scenToggle = await p.evaluate(() => EvieMission.plan().capacity === 50000 && !!document.querySelector('#ms-panel .ms-pill.warn'))
// ---- Serie de contenido → colección Contenido
await p.fill('#ms-panel .ms-idea input', 'Episodio 1: el plan'); await p.click('#ms-panel .ms-idea button'); await until(() => document.querySelector('#ms-panel .ms-eps li'))
out.series = await p.evaluate(() => { const c = Store.list('contentItems').find((x) => x.series === 'Serie de prueba'); return !!c && c.status === 'idea' && c.episode_number === 1 && c.platform === 'tiktok' })
out.overflowGoals = await overflow()
if (SHOT) { await p.evaluate(() => document.getElementById('ms-panel').scrollIntoView({ block: 'start' })); await p.waitForTimeout(900); await p.screenshot({ path: `${SHOT}-mision.png` }) }
// ---- Revisión del domingo (panel en Objetivos → diálogo)
await until(() => document.getElementById('wk-panel')); await p.click('#wk-panel [data-wk="open"]'); await until(() => document.querySelector('#wk-dialog .wk-tiles'))
out.weeklyTiles = await p.evaluate(() => document.querySelectorAll('#wk-dialog .wk-tile').length)
out.weeklyMission = await p.evaluate(() => /\+\$3,000\.00/.test(document.querySelector('#wk-dialog .wk-tile').textContent))
await p.click('#wk-dialog [data-wk="save"]'); await until(() => (Store.get().preferences.weeklyReviews || []).length === 1)
await until(() => document.querySelector('#wk-dialog [data-wk="ai"]')); await p.click('#wk-dialog [data-wk="ai"]'); await until(() => Store.get().preferences.weeklyReviews?.[0]?.ai)
out.weeklyAI = await p.evaluate(() => { const r = Store.get().preferences.weeklyReviews[0]; return r.priorities.length === 3 && r.priorities[0].text === 'Llamar al prospecto atrasado' && /Semana con/.test(r.ai.resumen) })
if (SHOT) { await p.waitForTimeout(400); await p.screenshot({ path: `${SHOT}-revision.png` }) }
await until(() => document.querySelector('#wk-dialog [data-wk="goals"]')); await p.click('#wk-dialog [data-wk="goals"]')
await until(() => Store.list('goals').filter((g) => g.horizon === 'semanal').length === 3); out.weeklyGoals = true
await p.evaluate(() => App.closeDialog(true))
// ---- Finanzas: tarjeta de la misión + Independencia
await p.evaluate(() => { location.hash = 'finanzas' }); await until(() => document.getElementById('ms-mini') && document.getElementById('ind-panel'))
out.mini = await p.evaluate(() => /30 %/.test(document.querySelector('#ms-mini .ms-mini-pct').textContent))
await p.click('#ind-panel [data-ind="edit"]'); await until(() => document.getElementById('ind-form'))
for (const [k, v] of [['rent_cents', '5000'], ['services_cents', '1000'], ['food_cents', '3000'], ['transport_cents', '1000'], ['share', '50']]) await fill(`#ind-form [name=${k}]`, v)
await p.click('#ind-form button.primary'); await until(() => document.querySelector('#ind-panel .ind-rent'))
out.rent = await p.evaluate(() => { const t = document.querySelector('#ind-panel .ind-rent').textContent; return t.includes('$10,000.00') && t.includes('$7,000.00') && t.includes('$3,000.00') })
out.gauge = await p.evaluate(() => !!document.querySelector('#ind-panel .ind-gauge b'))
await p.click('#ind-panel [data-ind="to-mission"]'); await until(() => EvieMission.cfg().scenarios.some((s) => s.name === 'Vivir con roomie'))
out.toMission = await p.evaluate(() => EvieMission.cfg().scenarios.map((s) => s.name).join('|') === 'Renta sola|Vivir solo|Vivir con roomie')
out.overflowFin = await overflow()
if (SHOT) { await p.evaluate(() => document.getElementById('ms-mini').scrollIntoView({ block: 'start' })); await p.waitForTimeout(700); await p.screenshot({ path: `${SHOT}-finanzas.png` }) }
// ---- Ivi: intenciones locales y barra de sistemas en Inicio
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('evie-stage-input') || document.getElementById('ivi-systems'))
out.say = await p.evaluate(() => EvieAssistant.tryLocal('Ivi, ¿cómo va mi misión?'))
out.intent = /Misión «Laptop gamer» al 30 por ciento/.test(out.say || '')
await until(() => document.querySelector('#ivi-systems .ivi-sys[href="#objetivos"]'))
out.systems = await p.evaluate(() => /30 %/.test(document.querySelector('#ivi-systems .ivi-sys[href="#objetivos"]').textContent))
await p.evaluate(() => EvieAssistant.tryLocal('Ivi, revisión semanal')); await until(() => document.querySelector('.hud-card[data-type=weekly] .wk-tiles'))
out.weeklyCard = true; out.overflowHome = await overflow()
if (SHOT) { await p.waitForTimeout(500); await p.screenshot({ path: `${SHOT}-inicio.png` }) }
const checks = { created: out.created.pct === 20 && out.created.cap && out.created.goal, holo: out.holo.canvas ? out.holo.parts === 11 && out.holo.built === 2 && !out.holo.fallback : out.holo.fallback, contribution: out.contribution, scenarioLate: out.scenLate, scenarioToggle: out.scenToggle, series: out.series, weeklyTiles: out.weeklyTiles >= 5, weeklyMission: out.weeklyMission,weeklyAI: out.weeklyAI, weeklyGoals: out.weeklyGoals, mini: out.mini, rent: out.rent, gauge: out.gauge, toMission: out.toMission, intent: out.intent, systems: out.systems, weeklyCard: out.weeklyCard, overflow: !out.overflowGoals && !out.overflowFin && !out.overflowHome, errors: !errors.length }
console.log(JSON.stringify({ ...out, say: undefined }), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
await b.close()
if (failed.length) { console.log('FAILED:', failed.join(', ')); process.exit(1) }
console.log(`${Object.keys(checks).length}/${Object.keys(checks).length} E2E MISION OK`)
