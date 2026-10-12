// Visual + behaviour check of the sign-in gate with Google enabled (runtime mocked).
import { chromium } from 'playwright'
const W = Number(process.env.W || 390), H = Number(process.env.H || 844)
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=200'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); let started = null
await p.route('**/api/runtime', (r) => r.fulfill({ json: { accountsEnabled: true, inviteOnly: true, googleAuth: true, passwordLogin: true, ai: {}, providers: {} } }))
await p.route('**/api/auth/session', (r) => r.fulfill({ json: { user: null } }))
await p.route('**/api/auth/google/start', async (r) => { started = r.request().postDataJSON(); await r.fulfill({ json: { url: 'https://example.invalid/google' } }) })
await p.route('https://example.invalid/**', (r) => r.fulfill({ body: 'google' }))
await p.goto('http://localhost:3000/index.html?google=not_linked', { timeout: 90000 })
await p.waitForSelector('#account-google', { timeout: 30000 }); await p.waitForTimeout(600)
const msg = await p.textContent('#account-error'); const url1 = p.url()
await p.screenshot({ path: `/tmp/login-${W}.png` })
await p.click('#account-other'); await p.click('#account-google'); const blocked = await p.textContent('#account-error')
await p.fill('input[name=invite]', 'ABCD-EFGH-JKLM'); await Promise.all([p.waitForURL(/example\.invalid/, { timeout: 15000 }), p.click('#account-google')])
const ok = /no está vinculada/.test(msg) && !/google=/.test(url1) && /invitación/.test(blocked) && started?.mode === 'signin' && started?.invite === 'ABCD-EFGH-JKLM' && !errors.length
console.log(JSON.stringify({ W, ok, msg, url1, blocked, started, errors })); await b.close(); process.exit(ok ? 0 : 1)
