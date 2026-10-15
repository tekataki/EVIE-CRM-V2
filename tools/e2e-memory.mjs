// E2E Memoria de Ivi (browser): «Ivi, recuerda que…» / «olvida…» / «¿recuerdas lo que te pregunté ayer?»,
// private mode, Memoria panel inside Configuración personalizada, sensitive confirmation, account switch.
// /api/memory is emulated per account here (the real server is covered by tests/memory.test.cjs), so this
// checks the UI contract: what is sent, what is shown, and that nothing leaks across accounts.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 1440), H = 900
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=220'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept())
const db = {}; let who = 'A'; const sent = { sessions: [] }
const acct = () => (db[who] ||= { settings: { enabled: true, use_memories: true, reference_history: false, save_history: false, allow_health: false, allow_emotional: false, timezone: 'America/Mexico_City' }, memories: [], sessions: [] })
await p.route('**/api/memory**', async (r) => {
  const u = new URL(r.request().url()), m = r.request().method(), path = u.pathname.replace('/api/memory', ''), body = r.request().postData() ? JSON.parse(r.request().postData()) : {}, a = acct()
  if (path === '' && m === 'GET') return r.fulfill({ json: a })
  if (path === '/settings') { a.settings = { ...a.settings, ...body.settings }; return r.fulfill({ json: { settings: a.settings } }) }
  if (path === '/items' && m === 'POST') {
    if (/diabetes/.test(body.text) && !a.settings.allow_health) return r.fulfill({ json: { needs_permission: true, category: 'health', error: 'Eso parece información de salud. Para guardarla, activa «Recordar datos de salud».' } })
    if (/diabetes/.test(body.text) && !body.confirm_sensitive) return r.fulfill({ json: { needs_confirmation: true, category: 'health', text: body.text } })
    const prev = a.memories.find((x) => /color favorito/.test(x.text) && /color favorito/.test(body.text)); if (prev) { prev.text = body.text; return r.fulfill({ json: { id: prev.id, text: body.text, superseded: true } }) }
    const it = { id: 'm-' + (a.memories.length + 1) + '-aaaaaaaa', text: body.text, kind: 'fact', category: /diabetes/.test(body.text) ? 'health' : 'general', source: 'explicit', updated_at: Date.now(), created_at: Date.now() }; a.memories.unshift(it); return r.fulfill({ json: { id: it.id, text: it.text, created: true } })
  }
  if (path === '/forget') { const w = body.query.toLowerCase().split(' ').pop(); const hits = a.memories.filter((x) => x.text.toLowerCase().includes(w)); if (hits.length > 1) return r.fulfill({ json: { ambiguous: true, candidates: hits.map((h) => ({ id: h.id, text: h.text })) } }); if (!hits.length) return r.fulfill({ json: { not_found: true, error: 'No tengo guardado nada sobre eso.' } }); a.memories = a.memories.filter((x) => x !== hits[0]); return r.fulfill({ json: { deleted: [hits[0].id], text: hits[0].text } }) }
  if (path.startsWith('/items/') && m === 'DELETE') { a.memories = a.memories.filter((x) => x.id !== decodeURIComponent(path.slice(7))); return r.fulfill({ json: { deleted: [path.slice(7)] } }) }
  if (path === '/sessions' && m === 'POST') { sent.sessions.push({ who, ...body }); if (!a.settings.save_history) return r.fulfill({ json: { stored: false } }); a.sessions.push({ id: body.id, day: '2026-10-14', started_at: body.started_at, questions: body.questions, summary: '' }); return r.fulfill({ json: { stored: true } }) }
  if (path === '/recall') { if (!a.settings.save_history) return r.fulfill({ json: { stored: false, day: '2026-10-14', text: 'No guardo un historial de nuestras conversaciones, así que no puedo saber qué me preguntaste el 14 de octubre de 2026.' } }); const s = a.sessions.filter((x) => x.day === '2026-10-14'); return r.fulfill({ json: s.length ? { stored: true, day: '2026-10-14', sessions: s, text: 'El 14 de octubre de 2026 me preguntaste: ' + s.flatMap((x) => x.questions).map((q) => '«' + q + '»').join(', ') + '.' } : { stored: true, day: '2026-10-14', sessions: [], text: 'No tengo guardada ninguna conversación del 14 de octubre de 2026.' } }) }
  if (path === '/export') return r.fulfill({ json: { format: 'evie.memory', version: 1, ...a } })
  if (path === '' && m === 'DELETE') { delete db[who]; return r.fulfill({ json: { deleted: true } }) }
  return r.fulfill({ status: 404, json: { error: 'no' } })
})
await p.route('**/api/profile', (r) => r.fulfill({ json: { profile: { enabled: true } } }))
await p.goto('http://localhost:3000/index.html?qa=mem' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 30000 })
const checks = []; const ok = (n) => { checks.push(n); console.log(' ✓ ' + n) }
const until = (fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms })
const signIn = (id) => p.evaluate((id) => { const k = EvieAccounts.storageKey(); const cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: false, stt: false, tts: false }; EvieAccounts.current = () => ({ id, username: id.slice(0, 4) }); EvieAccounts.storageKey = () => k; EvieAccounts.verify = async () => true; EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j }); EvieMemory.reset(); EvieProfile.reset() }, id)
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.profile.preferred = 'Ale' }); location.hash = 'inicio' })
await signIn(A)
const say = async (t) => { await p.evaluate((t) => { const i = document.getElementById('evie-stage-input'); i.value = t; document.getElementById('evie-stage-form').requestSubmit() }, t); await p.waitForTimeout(500) }
const subsMatch = (rx) => until((src) => new RegExp(src, 'i').test(document.getElementById('evie-subs')?.innerText || ''), rx.source)
await until(() => document.getElementById('evie-stage-input'))
await say('Ivi, recuerda que mi color favorito es azul'); await subsMatch(/lo recordaré/)
assert.equal(db.A.memories.length, 1); assert.equal(db.A.memories[0].text, 'mi color favorito es azul'); ok('«Ivi, recuerda que…» saves exactly what was said (local intent, no AI call)')
await say('Ivy, recuerda que mi color favorito es verde'); await subsMatch(/Actualicé/)
assert.equal(db.A.memories.length, 1); assert.match(db.A.memories[0].text, /verde/); ok('contradiction supersedes the old fact; wake variant «Ivy» accepted')
await say('Evie, recuerda que tengo diabetes'); await subsMatch(/salud/)
assert.equal(db.A.memories.length, 1); ok('health detail not saved while the category is off')
await say('Ivi, activa el modo privado'); await until(() => document.getElementById('evie-private-badge'))
await say('Ivi, recuerda que mi clave del wifi es 1234'); await subsMatch(/modo privado/)
assert.equal(db.A.memories.length, 1); assert.equal(await p.evaluate(() => document.documentElement.dataset.eviePrivate), '1'); ok('private mode: badge shown, «recuerda» refused, nothing stored')
await p.click('#evie-private-badge'); await until(() => !document.getElementById('evie-private-badge')); ok('private badge exits private mode')
await say('Ivi, ¿recuerdas lo que te pregunté ayer?'); await subsMatch(/No guardo un historial/)
ok('recall with history off says plainly it was not stored (no invented exchange)')
await p.evaluate(() => { location.hash = 'personalizada' }); await until(() => document.querySelector('#mem-settings'))
let s = await p.evaluate(() => ({ items: [...document.querySelectorAll('#mem-lists .mem-item p')].map((x) => x.textContent), sw: [...document.querySelectorAll('#mem-settings input[type=checkbox]')].map((x) => x.name + ':' + x.checked) }))
assert.deepEqual(s.items, ['mi color favorito es verde']); assert.ok(s.sw.includes('save_history:false') && s.sw.includes('allow_health:false')); ok('Memoria panel lists the item; history + sensitive switches off by default')
await p.check('#mem-settings [name=save_history]'); await p.check('#mem-settings [name=reference_history]'); await p.check('#mem-settings [name=allow_health]')
assert.equal(db.A.settings.save_history, false, 'not uploaded before pressing save'); await p.click('#mem-settings [type=submit]'); await p.waitForTimeout(500)
assert.equal(db.A.settings.save_history, true); assert.equal(db.A.settings.allow_health, true); ok('memory switches upload only on «Guardar ajustes de memoria»')
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('evie-stage-input'))
await say('Ivi, recuerda que tengo diabetes'); await subsMatch(/sensible/); assert.equal(db.A.memories.length, 1)
await p.evaluate(() => { location.hash = 'personalizada' }); await until(() => document.querySelector('[data-mem=confirm-sensitive]'))
await p.click('[data-mem=confirm-sensitive]'); await until(() => document.querySelectorAll('#mem-lists .mem-item').length === 2)
assert.ok(db.A.memories.some((m) => m.category === 'health')); assert.match(await p.innerText('#mem-lists'), /Salud/); ok('sensitive fact saved only after explicit on-screen confirmation, tagged «Salud»')
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('evie-stage-input'))
await say('¿A qué hora abre el Tecnológico?'); await p.evaluate(() => EvieMemory.finish()); await p.waitForTimeout(300)
const last = sent.sessions.at(-1); assert.ok(last && last.questions.includes('¿A qué hora abre el Tecnológico?')); assert.ok(last.questions.length <= 6); assert.ok(!('transcript' in last) && !('answers' in last)); ok('finished conversation sends only bounded questions (no transcript, no answers)')
await say('Ivi, ¿recuerdas lo que te pregunté ayer?'); await subsMatch(/14 de octubre de 2026/)
assert.match(await p.evaluate(() => document.getElementById('evie-subs').innerText), /A qué hora abre el Tecnológico/); ok('«¿recuerdas lo que te pregunté ayer?» answers with the stored question and its date')
await say('Ivi, olvida mi color favorito'); await subsMatch(/olvidé/)
assert.ok(!db.A.memories.some((m) => /color/.test(m.text))); ok('«Ivi, olvida…» deletes the matching memory')
const before = sent.sessions.length; await p.evaluate(() => { EvieMemory.track('me siento triste hoy', { source: 'kisha' }); return EvieMemory.finish() }); assert.equal(sent.sessions.length, before); ok('Kisha turns never become history')
await say('pregunta pendiente de A'); who = 'B'; await signIn(B)
await p.evaluate(() => EvieMemory.finish()); assert.ok(!sent.sessions.slice(before).some((x) => x.who === 'B' && x.questions?.includes('pregunta pendiente de A')), 'A question must not flush into B')
await p.evaluate(() => { location.hash = 'personalizada' }); await until(() => document.querySelector('#mem-settings')); await p.waitForTimeout(300)
assert.equal(await p.evaluate(() => document.querySelectorAll('#mem-lists .mem-item').length), 0); ok('account B sees none of A memories; A turns are not flushed into B')
assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); ok(`no horizontal overflow at ${W}px`)
assert.deepEqual(errors, []); console.log(`MEMORY E2E OK (${checks.length} checks, ${W}x${H})`); await b.close()
