'use strict';
// Real Hono handlers + actual SQLite statements behind a narrow D1-compatible
// adapter. Supabase HTTP is simulated; no sockets, credentials or live services.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
async function fixture(t){
 const {createAccounts,seal,unseal,digest}=await import('../src/accounts.js');
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(fs.readFileSync(path.join(__dirname,'../migrations/0001_auth_sessions.sql'),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'test-only-public-key',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')};
 const calls=[],tokens=new Map();let counter=0;
 const provider={hook:null,reply(owner=A){counter++;const access='test-only-access-'+counter,refresh='test-only-refresh-'+counter;tokens.set(access,owner);tokens.set(refresh,owner);return {user:{id:owner},access_token:access,refresh_token:refresh,expires_in:3600};}};
 const fetcher=async(url,options)=>{const call={url,options,body:options.body?JSON.parse(options.body):null};calls.push(call);const overridden=await provider.hook?.(call);if(overridden)return overridden;
  if(url.includes('grant_type=refresh_token'))return Response.json(provider.reply(tokens.get(call.body.refresh_token)||A));
  if(url.includes('grant_type=password')||url.endsWith('/signup'))return Response.json(provider.reply(call.body.email.startsWith('owner-b@')?B:A));
  if(url.endsWith('/user'))return Response.json({id:tokens.get(options.headers.Authorization?.replace('Bearer ',''))||A});
  if(url.includes('/logout'))return new Response(null,{status:204});
  if(url.endsWith('/evie_pull'))return Response.json([]);
  if(url.endsWith('/evie_apply'))return Response.json(call.body.changes.map(c=>({...c,owner_id:tokens.get(options.headers.Authorization.replace('Bearer ','')),revision:c.expected_revision+1})));
  throw Error('Unexpected provider request');
 };
 const api=createAccounts({fetcher});
 const request=(route,{method='GET',body,cookie,user,headers={}}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...(user?{'X-Evie-User':user}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})},env);
 const login=async(name='owner-a',cookie)=>{const response=await request('/auth/signin',{method:'POST',body:{username:name,password:'synthetic-password'},cookie});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
 const sessions=()=>db.prepare('select * from auth_sessions').all();
 async function expire(){const row=sessions()[0],value=await unseal(row.tokens,env.EVIE_SESSION_KEY);value.expires_at=Date.now()-1000;db.prepare('update auth_sessions set tokens=? where id=?').run(await seal(value,env.EVIE_SESSION_KEY),row.id);}
 return {db,env,api,request,login,calls,provider,sessions,expire,seal,unseal,digest};
}
test('Hono signup emits only identity and an opaque secure cookie; SQLite stores encrypted tokens',async t=>{
 const f=await fixture(t),r=await f.request('/auth/signup',{method:'POST',body:{username:' DÁLÍ ',password:'synthetic-password'}});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{user:{id:A,username:'dali'}});const cookie=r.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(cookie.includes(flag));assert.match(cookie,/^__Host-evie-session=[0-9a-f]{64};/);assert.match(r.headers.get('cache-control'),/no-store/);
 const row=f.sessions()[0],sid=cookie.split(';')[0].split('=')[1];assert.equal(row.id,await f.digest(sid));assert.ok(!row.tokens.includes('test-only'));assert.equal(row.owner_id,A);assert.equal(f.calls[0].body.email,'dali@accounts.evie.local');assert.deepEqual(f.calls[0].body.data,{username:'dali'});
});
test('Hono rejects origin and content-type violations before provider calls',async t=>{
 const f=await fixture(t);for(const headers of [{Origin:'https://evil.invalid'},{'X-Evie-Request':''},{'Content-Type':'text/plain'}]){const r=await f.request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'},headers});assert.ok([403,415].includes(r.status));}assert.equal(f.calls.length,0);assert.equal(f.sessions().length,0);
});
test('Auth attempt limit is persisted in SQLite and stores no plaintext IP',async t=>{
 const f=await fixture(t);f.provider.hook=()=>Response.json({error:'sensitive-provider-detail'},{status:400});for(let i=0;i<10;i++)assert.equal((await f.request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'},headers:{'CF-Connecting-IP':'192.0.2.12'}})).status,401);
 const r=await f.request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'},headers:{'CF-Connecting-IP':'192.0.2.12'}});assert.equal(r.status,429);assert.equal(f.calls.length,10);const row=f.db.prepare('select * from auth_attempts').get();assert.match(row.id,/^[0-9a-f]{64}$/);assert.ok(!JSON.stringify(row).includes('192.0.2.12'));
});
test('Signin rotates the opaque cookie and removes the previous local session',async t=>{
 const f=await fixture(t),first=await f.login(),second=await f.login('owner-a',first);assert.notEqual(first,second);assert.equal(f.sessions().length,1);assert.deepEqual(await(await f.request('/auth/session',{cookie:first})).json(),{user:null});assert.deepEqual(await(await f.request('/auth/session',{cookie:second})).json(),{user:{id:A,username:'owner-a'}});
});
test('Data requests require both valid cookie and matching X-Evie-User',async t=>{
 const f=await fixture(t),cookie=await f.login();for(const args of [{},{cookie},{cookie,user:B}])assert.equal((await f.request('/data/pull',{method:'POST',body:{after:''},...args})).status,401);
 assert.equal(f.calls.filter(c=>c.url.includes('/rest/')).length,0);const valid=await f.request('/data/pull',{method:'POST',body:{after:''},cookie,user:A});assert.equal(valid.status,200);assert.deepEqual(await valid.json(),{owner:A,rows:[],next:''});
});
test('Refresh encrypts rotated tokens, releases lease and verifies the resulting user',async t=>{
 const f=await fixture(t),cookie=await f.login();await f.expire();const before=f.sessions()[0].tokens;const response=await f.request('/auth/session',{cookie,user:A});assert.equal(response.status,200);assert.equal((await response.json()).user.id,A);const row=f.sessions()[0];assert.notEqual(row.tokens,before);assert.equal(row.refresh_until,0);assert.ok(!row.tokens.includes('test-only'));assert.equal(f.calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);
});
test('Concurrent refresh uses a lease and cannot reuse the same refresh token',async t=>{
 const f=await fixture(t),cookie=await f.login();await f.expire();let release;f.provider.hook=call=>call.url.includes('grant_type=refresh_token')?new Promise(r=>release=()=>r(Response.json(f.provider.reply(A)))):null;
 const first=f.request('/auth/session',{cookie,user:A});while(!release)await new Promise(r=>setTimeout(r,1));const second=await f.request('/auth/session',{cookie,user:A});assert.equal(second.status,503);release();assert.equal((await first).status,200);assert.equal(f.calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);assert.equal(f.sessions()[0].refresh_until,0);
});
test('Transient refresh failure preserves the encrypted session and allows retry',async t=>{
 const f=await fixture(t),cookie=await f.login();await f.expire();const original=f.sessions()[0].tokens;f.provider.hook=call=>call.url.includes('refresh_token')?Response.json({error:'provider unavailable'},{status:503}):null;
 const response=await f.request('/auth/session',{cookie,user:A});assert.equal(response.status,503);assert.equal(f.sessions()[0].tokens,original);assert.equal(f.sessions()[0].refresh_until,0);f.provider.hook=null;assert.equal((await(await f.request('/auth/session',{cookie,user:A})).json()).user.id,A);
});
test('Malformed refresh tokens are never persisted and always release the lease',async t=>{
 const f=await fixture(t),cookie=await f.login();await f.expire();const original=f.sessions()[0].tokens;f.provider.hook=call=>call.url.includes('refresh_token')?Response.json({access_token:{},refresh_token:null,expires_in:3600}):null;
 assert.equal((await f.request('/auth/session',{cookie,user:A})).status,503);assert.equal(f.sessions()[0].tokens,original);assert.equal(f.sessions()[0].refresh_until,0);
});
test('Rejected refresh revokes the D1 session without exposing provider details',async t=>{
 const f=await fixture(t),cookie=await f.login();await f.expire();f.provider.hook=call=>call.url.includes('refresh_token')?Response.json({error:'sensitive-provider-detail'},{status:400}):null;const r=await f.request('/auth/session',{cookie,user:A});assert.deepEqual(await r.json(),{user:null});assert.equal(f.sessions().length,0);
});
test('Malformed provider expiry or token types never create a persisted session',async t=>{
 const f=await fixture(t);for(const patch of [{expires_in:undefined},{expires_in:null},{expires_in:'3600'},{expires_in:-1},{access_token:{}},{refresh_token:12}]){f.provider.hook=()=>Response.json({...f.provider.reply(),...patch});const r=await f.request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'}});assert.equal(r.status,409);assert.equal(r.headers.get('set-cookie'),null);assert.equal(f.sessions().length,0);}
});
test('Provider user mismatch fails closed and never reaches the data RPC',async t=>{
 const f=await fixture(t),cookie=await f.login();f.provider.hook=call=>call.url.endsWith('/user')?Response.json({id:B}):null;assert.equal((await f.request('/data/push',{method:'POST',body:{changes:[{}]},cookie,user:A})).status,401);assert.equal(f.calls.filter(c=>c.url.includes('/rest/')).length,0);
});
test('Local logout revokes only one session; global logout revokes only that owner',async t=>{
 const f=await fixture(t),one=await f.login(),two=await f.login(),other=await f.login('owner-b');assert.equal(f.sessions().length,3);
 assert.equal((await f.request('/auth/signout',{method:'POST',body:{all:false},cookie:one,user:A})).status,200);assert.equal(f.sessions().length,2);
 assert.equal((await f.request('/auth/signout',{method:'POST',body:{all:true},cookie:two,user:A})).status,200);assert.equal(f.sessions().length,1);assert.equal(f.sessions()[0].owner_id,B);assert.equal((await(await f.request('/auth/session',{cookie:other,user:B})).json()).user.id,B);assert.ok(f.calls.some(c=>c.url.endsWith('/logout?scope=global')));
});
test('Failed global logout preserves sessions and does not report remote success',async t=>{
 const f=await fixture(t),cookie=await f.login();f.provider.hook=call=>call.url.includes('/logout')?new Response('private-provider-error',{status:500}):null;const r=await f.request('/auth/signout',{method:'POST',body:{all:true},cookie,user:A});assert.equal(r.status,502);assert.equal(r.headers.get('set-cookie'),null);assert.equal(f.sessions().length,1);assert.ok(!(await r.text()).includes('private-provider-error'));
});
test('Old-tab logout cannot clear the new account cookie or revoke its session',async t=>{
 const f=await fixture(t),cookie=await f.login('owner-b');for(const user of [A,undefined]){const r=await f.request('/auth/signout',{method:'POST',body:{all:false},cookie,user});assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);assert.equal(f.sessions()[0].owner_id,B);}
});
test('Data payload rejects caller-selected owner and preserves text IDs in RPC forwarding',async t=>{
 const f=await fixture(t),cookie=await f.login(),change={collection:'transactions',record_id:'Legacy-AbC-01',expected_revision:0,payload:{id:'Legacy-AbC-01',amount:12345}};
 assert.equal((await f.request('/data/push',{method:'POST',body:{changes:[change],owner_id:B},cookie,user:A})).status,400);const r=await f.request('/data/push',{method:'POST',body:{changes:[change]},cookie,user:A});assert.equal(r.status,200);assert.equal((await r.json()).rows[0].record_id,'Legacy-AbC-01');const rpc=f.calls.find(c=>c.url.endsWith('/evie_apply'));assert.deepEqual(rpc.body,{changes:[change]});assert.equal(rpc.options.redirect,'error');
});
