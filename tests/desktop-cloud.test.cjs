'use strict';
// 2.4 · EVIE para Windows works like the web: every route the web app calls is allowed by the desktop proxy, raw
// /api/* requests (Ivi's spoken replies, photos, chat images, SSE) pass through evie://app/api, the orb talks to Ivi in
// the cloud, and cloud Ivi gets narrow Windows actions (open an app by name, Spotify search, volume, web search).
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createAccountHost,ROUTES}=require('../electron/main/account-host.cjs');
const {createDesktopActions,validateDesktop}=require('../electron/tools/desktop-actions.cjs');
const appNames=require('../electron/tools/app-names.cjs');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',ORIGIN='https://evie.example';
const MEDIA='33333333-3333-4333-8333-333333333333.webp';
async function signedIn(handler,options={}){
 const calls=[];const host=createAccountHost({origin:ORIGIN,...options,fetcher:async(url,opts)=>{if(url===ORIGIN+'/api/auth/session')return Response.json({user:{id:A}});calls.push({url,opts});return handler(url,opts);}});
 await host.request({path:'auth/session',method:'GET'});return {host,calls};
}
const req=(p,{method='GET',headers={},body}={})=>new Request('evie://app'+p,{method,headers,...(body===undefined?{}:{body})});
const asText=async r=>Buffer.from(await r.arrayBuffer()).toString('utf8');

test('every route the web app calls is allowed by the desktop proxy (no more «Solicitud de cuenta no permitida»)',()=>{
 const names=ROUTES.map(r=>r.split(' ')[1]);const covered=p=>names.some(n=>n===p||n.startsWith(p+'/')||n.replace(/\/:[a-z0-9]+(?=\/|$)/g,'')===p);
 const found=new Map();
 for(const file of fs.readdirSync(path.join(ROOT,'public')).filter(f=>f.endsWith('.js'))){
  const src=read('public/'+file);
  const base=/EvieAccounts\.request\('chat\/'\+p/.test(src)?'chat/':/EvieAccounts\.request\('memory'\+\(path\?'\/'\+path:''\)/.test(src)?'memory/':null;
  const add=(raw,prefix='')=>{const p=(prefix+raw).replace(/[?].*$/,'').replace(/\/+$/,'');if(p)found.set(p,file);};
  for(const m of src.matchAll(/EvieAccounts\.request\(\s*['`]([a-z][a-z0-9/_-]*)/g))add(m[1]);
  for(const m of src.matchAll(/\bapi\(\s*['`]([a-z][a-z0-9/_-]*)/g))add(m[1]);
  for(const m of src.matchAll(/fetch\(\s*['`]\/api\/([a-z][a-z0-9/_-]*)/g))add(m[1]);
  if(base)for(const m of src.matchAll(/\breq\(\s*['`]([a-z][a-z0-9/_-]*)/g))add(m[1],base);
 }
 assert.ok(found.size>40,'the scan found the web app\'s routes ('+found.size+')');
 for(const [p,file] of found)assert.ok(covered(p),p+' (called from public/'+file+') is not in the desktop allowlist');
 for(const r of ['POST ai/chat','POST ai/tts','GET ai/status','POST kisha/turn','POST map/route','GET memory','GET tasks','POST plan/propose','GET profile','GET connections/google/events','PUT data/media/:media','GET data/media/:media','POST auth/guest/redeem'])assert.ok(ROUTES.includes(r),r);
 // Browser-only callbacks and cron-style routes stay out.
 for(const r of ['GET auth/google/callback','GET connections/google/callback'])assert.ok(!ROUTES.includes(r),r);
});

test('Ivi\'s chat goes through the IPC proxy; raw-byte routes are refused there and served by the pass-through',async()=>{
 const {host,calls}=await signedIn(async()=>Response.json({text:'Hola',calls:[]}));
 assert.deepEqual(await host.request({path:'ai/chat',method:'POST',userId:A,body:{input:[{role:'user',content:'hola'}],context:{app:'windows'}}}),{text:'Hola',calls:[]});
 assert.equal(calls.at(-1).url,ORIGIN+'/api/ai/chat');assert.equal(JSON.parse(calls.at(-1).opts.body).context.app,'windows');
 for(const args of [{path:'ai/tts',method:'POST',body:{text:'hola'}},{path:'data/media/'+MEDIA,method:'GET'},{path:'data/media/'+MEDIA,method:'PUT',body:{}}])await assert.rejects(host.request({...args,userId:A}),/no permitida/,args.method+' '+args.path);
});

test('pass-through forwards bytes with the verified account and never exposes cookies or the upstream URL',async()=>{
 const audio=new Uint8Array([0x49,0x44,0x33,1,2,3,0,255]);
 const {host,calls}=await signedIn(async(url,opts)=>url.endsWith('/api/ai/tts')?new Response(audio,{headers:{'Content-Type':'audio/mpeg','Set-Cookie':'x=1'}}):Response.json({ok:true}));
 const r=await host.http(req('/api/ai/tts',{method:'POST',headers:{'Content-Type':'application/json','X-Evie-User':A,'X-Evie-Request':'1',Cookie:'stolen=1'},body:JSON.stringify({text:'Hola jefe'})}));
 assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'audio/mpeg');assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.deepEqual(new Uint8Array(await r.arrayBuffer()),audio);
 const {url,opts}=calls.at(-1);assert.equal(url,ORIGIN+'/api/ai/tts');assert.equal(opts.method,'POST');assert.equal(opts.credentials,'include');assert.equal(opts.redirect,'error');
 assert.deepEqual(Object.keys(opts.headers).sort(),['Accept','Content-Type','Origin','X-Evie-Request','X-Evie-User']);
 assert.equal(opts.headers.Origin,ORIGIN);assert.equal(opts.headers['X-Evie-User'],A);assert.equal(Buffer.from(opts.body).toString(),'{"text":"Hola jefe"}');
 // Photos: raw image bytes both ways, with the image type checked.
 const img=new Uint8Array([82,73,70,70,1,2,3,4]);
 const put=await host.http(req('/api/data/media/'+MEDIA,{method:'PUT',headers:{'Content-Type':'image/webp','X-Evie-User':A},body:img}));
 assert.equal(put.status,200);assert.equal(calls.at(-1).opts.headers['Content-Type'],'image/webp');assert.deepEqual(new Uint8Array(calls.at(-1).opts.body),img);
 // Anonymous runtime needs no account header.
 const rt=await host.http(req('/api/runtime'));assert.equal(rt.status,200);assert.equal(calls.at(-1).opts.headers['X-Evie-User'],undefined);
});

test('pass-through refuses unknown routes, sign-in actions, other accounts, wrong types, big bodies and odd queries',async()=>{
 const {host,calls}=await signedIn(async()=>Response.json({ok:true}));const before=calls.length;
 const cases=[
  [req('/api/admin/users'),403],[req('/api/auth/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),403],[req('/api/auth/session'),403],
  [req('/api/chat/../auth/session'),403],[req('/api/chat/conversations/%2e%2e/messages',{headers:{'X-Evie-User':A}}),403],[req('/api/ai/chat',{headers:{'X-Evie-User':A}}),403],
  [req('/api/ai/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),401],[req('/api/ai/tts',{method:'POST',headers:{'Content-Type':'application/json','X-Evie-User':B},body:'{}'}),401],
  [req('/api/ai/tts',{method:'POST',headers:{'Content-Type':'text/plain','X-Evie-User':A},body:'hola'}),415],[req('/api/data/media/'+MEDIA,{method:'PUT',headers:{'Content-Type':'text/html','X-Evie-User':A},body:'<b>'}),415],
  [req('/api/ai/stt',{method:'POST',headers:{'Content-Type':'application/json','X-Evie-User':A},body:'{}'}),400],
  [req('/api/tasks?owner='+B,{headers:{'X-Evie-User':A}}),403],[req('/api/chat/stamp?x=1',{headers:{'X-Evie-User':A}}),403],[req('/api/data/media/../../x',{headers:{'X-Evie-User':A}}),403]];
 for(const [r,status] of cases)assert.equal((await host.http(r)).status,status,r.method+' '+r.url);
 const small=createAccountHost({origin:ORIGIN,limits:{json:40},fetcher:async url=>url.endsWith('/auth/session')?Response.json({user:{id:A}}):Response.json({ok:true})});await small.request({path:'auth/session',method:'GET'});
 assert.equal((await small.http(req('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Evie-User':A},body:JSON.stringify({x:'y'.repeat(50)})}))).status,413);
 assert.equal(calls.length,before,'nothing reached the Worker');
 const local=createAccountHost({origin:'',fetcher:async()=>{throw Error('never');}});assert.equal((await local.http(req('/api/runtime'))).status,503);
 // Allowed queries pass, re-encoded.
 await host.http(req('/api/tasks?status=open',{headers:{'X-Evie-User':A}}));assert.equal(calls.at(-1).url,ORIGIN+'/api/tasks?status=open');
 await host.http(req('/api/plan/next?tz=America%2FMexico_City',{headers:{'X-Evie-User':A}}));assert.equal(calls.at(-1).url,ORIGIN+'/api/plan/next?tz=America%2FMexico_City');
});

test('a 401 through the pass-through locks the desktop session; SSE streams chunk by chunk',async()=>{
 const changes=[];const enc=new TextEncoder();let push;
 const {host}=await signedIn(async url=>{if(url.endsWith('/api/ai/status'))return Response.json({error:'Inicia sesión.'},{status:401});return new Response(new ReadableStream({start(c){push=c;}}),{headers:{'Content-Type':'text/event-stream'}});},{onChange:id=>changes.push(id)});
 const sse=await host.http(req('/api/chat/conversations/'+A+'/messages',{method:'POST',headers:{'Content-Type':'application/json','X-Evie-User':A,Accept:'text/event-stream'},body:'{"text":"hola"}'}));
 assert.equal(sse.headers.get('content-type'),'text/event-stream');const reader=sse.body.getReader();
 push.enqueue(enc.encode('event: delta\ndata: {"t":"Ho"}\n\n'));assert.match(Buffer.from((await reader.read()).value).toString(),/"Ho"/);
 push.enqueue(enc.encode('event: done\ndata: {}\n\n'));push.close();let rest='';for(;;){const s=await reader.read();if(s.done)break;rest+=Buffer.from(s.value).toString();}assert.match(rest,/done/);
 const r=await host.http(req('/api/ai/status',{headers:{'X-Evie-User':A}}));assert.equal(r.status,401);assert.equal(host.current(),null);assert.equal(changes.at(-1),null);
});

test('main serves /api/* from the proxy before any static file, and wires updates and app opening safely',()=>{
 const main=read('electron/main/main.cjs');
 assert.match(main,/protocol\.handle\('evie',async request=>\{const u=new URL\(request\.url\);if\(u\.host==='app'&&u\.pathname\.startsWith\('\/api\/'\)\)return account\.http\(request\);/);
 // open_app: the model's text only ever reaches appNames.builtin/match (never a path, argument or shell command).
 const fn=/async function openAppByName\(name\)\{([\s\S]*?)\n\}\n/.exec(main)[1];
 assert.match(fn,/appNames\.builtin\(name\)/);assert.match(fn,/appNames\.match\(name,approved\)/);assert.match(fn,/dialog\.showMessageBox/);assert.match(fn,/registry\.execute\('windows\.open_app',\{appId:hit\.id\}\)/);
 assert.doesNotMatch(fn,/spawn\(name|openExternal\(name|launchFixed\(name/);
 assert.match(main,/updater=createUpdater\(\{autoUpdater,app,qaProfile,/);assert.match(main,/updater\.start\(\);/);
 const preload=read('electron/preload/preload.cjs');assert.match(preload,/update:Object\.freeze\(\{status:\(\)=>call\('update\.status'\),install:\(\)=>call\('update\.install'\)\}\)/);
});

test('signed-in desktops talk to Ivi in the cloud; the local Ollama session is only for local mode',()=>{
 const ui=read('public/desktop-ui.js');
 assert.match(ui,/const cloud=\(\)=>desktop&&window\.EvieAccounts\?\.config\?\.\(\)\?\.accountsEnabled===true;/);
 assert.match(ui,/if\(desktop&&!cloud\(\)&&ev\.target\.closest\('#dali-core-control,\[data-ivy-shell="open"\]'\)\)/);
 assert.match(ui,/async function toggle\(\)\{[^}]*\}if\(cloud\(\)\)\{window\.EvieAssistant\?\.listen\?\.\(\{inline:true\}\);return;\}/);
 assert.match(ui,/if\(cloud\(\)\)\{window\.EvieAssistant\?\.ask\?\.\(String\(text\|\|''\)\);return true;\}/);
 assert.match(ui,/if\(a\.type==='update-ready'\)updateReady\(a\.version\);/);
 const assistant=read('public/evie-assistant.js');
 assert.match(assistant,/\.\.\.\(window\.EvieDesktopActions\?\.available\?\.\(\)\?\{app:'windows'\}:\{\}\)/);
 assert.match(assistant,/async desktop_action\(\{action,contact,message,app,query,url,level,folder,page\}\)/);
});

test('desktop actions: open an app by name, Spotify and Google search, exact and stepped volume',async()=>{
 for(const ok of [{action:'open_app',app:'Bloc de notas'},{action:'spotify_search',query:'Bad Bunny'},{action:'search_web',query:'clima en Monterrey'},{action:'set_volume',level:40},{action:'set_volume',level:0},{action:'volume_up'},{action:'volume_mute'}])assert.doesNotThrow(()=>validateDesktop(ok),JSON.stringify(ok));
 for(const bad of [{action:'open_app'},{action:'open_app',app:''},{action:'open_app',app:'x'.repeat(81)},{action:'open_app',app:'notepad\n'},{action:'open_app',app:'notepad',path:'C:\\x.exe'},{action:'spotify_search',query:' '},{action:'set_volume',level:101},{action:'set_volume',level:2.5},{action:'set_volume',level:'50'},{action:'volume_up',level:5},{action:'run_command',cmd:'calc'}])assert.throws(()=>validateDesktop(bad),JSON.stringify(bad));
 const opened=[],media=[],volume=[],apps=[];
 const d=createDesktopActions({platform:'win32',shell:{openExternal:async u=>{opened.push(u);}},media:async(key,count)=>{media.push([key,count]);return {submitted:true};},setVolume:async l=>{volume.push(l);return {volume:l};},openApp:async name=>{apps.push(name);return name==='Discord'?{ok:false,status:'declined',note:'No autorizaste Discord.'}:{opened:true,app:'Bloc de notas',how:'builtin'};}});
 assert.deepEqual(await d.run({action:'open_app',app:'  Bloc de notas '}),{ok:true,data:{opened:true,app:'Bloc de notas',how:'builtin'}});assert.deepEqual(apps,['Bloc de notas']);
 assert.deepEqual(await d.run({action:'open_app',app:'Discord'}),{ok:false,status:'declined',note:'No autorizaste Discord.'});
 await d.run({action:'spotify_search',query:'Peso Pluma & Co'});assert.equal(opened.at(-1),'spotify:search:Peso%20Pluma%20%26%20Co');
 await d.run({action:'search_web',query:'¿qué hora es en Tokio?'});assert.equal(opened.at(-1),'https://www.google.com/search?q='+encodeURIComponent('¿qué hora es en Tokio?'));
 assert.equal((await d.run({action:'set_volume',level:35})).data.volume,35);assert.deepEqual(volume,[35]);
 await d.run({action:'volume_up'});await d.run({action:'volume_down'});await d.run({action:'volume_mute'});await d.run({action:'media_play_pause'});await d.run({action:'media_next'});
 assert.deepEqual(media,[['volumeup',5],['volumedown',5],['mute',1],['playpause',1],['next',1]]);
 const web=createDesktopActions({platform:'linux',shell:{openExternal:async()=>{}},media:async()=>({})});assert.equal((await web.run({action:'open_app',app:'calc'})).ok,false);
});

test('app names: fixed Windows built-ins, spoken variants, and catalog matches without guessing',()=>{
 for(const [spoken,id] of [['Bloc de notas','notepad'],['el block de notas','notepad'],['NOTEPAD','notepad'],['la calculadora','calc'],['Explorador de archivos','explorer'],['spotify','spotify'],['WhatsApp','whatsapp'],['guasap','whatsapp'],['Microsoft Store','store']])assert.equal(appNames.builtin(spoken)?.id,id,spoken);
 // EVIE's own sections are never mistaken for Windows apps.
 for(const spoken of ['configuración','reloj','agenda','finanzas','calendario'])assert.equal(appNames.builtin(spoken),null,spoken);
 for(const b of appNames.BUILTINS){assert.ok(!!b.exe!==!!b.uri,b.id);if(b.exe)assert.match(b.exe,/^[a-z]+\.exe$/i);if(b.uri)assert.match(b.uri,/^[a-z.-]+:/);}
 const items=[{id:'a',name:'Discord'},{id:'b',name:'Visual Studio Code'},{id:'c',name:'Microsoft Word'},{id:'d',name:'Word Online'},{id:'e',name:'Google Chrome'}];
 assert.equal(appNames.match('discord',items)?.id,'a');assert.equal(appNames.match('Visual Studio',items)?.id,'b');assert.equal(appNames.match('word',items)?.id,'d');assert.equal(appNames.match('chrome',items)?.id,'e');
 assert.equal(appNames.match('photoshop',items),null);assert.equal(appNames.match('',items),null);assert.equal(appNames.match('go',items),null);
});

test('cloud Ivi knows the Windows actions only on EVIE para Windows',async()=>{
 const {TOOLS}=await import('../src/assistant.js');const t=TOOLS.find(x=>x.name==='desktop_action');
 for(const a of ['open_app','spotify_search','volume_up','volume_down','volume_mute','set_volume','open_url','search_web','media_play_pause','compose_message'])assert.ok(t.parameters.properties.action.enum.includes(a),a);
 assert.deepEqual(t.parameters.required.sort(),['action','app','contact','folder','level','message','page','query','url']);assert.equal(t.parameters.additionalProperties,false);
 const src=read('src/assistant.js');assert.match(src,/const desktopContext = \(ctx\) => ctx\?\.app === 'windows' \?/);assert.equal((src.match(/iviSituation\(ctx\.situation\), desktopContext\(ctx\)\]/g)||[]).length,2);
});
