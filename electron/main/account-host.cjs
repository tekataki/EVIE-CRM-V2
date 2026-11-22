'use strict';
// Renderer gets a narrow account API, never cookies, token storage or a URL.
// Every route is an exact method + strict path pattern (UUID segments where the Worker expects an id); query strings
// and extra headers are allow-listed per route. JSON in, JSON out, except:
//  · ai/stt sends the raw audio bytes (audio/*, ≤ 4 MB, the Worker's limit) with a few validated X-Evie-* headers;
//  · chat message POSTs may stream: when the Worker answers text/event-stream the body is piped to the renderer chunk
//    by chunk (never buffered) and a renderer abort cancels the upstream request.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
// timeout: auth/data/chat CRUD · ai: Worker routes that wait on Claude/OpenAI · stream*: idle gap, whole stream, bytes.
const LIMITS=Object.freeze({json:16000000,audio:4*1024*1024,timeout:30000,ai:180000,stt:60000,streamIdle:120000,streamTotal:600000,streamBytes:16*1024*1024,streams:3});
const flag=v=>v==='1',search=v=>v.length>0&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v);
const AUDIO=/^(audio\/(?:webm|ogg|mp4|mpeg|wav|x-wav|m4a|aac))(?:\s*;[\w\s.,="'+-]{0,80})?$/i;
// lower-case header name → [name sent upstream, check returning the value to send (falsy = rejected)].
const STT_HEADERS=Object.freeze({'content-type':['Content-Type',v=>AUDIO.exec(v)?.[1].toLowerCase()],'x-evie-duration':['X-Evie-Duration',v=>/^\d{1,4}$/.test(v)&&v],'x-evie-chunk':['X-Evie-Chunk',v=>/^\d{1,3}$/.test(v)&&v],'x-evie-hint':['X-Evie-Hint',v=>/^[A-Za-z0-9%._~!*'()-]{1,3000}$/.test(v)&&v],'x-evie-lang':['X-Evie-Lang',v=>(v==='en'||v==='es')&&v]});
const table=[
 ['GET','runtime',{anonymous:true}],['GET','auth/session',{anonymous:true}],['POST','auth/signin',{anonymous:true}],['POST','auth/signup',{anonymous:true}],['POST','auth/signout',{anonymous:true}],['POST','auth/google/start',{anonymous:true}],['POST','auth/google/redeem',{anonymous:true}],
 ['POST','data/pull'],['POST','data/push'],['POST','data/stamp'],
 ['POST','info/research',{timeout:'ai'}],['POST','info/weather'],['POST','info/learn',{timeout:'ai'}],
 // v10 · chat with Ivi and «Lo que Ivi sabe de ti»
 ['GET','chat/conversations',{query:{archived:flag,q:search}}],['POST','chat/conversations'],['PATCH','chat/conversations/:id'],['DELETE','chat/conversations/:id'],
 ['GET','chat/conversations/:id/messages'],['POST','chat/conversations/:id/messages',{timeout:'ai',stream:true}],
 ['GET','chat/memories',{query:{forgotten:flag}}],['POST','chat/memories'],['PATCH','chat/memories/:id'],['DELETE','chat/memories/:id'],['POST','chat/memories/:id/restore'],['GET','chat/memories/:id/history'],['GET','chat/stamp'],
 // v10 · modules whose Worker routes call the AI
 ...['soma/dossier','soma/followup','school/summary','school/cards','weekly/review','dojo/turn','dojo/score','radar/news','radar/plans'].map(name=>['POST',name,{timeout:'ai'}]),
 ['POST','ai/stt',{timeout:'stt',audio:true,headers:STT_HEADERS}]];
const ROUTES=Object.freeze(table.map(([method,name,options={}])=>Object.freeze({method,name,pattern:new RegExp('^'+name.replaceAll(':id',ID)+'$'),timeout:'timeout',...options})));
const AUTH_ACTIONS=new Set(['auth/signin','auth/signup','auth/signout','auth/session','auth/google/redeem']);
const RESETS=new Set(['auth/signin','auth/signup','auth/signout','auth/google/redeem']);
const IDENTITY=new Set(['auth/session','auth/signin','auth/signup','auth/google/redeem']);
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
  if(!route||(streaming&&!route.stream))throw denied();
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
 return {request:async args=>(await perform(args,null)).data,stream:async(args,sink={})=>perform(args,sink),clear,current:()=>current,enabled:()=>!!origin};
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
