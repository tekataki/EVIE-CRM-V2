// EVIE v5 · Invitados temporales (rol 'guest').
// Dos caducidades DISTINTAS:
//   1. Código de invitación sin usar: caduca 72 h después de crearlo (auth_invites.expires_at).
//   2. Cuenta de invitado: dura 72 h desde que se CANJEA el código (guest_accounts.expires_at).
// Supabase (migración 202611220001_guests_sync): tabla evie_guests + RLS restrictiva + pg_cron. Sin
// SUPABASE_SERVICE_ROLE_KEY, el invitado se crea con el alta normal y se registra con su propia sesión;
// Supabase fija la caducidad (72 h), bloquea al vencer y borra al usuario (cascada) cada 15 min.
// El invitado da un nombre visible + el código (sin contraseña). El servidor crea un usuario Supabase sintético
// con contraseña aleatoria que nunca sale del Worker. La caducidad se aplica en CADA solicitud, antes de cualquier
// refresh; al caducar se revocan sus sesiones y se ejecuta una limpieza auditable y reintentable.
import { Hono } from 'hono'
import { ensureV5 } from './v5-schema.js'

export const GUEST_HOURS = 72
export const GUEST_MS = GUEST_HOURS * 3600000
// Every D1 table that holds per-account rows (owner_id). Cleanup deletes the guest's rows from all of them.
export const OWNER_TABLES = ['auth_sessions', 'ai_usage', 'provider_tokens', 'oauth_states', 'user_profiles', 'kisha_turns', 'google_links', 'evie_memory_settings', 'evie_memories', 'evie_sessions', 'evie_user_settings', 'evie_tasks', 'evie_scenes', 'evie_ops', 'evie_plans', 'evie_metrics']
export const cleanName = (v) => String(v ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
export const normCode = (v) => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-')

/** Guest state for an owner id: null (not a guest) | { expired, expires_at, display_name, status }. */
export async function guestOf(db, owner) {
  let g = null
  try { g = await db.prepare('SELECT display_name,expires_at,status FROM guest_accounts WHERE owner_id=?').bind(owner).first() } catch (e) { if (/no such table/i.test(String(e?.message))) return null; throw e }
  if (!g) return null
  return { ...g, expired: g.status !== 'active' || g.expires_at <= Date.now() }
}

/** Retryable, idempotent cleanup. Each step is logged by name + status only (never content). */
export async function cleanupGuest(env, owner, { fetcher = fetch } = {}) {
  const db = env.AUTH_DB
  const g = await db.prepare('SELECT status FROM guest_accounts WHERE owner_id=?').bind(owner).first()
  if (!g) return { ok: false, error: 'not_guest' }
  if (g.status === 'cleaned') return { ok: true, already: true }
  if (g.status === 'active') return { ok: false, error: 'still_active' }
  await db.prepare("UPDATE guest_accounts SET status='cleaning', cleanup_attempts=cleanup_attempts+1 WHERE owner_id=?").bind(owner).run()
  const log = [], step = (name, ok, detail = '') => log.push(name + ':' + (ok ? 'ok' : 'fail') + (detail ? '(' + String(detail).slice(0, 40) + ')' : ''))
  // 1. D1: sessions first (access ends immediately), then every owner-scoped table.
  for (const t of OWNER_TABLES) { try { await db.prepare(`DELETE FROM ${t} WHERE owner_id=?`).bind(owner).run(); step('d1.' + t, true) } catch (e) { if (/no such table/i.test(String(e?.message))) step('d1.' + t, true, 'absent'); else step('d1.' + t, false) } }
  try { await db.prepare('DELETE FROM auth_invites WHERE created_by=? AND used_at IS NULL').bind(owner).run(); step('d1.auth_invites', true) } catch { step('d1.auth_invites', false) }
  // 2. Supabase (service role): Storage objects under <uid>/ (incl. one nested level, e.g. voice/), then the auth
  //    user. crm_records, user_preferences, profiles, sync_devices and contacts are ON DELETE CASCADE from auth.users.
  const key = env.SUPABASE_SERVICE_ROLE_KEY, base = String(env.SUPABASE_URL || '').replace(/\/$/, '')
  let remoteOk = false
  if (!base) step('supabase', false, 'no_url')
  else if (!key) {
    // Supabase side is handled by the database itself: RLS blocks the expired guest immediately and the
    // pg_cron job 'evie-guest-purge' deletes the auth user (ON DELETE CASCADE) within 15 minutes.
    remoteOk = true; step('supabase.pg_cron_purge', true, 'scheduled')
  } else {
    const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }
    const list = async (prefix) => { const l = await fetcher(base + '/storage/v1/object/list/user-media', { method: 'POST', headers: H, body: JSON.stringify({ prefix, limit: 1000, offset: 0 }), signal: AbortSignal.timeout(15000) }); if (l.status === 404 || l.status === 400) return []; if (!l.ok) throw Error('list'); return (await l.json()).filter((x) => x && typeof x.name === 'string') }
    const del = async (paths) => { if (!paths.length) return; const d = await fetcher(base + '/storage/v1/object/user-media', { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: paths }), signal: AbortSignal.timeout(15000) }); if (!d.ok) throw Error('delete') }
    try {
      let storageOk = true
      try {
        for (let round = 0; round < 10; round++) {
          const items = await list(owner)
          if (!items.length) break
          await del(items.filter((x) => x.id).map((x) => owner + '/' + x.name))
          for (const dir of items.filter((x) => !x.id).slice(0, 20)) await del((await list(owner + '/' + dir.name)).filter((x) => x.id).map((x) => owner + '/' + dir.name + '/' + x.name))
          if (round > 0 && !items.some((x) => x.id)) break
        }
      } catch { storageOk = false }
      step('storage.user-media', storageOk)
      if (storageOk) {
        const u = await fetcher(base + '/auth/v1/admin/users/' + owner, { method: 'DELETE', headers: H, signal: AbortSignal.timeout(15000) })
        remoteOk = u.ok || u.status === 404
        step('supabase.auth_user+cascade', remoteOk, remoteOk ? '' : 'status_' + u.status)
      }
    } catch { step('supabase', false, 'network') }
  }
  const allOk = remoteOk && !log.some((x) => x.includes(':fail'))
  await db.prepare('UPDATE guest_accounts SET status=?, cleanup_log=?, cleaned_at=? WHERE owner_id=?').bind(allOk ? 'cleaned' : 'failed', log.join(' ').slice(0, 2000), allOk ? Date.now() : null, owner).run()
  console.log('EVIE_GUEST_CLEANUP', allOk ? 'cleaned' : 'failed', log.filter((x) => x.includes(':fail')).length)
  return { ok: allOk, log }
}

/** Lazy sweep (no cron triggers on hosted deploys): expire + clean a few guests per call. */
export async function sweepGuests(env, { fetcher = fetch, max = 3 } = {}) {
  const db = env.AUTH_DB
  await db.prepare("UPDATE guest_accounts SET status='expired' WHERE status='active' AND expires_at<=?").bind(Date.now()).run()
  await db.prepare("DELETE FROM auth_sessions WHERE owner_id IN (SELECT owner_id FROM guest_accounts WHERE status<>'active')").bind().run()
  const { results = [] } = await db.prepare("SELECT owner_id FROM guest_accounts WHERE status IN ('expired','failed','cleaning') AND cleanup_attempts<8 ORDER BY expires_at LIMIT ?").bind(max).all()
  const out = []
  for (const r of results) out.push({ owner_id: r.owner_id, ...(await cleanupGuest(env, r.owner_id, { fetcher })) })
  return out
}

export function createGuests({ fetcher = fetch, remote, issueSession, digest, limited, owner, unseal }) {
  const api = new Hono()
  // Early end: mark the guest as ended in Supabase using the guest's OWN session (no admin key needed).
  async function endRemote(c, id) {
    try {
      const row = await c.env.AUTH_DB.prepare('SELECT tokens FROM auth_sessions WHERE owner_id=? ORDER BY expires_at DESC LIMIT 1').bind(id).first()
      if (!row || !unseal) return false
      const tok = await unseal(row.tokens, c.env.EVIE_SESSION_KEY)
      let r = await remote(c, '/rest/v1/rpc/evie_guest_end', { method: 'POST', access: tok.access_token, body: {} })
      if (r.status === 401 && tok.refresh_token) {
        const rr = await remote(c, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: tok.refresh_token } })
        if (!rr.ok) return false
        r = await remote(c, '/rest/v1/rpc/evie_guest_end', { method: 'POST', access: (await rr.json()).access_token, body: {} })
      }
      return r.ok
    } catch { return false }
  }
  const jsonError = (c, m, s = 400, extra = {}) => c.json({ error: m, ...extra }, s)
  // Redeem: display name + code, no password. Single use (atomic UPDATE … RETURNING), rate limited per IP and per code.
  api.post('/redeem', async (c) => {
    const env = c.env
    let b; try { b = await c.req.json() } catch { return jsonError(c, 'Solicitud inválida.') }
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some((k) => !['code', 'display_name'].includes(k))) return jsonError(c, 'Solicitud inválida.')
    const name = cleanName(b.display_name), code = normCode(b.code)
    if (name.length < 2) return jsonError(c, 'Escribe tu nombre (2 a 40 caracteres).')
    if (!/^[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/.test(code)) return jsonError(c, 'Revisa el código de invitación (formato XXXX-XXXX-XXXX).')
    const ip = c.req.header('CF-Connecting-IP') || 'local', id = await digest('invite:' + code)
    if (await limited(c, 'guest-ip:' + ip, 10) || await limited(c, 'guest-code:' + id, 5)) return jsonError(c, 'Demasiados intentos. Espera 15 minutos.', 429)
    await ensureV5(env.AUTH_DB)
    const now = Date.now()
    const invite = await env.AUTH_DB.prepare("UPDATE auth_invites SET used_at=? WHERE id=? AND kind='guest' AND used_at IS NULL AND expires_at>? RETURNING id,created_by").bind(now, id, now).first()
    if (!invite) return jsonError(c, 'La invitación no es válida, ya se usó o expiró. Pide una nueva.', 403)
    const release = () => env.AUTH_DB.prepare('UPDATE auth_invites SET used_at=NULL WHERE id=?').bind(invite.id).run()
    const domain = env.EVIE_AUTH_DOMAIN || 'accounts.evie.local'
    const handle = 'guest-' + [...crypto.getRandomValues(new Uint8Array(6))].map((x) => x.toString(16).padStart(2, '0')).join('')
    const password = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('')
    const email = handle + '@' + domain, base = env.SUPABASE_URL.replace(/\/$/, '')
    let result
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      // Public sign-up (Supabase "Confirm email" off): returns the session directly. No admin key needed.
      const r = await remote(c, '/auth/v1/signup', { method: 'POST', body: { email, password, data: { username: handle, guest: true } } })
      if (!r.ok) { await release(); console.error('GUEST_SIGNUP_REJECTED', r.status); return jsonError(c, 'No se pudo crear el acceso de invitado. Intenta de nuevo.', 502) }
      result = await r.json()
      if (!result?.access_token || !result?.user?.id) { await release(); return jsonError(c, 'Supabase pidió confirmar el correo: desactiva "Confirm email" en Authentication → Providers → Email.', 409) }
    } else {
      let created
      try { created = await fetcher(base + '/auth/v1/admin/users', { method: 'POST', redirect: 'manual', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username: handle, guest: true } }), signal: AbortSignal.timeout(20000) }) } catch { await release(); return jsonError(c, 'El proveedor de cuentas no respondió.', 504) }
      if (!created.ok) { await release(); console.error('GUEST_CREATE_REJECTED', created.status); return jsonError(c, 'No se pudo crear el acceso de invitado. Intenta de nuevo.', 502) }
      const r = await remote(c, '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })
      if (!r.ok) { await release(); return jsonError(c, 'No se pudo iniciar la sesión de invitado.', 502) }
      result = await r.json()
    }
    // Supabase records the guest and sets the 72 h expiry itself (evie_guest_register, called as the guest).
    const reg = await remote(c, '/rest/v1/rpc/evie_guest_register', { method: 'POST', access: result.access_token, body: { display_name: name } })
    if (!reg.ok) { await release(); console.error('GUEST_REGISTER_REJECTED', reg.status); return jsonError(c, 'Supabase no registró al invitado. Aplica la migración 202611220001_guests_sync.', 502) }
    let remoteExpiry = NaN; try { remoteExpiry = Date.parse(await reg.json()) } catch {}
    const expires = Number.isFinite(remoteExpiry) ? Math.min(now + GUEST_MS, remoteExpiry) : now + GUEST_MS
    await env.AUTH_DB.prepare("INSERT INTO guest_accounts(owner_id,display_name,invite_id,created_by,redeemed_at,expires_at,status) VALUES(?,?,?,?,?,?,'active')").bind(result.user.id, name, invite.id, invite.created_by, now, expires).run()
    if (!await issueSession(c, result, handle, { expiresAt: expires })) { await env.AUTH_DB.prepare("UPDATE guest_accounts SET status='expired', expires_at=? WHERE owner_id=?").bind(now, result.user.id).run(); return jsonError(c, 'No se pudo iniciar la sesión de invitado.', 502) }
    await env.AUTH_DB.prepare('UPDATE auth_invites SET used_by=? WHERE id=?').bind(result.user.id, invite.id).run()
    return c.json({ user: { id: result.user.id, username: handle, display_name: name, role: 'guest', expires_at: expires } })
  })
  // Owner: list guests (display name, expiry, cleanup status) — no content.
  api.get('/', async (c) => {
    const [, e] = await owner(c); if (e) return e
    const { results = [] } = await c.env.AUTH_DB.prepare('SELECT owner_id,display_name,redeemed_at,expires_at,status,cleanup_attempts,cleanup_log,cleaned_at FROM guest_accounts ORDER BY redeemed_at DESC LIMIT 50').bind().all()
    return c.json({ guests: results.map((g) => ({ ...g, active: g.status === 'active' && g.expires_at > Date.now() })) })
  })
  // Owner: end a guest's access now (sessions revoked, cleanup runs).
  api.post('/:id/revoke', async (c) => {
    const [, e] = await owner(c); if (e) return e
    const id = c.req.param('id'); if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(c, 'Invitado inválido.')
    const r = await c.env.AUTH_DB.prepare("UPDATE guest_accounts SET status=CASE WHEN status='active' THEN 'expired' ELSE status END, expires_at=MIN(expires_at,?) WHERE owner_id=?").bind(Date.now(), id).run()
    if (!r.meta?.changes) return jsonError(c, 'Ese invitado no existe.', 404)
    const ended = await endRemote(c, id)
    if (!ended) console.error('GUEST_REMOTE_END', 'pending') // Supabase still blocks it at its own 72 h expiry
    await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE owner_id=?').bind(id).run()
    return c.json(await cleanupGuest(c.env, id, { fetcher }))
  })
  // Owner: retry pending/failed cleanups now.
  api.post('/cleanup', async (c) => { const [, e] = await owner(c); if (e) return e; return c.json({ results: await sweepGuests(c.env, { fetcher, max: 10 }) }) })
  return api
}
