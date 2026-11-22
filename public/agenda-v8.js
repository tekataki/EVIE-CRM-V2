'use strict';
/* agenda-v8.js · v8 (2026-11-22)
   The Agenda screen, simple on purpose:
   header with today's date + «Nuevo» · quick add · week strip · Hoy / Próximos / Todo / Hechos ·
   clear sections (Vencidos, Hoy, Mañana, Esta semana, Más adelante, Sin fecha) · a big round check.
   Data rules stay in agenda.js (complete/reopen/occurrence) and agenda-rules.js (pure grouping + quick add).
   Taps use data-agv="…" (handled here) or the existing data-action="rc-agenda-…" actions. */
window.AgendaV8=(()=>{
 const e=v=>Domain.escape(v==null?'':String(v)),R=()=>window.AgendaRules,ic=n=>Views.icon(n);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.paused==='true';
 const TABS=[['hoy','Hoy'],['proximos','Próximos'],['todo','Todo'],['hechos','Hechos']];
 const REP={daily:'Diario',weekly:'Semanal',monthly:'Mensual',yearly:'Anual'};
 const KIND={event:'Evento',time_block:'Bloque',reminder:'Recordatorio'};
 const HUE={personal:212,school:262,soma:328,farm:96,finance:152,gym:22,learning:44,alvento:188,content:296,other:226};
 const SEC_ICON={overdue:'alarm-clock',today:'sun',tomorrow:'sunrise',week:'calendar-range',later:'calendar-clock',none:'inbox'};
 const LIMIT=25,busy=new Set();
 let pending=null,lastSeg=null,lastKey=null,live=null,draft='';
 const safe=(fn,fallback)=>{try{return fn();}catch{return fallback;}};
 const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
 const plural=(n,one,many)=>n+' '+(n===1?one:many);
 const dayOf=at=>at?safe(()=>Domain.today(new Date(at)),''):'';

 // ---------- state ----------
 function state(){
  // Other modules may still set legacy tabs (e.g. DALI Core: 'today'). Read them as aliases, never rewrite them,
  // and drop a stale day filter when someone else changed the tab.
  const today=Domain.today(),raw=UI.tab.agenda;
  if(raw!==UI.agvTabSeen){if(raw!=null&&!['hoy','proximos','todo','hechos'].includes(raw))UI.agendaDay=null;UI.agvTabSeen=raw;}
  const day=UI.agendaDay&&R().real(UI.agendaDay)?UI.agendaDay:null,anchor=UI.agendaStart&&R().real(UI.agendaStart)?UI.agendaStart:(day||today);
  return {today,tab:R().tab(UI.tab.agenda),day,anchor,now:Agenda.localValue(new Date().toISOString()).slice(11)};
 }
 const defaultDate=s=>s.day||(s.tab==='hoy'||s.tab==='hechos'?s.today:s.tab==='proximos'?R().add(s.today,1):null);

 // ---------- data → entries ----------
 const occurs=(r,d)=>safe(()=>Agenda.occurrence(r,d),false);
 const doneOn=(r,d)=>safe(()=>Agenda.isDone(r,d),false);
 const live_=r=>r.status!=='archived'&&!(r.recurrence&&r.status==='done');
 function nextOpen(r,today){const start=Agenda.dateOf(r);if(!start)return null;for(const d of safe(()=>R().expand(start,r.recurrence,today,R().add(today,400),60),[]))if(occurs(r,d)&&!doneOn(r,d))return d;return null;}
 function entry(r,date){return {id:r.id,r,date:date||null,time:date&&!r.all_day?(safe(()=>Agenda.occTime(r,date),'')||''):'',title:date?safe(()=>Agenda.occTitle(r,date),r.title):r.title,priority:r.priority};}
 function openEntries(list,today){const out=[];for(const r of list){if(['done','archived'].includes(r.status))continue;if(r.recurrence){const d=nextOpen(r,today);if(d)out.push(entry(r,d));}else out.push(entry(r,Agenda.dateOf(r)));}return out;}
 function dayEntries(list,d){return list.filter(r=>live_(r)&&occurs(r,d)).map(r=>({...entry(r,d),done:doneOn(r,d)})).sort(R().compare);}
 function doneEntries(list){const out=[];for(const r of list){
   if(r.recurrence){for(const h of r.history||[])if(h.completed&&h.occurrence)out.push({...entry(r,h.occurrence),at:h.at||'',done:true});if(r.status==='done')out.push({...entry(r,null),at:r.completed_at||r.updated_at||'',done:true});}
   else if(r.status==='done')out.push({...entry(r,Agenda.dateOf(r)),at:r.completed_at||r.updated_at||'',done:true});
   else if(r.status==='archived')out.push({...entry(r,Agenda.dateOf(r)),at:r.updated_at||'',archived:true});}
  return out.sort((a,b)=>String(b.at).localeCompare(String(a.at)));}
 function weekInfo(list,days){return days.map(d=>{let open=0,done=0;for(const r of list){if(!live_(r)||!occurs(r,d))continue;if(doneOn(r,d))done++;else open++;}return {d,open,done};});}

 // ---------- labels ----------
 function dayLabel(d,today,long=false){
  if(!d)return 'Sin fecha';if(d===today)return 'Hoy';if(d===R().add(today,1))return 'Mañana';if(d===R().add(today,-1))return 'Ayer';
  const diff=R().diff(today,d),year=d.slice(0,4)!==today.slice(0,4)?{year:'numeric'}:{};
  if(!long&&diff>1&&diff<7)return cap(Views.date(d,{weekday:'long'}));
  return cap(Views.date(d,long?{weekday:'long',day:'numeric',month:'long',...year}:{weekday:'short',day:'numeric',month:'short',...year}).replace(/\./g,''));
 }
 const whenText=(date,time,today)=>date?dayLabel(date,today,true)+(time?' · '+time:''):(time?'Hoy · '+time:'Sin fecha');
 function longDate(d){return cap(Views.date(d,{weekday:'long',day:'numeric',month:'long'}));}

 // ---------- pieces ----------
 const CHECK_SVG='<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><circle class="agv-ring" cx="14" cy="14" r="11.5"/><path class="agv-tick" d="M8.6 14.4l3.6 3.6 7.2-7.6"/></svg>';
 function check(x,big=false){
  if(x.archived)return `<span class="agv-check is-archived" aria-hidden="true">${ic('archive')}</span>`;
  const t=e(x.title);
  return `<button type="button" class="agv-check${big?' agv-check-lg':''}${x.done?' is-on':''}${x.priority==='high'?' is-high':''}" data-agv="${x.done?'undo':'done'}" data-id="${e(x.id)}" data-date="${e(x.date||'')}" aria-pressed="${!!x.done}" aria-label="${x.done?'Volver a pendiente':'Marcar como hecho'}: ${t}">${CHECK_SVG}</button>`;
 }
 function chips(x,ctx){const r=x.r,out=[];
  if(ctx.showDate&&x.date)out.push(`<span class="agv-chip agv-chip-date${ctx.key==='overdue'?' is-bad':''}">${ic('calendar')}${e(dayLabel(x.date,ctx.today))}</span>`);
  if(x.time)out.push(`<span class="agv-chip agv-chip-time${ctx.key==='today'&&!x.done&&x.time<ctx.now?' is-late':''}">${ic('clock-3')}${e(x.time)}</span>`);
  if(x.at&&(x.done||x.archived))out.push(`<span class="agv-chip agv-chip-ok">${ic(x.archived?'archive':'check')}${x.archived?'Archivado':'Hecho '+e(dayOf(x.at)?dayLabel(dayOf(x.at),ctx.today).toLowerCase():'')}</span>`);
  if(r.recurrence)out.push(`<span class="agv-chip agv-chip-rep">${ic('repeat')}${e(REP[r.recurrence.frequency]||'Se repite')}</span>`);
  out.push(`<span class="agv-chip agv-chip-area" style="--h:${HUE[r.area]??226}">${e(Agenda.areas[r.area]||'Otra')}</span>`);
  if(r.priority==='high')out.push(`<span class="agv-chip agv-chip-high">${ic('flame')}Alta</span>`);else if(r.priority==='low')out.push(`<span class="agv-chip agv-chip-low">Baja</span>`);
  if(KIND[r.kind])out.push(`<span class="agv-chip">${e(KIND[r.kind])}</span>`);
  return out.join('');}
 function row(x,ctx){
  return `<li class="agv-row${x.done?' is-done':''}${x.archived?' is-archived':''}" data-id="${e(x.id)}" data-date="${e(x.date||'')}"${ctx.keep?' data-keep="1"':''} style="--h:${HUE[x.r.area]??226}">${check(x)}<button type="button" class="agv-body" data-agv="edit" data-id="${e(x.id)}" data-date="${e(x.date||'')}"><span class="agv-title">${e(x.title)}</span><span class="agv-meta">${chips(x,ctx)}</span></button><span class="agv-go" aria-hidden="true">${ic('chevron-right')}</span></li>`;}
 function section(key,label,items,ctx){
  const more=UI.agvMore?.[key],shown=more?items:items.slice(0,LIMIT),rest=items.length-shown.length,c={...ctx,key,showDate:ctx.showDate??['overdue','week','later'].includes(key)};
  return `<section class="agv-sec agv-sec-${key}" aria-labelledby="agv-h-${key}"><h2 class="agv-sec-h" id="agv-h-${key}"><span class="agv-sec-ico" aria-hidden="true">${ic(SEC_ICON[key]||'list')}</span>${e(label)}<span class="agv-count" aria-label="${plural(items.length,'elemento','elementos')}">${items.length}</span></h2><ul class="agv-rows" role="list">${shown.map(x=>row(x,c)).join('')}</ul>${rest>0?`<button type="button" class="agv-more-rows" data-agv="more" data-key="${key}">Mostrar ${rest} más</button>`:''}</section>`;}
 function empty(icon,title,text,button){return `<div class="agv-empty"><span class="agv-empty-ico" aria-hidden="true">${ic(icon)}</span><h2>${e(title)}</h2><p>${e(text)}</p>${button||''}</div>`;}
 const cta=(label,attrs)=>`<button type="button" class="agv-cta" ${attrs}>${ic('plus')}<span>${e(label)}</span></button>`;

 function header(s,counts){
  const today=s.today,{todayOpen,overdue,doneToday}=counts;
  const parts=[todayOpen?`Hoy tienes <strong>${plural(todayOpen,'pendiente','pendientes')}</strong>`:'Tu día está libre'];
  if(overdue)parts.push(`<span class="agv-sum-bad">${plural(overdue,'vencido','vencidos')}</span>`);
  if(doneToday)parts.push(`<span class="agv-sum-ok">${plural(doneToday,'hecho','hechos')}</span>`);
  return `<header class="agv-head"><div class="agv-hgroup"><p class="agv-kicker">${ic('calendar-days')}<span>Agenda</span></p><h1 class="agv-date">${e(longDate(today))}</h1><p class="agv-summary">${parts.join(' · ')}</p></div><button type="button" class="agv-new" data-agv="new">${ic('plus')}<span>Nuevo</span></button></header>`;}
 function quick(s){
  const d=defaultDate(s);
  return `<form class="agv-quick" data-agv-quick data-draft-ignore autocomplete="off" novalidate><span class="agv-quick-ico" aria-hidden="true">${ic('sparkles')}</span><label class="agv-sr" for="agv-quick-input">Agregar rápido</label><input id="agv-quick-input" class="agv-quick-input" name="q" type="text" maxlength="200" placeholder="Escribe algo y presiona Enter" enterkeyhint="done" autocomplete="off" aria-describedby="agv-quick-when agv-quick-tip"><span class="agv-quick-when" id="agv-quick-when" title="Cuándo se guardará">${e(whenText(d,null,s.today))}</span><button type="submit" class="agv-quick-go" aria-label="Agregar" disabled>${ic('arrow-up')}</button></form><p class="agv-tip" id="agv-quick-tip">Tip: termina con «mañana» o «mañana 17:00» para ponerle fecha.</p>`;}
 function weekStrip(s,list){
  const days=R().week(s.anchor),info=weekInfo(list,days),first=days[0],last=days[6],sameMonth=first.slice(0,7)===last.slice(0,7);
  const month=sameMonth?cap(Views.date(first,{month:'long',year:'numeric'})):cap(Views.date(first,{month:'short'}).replace('.',''))+' – '+Views.date(last,{month:'short',year:'numeric'}).replace('.','');
  const L=['L','M','M','J','V','S','D'];
  return `<div class="agv-week" role="group" aria-label="Semana"><div class="agv-week-top"><h2 class="agv-month">${e(month)}</h2><div class="agv-week-nav"><button type="button" class="agv-round" data-agv="week" data-dir="-1" aria-label="Semana anterior">${ic('chevron-left')}</button>${days.includes(s.today)?'':`<button type="button" class="agv-pill" data-agv="week" data-dir="0">Hoy</button>`}<label class="agv-round agv-jump" title="Ir a una fecha">${ic('calendar-search')}<input type="date" data-agv-jump value="${e(s.day||s.anchor)}" aria-label="Ir a una fecha"></label><button type="button" class="agv-round" data-agv="week" data-dir="1" aria-label="Semana siguiente">${ic('chevron-right')}</button></div></div><div class="agv-days">${info.map(({d,open,done},i)=>{const dots=open?'<i></i>'.repeat(Math.min(open,3)):done?'<i class="ok"></i>':'';const what=open?plural(open,'pendiente','pendientes'):done?'todo hecho':'libre';return `<button type="button" class="agv-day${d===s.today?' is-today':''}${d===s.day?' is-sel':''}${d<s.today?' is-past':''}" data-agv="day" data-date="${d}" aria-pressed="${d===s.day}" aria-label="${e(longDate(d))}${d===s.today?', hoy':''}: ${what}"><span class="agv-dow" aria-hidden="true">${L[i]}</span><span class="agv-dnum" aria-hidden="true">${+d.slice(8)}</span><span class="agv-dots" aria-hidden="true">${dots}</span></button>`;}).join('')}</div></div>`;}
 function seg(s,counts){const i=TABS.findIndex(t=>t[0]===s.tab);
  return `<div class="agv-seg${s.day?' is-off':''}" role="group" aria-label="Qué quieres ver" style="--i:${i}"><span class="agv-seg-pill" aria-hidden="true"></span>${TABS.map(([k,l])=>{const on=!s.day&&s.tab===k,n=k==='hoy'?counts.todayOpen+counts.overdue:0;return `<button type="button" class="agv-seg-b${on?' is-on':''}" data-agv="tab" data-tab="${k}" aria-pressed="${on}">${l}${n?`<span class="agv-seg-n${counts.overdue?' is-bad':''}" aria-label="(${n})">${n}</span>`:''}</button>`;}).join('')}</div>`;}

 // ---------- screens ----------
 function listView(s,list,open,done){
  const ctx={today:s.today,now:s.now};
  if(s.day){const rows=dayEntries(list,s.day),k=R().bucket(s.day,s.today);
   const bar=`<div class="agv-filter" role="status"><span>${ic('calendar-check')} <strong>${e(longDate(s.day))}</strong>${s.day===s.today?' · hoy':''}</span><button type="button" class="agv-pill" data-agv="day-clear">${ic('x')}<span>Ver todo</span></button></div>`;
   const todo=rows.filter(x=>!x.done),fin=rows.filter(x=>x.done),c={...ctx,keep:true,showDate:false};
   return bar+(rows.length?(todo.length?section(k==='today'?'today':'day-open','Por hacer',todo,c):'')+(fin.length?section('day-done','Hecho',fin,c):''):empty('calendar-heart','Nada para este día','Un día libre también es un buen plan.',cta('Agregar para este día',`data-agv="new" data-date="${s.day}"`)));}
  if(s.tab==='hechos'){const rows=done.slice(0,120);if(!rows.length)return empty('party-popper','Aún no hay nada hecho','Cuando termines algo, tócale al círculo y aparecerá aquí.',`<button type="button" class="agv-cta" data-agv="tab" data-tab="hoy">${ic('sun')}<span>Ver lo de hoy</span></button>`);
   const yest=R().add(s.today,-1),by={today:[],yest:[],before:[],arch:[]};for(const x of rows){if(x.archived){by.arch.push(x);continue;}const d=dayOf(x.at);(d===s.today?by.today:d===yest?by.yest:by.before).push(x);}
   return [['today','Hoy',by.today],['yest','Ayer',by.yest],['before','Antes',by.before],['arch','Archivados',by.arch]].filter(g=>g[2].length).map(([k,l,items])=>section('done-'+k,l,items,{...ctx,keep:true,showDate:false})).join('');}
  const groups=R().group(open,s.today,R().TABS[s.tab]);
  if(!groups.length){
   if(s.tab==='hoy')return empty('sun','Nada pendiente para hoy','Disfruta tu día. Si se te ocurre algo, agrégalo arriba.',cta('Agregar algo para hoy',`data-agv="new" data-date="${s.today}"`));
   if(s.tab==='proximos')return empty('calendar-plus','Nada programado más adelante','Ponle fecha a lo que quieras recordar.',cta('Programar algo',`data-agv="new" data-date="${R().add(s.today,1)}"`));
   return empty('sparkles','Tu agenda está vacía','Empieza con lo primero que se te venga a la mente.',cta('Agregar','data-agv="new"'));}
  return groups.map(g=>section(g.key,g.label,g.items,ctx)).join('');
 }
 function footer(counts,st){const g=safe(()=>window.EvieSettings?.googleStatus?.(),null);
  return `<footer class="agv-foot">${counts.doneToday&&st.tab!=='hechos'&&!st.day?`<button type="button" class="agv-pill agv-pill-ok" data-agv="tab" data-tab="hechos">${ic('circle-check')}<span>${plural(counts.doneToday,'hecho','hechos')} hoy</span></button>`:''}<span class="agv-foot-note">${ic('shield-check')}Se guarda en tu Agenda de EVIE${g?.connected?' · Google Calendar conectado':''}</span><button type="button" class="agv-link" data-action="rc-agenda-ics">${ic('download')}<span>Descargar calendario (.ics)</span></button></footer>`;}
 function counts(open,done,s){let todayOpen=0,overdue=0;for(const x of open){const k=R().bucket(x.date,s.today);if(k==='today')todayOpen++;else if(k==='overdue')overdue++;}const doneToday=done.filter(x=>x.done&&dayOf(x.at)===s.today).length;return {todayOpen,overdue,doneToday};}

 function detail(id){
  const r=Store.list('agendaItems').find(x=>x.id===id);if(!r)return Views.notFound();
  const today=Domain.today(),occ=r.recurrence?(occurs(r,today)?today:nextOpen(r,today)):Agenda.dateOf(r),x={...entry(r,occ),done:r.recurrence?(occ?doneOn(r,occ):r.status==='done'):r.status==='done',archived:r.status==='archived'};
  const when=occ?whenText(occ,x.time,today):'Sin fecha',hist=(r.history||[]).slice().reverse().slice(0,30);
  const btn=(icon,label,attrs,cls='')=>`<button type="button" class="agv-btn ${cls}" ${attrs}>${ic(icon)}<span>${e(label)}</span></button>`,ID=`data-id="${e(r.id)}"`;
  return `<section class="agv agv-detail-page" data-agv-root data-view="detail"><a class="agv-back" href="#agenda">${ic('chevron-left')}<span>Agenda</span></a><article class="agv-detail"><div class="agv-detail-top">${check(x,true)}<div class="agv-detail-head"><h1 class="agv-detail-title">${e(x.title)}</h1><p class="agv-detail-when">${ic(occ?'calendar':'inbox')}${e(r.recurrence&&occ?'Siguiente: '+when:when)}</p><p class="agv-meta">${chips({...x,time:''},{today,now:''})}</p></div></div>${r.notes?`<p class="agv-notes">${e(r.notes)}</p>`:''}<div class="agv-actions">${btn('pencil','Editar',`data-action="rc-agenda-edit" ${ID}`,'agv-btn-primary')}${r.recurrence&&occ?btn('calendar-cog','Cambiar solo ese día',`data-action="rc-agenda-occ" ${ID} data-date="${occ}"`):''}${btn('target','Enfoque',`data-action="rc-agenda-focus" ${ID}`)}${btn('link','Vincular con…',`data-action="rc-links" data-collection="agendaItems" ${ID}`)}${r.start_at||r.due_at?btn('download','Calendario (.ics)',`data-action="rc-agenda-ics" ${ID}`):''}${btn('archive','Archivar',`data-action="delete" data-collection="agendaItems" ${ID}`,'agv-btn-danger')}</div><h2 class="agv-sub-h">Historial</h2>${hist.length?`<ul class="agv-history" role="list">${hist.map(h=>`<li>${ic(h.reopened?'rotate-ccw':h.completed||h.status?'circle-check':'history')}<span>${e(h.reopened?'Volvió a pendiente':h.completed?(h.reopened_at?'Hecho (luego reabierto)':'Hecho'):h.status?'Hecho':'Cambio registrado')}${h.occurrence&&/^\d{4}-\d{2}-\d{2}$/.test(h.occurrence)?' · '+e(dayLabel(h.occurrence,today,true)):''}</span><time>${e(h.at?Views.date(h.at,{day:'numeric',month:'short',year:'numeric'}):'')}</time></li>`).join('')}</ul>`:'<p class="agv-muted">Aún sin cambios registrados.</p>'}</article></section>`;}

 function render(id){
  if(id)return detail(id);
  const s=state(),list=Store.list('agendaItems'),open=openEntries(list,s.today),done=doneEntries(list),c=counts(open,done,s);
  return `<section class="agv" data-agv-root data-view="${s.day?'day':s.tab}">${header(s,c)}${quick(s)}${weekStrip(s,list)}${seg(s,c)}<div class="agv-list" id="agv-list">${listView(s,list,open,done)}</div>${footer(c,s)}</section>`;
 }

 // ---------- motion ----------
 const M=()=>window.Motion;
 function animate(el,kf,opts){const m=M();if(!el||reduced())return null;if(m?.animate){try{return m.animate(el,kf,opts);}catch{}}return null;}
 function burst(btn){if(reduced())return;const b=document.createElement('span');b.className='agv-burst';b.setAttribute('aria-hidden','true');b.innerHTML='<i></i>'.repeat(8);btn.append(b);setTimeout(()=>b.remove(),900);}
 function collapse(row){return new Promise(done=>{if(!row||reduced())return done();const h=row.offsetHeight;row.style.overflow='hidden';row.style.minHeight='0px';row.style.height=h+'px';
  const cs=getComputedStyle(row),a=animate(row,{opacity:[1,0],x:[0,28],height:[h+'px','0px'],paddingTop:[cs.paddingTop,'0px'],paddingBottom:[cs.paddingBottom,'0px']},{duration:.34,ease:[.4,0,.2,1]});
  if(a?.finished)a.finished.then(done,done);else if(window.gsap){gsap.to(row,{opacity:0,x:28,height:0,paddingTop:0,paddingBottom:0,duration:.32,ease:'power2.in',onComplete:done});}else{row.style.transition='opacity .25s,transform .25s';row.style.opacity='0';row.style.transform='translateX(28px)';setTimeout(done,260);}
  setTimeout(done,700);});}
 const wait=ms=>new Promise(r=>setTimeout(r,reduced()?0:ms));

 // ---------- actions ----------
 function announce(text){if(!live){live=document.createElement('p');live.className='agv-sr';live.setAttribute('role','status');live.setAttribute('aria-live','polite');document.body.append(live);}live.textContent='';setTimeout(()=>{live.textContent=text;},60);}
 const kbd=el=>document.activeElement===el&&safe(()=>el.matches(':focus-visible'),false);
 function refocusAfter(el){const li=el.closest('.agv-row');if(!li||!kbd(el))return null;const next=li.nextElementSibling||li.previousElementSibling;return next?`.agv-row[data-id="${CSS.escape(next.dataset.id)}"] .agv-check`:'#agv-quick-input';}
 async function complete(el){
  const id=el.dataset.id,date=el.dataset.date||Domain.today(),key=id+'|'+date;if(busy.has(key))return;
  const before=Store.list('agendaItems').find(x=>x.id===id);if(!before)return;busy.add(key);
  const snapshot=structuredClone(before),title=el.closest('.agv-row,.agv-detail')?.querySelector('.agv-title,.agv-detail-title')?.textContent||before.title,focus=refocusAfter(el),row=el.closest('.agv-row');
  el.classList.add('is-on','is-pop');el.setAttribute('aria-pressed','true');row?.classList.add('is-done');burst(el);
  animate(el,{scale:[1,.82,1.16,1]},{duration:.5,ease:'easeOut'});
  safe(()=>window.EvieSounds?.play?.('success'));safe(()=>navigator.vibrate?.(10));
  await wait(420);if(row&&!row.dataset.keep)await collapse(row);
  let changed=false;
  try{Store.save(s=>{changed=Agenda.complete(s,id,date)!==false;});}
  catch(err){busy.delete(key);App.render();throw err;}
  busy.delete(key);if(changed)safe(()=>window.DaliCore?.pulse?.());
  pending={skipIntro:true,focus};App.render();
  announce(`«${title}» marcado como hecho.`);
  App.toast(`¡Hecho! ${title}`,'success',()=>Store.save(s=>{const i=s.agendaItems.findIndex(x=>x.id===id);if(i>=0)s.agendaItems[i]={...snapshot,updated_at:new Date().toISOString()};}));
 }
 function reopen(el){const id=el.dataset.id,date=el.dataset.date||Domain.today();let changed=false;
  Store.save(s=>{changed=Agenda.reopen(s,id,date);});
  pending={skipIntro:true,focus:kbd(el)?`.agv-row[data-id="${CSS.escape(id)}"] .agv-check`:null};App.render();
  if(changed){announce('Volvió a tus pendientes.');App.toast('Volvió a tus pendientes.');}}
 function quickAdd(form){
  const input=form.querySelector('.agv-quick-input'),s=state(),p=R().quick(input.value,s.today);
  if(!p){input.focus();animate(form,{x:[0,-6,6,-3,0]},{duration:.32});return;}
  const date=p.date||defaultDate(s)||(p.time?s.today:null),rec=Store.record({...RCData.defaults('agendaItems'),title:p.title.slice(0,200),source:'manual'});
  if(date){rec.due_at=Agenda.toTimestamp(date+'T'+(p.time||'23:59'));rec.all_day=!p.time;rec.status='scheduled';}
  Store.save(st=>{st.agendaItems.push(rec);});draft='';
  const when=whenText(date,p.time,s.today);
  pending={skipIntro:true,flashId:rec.id,focus:'#agv-quick-input'};App.render();
  announce(`Agregado: ${p.title}, ${when}.`);
  App.toast(`Agregado · ${when}`,'success',()=>Store.save(st=>{const x=st.agendaItems.find(y=>y.id===rec.id);if(x){x.deleted_at=new Date().toISOString();x.updated_at=x.deleted_at;}}));
 }
 function updateHint(input){
  if(!input)return;const s=state(),p=R().quick(input.value,s.today),chip=document.getElementById('agv-quick-when'),go=input.form?.querySelector('.agv-quick-go');
  if(go)go.disabled=!p;if(!chip)return;
  const date=p?.date||defaultDate(s)||(p?.time?s.today:null);chip.textContent=whenText(date,p?.time,s.today);chip.classList.toggle('is-set',!!(p&&(p.date||p.time)));}

 // Edit form helpers (form markup lives in Agenda.edit).
 function syncForm(form){
  const wrap=form?.querySelector('.agv-form');if(!wrap)return;
  const today=Domain.today(),date=form.elements.date?.value||'',time=form.elements.time?.value||'';
  const on={today:date===today,tomorrow:date===R().add(today,1),none:!date,allday:!!date&&!time};
  wrap.querySelectorAll('[data-agv-when]').forEach(b=>b.setAttribute('aria-pressed',String(!!on[b.dataset.agvWhen])));
  const f=form.querySelector('input[name="frequency"]:checked');wrap.dataset.freq=f?f.value:'';
 }
 function setField(input,value){if(!input||input.value===value)return;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}

 // ---------- mount (runs after every render via Agenda.clock) ----------
 function mount(){
  const root=document.querySelector('[data-agv-root]:not([data-mounted])');if(!root)return;root.dataset.mounted='1';
  const p=pending;pending=null;
  const seg=root.querySelector('.agv-seg');
  if(seg){const i=Number(seg.style.getPropertyValue('--i'));if(lastSeg!=null&&lastSeg!==i&&!reduced()&&!seg.classList.contains('is-off')){seg.classList.add('no-anim');seg.style.setProperty('--i',lastSeg);void seg.offsetWidth;seg.classList.remove('no-anim');requestAnimationFrame(()=>seg.style.setProperty('--i',i));}if(!seg.classList.contains('is-off'))lastSeg=i;}
  const key=(root.dataset.view||'')+'|'+(UI.agendaStart||'')+'|'+(UI.id||'');
  if(key!==lastKey&&!p?.skipIntro&&!reduced()&&M()?.animate){
   const items=[...root.querySelectorAll('.agv-sec-h,.agv-row,.agv-empty,.agv-filter,.agv-detail')].slice(0,16);
   if(items.length){items.forEach(n=>{n.style.opacity='0';});const m=M(),a=safe(()=>m.animate(items,{opacity:[0,1],y:[10,0]},{delay:m.stagger?m.stagger(.028):0,type:'spring',stiffness:320,damping:30}),null);
    const clean=()=>items.forEach(n=>{n.style.opacity='';n.style.transform='';});(a?.finished||Promise.resolve()).then(clean,clean);setTimeout(clean,1600);}}
  lastKey=key;
  if(p?.weekDir)animate(root.querySelector('.agv-days'),{x:[p.weekDir*36,0],opacity:[.2,1]},{type:'spring',stiffness:320,damping:30});
  if(p?.flashId){const n=root.querySelector(`.agv-row[data-id="${CSS.escape(p.flashId)}"]`);if(n){n.classList.add('is-new');setTimeout(()=>n.classList.remove('is-new'),1600);safe(()=>n.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'}));}}
  if(p?.focus)safe(()=>root.querySelector(p.focus)?.focus({preventScroll:true}));
  const q=root.querySelector('#agv-quick-input');if(q&&draft&&!q.value)q.value=draft;updateHint(q);
 }

 // ---------- events ----------
 document.addEventListener('click',ev=>{
  const jump=ev.target.closest?.('[data-agv-jump]');if(jump){safe(()=>jump.showPicker?.());return;}
  const w=ev.target.closest?.('[data-agv-when]');if(w){const form=w.closest('form'),today=Domain.today(),k=w.dataset.agvWhen;if(!form)return;
   if(k==='today')setField(form.elements.date,today);else if(k==='tomorrow')setField(form.elements.date,R().add(today,1));else if(k==='none'){setField(form.elements.date,'');setField(form.elements.time,'');}else if(k==='allday')setField(form.elements.time,'');
   syncForm(form);return;}
  const el=ev.target.closest?.('[data-agv]');if(!el||el.disabled)return;const a=el.dataset.agv;
  Promise.resolve().then(()=>{
   if(a==='tab'){UI.tab.agenda=el.dataset.tab;UI.agendaDay=null;UI.id=null;pending={focus:kbd(el)?`[data-agv="tab"][data-tab="${el.dataset.tab}"]`:null};if(location.hash!=='#agenda'&&location.hash.startsWith('#agenda/'))location.hash='agenda';else App.render();}
   else if(a==='day'){const d=el.dataset.date;UI.agendaDay=UI.agendaDay===d?null:d;pending={focus:kbd(el)?`[data-agv="day"][data-date="${d}"]`:null};App.render();}
   else if(a==='day-clear'){UI.agendaDay=null;App.render();}
   else if(a==='week'){const dir=Number(el.dataset.dir),s=state();UI.agendaStart=dir?R().add(s.anchor,dir*7):s.today;UI.agendaDay=null;pending={weekDir:dir,skipIntro:true,focus:kbd(el)?`[data-agv="week"][data-dir="${dir}"]`:null};App.render();}
   else if(a==='new'){const s=state(),d=el.dataset.date||defaultDate(s);Agenda.edit(null,d?{date:d}:{});}
   else if(a==='edit'){const r=Store.list('agendaItems').find(x=>x.id===el.dataset.id);if(r)Agenda.edit(r.id,r.recurrence&&el.dataset.date?{occurrence:el.dataset.date}:{});}
   else if(a==='done')return complete(el);
   else if(a==='undo')return reopen(el);
   else if(a==='more'){UI.agvMore={...(UI.agvMore||{}),[el.dataset.key]:true};pending={skipIntro:true};App.render();}
   else if(a==='close-dialog')App.closeDialog();
  }).catch(err=>App.toast(err?.message||'No se pudo completar.','error'));
 });
 document.addEventListener('submit',ev=>{const f=ev.target.closest?.('[data-agv-quick]');if(!f)return;ev.preventDefault();try{quickAdd(f);}catch(err){App.toast(err?.message||'No se pudo agregar.','error');}});
 document.addEventListener('input',ev=>{const t=ev.target;if(t?.id==='agv-quick-input'){draft=t.value;updateHint(t);}else if(t?.form?.querySelector?.('.agv-form')&&['date','time'].includes(t.name))syncForm(t.form);});
 document.addEventListener('change',ev=>{const t=ev.target;
  if(t?.matches?.('[data-agv-jump]')){const v=t.value;if(R().real(v)){UI.agendaStart=v;UI.agendaDay=v;App.render();}return;}
  if(t?.form?.querySelector?.('.agv-form')&&['frequency','date','time'].includes(t.name))syncForm(t.form);});
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&ev.target?.id==='agv-quick-input'&&ev.target.value){ev.target.value='';draft='';updateHint(ev.target);ev.stopPropagation();}});

 return Object.freeze({render,mount,syncForm,dayLabel,whenText,openEntries,doneEntries,dayEntries});
})();
