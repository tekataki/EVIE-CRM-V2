'use strict';
// Shared in-memory fixture for v5 server tests: node:sqlite as D1 (ALL migrations applied in order),
// fake Supabase (auth/admin/storage), OpenAI, Groq, Fish and Stadia.
const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
async function fixture(t,{env:extra={},openai=null,stadia=null,storage=[],googleOn=false}={}){
 const {createAccounts}=await import('../src/accounts.js');
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of fs.readdirSync(path.join(__dirname,'../migrations/d1')).filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',SUPABASE_SERVICE_ROLE_KEY:'service-role-secret',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),OPENAI_API_KEY:'test-openai',GROQ_API_KEY:'g',FISH_AUDIO_API_KEY:'f',FISH_AUDIO_VOICE_ID:'voice12345',...extra};
 const sent={openai:[],groq:[],fish:[],stadia:[],admin:[],storage:[],rpc:[],signup:[],objects:[]};let guestSeq=0;const users=new Map();
 const files=new Set(storage),blobs=new Map();
 const fetcher=async(url,options={})=>{
  if(url.endsWith('/auth/v1/admin/users')&&options.method==='POST'){const b=JSON.parse(options.body);const id=`33333333-3333-4333-8333-${String(++guestSeq).padStart(12,'0')}`;users.set(b.email,id);sent.admin.push({op:'create',email:b.email,meta:b.user_metadata});return Response.json({id});}
  if(/\/auth\/v1\/admin\/users\/[0-9a-f-]{36}$/.test(url)&&options.method==='DELETE'){sent.admin.push({op:'delete',id:url.split('/').pop()});return new Response('{}',{status:200});}
  if(url.includes('/storage/v1/object/list/user-media')){const b=JSON.parse(options.body);const pre=b.prefix+'/';const top=new Map();for(const f of files){if(!f.startsWith(pre))continue;const [h,...rest]=f.slice(pre.length).split('/');top.set(h,rest.length?{name:h,id:null}:{name:h,id:'x'+h});}return Response.json([...top.values()]);}
  if(url.endsWith('/storage/v1/object/user-media')&&options.method==='DELETE'){const b=JSON.parse(options.body);for(const p of b.prefixes){files.delete(p);sent.storage.push(p);}return Response.json([]);}
  if(url.includes('grant_type=password')){const u=JSON.parse(options.body).email||'';const who=users.get(u)||(u.startsWith('owner-b@')?B:A);return Response.json({user:{id:who},access_token:'acc-'+who,refresh_token:'ref',expires_in:3600});}
  if(url.endsWith('/auth/v1/user'))return Response.json({id:String(options.headers.Authorization||'').replace('Bearer acc-','')});
  if(url.startsWith('https://api.openai.com')){const b=JSON.parse(options.body);sent.openai.push(b);if(openai)return openai(b,sent.openai.length);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'ok'}]}],usage:{input_tokens:1000,output_tokens:100}});}
  if(url.startsWith('https://api.groq.com')){sent.groq.push(options);return Response.json({text:'hola '.repeat(1500)});}
  if(url.startsWith('https://api.fish.audio')){sent.fish.push(JSON.parse(options.body));return new Response(new Uint8Array([1,2,3]),{status:200});}
  if(url.startsWith('https://api.stadiamaps.com')){sent.stadia.push({url,options});if(stadia)return stadia(url,options);throw Error('no stadia');}
  // Supabase RPCs and endpoints added for guests/sync/media (migration 202611220001).
  if(url.endsWith('/rest/v1/rpc/evie_guest_register')){sent.rpc.push({fn:'register',auth:options.headers.Authorization,body:JSON.parse(options.body)});return Response.json(new Date(Date.now()+72*3600000).toISOString());}
  if(url.endsWith('/rest/v1/rpc/evie_guest_end')){sent.rpc.push({fn:'end',auth:options.headers.Authorization});return new Response(null,{status:204});}
  if(url.endsWith('/rest/v1/rpc/evie_sync_stamp')){sent.rpc.push({fn:'stamp',auth:options.headers.Authorization});return Response.json('3.1700000000|2');}
  if(url.endsWith('/auth/v1/signup')){const b=JSON.parse(options.body);const id=`44444444-4444-4444-8444-${String(++guestSeq).padStart(12,'0')}`;users.set(b.email,id);sent.signup.push({email:b.email,meta:b.data});return Response.json({user:{id},access_token:'acc-'+id,refresh_token:'ref',expires_in:3600});}
  if(url.endsWith('/auth/v1/settings'))return Response.json({external:{google:!!googleOn}});
  {const m=url.match(/\/storage\/v1\/object\/(authenticated\/)?user-media\/([0-9a-f-]{36}\/[^/]+)$/);if(m){const key=m[2],auth=options.headers?.Authorization;sent.objects.push({method:options.method||'GET',key,auth});
   if((options.method||'GET')==='POST'){blobs.set(key,{type:options.headers['Content-Type'],body:new Uint8Array(options.body)});return Response.json({Key:'user-media/'+key});}
   if(options.method==='DELETE'){blobs.delete(key);return Response.json([]);}
   const b=blobs.get(key);return b?new Response(b.body,{status:200,headers:{'Content-Type':b.type}}):Response.json({error:'not_found'},{status:400});}}
  throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});
 const req=(route,{method='GET',body,cookie,user,headers={},raw}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-Evie-User':user}:{}),...headers},...(raw!==undefined?{body:raw}:body!==undefined?{body:JSON.stringify(body)}:{})},env);
 const login=async(u)=>{const r=await req('/auth/signin',{method:'POST',body:{username:u,password:'synthetic-password'}});return r.headers.get('set-cookie').split(';')[0];};
 const a=await login('owner-a'),b=await login('owner-b');
 db.prepare("INSERT OR IGNORE INTO auth_accounts(owner_id,username,role,created_at) VALUES(?,?,?,?)").run(A,'owner-a','owner',Date.now());
 db.prepare("INSERT OR IGNORE INTO auth_accounts(owner_id,username,role,created_at) VALUES(?,?,?,?)").run(B,'owner-b','member',Date.now());
 const who={a:{cookie:a,user:A},b:{cookie:b,user:B}};
 const call=async(w,route,method='GET',body,extra={})=>{const s=typeof w==='string'?who[w]:w;const r=await req(route,{method,body,...s,...extra});const text=await r.text();let json=null;try{json=JSON.parse(text);}catch{}return {status:r.status,json,text,headers:r.headers};};
 return {req,call,sent,db,env,who,A,B,files,blobs,login};
}
async function invite(f,kind='guest'){const r=await f.call('a','/auth/invites','POST',{label:'prueba',kind});if(r.status!==200)throw Error('invite '+r.status+' '+r.text);return r.json.code;}
async function guest(f,name='Invitada'){const code=await invite(f);const r=await f.req('/auth/guest/redeem',{method:'POST',body:{display_name:name,code}});const j=await r.json();if(r.status!==200)throw Error('redeem '+r.status+' '+JSON.stringify(j));return {cookie:r.headers.get('set-cookie').split(';')[0],user:j.user.id,id:j.user.id,code};}
module.exports={fixture,invite,guest,A,B};
