'use strict';
/* EVIE v10 · Chat con Ivi (estilo ChatGPT/Claude) + «Lo que Ivi sabe de ti».
   Rutas: #chat (nueva conversación), #chat/<uuid> (conversación), #chat/memoria (memoria de largo plazo).
   Datos: /api/chat/* (Worker → Supabase con tu token; todo cifrado en el Worker). Respuestas en streaming (SSE)
   con detener, regenerar y editar el último mensaje; voz (Groq) y lectura en voz alta (Fish Audio).
   Sincronización entre dispositivos: account-ui.js avisa cuando cambia el sello del chat → EvieChat.refresh(). */
window.EvieChat=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const MD=()=>window.EvieMarkdown;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const TIERS=[['chispa','Chispa','zap','Rápido'],['enfoque','Enfoque','crosshair','Equilibrado'],['profundo','Profundo','brain','Más análisis']];
 const KINDS={profile:'Perfil',preference:'Preferencia',project:'Proyecto',goal:'Meta',person:'Persona',decision:'Decisión',fact:'Dato'};
 const SUGGEST=[['piggy-bank','Hazme un plan de ahorro mensual para una meta grande'],['handshake','Prepárame una visita de ventas a un restaurante'],['graduation-cap','Explícame un tema de la escuela como si fuera audio'],['map','Ideas para el fin de semana cerca de mí, sin gastar de más']];
 const S={list:[],listLoaded:false,listLoading:false,archived:false,q:'',cur:null,conv:null,msgs:[],loadingMsgs:false,stream:null,tier:null,research:false,drawer:false,error:null,mem:null,memLoading:false,memForgotten:false,memKind:'all',rec:null,speaking:null,entered:false};
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const ai=()=>EvieAccounts.config?.()?.ai||{};
 const me=()=>EvieAccounts.current?.()?.id||'';
 const req=(p,o)=>EvieAccounts.request('chat/'+p,o);
 const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';}catch{return true;}};
 const M=()=>!reduced()&&window.Motion?.animate?window.Motion:null;
 const anim=(els,kf,o={})=>{const m=M(),list=[...(els||[])].filter(Boolean);if(!m||!list.length)return;const clean=()=>list.forEach(n=>{n.style.opacity='';n.style.transform='';});try{const a=m.animate(list,kf,{type:'spring',stiffness:300,damping:28,...o});(a?.finished||Promise.resolve()).then(clean,clean);setTimeout(clean,1800);}catch{clean();}};
 const icons=root=>{try{window.lucide?.createIcons?.({root});}catch{}};
 const prefs=()=>Store.get()?.preferences||{};
 const context=()=>{const st=Store.get()||{},p=st.profile||{};return {name:String(p.preferred||p.name||'').slice(0,40),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,currency:window.DALI_CONFIG?.currency||'MXN',mode:prefs().iviMode||'asistente',persona:prefs().iviPersona||{}};};
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
 function paintLive(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const el=document.getElementById('ch-live');if(!el||!S.stream)return;const md=el.querySelector('.ch-md');if(md){md.innerHTML=MD().render(S.stream.text)+'<span class="ch-caret" aria-hidden="true"></span>';}scrollEnd();});}
 async function send({text='',regenerate=false,edit=false}={}){
  if(S.stream)return;const t=String(text).trim();if(!regenerate&&!t)return;
  if(!cloud()){App.toast('El chat necesita tu cuenta EVIE con sesión iniciada.','error');return;}
  if(window.evieDesktop?.account){App.toast('El chat con streaming está disponible en el navegador; en la app de escritorio llega en la siguiente fase.','error');return;}
  let id;try{id=await ensureConversation();}catch(err){App.toast(err.message||'No pude crear la conversación.','error');return;}
  const ctl=new AbortController();S.stream={conv:id,ctl,text:'',mode:regenerate?'regenerate':edit?'edit':'send'};S.error=null;
  if(regenerate){if(S.msgs.at(-1)?.role==='assistant')S.msgs.pop();}
  else if(edit){const i=S.msgs.map(m=>m.role).lastIndexOf('user');if(i>=0)S.msgs=S.msgs.slice(0,i);S.msgs.push({id:'tmp-u',seq:0,role:'user',text:t,meta:{}});}
  else S.msgs.push({id:'tmp-u',seq:0,role:'user',text:t,meta:{}});
  const input=document.getElementById('ch-input');if(input&&!regenerate){input.value='';autosize(input);}
  paintThread();paintComposer();scrollEnd(true);anim(document.querySelectorAll('.ch-msg:last-child,.ch-msg.is-user:nth-last-child(2)'),{opacity:[0,1],y:[14,0]});
  window.EvieSounds?.play?.('send');
  try{
   const res=await fetch('/api/chat/conversations/'+id+'/messages',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-Evie-Request':'1','Content-Type':'application/json',Accept:'text/event-stream','X-Evie-User':me()},body:JSON.stringify({text:t,regenerate,edit,tier:S.tier||undefined,research:S.research||undefined,context:context()}),signal:ctl.signal});
   if(!res.ok||!res.body){let msg='Ivi no pudo responder.';try{msg=(await res.json()).error||msg;}catch{}throw Object.assign(Error(msg),{status:res.status});}
   const reader=res.body.getReader(),dec=new TextDecoder();let buf='';
   for(;;){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let k;
    while((k=buf.indexOf('\n\n'))>=0){const block=buf.slice(0,k);buf=buf.slice(k+2);const ev=(block.match(/^event: (.*)$/m)||[])[1],data=(block.match(/^data: (.*)$/m)||[])[1];if(!ev||!data)continue;let d;try{d=JSON.parse(data);}catch{continue;}
     if(ev==='meta'){const u=S.msgs.find(m=>m.id==='tmp-u');if(u){u.id=d.user_message.id;u.seq=d.user_message.seq;}if(d.title&&S.conv){S.conv.title=d.title;}if(d.tier?.downgraded)App.toast(`Usé ${d.tier.label} para cuidar tu presupuesto de hoy.`,'success');S.stream.meta=d;}
     else if(ev==='delta'){S.stream.text+=d.t;paintLive();}
     else if(ev==='done'){S.msgs.push({id:d.message.id,seq:d.message.seq,role:'assistant',text:d.text,sources:d.sources||[],meta:{model:d.model,tier:d.tier?.id,stop_reason:d.stop_reason,web:!!d.checked_at},memory_used:d.memory_used||[]});if(d.title&&S.conv)S.conv.title=d.title;S.stream=null;}
     else if(ev==='error'){throw Object.assign(Error(d.error||'Ivi no pudo responder.'),{code:d.code});}}}
   if(S.stream){const partial=S.stream.text;S.stream=null;if(partial)S.msgs.push({id:'tmp-a',role:'assistant',text:partial,meta:{stop_reason:'cut'}});}
   window.EvieSounds?.play?.('receive');
  }catch(err){const partial=S.stream?.text||'';const aborted=err.name==='AbortError';S.stream=null;
   if(partial)S.msgs.push({id:'tmp-a',role:'assistant',text:partial,meta:{stop_reason:aborted?'stopped':'error'}});
   if(!aborted){S.error=err.message||'Ivi no pudo responder.';if(!partial&&!regenerate&&S.msgs.at(-1)?.id==='tmp-u'){}}}
  paintAll();scrollEnd(true);anim(document.querySelectorAll('.ch-msg.is-ivi:last-of-type .ch-actions'),{opacity:[0,1]});
  // The conversation list order/title changed: refresh quietly.
  loadList();}
 function stop(){if(S.stream){try{S.stream.ctl.abort();}catch{}}}

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
  const live=S.stream?`<article class="ch-msg is-ivi is-live" id="ch-live"><span class="ch-orb is-talking" aria-hidden="true"><i></i></span><div class="ch-body"><div class="ch-md">${S.stream.text?MD().render(S.stream.text):'<span class="ch-thinking"><i></i><i></i><i></i><em>Ivi está pensando…</em></span>'}</div><div class="ch-actions"><button type="button" class="ch-chip" data-ch="stop">${ic('square')}Detener</button></div></div></article>`:'';
  const err=S.error?`<div class="ch-error" role="alert">${ic('triangle-alert')}<span>${e(S.error)}</span>${S.msgs.at(-1)?.role==='user'?`<button type="button" class="ch-chip" data-ch="retry">${ic('rotate-ccw')}Reintentar</button>`:''}</div>`:'';
  return rows+live+err;}
 function hero(){const name=context().name;return `<div class="ch-hero"><span class="ch-orb is-hero" aria-hidden="true"><i></i></span><h2>${name?`Hola, ${e(name)}.`:'Hola.'} ¿En qué trabajamos?</h2><p>Pregúntame lo que sea. Recuerdo lo importante entre conversaciones${S.privateNext?' (en este chat privado, no)':''}.</p>
  <div class="ch-suggest">${SUGGEST.map(([i,t])=>`<button type="button" class="ch-sug v8-card" data-ch="suggest" data-t="${e(t)}">${ic(i)}<span>${e(t)}</span></button>`).join('')}</div></div>`;}
 function userMsg(m,last){return `<article class="ch-msg is-user" data-id="${e(m.id)}"><div class="ch-body"><div class="ch-bubble">${e(m.text).replace(/\n/g,'<br>')}</div>${last?`<div class="ch-actions"><button type="button" class="ch-chip" data-ch="edit" aria-label="Editar mensaje">${ic('pencil')}Editar</button></div>`:''}</div></article>`;}
 function iviMsg(m,last){const stopped=m.meta?.stop_reason==='stopped'||m.meta?.stop_reason==='cut'||m.meta?.stop_reason==='error';
  const src=(m.sources||[]).length?`<div class="ch-sources">${m.sources.map((s,i)=>`<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer" class="ch-src"><b>${i+1}</b>${e(s.host||s.title)}</a>`).join('')}</div>`:'';
  const mem=(m.memory_used||[]).length?`<details class="ch-memused"><summary>${ic('brain-circuit')}Usé ${m.memory_used.length} ${m.memory_used.length===1?'recuerdo':'recuerdos'}</summary><ul>${m.memory_used.map(x=>`<li>${e(x.text)}</li>`).join('')}</ul></details>`:'';
  return `<article class="ch-msg is-ivi" data-id="${e(m.id)}"><span class="ch-orb" aria-hidden="true"><i></i></span><div class="ch-body"><div class="ch-md">${MD().render(m.text)}</div>${stopped?`<p class="ch-note">${m.meta.stop_reason==='error'?'Respuesta incompleta.':'Respuesta detenida.'}</p>`:''}${src}${mem}
   <div class="ch-actions"><button type="button" class="ch-chip" data-ch="copy" data-id="${e(m.id)}" aria-label="Copiar respuesta">${ic('copy')}<span>Copiar</span></button><button type="button" class="ch-chip ${S.speaking===m.id?'is-on':''}" data-ch="speak" data-id="${e(m.id)}" aria-label="${S.speaking===m.id?'Detener lectura':'Leer en voz alta'}">${ic(S.speaking===m.id?'volume-x':'volume-2')}<span>${S.speaking===m.id?'Detener':'Escuchar'}</span></button>${last?`<button type="button" class="ch-chip" data-ch="regenerate" aria-label="Regenerar respuesta">${ic('refresh-cw')}<span>Regenerar</span></button>`:''}${m.meta?.model?`<small class="ch-model" title="${e(m.meta.model)}">${e({chispa:'Chispa',enfoque:'Enfoque',profundo:'Profundo'}[m.meta.tier]||'')}</small>`:''}</div></div></article>`;}
 function composer(){return composerForm()+`<p class="ch-foot">Ivi puede equivocarse; separa lo confirmado de lo que no. ${ai().provider==='claude'?'Claude · respaldo ante rechazos activado.':''}</p>`;}
 function composerForm(){const busy=!!S.stream;return `<form class="ch-composer v8-card" id="ch-form" autocomplete="off"><label class="sr-only" for="ch-input">Mensaje para Ivi</label><textarea id="ch-input" rows="1" maxlength="16000" placeholder="Escríbele a Ivi…" enterkeyhint="send"></textarea>
  <div class="ch-tools"><button type="button" class="ch-tool ${S.research?'is-on':''}" data-ch="research" aria-pressed="${S.research}" title="Buscar en la web en este mensaje">${ic('globe')}<span>Web</span></button><span class="ch-spacer"></span>
   <button type="button" class="ch-tool ch-mic ${S.rec?'is-rec':''}" data-ch="mic" aria-pressed="${!!S.rec}" aria-label="${S.rec?'Terminar dictado':'Dictar por voz'}">${ic(S.rec?'square':'mic')}</button>
   ${busy?`<button type="button" class="ch-send is-stop" data-ch="stop" aria-label="Detener respuesta">${ic('square')}</button>`:`<button type="submit" class="ch-send" aria-label="Enviar">${ic('arrow-up')}</button>`}</div></form>`;}

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
 function paintThread(){const el=document.getElementById('ch-thread');if(el){el.innerHTML=thread();icons(el);}const h=document.querySelector('.ch-head');if(h){h.outerHTML=header();icons(document.querySelector('.ch-head'));}}
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
  if(!S.listLoaded)loadList();bindInput();
  const q=document.getElementById('ch-q');if(q&&!q.dataset.bound){q.dataset.bound='1';q.addEventListener('input',()=>{clearTimeout(qTimer);qTimer=setTimeout(()=>{S.q=q.value.trim();S.listLoaded=false;paintList();loadList();},260);});}
  if(S.msgs.length||S.stream)scrollEnd(true);else{const t=document.getElementById('ch-thread');if(t)t.scrollTop=0;}
  if(!S.entered){S.entered=true;anim(root.querySelectorAll('.ch-side,.ch-head,.ch-composer'),{opacity:[0,1],y:[16,0]},{delay:window.Motion?.stagger?.(.05)||0});anim(root.querySelectorAll('.ch-sug,.ch-hero h2,.ch-hero p,.ch-orb.is-hero'),{opacity:[0,1],y:[18,0],scale:[.96,1]},{delay:window.Motion?.stagger?.(.04,{startDelay:.1})||0});}}
 document.addEventListener('submit',ev=>{if(ev.target.id!=='ch-form')return;ev.preventDefault();send({text:document.getElementById('ch-input')?.value||''});});
 document.addEventListener('click',async ev=>{
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
   else if(a==='retry'){const last=S.msgs.at(-1);if(last?.role==='user'){S.msgs.pop();S.error=null;send({text:last.text,edit:last.id!=='tmp-u'});}}
   else if(a==='edit'){const last=[...S.msgs].reverse().find(m=>m.role==='user');if(!last)return;App.openDialog('Editar mensaje',`<form id="ch-edit" class="ch-form"><label class="ch-field"><span>Tu mensaje</span><textarea class="input" name="text" rows="4" maxlength="16000" required>${e(last.text)}</textarea></label><p class="dialog-subtitle">Ivi responderá de nuevo desde este punto.</p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('send')}Enviar</button></div></form>`);
    const f=document.getElementById('ch-edit');f.onsubmit=ev2=>{ev2.preventDefault();const t=f.elements.text.value.trim();if(!t)return;App.closeDialog(true);send({text:t,edit:true});};}
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
 function reset(){stop();S.rec?.stop?.();audio?.pause();Object.assign(S,{list:[],listLoaded:false,cur:null,conv:null,msgs:[],stream:null,tier:null,research:false,drawer:false,error:null,mem:null,memForgotten:false,memKind:'all',rec:null,speaking:null,entered:false,privateNext:false});}
 return Object.freeze({view,afterRender,refresh,reset,send,stop,open,startNew,state:()=>S});
})();
