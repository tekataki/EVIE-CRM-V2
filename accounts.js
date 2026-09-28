import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { bodyLimit } from 'hono/body-limit'

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

export function createAccounts({fetcher=fetch}={}) {
 const api=new Hono()
 api.use('*',bodyLimit({maxSize:16*1024*1024,onError:c=>jsonError(c,'La solicitud supera el límite.',413)}))
 api.use('*',async(c,next)=>{c.header('Cache-Control','no-store, private');c.header('X-Content-Type-Options','nosniff');await next()})
 api.get('/runtime',c=>c.json({accountsEnabled:c.env?.EVIE_ACCOUNTS_ENABLED==='true',legacyOwnerId:c.env?.EVIE_LEGACY_OWNER_ID||null,providers:{spotify:false,whatsapp:false,instagram:false}}))
 api.use('*',async(c,next)=>{
  const env=c.env||{}
  if(env.EVIE_ACCOUNTS_ENABLED!=='true')return jsonError(c,'Las conexiones externas están desactivadas.',503)
  if(!env.AUTH_DB||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.EVIE_SESSION_KEY)return jsonError(c,'Falta configurar el servicio de cuentas.',503)
  try{const url=new URL(env.SUPABASE_URL);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error()}catch{return jsonError(c,'Configuración de cuentas no válida.',503)}
  if(c.req.method!=='GET'){
   const origin=c.req.header('Origin');const expected=new URL(c.req.url).origin
   if(c.req.header('X-Evie-Request')!=='1'||origin!==expected)return jsonError(c,'Solicitud no autorizada.',403)
   if(!c.req.header('Content-Type')?.startsWith('application/json'))return jsonError(c,'Usa JSON.',415)
  }
  await next()
 })
 async function remote(c,path,{method='GET',body,access,headers={}}={}){
  const r=await fetcher(c.env.SUPABASE_URL.replace(/\/$/,'')+path,{method,redirect:'error',headers:{apikey:c.env.SUPABASE_PUBLISHABLE_KEY,...(access?{Authorization:'Bearer '+access}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)})
  return r
 }
 async function auth(c){
  const raw=getCookie(c,cookie);if(!raw||!/^[0-9a-f]{64}$/.test(raw))return null
  const hash=await digest(raw),record=await c.env.AUTH_DB.prepare('SELECT * FROM auth_sessions WHERE id=? AND expires_at>?').bind(hash,Date.now()).first();if(!record)return null
  let tokens=await unseal(record.tokens,c.env.EVIE_SESSION_KEY)
  if(!Number.isSafeInteger(tokens.expires_at)||typeof tokens.access_token!=='string'||!tokens.access_token||typeof tokens.refresh_token!=='string'||!tokens.refresh_token)throw Error('Invalid stored session')
  if(tokens.expires_at<Date.now()+60000){
   const lease=await c.env.AUTH_DB.prepare('UPDATE auth_sessions SET refresh_until=? WHERE id=? AND refresh_until<? AND tokens=?').bind(Date.now()+25000,hash,Date.now(),record.tokens).run();if(!lease.meta.changes)throw Error('Sesión actualizándose.')
   try{const r=await remote(c,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:tokens.refresh_token}});if(!r.ok){if(r.status!==400&&r.status!==401)throw Error('Provider refresh unavailable');await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE id=?').bind(hash).run();return null}const t=await r.json();tokens=providerTokens(t);await c.env.AUTH_DB.prepare('UPDATE auth_sessions SET tokens=? WHERE id=?').bind(await seal(tokens,c.env.EVIE_SESSION_KEY),hash).run()}finally{await c.env.AUTH_DB.prepare('UPDATE auth_sessions SET refresh_until=0 WHERE id=?').bind(hash).run()}
  }
  const verified=await remote(c,'/auth/v1/user',{access:tokens.access_token});if(!verified.ok)return null;const u=await verified.json();if(!UUID.test(u.id)||u.id!==record.owner_id)return null
  if(c.req.header('X-Evie-User')&&c.req.header('X-Evie-User')!==u.id)return null
  return {id:hash,user:{id:u.id,username:record.username},tokens}
 }
 async function enter(c,signup){
  let data;try{data=await c.req.json();if(Object.keys(data).sort().join(',')!=='password,username')throw Error();data.username=normalizeUsername(data.username);if(typeof data.password!=='string'||data.password.length<10||data.password.length>128)throw Error()}catch{return jsonError(c,'Revisa el usuario y la contraseña (10–128 caracteres).')}
  const period=Math.floor(Date.now()/900000),ip=c.req.header('CF-Connecting-IP')||'local';const rate=await digest(c.env.EVIE_SESSION_KEY+':'+ip+':'+period)
  const limit=await c.env.AUTH_DB.prepare('INSERT INTO auth_attempts(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(rate,Date.now()+1800000).first();if(limit.count>10)return jsonError(c,'Demasiados intentos. Espera unos minutos.',429)
  await c.env.AUTH_DB.prepare('DELETE FROM auth_attempts WHERE expires_at<?').bind(Date.now()).run()
  const domain=c.env.EVIE_AUTH_DOMAIN||'accounts.evie.local';if(!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))return jsonError(c,'Dominio de cuentas no válido.',503)
  const body={email:data.username+'@'+domain,password:data.password,...(signup?{data:{username:data.username}}:{})}
  const r=await remote(c,signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{method:'POST',body});data.password='';body.password=''
  if(!r.ok)return jsonError(c,signup?'No se pudo crear la cuenta. Prueba otro usuario.':'Usuario o contraseña no válidos.',signup?400:401)
  const result=await r.json();if(!UUID.test(result.user?.id))return jsonError(c,'No se pudo abrir sesión. Revisa la configuración de cuentas.',409)
  let verifiedTokens;try{verifiedTokens=providerTokens(result)}catch{return jsonError(c,'No se pudo abrir sesión. Revisa la configuración de cuentas.',409)}
  const sid=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join(''),expires=Date.now()+30*86400000
  const tokens=await seal(verifiedTokens,c.env.EVIE_SESSION_KEY)
  const old=getCookie(c,cookie);if(old)await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE id=?').bind(await digest(old)).run()
  await c.env.AUTH_DB.prepare('INSERT INTO auth_sessions(id,owner_id,username,tokens,expires_at,refresh_until) VALUES(?,?,?,?,?,0)').bind(await digest(sid),result.user.id,data.username,tokens,expires).run()
  setCookie(c,cookie,sid,{httpOnly:true,secure:true,sameSite:'Strict',path:'/',maxAge:30*86400})
  return c.json({user:{id:result.user.id,username:data.username}})
 }
 api.post('/auth/signup',c=>enter(c,true));api.post('/auth/signin',c=>enter(c,false))
 api.get('/auth/session',async c=>{const s=await auth(c);return c.json({user:s?.user||null})})
 api.post('/auth/signout',async c=>{let body;try{body=await c.req.json();if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='all')||(body.all!==undefined&&typeof body.all!=='boolean'))throw Error()}catch{return jsonError(c,'Solicitud de cierre inválida.')}
  const s=await auth(c);if((s&&c.req.header('X-Evie-User')!==s.user.id)||(!s&&(body.all===true||c.req.header('X-Evie-User'))))return jsonError(c,'No se pudo verificar la sesión para cerrar. Vuelve a autenticarte.',401);if(s){if(body.all===true){const r=await remote(c,'/auth/v1/logout?scope=global',{method:'POST',access:s.tokens.access_token});if(!r.ok)return jsonError(c,'No se pudieron cerrar las sesiones remotas.',502);await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE owner_id=?').bind(s.user.id).run()}else await c.env.AUTH_DB.prepare('DELETE FROM auth_sessions WHERE id=?').bind(s.id).run()}deleteCookie(c,cookie,{secure:true,path:'/'});return c.json({ok:true})})
 api.use('/data/*',async(c,next)=>{const s=await auth(c);if(!s||c.req.header('X-Evie-User')!==s.user.id)return jsonError(c,'La sesión cambió. Inicia sesión de nuevo.',401);c.set('account',s);await next()})
 api.post('/data/pull',async c=>{const s=c.get('account'),b=await c.req.json();if(!b||typeof b.after!=='string'||b.after.length>200||Object.keys(b).some(k=>k!=='after'))return jsonError(c,'Cursor inválido.');const r=await remote(c,'/rest/v1/rpc/evie_pull',{method:'POST',access:s.tokens.access_token,body:{after_key:b.after}});if(!r.ok)return jsonError(c,'No se pudo leer la cuenta.',502);const rows=await r.json();return c.json({owner:s.user.id,rows,next:rows.length===500?rows.at(-1).collection+'/'+rows.at(-1).record_id:''})})
 api.post('/data/push',async c=>{const s=c.get('account'),b=await c.req.json();if(!b||!Array.isArray(b.changes)||!b.changes.length||b.changes.length>5000||Object.keys(b).some(k=>k!=='changes'))return jsonError(c,'Lote de 1 a 5000 cambios requerido.');const r=await remote(c,'/rest/v1/rpc/evie_apply',{method:'POST',access:s.tokens.access_token,body:{changes:b.changes}});if(!r.ok)return jsonError(c,r.status===409?'Otro dispositivo cambió estos registros.':'No se pudieron guardar los cambios.',r.status===409?409:422);return c.json({owner:s.user.id,rows:await r.json()})})
 api.onError((err,c)=>{
  console.error('EVIE_ACCOUNTS_ERROR', err?.stack || err?.message || String(err))
  return jsonError(c,'Servicio temporalmente no disponible. No se han descartado cambios locales.',503)
 })
 return api
}
