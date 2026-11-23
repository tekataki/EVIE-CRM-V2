'use strict';
/* EVIE v10 · Ivi core: persona dials, modes on the home screen, the «sistemas» status bar and protocols.
   - Modes (EvieModes): Asistente · Ventas · Gym · Estudio · Noche (+ Enfoque / Negocio / Cierre). The server gets a
     persona mode (asistente|ventas|gym|estudio|noche) that nudges priorities; the home re-orders its systems and
     suggestions by mode.
   - Persona dials (preferences.iviPersona): formality, humor, verbosity (+ voice on/off = preferences.evie.muted).
   - Protocols = scripted multi-step routines: briefing (matutino), debrief (cierre), visita (preparar visita).
   Everything here reads LOCAL data only; the model gathers details through its own tools. */
window.IviCore=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const today=()=>Domain.today();
 const MODE_OF={normal:'asistente',ventas:'ventas',negocio:'ventas',gym:'gym',estudio:'estudio',enfoque:'estudio',noche:'noche',cierre:'noche'};
 const MAIN=[['normal','Asistente','sparkles'],['ventas','Ventas','handshake'],['gym','Gym','dumbbell'],['estudio','Estudio','graduation-cap'],['noche','Noche','moon-star']];
 const DIALS={formality:[['casual','Cercano'],['neutral','Profesional'],['formal','Formal (usted)']],humor:[['off','Sin humor'],['light','Ligero'],['playful','Con chispa']],verbosity:[['short','Muy breve'],['normal','Normal'],['detailed','Detallado']]};
 const persona=()=>({formality:'casual',humor:'light',verbosity:'normal',...(P().iviPersona||{})});
 const evieMode=()=>window.EvieModes?.current?.()||'normal';
 /** Persona mode sent to the server with every voice/chat request. */
 const personaMode=()=>MODE_OF[evieMode()]||'asistente';

 /* ---------------- systems (local, cheap) ---------------- */
 function systems(){const st=Store.get()||{},t=today();
  const rec=window.EvieFisico?.recovery?EvieFisico.recovery():{},vals=Object.values(rec),ready=vals.filter(r=>r.state==='green').length,resting=vals.filter(r=>r.state==='red'||r.state==='yellow').length;
  const closed=/ganad|perdid|cerrad|cancel/i;const follow=(st.clients||[]).filter(c=>!c.deleted_at&&c.nextDate&&c.nextDate<=t&&!closed.test(c.stage||''));
  const items=(st.agendaItems||[]).filter(r=>!r.deleted_at&&!['done','archived'].includes(r.status)&&window.Agenda&&Agenda.occurrence(r,t)&&!Agenda.isDone(r,t));
  const school=items.filter(r=>r.area==='school');
  // v10 · Fase 4: Escuela and Misión feed the bar when their modules exist (fallback: agenda items / a «Misión…» goal).
  const sch=window.EvieSchool?.summary?.()||null;
  const mp=window.EvieMission?.plan?.()||null;
  const mission=mp?{title:'Misión: '+mp.name}:(st.goals||[]).filter(g=>!g.archived&&!g.deleted_at&&g.target>0&&/^misi[oó]n\b/i.test(g.title||'')).sort((a,b)=>b.target-a.target)[0];
  const pct=mp?Math.round(mp.pct):mission?Math.max(0,Math.min(100,Math.round(mission.progress/mission.target*100))):null;
  const schoolSys=sch?{key:'school',icon:'graduation-cap',label:'Escuela',value:String(sch.tasksDue7),hint:sch.nextExam?`examen ${sch.nextExam.days<=0?'hoy':sch.nextExam.days===1?'mañana':'en '+sch.nextExam.days+' días'}`:sch.today?.length?`${sch.today.length} ${sch.today.length===1?'clase':'clases'} hoy`:'sin entregas',tone:sch.overdue||(sch.nextExam&&sch.nextExam.days<=3)?'warn':'good',href:'#escuela'}:null;
  return {
   recovery:{key:'recovery',icon:'activity',label:'Recuperación',value:vals.length?`${ready} listos`:'—',hint:resting?`${resting} descansando`:'todo recuperado',tone:resting>4?'warn':'good',href:'#fisico'},
   followups:{key:'followups',icon:'handshake',label:'Seguimientos',value:String(follow.length),hint:follow.length?follow.slice(0,2).map(c=>c.title||c.name).join(' · '):'al día',tone:follow.length?'warn':'good',href:'#soma'},
   today:{key:'today',icon:'calendar-check',label:'Hoy',value:String(items.length),hint:items.length?'pendientes':'libre',tone:items.length>6?'warn':'good',href:'#agenda'},
   school:schoolSys||{key:'school',icon:'graduation-cap',label:'Escuela',value:String(school.length),hint:school.length?'para hoy':'sin entregas hoy',tone:school.length?'warn':'good',href:'#agenda'},
   mission:{key:'mission',icon:'rocket',label:'Misión',value:pct==null?'—':pct+' %',hint:mp?(mp.done?'cumplida':mp.onTrack?'a tiempo':mp.eta?mp.late+(mp.late===1?' mes':' meses')+' tarde':'sin proyección'):mission?e(mission.title).slice(0,24):'crea tu misión',tone:pct==null?'idle':mp&&!mp.onTrack?'warn':'good',href:'#objetivos'}};}
 const ORDER={asistente:['today','followups','recovery','school','mission'],ventas:['followups','today','mission','recovery','school'],gym:['recovery','today','mission','followups','school'],estudio:['school','today','recovery','followups','mission'],noche:['today','mission','recovery','followups','school']};
 const SUGGEST={
  asistente:[['sunrise','Protocolo matutino','protocol:briefing'],['list-checks','¿Qué tengo hoy?','ask:¿Qué tengo hoy?'],['brain-circuit','¿Qué sabes de mí?','route:chat/memoria']],
  ventas:[['handshake','¿A quién le doy seguimiento hoy?','ask:¿A quién le doy seguimiento hoy en SOMA? Dame el siguiente paso con cada uno.'],['briefcase','Preparar visita','protocol:visita'],['message-square-text','Mensaje de seguimiento','ask:Redáctame un mensaje corto de seguimiento para mi prospecto más atrasado.']],
  gym:[['dumbbell','¿Qué puedo entrenar hoy?','ask:¿Qué puedo entrenar hoy según mi recuperación?'],['activity','Ver recuperación','route:fisico'],['timer','Descanso 90 s','ask:Pon un temporizador de 90 segundos']],
  estudio:[['graduation-cap','¿Qué tareas tengo?','ask:¿Qué tareas o exámenes tengo esta semana?'],['headphones','Explícame un tema','route:chat'],['languages','Frase en inglés','ask:Dame una frase útil en inglés nivel B2 con su traducción y un ejemplo.']],
  noche:[['moon-star','Protocolo de cierre','protocol:debrief'],['dog','Hablar con Kisha','route:bitacora'],['calendar-clock','¿Qué hay mañana?','ask:¿Qué tengo mañana?']]};
 /* v11 · Onyx: two HUD rails around the core. Left = live read-outs (5 systems, ordered by mode), right = what Ivi
    can do now (mode, suggestions, settings; on phones also the links, shown as the «Atajos» sheet). Both live in
    #ivi-systems (display:contents) so they become cells of the home grid. Thin «wires» point at the core. */
 function bar(){const m=personaMode(),s=systems(),def=MAIN.find(x=>x[0]===evieMode())||[evieMode(),window.EvieModes?.current?.()==='normal'?'Asistente':evieMode(),'sparkles'];const W='<i class="ivi-wire" aria-hidden="true"></i>';
  const left=(ORDER[m]||ORDER.asistente).map((k,n)=>{const x=s[k];return `<a class="ivi-sys ${n===0?'is-lead':''}" href="${x.href}" data-tone="${x.tone}" title="${e(x.label+': '+x.value+' · '+x.hint)}"><span class="ivi-sys-txt"><small><span class="ivi-sys-ic" aria-hidden="true">${ic(x.icon)}</span>${x.label}</small><em>${e(x.hint)}</em></span><strong class="ivi-sys-val">${e(x.value)}</strong>${W}</a>`;}).join('');
  const right=[`<p class="ivi-online">${W}<b aria-hidden="true"></b>Sistemas en línea</p>`,
   `<button type="button" class="ivi-act is-mode" data-ivi="modes" aria-label="Cambiar modo (ahora ${e(def[1])})">${W}${ic(def[2]||'sparkles')}<span>Modo ${e(def[1])}<small>Toca para cambiar</small></span></button>`,
   ...(SUGGEST[m]||SUGGEST.asistente).map(([i,l,a])=>`<button type="button" class="ivi-act ivi-chip" data-ivi="go" data-go="${e(a)}">${W}${ic(i)}<span>${e(l)}</span></button>`),
   `<button type="button" class="ivi-act ivi-gear" data-ivi="settings" aria-label="Ajustes de Ivi">${W}${ic('sliders-horizontal')}<span>Ajustes de Ivi</span></button>`,
   `<button type="button" class="ivi-act is-link" data-evie="open">${W}${ic('messages-square')}<span>Conversación completa</span></button>`,
   `<button type="button" class="ivi-act is-link" data-hud-open="capabilities">${W}${ic('circle-help')}<span>¿Qué puedo hacer?</span></button>`,
   `<button type="button" class="ivi-act is-link" data-hud-open="pendientes">${W}${ic('bell-ring')}<span>Pendientes</span></button>`].join('');
  return `<section class="ivi-systems" id="ivi-systems" aria-label="Sistemas de Ivi" data-mode="${e(m)}"><nav class="ivi-rail ivi-rail-l" id="ivi-rail-l" aria-label="Estado de tus sistemas">${left}</nav><div class="ivi-rail ivi-rail-r" id="ivi-rail-r" role="group" aria-label="Atajos de Ivi">${right}</div></section>`;}
 function mount(){if(UI.section!=='inicio')return;const host=document.getElementById('evie-hud');if(!host)return;const old=document.getElementById('ivi-systems'),html=bar();
  if(old){old.outerHTML=html;}else{const stage=host.querySelector('.hud-stage')||host.querySelector('.hud-dock');if(!stage)return;stage.insertAdjacentHTML('afterbegin',html);
   const G=window.gsap,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';
   if(G&&!reduced&&innerWidth>=1024){const L=[...document.querySelectorAll('#ivi-rail-l>*')],R=[...document.querySelectorAll('#ivi-rail-r>*')].filter(n=>getComputedStyle(n).display!=='none');
    G.timeline({delay:.35}).from(L,{opacity:0,x:-26,duration:.7,stagger:.07,ease:'expo.out',clearProps:'opacity,transform'},0).from(R,{opacity:0,x:26,duration:.7,stagger:.06,ease:'expo.out',clearProps:'opacity,transform'},.05)
     .from(document.querySelectorAll('#ivi-systems .ivi-wire'),{scaleX:0,transformOrigin:(i,n)=>n.closest('#ivi-rail-l')?'0% 50%':'100% 50%',duration:.9,stagger:.05,ease:'power3.inOut',clearProps:'transform'},.25);
    window.EvieOnyx?.countUp?.(document.getElementById('ivi-rail-l'));}}
  try{window.lucide?.createIcons?.({root:document.getElementById('ivi-systems')});}catch{}}

 /* ---------------- dialogs ---------------- */
 function modesDialog(){const cur=evieMode();App.openDialog('Modo de Ivi',`<p class="dialog-subtitle">El modo reordena tu inicio, las alertas y lo que Ivi te sugiere. No cambia el nivel de IA.</p><div class="ivi-modes">${MAIN.map(([k,l,i])=>`<button type="button" class="ivi-mode ${cur===k?'is-on':''}" data-ivi="set-mode" data-mode="${k}" aria-pressed="${cur===k}">${ic(i)}<strong>${l}</strong><small>${{normal:'Equilibrio general',ventas:'Prospectos, seguimientos y cierres',gym:'Recuperación y entreno',estudio:'Tareas, exámenes y repasos',noche:'Calma y cierre del día'}[k]}</small></button>`).join('')}</div><details class="ivi-more"><summary>Más modos</summary><div class="ivi-modes">${[['enfoque','Enfoque','timer','Bloque de 25 min sin distracciones'],['cierre','Cierre del día','notebook-pen','Cuéntale a Kisha cómo te fue']].map(([k,l,i,h])=>`<button type="button" class="ivi-mode ${cur===k?'is-on':''}" data-ivi="set-mode" data-mode="${k}">${ic(i)}<strong>${l}</strong><small>${h}</small></button>`).join('')}</div></details>`);}
 function settingsDialog(){const p=persona(),muted=!!(P().evie||{}).muted;
  App.openDialog('Ajustes de Ivi',`<form id="ivi-settings" class="ivi-settings"><p class="dialog-subtitle">Cómo te habla Ivi en voz y en el chat. Cambia cuando quieras.</p>${Object.entries(DIALS).map(([k,opts])=>`<fieldset class="ivi-dial"><legend>${{formality:'Formalidad',humor:'Humor',verbosity:'Extensión'}[k]}</legend><div class="ivi-seg">${opts.map(([v,l])=>`<label><input type="radio" name="${k}" value="${v}" ${p[k]===v?'checked':''}><span>${l}</span></label>`).join('')}</div></fieldset>`).join('')}
   <label class="ivi-switch"><input type="checkbox" name="voice" ${muted?'':'checked'}><span class="ivi-switch-ui" aria-hidden="true"></span><span><strong>Voz de Ivi</strong><small>Leer sus respuestas en voz alta</small></span></label>
   <fieldset class="ivi-dial"><legend>Protocolos</legend><div class="ivi-protocols">${[['briefing','sunrise','Protocolo matutino'],['debrief','moon-star','Protocolo de cierre'],['visita','briefcase','Preparar visita']].map(([k,i,l])=>`<button type="button" class="button" data-ivi="protocol" data-protocol="${k}">${ic(i)}${l}</button>`).join('')}</div></fieldset>
   <div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('check')}Guardar</button></div></form>`);
  const f=document.getElementById('ivi-settings');f.onsubmit=ev=>{ev.preventDefault();const d=Object.fromEntries(new FormData(f));
   Store.save(s=>{s.preferences.iviPersona={formality:d.formality,humor:d.humor,verbosity:d.verbosity};s.preferences.evie={...(s.preferences.evie||{}),muted:d.voice!=='on'};});App.closeDialog(true);App.toast('Listo. Ajusté cómo te habla Ivi.','success');};}

 /* ---------------- protocols ---------------- */
 const ask=(text)=>{if(!window.EvieAssistant){App.toast('Ivi no está disponible.','error');return;}if(UI.section!=='inicio')location.hash='inicio';setTimeout(()=>EvieAssistant.ask(text,{speak:!(P().evie||{}).muted}),UI.section==='inicio'?0:450);};
 function clients(){return (Store.get()?.clients||[]).filter(c=>!c.deleted_at&&!/ganad|perdid|cerrad|cancel/i.test(c.stage||''));}
 function protocol(id,{client=null,fromModel=false}={}){
  const hour=new Date().getHours();
  if(id==='briefing'){if(!fromModel){window.EvieHUD?.open?.('briefing');ask(`Protocolo matutino${hour<12?'':' (aunque ya no es temprano)'}: dame mi briefing de hoy en máximo 6 frases: agenda y la ventana para entrenar antes de clases según mi recuperación, seguimientos de ventas vencidos, avance de mi misión si existe, y termina con una frase útil en inglés nivel B2 con su traducción.`);}return {ok:true,status:'started',say:'Protocolo matutino en marcha.'};}
  if(id==='debrief'){if(!fromModel)ask('Protocolo de cierre: resume en pocas frases qué hice hoy según mis registros, qué quedó pendiente y propón 3 prioridades para mañana. Si quiero, después hablo con Kisha.');return {ok:true,status:'started',say:'Protocolo de cierre en marcha.'};}
  if(id==='visita'){const list=clients(),name=String(client||'').trim();const nm=c=>String(c.title||c.name||''),hit=name?list.find(c=>IvyTools?.norm?IvyTools.norm(nm(c)).includes(IvyTools.norm(name)):nm(c).toLowerCase().includes(name.toLowerCase())):null;
   if(hit){if(!fromModel)ask(`Protocolo de visita para el prospecto «${nm(hit)}» (etapa ${hit.stage||'sin etapa'}${hit.project?', proyecto: '+hit.project:''}${hit.nextAction?', siguiente paso: '+hit.nextAction:''}): prepárame un dossier breve con su problema probable, la solución y paquete que le conviene, 3 objeciones probables con su respuesta si/entonces, y la pregunta de cierre.`);return {ok:true,status:'started',client:nm(hit),say:'Preparando la visita a '+nm(hit)+'.'};}
   if(fromModel)return {ok:false,status:'needs',question:list.length?'¿A qué prospecto vas a visitar? Tengo: '+list.slice(0,6).map(nm).join(', ')+'.':'No tienes prospectos activos en SOMA.'};
   if(!list.length){App.toast('No tienes prospectos activos en SOMA.','error');return {ok:false};}
   App.openDialog('Preparar visita',`<p class="dialog-subtitle">Elige el prospecto. Ivi arma el dossier: problema, solución y paquete, objeciones si/entonces y la pregunta de cierre.</p><div class="ivi-clients">${list.slice(0,30).map(c=>`<button type="button" class="ivi-client" data-ivi="visit" data-name="${e(nm(c))}"><strong>${e(nm(c))}</strong><small>${e(c.stage||'')}${c.nextDate?' · '+e(Views.date(c.nextDate)):''}</small></button>`).join('')}</div>`);return {ok:true,status:'choose'};}
  return {ok:false,error:'Protocolo desconocido.'};}
 /** Local voice intent: «Ivi, protocolo matutino», «buenos días Ivi», «debrief», «prepara la visita a X». */
 function intent(text){const q=(window.IvyTools?.norm?IvyTools.norm(text):String(text).toLowerCase()).replace(/[¿?¡!.,]/g,'').replace(/^(?:oye |hey )?(?:ivi|ivy|evie|evi|ibi)[, ]*/,'').trim();
  // v10 · Fase 4 modules answer from real local data (no AI): misión, revisión semanal, escuela.
  for(const mod of [window.EvieMission,window.EvieWeekly,window.EvieSchool,window.EvieDojo,window.EvieRadar,window.IviProactive,window.EviePrompts]){const r=mod?.intent?.(text);if(typeof r==='string'&&r)return r;}
  if(/^(protocolo matutino|briefing|briefing (del dia|de hoy)|buenos dias|dame mi briefing)$/.test(q))return protocol('briefing').say;
  if(/^(protocolo de cierre|debrief|cierre del dia|cierra el dia)$/.test(q))return protocol('debrief').say;
  const m=q.match(/^(?:prepara(?:me)? (?:la |mi )?visita|protocolo de visita)(?: (?:a|con|para) (.+))?$/);if(m){const r=protocol('visita',{client:m[1]||null});return r.say||(r.status==='choose'?'Elige el prospecto en pantalla.':'No encontré ese prospecto.');}
  return null;}

 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-ivi]');if(!b)return;const a=b.dataset.ivi;
  if(a==='modes')modesDialog();
  else if(a==='settings')settingsDialog();
  else if(a==='set-mode'){App.closeDialog(true);const r=window.EvieModes?.set?.(b.dataset.mode);if(r?.say)App.toast(r.say,'success');setTimeout(mount,60);}
  else if(a==='protocol'){App.closeDialog(true);protocol(b.dataset.protocol);}
  else if(a==='visit'){App.closeDialog(true);protocol('visita',{client:b.dataset.name});}
  else if(a==='go'){const g=b.dataset.go||'';const [kind,...rest]=g.split(':'),v=rest.join(':');if(kind==='ask')ask(v);else if(kind==='route')location.hash=v;else if(kind==='protocol')protocol(v);}});
 function afterRender(){if(UI.section==='inicio')mount();}
 return Object.freeze({afterRender,mount,systems,personaMode,persona,protocol,intent,MODE_OF});
})();
