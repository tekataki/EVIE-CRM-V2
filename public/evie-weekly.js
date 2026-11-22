'use strict';
/* EVIE v10 · Revisión del domingo. Reporte de tu semana con tus datos reales (sin IA): misión (ahorro de la semana),
   físico (entrenos vs. la semana anterior), SOMA (cobrado, prospectos nuevos, ganados/perdidos, seguimientos
   atrasados), finanzas (neto), escuela y ánimo del diario de Kisha (solo si permitiste cruzarlo con otros módulos).
   Propone 3 prioridades (reglas locales; editables) y, si quieres, Ivi agrega su análisis (/api/weekly/review).
   Se abre sola el domingo desde las 17:00 (o el lunes en la mañana si no la hiciste). Se guardan las últimas 12. */
window.EvieWeekly=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const money=c=>Domain.money(Math.round(Number(c)||0));
 const today=()=>Domain.today();
 const addDays=(d,n)=>window.V2Domain?.addDays?V2Domain.addDays(d,n):new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
 const dow=d=>new Date(d+'T12:00:00').getDay();
 const short=d=>new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'});
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 /** Week = the 7 days ending on `end` (Sunday when run on Sunday; on Monday, the week that just ended). */
 function weekEnd(t=today()){const d=dow(t);return d===0?t:d===1&&new Date().getHours()<12?addDays(t,-1):t;}
 function reviews(){return Array.isArray(P().weeklyReviews)?P().weeklyReviews:[];}
 const inRange=(d,a,b)=>!!d&&d>=a&&d<=b;
 function build(end=weekEnd()){const from=addDays(end,-6),pFrom=addDays(end,-13),pTo=addDays(end,-7),tx=Store.list('transactions');
  // Misión: ahorro de la semana desde el historial diario
  let mission=null;const mp=window.EvieMission?.plan?.();if(mp){const h=(EvieMission.cfg()?.history||[]),prev=h.filter(x=>x.date<=pTo).at(-1),first=h.find(x=>x.date>=from&&x.date<=end),startV=prev?prev.saved_cents:first?(first.open??first.saved_cents):mp.saved;mission={name:mp.name,pct:mp.pct,saved:mp.saved,week:mp.saved-startV,onTrack:mp.onTrack,required:mp.required,late:mp.late};}
  // Físico
  const gs=Store.list('gymSessions'),cnt=(a,b)=>gs.filter(s=>inRange(String(s.date||'').slice(0,10),a,b)).length;
  const muscles=new Set(gs.filter(s=>inRange(String(s.date||'').slice(0,10),from,end)).flatMap(s=>(s.exercises||[]).flatMap(x=>x.muscles||[])));
  const fisico={sessions:cnt(from,end),prev:cnt(pFrom,pTo),groups:muscles.size};
  // SOMA
  const clients=Store.list('clients'),closed=/complet|perdid|pausad|ganad/i;
  const soma={income:tx.filter(x=>x.business_unit==='soma'&&x.type==='income'&&!x.transfer_id&&inRange(x.date,from,end)).reduce((a,x)=>a+(Number(x.amount)||0),0),
   newClients:clients.filter(c=>inRange(String(c.created_at||'').slice(0,10),from,end)).length,
   won:clients.filter(c=>c.cabin?.outcome?.result==='won'&&inRange(String(c.cabin.outcome.at||'').slice(0,10),from,end)).length,
   lost:clients.filter(c=>c.cabin?.outcome?.result==='lost'&&inRange(String(c.cabin.outcome.at||'').slice(0,10),from,end)).length,
   overdue:clients.filter(c=>c.nextDate&&c.nextDate<today()&&!closed.test(c.stage||'')&&!c.cabin?.outcome).length};
  // Finanzas
  let finance={income:0,expense:0,net:0};try{const t=FinanceCore.periodTotals(tx,from,end);finance={income:t.income,expense:t.expense,net:t.net};}catch{}
  // Escuela
  let school=null;try{if(window.EvieSchool?.weekStats){const w=EvieSchool.weekStats(from,end),s=EvieSchool.summary?.()||{};school={tasksDone:w.tasksDone||0,reviews:w.reviews||0,exams:(w.examsNext7||[]).slice(0,3),average:w.average??s.average??null,overdue:s.overdue||0,cardsDue:s.cardsDue||0};}}catch{}
  // Ánimo (solo con permiso explícito del diario)
  let mood={locked:true};if(P().journalPrivacy?.crossModule===true&&window.KishaCore?.trends){try{const tr=KishaCore.trends(Store.list('journal'),{from,to:end});mood={locked:false,entries:tr.entries||0,top:(tr.emotions||[]).slice().sort((a,b)=>b.mean-a.mean).slice(0,3).map(x=>({label:x.label,mean:Math.round(x.mean)}))};}catch{}}
  return {from,to:end,mission,fisico,soma,finance,school,mood};}
 /** Up to 3 local priorities, most urgent first. */
 function priorities(m){const out=[];
  for(const x of m.school?.exams||[])out.push({text:`Prepárate para «${x.title}»${x.subject?' ('+x.subject+')':''}`,why:`Examen el ${short(x.due)}.`});
  if(m.soma.overdue)out.push({text:`Ponte al día con ${m.soma.overdue} ${m.soma.overdue===1?'seguimiento':'seguimientos'} de SOMA`,why:'Prospectos con fecha de contacto vencida.'});
  if(m.mission&&!m.mission.onTrack&&m.mission.required>0)out.push({text:`Aparta ${money(Math.ceil(m.mission.required/4.35))} esta semana para «${m.mission.name}»`,why:`Necesitas ${money(m.mission.required)} al mes para llegar a tiempo.`});
  if(m.fisico.sessions<3)out.push({text:'Entrena al menos 3 veces',why:`Esta semana: ${m.fisico.sessions} ${m.fisico.sessions===1?'entreno':'entrenos'}.`});
  if(m.school?.overdue)out.push({text:`Entrega ${m.school.overdue} ${m.school.overdue===1?'tarea atrasada':'tareas atrasadas'}`,why:'Escuela.'});
  if(m.school?.cardsDue>15)out.push({text:`Repasa tus tarjetas (${m.school.cardsDue} pendientes)`,why:'Repaso espaciado.'});
  if(m.finance.net<0)out.push({text:'Revisa tus gastos',why:`Saliste ${money(-m.finance.net)} abajo esta semana.`});
  if(!out.length)out.push({text:'Mantén el ritmo de esta semana',why:'Todo en orden.'});
  return out.slice(0,3);}
 const current=()=>{const end=weekEnd();return reviews().find(r=>r.week===end)||null;};
 function tiles(m){const d=(a,b)=>a>b?'up':a<b?'down':'same';
  return `<div class="wk-tiles">
   ${m.mission?`<div class="wk-tile"><span>${ic('rocket')}Misión</span><b>${m.mission.week>=0?'+':''}${money(m.mission.week)}</b><small>${e(m.mission.name)} · ${m.mission.pct} %</small></div>`:''}
   <div class="wk-tile" data-trend="${d(m.fisico.sessions,m.fisico.prev)}"><span>${ic('dumbbell')}Físico</span><b>${m.fisico.sessions} ${m.fisico.sessions===1?'entreno':'entrenos'}</b><small>semana anterior: ${m.fisico.prev}${m.fisico.groups?` · ${m.fisico.groups} grupos`:''}</small></div>
   <div class="wk-tile"><span>${ic('handshake')}SOMA</span><b>${money(m.soma.income)}</b><small>${m.soma.newClients} nuevos · ${m.soma.won} ganados · ${m.soma.lost} perdidos</small></div>
   <div class="wk-tile" data-trend="${m.finance.net>=0?'up':'down'}"><span>${ic('wallet')}Finanzas</span><b>${m.finance.net>=0?'+':'−'}${money(Math.abs(m.finance.net))}</b><small>entró ${money(m.finance.income)} · salió ${money(m.finance.expense)}</small></div>
   ${m.school?`<div class="wk-tile"><span>${ic('graduation-cap')}Escuela</span><b>${m.school.tasksDone} ${m.school.tasksDone===1?'tarea':'tareas'}</b><small>${m.school.reviews} repasos${m.school.average!=null?` · promedio ${m.school.average}`:''}</small></div>`:''}
   <div class="wk-tile"><span>${ic('heart-pulse')}Ánimo</span>${m.mood.locked?'<b>Privado</b><small>Actívalo en el diario de Kisha</small>':m.mood.entries?`<b>${e(m.mood.top.map(x=>x.label).join(' · ')||'—')}</b><small>${m.mood.entries} ${m.mood.entries===1?'entrada':'entradas'} del diario</small>`:'<b>—</b><small>Sin entradas esta semana</small>'}</div>
  </div>`;}
 function render(d){const m=d.metrics,saved=d.saved,pr=saved?.priorities||d.priorities;
  return `<div class="wk bf"><div class="bf-top"><div><span class="bf-eyebrow">REVISIÓN SEMANAL</span><p class="bf-date">${e(short(m.from))} – ${e(short(m.to))}</p></div>${saved?`<span class="ms-pill good">${ic('check')}Guardada</span>`:''}</div>
   ${tiles(m)}
   ${saved?.ai?`<section class="bf-sec wk-ai"><h4>${ic('sparkles')}Análisis de Ivi</h4><p>${e(saved.ai.resumen)}</p>${(saved.ai.logros||[]).length?`<ul class="wk-list good">${saved.ai.logros.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`:''}${(saved.ai.alertas||[]).length?`<ul class="wk-list warn">${saved.ai.alertas.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`:''}</section>`:''}
   <section class="bf-sec"><h4>${ic('list-checks')}3 prioridades para la semana</h4><ol class="wk-prio">${pr.map((p,i)=>`<li>${saved?`<label><input type="checkbox" data-wk="done" data-i="${i}" ${p.done?'checked':''}><span>${e(p.text)}</span></label>`:`<input class="input" data-wk-p="${i}" value="${e(p.text)}" maxlength="120" aria-label="Prioridad ${i+1}">`}${p.why?`<small>${e(p.why)}</small>`:''}</li>`).join('')}</ol></section>
   <div class="bf-actions">${saved?'':`<button type="button" class="button primary" data-wk="save">${ic('check')}Guardar prioridades</button>`}${cloud()?`<button type="button" class="button" data-wk="ai">${ic('sparkles')}${saved?.ai?'Actualizar análisis':'Análisis de Ivi'}</button>`:''}${saved?`<button type="button" class="button" data-wk="goals">${ic('target')}Volverlas objetivos</button>`:''}</div></div>`;}
 function data(){const metrics=build(),saved=current();return {metrics:saved?.metrics||metrics,saved,priorities:priorities(metrics)};}
 const card={title:'Revisión del domingo',icon:'calendar-check',scope:'account',load:async()=>data(),render};
 if(window.EvieCards?.R)EvieCards.R.weekly=card;
 function persist(fn){Store.save(s=>{const list=Array.isArray(s.preferences.weeklyReviews)?s.preferences.weeklyReviews:[];fn(list);s.preferences.weeklyReviews=list.sort((a,b)=>a.week.localeCompare(b.week)).slice(-12);});}
 function saveCurrent(root){const m=build(),end=m.to,base=priorities(m),edits=[...(root?.querySelectorAll('[data-wk-p]')||[])].map(i=>i.value.trim()).filter(Boolean);
  const pr=(edits.length?edits:base.map(x=>x.text)).slice(0,3).map((text,i)=>({text:text.slice(0,120),why:base[i]?.why||'',done:false}));
  persist(list=>{const i=list.findIndex(r=>r.week===end),row={week:end,created_at:new Date().toISOString(),metrics:m,priorities:pr,ai:i>=0?list[i].ai:null};if(i>=0)list[i]=row;else list.push(row);});}
 function refresh(){window.EvieHUD?.open?.('weekly');const box=document.getElementById('wk-dialog');if(box){box.innerHTML=render(data());window.lucide?.createIcons?.({root:box});}if(UI.section==='objetivos')App.render();}
 /** Payload for Ivi: only numbers and short labels, never diary text. */
 function aiPayload(m){return {range:{from:m.from,to:m.to},mission:m.mission&&{name:m.mission.name,pct:m.mission.pct,week_cents:m.mission.week,on_track:m.mission.onTrack,required_monthly_cents:m.mission.required},fisico:m.fisico,soma:{...m.soma},finance:m.finance,school:m.school&&{tasks_done:m.school.tasksDone,reviews:m.school.reviews,exams:m.school.exams.map(x=>({title:x.title,subject:x.subject,due:x.due})),average:m.school.average,overdue:m.school.overdue},mood:m.mood.locked?null:{entries:m.mood.entries,top:m.mood.top},priorities:(current()?.priorities||[]).map(p=>p.text)};}
 async function analyze(btn){const cur=current();if(!cur){App.toast('Primero guarda tus prioridades.','error');return;}btn&&(btn.disabled=true);
  try{const r=await EvieAccounts.request('weekly/review',{method:'POST',body:aiPayload(cur.metrics)});persist(list=>{const row=list.find(x=>x.week===cur.week);if(row){row.ai={resumen:r.review.resumen,logros:r.review.logros,alertas:r.review.alertas};if((r.review.prioridades||[]).length===3)row.priorities=r.review.prioridades.map(p=>({text:p.titulo,why:p.por_que,done:false}));}});App.toast('Listo: Ivi revisó tu semana.','success');refresh();}
  catch(err){App.toast(err.message||'Ivi no pudo revisar tu semana ahora.','error');}finally{btn&&(btn.disabled=false);}}
 function toGoals(){const cur=current();if(!cur)return;const date=addDays(cur.week,7);let n=0;Store.save(s=>{for(const p of cur.priorities){if(s.goals.some(g=>!g.deleted_at&&g.title===p.text&&g.horizon==='semanal'))continue;s.goals.push(Store.record(Records.normalize('goals',{title:p.text.slice(0,120),date,horizon:'semanal',category:'Personal',target:1,progress:0,periodKey:Domain.periodKey('semanal',date),description:'Prioridad de la revisión semanal.'})));n++;}});App.toast(n?`Agregué ${n} ${n===1?'objetivo':'objetivos'} de la semana.`:'Ya estaban en Objetivos.','success');}
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-wk]');if(!b||b.matches('input'))return;const a=b.dataset.wk;
  if(a==='save'){saveCurrent(b.closest('.wk'));App.toast('Prioridades guardadas.','success');refresh();}
  else if(a==='ai')analyze(b);else if(a==='goals')toGoals();else if(a==='open')openDialog();});
 document.addEventListener('change',ev=>{const b=ev.target.closest?.('[data-wk="done"]');if(!b)return;const cur=current();if(!cur)return;persist(list=>{const row=list.find(x=>x.week===cur.week);if(row?.priorities[b.dataset.i])row.priorities[b.dataset.i].done=b.checked;});});
 function openDialog(){App.openDialog('Revisión del domingo',`<div id="wk-dialog">${render(data())}</div>`);window.lucide?.createIcons?.({root:document.getElementById('wk-dialog')});}
 /** Objetivos: compact panel with this week's priorities. */
 function panel(){const cur=reviews().at(-1),fresh=current();
  return `<section class="panel wk-panel v8-card" id="wk-panel" aria-label="Revisión semanal"><div class="wk-panel-top"><div><span class="ms-eyebrow">REVISIÓN SEMANAL</span><h3>${fresh?'Prioridades de esta semana':'Tu revisión del domingo'}</h3></div><button type="button" class="button small ${fresh?'':'primary'}" data-wk="open">${ic('calendar-check')}${fresh?'Ver revisión':'Hacer revisión'}</button></div>
   ${cur?`<ol class="wk-prio compact">${cur.priorities.map((p,i)=>`<li><label><input type="checkbox" data-wk="done" data-i="${i}" ${p.done?'checked':''} ${cur===fresh?'':'disabled'}><span>${e(p.text)}</span></label></li>`).join('')}</ol>${cur===fresh?'':`<p class="ms-muted">De la semana que terminó el ${e(short(cur.week))}.</p>`}`:'<p class="ms-muted">Cada domingo Ivi junta tu semana (misión, físico, SOMA, finanzas, escuela y ánimo) y te propone 3 prioridades.</p>'}</section>`;}
 function afterRender(){const sec=UI.section;
  if(sec==='objetivos'&&!UI.id){const main=document.getElementById('main-content');if(main&&!main.querySelector('#wk-panel')){const a=main.querySelector('#ms-panel')||main.querySelector('.page-heading');a?.insertAdjacentHTML('afterend',panel());window.lucide?.createIcons?.({root:main.querySelector('#wk-panel')});}}
  if(sec!=='inicio'||!window.EvieHUD)return;const t=today(),d=dow(t),h=new Date().getHours();if(!((d===0&&h>=17)||(d===1&&h<12)))return;if(current())return;
  let last='';try{last=localStorage.getItem('evie-weekly-last')||'';}catch{}const end=weekEnd();if(last===end)return;try{localStorage.setItem('evie-weekly-last',end);}catch{}
  setTimeout(()=>window.EvieHUD?.open?.('weekly'),900);}
 function intent(text){const t=String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');if(!/revision (semanal|del domingo|de la semana)|resumen (semanal|de (la|mi) semana)|como me fue (esta|en la) semana/.test(t))return '';
  if(UI.section==='inicio'&&window.EvieHUD)EvieHUD.open('weekly');else openDialog();const m=build();
  return `Tu semana: ${m.fisico.sessions} ${m.fisico.sessions===1?'entreno':'entrenos'}, SOMA cobró ${money(m.soma.income)}${m.mission?` y la misión ${m.mission.week>=0?'sumó':'bajó'} ${money(Math.abs(m.mission.week))}`:''}. Te dejé tus 3 prioridades en pantalla.`;}
 return Object.freeze({build,priorities,render,card,panel,afterRender,intent,reviews,weekEnd,aiPayload});
})();
