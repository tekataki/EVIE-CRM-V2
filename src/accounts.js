import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { bodyLimit } from 'hono/body-limit'
import { createConnections } from './connections.js'
import { createAssistant } from './assistant.js'
import { createKisha } from './kisha.js'
import { createProfile } from './profile.js'

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function normalizeUsername(value) {
  if (typeof value !== 'string') throw new Error('Usuario inválido.')
  const key = value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!/^[a-z0-9._-]{3,24}$/.test(key)) throw new Error('Usuario inválido.')
  return key
}
const encoder = new TextEncoder()
const to64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s) }
const from64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
export async function digest(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(x => x.toString(16).padStart(2,'0')).join('') }
async function encryptionKey(secret) { const raw=from64(secret||''); if(raw.length!==32) throw Error('Configuración de sesión incompleta.'); return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']) }
export async function seal(data, secret) { const iv=crypto.getRandomValues(new Uint8Array(12)); const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(secret),encoder.encode(JSON.stringify(data))); return to64(iv)+'.'+to64(new Uint8Array(encrypted)) }
export async function unseal(data,secret) { const [iv,body]=data.split('.'); const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(iv)},await encryptionKey(secret),from64(body)); return JSON.parse(new TextDecoder().decode(raw)) }
function providerTokens(result) {
 if (!result || typeof result.access_token!=='string' || !result.access_token || result.access_token.length>16384 || typeof result.refresh_token!=='string' || !result.refresh_token || result.refresh_token.length>4096 || !Number.isSafeInteger(result.expires_in) || result.expires_in<1 || result.expires_in>604800) throw Error('Invalid provider session')
 return {access_token:result.access_token,refresh_token:result.refresh_token,expires_at:Date.now()+result.expires_in*1000}
}
const cookie='__Host-evie-session'
const jsonError=(c,message,status=400)=>c.json({error:message},status)


// Self-healing schema: idempotent CREATE IF NOT EXISTS for tables added after 0001 (same SQL as
// migrations/d1/0002 and 0003). Lets an existing deployment upgrade without a manual migration.
const SCHEMA=["CREATE TABLE IF NOT EXISTS auth_accounts (owner_id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')), created_at INTEGER NOT NULL)",
 "CREATE TABLE IF NOT EXISTS auth_invites (id TEXT PRIMARY KEY, created_by TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL, used_at INTEGER, used_by TEXT)",
 "CREATE TABLE IF NOT EXISTS ai_usage (owner_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner_id, day, kind))",
 "CREATE TABLE IF NOT EXISTS provider_tokens (owner_id TEXT NOT NULL, provider TEXT NOT NULL CHECK (provider IN ('google_calendar')), tokens TEXT NOT NULL, scopes TEXT NOT NULL, created_at INTEGER NOT NULL, last_ok INTEGER, error TEXT, PRIMARY KEY (owner_id, provider))",
 "CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, owner_id TEXT NOT NULL, provider TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL)",
 "CREATE INDEX IF NOT EXISTS idx_oauth_states_exp ON oauth_states(expires_at)",
 "CREATE TABLE IF NOT EXISTS user_profiles (owner_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)",
 "CREATE TABLE IF NOT EXISTS kisha_turns (owner_id TEXT NOT NULL, turn_id TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, turn_id))"]
const schemaReady=new WeakMap()
export function ensureSchema(db){if(!db)return Promise.resolve();let p=schemaReady.get(db);if(!p){p=(async()=>{for(const sql of SCHEMA)await db.prepare(sql).bind().run()})().catch(e=>{schemaReady.delete(db);throw e});schemaReady.set(db,p)}return p}
export function createAccounts({fetcher=fetch}={}) {
 const api=new Hono()
 api.use('*',async(c,next)=>{const max=c.req.path.endsWith('/data/push')?16*1024*1024:c.req.path.endsWith('/ai/stt')?4*1024*1024:256*1024;return bodyLimit({maxSize:max,onError:c=>jsonError(c,'La solicitud supera el límite.',413)})(c,next)})
 api.use('*',async(c,next)=>{c.header('Cache-Control','no-store, private');c.header('X-Content-Type-Options','nosniff');await next()})
 api.get('/runtime',c=>c.json({accountsEnabled:c.env?.EVIE_ACCOUNTS_ENABLED==='true',legacyOwnerId:c.env?.EVIE_LEGACY_OWNER_ID||null,inviteOnly:c.env?.EVIE_OPEN_SIGNUP!=='true',ai:{chat:!!c.env?.OPENAI_API_KEY,stt:!!c.env?.GROQ_API_KEY,tts:!!(c.env?.FISH_AUDIO_API_KEY&&c.env?.FISH_AUDIO_VOICE_ID)},providers:{spotify:false,whatsapp:false,instagram:false}}))
 api.use('*',async(c,next)=>{
  const env=c.env||{}
  if(env.EVIE_ACCOUNTS_ENABLED!=='true')return jsonError(c,'Las conexiones externas están desactivadas.',503)
  if(!env.AUTH_DB||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.EVIE_SESSION_KEY)return jsonError(c,'Falta configurar el servicio de cuentas.',503)
  try{const url=new URL(env.SUPABASE_URL);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error()}catch{return jsonError(c,'Configuración de cuentas no válida.',503)}
  if(c.req.method!=='GET'){
   const origin=c.req.header('Origin');const expected=new URL(c.req.url).origin
   if(c.req.header('X-Evie-Request')!=='1'||origin!==expected)return jsonError(c,'Solicitud no autorizada.',403)
   if(!c.req.path.endsWith('/ai/stt')&&c.req.method!=='DELETE'&&!c.req.header('Content-Type')?.startsWith('application/json'))return jsonError(c,'Usa JSON.',415)
  }
  await ensureSchema(env.AUTH_DB)
  await next()
 })
 async function remote(c,path,{method='GET',body,access,headers={}}={}){
  const r=await fetcher(c.env.SUPABASE_URL.replace(/\/$/,'')+path,{method,redirect:'manual',headers:{apikey:c.env.SUPABASE_PUBLISHABLE_KEY,...(access?{Authorization:'Bearer '+access}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)})
  return r
 }
 async function auth(c){
  const raw=getCookie(c,cookie);if(!raw||!/^[0-9a-f]{64}$/.test(raw))return null
  const hash=await digest(raw),record=await c.env.AUTH_DB.prepare('SELECT * FROM auth_sessions WHERE id=? AND expires_at>?').bind(hash,Date.now()).first();if(!record)return null
  let tokens=await unseal(record.tokens,c.env.EVIE_SESSION_KEY)
  if(!Number.isSafeInteger(tokens.expires_at)||typeof tokens.access_token!=='string'||!tokens.access_token||typeof tokens.refresh_token!=='string'||!tokens.refresh_token)throw Error('Invalid stored session')
  if(tokens.expires_at<Date.now()+60000){
   const lease=await c.env.AUTH_DB.prepare('UPDATE auth_sessions SET refresh_until=? WHERE id=? AND refresh_until<? AND tokens=?').bind(Date.now()+25000,hash,Date.now(),record.tokens).run()
   if(!lease.meta.changes){
    // Another request is refreshing this session: wait briefly and reuse its result instead of failing with 503.
    for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,250));const fresh=await c.env.AUTH_DB.prepare('SELECT tokens FROM auth_sessions WHERE id=? AND expires_at>?').bind(hash,Date.now()).first();if(!fresh)return null;if(fresh.tokens!==record.tokens){tokens=await unseal(fresh.tokens,c.env.EVIE_SESSION_KEY);break}}
    if(tokens.expires_at<Date.now())throw Error('Sesión actualizándose.')
   }else{
   try{const r=await remote(c,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:tokens.refresh_token}});if(!r.ok){if(r.status!==400&&r.status!==401)throw Error('Provider refresh unavailable');await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE id=?').bind(hash).run();return null}const t=await r.json();tokens=providerTokens(t);await c.env.AUTH_DB.prepare('UPDATE auth_sessions SET tokens=? WHERE id=?').bind(await seal(tokens,c.env.EVIE_SESSION_KEY),hash).run()}finally{await c.env.AUTH_DB.prepare('UPDATE auth_sessions SET refresh_until=0 WHERE id=?').bind(hash).run()}
   }
  }
  const verified=await remote(c,'/auth/v1/user',{access:tokens.access_token});if(!verified.ok)return null;const u=await verified.json();if(!UUID.test(u.id)||u.id!==record.owner_id)return null
  if(c.req.header('X-Evie-User')&&c.req.header('X-Evie-User')!==u.id)return null
  const acct=await c.env.AUTH_DB.prepare('SELECT role FROM auth_accounts WHERE owner_id=?').bind(u.id).first().catch(()=>null)
  return {id:hash,user:{id:u.id,username:record.username,role:acct?.role||'member'},tokens}
 }
 // Rate limit by IP *and* by username: two people behind the same home IP must not lock each other out.
 async function limited(c,scope,max){
  const period=Math.floor(Date.now()/900000),id=await digest(c.env.EVIE_SESSION_KEY+':'+scope+':'+period)
  const row=await c.env.AUTH_DB.prepare('INSERT INTO auth_attempts(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id,Date.now()+1800000).first()
  return row.count>max
 }
 async function cleanup(c){if(Math.random()<0.1)await c.env.AUTH_DB.prepare('DELETE FROM auth_attempts WHERE expires_at<?').bind(Date.now()).run()}
 function providerMessage(status,code,signup){
  if(status===429||code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return ['El proveedor de cuentas limitó los intentos. Espera unos minutos.',429]
  if(signup&&(code==='user_already_exists'||code==='email_exists'))return ['Ese nombre de usuario ya está en uso. Elige otro.',409]
  if(signup&&code==='weak_password')return ['La contraseña es demasiado débil. Usa una frase más larga.',400]
  if(signup&&(code==='signup_disabled'||code==='email_provider_disabled'))return ['El registro está desactivado en Supabase. Revisa docs/SETUP.md.',503]
  if(!signup&&code==='email_not_confirmed')return ['La cuenta existe pero no está confirmada. Revisa docs/SETUP.md (confirmación de correo).',409]
  return signup?['No se pudo crear la cuenta. Intenta de nuevo.',400]:['Usuario o contraseña no válidos.',401]
 }
 // Logs only status + provider error code, never the body (it may contain emails).
 async function providerError(r){let code='';try{const j=await r.json();code=String(j.error_code||j.code||j.error||'').slice(0,60)}catch{}console.error('SUPABASE_AUTH_REJECTED',r.status,code);return code}
 const accounts=c=>c.env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM auth_accounts').bind().first()
 const release=(c,invite)=>invite?c.env.AUTH_DB.prepare('UPDATE auth_invites SET used_at=NULL WHERE id=?').bind(invite.id).run():null
 async function issueSession(c,result,username){
  let verifiedTokens;try{verifiedTokens=providerTokens(result)}catch{return false}
  const sid=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join(''),expires=Date.now()+30*86400000
  const tokens=await seal(verifiedTokens,c.env.EVIE_SESSION_KEY)
  const old=getCookie(c,cookie);if(old)await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE id=?').bind(await digest(old)).run()
  await c.env.AUTH_DB.prepare('INSERT INTO auth_sessions(id,owner_id,username,tokens,expires_at,refresh_until) VALUES(?,?,?,?,?,0)').bind(await digest(sid),result.user.id,username,tokens,expires).run()
  setCookie(c,cookie,sid,{httpOnly:true,secure:true,sameSite:'Strict',path:'/',maxAge:30*86400})
  return true
 }
 async function enter(c,signup){
  let data;try{data=await c.req.json();const keys=Object.keys(data).sort().join(',');if(keys!=='password,username'&&!(signup&&keys==='invite,password,username'))throw Error();data.username=normalizeUsername(data.username);if(typeof data.password!=='string'||data.password.length<10||data.password.length>128)throw Error();if(data.invite!==undefined&&(typeof data.invite!=='string'||data.invite.length<8||data.invite.length>128))throw Error()}catch{return jsonError(c,'Revisa el usuario y la contraseña (10–128 caracteres).')}
  const ip=c.req.header('CF-Connecting-IP')||'local'
  if(await limited(c,'ip:'+ip,30)||await limited(c,'user:'+data.username,8))return jsonError(c,'Demasiados intentos. Espera 15 minutos.',429)
  await cleanup(c)
  const domain=c.env.EVIE_AUTH_DOMAIN||'accounts.evie.local';if(!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))return jsonError(c,'Dominio de cuentas no válido.',503)
  const email=data.username+'@'+domain
  let invite=null,role='member'
  if(signup){
   // Closed registration: only an owner-issued invite, or the very first account with EVIE_BOOTSTRAP_TOKEN.
   const n=(await accounts(c))?.n||0
   if(typeof data.invite==='string'&&c.env.EVIE_BOOTSTRAP_TOKEN&&n===0&&data.invite===c.env.EVIE_BOOTSTRAP_TOKEN)role='owner'
   else if(typeof data.invite==='string'){
    const id=await digest('invite:'+data.invite.trim().toUpperCase())
    invite=await c.env.AUTH_DB.prepare('UPDATE auth_invites SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? RETURNING id').bind(Date.now(),id,Date.now()).first()
    if(!invite)return jsonError(c,'La invitación no es válida, ya se usó o expiró. Pide una nueva.',403)
   }else if(c.env.EVIE_OPEN_SIGNUP!=='true')return jsonError(c,'El registro es solo por invitación. Pide un código a quien administra EVIE.',403)
   else if(n===0)role='owner'
  }
  let r
  if(signup&&c.env.SUPABASE_SERVICE_ROLE_KEY){
   // Admin creation with email_confirm: synthetic addresses never need a confirmation email (fixes 422/429/null session).
   const created=await fetcher(c.env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/admin/users',{method:'POST',redirect:'manual',headers:{apikey:c.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+c.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password:data.password,email_confirm:true,user_metadata:{username:data.username}}),signal:AbortSignal.timeout(20000)})
   if(!created.ok){const code=await providerError(created);await release(c,invite);const [m,st]=providerMessage(created.status,code,true);return jsonError(c,m,st)}
   r=await remote(c,'/auth/v1/token?grant_type=password',{method:'POST',body:{email,password:data.password}})
  }else r=await remote(c,signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{method:'POST',body:{email,password:data.password,...(signup?{data:{username:data.username}}:{})}})
  data.password=''
  if(!r.ok){const code=await providerError(r);await release(c,invite);const [m,st]=providerMessage(r.status,code,signup);return jsonError(c,m,st)}
  const result=await r.json()
  if(!UUID.test(result.user?.id)){await release(c,invite);return jsonError(c,'Supabase no devolvió una sesión: desactiva "Confirm email" o configura SUPABASE_SERVICE_ROLE_KEY (docs/SETUP.md).',409)}
  if(!await issueSession(c,result,data.username)){await release(c,invite);return jsonError(c,'Supabase no devolvió una sesión: desactiva "Confirm email" o configura SUPABASE_SERVICE_ROLE_KEY (docs/SETUP.md).',409)}
  if(invite)await c.env.AUTH_DB.prepare('UPDATE auth_invites SET used_by=? WHERE id=?').bind(result.user.id,invite.id).run()
  if(signup||role==='owner')await c.env.AUTH_DB.prepare('INSERT INTO auth_accounts(owner_id,username,role,created_at) VALUES(?,?,?,?) ON CONFLICT(owner_id) DO NOTHING').bind(result.user.id,data.username,role,Date.now()).run()
  const acct=await c.env.AUTH_DB.prepare('SELECT role FROM auth_accounts WHERE owner_id=?').bind(result.user.id).first()
  return c.json({user:{id:result.user.id,username:data.username,role:acct?.role||'member'}})
 }
 api.post('/auth/signup',c=>enter(c,true));api.post('/auth/signin',c=>enter(c,false))
 const verified=async c=>{const s=await auth(c);return s&&c.req.header('X-Evie-User')===s.user.id?s:null}
 const owner=async c=>{const s=await verified(c);if(!s)return [null,jsonError(c,'Inicia sesión de nuevo.',401)];if(s.user.role!=='owner')return [null,jsonError(c,'Solo el propietario puede administrar personas.',403)];return [s,null]}
 // Existing accounts (created before invitations) can claim ownership once with the bootstrap token.
 api.post('/auth/claim-owner',async c=>{const s=await verified(c);if(!s)return jsonError(c,'Inicia sesión de nuevo.',401);let b;try{b=await c.req.json()}catch{b={}}
  if(!c.env.EVIE_BOOTSTRAP_TOKEN||typeof b?.token!=='string'||b.token!==c.env.EVIE_BOOTSTRAP_TOKEN)return jsonError(c,'Código de propietario no válido.',403)
  const existing=await c.env.AUTH_DB.prepare("SELECT owner_id FROM auth_accounts WHERE role='owner'").bind().first();if(existing&&existing.owner_id!==s.user.id)return jsonError(c,'Ya existe un propietario.',409)
  await c.env.AUTH_DB.prepare("INSERT INTO auth_accounts(owner_id,username,role,created_at) VALUES(?,?,'owner',?) ON CONFLICT(owner_id) DO UPDATE SET role='owner'").bind(s.user.id,s.user.username,Date.now()).run();return c.json({ok:true,role:'owner'})})
 api.post('/auth/invites',async c=>{const [s,e]=await owner(c);if(e)return e;let b;try{b=await c.req.json()}catch{return jsonError(c,'Solicitud inválida.')}const label=typeof b?.label==='string'?b.label.trim().slice(0,40):''
  const pending=await c.env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM auth_invites WHERE used_at IS NULL AND expires_at>?').bind(Date.now()).first();if(pending.n>=5)return jsonError(c,'Ya tienes 5 invitaciones activas. Revócalas primero.',429)
  const code=[...crypto.getRandomValues(new Uint8Array(12))].map(x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('').replace(/(.{4})(?=.)/g,'$1-')
  const expires=Date.now()+72*3600000;await c.env.AUTH_DB.prepare('INSERT INTO auth_invites(id,created_by,label,expires_at) VALUES(?,?,?,?)').bind(await digest('invite:'+code),s.user.id,label,expires).run()
  return c.json({code,expires_at:expires,label})})
 api.get('/auth/members',async c=>{const [,e]=await owner(c);if(e)return e;const members=await c.env.AUTH_DB.prepare('SELECT username,role,created_at FROM auth_accounts ORDER BY created_at').bind().all();const invites=await c.env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM auth_invites WHERE used_at IS NULL AND expires_at>?').bind(Date.now()).first();return c.json({members:members.results||[],activeInvites:invites.n})})
 api.post('/auth/invites/revoke',async c=>{const [,e]=await owner(c);if(e)return e;await c.env.AUTH_DB.prepare('DELETE FROM auth_invites WHERE used_at IS NULL').bind().run();return c.json({ok:true})})
 api.post('/auth/password',async c=>{const s=await verified(c);if(!s)return jsonError(c,'Inicia sesión de nuevo.',401);let b;try{b=await c.req.json();if(Object.keys(b).join()!=='password'||typeof b.password!=='string'||b.password.length<10||b.password.length>128)throw Error()}catch{return jsonError(c,'Usa una contraseña de 10 a 128 caracteres.')}
  const r=await remote(c,'/auth/v1/user',{method:'PUT',access:s.tokens.access_token,body:{password:b.password}});b.password='';if(!r.ok){const code=await providerError(r);return jsonError(c,code==='same_password'?'La nueva contraseña debe ser distinta.':'No se pudo cambiar la contraseña.',400)}return c.json({ok:true})})
 api.get('/auth/session',async c=>{const s=await auth(c);return c.json({user:s?.user||null})})
 api.post('/auth/signout',async c=>{let body;try{body=await c.req.json();if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='all')||(body.all!==undefined&&typeof body.all!=='boolean'))throw Error()}catch{return jsonError(c,'Solicitud de cierre inválida.')}
  const s=await auth(c);if((s&&c.req.header('X-Evie-User')!==s.user.id)||(!s&&(body.all===true||c.req.header('X-Evie-User'))))return jsonError(c,'No se pudo verificar la sesión para cerrar. Vuelve a autenticarte.',401);if(s){if(body.all===true){const r=await remote(c,'/auth/v1/logout?scope=global',{method:'POST',access:s.tokens.access_token});if(!r.ok)return jsonError(c,'No se pudieron cerrar las sesiones remotas.',502);await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE owner_id=?').bind(s.user.id).run()}else await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE id=?').bind(s.id).run()}deleteCookie(c,cookie,{secure:true,path:'/'});return c.json({ok:true})})
 api.use('/data/*',async(c,next)=>{const s=await auth(c);if(!s||c.req.header('X-Evie-User')!==s.user.id)return jsonError(c,'La sesión cambió. Inicia sesión de nuevo.',401);c.set('account',s);await next()})
 api.post('/data/pull',async c=>{const s=c.get('account'),b=await c.req.json();if(!b||typeof b.after!=='string'||b.after.length>200||Object.keys(b).some(k=>k!=='after'))return jsonError(c,'Cursor inválido.');const r=await remote(c,'/rest/v1/rpc/evie_pull',{method:'POST',access:s.tokens.access_token,body:{after_key:b.after}});if(!r.ok)return jsonError(c,'No se pudo leer la cuenta.',502);const rows=await r.json();return c.json({owner:s.user.id,rows,next:rows.length===500?rows.at(-1).collection+'/'+rows.at(-1).record_id:''})})
 api.post('/data/push',async c=>{const s=c.get('account'),b=await c.req.json();if(!b||!Array.isArray(b.changes)||!b.changes.length||b.changes.length>5000||Object.keys(b).some(k=>k!=='changes'))return jsonError(c,'Lote de 1 a 5000 cambios requerido.');const r=await remote(c,'/rest/v1/rpc/evie_apply',{method:'POST',access:s.tokens.access_token,body:{changes:b.changes}});if(!r.ok)return jsonError(c,r.status===409?'Otro dispositivo cambió estos registros.':'No se pudieron guardar los cambios.',r.status===409?409:422);return c.json({owner:s.user.id,rows:await r.json()})})
 api.route('/connections',createConnections({fetcher,seal,unseal,authenticate:async c=>{const s=await auth(c);return s&&c.req.header('X-Evie-User')===s.user.id?s:null}}))
 const bound=async c=>{const s=await auth(c);return s&&c.req.header('X-Evie-User')===s.user.id?s:null}
 api.route('/profile',createProfile({authenticate:bound,seal,unseal}))
 api.route('/ai',createAssistant({fetcher,authenticate:bound,unseal}))
 api.route('/kisha',createKisha({fetcher,authenticate:bound,seal,unseal}))
 api.onError((err,c)=>{
  console.error('EVIE_ACCOUNTS_ERROR', err?.stack || err?.message || String(err))
  return jsonError(c,'Servicio temporalmente no disponible. No se han descartado cambios locales.',503)
 })
 return api
}
