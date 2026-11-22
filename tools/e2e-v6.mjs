// v6 E2E (runtime/auth/data mocked; real Supabase/Google NOT used):
//  1. (retired 2026-11-22: Google-only access; see tools/e2e-login.mjs)
//  2. Back from Google with ?google=recover → «Crea una contraseña nueva» → POST auth/password (old one not needed).
//  3. Cross-device sync: another device changes the account → this tab pulls it within ~15 s (stamp watcher)
//     and immediately when the app becomes visible again.
//  4. Images: a new image is uploaded (thumbnail + full) to /api/data/media; an image created on another device
//     is downloaded and cached when shown.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 390), H = Number(process.env.H || 844)
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=220'] })
const errors = [], checks = [], ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
const UID = '77777777-7777-4777-8777-777777777777'
const user = { id: UID, username: 'dali', role: 'owner' }
// Tiny 1×1 WebP served as the "remote" image.
const WEBP = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64')

async function session({ google = true, signedIn = false, server }) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(e.message)); const hits = []
  await ctx.route('**/api/**', async (r) => {
    const req = r.request(), u = new URL(req.url()), path = u.pathname.replace(/^\/api\//, ''); hits.push(req.method() + ' ' + path)
    if (path === 'runtime') return r.fulfill({ json: { accountsEnabled: true, inviteOnly: true, googleAuth: google, passwordLogin: true, mediaSync: true, guestInvites: true, ai: {}, providers: {} } })
    if (path === 'auth/session') return r.fulfill({ json: { user: signedIn ? user : null } })
    if (path === 'auth/google/start') { hits.push('START ' + JSON.stringify(req.postDataJSON())); return r.fulfill({ json: { url: 'https://example.invalid/google' } }) }
    if (path === 'auth/password') { hits.push('PASS ' + JSON.stringify(req.postDataJSON())); return r.fulfill({ json: { ok: true } }) }
    if (path === 'data/pull') return r.fulfill({ json: { owner: UID, rows: [...server.rows.values()].map((x) => structuredClone(x)), next: '' } })
    if (path === 'data/push') { const rows = req.postDataJSON().changes.map((c) => { const row = { owner_id: UID, collection: c.collection, record_id: c.record_id, payload: c.payload, revision: c.expected_revision + 1 }; server.rows.set(c.collection + '/' + c.record_id, row); return row }); server.stamp++; return r.fulfill({ json: { owner: UID, rows } }) }
    if (path === 'data/stamp') return r.fulfill({ json: { owner: UID, stamp: 's' + server.stamp } })
    if (path.startsWith('data/media/')) { const name = path.slice(11); if (req.method() === 'PUT') { server.media.set(name, req.postDataBuffer()); return r.fulfill({ json: { ok: true, name } }) } if (req.method() === 'GET') return server.media.has(name) ? r.fulfill({ body: server.media.get(name), contentType: 'image/webp' }) : r.fulfill({ status: 404, json: { error: 'no' } }); return r.fulfill({ json: { ok: true } }) }
    if (path === 'profile') return r.fulfill({ json: { profile: {} } })
    return r.fulfill({ json: {} })
  })
  await ctx.route('https://example.invalid/**', (r) => r.fulfill({ body: 'google' }))
  return { ctx, p, hits }
}

// (1. The «¿Olvidaste tu contraseña?» panel was retired on 2026-11-22: access is Google-only — see tools/e2e-login.mjs.)

// 2–4. Signed in
{ const server = { rows: new Map(), stamp: 1, media: new Map() }; const { ctx, p, hits } = await session({ signedIn: true, server })
  await p.goto('http://localhost:3000/index.html?google=recover', { timeout: 90000 })
  await p.waitForFunction(() => window.EvieAccounts?.current?.()?.id && window.Store?.get?.(), null, { timeout: 30000 })
  // First run of an empty account shows onboarding; complete it.
  await p.waitForTimeout(1500); if (await p.$('#onboarding-form')) { await p.fill('#onboarding-form [name=name]', 'Dali'); await p.fill('#onboarding-form [name=preferred]', 'Dali'); await p.evaluate(() => document.getElementById('onboarding-form').requestSubmit()) }
  await p.waitForSelector('#recover-pass-form', { timeout: 15000 }); ok('back from Google (?google=recover): «Crea una contraseña nueva» opens')
  await p.fill('#recover-pass-form [name=p]', 'nueva-clave-123'); await p.fill('#recover-pass-form [name=c]', 'otra-clave-123'); await p.click('#recover-pass-form .primary')
  assert.match(await p.textContent('#recover-error'), /no coinciden/); assert.ok(!hits.some((h) => h.startsWith('PASS')))
  await p.fill('#recover-pass-form [name=c]', 'nueva-clave-123'); await p.click('#recover-pass-form .primary')
  await p.waitForFunction(() => !document.querySelector("#recover-pass-form")?.closest("dialog")?.open, null, { timeout: 10000 })
  assert.ok(hits.includes('PASS {"password":"nueva-clave-123"}')); ok('mismatch is caught; matching password is saved without the old one')
  assert.ok(!(await p.evaluate(() => location.search)).includes('google')); ok('the ?google=recover marker is removed from the address')

  // 3. Another device adds a goal: the stamp changes and this tab pulls it without a reload.
  await p.waitForFunction(() => window.EvieAccounts?.current?.() && !document.querySelector('.auth-v31'), null, { timeout: 15000 })
  await p.waitForTimeout(1500)
  const id = 'remote-goal-1'
  server.rows.set('goals/' + id, { owner_id: UID, collection: 'goals', record_id: id, revision: 1, payload: await p.evaluate((rid) => ({ ...window.Store.record({ title: 'Desde el celular', date: new Date().toISOString().slice(0, 10), target: 1, progress: 0, horizon: 'diario', category: 'Personal', periodKey: new Date().toISOString().slice(0, 10), history: [] }), id: rid }), id) })
  server.stamp++
  const t0 = Date.now()
  try {
  await p.waitForFunction((rid) => window.Store.list('goals').some((g) => g.id === rid), id, { timeout: 25000 })
  } catch (e) { console.log('DEBUG2', JSON.stringify({ tail: hits.slice(-12), status: await p.evaluate(() => document.getElementById('sync-status')?.textContent), err: await p.evaluate(() => window.AccountUI?.sync?.()?.error?.() || null), goals: await p.evaluate(() => window.Store.list('goals').length), gate: await p.evaluate(() => !!document.querySelector('.auth-v31,#onboarding-form')) })); throw e }
  const secs = Math.round((Date.now() - t0) / 1000); ok(`change made on another device appears here in ${secs}s without reloading`)
  assert.ok(secs <= 20)
  // Returning to the app (phone resumes) pulls right away.
  const id2 = 'remote-goal-2'
  server.rows.set('goals/' + id2, { owner_id: UID, collection: 'goals', record_id: id2, revision: 1, payload: await p.evaluate((rid) => ({ ...window.Store.record({ title: 'Otra desde el celular', date: new Date().toISOString().slice(0, 10), target: 1, progress: 0, horizon: 'diario', category: 'Personal', periodKey: new Date().toISOString().slice(0, 10), history: [] }), id: rid }), id2) })
  server.stamp++
  const t1 = Date.now(); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await p.waitForFunction((rid) => window.Store.list('goals').some((g) => g.id === rid), id2, { timeout: 8000 })
  ok(`coming back to the app pulls immediately (${Math.round((Date.now() - t1) / 100) / 10}s)`)

  // 4a. New image → uploaded (thumbnail + full).
  const mid = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = c.height = 32; c.getContext('2d').fillRect(0, 0, 32, 32); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return window.MediaStore.save(new File([blob], 'foto.png', { type: 'image/png' })) })
  await p.waitForFunction((m) => true, mid); const deadline = Date.now() + 15000
  while (Date.now() < deadline && !(server.media.has(mid + '.webp') && server.media.has(mid + '-t.webp'))) await p.waitForTimeout(300)
  assert.ok(server.media.has(mid + '.webp') && server.media.has(mid + '-t.webp'), 'uploaded ' + [...server.media.keys()]); ok('new image uploaded to the private cloud folder (thumbnail + full)')
  assert.equal(await p.evaluate(async (m) => (await window.MediaStore.get(m)).remote, mid), true); ok('local copy marked as synced (no re-upload)')

  // 4b. Image that exists only in the cloud (made on another device) → downloaded when shown.
  const rid = '0f8fad5b-d9cb-469f-a165-70867728950e'; server.media.set(rid + '.webp', WEBP); server.media.set(rid + '-t.webp', WEBP)
  await p.evaluate((m) => window.Store.put('mediaMetadata', { id: m, title: 'remota', name: 'remota.webp', mime: 'image/webp', size: 40, width: 1, height: 1 }), rid)
  const shown = await p.evaluate(async (m) => { const box = document.createElement('div'); box.innerHTML = `<img data-media-id="${m}" alt="">`; document.body.append(box); await window.MediaStore.hydrate(box); const img = box.querySelector('img'); const r = { hidden: img.hidden, src: img.src.startsWith('blob:'), cached: !!(await window.MediaStore.get(m)) }; box.remove(); return r }, rid)
  assert.deepEqual(shown, { hidden: false, src: true, cached: true }); ok('image from another device is downloaded, shown and cached')
  await ctx.close() }

console.log(JSON.stringify({ checks: checks.length }), errors.length ? errors : 'no errors'); assert.deepEqual(errors, [])
console.log('V6 E2E OK (' + checks.length + ' checks, ' + W + 'x' + H + ')'); await b.close()
