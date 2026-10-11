// Quick visual QA: node tools/shot.mjs route[,route] [width] [theme]
import { chromium } from 'playwright'
const routes = (process.argv[2] || 'inicio').split(',')
const width = Number(process.argv[3] || 390), theme = process.argv[4] || 'dark'
const height = width < 800 ? 844 : 900
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push('PAGE ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()) })
await page.goto('http://localhost:3000/index.html?qa=shots')
await page.waitForFunction(() => window.DALI_READY, null, { timeout: 15000 })
await page.evaluate((theme) => { try { Neural.dismiss() } catch {} Store.save((s) => { s.preferences.theme = theme; s.preferences.evieModulesChosen = true }); document.getElementById('evie-splash')?.remove(); App.render() }, theme)
for (const r of routes) {
  await page.evaluate((r) => { location.hash = r }, r)
  await page.waitForTimeout(1400)
  if (process.env.ACTION) { await page.evaluate((a) => { const b = document.querySelector('[data-action="' + a + '"]'); b && b.click() }, process.env.ACTION); await page.waitForTimeout(700) }
  if (process.env.BOTTOM) { await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(500) }
  const info = await page.evaluate(() => {
    const over = document.documentElement.scrollWidth > innerWidth + 1
    // overlapping fixed elements check
    const fixed = [...document.querySelectorAll('body *')].filter((n) => { const cs = getComputedStyle(n); return (cs.position === 'fixed') && cs.display !== 'none' && cs.visibility !== 'hidden' && n.offsetWidth > 0 && n.offsetHeight > 0 && !n.closest('dialog:not([open])') })
    const rects = fixed.map((n) => ({ id: n.id || n.className.toString().slice(0, 30), r: n.getBoundingClientRect() })).filter((x) => x.r.width < innerWidth * 0.95 || x.r.height < innerHeight * 0.95)
    const hits = []
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i].r, b = rects[j].r; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hits.push(rects[i].id + ' × ' + rects[j].id) }
    return { over, sw: document.documentElement.scrollWidth, hits }
  })
  console.log(r, width, theme, JSON.stringify(info))
  await page.screenshot({ path: `evidence/shots/${r.replace(/\W/g, '_')}-${width}-${theme}.png`, fullPage: process.env.FULL === '1' })
}
console.log(errors.length ? errors.slice(0, 15).join('\n') : 'no errors')
await browser.close()
