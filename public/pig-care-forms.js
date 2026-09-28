'use strict';
PigForms.health=id=>NeuralCare.health(id);
PigForms.task=function(){const F=Forms,windows=Pig.alerts(Store.get()).filter(a=>a.estimated&&a.kind!=='health'&&a.date>=Domain.today());F.form('Pendiente','Completar no modifica estados reproductivos. Una ventana estimada no confirma ningún evento.',F.field('title','Título','','text','required',true)+F.field('date','Fecha',Domain.today(),'date','required')+F.select('category','Categoría',[['manual','Manual'],['reproduction','Reproducción'],['litter','Camada'],['feed','Alimento'],['health','Salud']],'manual')+F.select('priority','Prioridad',[['low','Baja'],['medium','Media'],['high','Alta']],'medium')+F.check('preparation_required','Es una preparación requerida para una ventana estimada',false)+F.select('origin_key','Ventana de Granja · opcional',[['','Sin vincular'],...windows.map(a=>[a.id,a.title+' · '+a.date+' · '+a.detail])],'',true)+F.area('notes','Notas',''),d=>{const window=windows.find(a=>a.id===d.origin_key);V2Domain.assert(!d.preparation_required||window,'Selecciona la ventana estimada que requiere preparación.');Store.put('farmTasks',{...d,preparation_required:!!d.preparation_required,status:'pending',animal_id:window?.animal_id||null,origin_key:window?.id||null});});};
PigForms.litter=function(id){const r=Store.list('farmLitters').find(r=>r.id===id),F=Forms,labels={born_total:'Nacidos totales',born_alive:'Nacidos vivos',stillborn:'Nacidos muertos',mummified:'Momificados',adoptions:'Adopciones recibidas',transfers:'Traslados salientes',losses:'Bajas registradas'};let fields='';for(const [k,label] of Object.entries(labels))fields+=F.field(k,label,r[k]??'','number','min="0" max="1000" step="1"');fields+=F.area('notes','Motivo de actualización',r.notes||'','required');F.form('Datos de camada','Se conserva la versión anterior.',fields,d=>{for(const k of Object.keys(labels))d[k]=d[k]===''?null:Number(d[k]);Store.put('farmLitters',{...d,history:[...(r.history||[]),{at:new Date().toISOString(),data:{...r,history:undefined}}]},id);});};
PigForms.settings=function(){
 const r=Pig.settings(Store.get()),F=Forms,labels={gestation_days:'Gestación · días estimados',lactation_days:'Destete · día objetivo',check_days:'Revisión · días tras servicio',prefarrowing_days:'Preparto · días de anticipación',maternity_capacity:'Espacios de maternidad',target_sows:'Meta de reproductoras',target_piglets:'Meta de lechones',late_gestation_day:'Gestación tardía · día de referencia',safety_buffer_percent:'Colchón de compra · %'};
 let fields=F.field('effective_date','Fecha efectiva',Domain.today(),'date','required');
 for(const [k,l] of Object.entries(labels))fields+=F.field(k,l,r[k]??0,'number','min="0" max="400" step="1" required');
 fields+=NeuralMilestones.html(r.milestones||[]);let editor;
 F.form('Ajustes del rancho','Referencias operativas, no prescripciones. Los cambios solo se aplican al confirmar.',fields,d=>{
  const next={...r,...d};delete next.id;
  for(const k of Object.keys(labels))next[k]=Number(d[k]);
  next.milestones=editor.read();
  V2Domain.assert(next.milestones.every(m=>V2Domain.integer(m.day,0,400)&&m.title.trim()&&typeof m.enabled==='boolean'),'Cada hito necesita nombre y día relativo entre 0 y 400.');
  V2Domain.assert(next.maternity_capacity>0&&next.safety_buffer_percent<=100,'Capacidad positiva y colchón hasta 100%.');
  Store.put('farmSettings',next);
 },'Guardar ajustes');
 editor=NeuralMilestones.mount(r.milestones||[]);
};
