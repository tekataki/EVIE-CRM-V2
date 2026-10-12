'use strict';
/* EVIE Pendientes: one account-scoped, deduplicated list of actionable items derived from the
   existing modules. Pure: build(state, {today, now}) never writes. Severity rules:
   red    = overdue, or due today with its time already passed / within 2 h
   yellow = due today, or within the next 3 days
   green  = later (up to 14 days)
   Items without a date never get an invented deadline. */
window.EviePendientes=(()=>{
 const DAY=86400000;
 const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
 const diff=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/DAY);
 const money=c=>window.Domain?.money?Domain.money(c):(c/100).toFixed(2);
 const outstanding=x=>Math.max(0,(x.amount||0)-(x.payments||[]).reduce((s,p)=>s+(p.amount||0),0));
 function severity(date,time,today,nowHM){if(!date)return 'green';const d=diff(date,today);if(d<0)return 'red';if(d===0){if(time&&nowHM){const [h,m]=time.split(':').map(Number),[H,M]=nowHM.split(':').map(Number);if((h*60+m)-(H*60+M)<=120)return 'red';}return 'yellow';}return d<=3?'yellow':'green';}
 const rank={red:0,yellow:1,green:2};
 function build(s,{today,now='',horizon=14,agenda=window.Agenda,life=window.EvieLife,payments=window.SomaPayments}={}){
  const out=[],seen=new Set(),limit=addDays(today,horizon);
  const push=it=>{if(seen.has(it.key))return;seen.add(it.key);it.severity=severity(it.date,it.time,today,now);out.push(it);};
  const live=c=>(s[c]||[]).filter(r=>!r.deleted_at);
  if(payments)for(const p of payments.upcoming(s,{today,until:limit}))push({key:'soma:'+p.schedule_id+':'+p.due,source:'SOMA',kind:'Cobro',title:p.client+' · '+money(p.remaining),detail:(p.partial?'Abono parcial · ':'')+'Cuota '+p.label+' · '+p.title,date:p.due,time:null,route:'soma/'+p.client_id,action:'Registrar cobro'});
  if(agenda)for(const r of live('agendaItems').filter(r=>!['done','archived','cancelled'].includes(r.status))){
   if(r.recurrence){for(let d=addDays(today,-7);d<=limit;d=addDays(d,1)){if(agenda.occurrence(r,d)&&!agenda.isDone(r,d)&&(d>=today||r.kind!=='event')){push({key:'agenda:'+r.id+':'+d,source:'Agenda',kind:r.kind==='event'?'Evento':'Pendiente',title:r.title,detail:r.area==='finance'?'Pago programado':'Serie',date:d,time:r.all_day?null:(r.recurrence.time_local||null),route:'agenda/'+r.id,action:'Abrir en Agenda'});if(d>=today)break;}}continue;}
   const d=agenda.dateOf(r);if(!d||d>limit)continue;if(r.kind==='event'&&d<today)continue;
   const at=r.all_day?null:(agenda.localValue?.(r.due_at||r.start_at)||'').slice(11,16)||null;
   push({key:'agenda:'+r.id+':'+d,source:'Agenda',kind:r.kind==='event'?'Evento':'Pendiente',title:r.title,detail:'Prioridad '+(agenda.priorities?.[r.priority]||'Media'),date:d,time:at,route:'agenda/'+r.id,action:'Abrir en Agenda'});}
  for(const b of live('bills').filter(b=>outstanding(b)>0&&b.date<=limit))push({key:'bill:'+b.id,source:'Finanzas',kind:'Pago',title:b.title,detail:'Por pagar '+money(outstanding(b)),date:b.date,time:null,route:'finanzas',action:'Abrir Finanzas'});
  for(const l of live('loans').filter(l=>outstanding(l)>0&&l.date&&l.date<=limit))push({key:'loan:'+l.id,source:'Finanzas',kind:'Préstamo',title:l.title,detail:'Saldo '+money(outstanding(l)),date:l.date,time:null,route:'finanzas',action:'Abrir Finanzas'});
  for(const g of live('goals').filter(g=>!g.archived&&g.progress<g.target&&g.date&&g.date<=limit))push({key:'goal:'+g.id,source:'Objetivos',kind:'Objetivo',title:g.title,detail:g.progress+' / '+g.target,date:g.date,time:null,route:'objetivos',action:'Abrir Objetivos'});
  for(const c of live('clients').filter(c=>c.nextDate&&c.nextAction&&c.nextDate<=limit))push({key:'client:'+c.id+':'+c.nextDate,source:'SOMA',kind:'Seguimiento',title:c.title,detail:c.nextAction,date:c.nextDate,time:null,route:'soma/'+c.id,action:'Abrir cliente'});
  if(life&&s.evieData)try{for(const x of life.todayList())if(!x.done)push({key:'habit:'+x.h.id+':'+today,source:'Hábitos',kind:'Hábito',title:x.h.title,detail:'Programado hoy',date:today,time:x.h.time||null,route:'habitos',action:'Abrir Hábitos'});}catch{}
  return out.sort((a,b)=>rank[a.severity]-rank[b.severity]||(a.date||'9').localeCompare(b.date||'9')||(a.time||'99').localeCompare(b.time||'99')||a.title.localeCompare(b.title));
 }
 const counts=list=>list.reduce((a,x)=>(a[x.severity]++,a),{red:0,yellow:0,green:0});
 function spoken(list,name=''){if(!list.length)return (name?name+', ':'')+'no tienes pendientes con fecha en las próximas dos semanas.';const c=counts(list),top=list.slice(0,3).map(x=>x.title).join(', ');return `${name?name+', ':''}tienes ${list.length} pendiente${list.length>1?'s':''}${c.red?`, ${c.red} urgente${c.red>1?'s':''}`:''}. Primero: ${top}.`;}
 return Object.freeze({build,severity,counts,spoken,addDays});
})();
