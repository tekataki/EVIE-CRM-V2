// "Configuración personalizada": optional per-user profile. Keyed ONLY by the authenticated session's
// owner id (never a client-supplied id), sealed with AES-GCM (EVIE_SESSION_KEY) because it may hold
// health data. Users can read, replace, export and delete their own profile.
import { Hono } from 'hono'
import { cleanProfile } from './assistant.js'

export async function readProfile(env, owner, unseal) {
  if (!env?.AUTH_DB || !owner) return null
  const row = await env.AUTH_DB.prepare('SELECT data FROM user_profiles WHERE owner_id=?').bind(owner).first()
  if (!row?.data) return null
  try { return cleanProfile(await unseal(row.data, env.EVIE_SESSION_KEY)) } catch { return null }
}

export function createProfile({ authenticate, seal, unseal }) {
  const api = new Hono()
  const err = (c, m, s = 400) => c.json({ error: m }, s)
  api.get('/', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    return c.json({ profile: (await readProfile(c.env, s.user.id, unseal)) || null })
  })
  api.put('/', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    let b; try { b = await c.req.json() } catch { return err(c, 'JSON inválido.') }
    if (!b || typeof b !== 'object' || Array.isArray(b) || 'owner_id' in b || 'user_id' in b) return err(c, 'Perfil inválido.')
    const profile = cleanProfile(b.profile ?? b)
    const sealed = await seal(profile, c.env.EVIE_SESSION_KEY)
    if (sealed.length > 16000) return err(c, 'El perfil es demasiado largo.', 413)
    await c.env.AUTH_DB.prepare('INSERT INTO user_profiles(owner_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(s.user.id, sealed, Date.now()).run()
    return c.json({ profile })
  })
  api.delete('/', async (c) => {
    const s = await authenticate(c); if (!s) return err(c, 'Inicia sesión.', 401)
    await c.env.AUTH_DB.prepare('DELETE FROM user_profiles WHERE owner_id=?').bind(s.user.id).run()
    return c.json({ deleted: true })
  })
  return api
}
