// Connections center: per-account provider connections.
// Implemented end-to-end: Google Calendar (read-only, events of the signed-in EVIE account only).
// OAuth 2.0 authorization code + PKCE (S256). The single-use `state` is created by an authenticated,
// CSRF-protected POST and stored hashed with the owner_id; the callback exchanges the code and stores the
// sealed tokens under that owner. (The session cookie is SameSite=Strict, so it is not sent on the
// cross-site redirect from Google; binding therefore relies on the unguessable state created in-session.)
// Tokens are sealed with AES-GCM (EVIE_SESSION_KEY) in D1 provider_tokens keyed by (owner_id, provider).
// Gmail and Spotify are listed honestly as "later" (restricted-scope review / Premium + device).
import { Hono } from 'hono'

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke'
export const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const rand = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)))
export const sha256u = async (s) => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
const err = (c, m, s = 400) => c.json({ error: m }, s)

export function catalog(env, rows = []) {
  const g = rows.find((r) => r.provider === 'google_calendar')
  const googleReady = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
  return [
    { id: 'google_calendar', name: 'Google Calendar', reads: 'Eventos de tu calendario principal (solo lectura)', writes: 'Nada por ahora. Las escrituras llegarán con confirmación explícita.',
      status: g ? (g.error ? 'error' : 'connected') : googleReady ? 'available' : 'needs_setup', last_ok: g?.last_ok || null, error: g?.error || null, setup: googleReady ? null : 'Falta GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor (docs/SETUP.md).' },
    { id: 'openai', name: 'OpenAI · razonamiento de EVIE', reads: 'Tus preguntas y los datos que EVIE consulta para responderte', writes: 'Nada', shared: true, status: env.OPENAI_API_KEY ? 'connected' : 'needs_setup', setup: env.OPENAI_API_KEY ? null : 'Falta OPENAI_API_KEY. Ojo: la suscripción de ChatGPT no incluye clave de API; la API se paga aparte.' },
    { id: 'groq', name: 'Groq · voz a texto', reads: 'El audio de tu pregunta mientras hablas', writes: 'Nada', shared: true, status: env.GROQ_API_KEY ? 'connected' : 'needs_setup', setup: env.GROQ_API_KEY ? null : 'Falta GROQ_API_KEY.' },
    { id: 'fish_audio', name: 'Fish Audio · voz de EVIE', reads: 'El texto que EVIE va a decir', writes: 'Nada', shared: true, status: env.FISH_AUDIO_API_KEY && env.FISH_AUDIO_VOICE_ID ? 'connected' : 'needs_setup', setup: env.FISH_AUDIO_API_KEY ? (env.FISH_AUDIO_VOICE_ID ? null : 'Falta FISH_AUDIO_VOICE_ID.') : 'Falta FISH_AUDIO_API_KEY.' },
    { id: 'gmail', name: 'Gmail', reads: '—', writes: '—', status: 'later', setup: 'Leer correo usa alcances restringidos de Google: requiere verificación de la app y una auditoría de seguridad. Pendiente.' },
    { id: 'spotify', name: 'Spotify', reads: '—', writes: '—', status: 'later', setup: 'Controlar la música requiere Spotify Premium, un dispositivo activo y que Spotify apruebe la app (en desarrollo solo admite usuarios agregados a mano). Pendiente.' }
  ]
}

export function createConnections({ fetcher = fetch, authenticate, seal, unseal }) {
  const api = new Hono()
  const db = (c) => c.env.AUTH_DB
  const redirectUri = (c) => (c.env.EVIE_PUBLIC_ORIGIN || new URL(c.req.url).origin) + '/api/connections/google/callback'
  const google = (c) => !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET)

  async function tokenFor(c, owner) {
    const row = await db(c).prepare("SELECT tokens FROM provider_tokens WHERE owner_id=? AND provider='google_calendar'").bind(owner).first()
    if (!row) return null
    let t = await unseal(row.tokens, c.env.EVIE_SESSION_KEY)
    if (t.expires_at - 60000 > Date.now()) return t.access_token
    if (!t.refresh_token) return null
    const r = await fetcher(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID, client_secret: c.env.GOOGLE_CLIENT_SECRET, refresh_token: t.refresh_token, grant_type: 'refresh_token' }), redirect: 'error', signal: AbortSignal.timeout(15000) })
    if (!r.ok) { await db(c).prepare("UPDATE provider_tokens SET error=? WHERE owner_id=? AND provider='google_calendar'").bind('La autorización expiró o fue revocada. Vuelve a conectar.', owner).run(); return null }
    const j = await r.json()
    t = { ...t, access_token: j.access_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 }
    await db(c).prepare("UPDATE provider_tokens SET tokens=?, error=NULL WHERE owner_id=? AND provider='google_calendar'").bind(await seal(t, c.env.EVIE_SESSION_KEY), owner).run()
    return t.access_token
  }

  api.get('/', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    const rows = (await db(c).prepare('SELECT provider,last_ok,error FROM provider_tokens WHERE owner_id=?').bind(s.user.id).all()).results || []
    return c.json({ connections: catalog(c.env, rows) })
  })

  api.post('/google/start', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    if (!google(c)) return err(c, 'Google Calendar necesita configuración en el servidor.', 503)
    const state = rand(24), verifier = rand(48)
    await db(c).prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(Date.now()).run()
    await db(c).prepare('INSERT INTO oauth_states(state,owner_id,provider,verifier,expires_at) VALUES(?,?,?,?,?)').bind(await sha256u(state), s.user.id, 'google_calendar', await seal({ verifier }, c.env.EVIE_SESSION_KEY), Date.now() + 600000).run()
    const u = new URL(GOOGLE_AUTH)
    u.search = new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(c), response_type: 'code', scope: CAL_SCOPE, access_type: 'offline', prompt: 'consent', state, code_challenge: await sha256u(verifier), code_challenge_method: 'S256' }).toString()
    return c.json({ url: u.toString() })
  })

  api.get('/google/callback', async (c) => {
    const back = (q) => c.redirect('/?conexion=' + q + '#configuracion', 302)
    const state = c.req.query('state') || '', code = c.req.query('code') || ''
    if (c.req.query('error')) return back('cancelada')
    if (!google(c) || !state || !code || state.length > 100 || code.length > 2000) return back('invalida')
    const row = await db(c).prepare('DELETE FROM oauth_states WHERE state=? AND expires_at>? RETURNING owner_id,verifier').bind(await sha256u(state), Date.now()).first()
    if (!row) return back('expirada')
    const { verifier } = await unseal(row.verifier, c.env.EVIE_SESSION_KEY)
    let r
    try { r = await fetcher(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID, client_secret: c.env.GOOGLE_CLIENT_SECRET, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirectUri(c) }), redirect: 'error', signal: AbortSignal.timeout(15000) }) } catch { return back('sin-respuesta') }
    if (!r.ok) return back('rechazada')
    const j = await r.json()
    if (!String(j.scope || '').split(' ').includes(CAL_SCOPE)) return back('sin-permiso')
    const t = { access_token: j.access_token, refresh_token: j.refresh_token || null, expires_at: Date.now() + (j.expires_in || 3600) * 1000 }
    await db(c).prepare("INSERT INTO provider_tokens(owner_id,provider,tokens,scopes,created_at,last_ok,error) VALUES(?,'google_calendar',?,?,?,?,NULL) ON CONFLICT(owner_id,provider) DO UPDATE SET tokens=excluded.tokens,scopes=excluded.scopes,last_ok=excluded.last_ok,error=NULL").bind(row.owner_id, await seal(t, c.env.EVIE_SESSION_KEY), CAL_SCOPE, Date.now(), Date.now()).run()
    return back('ok')
  })

  api.get('/google/events', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    const day = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('date') || '') ? c.req.query('date') : new Date().toISOString().slice(0, 10)
    const tz = /^[A-Za-z_/+-]{3,40}$/.test(c.req.query('tz') || '') ? c.req.query('tz') : 'America/Mexico_City'
    const token = await tokenFor(c, s.user.id); if (!token) return err(c, 'Google Calendar no está conectado.', 409)
    const from = new Date(Date.parse(day + 'T00:00:00Z') - 14 * 3600000), to = new Date(Date.parse(day + 'T00:00:00Z') + 38 * 3600000)
    const u = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    u.search = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '50', timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: tz }).toString()
    let r; try { r = await fetcher(u.toString(), { headers: { Authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(15000) }) } catch { return err(c, 'Google Calendar no respondió.', 504) }
    if (!r.ok) { await db(c).prepare("UPDATE provider_tokens SET error=? WHERE owner_id=? AND provider='google_calendar'").bind('Google rechazó la lectura (' + r.status + ').', s.user.id).run(); return err(c, 'Google Calendar no respondió.', 502) }
    const j = await r.json()
    await db(c).prepare("UPDATE provider_tokens SET last_ok=?, error=NULL WHERE owner_id=? AND provider='google_calendar'").bind(Date.now(), s.user.id).run()
    const local = (v) => v ? (v.length === 10 ? v : new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(v))) : null
    // Event text is untrusted: only plain, truncated fields are returned; never treated as instructions.
    const events = (j.items || []).map((e) => ({ title: String(e.summary || '(sin título)').slice(0, 140), start: e.start?.dateTime || e.start?.date || null, end: e.end?.dateTime || e.end?.date || null, all_day: !!e.start?.date, location: e.location ? String(e.location).slice(0, 120) : null }))
      .filter((e) => local(e.start) === day || (e.all_day && e.start <= day && (e.end || '') > day))
    return c.json({ date: day, events })
  })

  api.post('/google/disconnect', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    const row = await db(c).prepare("SELECT tokens FROM provider_tokens WHERE owner_id=? AND provider='google_calendar'").bind(s.user.id).first()
    if (row) { try { const t = await unseal(row.tokens, c.env.EVIE_SESSION_KEY); await fetcher(GOOGLE_REVOKE + '?token=' + encodeURIComponent(t.refresh_token || t.access_token), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000) }) } catch {} }
    await db(c).prepare("DELETE FROM provider_tokens WHERE owner_id=? AND provider='google_calendar'").bind(s.user.id).run()
    return c.json({ ok: true })
  })
  return api
}
