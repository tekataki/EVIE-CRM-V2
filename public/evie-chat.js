'use strict';
/* EVIE v10 · Chat con Ivi (estilo ChatGPT/Claude) + «Lo que Ivi sabe de ti».
   Rutas: #chat (nueva conversación), #chat/<uuid> (conversación), #chat/memoria (memoria de largo plazo).
   Datos: /api/chat/* (Worker → Supabase con tu token; todo cifrado en el Worker). Respuestas en streaming (SSE)
   con detener, regenerar y editar el último mensaje; voz (Groq) y lectura en voz alta (Fish Audio).
   Imágenes: botón, pegar o arrastrar (máx. 4 por mensaje). Se comprimen aquí (WebP o JPEG, ≤1600 px), se suben como
   JSON a /api/chat/attachments (carpeta privada del usuario en Supabase) y Ivi las ve; en las burbujas llegan con tu
   sesión como blob: (nunca URL pública) y se abren en grande con un toque.
   Acciones: Ivi puede consultar y registrar en tus módulos (gasto/ingreso, traspaso, entreno, pendiente). Cuando el
   modelo pide herramientas el stream termina con «tools»: aquí se ejecutan sobre TUS datos con los mismos ejecutores
   de la voz (EvieAssistant.runTool, con deshacer), se muestran comprobantes y se sigue en /continue (máx. 3 rondas).
   Sincronización entre dispositivos: account-ui.js avisa cuando cambia el sello del chat → EvieChat.refresh(). */
window.EvieChat=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const MD=()=>window.EvieMarkdown;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const TIERS=[['chispa','Chispa','zap','Rápido'],['enfoque','Enfoque','crosshair','Equilibrado'],['profundo','Profundo','brain','Más análisis']];
 const KINDS={profile:'Perfil',preference:'Preferencia',project:'Proyecto',goal:'Meta',person:'Persona',decision:'Decisión',fact:'Dato'};
 const SUGGEST=[['piggy-bank','Hazme un plan de ahorro mensual para una meta grande'],['handshake','Prepárame una visita de ventas a un restaurante'],['graduation-cap','Explícame un tema de la escuela como si fuera audio'],['map','Ideas para el fin de semana cerca de mí, sin gastar de más']];
 const S={list:[],listLoaded:false,listLoading:false,archived:false,q:'',cur:null,conv:null,msgs:[],loadingMsgs:false,stream:null,tier:null,research:false,drawer:false,error:null,mem:null,memLoading:false,memForgotten:false,memKind:'all',rec:null,speaking:null,entered:false,att:[],undone:new Set()};
 // Images: name → blob: URL (session cache), pending downloads, names that failed; receipts: call id → undo (live only).
 const IMG=new Map(),IMG_WAIT=new Map(),IMG_MISS=new Set(),UNDO=new Map();
 const MAX_IMG=4,IMG_SIDE=1600,IMG_Q=.85,IMG_BYTES=6*1024*1024,TOOL_ROUNDS=3,TOOL_CALLS=8,TOOL_OUTPUT=8000;
 // App tools the chat may run (same contract as src/chat.js CHAT_TOOLS); writes leave a receipt.
 const WRITES=new Set(['log_transaction','transfer_money','log_workout','edit_record']);
 const CHAT_TOOLS=new Set(['get_today_overview','get_agenda','get_finance_summary','get_business_summary','get_goals','get_habits','get_gym_summary','search_records','list_accounts',...WRITES]);
 const DONE=new Set(['created','updated','deleted','duplicate']);
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const canAttach=()=>cloud()&&EvieAccounts.current?.()?.role!=='guest';
 const ai=()=>EvieAccounts.config?.()?.ai||{};
 const me=()=>EvieAccounts.current?.()?.id||'';
 const req=(p,o)=>EvieAccounts.request('chat/'+p,o);
 const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';}catch{return true;}};
 const M=()=>!reduced()&&window.Motion?.animate?window.Motion:null;
 const anim=(els,kf,o={})=>{const m=M(),list=[...(els||[])].filter(Boolean);if(!m||!list.length)return;const clean=()=>list.forEach(n=>{n.style.opacity='';n.style.transform='';});try{const a=m.animate(list,kf,{type:'spring',stiffness:300,damping:28,...o});(a?.finished||Promise.resolve()).then(clean,clean);setTimeout(clean,1800);}catch{clean();}};
 const icons=root=>{try{window.lucide?.createIcons?.({root});}catch{}};
 const prefs=()=>Store.get()?.preferences||{};
 const context=()=>{const st=Store.get()||{},p=st.profile||{};return {name:String(p.preferred||p.name||'').slice(0,40),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,currency:window.DALI_CONFIG?.currency||'MXN',mode:prefs().iviMode||'asistente',persona:prefs().iviPersona||{},situation:window.IviProactive?.situation?.()||null};};
 const when=iso=>{if(!iso)return '';const d=new Date(iso),now=new Date();const day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();const diff=Math.round((day(now)-day(d))/864e5);
  return diff===0?d.toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'}):diff===1?'Ayer':diff<7?d.toLocaleDateString('es-MX',{weekday:'long'}):d.toLocaleDateString('es-MX',{day:'numeric',month:'short'});};
 const groupOf=c=>{if(c.pinned)return 'Fijadas';const d=new Date(c.updated_at),now=new Date(),diff=(new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5;return diff<=0?'Hoy':diff<=1?'Ayer':diff<=7?'Últimos 7 días':'Anteriores';};

 /* ---------------- data ---------------- */
 async function loadList(){if(!cloud()||S.listLoading)return;S.listLoading=true;try{const r=await req('conversations'+(S.archived?'?archived=1':'')+(S.q?(S.archived?'&':'?')+'q='+encodeURIComponent(S.q):''));S.list=r.conversations||[];S.listLoaded=true;S.error=null;}catch(err){S.error=err.message;}finally{S.listLoading=false;paintList();}}
 async function open(id){if(!UUID.test(id)||!cloud())return;if(S.stream&&S.stream.conv!==id)stop();S.cur=id;S.loadingMsgs=true;S.drawer=false;paintThread();
  try{const r=await req('conversations/'+id+'/messages');if(S.cur!==id)return;S.conv=r.conversation;S.msgs=r.messages||[];S.tier=r.conversation.tier;S.error=null;}catch(err){if(S.cur===id){S.error=err.status===404?'No encontré esa conversación.':err.message;S.conv=null;S.msgs=[];}}finally{if(S.cur===id){S.loadingMsgs=false;paintAll();scrollEnd(true);}}}
 function startNew(){stop();S.cur=null;S.conv=null;S.msgs=[];S.error=null;S.drawer=false;if(UI.section==='chat'&&UI.id){history.replaceState(null,'','#chat');UI.id=null;}paintAll();setTimeout(()=>document.getElementById('ch-input')?.focus(),40);}
 async function ensureConversation(){if(S.cur&&S.conv)return S.cur;const r=await req('conversations',{method:'POST',body:{tier:S.tier||undefined,private:!!S.privateNext}});S.privateNext=false;S.conv=r.conversation;S.cur=r.conversation.id;S.list=[r.conversation,...S.list];history.replaceState(null,'','#chat/'+S.cur);UI.id=S.cur;return S.cur;}

 /* ---------------- streaming ---------------- */
 let raf=0;
 function paintLive(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const el=document.getElementById('ch-live');if(!el||!S.stream)return;const md=el.querySelector('.ch-md');if(md&&S.stream.text){md.innerHTML=MD().render(S.stream.text)+'<span class="ch-caret" aria-hidden="true"></span>';}
  const x=el.querySelector('.ch-live-extra'),h=liveExtra();if(x&&x.dataset.h!==h){x.dataset.h=h;x.innerHTML=h;icons(x);}scrollEnd();});}
 /** Desktop app (Electron): the same SSE stream through the account proxy (MessageChannel), as a fetch-like Response. */
 function desktopStream(path,{body,signal}={}){return new Promise((resolve,reject)=>{const enc=new TextEncoder();let ctl=null,opened=false,abort=()=>{};
  const stream=new ReadableStream({start(c){ctl=c;},cancel(){abort();}});
  abort=window.evieDesktop.accountStream({path,method:'POST',body,userId:me()},ev=>{
   if(ev.type==='open'){opened=true;resolve(new Response(stream,{status:ev.status,headers:{'Content-Type':'text/event-stream'}}));}
   else if(ev.type==='chunk'){try{ctl.enqueue(enc.encode(ev.text));}catch{}}
   else if(ev.type==='end'){try{ctl.close();}catch{}}
   else if(ev.type==='json')resolve(new Response(JSON.stringify(ev.data),{status:ev.status,headers:{'Content-Type':'application/json'}}));
   else{const err=ev.aborted?new DOMException('Operación cancelada.','AbortError'):Object.assign(Error(ev.error||'Ivi no pudo responder.'),{status:ev.status,code:ev.code});if(opened){try{ctl.error(err);}catch{}}else reject(err);}});
  if(signal){if(signal.aborted)abort();else signal.addEventListener('abort',()=>abort(),{once:true});}});}
 /** POST that answers SSE: fetch on the web, the account proxy's MessagePort in the desktop app. */
 const post=(path,payload,signal)=>window.evieDesktop?.accountStream?desktopStream(path,{body:payload,signal}):fetch('/api/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-Evie-Request':'1','Content-Type':'application/json',Accept:'text/event-stream','X-Evie-User':me()},body:JSON.stringify(payload),signal});
 /** Reads one SSE response (meta/delta/tools/done/error). Returns {tools} when the model asked for app tools. */
 async function readStream(res,turn){
  if(!res.ok||!res.body){let msg='Ivi no pudo responder.',code;try{const j=await res.json();msg=j.error||msg;code=j.code;}catch{}throw Object.assign(Error(msg),{status:res.status,code});}
  const reader=res.body.getReader(),dec=new TextDecoder();let buf='',tools=null,gap=!!S.stream?.text;
  for(;;){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let k;
   while((k=buf.indexOf('\n\n'))>=0){const block=buf.slice(0,k);buf=buf.slice(k+2);const ev=(block.match(/^event: (.*)$/m)||[])[1],data=(block.match(/^data: (.*)$/m)||[])[1];if(!ev||!data)continue;let d;try{d=JSON.parse(data);}catch{continue;}
    if(ev==='meta'){const u=S.msgs.find(m=>m.id==='tmp-u');if(u&&d.user_message){u.id=d.user_message.id;u.seq=d.user_message.seq;}if(d.user_message?.seq)turn.seq=d.user_message.seq;if(d.title&&S.conv){S.conv.title=d.title;}if(d.tier?.downgraded&&!d.round)App.toast(`Usé ${d.tier.label} para cuidar tu presupuesto de hoy.`,'success');if(S.stream)S.stream.meta=d;}
    else if(ev==='delta'){if(!S.stream)continue;if(gap){S.stream.text+=/\n\s*$/.test(S.stream.text)?'\n':'\n\n';gap=false;}S.stream.text+=d.t;paintLive();}
    else if(ev==='tools'){tools=d;}
    else if(ev==='done'){S.msgs.push({id:d.message.id,seq:d.message.seq,role:'assistant',text:d.text,sources:d.sources||[],meta:{model:d.model,tier:d.tier?.id,stop_reason:d.stop_reason,web:!!d.checked_at,...(Array.isArray(d.actions)&&d.actions.length?{actions:d.actions}:{})},memory_used:d.memory_used||[]});if(d.title&&S.conv)S.conv.title=d.title;S.stream=null;}
    else if(ev==='error'){throw Object.assign(Error(d.error||'Ivi no pudo responder.'),{code:d.code});}}}
  return {tools};}
 async function send({text='',regenerate=false,edit=false,attachments=null}={}){
  if(S.stream)return;const t=String(text).trim(),fromTray=!regenerate&&!edit&&attachments===null;
  if(fromTray&&uploading()){App.toast('Espera a que terminen de subir las imágenes.','error');return;}
  const tray=fromTray?S.att.filter(a=>a.status==='ready'&&a.name):[],imgs=(attachments||tray.map(a=>a.name)).slice(0,MAX_IMG);
  const lastUser=edit?[...S.msgs].reverse().find(m=>m.role==='user'):null,keep=lastUser?.images||[];
  if(!regenerate&&!t&&!imgs.length&&!(edit&&keep.length))return;
  if(!cloud()){App.toast('El chat necesita tu cuenta EVIE con sesión iniciada.','error');return;}
  if(window.evieDesktop?.account&&!window.evieDesktop?.accountStream){App.toast('Actualiza la app de escritorio para usar el chat con respuestas en vivo.','error');return;}
  let id;try{id=await ensureConversation();}catch(err){App.toast(err.message||'No pude crear la conversación.','error');return;}
  const ctl=new AbortController();S.stream={conv:id,ctl,text:'',mode:regenerate?'regenerate':edit?'edit':'send',actions:[],phase:null};S.error=null;
  if(regenerate){if(S.msgs.at(-1)?.role==='assistant')S.msgs.pop();}
  else if(edit){const i=S.msgs.map(m=>m.role).lastIndexOf('user');if(i>=0)S.msgs=S.msgs.slice(0,i);S.msgs.push({id:'tmp-u',seq:0,role:'user',text:t,images:keep,meta:{}});}
  else S.msgs.push({id:'tmp-u',seq:0,role:'user',text:t,images:imgs,meta:{}});
  // The tray empties: its previews are already cached (IMG) under the uploaded names; failed ones are dropped.
  if(fromTray&&S.att.length){for(const a of S.att)if(!(a.status==='ready'&&a.name)&&a.url)URL.revokeObjectURL(a.url);S.att=[];}
  const input=document.getElementById('ch-input');if(input&&!regenerate){input.value='';autosize(input);}
  paintThread();paintComposer();scrollEnd(true);anim(document.querySelectorAll('.ch-msg:last-child,.ch-msg.is-user:nth-last-child(2)'),{opacity:[0,1],y:[14,0]});
  window.EvieSounds?.play?.('send');
  try{
   const payload={text:t,regenerate,edit,tier:S.tier||undefined,research:S.research||undefined,context:context(),tools:true,...(!regenerate&&!edit&&imgs.length?{attachments:imgs}:{})};
   let res=await post('chat/conversations/'+id+'/messages',payload,ctl.signal);const turn={conv:id,seq:0,counts:new Map()};
   for(let round=0;;round++){
    const {tools}=await readStream(res,turn);if(!tools||!S.stream)break;
    if(round>=TOOL_ROUNDS)throw Error('Ivi necesitó demasiados pasos. Intenta pedirlo de otra forma.');
    const calls=(Array.isArray(tools.calls)?tools.calls:[]).slice(0,TOOL_CALLS);S.stream.phase=calls.some(c=>WRITES.has(c?.name))?'write':'read';paintLive();
    const outputs=await runCalls(calls,turn);
    if(ctl.signal.aborted)throw new DOMException('Operación cancelada.','AbortError');
    S.stream.phase=null;paintLive();
    res=await post('chat/conversations/'+id+'/continue',{continuation:tools.continuation,outputs,context:context()},ctl.signal);
   }
   if(S.stream){const partial=S.stream.text,acts=S.stream.actions;S.stream=null;if(S.cur===id&&(partial||acts.length))S.msgs.push({id:'tmp-a',role:'assistant',text:partial,meta:{stop_reason:'cut',...(acts.length?{actions:acts}:{})}});}
   window.EvieSounds?.play?.('receive');
  }catch(err){const live=S.stream,partial=live?.text||'',acts=live?.actions||[];const aborted=err.name==='AbortError';S.stream=null;
   // Whatever Ivi already did stays visible (with «Deshacer») even if the answer could not finish — in its own chat.
   if(S.cur===id&&(partial||acts.length))S.msgs.push({id:'tmp-a',role:'assistant',text:partial,meta:{stop_reason:aborted?'stopped':'error',...(acts.length?{actions:acts}:{})}});
   if(!aborted&&S.cur===id)S.error=err.message||'Ivi no pudo responder.';}
  paintAll();scrollEnd(true);anim(document.querySelectorAll('.ch-msg.is-ivi:last-of-type .ch-actions'),{opacity:[0,1]});
  // The conversation list order/title changed: refresh quietly.
  loadList();}
 function stop(){if(S.stream){try{S.stream.ctl.abort();}catch{}}}

 /* ---------------- app tools (run here, on the user's own data) ---------------- */
 function hash(s){let h1=0x811c9dc5,h2=0x1000193;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,16777619)>>>0;h2=Math.imul(h2+c,2654435761)>>>0;}return h1.toString(36)+h2.toString(36);}
 const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
 const clean=(s,n=90)=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
 const todayStr=()=>window.Domain?.today?.()||new Date().toISOString().slice(0,10);
 /** Stable op id per (conversation, user message, action): «Regenerar», an edit with the same data or a repeated round
     finds the record it already saved instead of saving it twice. */
 function opKey(turn,name,a){const core=name==='log_transaction'?[a.type,Number(a.amount)||0,a.date||todayStr()]:name==='transfer_money'?[Number(a.amount)||0,norm(a.from_account),norm(a.to_account),a.date||todayStr()]:name==='log_workout'?[a.date||todayStr(),(Array.isArray(a.muscles)?a.muscles:[]).map(norm).sort().join(',')]:[a.op,norm(a.title),a.date||'',a.time||''];
  const base=[turn.conv,turn.seq,name,...core].join('|'),n=(turn.counts.get(base)||0)+1;turn.counts.set(base,n);return 'ivi-'+hash(base+'|'+n);}
 function money(v){const n=Number(v)||0;try{return new Intl.NumberFormat('es-MX',{style:'currency',currency:window.DALI_CONFIG?.currency||'MXN',minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n);}catch{return '$'+n;}}
 function dayLabel(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return 'hoy';const t=Date.parse(todayStr()+'T12:00:00Z'),x=Date.parse(d+'T12:00:00Z'),diff=Math.round((x-t)/864e5);
  return diff===0?'hoy':diff===-1?'ayer':diff===1?'mañana':new Date(x).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});}
 /** Short receipt label («Gasto registrado · $250 · Comida · Efectivo») from the call, its result and the saved record. */
 function receipt(name,a,out,op){const st=String(out?.status||(out?.error?'error':'unknown')),dup=st==='duplicate';
  if(/^needs/.test(st))return {status:st,summary:clean(out?.question||'Falta un dato.',160)};
  if(!DONE.has(st))return {status:st==='unknown'?'error':st,summary:'No se pudo registrar: '+clean(out?.error||out?.summary||'intenta de nuevo',120)};
  const p=[];
  if(name==='log_transaction'){const tx=(Store.get()?.transactions||[]).find(x=>x.op_id===op&&!x.deleted_at),inc=(tx?.type||a.type)==='income';p.push(dup?'Ya estaba registrado':inc?'Ingreso registrado':'Gasto registrado',money(tx?tx.amount/100:a.amount),tx?.category||a.category||a.title,out?.account||(tx?.evie_account&&window.EvieFinance?.accountLabel?.(tx.evie_account))||'Sin cuenta');}
  else if(name==='transfer_money')p.push(dup?'Ese traspaso ya estaba':'Traspaso registrado',money(a.amount),clean(a.from_account,30)+' → '+clean(a.to_account,30));
  else if(name==='log_workout')p.push(dup?'Ese entreno ya estaba':'Entreno anotado',(Array.isArray(a.muscles)?a.muscles:[]).slice(0,4).join(', ')||'Entrenamiento',dayLabel(a.date));
  else p.push(dup?'Ya estaba en tu agenda':'Pendiente agregado',clean(a.title||'Pendiente',60),[a.date?dayLabel(a.date):'',/^\d{2}:\d{2}$/.test(a.time||'')?a.time:''].filter(Boolean).join(' '));
  return {status:st,summary:p.map(x=>clean(x,60)).filter(Boolean).join(' · ').slice(0,160)};}
 async function runCalls(calls,turn){const outputs=[],live=S.stream;
  for(const call of calls){if(!call||typeof call.call_id!=='string'||typeof call.name!=='string')continue;
   let args={};try{const v=JSON.parse(call.arguments||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))args=v;}catch{}
   let out,undo=null;const write=WRITES.has(call.name),op=write?opKey(turn,call.name,args):call.call_id;
   if(!CHAT_TOOLS.has(call.name)||(call.name==='edit_record'&&args.op!=='agenda.create'))out={status:'error',error:'Esa acción no está disponible en el chat.'};
   else if(!window.EvieAssistant?.runTool)out={status:'error',error:'Ivi aún no está lista en este dispositivo. Recarga la página.'};
   else{try{const r=await EvieAssistant.runTool(call.name,args,{call_id:op,name:call.name});out=r.output;undo=r.undo;}catch(err){out={status:'error',error:err?.message||'No se pudo completar.'};}}
   let summary='';
   if(write){const rc=receipt(call.name,args,out,op);summary=rc.summary;if(live){live.actions.push({id:call.call_id,name:call.name,status:rc.status,summary});if(undo&&DONE.has(rc.status)&&rc.status!=='duplicate')UNDO.set(call.call_id,undo);}}
   let text='{}';try{text=JSON.stringify(out??{});}catch{}
   outputs.push({call_id:call.call_id,output:text.slice(0,TOOL_OUTPUT),...(summary?{summary}:{})});}
  paintLive();return outputs;}
 function undoAction(id){const fn=UNDO.get(id);if(!fn)return;UNDO.delete(id);try{fn();S.undone.add(id);App.toast('Listo, lo deshice.','success');}catch(err){App.toast(err?.message||'No pude deshacerlo.','error');}if(UI.section==='chat')paintThread();}
 /** Receipts under an answer. Undo only while the page lives (the function is not stored). */
 function receiptsHtml(list){const items=(Array.isArray(list)?list:[]).filter(a=>a&&a.summary&&!/^needs/.test(a.status||''));if(!items.length)return '';
  return `<ul class="ch-receipts" aria-label="Lo que Ivi hizo en tu app">${items.map(a=>{const ok=DONE.has(a.status),undone=S.undone.has(a.id),can=ok&&a.status!=='duplicate'&&!undone&&UNDO.has(a.id);
   return `<li class="ch-receipt ${ok?'is-ok':'is-bad'}${undone?' is-undone':''}">${ic(undone?'undo-2':ok?'check':'x')}<span>${e(undone?'Deshecho · '+a.summary:a.summary)}</span>${can?`<button type="button" class="ch-receipt-undo" data-ch="undo" data-id="${e(a.id)}">Deshacer</button>`:''}</li>`;}).join('')}</ul>`;}
 function liveExtra(){const s=S.stream;if(!s)return '';return receiptsHtml(s.actions)+(s.phase?`<p class="ch-working">${ic('loader-circle')}<span>${s.phase==='write'?'Registrando en tu app…':'Revisando tus datos…'}</span></p>`:'');}

 /* ---------------- images ---------------- */
 let attSeq=0;
 const uploading=()=>S.att.some(a=>a.status==='compressing'||a.status==='uploading');
 const blobB64=blob=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).replace(/^data:[^,]*,/,''));r.onerror=()=>ko(Error('No pude leer la imagen.'));r.readAsDataURL(blob);});
 const b64Blob=(data,type)=>{const bin=atob(data),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type});};
 const toBlob=(canvas,type,q)=>new Promise(ok=>{try{canvas.toBlob(b=>ok(b),type,q);}catch{ok(null);}});
 async function decode(file){if(window.createImageBitmap){try{const b=await createImageBitmap(file,{imageOrientation:'from-image'});return {src:b,w:b.width,h:b.height,done:()=>b.close?.()};}catch{}}
  const url=URL.createObjectURL(file);try{const img=await new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ko(Error('No pude leer esa imagen. Prueba con una foto JPG o PNG.'));i.src=url;});return {src:img,w:img.naturalWidth,h:img.naturalHeight,done:()=>URL.revokeObjectURL(url)};}catch(err){URL.revokeObjectURL(url);throw err;}}
 /** Canvas → WebP (JPEG where the browser cannot encode WebP), ≤1600 px on the long side, quality ≈0.85, ≤6 MB. */
 async function shrink(file){if(file.size>40*1024*1024)throw Error('Esa imagen es demasiado grande.');const d=await decode(file);
  try{if(!d.w||!d.h)throw Error('No pude leer esa imagen.');
   for(const side of [IMG_SIDE,1280,960]){const k=Math.min(1,side/Math.max(d.w,d.h)),w=Math.max(1,Math.round(d.w*k)),h=Math.max(1,Math.round(d.h*k)),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(d.src,0,0,w,h);
    let blob=await toBlob(c,'image/webp',IMG_Q);if(!blob||blob.type!=='image/webp'){g.globalCompositeOperation='destination-over';g.fillStyle='#fff';g.fillRect(0,0,w,h);blob=await toBlob(c,'image/jpeg',IMG_Q);}
    if(blob&&blob.size<=IMG_BYTES&&/^image\/(webp|jpeg)$/.test(blob.type))return {blob,mime:blob.type};}
   throw Error('No pude comprimir esa imagen.');}finally{d.done();}}
 const isImage=f=>!!f&&(/^image\//.test(f.type||'')||/\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(f.name||''));
 function addFiles(list){if(!canAttach()){App.toast(cloud()?'Las cuentas de invitado no pueden usar imágenes en el chat.':'Inicia sesión para adjuntar imágenes.','error');return;}
  const files=[...(list||[])].filter(isImage);if(!files.length){App.toast('Solo puedo adjuntar imágenes.','error');return;}
  const room=MAX_IMG-S.att.length;if(room<=0){App.toast('Máximo 4 imágenes por mensaje.','error');return;}
  if(files.length>room)App.toast(`Máximo 4 imágenes por mensaje: agregué ${room}.`,'error');
  for(const f of files.slice(0,room)){const a={key:'a'+(++attSeq),status:'compressing',url:'',name:'',error:'',ctl:new AbortController()};S.att.push(a);upload(a,f);}
  paintTray();}
 async function upload(a,file){try{const {blob,mime}=await shrink(file);if(!S.att.includes(a))return;a.url=URL.createObjectURL(blob);a.status='uploading';paintTray();
   const data=await blobB64(blob);if(!S.att.includes(a))return;
   const r=await EvieAccounts.request('chat/attachments',{method:'POST',body:{mime,data},signal:a.ctl.signal});
   if(!S.att.includes(a)){discard(r?.name);return;}if(!r?.name)throw Error('No se pudo subir la imagen.');a.name=r.name;a.status='ready';IMG.set(r.name,a.url);}
  catch(err){if(!S.att.includes(a))return;a.status='error';a.error=err?.name==='AbortError'?'Cancelada.':err?.message||'No se pudo subir la imagen.';App.toast(a.error,'error');}
  paintTray();}
 function discard(name){if(name)req('attachments/'+name,{method:'DELETE'}).catch(()=>{});}
 function unattach(key){const i=S.att.findIndex(a=>a.key===key);if(i<0)return;const [a]=S.att.splice(i,1);try{a.ctl.abort();}catch{}if(a.name){IMG.delete(a.name);discard(a.name);}if(a.url)URL.revokeObjectURL(a.url);paintTray();document.getElementById('ch-input')?.focus();}
 function trayHtml(){return S.att.map(a=>{const busy=a.status==='compressing'||a.status==='uploading';return `<div class="ch-thumb is-${a.status}">${a.url?`<img src="${e(a.url)}" alt="">`:''}${busy?`<span class="ch-thumb-busy" aria-hidden="true"></span><span class="sr-only">${a.status==='compressing'?'Preparando imagen…':'Subiendo imagen…'}</span>`:''}${a.status==='error'?`<span class="ch-thumb-err" title="${e(a.error)}">${ic('triangle-alert')}<span class="sr-only">${e(a.error)}</span></span>`:''}<button type="button" class="ch-thumb-x" data-ch="unattach" data-key="${a.key}" aria-label="Quitar imagen">${ic('x')}</button></div>`;}).join('');}
 function paintTray(){const t=document.getElementById('ch-tray');if(t){t.innerHTML=trayHtml();t.hidden=!S.att.length;icons(t);}
  const b=document.querySelector('#ch-form .ch-send:not(.is-stop)');if(b){const up=uploading();b.disabled=up;b.setAttribute('aria-label',up?'Esperando a que suban las imágenes':'Enviar');}}
 /** A chat image as a blob: URL (fetched once per session with the account's headers; JSON through the desktop proxy). */
 function imageUrl(name){if(IMG.has(name))return Promise.resolve(IMG.get(name));if(IMG_MISS.has(name))return Promise.resolve(null);if(IMG_WAIT.has(name))return IMG_WAIT.get(name);
  const p=(async()=>{try{let blob;
    if(window.evieDesktop?.account){const r=await req('attachments/'+name);blob=r?.data?b64Blob(r.data,r.mime):null;}
    else{const res=await fetch('/api/chat/attachments/'+name,{credentials:'same-origin',headers:{'X-Evie-User':me(),Accept:'image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1'}});if(!res.ok){if(res.status===404)IMG_MISS.add(name);return null;}blob=await res.blob();}
    if(!blob||!/^image\//.test(blob.type)){IMG_MISS.add(name);return null;}const url=URL.createObjectURL(blob);IMG.set(name,url);return url;}
   catch(err){if(err?.status===404)IMG_MISS.add(name);return null;}finally{IMG_WAIT.delete(name);}})();
  IMG_WAIT.set(name,p);return p;}
 function hydrate(root){for(const img of root?.querySelectorAll?.('img[data-ch-img]')||[]){const name=img.dataset.chImg;img.removeAttribute('data-ch-img');
  imageUrl(name).then(url=>{if(!img.isConnected)return;const b=img.closest('.ch-img');b?.classList.remove('is-loading');if(url){img.src=url;img.addEventListener('load',()=>scrollEnd(),{once:true});}else{b?.classList.add('is-missing');b?.setAttribute('aria-label','Imagen no disponible');}});}}
 function tile(name){const url=IMG.get(name);return `<button type="button" class="ch-img${url?'':' is-loading'}" data-ch="zoom" data-name="${e(name)}" aria-label="Ver imagen en grande"><img ${url?`src="${e(url)}"`:`data-ch-img="${e(name)}"`} alt="Imagen adjunta" decoding="async" draggable="false"></button>`;}
 let lightbox=null,lightboxFrom=null;
 function zoom(name,from){const url=IMG.get(name);if(!url)return;closeZoom();lightboxFrom=from||document.activeElement;const lb=document.createElement('div');lb.className='ch-lightbox';lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Imagen adjunta');
  lb.innerHTML=`<img src="${e(url)}" alt="Imagen adjunta"><button type="button" class="ch-lightbox-x" data-ch-box="close" aria-label="Cerrar imagen">${ic('x')}</button>`;document.body.append(lb);lightbox=lb;icons(lb);lb.querySelector('.ch-lightbox-x')?.focus();anim([lb],{opacity:[0,1]},{type:'tween',duration:.18});}
 function closeZoom(){if(!lightbox)return;lightbox.remove();lightbox=null;const f=lightboxFrom;lightboxFrom=null;try{if(f?.isConnected)f.focus({preventScroll:true});}catch{}}

 /* ---------------- voice in / read aloud ---------------- */
 async function toggleRec(){if(S.rec){S.rec.stop();return;}
  if(!ai().stt){App.toast('La voz no está configurada en el servidor.','error');return;}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});}catch{App.toast('Permite el micrófono para dictar.','error');return;}
  const type=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].find(t=>window.MediaRecorder?.isTypeSupported?.(t))||'';
  const rec=new MediaRecorder(stream,type?{mimeType:type}:{}),chunks=[],t0=Date.now();
  rec.ondataavailable=ev=>{if(ev.data?.size)chunks.push(ev.data);};
  rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());S.rec=null;paintComposer();const blob=new Blob(chunks,{type:(rec.mimeType||type||'audio/webm').split(';')[0]});if(blob.size<400)return;
   const btn=document.querySelector('[data-ch="mic"]');btn?.classList.add('is-busy');
   try{const r=await fetch('/api/ai/stt',{method:'POST',credentials:'same-origin',headers:{'Content-Type':blob.type,'X-Evie-Request':'1','X-Evie-User':me(),'X-Evie-Duration':String(Math.ceil((Date.now()-t0)/1000))},body:blob});const j=await r.json();if(!r.ok)throw Error(j.error||'No pude transcribir.');
    const input=document.getElementById('ch-input');if(input&&j.text){input.value=(input.value?input.value.trimEnd()+' ':'')+j.text;autosize(input);input.focus();}}
   catch(err){App.toast(err.message,'error');}finally{btn?.classList.remove('is-busy');}};
  S.rec=rec;rec.start();paintComposer();setTimeout(()=>{if(S.rec===rec)rec.stop();},85000);}
 let audio=null;
 async function speak(id){const m=S.msgs.find(x=>x.id===id);if(!m)return;if(S.speaking===id){audio?.pause();S.speaking=null;paintThread();return;}
  if(!ai().tts){App.toast('La voz de Ivi no está configurada en el servidor.','error');return;}
  audio?.pause();S.speaking=id;paintThread();const text=MD().plain(m.text);const parts=[];let cur='';
  for(const s of text.split(/(?<=[.!?])\s+/)){if((cur+' '+s).length>560){if(cur)parts.push(cur);cur=s.slice(0,560);}else cur=cur?cur+' '+s:s;}if(cur)parts.push(cur);
  try{for(const p of parts.slice(0,12)){if(S.speaking!==id)break;const r=await fetch('/api/ai/tts',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Evie-Request':'1','X-Evie-User':me()},body:JSON.stringify({text:p})});if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'No pude leerlo en voz alta.');}
    const url=URL.createObjectURL(await r.blob());audio=new Audio(url);await new Promise((ok,ko)=>{audio.onended=ok;audio.onerror=ko;audio.play().catch(ko);});URL.revokeObjectURL(url);}}
  catch(err){if(S.speaking===id)App.toast(err.message||'No pude leerlo en voz alta.','error');}
  if(S.speaking===id){S.speaking=null;paintThread();}}

 /* ---------------- conversation actions ---------------- */
 async function patchConv(id,body,msg){try{const r=await req('conversations/'+id,{method:'PATCH',body});const i=S.list.findIndex(c=>c.id===id);if(i>=0)S.list[i]=r.conversation;if(S.conv?.id===id)S.conv=r.conversation;if(msg)App.toast(msg,'success');await loadList();paintThread();}catch(err){App.toast(err.message,'error');}}
 function rename(id){const c=S.list.find(x=>x.id===id)||S.conv;if(!c)return;
  App.openDialog('Renombrar conversación',`<form id="ch-rename" class="ch-form"><label class="ch-field"><span>Título</span><input class="input" name="title" maxlength="120" value="${e(c.title)}" required autocomplete="off"></label><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('check')}Guardar</button></div></form>`);
  const f=document.getElementById('ch-rename');setTimeout(()=>f.elements.title.select(),30);f.onsubmit=ev=>{ev.preventDefault();App.closeDialog(true);patchConv(id,{title:f.elements.title.value.trim()},'Conversación renombrada.');};}
 function remove(id){const c=S.list.find(x=>x.id===id)||S.conv;App.confirmAction('Borrar conversación',`Se borrará «${e(c?.title||'Nueva conversación')}» y todos sus mensajes en todos tus dispositivos. Lo que Ivi aprendió de ella se queda en su memoria (puedes revisarlo en «Lo que Ivi sabe de ti»).`,async()=>{try{await req('conversations/'+id,{method:'DELETE'});S.list=S.list.filter(x=>x.id!==id);if(S.cur===id)startNew();else paintList();App.toast('Conversación borrada.','success');}catch(err){App.toast(err.message,'error');}},'Borrar');}

 /* ---------------- views ---------------- */
 function locked(){return `<section class="ch-locked v8-card"><span class="ch-orb is-idle" aria-hidden="true"><i></i></span><h2>El chat vive en tu cuenta</h2><p>Inicia sesión en EVIE para hablar con Ivi, guardar tus conversaciones y que te recuerde en todos tus dispositivos.</p></section>`;}
 function view(id){if(!cloud())return Views.heading('Chat','Conversaciones con Ivi, sincronizadas en todos tus dispositivos.','','CHAT')+locked();
  if(id==='memoria')return memoryView();
  if(id&&UUID.test(id)&&S.cur!==id){S.cur=id;S.conv=null;S.msgs=[];S.loadingMsgs=true;queueMicrotask(()=>open(id));}
  if(!id&&S.cur&&!S.stream){S.cur=null;S.conv=null;S.msgs=[];}
  return `<div class="ch" data-ch-root data-drawer="${S.drawer}">${sidebar()}<section class="ch-main" aria-label="Conversación">${header()}<div class="ch-thread" id="ch-thread" aria-live="polite">${thread()}</div>${composer()}</section></div>`;}
 function sidebar(){return `<aside class="ch-side" id="ch-side" aria-label="Conversaciones"><div class="ch-side-head"><div><span class="ch-eyebrow">IVI · CHAT</span><h1>Chat</h1></div><button type="button" class="button primary ch-new" data-ch="new">${ic('square-pen')}<span>Nueva</span></button></div>
  <label class="ch-search">${ic('search')}<span class="sr-only">Buscar conversaciones</span><input type="search" id="ch-q" placeholder="Buscar conversaciones" value="${e(S.q)}" autocomplete="off"></label>
  <div class="ch-seg" role="group" aria-label="Filtro">${[[false,'Activas'],[true,'Archivadas']].map(([v,l])=>`<button type="button" data-ch="archived" data-v="${v}" aria-pressed="${S.archived===v}">${l}</button>`).join('')}</div>
  <nav class="ch-list" id="ch-list">${listHtml()}</nav>
  <a class="ch-memory-link" href="#chat/memoria">${ic('brain-circuit')}<span><strong>Lo que Ivi sabe de ti</strong><small>Ver y editar su memoria</small></span>${ic('chevron-right')}</a></aside><button type="button" class="ch-scrim" data-ch="drawer" aria-label="Cerrar lista"></button>`;}
 function listHtml(){if(!S.listLoaded)return `<div class="ch-skel">${'<span></span>'.repeat(5)}</div>`;
  if(!S.list.length)return `<p class="ch-empty-list">${S.q?'Nada coincide con tu búsqueda.':S.archived?'No tienes conversaciones archivadas.':'Aún no hay conversaciones. Empieza una nueva.'}</p>`;
  const groups={};for(const c of S.list)(groups[groupOf(c)]||=[]).push(c);
  return ['Fijadas','Hoy','Ayer','Últimos 7 días','Anteriores'].filter(g=>groups[g]).map(g=>`<div class="ch-group"><h2>${g}</h2><ul>${groups[g].map(c=>`<li class="ch-item ${c.id===S.cur?'is-on':''}"><a href="#chat/${c.id}" data-ch-open="${c.id}" ${c.id===S.cur?'aria-current="page"':''}>${c.private?`<span class="ch-lock" title="Privada">${ic('lock')}</span>`:''}<span class="ch-item-t">${e(c.title||'Nueva conversación')}</span><small>${e(when(c.updated_at))}</small></a>
   <div class="ch-item-act"><button type="button" data-ch="pin" data-id="${c.id}" aria-label="${c.pinned?'Desfijar':'Fijar'}" title="${c.pinned?'Desfijar':'Fijar'}">${ic(c.pinned?'pin-off':'pin')}</button><button type="button" data-ch="rename" data-id="${c.id}" aria-label="Renombrar" title="Renombrar">${ic('pencil')}</button><button type="button" data-ch="archive" data-id="${c.id}" aria-label="${c.archived?'Desarchivar':'Archivar'}" title="${c.archived?'Desarchivar':'Archivar'}">${ic(c.archived?'archive-restore':'archive')}</button><button type="button" data-ch="delete" data-id="${c.id}" aria-label="Borrar" title="Borrar">${ic('trash-2')}</button></div></li>`).join('')}</ul></div>`).join('');}
 function header(){const t=S.conv?.title||(S.cur?'…':'Nueva conversación'),tier=S.tier||S.conv?.tier||'enfoque',priv=S.conv?S.conv.private:!!S.privateNext;
  return `<header class="ch-head"><button type="button" class="ch-icon ch-menu" data-ch="drawer" aria-label="Ver conversaciones">${ic('panel-left')}</button><div class="ch-title"><h2 title="${e(t)}">${priv?ic('lock'):''}${e(t)}</h2><small>${priv?'Chat privado · sin memoria':'Ivi recuerda lo importante'}</small></div>
   <div class="ch-tiers" role="group" aria-label="Nivel de IA">${TIERS.map(([k,l,icon,h])=>`<button type="button" data-ch="tier" data-v="${k}" aria-pressed="${tier===k}" title="${h}">${ic(icon)}<span>${l}</span></button>`).join('')}</div>
   ${S.conv?`<button type="button" class="ch-icon" data-ch="rename" data-id="${S.conv.id}" aria-label="Renombrar">${ic('pencil')}</button>`:`<button type="button" class="ch-icon ${priv?'is-on':''}" data-ch="private" aria-pressed="${priv}" aria-label="Chat privado (sin memoria)" title="Chat privado: no usa ni guarda memoria">${ic(priv?'lock':'lock-open')}</button>`}</header>`;}
 function thread(){if(S.loadingMsgs)return `<div class="ch-skel ch-skel-thread">${'<span></span>'.repeat(3)}</div>`;
  if(!S.msgs.length&&!S.stream)return hero();
  const lastUser=S.msgs.map(m=>m.role).lastIndexOf('user'),lastIvi=S.msgs.map(m=>m.role).lastIndexOf('assistant');
  const rows=S.msgs.map((m,i)=>m.role==='user'?userMsg(m,i===lastUser&&!S.stream):iviMsg(m,i===lastIvi&&i===S.msgs.length-1&&!S.stream)).join('');
  const live=S.stream?`<article class="ch-msg is-ivi is-live" id="ch-live"><span class="ch-orb is-talking" aria-hidden="true"><i></i></span><div class="ch-body"><div class="ch-md">${S.stream.text?MD().render(S.stream.text):'<span class="ch-thinking"><i></i><i></i><i></i><em>Ivi está pensando…</em></span>'}</div><div class="ch-live-extra" aria-live="polite">${liveExtra()}</div><div class="ch-actions"><button type="button" class="ch-chip" data-ch="stop">${ic('square')}Detener</button></div></div></article>`:'';
  const err=S.error?`<div class="ch-error" role="alert">${ic('triangle-alert')}<span>${e(S.error)}</span>${S.msgs.at(-1)?.role==='user'?`<button type="button" class="ch-chip" data-ch="retry">${ic('rotate-ccw')}Reintentar</button>`:''}</div>`:'';
  return rows+live+err;}
 function hero(){const name=context().name;return `<div class="ch-hero"><span class="ch-orb is-hero" aria-hidden="true"><i></i></span><h2>${name?`Hola, ${e(name)}.`:'Hola.'} ¿En qué trabajamos?</h2><p>Pregúntame lo que sea${canAttach()?', mándame una foto':''} o pídeme que anote un gasto o un pendiente. Recuerdo lo importante entre conversaciones${S.privateNext?' (en este chat privado, no)':''}.</p>
  <div class="ch-suggest">${SUGGEST.map(([i,t])=>`<button type="button" class="ch-sug v8-card" data-ch="suggest" data-t="${e(t)}">${ic(i)}<span>${e(t)}</span></button>`).join('')}</div></div>`;}
 function userMsg(m,last){const imgs=(m.images||[]).slice(0,MAX_IMG);return `<article class="ch-msg is-user" data-id="${e(m.id)}"><div class="ch-body">${imgs.length?`<div class="ch-imgs" data-n="${imgs.length}">${imgs.map(tile).join('')}</div>`:''}${m.text||!imgs.length?`<div class="ch-bubble">${e(m.text).replace(/\n/g,'<br>')}</div>`:''}${last?`<div class="ch-actions"><button type="button" class="ch-chip" data-ch="edit" aria-label="Editar mensaje">${ic('pencil')}Editar</button></div>`:''}</div></article>`;}
 function iviMsg(m,last){const stopped=m.meta?.stop_reason==='stopped'||m.meta?.stop_reason==='cut'||m.meta?.stop_reason==='error';
  const src=(m.sources||[]).length?`<div class="ch-sources">${m.sources.map((s,i)=>`<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer" class="ch-src"><b>${i+1}</b>${e(s.host||s.title)}</a>`).join('')}</div>`:'';
  const mem=(m.memory_used||[]).length?`<details class="ch-memused"><summary>${ic('brain-circuit')}Usé ${m.memory_used.length} ${m.memory_used.length===1?'recuerdo':'recuerdos'}</summary><ul>${m.memory_used.map(x=>`<li>${e(x.text)}</li>`).join('')}</ul></details>`:'';
  return `<article class="ch-msg is-ivi" data-id="${e(m.id)}"><span class="ch-orb" aria-hidden="true"><i></i></span><div class="ch-body"><div class="ch-md">${MD().render(m.text)}</div>${receiptsHtml(m.meta?.actions)}${stopped?`<p class="ch-note">${m.meta.stop_reason==='error'?'Respuesta incompleta.':'Respuesta detenida.'}</p>`:''}${src}${mem}
   <div class="ch-actions"><button type="button" class="ch-chip" data-ch="copy" data-id="${e(m.id)}" aria-label="Copiar respuesta">${ic('copy')}<span>Copiar</span></button><button type="button" class="ch-chip ${S.speaking===m.id?'is-on':''}" data-ch="speak" data-id="${e(m.id)}" aria-label="${S.speaking===m.id?'Detener lectura':'Leer en voz alta'}">${ic(S.speaking===m.id?'volume-x':'volume-2')}<span>${S.speaking===m.id?'Detener':'Escuchar'}</span></button>${last?`<button type="button" class="ch-chip" data-ch="regenerate" aria-label="Regenerar respuesta">${ic('refresh-cw')}<span>Regenerar</span></button>`:''}${m.meta?.model?`<small class="ch-model" title="${e(m.meta.model)}">${e({chispa:'Chispa',enfoque:'Enfoque',profundo:'Profundo'}[m.meta.tier]||'')}</small>`:''}</div></div></article>`;}
 function composer(){return composerForm()+`<p class="ch-foot">Ivi puede equivocarse; separa lo confirmado de lo que no. ${ai().provider==='claude'?'Claude · respaldo ante rechazos activado.':''}</p>`;}
 function composerForm(){const busy=!!S.stream,att=canAttach(),up=uploading();return `<form class="ch-composer v8-card" id="ch-form" autocomplete="off">${att?`<div class="ch-tray" id="ch-tray" role="group" aria-label="Imágenes para enviar"${S.att.length?'':' hidden'}>${trayHtml()}</div>`:''}<label class="sr-only" for="ch-input">Mensaje para Ivi</label><textarea id="ch-input" rows="1" maxlength="16000" placeholder="Escríbele a Ivi…" enterkeyhint="send"></textarea>
  <div class="ch-tools">${att?`<button type="button" class="ch-tool ch-attach" data-ch="attach" aria-label="Adjuntar imagen" title="Adjuntar imagen (también puedes pegarla o arrastrarla)">${ic('image-plus')}</button><input type="file" id="ch-file" accept="image/*" multiple hidden tabindex="-1" aria-hidden="true">`:''}<button type="button" class="ch-tool ${S.research?'is-on':''}" data-ch="research" aria-pressed="${S.research}" title="Buscar en la web en este mensaje">${ic('globe')}<span>Web</span></button><span class="ch-spacer"></span>
   <button type="button" class="ch-tool ch-mic ${S.rec?'is-rec':''}" data-ch="mic" aria-pressed="${!!S.rec}" aria-label="${S.rec?'Terminar dictado':'Dictar por voz'}">${ic(S.rec?'square':'mic')}</button>
   ${busy?`<button type="button" class="ch-send is-stop" data-ch="stop" aria-label="Detener respuesta">${ic('square')}</button>`:`<button type="submit" class="ch-send" aria-label="${up?'Esperando a que suban las imágenes':'Enviar'}"${up?' disabled':''}>${ic('arrow-up')}</button>`}</div></form>`;}

 /* ---------------- «Lo que Ivi sabe de ti» ---------------- */
 async function loadMemory(){if(S.memLoading||!cloud())return;S.memLoading=true;try{S.mem=await req('memories'+(S.memForgotten?'?forgotten=1':''));S.error=null;}catch(err){S.mem={error:err.message};}finally{S.memLoading=false;const box=document.getElementById('chm-body');if(box){box.innerHTML=memoryBody();icons(box);anim(box.querySelectorAll('.chm-card,.chm-profile'),{opacity:[0,1],y:[10,0]},{delay:window.Motion?.stagger?.(.02)||0});}}}
 function memoryView(){if(!S.mem&&!S.memLoading)queueMicrotask(loadMemory);
  return `${Views.heading('Lo que Ivi sabe de ti','Su memoria de largo plazo: la usa en el chat, por voz y con Kisha. Tú decides qué se queda.',`<a class="button" href="#chat">${ic('message-circle')}Volver al chat</a><button type="button" class="button primary" data-chm="add">${ic('plus')}Agregar</button>`,'MEMORIA DE IVI')}<div class="chm" id="chm-body">${memoryBody()}</div>`;}
 function memoryBody(){const m=S.mem;if(!m||S.memLoading&&!m)return `<div class="ch-skel">${'<span></span>'.repeat(4)}</div>`;if(m.error)return `<div class="ch-error">${ic('triangle-alert')}<span>${e(m.error)}</span></div>`;
  const list=(m.memories||[]).filter(x=>S.memKind==='all'||x.kind===S.memKind),counts={};for(const x of m.memories||[])counts[x.kind]=(counts[x.kind]||0)+1;
  const profile=m.profile?`<section class="chm-profile v8-card"><header><span class="ch-orb is-idle" aria-hidden="true"><i></i></span><div><span class="ch-eyebrow">PERFIL DE MEMORIA</span><h2>Lo más importante ahora</h2></div></header><div class="ch-md">${MD().render(m.profile)}</div><small>Ivi lo regenera cuando aprende cosas nuevas.</small></section>`:`<section class="chm-profile v8-card is-empty"><header><span class="ch-orb is-idle" aria-hidden="true"><i></i></span><div><span class="ch-eyebrow">PERFIL DE MEMORIA</span><h2>Aún se está formando</h2></div></header><p>Platica con Ivi y ella irá guardando lo importante: metas, proyectos, personas y preferencias.</p></section>`;
  const chips=`<div class="chm-kinds" role="group" aria-label="Tipo de recuerdo"><button type="button" data-chm="kind" data-v="all" aria-pressed="${S.memKind==='all'}">Todo <b>${(m.memories||[]).length}</b></button>${Object.entries(KINDS).filter(([k])=>counts[k]).map(([k,l])=>`<button type="button" data-chm="kind" data-v="${k}" aria-pressed="${S.memKind===k}">${l} <b>${counts[k]}</b></button>`).join('')}</div>`;
  const cards=list.length?`<ul class="chm-list">${list.map(x=>`<li class="chm-card v8-card" data-kind="${e(x.kind)}"><div class="chm-top"><span class="chm-kind">${e(KINDS[x.kind]||x.kind)}</span><span class="chm-imp" title="Importancia ${x.importance} de 5" aria-label="Importancia ${x.importance} de 5">${'<i></i>'.repeat(x.importance)}${'<i class="off"></i>'.repeat(5-x.importance)}</span></div><p>${e(x.text)}</p><div class="chm-foot"><small>${e(when(x.updated_at))}${x.source_conversation?` · <a href="#chat/${e(x.source_conversation)}">de una conversación</a>`:''}</small><div><button type="button" class="ch-icon" data-chm="edit" data-id="${e(x.id)}" aria-label="Editar recuerdo">${ic('pencil')}</button><button type="button" class="ch-icon" data-chm="history" data-id="${e(x.id)}" aria-label="Historial">${ic('history')}</button><button type="button" class="ch-icon" data-chm="forget" data-id="${e(x.id)}" aria-label="Olvidar">${ic('eraser')}</button></div></div></li>`).join('')}</ul>`:`<p class="ch-empty-list">${S.memKind==='all'?'Ivi todavía no guarda recuerdos. Dile «Ivi, recuerda que…» o platica con ella en el chat.':'Nada de este tipo.'}</p>`;
  const forgotten=S.memForgotten?((m.forgotten||[]).length?`<section class="chm-forgotten"><h3>Olvidados</h3><ul>${m.forgotten.map(x=>`<li><span>${e(x.text)}</span><button type="button" class="ch-chip" data-chm="restore" data-id="${e(x.id)}">${ic('undo-2')}Recuperar</button></li>`).join('')}</ul></section>`:'<p class="ch-empty-list">No hay recuerdos olvidados.</p>'):'';
  return `${profile}<div class="chm-bar">${chips}<button type="button" class="ch-chip" data-chm="forgotten" aria-pressed="${S.memForgotten}">${ic('archive')}${S.memForgotten?'Ocultar olvidados':'Ver olvidados'}</button></div>${cards}${forgotten}<p class="chm-note">${ic('shield-check')}Cifrada en el servidor y solo tuya. Nunca guarda contraseñas ni datos bancarios; lo de salud o emociones solo si lo activas en Configuración → Memoria. En un chat privado no se usa ni se aprende nada.</p>`;}
 function memoryForm(x=null){App.openDialog(x?'Editar recuerdo':'Agregar recuerdo',`<form id="chm-form" class="ch-form"><label class="ch-field"><span>Qué debe recordar Ivi</span><textarea class="input" name="text" rows="3" maxlength="400" required>${e(x?.text||'')}</textarea></label>
  <div class="ch-row"><label class="ch-field"><span>Tipo</span><select class="select" name="kind">${Object.entries(KINDS).map(([k,l])=>`<option value="${k}" ${(x?.kind||'fact')===k?'selected':''}>${l}</option>`).join('')}</select></label><label class="ch-field"><span>Importancia</span><select class="select" name="importance">${[1,2,3,4,5].map(n=>`<option value="${n}" ${(x?.importance||3)===n?'selected':''}>${n} · ${['trivial','baja','normal','alta','central'][n-1]}</option>`).join('')}</select></label></div>
  <p class="ch-error" role="alert" hidden></p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('check')}${x?'Guardar':'Agregar'}</button></div></form>`);
  const f=document.getElementById('chm-form');f.onsubmit=async ev=>{ev.preventDefault();const body={text:f.elements.text.value.trim(),kind:f.elements.kind.value,importance:Number(f.elements.importance.value)};
   try{await req(x?'memories/'+x.id:'memories',{method:x?'PATCH':'POST',body});App.closeDialog(true);App.toast(x?'Recuerdo actualizado.':'Listo, Ivi lo recordará.','success');S.mem=null;loadMemory();}catch(err){const p=f.querySelector('.ch-error');p.hidden=false;p.textContent=err.message;}};}
 async function memoryHistory(id){try{const r=await req('memories/'+id+'/history');const ops={add:'Lo aprendió',update:'Lo actualizó',edit:'Lo editaste',forget:'Lo olvidó',restore:'Lo recuperaste',migrate:'Venía de la memoria anterior'};
  App.openDialog('Historial del recuerdo',`<ol class="chm-hist">${(r.history||[]).map(h=>`<li><strong>${ops[h.op]||h.op}</strong><small>${e(new Date(h.at).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}))}</small>${h.detail?.before?`<p><del>${e(h.detail.before)}</del><br>${e(h.detail.after||'')}</p>`:h.detail?.text?`<p>${e(h.detail.text)}</p>`:''}</li>`).join('')||'<li>Sin historial.</li>'}</ol><div class="form-footer"><button type="button" class="button primary" data-action="close-dialog">Listo</button></div>`);}catch(err){App.toast(err.message,'error');}}

 /* ---------------- painting & binding ---------------- */
 function paintList(){const el=document.getElementById('ch-list');if(el){el.innerHTML=listHtml();icons(el);}}
 function paintThread(){const el=document.getElementById('ch-thread');if(el){el.innerHTML=thread();icons(el);hydrate(el);}const h=document.querySelector('.ch-head');if(h){h.outerHTML=header();icons(document.querySelector('.ch-head'));}}
 function paintComposer(){const f=document.getElementById('ch-form');if(!f)return;const old=document.getElementById('ch-input'),v=old?.value||'',focused=document.activeElement===old;const box=document.createElement('div');box.innerHTML=composerForm();f.replaceWith(box.firstElementChild);const i=document.getElementById('ch-input');if(i){i.value=v;autosize(i);bindInput();if(focused)i.focus();}icons(document.getElementById('ch-form'));}
 function paintAll(){if(UI.section!=='chat'||UI.id==='memoria')return;const root=document.querySelector('[data-ch-root]');if(!root)return;root.dataset.drawer=String(S.drawer);paintList();paintThread();paintComposer();}
 function scrollEnd(force=false){const t=document.getElementById('ch-thread');if(!t)return;const near=t.scrollHeight-t.scrollTop-t.clientHeight<160;if(force||near)t.scrollTop=t.scrollHeight;}
 function autosize(t){t.style.height='auto';t.style.height=Math.min(t.scrollHeight,window.innerHeight*.4)+'px';}
 function bindInput(){const i=document.getElementById('ch-input');if(!i||i.dataset.bound)return;i.dataset.bound='1';i.addEventListener('input',()=>autosize(i));
  i.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing&&matchMedia('(hover: hover) and (pointer: fine)').matches){ev.preventDefault();send({text:i.value});}});}
 let qTimer=0;
 function afterRender(){if(UI.section!=='chat'){S.entered=false;delete document.documentElement.dataset.chatOpen;return;}document.documentElement.dataset.chatOpen='1';
  if(UI.id==='memoria'){if(!S.entered){S.entered=true;anim(document.querySelectorAll('.chm-profile,.chm-card'),{opacity:[0,1],y:[12,0]},{delay:window.Motion?.stagger?.(.025)||0});}return;}
  const root=document.querySelector('[data-ch-root]');if(!root)return;
  if(!S.listLoaded)loadList();bindInput();hydrate(root);
  const q=document.getElementById('ch-q');if(q&&!q.dataset.bound){q.dataset.bound='1';q.addEventListener('input',()=>{clearTimeout(qTimer);qTimer=setTimeout(()=>{S.q=q.value.trim();S.listLoaded=false;paintList();loadList();},260);});}
  if(S.msgs.length||S.stream)scrollEnd(true);else{const t=document.getElementById('ch-thread');if(t)t.scrollTop=0;}
  if(!S.entered){S.entered=true;anim(root.querySelectorAll('.ch-side,.ch-head,.ch-composer'),{opacity:[0,1],y:[16,0]},{delay:window.Motion?.stagger?.(.05)||0});anim(root.querySelectorAll('.ch-sug,.ch-hero h2,.ch-hero p,.ch-orb.is-hero'),{opacity:[0,1],y:[18,0],scale:[.96,1]},{delay:window.Motion?.stagger?.(.04,{startDelay:.1})||0});}}
 document.addEventListener('submit',ev=>{if(ev.target.id!=='ch-form')return;ev.preventDefault();send({text:document.getElementById('ch-input')?.value||''});});
 // Images: mobile/desktop picker, paste into the composer, drag & drop onto the conversation.
 document.addEventListener('change',ev=>{if(ev.target?.id!=='ch-file')return;const files=[...(ev.target.files||[])];ev.target.value='';if(files.length)addFiles(files);});
 document.addEventListener('paste',ev=>{if(ev.target?.id!=='ch-input'||!canAttach())return;const dt=ev.clipboardData,files=[];for(const it of dt?.items||[])if(it.kind==='file'&&/^image\//.test(it.type)){const f=it.getAsFile();if(f)files.push(f);}
  if(!files.length)for(const f of dt?.files||[])if(/^image\//.test(f.type))files.push(f);if(!files.length)return;if(![...(dt.types||[])].includes('text/plain'))ev.preventDefault();addFiles(files);});
 const dropZone=ev=>UI.section==='chat'&&UI.id!=='memoria'&&canAttach()&&[...(ev.dataTransfer?.types||[])].includes('Files')?ev.target?.closest?.('.ch-main'):null;
 const dropOff=()=>document.querySelectorAll('.ch-main[data-drop]').forEach(z=>delete z.dataset.drop);
 for(const type of ['dragenter','dragover'])document.addEventListener(type,ev=>{const z=dropZone(ev);if(!z)return;ev.preventDefault();if(ev.dataTransfer)ev.dataTransfer.dropEffect='copy';z.dataset.drop='1';});
 document.addEventListener('dragleave',ev=>{const z=ev.target?.closest?.('.ch-main[data-drop]');if(z&&!z.contains(ev.relatedTarget))delete z.dataset.drop;});
 document.addEventListener('drop',ev=>{const z=dropZone(ev);dropOff();if(!z)return;ev.preventDefault();addFiles([...(ev.dataTransfer?.files||[])]);});
 document.addEventListener('dragend',dropOff);
 document.addEventListener('keydown',ev=>{if(!lightbox)return;if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();closeZoom();}else if(ev.key==='Tab'){ev.preventDefault();lightbox.querySelector('.ch-lightbox-x')?.focus();}},true);
 document.addEventListener('click',async ev=>{
  if(lightbox&&ev.target?.closest?.('.ch-lightbox')&&(ev.target.closest('[data-ch-box]')||!ev.target.closest('img'))){closeZoom();return;}
  const md=ev.target.closest?.('[data-md-copy]');if(md){const code=md.closest('.md-code')?.querySelector('code')?.textContent||'';try{await navigator.clipboard.writeText(code);md.textContent='Copiado';setTimeout(()=>{md.textContent='Copiar';},1400);}catch{App.toast('No pude copiar.','error');}return;}
  const o=ev.target.closest?.('[data-ch-open]');if(o&&!ev.metaKey&&!ev.ctrlKey){S.drawer=false;return;}
  const b=ev.target.closest?.('[data-ch]');if(b){const a=b.dataset.ch,id=b.dataset.id;
   if(a==='new')startNew();
   else if(a==='drawer'){S.drawer=!S.drawer;document.querySelector('[data-ch-root]')?.setAttribute('data-drawer',String(S.drawer));}
   else if(a==='archived'){S.archived=b.dataset.v==='true';S.listLoaded=false;document.querySelectorAll('[data-ch="archived"]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paintList();loadList();}
   else if(a==='tier'){S.tier=b.dataset.v;if(S.conv)patchConv(S.conv.id,{tier:S.tier});else paintThread();}
   else if(a==='private'){S.privateNext=!S.privateNext;paintThread();App.toast(S.privateNext?'Chat privado: Ivi no usará ni guardará memoria en esta conversación.':'Chat normal: Ivi recuerda lo importante.','success');}
   else if(a==='research'){S.research=!S.research;b.classList.toggle('is-on',S.research);b.setAttribute('aria-pressed',String(S.research));}
   else if(a==='suggest'){const i=document.getElementById('ch-input');if(i){i.value=b.dataset.t;autosize(i);i.focus();}}
   else if(a==='stop')stop();
   else if(a==='regenerate')send({regenerate:true});
   // A failed message that reached the server is resent as an edit (same images); one that never did, as new.
   else if(a==='retry'){const last=S.msgs.at(-1);if(last?.role==='user'){S.error=null;if(last.id==='tmp-u'){S.msgs.pop();send({text:last.text,attachments:last.images||[]});}else send({text:last.text,edit:true});}}
   else if(a==='edit'){const last=[...S.msgs].reverse().find(m=>m.role==='user');if(!last)return;const pics=(last.images||[]).length,done=[...S.msgs].reverse().find(m=>m.role==='assistant'&&m.seq>last.seq)?.meta?.actions?.some(x=>DONE.has(x.status)&&x.status!=='duplicate');
    App.openDialog('Editar mensaje',`<form id="ch-edit" class="ch-form"><label class="ch-field"><span>Tu mensaje</span><textarea class="input" name="text" rows="4" maxlength="16000"${pics?'':' required'}>${e(last.text)}</textarea></label><p class="dialog-subtitle">Ivi responderá de nuevo desde este punto.${pics?` Se conservan ${pics===1?'la imagen':'las '+pics+' imágenes'}.`:''}${done?' Lo que ya registró en tu app se queda; si cambió, deshazlo desde su comprobante.':''}</p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('send')}Enviar</button></div></form>`);
    const f=document.getElementById('ch-edit');f.onsubmit=ev2=>{ev2.preventDefault();const t=f.elements.text.value.trim();if(!t&&!pics)return;App.closeDialog(true);send({text:t,edit:true});};}
   else if(a==='attach'){if(!canAttach()){addFiles([]);return;}if(S.att.length>=MAX_IMG){App.toast('Máximo 4 imágenes por mensaje.','error');return;}document.getElementById('ch-file')?.click();}
   else if(a==='unattach')unattach(b.dataset.key);
   else if(a==='zoom'){if(b.classList.contains('is-loading')||b.classList.contains('is-missing'))return;zoom(b.dataset.name,b);}
   else if(a==='undo')undoAction(id);
   else if(a==='copy'){const m=S.msgs.find(x=>x.id===id);try{await navigator.clipboard.writeText(m?.text||'');App.toast('Respuesta copiada.','success');}catch{App.toast('No pude copiar.','error');}}
   else if(a==='speak')speak(id);
   else if(a==='mic')toggleRec();
   else if(a==='pin'){const c=S.list.find(x=>x.id===id);patchConv(id,{pinned:!c?.pinned},c?.pinned?'Conversación desfijada.':'Conversación fijada.');}
   else if(a==='archive'){const c=S.list.find(x=>x.id===id);patchConv(id,{archived:!c?.archived},c?.archived?'Conversación restaurada.':'Conversación archivada.');if(S.cur===id&&!c?.archived)startNew();}
   else if(a==='rename')rename(id);
   else if(a==='delete')remove(id);
   return;}
  const m=ev.target.closest?.('[data-chm]');if(!m)return;const a=m.dataset.chm,id=m.dataset.id;
  if(a==='add')memoryForm();
  else if(a==='edit')memoryForm((S.mem?.memories||[]).find(x=>x.id===id));
  else if(a==='history')memoryHistory(id);
  else if(a==='kind'){S.memKind=m.dataset.v;const box=document.getElementById('chm-body');if(box){box.innerHTML=memoryBody();icons(box);}}
  else if(a==='forgotten'){S.memForgotten=!S.memForgotten;S.mem=null;loadMemory();}
  else if(a==='forget'){try{await req('memories/'+id,{method:'DELETE'});App.toast('Ivi lo olvidó.','success',async()=>{await req('memories/'+id+'/restore',{method:'POST',body:{}});S.mem=null;loadMemory();});S.mem=null;loadMemory();}catch(err){App.toast(err.message,'error');}}
  else if(a==='restore'){try{await req('memories/'+id+'/restore',{method:'POST',body:{}});App.toast('Recuerdo recuperado.','success');S.mem=null;loadMemory();}catch(err){App.toast(err.message,'error');}}});
 /** Called when another device changed chats/memory (sync stamp) or after a voice «recuerda…». */
 async function refresh(){if(!cloud())return;if(UI.section!=='chat')return;
  if(UI.id==='memoria'){S.mem=null;loadMemory();return;}
  await loadList();if(S.cur&&!S.stream&&!S.loadingMsgs){const c=S.list.find(x=>x.id===S.cur);const have=S.msgs.filter(m=>!String(m.id).startsWith('tmp')).length;if(c&&c.message_count!==have)open(S.cur);else if(!c&&!S.archived){startNew();App.toast('Esa conversación se borró en otro dispositivo.','success');}}}
 function reset(){stop();S.rec?.stop?.();audio?.pause();closeZoom();for(const a of S.att){try{a.ctl.abort();}catch{}if(a.url&&!IMG.has(a.name))URL.revokeObjectURL(a.url);}for(const u of IMG.values())URL.revokeObjectURL(u);IMG.clear();IMG_WAIT.clear();IMG_MISS.clear();UNDO.clear();
  Object.assign(S,{list:[],listLoaded:false,cur:null,conv:null,msgs:[],stream:null,tier:null,research:false,drawer:false,error:null,mem:null,memForgotten:false,memKind:'all',rec:null,speaking:null,entered:false,privateNext:false,att:[],undone:new Set()});}
 /* v11: tapping «Enviar» keeps the focus (and the phone keyboard) in the message box, like a messaging app. Without it
    the box blurs on press, the bottom bar slides back and the button moves under the finger, so the tap was lost. */
 document.addEventListener('pointerdown',ev=>{if(ev.button>0)return;const b=ev.target.closest?.('.ch-composer .ch-send:not(.is-stop)');if(b&&document.activeElement?.id==='ch-input')ev.preventDefault();},true);
 return Object.freeze({view,afterRender,refresh,reset,send,stop,open,startNew,state:()=>S});
})();
