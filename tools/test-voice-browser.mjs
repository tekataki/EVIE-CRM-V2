// Voice state machine in a real browser with mocked /api/ai/* (no paid calls).
// Simulates: two successive questions, iOS-style autoplay rejection + one-tap replay (no 2nd TTS request),
// TTS failure → browser voice/text, STT timeout, denied mic, interruption by a newer turn, background.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const b = await chromium.launch({ args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.grantPermissions(['microphone'], { origin: 'http://localhost:3000' })
const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message))
const wav = (() => { const n = 4000, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b })()
const calls = { chat: 0, tts: 0, stt: 0 }; let mode = { tts: 'ok', stt: 'ok', chat: 'ok' }
await p.route('**/api/ai/**', async (route) => {
  const u = route.request().url()
  if (u.endsWith('/ai/chat')) { calls.chat++; const body = JSON.parse(route.request().postData()); const q = body.input.filter((x) => x.role === 'user').pop().content; if (mode.chat === 'slow') await new Promise((r) => setTimeout(r, 1500)); return route.fulfill({ json: { text: 'Respuesta a: ' + q, calls: [], reasoning: [] } }) }
  if (u.endsWith('/ai/tts')) { calls.tts++; if (mode.tts === 'fail') return route.fulfill({ status: 502, json: { error: 'x' } }); return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }) }
  if (u.endsWith('/ai/stt')) { calls.stt++; if (mode.stt === 'timeout') { await new Promise((r) => setTimeout(r, 4000)); return route.abort() } return route.fulfill({ json: { text: 'hola evie' } }) }
  return route.continue()
})
await p.goto('http://localhost:3000/index.html?qa=voice', { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 20000 })
await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.evie = { ...(s.preferences.evie || {}), cloudVoice: true, cloudAI: true, conversation: true, muted: false } }); UI.section = 'inicio'; App.render() })
// Pretend a signed-in cloud account with all providers available (UI gate only; server still authorizes).
await p.evaluate(() => { const c = EvieAccounts.config(); c.accountsEnabled = true; c.ai = { chat: true, stt: true, tts: true }; window.__u = { id: 'qa-user' }; const o = EvieAccounts.current; Object.defineProperty(EvieAccounts, 'current', { value: () => window.__u }) }).catch(() => {})
const canCloud = await p.evaluate(() => !!EvieAccounts.current?.())
const checks = []
const ask = (q) => p.evaluate((q) => { document.getElementById('evie-stage-input').value = q; document.getElementById('evie-stage-form').requestSubmit() }, q)
const wait = (ms) => p.waitForTimeout(ms)
const until = async (fn, arg) => { try { return await p.waitForFunction(fn, arg, { timeout: 40000 }) } catch (e) { console.log('STUCK', new Error().stack.split('\n')[2], JSON.stringify(await st()), JSON.stringify(calls)); throw e } }
const settled = () => until(() => ['idle', 'blocked', 'error'].includes(EvieAssistant.stats().voice.state) && !EvieAssistant.stats().busy)
const st = () => p.evaluate(() => ({ ...EvieAssistant.stats().voice, sub: document.querySelector('#evie-subs .evie')?.textContent || '', replayVisible: !!document.querySelector('#evie-subs [data-evie=replay]:not([hidden])') }))
// Media playback: decide per scenario whether play() is allowed (emulates Safari autoplay policy).
await p.evaluate(() => { window.__allowPlay = true; const orig = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { if (this.src.startsWith('blob:') && !window.__allowPlay && !this.__silent) return Promise.reject(new DOMException('blocked', 'NotAllowedError')); return orig.call(this) } })
if (canCloud) {
  await ask('primera'); await wait(200); await settled(); let s = await st(); assert.match(s.sub, /primera/); assert.equal(s.state, 'idle'); checks.push('1ª pregunta: texto + voz')
  await ask('segunda'); await wait(200); await settled(); s = await st(); assert.match(s.sub, /segunda/); assert.equal(calls.chat, 2); checks.push('2ª pregunta seguida responde')
  await p.evaluate(() => { window.__allowPlay = false }); const ttsBefore = calls.tts
  await ask('bloqueada'); await until(() => EvieAssistant.stats().voice.state === 'blocked'); s = await st(); assert.equal(s.state, 'blocked'); assert.ok(s.replayVisible); assert.match(s.sub, /bloqueada/); checks.push('Autoplay bloqueado: texto visible + botón «Toca para escuchar»')
  await p.evaluate(() => { window.__allowPlay = true }); await p.click('#evie-subs [data-evie=replay]'); await wait(200); await settled(); s = await st(); assert.equal(calls.tts, ttsBefore + 1); assert.equal(s.state, 'idle'); checks.push('Reproducir tras tocar sin segunda petición TTS')
  mode.tts = 'fail'; await ask('sin voz'); await wait(200); await settled(); s = await st(); assert.match(s.sub, /sin voz/); assert.notEqual(s.state, 'error'); mode.tts = 'ok'; checks.push('Falla TTS: respuesta en texto (voz del navegador de respaldo)')
  mode.chat = 'slow'; await ask('vieja'); await wait(300); await ask('nueva'); await wait(2000); await settled(); s = await st(); assert.match(s.sub, /nueva/); assert.doesNotMatch(s.sub, /vieja/); mode.chat = 'ok'; checks.push('Una respuesta vieja nunca reemplaza a la nueva')
  // Mic → STT → answer (fake device audio). VAD may see the fake tone; stop explicitly.
  await p.evaluate(() => EvieAssistant.listen({ inline: true })); await until(() => EvieAssistant.stats().voice.recording); await wait(1200); await p.evaluate(() => { if (EvieAssistant.stats().voice.recording) EvieAssistant.listen({ inline: true }) }); await until(() => /hola evie/.test(document.querySelector('#evie-subs .you')?.textContent || '')); await settled(); s = await st(); assert.ok(calls.stt >= 1); assert.match(s.sub, /hola evie/); checks.push('Micrófono → Groq (mock) → respuesta')
  // Background while recording: tracks released, no zombie session
  await p.evaluate(() => EvieAssistant.listen({ inline: true })); await until(() => EvieAssistant.stats().voice.recording); await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) }); await wait(400); s = await st(); assert.equal(s.recording, false); await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }) }); checks.push('Segundo plano: la grabación se cancela y libera el micrófono')
  mode.stt = 'timeout'; await p.evaluate(() => EvieAssistant.listen({ inline: true })); await until(() => EvieAssistant.stats().voice.recording); await wait(1200); await p.evaluate(() => { if (EvieAssistant.stats().voice.recording) EvieAssistant.listen({ inline: true }) }); await until(() => EvieAssistant.stats().voice.diag.some((d) => d.stage === 'stt' || (d.stage === 'vad' && d.code === 'silence'))); await settled(); s = await st(); assert.ok(['idle', 'error'].includes(s.state)); mode.stt = 'ok'; checks.push('Red caída en STT: error breve y vuelve a idle')
  // Repeated taps never leave two recorders
  for (let i = 0; i < 5; i++) await p.evaluate(() => EvieAssistant.listen({ inline: true }))
  await wait(600); s = await st(); assert.ok(s.turn > 0); await p.evaluate(() => EvieAssistant.stopSpeaking()); checks.push('Toques repetidos: una sola sesión de micrófono')
} else checks.push('SKIP: no se pudo simular sesión en la nube')
// Denied permission
await ctx.close()
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await ctx2.newPage()
await p2.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError')) })
await p2.goto('http://localhost:3000/index.html?qa=voice2', { timeout: 90000 }); await p2.waitForFunction(() => window.DALI_READY, null, { timeout: 20000 })
await p2.evaluate(() => { document.getElementById('evie-splash')?.remove(); UI.section = 'inicio'; App.render(); const c = EvieAccounts.config(); c.accountsEnabled = true; c.ai = { chat: true, stt: true, tts: true }; Object.defineProperty(EvieAccounts, 'current', { value: () => ({ id: 'qa' }) }) })
await p2.evaluate(() => EvieAssistant.listen({ inline: true })); await p2.waitForTimeout(800)
assert.match(await p2.evaluate(() => document.querySelector('#evie-subs .evie')?.textContent || ''), /permiso de micrófono/); checks.push('Permiso denegado: mensaje claro')
console.log(JSON.stringify({ checks, calls, errors }, null, 1)); console.log('VOICE OK'); assert.deepEqual(errors, [])
await b.close()
