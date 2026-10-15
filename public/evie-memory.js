'use strict';
/* Memoria de Ivi (client). Server is authoritative (/api/memory, per signed-in account). This module:
   - parses explicit voice/text intents locally (no paid AI call): «Ivi, recuerda que…», «Ivi, olvida…»,
     «¿recuerdas lo que te pregunté ayer?», «modo privado» on/off;
   - executes the model tools remember_memory / forget_memory / recall_conversation;
   - keeps the CURRENT conversation's user questions and, only if the account opted in to saving history,
     sends one bounded summary when the conversation ends. Kisha and private mode never send.
   Every session is bound to the account that started it: an account switch never flushes A's turns into B. */
window.EvieMemory=(()=>{
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const WAKE=/^(?:oye |hey |hola )?(?:ivi|ivy|evie|evi|ibi)[, ]+/;
 const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,]/g,'').trim();
 let settings=null,owner=null,privateMode=false,session=null,endTimer=0,pendingSensitive=null;
 const me=()=>EvieAccounts?.current?.()?.id||null;
 function reset(){settings=null;owner=null;privateMode=false;session=null;pendingSensitive=null;clearTimeout(endTimer);badge();}
 async function load(force=false){if(!cloud())return null;if(owner!==me()){settings=null;owner=me();}if(settings&&!force)return {settings};try{const r=await EvieAccounts.request('memory');settings=r.settings;return r;}catch{return null;}}
 const req=(path,o)=>EvieAccounts.request('memory'+(path?'/'+path:''),o);
 /* ---------- private mode ---------- */
 function setPrivate(on){privateMode=!!on;if(privateMode){session=null;clearTimeout(endTimer);}badge();return privateMode;}
 function badge(){document.documentElement.dataset.eviePrivate=privateMode?'1':'';let b=document.getElementById('evie-private-badge');
  if(!privateMode){b?.remove();return;}if(!b){b=document.createElement('button');b.type='button';b.id='evie-private-badge';b.className='evie-private-badge';b.dataset.memoryPrivate='off';b.setAttribute('aria-label','Modo privado activo. Toca para salir.');document.body.append(b);}
  b.innerHTML='<span aria-hidden="true">●</span> Modo privado · no se guarda nada';}
 document.addEventListener('click',ev=>{const t=ev.target.closest('[data-memory-private]');if(!t)return;setPrivate(t.dataset.memoryPrivate==='on');window.App?.toast?.(privateMode?'Modo privado: esta conversación no crea recuerdos ni se guarda en el historial.':'Saliste del modo privado.','success');window.EvieMemoryView?.reload?.();});
 /* ---------- current conversation (short-term) ---------- */
 function track(text,{source='evie'}={}){if(privateMode||source==='kisha'||!cloud())return;const q=String(text||'').trim().slice(0,200);if(q.length<3||isMemoryCommand(q))return;
  if(!session||session.owner!==me())session={id:'s-'+crypto.randomUUID(),owner:me(),started_at:Date.now(),questions:[]};if(!session.questions.includes(q))session.questions.push(q);session.questions=session.questions.slice(-6);
  clearTimeout(endTimer);endTimer=setTimeout(()=>void finish(),10*60*1000);}
 /** Send the bounded summary (the server re-checks the opt-in). Safe to call many times. */
 async function finish(){clearTimeout(endTimer);const s=session;session=null;if(!s||privateMode||!s.questions.length||!cloud()||s.owner!==me())return {stored:false};
  try{const st=settings||(await load())?.settings;if(!st?.save_history)return {stored:false,reason:'history_off'};return await req('sessions',{method:'POST',body:{id:s.id,started_at:s.started_at,questions:s.questions}});}catch{return {stored:false};}}
 addEventListener('pagehide',()=>{void finish();});document.addEventListener('visibilitychange',()=>{if(document.hidden)void finish();});
 /* ---------- intents (local, no AI) ---------- */
 const strip=t=>norm(t).replace(WAKE,'');
 function isMemoryCommand(t){const q=strip(t);return /^(recuerda|acuerdate de|no olvides|guarda en tu memoria|olvida|borra (?:el|ese) recuerdo|activa el modo privado|modo privado|desactiva el modo privado|sal del modo privado)/.test(q)||/recuerdas (lo )?que te (pregunte|dije)/.test(q);}
 function original(text,rx){const m=String(text).replace(/^[\s¿¡]*(?:oye |hey |hola )?(?:ivi|ivy|evie|evi|ibi)[, ]+/i,'').match(rx);return m?m[1].trim().replace(/[.!]+$/,''):null;}
 /** Returns a spoken string, '' (handled async through say), or null (not a memory request). */
 function intent(text,{say}={}){const q=strip(text);
  if(/^(activa(r)? el |entra en |pon el )?modo privado$|^conversacion privada$/.test(q)){setPrivate(true);return 'Modo privado activado. No guardaré recuerdos ni esta conversación.';}
  if(/^(desactiva|quita|sal del|salir del|termina el) modo privado$/.test(q)){setPrivate(false);return 'Listo, salí del modo privado.';}
  let fact=original(text,/^(?:recuerda que|recuerda|acuérdate de que|acuerdate de que|no olvides que|guarda en tu memoria que)\s+(.{3,280})$/i);
  if(fact&&!/^(lo que te|que te pregunte|que te dije)/i.test(norm(fact))){if(privateMode)return 'Estás en modo privado, así que no guardo recuerdos. Sal del modo privado si quieres que lo recuerde.';
   if(!cloud())return 'Para recordar cosas necesito tu cuenta EVIE con sesión iniciada.';
   remember(fact).then(r=>say?.(r.say)).catch(e=>say?.(e.message||'No pude guardarlo.'));return '';}
  fact=original(text,/^(?:olvida(?: que)?|borra (?:el|ese) recuerdo(?: de| sobre)?|ya no recuerdes)\s+(.{2,200})$/i);
  if(fact){if(!cloud())return 'Necesito tu cuenta EVIE para manejar tu memoria.';forget(fact).then(r=>say?.(r.say)).catch(e=>say?.(e.message||'No pude borrarlo.'));return '';}
  if(/recuerdas (lo )?que te (pregunte|dije|conte)|que te pregunte (ayer|anteayer|hoy|el \w+)|de que hablamos (ayer|anteayer|el \w+)/.test(q)){if(!cloud())return 'No tengo un historial de conversaciones sin tu cuenta EVIE.';
   if(privateMode)return 'En modo privado no consulto conversaciones pasadas.';recall(text).then(r=>say?.(r.say)).catch(()=>say?.('No pude consultar tu historial ahora.'));return '';}
  return null;}
 /* ---------- operations (also used as model tools) ---------- */
 async function remember(text,{confirm=false}={}){const r=await req('items',{method:'POST',body:{text,confirm_sensitive:confirm,source:'explicit'}});
  if(r.needs_confirmation){pendingSensitive=r.text||text;refreshView();return {...r,say:'Eso es sensible. Te dejé la confirmación en Configuración personalizada → Memoria para que lo revises antes de guardarlo.'};}
  if(r.needs_permission||r.refused||r.error)return {...r,say:r.error};
  window.EvieSounds?.play?.('success');refreshView();return {...r,say:r.superseded?'Actualicé lo que sabía: '+r.text+'.':r.duplicate?'Eso ya lo tenía guardado.':'Listo, lo recordaré: '+r.text+'.'};}
 async function forget(query){const r=await req('forget',{method:'POST',body:{query}});
  if(r.ambiguous){showChoices(r.candidates);return {...r,say:'Tengo varios recuerdos parecidos. Te los dejé en pantalla para que elijas cuál olvidar.'};}
  if(r.deleted?.length){refreshView();return {...r,say:'Listo, olvidé: '+(r.text||'ese recuerdo')+'.'};}
  return {...r,say:r.error||'No tengo guardado nada sobre eso.'};}
 async function recall(question){const r=await req('recall',{method:'POST',body:{question}});return {...r,say:r.text};}
 const tools={
  async remember_memory({text}){if(privateMode)return {ok:false,status:'private_mode',note:'Modo privado: no se guardan recuerdos.'};if(!cloud())return {ok:false,status:'unavailable'};const r=await remember(text);return {ok:!!(r.created||r.superseded||r.duplicate),status:r.created?'saved':r.superseded?'updated':r.duplicate?'already_saved':r.needs_confirmation?'needs_user_confirmation':r.needs_permission?'category_disabled':r.refused?'refused':'error',text:r.text||null,note:r.say};},
  async forget_memory({query}){if(!cloud())return {ok:false,status:'unavailable'};const r=await forget(query);return {ok:!!r.deleted?.length,status:r.deleted?.length?'deleted':r.ambiguous?'ambiguous_shown':'not_found',candidates:r.candidates?.map(c=>c.text)||null,note:r.say};},
  async recall_conversation({question}){if(privateMode)return {ok:false,status:'private_mode'};if(!cloud())return {ok:false,status:'unavailable'};const r=await recall(question);return {ok:!!r.sessions?.length,status:r.sessions?.length?'found':r.stored?'none_that_day':'history_not_saved',day:r.day,questions:r.sessions?.flatMap(s=>s.questions)||[],answer:r.text,note:'Responde solo con esto; no inventes.'};}
 };
 function showChoices(list){const dlg=document.createElement('dialog');dlg.className='memory-choice';dlg.setAttribute('aria-labelledby','mem-choice-t');
  dlg.innerHTML=`<h2 id="mem-choice-t">¿Cuál quieres que olvide?</h2><ul class="memory-choice-list">${list.map(c=>`<li><button type="button" class="button" data-forget-id="${Domain.escape(c.id)}">${Domain.escape(c.text)}</button></li>`).join('')}</ul><div class="form-footer"><button type="button" class="button" data-forget-cancel>Ninguno</button></div>`;
  document.body.append(dlg);dlg.showModal();dlg.addEventListener('close',()=>dlg.remove());
  dlg.addEventListener('click',async ev=>{if(ev.target.closest('[data-forget-cancel]'))return dlg.close();const b=ev.target.closest('[data-forget-id]');if(!b)return;b.disabled=true;try{await req('items/'+encodeURIComponent(b.dataset.forgetId),{method:'DELETE'});App.toast('Recuerdo olvidado.','success');refreshView();}catch(e){App.toast(e.message,'error');}dlg.close();});}
 function refreshView(){window.EvieMemoryView?.reload?.();}
 return Object.freeze({load,reset,intent,tools,track,finish,setPrivate,isPrivate:()=>privateMode,remember,forget,recall,request:req,pendingSensitive:()=>pendingSensitive,clearPending:()=>{pendingSensitive=null;},cloud});
})();
