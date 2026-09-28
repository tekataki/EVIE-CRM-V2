'use strict';
/* Pure selectors and mutations through existing domain functions. No speech/storage here. */
window.IvyTools=(()=>{
 const A=V2Domain.assert,live=(s,c)=>s[c].filter(r=>!r.deleted_at),norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const find=(s,c,title)=>{const rows=live(s,c).filter(r=>norm(r.title)===norm(title));A(rows.length===1,rows.length?'Hay varios registros con ese título. Usa el formulario para elegir uno.':'No encontré un registro con ese título exacto.');return rows[0];};
 function read(kind,s=Store.get()){
  const today=Domain.today(),core=DaliCore.select(s),sales=core.sales;
  if(kind==='today'){const rows=live(s,'agendaItems').filter(r=>!['done','archived'].includes(r.status)&&Agenda.occurrence(r,today)&&!Agenda.isDone(r,today));return {route:'agenda',text:rows.length?rows.length+' pendientes hoy: '+rows.map(r=>r.title).join('; '):'No tienes pendientes fechados para hoy en Agenda. Revisa también tu bandeja sin horario.'};}
  if(kind==='next')return {route:core.nextAction?.route||'agenda',text:core.nextAction?core.nextAction.title+' · '+(core.nextAction.detail||core.nextAction.kind||'Agenda'):'No hay una siguiente acción registrada. Puedes capturar un pendiente en Agenda.'};
  if(kind==='payments'){const rows=live(s,'bills').filter(r=>Domain.outstanding(r)>0);return {route:'finanzas',text:rows.length?rows.map(r=>r.title+': '+Domain.money(Domain.outstanding(r))+' · '+r.date).join('; '):'No hay pagos por realizar registrados. Esto no incluye compromisos que aún no hayas capturado.'};}
  if(kind==='collected'||kind==='target')return {route:'soma',text:'SOMA · '+sales.month+': cobrado '+Domain.money(sales.collected)+' de '+Domain.money(sales.target)+' de meta mensual. Contratado vigente '+Domain.money(sales.contracted)+'; saldo por cobrar '+Domain.money(sales.receivable)+'; pipeline ponderado '+Domain.money(sales.pipeline)+' (no es dinero cobrado).'};
  if(kind==='followups'){const rows=live(s,'clients').filter(r=>r.nextDate&&r.nextDate<=today&&r.nextAction&&!['Perdido','Completado'].includes(r.stage));return {route:'soma',text:rows.length?rows.map(r=>r.title+': '+r.nextAction+' · '+r.nextDate).join('; '):'No hay seguimientos SOMA con fecha vencida o de hoy registrados.'};}
  if(kind==='farm'){const rows=Pig.alerts(s,today);return {route:'granja',text:rows.length?rows.map(r=>r.title+' · '+r.detail+(r.estimated?' (estimado, requiere verificar)':'')).join('; '):'No hay alertas registradas en Granja. Esto no es una evaluación veterinaria.'};}
  if(kind==='workout'){const row=live(s,'gymSessions').sort((a,b)=>b.date.localeCompare(a.date))[0];return {route:row?'gimnasio/'+row.id:'gimnasio',text:row?row.title+' · '+row.date+'. Volumen reportado: '+(row.reported_volume_kg==null?'desconocido':row.reported_volume_kg+' kg')+'. Calculado de series visibles: '+V2Domain.gym(row).computed_volume_kg+' kg.':'No hay entrenamientos importados registrados.'};}
  return {route:'inicio',text:'Datos registrados: '+live(s,'agendaItems').length+' pendientes en Agenda (todos los estados), '+live(s,'goals').length+' objetivos, '+live(s,'clients').length+' clientes, '+live(s,'gymSessions').length+' entrenamientos importados. Saldo del libro financiero: '+Domain.money(Domain.balance(live(s,'transactions')))+'. No es un puntaje de tu vida.'};
 }
 function build(intent,p,s){
  V2Domain.safeTree(p);A(p&&typeof p==='object','Parámetros inválidos.');
  const title=()=>{A(typeof p.title==='string'&&p.title.trim()&&p.title.length<=500,'¿Cuál es el título? Escribe hasta 500 caracteres.');return p.title.trim();};
  const date=()=>{A(V2Domain.date(p.date),'Indica la fecha como AAAA-MM-DD, hoy o mañana.');return p.date;};
  const amount=()=>{A(Number.isSafeInteger(p.amount)&&p.amount>0&&p.amount<=1e12,'Indica un importe positivo en MXN con hasta dos decimales.');return p.amount;};
  let fields,mutate,route;
  if(intent==='agenda.create'){
   const r=Store.record({...RCData.defaults('agendaItems'),title:title(),source:'ivy-confirmed'});
   A(!p.time||p.date,'Una hora necesita una fecha.');if(p.date){r.due_at=Agenda.toTimestamp(date()+'T'+(p.time||'23:59'));r.all_day=!p.time;r.status='scheduled';}
   fields={Título:r.title,Fecha:p.date||'Sin programar',Hora:p.time||'Todo el día',Área:'Personal',Prioridad:'Media'};mutate=s=>s.agendaItems.push(structuredClone(r));route='agenda/'+r.id;
  }else if(intent==='finance.create'){
   A(['income','expense'].includes(p.type),'Indica ingreso o gasto.');const r=Store.record(Records.normalize('transactions',{title:title(),date:date(),amount:amount(),type:p.type,category:p.category||'Personal',business_unit:'personal',source:'ivy-confirmed'}));
   fields={Concepto:r.title,Importe:Domain.money(r.amount),Tipo:r.type==='expense'?'Gasto':'Ingreso',Fecha:r.date,Categoría:r.category};mutate=s=>s.transactions.push(structuredClone(r));route='finanzas';
  }else if(intent==='goal.create'){
   const r=Store.record(Records.normalize('goals',{title:title(),date:date(),periodKey:Domain.periodKey('diario',p.date)}));fields={Título:r.title,Fecha:r.date,Meta:'1 paso',Repetición:'No repetir'};mutate=s=>s.goals.push(structuredClone(r));route='objetivos';
  }else if(intent==='journal.create'){
   const r=Store.record({title:title(),date:date(),text:p.text||p.title,raw_narrative:p.text||p.title,summary:'',productivity:null,reason:'',source:'manual',source_entry_id:Store.uuid(),journal_version:4,highlights:[],difficulties:[],learnings:[],tags:[],emotions:[],indicators:{},events:[],next_actions:[],review_required:false,confirmed_by_user:true,assistant_note:'Nota capturada por el usuario y confirmada; sin inferencias.'});fields={Título:r.title,Fecha:r.date,Texto:r.text,Indicadores:'No evaluados'};mutate=s=>s.journal.push(structuredClone(r));route='bitacora/'+r.id;
  }else if(intent==='agenda.complete'){
   const r=find(s,'agendaItems',title());A(!['done','archived'].includes(r.status),'El pendiente ya está completado o archivado.');const day=p.date||Domain.today();A(!Agenda.isDone(r,day),'Esta repetición ya está completada.');fields={Pendiente:r.title,Acción:'Completar',Ocurrencia:day};mutate=s=>Agenda.complete(s,r.id,day);route='agenda/'+r.id;
  }else if(intent==='soma.followup'){
   const r=find(s,'clients',title());A(typeof p.note==='string'&&p.note.trim()&&p.note.length<=2000,'¿Qué seguimiento necesitas registrar?');const day=date();fields={Cliente:r.title,Seguimiento:p.note,Fecha:day};mutate=s=>{const row=s.clients.find(x=>x.id===r.id);row.nextAction=p.note;row.nextDate=day;row.updated_at=new Date().toISOString();};route='soma/'+r.id;
  }else if(intent==='payment.create'){
   A(['clients','bills','loans'].includes(p.collection),'Selecciona cliente, pago pendiente o préstamo.');const r=find(s,p.collection,title());const payment={id:Store.uuid(),date:date(),amount:amount(),link:true};A(payment.amount<=Domain.outstanding(r),'El abono supera el saldo pendiente.');fields={Registro:r.title,Abono:Domain.money(payment.amount),Fecha:payment.date,Movimiento:p.collection==='bills'?'Gasto vinculado':'Ingreso vinculado'};mutate=s=>Domain.linkedPayment(s,p.collection,r.id,payment);route=p.collection==='clients'?'soma/'+r.id:'finanzas';
  }else throw new Error('Herramienta no registrada.');
  const check=structuredClone(s);mutate(check);Store.validate(check);return {fields,mutate,route};
 }
 return Object.freeze({read,build,norm,intents:Object.freeze(['agenda.create','finance.create','goal.create','journal.create','agenda.complete','soma.followup','payment.create'])});
})();
