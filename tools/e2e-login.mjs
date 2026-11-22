// Login E2E · Google-only access (2026-11-22). Runtime + auth mocked; real Supabase/Google NOT used.
//  · «Iniciar sesión» and «Crear mi cuenta» are Google (no username/password sign-up anywhere).
//  · Small «Tengo un código de invitación» tab (guest, 72 h) on both tabs.
//  · «¿Ya tenías usuario y contraseña?» signs a legacy account in once and starts Google linking right away.
//  · Google not configured yet: button disabled with a note; the username form stays open (no lock-out).
//  · ?google=<status> messages; keyboard tabs; no horizontal overflow.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 390), H = Number(process.env.H || 844), GOOGLE = process.env.GOOGLE !== '0'
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=200'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); let started = null, signin = null, signup = 0, signupMode = 'open'
await ctx.route('**/api/runtime', (r) => r.fulfill({ json: { accountsEnabled: true, googleAuth: GOOGLE, googleSignup: signupMode, passwordLogin: true, guestInvites: true, ai: {}, providers: {} } }))
await ctx.route('**/api/auth/session', (r) => r.fulfill({ json: { user: null } }))
await ctx.route('**/api/auth/signin', async (r) => { signin = r.request().postDataJSON(); await r.fulfill({ json: { user: { id: '77777777-7777-4777-8777-777777777777', username: signin.username, role: 'owner' } } }) })
await ctx.route('**/api/auth/signup', (r) => { signup++; return r.fulfill({ status: 410, json: { error: 'no' } }) })
await ctx.route('**/api/auth/google/start', async (r) => { started = { body: r.request().postDataJSON(), user: r.request().headers()['x-evie-user'] || null }; await r.fulfill({ json: { url: 'https://example.invalid/google' } }) })
await ctx.route('https://example.invalid/**', (r) => r.fulfill({ body: 'google' }))
const checks = []; const ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
const load = async (q = '') => { await p.goto('http://localhost:3000/index.html' + q, { timeout: 90000 }); await p.waitForSelector('.auth-v31', { timeout: 30000 }); await p.waitForTimeout(250) }
const view = () => p.evaluate(() => ({ tabs: [...document.querySelectorAll('[role=tab]')].map((t) => [t.textContent, t.getAttribute('aria-selected')]), err: document.getElementById('account-error').textContent, url: location.search, gbtn: document.getElementById('account-google')?.innerText.trim(), disabled: document.getElementById('account-google')?.disabled, bridge: document.getElementById('auth-bridge') ? { open: document.getElementById('auth-bridge').open, summary: document.querySelector('#auth-bridge summary').innerText } : null, pwInputs: document.querySelectorAll('.auth-v31 input[type=password]').length, guest: document.getElementById('auth-guest') ? { open: document.getElementById('auth-guest').open, summary: document.querySelector('#auth-guest summary').innerText } : null, invite: !!document.getElementById('auth-invite'), retry: !!document.getElementById('auth-retry'), scope: document.querySelector('.auth-scope')?.innerText || '', note: document.getElementById('account-google-off')?.innerText || '' }))

await load('?google=denied'); let s = await view()
assert.deepEqual(s.tabs, [['Iniciar sesión', 'true'], ['Crear mi cuenta', 'false']]); assert.match(s.err, /Cancelaste/); assert.equal(s.url, ''); assert.ok(s.retry); assert.match(s.scope, /no lee tu Gmail ni tu Calendar/)
assert.ok(s.guest && !s.guest.open && /Tengo un código de invitación/.test(s.guest.summary) && /72 h/.test(s.guest.summary), 'small guest tab, closed')
ok('two journeys; ?google=denied shows cancelled state + retry; URL cleaned; small «código de invitación (72 h)» tab')
await p.screenshot({ path: `/tmp/after-login-${W}-${GOOGLE ? 'google' : 'nogoogle'}.png` })
if (GOOGLE) {
  assert.equal(s.gbtn, 'Continuar con Google'); assert.equal(s.disabled, false); assert.equal(s.note, '')
  assert.ok(s.bridge && !s.bridge.open && /Ya tenías usuario y contraseña/.test(s.bridge.summary), 'bridge collapsed'); ok('Iniciar sesión: Google first; username form is only the collapsed one-time bridge')
  await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-google')]); assert.deepEqual(started.body, { mode: 'signin' }); ok('Continuar con Google starts mode=signin')
  await load(); await p.click('#auth-tab-new'); await p.waitForSelector('[data-mode=new]'); s = await view()
  assert.equal(s.gbtn, 'Crear cuenta con Google'); assert.equal(s.pwInputs, 0); assert.equal(s.bridge, null); assert.equal(s.invite, false); assert.ok(s.guest)
  ok('Crear mi cuenta: only «Crear cuenta con Google» (no username/password, no invitation needed) + guest tab')
  await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-google')]); assert.deepEqual(started.body, { mode: 'signin' }); assert.equal(signup, 0); ok('Crear cuenta con Google starts Google (open sign-up), never password sign-up')
  // Legacy bridge: sign in once with the old username → Google linking starts at once, as that user.
  await load(); await p.click('#auth-bridge summary'); await p.fill('#account-form [name=username]', 'mi_usuario'); await p.fill('#account-form [name=password]', 'clave-antigua-123')
  assert.equal((await p.textContent('#account-form .account-submit')).trim(), 'Entrar y vincular Google')
  await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-form .account-submit')])
  assert.deepEqual(signin, { username: 'mi_usuario', password: 'clave-antigua-123' }); assert.deepEqual(started.body, { mode: 'link' }); assert.equal(started.user, '77777777-7777-4777-8777-777777777777')
  ok('«¿Ya tenías usuario y contraseña?» signs in once and immediately starts Google linking for that account')
  // Guest tab works from the sign-in screen.
  await load(); await p.click('#auth-guest summary'); assert.equal(await p.isVisible('#guest-form [name=code]'), true); ok('guest tab opens the 72 h invitation form')
  for (const [st, rx] of [['not_linked', /Ya tenías usuario y contraseña/], ['link_taken', /ya tiene su propio espacio/], ['expired', /caducó/], ['disabled', /no está activado/]]) { await load('?google=' + st); assert.match(await p.textContent('#account-error'), rx, st) }
  ok('status messages: not_linked, link_taken, expired, disabled')
  // Invitation-only installations (EVIE_GOOGLE_SIGNUP=invite) still ask for the code before Google.
  signupMode = 'invite'; await load(); await p.click('#auth-tab-new'); await p.waitForSelector('[data-mode=new]'); await p.click('#account-google'); assert.match(await p.textContent('#account-error'), /código de invitación/)
  await p.fill('#auth-invite', 'ABCD-EFGH-JKLM'); await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-google')]); assert.deepEqual(started.body, { mode: 'signin', invite: 'ABCD-EFGH-JKLM' }); signupMode = 'open'
  ok('invitation-only mode still carries the code to Google')
} else {
  assert.equal(s.disabled, true); assert.match(s.note, /se está activando/); assert.ok(s.bridge?.open, 'username form open while Google is off'); assert.match(s.bridge.summary, /Entrar con mi usuario/)
  ok('Google not configured: button disabled with explanation; username form open (no lock-out)')
  await p.fill('#account-form [name=username]', 'mi_usuario'); await p.fill('#account-form [name=password]', 'clave-antigua-123'); assert.equal((await p.textContent('#account-form .account-submit')).trim(), 'Entrar')
  started = null; await Promise.all([p.waitForNavigation({ timeout: 15000 }), p.click('#account-form .account-submit')]); assert.equal(started, null); assert.equal(signin.username, 'mi_usuario'); ok('while Google is off the username form signs in without trying to link')
  await load(); await p.click('#auth-tab-new'); await p.waitForSelector('[data-mode=new]'); s = await view(); assert.equal(s.pwInputs, 0); assert.equal(s.disabled, true); ok('Crear mi cuenta never offers password sign-up')
}
await load(); await p.focus('#auth-tab-in'); await p.keyboard.press('ArrowRight'); await p.waitForSelector('[data-mode=new]'); ok('tabs are keyboard operable')
s = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth })); assert.ok(s.sw <= s.vw + 1); ok('no horizontal overflow at ' + W + 'px')
assert.deepEqual(errors, []); console.log(`LOGIN E2E OK (${checks.length} checks, ${W}x${H}, google=${GOOGLE})`); await b.close()
