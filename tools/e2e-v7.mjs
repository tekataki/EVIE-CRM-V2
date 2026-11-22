// v7 E2E (runtime/auth/data mocked; real Supabase NOT used). Reproduces the phone report of 2026-11-22:
//  1. A phone cache saved by an older EVIE (schema 4 without `automations`) used to stop the app with
//     «No pudimos abrir tus datos · Colección v4 inválida: automations». It must now open and pull the
//     account (including automations created on another device).
//  2. A cache this version truly cannot read is no longer a dead end for a signed-in account: «Volver a bajar
//     mis datos de la nube» keeps the local copy aside and downloads the account again.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 390), H = Number(process.env.H || 844)
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=220'] })
const errors = [], checks = [], ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
const UID = '77777777-7777-4777-8777-777777777777', KEY = 'evie-account-' + UID
const user = { id: UID, username: 'mi_usuario', role: 'owner' }
const server = { rows: new Map(), stamp: 1 }
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
p.on('pageerror', (e) => errors.push(e.message))
await ctx.route('**/api/**', async (r) => {
  const req = r.request(), path = new URL(req.url()).pathname.replace(/^\/api\//, '')
  if (path === 'runtime') return r.fulfill({ json: { accountsEnabled: true, googleAuth: true, googleSignup: 'open', passwordLogin: true, mediaSync: true, guestInvites: true, ai: {}, providers: {} } })
  if (path === 'auth/session') return r.fulfill({ json: { user } })
  if (path === 'data/pull') return r.fulfill({ json: { owner: UID, rows: [...server.rows.values()].map((x) => structuredClone(x)), next: '' } })
  if (path === 'data/push') { const rows = req.postDataJSON().changes.map((c) => { const row = { owner_id: UID, collection: c.collection, record_id: c.record_id, payload: c.payload, revision: c.expected_revision + 1 }; server.rows.set(c.collection + '/' + c.record_id, row); return row }); server.stamp++; return r.fulfill({ json: { owner: UID, rows } }) }
  if (path === 'data/stamp') return r.fulfill({ json: { owner: UID, stamp: 's' + server.stamp } })
  if (path === 'profile') return r.fulfill({ json: { profile: {} } })
  return r.fulfill({ json: {} })
})
const opened = () => p.waitForFunction(() => window.Store?.get?.() && window.EvieAccounts?.current?.() && !document.querySelector('.auth-v31'), null, { timeout: 30000 })

// Account exists in the cloud: profile + one goal + one automation made on the PC.
await p.goto('http://localhost:3000/index.html', { timeout: 90000 }); await opened(); await p.waitForTimeout(1200)
if (await p.$('#onboarding-form')) { await p.fill('#onboarding-form [name=name]', 'Dali'); await p.fill('#onboarding-form [name=preferred]', 'Dali'); await p.evaluate(() => document.getElementById('onboarding-form').requestSubmit()) }
await p.waitForFunction(() => window.Store.get().profile.name === 'Dali', null, { timeout: 10000 })
const auto = await p.evaluate(() => ({ ...window.EvieAutomations.build({ name: 'Banco', url: 'https://example.com/banco' }), id: 'auto-from-pc-1' }))
server.rows.set('automations/auto-from-pc-1', { owner_id: UID, collection: 'automations', record_id: 'auto-from-pc-1', revision: 1, payload: auto })
await p.evaluate(() => window.AccountUI.sync().sync()); await p.waitForFunction(() => window.Store.list('automations').length === 1, null, { timeout: 10000 })
await p.waitForTimeout(1500); assert.ok(server.rows.has('$state/root'), 'profile in the cloud')

// 1. The phone's old cache: same account, schema 4, saved before `automations` existed (and an old shadow).
await p.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); delete s.automations; localStorage.setItem(k, JSON.stringify(s)); const sh = JSON.parse(localStorage.getItem(k + '-sync-shadow') || '{}'); for (const key of Object.keys(sh)) if (key.startsWith('automations/')) delete sh[key]; localStorage.setItem(k + '-sync-shadow', JSON.stringify(sh)) }, KEY)
await p.reload(); await opened(); await p.waitForTimeout(1500)
let s = await p.evaluate(() => ({ err: document.querySelector('#main-content .form-error')?.textContent || '', autos: window.Store.list('automations').map((a) => a.name), name: window.Store.get().profile.name }))
assert.equal(s.err, '', 'no «No pudimos abrir tus datos»'); assert.deepEqual(s.autos, ['Banco']); assert.equal(s.name, 'Dali')
ok('old phone cache without automations opens (no «Colección v4 inválida») and pulls the PC automation')

// 2. A cache that cannot be read at all → rescue button downloads the account again; the local copy is kept aside.
await p.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.goals = 'roto'; localStorage.setItem(k, JSON.stringify(s)) }, KEY)
await p.reload(); await p.waitForSelector('#store-recloud', { timeout: 30000 })
assert.match(await p.textContent('#main-content'), /No pudimos abrir tus datos/); assert.match(await p.textContent('#main-content'), /nube están a salvo/)
ok('unreadable cache on a signed-in account offers «Volver a bajar mis datos de la nube»')
await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click('#store-recloud')]); await opened(); await p.waitForTimeout(1500)
s = await p.evaluate((k) => ({ err: document.querySelector('#main-content .form-error')?.textContent || '', autos: window.Store.list('automations').length, goalsOk: Array.isArray(window.Store.get().goals), name: window.Store.get().profile.name, kept: Object.keys(localStorage).filter((x) => x.startsWith(k + '-unreadable-')).length }), KEY)
assert.equal(s.err, ''); assert.equal(s.autos, 1); assert.equal(s.goalsOk, true); assert.equal(s.name, 'Dali'); assert.ok(s.kept >= 1, 'local copy kept aside')
ok('after the rescue the account is back from the cloud (profile + automation) and the unreadable copy is kept aside')
s = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth })); assert.ok(s.sw <= s.vw + 1); ok('no horizontal overflow at ' + W + 'px')
assert.deepEqual(errors, []); console.log(`V7 E2E OK (${checks.length} checks, ${W}x${H})`); await b.close()
