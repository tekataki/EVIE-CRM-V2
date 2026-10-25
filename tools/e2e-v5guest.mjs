// v5 E2E (runtime/auth mocked; real Supabase NOT used): "Entrar con invitación" (name + code, no password),
// guest session → v5 tools panel without Escenas, AI tier tab, plan approval gating.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=200'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
const GID = '33333333-3333-4333-8333-333333333333'; let redeemed = null, signedIn = false; const hits = []
await ctx.route('**/api/**', async (r) => {
  const u = new URL(r.request().url()), path = u.pathname.replace(/^\/api\//, ''); hits.push(r.request().method() + ' ' + path)
  const user = { id: GID, username: 'guest-abc123', role: 'guest', display_name: 'Ana', expires_at: Date.now() + 72 * 3600e3 }
  if (path === 'runtime') return r.fulfill({ json: { accountsEnabled: true, inviteOnly: true, googleAuth: true, passwordLogin: true, ai: {}, providers: {} } })
  if (path === 'auth/session') return r.fulfill({ json: { user: signedIn ? user : null } })
  if (path === 'auth/guest/redeem') { redeemed = r.request().postDataJSON(); signedIn = true; return r.fulfill({ json: { user } }) }
  if (path === 'ai/tier') return r.fulfill({ json: { tier: 'enfoque', tiers: [{ id: 'chispa', label: 'Chispa', summary: 'rápido', available: true }, { id: 'enfoque', label: 'Enfoque', summary: 'equilibrado', available: true }, { id: 'profundo', label: 'Profundo', summary: 'a fondo', available: false }] } })
  if (path.startsWith('tasks')) return r.fulfill({ json: { tasks: [] } })
  if (path === 'plan/propose') return r.fulfill({ json: { plan_id: 'p-1', day: '2026-10-25', hours: { start: '09:00', end: '18:00' }, timezone: 'America/Mexico_City', slots: [{ item_id: 'd0', kind: 'nuevo', title: 'Llamar a Intensity', start: '09:00', end: '09:30', estimated: false }, { kind: 'fixed', title: 'Junta', start: '10:00', end: '11:00' }], warnings: [{ code: 'estimates', message: 'Algunas duraciones son estimadas.' }], needs_approval: true, google_calendar: 'no_write', say: 'Te propongo 1 bloque.' } })
  if (path.startsWith('plan/p-1/apply')) return r.fulfill({ json: { results: [{ item_id: 'd0', status: 'created' }], applied: 1, failed: 0, say: 'Listo, programé 1 bloque en tu Agenda de EVIE. No toqué Google Calendar.' } })
  if (path.startsWith('scenes')) return r.fulfill({ status: 403, json: { error: 'no para invitados' } })
  return r.fulfill({ json: {} })
})
const checks = []; const ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
await p.goto('http://localhost:3000/index.html', { timeout: 90000 }); await p.waitForSelector('.auth-v31', { timeout: 30000 })
assert.ok(await p.$('#auth-guest')); assert.equal(await p.$eval('#guest-form', (f) => !!f.querySelector('input[type=password]')), false); ok('sign-in shows «Entrar con invitación» without a password field')
await p.click('#auth-guest summary'); await p.fill('#guest-form [name=display_name]', 'Ana'); await p.fill('#guest-form [name=code]', 'abcd efgh jklm')
await Promise.all([p.waitForEvent('load', { timeout: 30000 }), p.click('.guest-submit')])
assert.deepEqual(redeemed, { display_name: 'Ana', code: 'ABCD-EFGH-JKLM' }); ok('code normalized to XXXX-XXXX-XXXX and redeemed with the name only')
await p.waitForFunction(() => window.EvieAccounts?.current?.()?.role === 'guest', null, { timeout: 30000 }); ok('guest session restored after reload (role guest, expiry kept)')
await p.evaluate(() => window.EvieV5.openPanel('tier')); await p.waitForSelector('#v5-panel [data-v5-tier]')
const tabs = await p.$$eval('#v5-panel [data-v5-tab]', (x) => x.map((t) => t.dataset.v5Tab)); assert.ok(!tabs.includes('scenes')); assert.match(await p.textContent('#v5-panel .v5-guest'), /Invitado · Ana · quedan ~7[12] h/)
assert.equal(await p.$eval('[data-v5-tier=profundo]', (i) => i.disabled), true); assert.match(await p.textContent('#v5-panel legend'), /distinto del modo de trabajo/); ok('panel: no Escenas tab for guests, banner with hours left, Profundo disabled, tier ≠ work mode')
await p.click('[data-v5-tab=plan]'); await p.waitForSelector('[data-v5-form=plan]'); await p.fill('[data-v5-form=plan] textarea', 'llamar a Intensity 30 min'); await p.click('[data-v5-form=plan] button.primary')
await p.waitForSelector('[data-v5-plan=apply]'); assert.ok(!hits.some((h) => h.includes('/apply'))); assert.match(await p.textContent('.v5-fixed'), /Junta.*fijo/); ok('plan proposal shown with fixed event; nothing applied before approval')
await p.click('[data-v5-plan=apply]'); await p.waitForFunction(() => /No toqué Google Calendar/.test(document.querySelector('#v5-panel')?.textContent || ''), null, { timeout: 15000 }); ok('explicit approval applies; never claims Google Calendar writes')
assert.ok(!hits.some((h) => h.startsWith('GET scenes') || h.startsWith('POST scenes'))); ok('guest client never calls scene endpoints')
console.log(JSON.stringify({ checks: checks.length }), errors.length ? errors : 'no errors'); assert.deepEqual(errors, []); console.log('V5 GUEST E2E OK (' + checks.length + ' checks, 390x844)'); await b.close()
