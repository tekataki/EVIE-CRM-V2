'use strict';
/* EVIE v10 · Escuela — tu semana escolar en un solo lugar.
   Pestañas: Hoy (clases, entregas de 7 días, próximo examen y tarjetas) · Materias (color, profesor, salón, horario y
   bloques semanales en la Agenda) · Tareas (vencidas / esta semana / después / hechas; cada una puede crear su
   pendiente en la Agenda) · Tarjetas (repaso espaciado SM-2; alta una por una, por lote «frente :: reverso» o generadas
   por Ivi con tus apuntes) · Calificaciones (promedio ponderado y cuánto necesitas en lo que falta) · Resúmenes en
   audio (Ivi los prepara; los guardados se vuelven a escuchar sin costo de IA).
   Datos: preferences.school (cuenta, sincronizado); sin colecciones nuevas. Nada personal vive en el código. */
window.EvieSchool=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const uid=()=>crypto.randomUUID();
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return true;}};
 const icons=root=>{try{window.lucide?.createIcons?.({root});}catch{}};
 const today=()=>Domain.today();
 const isDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'));
 const okTime=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
 const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
 const between=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
 const dowOf=d=>new Date(d+'T12:00:00Z').getUTCDay();
 const toMin=t=>{const [h,m]=String(t).split(':').map(Number);return h*60+m;};
 const hhmm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes();};
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const r1=n=>Math.round(n*10)/10;
 const num=v=>{if(v===null||v===undefined||v==='')return null;const n=typeof v==='number'?v:parseFloat(String(v).replace(',','.'));return Number.isFinite(n)?n:null;};
 const fmt=n=>n==null||!Number.isFinite(Number(n))?'—':String(r1(Number(n)));
 const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,;:«»"()]/g,' ').replace(/\s+/g,' ').trim();
 const cap1=s=>s?s.charAt(0).toUpperCase()+s.slice(1):'';
 const plural=(n,a,b)=>n===1?a:b;
 const joinY=a=>a.length<=1?(a[0]||''):a.slice(0,-1).join(', ')+' y '+a[a.length-1];
 const dot=s=>{s=String(s).trim();return /[.!?…]$/.test(s)?s:s+'.';};
 const dateText=(d,o={weekday:'long',day:'numeric',month:'long'})=>{try{return new Date(d+'T12:00:00').toLocaleDateString('es-MX',o);}catch{return d;}};
 const hour12=t=>{const [h,m]=String(t).split(':').map(Number);try{return new Date(2000,0,1,h,m).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'});}catch{return t;}};
 const arr=x=>Array.isArray(x)?x:[];
 const str=(v,n)=>String(v??'').trim().slice(0,n);
 const sid=v=>typeof v==='string'&&v?v:null;

 const DAYS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],DAY_LONG=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
 const KIND={tarea:'Tarea',examen:'Examen',proyecto:'Proyecto'},KIND_IC={tarea:'notebook-pen',examen:'file-text',proyecto:'presentation'};
 const PALETTE=['#4f8cff','#8b6cff','#22c55e','#f59e0b','#ef4467','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6'];
 const NEUTRAL='#8a93a8';
 const col=c=>/^#[0-9a-f]{6}$/i.test(String(c||''))?String(c).toLowerCase():PALETTE[0];
 const CAP=Object.freeze({subjects:20,tasks:300,cards:500,summaries:20,side:280,logDays:120,doneDays:120,rows:8,grades:40,session:60});
 const TABS=[['hoy','Hoy','sun'],['materias','Materias','book-open'],['tareas','Tareas','list-checks'],['tarjetas','Tarjetas','layers'],['calificaciones','Calificaciones','chart-column'],['resumenes','Resúmenes','headphones']];
 const GRADES=[[1,'Otra vez','1','again'],[3,'Difícil','2','hard'],[4,'Bien','3','good'],[5,'Fácil','4','easy']];
 const STARTERS=['Matemáticas','Español','Historia','Inglés','Biología','Física','Química','Geografía'];
 const S={tab:'hoy',sub:undefined,filter:'',away:true,pendingReview:null,busy:'',draft:null,gen:null,speak:{token:0,id:null},open:new Set(),pending:new Set()};

 /* ---------------- data: preferences.school ---------------- */
 function normRow(r){const days=[...new Set(arr(r?.days).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))].sort((a,b)=>a-b);return days.length&&okTime(r?.start)&&okTime(r?.end)&&toMin(r.end)>toMin(r.start)?{days,start:r.start,end:r.end}:null;}
 const normPlace=p=>p&&typeof p==='object'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)?{name:str(p.name,120),lat:p.lat,lon:p.lon}:null;
 function normalize(raw){const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},t=today();
  const subjects=arr(r.subjects).filter(s=>s&&sid(s.id)&&str(s.name,60)).slice(0,CAP.subjects).map(s=>({...s,name:str(s.name,60),color:col(s.color),teacher:str(s.teacher,60),room:str(s.room,40),place:normPlace(s.place),schedule:arr(s.schedule).map(normRow).filter(Boolean).slice(0,CAP.rows),target:clamp(num(s.target)??80,0,100),
   grades:arr(s.grades).filter(g=>g&&sid(g.id)&&num(g.score)!=null&&num(g.max)>0).slice(0,CAP.grades).map(g=>({...g,label:str(g.label,80)||'Evaluación',score:num(g.score),max:num(g.max),weight:num(g.weight)==null?null:clamp(num(g.weight),0,100),date:isDate(g.date)?g.date:null})),agenda:!!s.agenda,agenda_ids:arr(s.agenda_ids).filter(x=>typeof x==='string')}));
  const tasks=arr(r.tasks).filter(x=>x&&sid(x.id)&&str(x.title,140)&&isDate(x.due)).map(x=>({...x,subject_id:sid(x.subject_id),title:str(x.title,140),kind:KIND[x.kind]?x.kind:'tarea',time:okTime(x.time)?x.time:null,done:!!x.done,done_at:x.done&&typeof x.done_at==='string'?x.done_at:null,grade:num(x.grade),agenda_id:sid(x.agenda_id)}));
  const cards=arr(r.cards).filter(c=>c&&sid(c.id)&&str(c.front,CAP.side)&&str(c.back,CAP.side)).map(c=>({...c,subject_id:sid(c.subject_id),front:str(c.front,CAP.side),back:str(c.back,CAP.side),ef:Math.max(1.3,num(c.ef)??2.5),interval:Math.max(0,Math.round(num(c.interval)??0)),reps:Math.max(0,Math.round(num(c.reps)??0)),lapses:Math.max(0,Math.round(num(c.lapses)??0)),due:isDate(c.due)?c.due:t,last:isDate(c.last)?c.last:null}));
  const summaries=arr(r.summaries).filter(x=>x&&sid(x.id)&&str(x.title,160)).map(x=>({...x,subject_id:sid(x.subject_id),topic:str(x.topic,200),title:str(x.title,160),points:arr(x.points).map(p=>str(p,400)).filter(Boolean).slice(0,7),script:str(x.script,1600),questions:arr(x.questions).map(q=>str(q,300)).filter(Boolean).slice(0,3),created_at:typeof x.created_at==='string'?x.created_at:''}));
  const log=r.log&&typeof r.log==='object'&&!Array.isArray(r.log)?r.log:{},src=log.reviews&&typeof log.reviews==='object'?log.reviews:{},reviews={};for(const [k,v] of Object.entries(src))if(isDate(k)&&Number(v)>0)reviews[k]=Math.round(Number(v));
  return {...r,subjects,tasks,cards,summaries,log:{...log,reviews}};}
 let memo={raw:null,d:null};
 /** Normalized, read-only view of preferences.school (memoized per saved state). */
 function data(){const raw=Store.get()?.preferences?.school;if(!memo.d||memo.raw!==raw)memo={raw,d:normalize(raw)};return memo.d;}
 function prune(d,t=today()){const cut=addDays(t,-CAP.doneDays);d.tasks=d.tasks.filter(x=>!(x.done&&String(x.done_at||x.due).slice(0,10)<cut));
  if(d.tasks.length>CAP.tasks){const drop=new Set(d.tasks.filter(x=>x.done).sort((a,b)=>String(a.done_at||a.due).localeCompare(String(b.done_at||b.due))).slice(0,d.tasks.length-CAP.tasks).map(x=>x.id));d.tasks=d.tasks.filter(x=>!drop.has(x.id)).slice(-CAP.tasks);}
  d.subjects=d.subjects.slice(0,CAP.subjects);d.cards=d.cards.slice(0,CAP.cards);d.summaries=d.summaries.slice(0,CAP.summaries);
  const lc=addDays(t,-CAP.logDays);for(const k of Object.keys(d.log.reviews))if(k<lc)delete d.log.reviews[k];return d;}
 /** One atomic save: fn(school, state) mutates a fresh normalized copy (and, if needed, state.agendaItems). */
 function save(fn){let out;Store.save(s=>{if(!s.preferences||typeof s.preferences!=='object')s.preferences={};const d=normalize(s.preferences.school);out=fn(d,s);s.preferences.school=prune(d);});return out;}
 const subjOf=(d,id)=>id?d.subjects.find(s=>s.id===id)||null:null;
 const nameOf=(d,id)=>subjOf(d,id)?.name||'';
 const byDue=(a,b)=>a.due.localeCompare(b.due)||String(a.time||'99').localeCompare(String(b.time||'99'))||a.title.localeCompare(b.title);
 const isNew=c=>!c.last&&!c.reps;

 /* ---------------- pure helpers ---------------- */
 /** SM-2 (exact). q 0–5. Every EF step is a multiple of 0.02, so rounding to 2 decimals only removes float noise. */
 function sm2(card,q,t=today()){q=clamp(Math.round(Number(q)||0),0,5);let ef=Number.isFinite(Number(card?.ef))?Number(card.ef):2.5,interval=Math.max(0,Math.round(Number(card?.interval)||0)),reps=Math.max(0,Math.round(Number(card?.reps)||0)),lapses=Math.max(0,Math.round(Number(card?.lapses)||0));
  if(q<3){reps=0;interval=1;lapses+=1;}else{reps+=1;interval=reps===1?1:reps===2?6:Math.max(1,Math.round(interval*ef));}
  ef=Math.round(Math.max(1.3,ef+(0.1-(5-q)*(0.08+(5-q)*0.02)))*100)/100;
  return {...card,ef,interval,reps,lapses,due:addDays(t,interval),last:t};}
 /** Weighted average 0–100 (score/max × weight); without weights, the simple mean. null without grades. */
 function average(s){const g=arr(s?.grades).filter(x=>num(x.score)!=null&&num(x.max)>0);if(!g.length)return null;
  const pct=x=>num(x.score)/num(x.max)*100,w=x=>Math.max(0,num(x.weight)||0),tw=g.reduce((a,x)=>a+w(x),0);
  return r1(tw>0?g.reduce((a,x)=>a+pct(x)*w(x),0)/tw:g.reduce((a,x)=>a+pct(x),0)/g.length);}
 /** What the student needs (0–100) in the remaining weight (100 − Σ weights) to reach the target.
     status: empty · no_weights · over · open · secured · impossible · reached · missed. */
 function needed(s){const target=clamp(num(s?.target)??80,0,100),g=arr(s?.grades).filter(x=>num(x.score)!=null&&num(x.max)>0),w=x=>Math.max(0,num(x.weight)||0),used=g.reduce((a,x)=>a+w(x),0);
  if(!g.length)return {status:'empty',needed:target,remaining:100,earned:0,used:0,target,max:100};
  if(used<=0)return {status:'no_weights',needed:null,remaining:null,earned:null,used:0,target,max:null};
  if(used>100+1e-9)return {status:'over',needed:null,remaining:0,earned:null,used:r1(used),target,max:null};
  const earned=g.reduce((a,x)=>a+num(x.score)/num(x.max)*w(x),0),remaining=100-used;
  if(remaining<1e-9)return {status:earned>=target-1e-9?'reached':'missed',needed:null,remaining:0,earned:r1(earned),used:r1(used),target,max:r1(earned)};
  const need=(target-earned)*100/remaining;
  return {status:need<=1e-9?'secured':need>100+1e-9?'impossible':'open',needed:need<=0?0:Math.ceil(need*10-1e-6)/10,remaining:r1(remaining),earned:r1(earned),used:r1(used),target,max:r1(earned+remaining)};}
 /** Countdown chip: «vencida», «hoy», «mañana», «en N días». */
 function countdown(due,t=today()){const n=between(t,due);return n<0?{n,label:'vencida',tone:'late'}:n===0?{n,label:'hoy',tone:'now'}:n===1?{n,label:'mañana',tone:'soon'}:{n,label:`en ${n} días`,tone:n<=3?'soon':'ok'};}
 /** «frente :: reverso» (or a tab) per line. */
 function parseBulk(text){const ok=[],bad=[];for(const raw of String(text||'').split(/\r?\n/)){const l=raw.trim();if(!l)continue;const m=l.match(/^(.*?)\s*(?:::|\t)\s*(.*)$/);if(m&&m[1].trim()&&m[2].trim())ok.push({front:m[1].trim().slice(0,CAP.side),back:m[2].trim().slice(0,CAP.side)});else bad.push(l);}return {ok,bad};}
 /** Text-to-speech parts: sentence boundaries, ≤ 560 chars each, ≤ 12 parts (same rule as the chat). */
 function chunks(text){const parts=[];let cur='';for(const s of String(text||'').split(/(?<=[.!?])\s+/)){if((cur+' '+s).length>560){if(cur)parts.push(cur);cur=s.slice(0,560);}else cur=cur?cur+' '+s:s;}if(cur)parts.push(cur);return parts.slice(0,12);}
 function daysLabel(days){const d=[...days].sort((a,b)=>a-b);if(d.length>=3&&d.every((x,i)=>!i||x===d[i-1]+1))return `${DAYS[d[0]]} a ${DAYS[d[d.length-1]]}`;return d.map(x=>DAYS[x]).join(' · ');}
 function streak(d,t=today()){let k=d.log.reviews[t]?t:addDays(t,-1),n=0;while(d.log.reviews[k]>0&&n<CAP.logDays){n++;k=addDays(k,-1);}return n;}
 const overall=d=>{const v=d.subjects.map(average).filter(x=>x!=null);return v.length?r1(v.reduce((a,b)=>a+b,0)/v.length):null;};
 const nextExam=(d,t,subject=null)=>d.tasks.filter(x=>!x.done&&x.kind==='examen'&&x.due>=t&&(!subject||x.subject_id===subject)).sort(byDue)[0]||null;
 const inDeck=(d,c,deck)=>!deck||(deck==='none'?!subjOf(d,c.subject_id):c.subject_id===deck);
 /** Review queue: due cards (learned first, oldest first, then new ones), capped per session. */
 function queue(d,deck=null,t=today()){return d.cards.filter(c=>c.due<=t&&inDeck(d,c,deck)).sort((a,b)=>(isNew(a)-isNew(b))||a.due.localeCompare(b.due)).slice(0,CAP.session).map(c=>c.id);}
 function decks(d,t=today()){const list=d.subjects.map(s=>({id:s.id,name:s.name,color:s.color,cards:d.cards.filter(c=>c.subject_id===s.id)})),loose=d.cards.filter(c=>!subjOf(d,c.subject_id));if(loose.length)list.push({id:'none',name:'General',color:NEUTRAL,cards:loose});
  return list.map(x=>({...x,total:x.cards.length,due:x.cards.filter(c=>c.due<=t&&!isNew(c)).length,fresh:x.cards.filter(isNew).length,today:x.cards.filter(c=>c.due<=t).length}));}

 /* ---------------- Agenda ---------------- */
 /** Profile timezone when the Agenda accepts it (Recurrence only accepts America/Mexico_City today). */
 function zone(){const z=window.EvieProfile?.current?.()?.timezone||Store.get()?.profile?.timezone;if(!z||z==='America/Mexico_City'||!window.Recurrence?.validate)return 'America/Mexico_City';try{Recurrence.validate({frequency:'weekly',interval:1,timezone:z,time_local:null,days_of_week:[],day_of_month:null,end_date:null});return z;}catch{return 'America/Mexico_City';}}
 const firstDay=(days,t)=>{for(let k=0;k<7;k++){const d=addDays(t,k);if(days.includes(dowOf(d)))return d;}return t;};
 /** Weekly recurring «time_block» items, one per schedule row (not saved). */
 function agendaItemsFor(subject,t=today()){const now=new Date().toISOString(),tz=zone(),notes=[str(subject?.teacher,60),subject?.room?'Salón '+str(subject.room,40):''].filter(Boolean).join(' · ');
  return arr(subject?.schedule).map(normRow).filter(Boolean).map(r=>{const first=firstDay(r.days,t),dur=toMin(r.end)-toMin(r.start);
   return {...RCData.defaults('agendaItems'),id:uid(),title:str(subject.name,60)||'Clase',kind:'time_block',area:'school',status:'scheduled',all_day:false,start_at:Agenda.toTimestamp(first+'T'+r.start),due_at:null,duration_minutes:dur>0?dur:50,notes,recurrence:{frequency:'weekly',interval:1,timezone:tz,time_local:r.start,days_of_week:r.days.slice(),day_of_month:null,end_date:null},history:[],source:'school',created_at:now,updated_at:now};});}
 const taskTitle=(x,s)=>`${KIND[x.kind]||'Tarea'}: ${x.title}${s?' · '+s.name:''}`;
 const taskStamp=x=>Agenda.toTimestamp(x.due+'T'+(x.time||'23:59'));
 function taskAgendaItem(x,s){const now=new Date().toISOString();return {...RCData.defaults('agendaItems'),id:uid(),title:taskTitle(x,s),kind:'task',area:'school',status:'scheduled',priority:x.kind==='examen'?'high':'medium',all_day:!x.time,start_at:null,due_at:taskStamp(x),duration_minutes:null,recurrence:null,notes:'Desde Escuela.',history:[],source:'school',created_at:now,updated_at:now};}
 const live=(st,id)=>id&&Array.isArray(st?.agendaItems)?st.agendaItems.find(r=>r.id===id&&!r.deleted_at)||null:null;
 /** Same effect as Store.remove('agendaItems', id), inside the current save. */
 function dropAgenda(st,ids){const now=new Date().toISOString();for(const id of arr(ids)){const r=live(st,id);if(r){r.deleted_at=now;r.updated_at=now;}}}
 function undropAgenda(st,ids){const now=new Date().toISOString();for(const id of arr(ids)){const r=Array.isArray(st?.agendaItems)?st.agendaItems.find(x=>x.id===id):null;if(r?.deleted_at){delete r.deleted_at;r.updated_at=now;}}}
 function agendaDone(st,id,done){if(!live(st,id)||!window.Agenda)return;try{if(done)Agenda.complete(st,id);else Agenda.reopen(st,id);}catch{}}
 const agendaAlive=id=>!!id&&!!Store.list?.('agendaItems')?.some(r=>r.id===id);

 /* ---------------- public read API ---------------- */
 function classRows(d,dow){return d.subjects.flatMap(s=>s.schedule.map((r,i)=>({s,r,i})).filter(x=>x.r.days.includes(dow))).sort((a,b)=>toMin(a.r.start)-toMin(b.r.start)||a.s.name.localeCompare(b.s.name));}
 /** Classes of a weekday as fixed commitments (same shape the morning briefing uses). */
 function classesOn(dow=dowOf(today())){return classRows(data(),Number(dow)).map(({s,r,i})=>({id:s.id+'-'+i,label:s.name,time:r.start,end:r.end,days:r.days.slice(),place:s.place?{...s.place}:null,alert:true,buffer:5}));}
 function summary(){const d=data(),t=today(),open=d.tasks.filter(x=>!x.done),ex=nextExam(d,t),wk=addDays(t,7);
  return {today:classesOn(dowOf(t)).map(c=>({label:c.label,time:c.time,end:c.end})),tasksDue7:open.filter(x=>x.due>=t&&x.due<=wk).length,overdue:open.filter(x=>x.due<t).length,nextExam:ex?{title:ex.title,subject:nameOf(d,ex.subject_id),due:ex.due,days:between(t,ex.due)}:null,cardsDue:d.cards.filter(c=>c.due<=t).length,average:overall(d)};}
 /** Done tasks and reviews inside [from, to]; exams in the next 7 days from today. */
 function weekStats(from,to){const d=data(),t=today(),f=isDate(from)?from:addDays(t,-6),u=isDate(to)?to:t,wk=addDays(t,7),day=at=>{try{return Domain.today(new Date(at));}catch{return String(at).slice(0,10);}};
  return {tasksDone:d.tasks.filter(x=>x.done&&x.done_at&&(k=>k>=f&&k<=u)(day(x.done_at))).length,reviews:Object.entries(d.log.reviews).filter(([k])=>k>=f&&k<=u).reduce((a,[,v])=>a+v,0),examsNext7:d.tasks.filter(x=>!x.done&&x.kind==='examen'&&x.due>=t&&x.due<=wk).sort(byDue).map(x=>({title:x.title,subject:nameOf(d,x.subject_id),due:x.due})),average:overall(d)};}

 /* ---------------- page ---------------- */
 function view(sub){try{if(S.away||sub!==S.sub){S.sub=sub;if(sub&&TABS.some(x=>x[0]===sub))S.tab=sub;}
   const d=data(),sm=summary(),n=sm.today.length;
   const subtitle=d.subjects.length?`${cap1(dateText(today()))} · ${n?n+' '+plural(n,'clase','clases')+' hoy':'sin clases hoy'}${sm.tasksDue7?` · ${sm.tasksDue7} ${plural(sm.tasksDue7,'entrega','entregas')} en 7 días`:''}`:'Tus clases, tareas, tarjetas y calificaciones en un solo lugar.';
   const actions=`<button type="button" class="button primary" data-es="task-add">${ic('plus')}Tarea</button>${sm.cardsDue?`<button type="button" class="button" data-es="review">${ic('layers')}Repasar · ${sm.cardsDue}</button>`:''}`;
   return Views.heading('Escuela',e(subtitle),actions,'ESCUELA')+`<div class="es" id="es-root">${tabsHtml(d)}<div class="es-body" id="es-body" role="tabpanel" aria-labelledby="es-tab-${S.tab}" tabindex="-1">${bodyHtml(d)}</div></div>`;}
  catch(err){console.warn('EVIE escuela',err);return Views.heading('Escuela','No pude abrir Escuela ahora.','','ESCUELA')+`<p class="es-empty">${e(err?.message||'Error')}</p>`;}}
 function tabsHtml(d){const t=today(),late=d.tasks.filter(x=>!x.done&&x.due<t).length,due=d.cards.filter(c=>c.due<=t).length;
  const badge=k=>k==='tareas'&&late?`<b class="es-tab-n" data-tone="late">${late}<span class="sr-only"> vencidas</span></b>`:k==='tarjetas'&&due?`<b class="es-tab-n">${due}<span class="sr-only"> para hoy</span></b>`:'';
  return `<nav class="es-tabs" role="tablist" aria-label="Secciones de Escuela">${TABS.map(([k,l,i])=>`<button type="button" role="tab" id="es-tab-${k}" data-es="tab" data-tab="${k}" aria-selected="${S.tab===k}" aria-controls="es-body" tabindex="${S.tab===k?0:-1}">${ic(i)}<span>${l}</span>${badge(k)}</button>`).join('')}</nav>`;}
 function bodyHtml(d=data()){const t=S.tab;return t==='materias'?subjectsView(d):t==='tareas'?tasksView(d):t==='tarjetas'?cardsView(d):t==='calificaciones'?gradesView(d):t==='resumenes'?summariesView(d):todayView(d);}
 const blank=(icon,title,text,extra='')=>`<section class="panel es-card es-anim es-blank"><span class="es-blank-ic" aria-hidden="true">${ic(icon)}</span><h3>${title}</h3><p class="es-muted">${text}</p>${extra}</section>`;

 /* Hoy */
 function todayView(d){const t=today();
  if(!d.subjects.length&&!d.tasks.length&&!d.cards.length)return `<section class="panel es-card es-anim es-onb"><span class="es-blank-ic" aria-hidden="true">${ic('graduation-cap')}</span><h3>Arma tu semana escolar</h3><p class="es-muted">Tres pasos y Escuela te dice qué toca hoy.</p><ol class="es-steps">${[['subj-add','Materias y horario','Con color, salón y bloques en tu Agenda.'],['task-add','Tareas y exámenes','Con cuenta regresiva y pendiente en la Agenda.'],['card-add','Tarjetas de repaso','Repaso espaciado: estudias justo antes de olvidar.']].map(([a,h,s],i)=>`<li><button type="button" data-es="${a}"><b>${i+1}</b><span><strong>${h}</strong><small>${s}</small></span>${ic('chevron-right')}</button></li>`).join('')}</ol></section>`;
  const rows=classRows(d,dowOf(t)),m=nowMin(),open=d.tasks.filter(x=>!x.done),soon=open.filter(x=>x.due<=addDays(t,7)).sort(byDue),dueCards=d.cards.filter(c=>c.due<=t),fresh=dueCards.filter(isNew).length,avg=overall(d),st=streak(d,t);let nextShown=false;
  const tl=rows.map(({s,r})=>{const a=toMin(r.start),b=toMin(r.end),state=m>=a&&m<b?'now':m<a?'next':'past',first=state==='next'&&!nextShown;if(first)nextShown=true;
   const pill=state==='now'?'<span class="es-pill is-now">Ahora</span>':first&&a-m<=120?`<span class="es-pill">En ${a-m} min</span>`:'';
   return `<li class="es-tl" data-state="${state}" style="--c:${col(s.color)}"><time datetime="${r.start}">${r.start}<small>${r.end}</small></time><i class="es-tl-dot" aria-hidden="true"></i><div class="es-tl-main"><strong>${e(s.name)}</strong>${s.room||s.teacher?`<small>${[s.room?'Salón '+e(s.room):'',e(s.teacher)].filter(Boolean).join(' · ')}</small>`:''}</div>${pill}</li>`;}).join('');
  return `<div class="es-grid">
   <section class="panel es-card es-anim es-span-7"><header class="es-ch"><h3>${ic('calendar-clock')}Clases de hoy</h3><span class="es-muted">${e(cap1(dateText(t,{weekday:'long',day:'numeric',month:'short'})))}</span></header>${rows.length?`<ol class="es-timeline">${tl}</ol>`:`<p class="es-empty">${d.subjects.length?'Hoy no tienes clases. Buen día para adelantar.':'Agrega tus materias con su horario para verlas aquí.'}</p>${d.subjects.length?'':`<div class="es-act"><button type="button" class="button small" data-es="subj-add">${ic('plus')}Materia</button></div>`}`}</section>
   ${examCard(d,nextExam(d,t),t)}
   <section class="panel es-card es-anim es-span-7"><header class="es-ch"><h3>${ic('list-checks')}Entregas · próximos 7 días</h3><button type="button" class="button small" data-es="task-add">${ic('plus')}Tarea</button></header>${soon.length?`<ul class="es-tasks">${soon.map(x=>taskRow(d,x,t)).join('')}</ul>`:'<p class="es-empty">Nada pendiente para los próximos 7 días.</p>'}</section>
   <section class="panel es-card es-anim es-span-5 es-due"><header class="es-ch"><h3>${ic('layers')}Tarjetas</h3>${st?`<span class="es-pill is-streak">${ic('flame')}${st} ${plural(st,'día','días')}</span>`:''}</header><div class="es-due-n"><strong>${dueCards.length}</strong><span>${plural(dueCards.length,'tarjeta para hoy','tarjetas para hoy')}${fresh?`<small>${fresh} ${plural(fresh,'nueva','nuevas')}</small>`:''}</span></div><div class="es-act"><button type="button" class="button primary es-wide" data-es="review" ${dueCards.length?'':'disabled'}>${ic('play')}${dueCards.length?'Repasar':'Al día'}</button><button type="button" class="button" data-es="card-add">${ic('plus')}Tarjeta</button></div>${avg!=null?`<p class="es-muted">Promedio general: <b>${fmt(avg)}</b></p>`:''}</section>
  </div>`;}
 function examCard(d,x,t){if(!x)return `<section class="panel es-card es-anim es-span-5 es-exam is-empty"><header class="es-ch"><h3>${ic('file-text')}Próximo examen</h3></header><p class="es-empty">Sin exámenes a la vista.</p><div class="es-act"><button type="button" class="button small" data-es="task-add" data-kind="examen">${ic('plus')}Examen</button></div></section>`;
  const s=subjOf(d,x.subject_id),n=between(t,x.due),due=s?d.cards.filter(c=>c.subject_id===s.id&&c.due<=t).length:0;
  return `<section class="panel es-card es-anim es-span-5 es-exam" style="--c:${col(s?.color||PALETTE[1])}"><span class="es-glow" aria-hidden="true"></span><span class="es-eyebrow">PRÓXIMO EXAMEN</span><div class="es-exam-row"><div class="es-exam-main"><h3>${e(x.title)}</h3><p>${s?`<span class="es-sub"><i class="es-dot" aria-hidden="true"></i>${e(s.name)}</span>`:''}<span>${e(cap1(dateText(x.due)))}${x.time?' · '+x.time:''}</span></p></div><div class="es-exam-n"><strong>${n===0?'Hoy':n===1?'Mañana':n}</strong>${n>1?'<small>días</small>':''}</div></div>
   <div class="es-act">${s?due?`<button type="button" class="button small primary" data-es="review" data-deck="${e(s.id)}">${ic('layers')}Repasar · ${due}</button>`:`<button type="button" class="button small" data-es="card-add" data-deck="${e(s.id)}">${ic('plus')}Tarjetas de ${e(s.name)}</button>`:''}<button type="button" class="button small" data-es="task-edit" data-id="${e(x.id)}">${ic('pencil')}Editar</button></div></section>`;}
 function taskRow(d,x,t=today()){const s=subjOf(d,x.subject_id),cd=countdown(x.due,t);
  return `<li class="es-task${x.done?' is-done':''}" style="--c:${col(s?.color||NEUTRAL)}"><button type="button" class="es-check" data-es="task-toggle" data-id="${e(x.id)}" aria-pressed="${x.done}" aria-label="${x.done?'Marcar como pendiente':'Marcar como hecha'}: ${e(x.title)}">${ic('check')}</button><button type="button" class="es-task-main" data-es="task-edit" data-id="${e(x.id)}"><strong>${e(x.title)}</strong><small><span class="es-kind" data-kind="${x.kind}">${ic(KIND_IC[x.kind])}${KIND[x.kind]}</span>${s?`<span class="es-sub"><i class="es-dot" aria-hidden="true"></i>${e(s.name)}</span>`:''}${x.done?'':`<span>${e(dateText(x.due,{weekday:'short',day:'numeric',month:'short'}))}${x.time?' · '+x.time:''}</span>`}</small></button>${x.done?'':`<span class="es-due" data-tone="${cd.tone}">${cd.label}</span>`}</li>`;}

 /* Materias */
 function subjectsView(d){if(!d.subjects.length)return blank('book-open','Agrega tu primera materia','Con su horario, Escuela arma tu día y puede bloquear tus clases en la Agenda.',`<div class="es-starters">${STARTERS.map(n=>`<button type="button" class="es-fchip" data-es="subj-add" data-name="${e(n)}">${ic('plus')}${e(n)}</button>`).join('')}</div><div class="es-act"><button type="button" class="button primary" data-es="subj-add">${ic('plus')}Nueva materia</button></div>`);
  return `<div class="es-bar"><p class="es-muted">${d.subjects.length} ${plural(d.subjects.length,'materia','materias')} · toca una para editarla.</p><button type="button" class="button primary" data-es="subj-add" ${d.subjects.length>=CAP.subjects?'disabled':''}>${ic('plus')}Nueva materia</button></div><div class="es-subjects">${d.subjects.map(s=>subjectCard(d,s)).join('')}</div>`;}
 function subjectCard(d,s){const avg=average(s),open=d.tasks.filter(x=>x.subject_id===s.id&&!x.done).length,cards=d.cards.filter(c=>c.subject_id===s.id).length;
  return `<article class="panel es-card es-anim es-subj" style="--c:${s.color}" data-es="subj-edit" data-id="${e(s.id)}"><span class="es-stripe" aria-hidden="true"></span><header class="es-ch"><h3><button type="button" class="es-name" data-es="subj-edit" data-id="${e(s.id)}"><i class="es-dot" aria-hidden="true"></i>${e(s.name)}</button></h3><button type="button" class="es-icon" data-es="subj-edit" data-id="${e(s.id)}" aria-label="Editar ${e(s.name)}">${ic('pencil')}</button></header>
   ${s.teacher||s.room?`<p class="es-meta">${s.teacher?`<span>${ic('user-round')}${e(s.teacher)}</span>`:''}${s.room?`<span>${ic('door-open')}Salón ${e(s.room)}</span>`:''}</p>`:''}
   <div class="es-chips">${s.schedule.length?s.schedule.map(r=>`<span class="es-chip">${e(daysLabel(r.days))} · ${r.start}–${r.end}</span>`).join(''):'<span class="es-chip is-ghost">Sin horario</span>'}${s.agenda&&s.agenda_ids.length?`<span class="es-chip is-agenda">${ic('calendar-check')}En Agenda</span>`:''}</div>
   <footer class="es-subj-foot"><div class="es-avg"><strong>${fmt(avg)}</strong><small>promedio · meta ${fmt(s.target)}</small></div><div class="es-meter" style="--p:${avg==null?0:clamp(avg,0,100)};--t:${clamp(s.target,0,100)}" aria-hidden="true"><i></i><b></b></div><p class="es-muted">${open} ${plural(open,'pendiente','pendientes')} · ${cards} ${plural(cards,'tarjeta','tarjetas')}</p></footer></article>`;}

 /* Tareas */
 function tasksView(d){const t=today(),wk=addDays(t,7),f=S.filter&&subjOf(d,S.filter)?S.filter:'',mine=d.tasks.filter(x=>!f||x.subject_id===f),open=mine.filter(x=>!x.done).sort(byDue),done=mine.filter(x=>x.done).sort((a,b)=>String(b.done_at||'').localeCompare(String(a.done_at||'')));
  if(!d.tasks.length)return blank('list-checks','Sin tareas todavía','Anota tareas, exámenes y proyectos con su fecha: verás la cuenta regresiva y, si quieres, quedan en tu Agenda.',`<div class="es-act"><button type="button" class="button primary" data-es="task-add">${ic('plus')}Nueva tarea</button></div>`);
  const chips=d.subjects.length?`<div class="es-filter" role="group" aria-label="Filtrar por materia"><button type="button" class="es-fchip" data-es="filter" data-id="" aria-pressed="${!f}">Todas</button>${d.subjects.map(s=>`<button type="button" class="es-fchip" data-es="filter" data-id="${e(s.id)}" aria-pressed="${f===s.id}" style="--c:${s.color}"><i class="es-dot" aria-hidden="true"></i>${e(s.name)}</button>`).join('')}</div>`:'<span></span>';
  const groups=[['late','Vencidas',open.filter(x=>x.due<t)],['week','Esta semana',open.filter(x=>x.due>=t&&x.due<=wk)],['later','Después',open.filter(x=>x.due>wk)]].filter(g=>g[2].length);
  return `<div class="es-bar">${chips}<button type="button" class="button primary" data-es="task-add">${ic('plus')}Nueva tarea</button></div>
   ${groups.map(([k,l,list])=>`<section class="panel es-card es-anim es-group" data-group="${k}"><header class="es-ch"><h3>${l}<b class="es-count">${list.length}</b></h3></header><ul class="es-tasks">${list.map(x=>taskRow(d,x,t)).join('')}</ul></section>`).join('')}
   ${open.length?'':`<p class="es-empty es-anim">${f?'Nada pendiente en esta materia.':'Todo entregado. Nada pendiente.'}</p>`}
   ${done.length?`<details class="panel es-card es-anim es-group es-done" data-open-key="done" ${S.open.has('done')?'open':''}><summary class="es-ch"><h3>Hechas<b class="es-count">${done.length}</b></h3>${ic('chevron-down')}</summary><ul class="es-tasks">${done.slice(0,30).map(x=>taskRow(d,x,t)).join('')}</ul>${done.length>30?'<p class="es-muted">Se muestran las 30 más recientes. Las hechas se limpian solas a los 120 días.</p>':''}</details>`:''}`;}

 /* Tarjetas */
 function cardsView(d){const t=today(),due=d.cards.filter(c=>c.due<=t),freshDue=due.filter(isNew).length,st=streak(d,t),c=cloud();
  const tools=`<div class="es-tools"><button type="button" class="button" data-es="card-add">${ic('plus')}Tarjeta</button><button type="button" class="button" data-es="card-bulk">${ic('list-plus')}Varias</button>${c?`<button type="button" class="button" data-es="card-gen">${ic('sparkles')}Generar con Ivi</button>`:''}</div>`;
  if(!d.cards.length)return blank('layers','Tus tarjetas de repaso','Pregunta al frente, respuesta atrás. Escuela te las muestra justo antes de que se te olviden (repaso espaciado).',tools+(c?'':'<p class="es-muted">Inicia sesión para que Ivi las genere con tus apuntes.</p>'));
  return `<section class="panel es-card es-anim es-hero"><span class="es-glow" aria-hidden="true"></span><div class="es-hero-main"><span class="es-eyebrow">PARA HOY</span><div class="es-due-n"><strong>${due.length}</strong><span>${plural(due.length,'tarjeta','tarjetas')}${freshDue?`<small>${freshDue} ${plural(freshDue,'nueva','nuevas')}</small>`:''}</span></div></div><div class="es-hero-side"><button type="button" class="button primary es-wide" data-es="review" ${due.length?'':'disabled'}>${ic('play')}${due.length?'Repasar todo':'Al día'}</button>${st?`<span class="es-pill is-streak">${ic('flame')}Racha de ${st} ${plural(st,'día','días')}</span>`:'<span class="es-muted">Repasa hoy para empezar tu racha.</span>'}</div></section>
   <div class="es-bar">${tools}<p class="es-muted">${d.cards.length} de ${CAP.cards} tarjetas</p></div>
   <div class="es-decks">${decks(d,t).map(x=>deckCard(x,t)).join('')}</div>`;}
 function deckCard(x,t){const k='deck:'+x.id;
  return `<article class="panel es-card es-anim es-deck" style="--c:${col(x.color)}"><span class="es-stripe" aria-hidden="true"></span><header class="es-ch"><h3><i class="es-dot" aria-hidden="true"></i>${e(x.name)}</h3><button type="button" class="es-icon" data-es="card-add" data-deck="${e(x.id)}" aria-label="Agregar tarjeta a ${e(x.name)}">${ic('plus')}</button></header>
   <dl class="es-counts"><div><dt>Total</dt><dd>${x.total}</dd></div><div><dt>Pendientes</dt><dd>${x.due}</dd></div><div><dt>Nuevas</dt><dd>${x.fresh}</dd></div></dl>
   <div class="es-act"><button type="button" class="button small primary es-wide" data-es="review" data-deck="${e(x.id)}" ${x.today?'':'disabled'}>${ic('play')}${x.today?'Repasar · '+x.today:'Al día'}</button></div>
   ${x.total?`<details class="es-list" data-open-key="${e(k)}" ${S.open.has(k)?'open':''}><summary>${ic('chevron-down')}Ver ${x.total} ${plural(x.total,'tarjeta','tarjetas')}</summary><ul>${x.cards.slice(0,150).map(c=>`<li><button type="button" class="es-li-main" data-es="card-edit" data-id="${e(c.id)}"><strong>${e(c.front)}</strong><small>${e(c.back)}</small></button><span class="es-li-meta">${isNew(c)?'Nueva':c.due<=t?'Hoy':e(dateText(c.due,{day:'numeric',month:'short'}))}</span><button type="button" class="es-icon" data-es="card-del" data-id="${e(c.id)}" aria-label="Borrar tarjeta">${ic('trash-2')}</button></li>`).join('')}</ul>${x.total>150?'<p class="es-muted">Se muestran las primeras 150.</p>':''}</details>`:''}</article>`;}

 /* Calificaciones */
 const tone=(p,t)=>p>=t?'good':p>=t-10?'warn':'bad';
 const NEED_IC={open:'target',secured:'badge-check',reached:'trophy',impossible:'circle-alert',missed:'circle-x',over:'circle-alert',no_weights:'info',empty:'info'};
 function needText(n){const T=fmt(n.target);switch(n.status){
  case 'open':return `Necesitas <b>${fmt(n.needed)}</b> en lo que falta (${fmt(n.remaining)} % del curso) para llegar a ${T}.`;
  case 'secured':return `Meta asegurada: aunque saques 0 en lo que falta, terminas con al menos <b>${fmt(n.earned)}</b> (meta ${T}).`;
  case 'impossible':return `Ya no alcanzas ${T} ni con 100 en lo que falta: lo máximo posible es <b>${fmt(n.max)}</b>. Pregunta por puntos extra.`;
  case 'reached':return `Meta lograda: terminaste con <b>${fmt(n.earned)}</b> (meta ${T}).`;
  case 'missed':return `Ya no quedan evaluaciones: terminaste con <b>${fmt(n.earned)}</b> (meta ${T}).`;
  case 'over':return `Los pesos suman ${fmt(n.used)} %: revísalos, el máximo es 100 %.`;
  case 'no_weights':return 'Agrega el peso (%) de cada evaluación para calcular cuánto necesitas.';
  default:return `Sin calificaciones aún: para llegar a ${T} necesitas ${T} de promedio en todo el curso.`;}}
 function gradesView(d){if(!d.subjects.length)return blank('chart-column','Calificaciones','Agrega tus materias para llevar tu promedio ponderado y saber cuánto necesitas en lo que falta.',`<div class="es-act"><button type="button" class="button primary" data-es="subj-add">${ic('plus')}Nueva materia</button></div>`);
  const avg=overall(d),graded=d.subjects.filter(s=>average(s)!=null).length;
  return `<section class="panel es-card es-anim es-overall"><div class="es-ring" style="--p:${avg==null?0:clamp(avg,0,100)}" role="img" aria-label="Promedio general: ${avg==null?'sin datos':fmt(avg)}"><strong>${fmt(avg)}</strong></div><div><span class="es-eyebrow">PROMEDIO GENERAL</span><h3>${avg==null?'Aún sin calificaciones':avg>=90?'¡Excelente!':avg>=80?'Vas muy bien':avg>=70?'Vas bien; puedes subir':'Hay que reforzar'}</h3><p class="es-muted">${graded} de ${d.subjects.length} ${plural(d.subjects.length,'materia','materias')} con calificaciones · escala 0–100 (8 de 10 = 80).</p></div></section>
   <div class="es-gsubjects">${d.subjects.map(gradeCard).join('')}</div>`;}
 function gradeCard(s){const avg=average(s),n=needed(s),used=s.grades.reduce((a,g)=>a+Math.max(0,num(g.weight)||0),0);
  return `<section class="panel es-card es-anim es-gcard" style="--c:${s.color}"><span class="es-stripe" aria-hidden="true"></span><header class="es-ch"><h3><i class="es-dot" aria-hidden="true"></i>${e(s.name)}</h3><div class="es-gavg"><strong data-tone="${avg==null?'':tone(avg,s.target)}">${fmt(avg)}</strong><label class="es-target"><span>Meta</span><input class="input" type="number" min="0" max="100" step="1" inputmode="numeric" value="${fmt(s.target)}" data-es-change="target" data-id="${e(s.id)}" aria-label="Meta de ${e(s.name)}"></label></div></header>
   ${used>0?`<div class="es-wbar" aria-hidden="true">${s.grades.filter(g=>num(g.weight)>0).map(g=>`<i style="--w:${clamp(num(g.weight),0,100)}" data-tone="${tone(g.score/g.max*100,s.target)}"></i>`).join('')}</div><p class="es-wlabel">Evaluado: ${fmt(Math.min(used,100))} % del curso${used<100?` · falta ${fmt(100-used)} %`:''}</p>`:''}
   ${s.grades.length?`<ul class="es-grades">${s.grades.map(g=>`<li><button type="button" class="es-li-main" data-es="grade-edit" data-id="${e(s.id)}" data-grade="${e(g.id)}"><strong>${e(g.label)}</strong>${g.date||num(g.weight)>0?`<small>${g.date?e(dateText(g.date,{day:'numeric',month:'short'})):''}${num(g.weight)>0?`<span class="es-gw-in">${g.date?' · ':''}${fmt(g.weight)} %</span>`:''}</small>`:''}</button><span class="es-gscore">${fmt(g.score)}<small>/${fmt(g.max)}</small></span><span class="es-gw" title="Peso">${num(g.weight)>0?fmt(g.weight)+' %':'—'}</span><span class="es-gpct" data-tone="${tone(g.score/g.max*100,s.target)}">${fmt(g.score/g.max*100)}</span><button type="button" class="es-icon" data-es="grade-del" data-id="${e(s.id)}" data-grade="${e(g.id)}" aria-label="Borrar ${e(g.label)}">${ic('x')}</button></li>`).join('')}</ul>`:''}
   <form class="es-gform" data-es-form="grade" data-id="${e(s.id)}" autocomplete="off" novalidate><input class="input" name="label" maxlength="80" placeholder="Evaluación (ej. Parcial 1)" aria-label="Evaluación"><input class="input" name="score" type="number" step="any" min="0" inputmode="decimal" placeholder="Calif." aria-label="Calificación obtenida"><span class="es-of" aria-hidden="true">/</span><input class="input" name="max" type="number" step="any" min="0" inputmode="decimal" value="10" aria-label="Calificación máxima"><input class="input" name="weight" type="number" step="any" min="0" max="100" inputmode="decimal" placeholder="Peso %" aria-label="Peso en porcentaje del curso"><button class="button primary es-gadd" aria-label="Agregar calificación a ${e(s.name)}">${ic('plus')}</button></form>
   <p class="es-need" data-status="${n.status}">${ic(NEED_IC[n.status]||'target')}<span>${needText(n)}</span></p></section>`;}

 /* Resúmenes */
 function summariesView(d){const c=cloud(),dr=S.draft||{},busy=S.busy==='summary';
  const form=c?`<form class="panel es-card es-anim es-sumform" data-es-form="summary" autocomplete="off" novalidate><header class="es-ch"><h3>${ic('sparkles')}Nuevo resumen con Ivi</h3></header><div class="es-row2">${subjectSelect(d,dr.subject??(S.filter||d.subjects[0]?.id||''),'subject')}${field('topic','Tema',dr.topic||'','text','maxlength="200" placeholder="Ej. Fracciones equivalentes"')}</div>${area('notes','Apuntes (opcional)',dr.notes||'','rows="4" maxlength="4000" placeholder="Pega tus apuntes para que Ivi se base en ellos."')}<div class="es-act es-act-split"><p class="es-muted">Ideas clave, un guion para escuchar y preguntas para comprobar.</p><button class="button primary${busy?' is-busy':''}" ${busy?'disabled':''}>${ic('wand-sparkles')}${busy?'Preparando…':'Crear resumen'}</button></div></form>`
   :`<section class="panel es-card es-anim es-note">${ic('lock')}<p>Inicia sesión para que Ivi prepare resúmenes en audio. Los que ya guardaste se escuchan aquí.</p></section>`;
  const skel=busy?`<div class="panel es-card es-skel" aria-live="polite"><span></span><span></span><span></span><p class="es-muted">Ivi está preparando tu resumen…</p></div>`:'';
  return form+skel+(d.summaries.length?`<div class="es-sums">${d.summaries.map(x=>sumCard(d,x)).join('')}</div>`:(c?'<p class="es-empty es-anim">Tus resúmenes guardados aparecen aquí para escucharlos cuando quieras.</p>':''));}
 function sumCard(d,x){const s=subjOf(d,x.subject_id),k='sum:'+x.id,playing=S.speak.id===x.id;
  return `<details class="panel es-card es-anim es-sum" style="--c:${col(s?.color||PALETTE[1])}" data-open-key="${e(k)}" ${S.open.has(k)?'open':''}><summary class="es-ch"><span class="es-sum-h"><strong>${e(x.title)}</strong><small>${s?`<span class="es-sub"><i class="es-dot" aria-hidden="true"></i>${e(s.name)}</span>`:''}${x.topic&&norm(x.topic)!==norm(x.title)?`<span>${e(x.topic)}</span>`:''}${x.created_at?`<span>${e(dateText(x.created_at.slice(0,10),{day:'numeric',month:'short'}))}</span>`:''}</small></span>${ic('chevron-down')}</summary>
   <div class="es-sum-body"><ul class="es-points">${x.points.map(p=>`<li>${e(p)}</li>`).join('')}</ul>${x.questions.length?`<h4>Para comprobar</h4><ol class="es-qs">${x.questions.map(q=>`<li>${e(q)}</li>`).join('')}</ol>`:''}
   <div class="es-act"><button type="button" class="button primary" data-es="sum-play" data-id="${e(x.id)}" aria-pressed="${playing}">${playing?ic('square')+'Detener':ic('volume-2')+'Escuchar'}</button><button type="button" class="button" data-es="sum-del" data-id="${e(x.id)}">${ic('trash-2')}Borrar</button></div></div></details>`;}

 /* ---------------- dialogs ---------------- */
 const field=(name,label,value='',type='text',extra='')=>`<label class="es-field"><span>${label}</span><input class="input" name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
 const area=(name,label,value='',extra='')=>`<label class="es-field"><span>${label}</span><textarea class="input" name="${name}" ${extra}>${e(value)}</textarea></label>`;
 const sw=(name,label,hint,on)=>`<label class="es-switch"><input type="checkbox" name="${name}" ${on?'checked':''}><span class="es-switch-ui" aria-hidden="true"></span><span><strong>${label}</strong><small>${hint}</small></span></label>`;
 const subjectSelect=(d,cur,name='subject_id')=>`<label class="es-field"><span>Materia</span><select class="select" name="${name}">${d.subjects.map(s=>`<option value="${e(s.id)}" ${cur===s.id?'selected':''}>${e(s.name)}</option>`).join('')}<option value="" ${cur&&subjOf(d,cur)?'':'selected'}>Sin materia</option></select></label>`;
 function dialog(title,inner,{submit='Guardar',left=''}={}){App.openDialog(title,`<form id="es-form" class="es-form" novalidate>${inner}<p class="es-error" role="alert" hidden></p><div class="form-footer es-footer">${left?`<div class="es-left">${left}</div>`:''}<button type="button" class="button" data-action="close-dialog">Cancelar</button><button type="submit" class="button primary">${ic('check')}${submit}</button></div></form>`);return document.getElementById('es-form');}
 /** Submit wiring: fn(values, form, submitter) may be async; return false to keep the dialog open. */
 function bind(f,fn){if(!f)return;f.onsubmit=async ev=>{ev.preventDefault();const er=f.querySelector('.es-error'),btn=ev.submitter||f.querySelector('[type=submit]');er.hidden=true;if(btn){btn.disabled=true;btn.classList.add('is-busy');}
  try{const r=await fn(Object.fromEntries(new FormData(f)),f,ev.submitter||null);if(r!==false){App.closeDialog(true);App.render();}}catch(x){er.hidden=false;er.textContent=x?.message||'Revisa los datos.';}finally{if(btn?.isConnected){btn.disabled=false;btn.classList.remove('is-busy');}}};}
 const schedRow=(r={})=>`<div class="es-srow"><div class="es-days" role="group" aria-label="Días">${[1,2,3,4,5,6].map(k=>`<label><input type="checkbox" value="${k}" ${arr(r.days).includes(k)?'checked':''} aria-label="${DAY_LONG[k]}"><span aria-hidden="true">${DAYS[k]}</span></label>`).join('')}</div><div class="es-times"><input class="input" type="time" name="start" value="${e(r.start||'')}" aria-label="Empieza"><span aria-hidden="true">a</span><input class="input" type="time" name="end" value="${e(r.end||'')}" aria-label="Termina"></div><button type="button" class="es-icon" data-es="row-del" aria-label="Quitar este horario">${ic('x')}</button></div>`;
 function subjectDialog(s=null,preset={}){const d=data();if(!s&&d.subjects.length>=CAP.subjects){App.toast(`Llegaste al máximo de ${CAP.subjects} materias.`,'error');return;}
  const x=s||{name:str(preset.name,60),color:PALETTE[d.subjects.length%PALETTE.length],teacher:'',room:'',place:null,schedule:[],target:80,agenda:true};
  const f=dialog(s?'Editar materia':'Nueva materia',`${field('name','Materia',x.name,'text','required maxlength="60" placeholder="Ej. Matemáticas" autocomplete="off"')}
   <fieldset class="es-fs"><legend>Color</legend><div class="es-swatches">${PALETTE.map((c,i)=>`<label class="es-swatch" style="--c:${c}"><input type="radio" name="color" value="${c}" ${c===col(x.color)?'checked':''} aria-label="Color ${i+1}"><span aria-hidden="true"></span></label>`).join('')}</div></fieldset>
   <div class="es-row2">${field('teacher','Profesor(a)',x.teacher,'text','maxlength="60" placeholder="Opcional" autocomplete="off"')}${field('room','Salón',x.room,'text','maxlength="40" placeholder="Opcional" autocomplete="off"')}</div>
   <fieldset class="es-fs"><legend>Horario</legend><div class="es-rows" id="es-rows">${(x.schedule.length?x.schedule:[{}]).map(schedRow).join('')}</div><button type="button" class="button small" data-es="row-add">${ic('plus')}Agregar horario</button></fieldset>
   <div class="es-row2">${field('target','Meta de calificación (0–100)',fmt(x.target),'number','min="0" max="100" step="1" inputmode="numeric"')}<div class="es-field"><span>Lugar (opcional)</span><div class="es-place"><input class="input" name="place" maxlength="120" placeholder="Para avisarte cuándo salir" value="${e(x.place?.name||'')}" data-lat="${x.place?.lat??''}" data-lon="${x.place?.lon??''}" aria-label="Lugar"><button type="button" class="button small" data-es="place-find" aria-label="Buscar el lugar en el mapa">${ic('search')}</button></div></div></div>
   ${sw('agenda','Bloquear en Agenda','Crea bloques semanales en tu Agenda con cada horario.',x.agenda!==false)}`,{left:s?`<button type="button" class="button es-danger" data-es="subj-del" data-id="${e(s.id)}">${ic('trash-2')}Borrar</button>`:''});
  if(!f)return;f.elements.place.addEventListener('input',ev=>{ev.target.dataset.lat='';ev.target.dataset.lon='';});
  f.addEventListener('change',ev=>{const st=ev.target;if(st.name!=='start'||!okTime(st.value))return;const end=st.closest('.es-srow')?.querySelector('[name=end]');if(end&&!end.value&&toMin(st.value)+50<1440)end.value=hhmm(toMin(st.value)+50);});
  bind(f,(v,form)=>{const name=str(v.name,60);if(!name)throw Error('Escribe el nombre de la materia.');if(data().subjects.some(y=>y.id!==s?.id&&norm(y.name)===norm(name)))throw Error('Ya tienes una materia con ese nombre.');
   const schedule=[];for(const row of form.querySelectorAll('.es-srow')){const days=[...row.querySelectorAll('input[type=checkbox]:checked')].map(i=>Number(i.value)),start=row.querySelector('[name=start]').value.slice(0,5),end=row.querySelector('[name=end]').value.slice(0,5);if(!days.length&&!start&&!end)continue;
    if(!days.length)throw Error('Elige al menos un día en cada horario.');if(!okTime(start)||!okTime(end))throw Error('Pon la hora de inicio y de fin de cada horario.');if(toMin(end)<=toMin(start))throw Error('La hora de fin debe ser después de la de inicio.');schedule.push({days,start,end});}
   if(schedule.length>CAP.rows)throw Error(`Máximo ${CAP.rows} horarios por materia.`);
   const target=num(v.target);if(target==null||target<0||target>100)throw Error('La meta va de 0 a 100.');
   const pl=form.elements.place,lat=parseFloat(pl.dataset.lat),lon=parseFloat(pl.dataset.lon),place=pl.value.trim()&&Number.isFinite(lat)&&Number.isFinite(lon)?{name:pl.value.trim().slice(0,120),lat,lon}:null;
   const agenda=!!form.elements.agenda.checked,next={...(s||{id:uid(),grades:[],agenda_ids:[]}),name,color:col(v.color),teacher:str(v.teacher,60),room:str(v.room,40),place,schedule,target:r1(target),agenda};
   const same=!!s&&s.agenda===agenda&&s.name===next.name&&s.teacher===next.teacher&&s.room===next.room&&JSON.stringify(s.schedule)===JSON.stringify(schedule)&&s.agenda_ids.length===schedule.length&&s.agenda_ids.every(agendaAlive);
   const items=agenda&&!same&&window.Agenda&&window.RCData?agendaItemsFor(next):[];
   save((dd,st)=>{const k=dd.subjects.findIndex(y=>y.id===next.id),prev=k>=0?dd.subjects[k]:null;
    if(same)next.agenda_ids=prev?.agenda_ids||[];else{dropAgenda(st,prev?.agenda_ids);next.agenda_ids=[];if(items.length&&Array.isArray(st.agendaItems)){st.agendaItems.push(...items);next.agenda_ids=items.map(i=>i.id);}}
    if(k>=0)dd.subjects[k]=next;else{if(dd.subjects.length>=CAP.subjects)throw Error(`Máximo ${CAP.subjects} materias.`);dd.subjects.push(next);}});
   App.toast((s?'Materia actualizada.':'Materia agregada.')+(items.length?' Sus clases quedaron en tu Agenda.':''),'success');});}
 function deleteSubject(id){const d=data(),s=subjOf(d,id);if(!s)return;const nt=d.tasks.filter(x=>x.subject_id===id).length,nc=d.cards.filter(c=>c.subject_id===id).length,ns=d.summaries.filter(x=>x.subject_id===id).length;
  const parts=[s.grades.length&&'sus calificaciones',nt&&`${nt} ${plural(nt,'tarea','tareas')}`,nc&&`${nc} ${plural(nc,'tarjeta','tarjetas')}`,ns&&`${ns} ${plural(ns,'resumen','resúmenes')}`,s.agenda_ids.length&&'sus bloques de la Agenda'].filter(Boolean);
  App.confirmAction('Borrar materia',`Se borrará «${s.name}»${parts.length?' con '+joinY(parts):''}. No se puede deshacer.`,()=>{save((dd,st)=>{const x=subjOf(dd,id);if(!x)return;dropAgenda(st,x.agenda_ids);for(const t of dd.tasks.filter(t=>t.subject_id===id))dropAgenda(st,[t.agenda_id]);dd.subjects=dd.subjects.filter(y=>y.id!==id);dd.tasks=dd.tasks.filter(t=>t.subject_id!==id);dd.cards=dd.cards.filter(c=>c.subject_id!==id);dd.summaries=dd.summaries.filter(z=>z.subject_id!==id);});if(S.filter===id)S.filter='';App.toast('Materia borrada.','success');},'Borrar');}
 function taskDialog(x=null,preset={}){const d=data();if(!x&&d.tasks.filter(t=>!t.done).length>=CAP.tasks){App.toast(`Llegaste al máximo de ${CAP.tasks} tareas pendientes.`,'error');return;}
  const v=x||{title:'',kind:KIND[preset.kind]?preset.kind:'tarea',subject_id:preset.subject||(subjOf(d,S.filter)?S.filter:d.subjects[0]?.id||''),due:addDays(today(),1),time:null};
  const f=dialog(x?'Editar tarea':'Nueva tarea',`${d.subjects.length?subjectSelect(d,v.subject_id):''}${field('title','¿Qué hay que hacer?',v.title,'text','required maxlength="140" placeholder="Ej. Ejercicios del tema 3" autocomplete="off" enterkeyhint="next"')}
   <fieldset class="es-fs"><legend>Tipo</legend><div class="es-seg">${Object.entries(KIND).map(([k,l])=>`<label><input type="radio" name="kind" value="${k}" ${v.kind===k?'checked':''}><span>${ic(KIND_IC[k])}${l}</span></label>`).join('')}</div></fieldset>
   <div class="es-row2">${field('due','Fecha de entrega',v.due,'date','required')}${field('time','Hora (opcional)',v.time||'','time')}</div>
   <div class="es-quick" role="group" aria-label="Atajos de fecha">${[['Hoy',0],['Mañana',1],['En una semana',7]].map(([l,n])=>`<button type="button" class="es-fchip" data-es="quick-date" data-days="${n}">${l}</button>`).join('')}</div>
   ${sw('agenda','Agregar a Agenda','Crea un pendiente con esta fecha; al marcar la tarea como hecha, también se completa.',x?agendaAlive(x.agenda_id):true)}`,{left:x?`<button type="button" class="button es-danger" data-es="task-del" data-id="${e(x.id)}">${ic('trash-2')}Borrar</button>`:''});
  bind(f,val=>{const title=str(val.title,140);if(!title)throw Error('Escribe qué hay que hacer.');if(!isDate(val.due))throw Error('Elige la fecha de entrega.');const time=val.time?String(val.time).slice(0,5):null;if(time&&!okTime(time))throw Error('Revisa la hora.');
   const kind=KIND[val.kind]?val.kind:'tarea',subject_id=val.subject_id&&subjOf(data(),val.subject_id)?val.subject_id:null,agenda=!!f.elements.agenda.checked,now=new Date().toISOString(),can=!!(window.Agenda&&window.RCData);
   save((dd,st)=>{let task=x?dd.tasks.find(y=>y.id===x.id):null;if(x&&!task)throw Error('Esta tarea ya no existe.');
    if(!task){if(dd.tasks.filter(y=>!y.done).length>=CAP.tasks)throw Error(`Llegaste al máximo de ${CAP.tasks} tareas pendientes.`);task={id:uid(),done:false,done_at:null,grade:null,agenda_id:null};dd.tasks.push(task);}
    Object.assign(task,{subject_id,title,kind,due:val.due,time});const sb=subjOf(dd,subject_id),it=live(st,task.agenda_id);
    if(agenda&&can){if(it)Object.assign(it,{title:taskTitle(task,sb),due_at:taskStamp(task),all_day:!time,priority:kind==='examen'?'high':'medium',updated_at:now});else if(Array.isArray(st.agendaItems)){const n=taskAgendaItem(task,sb);st.agendaItems.push(n);task.agenda_id=n.id;if(task.done)agendaDone(st,n.id,true);}}
    else if(!agenda&&it){dropAgenda(st,[it.id]);task.agenda_id=null;}});
   App.toast(x?'Tarea actualizada.':agenda&&can?'Tarea agregada; también está en tu Agenda.':'Tarea agregada.','success');});}
 function setTask(id,done){save((dd,st)=>{const x=dd.tasks.find(y=>y.id===id);if(!x||x.done===done)return;x.done=done;x.done_at=done?new Date().toISOString():null;agendaDone(st,x.agenda_id,done);});}
 function toggleTask(id,btn){const x=data().tasks.find(y=>y.id===id);if(!x||S.pending.has(id))return;const done=!x.done;S.pending.add(id);btn?.setAttribute('aria-pressed',String(done));btn?.closest('.es-task')?.classList.toggle('is-done',done);
  setTimeout(()=>{S.pending.delete(id);try{setTask(id,done);}catch(err){App.toast(err?.message||'No pude guardar.','error');}if(UI.section==='escuela')App.render();if(done)App.toast(x.kind==='examen'?'Examen marcado como hecho.':'¡Hecha!','success',()=>setTask(id,false));},reduced()?0:280);}
 function deleteTask(id){let snap=null;save((dd,st)=>{const k=dd.tasks.findIndex(y=>y.id===id);if(k<0)return;snap=dd.tasks.splice(k,1)[0];dropAgenda(st,[snap.agenda_id]);});App.closeDialog(true);App.render();if(snap)App.toast('Tarea borrada.','success',()=>save((dd,st)=>{if(!dd.tasks.some(y=>y.id===snap.id))dd.tasks.push(snap);undropAgenda(st,[snap.agenda_id]);}));}
 /** Adds cards (deduped per subject, capped). Returns {added, skipped}. */
 function addCards(list,subject_id){let added=0,skipped=0;save(dd=>{const t=today(),key=(s,f,b)=>(s||'')+'|'+norm(f)+'|'+norm(b),seen=new Set(dd.cards.map(c=>key(c.subject_id,c.front,c.back)));
  for(const c of arr(list)){const front=str(c?.front,CAP.side),back=str(c?.back,CAP.side),k=key(subject_id,front,back);if(!front||!back||seen.has(k)||dd.cards.length>=CAP.cards){skipped++;continue;}seen.add(k);dd.cards.push({id:uid(),subject_id:subject_id||null,front,back,ef:2.5,interval:0,reps:0,lapses:0,due:t,last:null});added++;}});return {added,skipped};}
 const deckSubject=(d,deck)=>deck&&deck!=='none'&&subjOf(d,deck)?deck:deck==='none'?'':(subjOf(d,S.filter)?S.filter:d.subjects[0]?.id||'');
 function cardDialog(c=null,preset={}){const d=data();if(!c&&d.cards.length>=CAP.cards){App.toast(`Llegaste al máximo de ${CAP.cards} tarjetas. Borra algunas para agregar más.`,'error');return;}
  const f=dialog(c?'Editar tarjeta':'Nueva tarjeta',`${d.subjects.length?subjectSelect(d,c?c.subject_id:deckSubject(d,preset.deck)):''}${area('front','Frente · pregunta o término',c?.front||'',`maxlength="${CAP.side}" rows="3" placeholder="Ej. ¿Qué es una fracción equivalente?"`)}${area('back','Reverso · respuesta',c?.back||'',`maxlength="${CAP.side}" rows="3" placeholder="Ej. Otra fracción con el mismo valor, como 1/2 y 2/4."`)}${c?`<p class="es-muted">${isNew(c)?'Nueva: aún no la repasas.':`Próximo repaso: ${e(dateText(c.due))} · ${c.reps} ${plural(c.reps,'acierto seguido','aciertos seguidos')}`}</p>`:''}`,{left:c?`<button type="button" class="button es-danger" data-es="card-del" data-id="${e(c.id)}">${ic('trash-2')}Borrar</button>`:`<button type="submit" class="button" name="more" value="1">${ic('plus')}Guardar y otra</button>`});
  bind(f,(v,form,sub)=>{const front=str(v.front,CAP.side),back=str(v.back,CAP.side);if(!front||!back)throw Error('Escribe el frente y el reverso.');const subject_id=v.subject_id&&subjOf(data(),v.subject_id)?v.subject_id:null;
   if(c){save(dd=>{const k=dd.cards.find(y=>y.id===c.id);if(!k)throw Error('Esta tarjeta ya no existe.');Object.assign(k,{front,back,subject_id});});App.toast('Tarjeta actualizada.','success');return;}
   const r=addCards([{front,back}],subject_id);if(!r.added)throw Error(data().cards.length>=CAP.cards?`Llegaste al máximo de ${CAP.cards} tarjetas.`:'Esa tarjeta ya existe.');
   if(sub?.value==='1'){form.elements.front.value='';form.elements.back.value='';form.elements.front.focus();App.render();App.toast('Tarjeta guardada. Va la siguiente.','success');return false;}
   App.toast('Tarjeta guardada.','success');});}
 function bulkDialog(preset={}){const d=data();if(d.cards.length>=CAP.cards){App.toast(`Llegaste al máximo de ${CAP.cards} tarjetas.`,'error');return;}
  const f=dialog('Agregar varias tarjetas',`${d.subjects.length?subjectSelect(d,deckSubject(d,preset.deck)):''}${area('lines','Una tarjeta por línea: frente :: reverso','','rows="8" maxlength="40000" placeholder="Capital de Francia :: París&#10;7 × 8 :: 56"')}<p class="es-muted" id="es-bulk-n" aria-live="polite">Escribe o pega tus tarjetas.</p>`,{submit:'Agregar'});if(!f)return;
  const out=f.querySelector('#es-bulk-n');f.elements.lines.addEventListener('input',()=>{const {ok,bad}=parseBulk(f.elements.lines.value);out.textContent=ok.length||bad.length?`${ok.length} ${plural(ok.length,'tarjeta lista','tarjetas listas')}${bad.length?` · ${bad.length} ${plural(bad.length,'línea','líneas')} sin «::»`:''}`:'Escribe o pega tus tarjetas.';});
  bind(f,v=>{const {ok}=parseBulk(v.lines);if(!ok.length)throw Error('No encontré tarjetas. Escribe una por línea: frente :: reverso');const r=addCards(ok,v.subject_id&&subjOf(data(),v.subject_id)?v.subject_id:null);if(!r.added)throw Error('No agregué ninguna: ya existían o llegaste al máximo.');
   App.toast(`Agregué ${r.added} ${plural(r.added,'tarjeta','tarjetas')}${r.skipped?` (${r.skipped} repetidas o de más)`:''}.`,'success');});}
 function genDialog(preset={}){if(!cloud()){App.toast('Inicia sesión para que Ivi genere tarjetas.','error');return;}const d=data();if(d.cards.length>=CAP.cards){App.toast(`Llegaste al máximo de ${CAP.cards} tarjetas.`,'error');return;}
  const f=dialog('Generar tarjetas con Ivi',`<p class="dialog-subtitle">Pega tus apuntes. Ivi crea tarjetas solo con lo que está ahí y tú eliges cuáles guardar.</p>${d.subjects.length?subjectSelect(d,deckSubject(d,preset.deck)):''}${area('notes','Apuntes','','rows="8" maxlength="6000" placeholder="Pega aquí el texto del tema (al menos unas líneas)."')}<fieldset class="es-fs"><legend>¿Cuántas?</legend><div class="es-seg">${[5,10,15,20].map(n=>`<label><input type="radio" name="count" value="${n}" ${n===10?'checked':''}><span>${n}</span></label>`).join('')}</div></fieldset>`,{submit:'Generar'});
  bind(f,async v=>{const notes=String(v.notes||'').trim();if(notes.length<40)throw Error('Pega al menos unas líneas de apuntes (40 caracteres o más).');const subject_id=v.subject_id&&subjOf(data(),v.subject_id)?v.subject_id:null;
   const r=await EvieAccounts.request('school/cards',{method:'POST',body:{subject:nameOf(data(),subject_id),notes:notes.slice(0,6000),count:Number(v.count)||10}});
   const cards=arr(r?.cards).map(c=>({front:str(c?.front,CAP.side),back:str(c?.back,CAP.side)})).filter(c=>c.front&&c.back);if(!cards.length)throw Error('Ivi no encontró material suficiente en esos apuntes. Agrega más detalle.');
   S.gen={cards,subject_id};previewDialog();return false;});}
 function previewDialog(){const g=S.gen;if(!g)return;const f=dialog('Revisa las tarjetas',`<p class="dialog-subtitle">Ivi creó ${g.cards.length} ${plural(g.cards.length,'tarjeta','tarjetas')}${g.subject_id?' para '+e(nameOf(data(),g.subject_id)):''}. Desmarca las que no quieras.</p><ul class="es-prev">${g.cards.map((c,i)=>`<li><label><input type="checkbox" name="c${i}" checked><span><strong>${e(c.front)}</strong><small>${e(c.back)}</small></span></label></li>`).join('')}</ul>`,{submit:'Guardar seleccionadas'});
  bind(f,(v,form)=>{const pick=g.cards.filter((_,i)=>form.elements['c'+i]?.checked);if(!pick.length)throw Error('Marca al menos una tarjeta.');const r=addCards(pick,g.subject_id);S.gen=null;if(!r.added)throw Error('No agregué ninguna: ya existían o llegaste al máximo.');S.tab='tarjetas';App.toast(`Guardé ${r.added} ${plural(r.added,'tarjeta','tarjetas')}.`,'success');});}
 function deleteCard(id){let snap=null;save(dd=>{const k=dd.cards.findIndex(c=>c.id===id);if(k>=0)snap=dd.cards.splice(k,1)[0];});if(document.getElementById('es-form'))App.closeDialog(true);App.render();if(snap)App.toast('Tarjeta borrada.','success',()=>save(dd=>{if(!dd.cards.some(c=>c.id===snap.id))dd.cards.push(snap);}));}
 function gradeValues(v){const label=str(v.label,80),score=num(v.score),max=num(v.max),weight=num(v.weight);
  if(!label)throw Error('Escribe el nombre de la evaluación.');if(score==null||score<0)throw Error('Escribe la calificación que sacaste.');if(max==null||max<=0)throw Error('La calificación máxima debe ser mayor que 0.');if(score>max)throw Error('La calificación no puede ser mayor que la máxima.');if(weight!=null&&(weight<0||weight>100))throw Error('El peso va de 0 a 100 %.');return {label,score,max,weight};}
 function checkWeights(s,weight,skip=null){const used=s.grades.filter(g=>g.id!==skip).reduce((a,g)=>a+Math.max(0,num(g.weight)||0),0);if(weight&&used+weight>100+1e-9)throw Error(`Con ese peso pasas de 100 % (ya llevas ${fmt(used)} %).`);}
 function addGrade(form){const id=form.dataset.id,g=gradeValues(Object.fromEntries(new FormData(form)));save(dd=>{const s=subjOf(dd,id);if(!s)throw Error('Esta materia ya no existe.');if(s.grades.length>=CAP.grades)throw Error(`Máximo ${CAP.grades} calificaciones por materia.`);checkWeights(s,g.weight);s.grades.push({id:uid(),...g,date:today()});});}
 function gradeDialog(id,gid){const s=subjOf(data(),id),g=s?.grades.find(x=>x.id===gid);if(!g)return;
  const f=dialog('Editar calificación',`${field('label','Evaluación',g.label,'text','maxlength="80" autocomplete="off"')}<div class="es-row3">${field('score','Calificación',fmt(g.score),'number','step="any" min="0" inputmode="decimal"')}${field('max','Máxima',fmt(g.max),'number','step="any" min="0" inputmode="decimal"')}${field('weight','Peso (%)',g.weight==null?'':fmt(g.weight),'number','step="any" min="0" max="100" inputmode="decimal"')}</div>${field('date','Fecha',g.date||'','date')}`,{left:`<button type="button" class="button es-danger" data-es="grade-del" data-id="${e(id)}" data-grade="${e(gid)}">${ic('trash-2')}Borrar</button>`});
  bind(f,v=>{const x=gradeValues(v);save(dd=>{const ss=subjOf(dd,id),gg=ss?.grades.find(y=>y.id===gid);if(!gg)throw Error('Esta calificación ya no existe.');checkWeights(ss,x.weight,gid);Object.assign(gg,x,{date:isDate(v.date)?v.date:gg.date||null});});App.toast('Calificación actualizada.','success');});}
 function deleteGrade(id,gid){let snap=null;save(dd=>{const s=subjOf(dd,id);const k=s?s.grades.findIndex(g=>g.id===gid):-1;if(k>=0)snap=s.grades.splice(k,1)[0];});if(document.getElementById('es-form'))App.closeDialog(true);App.render();if(snap)App.toast('Calificación borrada.','success',()=>save(dd=>{const s=subjOf(dd,id);if(s&&!s.grades.some(g=>g.id===snap.id))s.grades.push(snap);}));}
 async function createSummary(form){if(!cloud()){App.toast('Inicia sesión para crear resúmenes con Ivi.','error');return;}if(S.busy)return;const v=Object.fromEntries(new FormData(form)),topic=str(v.topic,200),notes=str(v.notes,4000),subject=v.subject&&subjOf(data(),v.subject)?v.subject:null;
  if(!topic){App.toast('Escribe el tema que quieres repasar.','error');form.elements.topic?.focus();return;}
  S.busy='summary';S.draft={topic,notes,subject:subject||''};App.render();
  try{const r=await EvieAccounts.request('school/summary',{method:'POST',body:{subject:nameOf(data(),subject),topic,notes}}),x=r?.summary||{};
   const item={id:uid(),subject_id:subject,topic,title:str(x.title,160)||topic,points:arr(x.points).map(p=>str(p,400)).filter(Boolean).slice(0,7),script:str(x.script,1600),questions:arr(x.questions).map(q=>str(q,300)).filter(Boolean).slice(0,3),created_at:typeof r?.generated_at==='string'?r.generated_at:new Date().toISOString()};
   save(dd=>{dd.summaries.unshift(item);dd.summaries=dd.summaries.slice(0,CAP.summaries);});S.open.add('sum:'+item.id);S.draft=null;App.toast('Resumen listo. Toca «Escuchar».','success');}
  catch(err){App.toast(err?.message||'No pude preparar el resumen.','error');}
  finally{S.busy='';if(UI.section==='escuela')App.render();}}
 function deleteSummary(id){if(S.speak.id===id)stopPlay();let snap=null,at=0;save(dd=>{at=dd.summaries.findIndex(x=>x.id===id);if(at>=0)snap=dd.summaries.splice(at,1)[0];});App.render();if(snap)App.toast('Resumen borrado.','success',()=>save(dd=>{if(!dd.summaries.some(x=>x.id===snap.id))dd.summaries.splice(Math.min(at,dd.summaries.length),0,snap);}));}
 async function findPlace(b){const inp=b.parentElement?.querySelector('input'),q=inp?.value.trim()||'';if(q.length<3){App.toast('Escribe el lugar para buscarlo.','error');return;}if(!cloud()){App.toast('Inicia sesión para buscar el lugar en el mapa.','error');return;}b.classList.add('is-busy');
  try{const r=await EvieAccounts.request('map/search',{method:'POST',body:{text:q}}),hit=r?.results?.[0];if(!hit){App.toast('No encontré ese lugar en el mapa.','error');return;}inp.value=String(hit.label||hit.name||q).slice(0,120);inp.dataset.lat=hit.lat;inp.dataset.lon=hit.lon;App.toast('Lugar encontrado: '+inp.value,'success');}
  catch(err){App.toast(err?.message||'El mapa no está disponible.','error');}finally{b.classList.remove('is-busy');}}

 /* ---------------- audio summaries (chunked TTS, sequential, stoppable) ---------------- */
 function paintSpeak(){document.querySelectorAll('[data-es="sum-play"]').forEach(b=>{const on=b.dataset.id===S.speak.id;b.setAttribute('aria-pressed',String(on));b.innerHTML=on?ic('square')+'Detener':ic('volume-2')+'Escuchar';});icons(document.getElementById('es-body'));}
 async function play(id){if(S.speak.id===id){stopPlay();return;}const x=data().summaries.find(y=>y.id===id);if(!x)return;if(!window.EvieAssistant?.say){App.toast('La voz de Ivi no está disponible aquí.','error');return;}
  const pf=EvieAssistant.pref?.()||{};if(pf.muted||pf.conversation===false)App.toast('La voz de Ivi está en silencio: verás el texto. Actívala en los ajustes de EVIE.','error');
  if(S.speak.id)stopPlay();const token=++S.speak.token;S.speak.id=id;paintSpeak();
  try{for(const p of chunks(`${x.title}. ${x.script||x.points.join('. ')}`)){if(S.speak.token!==token)break;await EvieAssistant.say(p);const st=EvieAssistant.stats?.();if(st&&(st.busy||(st.voice?.state&&st.voice.state!=='idle')))break;}}
  catch{if(S.speak.token===token)App.toast('No pude leerlo en voz alta.','error');}
  if(S.speak.token===token){S.speak.id=null;paintSpeak();}}
 function stopPlay(){S.speak.token++;S.speak.id=null;try{window.EvieAssistant?.stopSpeaking?.();}catch{}paintSpeak();}

 /* ---------------- review mode (overlay) ---------------- */
 const R={on:false,deck:null,queue:[],i:0,pct:0,flipped:false,seen:new Set(),stats:{},done:0,good:0,t:null,prev:null};
 const nextLabel=n=>n<=1?'mañana':n<30?`${n} días`:n<365?`${Math.round(n/30)} ${plural(Math.round(n/30),'mes','meses')}`:'1 año o más';
 function startReview(deck=null){const d=data(),ids=queue(d,deck);if(!ids.length){App.toast('No tienes tarjetas para repasar hoy. ¡Vas al día!','success');return;}
  try{if(document.getElementById('app-dialog')?.open)App.closeDialog(true);}catch{}
  Object.assign(R,{on:true,deck,queue:ids,i:0,pct:0,flipped:false,seen:new Set(),stats:{1:0,3:0,4:0,5:0},done:0,good:0,t:today(),prev:document.activeElement});
  document.getElementById('es-rv')?.remove();const box=document.createElement('div');box.id='es-rv';box.className='es-rv';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','es-rv-title');document.body.append(box);document.documentElement.classList.add('es-rv-lock');paintReview();}
 function footHtml(c){return R.flipped?`<div class="es-grades-row">${GRADES.map(([q,l,k,tn])=>`<button type="button" class="es-grade" data-es="rv-grade" data-q="${q}" data-tone="${tn}"><strong>${l}</strong><small>${nextLabel(sm2(c,q,R.t).interval)}</small><kbd>${k}</kbd></button>`).join('')}</div><p class="es-rv-hint">¿Qué tan bien la recordaste? Teclas 1 a 4.</p>`
  :`<button type="button" class="button primary es-rv-flip" data-es="rv-flip">${ic('eye')}Mostrar respuesta<kbd>Espacio</kbd></button><p class="es-rv-hint">Piensa la respuesta antes de voltearla.</p>`;}
 function paintReview(){const box=document.getElementById('es-rv');if(!box)return;const d=data();while(R.i<R.queue.length&&!d.cards.some(c=>c.id===R.queue[R.i]))R.i++;
  if(R.i>=R.queue.length){box.style.setProperty('--c',PALETTE[1]);box.innerHTML=endHtml(d);icons(box);box.querySelector('.es-rv-end [data-es="rv-close"]')?.focus({preventScroll:true});spring(box.querySelector('.es-rv-end'));return;}
  const c=d.cards.find(x=>x.id===R.queue[R.i]),s=subjOf(d,c.subject_id),total=R.queue.length,pct=Math.round(R.i/total*100),from=Math.min(R.pct,pct);R.pct=pct;box.style.setProperty('--c',col(s?.color||PALETTE[1]));
  box.innerHTML=`<div class="es-rv-shell"><header class="es-rv-top"><span class="es-eyebrow">${s?e(s.name):'Repaso'}</span><span class="es-rv-count">${R.i+1} de ${total}</span><button type="button" class="es-icon" data-es="rv-close" aria-label="Salir del repaso">${ic('x')}</button></header>
   <div class="es-rv-bar" role="progressbar" aria-label="Progreso del repaso" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${R.i}"><i style="width:${from}%"></i></div><h2 id="es-rv-title" class="sr-only">Repaso de tarjetas</h2>
   <div class="es-rv-stage" tabindex="-1"><div class="es-rv-pop"><div class="es-rv-card${R.flipped?' is-flipped':''}"><section class="es-rv-face es-rv-front" aria-hidden="${R.flipped}"><small>${isNew(c)?'Nueva':'Pregunta'}</small><p>${e(c.front)}</p></section><section class="es-rv-face es-rv-back" aria-hidden="${!R.flipped}"><small>Respuesta</small><p class="es-rv-ask">${e(c.front)}</p><p>${e(c.back)}</p></section></div></div></div>
   <footer class="es-rv-foot" aria-live="polite">${footHtml(c)}</footer></div>`;
  icons(box);(R.flipped?box.querySelector('.es-rv-stage'):box.querySelector('[data-es="rv-flip"]'))?.focus({preventScroll:true});spring(box.querySelector('.es-rv-pop'));
  if(from!==pct){const bar=box.querySelector('.es-rv-bar i'),go=()=>{if(bar)bar.style.width=pct+'%';};try{requestAnimationFrame(()=>requestAnimationFrame(go));}catch{go();}}}
 function spring(el){if(!el||reduced()||!window.Motion?.animate)return;try{Motion.animate(el,{opacity:[0,1],y:[18,0],scale:[.97,1]},{type:'spring',stiffness:320,damping:28});}catch{}}
 function flip(){if(!R.on||R.flipped||R.i>=R.queue.length)return;const box=document.getElementById('es-rv'),card=box?.querySelector('.es-rv-card'),c=data().cards.find(x=>x.id===R.queue[R.i]);R.flipped=true;if(!card||!c){paintReview();return;}
  card.classList.add('is-flipped');card.querySelector('.es-rv-front')?.setAttribute('aria-hidden','true');card.querySelector('.es-rv-back')?.setAttribute('aria-hidden','false');const foot=box.querySelector('.es-rv-foot');foot.innerHTML=footHtml(c);icons(foot);box.querySelector('.es-rv-stage')?.focus({preventScroll:true});
  if(!reduced()&&window.Motion?.animate)try{Motion.animate(foot.querySelectorAll('.es-grade'),{opacity:[0,1],y:[10,0]},{type:'spring',stiffness:300,damping:26,delay:Motion.stagger?.(.04)||0});}catch{}}
 function grade(q){if(!R.on||!R.flipped||R.i>=R.queue.length)return;const id=R.queue[R.i];
  if(!R.seen.has(id)){R.seen.add(id);try{save(dd=>{const k=dd.cards.findIndex(c=>c.id===id);if(k<0)return;dd.cards[k]=sm2(dd.cards[k],q,R.t);dd.log.reviews[R.t]=(dd.log.reviews[R.t]||0)+1;});}catch(err){App.toast(err?.message||'No pude guardar el repaso.','error');closeReview(true);return;}
   R.done++;if(q>=3)R.good++;R.stats[q]=(R.stats[q]||0)+1;if(q<3&&R.queue.length<CAP.session*2)R.queue.push(id);}// «Otra vez»: one more look this session (scheduled once)
  R.i++;R.flipped=false;paintReview();}
 function endHtml(d){const left=queue(d,R.deck).length,pct=R.done?Math.round(R.good/R.done*100):0,st=streak(d);
  return `<div class="es-rv-shell es-rv-end"><span class="es-rv-trophy" aria-hidden="true">${ic('party-popper')}</span><h2 id="es-rv-title">¡Repaso terminado!</h2><p class="es-rv-sum">${R.done} ${plural(R.done,'tarjeta repasada','tarjetas repasadas')}${R.done?` · recordaste bien el ${pct} %`:''}</p>
   <ul class="es-rv-dist">${GRADES.map(([q,l,,tn])=>`<li data-tone="${tn}"><b>${R.stats[q]||0}</b><span>${l}</span></li>`).join('')}</ul>
   <p class="es-muted">${st?`Racha: ${st} ${plural(st,'día seguido','días seguidos')}. `:''}${left?`Quedan ${left} para hoy.`:'Vas al día: mañana te tocan las siguientes.'}</p>
   <div class="es-rv-actions">${left?`<button type="button" class="button" data-es="rv-again">${ic('rotate-ccw')}Seguir · ${left}</button>`:''}<button type="button" class="button primary" data-es="rv-close">${ic('check')}Listo</button></div></div>`;}
 function closeReview(silent=false){if(!R.on)return;R.on=false;const box=document.getElementById('es-rv');document.documentElement.classList.remove('es-rv-lock');if(box){box.removeAttribute('id');box.classList.add('is-out');setTimeout(()=>box.remove(),reduced()?0:200);}
  if(!silent&&R.done)App.toast(`Repaso guardado: ${R.done} ${plural(R.done,'tarjeta','tarjetas')}.`,'success');if(UI.section==='escuela')App.render();try{if(R.prev?.isConnected)R.prev.focus({preventScroll:true});}catch{}}
 function trap(ev,box){const f=[...box.querySelectorAll('button:not([disabled])')];if(!f.length)return;const a=document.activeElement;if(!box.contains(a)){ev.preventDefault();f[0].focus();}else if(ev.shiftKey&&a===f[0]){ev.preventDefault();f[f.length-1].focus();}else if(!ev.shiftKey&&a===f[f.length-1]){ev.preventDefault();f[0].focus();}}
 function reviewKey(ev){const box=document.getElementById('es-rv');if(!box)return;const k=ev.key;
  if(k==='Escape'){ev.preventDefault();ev.stopPropagation();closeReview();return;}if(k==='Tab'){trap(ev,box);return;}if(ev.ctrlKey||ev.metaKey||ev.altKey||R.i>=R.queue.length)return;
  if(!R.flipped&&(k===' '||k==='Spacebar'||k==='Enter')){if(ev.target?.closest?.('button,a,input,textarea,select'))return;ev.preventDefault();ev.stopPropagation();flip();return;}
  if(R.flipped&&/^[1-4]$/.test(k)){ev.preventDefault();ev.stopPropagation();grade(GRADES[Number(k)-1][0]);}}
 /** Opens Escuela on Tarjetas and starts the review (used by «repasemos»). */
 function goReview(deck=null){S.tab='tarjetas';if(UI.section==='escuela'&&document.getElementById('es-root')){App.render();startReview(deck);return;}S.pendingReview={deck};try{location.hash='escuela';}catch{}}

 /* ---------------- voice / text intents (local, no AI cost) ---------------- */
 function mentioned(d,q){let best=null;for(const s of d.subjects){const n=norm(s.name);if(n&&new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(q)&&(!best||n.length>norm(best.name).length))best=s;}return best;}
 function whenSpoken(due,t){const n=between(t,due);return n<0?`(vencida desde el ${dateText(due,{weekday:'long',day:'numeric'})})`:n===0?'para hoy':n===1?'para mañana':n<7?`para el ${DAY_LONG[dowOf(due)]}`:`para el ${dateText(due,{day:'numeric',month:'long'})}`;}
 function intent(text){const q=norm(text).replace(/^(?:oye |hey |ok )?(?:ivi|ivy|evie|evi|ibi)\b\s*/,'');if(!q)return '';const d=data(),t=today(),school=/\b(escuela|colegio|clase|clases|materia|materias|prepa|secundaria|universidad|semestre|maestr[oa]|profe|profesor[a]?)\b/.test(q),has=d.subjects.length+d.tasks.length+d.cards.length>0;
  if(/\b(repasemos|repasamos|vamos a repasar|quiero repasar|hay que repasar|ponme a repasar|empecemos a repasar|empezar (el|a) repas\w*|repasar (mis |las )?tarjetas|repaso de tarjetas)\b/.test(q)){const s=mentioned(d,q),deck=s&&queue(d,s.id,t).length?s.id:null,n=queue(d,deck,t).length;
   if(n){goReview(deck);return `Vamos a repasar${deck?' '+s.name:''}: ${n} ${plural(n,'tarjeta','tarjetas')}. Piensa la respuesta antes de voltearla.`;}
   S.tab='tarjetas';if(UI.section!=='escuela')try{location.hash='escuela';}catch{}else App.render();return d.cards.length?'No tienes tarjetas pendientes hoy: vas al día.':'Aún no tienes tarjetas. Te abro Tarjetas para que crees las primeras.';}
  if(/\b(agrega|agregar|anota|anotar|apunta|apuntar|crea|crear|registra|registrar|programa|programar|pon|ponme|borra|borrar|elimina|eliminar)\b/.test(q))return '';
  if(/\b(tarjetas?|flashcards?|fichas)\b/.test(q)&&/\b(cuantas|cuantos|tengo|hay|pendientes?|toca|tocan|quedan|faltan|hoy|repasar)\b/.test(q)){const due=d.cards.filter(c=>c.due<=t),fresh=due.filter(isNew).length;
   if(!d.cards.length)return 'Aún no tienes tarjetas. Créalas en Escuela, en la pestaña Tarjetas.';
   return due.length?`Tienes ${due.length} ${plural(due.length,'tarjeta','tarjetas')} para repasar hoy${fresh?`, ${fresh} ${plural(fresh,'nueva','nuevas')}`:''}, de ${d.cards.length} en total. Di «repasemos» para empezar.`:`Hoy no te toca ninguna tarjeta: vas al día. Tienes ${d.cards.length} en total.`;}
  if(/\b(examen|examenes|parcial|parciales|extraordinario)\b/.test(q)){const s=mentioned(d,q),list=d.tasks.filter(x=>!x.done&&x.kind==='examen'&&x.due>=t&&(!s||x.subject_id===s.id)).sort(byDue);
   if(!list.length)return s?`No tienes exámenes de ${s.name} registrados.`:'No tienes exámenes registrados. Agrégalos en Escuela, en Tareas.';
   const x=list[0],sn=nameOf(d,x.subject_id),n=between(t,x.due),when=n===0?'hoy':n===1?'mañana':`el ${dateText(x.due).replace(',','')}, en ${n} días`;
   return dot(`${s?`Tu próximo examen de ${s.name} es «${x.title}»`:`Tu próximo examen es «${x.title}»${sn?' de '+sn:''}`}, ${when}${x.time?', a las '+hour12(x.time):''}`)+(list.length>1?` Después tienes ${list.length-1} ${plural(list.length-1,'examen más','exámenes más')}.`:'');}
  if(/\b(horario|clase|clases)\b/.test(q)&&!/\b(gym|gimnasio|yoga|spinning|crossfit|natacion|baile|box|manejo)\b/.test(q)&&/\b(hoy|manana|mi|mis|que|cual|cuales|tengo|hay|hora|cuando|toca|tocan)\b/.test(q)){
   if(!d.subjects.length)return 'Aún no registras tu horario. Agrega tus materias en Escuela.';const s=mentioned(d,q);
   if(s){if(!s.schedule.length)return `${s.name} no tiene horario registrado.`;for(let k=0;k<8;k++){const day=addDays(t,k),r=s.schedule.filter(y=>y.days.includes(dowOf(day))).sort((a,b)=>toMin(a.start)-toMin(b.start)).find(y=>k>0||toMin(y.end)>nowMin());if(r)return dot(`Tu clase de ${s.name} es ${k===0?'hoy':k===1?'mañana':'el '+DAY_LONG[dowOf(day)]} a las ${hour12(r.start)}${s.room?', en el salón '+s.room:''}`);}return `${s.name} no tiene clases próximas.`;}
   const tom=/\bmanana\b/.test(q)&&!/\b(en|de|por) la manana\b/.test(q),day=tom?addDays(t,1):t,list=classRows(d,dowOf(day)),when=tom?'Mañana':'Hoy';
   if(!list.length)return `${when} no tienes clases.`;return dot(`${when} tienes ${list.length} ${plural(list.length,'clase','clases')}: ${joinY(list.slice(0,6).map(({s:x,r})=>`${x.name} a las ${hour12(r.start)}`))}${list.length>6?', y más':''}`);}
  if(/\b(tarea|tareas|deberes|entrega|entregas)\b/.test(q)&&/\b(que|cual|cuales|tengo|hay|pendientes?|cuando|debo|falta|faltan|para)\b/.test(q)){if(!has&&!school)return '';
   const s=mentioned(d,q),open=d.tasks.filter(x=>!x.done&&(!s||x.subject_id===s.id)).sort(byDue),late=open.filter(x=>x.due<t),soon=open.filter(x=>x.due>=t&&x.due<=addDays(t,7));
   if(!open.length)return s?`No tienes tareas pendientes de ${s.name}.`:'No tienes tareas pendientes. ¡Bien!';
   const item=x=>`«${x.title}»${!s&&nameOf(d,x.subject_id)?' de '+nameOf(d,x.subject_id):''} ${whenSpoken(x.due,t)}`,out=[];
   if(soon.length)out.push(`Tienes ${soon.length} ${plural(soon.length,'entrega','entregas')} en los próximos 7 días: ${joinY(soon.slice(0,3).map(item))}${soon.length>3?', y más':''}.`);
   if(!soon.length)out.push(`Nada para los próximos 7 días.${open.some(x=>x.due>addDays(t,7))?' Lo siguiente es '+item(open.find(x=>x.due>addDays(t,7)))+'.':''}`);
   if(late.length)out.push(`${soon.length?'Y':'Tienes'} ${late.length} ${plural(late.length,'vencida','vencidas')}: ${joinY(late.slice(0,2).map(x=>'«'+x.title+'»'))}${late.length>2?', y más':''}.`);
   return out.join(' ');}
  if((/\b(promedio|calificacion|calificaciones)\b/.test(q)||(/\bcomo (voy|llevo|va)\b/.test(q)&&mentioned(d,q)))&&!/\b(gasto|gastos|ingreso|ingresos|dinero|ventas|peso|sueno|calorias|pasos)\b/.test(q)){if(!d.subjects.length)return school?'Aún no registras materias ni calificaciones.':'';
   const s=mentioned(d,q);if(s){const a=average(s);return a==null?`Aún no tienes calificaciones de ${s.name}.`:`En ${s.name} llevas ${fmt(a)} de promedio; tu meta es ${fmt(s.target)}. ${needText(needed(s)).replace(/<[^>]+>/g,'')}`;}
   const a=overall(d);return a==null?'Aún no registras calificaciones.':`Tu promedio general es ${fmt(a)}, con ${d.subjects.filter(x=>average(x)!=null).length} ${plural(d.subjects.filter(x=>average(x)!=null).length,'materia','materias')} calificadas.`;}
  return '';}

 /* ---------------- tabs, mount, motion ---------------- */
 function centerTab(smooth=true){const nav=document.querySelector('.es-tabs'),t=nav?.querySelector('[aria-selected="true"]');if(!nav||!t||nav.scrollWidth<=nav.clientWidth)return;const nr=nav.getBoundingClientRect(),tr=t.getBoundingClientRect(),left=nav.scrollLeft+(tr.left-nr.left)-(nr.width-tr.width)/2;
  try{nav.scrollTo({left:Math.max(0,left),behavior:smooth&&!reduced()?'smooth':'auto'});}catch{nav.scrollLeft=Math.max(0,left);}}
 function anim(nodes){if(!window.Motion?.animate||reduced())return;const list=[...nodes].slice(0,24);if(!list.length)return;try{Motion.animate(list,{opacity:[0,1],y:[12,0]},{type:'spring',stiffness:280,damping:26,delay:Motion.stagger?.(.035)||0});}catch{}}
 function setTab(k,focus=false){if(!TABS.some(x=>x[0]===k))return;S.tab=k;const root=document.getElementById('es-root'),body=document.getElementById('es-body');if(!root||!body){App.render();return;}
  root.querySelectorAll('[data-es="tab"]').forEach(b=>{const on=b.dataset.tab===k;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();});
  body.setAttribute('aria-labelledby','es-tab-'+k);body.innerHTML=bodyHtml();icons(body);centerTab();anim(body.querySelectorAll('.es-bar,.es-anim'));}
 function afterRender(){if(UI.section!=='escuela'){S.away=true;return;}const root=document.getElementById('es-root');if(!root||root.dataset.mounted)return;root.dataset.mounted='1';icons(root);
  try{requestAnimationFrame(()=>centerTab(false));}catch{}if(S.away){S.away=false;anim(root.querySelectorAll('.es-tabs,.es-bar,.es-anim'));}
  if(S.pendingReview){const p=S.pendingReview;S.pendingReview=null;setTimeout(()=>startReview(p.deck),reduced()?0:250);}}

 /* ---------------- events (delegated) ---------------- */
 const guard=fn=>{try{const r=fn();if(r&&typeof r.catch==='function')r.catch(err=>App.toast(err?.message||'Algo falló.','error'));}catch(err){App.toast(err?.message||'Algo falló.','error');}};
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-es]');if(!b||b.disabled)return;const a=b.dataset.es,id=b.dataset.id||'';
  if(a==='tab'){setTab(b.dataset.tab);return;}
  guard(()=>{
   if(a==='task-add')taskDialog(null,{kind:b.dataset.kind,subject:b.dataset.subject});
   else if(a==='task-edit'){const x=data().tasks.find(y=>y.id===id);if(x)taskDialog(x);}
   else if(a==='task-toggle')toggleTask(id,b);
   else if(a==='task-del')deleteTask(id);
   else if(a==='subj-add')subjectDialog(null,{name:b.dataset.name});
   else if(a==='subj-edit'){const s=subjOf(data(),id);if(s)subjectDialog(s);}
   else if(a==='subj-del')deleteSubject(id);
   else if(a==='row-add'){const box=document.getElementById('es-rows');if(!box)return;if(box.children.length>=CAP.rows){App.toast(`Máximo ${CAP.rows} horarios.`,'error');return;}box.insertAdjacentHTML('beforeend',schedRow());icons(box);}
   else if(a==='row-del'){const row=b.closest('.es-srow'),box=row?.parentElement;row?.remove();if(box&&!box.children.length){box.insertAdjacentHTML('beforeend',schedRow());icons(box);}}
   else if(a==='place-find')return findPlace(b);
   else if(a==='quick-date'){const f=b.closest('form');if(f?.elements.due)f.elements.due.value=addDays(today(),Number(b.dataset.days)||0);}
   else if(a==='filter'){S.filter=id;App.render();}
   else if(a==='card-add')cardDialog(null,{deck:b.dataset.deck});
   else if(a==='card-bulk')bulkDialog({deck:b.dataset.deck});
   else if(a==='card-gen')genDialog({deck:b.dataset.deck});
   else if(a==='card-edit'){const c=data().cards.find(y=>y.id===id);if(c)cardDialog(c);}
   else if(a==='card-del')deleteCard(id);
   else if(a==='review')startReview(b.dataset.deck||null);
   else if(a==='rv-flip')flip();
   else if(a==='rv-grade')grade(Number(b.dataset.q));
   else if(a==='rv-close')closeReview();
   else if(a==='rv-again'){const deck=R.deck;closeReview(true);startReview(deck);}
   else if(a==='grade-edit')gradeDialog(id,b.dataset.grade);
   else if(a==='grade-del')deleteGrade(id,b.dataset.grade);
   else if(a==='sum-play')return play(id);
   else if(a==='sum-del')deleteSummary(id);});});
 document.addEventListener('submit',ev=>{const f=ev.target.closest?.('[data-es-form]');if(!f)return;ev.preventDefault();
  if(f.dataset.esForm==='grade')guard(()=>{addGrade(f);const id=f.dataset.id;App.render();try{document.querySelector(`[data-es-form="grade"][data-id="${window.CSS?.escape?CSS.escape(id):id}"] [name=label]`)?.focus();}catch{}});
  else if(f.dataset.esForm==='summary')guard(()=>createSummary(f));});
 document.addEventListener('change',ev=>{const el=ev.target.closest?.('[data-es-change]');if(!el||el.dataset.esChange!=='target')return;const v=num(el.value);if(v==null||v<0||v>100){App.toast('La meta va de 0 a 100.','error');App.render();return;}guard(()=>{save(dd=>{const s=subjOf(dd,el.dataset.id);if(s)s.target=r1(v);});App.render();});});
 document.addEventListener('toggle',ev=>{const k=ev.target?.dataset?.openKey;if(!k)return;if(ev.target.open)S.open.add(k);else S.open.delete(k);},true);
 document.addEventListener('keydown',ev=>{if(R.on){reviewKey(ev);return;}const tab=ev.target?.closest?.('[data-es="tab"]');if(!tab||!['ArrowRight','ArrowLeft','Home','End'].includes(ev.key))return;ev.preventDefault();const keys=TABS.map(x=>x[0]),i=keys.indexOf(S.tab),n=ev.key==='Home'?0:ev.key==='End'?keys.length-1:(i+(ev.key==='ArrowRight'?1:-1)+keys.length)%keys.length;setTab(keys[n],true);},true);

 return Object.freeze({view,afterRender,classesOn,summary,weekStats,intent,sm2,average,needed,agendaItemsFor,countdown,parseBulk,chunks,startReview,closeReview,data:()=>structuredClone(data()),PALETTE,CAP});
})();
