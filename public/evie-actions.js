'use strict';
/* EVIE typed actions for Ivi (v4). A fixed allow-list of operations over existing collections — no arbitrary
   code, SQL, shell, URLs or secrets. Every write:
   - validates its arguments (types, lengths, dates, enums) before touching data,
   - resolves records by id or by an unambiguous title match (else returns a question),
   - is idempotent per op_id (model call_id) for retries,
   - is recorded in preferences.evieAudit (last 200, record title only — no note text) with an undo.
   Deletes are soft (deleted_at) and undoable. Destructive or bulk operations are not offered.
   Account isolation: Store is already scoped to the signed-in account (Alejandro/Dali vs Naomi); the server
   only proxies the model and never receives these records. */
window.EvieActions=(()=>{
 const AUDIT_MAX=200,OP_TTL=10*60e3;
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const T=(v,n,f)=>{if(v==null||v==='')return null;if(typeof v!=='string')throw Error(`${f}: texto no válido.`);const s=v.replace(/[\u0000-\u001f]/g,' ').trim();if(s.length>n)throw Error(`${f}: máximo ${n} caracteres.`);return s||null;};
 const D=(v,f)=>{if(v==null||v==='')return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T12:00:00Z')))throw Error(`${f}: usa AAAA-MM-DD.`);return v;};
 const H=(v,f)=>{if(v==null||v==='')return null;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error(`${f}: usa HH:MM.`);return v;};
 const E=(v,list,f,def=null)=>{if(v==null||v==='')return def;if(!list.includes(v))throw Error(`${f}: valor no permitido.`);return v;};
 const now=()=>new Date().toISOString();
 const live=c=>(Store.list(c)||[]).filter(r=>!r.deleted_at);
 const seen=new Map();
 function opSeen(op){if(!op)return null;const x=seen.get(op);if(x&&Date.now()-x.at<OP_TTL)return x.result;return null;}
 function opKeep(op,result){if(op)seen.set(op,{at:Date.now(),result});if(seen.size>200)seen.delete(seen.keys().next().value);}
 /* Resolve «el pendiente de llamar al banco» → one record, or a question. */
 function resolve(collection,ref,{filter=()=>true}={}){const rows=live(collection).filter(filter);if(ref&&typeof ref==='object'&&ref.id)ref=ref.id;
  const byId=rows.find(r=>r.id===ref);if(byId)return {record:byId};const q=norm(ref);if(!q)return {question:'¿Cuál? Dime el nombre.'};
  const exact=rows.filter(r=>norm(r.title)===q);if(exact.length===1)return {record:exact[0]};
  const words=q.split(' ').filter(w=>w.length>2);const part=rows.filter(r=>{const t=norm(r.title);return t.includes(q)||(words.length&&words.every(w=>t.includes(w)));});
  if(!exact.length&&part.length===1)return {record:part[0]};if(!part.length&&!exact.length)return {question:`No encontré «${ref}». ¿Cómo se llama exactamente?`,not_found:true};
  const opts=(exact.length?exact:part).slice(0,5);return {question:`Encontré varios: ${opts.map(r=>'«'+r.title+'»').join(', ')}. ¿Cuál?`,candidates:opts.map(r=>({id:r.id,title:r.title}))};}
 function audit(entry){try{Store.save(s=>{const a=Array.isArray(s.preferences.evieAudit)?s.preferences.evieAudit:[];a.push({id:Store.uuid(),at:now(),...entry});s.preferences.evieAudit=a.slice(-AUDIT_MAX);});}catch{}}
 /* Snapshot-based undo for one record: restores the exact previous object, or soft-deletes a created one. */
 function undoFor(collection,id,before){return ()=>{Store.save(s=>{const list=s[collection],i=list.findIndex(r=>r.id===id);if(before==null){if(i>=0)list[i]={...list[i],deleted_at:now(),updated_at:now()};}else if(i>=0)list[i]=structuredClone(before);else list.push(structuredClone(before));});audit({action:'undo',collection,record_id:id});try{window.App?.render?.();}catch{}};}
 function write(collection,id,mutate,{action,title,op}){const prev=id?structuredClone(Store.get()[collection].find(r=>r.id===id)||null):null;let out;
  Store.save(s=>{out=mutate(s);});const rid=id||out?.id;audit({action,collection,record_id:rid,title:String(title||'').slice(0,80),op_id:op||null,source:'ivi'});
  return {id:rid,undo:undoFor(collection,rid,prev)};}
 /* ---------------- Agenda / Pendientes ---------------- */
 const PRIOS=['low','medium','high'],AREAS=['personal','trabajo','soma','escuela','salud','hogar','alvento','granja'];
 function agendaCreate(a={},op){const title=T(a.title,140,'Título');if(!title)return {status:'needs',question:'¿Qué pendiente agrego?'};const date=D(a.date,'Fecha'),time=H(a.time,'Hora');if(time&&!date)return {status:'needs',question:'¿Para qué día es esa hora?'};
  const prio=E(a.priority,PRIOS,'Prioridad','medium'),area=E(a.area,AREAS,'Área','personal'),notes=T(a.notes,2000,'Notas')||'';
  const dup=live('agendaItems').find(r=>norm(r.title)===norm(title)&&!['done','archived'].includes(r.status)&&(!date||String(r.due_at||'').slice(0,10)===date));if(dup)return {status:'duplicate',id:dup.id,say:`Ya tenías «${dup.title}» en tu agenda.`};
  const r=Store.record({...RCData.defaults('agendaItems'),title,priority:prio,area,notes,source:'ivi'});
  if(date){r.due_at=Agenda.toTimestamp(date+'T'+(time||'23:59'));r.all_day=!time;r.status='scheduled';}
  const w=write('agendaItems',null,s=>{s.agendaItems.push(r);return r;},{action:'agenda.create',title,op});
  return {status:'created',id:w.id,undo:w.undo,say:`Agregué «${title}»${date?' para el '+date+(time?' a las '+time:''):' sin fecha'}.`};}
 function agendaUpdate(a={},op){const f=resolve('agendaItems',a.item);if(!f.record)return {status:'needs',...f};const r=f.record;
  const title=T(a.title,140,'Título'),date=D(a.date,'Fecha'),time=H(a.time,'Hora'),prio=E(a.priority,PRIOS,'Prioridad'),notes=T(a.notes,2000,'Notas');
  if(!title&&!date&&!time&&!prio&&notes==null&&!a.clear_date)return {status:'needs',question:'¿Qué le cambio: fecha, hora, título o prioridad?'};
  const w=write('agendaItems',r.id,s=>{const x=s.agendaItems.find(y=>y.id===r.id);if(title)x.title=title;if(prio)x.priority=prio;if(notes!=null)x.notes=notes;
   if(a.clear_date){x.due_at=null;x.all_day=true;if(x.status==='scheduled')x.status='inbox';}
   else if(date||time){const d=date||String(x.due_at||'').slice(0,10)||null;if(!d)throw Error('¿Para qué día?');x.due_at=Agenda.toTimestamp(d+'T'+(time||'23:59'));x.all_day=!time;if(x.status==='inbox')x.status='scheduled';}
   x.updated_at=now();return x;},{action:'agenda.update',title:r.title,op});
  return {status:'updated',id:r.id,undo:w.undo,say:`Actualicé «${title||r.title}».`};}
 function agendaComplete(a={},op){const f=resolve('agendaItems',a.item,{filter:r=>r.status!=='archived'});if(!f.record)return {status:'needs',...f};const r=f.record,day=D(a.date,'Fecha')||Domain.today();
  if(Agenda.isDone(r,day))return {status:'duplicate',say:`«${r.title}» ya estaba completado.`};
  const w=write('agendaItems',r.id,s=>{Agenda.complete(s,r.id,day);return r;},{action:'agenda.complete',title:r.title,op});
  return {status:'updated',id:r.id,undo:w.undo,say:`¡Listo! Marqué «${r.title}» como hecho.`};}
 function agendaDelete(a={},op){const f=resolve('agendaItems',a.item);if(!f.record)return {status:'needs',...f};const r=f.record;
  const w=write('agendaItems',r.id,s=>{const x=s.agendaItems.find(y=>y.id===r.id);x.deleted_at=now();x.updated_at=now();return x;},{action:'agenda.delete',title:r.title,op});
  return {status:'deleted',id:r.id,undo:w.undo,say:`Quité «${r.title}». Puedes deshacerlo.`};}
 /* ---------------- SOMA ---------------- */
 function somaNote(a={},op){const f=resolve('clients',a.client);if(!f.record)return {status:'needs',...f};const r=f.record,text=T(a.note,1000,'Nota');if(!text)return {status:'needs',question:`¿Qué anoto sobre ${r.title}?`};
  const next=D(a.next_date,'Fecha de seguimiento');
  const w=write('clients',r.id,s=>{const x=s.clients.find(y=>y.id===r.id);x.notes=Array.isArray(x.notes)?x.notes:[];x.notes.push({id:Store.uuid(),date:Domain.today(),text,source:'ivi'});if(next){x.nextAction=text;x.nextDate=next;}x.updated_at=now();return x;},{action:'soma.note',title:r.title,op});
  return {status:'updated',id:r.id,undo:w.undo,say:`Anoté en ${r.title}: «${text}»${next?' con seguimiento el '+next:''}.`};}
 const STAGES=['Prospecto','Contactado','Propuesta','Activo','Pausado','Cerrado'];
 function somaStage(a={},op){const f=resolve('clients',a.client);if(!f.record)return {status:'needs',...f};const r=f.record,stage=E(a.stage,STAGES,'Etapa');if(!stage)return {status:'needs',question:'¿A qué etapa lo muevo? '+STAGES.join(', ')+'.'};
  if(r.stage===stage)return {status:'duplicate',say:`${r.title} ya estaba en ${stage}.`};
  const w=write('clients',r.id,s=>{const x=s.clients.find(y=>y.id===r.id);x.stage=stage;x.updated_at=now();return x;},{action:'soma.stage',title:r.title,op});
  return {status:'updated',id:r.id,undo:w.undo,say:`Moví a ${r.title} a «${stage}».`};}
 /* ---------------- Aprendizaje ---------------- */
 function learningTask(a={},op){const f=resolve('skills',a.skill);if(!f.record)return {status:'needs',...f};const r=f.record,title=T(a.task,140,'Actividad');if(!title)return {status:'needs',question:`¿Qué actividad agrego a ${r.title}?`};
  if((r.tasks||[]).some(t=>norm(t.title)===norm(title)))return {status:'duplicate',say:`«${title}» ya estaba en ${r.title}.`};
  const level=Number.isInteger(a.level)&&a.level>=1&&a.level<=6?a.level:1;
  const w=write('skills',r.id,s=>{const x=s.skills.find(y=>y.id===r.id);x.tasks=Array.isArray(x.tasks)?x.tasks:[];x.tasks.push({id:Store.uuid(),title,points:10,level,done:false,evidence:'',final:false,source:''});x.updated_at=now();return x;},{action:'learning.task',title:r.title,op});
  return {status:'updated',id:r.id,undo:w.undo,say:`Agregué «${title}» a ${r.title}.`};}
 function learningDone(a={},op){const f=resolve('skills',a.skill);if(!f.record)return {status:'needs',...f};const r=f.record,q=norm(a.task);if(!q)return {status:'needs',question:'¿Qué actividad terminaste?'};
  const hits=(r.tasks||[]).filter(t=>!t.done&&(norm(t.title)===q||norm(t.title).includes(q)));if(hits.length!==1)return {status:'needs',question:hits.length?'Hay varias actividades parecidas. ¿Cuál?':`No encontré esa actividad en ${r.title}.`};
  const t=hits[0],ev=T(a.evidence,400,'Evidencia');const w=write('skills',r.id,s=>{const x=s.skills.find(y=>y.id===r.id);const y=x.tasks.find(k=>k.id===t.id);y.done=true;y.done_at=now();if(ev)y.evidence=ev;x.updated_at=now();return x;},{action:'learning.done',title:r.title,op});
  return {status:'updated',id:r.id,undo:w.undo,say:`¡Bien! Marqué «${t.title}» como completada.`};}
 /* ---------------- dispatcher ---------------- */
 const OPS={'agenda.create':agendaCreate,'agenda.update':agendaUpdate,'agenda.complete':agendaComplete,'agenda.delete':agendaDelete,'soma.note':somaNote,'soma.stage':somaStage,'learning.task':learningTask,'learning.done':learningDone};
 /** run(op,args,{op_id}) → {status:'created'|'updated'|'deleted'|'duplicate'|'needs'|'error', say|question, undo?} */
 function run(op,args={},{op_id=null,toast=true}={}){if(!Object.hasOwn(OPS,op))return {status:'error',error:'Acción no permitida.'};
  if(!args||typeof args!=='object'||Array.isArray(args))return {status:'error',error:'Argumentos no válidos.'};
  const prev=opSeen(op_id);if(prev)return {...prev,status:'duplicate',say:prev.say||'Ya lo había hecho.'};
  let r;try{r=OPS[op](args,op_id);}catch(err){return {status:'error',error:err.message};}
  if(['created','updated','deleted'].includes(r.status)){opKeep(op_id,{say:r.say,id:r.id});if(toast){try{App.render();App.toast(r.say,'success',r.undo);window.EvieSounds?.play?.('success');window.EvieFinance?.setLastUndo?.(r.undo);}catch{}}}
  return r;}
 return Object.freeze({run,resolve,OPS:Object.keys(OPS),STAGES,PRIOS,AREAS,audit:()=>(Store.get()?.preferences?.evieAudit||[]).slice()});
})();
