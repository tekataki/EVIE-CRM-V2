// E2E Mascota Virtual (Kisha) in a real browser with mocked /api/kisha/* and /api/ai/* (no paid calls).
// Covers: typed + voice turns, contextual follow-ups, speaking only while audio plays, iOS-style blocked
// autoplay + one-tap replay (no 2nd TTS), interrupt, pause/resume, provider failures, too-little session,
// review/edit/confirm, duplicate-save prevention, draft resume after navigation, legacy records, delete.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 390), H = Number(process.env.H || 844)
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=200', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: W, height: H } })
await ctx.grantPermissions(['microphone'], { origin: 'http://localhost:3000' })
const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message))
const wav = (() => { const n = 8000, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 6) * 9000 * (i % 2000 < 1200 ? 1 : .1)), 44 + i * 2); return b })()
const calls = { turn: 0, analyze: 0, tts: 0, stt: 0, turnBodies: [] }; const mode = { turn: 'ok', tts: 'ok', stt: 'ok', analyze: 'ok' }
await p.route('**/api/**', async (route) => {
  const u = route.request().url()
  if (u.endsWith('/kisha/turn')) { calls.turn++; const body = JSON.parse(route.request().postData()); calls.turnBodies.push(body); if (mode.turn === 'fail') return route.fulfill({ status: 502, json: { error: 'Kisha no pudo responder ahora.' } }); const last = body.messages.at(-1).text
    const sad = /triste/.test(last); return route.fulfill({ json: { reply: sad ? 'Siento que hoy pesó. ¿Qué fue lo más difícil?' : 'Qué bueno que lo cuentas. ¿Qué parte disfrutaste más de «' + last.slice(0, 20) + '»?', cue: sad ? 'supportive' : 'curious', intent: 'follow_up', safety: false, memory: null } }) }
  if (u.endsWith('/kisha/analyze')) { calls.analyze++; if (mode.analyze === 'fail') return route.fulfill({ status: 502, json: { error: 'Kisha no pudo responder ahora.' } }); return route.fulfill({ json: { owner: 'qa-user', session_id: JSON.parse(route.request().postData()).session_id, date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()), time_local: '21:30', timezone: 'America/Mexico_City', insufficient: false, title: 'Un día de proyecto', summary: 'Contaste que terminaste tu proyecto y que te sentiste triste por la tarde.', moments: [{ text: 'Terminaste el proyecto', quote: 'terminé mi proyecto' }], emotions: [{ key: 'alegria', value: 40, evidence: 'terminé mi proyecto' }, { key: 'tristeza', value: 55, evidence: 'me sentí triste' }], observation: 'Quizá fue un día de contrastes.', dropped: 0 } }) }
  if (u.endsWith('/ai/tts')) { calls.tts++; if (mode.tts === 'fail') return route.fulfill({ status: 502, json: { error: 'x' } }); return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }) }
  if (u.endsWith('/ai/stt')) { calls.stt++; if (mode.stt === 'fail') return route.fulfill({ status: 502, json: { error: 'No se pudo transcribir.' } }); return route.fulfill({ json: { text: 'hoy terminé mi proyecto de la escuela' } }) }
  return route.continue()
})
await p.goto('http://localhost:3000/index.html?qa=kisha-' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 30000 })
// Simulated signed-in cloud account (UI gate only — the server authorizes for real; see tests/kisha-server.test.cjs).
await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.journal.push({ id: 'legacy-1', title: 'Mi día escrito a mano', text: 'Fui al parque con mi hermana.', summary: '', productivity: 60, reason: '', tags: [], date: '2025-05-01', source: 'manual', journal_version: 1, created_at: '2025-05-01T10:00:00Z', updated_at: '2025-05-01T10:00:00Z' }) }); const key = EvieAccounts.storageKey(); const c = EvieAccounts.config(); c.accountsEnabled = true; c.ai = { chat: true, stt: true, tts: true }; window.__u = { id: 'qa-user' }; Object.defineProperty(EvieAccounts, 'storageKey', { value: () => key, configurable: true }); Object.defineProperty(EvieAccounts, 'current', { value: () => window.__u, configurable: true }); EvieAccounts.request = async (path, { method = 'GET', body, signal } = {}) => { const r = await fetch('/api/' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Evie-Request': '1' }, body: body === undefined ? undefined : JSON.stringify(body), signal }); const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error), { status: r.status }); return j }
  location.hash = 'mascota' })
const st = () => p.evaluate(() => ({ ...KishaView.stats(), status: document.getElementById('kisha-status')?.textContent, pose: document.getElementById('kisha-char')?.dataset.pose, log: [...document.querySelectorAll('#kisha-log .kisha-msg')].map((x) => x.className.replace('kisha-msg ', '') + ':' + x.querySelector('p')?.textContent) }))
const until = async (fn, arg, ms = 20000) => { try { return await p.waitForFunction(fn, arg, { timeout: ms }) } catch (e) { console.log('STUCK', new Error().stack.split('\n')[2], JSON.stringify(await st()), JSON.stringify({ ...calls, turnBodies: calls.turnBodies.length })); throw e } }
const typeSend = (t) => p.evaluate((t) => { document.getElementById('kisha-text').value = t; document.getElementById('kisha-form').requestSubmit() }, t)
const checks = []; const ok = (name) => checks.push(name)
await until(() => document.querySelector('[data-kisha=start]'))
let s = await p.evaluate(() => ({ crumb: document.getElementById('page-crumb').textContent, h1: document.querySelector('main h1').textContent, oldUi: /Escribir mi día|Importar reflexión JSON|Pegar cierre de ChatGPT|Copiar esquema/.test(document.getElementById('main-content').textContent), legacyTab: document.querySelector('[data-tab=legacy]').textContent, startVisible: (() => { const r = document.querySelector('[data-kisha=start]').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 })() }))
assert.equal(s.crumb, 'Mascota Virtual'); assert.equal(s.h1, 'Kisha'); assert.equal(s.oldUi, false); assert.match(s.legacyTab, /\(1\)/); assert.ok(s.startVisible, 'start button visible without scrolling'); ok('page/rename/no-old-ui/start-visible')
// 1. Start: greeting is spoken; speaking only while audio plays.
await p.evaluate(() => document.querySelector('[data-kisha=start]').click())
await until(() => document.querySelector('#kisha-log .kisha-msg.kisha'))
await until(() => document.getElementById('kisha-char').dataset.pose === 'speaking')
await until(() => KishaView.stats().phase === 'idle' && document.getElementById('kisha-char').dataset.pose !== 'speaking')
s = await st(); assert.match(s.log[0], /Soy Kisha\. ¿Cómo estuvo tu día\? Estoy aquí para escucharte\./); assert.equal(calls.tts, 1); ok('greeting spoken; speaking only during playback')
// 2. Typed turn → contextual follow-up; the request carries only session messages.
await typeSend('Hoy terminé mi proyecto y fui al cine')
await until(() => document.querySelectorAll('#kisha-log .kisha-msg.kisha').length === 2)
s = await st(); assert.match(s.log.at(-1), /Hoy terminé mi proye/); assert.equal(calls.turnBodies[0].messages.at(-1).text, 'Hoy terminé mi proyecto y fui al cine'); assert.ok(!('owner_id' in calls.turnBodies[0])); ok('typed turn with contextual follow-up')
await until(() => KishaView.stats().phase === 'idle')
// 3. Interrupt playback by typing while Kisha speaks; sad message → supportive (never happy).
await typeSend('Pero luego me sentí triste')
await until(() => document.getElementById('kisha-char').dataset.pose === 'speaking')
await typeSend('Perdón, te interrumpo: fue por una discusión')
await until(() => document.querySelectorAll('#kisha-log .kisha-msg.user').length === 3 && KishaView.stats().phase === 'idle', null, 30000)
s = await st(); assert.notEqual(s.pose, 'happy'); ok('interrupt playback, no happy pose on sadness')
// 4. Voice turn: listening → transcribing → thinking → reply; mic released afterwards.
await p.click('[data-kisha=mic]')
await until(() => KishaView.stats().phase === 'listening')
await p.waitForTimeout(1200) // fake mic tone; VAD may or may not register it
assert.equal(await p.evaluate(() => document.getElementById('kisha-char').dataset.pose), 'listening')
await p.click('[data-kisha=mic]') // tap again = send
await until(() => document.querySelectorAll('#kisha-log .kisha-msg.user').length === 4, null, 30000)
await until(() => KishaView.stats().phase === 'idle', null, 30000)
s = await st(); assert.match(s.log.find((x) => x.startsWith('user:hoy terminé')), /proyecto de la escuela/); assert.equal(s.voice.recording, false); assert.ok(calls.stt >= 1); ok('voice turn via Groq mock; mic released')
// 5. iOS-style autoplay refusal → "Tocar para escuchar" replays without a 2nd TTS call.
await p.evaluate(() => { window.__realPlay = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { if (this.src.startsWith('blob:') && !this.__allow) return Promise.reject(new DOMException('blocked', 'NotAllowedError')); return window.__realPlay.call(this) } })
const ttsBefore = calls.tts
await typeSend('Me ayudó hablar con mi mamá')
await until(() => KishaView.stats().phase === 'blocked')
assert.equal(await p.isVisible('[data-kisha=replay]'), true); assert.equal(await p.evaluate(() => document.getElementById('kisha-char').dataset.pose === 'speaking'), false)
await p.evaluate(() => { HTMLMediaElement.prototype.play = window.__realPlay })
await p.click('[data-kisha=replay]')
await until(() => document.getElementById('kisha-char').dataset.pose === 'speaking')
await until(() => KishaView.stats().phase === 'idle')
assert.equal(calls.tts, ttsBefore + 1, 'replay reuses the generated clip'); ok('blocked autoplay + one-tap replay, no 2nd TTS charge')
// 6. Provider failures: TTS fail → text stays (browser voice or text), STT fail → message, OpenAI fail → retry button.
mode.tts = 'fail'; await typeSend('Otra cosa más'); await until(() => document.querySelectorAll('#kisha-log .kisha-msg.kisha').length >= 6 && KishaView.stats().phase === 'idle', null, 30000); mode.tts = 'ok'; ok('Fish Audio failure keeps text reply')
mode.stt = 'fail'; await p.click('[data-kisha=mic]'); await until(() => KishaView.stats().phase === 'listening'); await p.waitForTimeout(1200); await p.click('[data-kisha=mic]'); await until(() => /transcribir/.test(document.getElementById('kisha-log').textContent), null, 30000); mode.stt = 'ok'; await until(() => KishaView.stats().phase === 'idle'); ok('Groq failure shows message, text path remains')
mode.turn = 'fail'; const nUser = (await st()).log.filter((x) => x.startsWith('user')).length; await typeSend('Mensaje durante una falla'); await until(() => document.querySelector('[data-kisha=retry]'))
mode.turn = 'ok'; const turnsBefore = calls.turn; await p.click('[data-kisha=retry]'); await until(() => KishaView.stats().phase === 'idle' && document.querySelectorAll('#kisha-log .kisha-msg.kisha').length >= 7, null, 30000)
assert.equal(calls.turnBodies.at(-1).turn_id, calls.turnBodies.at(-2).turn_id, 'retry reuses the same turn id (server dedupes)'); assert.equal((await st()).log.filter((x) => x.startsWith('user')).length, nUser + 1); ok('OpenAI failure → retry with same turn id, no duplicate message')
// 7. Pause / resume.
await p.click('[data-kisha=pause]'); await until(() => KishaView.stats().phase === 'paused'); assert.equal(await p.evaluate(() => document.getElementById('kisha-send').disabled), true)
assert.equal(await p.evaluate(() => document.getElementById('kisha-char').dataset.pose), 'resting')
await p.click('[data-kisha=pause]'); await until(() => KishaView.stats().phase === 'idle'); ok('pause/resume (resting pose while paused)')
// 8. Navigate away → draft persisted → resume.
await p.evaluate(() => { location.hash = 'inicio' }); await p.waitForTimeout(500)
assert.equal(await p.evaluate(() => KishaView.stats().voice), null, 'audio resources released on leave')
await p.evaluate(() => { location.hash = 'mascota' }); await until(() => document.querySelector('[data-kisha=resume]'))
await p.click('[data-kisha=resume]'); await until(() => document.querySelectorAll('#kisha-log .kisha-msg.user').length >= 6); ok('draft recoverable after navigation; resources cleaned')
// 9. Conclude → REVIEW (no auto-write) → edit → save → duplicate prevention.
const before = await p.evaluate(() => Store.list('journal').length)
await p.click('[data-kisha=finish]'); await until(() => document.getElementById('kisha-review-form'))
assert.equal(await p.evaluate(() => Store.list('journal').length), before, 'conclude never writes')
s = await p.evaluate(() => ({ help: document.getElementById('kisha-emo-help').textContent, vals: [...document.querySelectorAll('[data-kisha-emo]')].map((x) => x.dataset.kishaEmo + '=' + x.value), overflow: document.documentElement.scrollWidth > innerWidth + 1 }))
assert.match(s.help, /no que estuviste feliz el 40% del día/); assert.deepEqual(s.vals, ['alegria=40', 'tristeza=55']); assert.equal(s.overflow, false)
await p.fill('#kisha-review-form input[name=title]', 'Proyecto y una tarde difícil'); await p.fill('[data-kisha-emo=alegria]', '65'); await p.check('#kisha-review-form [name=keep_transcript]')
await p.evaluate(() => { const f = document.getElementById('kisha-review-form'); f.requestSubmit(); f.requestSubmit() })
await until(() => /^#mascota\//.test(location.hash))
s = await p.evaluate(() => { const r = Store.list('journal').filter((x) => x.source === 'kisha'); return { n: r.length, title: r[0]?.title, emo: r[0]?.emotions.map((x) => x.key + ':' + x.intensity + ':' + x.basis), transcript: r[0]?.transcript?.length, valid: JournalData.validate(r[0]), confirmed: r[0]?.confirmed_by_user, draft: localStorage.getItem(KishaCore.draftKey('qa-user')) } })
assert.equal(s.n, 1); assert.equal(s.title, 'Proyecto y una tarde difícil'); assert.deepEqual(s.emo, ['alegria:65:reported', 'tristeza:55:inferred']); assert.ok(s.transcript > 5); assert.equal(s.valid, true); assert.equal(s.confirmed, true); assert.equal(s.draft, null); ok('review/edit/confirm; double submit saves once; draft cleared')
// 10. Detail: chart, transcript, edit title, delete.
s = await p.evaluate(() => ({ bars: document.querySelectorAll('#kisha-detail .kc-bar').length, tr: !!document.querySelector('.kisha-transcript') }))
assert.equal(s.bars, 2); assert.equal(s.tr, true)
await p.fill('#kisha-title-form input[name=title]', 'Título editado'); await p.evaluate(() => document.getElementById('kisha-title-form').requestSubmit()); await p.waitForTimeout(300)
assert.equal(await p.evaluate(() => Store.list('journal').find((x) => x.source === 'kisha').title), 'Título editado'); ok('detail chart, transcript, title edit')
// 11. History: grouped by day, search, legacy still readable, trends with entries behind.
await p.evaluate(() => { location.hash = 'mascota' }); await until(() => document.getElementById('kisha-q'))
s = await p.evaluate(() => ({ entries: document.querySelectorAll('#kisha-list .kisha-entry').length, day: document.querySelector('.kisha-day h3')?.textContent }))
assert.equal(s.entries, 1); assert.match(s.day, /20\d\d/)
await p.fill('#kisha-q', 'zzz'); assert.match(await p.textContent('#kisha-list'), /Ninguna conversación coincide/); await p.fill('#kisha-q', 'editado'); assert.equal(await p.locator('#kisha-list .kisha-entry').count(), 1)
await p.click('[data-tab=legacy]'); await until(() => /Mi día escrito a mano/.test(document.getElementById('kisha-history').textContent))
await p.click('a[href="#mascota/legacy-1"]'); await until(() => /Fui al parque con mi hermana/.test(document.getElementById('main-content').textContent)); ok('legacy record still readable')
await p.evaluate(() => { location.hash = 'mascota'; UI.kisha.tab = 'trends' }); await p.waitForTimeout(200); await p.evaluate(() => App.render())
assert.match(await p.textContent('#kisha-history'), /1 conversación\(es\) que confirmaste/); ok('trends from confirmed entries only')
// 12. Too-little session: no invented scores.
await p.evaluate(() => { UI.kisha.tab = 'history'; App.render() }); await p.evaluate(() => document.querySelector('[data-kisha=start]').click()); await until(() => KishaView.stats().phase === 'idle' && document.querySelector('#kisha-log .kisha-msg.kisha'))
await typeSend('Bien'); await until(() => document.querySelectorAll('#kisha-log .kisha-msg.kisha').length === 2); await until(() => KishaView.stats().phase === 'idle')
const anBefore = calls.analyze; await p.click('[data-kisha=finish]'); await until(() => document.getElementById('kisha-review-form'))
s = await p.evaluate(() => ({ nodata: /Sin datos suficientes/.test(document.getElementById('kisha-review').textContent), inputs: document.querySelectorAll('[data-kisha-emo]').length }))
assert.equal(calls.analyze, anBefore, 'no model call for one short message'); assert.equal(s.nodata, true); assert.equal(s.inputs, 0); ok('one-word session: Sin datos suficientes, no scores')
await p.click('[data-kisha=discard]'); await p.click('#confirm-action'); await p.waitForTimeout(300)
assert.equal(await p.evaluate(() => Store.list('journal').filter((x) => x.source === 'kisha' && !x.deleted_at).length), 1); ok('discard writes nothing')
// 13. Delete with confirmation.
const id = await p.evaluate(() => Store.list('journal').find((x) => x.source === 'kisha').id)
await p.evaluate((id) => { location.hash = 'mascota/' + id }, id); await until(() => document.querySelector('[data-kisha=delete]'))
await p.click('[data-kisha=delete]'); await p.click('#confirm-action'); await until(() => location.hash === '#mascota')
assert.equal(await p.evaluate(() => Store.list('journal').filter((x) => x.source === 'kisha' && !x.deleted_at).length), 0); assert.equal(await p.evaluate(() => Store.list('journal').some((x) => x.id === 'legacy-1' && !x.deleted_at)), true); ok('delete with confirmation; legacy untouched')
// 14. Account switch drops in-memory session; drafts are per-account keys.
await p.evaluate(() => document.querySelector('[data-kisha=start]').click()); await until(() => KishaView.stats().session); await typeSend('Algo privado de esta cuenta'); await until(() => KishaView.stats().phase === 'idle' && document.querySelectorAll('#kisha-log .kisha-msg.kisha').length === 2)
await p.evaluate(() => { KishaView.reset(); window.__u = { id: 'qa-other' }; location.hash = 'inicio' }); await p.waitForTimeout(300); await p.evaluate(() => { location.hash = 'mascota' }); await until(() => document.querySelector('[data-kisha=start]'))
s = await p.evaluate(() => ({ resume: !!document.querySelector('[data-kisha=resume]'), mine: !!localStorage.getItem(KishaCore.draftKey('qa-user')), other: localStorage.getItem(KishaCore.draftKey('qa-other')) }))
assert.equal(s.resume, false); assert.equal(s.mine, true); assert.equal(s.other, null); ok('other account does not see the previous account draft')
// Reduced motion / animation off.
await p.emulateMedia({ reducedMotion: 'reduce' }); await p.reload(); await p.waitForFunction(() => window.DALI_READY); await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); location.hash = 'mascota' }); await until(() => document.getElementById('kisha-char')?.dataset.still === 'true'); ok('reduced motion → still pose')
console.log(JSON.stringify({ width: W, checks: checks.length, calls: { ...calls, turnBodies: calls.turnBodies.length } }), errors.length ? errors : 'no errors')
assert.deepEqual(errors, []); console.log('KISHA E2E OK'); await b.close()
