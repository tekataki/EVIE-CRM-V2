// v3.1 login E2E (runtime + auth mocked): two journeys, Google states, invitation gate, transition form,
// unconfigured provider, ?google=<status> messages, onboarding name hint. Real Supabase/Google NOT used.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 390), H = Number(process.env.H || 844), GOOGLE = process.env.GOOGLE !== '0'
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=200'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); let started = null
await ctx.route('**/api/runtime', (r) => r.fulfill({ json: { accountsEnabled: true, inviteOnly: true, googleAuth: GOOGLE, passwordLogin: true, ai: {}, providers: {} } }))
await ctx.route('**/api/auth/session', (r) => r.fulfill({ json: { user: null } }))
await ctx.route('**/api/auth/google/start', async (r) => { started = r.request().postDataJSON(); await r.fulfill({ json: { url: 'https://example.invalid/google' } }) })
await ctx.route('https://example.invalid/**', (r) => r.fulfill({ body: 'google' }))
const checks = []; const ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
await p.goto('http://localhost:3000/index.html?google=denied', { timeout: 90000 }); await p.waitForSelector('.auth-v31', { timeout: 30000 }); await p.waitForTimeout(500)
let s = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('[role=tab]')].map((t) => [t.textContent, t.getAttribute('aria-selected')]), err: document.getElementById('account-error').textContent, url: location.search, gbtn: document.getElementById('account-google')?.innerText, disabled: document.getElementById('account-google')?.disabled, legacy: !!document.querySelector('.auth-legacy'), retry: !!document.getElementById('auth-retry'), scope: document.querySelector('.auth-scope')?.innerText || '' }))
assert.deepEqual(s.tabs, [['Iniciar sesión', 'true'], ['Crear mi cuenta', 'false']]); assert.match(s.err, /Cancelaste/); assert.equal(s.url, ''); assert.ok(s.retry); assert.ok(s.legacy, 'transition form present'); assert.match(s.scope, /no lee tu Gmail ni tu Calendar/)
ok('two journeys; ?google=denied shows cancelled state + retry; URL cleaned; scope disclaimer')
await p.screenshot({ path: `/tmp/after-login-${W}-${GOOGLE ? 'google' : 'nogoogle'}.png` })
if (GOOGLE) {
  assert.equal(s.gbtn.trim(), 'Continuar con Google'); assert.equal(s.disabled, false)
  await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-google')]); assert.deepEqual(started, { mode: 'signin' }); ok('Iniciar sesión → Continuar con Google starts mode=signin (no invite)')
  await p.goto('http://localhost:3000/index.html', { timeout: 90000 }); await p.waitForSelector('.auth-v31')
  await p.click('#auth-tab-new'); await p.waitForSelector('[data-mode=new]'); await p.click('#account-google'); s = await p.textContent('#account-error'); assert.match(s, /código de invitación/); ok('Crear mi cuenta requires an invitation before Google')
  await p.fill('#auth-invite', 'ABCD-EFGH-JKLM'); await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-google')]); assert.deepEqual(started, { mode: 'signin', invite: 'ABCD-EFGH-JKLM' }); ok('Crear mi cuenta → Google carries the invitation')
  for (const [st, rx] of [['not_linked', /no está vinculada/], ['not_invited', /no tiene invitación/], ['expired', /caducó/], ['disabled', /no está activado/]]) { await p.goto('http://localhost:3000/index.html?google=' + st, { timeout: 90000 }); await p.waitForSelector('.auth-v31'); await p.waitForTimeout(200); assert.match(await p.textContent('#account-error'), rx, st) }
  ok('status messages: not_linked, not_invited, expired, disabled')
} else {
  assert.equal(s.disabled, true); s = await p.evaluate(() => ({ note: document.getElementById('account-google-off')?.innerText || '', open: document.querySelector('.auth-legacy')?.open })); assert.match(s.note, /aún no está configurado/); assert.equal(s.open, true); ok('Google unconfigured: button disabled with explanation, transition form open (no lock-out)')
}
// keyboard: arrow switches tab
await p.goto('http://localhost:3000/index.html', { timeout: 90000 }); await p.waitForSelector('.auth-v31'); await p.focus('#auth-tab-in'); await p.keyboard.press('ArrowRight'); await p.waitForSelector('[data-mode=new]'); ok('tabs are keyboard operable')
s = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth })); assert.ok(s.sw <= s.vw + 1); ok('no horizontal overflow at ' + W + 'px')
assert.deepEqual(errors, []); console.log(`LOGIN E2E OK (${checks.length} checks, ${W}x${H}, google=${GOOGLE})`); await b.close()
