// Diagnostic: proves #neural-canvas has exactly one renderer and one loop.
// Usage: node tools/core-probe.mjs [width]   (server on http://localhost:3000)
import { chromium } from 'playwright'
import fs from 'node:fs'
const width = Number(process.argv[2] || 1440), height = width < 800 ? 844 : 900
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width, height } })
const errors = []
page.on('pageerror', (e) => errors.push('PAGE ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()) })
await page.addInitScript(() => {
  // Attribute every 2D draw on #neural-canvas to the script that issued it.
  window.__draws = {}; window.__obs = { ro: 0, io: 0 }
  const orig = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const ctx = orig.call(this, type, ...a)
    if (ctx && this.id === 'neural-canvas' && !ctx.__wrapped) {
      ctx.__wrapped = true
      for (const fn of ['arc', 'fillRect', 'stroke', 'fill']) {
        const f = ctx[fn].bind(ctx)
        ctx[fn] = (...x) => { const m = (new Error().stack || '').match(/\/([\w-]+\.js)/); const k = m ? m[1] : '?'; window.__draws[k] = (window.__draws[k] || 0) + 1; return f(...x) }
      }
    }
    return ctx
  }
  for (const [name, key] of [['ResizeObserver', 'ro'], ['IntersectionObserver', 'io']]) {
    const O = window[name]; if (!O) continue
    window[name] = class extends O { constructor(cb) { super(cb); window.__obs[key]++; this.__on = true } disconnect() { if (this.__on) { this.__on = false; window.__obs[key]-- } return super.disconnect() } }
  }
  let hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' })
  window.__setHidden = (h) => { hidden = h; document.dispatchEvent(new Event('visibilitychange')) }
})
await page.goto('http://localhost:3000/index.html?qa=probe')
await page.waitForFunction(() => window.DALI_READY, null, { timeout: 20000 })
await page.evaluate(() => { try { Neural.dismiss() } catch {} document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.motion = 'full'; s.preferences.motionPaused = false; s.preferences.theme = 'dark'; s.preferences.evieModulesChosen = true }); UI.section = 'inicio'; UI.id = null; App.render() })
const sample = async (label, fn, expectRaf = true) => {
  if (fn) await page.evaluate(fn)
  await page.waitForTimeout(250)
  await page.evaluate(() => { window.__draws = {} })
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => ({ draws: { ...window.__draws }, obs: { ...window.__obs }, stats: window.EvieNeural?.stats(), legacy: typeof window.IvyRenderer, canvases: document.querySelectorAll('#neural-canvas').length, rings: document.querySelectorAll('.orb-ring,.orb-core').length }))
  const owners = Object.keys(r.draws)
  const onHome = await page.evaluate(() => UI.section === 'inicio')
  const ok = r.legacy === 'undefined' && r.rings === 0 && owners.every((k) => k === 'evie-neural.js') &&
    (onHome ? r.canvases === 1 && r.obs.ro === 1 && r.obs.io === 1 && r.stats.renderer === 1 && r.stats.raf === expectRaf && (!expectRaf || owners.length === 1)
            : r.obs.ro === 0 && r.obs.io === 0 && r.stats.renderer === 0 && !r.stats.raf)
  console.log((ok ? 'ok  ' : 'FAIL') + ' ' + label.padEnd(22), JSON.stringify({ draws: r.draws, ro: r.obs.ro, io: r.obs.io, raf: r.stats?.raf, observers: r.stats?.observers }))
  return ok
}
const results = []
results.push(await sample('inicial'))
results.push(await sample('3 renders', () => { for (let i = 0; i < 3; i++) App.render() }))
results.push(await sample('ocultar/mostrar', () => { __setHidden(true); __setHidden(false) }))
results.push(await sample('ocultar/mostrar x3', () => { for (let i = 0; i < 3; i++) { __setHidden(true); __setHidden(false) } }))
results.push(await sample('oculto (sin dibujo)', () => __setHidden(true), false))
await page.evaluate(() => __setHidden(false))
results.push(await sample('navegación ida/vuelta', () => { UI.section = 'finanzas'; App.render(); UI.section = 'inicio'; App.render() }))
await page.setViewportSize({ width: Math.round(width * 0.8), height }); await page.setViewportSize({ width, height })
results.push(await sample('resize'))
results.push(await sample('tema claro', () => { Store.save((s) => { s.preferences.theme = 'light' }); App.render() }))
await page.screenshot({ path: `evidence/shots/core-${width}-light.png` })
results.push(await sample('tema oscuro', () => { Store.save((s) => { s.preferences.theme = 'dark' }); App.render() }))
results.push(await sample('movimiento reducido', () => { Store.save((s) => { s.preferences.motion = 'reduced' }); App.render() }, false))
results.push(await sample('pausado', () => { Store.save((s) => { s.preferences.motion = 'full'; s.preferences.motionPaused = true }); App.render() }, false))
results.push(await sample('reanudado', () => { Store.save((s) => { s.preferences.motionPaused = false }); App.render() }))
fs.mkdirSync('evidence/shots', { recursive: true })
await page.screenshot({ path: `evidence/shots/core-${width}.png` })
const geo = await page.evaluate(() => { const r = document.getElementById('dali-core-control').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.left + r.width / 2), vw: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1 } })
console.log('geometría', JSON.stringify(geo))
results.push(await sample('fuera de Inicio', () => { UI.section = 'finanzas'; App.render() }, false))
console.log('errores:', errors.length ? errors.join(' | ') : 'ninguno')
const pass = results.every(Boolean) && !errors.length && !geo.overflow
console.log(pass ? 'OK: un solo renderizador' : 'FALLO')
await browser.close()
process.exit(pass ? 0 : 1)
