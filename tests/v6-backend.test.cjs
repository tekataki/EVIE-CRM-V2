'use strict';
// 2026-11-21: invitados sin clave secreta (estructura en Supabase), Google auto-detectado + recuperación,
// sello de sincronización entre dispositivos e imágenes en Storage.
const test=require('node:test');const assert=require('node:assert/strict');
const {fixture,invite,guest,A}=require('./v5-fixture.cjs');
const noKey={env:{SUPABASE_SERVICE_ROLE_KEY:''}};

test('guest WITHOUT service role: public sign-up + Supabase register with the guest token; no admin call',async t=>{const f=await fixture(t,noKey);const code=await invite(f);
 const r=await f.req('/auth/guest/redeem',{method:'POST',body:{display_name:'Ana',code}});const j=await r.json();
 assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.user.role,'guest');
 assert.equal(f.sent.admin.length,0);assert.equal(f.sent.signup.length,1);
 assert.match(f.sent.signup[0].email,/^guest-[0-9a-f]{12}@/);assert.equal(f.sent.signup[0].meta.guest,true);
 const reg=f.sent.rpc.find(x=>x.fn==='register');assert.ok(reg);assert.equal(reg.auth,'Bearer acc-'+j.user.id);assert.equal(reg.body.display_name,'Ana');
 assert.ok(j.user.expires_at<=Date.now()+72*3600000+1000&&j.user.expires_at>Date.now()+71*3600000);
 const s=await f.call({cookie:r.headers.get('set-cookie').split(';')[0],user:j.user.id},'/auth/session');assert.equal(s.json.user.role,'guest');});

test('guest WITH service role still registers in Supabase (same structure either way)',async t=>{const f=await fixture(t);const g=await guest(f);
 assert.ok(f.sent.admin.some(x=>x.op==='create'));assert.ok(f.sent.rpc.some(x=>x.fn==='register'&&x.auth==='Bearer acc-'+g.id));});

test('guest register failure releases the code (can retry) and opens no session',async t=>{const f=await fixture(t,noKey);const code=await invite(f);
 const {createAccounts}=await import('../src/accounts.js');
 const failing=async(url,o)=>url.endsWith('/rpc/evie_guest_register')?new Response('{}',{status:404}):url.endsWith('/auth/v1/signup')?Response.json({user:{id:'55555555-5555-4555-8555-000000000001'},access_token:'acc-x',refresh_token:'r',expires_in:3600}):Response.json({});
 const api=createAccounts({fetcher:failing});
 const r=await api.request('https://evie.test/auth/guest/redeem',{method:'POST',headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json'},body:JSON.stringify({display_name:'Ana',code})},f.env);
 assert.equal(r.status,502);assert.equal(r.headers.get('set-cookie'),null);
 assert.equal(f.db.prepare('SELECT used_at FROM auth_invites WHERE kind=?').get('guest').used_at,null);});

test('owner revoke ends the guest in Supabase with the guest own session; cleanup ok without admin key',async t=>{const f=await fixture(t,noKey);const g=await guest(f);
 const r=await f.call('a','/auth/guest/'+g.id+'/revoke','POST',{});assert.equal(r.json.ok,true,JSON.stringify(r.json));
 const end=f.sent.rpc.find(x=>x.fn==='end');assert.ok(end);assert.equal(end.auth,'Bearer acc-'+g.id);
 assert.match(f.db.prepare('SELECT cleanup_log FROM guest_accounts WHERE owner_id=?').get(g.id).cleanup_log,/supabase\.pg_cron_purge:ok/);
 assert.equal((await f.call(g,'/tasks')).status,401);});

test('members cannot sign up with the reserved guest- prefix',async t=>{const f=await fixture(t);const code=await invite(f,'member');
 const r=await f.req('/auth/signup',{method:'POST',body:{username:'guest-0123456789ab',password:'0123456789abc',invite:code}});
 assert.equal(r.status,400);assert.match((await r.json()).error,/reservados/);
 const {usernameFrom}=await import('../src/google-auth.js');assert.ok(!usernameFrom('guest-0123456789ab@gmail.com',new Set()).startsWith('guest-'));});

test('Google: follows the Supabase provider; EVIE_GOOGLE_AUTH forces on/off',async t=>{
 let f=await fixture(t);assert.equal((await f.call('a','/runtime')).json.googleAuth,false);
 f=await fixture(t,{googleOn:true,env:{SUPABASE_URL:'https://provider-google.invalid'}});const rt=(await f.call('a','/runtime')).json;assert.equal(rt.googleAuth,true);assert.equal(rt.mediaSync,true);
 f=await fixture(t,{googleOn:true,env:{EVIE_GOOGLE_AUTH:'false',SUPABASE_URL:'https://provider2.invalid'}});assert.equal((await f.call('a','/runtime')).json.googleAuth,false);
 f=await fixture(t,{env:{EVIE_GOOGLE_AUTH:'true'}});assert.equal((await f.call('a','/runtime')).json.googleAuth,true);});

test('Google recover mode: start returns the Supabase authorize URL with PKCE; unknown modes rejected',async t=>{const f=await fixture(t,{env:{EVIE_GOOGLE_AUTH:'true'}});
 const r=await f.req('/auth/google/start',{method:'POST',body:{mode:'recover'}});const j=await r.json();
 assert.equal(r.status,200,JSON.stringify(j));const u=new URL(j.url);assert.equal(u.pathname,'/auth/v1/authorize');assert.equal(u.searchParams.get('provider'),'google');assert.equal(u.searchParams.get('code_challenge_method'),'s256');
 assert.equal((await f.req('/auth/google/start',{method:'POST',body:{mode:'admin'}})).status,400);
 const off=await fixture(t);assert.equal((await off.req('/auth/google/start',{method:'POST',body:{mode:'recover'}})).status,503);});

test('Google recover callback: unlinked Google identity never creates an account',async t=>{const f=await fixture(t,{env:{EVIE_GOOGLE_AUTH:'true'}});
 const j=await (await f.req('/auth/google/start',{method:'POST',body:{mode:'recover'}})).json();const state=new URL(new URL(j.url).searchParams.get('redirect_to')).searchParams.get('s');
 const {createAccounts}=await import('../src/accounts.js');const stranger='66666666-6666-4666-8666-000000000001';
 const api=createAccounts({fetcher:async(url)=>url.includes('grant_type=pkce')?Response.json({user:{id:stranger,identities:[{provider:'google',identity_data:{email:'x@gmail.com'}}]},access_token:'a',refresh_token:'r',expires_in:3600}):Response.json({})});
 const r=await api.request('https://evie.test/auth/google/callback?s='+state+'&code=abc',{headers:{}},f.env);
 assert.equal(r.status,302);assert.match(r.headers.get('location'),/google=not_linked/);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM auth_accounts WHERE owner_id=?').get(stranger).n,0);});

test('Google recover callback: linked account signs in and lands on ?google=recover',async t=>{const f=await fixture(t,{env:{EVIE_GOOGLE_AUTH:'true'}});
 f.db.prepare('INSERT INTO google_links(owner_id,email,linked_at) VALUES(?,?,?)').run(A,'a@gmail.com',Date.now());
 const j=await (await f.req('/auth/google/start',{method:'POST',body:{mode:'recover'}})).json();const state=new URL(new URL(j.url).searchParams.get('redirect_to')).searchParams.get('s');
 const {createAccounts}=await import('../src/accounts.js');
 const api=createAccounts({fetcher:async(url)=>url.includes('grant_type=pkce')?Response.json({user:{id:A,identities:[{provider:'google',identity_data:{email:'a@gmail.com'}}]},access_token:'acc-'+A,refresh_token:'r',expires_in:3600}):Response.json({})});
 const r=await api.request('https://evie.test/auth/google/callback?s='+state+'&code=abc',{headers:{}},f.env);
 assert.equal(r.status,302);assert.match(r.headers.get('location'),/google=recover/);assert.ok(r.headers.get('set-cookie'));});

test('sync stamp: per-account RPC with the user token; requires a session',async t=>{const f=await fixture(t);
 const r=await f.call('a','/data/stamp','POST',{});assert.equal(r.status,200);assert.equal(r.json.owner,A);assert.equal(r.json.stamp,'3.1700000000|2');
 assert.equal(f.sent.rpc.at(-1).auth,'Bearer acc-'+A);
 assert.equal((await f.req('/data/stamp',{method:'POST',body:{}})).status,401);});

test('media: upload/download/delete in the owner folder with the owner token; validation; guests refused',async t=>{const f=await fixture(t);
 const id='0f8fad5b-d9cb-469f-a165-70867728950e',bytes=new Uint8Array([82,73,70,70,1,2,3,4]);
 let r=await f.req('/data/media/'+id+'.webp',{method:'PUT',...f.who.a,headers:{'Content-Type':'image/webp'},raw:bytes});assert.equal(r.status,200,await r.clone().text());
 const up=f.sent.objects.at(-1);assert.equal(up.method,'POST');assert.equal(up.key,A+'/'+id+'.webp');assert.equal(up.auth,'Bearer acc-'+A);
 r=await f.req('/data/media/'+id+'.webp',{...f.who.a});assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);assert.equal(r.headers.get('content-type'),'image/webp');
 // B asks for the same name → served from B's own folder → not found
 r=await f.req('/data/media/'+id+'.webp',{...f.who.b});assert.equal(r.status,404);
 assert.equal((await f.req('/data/media/../x.webp',{method:'PUT',...f.who.a,headers:{'Content-Type':'image/webp'},raw:bytes})).status!==200,true);
 assert.equal((await f.req('/data/media/'+id+'.webp',{method:'PUT',...f.who.a,headers:{'Content-Type':'image/png'},raw:bytes})).status,415);
 assert.equal((await f.req('/data/media/not-an-id.webp',{method:'PUT',...f.who.a,headers:{'Content-Type':'image/webp'},raw:bytes})).status,400);
 assert.equal((await f.req('/data/media/'+id+'.webp',{method:'PUT',headers:{'Content-Type':'image/webp'},raw:bytes})).status,401);
 r=await f.req('/data/media/'+id+'.webp',{method:'DELETE',...f.who.a});assert.equal(r.status,200);assert.equal(f.blobs.has(A+'/'+id+'.webp'),false);
 const g=await guest(f);assert.equal((await f.req('/data/media/'+id+'.webp',{method:'PUT',cookie:g.cookie,user:g.id,headers:{'Content-Type':'image/webp'},raw:bytes})).status,403);});
