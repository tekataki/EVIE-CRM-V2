// Visual QA of the HUD: empty Home and Home with 2 cards; checks overlap/scroll per viewport.
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900), THEME = process.env.THEME || 'dark'
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=200'] })
const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
await p.goto('http://localhost:3000/index.html?qa=shot-' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 30000 })
await p.evaluate((t) => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = t; s.profile.preferred = 'Alejandro'; s.profile.greeting_form = 'Bienvenido' }); location.hash = 'inicio'; App.render() }, THEME)
await p.waitForTimeout(1800); await p.screenshot({ path: `/tmp/hud-${W}-${THEME}-empty.png` })
await p.evaluate(() => { EvieHUD.open('finanzas'); EvieHUD.open('clock') }); await p.waitForTimeout(1500)
const m = await p.evaluate(() => { const rs = [...document.querySelectorAll('.hud-card,#hud-core,.hud-greeting,.hud-composer')].map((n) => [n.id || n.className.split(' ')[0], n.getBoundingClientRect()]); let ov = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const [na, a] = rs[i], [nb, bb] = rs[j]; if (na === 'hud-core' || nb === 'hud-core') continue; if (a.left < bb.right - 2 && bb.left < a.right - 2 && a.top < bb.bottom - 2 && bb.top < a.bottom - 2) ov.push(na + '×' + nb) } return { ov, sw: document.documentElement.scrollWidth, vw: innerWidth, wide: [...document.querySelectorAll('body *')].filter((n) => n.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(n).position !== 'fixed').slice(0,8).map((n) => n.tagName + '#' + n.id + '.' + String(n.className).split(' ')[0] + ':' + Math.round(n.getBoundingClientRect().width)), core: Math.round(document.getElementById('hud-core').getBoundingClientRect().width) } })
await p.screenshot({ path: `/tmp/hud-${W}-${THEME}-cards.png`, fullPage: W < 700 })
console.log(JSON.stringify({ W, THEME, ...m, errors })); await b.close()
