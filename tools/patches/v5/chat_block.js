  // ---------- AI tier (ai_reasoning_tier): per-account, authenticated ----------
  api.get('/tier', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    const env = c.env || {}, cur = await readTier(env, s.user.id), guest = s.user.role === 'guest'
    return c.json({ tier: cur, setting: 'ai_reasoning_tier', tiers: TIER_IDS.map((id) => { const t = tierConfig(env, id); return { id, label: t.label, summary: t.summary, model: t.model, effort: t.effort, available: !(guest && id === 'profundo') } }), note: 'El nivel de IA es independiente del modo de trabajo (enfoque, gym, negocio…).' })
  })
  api.put('/tier', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    let b; try { b = await c.req.json() } catch { return err(c, 'JSON inválido.') }
    if (!b || typeof b !== 'object' || Object.keys(b).some((k) => k !== 'tier') || !isTier(b.tier)) return err(c, 'Nivel inválido. Usa chispa, enfoque o profundo.')
    if (s.user.role === 'guest' && b.tier === 'profundo') return err(c, 'El nivel Profundo no está disponible para invitados.', 403)
    if (!c.env?.AUTH_DB) return err(c, 'Almacenamiento no disponible.', 503)
    await ensureV5(c.env.AUTH_DB); await putSetting(c.env, s.user.id, 'ai_reasoning_tier', b.tier)
    return c.json({ tier: b.tier, label: TIER_LABELS[b.tier] })
  })
  // Content-free metrics: p50/p95 per stage and tier for the signed-in account (last 7 days).
  api.get('/metrics', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    const env = c.env || {}; if (!env.AUTH_DB) return c.json({ metrics: {} })
    await ensureV5(env.AUTH_DB)
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const { results = [] } = await env.AUTH_DB.prepare('SELECT metric,bucket,SUM(n) AS n FROM evie_metrics WHERE owner_id=? AND day>=? GROUP BY metric,bucket').bind(s.user.id, since).all()
    const cost = await usage(env, s.user.id, 'cost_micro'), global = await usage(env, '__global__', 'cost_micro')
    return c.json({ metrics: percentiles(results), spend_today_usd: { account: cost / 1e6, global: global / 1e6 }, budget: budget(env), note: 'Solo tiempos y conteos; nunca contenido.' })
  })
  // Client-side stage timings (wake, capture, first audio…) — numbers only, whitelisted names.
  const CLIENT_STAGES = new Set(['wake', 'capture', 'stt', 'retrieval', 'first_token', 'tools', 'tts_first_audio', 'total', 'dictation_chunk'])
  api.post('/metrics', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    let b; try { b = await c.req.json() } catch { return err(c, 'JSON inválido.') }
    const marks = b && typeof b.marks === 'object' && !Array.isArray(b.marks) ? b.marks : null; if (!marks) return err(c, 'Marcas inválidas.')
    const tier = isTier(b.tier) ? b.tier : 'na'; let n = 0
    if (c.env?.AUTH_DB) { await ensureV5(c.env.AUTH_DB); for (const [k, v] of Object.entries(marks).slice(0, 12)) if (CLIENT_STAGES.has(k) && Number.isFinite(v) && v >= 0 && v < 600000) { await observe(c.env, s.user.id, 'c_' + k + ':' + tier, v); n++ } }
    return c.json({ recorded: n })
  })

  api.post('/chat', async (c) => {
    const t0 = Date.now()
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    const env = c.env || {}
    if (!env.OPENAI_API_KEY) return err(c, 'EVIE IA no está configurada (falta OPENAI_API_KEY).', 503)
    let body; try { body = await c.req.json() } catch { return err(c, 'JSON inválido.') }
    let input; try { input = sanitizeInput(body?.input) } catch (e) { return err(c, e.message) }
    const requestId = typeof body.request_id === 'string' && /^r-[0-9a-f-]{36}$/.test(body.request_id) ? body.request_id : rid()
    const ctx = body.context && typeof body.context === 'object' ? body.context : {}
    const role = s.user.role || 'member', guest = role === 'guest'
    // Profile comes from the SERVER-side record of the authenticated account, never from the client body.
    const profile = unseal ? await readProfile(env, s.user.id, unseal).catch(() => null) : null
    const name = (profile?.enabled !== false && profile?.preferred_name) || (typeof ctx.name === 'string' ? ctx.name.slice(0, 40).replace(/[\n\r]/g, ' ') : '')
    const timezone = (profile?.timezone && validTimeZone(profile.timezone)) ? profile.timezone : (validTimeZone(ctx.timezone) ? ctx.timezone : 'America/Mexico_City')
    const currency = typeof ctx.currency === 'string' && /^[A-Z]{3}$/.test(ctx.currency) ? ctx.currency : 'MXN'
    const lim = limits(env, role), bud = budget(env)
    if (await usage(env, s.user.id, 'chat') >= lim.chat) return err(c, 'Llegaste al límite diario de EVIE IA. Los comandos locales siguen funcionando.', 429)
    if (await usage(env, '__global__', 'cost_micro') >= bud.global_daily_usd * 1e6) return c.json({ error: 'Se alcanzó el presupuesto diario de IA de esta instalación. Los comandos locales siguen funcionando; se reinicia a las 00:00 UTC.', code: 'budget_global', request_id: requestId }, 429)
    const lastIdx = input.map((x) => x.role).lastIndexOf('user')
    let lastUser = lastIdx >= 0 ? input[lastIdx].content : ''
    // ----- tier resolution: explicit once (body.tier or spoken) > stored per-account tier. Never silently overridden.
    const stored = await readTier(env, s.user.id)
    let tier = stored, tierSource = 'account', tierChanged = null
    const cmd = lastIdx >= 0 && lastIdx === input.length - 1 ? parseTierCommand(lastUser) : null
    const meta = (id, source) => ({ id, label: TIER_LABELS[id], source })
    if (cmd) {
      if (guest && cmd.tier === 'profundo') { const say = 'El nivel Profundo no está disponible en cuentas de invitado.'; return c.json({ text: say, spoken: say, calls: [], reasoning: [], request_id: requestId, tier: meta(stored, 'account') }) }
      if (cmd.scope === 'persistent') { if (env.AUTH_DB) { await ensureV5(env.AUTH_DB); await putSetting(env, s.user.id, 'ai_reasoning_tier', cmd.tier) } tierChanged = cmd.tier; tier = cmd.tier }
      else { tier = cmd.tier; tierSource = 'once' }
      if (!cmd.rest) { const say = cmd.scope === 'persistent' ? `Listo, usaré el nivel ${TIER_LABELS[cmd.tier]} a partir de ahora.` : `De acuerdo, usaré ${TIER_LABELS[cmd.tier]} solo para tu siguiente pregunta. ¿Qué quieres saber?`; return c.json({ text: say, spoken: say, calls: [], reasoning: [], request_id: requestId, tier: meta(cmd.tier, cmd.scope === 'persistent' ? 'account' : 'once'), tier_changed: tierChanged, once_pending: cmd.scope === 'once' ? cmd.tier : null }) }
      input = input.map((x, i) => i === lastIdx ? { role: 'user', content: cmd.rest } : x); lastUser = cmd.rest
    } else if (isTier(body.tier)) { tier = body.tier; tierSource = 'once' }
    let fallback = null
    if (guest && tier === 'profundo') { fallback = { from: 'profundo', to: 'enfoque', reason: 'guest' }; tier = 'enfoque' }
    if (tier === 'profundo' && await usage(env, s.user.id, 'chat:profundo') >= lim.profundo) { fallback = { from: 'profundo', to: 'enfoque', reason: 'daily_limit' }; tier = 'enfoque' }
    if (tier !== 'chispa' && await usage(env, s.user.id, 'cost_micro') >= bud.account_daily_usd * 1e6) { fallback = { from: tier, to: 'chispa', reason: 'account_budget' }; tier = 'chispa' }
    let cfg = tierConfig(env, tier)
    const webOff = env.EVIE_WEB_SEARCH === 'off'
    let web = !webOff && (body.research === true || (cfg.web === 'auto' ? wantsWeb(lastUser) : /\b(investiga|busca en (internet|la web|google))\b/i.test(lastUser)))
    if (web && await usage(env, s.user.id, 'web_search') >= lim.web_search) web = false
    const tools = [...TOOLS, ...SERVER_TOOLS, ...(web ? [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'MX', timezone, ...(profile?.city ? { city: profile.city.slice(0, 60) } : {}) } }] : [])]
    // Memory is retrieved on the SERVER for the authenticated owner only; private mode skips it entirely.
    const privateMode = body.private === true
    let memory = null, memoryUsed = { facts: [], sessions: [] }
    const tr = Date.now()
    if (!privateMode && unseal && env.AUTH_DB && env.EVIE_SESSION_KEY) { try { await ensureMemorySchema(env.AUTH_DB); const st = await settingsOf(env, s.user.id, unseal); memoryUsed = await retrieve(env, s.user.id, unseal, lastUser, { ...st, timezone }); memory = contextBlock(memoryUsed) } catch (e) { console.error('MEMORY_RETRIEVE', String(e?.message || e).slice(0, 80)) } }
    const retrievalMs = Date.now() - tr
    const sys = instructions({ name, today: day(timezone), timezone, currency, profile: profileBlock(profile, lastUser), web, memory, privateMode, tier: cfg.id, guest })
    let convo = [...input], data = null, usedWeb = false, webUnsupported = false, costTotal = 0
    const openaiMs = []
    // Server tools (trusted clock) are resolved here in a bounded loop; client tools go back to the browser.
    for (let hop = 0; hop < cfg.hops + 2; hop++) {
      const payload = { model: cfg.model, instructions: sys, input: convo, tools, parallel_tool_calls: true, max_output_tokens: web ? Math.max(cfg.max_output_tokens, 900) : cfg.max_output_tokens, store: false, reasoning: { effort: cfg.effort }, include: [...(cfg.effort !== 'none' ? ['reasoning.encrypted_content'] : []), ...(web ? ['web_search_call.action.sources'] : [])] }
      if (!payload.include.length) delete payload.include
      let r; const ts = Date.now()
      try { r = await fetcher(OPENAI_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(web ? Math.max(cfg.timeout_ms, 45000) : cfg.timeout_ms) }) }
      catch { const fb = fallbackOf(cfg.id); if (fb && !fallback) { fallback = { from: cfg.id, to: fb, reason: 'timeout' }; cfg = tierConfig(env, fb); continue } return c.json({ error: 'OpenAI no respondió a tiempo.', request_id: requestId }, 504) }
      openaiMs.push(Date.now() - ts)
      if (!r.ok) {
        let code = '', msg = ''; try { const j = await r.json(); code = j?.error?.code || ''; msg = j?.error?.message || '' } catch {}
        console.error('OPENAI_REJECTED', r.status, String(code).slice(0, 60), cfg.id)
        // Model without hosted web_search support: retry once without it instead of failing the user.
        if (web && r.status === 400 && /web_search|tool/i.test(code + ' ' + msg)) { web = false; tools.splice(tools.findIndex((t) => t.type === 'web_search'), 1); webUnsupported = true; continue }
        // Model/effort unavailable or provider error → graceful, DISCLOSED fallback to the next tier down.
        const modelProblem = r.status === 404 || r.status >= 500 || (r.status === 400 && /model|reasoning|effort|unsupported/i.test(code + ' ' + msg))
        const fb = fallbackOf(cfg.id)
        if (modelProblem && fb) { fallback = { from: cfg.id, to: fb, reason: r.status >= 500 ? 'provider_error' : 'model_unavailable' }; cfg = tierConfig(env, fb); continue }
        return c.json({ error: r.status === 429 ? 'OpenAI limitó las solicitudes o no hay saldo en la cuenta de API.' : r.status === 401 ? 'La clave de OpenAI no es válida.' : 'EVIE IA no pudo responder.', request_id: requestId }, r.status === 429 ? 429 : 502)
      }
      await usage(env, s.user.id, 'chat', 1)
      data = await r.json()
      costTotal += costMicro(env, cfg.model, data?.usage)
      const out = Array.isArray(data.output) ? data.output : []
      if (out.some((o) => o.type === 'web_search_call')) { usedWeb = true; costTotal += WEB_SEARCH_USD * 1e6 }
      const serverCalls = out.filter((o) => o.type === 'function_call' && SERVER_NAMES.has(o.name))
      const clientCalls = out.filter((o) => o.type === 'function_call' && TOOL_NAMES.has(o.name))
      if (!serverCalls.length || clientCalls.length) break
      const reasoning = out.filter((o) => o.type === 'reasoning').map((o) => ({ type: 'reasoning', id: o.id, summary: o.summary || [], ...(o.encrypted_content ? { encrypted_content: o.encrypted_content } : {}) }))
      convo = [...convo, ...reasoning, ...serverCalls.map((o) => ({ type: 'function_call', call_id: o.call_id, name: o.name, arguments: o.arguments || '{}' })), ...serverCalls.map((o) => ({ type: 'function_call_output', call_id: o.call_id, output: JSON.stringify(currentTime(timezone)) }))]
    }
    if (!data) return c.json({ error: 'EVIE IA no pudo responder.', request_id: requestId }, 502)
    if (usedWeb) await usage(env, s.user.id, 'web_search', 1)
    await usage(env, s.user.id, 'chat:' + cfg.id, 1)
    if (costTotal > 0) { await usage(env, s.user.id, 'cost_micro', Math.round(costTotal)); await usage(env, '__global__', 'cost_micro', Math.round(costTotal)) }
    const output = Array.isArray(data?.output) ? data.output : []
    const calls = output.filter((o) => o.type === 'function_call' && TOOL_NAMES.has(o.name)).map((o) => ({ type: 'function_call', call_id: o.call_id, name: o.name, arguments: o.arguments }))
    const reasoning = output.filter((o) => o.type === 'reasoning').map((o) => ({ type: 'reasoning', id: o.id, summary: o.summary || [], ...(o.encrypted_content ? { encrypted_content: o.encrypted_content } : {}) }))
    const parts = output.filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((p) => p.type === 'output_text')
    const text = parts.map((p) => p.text).join('').trim()
    // Cited sources (url_citation) are shown as clickable links in the text UI; never read aloud.
    const seen = new Set(), sources = []
    for (const p of parts) for (const a of p.annotations || []) if (a?.type === 'url_citation' && /^https:\/\//.test(a.url || '') && !seen.has(a.url) && sources.length < 8) { seen.add(a.url); let host = ''; try { host = new URL(a.url).hostname.replace(/^www\./, '') } catch {} sources.push({ url: String(a.url).slice(0, 500), title: String(a.title || host).slice(0, 160), host }) }
    const spoken = text.replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim()
    const total = Date.now() - t0, oai = openaiMs.reduce((a, b) => a + b, 0)
    await observe(env, s.user.id, 'retrieval:' + cfg.id, retrievalMs); for (const ms of openaiMs) await observe(env, s.user.id, 'openai:' + cfg.id, ms); await observe(env, s.user.id, 'chat_total:' + cfg.id, total)
    c.header('Server-Timing', `retrieval;dur=${retrievalMs}, openai;dur=${oai}, total;dur=${total}`)
    return c.json({ request_id: requestId, tier: { id: cfg.id, label: cfg.label, source: fallback ? 'fallback' : tierSource, model: cfg.model, effort: cfg.effort }, tier_requested: tierSource === 'once' ? tier : stored, tier_fallback: fallback, tier_changed: tierChanged, suggest_tier: calls.length ? null : suggestTier(cfg.id, lastUser), timings: { retrieval_ms: retrievalMs, openai_ms: openaiMs, total_ms: total }, memory_used: { facts: memoryUsed.facts.map((f) => ({ id: f.id, text: f.text, day: f.updated_day, source: f.source, source_session: f.source_session })), sessions: memoryUsed.sessions.map((x) => ({ id: x.id, day: x.day })) }, private: privateMode, text, spoken, calls, reasoning, model: cfg.model, web: usedWeb, web_unavailable: webUnsupported, sources, checked_at: usedWeb ? currentTime(timezone).iso_local : null })
  })

