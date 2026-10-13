// Google sign-in through Supabase Auth (server-side PKCE). Security rules:
// - A Google identity only opens an EXISTING EVIE account (one that linked Google while signed in),
//   or creates one when the person presents a valid invitation / the bootstrap code for the first owner.
// - A random Google account is never given access; matching email addresses are never used to merge
//   identities (EVIE's legacy accounts use synthetic addresses).
// - Linking is explicit: a signed-in user starts "link", and the callback must return the SAME user id.
// - Desktop: the system browser finishes OAuth and returns a one-time code to evie-crm://auth; the app
//   redeems it with a secret nonce only it knows. Google login grants no Calendar/Gmail scopes.
import { Hono } from 'hono'

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const rand = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)))
export async function s256(v) { return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)))) }
export function usernameFrom(email, taken) {
  const base = (String(email || '').split('@')[0] || 'usuario').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 18) || 'usuario'
  let name = base.length >= 3 ? base : (base + 'evie').slice(0, 18), i = 1
  while (taken.has(name)) name = base.slice(0, 18) + '-' + (++i)
  return name
}

export function createGoogleAuth({ remote, issueSession, verified, seal, unseal, digest, limited }) {
  const api = new Hono()
  const enabled = (env) => env.EVIE_GOOGLE_AUTH === 'true'
  const origin = (c) => (c.env.EVIE_PUBLIC_ORIGIN || new URL(c.req.url).origin).replace(/\/$/, '')
  const callback = (c) => origin(c) + '/api/auth/google/callback'
  const db = (c) => c.env.AUTH_DB
  const back = (c, status) => c.redirect(origin(c) + '/?google=' + status + '#inicio', 302)

  api.post('/start', async (c) => {
    if (!enabled(c.env)) return c.json({ error: 'El acceso con Google no está activado en este servidor (EVIE_GOOGLE_AUTH).' }, 503)
    let b; try { b = await c.req.json() } catch { b = {} }
    const mode = ['signin', 'link'].includes(b?.mode) ? b.mode : null
    if (!mode) return c.json({ error: 'Modo inválido.' }, 400)
    const ip = c.req.header('CF-Connecting-IP') || 'local'
    if (await limited(c, 'google:' + ip, 20)) return c.json({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429)
    const invite = typeof b.invite === 'string' && b.invite.trim().length >= 8 && b.invite.length <= 128 ? b.invite.trim() : null
    const desktop = typeof b.desktop_nonce_hash === 'string' && /^[A-Za-z0-9_-]{43}$/.test(b.desktop_nonce_hash) ? b.desktop_nonce_hash : null
    let owner = null, access = null
    if (mode === 'link') { const s = await verified(c); if (!s) return c.json({ error: 'Inicia sesión para vincular Google.' }, 401); owner = s.user.id; access = s.tokens.access_token }
    const state = rand(24), verifier = rand(48), challenge = await s256(verifier)
    await db(c).prepare('DELETE FROM google_auth_states WHERE expires_at<?').bind(Date.now()).run()
    await db(c).prepare('INSERT INTO google_auth_states(state,data,expires_at) VALUES(?,?,?)').bind(await digest('gstate:' + state), await seal({ verifier, mode, owner, invite, desktop }, c.env.EVIE_SESSION_KEY), Date.now() + 600000).run()
    const redirect = callback(c) + '?s=' + state
    const q = new URLSearchParams({ provider: 'google', redirect_to: redirect, code_challenge: challenge, code_challenge_method: 's256', scopes: 'openid email profile' })
    if (mode === 'link') {
      q.set('skip_http_redirect', 'true')
      const r = await remote(c, '/auth/v1/user/identities/authorize?' + q, { access })
      if (!r.ok) return c.json({ error: r.status === 404 || r.status === 422 ? 'Activa "Manual linking" en Supabase → Authentication → Sign In / Providers.' : 'Supabase no permitió vincular Google.' }, 502)
      const j = await r.json(); if (!/^https:\/\//.test(j?.url || '')) return c.json({ error: 'Supabase no devolvió la URL de Google.' }, 502)
      return c.json({ url: j.url })
    }
    return c.json({ url: c.env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/authorize?' + q })
  })

  api.get('/callback', async (c) => {
    if (!enabled(c.env)) return back(c, 'disabled')
    const state = c.req.query('s') || '', code = c.req.query('code') || ''
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(state)) return back(c, 'invalid')
    if (!code && c.req.query('error')) { if (state) await db(c).prepare('DELETE FROM google_auth_states WHERE state=?').bind(await digest('gstate:' + state)).run(); return back(c, 'denied') }
    const row = await db(c).prepare('DELETE FROM google_auth_states WHERE state=? AND expires_at>? RETURNING data').bind(await digest('gstate:' + state), Date.now()).first()
    if (!row) return back(c, 'expired')
    const st = await unseal(row.data, c.env.EVIE_SESSION_KEY)
    if (!code || code.length > 600) return back(c, c.req.query('error') ? 'cancelled' : 'invalid')
    const r = await remote(c, '/auth/v1/token?grant_type=pkce', { method: 'POST', body: { auth_code: code, code_verifier: st.verifier } })
    if (!r.ok) return back(c, 'exchange')
    const result = await r.json(), id = result?.user?.id
    const google = (result.user?.identities || []).find((x) => x.provider === 'google')
    const email = String(google?.identity_data?.email || result.user?.email || '').slice(0, 200)
    if (!id) return back(c, 'exchange')
    let acct = await db(c).prepare('SELECT owner_id,username,role FROM auth_accounts WHERE owner_id=?').bind(id).first()
    if (st.mode === 'link') {
      // The identity must have been attached to the SAME signed-in account. Anything else is refused.
      if (id !== st.owner || !acct) return back(c, 'link_mismatch')
      await db(c).prepare('INSERT INTO google_links(owner_id,email,linked_at) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET email=excluded.email,linked_at=excluded.linked_at').bind(id, email, Date.now()).run()
    } else if (!acct) {
      const n = (await db(c).prepare('SELECT COUNT(*) AS n FROM auth_accounts').bind().first())?.n || 0
      let role = null
      if (st.invite && c.env.EVIE_BOOTSTRAP_TOKEN && n === 0 && st.invite === c.env.EVIE_BOOTSTRAP_TOKEN) role = 'owner'
      else if (st.invite) { const invite = await db(c).prepare('UPDATE auth_invites SET used_at=?,used_by=? WHERE id=? AND used_at IS NULL AND expires_at>? RETURNING id').bind(Date.now(), id, await digest('invite:' + st.invite.toUpperCase()), Date.now()).first(); if (invite) role = 'member' }
      if (!role) {
        // Not invited: no EVIE session. Remove the orphan Supabase user when the admin key exists.
        if (c.env.SUPABASE_SERVICE_ROLE_KEY) await remote(c, '/auth/v1/admin/users/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + c.env.SUPABASE_SERVICE_ROLE_KEY, apikey: c.env.SUPABASE_SERVICE_ROLE_KEY } }).catch(() => null)
        return back(c, 'not_invited')
      }
      const taken = new Set(((await db(c).prepare('SELECT username FROM auth_accounts').bind().all()).results || []).map((x) => x.username))
      const username = usernameFrom(email, taken)
      await db(c).prepare('INSERT INTO auth_accounts(owner_id,username,role,created_at) VALUES(?,?,?,?) ON CONFLICT(owner_id) DO NOTHING').bind(id, username, role, Date.now()).run()
      await db(c).prepare('INSERT INTO google_links(owner_id,email,linked_at) VALUES(?,?,?) ON CONFLICT(owner_id) DO NOTHING').bind(id, email, Date.now()).run()
      acct = { owner_id: id, username, role, created: true }
    } else {
      const linked = await db(c).prepare('SELECT owner_id FROM google_links WHERE owner_id=?').bind(id).first()
      if (!linked) return back(c, 'not_linked')
    }
    if (st.desktop) {
      const handoff = rand(32)
      await db(c).prepare('DELETE FROM desktop_handoffs WHERE expires_at<?').bind(Date.now()).run()
      await db(c).prepare('INSERT INTO desktop_handoffs(code,data,expires_at) VALUES(?,?,?)').bind(await digest('handoff:' + handoff), await seal({ result: { user: { id }, access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in }, username: acct.username, nonce: st.desktop }, c.env.EVIE_SESSION_KEY), Date.now() + 120000).run()
      return c.html(`<!doctype html><meta charset="utf-8"><title>EVIE</title><body style="font-family:system-ui;background:#0b1020;color:#e8ecff;display:grid;place-items:center;height:100vh"><main><h1>Listo</h1><p>Vuelve a EVIE para Windows. Si no se abrió sola, <a style="color:#9fb4ff" href="evie-crm://auth?code=${handoff}">toca aquí</a>.</p></main><script>location.href='evie-crm://auth?code=${handoff}'</script>`)
    }
    if (!await issueSession(c, result, acct.username)) return back(c, 'exchange')
    if (acct.created) {
      // New invited account → onboarding. The name is only a prefill hint in the fragment (not sent to servers).
      const meta = result.user?.user_metadata || {}, gname = String(google?.identity_data?.full_name || meta.full_name || meta.name || '').trim().slice(0, 60)
      return c.redirect(origin(c) + '/?google=new#inicio' + (gname ? '&gn=' + encodeURIComponent(gname) : ''), 302)
    }
    return back(c, st.mode === 'link' ? 'linked' : 'ok')
  })

  // Desktop only: exchange the deep-link code + the secret nonce for a session cookie in the app's partition.
  api.post('/redeem', async (c) => {
    let b; try { b = await c.req.json() } catch { b = {} }
    if (typeof b?.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(b.code) || typeof b.nonce !== 'string' || !/^[A-Za-z0-9_-]{43,64}$/.test(b.nonce)) return c.json({ error: 'Código inválido.' }, 400)
    const row = await db(c).prepare('DELETE FROM desktop_handoffs WHERE code=? AND expires_at>? RETURNING data').bind(await digest('handoff:' + b.code), Date.now()).first()
    if (!row) return c.json({ error: 'El código expiró. Vuelve a entrar con Google.' }, 401)
    const h = await unseal(row.data, c.env.EVIE_SESSION_KEY)
    if (h.nonce !== await s256(b.nonce)) return c.json({ error: 'Este código no pertenece a esta app.' }, 403)
    if (!await issueSession(c, h.result, h.username)) return c.json({ error: 'No se pudo abrir la sesión.' }, 409)
    const acct = await db(c).prepare('SELECT role FROM auth_accounts WHERE owner_id=?').bind(h.result.user.id).first()
    return c.json({ user: { id: h.result.user.id, username: h.username, role: acct?.role || 'member' } })
  })

  api.get('/status', async (c) => {
    const s = await verified(c); if (!s) return c.json({ error: 'Inicia sesión.' }, 401)
    const me = await db(c).prepare('SELECT email,linked_at FROM google_links WHERE owner_id=?').bind(s.user.id).first()
    const total = (await db(c).prepare('SELECT COUNT(*) AS n FROM auth_accounts').bind().first())?.n || 0
    const linked = (await db(c).prepare('SELECT COUNT(*) AS n FROM google_links l JOIN auth_accounts a ON a.owner_id=l.owner_id').bind().first())?.n || 0
    return c.json({ enabled: enabled(c.env), linked: !!me, email: me?.email || null, linked_at: me?.linked_at || null, all_linked: total > 0 && linked === total, ...(s.user.role === 'owner' ? { accounts: total, accounts_linked: linked } : {}) })
  })
  return api
}
