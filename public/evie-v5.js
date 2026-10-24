'use strict';
/* EVIE v5 client controller: functional wiring only. Visuals are deliberately minimal
   (Sonnet owns the redesign). Everything goes through EvieAccounts.request (session + X-Evie-User).
   handle(text) → answer object {text, spoken} | null (null = not a v5 command, fall through). */
window.EvieV5=(()=>{
 const C=()=>window.EvieV5Core;
 const api=(path,opts)=>EvieAccounts.request(path,opts);
 const me=()=>window.EvieAccounts?.current?.()||null;
 const isGuest=()=>me()?.role==='guest';
 const enabled=()=>!!(window.EvieAccounts?.config?.()?.accountsEnabled&&me());
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const zone=()=>{try{return Store.get()?.profile?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Mexico_City';}catch{return 'America/Mexico_City';}};
 const today=()=>{try{return Domain.today();}catch{return new Date().toISOString().slice(0,10);}};
 const opId=()=>'op-'+crypto.randomUUID();
 const ans=(text,extra={})=>({text,spoken:extra.spoken||text,sources:[],...extra});

 /* ---------- lifecycle events (no private content) + bounded thinking cue ---------- */
 let cueTimer=null,cueStart=0,cueStage=null;
 function cueStop(){clearTimeout(cueTimer);cueTimer=null;cueStage=null;}
 function cueTick(){const p=C().cuePlan({stage:cueStage,elapsedMs:Date.now()-cueStart,muted:!!window.EvieAssistant?.pref?.().muted||localStorage.getItem('evie-thinking-cue')==='off',reduced:matchMedia?.('(prefers-reduced-motion: reduce)').matches});if(!p.play){cueStop();return;}window.EvieSounds?.play('process');cueTimer=setTimeout(cueTick,p.next);}
 function onEvent(ev){document.documentElement.dataset.evieStage=ev.stage;document.dispatchEvent(new CustomEvent('evie:lifecycle',{detail:ev}));
  if(['thinking','searching','tool_running'].includes(ev.stage)){if(!cueTimer){cueStart=Date.now();cueStage=ev.stage;cueTimer=setTimeout(cueTick,900);}else cueStage=ev.stage;}else cueStop();}
 const lifecycle=()=>C().lifecycle(onEvent);

 /* ---------- tasks cache (mirrors server evie_tasks; read by Pendientes, never persisted in Store) ---------- */
 let tasks=null,tasksAt=0,tasksOwner=null;
 async function refreshTasks(force=false){if(!enabled())return [];const o=me().id;if(!force&&tasks&&tasksOwner===o&&Date.now()-tasksAt<60000)return tasks;try{const r=await api('tasks?status=open');tasks=Array.isArray(r.tasks)?r.tasks:[];tasksAt=Date.now();tasksOwner=o;}catch{tasks=tasks&&tasksOwner===o?tasks:[];}return tasks;}
 const cachedTasks=()=>tasks&&tasksOwner===me()?.id?tasks:null;
 function findClient(name){const q=C().norm(name);const list=(Store.get()?.clients||[]).filter(c=>!c.deleted_at);const exact=list.filter(c=>C().norm(c.title)===q);if(exact.length)return exact;return list.filter(c=>C().norm(c.title).includes(q)||q.includes(C().norm(c.title)));}
 const clientName=id=>(Store.get()?.clients||[]).find(c=>c.id===id)?.title||'';

 /* ---------- scenes: client-side step execution ---------- */
 let sceneCount=null;
 async function sceneTotal(){if(isGuest()||!enabled())return 0;if(sceneCount===null){try{sceneCount=(await api('scenes')).scenes.length;}catch{sceneCount=0;}}return sceneCount;}
 async function runStep(st){try{switch(st.action){
   case 'set_work_mode':{const r=window.EvieModes?.set(st.mode);return r?.ok?{ok:true}:{ok:false,error:'modo no disponible'};}
   case 'set_theme':{const t=st.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):st.theme;Store.save(s=>{s.preferences.theme=t;});App.render();return {ok:true};}
   case 'navigate':{location.hash=st.section;return {ok:true};}
   case 'open_shortcut':{const r=Store.list('automations').find(x=>x.id===st.shortcut_id);if(!r)return {ok:false,error:'atajo no encontrado'};const o=await window.EvieAutomationsView?.openShortcut(r);return o?.ok?{ok:true}:{ok:false,error:o?.error||'no se abrió'};}
   case 'open_client':{if(!(Store.get()?.clients||[]).some(c=>c.id===st.client_id&&!c.deleted_at))return {ok:false,error:'cliente no encontrado'};location.hash='soma/'+st.client_id;return {ok:true};}
   case 'show_card':{const r=window.EvieHUD?.open(st.card);return r&&r.ok!==false?{ok:true}:{ok:false,error:r?.error||'tarjeta no disponible'};}
   case 'close_card':{const r=window.EvieHUD?.close(st.card);return r?.ok?{ok:true}:{ok:false,error:r?.error||'no había tarjeta'};}
   default:return null;}}catch(x){return {ok:false,error:String(x?.message||'falló').slice(0,80)};}}
 async function runScene(scene){const client_results=[];for(const [i,st] of scene.steps.entries()){const r=await runStep(st);if(r)client_results.push({step:i,...r});}
  const r=await api('scenes/'+scene.id+'/run',{method:'POST',body:{run_id:crypto.randomUUID(),client_results}});return r;}

 /* ---------- route ---------- */
 let lastRoute=null;
 const here=()=>new Promise(res=>{if(!navigator.geolocation)return res(null);navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}),()=>res(null),{enableHighAccuracy:false,timeout:8000,maximumAge:120000});});
 async function route(text,extra={}){const body={text,...extra};let r=await api('map/route-query',{method:'POST',body});
  if(r.status==='needs_location'){const h=await here();if(h){body.here=h;r=await api('map/route-query',{method:'POST',body});}}
  lastRoute={text,body,result:r};
  if(r.status==='ambiguous'){openPanel('route');}
  /* The route is answered by voice + shown in the panel; the existing map card does not yet draw a server trip (Sonnet/next step). */
  return ans(r.say+(r.traffic_note&&!/tr[aá]fico/i.test(r.say||'')?' '+r.traffic_note:''));}
 async function chooseRoute(which,idx){if(!lastRoute)return;const c=lastRoute.result.candidates?.[idx];if(!c)return;const body={...lastRoute.body,choice:{...(lastRoute.body.choice||{}),[which]:{lat:c.lat,lon:c.lon}}};const r=await api('map/route-query',{method:'POST',body});lastRoute={...lastRoute,body,result:r};renderPanel();window.EvieAssistant?.say?.(r.say);}

 /* ---------- plan ---------- */
 let plan=null;
 function fixedFor(day){const out=[];try{for(const r of Store.list('agendaItems')){if(r.kind!=='event'||['cancelled','archived'].includes(r.status)||r.all_day)continue;if(Agenda.dateOf(r)!==day)continue;const s=(Agenda.localValue?.(r.start_at||r.due_at)||'').slice(11,16);const e=(Agenda.localValue?.(r.end_at)||'').slice(11,16);if(s)out.push({title:r.title,start:s,end:e||null});}}catch{}return out;}
 async function propose(text,day){const d=day==='tomorrow'?EviePendientes.addDays(today(),1):today();await refreshTasks();
  let pend=[];try{pend=EviePendientes.build(Store.get(),{today:today()}).filter(x=>!x.date||x.date<=d).slice(0,30).map(x=>({key:x.key,title:x.title,severity:x.severity,kind:x.kind,time:x.date===d?x.time:null}));}catch{}
  const st=Store.get()?.preferences||{};const hours=st.workHours&&st.workHours.start?st.workHours:undefined;
  plan=await api('plan/propose',{method:'POST',body:{text:String(text||'').replace(/^[^:]*:/,m=>/prepara|organiza|planea|reorganiza/i.test(m)?'':m),day,timezone:zone(),fixed:fixedFor(d),pendientes:pend,...(hours?{hours}:{})}});
  plan.keep=new Set(plan.slots.filter(s=>s.kind!=='fixed').map(s=>s.item_id));openPanel('plan');return ans(plan.say);}
 async function applyPlan(){if(!plan)return;const r=await api('plan/'+plan.plan_id+'/apply',{method:'POST',body:{approved:true,items:[...plan.keep]}});plan.applied=r;await refreshTasks(true);renderPanel();App.render?.();window.EvieAssistant?.say?.(r.say);return r;}
 async function discardPlan(){if(!plan)return;await api('plan/'+plan.plan_id+'/discard',{method:'POST',body:{}}).catch(()=>{});plan=null;renderPanel();}

 /* ---------- AI tier ---------- */
 let tierInfo=null;
 async function loadTier(){if(!enabled())return null;try{tierInfo=await api('ai/tier');}catch{}return tierInfo;}
 async function setTier(id){const r=await api('ai/tier',{method:'PUT',body:{tier:id}});tierInfo={...(tierInfo||{}),tier:r.tier||id};renderPanel();return r;}
 let onceTier=null;// "solo para esta pregunta" chosen in the UI: sent once as body.tier then cleared
 const takeOnceTier=()=>{const t=onceTier;onceTier=null;return t;};

 /* ---------- tasks by voice ---------- */
 async function taskCreate(i){const m=findClient(i.client);if(!m.length)return ans(`No encontré al cliente «${i.client}» en SOMA. ¿Cómo se llama exactamente?`);if(m.length>1)return ans(`Tengo varios clientes parecidos: ${m.slice(0,3).map(c=>c.title).join(', ')}. ¿Para cuál es la tarea?`);
  const due=/\bmañana\b/i.test(i.title)?EviePendientes.addDays(today(),1):/\bhoy\b/i.test(i.title)?today():null;const title=i.title.replace(/\s*\b(?:para )?(?:hoy|mañana)\b\s*/gi,' ').trim();
  const r=await api('tasks',{method:'POST',body:{title,client_id:m[0].id,due_date:due,op_id:opId(),source:'voice'}});await refreshTasks(true);App.render?.();
  return ans(`Anoté la tarea «${r.task.title}» para ${m[0].title}${due?(due===today()?' para hoy':' para mañana'):''}.`);}
 async function taskFind(query,status){const r=await api('tasks/find',{method:'POST',body:{query,status}});return r;}
 async function taskComplete(i,reopen=false){const r=await taskFind(i.query,reopen?'done':'open');if(!r.matches.length)return ans(`No encontré una tarea ${reopen?'completada ':''}que coincida con «${i.query}».`);if(!r.unique)return ans(`Encontré varias: ${r.matches.slice(0,3).map(t=>'«'+t.title+'»').join(', ')}. ¿Cuál?`);
  await api('tasks/'+r.unique.id+(reopen?'/reopen':'/complete'),{method:'POST',body:{}});await refreshTasks(true);App.render?.();return ans(reopen?`Reabrí «${r.unique.title}».`:`Hecho: «${r.unique.title}» quedó completada.`);}
 async function taskList(i){const all=await refreshTasks(true);let list=all;let who='';if(i.client){const m=findClient(i.client);if(!m.length)return ans(`No encontré al cliente «${i.client}».`);list=all.filter(t=>t.client_id===m[0].id);who=' de '+m[0].title;}
  if(!list.length)return ans(`No tienes tareas abiertas${who}.`);return ans(`Tienes ${list.length} tarea${list.length>1?'s':''} abierta${list.length>1?'s':''}${who}: ${list.slice(0,4).map(t=>t.title+(t.due_date?(t.due_date===today()?' (hoy)':t.due_date<today()?' (vencida)':''):'')).join(', ')}${list.length>4?' y más':''}.`);}

 /* ---------- memory v2 ---------- */
 const priv=()=>!!window.EvieMemory?.isPrivate?.();
 let memList=null;
 async function memorySearch(q){const r=await api('memory-v2/search',{method:'POST',body:{question:q,private:priv()}});return ans(r.say);}
 async function memoryCorrect(text){if(priv())return ans('Estás en modo incógnito: no cambio tu memoria.');const r=await api('memory-v2/search',{method:'POST',body:{question:text}});const top=r.items?.[0];
  if(!top||r.uncertain)return ans('No sé con certeza qué recuerdo corregir. Ábrelo en Memoria y edítalo ahí.');const c=await api('memory-v2/items/'+top.id+'/correct',{method:'POST',body:{text}});memList=null;return ans(`Corregido. Antes tenía «${c.previous}»; ahora «${c.text}».`);}

 /* ---------- handle: called by EvieAssistant.ask before tryLocal ---------- */
 async function handle(text){if(!C()||!enabled())return null;const i=C().intent(text);if(!i)return null;
  try{switch(i.type){
   case 'surface':return null;// section/card/close stay with the existing local router (the core only classifies)
   case 'plan':return await propose(i.text,i.day);
   case 'plan_next':{const r=await api('plan/next?tz='+encodeURIComponent(zone()));return ans(r.say);}
   case 'route':return await route(i.text);
   case 'tier':return null;// spoken tier commands are handled server-side in /ai/chat (persistent vs once)
   case 'task_create':return await taskCreate(i);
   case 'task_complete':return await taskComplete(i);
   case 'task_reopen':return await taskComplete(i,true);
   case 'task_list':return await taskList(i);
   case 'memory_search':return await memorySearch(i.question);
   case 'memory_correct':return await memoryCorrect(i.text);
   case 'scene_candidate':{if(isGuest()||!(await sceneTotal()))return null;const r=await api('scenes/resolve',{method:'POST',body:{text:i.text}});if(r.status==='ambiguous')return ans(r.say);if(r.status!=='match')return null;const run=await runScene(r.scene);return ans(run.say||('Escena «'+r.scene.name+'» lista.'));}
  }}catch(x){if(x.name==='AbortError')throw x;return ans(x.message||'No pude completar eso.');}
  return null;}

 /* ---------- chat helpers for EvieAssistant ---------- */
 let lastMeta=null;
 function chatExtras(){const t=takeOnceTier();return t?{tier:t}:{};}
 function chatMeta(r){if(!r||!r.tier)return;lastMeta={tier:r.tier,fallback:r.tier_fallback||null,suggest:r.suggest_tier||null,changed:r.tier_changed||null,request_id:r.request_id};if(r.tier_changed)tierInfo={...(tierInfo||{}),tier:r.tier_changed};document.dispatchEvent(new CustomEvent('evie:tier',{detail:lastMeta}));}
 function metaNote(){if(!lastMeta)return '';if(lastMeta.fallback)return `Respondí con ${lastMeta.tier.label} porque ${({timeout:'el nivel pedido tardó demasiado',account_budget:'se alcanzó tu presupuesto diario de IA',daily_limit:'se alcanzó el límite diario de Profundo',guest:'Profundo no está disponible para invitados'})[lastMeta.fallback.reason]||'el nivel pedido no estaba disponible'}.`;if(lastMeta.suggest)return 'Sugerencia: esta pregunta podría ir mejor en nivel Profundo. Dime «usa profundo solo para esta pregunta».';return '';}
 function reportMetrics(marks,tier){if(!enabled())return;api('ai/metrics',{method:'POST',body:{marks,...(tier?{tier}:{})}}).catch(()=>{});}

 /* ---------- minimal panel (functional; Sonnet restyles) ---------- */
 let panel=null,tab='tier';
 const TABS=[['tier','Nivel de IA'],['plan','Mi día'],['tasks','Tareas'],['scenes','Escenas'],['memory','Memoria'],['route','Ruta']];
 function openPanel(which){if(which)tab=which;if(!panel){panel=document.createElement('section');panel.id='v5-panel';panel.className='v5-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Herramientas de Ivi');document.body.append(panel);
   panel.addEventListener('click',onClick);panel.addEventListener('change',onChange);panel.addEventListener('submit',onSubmit);panel.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel();});}
  panel.hidden=false;renderPanel();panel.querySelector('[aria-selected=true]')?.focus({preventScroll:true});}
 function closePanel(){if(panel)panel.hidden=true;}
 async function renderPanel(){if(!panel||panel.hidden)return;const tabs=TABS.filter(([k])=>!(k==='scenes'&&isGuest()));
  let body='';try{body=await section(tab);}catch(x){body=`<p class="v5-error" role="alert">${esc(x.message||'No se pudo cargar.')}</p>`;}
  panel.innerHTML=`<header class="v5-head"><strong>Ivi · herramientas</strong>${isGuest()?guestBanner():''}<button type="button" class="button" data-v5-close aria-label="Cerrar">×</button></header><nav class="v5-tabs" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" aria-selected="${k===tab}" data-v5-tab="${k}">${l}</button>`).join('')}</nav><div class="v5-body" role="tabpanel">${body}</div>`;}
 function guestBanner(){const u=me(),h=u?.expires_at?Math.max(0,Math.round((u.expires_at-Date.now())/3600000)):null;return `<span class="v5-guest" role="status">Invitado${u?.display_name?' · '+esc(u.display_name):''}${h!==null?' · quedan ~'+h+' h':''}</span>`;}
 async function section(k){
  if(k==='tier'){const t=tierInfo||await loadTier();if(!t)return '<p>No disponible sin sesión.</p>';return `<fieldset class="v5-tier"><legend>Nivel de razonamiento de Ivi <small>(distinto del modo de trabajo «Enfoque»)</small></legend>${t.tiers.map(x=>`<label><input type="radio" name="v5-tier" data-v5-tier="${x.id}" value="${x.id}" ${t.tier===x.id?'checked':''} ${x.available?'':'disabled'}> <b>${esc(x.label)}</b> — ${esc(x.summary||'')}</label>`).join('')}</fieldset><label><input type="checkbox" data-v5-once ${onceTier?'checked':''}> Usar <b>Profundo</b> solo para mi siguiente pregunta</label><p class="v5-note">${esc(metaNote())}</p>`;}
  if(k==='plan'){if(!plan)return `<form data-v5-form="plan"><label>¿Qué quieres hacer hoy?<textarea name="text" rows="4" placeholder="Llamar a Intensity 30 min, gimnasio a las 7, revisar propuesta…"></textarea></label><label><input type="checkbox" name="tomorrow"> Preparar mañana</label><button class="button primary">Proponer mi día</button><small>Combino tus tareas, Pendientes y eventos fijos de tu Agenda. No guardo nada hasta que apruebes. No escribo en Google Calendar.</small></form>`;
   const rows=plan.slots.map(s=>s.kind==='fixed'?`<li class="v5-fixed">${esc(s.start)}–${esc(s.end||'')} · ${esc(s.title)} <small>(fijo)</small></li>`:`<li><label><input type="checkbox" data-v5-keep="${esc(s.item_id)}" ${plan.keep.has(s.item_id)?'checked':''} ${plan.applied?'disabled':''}> ${esc(s.start)}–${esc(s.end)} · ${esc(s.title)} ${s.estimated?'<small>(duración estimada)</small>':''} <small>${esc(s.source||s.kind||'')}</small></label>${plan.applied?statusOf(s.item_id):''}</li>`).join('');
   const warn=(plan.warnings||[]).map(w=>`<li>${esc(w.message||w.code)}</li>`).join('');
   return `<p>${esc(plan.day)} · horario ${esc(plan.hours.start)}–${esc(plan.hours.end)} (${esc(plan.timezone)})</p><ol class="v5-slots">${rows}</ol>${warn?`<ul class="v5-warn" role="note">${warn}</ul>`:''}${plan.applied?`<p role="status">${esc(plan.applied.say)}</p><button type="button" class="button" data-v5-plan="new">Nuevo plan</button>`:`<button type="button" class="button primary" data-v5-plan="apply">Aprobar y guardar</button> <button type="button" class="button" data-v5-plan="discard">Descartar</button>`}`;}
  if(k==='tasks'){const list=await refreshTasks(true);return `<form data-v5-form="task"><label>Nueva tarea<input name="title" maxlength="200" required></label><label>Cliente (opcional)<select name="client_id"><option value="">—</option>${(Store.get()?.clients||[]).filter(c=>!c.deleted_at).map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></label><label>Fecha<input type="date" name="due_date"></label><button class="button primary">Agregar</button></form><ul class="v5-tasks">${list.map(t=>`<li><label><input type="checkbox" data-v5-done="${esc(t.id)}"> ${esc(t.title)}</label> <small>${esc(clientName(t.client_id))}${t.due_date?' · '+esc(t.due_date)+(t.due_time?' '+esc(t.due_time):''):''}</small> <button type="button" class="button" data-v5-del="${esc(t.id)}" aria-label="Eliminar ${esc(t.title)}">Eliminar</button></li>`).join('')||'<li>Sin tareas abiertas.</li>'}</ul>`;}
  if(k==='scenes'){if(isGuest())return '<p>Las escenas no están disponibles para invitados.</p>';const r=await api('scenes');sceneCount=r.scenes.length;
   return `<ul class="v5-scenes">${r.scenes.map(s=>`<li><b>${esc(s.name)}</b> · «${s.triggers.map(esc).join('», «')}» · ${s.steps.length} paso${s.steps.length>1?'s':''} <button type="button" class="button" data-v5-run="${esc(s.id)}">Probar</button> <button type="button" class="button" data-v5-sdel="${esc(s.id)}">Eliminar</button></li>`).join('')||'<li>Aún no tienes escenas.</li>'}</ul>
   <form data-v5-form="scene"><label>Nombre<input name="name" maxlength="60" required placeholder="Modo SOMA"></label><label>Frase(s) para activarla, separadas por coma<input name="triggers" maxlength="200" required placeholder="modo soma"></label><label>Pasos (uno por línea: acción valor)<textarea name="steps" rows="4" placeholder="navigate negocios&#10;set_ai_tier enfoque&#10;show_card pendientes"></textarea></label><small>Acciones: ${r.actions.map(a=>esc(a.action)+' ('+esc(a.label)+')').join(', ')}. Máximo ${r.limits.scenes} escenas y ${r.limits.steps} pasos.</small><button class="button primary">Guardar escena</button></form>`;}
  if(k==='memory'){const r=memList||(memList=await api('memory-v2'));return `<p>${r.settings?.enabled===false?'La memoria está desactivada.':''} ${priv()?'<b>Modo incógnito activo:</b> no guardo ni consulto.':''}</p><p><button type="button" class="button" data-v5-export>Exportar (JSON)</button></p><ul class="v5-mem">${r.items.map(m=>`<li data-id="${esc(m.id)}"><small>${esc((r.types.find(t=>t.id===m.type)||{}).label||m.type)}${m.project?' · '+esc(m.project):''}${m.confidence<1?' · confianza '+Math.round(m.confidence*100)+'%':''}</small><br>${esc(m.text)} <button type="button" class="button" data-v5-medit="${esc(m.id)}">Corregir</button></li>`).join('')||'<li>Sin recuerdos.</li>'}</ul><form data-v5-form="memory"><label>Recordar<input name="text" maxlength="500" required></label><label>Tipo<select name="type">${r.types.map(t=>`<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('')}</select></label><button class="button primary">Guardar</button></form><small>Para borrar, usa Configuración → Memoria (borrado existente) o dime «olvida …».</small>`;}
  if(k==='route'){const r=lastRoute?.result;let h=`<form data-v5-form="route"><label>Pregunta<input name="text" maxlength="200" required placeholder="¿Cuánto tardo de aquí a Plaza Galerías en coche?"></label><button class="button primary">Calcular</button></form>`;if(r){h+=`<p role="status">${esc(r.say||r.error||'')}</p>`;if(r.status==='ambiguous')h+=`<ul>${r.candidates.map((c,i)=>`<li><button type="button" class="button" data-v5-pick="${esc(r.which)}:${i}">${esc(c.label||c.name)}</button></li>`).join('')}</ul>`;if(r.status==='ok')h+=`<p>${esc(r.distance_km)} km · ${esc(Math.round(r.duration_min))} min · ${esc(r.mode_label||r.mode)}${r.traffic_note?' · '+esc(r.traffic_note):''}</p><small>${esc(r.provider||'')}</small>`;}return h;}
  return '';}
 const statusOf=id=>{const x=plan?.applied?.results?.find(r=>r.item_id===id);return x?` <small class="v5-st v5-${esc(x.status)}">${esc({created:'creada',scheduled:'programada',time_block:'bloque',skipped:'omitida',failed:'falló'}[x.status]||x.status)}</small>`:'';};
 async function onClick(e){const t=e.target.closest('button,[data-v5-tab]');if(!t)return;const d=t.dataset;try{
  if(d.v5Close!==undefined)return closePanel();
  if(d.v5Tab){tab=d.v5Tab;return renderPanel();}
  if(d.v5Plan==='apply')return await applyPlan();
  if(d.v5Plan==='discard')return await discardPlan();
  if(d.v5Plan==='new'){plan=null;return renderPanel();}
  if(d.v5Del){await api('tasks/'+d.v5Del,{method:'DELETE'});await refreshTasks(true);App.render?.();return renderPanel();}
  if(d.v5Run){const s=(await api('scenes')).scenes.find(x=>x.id===d.v5Run);if(s){const r=await runScene(s);App.toast?.(r.say||'Escena ejecutada.',r.failed?'error':'success');}return;}
  if(d.v5Sdel){await api('scenes/'+d.v5Sdel,{method:'DELETE'});sceneCount=null;return renderPanel();}
  if(d.v5Pick){const [w,i]=d.v5Pick.split(':');return await chooseRoute(w,Number(i));}
  if(d.v5Export!==undefined){const r=await api('memory-v2/export');App.download?.('evie-memoria.json',JSON.stringify(r,null,2),'application/json');return;}
  if(d.v5Medit){const cur=memList?.items?.find(m=>m.id===d.v5Medit);const text=prompt('Corrige el recuerdo:',cur?.text||'');if(text&&text.trim()){await api('memory-v2/items/'+d.v5Medit+'/correct',{method:'POST',body:{text:text.trim()}});memList=null;renderPanel();}return;}
 }catch(x){App.toast?.(x.message||'No se pudo.','error');}}
 async function onChange(e){const t=e.target,d=t.dataset;try{
  if(d.v5Tier)return await setTier(d.v5Tier);
  if(d.v5Once!==undefined){onceTier=t.checked?'profundo':null;return;}
  if(d.v5Keep){t.checked?plan.keep.add(d.v5Keep):plan.keep.delete(d.v5Keep);return;}
  if(d.v5Done){await api('tasks/'+d.v5Done+'/complete',{method:'POST',body:{}});await refreshTasks(true);App.render?.();return renderPanel();}
 }catch(x){App.toast?.(x.message||'No se pudo.','error');}}
 async function onSubmit(e){const f=e.target,k=f.dataset.v5Form;if(!k)return;e.preventDefault();const b=f.querySelector('button.primary');if(b)b.disabled=true;try{
  if(k==='plan'){await propose(f.elements.text.value,f.elements.tomorrow.checked?'tomorrow':'today');}
  else if(k==='task'){await api('tasks',{method:'POST',body:{title:f.elements.title.value.trim(),client_id:f.elements.client_id.value||null,due_date:f.elements.due_date.value||null,op_id:opId()}});await refreshTasks(true);App.render?.();renderPanel();}
  else if(k==='scene'){const steps=f.elements.steps.value.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const [action,...v]=l.split(/\s+/);const PARAM={set_work_mode:'mode',set_ai_tier:'tier',set_theme:'theme',navigate:'section',open_shortcut:'shortcut_id',open_client:'client_id',show_card:'card',close_card:'card'};return {action,[PARAM[action]||'value']:v.join(' ')};});
   await api('scenes',{method:'POST',body:{name:f.elements.name.value.trim(),triggers:f.elements.triggers.value.split(',').map(x=>x.trim()).filter(Boolean),steps}});sceneCount=null;renderPanel();}
  else if(k==='memory'){const r=await api('memory-v2/items',{method:'POST',body:{text:f.elements.text.value.trim(),type:f.elements.type.value,private:priv()}});App.toast?.(r.created?'Guardado.':(r.error||r.say||'No se guardó.'),r.created?'success':'error');memList=null;renderPanel();}
  else if(k==='route'){await route(f.elements.text.value.trim());renderPanel();}
 }catch(x){App.toast?.(x.message||'No se pudo.','error');}finally{if(b)b.disabled=false;}}

 /* account switch: drop every cache (tenant isolation on the client too) */
 window.EvieAccounts?.subscribe?.(()=>{tasks=null;tasksOwner=null;plan=null;tierInfo=null;memList=null;sceneCount=null;lastRoute=null;lastMeta=null;onceTier=null;closePanel();});
 document.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&(e.key==='I'||e.key==='i')&&enabled()){e.preventDefault();panel&&!panel.hidden?closePanel():openPanel();}});
 setTimeout(()=>{if(enabled())refreshTasks().then(l=>{if(l.length&&window.FormSafety&&!FormSafety.busy()&&!document.querySelector('#account-gate'))App.render?.();});},1500);

 return Object.freeze({handle,lifecycle,refreshTasks,cachedTasks,runScene,runStep,route,propose,applyPlan,discardPlan,setTier,loadTier,chatExtras,chatMeta,metaNote,reportMetrics,openPanel,closePanel,isGuest});
})();
