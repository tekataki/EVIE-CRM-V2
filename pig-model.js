'use strict';
window.Pig=(()=>{
 const add=V2Domain.addDays,diff=V2Domain.days;
 const collections=['farmTasks','farmFeedProducts','farmFeedPriceHistory','farmFeedRules','farmFeedInventoryLots','farmFeedMovements'];
 const states={open:'Vacía',heat:'Celo observado',served_pending_confirmation:'Servida por confirmar',gestation_confirmed:'Gestación confirmada',prefarrowing:'Preparto estimado',lactation:'Lactancia',postweaning:'Posdestete',not_applicable:'No aplica'};
 const roles={sow:'Reproductora',breeding_sow:'Reproductora',gilt:'Primeriza',boar:'Semental',piglet:'Lechón',nursery:'Iniciación / destete',grower:'Crecimiento',developer:'Desarrollo',finisher:'Engorda',other:'Otro'};
 const events={heat_observed:'Celo observado',heat_ended_without_service:'Celo finalizado sin servicio',service:'Servicio / monta',pregnancy_check:'Revisión de gestación',return_to_heat:'Repetición de celo',farrowing:'Parto registrado',weaning:'Destete registrado',reproductive_loss:'Pérdida reproductiva',health_observation:'Observación de salud',sale:'Venta',death:'Fallecimiento',transfer:'Traslado',note:'Nota',state_correction:'Corrección auditada'};
 const type=e=>({mating:'service',health:'health_observation'})[e.type]||e.type;
 const normalize=x=>({empty:'open',gestation:'served_pending_confirmation'})[x]||x||'open';
 const breeding=a=>['sow','breeding_sow','gilt'].includes(a.role);
 const settings=s=>({gestation_days:114,lactation_days:35,maternity_capacity:3,prefarrowing_days:7,check_days:28,return_start:18,return_end:24,post_start:3,post_end:7,safety_buffer_percent:0,...s.farmSettings.at(-1)});
 function timeline(s,id,at=Domain.today()){const all=s.farmEvents.filter(e=>e.animal_id===id&&e.date<=at&&!e.deleted_at&&!e.reverted_at),voided=new Set(all.filter(e=>e.type==='state_correction'&&e.void_event_id).map(e=>e.void_event_id));return all.filter(e=>!voided.has(e.id)).sort((a,b)=>(a.occurred_at||a.date).localeCompare(b.occurred_at||b.date)||(a.created_at||'').localeCompare(b.created_at||'')||(a.sequence||0)-(b.sequence||0));}
 function derive(s,a,at=Domain.today()){
  const base=a.reproductive_baseline||{},r={state:breeding(a)?normalize(base.state||'open'):'not_applicable',life:base.life||a.initial_status||'active',since:base.since||a.acquisition_date||null,serviceDate:base.serviceDate||null,serviceId:null,farrowingDate:base.farrowingDate||null,weaningDate:null,sire_name:null,last:null};
  for(const ev of timeline(s,a.id,at)){const t=type(ev);r.last=ev;
   if(t==='heat_observed'||t==='return_to_heat'){r.state='heat';r.since=ev.date;if(t==='return_to_heat')r.serviceDate=null;}
   if(t==='heat_ended_without_service'||t==='reproductive_loss'){r.state='open';r.since=ev.date;r.serviceDate=null;}
   if(t==='service'){r.state='served_pending_confirmation';r.since=ev.date;r.serviceDate=ev.date;r.serviceId=ev.id;r.sire_name=ev.sire_name||s.farmAnimals.find(a=>a.id===ev.sire_id)?.name||null;}
   if(t==='pregnancy_check'){if(ev.result==='positive'){r.state='gestation_confirmed';r.since=ev.date;}if(ev.result==='negative'){r.state='open';r.since=ev.date;r.serviceDate=null;}}
   if(t==='farrowing'){r.state='lactation';r.since=ev.date;r.farrowingDate=ev.date;}
   if(t==='weaning'){r.state='postweaning';r.since=ev.date;r.weaningDate=ev.date;r.serviceDate=null;}
   if(t==='sale')r.life='sold';if(t==='death')r.life='deceased';if(t==='transfer')r.life=ev.destination_status||'transferred';
   if(t==='state_correction'&&ev.reproductive_state){r.state=normalize(ev.reproductive_state);r.since=ev.date;if(['open','heat','postweaning','not_applicable'].includes(r.state)){r.serviceDate=null;r.serviceId=null;}}
  }
  if(a.archived_at&&a.archived_at.slice(0,10)<=at)r.life='archived';
  r.due=r.serviceDate?add(r.serviceDate,settings(s).gestation_days):null;r.labelState=r.state==='gestation_confirmed'&&r.due&&diff(at,r.due)<=settings(s).prefarrowing_days&&diff(at,r.due)>=0?'prefarrowing':r.state;return r;
 }
 function allowed(r,a){if(r.life!=='active')return ['note','state_correction'];const common=['note','health_observation','state_correction','death','transfer'];if(!breeding(a))return [...common,'sale'];const map={open:['heat_observed','service','sale'],postweaning:['heat_observed','service','sale'],heat:['service','heat_ended_without_service'],served_pending_confirmation:['pregnancy_check','return_to_heat','service'],gestation_confirmed:['pregnancy_check','farrowing','reproductive_loss'],lactation:['weaning']};return [...(map[r.state]||[]),...common];}
 function capacity(s,start,end){const f=settings(s),intervals=[];for(const a of s.farmAnimals.filter(a=>!a.deleted_at)){const r=derive(s,a,start);if(r.life!=='active')continue;let from,to;if(r.state==='lactation'){from=r.farrowingDate||r.since;to=from?add(from,f.lactation_days):null;}else if(['served_pending_confirmation','gestation_confirmed'].includes(r.state)&&r.due){from=add(r.due,-f.prefarrowing_days);to=add(r.due,f.lactation_days);}if(from&&to>=start&&from<=end)intervals.push({animal_id:a.id,label:a.ear_tag,from,to,provisional:r.state==='served_pending_confirmation'});}const days=[];for(let date=start;date<=end;date=add(date,1)){const count=intervals.filter(x=>x.from<=date&&x.to>=date).length;days.push({date,count,overflow:count>f.maternity_capacity});}return {capacity:f.maternity_capacity,intervals,days,max:Math.max(0,...days.map(d=>d.count))};}
 return {collections,states,roles,events,settings,type,breeding,normalize,timeline,derive,allowed,capacity};
})();
