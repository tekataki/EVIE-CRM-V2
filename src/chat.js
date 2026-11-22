// EVIE v10 · Chat with Ivi (ChatGPT/Claude-style) + long-term memory API. Mounted at /api/chat.
// Storage: Supabase (ai_conversations / ai_messages / ai_memories …) through the Worker with the user's own token;
// titles, messages and memories are sealed (AES-GCM) before they leave the Worker.
// POST /conversations/:id/messages streams Server-Sent Events (Accept: text/event-stream) or returns JSON:
//   event meta  {conversation, user_message:{id,seq}, tier, web}
//   event delta {t}                               (text deltas as Claude writes)
//   event done  {message:{id,seq}, text, sources, model, stop_reason, title, memory_used}
//   event error {error, code}
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { readProfile } from './profile.js'
import { limits, usage, budget, validTimeZone, wantsWeb, currentTime, profileBlock, readTier, SERVER_TOOLS } from './assistant.js'
import { isTier, tierConfig, TIER_LABELS } from './tiers.js'
import { aiProvider, claudeClient, claudeRun, claudeError, claudeCost, claudeTools, webSearchTool, textOf, sourcesOf, toolUses, stopNote, searchesOf } from './claude.js'
import { iviSystem, iviUserBlock, iviDayContext, iviTurnNote, personaDials, cleanMode } from './persona.js'
import { supa, memoryStore, relevantMemories, memoryBlock, learnFromExchange, memorySettings, MEMORY_KINDS, MEMORY_LIMITS } from './ai-memory.js'
import { openaiStream, openaiError } from './openai.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const CHAT_LIMITS = { text: 16000, title: 120, history: 40, historyChars: 80000, conversations: 300, messages: 400 }
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, n)
const day = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Mexico_City' }).format(new Date())
/** First sentence of the first message → a short title (no extra model call). */
export function autoTitle(text) {
  const t = clip(text, 400).replace(/\s+/g, ' ').replace(/^(?:oye |hey |hola |ok )?(?:ivi|ivy|evie)[,\s]*/i, '').trim()
  const first = (t.split(/(?<=[.?!])\s/)[0] || t).replace(/[¿?¡!.]+$/g, '').replace(/^[¿¡]+/, '').trim()
  const s = first.length > 60 ? first.slice(0, 57).replace(/\s+\S*$/, '') + '…' : first
  return s ? s[0].toUpperCase() + s.slice(1) : 'Nueva conversación'
}
/** Stored messages (oldest first) → Claude messages: text only, bounded, starting with a user turn. */
export function historyMessages(rows, { max = CHAT_LIMITS.history, maxChars = CHAT_LIMITS.historyChars } = {}) {
  let out = rows.slice(-max).map((m) => ({ role: m.role, content: m.text })).filter((m) => m.content && m.content.trim())
  let total = out.reduce((n, m) => n + m.content.length, 0)
  while (out.length > 1 && total > maxChars) total -= out.shift().content.length
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

export function createChat({ fetcher = fetch, authenticate, seal, unseal, remote }) {
  const api = new Hono()
  const err = (c, message, status = 400, code) => c.json({ error: message, ...(code ? { code } : {}) }, status)
  async function ctx(c) {
    const s = await authenticate(c); if (!s) return [null, err(c, 'Inicia sesión.', 401)]
    const env = c.env || {}; if (!env.EVIE_SESSION_KEY) return [null, err(c, 'Configuración de sesión incompleta.', 503)]
    const db = supa(remote, c, s), secret = env.EVIE_SESSION_KEY
    return [{ s, env, db, secret, store: memoryStore({ db, seal, unseal, secret, owner: s.user.id }) }, null]
  }
  const fail = (c, e) => { console.error('CHAT_STORE', e?.status || '', String(e?.message || e).slice(0, 80)); return err(c, e?.status === 401 ? 'La sesión cambió. Inicia sesión de nuevo.' : 'No se pudo usar el chat ahora. Tus mensajes no se perdieron.', e?.status === 401 ? 401 : 502) }
  const openTitle = async (x, r) => { if (!r.title_sealed) return ''; try { return clip((await unseal(r.title_sealed, x.secret))?.t, CHAT_LIMITS.title) } catch { return '' } }
  const conv = async (x, r) => ({ id: r.id, title: await openTitle(x, r), pinned: r.pinned, archived: r.archived, private: r.private, tier: r.tier, message_count: r.message_count, created_at: r.created_at, updated_at: r.updated_at })
  async function body(c) { try { const b = await c.req.json(); return b && typeof b === 'object' && !Array.isArray(b) ? b : {} } catch { return null } }

  // ---------- conversations ----------
  api.get('/conversations', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const archived = c.req.query('archived') === '1', q = clip(c.req.query('q') || '', 80).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    try {
      const rows = await x.db.get('ai_conversations', `select=*&archived=eq.${archived}&order=pinned.desc,updated_at.desc&limit=${CHAT_LIMITS.conversations}`)
      let list = await Promise.all((rows || []).map((r) => conv(x, r)))
      if (q) list = list.filter((v) => v.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
      return c.json({ conversations: list })
    } catch (ex) { return fail(c, ex) }
  })
  api.post('/conversations', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const b = await body(c); if (!b) return err(c, 'JSON inválido.')
    const title = clip(b.title || '', CHAT_LIMITS.title).trim()
    try {
      const [row] = await x.db.insert('ai_conversations', [{ title_sealed: title ? await seal({ t: title }, x.secret) : '', private: b.private === true, tier: isTier(b.tier) ? b.tier : await readTier(x.env, x.s.user.id) }])
      return c.json({ conversation: await conv(x, row) }, 201)
    } catch (ex) { return fail(c, ex) }
  })
  api.patch('/conversations/:id', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const id = c.req.param('id'); if (!UUID.test(id)) return err(c, 'Conversación inválida.')
    const b = await body(c); if (!b) return err(c, 'JSON inválido.')
    const patch = { updated_at: new Date().toISOString() }
    if (typeof b.title === 'string') { const t = clip(b.title, CHAT_LIMITS.title).trim(); patch.title_sealed = t ? await seal({ t }, x.secret) : '' }
    for (const k of ['pinned', 'archived', 'private']) if (typeof b[k] === 'boolean') patch[k] = b[k]
    if (isTier(b.tier)) patch.tier = b.tier
    if (Object.keys(patch).length === 1) return err(c, 'Nada que cambiar.')
    try { const [row] = await x.db.patch('ai_conversations', 'id=eq.' + id, patch); if (!row) return err(c, 'No encontré esa conversación.', 404); return c.json({ conversation: await conv(x, row) }) } catch (ex) { return fail(c, ex) }
  })
  api.delete('/conversations/:id', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const id = c.req.param('id'); if (!UUID.test(id)) return err(c, 'Conversación inválida.')
    try { const rows = await x.db.del('ai_conversations', 'id=eq.' + id); return c.json({ deleted: (rows || []).length }) } catch (ex) { return fail(c, ex) }
  })
  async function loadMessages(x, id) {
    const rows = await x.db.get('ai_messages', `select=id,seq,role,content_sealed,meta,created_at&conversation_id=eq.${id}&order=seq.asc&limit=${CHAT_LIMITS.messages}`)
    return Promise.all((rows || []).map(async (r) => { let v = {}; try { v = await unseal(r.content_sealed, x.secret) } catch {} return { id: r.id, seq: r.seq, role: r.role, text: clip(v?.text, 200000), sources: Array.isArray(v?.sources) ? v.sources.slice(0, 8) : [], meta: r.meta || {}, created_at: r.created_at } }))
  }
  api.get('/conversations/:id/messages', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const id = c.req.param('id'); if (!UUID.test(id)) return err(c, 'Conversación inválida.')
    try {
      const [row] = await x.db.get('ai_conversations', 'select=*&id=eq.' + id); if (!row) return err(c, 'No encontré esa conversación.', 404)
      return c.json({ conversation: await conv(x, row), messages: await loadMessages(x, id) })
    } catch (ex) { return fail(c, ex) }
  })
  const append = async (x, id, msgs) => x.db.rpc('ai_append_messages', { p_conversation: id, p_messages: await Promise.all(msgs.map(async (m) => ({ role: m.role, content_sealed: await seal({ text: m.text, ...(m.sources?.length ? { sources: m.sources } : {}) }, x.secret), meta: m.meta || {} }))) })

  // ---------- send / regenerate / edit (streams) ----------
  api.post('/conversations/:id/messages', async (c) => {
    const t0 = Date.now()
    const [x, e] = await ctx(c); if (e) return e
    const { s, env } = x, owner = s.user.id
    // Claude when ANTHROPIC_API_KEY exists; OpenAI (Responses API, streamed) meanwhile. Same SSE contract for the browser.
    const provider = aiProvider(env); if (!provider) return err(c, 'La IA no está configurada en el servidor.', 503, 'no_ai')
    const errOf = (ex) => provider === 'claude' ? claudeError(ex) : openaiError(ex)
    const id = c.req.param('id'); if (!UUID.test(id)) return err(c, 'Conversación inválida.')
    const b = await body(c); if (!b) return err(c, 'JSON inválido.')
    const mode = b.regenerate === true ? 'regenerate' : b.edit === true ? 'edit' : 'send'
    const text = clip(b.text, CHAT_LIMITS.text).trim()
    if (mode !== 'regenerate' && !text) return err(c, 'Escribe un mensaje.')
    const role = s.user.role || 'member', lim = limits(env, role), bud = budget(env)
    if (await usage(env, owner, 'chat') >= lim.chat) return err(c, 'Llegaste al límite diario de IA. Se reinicia mañana.', 429, 'daily_limit')
    if (await usage(env, '__global__', 'cost_micro') >= bud.global_daily_usd * 1e6) return err(c, 'Se alcanzó el presupuesto diario de IA de esta instalación.', 429, 'budget_global')
    let row, rows
    try { [row] = await x.db.get('ai_conversations', 'select=*&id=eq.' + id); if (!row) return err(c, 'No encontré esa conversación.', 404); rows = await loadMessages(x, id) } catch (ex) { return fail(c, ex) }
    // Regenerate: drop the last assistant answer. Edit: drop the last user message (and its answer) and resend.
    let userMsg = null
    try {
      if (mode === 'regenerate') { const last = rows.at(-1); if (!last) return err(c, 'No hay nada que regenerar.'); if (last.role === 'assistant') { await x.db.rpc('ai_truncate_messages', { p_conversation: id, p_seq: last.seq }); rows = rows.slice(0, -1) } if (rows.at(-1)?.role !== 'user') return err(c, 'No hay pregunta que regenerar.'); userMsg = rows.at(-1) }
      else {
        if (mode === 'edit') { const lastUser = [...rows].reverse().find((m) => m.role === 'user'); if (!lastUser) return err(c, 'No hay mensaje que editar.'); await x.db.rpc('ai_truncate_messages', { p_conversation: id, p_seq: lastUser.seq }); rows = rows.filter((m) => m.seq < lastUser.seq) }
        const [ins] = await append(x, id, [{ role: 'user', text, meta: {} }]); userMsg = { id: ins.id, seq: ins.seq, role: 'user', text }; rows = [...rows, userMsg]
      }
    } catch (ex) { return fail(c, ex) }
    // Tier: explicit for this message > conversation > account. Budget guard downgrades (disclosed).
    let tier = isTier(b.tier) ? b.tier : isTier(row.tier) ? row.tier : await readTier(env, owner), downgraded = null
    if (tier === 'profundo' && (role === 'guest' || await usage(env, owner, 'chat:profundo') >= lim.profundo)) { downgraded = { from: 'profundo', to: 'enfoque' }; tier = 'enfoque' }
    if (tier !== 'chispa' && await usage(env, owner, 'cost_micro') >= bud.account_daily_usd * 1e6) { downgraded = { from: tier, to: 'chispa', reason: 'account_budget' }; tier = 'chispa' }
    const cfg = tierConfig(env, tier)
    const ctxIn = b.context && typeof b.context === 'object' ? b.context : {}
    const privateMode = row.private === true || b.private === true
    const profile = await readProfile(env, owner, unseal).catch(() => null)
    const name = (profile?.enabled !== false && profile?.preferred_name) || clip(ctxIn.name || '', 40).replace(/[\n\r]/g, ' ')
    const timezone = profile?.timezone && validTimeZone(profile.timezone) ? profile.timezone : validTimeZone(ctxIn.timezone) ? ctxIn.timezone : 'America/Mexico_City'
    const currency = typeof ctxIn.currency === 'string' && /^[A-Z]{3}$/.test(ctxIn.currency) ? ctxIn.currency : 'MXN'
    let web = env.EVIE_WEB_SEARCH !== 'off' && (b.research === true || wantsWeb(userMsg.text))
    if (web && await usage(env, owner, 'web_search') >= lim.web_search) web = false
    // Memory (never in private chats).
    let memProfile = null, relevant = []
    const settings = await memorySettings(env, owner, unseal)
    if (!privateMode && settings.enabled !== false) { try { await x.store.migrateFromD1(env); memProfile = await x.store.profile(); if (settings.use_memories !== false) relevant = relevantMemories(await x.store.list(), userMsg.text) } catch (ex) { console.error('CHAT_MEMORY', String(ex?.message || ex).slice(0, 60)) } }
    const system = iviSystem({ userBlock: iviUserBlock({ profile: profileBlock(profile, userMsg.text), memoryProfile: memProfile }), context: iviDayContext({ name, today: day(timezone), timezone, currency, mode: cleanMode(ctxIn.mode), dials: personaDials(ctxIn.persona), guest: role === 'guest', privateMode }), cacheContext: true })
    const hist = historyMessages(rows)
    const last = hist.at(-1); if (last?.role === 'user') hist[hist.length - 1] = { role: 'user', content: [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }] }
    let messages = [...hist, { role: 'system', content: iviTurnNote({ tier: cfg.id, web, memory: memoryBlock(relevant) }) }]
    const tools = provider === 'claude' ? [...claudeTools(SERVER_TOOLS), ...(web ? [webSearchTool({ timezone, city: profile?.city, maxUses: 3 })] : [])] : []
    const client = provider === 'claude' ? claudeClient(env, fetcher) : null, abort = c.req.raw?.signal || null
    const isNew = !row.title_sealed && mode === 'send' && rows.filter((m) => m.role === 'user').length === 1
    const title = isNew ? autoTitle(userMsg.text) : null
    const memoryUsed = relevant.map((m) => ({ id: m.id, kind: m.kind, text: m.text }))

    async function generate(onText) {
      if (provider === 'openai') {
        // Same persona and context; the clock goes in the instructions (no tool loop) and web search is hosted.
        const instructions = [...system.map((b) => b.text), iviTurnNote({ tier: cfg.id, web, memory: memoryBlock(relevant) }), `Hora local actual: ${currentTime(timezone).spoken_es} (${timezone}).`].join('\n\n')
        const o = await openaiStream(env, fetcher, { tier: cfg.id, instructions, input: historyMessages(rows), web: web ? { timezone, city: profile?.city } : null, onText, signal: abort })
        let text = o.text.trim()
        if (!text) text = o.stop_reason === 'refusal' ? 'Prefiero no responder eso. ¿Lo vemos de otra forma?' : 'Listo.'
        else if (o.stop_reason === 'max_tokens') text += '\n\n_(Respuesta cortada por longitud: pídeme que continúe.)_'
        return { msg: { model: o.model, stop_reason: o.stop_reason, usage: {} }, cost: o.cost, searches: o.searches, text, sources: o.sources }
      }
      let msg = null, cost = 0, searches = 0, text = '', sources = []
      for (let hop = 0; hop < 6; hop++) {
        msg = await claudeRun(client, { model: cfg.model, max_tokens: cfg.max_output_tokens, system, messages, tools, output_config: { effort: cfg.effort } }, { onText, signal: abort })
        cost += claudeCost(env, msg); searches += searchesOf(msg); text += textOf(msg) ? (text ? '\n\n' : '') + textOf(msg) : ''; sources = [...sources, ...sourcesOf(msg)]
        if (msg.stop_reason === 'pause_turn') { messages = [...messages, { role: 'assistant', content: msg.content }]; continue }
        if (msg.stop_reason === 'tool_use') { const uses = toolUses(msg); messages = [...messages, { role: 'assistant', content: msg.content }, { role: 'user', content: uses.map((u) => u.name === 'get_current_time' ? { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(currentTime(timezone)) } : { type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'Herramienta no disponible en el chat.' }) }]; continue }
        break
      }
      const seen = new Set(); sources = sources.filter((x) => !seen.has(x.url) && seen.add(x.url)).slice(0, 8)
      if (!text) text = stopNote(msg) || 'Listo.'; else if (msg?.stop_reason === 'max_tokens') text += '\n\n_(Respuesta cortada por longitud: pídeme que continúe.)_'
      return { msg, cost, searches, text, sources }
    }
    async function finish(r, stopped = false) {
      await usage(env, owner, 'chat', 1); await usage(env, owner, 'chat:' + cfg.id, 1); if (r.searches) await usage(env, owner, 'web_search', r.searches)
      if (r.cost > 0) { await usage(env, owner, 'cost_micro', r.cost); await usage(env, '__global__', 'cost_micro', r.cost) }
      const meta = { model: r.msg?.model || cfg.model, tier: cfg.id, stop_reason: stopped ? 'stopped' : r.msg?.stop_reason || null, web: r.searches > 0, ms: Date.now() - t0, cache_read: r.msg?.usage?.cache_read_input_tokens || 0 }
      const [saved] = await append(x, id, [{ role: 'assistant', text: r.text, sources: r.sources, meta }])
      if (title) await x.db.patch('ai_conversations', 'id=eq.' + id, { title_sealed: await seal({ t: title }, x.secret) }).catch(() => {})
      // Long-term memory: learn from the finished exchange off the response path (never private, daily cap).
      if (!privateMode && !stopped && settings.enabled !== false && await usage(env, owner, 'memory_extract') < MEMORY_LIMITS.extractDaily) {
        const job = (async () => { try { await usage(env, owner, 'memory_extract', 1); const l = await learnFromExchange({ env, fetcher, store: x.store, user: userMsg.text, assistant: r.text, conversationId: id, settings }); if (l.cost > 0) { await usage(env, owner, 'cost_micro', l.cost); await usage(env, '__global__', 'cost_micro', l.cost) } } catch (ex) { console.error('MEMORY_LEARN', String(ex?.message || ex).slice(0, 80)) } })()
        try { c.executionCtx.waitUntil(job) } catch { await job }
      }
      return { message: { id: saved.id, seq: saved.seq }, text: r.text, sources: r.sources, model: meta.model, stop_reason: meta.stop_reason, title, tier: { id: cfg.id, label: TIER_LABELS[cfg.id], effort: cfg.effort, downgraded }, memory_used: memoryUsed, checked_at: r.searches ? currentTime(timezone).iso_local : null }
    }
    const metaEvent = { conversation: id, user_message: { id: userMsg.id, seq: userMsg.seq }, tier: { id: cfg.id, label: TIER_LABELS[cfg.id], effort: cfg.effort, downgraded }, web, private: privateMode, title }

    if (!(c.req.header('Accept') || '').includes('text/event-stream')) {
      try { const r = await generate(null); return c.json({ ...metaEvent, ...(await finish(r)) }) } catch (ex) { const xe = errOf(ex); console.error('CHAT_' + provider.toUpperCase(), xe.code); return err(c, xe.message, xe.status === 499 ? 499 : xe.status, xe.code) }
    }
    c.header('X-Accel-Buffering', 'no')
    return streamSSE(c, async (stream) => {
      let partial = '', closed = false
      stream.onAbort(() => { closed = true })
      await stream.writeSSE({ event: 'meta', data: JSON.stringify(metaEvent) })
      try {
        const r = await generate((t) => { partial += t; if (!closed) stream.writeSSE({ event: 'delta', data: JSON.stringify({ t }) }).catch(() => { closed = true }) })
        const done = await finish(r)
        if (!closed) await stream.writeSSE({ event: 'done', data: JSON.stringify(done) })
      } catch (ex) {
        const xe = errOf(ex)
        if (xe.code === 'aborted' || closed) { if (partial.trim()) { try { await finish({ msg: null, cost: 0, searches: 0, text: partial.trim(), sources: [] }, true) } catch {} } return }
        console.error('CHAT_' + provider.toUpperCase(), xe.code)
        if (!closed) await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: xe.message, code: xe.code }) })
      }
    })
  })

  // ---------- «Lo que Ivi sabe de ti» ----------
  api.get('/memories', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    try { await x.store.migrateFromD1(x.env); const [list, forgotten, profile, st] = await Promise.all([x.store.list(), c.req.query('forgotten') === '1' ? x.store.list({ includeForgotten: true }) : Promise.resolve(null), x.store.profile(), x.store.state()]); return c.json({ memories: list, forgotten: forgotten ? forgotten.filter((m) => m.deleted_at) : undefined, profile, profile_version: st?.profile_version || 0, kinds: MEMORY_KINDS }) } catch (ex) { return fail(c, ex) }
  })
  api.post('/memories', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const b = await body(c); if (!b) return err(c, 'JSON inválido.')
    const text = clip(b.text, MEMORY_LIMITS.text).trim(); if (text.length < 3) return err(c, 'Escribe el recuerdo.')
    try { return c.json({ memory: await x.store.add({ kind: b.kind, text, importance: Number.isInteger(b.importance) ? b.importance : 3, confidence: 1 }) }, 201) } catch (ex) { return fail(c, ex) }
  })
  api.patch('/memories/:id', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const id = c.req.param('id'); if (!UUID.test(id)) return err(c, 'Recuerdo inválido.')
    const b = await body(c); if (!b) return err(c, 'JSON inválido.')
    try { return c.json({ memory: await x.store.update(id, { text: typeof b.text === 'string' ? b.text : null, kind: b.kind, importance: Number.isInteger(b.importance) ? b.importance : undefined }, { user: true }) }) } catch (ex) { return /No encontré/.test(ex.message) ? err(c, ex.message, 404) : fail(c, ex) }
  })
  api.delete('/memories/:id', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const id = c.req.param('id'); if (!UUID.test(id)) return err(c, 'Recuerdo inválido.')
    try { return c.json({ forgotten: await x.store.forget(id) }) } catch (ex) { return fail(c, ex) }
  })
  api.post('/memories/:id/restore', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const id = c.req.param('id'); if (!UUID.test(id)) return err(c, 'Recuerdo inválido.')
    try { return c.json({ restored: await x.store.restore(id) }) } catch (ex) { return fail(c, ex) }
  })
  api.get('/memories/:id/history', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    const id = c.req.param('id'); if (!UUID.test(id)) return err(c, 'Recuerdo inválido.')
    try { return c.json({ history: await x.store.history(id) }) } catch (ex) { return fail(c, ex) }
  })
  api.get('/stamp', async (c) => {
    const [x, e] = await ctx(c); if (e) return e
    try { const v = await x.db.rpc('evie_chat_stamp', {}); return c.json({ stamp: typeof v === 'string' ? v : '' }) } catch (ex) { return fail(c, ex) }
  })
  return api
}
