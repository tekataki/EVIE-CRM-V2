// Login E2E · correo + contraseña o Google (2026-11-22). Runtime + auth mocked; real Supabase/Google NOT used.
//  · «Iniciar sesión»: Continuar con Google (rápido) o correo + contraseña; «¿Olvidaste tu contraseña?» → Recuperar con Google.
//  · «Crear mi cuenta»: Crear cuenta con Google o correo + contraseña + confirmación (validada antes de enviar).
//  · Pestaña pequeña «Tengo un código de invitación» (72 h). Cuentas antiguas: el campo acepta su usuario.
//  · Google sin configurar: botón deshabilitado con aviso; el correo sigue funcionando.
//  · Enlace de confirmación de Supabase: se limpia la dirección y se avisa. Mensajes ?google=…; teclado; sin desbordes.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 390), H = Number(process.env.H || 844), GOOGLE = process.env.GOOGLE !== '0'
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=200'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
let started = null, signin = null, signup = null, signupReply = { status: 200, json: { user: { id: '77777777-7777-4777-8777-777777777777', username: 'mi_usuario', role: 'owner' } } }
await ctx.route('**/api/runtime', (r) => r.fulfill({ json: { accountsEnabled: true, googleAuth: GOOGLE, signup: 'open', googleSignup: 'open', passwordLogin: true, guestInvites: true, ai: {}, providers: {} } }))
await ctx.route('**/api/auth/session', (r) => r.fulfill({ json: { user: null } }))
await ctx.route('**/api/auth/signin', async (r) => { signin = r.request().postDataJSON(); await r.fulfill({ json: { user: { id: '77777777-7777-4777-8777-777777777777', username: 'mi_usuario', role: 'owner' } } }) })
await ctx.route('**/api/auth/signup', async (r) => { signup = r.request().postDataJSON(); await r.fulfill(signupReply) })
await ctx.route('**/api/auth/google/start', async (r) => { started = r.request().postDataJSON(); await r.fulfill({ json: { url: 'https://example.invalid/google' } }) })
await ctx.route('https://example.invalid/**', (r) => r.fulfill({ body: 'google' }))
const checks = []; const ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
const load = async (q = '') => { await p.goto('about:blank'); await p.goto('http://localhost:3000/' + q, { timeout: 90000 }); await p.waitForSelector('.auth-v31', { timeout: 30000 }); await p.waitForTimeout(250) }
const view = () => p.evaluate(() => ({ tabs: [...document.querySelectorAll('[role=tab]')].map((t) => [t.textContent, t.getAttribute('aria-selected')]), err: document.getElementById('account-error').textContent, info: document.getElementById('account-info')?.textContent || '', url: location.search + location.hash, gbtn: document.getElementById('account-google')?.innerText.trim(), disabled: document.getElementById('account-google')?.disabled, fields: [...document.querySelectorAll('#account-form input')].map((i) => i.name + ':' + i.type), submit: document.querySelector('#account-form .account-submit')?.textContent.trim(), forgot: !!document.getElementById('account-forgot'), guest: document.querySelector('#auth-guest summary')?.innerText || '', bridge: !!document.getElementById('auth-bridge'), note: document.getElementById('account-google-off')?.innerText || '' }))
const fill = async (email, pass, confirm) => { await p.fill('#account-form [name=email]', email); await p.fill('#account-form [name=password]', pass); if (confirm !== undefined) await p.fill('#account-form [name=confirm]', confirm) }

await load('?google=denied'); let s = await view()
assert.deepEqual(s.tabs, [['Iniciar sesión', 'true'], ['Crear mi cuenta', 'false']]); assert.match(s.err, /Cancelaste/); assert.ok(!s.url.includes('google'))
assert.deepEqual(s.fields, ['email:text', 'password:password']); assert.equal(s.submit, 'Entrar'); assert.ok(s.forgot); assert.equal(s.bridge, false)
assert.match(s.guest, /Tengo un código de invitación/); assert.match(s.guest, /72 h/)
ok('Iniciar sesión: correo + contraseña, «¿Olvidaste tu contraseña?», pestaña de invitación; sin el puente de usuario')
await p.screenshot({ path: `/tmp/after-login-${W}-${GOOGLE ? 'google' : 'nogoogle'}.png` })
// Sign in with e-mail.
await load(); await fill('Dali@Example.com', 'una-clave-segura-1'); await Promise.all([p.waitForNavigation({ timeout: 15000 }), p.click('#account-form .account-submit')])
assert.deepEqual(signin, { email: 'dali@example.com', password: 'una-clave-segura-1' }); ok('Entrar envía {email, password} (correo en minúsculas)')
// Old username still accepted in the same field.
await load(); await fill('mi_usuario', 'clave-antigua-123'); await Promise.all([p.waitForNavigation({ timeout: 15000 }), p.click('#account-form .account-submit')])
assert.deepEqual(signin, { username: 'mi_usuario', password: 'clave-antigua-123' }); ok('una cuenta antigua puede escribir su usuario en el mismo campo')
// Crear mi cuenta.
await load(); await p.click('#auth-tab-new'); await p.waitForSelector('[data-mode=new]'); s = await view()
assert.deepEqual(s.fields, ['email:email', 'password:password', 'confirm:password']); assert.equal(s.submit, 'Crear cuenta'); assert.equal(s.forgot, false); assert.match(s.guest, /código de invitación/)
ok('Crear mi cuenta: correo, contraseña y confirmación + pestaña de invitación')
signup = null
await fill('ana@example.com', 'una-clave-segura-1', 'otra-clave-distinta'); await p.click('#account-form .account-submit'); assert.match(await p.textContent('#account-error'), /no coinciden/); assert.equal(signup, null)
await fill('ana@example.com', 'corta', 'corta'); await p.click('#account-form .account-submit'); assert.match(await p.textContent('#account-error'), /al menos 10/); assert.equal(signup, null)
await fill('ana-sin-arroba', 'una-clave-segura-1', 'una-clave-segura-1'); await p.click('#account-form .account-submit'); assert.match(await p.textContent('#account-error'), /correo válido/); assert.equal(signup, null)
ok('contraseñas distintas, contraseña corta y correo inválido se detienen antes de enviar')
await fill('ana@example.com', 'una-clave-segura-1', 'una-clave-segura-1'); await Promise.all([p.waitForNavigation({ timeout: 15000 }), p.click('#account-form .account-submit')])
assert.deepEqual(signup, { email: 'ana@example.com', password: 'una-clave-segura-1' }); ok('Crear cuenta envía {email, password} (la confirmación no sale del navegador)')
signupReply = { status: 202, json: { pending: 'confirm_email' } }
await load(); await p.click('#auth-tab-new'); await p.waitForSelector('[data-mode=new]'); await fill('ana@example.com', 'una-clave-segura-1', 'una-clave-segura-1'); await p.click('#account-form .account-submit')
await p.waitForFunction(() => /Te enviamos un correo/.test(document.getElementById('account-info')?.textContent || ''), null, { timeout: 10000 }); assert.equal(await p.getAttribute('#auth-tab-in', 'aria-selected'), 'true')
ok('si Supabase pide confirmar el correo: aviso «Te enviamos un correo» y vuelve a Iniciar sesión')
signupReply = { status: 200, json: { user: { id: '77777777-7777-4777-8777-777777777777', username: 'mi_usuario', role: 'owner' } } }
// Supabase confirmation link landing: tokens leave the address.
await load('#access_token=fake-token&refresh_token=x&type=signup'); s = await view(); assert.match(s.info, /Correo confirmado/); assert.ok(!s.url.includes('access_token')); ok('al volver del enlace de confirmación se borran los datos de la dirección y se avisa')
if (GOOGLE) {
  await load(); s = await view(); assert.equal(s.gbtn, 'Continuar con Google'); assert.equal(s.disabled, false); assert.equal(s.note, '')
  await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-google')]); assert.deepEqual(started, { mode: 'signin' }); ok('Continuar con Google entra rápido (mode=signin)')
  await load(); await p.click('#auth-tab-new'); await p.waitForSelector('[data-mode=new]'); assert.equal((await view()).gbtn, 'Crear cuenta con Google')
  await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-google')]); assert.deepEqual(started, { mode: 'signin' }); ok('Crear cuenta con Google')
  await load(); await p.click('#account-forgot'); assert.equal(await p.isVisible('#auth-recover'), true); await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-recover-google')]); assert.deepEqual(started, { mode: 'recover' }); ok('«¿Olvidaste tu contraseña?» → Recuperar con Google (mode=recover)')
  for (const [st, rx] of [['not_linked', /Crear mi cuenta/], ['expired', /caducó/], ['disabled', /no está activado/]]) { await load('?google=' + st); assert.match(await p.textContent('#account-error'), rx, st) }
  ok('mensajes: not_linked, expired, disabled')
} else {
  await load(); s = await view(); assert.equal(s.disabled, true); assert.match(s.note, /correo y contraseña/); assert.deepEqual(s.fields, ['email:text', 'password:password'])
  ok('Google sin configurar: botón deshabilitado con aviso; el correo sigue disponible')
}
await load(); await p.click('#auth-guest summary'); assert.equal(await p.isVisible('#guest-form [name=code]'), true); ok('la pestaña de invitación abre el formulario de 72 h')
await load(); await p.focus('#auth-tab-in'); await p.keyboard.press('ArrowRight'); await p.waitForSelector('[data-mode=new]'); ok('pestañas operables con teclado')
s = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth })); assert.ok(s.sw <= s.vw + 1); ok('sin desborde horizontal a ' + W + 'px')
assert.deepEqual(errors, []); console.log(`LOGIN E2E OK (${checks.length} checks, ${W}x${H}, google=${GOOGLE})`); await b.close()
