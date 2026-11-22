'use strict';
// 2026-11-22 · Cuentas con correo + contraseña (además de Google) a través de los handlers Hono reales + SQLite.
// Supabase Auth y Google se simulan. Incluye la protección contra «pre-account takeover»: un correo registrado
// sin comprobar pierde su contraseña la primera vez que el dueño real del correo entra con Google.
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');
async function fixture(t,{confirm=false,env:extra={}}={}){
 const {createAccounts}=await import('../src/accounts.js');
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...a){return {all:async()=>({results:db.prepare(sql).all(...a)}),first:async()=>db.prepare(sql).get(...a)||null,run:async()=>{const r=db.prepare(sql).run(...a);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',EVIE_GOOGLE_AUTH:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),...extra};
 const users=new Map(),tokens=new Map(),calls=[];let n=0,pkce=null;
 const session=(u,providers)=>{n++;const a='acc-'+n;tokens.set(a,u.id);return {user:{id:u.id,email:u.email,identities:providers.map(p=>({provider:p,identity_data:{email:u.email}}))},access_token:a,refresh_token:'ref-'+n,expires_in:3600};};
 const fetcher=async(url,o={})=>{url=String(url);const body=o.body?JSON.parse(o.body):null;const auth=o.headers?.Authorization||'';calls.push({url,method:o.method||'GET',body,auth});
  if(url.endsWith('/auth/v1/settings'))return Response.json({external:{google:true}});
  if(url.endsWith('/auth/v1/signup')){if(users.has(body.email))return Response.json({error_code:'user_already_exists'},{status:422});const u={id:crypto.randomUUID(),email:body.email,password:body.password,providers:['email']};users.set(body.email,u);if(confirm)return Response.json({id:u.id,email:u.email});return Response.json(session(u,u.providers));}
  if(url.includes('grant_type=password')){const u=users.get(body.email);if(!u||u.password!==body.password)return Response.json({error_code:'invalid_credentials'},{status:400});return Response.json(session(u,u.providers));}
  if(url.includes('grant_type=pkce')){const u=pkce();return Response.json(session(u,u.providers));}
  if(url.endsWith('/auth/v1/user')&&o.method==='PUT'){const id=tokens.get(auth.replace('Bearer ',''));const u=[...users.values()].find(x=>x.id===id);if(u&&body.password)u.password=body.password;return Response.json({id});}
  if(url.endsWith('/auth/v1/user'))return Response.json({id:tokens.get(auth.replace('Bearer ',''))});
  if(url.includes('/auth/v1/logout'))return new Response(null,{status:204});
  throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});
 const req=(route,{method='GET',body,cookie,user}={})=>api.request('https://evie.test'+route,{method,redirect:'manual',headers:{Origin:'https://evie.test','X-Evie-Request':'1',...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(user?{'X-Evie-User':user}:{})},...(body?{body:JSON.stringify(body)}:{})},env);
 const signup=(email,password='una-clave-segura-1')=>req('/auth/signup',{method:'POST',body:{email,password}});
 const signin=(email,password='una-clave-segura-1')=>req('/auth/signin',{method:'POST',body:{email,password}});
 async function google(mode='signin'){const r=await req('/auth/google/start',{method:'POST',body:{mode}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));const s=new URL(new URL(j.url).searchParams.get('redirect_to')).searchParams.get('s');return req('/auth/google/callback?s='+s+'&code=authcode-1');}
 return {db,env,users,calls,req,signup,signin,google,setGoogle:fn=>{pkce=fn;}};
}
const cookieOf=r=>r.headers.get('set-cookie')?.split(';')[0]||null,where=r=>r.headers.get('location')||'';

test('Crear mi cuenta con correo: la primera cuenta es la propietaria; la sesión se abre al instante',async t=>{const f=await fixture(t);
 const r=await f.signup(' Dali@Example.com ');const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.user.role,'owner');assert.match(j.user.username,/^dali/);
 const call=f.calls.find(c=>c.url.endsWith('/auth/v1/signup'));assert.equal(call.body.email,'dali@example.com');assert.ok(cookieOf(r));
 const s=await(await f.req('/auth/session',{cookie:cookieOf(r)})).json();assert.equal(s.user.id,j.user.id);
 const r2=await f.signup('ana@example.com');assert.equal((await r2.json()).user.role,'member');});
test('Iniciar sesión con correo y contraseña; contraseña incorrecta no abre nada',async t=>{const f=await fixture(t);await f.signup('dali@example.com');
 const ok=await f.signin('DALI@example.com');assert.equal(ok.status,200);assert.ok(cookieOf(ok));
 const bad=await f.signin('dali@example.com','otra-clave-incorrecta');assert.equal(bad.status,401);assert.match((await bad.json()).error,/Correo o contraseña no válidos/);assert.equal(cookieOf(bad),null);});
test('correo repetido, correo inválido, dominio interno y contraseña corta se rechazan',async t=>{const f=await fixture(t);await f.signup('dali@example.com');
 const dup=await f.signup('dali@example.com');assert.equal(dup.status,409);assert.match((await dup.json()).error,/Ya existe una cuenta con ese correo/);
 assert.equal((await f.signup('no-es-correo')).status,400);
 assert.equal((await f.signup('alguien@accounts.evie.local')).status,400);
 assert.equal((await f.signup('ana@example.com','corta')).status,400);});
test('EVIE_SIGNUP=invite cierra el registro por correo',async t=>{const f=await fixture(t,{env:{EVIE_SIGNUP:'invite'}});const r=await f.signup('dali@example.com');assert.equal(r.status,403);assert.equal(f.users.size,0);
 assert.equal((await(await f.req('/runtime')).json()).signup,'invite');});
test('con «Confirm email» en Supabase: el registro queda pendiente y la cuenta se crea al entrar después',async t=>{const f=await fixture(t,{confirm:true});
 const r=await f.signup('dali@example.com');assert.equal(r.status,202);assert.deepEqual(await r.json(),{pending:'confirm_email'});assert.equal(cookieOf(r),null);assert.equal(f.db.prepare('select count(*) n from auth_accounts').get().n,0);
 const s=await f.signin('dali@example.com');const j=await s.json();assert.equal(s.status,200,JSON.stringify(j));assert.equal(j.user.role,'owner');assert.equal(f.db.prepare('select count(*) n from auth_accounts').get().n,1);});
test('Google con el mismo correo entra a la misma cuenta; la primera vez retira la contraseña no comprobada',async t=>{const f=await fixture(t);
 const r=await f.signup('dali@gmail.com');const {user}=await r.json();const old=cookieOf(r);
 const u=f.users.get('dali@gmail.com');f.setGoogle(()=>({...u,providers:['email','google']}));
 const g=await f.google();assert.equal(g.status,302);assert.match(where(g),/google=reset/);
 const put=f.calls.find(c=>c.url.endsWith('/auth/v1/user')&&c.method==='PUT');assert.ok(put&&put.body.password.length>=20,'password rotated');assert.ok(f.calls.some(c=>c.url.includes('/logout?scope=others')));
 assert.equal((await(await f.req('/auth/session',{cookie:old})).json()).user,null,'other sessions closed');
 const s=await(await f.req('/auth/session',{cookie:cookieOf(g)})).json();assert.equal(s.user.id,user.id);
 assert.equal((await f.signin('dali@gmail.com')).status,401,'the unproven password no longer works');
 // Second Google sign-in: address already proven, nothing else changes.
 const before=f.calls.length;const g2=await f.google();assert.match(where(g2),/google=ok/);assert.ok(!f.calls.slice(before).some(c=>c.method==='PUT'));});
test('cuenta ya comprobada (email_trust): Google entra sin tocar la contraseña',async t=>{const f=await fixture(t);
 const {user}=await(await f.signup('dali@gmail.com')).json();f.db.prepare('INSERT INTO email_trust(owner_id,via,at) VALUES(?,?,?)').run(user.id,'admin',Date.now());
 const u=f.users.get('dali@gmail.com');f.setGoogle(()=>({...u,providers:['email','google']}));
 const g=await f.google();assert.match(where(g),/google=ok/);assert.ok(!f.calls.some(c=>c.method==='PUT'));assert.equal((await f.signin('dali@gmail.com')).status,200);});
test('Google nuevo crea su cuenta y queda comprobado; «Recuperar con Google» pide contraseña nueva sin tocar nada más',async t=>{const f=await fixture(t);
 const u={id:crypto.randomUUID(),email:'nuevo@gmail.com',providers:['google']};f.setGoogle(()=>u);
 const g=await f.google();assert.match(where(g),/google=new/);assert.equal(f.db.prepare('select via from email_trust where owner_id=?').get(u.id).via,'google');
 const rec=await f.google('recover');assert.match(where(rec),/google=recover/);assert.ok(!f.calls.some(c=>c.method==='PUT'));});
test('las cuentas antiguas con usuario siguen entrando con su usuario',async t=>{const f=await fixture(t);
 f.users.set('vieja@accounts.evie.local',{id:'11111111-1111-4111-8111-111111111111',email:'vieja@accounts.evie.local',password:'clave-antigua-123',providers:['email']});
 f.db.prepare('INSERT INTO auth_accounts(owner_id,username,role,created_at) VALUES(?,?,?,?)').run('11111111-1111-4111-8111-111111111111','vieja','owner',1);
 const r=await f.req('/auth/signin',{method:'POST',body:{username:'vieja',password:'clave-antigua-123'}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.deepEqual(j.user,{id:'11111111-1111-4111-8111-111111111111',username:'vieja',role:'owner'});});
