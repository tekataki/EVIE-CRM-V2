// E2E v10 Chat con Ivi (browser): new chat from the hero, streamed reply rendered as Markdown (code block + copy),
// auto title in the sidebar, regenerate, edit last message, stop while thinking, rename / pin / archive / delete,
// private chat flag, tier selector, mobile drawer, «Lo que Ivi sabe de ti» (add / edit / forget / restore),
// cross-device refresh hook, Inicio «sistemas» bar + modes dialog, and no horizontal overflow.
// /api/chat is emulated here (the Worker + Supabase side is covered by tests/chat.test.cjs).
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), THEME = process.env.THEME || 'dark', SHOT = process.env.SHOT || ''
const b = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
const db = { convs: [], msgs: {}, mems: [] }; let n = 0, slow = false, answers = 0
const now = () => new Date().toISOString(), uid = () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0')
const sse = (evs) => evs.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')
await p.route('**/api/chat/**', async (r) => {
  const u = new URL(r.request().url()), m = r.request().method(), path = u.pathname.replace('/api/chat/', ''), body = r.request().postData() ? JSON.parse(r.request().postData()) : {}
  const parts = path.split('/'), conv = (id) => db.convs.find((c) => c.id === id)
  if (path === 'conversations' && m === 'GET') { const arch = u.searchParams.get('archived') === '1', q = (u.searchParams.get('q') || '').toLowerCase(); return r.fulfill({ json: { conversations: db.convs.filter((c) => c.archived === arch && (!q || c.title.toLowerCase().includes(q))).sort((a, b) => (b.pinned - a.pinned) || b.updated_at.localeCompare(a.updated_at)) } }) }
  if (path === 'conversations' && m === 'POST') { const c = { id: uid(), title: '', pinned: false, archived: false, private: !!body.private, tier: body.tier || 'enfoque', message_count: 0, created_at: now(), updated_at: now() }; db.convs.push(c); db.msgs[c.id] = []; return r.fulfill({ status: 201, json: { conversation: c } }) }
  if (parts[0] === 'conversations' && parts.length === 2 && m === 'PATCH') { const c = conv(parts[1]); Object.assign(c, body, { updated_at: now() }); return r.fulfill({ json: { conversation: c } }) }
  if (parts[0] === 'conversations' && parts.length === 2 && m === 'DELETE') { db.convs = db.convs.filter((c) => c.id !== parts[1]); return r.fulfill({ json: { deleted: 1 } }) }
  if (parts[2] === 'messages' && m === 'GET') { const c = conv(parts[1]); return c ? r.fulfill({ json: { conversation: c, messages: db.msgs[c.id] } }) : r.fulfill({ status: 404, json: { error: 'No encontré esa conversación.' } }) }
  if (parts[2] === 'messages' && m === 'POST') {
    const c = conv(parts[1]), list = db.msgs[c.id]
    if (slow) { await new Promise((ok) => setTimeout(ok, 2500)); try { return await r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([['meta', { user_message: { id: 'x', seq: 1 } }]]) }) } catch { return } }
    if (body.regenerate) { if (list.at(-1)?.role === 'assistant') list.pop() } else if (body.edit) { const i = list.map((x) => x.role).lastIndexOf('user'); list.splice(i) }
    if (!body.regenerate) list.push({ id: uid(), seq: list.length + 1, role: 'user', text: body.text, meta: {} })
    const q = list.filter((x) => x.role === 'user').at(-1).text, k = ++answers
    const answer = `## Plan ${k}\nRespuesta a: **${q.slice(0, 40)}**\n\n- Paso uno\n- Paso dos\n\n\`\`\`js\nconst meta = ${k} * 1000\n\`\`\``
    const a = { id: uid(), seq: list.length + 1, role: 'assistant', text: answer, sources: [], meta: { model: 'claude-opus-5-5', tier: body.tier || c.tier } }; list.push(a)
    const title = !c.title ? q.replace(/[¿?]/g, '').slice(0, 40) : null; if (title) c.title = title; c.message_count = list.length; c.updated_at = now(); c.tier = body.tier || c.tier
    const deltas = answer.match(/.{1,12}/gs).map((t) => ['delta', { t }])
    return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([['meta', { conversation: c.id, user_message: { id: list.at(-2).id, seq: list.at(-2).seq }, tier: { id: c.tier, label: c.tier, effort: 'medium' }, title }], ...deltas, ['done', { message: { id: a.id, seq: a.seq }, text: answer, sources: [], model: 'claude-opus-5-5', stop_reason: 'end_turn', title, tier: { id: c.tier }, memory_used: [{ id: 'm1', kind: 'goal', text: 'Meta de prueba' }] }]]) })
  }
  if (path === 'memories' && m === 'GET') return r.fulfill({ json: { memories: db.mems.filter((x) => !x.deleted_at), forgotten: u.searchParams.get('forgotten') === '1' ? db.mems.filter((x) => x.deleted_at) : undefined, profile: db.mems.length ? '- Quiere ahorrar para una meta grande\n- Prefiere audio' : null } })
  if (path === 'memories' && m === 'POST') { const x = { id: uid(), kind: body.kind, text: body.text, importance: body.importance, confidence: 1, updated_at: now(), created_at: now() }; db.mems.unshift(x); return r.fulfill({ status: 201, json: { memory: x } }) }
  if (parts[0] === 'memories' && parts.length === 2 && m === 'PATCH') { const x = db.mems.find((y) => y.id === parts[1]); Object.assign(x, body, { updated_at: now() }); return r.fulfill({ json: { memory: x } }) }
  if (parts[0] === 'memories' && parts.length === 2 && m === 'DELETE') { db.mems.find((y) => y.id === parts[1]).deleted_at = now(); return r.fulfill({ json: { forgotten: true } }) }
  if (parts[2] === 'restore') { delete db.mems.find((y) => y.id === parts[1]).deleted_at; return r.fulfill({ json: { restored: true } }) }
  if (parts[2] === 'history') return r.fulfill({ json: { history: [{ op: 'edit', at: now(), detail: { before: 'antes', after: 'después' } }] } })
  return r.fulfill({ status: 404, json: { error: 'no' } })
})
await p.goto('http://localhost:3000/index.html?qa=chat' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
await p.evaluate((theme) => { window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme; s.profile.preferred = 'Sam' }); const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: true, provider: 'claude', stt: true, tts: true }; EvieAccounts.current = () => ({ id: 'aaaaaaaa-0000-4000-8000-000000000001', username: 'dali' }); EvieAccounts.storageKey = () => k; EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j }); App.render() }, THEME)
const until = async (fn, a, ms = 12000) => { try { return await p.waitForFunction(fn, a, { timeout: ms }) } catch (e) { console.log('STUCK', JSON.stringify(await p.evaluate(() => ({ hash: location.hash, msgs: [...document.querySelectorAll('.ch-msg')].map((m) => m.className + ':' + m.textContent.slice(0, 50)), dialog: !!document.querySelector('#app-dialog[open]'), err: document.querySelector('.ch-error')?.textContent, st: window.EvieChat ? JSON.stringify(EvieChat.state().msgs.map((m) => m.role + ':' + m.id)) : '' })))); throw e } }
const out = {}
await p.evaluate(() => { location.hash = 'chat' }); await until(() => document.querySelector('.ch-hero'))
out.hero = await p.evaluate(() => /Hola, Sam/.test(document.querySelector('.ch-hero h2').textContent) && document.querySelectorAll('.ch-sug').length === 4)
out.navItem = await p.evaluate(() => [...document.querySelectorAll('#main-nav a')].some((a) => a.hash === '#chat'))
await p.click('.ch-sug'); out.suggestFills = await p.evaluate(() => document.getElementById('ch-input').value.length > 10)
await p.fill('#ch-input', '¿Cómo armo mi plan de ahorro mensual?'); await p.click('.ch-send')
await until(() => document.querySelectorAll('.ch-msg.is-ivi .md-code').length === 1 && !document.getElementById('ch-live'))
out.first = await p.evaluate(() => ({ user: document.querySelector('.ch-msg.is-user .ch-bubble').textContent, h: document.querySelector('.ch-msg.is-ivi .ch-md h3')?.textContent, li: document.querySelectorAll('.ch-msg.is-ivi .ch-md li').length, hash: location.hash, title: document.querySelector('.ch-title h2').textContent.trim(), side: document.querySelector('.ch-item .ch-item-t')?.textContent, memused: !!document.querySelector('.ch-memused') }))
await p.evaluate(() => { document.querySelector('.ch-item-act button[data-ch="pin"]').click() }); await until(() => document.querySelector('.ch-group h2')?.textContent === 'Fijadas')
out.pinned = true
await p.click('[data-ch="regenerate"]'); await until(() => /Plan 2/.test(document.querySelector('.ch-msg.is-ivi:last-of-type .ch-md h3')?.textContent || '') && document.querySelectorAll('.ch-msg.is-ivi').length === 1)
out.regenerated = true
await p.click('[data-ch="edit"]'); await until(() => document.getElementById('ch-edit')); await p.fill('#ch-edit textarea', 'Mejor ayúdame con un plan semanal'); await p.click('#ch-edit .button.primary')
await until(() => /plan semanal/.test([...document.querySelectorAll('.ch-msg.is-user .ch-bubble')].at(-1)?.textContent || '') && document.querySelectorAll('.ch-msg').length === 2 && !document.getElementById('ch-live'))
out.edited = await p.evaluate(() => document.querySelectorAll('.ch-msg.is-user').length === 1)
await p.click('[data-ch="tier"][data-v="profundo"]'); await until(() => document.querySelector('[data-ch="tier"][data-v="profundo"]').getAttribute('aria-pressed') === 'true')
out.tier = await p.evaluate(() => EvieChat.state().conv.tier === 'profundo' || EvieChat.state().tier === 'profundo')
// Stop while Ivi is still thinking.
slow = true; await p.fill('#ch-input', 'Pregunta lenta'); await p.click('.ch-send'); await until(() => document.querySelector('#ch-live .ch-thinking'))
await p.click('.ch-send.is-stop'); await until(() => !document.getElementById('ch-live')); slow = false
out.stopped = await p.evaluate(() => !!document.querySelector('.ch-send:not(.is-stop)') && !document.querySelector('.ch-error'))
// Rename, new chat, archive, search, delete.
await p.evaluate(() => document.querySelector('.ch-head [data-ch="rename"]').click()); await until(() => document.getElementById('ch-rename')); await p.fill('#ch-rename input', 'Plan de ahorro'); await p.click('#ch-rename .button.primary')
await until(() => document.querySelector('.ch-title h2').textContent.trim() === 'Plan de ahorro'); out.renamed = true
await p.evaluate(() => document.querySelector('[data-ch="new"]').click()); await until(() => document.querySelector('.ch-hero') && location.hash === '#chat')
await p.click('[data-ch="private"]'); out.privateFlag = await p.evaluate(() => document.querySelector('[data-ch="private"]').getAttribute('aria-pressed') === 'true')
await p.fill('#ch-input', 'Segunda conversación privada'); await p.click('.ch-send'); await until(() => document.querySelectorAll('.ch-item').length === 2 && !document.getElementById('ch-live'))
out.privateSaved = await p.evaluate(() => !!document.querySelector('.ch-item .ch-lock'))
await p.fill('#ch-q', 'ahorro'); await until(() => document.querySelectorAll('.ch-item').length === 1); out.search = true; await p.fill('#ch-q', ''); await until(() => document.querySelectorAll('.ch-item').length === 2)
await p.evaluate(() => [...document.querySelectorAll('.ch-item')].find((li) => /Segunda/.test(li.textContent)).querySelector('[data-ch="archive"]').click()); await until(() => document.querySelectorAll('.ch-item').length === 1)
if (W < 1024) { await p.click('.ch-menu'); await p.waitForTimeout(600) }
await p.click('[data-ch="archived"][data-v="true"]'); await until(() => document.querySelectorAll('.ch-item').length === 1 && /Segunda/.test(document.querySelector('.ch-item').textContent)); out.archived = true
await p.evaluate(() => document.querySelector('.ch-item [data-ch="delete"]').click()); await until(() => document.querySelector('#app-dialog[open]')); await p.evaluate(() => [...document.querySelectorAll('#app-dialog button')].find((x) => /Borrar/.test(x.textContent)).click())
await until(() => !document.querySelector('.ch-item')); out.deleted = await p.evaluate(() => /No tienes conversaciones archivadas/.test(document.getElementById('ch-list').textContent)); await p.click('[data-ch="archived"][data-v="false"]')
if (W < 1024) { out.drawer = await p.evaluate(() => document.querySelector('[data-ch-root]').dataset.drawer === 'true' && document.querySelector('.ch-side').getBoundingClientRect().left >= 0); await p.mouse.click(W - 20, 400); await until(() => document.querySelector('[data-ch-root]').dataset.drawer === 'false') } else out.drawer = true
out.overflowChat = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
if (SHOT) { await p.evaluate(() => { const id = EvieChat.state().list[0]?.id; if (id) location.hash = 'chat/' + id }); await p.waitForTimeout(900); await p.screenshot({ path: SHOT + '-chat.png' }) }
// «Lo que Ivi sabe de ti»
await p.evaluate(() => { location.hash = 'chat/memoria' }); await until(() => document.getElementById('chm-body') && /Aún se está formando/.test(document.getElementById('chm-body').textContent))
await p.click('[data-chm="add"]'); await until(() => document.getElementById('chm-form')); await p.fill('#chm-form textarea', 'Quiere ahorrar para una meta grande en 2027.'); await p.selectOption('#chm-form [name=kind]', 'goal'); await p.selectOption('#chm-form [name=importance]', '5'); await p.click('#chm-form .button.primary')
await until(() => document.querySelectorAll('.chm-card').length === 1 && /Lo más importante ahora/.test(document.getElementById('chm-body').textContent))
out.memAdd = await p.evaluate(() => document.querySelector('.chm-card .chm-kind').textContent === 'Meta' && document.querySelectorAll('.chm-card .chm-imp i:not(.off)').length === 5)
await p.click('[data-chm="edit"]'); await until(() => document.getElementById('chm-form')); await p.fill('#chm-form textarea', 'Quiere ahorrar para su meta grande en noviembre de 2027.'); await p.click('#chm-form .button.primary'); await until(() => /noviembre/.test(document.querySelector('.chm-card p')?.textContent || ''))
out.memEdit = true
if (SHOT) { await p.waitForTimeout(500); await p.screenshot({ path: SHOT + '-memoria.png' }) }
await p.click('[data-chm="forget"]'); await until(() => !document.querySelector('.chm-card')); await p.click('[data-chm="forgotten"]'); await until(() => document.querySelector('[data-chm="restore"]')); await p.click('[data-chm="restore"]'); await until(() => document.querySelectorAll('.chm-card').length === 1)
out.memForgetRestore = true
out.overflowMem = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
// Inicio: sistemas + modes
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('ivi-systems'))
out.systems = await p.evaluate(() => document.querySelectorAll('#ivi-systems .ivi-sys').length === 5 && /Sistemas en línea/.test(document.getElementById('ivi-systems').textContent) && document.querySelectorAll('#ivi-systems .ivi-chip').length === 3)
if (await p.evaluate(() => getComputedStyle(document.getElementById('ivi-rail-r')).display === 'none' || getComputedStyle(document.getElementById('ivi-rail-r')).visibility === 'hidden')) { await p.click('[data-hud-quick]'); await p.waitForTimeout(400) } /* v11: on phones (or with cards on the right) Ivi's actions live in the ✦ Atajos sheet */ await p.click('[data-ivi="modes"]'); await until(() => document.querySelector('[data-ivi="set-mode"][data-mode="ventas"]')); await p.click('[data-ivi="set-mode"][data-mode="ventas"]')
await until(() => EvieModes.current() === 'ventas'); out.modeRoute = await p.evaluate(() => location.hash === '#soma'); await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('ivi-systems')?.dataset.mode === 'ventas')
out.modeOrder = await p.evaluate(() => document.querySelector('#ivi-systems .ivi-sys.is-lead small').textContent === 'Seguimientos' && IviCore.personaMode() === 'ventas')
if (SHOT) { await p.waitForTimeout(700); await p.screenshot({ path: SHOT + '-inicio.png' }) }
await p.evaluate(() => EvieModes.set('normal'))
console.log(JSON.stringify(out), errors.length ? errors : 'no errors')
const checks = { hero: out.hero, nav: out.navItem, suggest: out.suggestFills, stream: out.first.user.includes('plan de ahorro') && out.first.h === 'Plan 1' && out.first.li === 2 && /^#chat\/0{8}/.test(out.first.hash) && out.first.memused, title: /Cómo armo mi plan de ahorro/.test(out.first.title) && /Cómo armo/.test(out.first.side || ''), pin: out.pinned, regenerate: out.regenerated, edit: out.edited, tier: out.tier, stop: out.stopped, rename: out.renamed, private: out.privateFlag && out.privateSaved, search: out.search, archive: out.archived, del: out.deleted, drawer: out.drawer, memAdd: out.memAdd, memEdit: out.memEdit, memForget: out.memForgetRestore, systems: out.systems, modes: out.modeRoute && out.modeOrder, overflow: !out.overflowChat && !out.overflowMem, errors: !errors.length }
const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
console.log(Object.keys(checks).length - bad.length + '/' + Object.keys(checks).length, bad.length ? 'FAIL ' + bad.join(',') : 'E2E CHAT OK'); await b.close(); process.exitCode = bad.length ? 1 : 0
