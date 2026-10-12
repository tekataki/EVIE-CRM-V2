'use strict';
/* Mascota Virtual · Kisha — page controller (route #mascota, internal alias #bitacora).
   Hierarchy: 1) Kisha  2) one action  3) live transcript when active  4) searchable history.
   Saving: Concluir → server draft → REVIEW (editable) → explicit Guardar → one journal v4 record
   (idempotent per session id). Unfinished sessions live only in this account's localStorage key. */
window.KishaView=(()=>{
 const K=()=>window.KishaCore;
 const e=s=>Domain.escape(String(s??''));
 const i=n=>Views.icon(n);
 let session=null,machine=null,character=null,voice=null,ctl=null,turnSeq=0,closeTimer=0,mounted=null,saving=false;
 const UIK=()=>(UI.kisha??={q:'',from:'',to:'',tab:'history',range:30});
 const owner=()=>window.EvieAccounts?.current?.()?.id||'local';
 const runtime=()=>window.EvieAccounts?.config?.()||{};
 const cloud=()=>!!window.EvieAccounts?.current?.()&&runtime().accountsEnabled===true;
 const can=k=>cloud()&&runtime().ai?.[k]===true;
 const pref=()=>({voice:true,muted:false,animate:true,...(Store.get()?.preferences?.kisha||{})});
 function setPref(p){Store.save(s=>{s.preferences.kisha={...pref(),...p};});}
 const prof=()=>{const x=window.EvieProfile?.current?.();return x&&x.enabled!==false?x:null;};
 const name=()=>{const p=prof();if(p?.preferred_name)return p.preferred_name;return String(Store.get()?.profile?.preferred||'').trim();};
 const zone=()=>prof()?.timezone||DALI_CONFIG.timezone||'America/Mexico_City';
 const hourNow=()=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:zone(),hour:'2-digit',hourCycle:'h23'}).format(new Date()));
 const localNow=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone(),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour==='24'?'00':p.hour}:${p.minute}`};};
 const rows=()=>Store.list('journal');
 /* ---------- private recoverable draft (per account) ---------- */
 function persist(){if(!session||session.saved)return;try{localStorage.setItem(K().draftKey(owner()),K().serialize(session));}catch{}}
 function loadDraft(){try{return K().restore(localStorage.getItem(K().draftKey(owner()))||'');}catch{return null;}}
 function clearDraft(){try{localStorage.removeItem(K().draftKey(owner()));}catch{}}
 /* ---------- render ---------- */
 function headerHTML(){return `<header class="page-heading kisha-heading"><div><div class="eyebrow">MASCOTA VIRTUAL</div><h1>Kisha</h1><p>Cuéntale tu día. Ella te escucha y, si quieres, lo guardas.</p></div></header>`;}
 function stageHTML(){const active=!!session&&!session.review,draft=!session&&loadDraft();
  return `<section class="kisha-stage panel ${active?'active':''}" id="kisha-stage" aria-label="Conversación con Kisha">
   <div class="kisha-char" id="kisha-char"></div>
   <p class="kisha-status" id="kisha-status" role="status" aria-live="polite">Lista para conversar</p>
   ${active?convoHTML():draft&&draft.messages.some(m=>m.role==='user')?`<div class="kisha-resume" role="group" aria-label="Conversación sin terminar"><p>${i('history')}Tienes una conversación sin terminar${draft.started_at?' del '+e(Views.date(draft.started_at.slice(0,10))):''}.</p><div class="toolbar"><button class="button primary" data-kisha="resume">Continuar conversación</button><button class="button" data-kisha="discard-draft">Descartar</button></div></div>`:`<button class="button primary kisha-start" data-kisha="start">${i('message-circle-heart')}Iniciar conversación</button>`}
   <p class="kisha-privacy">${i('shield-check')}<span>Lo que dices por voz se transcribe con Groq, Kisha responde con OpenAI y habla con Fish Audio. No guardamos el audio. Nada se guarda en tu historial sin tu confirmación. Kisha es una compañera de IA, no una terapeuta.</span></p>
   <button class="kisha-anim-toggle" data-kisha="animate" aria-pressed="${!pref().animate}">${pref().animate?'Desactivar animación de Kisha':'Activar animación de Kisha'}</button>
  </section>`;}
 function convoHTML(){return `<div class="kisha-convo" id="kisha-convo">
   <ol class="kisha-log" id="kisha-log" aria-label="Transcripción de la conversación">${session.messages.map(msgHTML).join('')}</ol>
   <div class="kisha-replay" id="kisha-replay" hidden><button class="button primary" data-kisha="replay">${i('volume-2')}Tocar para escuchar</button></div>
   <form class="kisha-input" id="kisha-form" autocomplete="off"><label class="sr-only" for="kisha-text">Escribe tu mensaje para Kisha</label><textarea id="kisha-text" rows="1" maxlength="2000" placeholder="Escribe o usa el micrófono" enterkeyhint="send"></textarea>
    <button type="button" class="icon-button kisha-mic" data-kisha="mic" aria-label="Hablar con Kisha" aria-pressed="false">${i('mic')}</button><button class="icon-button primary" id="kisha-send" aria-label="Enviar">${i('send')}</button></form>
   ${controlsHTML()}</div>`;}
 function controlsHTML(){const p=pref(),paused=machine?.phase==='paused';return `<div class="kisha-controls" role="toolbar" aria-label="Controles de la conversación">
    <button class="button" data-kisha="pause" aria-pressed="${paused}">${paused?i('play')+'Reanudar':i('pause')+'Pausar'}</button>
    <button class="button" data-kisha="stop-audio">${i('square')}Detener voz</button>
    <button class="button" data-kisha="mute" aria-pressed="${p.muted}">${p.muted?i('volume-x')+'Voz apagada':i('volume-2')+'Voz activada'}</button>
    <button class="button primary kisha-finish" data-kisha="finish">${i('check')}Concluir conversación</button></div>`;}
 function msgHTML(m){return `<li class="kisha-msg ${m.role==='user'?'user':'kisha'}"><span class="kisha-who">${m.role==='user'?e(name()||'Tú'):'Kisha'}</span><p>${e(m.text)}</p></li>`;}
 function historyHTML(){const f=UIK(),all=rows(),kisha=all.filter(r=>K().isKisha(r)&&!r.deleted_at),legacy=all.filter(K().isLegacy);
  const tabs=`<nav class="tabs kisha-tabs" aria-label="Secciones del historial">${[['history','Conversaciones'],['trends','Tendencias'],['legacy',`Registros anteriores (${legacy.length})`]].map(([k,l])=>`<button class="button ${f.tab===k?'primary':''}" data-kisha="tab" data-tab="${k}" aria-current="${f.tab===k?'page':'false'}">${l}</button>`).join('')}</nav>`;
  let body;
  if(f.tab==='trends')body=trendsHTML(kisha);
  else if(f.tab==='legacy')body=legacyHTML(legacy);
  else{const groups=K().groupByDay(K().filter(kisha,f));
   body=`<div class="kisha-filters" role="search"><label>Buscar por título<input class="input" id="kisha-q" type="search" value="${e(f.q)}" placeholder="Ej. trabajo, familia…"></label><label>Desde<input class="input" id="kisha-from" type="date" value="${e(f.from)}"></label><label>Hasta<input class="input" id="kisha-to" type="date" value="${e(f.to)}"></label></div><div id="kisha-list">${listHTML(groups,kisha.length)}</div>`;}
  return `<section class="panel kisha-history" id="kisha-history" aria-labelledby="kisha-h-title"><header class="panel-header"><div><span class="eyebrow">HISTORIAL</span><h2 id="kisha-h-title">Tus conversaciones</h2></div><button class="button" data-action="rc-context">${i('download')}Exportar</button></header>${tabs}${body}</section>`;}
 function listHTML(groups,total){return groups.length?groups.map(g=>`<section class="kisha-day"><h3>${e(Views.date(g.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</h3>${g.rows.map(r=>`<a class="kisha-entry" href="#mascota/${e(r.id)}"><span class="tag">${e(r.time_local||'')}</span><span><strong>${e(r.title)}</strong><small>${e(K().excerpt(r))}</small></span>${i('chevron-right')}</a>`).join('')}</section>`).join(''):`<p class="empty-compact">${total?'Ninguna conversación coincide con tu búsqueda.':'Aún no hay conversaciones guardadas. Cuando concluyas una y la confirmes, aparecerá aquí.'}</p>`;}
 function trendsHTML(list){const to=Domain.today(),days=UIK().range||30,from=V2Domain.addDays(to,-(days-1)),t=K().trends(list,{from,to});
  return `<div class="toolbar">${[7,30,90].map(n=>`<button class="button ${days===n?'primary':''}" data-kisha="range" data-n="${n}" aria-pressed="${days===n}">${n} días</button>`).join('')}</div>
  ${t.entries?`<p class="muted">Promedios de ${t.entries} conversación(es) que confirmaste. Son intensidades sugeridas de 0 a 100, independientes entre sí; no explican por qué te sentiste así.</p>${chartHTML(t.emotions.map(x=>({key:x.key,label:x.label,value:x.mean,note:`${x.n} entrada(s)`})),'Promedio por emoción')}
  ${t.emotions.map(x=>`<details class="kisha-why"><summary>${e(x.label)}: ver las ${x.n} entrada(s)</summary><ul>${x.ids.map(id=>{const r=list.find(y=>y.id===id);return r?`<li><a href="#mascota/${e(id)}">${e(Views.date(r.date))} · ${e(r.title)}</a></li>`:'';}).join('')}</ul></details>`).join('')}
  ${t.repeated.map(x=>`<p class="notice">${i('repeat')}<span>«${e(x.text)}». ${e(x.sentence)}</span></p>`).join('')}`:`<p class="empty-compact">Sin datos suficientes en este periodo. Las tendencias solo usan conversaciones que confirmaste.</p>`}`;}
 function legacyHTML(list){const s=[...list].sort((a,b)=>b.date.localeCompare(a.date));
  return `<p class="muted">Tus entradas escritas a mano o importadas antes de Kisha se conservan intactas. Puedes abrirlas, exportarlas o archivarlas.</p>${s.length?s.map(r=>`<a class="kisha-entry" href="#mascota/${e(r.id)}"><span class="tag">${e(Views.date(r.date))}</span><span><strong>${e(r.title)}</strong><small>${r.journal_version===4?'Reflexión importada':'Entrada manual'} · ${e(K().excerpt(r,90))}</small></span>${i('chevron-right')}</a>`).join(''):'<p class="empty-compact">No hay registros anteriores.</p>'}`;}
 /* Emotion bars: exact values, accessible labels, honest empty state. */
 function chartHTML(items,caption,{editable=false}={}){if(!items.length)return `<p class="kisha-nodata">${i('circle-help')}Sin datos suficientes para sugerir intensidades.</p>`;
  return `<figure class="kisha-chart"><figcaption>${e(caption)} <small>(0–100; no suman 100)</small></figcaption><ul>${items.map(x=>`<li><span class="kc-label" id="kc-${e(x.key)}">${e(x.label)}</span><span class="kc-track" aria-hidden="true"><span class="kc-bar kc-${e(x.key)}" style="--v:${x.value}"></span></span>${editable?`<input class="input kc-num" type="number" inputmode="numeric" min="0" max="100" step="1" value="${x.value}" data-kisha-emo="${e(x.key)}" aria-labelledby="kc-${e(x.key)}">`:`<strong class="kc-val" aria-label="${e(x.label)}: ${x.value} de 100">${x.value}</strong>`}${x.note?`<small class="kc-note">${e(x.note)}</small>`:''}</li>`).join('')}</ul></figure>`;}
 function reviewHTML(){const r=session.review,emo=r.emotions.map(x=>({key:x.key,label:K().EMOTIONS[x.key],value:x.value,note:x.evidence?`«${x.evidence}»`:''}));
  const missing=Object.keys(K().EMOTIONS).filter(k=>!r.emotions.some(x=>x.key===k));
  return `<section class="panel kisha-review" id="kisha-review" aria-labelledby="kisha-r-title"><header class="panel-header"><div><span class="eyebrow">REVISA ANTES DE GUARDAR</span><h2 id="kisha-r-title">Tu conversación</h2></div></header>
  <form id="kisha-review-form" class="form-grid">
   <label>Título<input class="input" name="title" maxlength="120" required value="${e(r.title)}" placeholder="Ponle un nombre a tu día"></label>
   <p class="muted">${e(Views.date(r.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))} · ${e(r.time_local)} (${e(r.timezone)})</p>
   <label>Resumen<textarea class="input" name="summary" rows="3" maxlength="1200" placeholder="${r.insufficient?'Compartiste poco; puedes escribir un resumen tú.':''}">${e(r.summary)}</textarea></label>
   ${r.moments.length?`<fieldset><legend>Momentos clave</legend><ul class="kisha-moments">${r.moments.map((m,k)=>`<li><label><input type="checkbox" name="moment" value="${k}" checked> ${e(m.text)}</label>${m.quote?`<small>«${e(m.quote)}»</small>`:''}</li>`).join('')}</ul></fieldset>`:''}
   <div><h3>Intensidades sugeridas</h3><p class="muted" id="kisha-emo-help">Son sugerencias, no mediciones. «Felicidad 40» significa una intensidad sugerida de 40/100, no que estuviste feliz el 40% del día. Puedes cambiarlas, quitarlas o no guardarlas.</p>
    ${chartHTML(emo,'Intensidad sugerida',{editable:true})}
    ${emo.length?`<label class="kisha-check"><input type="checkbox" name="keep_emotions" checked> Guardar estas intensidades</label>`:''}
    ${missing.length?`<label class="kisha-add">Añadir una emoción tú<select class="select" id="kisha-add-emo"><option value="">Elegir…</option>${missing.map(k=>`<option value="${k}">${e(K().EMOTIONS[k])}</option>`).join('')}</select></label>`:''}</div>
   ${r.observation?`<label class="kisha-check"><input type="checkbox" name="keep_observation" checked> <span>Guardar esta posible observación: <em>${e(r.observation)}</em></span></label>`:''}
   <label class="kisha-check"><input type="checkbox" name="keep_transcript"> Guardar también la transcripción completa (${session.messages.length} mensajes)</label>
   <p class="form-error" id="kisha-review-err" role="alert"></p>
   <footer class="form-footer"><button type="button" class="button" data-kisha="back">Seguir conversando</button><button type="button" class="button" data-kisha="discard">Descartar</button><button class="button primary" id="kisha-save">Guardar en mi historial</button></footer>
  </form></section>`;}
 function detailHTML(r){const emo=(r.emotions||[]).map(x=>({key:x.key,label:K().EMOTIONS[x.key]||x.label||x.key,value:x.intensity})),legacy=!K().isKisha(r);
  return `<article class="panel kisha-detail" id="kisha-detail"><header class="panel-header"><div><span class="eyebrow">${e(Views.date(r.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}${r.time_local?' · '+e(r.time_local):''}${legacy?' · Registro anterior':''}</span><h2>${e(r.title)}</h2></div><a class="button" href="#mascota">${i('arrow-left')}Volver</a></header>
   <form id="kisha-title-form" class="kisha-inline"><label>Título<input class="input" name="title" maxlength="120" value="${e(r.title)}" required></label><button class="button">Guardar título</button></form>
   ${r.summary&&r.summary!=='Sin resumen.'?`<h3>Resumen</h3><p class="body-copy">${e(r.summary)}</p>`:''}
   ${legacy&&r.text?`<h3>Texto original</h3><p class="body-copy">${e(r.text)}</p>`:''}
   ${(r.highlights||[]).length?`<h3>Momentos</h3><ul>${r.highlights.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`:''}
   <form id="kisha-emo-form">${chartHTML(emo,'Intensidades',{editable:true})}${emo.length?'<button class="button">Guardar intensidades</button>':''}</form>
   ${!legacy&&r.assistant_note&&r.assistant_note!=='Borrador revisado y confirmado por ti.'?`<p class="notice">${i('lightbulb')}<span>${e(r.assistant_note)}</span></p>`:''}
   ${Array.isArray(r.transcript)&&r.transcript.length?`<details class="kisha-transcript"><summary>Transcripción (${r.transcript.length} mensajes)</summary><ol class="kisha-log">${r.transcript.map(msgHTML).join('')}</ol></details>`:!legacy?'<p class="muted">No guardaste la transcripción de esta conversación.</p>':''}
   <div class="toolbar"><button class="button danger" data-kisha="delete" data-id="${e(r.id)}">${i('trash-2')}Eliminar</button></div></article>`;}
 function render(id){if(id){const r=rows().find(x=>x.id===id&&!x.deleted_at);return `<div class="kisha-page" data-kisha-page>${headerHTML()}${r?detailHTML(r):Views.notFound()}</div>`;}
  return `<div class="kisha-page" data-kisha-page>${headerHTML()}${session?.review?reviewHTML():stageHTML()}${historyHTML()}</div>`;}
 /* ---------- mount / lifecycle ---------- */
 function afterRender(){const page=document.querySelector('[data-kisha-page]');if(!page){if(mounted||voice)leave();return;}
  const host=document.getElementById('kisha-char');
  if(host&&mounted!==host){character?.destroy();try{character=KishaCharacter.create(host,{animated:pref().animate});}catch{character=null;host.classList.add('still');}mounted=host;}
  if(!machine)machine=K().machine(onView);
  character?.setAnimated(pref().animate);onView(machine.view());
  const log=document.getElementById('kisha-log');if(log)log.scrollTop=log.scrollHeight;
  const ta=document.getElementById('kisha-text');if(ta){ta.oninput=()=>{ta.style.height='auto';ta.style.height=Math.min(140,ta.scrollHeight)+'px';};ta.onkeydown=ev=>{if(ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing){ev.preventDefault();document.getElementById('kisha-form').requestSubmit();}};}
  const form=document.getElementById('kisha-form');if(form)form.onsubmit=ev=>{ev.preventDefault();const t=ta.value.trim();if(!t)return;ta.value='';ta.style.height='';send(t);};
  bindReview();bindDetail();bindFilters();syncReplay();}
 function onView(v){const st=document.getElementById('kisha-status');if(st)st.textContent=(v.phase==='off'&&!session)?'Lista para conversar':(K().STATUS[v.phase]||'');
  character?.set(v.pose);const stage=document.getElementById('kisha-stage');if(stage)stage.dataset.phase=v.phase;
  const mic=document.querySelector('[data-kisha=mic]');if(mic){mic.setAttribute('aria-pressed',String(v.phase==='listening'));mic.setAttribute('aria-label',v.phase==='listening'?'Terminar de hablar y enviar':'Hablar con Kisha');mic.disabled=v.phase==='paused'||['transcribing','thinking'].includes(v.phase);}
  const busy=['transcribing','thinking','listening'].includes(v.phase)||v.phase==='paused';const send=document.getElementById('kisha-send');if(send)send.disabled=busy;const ta=document.getElementById('kisha-text');if(ta)ta.disabled=v.phase==='paused';
  syncReplay();}
 function syncReplay(){const r=document.getElementById('kisha-replay');if(r)r.hidden=!(machine?.phase==='blocked'&&voice?.hasClip());}
 function leave(){abort();voice?.dispose();voice=null;character?.destroy();character=null;mounted=null;clearTimeout(closeTimer);persist();session=null;machine=null;}
 function abort(){try{ctl?.abort();}catch{}ctl=null;}
 function ensureVoice(){if(!voice)voice=KishaVoice.create({onPhase:p=>{if(p!=='synthesizing')machine.go(p);},onLevel:l=>character?.setMouth(l),canCloud:can});return voice;}
 /* ---------- conversation ---------- */
 function add(role,text){session.messages.push({role,text,at:new Date().toISOString()});const log=document.getElementById('kisha-log');if(log){log.insertAdjacentHTML('beforeend',msgHTML(session.messages.at(-1)));log.scrollTop=log.scrollHeight;}persist();}
 function note(text,html=''){const log=document.getElementById('kisha-log');if(log){log.insertAdjacentHTML('beforeend',`<li class="kisha-msg system" role="note"><p>${e(text)}</p>${html}</li>`);log.scrollTop=log.scrollHeight;}}
 async function start(){ensureVoice().unlock();window.EvieAssistant?.stopSpeaking?.();session={id:K().newId(),started_at:new Date().toISOString(),messages:[],memory:null,memoryUpTo:0};machine=K().machine(onView);machine.go('greeting');App.render();
  const hello=K().greeting(name(),hourNow());add('kisha',hello);await say(hello);if(session&&['greeting','speaking'].includes(machine.phase))machine.go('idle');document.getElementById('kisha-text')?.focus({preventScroll:true});}
 function resume(){const d=loadDraft();if(!d)return start();ensureVoice().unlock();session=d;machine=K().machine(onView);machine.go('idle');if(session.review)machine.go('review');App.render();if(!session.review)note('Continuamos donde lo dejaste.');}
 async function say(text){if(!session)return;if(pref().muted||!pref().voice){if(machine.phase!=='idle')machine.go('idle');return;}
  abort();ctl=new AbortController();const sig=ctl.signal;const r=await ensureVoice().speak(text,sig);if(sig.aborted||!session)return;
  if(r==='blocked'){machine.go('blocked');syncReplay();return;}
  if(['speaking','thinking','greeting'].includes(machine.phase))machine.go('idle');scheduleClose();}
 function scheduleClose(){clearTimeout(closeTimer);if(!session||session.closeAsked||K().userWords(session)<25)return;
  closeTimer=setTimeout(()=>{if(session&&machine.phase==='idle'&&!session.review&&!session.closeAsked){session.closeAsked=true;add('kisha',K().CLOSE);say(K().CLOSE);}},45000);}
 async function send(text){if(!session||machine.phase==='paused')return;clearTimeout(closeTimer);
  voice?.stopPlayback();abort();if(['speaking','blocked','error','greeting'].includes(machine.phase))machine.go('idle');add('user',text);await reply();}
 async function reply(){if(!can('chat')){if(machine.phase!=='idle')machine.go('idle');note(cloud()?'La IA de Kisha no está disponible ahora. Tus mensajes siguen aquí; puedes concluir y guardarlos.':'Kisha necesita tu cuenta EVIE con IA para responder. Tus mensajes se conservan en este dispositivo y puedes concluir y guardarlos.');return;}
  const id=++turnSeq,users=session.messages.filter(m=>m.role==='user').length,turnId='t'+session.id.slice(0,8)+'-'+users;
  machine.go('thinking');abort();ctl=new AbortController();const sig=ctl.signal;const c=K().context(session);
  let res;try{res=await EvieAccounts.request('kisha/turn',{method:'POST',body:{session_id:session.id,turn_id:turnId,...c},signal:sig});}
  catch(err){if(sig.aborted||id!==turnSeq||!session)return;machine.go('error');
   note(err.status===429?err.message:navigator.onLine===false?'Sin conexión. Tu mensaje quedó guardado aquí; reintenta cuando vuelvas a estar en línea.':(err.message||'Kisha no pudo responder.'),`<button class="button" data-kisha="retry">${i('rotate-cw')}Reintentar</button>`);App.icons();setTimeout(()=>{if(machine?.phase==='error')machine.go('idle');},1500);return;}
  if(sig.aborted||id!==turnSeq||!session)return;
  if(res.memory){session.memory=res.memory;session.memoryUpTo=session.messages.length;}
  machine.go('idle');machine.suggest(res.cue);add('kisha',res.reply);
  if(res.safety)document.getElementById('kisha-log')?.lastElementChild?.classList.add('safety');
  if(res.intent==='close_offer')session.closeAsked=true;
  await say(res.reply);}
 async function mic(){if(!session)return;const v=ensureVoice();if(v.recording()){v.stopRecording();return;}
  if(machine.phase==='paused')return;v.unlock();v.stopPlayback();abort();if(['speaking','blocked','error','greeting'].includes(machine.phase))machine.go('idle');ctl=new AbortController();const sig=ctl.signal;
  try{const text=await v.record(sig);if(sig.aborted||!session)return;if(!text){if(!['paused','idle'].includes(machine.phase))machine.go('idle');return;}if(machine.phase!=='idle')machine.go('idle');add('user',text);await reply();}
  catch(err){if(sig.aborted||!session)return;machine.go('error');note(err.message);setTimeout(()=>{if(machine?.phase==='error')machine.go('idle');},1600);document.getElementById('kisha-text')?.focus();}}
 function pause(){if(!session)return;if(machine.phase==='paused')machine.go('idle');else{abort();voice?.stopRecording();voice?.stopPlayback();clearTimeout(closeTimer);if(machine.phase!=='idle')machine.go('idle');machine.go('paused');}persist();const c=document.querySelector('.kisha-controls');if(c){c.outerHTML=controlsHTML();App.icons();}onView(machine.view());}
 async function finish(){if(!session)return;abort();voice?.stopRecording();voice?.stopPlayback();clearTimeout(closeTimer);
  if(!session.messages.some(m=>m.role==='user')){App.confirmAction('Concluir conversación','Aún no contaste nada. ¿Quieres terminar sin guardar?',()=>discard(true),'Terminar sin guardar');return;}
  if(machine.phase!=='idle'&&machine.phase!=='paused')machine.go('idle');
  const st=document.getElementById('kisha-status');if(st)st.textContent='Preparando tu resumen…';
  const btn=document.querySelector('[data-kisha=finish]');if(btn)btn.disabled=true;
  const now=localNow();let draft=null;
  if(can('chat')&&K().userWords(session)>=8){ctl=new AbortController();try{draft=await EvieAccounts.request('kisha/analyze',{method:'POST',body:{session_id:session.id,messages:session.messages.slice(-120).map(m=>({role:m.role,text:m.text})),memory:session.memory,timezone:zone()},signal:ctl.signal});}
   catch(err){if(!session)return;App.toast((err.message||'No se pudo preparar el resumen.')+' Puedes escribir tu propio resumen.','error');}}
  if(!session)return;
  if(draft?.owner&&draft.owner!==owner()){App.toast('La sesión cambió de cuenta. No se usó ese resumen.','error');if(btn)btn.disabled=false;return;}
  draft=draft||{insufficient:true,title:'',summary:'',moments:[],emotions:[],observation:null,date:now.date,time_local:now.time,timezone:zone()};
  session.review={date:draft.date,time_local:draft.time_local,timezone:draft.timezone,title:draft.title||'',summary:draft.summary||'',moments:draft.moments||[],emotions:(draft.emotions||[]).map(x=>({key:x.key,value:x.value,evidence:x.evidence})),observation:draft.observation||null,insufficient:!!draft.insufficient};
  if(machine.phase==='paused')machine.go('idle');machine.go('review');persist();App.render();document.querySelector('#kisha-review input[name=title]')?.focus();}
 function readReview(form){const r=session.review,keepEmo=!form.elements.keep_emotions||form.elements.keep_emotions.checked;
  const emotions=keepEmo?[...form.querySelectorAll('[data-kisha-emo]')].filter(n=>n.value.trim()!=='').map(n=>{const key=n.dataset.kishaEmo,orig=r.emotions.find(x=>x.key===key),val=Number(n.value);if(!Number.isInteger(val)||val<0||val>100)throw Error('Cada intensidad debe ser un número entero de 0 a 100.');return {key,value:val,evidence:orig?.added?null:orig?.evidence,edited:!!orig?.added||orig?.value!==val};}):[];
  const sel=new Set([...form.querySelectorAll('[name=moment]:checked')].map(x=>Number(x.value)));
  return {...r,title:form.elements.title.value,summary:form.elements.summary.value,moments:r.moments.filter((_,k)=>sel.has(k)),emotions,observation:form.elements.keep_observation?.checked?r.observation:null};}
 function bindReview(){const form=document.getElementById('kisha-review-form');if(!form)return;
  form.oninput=ev=>{if(ev.target.matches('[data-kisha-emo]'))ev.target.closest('li')?.querySelector('.kc-bar')?.style.setProperty('--v',Math.max(0,Math.min(100,Number(ev.target.value)||0)));if(ev.target.name==='title'||ev.target.name==='summary'){session.review[ev.target.name]=ev.target.value;persist();}};
  const addSel=document.getElementById('kisha-add-emo');if(addSel)addSel.onchange=()=>{if(!addSel.value)return;session.review.title=form.elements.title.value;session.review.summary=form.elements.summary.value;session.review.emotions.push({key:addSel.value,value:50,added:true});persist();App.render();};
  form.onsubmit=ev=>{ev.preventDefault();save(form);};}
 function save(form){if(saving||!session)return;const err=document.getElementById('kisha-review-err');
  // Idempotency: one entry per session id; a double tap or a retry never duplicates.
  const already=K().existing(rows(),session.id);if(already)return finishSaved(already.id,true);
  saving=true;const btn=document.getElementById('kisha-save');if(btn)btn.disabled=true;
  try{const entry=K().toEntry(readReview(form),{session,keepTranscript:form.elements.keep_transcript.checked});
   let id=entry.id;Store.save(s=>{const dup=K().existing(s.journal,session.id);if(dup){id=dup.id;return;}s.journal.push(entry);});finishSaved(id,false);}
  catch(e2){if(err)err.textContent=e2.message;if(btn)btn.disabled=false;}finally{saving=false;}}
 function syncLabel(){if(!cloud())return 'en este dispositivo (Modo local)';if(navigator.onLine===false)return 'sin conexión: se sincronizará al reconectar';const s=window.AccountUI?.sync?.();if(!s)return 'pendiente de sincronizar';return s.pending?.()?'sincronizando con tu cuenta…':'sincronizado con tu cuenta';}
 function finishSaved(id,dupe){session.saved=true;clearDraft();session=null;machine.go('idle');machine.go('resting');
  App.toast(dupe?'Esta conversación ya estaba guardada.':'Guardada · '+syncLabel(),'success');location.hash='mascota/'+id;}
 function discard(fromDialog){abort();voice?.stopRecording();voice?.stopPlayback();clearTimeout(closeTimer);session=null;clearDraft();if(machine){machine.go('idle');machine.go('resting');}if(!fromDialog)App.render();App.toast('Conversación descartada. No se guardó nada.');}
 function bindDetail(){const id=UI.id,tf=document.getElementById('kisha-title-form');if(tf)tf.onsubmit=ev=>{ev.preventDefault();const t=tf.elements.title.value.trim().slice(0,120);if(!t)return App.toast('El título no puede quedar vacío.','error');Store.save(s=>{const r=s.journal.find(x=>x.id===id);r.title=t;r.updated_at=new Date().toISOString();});App.toast('Título actualizado.');App.render();};
  const ef=document.getElementById('kisha-emo-form');if(!ef)return;ef.oninput=ev=>{if(ev.target.matches('[data-kisha-emo]'))ev.target.closest('li')?.querySelector('.kc-bar')?.style.setProperty('--v',Math.max(0,Math.min(100,Number(ev.target.value)||0)));};
  ef.onsubmit=ev=>{ev.preventDefault();try{const vals=[...ef.querySelectorAll('[data-kisha-emo]')].map(n=>({key:n.dataset.kishaEmo,v:Number(n.value)}));for(const x of vals)if(!Number.isInteger(x.v)||x.v<0||x.v>100)throw Error('Cada intensidad debe ser un entero de 0 a 100.');
   Store.save(s=>{const r=s.journal.find(x=>x.id===id);for(const x of vals){const m=r.emotions.find(y=>y.key===x.key);if(m&&m.intensity!==x.v){m.intensity=x.v;m.basis='reported';m.confidence=1;}}r.updated_at=new Date().toISOString();});App.toast('Intensidades actualizadas.');App.render();}catch(e2){App.toast(e2.message,'error');}};}
 function bindFilters(){const f=UIK(),q=document.getElementById('kisha-q'),a=document.getElementById('kisha-from'),b=document.getElementById('kisha-to');if(!q)return;
  const upd=()=>{f.q=q.value;f.from=a.value;f.to=b.value;const kisha=rows().filter(r=>K().isKisha(r)&&!r.deleted_at);document.getElementById('kisha-list').innerHTML=listHTML(K().groupByDay(K().filter(kisha,f)),kisha.length);App.icons();};
  q.oninput=upd;a.onchange=upd;b.onchange=upd;}
 /* ---------- actions ---------- */
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-kisha]');if(!b)return;const a=b.dataset.kisha;
  try{if(a==='start')start();else if(a==='resume')resume();
   else if(a==='discard-draft')App.confirmAction('Descartar conversación','Se borrará la conversación sin terminar de este dispositivo. No se guardará nada.',()=>clearDraft(),'Descartar');
   else if(a==='mic')mic();else if(a==='pause')pause();
   else if(a==='stop-audio'){abort();voice?.stopPlayback();if(['speaking','blocked','thinking'].includes(machine?.phase))machine.go('idle');}
   else if(a==='mute'){setPref({muted:!pref().muted});if(pref().muted){abort();voice?.stopPlayback();if(['speaking','blocked'].includes(machine?.phase))machine.go('idle');}const c=document.querySelector('.kisha-controls');if(c){c.outerHTML=controlsHTML();App.icons();}}
   else if(a==='replay'){abort();ctl=new AbortController();voice?.replay(ctl.signal).then(r=>{if(r==='blocked')machine.go('blocked');else if(['speaking','blocked'].includes(machine.phase))machine.go('idle');syncReplay();});}
   else if(a==='retry'){b.closest('li')?.remove();reply();}
   else if(a==='finish')finish();
   else if(a==='back'){session.review=null;machine.go('idle');persist();App.render();}
   else if(a==='discard')App.confirmAction('Descartar conversación','No se guardará nada de esta conversación.',()=>discard(true),'Descartar');
   else if(a==='tab'){UIK().tab=b.dataset.tab;App.render();}
   else if(a==='range'){UIK().range=Number(b.dataset.n);App.render();}
   else if(a==='animate'){setPref({animate:!pref().animate});App.render();}
   else if(a==='delete'){const id=b.dataset.id;App.confirmAction('Eliminar conversación','Se eliminará de tu historial y de tus tendencias.',()=>{Store.remove('journal',id);setTimeout(()=>{location.hash='mascota';},0);},'Eliminar');}
  }catch(err){App.toast(err.message,'error');}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden||!session)return;voice?.stopRecording();if(machine?.phase==='speaking'){voice?.stopPlayback();machine.go(voice?.hasClip()?'blocked':'idle');}persist();});
 addEventListener('pagehide',()=>persist());
 /** Account switch / sign-out: drop everything in memory (drafts stay under the previous owner's key). */
 function reset(){abort();voice?.dispose();voice=null;character?.destroy();character=null;mounted=null;session=null;machine=null;clearTimeout(closeTimer);UI.kisha=undefined;}
 return Object.freeze({render,afterRender,reset,stats:()=>({session:!!session,phase:machine?.phase||null,pose:character?.pose||null,voice:voice?.stats()||null,messages:session?.messages.length||0,review:!!session?.review})});
})();
