'use strict';
window.LocalAgendaProvider=(()=>{
 const proposals=new Map(),assert=(v,m)=>{if(!v)throw Error(m);};
 const transaction=r=>({id:r.id,title:r.title,type:r.type,amount:r.amount,currency:'MXN',date:r.date,category:r.category,business_unit:r.business_unit,client_id:r.client_id||null,archived:!!r.deleted_at});
 const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function entities(args){const collections=args.collection?[args.collection]:['clients','books','alventoProducts','farmAnimals','contentItems','goals'];assert(collections.every(c=>['clients','books','alventoProducts','farmAnimals','contentItems','goals'].includes(c)),'Colección no permitida.');return collections.flatMap(c=>Store.list(c).filter(r=>norm(r.title||r.name||r.ear_tag).includes(norm(args.query))).map(r=>({id:r.id,title:r.title||r.name||r.ear_tag,collection:c,business_unit:r.business_unit||(c==='clients'?'soma':c==='alventoProducts'?'alvento':c==='farmAnimals'?'granja':null)}))).slice(0,50);}
 const present=r=>({id:r.id,title:r.title,kind:r.kind,status:r.status,start:Agenda.localValue(r.start_at),due:Agenda.localValue(r.due_at),all_day:r.all_day,recurring:!!r.recurrence});
 function read(name,args){const rows=Store.list('agendaItems');
  if(name==='crm.search_entities')return {records:entities(args)};
  if(name==='crm.verify_record'){assert(['transactions','agendaItems'].includes(args.collection),'Colección no permitida.');const row=Store.get()[args.collection].find(r=>r.id===args.id);assert(row,'Registro no encontrado.');return {verified:true,record:args.collection==='transactions'?transaction(row):present(row)};}
  if(name==='finance.search_transactions'){return {records:Store.list('transactions').filter(r=>(!args.query||norm(r.title).includes(norm(args.query)))&&(!args.date||r.date===args.date)&&(!args.type||r.type===args.type)).slice(0,100).map(transaction)};}
  if(name==='finance.get_summary'){const list=Store.list('transactions').filter(r=>(!args.from||r.date>=args.from)&&(!args.to||r.date<=args.to)&&(!args.business_unit||r.business_unit===args.business_unit));const income=list.filter(r=>r.type==='income').reduce((n,r)=>n+r.amount,0),expense=list.filter(r=>r.type==='expense').reduce((n,r)=>n+r.amount,0);return {currency:'MXN',unit:'integer cents',income,expense,balance:income-expense,count:list.length,provider:'Libro de Finanzas EVIE'};}

  if(name==='crm.get_today_agenda')return {date:Domain.today(),timezone:DALI_CONFIG.timezone,records:rows.filter(r=>!['done','archived'].includes(r.status)&&Agenda.occurrence(r,Domain.today())&&!Agenda.isDone(r,Domain.today())).slice(0,100).map(present)};
  if(name==='crm.search_events'){const filtered=rows.filter(r=>(!args.query||r.title.toLocaleLowerCase().includes(args.query.toLocaleLowerCase()))&&(!args.date||Agenda.occurrence(r,args.date))&&(!args.time||Agenda.localValue(r.start_at||r.due_at).slice(11)===args.time));return {records:filtered.slice(0,100).map(present),total:filtered.length};}
  if(name==='crm.get_dashboard_summary')return {summary:IvyTools.read('stats').text,provider:'Agenda local',date:Domain.today()};
 }
 function propose(p){for(const [id,v]of proposals)if(v.expires<Date.now())proposals.delete(id);assert(proposals.size<8,'Cancela las propuestas anteriores.');const token=crypto.randomUUID();proposals.set(token,{...p,scope:DALI_CONFIG.storageKey,raw:localStorage.getItem(DALI_CONFIG.storageKey),revision:Store.get().revision,expires:Date.now()+120000});return {token,preview:p.preview};}
 function finance(name,args){
  const create=name==='finance.create_transaction',remove=name==='finance.delete_transaction';
  assert(['finance.create_transaction','finance.update_transaction','finance.delete_transaction'].includes(name),'Herramienta financiera inválida.');
  const allowed=['id','title','type','amount','date','category','business_unit','client_id','entity_name','note'];for(const key of Object.keys(args))assert(allowed.includes(key),'Campo no permitido.');
  const old=create?null:Store.list('transactions').find(r=>r.id===args.id);assert(create||old,'Selecciona un movimiento existente.');assert(!old?.origin,'Modifica/revierte este movimiento desde su registro vinculado original.');
  const patch={...args};delete patch.id;delete patch.entity_name;
  if(args.entity_name){const matches=Store.list('clients').filter(r=>norm(r.title||r.name)===norm(args.entity_name));const selected=args.client_id?matches.find(r=>r.id===args.client_id):matches.length===1?matches[0]:null;assert(!args.client_id||selected,'Cliente y nombre no coinciden.');if(matches.length>1&&!selected)return {result:{ok:false,error:'Hay varios clientes '+args.entity_name+'. Indica el ID del cliente correcto: '+matches.slice(0,10).map(r=>r.id).join(', '),clarification:{kind:'client',choices:matches.slice(0,10).map(r=>({id:r.id,title:r.title}))}}};if(selected){patch.client_id=selected.id;patch.business_unit=selected.business_unit||'soma';}}
  if(patch.client_id){const client=Store.list('clients').find(r=>r.id===patch.client_id);assert(client,'Cliente no encontrado; no se inventan IDs.');patch.business_unit=patch.business_unit||client.business_unit||'soma';}
  if(create){assert(['income','expense'].includes(patch.type),'Indica ingreso o gasto.');assert(typeof patch.title==='string'&&patch.title.trim(),'Concepto obligatorio.');}
  if(create||patch.amount!==undefined)assert(Number.isSafeInteger(patch.amount)&&patch.amount>0&&patch.amount<=1e12,'Importe positivo en centavos enteros requerido.');
  const next=create?Store.record(Records.normalize('transactions',{...patch,date:patch.date||Domain.today(),source:'ivy-local-confirmed'})):Records.normalize('transactions',patch,old);
  if(remove)next.deleted_at=new Date().toISOString();next.updated_at=new Date().toISOString();
  const draft=structuredClone(Store.get()),i=draft.transactions.findIndex(r=>r.id===next.id);if(i<0)draft.transactions.push(next);else draft.transactions[i]=next;Store.validate(draft);
  return propose({name,collection:'transactions',next,preview:{provider:'Finanzas · libro local EVIE',before:old?transaction(old):null,after:transaction(next)}});
 }
 function prepare({name,args}){
  assert(['finance.get_summary','finance.search_transactions','finance.create_transaction','finance.update_transaction','finance.delete_transaction','crm.search_entities','crm.verify_record','crm.get_today_agenda','crm.search_events','crm.get_dashboard_summary','crm.navigate','crm.create_event','crm.update_event','crm.delete_event','crm.create_task','crm.update_task'].includes(name),'Herramienta local no permitida.');assert(args&&typeof args==='object'&&!Array.isArray(args),'Argumentos inválidos.');V2Domain.safeTree(args);
  const data=read(name,args);if(data)return {result:{ok:true,data}};
  if(name.startsWith('finance.'))return finance(name,args);
  if(name==='crm.navigate'){assert(DALI_CONFIG.sections.some(s=>s.route===args.route),'Ruta no permitida.');return propose({name,route:args.route,preview:{provider:'LocalAgendaProvider',route:args.route}});}
  const allowedFields=['id','title','date','time','minutes','notes',...(name==='crm.update_task'?['done']:[])];for(const k of Object.keys(args))assert(allowedFields.includes(k),'Campo no permitido.');
  const create=name==='crm.create_event'||name==='crm.create_task',remove=name==='crm.delete_event',original=create?null:Store.list('agendaItems').find(r=>r.id===args.id);assert(create||original,'Selecciona un registro existente por ID.');
  if(original)assert(!original.recurrence,'Edita las repeticiones desde el formulario de Agenda; Ivy no reprograma una serie entera.');
  const now=new Date().toISOString(),next=create?Store.record({...RCData.defaults('agendaItems'),kind:name.endsWith('event')?'event':'task',source:'ivy-local-confirmed'}):structuredClone(original);
  if(remove)next.deleted_at=now;
  else{
   if(args.title!==undefined){assert(typeof args.title==='string'&&args.title.trim()&&args.title.length<=500,'Título inválido.');next.title=args.title.trim();}
   if(args.notes!==undefined){assert(typeof args.notes==='string'&&args.notes.length<=2000,'Notas inválidas.');next.notes=args.notes;}
   assert(!args.time||args.date||original?.start_at||original?.due_at,'Indica una fecha para la hora.');
   if(args.date||args.time){const day=args.date||Agenda.localValue(original.start_at||original.due_at).slice(0,10);assert(V2Domain.date(day),'Fecha inválida.');const oldTime=original&&!original.all_day?Agenda.localValue(original.start_at||original.due_at).slice(11):'',time=args.time||oldTime;const at=Agenda.toTimestamp(day+'T'+(time||'23:59'));next.start_at=at;next.due_at=at;next.all_day=!time;next.status='scheduled';}
   if(args.minutes!==undefined){assert(Number.isInteger(args.minutes)&&args.minutes>=1&&args.minutes<=10080,'Duración inválida.');next.duration_minutes=args.minutes;}
   if(next.start_at&&next.duration_minutes)next.due_at=new Date(Date.parse(next.start_at)+next.duration_minutes*60000).toISOString();
   if(args.done!==undefined){assert(typeof args.done==='boolean','Estado inválido.');next.status=args.done?'done':next.start_at?'scheduled':'inbox';next.completed_at=args.done?now:null;}
   if(create&&next.kind==='event')assert(next.start_at,'Un evento necesita fecha.');
  }
  next.updated_at=now;next.history=[...next.history,{at:now,action:name,before:original?present(original):null}];
  const draft=structuredClone(Store.get());const index=draft.agendaItems.findIndex(r=>r.id===next.id);if(index<0)draft.agendaItems.push(next);else draft.agendaItems[index]=next;Store.validate(draft);
  return propose({name,next,preview:{provider:'Agenda local EVIE',before:original?present(original):null,after:remove?{id:next.id,archived:true,recoverable:true}:present(next)}});
 }
 function commit({token}){const p=proposals.get(token);proposals.delete(token);assert(p&&p.expires>=Date.now(),'Propuesta caducada.');assert(p.scope===DALI_CONFIG.storageKey&&p.raw===localStorage.getItem(DALI_CONFIG.storageKey)&&p.revision===Store.get().revision,'Los datos cambiaron. Revisa una propuesta nueva.');if(p.route){assert(!FormSafety.dirty(),'Guarda o cancela el formulario antes de navegar.');location.hash=p.route;return {ok:true,data:{route:p.route}};}
  const collection=p.collection||'agendaItems',backupKey=DALI_CONFIG.storageKey+'-pre-2.1.0';if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,p.raw);
  Store.save(s=>{const n=s[collection].findIndex(r=>r.id===p.next.id);if(n<0)s[collection].push(structuredClone(p.next));else s[collection][n]=structuredClone(p.next);});const saved=Store.get()[collection].find(r=>r.id===p.next.id);assert(JSON.stringify(saved)===JSON.stringify(p.next),'No se pudo verificar el registro.');
  if(!FormSafety.dirty())App.render();return {ok:true,data:{verified:true,provider:collection==='transactions'?'Libro de Finanzas EVIE':'LocalAgendaProvider',record:collection==='transactions'?transaction(saved):present(saved),collection,archived:!!saved.deleted_at}};
 }
 function diagnostics(){const s=Store.get();Store.validate(s);return {readable:true,validation:true,currentScreen:UI.section,storageKey:DALI_CONFIG.storageKey,version:s.version,writable:'Se verifica al confirmar una escritura; diagnóstico no altera datos.'};}
 function handle(action,payload){if(action==='prepare')return prepare(payload);if(action==='commit')return commit(payload);if(action==='cancel'){proposals.delete(payload.token);return {ok:true};}if(action==='diagnostics')return diagnostics();throw Error('Operación local no autorizada.');}
 return {prepare,commit,handle,read,diagnostics,cancel:token=>proposals.delete(token),clear:()=>proposals.clear()};
})();
if(window.evieDesktop)window.evieDesktop.onCRM((action,payload)=>LocalAgendaProvider.handle(action,payload));
