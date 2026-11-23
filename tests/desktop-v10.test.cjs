'use strict';
// v10 desktop bridge: new Worker routes, chat SSE piped over a MessagePort (abort cancels upstream), ai/stt audio with
// X-Evie-Lang, and the global hotkeys (type → Ivi's composer, voice → Ivi's voice).
const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createAccountHost,serveAccountStream,ROUTES,LIMITS}=require('../electron/main/account-host.cjs');
const {createShortcuts,TYPE_SHORTCUT,VOICE_SHORTCUTS,DEFAULT_VOICE_SHORTCUT,label}=require('../electron/main/shortcuts.cjs');
const createSettings=require('../electron/main/settings.cjs');const scopedSettings=require('../electron/main/scoped-settings.cjs');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333',D='44444444-4444-4444-8444-444444444444',E='55555555-5555-4555-8555-555555555555';
const ORIGIN='https://evie.example',enc=new TextEncoder();
const messages=id=>`chat/conversations/${id}/messages`,cont=id=>`chat/conversations/${id}/continue`;
const IMGN=C+'.webp';
// Stream tests must fail, never hang: per-test timeout, short idle limit, and every port/body is closed afterwards.
const T={timeout:15000},open={ports:new Set(),bodies:new Set()};
afterEach(()=>{for(const p of open.ports){try{p.close();}catch{}}open.ports.clear();for(const s of open.bodies){try{s.end();}catch{}}open.bodies.clear();});
class TrackedChannel{constructor(){const c=new MessageChannel();open.ports.add(c.port1);open.ports.add(c.port2);this.port1=c.port1;this.port2=c.port2;}}
async function until(fn,ms=3000){const t0=Date.now();while(!fn()){if(Date.now()-t0>ms)throw Error('Tiempo de espera agotado en la prueba.');await new Promise(r=>setTimeout(r,5));}}
// A host already signed in as A; every other request goes to handler(url, options).
async function signedIn(handler,options={}){
 const calls=[];const host=createAccountHost({origin:ORIGIN,...options,limits:{streamIdle:5000,...options.limits},fetcher:async(url,opts)=>{if(url===ORIGIN+'/api/auth/session')return Response.json({user:{id:A}});calls.push({url,opts});return handler(url,opts);}});
 await host.request({path:'auth/session',method:'GET'});return {host,calls};
}
// Upstream SSE body the test drives by hand; `cancelled` tells whether the proxy tore it down.
function upstream(){let ctrl;const s={cancelled:false,push:t=>ctrl.enqueue(enc.encode(t)),raw:b=>ctrl.enqueue(b),end:()=>ctrl.close()};s.body=new ReadableStream({start(c){ctrl=c;},cancel(){s.cancelled=true;}});s.response=()=>new Response(s.body,{status:200,headers:{'Content-Type':'text/event-stream; charset=utf-8'}});open.bodies.add(s);return s;}
// Electron MessagePortMain look-alike over a Node MessagePort ('message' listeners receive {data}).
const mainPort=p=>({on(name,fn){p.on(name,name==='message'?data=>fn({data,ports:[]}):fn);return this;},postMessage:v=>p.postMessage(v),start:()=>p.start(),close:()=>p.close()});
// Runs the real sandboxed preload with a fake contextBridge/ipcRenderer; postMessage hands the port to `onPost`.
function loadPreload(onPost=()=>{}){
 const exposed={},listeners=new Map();
 const ipcRenderer={invoke:async()=>({ok:true,data:null}),send:()=>{},on:(channel,fn)=>{if(!listeners.has(channel))listeners.set(channel,[]);listeners.get(channel).push(fn);},removeListener:(channel,fn)=>{const list=listeners.get(channel)||[];const i=list.indexOf(fn);if(i>=0)list.splice(i,1);},postMessage:(channel,message,ports)=>onPost(channel,structuredClone(message),ports)};
 const electron={contextBridge:{exposeInMainWorld:(key,api)=>{exposed[key]=api;}},ipcRenderer};
 vm.compileFunction(fs.readFileSync(path.join(__dirname,'../electron/preload/preload.cjs'),'utf8'),['require','process','MessageChannel'],{filename:'preload.cjs'})(name=>{if(name!=='electron')throw Error('El preload aislado solo carga electron.');return electron;},{platform:'win32'},TrackedChannel);
 return {api:exposed.evieDesktop,emit:(channel,payload)=>{for(const fn of [...(listeners.get(channel)||[])])fn({},payload);}};
}
function fakeGlobalShortcut(taken=[]){const map=new Map();return {map,register(accelerator,fn){if(taken.includes(accelerator))return false;map.set(accelerator,fn);return true;},unregisterAll(){map.clear();},unregister(accelerator){map.delete(accelerator);}};}

test('v10 Worker routes are in the allowlist with their exact methods; pre-v10 routes and size limits are kept',()=>{
 for(const route of ['GET chat/conversations','POST chat/conversations','PATCH chat/conversations/:id','DELETE chat/conversations/:id','GET chat/conversations/:id/messages','POST chat/conversations/:id/messages','POST chat/conversations/:id/continue','POST chat/attachments','GET chat/attachments/:img','DELETE chat/attachments/:img','GET chat/memories','POST chat/memories','PATCH chat/memories/:id','DELETE chat/memories/:id','POST chat/memories/:id/restore','GET chat/memories/:id/history','GET chat/stamp','POST soma/dossier','POST soma/followup','POST school/summary','POST school/cards','POST weekly/review','POST dojo/turn','POST dojo/score','POST radar/news','POST radar/plans','POST ai/stt','POST data/stamp','GET runtime','GET auth/session','POST auth/signin','POST auth/signup','POST auth/signout','POST auth/google/start','POST auth/google/redeem','POST data/pull','POST data/push','POST info/research','POST info/weather','POST info/learn'])assert.ok(ROUTES.includes(route),route);
 assert.equal(ROUTES.length,40);assert.equal(new Set(ROUTES).size,ROUTES.length);
 assert.equal(LIMITS.json,16000000);assert.equal(LIMITS.audio,4*1024*1024);assert.equal(LIMITS.timeout,30000);assert.ok(LIMITS.ai>=120000);
});

test('v10 routes reach the Worker with the exact URL, method, JSON body and the verified account',async()=>{
 const {host,calls}=await signedIn(async()=>Response.json({ok:true}));
 const cases=[
  [{path:'chat/conversations',method:'GET'},'/api/chat/conversations',undefined],
  [{path:'chat/conversations?archived=1&q=hola%20mundo',method:'GET'},'/api/chat/conversations?archived=1&q=hola%20mundo',undefined],
  [{path:'chat/conversations?q=caf%C3%A9+con+leche',method:'GET'},'/api/chat/conversations?q=caf%C3%A9%20con%20leche',undefined],
  [{path:'chat/conversations',method:'POST',body:{tier:'enfoque',private:true}},'/api/chat/conversations','{"tier":"enfoque","private":true}'],
  [{path:`chat/conversations/${C}`,method:'PATCH',body:{title:'Plan de ahorro'}},`/api/chat/conversations/${C}`,'{"title":"Plan de ahorro"}'],
  [{path:`chat/conversations/${C.toUpperCase()}`,method:'DELETE'},`/api/chat/conversations/${C.toUpperCase()}`,undefined],
  [{path:messages(C),method:'GET'},'/api/'+messages(C),undefined],
  [{path:messages(C),method:'POST',body:{text:'Hola',tier:'chispa'}},'/api/'+messages(C),'{"text":"Hola","tier":"chispa"}'],
  [{path:cont(C),method:'POST',body:{continuation:'s3ll4d0',outputs:[{call_id:'call_1',output:'{}'}]}},'/api/'+cont(C),'{"continuation":"s3ll4d0","outputs":[{"call_id":"call_1","output":"{}"}]}'],
  [{path:'chat/attachments',method:'POST',body:{mime:'image/webp',data:'UklGRg=='}},'/api/chat/attachments','{"mime":"image/webp","data":"UklGRg=="}'],
  [{path:'chat/attachments/'+IMGN,method:'GET'},'/api/chat/attachments/'+IMGN,undefined],
  [{path:'chat/attachments/'+C+'.jpg',method:'DELETE'},'/api/chat/attachments/'+C+'.jpg',undefined],
  [{path:'chat/memories?forgotten=1',method:'GET'},'/api/chat/memories?forgotten=1',undefined],
  [{path:'chat/memories',method:'POST',body:{text:'Prefiere café',kind:'preference',importance:3}},'/api/chat/memories','{"text":"Prefiere café","kind":"preference","importance":3}'],
  [{path:`chat/memories/${D}`,method:'PATCH',body:{importance:5}},`/api/chat/memories/${D}`,'{"importance":5}'],
  [{path:`chat/memories/${D}`,method:'DELETE'},`/api/chat/memories/${D}`,undefined],
  [{path:`chat/memories/${D}/restore`,method:'POST',body:{}},`/api/chat/memories/${D}/restore`,'{}'],
  [{path:`chat/memories/${D}/history`,method:'GET'},`/api/chat/memories/${D}/history`,undefined],
  [{path:'chat/stamp',method:'GET'},'/api/chat/stamp',undefined],
  ...['soma/dossier','soma/followup','school/summary','school/cards','weekly/review','dojo/turn','dojo/score','radar/news','radar/plans'].map(name=>[{path:name,method:'POST',body:{n:1}},'/api/'+name,'{"n":1}'])];
 for(const [args,url,body] of cases){
  assert.deepEqual(await host.request({...args,userId:A}),{ok:true},args.method+' '+args.path);
  const {url:sent,opts}=calls.at(-1);
  assert.equal(sent,ORIGIN+url);assert.equal(opts.method,args.method);assert.equal(opts.body,body);
  assert.equal(opts.redirect,'error');assert.equal(opts.credentials,'include');assert.equal(opts.headers.Origin,ORIGIN);assert.equal(opts.headers['X-Evie-Request'],'1');assert.equal(opts.headers['X-Evie-User'],A);assert.equal(opts.headers.Accept,'application/json');
  assert.equal(opts.headers['Content-Type'],body===undefined?undefined:'application/json');
 }
});

test('v10 routes reject other methods, malformed ids, traversal and unknown query parameters before any request',async()=>{
 const {host,calls}=await signedIn(async()=>Response.json({ok:true}));
 const bad=[['GET','soma/dossier'],['post','soma/dossier'],['PUT','chat/conversations'],['GET',`chat/conversations/${C}`],['POST',`chat/conversations/${C}`],['PUT',`chat/conversations/${C}`],['PATCH','chat/conversations'],['DELETE','chat/conversations'],['DELETE',messages(C)],['PATCH',messages(C)],['POST','chat/stamp'],['GET','data/stamp'],['GET',`chat/memories/${D}/restore`],['POST',`chat/memories/${D}/history`],['DELETE','chat/memories'],['GET','ai/stt'],['GET','ai/tts'],['POST','ai/chat'],
  ['GET','chat/conversations/123/messages'],['GET',`chat/conversations/${C}x/messages`],['GET',messages(C.slice(0,-1))],['GET',messages(C.replace(/-/g,''))],['GET','chat/conversations/../../auth/session'],['GET','chat/conversations/%2e%2e/messages'],['GET','chat//conversations'],['GET','chat/conversations/'],['GET','Chat/Conversations'],['GET','/chat/conversations'],['GET','chat/conversations#x'],['DELETE',`chat/memories/${D}/../${D}`],['POST','soma/dossier/'],['POST','soma'],['POST','chat'],
  ['POST','radar/news?force=1'],['GET','chat/conversations?archived=0'],['GET','chat/conversations?archived=1&archived=1'],['GET','chat/conversations?owner='+B],['GET','chat/conversations?q='],['GET','chat/conversations?q='+'x'.repeat(201)],['GET','chat/conversations?q=%0Aadmin'],['GET','chat/memories?archived=1'],['GET',messages(C)+'?x=1'],['GET','chat/stamp?forgotten=1'],
  ['GET',cont(C)],['PUT',cont(C)],['POST',cont('123')],['POST',cont(C)+'?r=1'],['GET','chat/attachments'],['PUT','chat/attachments'],['POST','chat/attachments/'+IMGN],['PATCH','chat/attachments/'+IMGN],['GET','chat/attachments/'+C],['GET','chat/attachments/'+C+'.gif'],['GET','chat/attachments/'+C+'.svg'],['GET','chat/attachments/ABCDEF01-2345-4678-9ABC-DEF012345678.png'],['GET','chat/attachments/'+C+'.png.png'],['GET','chat/attachments/../auth/session'],['GET','chat/attachments/%2e%2e%2f'+IMGN],['DELETE','chat/attachments/'+C],['GET','chat/attachments/'+IMGN+'?w=1']];
 for(const [method,p] of bad)await assert.rejects(host.request({path:p,method,userId:A}),/no permitida/,method+' '+p);
 for(const args of [{path:'chat/stamp',method:'GET',userId:A,headers:{}},{path:'chat/stamp',method:'GET',userId:A,extra:1},{path:'soma/dossier',method:'POST',userId:A,body:{},headers:{'X-Evie-Lang':'en'}},{path:'chat/stamp',method:'GET',userId:'not-a-uuid'},{path:'chat/stamp',method:'GET',userId:A,url:'https://evil.example'},{path:['chat/stamp'],method:'GET',userId:A},{path:'chat/stamp',userId:A}])await assert.rejects(host.request(args),/no permitida/,JSON.stringify(args));
 const small=createAccountHost({origin:ORIGIN,fetcher:async()=>Response.json({}),limits:{json:200}});
 await assert.rejects(small.request({path:'auth/signin',method:'POST',body:{email:'x'.repeat(300)}}),/no permitida/);
 assert.equal(calls.length,0);
});

test('v10 routes need the server-verified account; a 401 locks the desktop session',async()=>{
 const changes=[];let calls=0;
 const host=createAccountHost({origin:ORIGIN,onChange:id=>changes.push(id),fetcher:async url=>{calls++;if(url.endsWith('/auth/session'))return Response.json({user:{id:A}});return Response.json({error:'Inicia sesión.'},{status:401});}});
 await assert.rejects(host.request({path:'chat/conversations',method:'GET',userId:A}),/Cuenta no autorizada/);
 await assert.rejects(host.stream({path:messages(C),method:'POST',userId:A,body:{text:'Hola'}}),/Cuenta no autorizada/);
 assert.equal(calls,0);
 await host.request({path:'auth/session',method:'GET'});
 await assert.rejects(host.request({path:'soma/dossier',method:'POST',userId:B,body:{}}),/Cuenta no autorizada/);
 await assert.rejects(host.request({path:'school/cards',method:'POST',body:{}}),/Cuenta no autorizada/);
 await assert.rejects(host.request({path:'ai/stt',method:'POST',userId:B,body:new Uint8Array(500),headers:{'Content-Type':'audio/webm'}}),/Cuenta no autorizada/);
 assert.equal(calls,1);
 const error=await host.request({path:'chat/stamp',method:'GET',userId:A}).catch(e=>e);
 assert.equal(error.status,401);assert.equal(host.current(),null);assert.deepEqual(changes,[A,null]);
});

test('data/stamp passes the chat stamp through; Worker error codes and non-JSON failures reach the renderer',async()=>{
 const {host}=await signedIn(async url=>url.endsWith('/data/stamp')?Response.json({owner:A,stamp:'s1',chat:'c7'}):url.endsWith('/radar/news')?new Response('<html>Bad gateway</html>',{status:502,headers:{'Content-Type':'text/html'}}):Response.json({error:'Llegaste al límite diario de IA. Se reinicia mañana.',code:'daily_limit'},{status:429}));
 assert.deepEqual(await host.request({path:'data/stamp',method:'POST',userId:A,body:{}}),{owner:A,stamp:'s1',chat:'c7'});
 const limited=await host.request({path:'dojo/turn',method:'POST',userId:A,body:{}}).catch(e=>e);
 assert.equal(limited.status,429);assert.equal(limited.code,'daily_limit');assert.match(limited.message,/límite diario/);
 const gateway=await host.request({path:'radar/news',method:'POST',userId:A,body:{}}).catch(e=>e);
 assert.equal(gateway.status,502);assert.match(gateway.message,/No se pudo completar/);assert.equal(host.current(),A);
});

test('AI routes wait longer than account routes; a timeout aborts the upstream request',T,async()=>{
 const signals=[];
 const {host}=await signedIn((url,opts)=>new Promise((resolve,reject)=>{signals.push(opts.signal);const t=setTimeout(()=>resolve(Response.json({ok:true})),80);opts.signal.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('The operation was aborted.','AbortError'));});}),{limits:{timeout:20,ai:1000}});
 const error=await host.request({path:'chat/stamp',method:'GET',userId:A}).catch(e=>e);
 assert.equal(error.code,'timeout');assert.match(error.message,/tardó demasiado/);assert.equal(signals[0].aborted,true);
 assert.deepEqual(await host.request({path:'soma/dossier',method:'POST',userId:A,body:{}}),{ok:true});
 assert.equal(signals[1].aborted,false);
});

test('ai/stt forwards the audio bytes and only validated headers; X-Evie-Lang en/es is passed through',async()=>{
 const {host,calls}=await signedIn(async()=>Response.json({text:'hello there',billed_seconds:10}));
 const audio=new Uint8Array(4096).map((_,i)=>i%251);
 const result=await host.request({path:'ai/stt',method:'POST',userId:A,body:audio,headers:{'Content-Type':'audio/webm;codecs=opus','X-Evie-Duration':'12','X-Evie-Chunk':'0','X-Evie-Hint':encodeURIComponent('Kisha, EVIE'),'X-Evie-Lang':'en'}});
 assert.equal(result.text,'hello there');
 let {url,opts}=calls.at(-1);
 assert.equal(url,ORIGIN+'/api/ai/stt');assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error');
 assert.deepEqual(opts.headers,{Origin:ORIGIN,'X-Evie-Request':'1',Accept:'application/json','Content-Type':'audio/webm','X-Evie-Duration':'12','X-Evie-Chunk':'0','X-Evie-Hint':'Kisha%2C%20EVIE','X-Evie-Lang':'en','X-Evie-User':A});
 assert.ok(opts.body instanceof Uint8Array);assert.deepEqual([...opts.body],[...audio]);
 await host.request({path:'ai/stt',method:'POST',userId:A,body:audio.buffer,headers:{'content-type':'audio/mp4','x-evie-lang':'es'}});
 ({opts}=calls.at(-1));assert.equal(opts.headers['X-Evie-Lang'],'es');assert.equal(opts.headers['Content-Type'],'audio/mp4');assert.equal(opts.body.byteLength,4096);
 await host.request({path:'ai/stt',method:'POST',userId:A,body:audio,headers:{'Content-Type':'audio/ogg'}});
 ({opts}=calls.at(-1));assert.equal(Object.hasOwn(opts.headers,'X-Evie-Lang'),false);
 const sent=calls.length;
 for(const headers of [{'Content-Type':'audio/webm','X-Evie-Lang':'fr'},{'Content-Type':'audio/webm','X-Evie-Lang':'EN'},{'Content-Type':'audio/webm','X-Evie-Lang':'es-MX'},{'Content-Type':'audio/webm','X-Evie-Lang':''},{'Content-Type':'audio/webm','X-Evie-Lang':1},{'X-Evie-Lang':'en'},{'Content-Type':'text/plain'},{'Content-Type':'audio/webm','X-Evie-User':B},{'Content-Type':'audio/webm',Authorization:'Bearer x'},{'Content-Type':'audio/webm',Cookie:'evie_session=x'},{'Content-Type':'audio/webm','X-Evie-Duration':'1e3'},{'Content-Type':'audio/webm','X-Evie-Hint':'a\r\nX-Injected: 1'},{'Content-Type':'audio/webm','content-type':'audio/ogg'},{'Content-Type':'audio/webm',constructor:'x'},['audio/webm']])
  await assert.rejects(host.request({path:'ai/stt',method:'POST',userId:A,body:audio,headers}),/no permitida/,JSON.stringify(headers));
 for(const body of [undefined,'audio',{0:1},[1,2,3],new Uint8Array(0),new Uint8Array(LIMITS.audio+1)])
  await assert.rejects(host.request({path:'ai/stt',method:'POST',userId:A,body,headers:{'Content-Type':'audio/webm'}}),/no permitida/);
 await assert.rejects(host.request({path:'ai/stt',method:'POST',userId:A,body:audio}),/no permitida/);
 assert.equal(calls.length,sent);
});

test('chat SSE is piped chunk by chunk: chunks arrive before the Worker ends the stream, UTF-8 split safely',T,async()=>{
 const up=upstream();let opts;
 const {host}=await signedIn(async(url,o)=>{opts=o;return up.response();});
 const events=[];let settled=false;
 const pending=host.stream({path:messages(C),method:'POST',userId:A,body:{text:'Hola'}},{open:head=>events.push(['open',head]),chunk:text=>events.push(['chunk',text])});
 pending.then(()=>{settled=true;},()=>{settled=true;});
 await until(()=>opts);
 assert.equal(opts.headers.Accept,'text/event-stream');assert.equal(opts.headers['Content-Type'],'application/json');assert.equal(opts.body,'{"text":"Hola"}');assert.equal(opts.headers['X-Evie-User'],A);
 const meta=`event: meta\ndata: {"conversation":"${C}"}\n\n`;
 up.push(meta);
 await until(()=>events.length===2);
 assert.deepEqual(events,[['open',{status:200,contentType:'text/event-stream'}],['chunk',meta]]);
 const delta=enc.encode('event: delta\ndata: {"t":"¡Hola, ñandú!"}\n\n'),cut=delta.indexOf(0xc3)+1;
 up.raw(delta.slice(0,cut));up.raw(delta.slice(cut));
 await until(()=>events.map(e=>e[1]).join('').includes('ñandú'));
 assert.equal(settled,false);assert.equal(up.cancelled,false);
 const done='event: done\ndata: {"text":"¡Hola, ñandú!"}\n\n';up.push(done);up.end();
 assert.deepEqual(await pending,{streamed:true,status:200});
 const text=events.slice(1).map(e=>e[1]).join('');
 assert.equal(text,meta+'event: delta\ndata: {"t":"¡Hola, ñandú!"}\n\n'+done);assert.ok(!text.includes('�'));
});

test('the /continue round after Ivi\'s app tools streams through the same pipe; uploads are JSON, never streams',T,async()=>{
 const up=upstream();let opts,url;
 const {host}=await signedIn(async(u,o)=>{url=u;opts=o;return up.response();});
 const chunks=[];const pending=host.stream({path:cont(C),method:'POST',userId:A,body:{continuation:'c',outputs:[]}},{chunk:t=>chunks.push(t)});
 await until(()=>opts);assert.equal(url,ORIGIN+'/api/'+cont(C));assert.equal(opts.headers.Accept,'text/event-stream');assert.equal(opts.body,'{"continuation":"c","outputs":[]}');
 up.push('event: done\ndata: {"text":"Listo"}\n\n');up.end();
 assert.deepEqual(await pending,{streamed:true,status:200});assert.equal(chunks.join(''),'event: done\ndata: {"text":"Listo"}\n\n');
 await assert.rejects(host.stream({path:'chat/attachments',method:'POST',userId:A,body:{mime:'image/png',data:'iVBORw=='}},{}),/no permitida/);
});

test('a renderer abort cancels the upstream chat request mid-stream',T,async()=>{
 const up=upstream();let opts;
 const {host}=await signedIn(async(url,o)=>{opts=o;return up.response();});
 const ctl=new AbortController(),chunks=[];
 const pending=host.stream({path:messages(C),method:'POST',userId:A,body:{text:'Hola'}},{signal:ctl.signal,chunk:t=>chunks.push(t)}).catch(e=>e);
 await until(()=>opts);up.push('event: delta\ndata: {"t":"Ho"}\n\n');await until(()=>chunks.length===1);
 ctl.abort();
 await until(()=>opts.signal.aborted&&up.cancelled,1000);
 const error=await pending;
 assert.equal(error.aborted,true);assert.equal(error.code,'aborted');
 const early=new AbortController();early.abort();let reached=false;
 const {host:other}=await signedIn(async()=>{reached=true;return up.response();});
 assert.equal((await other.stream({path:messages(C),method:'POST',userId:A,body:{text:'x'}},{signal:early.signal}).catch(e=>e)).aborted,true);assert.equal(reached,false);
});

test('preload accountStream streams through a transferred MessagePort and abort() cancels upstream',T,async()=>{
 const up=upstream();let opts;
 const {host}=await signedIn(async(url,o)=>{opts=o;return up.response();});
 const served=[];
 const {api}=loadPreload((channel,args,ports)=>{assert.equal(channel,'evie:account-stream');assert.equal(ports.length,1);served.push(serveAccountStream(mainPort(ports[0]),host,args));});
 const events=[];
 const abort=api.accountStream({path:messages(C),method:'POST',userId:A,body:{text:'Hola'}},event=>events.push(event));
 assert.equal(typeof abort,'function');
 await until(()=>opts);
 up.push('event: delta\ndata: {"t":"Hola"}\n\n');
 await until(()=>events.some(e=>e.type==='chunk'));
 assert.deepEqual(events,[{type:'open',status:200,contentType:'text/event-stream'},{type:'chunk',text:'event: delta\ndata: {"t":"Hola"}\n\n'}]);
 abort();
 assert.deepEqual(events.at(-1),{type:'error',error:'Operación cancelada.',code:'aborted',aborted:true});
 await until(()=>opts.signal.aborted&&up.cancelled,1000);await Promise.all(served);
 abort();assert.equal(events.length,3);
 assert.throws(()=>api.accountStream({path:messages(C),method:'POST'},'not a function'));
});

test('preload accountStream: end after the last chunk; JSON answers, Worker errors and rejected routes are single final events',T,async()=>{
 const up=upstream();
 const {host}=await signedIn(async url=>url.includes(C)?up.response():url.includes(D)?Response.json({error:'Llegaste al límite diario de IA. Se reinicia mañana.',code:'daily_limit'},{status:429}):Response.json({text:'Hola (sin streaming)'},{status:200}));
 const {api}=loadPreload((channel,args,[port])=>{void serveAccountStream(mainPort(port),host,args);});
 const run=args=>new Promise(resolve=>{const list=[];api.accountStream(args,event=>{list.push(event);if(['end','json','error'].includes(event.type))setTimeout(()=>resolve(list),20);});});
 const streamed=run({path:messages(C),method:'POST',userId:A,body:{text:'Hola'}});
 up.push('event: delta\ndata: {"t":"Hola"}\n\n');up.push('event: done\ndata: {"text":"Hola"}\n\n');up.end();
 const list=await streamed;
 assert.deepEqual(list[0],{type:'open',status:200,contentType:'text/event-stream'});assert.deepEqual(list.at(-1),{type:'end'});
 assert.equal(list.slice(1,-1).map(e=>e.text).join(''),'event: delta\ndata: {"t":"Hola"}\n\nevent: done\ndata: {"text":"Hola"}\n\n');
 assert.deepEqual(await run({path:messages(D),method:'POST',userId:A,body:{text:'Hola'}}),[{type:'error',error:'Llegaste al límite diario de IA. Se reinicia mañana.',status:429,code:'daily_limit'}]);
 assert.deepEqual(await run({path:messages(E),method:'POST',userId:A,body:{text:'Hola'}}),[{type:'json',status:200,data:{text:'Hola (sin streaming)'}}]);
 assert.deepEqual(await run({path:'chat/conversations',method:'GET',userId:A}),[{type:'error',error:'Solicitud de cuenta no permitida.'}]);
 assert.deepEqual(await run({path:messages(C),method:'POST',userId:B,body:{text:'x'}}),[{type:'error',error:'Cuenta no autorizada.'}]);
});

test('closing the renderer port (reload/crash), an account change or a stalled stream all cancel upstream',T,async()=>{
 {const up=upstream();let opts;const {host}=await signedIn(async(url,o)=>{opts=o;return up.response();});
  const {port1,port2}=new TrackedChannel(),got=[];port1.on('message',v=>got.push(v));
  const served=serveAccountStream(mainPort(port2),host,{path:messages(C),method:'POST',userId:A,body:{text:'Hola'}});
  await until(()=>opts);up.push('event: delta\ndata: {"t":"Ho"}\n\n');await until(()=>got.some(e=>e.type==='chunk'));
  port1.close();await until(()=>opts.signal.aborted&&up.cancelled,1000);await served;}
 {const up=upstream();let opts;const {host}=await signedIn(async(url,o)=>{opts=o;return up.response();});
  const {port1,port2}=new TrackedChannel(),got=[];port1.on('message',v=>got.push(v));
  const served=serveAccountStream(mainPort(port2),host,{path:messages(C),method:'POST',userId:A,body:{text:'Hola'}});
  await until(()=>opts);up.push('event: delta\ndata: {"t":"Ho"}\n\n');await until(()=>got.some(e=>e.type==='chunk'));
  host.clear();await until(()=>opts.signal.aborted&&up.cancelled,1000);await served;await until(()=>got.some(e=>e.type==='error'));
  assert.deepEqual(got.at(-1),{type:'error',error:'La cuenta cambió.'});port1.close();}
 {const up=upstream();const {host}=await signedIn(async()=>up.response(),{limits:{streamIdle:40}});
  const error=await host.stream({path:messages(C),method:'POST',userId:A,body:{text:'Hola'}},{}).catch(e=>e);
  assert.equal(error.code,'timeout');assert.match(error.message,/tardó demasiado/);await until(()=>up.cancelled);}
 {const up=upstream();const {host}=await signedIn(async()=>up.response(),{limits:{streamBytes:16}});
  const pending=host.stream({path:messages(C),method:'POST',userId:A,body:{text:'Hola'}},{}).catch(e=>e);
  up.push('event: delta\ndata: {"t":"demasiado largo"}\n\n');
  assert.match((await pending).message,/demasiado grande/);await until(()=>up.cancelled);}
});

test('concurrent chat streams are capped and released when they finish',T,async()=>{
 const first=upstream(),second=upstream(),queue=[first,second];
 const {host}=await signedIn(async()=>queue.shift().response(),{limits:{streams:1}});
 const a=host.stream({path:messages(C),method:'POST',userId:A,body:{text:'1'}},{});
 await assert.rejects(host.stream({path:messages(D),method:'POST',userId:A,body:{text:'2'}},{}),/demasiadas respuestas/);
 first.end();assert.equal((await a).streamed,true);
 const b=host.stream({path:messages(D),method:'POST',userId:A,body:{text:'2'}},{});second.end();assert.equal((await b).streamed,true);
});

test('global hotkeys respect the globalShortcut toggle: type → Ivi composer, voice → Ivi voice; unregistered on demand',()=>{
 const gs=fakeGlobalShortcut(),log=[];let s={globalShortcut:false,voiceShortcut:DEFAULT_VOICE_SHORTCUT};
 const shortcuts=createShortcuts({globalShortcut:gs,settings:()=>s,reveal:mode=>log.push(['reveal',mode]),send:message=>log.push(['send',message])});
 assert.deepEqual(shortcuts.register(),[]);assert.equal(gs.map.size,0);
 s={...s,globalShortcut:true};
 assert.deepEqual(shortcuts.register(),[TYPE_SHORTCUT,'CommandOrControl+Shift+Space']);assert.equal(TYPE_SHORTCUT,'CommandOrControl+Space');
 gs.map.get('CommandOrControl+Space')();gs.map.get('CommandOrControl+Shift+Space')();
 assert.deepEqual(log,[['reveal','type'],['send',{type:'hotkey',mode:'type'}],['reveal','voice'],['send',{type:'hotkey',mode:'voice'}]]);
 assert.deepEqual(shortcuts.status(),{enabled:true,type:TYPE_SHORTCUT,voice:'CommandOrControl+Shift+Space',registered:[TYPE_SHORTCUT,'CommandOrControl+Shift+Space']});
 s={...s,voiceShortcut:'CommandOrControl+Alt+Space'};shortcuts.register();assert.deepEqual([...gs.map.keys()],[TYPE_SHORTCUT,'CommandOrControl+Alt+Space']);
 s={...s,voiceShortcut:'CommandOrControl+C'};shortcuts.register();assert.deepEqual([...gs.map.keys()],[TYPE_SHORTCUT,DEFAULT_VOICE_SHORTCUT]);
 s={...s,globalShortcut:false};shortcuts.register();assert.equal(gs.map.size,0);assert.equal(shortcuts.status().enabled,false);
 s={...s,globalShortcut:true};shortcuts.register();assert.equal(gs.map.size,2);shortcuts.unregister();assert.equal(gs.map.size,0);assert.deepEqual(shortcuts.status().registered,[]);
});

test('a hotkey taken by another app is reported and the other one still works; reveal errors never drop the message',()=>{
 const sent=[];
 const one=createShortcuts({globalShortcut:fakeGlobalShortcut(['CommandOrControl+Shift+Space']),settings:()=>({globalShortcut:true}),send:m=>sent.push(m),platform:'win32'});
 assert.deepEqual(one.register(),[TYPE_SHORTCUT]);assert.deepEqual(sent,[{type:'notice',text:'Ctrl+Mayús+Espacio global no está disponible.'}]);
 const both=createShortcuts({globalShortcut:fakeGlobalShortcut([TYPE_SHORTCUT,'CommandOrControl+Shift+Space']),settings:()=>({globalShortcut:true}),send:m=>sent.push(m),platform:'win32'});
 assert.deepEqual(both.register(),[]);assert.equal(sent.at(-1).text,'Ctrl+Espacio y Ctrl+Mayús+Espacio globales no están disponibles.');
 assert.equal(label('Alt+Shift+Space','win32'),'Alt+Mayús+Espacio');assert.equal(label(TYPE_SHORTCUT,'darwin'),'Cmd+Espacio');
 const gs=fakeGlobalShortcut(),out=[];createShortcuts({globalShortcut:gs,settings:()=>({globalShortcut:true}),reveal:()=>{throw Error('Ventana destruida.');},send:m=>out.push(m)}).register();
 gs.map.get(TYPE_SHORTCUT)();assert.deepEqual(out,[{type:'hotkey',mode:'type'}]);
});

test('voiceShortcut is a validated per-account setting (default Ctrl+Shift+Space); signed-out desktops register no hotkey',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'evie-hotkeys-'));
 try{
  const s=createSettings(dir);assert.equal(s.get().voiceShortcut,'CommandOrControl+Shift+Space');assert.equal(s.get().globalShortcut,false);
  for(const v of VOICE_SHORTCUTS){s.patch({voiceShortcut:v});assert.equal(createSettings(dir).get().voiceShortcut,v);}
  for(const v of [TYPE_SHORTCUT,'CommandOrControl+C','A','Alt+F4','Alt+Space','','CommandOrControl+Shift+Space ',null,1])assert.throws(()=>s.patch({voiceShortcut:v}),String(v));
  const old=path.join(dir,'old');fs.mkdirSync(old);fs.writeFileSync(path.join(old,'desktop-settings.json'),JSON.stringify({settingsVersion:2,globalShortcut:true}));
  assert.equal(createSettings(old).get().voiceShortcut,DEFAULT_VOICE_SHORTCUT);
  s.patch({globalShortcut:true});
  const scoped=scopedSettings(dir,{enabled:true}),gs=fakeGlobalShortcut(),hotkeys=createShortcuts({globalShortcut:gs,settings:()=>scoped.get()});
  assert.deepEqual(hotkeys.register(),[]);
  scoped.select(A);scoped.patch({globalShortcut:true,voiceShortcut:'Alt+Shift+Space'});assert.deepEqual(hotkeys.register(),[TYPE_SHORTCUT,'Alt+Shift+Space']);
  scoped.select(B);assert.deepEqual(hotkeys.register(),[]);
  scoped.select(null);assert.deepEqual(hotkeys.register(),[]);assert.equal(gs.map.size,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('preload onHotkey delivers only hotkey messages and keeps the one that arrived before the UI subscribed',T,async()=>{
 const {api,emit}=loadPreload();
 assert.equal(api.version,2);assert.equal(typeof api.onHotkey,'function');
 emit('evie:action',{type:'hotkey',mode:'voice'});
 const got=[];const off=api.onHotkey(event=>got.push(event));
 await until(()=>got.length===1);assert.deepEqual(got,[{type:'hotkey',mode:'voice'}]);
 emit('evie:action',{type:'listen'});emit('evie:action',{type:'hotkey',mode:'shell'});emit('evie:action',{type:'notice',text:'x'});emit('evie:action',{type:'hotkey',mode:'type',extra:'ignored'});
 assert.deepEqual(got,[{type:'hotkey',mode:'voice'},{type:'hotkey',mode:'type'}]);
 const actions=[];api.onAction(a=>actions.push(a.type));emit('evie:action',{type:'hotkey',mode:'type'});assert.deepEqual(actions,['hotkey']);assert.equal(got.length,3);
 off();emit('evie:action',{type:'hotkey',mode:'type'});assert.equal(got.length,3);
 assert.throws(()=>api.onHotkey('nope'));
});

test('main wires the stream port behind the trusted-origin check, hotkeys through shortcuts.cjs, and unregisters them on quit',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../electron/main/main.cjs'),'utf8');
 assert.match(src,/ipcMain\.on\('evie:account-stream',\(event,args\)=>\{[^\n]*if\(!isTrusted\(event\)\)throw[^\n]*limit\(\);[^\n]*serveAccountStream\(ports\[0\],account,args\)/);
 assert.match(src,/shortcuts=createShortcuts\(\{globalShortcut,settings:\(\)=>settings\.get\(\),reveal,send\}\)/);
 assert.match(src,/const s=settings\.patch\(args\);registerShortcut\(\);return s;/);
 assert.match(src,/app\.on\('before-quit',\(\)=>\{if\(shortcuts\)shortcuts\.unregister\(\);else globalShortcut\.unregisterAll\(\);/);
 assert.match(src,/app\.on\('will-quit',\(\)=>\{globalShortcut\.unregisterAll\(\);\}\)/);
 assert.ok(!/globalShortcut\.register\(/.test(src),'accelerators are only registered by shortcuts.cjs');
 const pre=fs.readFileSync(path.join(__dirname,'../electron/preload/preload.cjs'),'utf8');
 assert.match(pre,/ipcRenderer\.postMessage\('evie:account-stream',args,\[port2\]\)/);assert.ok(!/child_process|shell\.|require\('(?!electron)/.test(pre));
});
