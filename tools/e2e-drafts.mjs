// Regression (P1): periodic background work must never flash the page or erase what the user is typing.
// Types into Configuración personalizada across > 2 refresh intervals while triggering: the 60 s session
// refresh with a remote change (emulated EvieSync pull → Store.save), focus/visibility/storage events, the
// 60 s goal-renewal timer and an available service-worker update. Asserts: same DOM nodes (no rebuild),
// values intact, focus + caret kept, no reload, no auto-upload; deferred work applies once after saving.
// MODE=probe prints what happens (used to reproduce the bug before the fix: see evidence/p1-before-1440.json).
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900), PROBE = process.env.MODE === 'probe'
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=220'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
let profilePuts = 0, profile = { preferred_name: 'Ale', enabled: true }
await p.route('**/api/profile', (r) => { if (r.request().method() === 'PUT') { profilePuts++; profile = JSON.parse(r.request().postData()).profile; return r.fulfill({ json: { profile } }) } return r.fulfill({ json: { profile } }) })
await p.route('**/api/memory**', (r) => r.fulfill({ json: { settings: { enabled: true, use_memories: true, reference_history: false, save_history: false, allow_health: false, allow_emotional: false, timezone: 'America/Mexico_City' }, memories: [], sessions: [] } }))
await p.clock.install()
await p.goto('http://localhost:3000/index.html?qa=drafts' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 30000 })
const checks = []; const ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
const until = (fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms })
await p.evaluate(() => {
  document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.profile.preferred = 'Ale' })
  const k = EvieAccounts.storageKey(); const cfg = EvieAccounts.config(); cfg.accountsEnabled = true
  EvieAccounts.current = () => ({ id: '11111111-1111-4111-8111-111111111111', username: 'ale' }); EvieAccounts.storageKey = () => k; EvieAccounts.verify = async () => true
  const req = EvieAccounts.request; EvieAccounts.request = (path, o = {}) => (path === 'profile' || path.startsWith('memory')) ? fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then((r) => r.json()) : req(path, o)
  window.EvieProfile?.reset?.(); window.__mainSwaps = 0
  new MutationObserver((m) => { for (const x of m) if (x.target.id === 'main-content' && x.removedNodes.length) window.__mainSwaps++ }).observe(document.getElementById('main-content'), { childList: true })
  location.hash = 'personalizada'
})
await until(() => document.getElementById('evp-form'))
const fakeSync = "({ sync: async () => { Store.save((s) => { s.profile.bio = 'otro dispositivo ' + Date.now() }) }, stop() {} })"
const refresh = () => p.evaluate(async (f) => { try { await window.AccountUI.refreshNow(eval(f)) } catch (e) { window.__refreshErr = e.message } }, fakeSync)
const snap = () => p.evaluate(() => { const f = document.getElementById('evp-form'); const a = document.activeElement; return { form: !!f, same: f === window.__form, name: f?.elements.preferred_name?.value, addr: f?.elements.address_as?.value, prio: f?.elements.priorities?.value, focus: a?.name || a?.id || a?.tagName, caret: a?.selectionStart, swaps: window.__mainSwaps, reloaded: !window.__alive } })
await p.evaluate(() => { window.__form = document.getElementById('evp-form'); window.__alive = true })
await p.click('#evp-preferred_name'); await p.keyboard.press('Control+A'); await p.keyboard.type('Alejandro')
await p.click('#evp-address_as'); await p.keyboard.type('jefe')
await p.click('#evp-priorities'); await p.keyboard.type('Terminar el mapa de Ciudad Guzmán'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft')
const before = await snap(); await p.evaluate(() => { window.__mainSwaps = 0 })
const events = []
for (let round = 0; round < 3; round++) {
  await p.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new StorageEvent('storage', { key: DALI_CONFIG.storageKey })) })
  await p.clock.runFor(61000); await refresh(); events.push(await snap())
}
await p.evaluate(() => { try { Store.save((s) => { s.goals.push({ id: 'g-renew', title: 'Ahorro', horizon: 'week', recurring: true, progress: 3, target: 5, periodKey: '2000-W01', created_at: new Date().toISOString() }) }) } catch (e) { window.__goalErr = e.message } })
await p.clock.runFor(61000); events.push(await snap())
const swUpdate = await p.evaluate(() => typeof window.AccountUI?.swUpdateReady === 'function' ? (window.AccountUI.swUpdateReady(), 'hooked') : 'no-hook')
await p.clock.runFor(2000); const after = await snap(); const swWhileEditing = await p.evaluate(() => window.__swActivated || 0)
if (PROBE) { console.log(JSON.stringify({ W, before, events, after, swUpdate, swWhileEditing, profilePuts, errors }, null, 1)); await b.close(); process.exit(0) }
for (const s of [...events, after]) {
  assert.equal(s.form, true, 'form must stay'); assert.equal(s.same, true, 'form DOM must not be rebuilt')
  assert.equal(s.name, 'Alejandro'); assert.equal(s.addr, 'jefe'); assert.equal(s.prio, 'Terminar el mapa de Ciudad Guzmán')
  assert.equal(s.focus, 'priorities', 'focus kept'); assert.equal(s.caret, before.caret, 'caret kept'); assert.equal(s.swaps, 0, 'no main swap (flash)'); assert.equal(s.reloaded, false)
}
ok(`typing survives ${events.length} background rounds (session refresh + remote change, focus, visibility, storage, goal renewal) — same nodes, focus, caret`)
assert.equal(profilePuts, 0, 'drafts are never auto-uploaded'); ok('unsaved draft was not uploaded')
assert.equal(swUpdate, 'hooked'); assert.equal(swWhileEditing, 0, 'waiting service worker must not activate while editing'); ok('available update did not take control/reload while editing')
const notice = await p.evaluate(() => document.getElementById('draft-guard-notice')?.innerText || '')
assert.match(notice, /cambios sin guardar/i); assert.match(notice, /otro dispositivo|actualización/i); ok('waiting update/remote change is announced, not applied')
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('unsaved-dialog'))
ok('leaving the page with a dirty draft asks to keep editing or discard')
await p.click('[data-unsaved=stay]'); await p.waitForTimeout(200)
assert.equal(await p.evaluate(() => location.hash), '#personalizada'); assert.equal(await p.evaluate(() => document.getElementById('evp-form').elements.preferred_name.value), 'Alejandro'); ok('"Seguir editando" keeps route and draft')
await p.evaluate(() => { window.__mainSwaps = 0 }); await p.click('#evp-form [type=submit]'); await until(() => !window.FormSafety.dirty())
assert.equal(profilePuts, 1); assert.equal(profile.preferred_name, 'Alejandro'); ok('explicit save uploads once')
await p.clock.runFor(1000); await p.waitForTimeout(300)
const post = await p.evaluate(() => ({ sw: window.__swActivated || 0, swaps: window.__mainSwaps, notice: document.getElementById('draft-guard-notice')?.hidden !== false }))
assert.equal(post.sw, 1, 'deferred update applies once after save'); assert.ok(post.swaps >= 1, 'deferred render applies after save'); assert.ok(post.notice, 'notice hidden'); ok('after saving: deferred render + update applied once, notice cleared')
await p.evaluate(() => { location.hash = 'automatizaciones' }); await p.waitForTimeout(400)
if (await p.evaluate(() => !!document.querySelector('[data-auto-new]'))) {
  await p.click('[data-auto-new]'); await until(() => document.getElementById('auto-form'))
  await p.fill('#auto-form [name=name]', 'Borrador largo'); await p.evaluate(() => { window.__f2 = document.getElementById('auto-form'); window.__mainSwaps = 0 })
  await p.clock.runFor(61000); await refresh(); await p.clock.runFor(61000)
  const s = await p.evaluate(() => ({ same: document.getElementById('auto-form') === window.__f2, v: document.querySelector('#auto-form [name=name]')?.value, swaps: window.__mainSwaps }))
  assert.equal(s.same, true); assert.equal(s.v, 'Borrador largo'); assert.equal(s.swaps, 0); ok('Automatizaciones inline form survives refresh')
}
assert.deepEqual(errors, []); console.log(`DRAFTS E2E OK (${checks.length} checks, ${W}x${H})`); await b.close()
