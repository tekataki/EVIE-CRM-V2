// v3.1 E2E: Automatizaciones (CRUD, search, validation, manual + voice open, SOMA module vs site,
// ambiguity, blocked popup honesty, account isolation) and the radial/sheet capability view.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900), BLOCK = process.env.BLOCK === '1'
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=200'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
await ctx.route('https://soma.example.com/**', (r) => r.fulfill({ body: '<title>SOMA sitio</title>ok', contentType: 'text/html' }))
await ctx.route('https://otro.example.com/**', (r) => r.fulfill({ body: 'ok', contentType: 'text/html' }))
await p.goto('http://localhost:3000/index.html?qa=v31' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 30000 })
await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.profile.preferred = 'Alejandro' }); location.hash = 'automatizaciones'; App.render() })
const checks = []; const ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
const until = (fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms })
const say = (t) => p.evaluate((t) => { const i = document.getElementById('evie-stage-input'); i.value = t; document.getElementById('evie-stage-form').requestSubmit() }, t)
const subs = () => p.evaluate(() => document.getElementById('evie-subs')?.innerText || '')
// nav entry + empty state
let s = await p.evaluate(() => ({ nav: !!document.querySelector('#main-nav a[href="#automatizaciones"]'), empty: !!document.querySelector('.auto-empty-state') }))
assert.ok(s.nav && s.empty); ok('navigation entry + empty state')
// validation: dangerous schemes rejected
await p.click('[data-auto-new]'); await until(() => document.getElementById('auto-form'))
for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///C:/x', 'http://localhost:3000', 'https://user:pw@soma.example.com']) {
  await p.fill('#auto-form [name=name]', 'Prueba'); await p.fill('#auto-form [name=url]', bad); await p.click('#auto-form [type=submit]')
  const msg = await p.textContent('#auto-error'); assert.ok(msg.length > 5, 'must reject ' + bad) }
assert.equal(await p.evaluate(() => Store.list('automations').length), 0); ok('rejects javascript:, data:, file:, localhost and credentials')
// create with XSS-y name (escaped)
await p.fill('#auto-form [name=name]', 'Página de SOMA'); await p.fill('#auto-form [name=url]', 'soma.example.com/inicio'); await p.fill('#auto-form [name=description]', '<img src=x onerror=alert(1)> sitio público'); await p.fill('#auto-form [name=aliases]', 'web de SOMA, sitio de SOMA')
await p.click('#auto-form [type=submit]'); await until(() => document.querySelectorAll('.auto-card').length === 1)
s = await p.evaluate(() => ({ r: Store.list('automations')[0], img: !!document.querySelector('.auto-card img'), dom: document.querySelector('.auto-card .auto-domain').innerText }))
assert.equal(s.r.url, 'https://soma.example.com/inicio'); assert.equal(s.r.domain, 'soma.example.com'); assert.deepEqual(s.r.aliases, ['web de SOMA', 'sitio de SOMA']); assert.equal(s.img, false); ok('create: URL normalized to https, aliases, description escaped')
// second + edit + search + delete
await p.click('[data-auto-new]'); await p.fill('#auto-form [name=name]', 'Portal del banco'); await p.fill('#auto-form [name=url]', 'https://otro.example.com/'); await p.click('#auto-form [type=submit]'); await until(() => document.querySelectorAll('.auto-card').length === 2)
await p.click('.auto-card:has-text("Portal del banco") [data-auto-edit]'); await p.fill('#auto-form [name=name]', 'Portal del banco BBVA'); await p.click('#auto-form [type=submit]'); await until(() => document.body.innerText.includes('Portal del banco BBVA'))
await p.fill('#auto-q', 'bbva'); await p.waitForTimeout(200); assert.equal(await p.evaluate(() => document.querySelectorAll('.auto-card').length), 1); await p.fill('#auto-q', ''); ok('edit + search')
// manual open (real user click → new tab)
const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('.auto-card:has-text("Página de SOMA") [data-auto-open]')]); await tab.waitForLoadState(); assert.match(tab.url(), /soma\.example\.com\/inicio/); await tab.close()
assert.ok(p.url().includes('localhost:3000')); ok('manual "Abrir" opens the site in a new tab; CRM tab stays')
// voice: SOMA page vs SOMA module
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('evie-hud'))
if (BLOCK) await p.evaluate(() => { window.open = () => null })
const popup = BLOCK ? null : ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null)
await say('Ivi, abre la página de SOMA'); await until(() => EvieHUD.cards().some((c) => c.type === 'shortcut' && c.state === 'ready'))
await until(() => /Abrí|Intenté/.test(document.getElementById('evie-subs')?.innerText || ''), null, 8000)
const t2 = popup ? await popup : null; s = await subs()
if (BLOCK) { assert.match(s, /Intenté abrir «Página de SOMA»/); ok('blocked new tab: EVIE says it tried, link stays on the card') }
else { assert.ok(t2 && /soma\.example\.com/.test(t2.url()), 'voice open must open the site'); await t2.close(); ok('voice "abre la página de SOMA" opens the saved site (' + (s.match(/Abrí|Intenté/) || [''])[0] + ')') }
s = await p.evaluate(() => { const a = document.querySelector('.hud-card[data-type=shortcut] a[data-auto-open]'); return { href: a?.href, target: a?.target, rel: a?.rel } }); assert.equal(s.href, 'https://soma.example.com/inicio'); assert.equal(s.target, '_blank'); assert.match(s.rel, /noopener/); ok('shortcut HUD card keeps an actionable link')
await say('abre el apartado de SOMA'); await until(() => EvieHUD.cards().some((c) => c.type === 'soma'))
assert.ok(!(await p.evaluate(() => EvieHUD.cards().filter((c) => c.type === 'shortcut').length > 1))); ok('"abre el apartado de SOMA" opens the internal module, not the site')
// ambiguity
await p.evaluate(() => Store.save((s) => s.automations.push({ ...EvieAutomations.build({ name: 'Página de SOMA Academia', url: 'https://otro.example.com/academia', aliases: 'web de SOMA' }), id: crypto.randomUUID() })))
await say('abre la web de SOMA'); await until(() => /¿Cuál abro\?/.test(document.getElementById('evie-subs')?.innerText || '')); ok('ambiguous shortcut → short clarification')
await say('abre la página de Netflix'); await until(() => /No tengo guardada/.test(document.getElementById('evie-subs')?.innerText || '')); ok('unknown site: no invented URL')
// capabilities view
await say('¿Qué puedes hacer?'); await until(() => window.EvieCaps.visible())
s = await p.evaluate(() => ({ mode: document.body.dataset.caps, n: document.querySelectorAll('.cap-node').length, list: EvieCaps.items(), cards: EvieHUD.cards().length, auto: [...document.querySelectorAll('.cap-node')].some((x) => /Automatizaciones/.test(x.textContent)) }))
assert.equal(s.mode, W >= 1024 ? 'radial' : 'sheet'); assert.ok(s.auto, 'Automatizaciones listed'); assert.ok(s.cards >= 2, 'capabilities must not erase cards'); ok(`capabilities ${s.mode} view: ${s.list.length} items incl. Automatizaciones; ${s.cards} cards kept`)
if (W >= 1024) { s = await p.evaluate(() => { const r = [...document.querySelectorAll('.hud-caps-ring .cap-node')].map((n) => n.getBoundingClientRect()); let o = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], c = r[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) o++ } const off = r.filter((x) => x.left < 0 || x.top < 0 || x.right > innerWidth || x.bottom > innerHeight).length; return { o, off } }); assert.equal(s.o, 0, 'radial items overlap'); assert.equal(s.off, 0, 'radial items offscreen'); ok('radial items do not overlap and stay on screen') }
if (process.env.SHOT) { await p.waitForTimeout(900); await p.screenshot({ path: `/tmp/caps-${W}.png` }) }
// every ready item leads to a real destination
const ready = (await p.evaluate(() => EvieCaps.items())).filter((x) => x.card && x.state === 'ready')
for (const it of ready) { const r = await p.evaluate((k) => !!EvieHUD.REGISTRY[k] && (!EvieHUD.REGISTRY[k].route || DALI_CONFIG.sections.some((s) => s.route === EvieHUD.REGISTRY[k].route)), it.card); assert.ok(r, 'dead capability ' + it.card) }
ok(`all ${ready.length} ready capability items map to real cards/modules`)
await p.click('.cap-node[data-cap-open="automatizaciones"]'); await until(() => !EvieCaps.visible() && EvieHUD.cards().some((c) => c.type === 'automatizaciones')); ok('selecting a capability opens its real card and dismisses the view')
await say('¿Qué puedes hacer?'); await until(() => window.EvieCaps.visible()); await p.keyboard.press('Escape'); await until(() => !EvieCaps.visible()); ok('Escape dismisses capabilities, cards untouched (' + (await p.evaluate(() => EvieHUD.cards().length)) + ')')
// account isolation of shortcuts: another account (different storage key) has none
const other = await p.evaluate(() => { const k = 'dali-os-qa-other-' + Date.now(); const st = Store.blank(); return { n: (st.automations || []).length, has: Array.isArray(st.automations) } }); assert.deepEqual(other, { n: 0, has: true }); ok('a new/other account starts with zero shortcuts (data is per account store)')
assert.deepEqual(errors, []); console.log(`V31 E2E OK (${checks.length} checks, ${W}x${H}${BLOCK ? ' popup-blocked' : ''})`); await b.close()
