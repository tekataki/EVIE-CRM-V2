// Visual QA sweep: every navigation section at desktop and mobile — horizontal overflow, elements wider than the
// viewport (ignoring intentional horizontal scrollers and inner SVG paths), unlabeled buttons/links, small touch
// targets on mobile (a control counts as large enough when its <label> is ≥32 px), page errors.
// Usage: SIZES=1440,390 SHOT=evidence/sweep OUT=evidence/sweep.json node tools/qa-sweep.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
const SHOT = process.env.SHOT, sizes = (process.env.SIZES || '1440,390').split(',').map(Number), only = process.env.ONLY?.split(',')
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=220'] })
const report = {}; let failures = 0
for (const W of sizes) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, serviceWorkers: 'block', isMobile: W < 700, hasTouch: W < 700 }); const p = await ctx.newPage()
  const errors = []; p.on('pageerror', (e) => errors.push(e.message))
  await p.goto('http://localhost:3000/index.html?qa=sweep' + W + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
  await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.profile.preferred = 'Ale' }) })
  const routes = only || await p.evaluate(() => DALI_CONFIG.sections.map((s) => s.route))
  for (const r of routes) {
    await p.evaluate((r) => { location.hash = r }, r); await p.waitForTimeout(900)
    const res = await p.evaluate((mobile) => {
      const clipped = (n) => { for (let a = n.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible' && !(a instanceof SVGElement)) return a.getBoundingClientRect().right <= innerWidth + 1 } return false }
      const target = (n) => { const l = n.closest('label'); return l ? l.getBoundingClientRect().height >= 32 : false }
      const vw = innerWidth, main = document.getElementById('main-content'), all = [...main.querySelectorAll('*')]
      const wide = all.filter((n) => { const s = getComputedStyle(n); if (s.position === 'fixed' || n.closest('.maplibregl-map') || (n instanceof SVGElement && n.ownerSVGElement)) return false; const q = n.getBoundingClientRect(); return q.width > 0 && q.right > vw + 1 && !clipped(n) }).map((n) => n.tagName.toLowerCase() + '.' + String(n.className).split(' ').slice(0, 2).join('.')).slice(0, 5)
      const unlabeled = [...main.querySelectorAll('button,a[href]')].filter((n) => n.getClientRects().length && !(n.innerText.trim() || n.getAttribute('aria-label') || n.title)).map((n) => n.outerHTML.slice(0, 80)).slice(0, 3)
      const small = mobile ? [...main.querySelectorAll('button,a.button,input,select')].filter((n) => { const q = n.getBoundingClientRect(); return q.width && q.height && (q.height < 32 || q.width < 32) && getComputedStyle(n).visibility !== 'hidden' && !target(n) }).map((n) => (n.innerText || n.getAttribute('aria-label') || n.name || n.tagName).trim().slice(0, 24) + ':' + Math.round(n.getBoundingClientRect().height)).slice(0, 4) : []
      return { overflow: document.documentElement.scrollWidth - vw, wide, unlabeled, small }
    }, W < 700)
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await p.screenshot({ path: `${SHOT}/${r}-${W}.png` }) }
    const bad = res.overflow > 1 || res.wide.length || res.unlabeled.length || res.small.length; if (bad) failures++
    ;(report[W] ||= {})[r] = res; console.log(`${bad ? '✗' : '✓'} ${W} ${r}${bad ? ' ' + JSON.stringify(res) : ''}`)
  }
  if (errors.length) { failures++; console.log('page errors', W, errors.slice(0, 5)) } report[W].errors = errors
  await ctx.close()
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(report, null, 1)); await b.close()
console.log(failures ? `SWEEP: ${failures} problem(s)` : 'SWEEP OK'); process.exitCode = failures ? 1 : 0
