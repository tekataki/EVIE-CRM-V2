import sys
p='src/accounts.js';s=open(p).read()
if 'createGuests' in s: print('already'); sys.exit()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt,(old[:80],s.count(old)); s=s.replace(old,new)
rep("import { createProfile } from './profile.js'\n","import { createProfile } from './profile.js'\nimport { ensureV5 } from './v5-schema.js'\nimport { createGuests, guestOf, sweepGuests, GUEST_MS } from './guests.js'\nimport { createV5 } from './v5-routes.js'\n")
rep("  await ensureSchema(env.AUTH_DB)\n  await next()\n })",
"""  await ensureSchema(env.AUTH_DB)
  await ensureV5(env.AUTH_DB)
  // Lazy guest expiry sweep (hosted deploys have no cron): ~5% of requests, off the response path.
  if(Math.random()<0.05){const p=sweepGuests(env,{fetcher}).catch(e=>console.error('GUEST_SWEEP',String(e?.message||e).slice(0,60)));try{c.executionCtx.waitUntil(p)}catch{}}
  await next()
 })""")
rep("  const hash=await digest(raw),record=await c.env.AUTH_DB.prepare('SELECT * FROM auth_sessions WHERE id=? AND expires_at>?').bind(hash,Date.now()).first();if(!record)return null\n",
"""  const hash=await digest(raw),record=await c.env.AUTH_DB.prepare('SELECT * FROM auth_sessions WHERE id=? AND expires_at>?').bind(hash,Date.now()).first();if(!record)return null
  // Temporary guests: access ends exactly at expires_at (72 h after redemption). Enforced on every request,
  // BEFORE any token refresh; all of the guest's sessions are revoked and the cleanup sweep picks it up.
  const guest=await guestOf(c.env.AUTH_DB,record.owner_id)
  if(guest?.expired){await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE owner_id=?').bind(record.owner_id).run();await c.env.AUTH_DB.prepare("UPDATE guest_accounts SET status='expired' WHERE owner_id=? AND status='active'").bind(record.owner_id).run();return null}
""")
rep("  const acct=await c.env.AUTH_DB.prepare('SELECT role FROM auth_accounts WHERE owner_id=?').bind(u.id).first().catch(()=>null)\n  return {id:hash,user:{id:u.id,username:record.username,role:acct?.role||'member'},tokens}",
"""  if(guest)return {id:hash,user:{id:u.id,username:record.username,role:'guest',display_name:guest.display_name,expires_at:guest.expires_at},tokens}
  const acct=await c.env.AUTH_DB.prepare('SELECT role FROM auth_accounts WHERE owner_id=?').bind(u.id).first().catch(()=>null)
  return {id:hash,user:{id:u.id,username:record.username,role:acct?.role||'member'},tokens}""")
rep(""" async function issueSession(c,result,username){
  let verifiedTokens;try{verifiedTokens=providerTokens(result)}catch{return false}
  const sid=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join(''),expires=Date.now()+30*86400000""",
""" async function issueSession(c,result,username,{expiresAt=null}={}){
  let verifiedTokens;try{verifiedTokens=providerTokens(result)}catch{return false}
  // A guest's session can never outlive the guest account (<= 72 h); everyone else keeps 30 days.
  const g=expiresAt?null:await guestOf(c.env.AUTH_DB,result.user.id).catch(()=>null)
  if(g?.expired)return false
  const sid=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join(''),expires=Math.min(Date.now()+30*86400000,expiresAt||g?.expires_at||Infinity)""")
rep("  setCookie(c,cookie,sid,{httpOnly:true,secure:true,sameSite:'Strict',path:'/',maxAge:30*86400})",
"  setCookie(c,cookie,sid,{httpOnly:true,secure:true,sameSite:'Strict',path:'/',maxAge:Math.max(60,Math.floor((expires-Date.now())/1000))})")
rep("    invite=await c.env.AUTH_DB.prepare('UPDATE auth_invites SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? RETURNING id').bind(Date.now(),id,Date.now()).first()\n    if(!invite)return jsonError(c,'La invitación no es válida, ya se usó o expiró. Pide una nueva.',403)",
"""    invite=await c.env.AUTH_DB.prepare("UPDATE auth_invites SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? AND kind<>'guest' RETURNING id").bind(Date.now(),id,Date.now()).first()
    if(!invite){const g=await c.env.AUTH_DB.prepare("SELECT 1 AS x FROM auth_invites WHERE id=? AND kind='guest'").bind(id).first();return jsonError(c,g?'Ese código es de invitado temporal: usa «Entrar con invitación» (solo tu nombre, sin contraseña).':'La invitación no es válida, ya se usó o expiró. Pide una nueva.',403)}""")
rep(" const owner=async c=>{",""" const notGuest=async c=>{const s=await verified(c);if(!s)return [null,jsonError(c,'Inicia sesión de nuevo.',401)];if(s.user.role==='guest')return [null,jsonError(c,'Esta función no está disponible para invitados.',403)];return [s,null]}
 const owner=async c=>{""")
rep("""  const code=[...crypto.getRandomValues(new Uint8Array(12))].map(x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('').replace(/(.{4})(?=.)/g,'$1-')
  const expires=Date.now()+72*3600000;await c.env.AUTH_DB.prepare('INSERT INTO auth_invites(id,created_by,label,expires_at) VALUES(?,?,?,?)').bind(await digest('invite:'+code),s.user.id,label,expires).run()
  return c.json({code,expires_at:expires,label})})""",
"""  const kind=b?.kind==='guest'?'guest':'member'
  const code=[...crypto.getRandomValues(new Uint8Array(12))].map(x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('').replace(/(.{4})(?=.)/g,'$1-')
  // Unused code expires 72 h after creation (independent of the guest account's own 72 h, which starts at redemption).
  const expires=Date.now()+72*3600000;await c.env.AUTH_DB.prepare('INSERT INTO auth_invites(id,created_by,label,expires_at,kind) VALUES(?,?,?,?,?)').bind(await digest('invite:'+code),s.user.id,label,expires,kind).run()
  return c.json({code,expires_at:expires,label,kind,access_hours:kind==='guest'?GUEST_MS/3600000:null})})""")
rep("const invites=await c.env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM auth_invites WHERE used_at IS NULL AND expires_at>?').bind(Date.now()).first();return c.json({members:members.results||[],activeInvites:invites.n})})",
"const invites=await c.env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM auth_invites WHERE used_at IS NULL AND expires_at>?').bind(Date.now()).first();const guests=await c.env.AUTH_DB.prepare(\"SELECT COUNT(*) AS n FROM guest_accounts WHERE status='active' AND expires_at>?\").bind(Date.now()).first();return c.json({members:members.results||[],activeInvites:invites.n,activeGuests:guests?.n||0})})")
rep(" api.post('/auth/claim-owner',async c=>{const s=await verified(c);if(!s)return jsonError(c,'Inicia sesión de nuevo.',401);",
    " api.post('/auth/claim-owner',async c=>{const [s,ge]=await notGuest(c);if(ge)return ge;")
rep(" api.post('/auth/password',async c=>{const s=await verified(c);if(!s)return jsonError(c,'Inicia sesión de nuevo.',401);",
    " api.post('/auth/password',async c=>{const [s,ge]=await notGuest(c);if(ge)return ge;")
rep(" api.route('/connections',createConnections({fetcher,seal,unseal,authenticate:async c=>{const s=await auth(c);return s&&c.req.header('X-Evie-User')===s.user.id?s:null}}))",
    " api.route('/connections',createConnections({fetcher,seal,unseal,authenticate:async c=>{const s=await auth(c);return s&&c.req.header('X-Evie-User')===s.user.id&&s.user.role!=='guest'?s:null}}))")
rep(" api.route('/auth/google',createGoogleAuth({remote,issueSession,verified,seal,unseal,digest,limited}))",
    " api.route('/auth/google',createGoogleAuth({remote,issueSession,verified:async c=>{const s=await verified(c);return s&&s.user.role!=='guest'?s:null},seal,unseal,digest,limited}))\n api.route('/auth/guest',createGuests({fetcher,remote,issueSession,digest,limited,owner}))\n api.route('/',createV5({authenticate:bound,seal,unseal}))")
open(p,'w').write(s); print('patched')
