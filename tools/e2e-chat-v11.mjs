// E2E v11 · Chat: images and actions (browser, /api/chat emulated like tools/e2e-chat.mjs).
// 1) attach an image (file picker) → thumbnail in the tray → send → the request carries the uploaded name →
//    the bubble shows the image (fetched through /api/chat/attachments) → tap opens the lightbox;
// 2) «hoy me gasté 250 en comida…» → the server asks for log_transaction (SSE «tools») → the app records it locally
//    (EvieAssistant.runTool) → /continue receives the output → receipt «Gasto registrado · $250 …» with Deshacer →
//    Deshacer removes the expense; 3) the chat page never scrolls as a whole. Usage: W=1440|412 node tools/e2e-chat-v11.mjs
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), H = W < 700 ? 891 : 900, THEME = process.env.THEME || 'dark'
const b = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: W < 700, hasTouch: W < 700 })
const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message))
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const db = { convs: [], msgs: {} }, seen = { uploads: 0, sentAttachments: null, continueOutputs: null, toolsFlag: null }; let n = 0
const now = () => new Date().toISOString(), uid = () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0')
const sse = (evs) => evs.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')
await p.route('**/api/chat/**', async (r) => {
  const u = new URL(r.request().url()), m = r.request().method(), path = u.pathname.replace('/api/chat/', ''), body = r.request().postData() ? JSON.parse(r.request().postData()) : {}
  const parts = path.split('/'), conv = (id) => db.convs.find((c) => c.id === id)
  if (path === 'conversations' && m === 'GET') return r.fulfill({ json: { conversations: db.convs } })
  if (path === 'conversations' && m === 'POST') { const c = { id: uid(), title: '', pinned: false, archived: false, private: false, tier: 'enfoque', message_count: 0, created_at: now(), updated_at: now() }; db.convs.push(c); db.msgs[c.id] = []; return r.fulfill({ status: 201, json: { conversation: c } }) }
  if (path === 'attachments' && m === 'POST') { seen.uploads++; const ok = typeof body.data === 'string' && body.data.length > 20 && /^image\/(webp|png|jpeg)$/.test(body.mime); return r.fulfill(ok ? { status: 201, json: { name: 'aaaaaaaa-1111-4222-8333-' + String(seen.uploads).padStart(12, '0') + '.' + (body.mime === 'image/png' ? 'png' : body.mime === 'image/jpeg' ? 'jpg' : 'webp'), mime: body.mime, size: 1234 } } : { status: 400, json: { error: 'Imagen inválida.' } }) }
  if (parts[0] === 'attachments' && m === 'GET') return r.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG })
  if (parts[0] === 'attachments' && m === 'DELETE') return r.fulfill({ json: { ok: true } })
  if (parts[2] === 'messages' && m === 'GET') { const c = conv(parts[1]); return r.fulfill({ json: { conversation: c, messages: db.msgs[c.id] } }) }
  if (parts[2] === 'messages' && m === 'POST') {
    const c = conv(parts[1]), list = db.msgs[c.id]; seen.toolsFlag = body.tools === true
    list.push({ id: uid(), seq: list.length + 1, role: 'user', text: body.text, images: body.attachments || [], meta: {} })
    const user = list.at(-1), meta = ['meta', { conversation: c.id, user_message: { id: user.id, seq: user.seq }, tier: { id: 'enfoque', label: 'Enfoque', effort: 'medium' }, title: c.title ? null : 'Prueba' }]
    if (!c.title) c.title = 'Prueba'
    if (body.attachments?.length) { seen.sentAttachments = body.attachments; const a = { id: uid(), seq: list.length + 1, role: 'assistant', text: 'Veo un punto rojo en la imagen.', meta: {} }; list.push(a); return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([meta, ['delta', { t: a.text }], ['done', { message: { id: a.id, seq: a.seq }, text: a.text, sources: [], model: 'gpt', stop_reason: 'end_turn', tier: { id: 'enfoque' }, memory_used: [] }]]) }) }
    if (/gast/i.test(body.text)) return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([meta, ['tools', { round: 1, continuation: 'sealed-continuation', calls: [{ call_id: 'call_1', name: 'log_transaction', arguments: JSON.stringify({ type: 'expense', amount: 250, title: 'Comida', account: null, category: 'Comida', date: null, soma_client_name: null }) }] }]]) })
    const a = { id: uid(), seq: list.length + 1, role: 'assistant', text: 'Listo.', meta: {} }; list.push(a)
    return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([meta, ['delta', { t: 'Listo.' }], ['done', { message: { id: a.id, seq: a.seq }, text: 'Listo.', sources: [], model: 'gpt', stop_reason: 'end_turn', tier: { id: 'enfoque' }, memory_used: [] }]]) })
  }
  if (parts[2] === 'continue' && m === 'POST') {
    const c = conv(parts[1]), list = db.msgs[c.id]; seen.continueOutputs = body.outputs; seen.continuation = body.continuation
    const out = body.outputs?.[0] || {}, a = { id: uid(), seq: list.length + 1, role: 'assistant', text: 'Listo, lo anoté en Finanzas.', meta: { actions: [{ id: out.call_id || 'call_1', name: 'log_transaction', status: 'created', summary: out.summary || 'Gasto registrado' }] } }; list.push(a)
    return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([['meta', { conversation: c.id, round: 1, tier: { id: 'enfoque', label: 'Enfoque' } }], ['delta', { t: a.text }], ['done', { message: { id: a.id, seq: a.seq }, text: a.text, sources: [], model: 'gpt', stop_reason: 'end_turn', tier: { id: 'enfoque' }, memory_used: [], actions: a.meta.actions }]]) })
  }
  if (path === 'stamp') return r.fulfill({ json: { stamp: 's' } })
  return r.fulfill({ json: {} })
})
await p.goto('http://localhost:3000/index.html?qa=chatv11' + W + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
await p.evaluate((theme) => { window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme }); const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: true, provider: 'openai', stt: true, tts: true }; EvieAccounts.current = () => ({ id: 'aaaaaaaa-0000-4000-8000-000000000001', username: 'tester' }); EvieAccounts.storageKey = () => k; EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j }); location.hash = 'chat' }, THEME)
const until = (fn, a, ms = 12000) => p.waitForFunction(fn, a, { timeout: ms })
const out = {}; const ok = (k, v) => { out[k] = !!v; if (!v) console.log('FAIL', k) }
await until(() => document.getElementById('ch-input')); await p.waitForTimeout(600)

// 1 · image
await p.setInputFiles('#ch-file', { name: 'foto.png', mimeType: 'image/png', buffer: PNG })
await until(() => document.querySelector('#ch-tray .ch-thumb'))
ok('trayThumb', true)
await until(() => !document.querySelector('#ch-tray .ch-thumb [class*="spin"], #ch-tray .ch-thumb.is-uploading'), null, 8000).catch(() => {})
ok('uploaded', seen.uploads === 1)
await p.fill('#ch-input', '¿Qué ves?'); await p.click('.ch-send')
await until(() => [...document.querySelectorAll('.ch-msg')].some((m) => /punto rojo/.test(m.textContent))).catch(async (e) => { console.log('STATE', JSON.stringify(await p.evaluate(() => ({ msgs: [...document.querySelectorAll('.ch-msg')].map((m) => m.className + ':' + m.textContent.slice(0, 60)), err: document.querySelector('.ch-error')?.textContent, send: document.querySelector('.ch-send')?.outerHTML.slice(0, 160), input: document.getElementById('ch-input')?.value, tray: document.getElementById('ch-tray')?.outerHTML.slice(0, 300), toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent) }))), seen.uploads); throw e })
ok('sentWithAttachment', Array.isArray(seen.sentAttachments) && seen.sentAttachments.length === 1 && /\.(webp|png|jpg)$/.test(seen.sentAttachments[0]))
ok('toolsFlag', seen.toolsFlag === true)
await until(() => document.querySelector('.ch-imgs .ch-img img, .ch-imgs img'), null, 8000).catch(() => {})
ok('bubbleImage', await p.evaluate(() => { const i = document.querySelector('.ch-imgs img'); return !!i && /^blob:/.test(i.src) }))
await p.evaluate(() => document.querySelector('.ch-imgs .ch-img, .ch-imgs [data-ch="zoom"]')?.click()); await p.waitForTimeout(500)
ok('lightbox', await p.evaluate(() => { const l = document.querySelector('.ch-lightbox'); return !!l && getComputedStyle(l).display !== 'none' }))
await p.keyboard.press('Escape'); await p.waitForTimeout(400)
await p.evaluate(() => document.querySelector('.ch-lightbox')?.remove())

// 2 · action → Finanzas with receipt and undo
const before = await p.evaluate(() => (Store.get().transactions || []).filter((t) => !t.deleted_at).length)
await p.fill('#ch-input', 'Hoy me gasté 250 en comida, ¿lo puedes poner en finanzas?'); await p.click('.ch-send')
await until(() => document.querySelector('.ch-receipts .ch-receipt'))
const rec = await p.evaluate(() => ({ text: document.querySelector('.ch-receipts .ch-receipt')?.textContent || '', bad: !!document.querySelector('.ch-receipt.is-bad'), tx: (Store.get().transactions || []).filter((t) => !t.deleted_at && t.amount === 25000 && /^ivi-/.test(t.op_id || '')).length }))
ok('receipt', /Gasto registrado/.test(rec.text) && /250/.test(rec.text) && !rec.bad)
ok('expenseSaved', rec.tx === 1)
ok('continueGotOutput', Array.isArray(seen.continueOutputs) && seen.continueOutputs[0]?.call_id === 'call_1' && /created/.test(String(seen.continueOutputs[0]?.output)) && seen.continuation === 'sealed-continuation')
await until(() => [...document.querySelectorAll('.ch-msg')].some((m) => /lo anoté/.test(m.textContent)))
ok('finalAnswer', true)
const undo = await p.$('.ch-receipt-undo'); ok('undoButton', !!undo)
if (undo) { await undo.click(); await p.waitForTimeout(600); ok('undoRemoves', await p.evaluate((n) => (Store.get().transactions || []).filter((t) => !t.deleted_at).length === n, before)) }

// 3 · fixed page
ok('noPageScroll', await p.evaluate(() => { window.scrollTo(0, 500); return document.scrollingElement.scrollTop === 0 && getComputedStyle(document.documentElement).overflowY === 'hidden' }))
ok('composerVisible', await p.evaluate(() => { const r = document.getElementById('ch-input').getBoundingClientRect(); return r.bottom <= innerHeight && r.top > 0 }))
ok('noOverflow', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
ok('noPageErrors', !errors.length)
const fails = Object.entries(out).filter(([, v]) => !v)
console.log(JSON.stringify(out)); if (errors.length) console.log('ERRORS', errors.slice(0, 5).join('\n'))
console.log(fails.length ? `${fails.length} FALLAS E2E CHAT v11 (${W})` : `${Object.keys(out).length}/${Object.keys(out).length} E2E CHAT v11 OK (${W}, ${THEME})`)
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT })
await b.close(); process.exit(fails.length ? 1 : 0)
