'use strict';
// EVIE Mapa server proxy: authentication, honest 503 without STADIA_API_KEY, geofence on destination/origin,
// provider errors mapped (no fake route), key never echoed, quotas, and the provider trip passed through unedited.
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const TRIP={status:0,status_message:'Found route',units:'kilometers',summary:{length:1.2,time:240},legs:[{shape:'abc',maneuvers:[{type:1,instruction:'Dirígete al norte.',begin_shape_index:0}]}]};
async function fixture(t,extra={},provider=null){
 const {createAccounts}=await import('../src/accounts.js');
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),...extra};
 const calls=[];
 const fetcher=async(url,options={})=>{
  if(url.includes('grant_type=password')){const u=JSON.parse(options.body).email||'';const who=u.startsWith('owner-b@')?B:A;return Response.json({user:{id:who},access_token:'acc-'+who,refresh_token:'ref',expires_in:3600});}
  if(url.endsWith('/user'))return Response.json({id:String(options.headers.Authorization||'').endsWith(B)?B:A});
  if(url.startsWith('https://api.stadiamaps.com')){calls.push({url,options});return provider?provider(url,options):Response.json({trip:TRIP});}
  throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});
 const req=(route,{method='GET',body,cookie,user}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-Evie-User':user}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})},env);
 const login=async(u)=>{const r=await req('/auth/signin',{method:'POST',body:{username:u,password:'synthetic-password'}});return r.headers.get('set-cookie').split(';')[0];};
 const a=await login('owner-a');
 const call=async(route,method='GET',body)=>{const r=await req(route,{method,body,cookie:a,user:A});const text=await r.text();return {status:r.status,json:JSON.parse(text),text};};
 return {req,call,calls,env};
}
const IN={lat:19.7045,lon:-103.46},IN2={lat:19.7238,lon:-103.4612},GDL={lat:20.6767,lon:-103.3475};

test('requires a bound session',async t=>{const f=await fixture(t,{STADIA_API_KEY:'sk'});assert.equal((await f.req('/map/config')).status,401);assert.equal((await f.req('/map/route',{method:'POST',body:{from:IN,to:IN2}})).status,401);});

test('without STADIA_API_KEY: config says exactly what is missing; route/search answer 503 (no fake data)',async t=>{const f=await fixture(t);
 const c=await f.call('/map/config');assert.equal(c.json.configured,false);assert.ok(c.json.missing.some(m=>/STADIA_API_KEY/.test(m)));assert.match(c.json.attribution,/OpenStreetMap/);
 const r=await f.call('/map/route','POST',{from:IN,to:IN2});assert.equal(r.status,503);assert.equal(r.json.code,'not_configured');assert.ok(!('trip' in r.json));
 assert.equal((await f.call('/map/search','POST',{text:'tecnológico'})).status,503);assert.equal(f.calls.length,0,'no provider call');
 const rt=await (await f.req('/runtime')).json();assert.equal(rt.map.configured,false);});

test('route: geofenced destination/origin; provider trip passed through unedited; key only in Authorization header',async t=>{const f=await fixture(t,{STADIA_API_KEY:'sk-secret-123'});
 let r=await f.call('/map/route','POST',{from:IN,to:GDL});assert.equal(r.status,422);assert.equal(r.json.code,'outside_area');assert.match(r.json.error,/fuera de la zona/);
 r=await f.call('/map/route','POST',{from:GDL,to:IN});assert.equal(r.json.code,'origin_outside_area');assert.equal(f.calls.length,0);
 r=await f.call('/map/route','POST',{from:IN,to:IN2,mode:'pedestrian'});assert.equal(r.status,200);assert.deepEqual(r.json.trip,TRIP);assert.equal(r.json.mode,'pedestrian');assert.equal(r.json.traffic,false);
 const sent=JSON.parse(f.calls[0].options.body);assert.equal(sent.costing,'pedestrian');assert.equal(sent.language,'es-ES');assert.equal(sent.locations.length,2);
 assert.equal(f.calls[0].options.headers.Authorization,'Stadia-Auth sk-secret-123');assert.ok(!f.calls[0].url.includes('sk-secret'));assert.ok(!r.text.includes('sk-secret'),'key never returned');
 assert.ok(!(await f.call('/map/config')).text.includes('sk-secret'));});

test('traffic only when explicitly enabled and mode is auto',async t=>{const f=await fixture(t,{STADIA_API_KEY:'sk',EVIE_MAP_TRAFFIC:'on'});
 let r=await f.call('/map/route','POST',{from:IN,to:IN2,mode:'auto'});assert.equal(r.json.traffic,true);assert.equal(JSON.parse(f.calls.at(-1).options.body).costing,'auto_traffic');
 r=await f.call('/map/route','POST',{from:IN,to:IN2,mode:'bicycle'});assert.equal(r.json.traffic,false);});

test('provider failures become honest errors: no route, bad key, rate limit, timeout',async t=>{
 let f=await fixture(t,{STADIA_API_KEY:'sk'},()=>Response.json({trip:{status:442,status_message:'No path could be found for input'}}));
 let r=await f.call('/map/route','POST',{from:IN,to:IN2});assert.equal(r.status,422);assert.equal(r.json.code,'no_route');assert.ok(!('trip' in r.json));
 f=await fixture(t,{STADIA_API_KEY:'bad'},()=>new Response('{}',{status:401}));r=await f.call('/map/route','POST',{from:IN,to:IN2});assert.equal(r.json.code,'provider_auth');
 f=await fixture(t,{STADIA_API_KEY:'sk'},()=>new Response('{}',{status:429}));r=await f.call('/map/search','POST',{text:'jardín'});assert.equal(r.json.code,'provider_rate');
 f=await fixture(t,{STADIA_API_KEY:'sk'},()=>{throw Error('timeout');});r=await f.call('/map/route','POST',{from:IN,to:IN2});assert.equal(r.status,504);});

test('search is bounded to the area and returns only real coordinates',async t=>{
 const f=await fixture(t,{STADIA_API_KEY:'sk'},()=>Response.json({features:[{properties:{gid:'osm:venue:1',name:'Instituto Tecnológico de Ciudad Guzmán',label:'ITCG, Ciudad Guzmán, JAL, México',layer:'venue',confidence:0.9},geometry:{coordinates:[-103.4612,19.7238]}},{properties:{name:'Sin coordenadas'},geometry:{coordinates:[]}}]}));
 const r=await f.call('/map/search','POST',{text:'el tecnológico'});assert.equal(r.status,200);assert.equal(r.json.results.length,1);assert.equal(r.json.results[0].lat,19.7238);
 const u=new URL(f.calls[0].url);assert.equal(u.searchParams.get('boundary.rect.min_lon'),'-103.54');assert.equal(u.searchParams.get('boundary.country'),'MX');assert.equal(u.searchParams.get('text'),'el tecnológico');});

test('daily quota per account (EVIE_MAP_LIMITS)',async t=>{const f=await fixture(t,{STADIA_API_KEY:'sk',EVIE_MAP_LIMITS:JSON.stringify({map_route:2})});
 assert.equal((await f.call('/map/route','POST',{from:IN,to:IN2})).status,200);assert.equal((await f.call('/map/route','POST',{from:IN,to:IN2})).status,200);
 const r=await f.call('/map/route','POST',{from:IN,to:IN2});assert.equal(r.status,429);assert.equal(r.json.code,'quota');assert.equal(f.calls.length,2);
 assert.equal((await f.call('/map/config')).json.used.map_route,2);});
