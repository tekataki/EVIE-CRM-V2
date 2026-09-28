'use strict';
window.Migrations=(()=>{
 function migrateLegacy(input){
  if(input.version===2||input.version===3)return FarmUpgrade.migrate(input);
  if(input.version!==1)throw new Error('Versión de datos desconocida. No se modificó el almacenamiento.');
  const s=structuredClone(input),stamp=input.migrated_at||new Date().toISOString();
  for(const c of V2Domain.collections)s[c]=s[c]||[];
  for(const c of s.clients)c.deliverables=c.deliverables||[];
  for(const t of s.transactions)t.business_unit=t.business_unit||(t.source==='clients'?'soma':'personal');
  for(const r of s.routines)r.archived_at=r.archived_at||stamp;
  for(const old of s.sessions){old.archived_at=old.archived_at||stamp;if(!old.finished||old.deleted_at||s.gymSessions.some(g=>g.id===old.id))continue;
   const completed=old.sets.filter(t=>t.done),exercises=[...new Set(completed.map(t=>t.exercise))].map(name=>({name,equipment:null,primary_muscles:[],secondary_muscles:[],rank:null,sets:completed.filter(t=>t.exercise===name).map((t,i)=>({set_number:i+1,weight:t.weight,weight_unit:'kg',reps:t.reps,duration_seconds:null,is_warmup:false,is_failure:null}))}));
   const duration=old.ended_at&&old.started_at?Math.round((Date.parse(old.ended_at)-Date.parse(old.started_at))/1000):null;
   s.gymSessions.push({id:old.id,title:old.title,date:old.date,created_at:old.created_at,updated_at:old.updated_at,source:'migration-v1',completeness:'partial',duration_seconds:duration>=0?duration:null,reported_volume_kg:null,reported_total_sets:null,muscle_distribution:[],exercises,imported_ranks:[],uncertainties:['Sesión de DALI v1. Sin volumen, distribución ni rango reportados por Symmetry.'],notes:'Los datos originales permanecen archivados.'});
  }
  for(const g of s.goals){g.timezone=g.timezone||DALI_CONFIG.timezone;if(g.recurring&&!g.recurrence)g.recurrence={frequency:({diario:'daily',semanal:'weekly',mensual:'monthly',anual:'yearly'})[g.horizon],interval:1,time_local:null,days_of_week:[],day_of_month:null,end_date:null,timezone:DALI_CONFIG.timezone};}
  const order=Object.keys(DALI_CONFIG.widgets);s.preferences.widgetOrder=[...s.preferences.widgetOrder,...order.filter(k=>!s.preferences.widgetOrder.includes(k))];s.preferences.hiddenWidgets=[...new Set([...s.preferences.hiddenWidgets,'farm','books','alvento','content','vision'])];s.preferences.greeting=s.preferences.greeting||'jefe';s.preferences.hour12=s.preferences.hour12??false;
  if(!s.farmSettings.length)s.farmSettings.push({id:'bb47a1f0-8868-4fbe-80a0-cf0927ea7e01',title:'Rancho familiar',created_at:stamp,updated_at:stamp,effective_date:Domain.today(new Date(stamp)),gestation_days:114,lactation_days:35,heat_days:21,active_sire_name:'',reference_sows:0,target_sows:8,target_piglets:10,feed_fortnight_min:534400,feed_fortnight_max:550000,piglet_price:120000,kilo_price_min:3900,kilo_price_max:4000,sow_purchase_min:350000,sow_purchase_max:400000,cycle_cost:420000,supplies_cost:50000,reference_litter_revenue:1200000,milestones:[{day:3,title:'Protocolo hierro',enabled:true},{day:15,title:'Protocolo vitaminas',enabled:true},{day:20,title:'Revisión protocolo castración',enabled:true},{day:35,title:'Destete',enabled:true}],source:'configuration-reference'});
  s.version=2;s.migrated_at=stamp;s.migrations=[...(s.migrations||[]),{version:2,at:stamp,from:1}];return FarmUpgrade.migrate(s);
 }
 function migrate(input){
  if(input.version===4){const next=structuredClone(input);if(next.farm_catalog_version!==4){next.version=3;const updated=FarmUpgrade.upgradeReferences(next);updated.version=4;return updated;}return next;}
  return RCData.migrate(migrateLegacy(input));
 }
 return {migrate};
})();
