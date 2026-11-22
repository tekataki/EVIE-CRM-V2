// E2E v10 Fase 5 (browser): Alvento (plan de drop con tallas S–XL y colores, comparador de cotizaciones, costo
// unitario y margen, inventario por talla) y Granja (simulador antes de comprar: flujo mensual, punto de equilibrio,
// colchón mínimo y cobertura con SOMA). Pure math is covered in tests/alvento-granja.test.cjs.
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), THEME = process.env.THEME || 'dark', SHOT = process.env.SHOT || ''
const b = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept())
await p.goto('http://localhost:3000/index.html?qa=alvento' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
const dropId = await p.evaluate((theme) => {
  window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove(); const t = Domain.today()
  const drop = Store.record(Records.normalize('alventoDrops', { title: 'Drop de prueba', date: V2Domain.addDays(t, 45) }))
  Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme; s.profile.preferred = 'Sam'; s.alventoDrops.push(structuredClone(drop))
    s.transactions = [{ id: crypto.randomUUID(), title: 'Pago', amount: 900000, type: 'income', date: V2Domain.addDays(t, -20), category: 'Clientes', business_unit: 'soma', note: '', created_at: t + 'T12:00:00Z', updated_at: t + 'T12:00:00Z' }] })
  AlventoPlus.savePlan(drop.id, (pl) => { pl.pieces = [{ id: 'hoodie1', name: 'Hoodie', colors: ['Negro', 'Gris'], sizes: { S: 10, M: 20, L: 20, XL: 10 }, price_cents: 69900, extras: { labels: 1500, pack: 1200, ship: 2500, other: 0 }, quotes: [{ id: 'qa', supplier: 'Taller A', unit_cents: 21000, min_qty: 100, lead_days: 20 }, { id: 'qb', supplier: 'Taller B', unit_cents: 19000, min_qty: 200, lead_days: 30 }, { id: 'qc', supplier: 'Taller C', unit_cents: 24000, min_qty: 50, lead_days: 10 }], quote_id: 'qa' }]; pl.fixed_cents = 300000 })
  App.render(); return drop.id }, THEME)
const until = async (fn, a, ms = 12000) => { try { return await p.waitForFunction(fn, a, { timeout: ms }) } catch (e) { console.log('STUCK', JSON.stringify(await p.evaluate(() => ({ hash: location.hash, ap: document.getElementById('ap-panel')?.textContent?.slice(0, 200), gs: document.getElementById('gs-panel')?.textContent?.slice(0, 200) })))); throw e } }
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
const out = {}
// ---- Alvento: drop detail page with the plan
await p.evaluate((id) => { location.hash = 'alvento/' + id }, dropId); await until(() => document.getElementById('ap-panel'))
out.math = await p.evaluate((id) => { const pl = AlventoPlus.planOf(id), t = AlventoPlus.planTotals(pl.pieces), q = AlventoPlus.quoteSummary(pl.pieces[0].quotes, 120); return { units: t.units ?? t.total ?? null, cheapest: q.cheapest?.supplier ?? q.cheapest, fastest: q.fastest?.supplier ?? q.fastest } }, dropId)
out.tabs = await p.evaluate(() => [...document.querySelectorAll('#ap-panel [data-ap="tab"]')].map((x) => x.dataset.tab))
for (const tab of out.tabs) { await p.click(`#ap-panel [data-ap="tab"][data-tab="${tab}"]`); await p.waitForTimeout(250); out['tab_' + tab] = await p.evaluate(() => (document.getElementById('ap-body')?.textContent || '').trim().length > 20) }
await p.click('#ap-panel [data-ap="tab"][data-tab="quotes"]'); await p.waitForTimeout(250)
out.quotesUI = await p.evaluate(() => { const t = document.getElementById('ap-body').textContent; return /Taller A/.test(t) && /Taller C/.test(t) && /(Más barata|Más rápida)/.test(t) })
if (SHOT) { await p.evaluate(() => document.getElementById('ap-panel').scrollIntoView({ block: 'start' })); await p.waitForTimeout(500); await p.screenshot({ path: `${SHOT}-alvento.png` }) }
await p.click('#ap-panel [data-ap="tab"][data-tab="margin"]'); await p.waitForTimeout(250); out.marginUI = await p.evaluate(() => /%/.test(document.getElementById('ap-body').textContent))
out.overflowAlvento = await overflow()
// ---- Granja: simulator on the Resumen tab
await p.evaluate(() => { location.hash = 'granja' }); await until(() => document.getElementById('gs-panel'), null, 15000)
const k0 = await p.evaluate(() => document.getElementById('gs-kpis').textContent)
out.chart = await p.evaluate(() => !!document.querySelector('#gs-chart svg'))
const field = await p.evaluate(() => { const f = document.getElementById('gs-form'), i = f.querySelector('[name="sows"]') || f.querySelector('input[type=number]'); return i ? i.name : null })
if (field) { await p.fill(`#gs-form [name="${field}"]`, '8'); await p.dispatchEvent(`#gs-form [name="${field}"]`, 'change'); await p.waitForTimeout(700) }
out.recalc = await p.evaluate((k0) => document.getElementById('gs-kpis').textContent !== k0, k0)
out.saved = await p.evaluate((f) => !f || Number(Store.get().preferences.farmSim?.[f]) === 8, field)
out.sim = await p.evaluate(() => { const s = GranjaSim.simulate(GranjaSim.normalize({ sows: 4, months: 18 })); return Array.isArray(s.rows) && s.rows.length === 18 && 'summary' in s })
if (SHOT) { await p.evaluate(() => document.getElementById('gs-panel').scrollIntoView({ block: 'start' })); await p.waitForTimeout(600); await p.screenshot({ path: `${SHOT}-granja.png` }) }
out.overflowGranja = await overflow()
const tabsOk = out.tabs.length >= 3 && out.tabs.every((t) => out['tab_' + t])
const checks = { panel: out.tabs.length >= 3, tabs: tabsOk, quotesUI: out.quotesUI, marginUI: out.marginUI, chart: out.chart, recalc: out.recalc, saved: out.saved, sim: out.sim, overflow: !out.overflowAlvento && !out.overflowGranja, errors: !errors.length }
console.log(JSON.stringify(out), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
await b.close()
if (failed.length) { console.log('FAILED:', failed.join(', ')); process.exit(1) }
console.log(`${Object.keys(checks).length}/${Object.keys(checks).length} E2E ALVENTO+GRANJA OK`)
