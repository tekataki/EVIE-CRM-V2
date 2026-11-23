'use strict';
// Renderer gets a narrow account API, never cookies, token storage or a URL.
// Every route is an exact method + strict path pattern (UUID segments where the Worker expects an id); query strings
// and extra headers are allow-listed per route. JSON in, JSON out, except:
//  · ai/stt sends the raw audio bytes (audio/*, ≤ 4 MB, the Worker's limit) with a few validated X-Evie-* headers;
//  · chat message POSTs (and the /continue after Ivi's app tools) may stream: when the Worker answers text/event-stream
//    the body is piped to the renderer chunk by chunk (never buffered) and a renderer abort cancels the upstream request;
//  · chat images travel as JSON too: upload {mime,data(base64)}, download answers {name,mime,data} (Accept: JSON).
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Path segments, matching the Worker's own validators: :id UUID (chat) · :img chat image · :media synced photo ·
// :mem memory item/session (src/memory.js ID) · :v5 task/scene/plan (src/v5-routes.js ID) · :guest guest id.
const ID='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const IMG='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:webp|png|jpg)';
const SEGMENTS=Object.freeze({':id':ID,':img':IMG,':media':'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-t)?\\.(?:webp|png|jpg|jpeg)',':mem':'[a-z0-9][a-z0-9-]{7,63}',':v5':'[a-z]-[0-9a-f-]{36}',':guest':'[0-9a-fA-F-]{36}'});
// timeout: auth/data/chat CRUD · ai: Worker routes that wait on Claude/OpenAI · stream*: idle gap, whole stream, bytes.
const LIMITS=Object.freeze({json:16000000,audio:4*1024*1024,media:11*1024*1024,timeout:30000,ai:180000,stt:60000,streamIdle:120000,streamTotal:600000,streamBytes:16*1024*1024,streams:3});
const flag=v=>v==='1',search=v=>v.length>0&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v);
const AUDIO=/^(audio\/(?:webm|ogg|mp4|mpeg|wav|x-wav|m4a|aac))(?:\s*;[\w\s.,="'+-]{0,80})?$/i,IMAGE=/^image\/(?:webp|png|jpeg)$/i;
// lower-case header name → [name sent upstream, check returning the value to send (falsy = rejected)].
const STT_HEADERS=Object.freeze({'content-type':['Content-Type',v=>AUDIO.exec(v)?.[1].toLowerCase()],'x-evie-duration':['X-Evie-Duration',v=>/^\d{1,4}$/.test(v)&&v],'x-evie-chunk':['X-Evie-Chunk',v=>/^\d{1,3}$/.test(v)&&v],'x-evie-hint':['X-Evie-Hint',v=>/^[A-Za-z0-9%._~!*'()-]{1,3000}$/.test(v)&&v],'x-evie-lang':['X-Evie-Lang',v=>(v==='en'||v==='es')&&v]});
const table=[
 ['GET','runtime',{anonymous:true}],['GET','auth/session',{anonymous:true}],['POST','auth/signin',{anonymous:true}],['POST','auth/signup',{anonymous:true}],['POST','auth/signout',{anonymous:true}],['POST','auth/google/start',{anonymous:true}],['POST','auth/google/redeem',{anonymous:true}],['POST','auth/guest/redeem',{anonymous:true}],
 ['POST','data/pull'],['POST','data/push'],['POST','data/stamp'],
 ['POST','info/research',{timeout:'ai'}],['POST','info/weather'],['POST','info/learn',{timeout:'ai'}],
 // v10 · chat with Ivi and «Lo que Ivi sabe de ti»
 ['GET','chat/conversations',{query:{archived:flag,q:search}}],['POST','chat/conversations'],['PATCH','chat/conversations/:id'],['DELETE','chat/conversations/:id'],
 ['GET','chat/conversations/:id/messages'],['POST','chat/conversations/:id/messages',{timeout:'ai',stream:true}],['POST','chat/conversations/:id/continue',{timeout:'ai',stream:true}],
 ['POST','chat/attachments',{timeout:'ai'}],['GET','chat/attachments/:img'],['DELETE','chat/attachments/:img'],
 ['GET','chat/memories',{query:{forgotten:flag}}],['POST','chat/memories'],['PATCH','chat/memories/:id'],['DELETE','chat/memories/:id'],['POST','chat/memories/:id/restore'],['GET','chat/memories/:id/history'],['GET','chat/stamp'],
 // v10 · modules whose Worker routes call the AI
 ...['soma/dossier','soma/followup','school/summary','school/cards','weekly/review','dojo/turn','dojo/score','radar/news','radar/plans'].map(name=>['POST',name,{timeout:'ai'}]),
 ['POST','ai/stt',{timeout:'stt',audio:true,headers:STT_HEADERS}],
 // 2.4 · everything else the web app calls, so EVIE para Windows works like the web (Ivi's voice and actions,
 // spoken replies, Kisha, map, memory, tasks, scenes, plans, Google Calendar, profile, account admin, photos).
 ['POST','ai/chat',{timeout:'ai'}],['POST','ai/tts',{timeout:'ai',rawOut:true}],['GET','ai/status'],['GET','ai/tier'],['PUT','ai/tier'],['GET','ai/metrics'],['POST','ai/metrics'],
 ['POST','kisha/turn',{timeout:'ai'}],['POST','kisha/analyze',{timeout:'ai'}],
 ['GET','map/config'],['POST','map/search'],['POST','map/route'],['POST','map/route-query',{timeout:'ai'}],
 ['GET','memory'],['PUT','memory/settings'],['POST','memory/items'],['PATCH','memory/items/:mem'],['DELETE','memory/items/:mem'],['POST','memory/forget'],['POST','memory/sessions'],['DELETE','memory/sessions/:mem'],['POST','memory/recall'],['GET','memory/export'],['DELETE','memory'],
 ['GET','memory-v2'],['POST','memory-v2/items'],['POST','memory-v2/items/:mem/correct'],['GET','memory-v2/items/:mem/history'],['POST','memory-v2/search'],['GET','memory-v2/export'],
 ['GET','profile'],['PUT','profile'],['DELETE','profile'],
 ['GET','connections'],['POST','connections/google/start'],['GET','connections/google/events',{query:{date:v=>/^\d{4}-\d{2}-\d{2}$/.test(v)}}],['POST','connections/google/events'],['POST','connections/google/disconnect'],
 ['GET','tasks',{query:{status:v=>/^[a-z_]{2,20}$/.test(v)}}],['POST','tasks/find',{timeout:'ai'}],['GET','tasks/:v5'],['POST','tasks'],['PATCH','tasks/:v5'],['POST','tasks/:v5/complete'],['POST','tasks/:v5/reopen'],['POST','tasks/:v5/reschedule'],['DELETE','tasks/:v5'],
 ['GET','scenes'],['POST','scenes/resolve',{timeout:'ai'}],['POST','scenes'],['PUT','scenes/:v5'],['DELETE','scenes/:v5'],['POST','scenes/:v5/run'],
 ['POST','plan/propose',{timeout:'ai'}],['POST','plan/:v5/apply'],['POST','plan/:v5/discard'],['GET','plan/next',{query:{tz:v=>/^[A-Za-z0-9_+\-/]{1,64}$/.test(v)}}],
 ['POST','auth/claim-owner'],['POST','auth/invites'],['GET','auth/members'],['POST','auth/invites/revoke'],['POST','auth/password'],['GET','auth/google/status'],['GET','auth/guest'],['POST','auth/guest/:guest/revoke'],['POST','auth/guest/cleanup'],
 // Photos synced with the account: raw image bytes both ways (only through the evie://app/api pass-through).
 ['PUT','data/media/:media',{media:true}],['GET','data/media/:media',{rawOut:true}],['DELETE','data/media/:media']];
const ROUTES=Object.freeze(table.map(([method,name,options={}])=>Object.freeze({method,name,pattern:new RegExp('^'+name.replace(/:[a-z0-9]+/g,s=>{if(!Object.hasOwn(SEGMENTS,s))throw Error('Segmento sin patrón: '+s);return SEGMENTS[s];})+'$'),timeout:'timeout',...options})));
const AUTH_ACTIONS=new Set(['auth/signin','auth/signup','auth/signout','auth/session','auth/google/redeem','auth/guest/redeem']);
const RESETS=new Set(['auth/signin','auth/signup','auth/signout','auth/google/redeem','auth/guest/redeem']);
const IDENTITY=new Set(['auth/session','auth/signin','auth/signup','auth/google/redeem','auth/guest/redeem']);
// Never through the raw pass-through: they move the identity (IPC keeps `current` in step) or start sign-in.
const IPC_ONLY=new Set([...AUTH_ACTIONS,'auth/google/start']);
const JSON_HEADERS=Object.freeze({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
const ACCEPT=/^[a-z0-9*/+.,;=\s-]{1,200}$/i;
const FIELDS=new Set(['path','method','body','userId','headers']);
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const denied=()=>Error('Solicitud de cuenta no permitida.');
const SSE=/^text\/event-stream\s*(?:;|$)/i;
function createAccountHost({origin='',fetcher,onChange=()=>{},limits={}}={}){
 const L={...LIMITS,...limits};
 let current=null,epoch=0,authBusy=false,streams=0;const controllers=new Set();
 if(origin){const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('EVIE_ACCOUNT_API_ORIGIN debe ser un origen HTTPS sin ruta.');origin=u.origin;}
 function clear(){epoch++;controllers.forEach(c=>c.abort());controllers.clear();current=null;onChange(null);}
 function parse(args,streaming){
  if(!plain(args)||Object.keys(args).some(k=>!FIELDS.has(k))||typeof args.path!=='string'||args.path.length>1000||typeof args.method!=='string')throw denied();
  const cut=args.path.indexOf('?'),name=cut<0?args.path:args.path.slice(0,cut);
  const route=ROUTES.find(r=>r.method===args.method&&r.pattern.test(name));
  // Raw-byte answers (spoken replies, photos) and photo uploads only travel through the evie://app/api pass-through.
  if(!route||(streaming&&!route.stream)||route.rawOut||route.media)throw denied();
  if(args.userId!==undefined&&(typeof args.userId!=='string'||!UUID.test(args.userId)))throw denied();
  let query='';
  if(cut>=0){
   if(!route.query)throw denied();const seen=new Set(),parts=[];
   for(const [k,v] of new URLSearchParams(args.path.slice(cut+1))){if(!Object.hasOwn(route.query,k)||seen.has(k)||!route.query[k](v))throw denied();seen.add(k);parts.push(encodeURIComponent(k)+'='+encodeURIComponent(v));}
   query=parts.join('&');
  }
  const headers={};
  if(args.headers!==undefined){
   if(!route.headers||!plain(args.headers))throw denied();
   for(const [k,v] of Object.entries(args.headers)){const key=k.toLowerCase(),spec=Object.hasOwn(route.headers,key)?route.headers[key]:null,value=spec&&typeof v==='string'?spec[1](v):null;if(!value||Object.hasOwn(headers,spec[0]))throw denied();headers[spec[0]]=value;}
  }
  let body;
  if(route.audio){
   const raw=args.body,bytes=raw instanceof ArrayBuffer?new Uint8Array(raw):ArrayBuffer.isView(raw)?new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength):null;
   if(!headers['Content-Type']||!bytes||!bytes.byteLength||bytes.byteLength>L.audio)throw denied();body=bytes;
  }else{
   let size;try{size=JSON.stringify(args).length;}catch{throw denied();}if(size>L.json)throw denied();
   if(route.method==='POST'||route.method==='PATCH')body=JSON.stringify(args.body||{});
  }
  return {route,url:'/api/'+name+(query?'?'+query:''),headers,body};
 }
 // SSE pass-through: each upstream read is forwarded as decoded text; never accumulated.
 async function pipe(result,sink,signal,alive,stop){
  sink.open?.({status:result.status,contentType:'text/event-stream'});
  const reader=result.body.getReader(),decoder=new TextDecoder();let size=0,idle=null,done=false;
  const aborted=new Promise((_,reject)=>{const fail=()=>reject(Error('Operación cancelada.'));if(signal.aborted)fail();else signal.addEventListener('abort',fail,{once:true});});aborted.catch(()=>{});
  const total=setTimeout(()=>stop('timeout'),L.streamTotal);
  try{
   for(;;){
    clearTimeout(idle);idle=setTimeout(()=>stop('timeout'),L.streamIdle);
    const step=await Promise.race([reader.read(),aborted]);
    if(!alive())throw Error('La cuenta cambió.');
    if(step.done){done=true;break;}
    if(!ArrayBuffer.isView(step.value))throw Error('Respuesta de cuenta no válida.');
    size+=step.value.byteLength;if(size>L.streamBytes){stop('size');throw Error('La respuesta del servidor es demasiado grande.');}
    const text=decoder.decode(step.value,{stream:true});if(text)sink.chunk?.(text);
   }
   const tail=decoder.decode();if(tail)sink.chunk?.(tail);
  }finally{clearTimeout(idle);clearTimeout(total);if(!done)reader.cancel().catch(()=>{});}
 }
 async function perform(args,sink){
  const streaming=!!sink,{route,url,headers:extra,body}=parse(args,streaming);
  if(!origin){if(route.name==='runtime')return {streamed:false,status:200,data:{accountsEnabled:false,legacyOwnerId:null,providers:{spotify:false,whatsapp:false,instagram:false}}};throw Error('Las conexiones externas están desactivadas.');}
  if(!route.anonymous&&(!current||args.userId!==current))throw Error('Cuenta no autorizada.');
  const authAction=AUTH_ACTIONS.has(route.name);if(authAction&&authBusy)throw Error('Espera a que termine la operación de cuenta.');
  if(streaming&&streams>=L.streams)throw Error('Hay demasiadas respuestas en curso. Espera a que terminen.');
  if(authAction)authBusy=true;if(streaming)streams++;
  if(RESETS.has(route.name))clear();
  const ticket=epoch,controller=new AbortController();controllers.add(controller);
  let reason=null;const stop=why=>{if(!controller.signal.aborted){reason=why;controller.abort();}};
  const external=sink?.signal,onAbort=()=>stop('client');external?.addEventListener?.('abort',onAbort,{once:true});if(external?.aborted)stop('client');
  const timer=setTimeout(()=>stop('timeout'),L[route.timeout]);
  const failure=error=>{if(ticket!==epoch)return Error('La cuenta cambió.');if(reason==='timeout')return Object.assign(Error('El servidor tardó demasiado en responder.'),{code:'timeout'});if(reason==='client')return Object.assign(Error('Operación cancelada.'),{code:'aborted',aborted:true});if(reason==='size')return Error('La respuesta del servidor es demasiado grande.');return error;};
  try{
   if(controller.signal.aborted)throw failure(Error('Operación cancelada.'));
   const userId=route.anonymous?args.userId:current;let result;
   try{result=await fetcher(origin+url,{method:route.method,credentials:'include',cache:'no-store',redirect:'error',headers:{Origin:origin,'X-Evie-Request':'1',Accept:streaming?'text/event-stream':'application/json',...(typeof body==='string'?{'Content-Type':'application/json'}:{}),...extra,...(userId?{'X-Evie-User':userId}:{})},...(body===undefined?{}:{body}),signal:controller.signal});}catch(error){throw failure(error);}
   if(ticket!==epoch)throw Error('La cuenta cambió.');
   if(streaming&&result.ok&&result.body&&SSE.test(result.headers.get('content-type')||'')){
    clearTimeout(timer);
    try{await pipe(result,sink,controller.signal,()=>ticket===epoch,stop);}catch(error){throw failure(error);}
    return {streamed:true,status:result.status};
   }
   let data=null;try{data=await result.json();}catch(error){if(controller.signal.aborted)throw failure(error);}
   if(ticket!==epoch)throw Error('La cuenta cambió.');
   if(!result.ok){if(result.status===401)clear();const error=Error(typeof data?.error==='string'&&data.error?data.error:'No se pudo completar la solicitud de cuenta.');error.status=result.status;if(typeof data?.code==='string'&&/^[a-z0-9_]{1,64}$/.test(data.code))error.code=data.code;throw error;}
   if(!data||typeof data!=='object')throw Error('Respuesta de cuenta no válida.');
   if(route.name==='runtime'&&data.accountsEnabled!==true)throw Error('El servidor configurado no tiene cuentas habilitadas. No se abrió un perfil local alternativo.');
   if(IDENTITY.has(route.name)){
    const id=data.user?.id||null;if(id&&!UUID.test(id))throw Error('Identidad remota no válida.');
    if(current!==id){epoch++;for(const c of controllers)if(c!==controller)c.abort();current=id;onChange(id);}
   }
   return {streamed:false,status:result.status,data};
  }finally{clearTimeout(timer);controllers.delete(controller);external?.removeEventListener?.('abort',onAbort);if(authAction)authBusy=false;if(streaming)streams--;}
 }
 // Raw /api/* requests from the app's own page (evie://app/api/…, served by protocol.handle in main.cjs). Same route
 // table, identity rule and limits as request(), but bodies and answers pass through as bytes or streams, so the web
 // code (Ivi's spoken replies, synced photos, chat images, SSE) runs unchanged. Sign-in/out stay on the IPC path, and
 // no cookie, token or upstream URL ever reaches the page.
 async function http(req){
  const fail=(status,error)=>new Response(JSON.stringify({error}),{status,headers:JSON_HEADERS});
  let u;try{u=new URL(req.url);}catch{return fail(400,'Solicitud inválida.');}
  const method=String(req.method||'GET').toUpperCase(),name=u.pathname.startsWith('/api/')?u.pathname.slice(5):'';
  const route=ROUTES.find(r=>r.method===method&&r.pattern.test(name));
  if(!route||IPC_ONLY.has(route.name)||u.hash)return fail(403,denied().message);
  if(!origin)return fail(503,'Las conexiones externas están desactivadas.');
  let query='';
  if(u.search){if(!route.query)return fail(403,denied().message);const seen=new Set(),parts=[];for(const [k,v] of u.searchParams){if(!Object.hasOwn(route.query,k)||seen.has(k)||!route.query[k](v))return fail(403,denied().message);seen.add(k);parts.push(encodeURIComponent(k)+'='+encodeURIComponent(v));}query=parts.join('&');}
  if(!route.anonymous&&(!current||req.headers.get('x-evie-user')!==current))return fail(401,'Cuenta no autorizada.');
  const accept=req.headers.get('accept'),type=req.headers.get('content-type')||'',hasBody=['POST','PUT','PATCH'].includes(method);
  const headers={Origin:origin,'X-Evie-Request':'1',Accept:accept&&ACCEPT.test(accept)?accept:'application/json'};
  if(route.headers){for(const [key,spec] of Object.entries(route.headers)){const raw=req.headers.get(key);if(raw===null)continue;const value=spec[1](raw);if(!value)return fail(400,'Encabezado no permitido.');headers[spec[0]]=value;}if(route.audio&&!headers['Content-Type'])return fail(415,'Formato de audio no permitido.');}
  else if(hasBody){if(route.media){if(!IMAGE.test(type))return fail(415,'Formato de imagen no permitido.');headers['Content-Type']=type.toLowerCase();}else{if(!/^application\/json\s*(?:;|$)/i.test(type))return fail(415,'Usa JSON.');headers['Content-Type']='application/json';}}
  if(!route.anonymous)headers['X-Evie-User']=current;
  let body;
  if(hasBody){let bytes;try{bytes=new Uint8Array(await req.arrayBuffer());}catch{return fail(400,'Solicitud inválida.');}if(bytes.byteLength>(route.audio?L.audio:route.media?L.media:L.json))return fail(413,'La solicitud supera el límite.');body=bytes;}
  const ticket=epoch,controller=new AbortController();controllers.add(controller);
  let reason=null,sse=false,finished=false,idle=null;const stop=why=>{if(!controller.signal.aborted){reason=why;controller.abort();}};
  // Timers never keep the process alive on their own (unref); they still bound a request the page stops reading.
  const later=(fn,ms)=>{const t=setTimeout(fn,ms);t.unref?.();return t;};
  let timer=later(()=>stop('timeout'),L[route.timeout]);
  const end=()=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(idle);controllers.delete(controller);if(sse)streams--;};
  let result;
  try{result=await fetcher(origin+'/api/'+name+(query?'?'+query:''),{method,credentials:'include',cache:'no-store',redirect:'error',headers,...(body?{body}:{}),signal:controller.signal});}
  catch{end();return ticket!==epoch?fail(409,'La cuenta cambió.'):reason==='timeout'?fail(504,'El servidor tardó demasiado en responder.'):fail(502,'No se pudo conectar con el servidor.');}
  if(ticket!==epoch){stop('account');end();return fail(409,'La cuenta cambió.');}
  if(result.status===401){const text=await result.text().catch(()=>'');end();clear();return new Response(text||JSON.stringify({error:'Inicia sesión.'}),{status:401,headers:JSON_HEADERS});}
  const contentType=result.headers.get('content-type')||'application/octet-stream';
  const out={'Content-Type':contentType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(!result.body||[204,205,304].includes(result.status)){end();return new Response(null,{status:result.status,headers:out});}
  if(SSE.test(contentType)){if(streams>=L.streams){stop('busy');end();return fail(429,'Hay demasiadas respuestas en curso. Espera a que terminen.');}sse=true;streams++;clearTimeout(timer);timer=later(()=>stop('timeout'),L.streamTotal);}
  // Bytes are forwarded as they arrive (never buffered); idle gaps, total time and size are bounded like the IPC pipe.
  const reader=result.body.getReader();let size=0;const arm=()=>{clearTimeout(idle);idle=later(()=>stop('timeout'),L.streamIdle);};
  return new Response(new ReadableStream({
   start(){arm();},
   async pull(ctl){try{const step=await reader.read();if(ticket!==epoch)throw Error('La cuenta cambió.');if(step.done){end();ctl.close();return;}size+=step.value.byteLength;if(size>L.streamBytes){stop('size');throw Error('La respuesta del servidor es demasiado grande.');}arm();ctl.enqueue(step.value);}catch(error){end();reader.cancel().catch(()=>{});ctl.error(error);}},
   cancel(){stop('client');end();reader.cancel().catch(()=>{});}
  }),{status:result.status,headers:out});
 }
 return {request:async args=>(await perform(args,null)).data,stream:async(args,sink={})=>perform(args,sink),http,clear,current:()=>current,enabled:()=>!!origin};
}
// One MessagePort per streamed request (main side: Electron MessagePortMain).
// main → renderer: {type:'open',status,contentType} · {type:'chunk',text}… then one of {type:'end'} |
// {type:'json',status,data} (Worker answered JSON) | {type:'error',error,status?,code?,aborted?}; then the port closes.
// renderer → main: {type:'abort'}, or simply closing the port (also on reload/crash), cancels the upstream request.
function serveAccountStream(port,host,args){
 const controller=new AbortController();let live=true;
 const post=message=>{if(!live)return;try{port.postMessage(message);}catch{live=false;controller.abort();}};
 port.on('message',event=>{if(event?.data?.type==='abort')controller.abort();});
 port.on('close',()=>{live=false;controller.abort();});
 port.start();
 return host.stream(args,{signal:controller.signal,open:head=>post({type:'open',status:head.status,contentType:head.contentType}),chunk:text=>post({type:'chunk',text})})
  .then(result=>post(result.streamed?{type:'end'}:{type:'json',status:result.status,data:result.data}),
   error=>post({type:'error',error:String(error?.message||'No se pudo completar la solicitud de cuenta.'),...(Number.isInteger(error?.status)?{status:error.status}:{}),...(typeof error?.code==='string'?{code:error.code}:{}),...(error?.aborted===true?{aborted:true}:{})}))
  .finally(()=>{live=false;try{port.close();}catch{}});
}
module.exports={createAccountHost,serveAccountStream,ROUTES:Object.freeze(ROUTES.map(r=>r.method+' '+r.name)),LIMITS};
