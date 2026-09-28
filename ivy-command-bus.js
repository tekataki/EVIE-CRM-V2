'use strict';
/* Only a privately held, reviewed proposal can be committed. No automatic voice writes. */
window.IvyCommandBus=(()=>{
 const pending=new Map(),A=V2Domain.assert,norm=IvyTools.norm;
 const examples=['Abre Agenda','¿Qué tengo pendiente hoy?','¿Qué sigue?','¿Qué pagos tengo pendientes?','¿Cuánto he cobrado en SOMA este mes?','¿Qué clientes necesitan seguimiento?','¿Cómo va mi meta mensual de SOMA?','¿Qué alertas hay en la granja?','¿Cuál fue mi último entrenamiento?','Dame estadísticas','Crea pendiente: Revisar propuesta mañana','Registra gasto 150.50: Papelería hoy','Crea objetivo: Leer 20 páginas hoy','Completa pendiente: Revisar propuesta','Agrega nota: Una idea para mañana','Seguimiento a "Cliente": Llamar mañana','Registra pago 250 a cliente "Cliente" hoy'];
 function envelope(intent,parameters={},source='text',risk='read'){A(['text','voice','clap','ui'].includes(source),'Origen no válido.');return Object.freeze({id:crypto.randomUUID(),source,intent,parameters:Object.freeze(parameters),confidence:intent==='unknown'?0:1,risk,requiresConfirmation:risk==='write',createdAt:new Date().toISOString()});}
 function parse(input,source='text'){
  A(typeof input==='string'&&input.trim()&&input.length<=4000,'Escribe un comando de hasta 4000 caracteres.');const text=input.trim(),q=norm(text).replace(/[¿?¡!]/g,'');
  if(/spotify|playlist|captura.*pantalla|windows|powershell|abre (chrome|word|excel)/.test(q))return envelope('external',{},source,'external');
  const nav=q.match(/^(?:abre|abrir|ir a|ve a|muestra|muestrame)\s+(?:la |el |mi )?(.+)$/);if(nav){const key=nav[1],route=DALI_CONFIG.sections.find(r=>[r.route,norm(r.label),...r.searchTerms.map(norm),...(r.route==='bitacora'?['bitacora']:[]),...(r.route==='perfil'?['perfil']:[])].includes(key));if(route)return envelope('navigate',{route:route.route},source);}
  const reads=[[/pendiente.*hoy|agenda.*hoy/,'today'],[/que sigue|siguiente (accion|paso)/,'next'],[/pagos?.*pendientes?/,'payments'],[/cobrad.*soma/,'collected'],[/clientes.*seguimiento/,'followups'],[/meta.*soma/,'target'],[/alertas?.*granja/,'farm'],[/ultimo.*entrenamiento/,'workout'],[/estadisticas|resumen general/,'stats']];
  for(const [rx,kind] of reads)if(!/^(crea|crear|agrega|anade|captura|registra|registrar|propon|escribe|completa|termina|marca|seguimiento)\b/.test(q)&&rx.test(q))return envelope('summary',{kind},source);
  const parameters={};let body=text,intent,match;
  // Explicit suffix date/time; unknown dates are never silently invented.
  const dateMatch=body.match(/\s+(hoy|mañana|\d{4}-\d{2}-\d{2})(?:\s+(?:a las?\s+)?([0-2]\d:[0-5]\d))?\s*$/i);
  if(dateMatch){parameters.date=norm(dateMatch[1])==='hoy'?Domain.today():norm(dateMatch[1])==='manana'?V2Domain.addDays(Domain.today(),1):dateMatch[1];if(dateMatch[2])parameters.time=dateMatch[2];body=body.slice(0,dateMatch.index).trim();}
  if(match=body.match(/^(?:crea|crear|agrega|añade|captura)\s+(?:un |una )?(?:pendiente|tarea|evento)(?:\s+en agenda)?\s*:?\s*(.*)$/i)){intent='agenda.create';parameters.title=match[1];}
  else if(match=body.match(/^(?:registra|registrar|agrega|prop[oó]n)\s+(?:un )?(gasto|ingreso)\s*\$?\s*([\d.,]+)(?:\s*MXN)?\s*(?::|por|de)?\s*(.*)$/i)){intent='finance.create';parameters.type=norm(match[1])==='gasto'?'expense':'income';parameters.amount=Domain.cents(match[2]);parameters.title=match[3];}
  else if(match=body.match(/^(?:crea|crear|agrega|añade)\s+(?:un )?objetivo\s*:?\s*(.*)$/i)){intent='goal.create';parameters.title=match[1];}
  else if(match=body.match(/^(?:agrega|añade|crea|escribe)\s+(?:una )?(?:nota|bit[aá]cora|entrada de bit[aá]cora)\s*:?\s*(.*)$/i)){intent='journal.create';parameters.title=match[1].slice(0,120);parameters.text=match[1];}
  else if(match=body.match(/^(?:completa|termina|marca como completad[oa])\s+(?:el |la )?(?:pendiente|tarea)\s*:?\s*(.*)$/i)){intent='agenda.complete';parameters.title=match[1];}
  else if(match=body.match(/^(?:agrega )?seguimiento a\s+"([^"]+)"\s*:\s*(.*)$/i)){intent='soma.followup';parameters.title=match[1];parameters.note=match[2];}
  else if(match=body.match(/^(?:registra|prop[oó]n)\s+(?:un )?(?:pago|abono)\s*\$?([\d.,]+)\s+a\s+(cliente|factura|pr[eé]stamo)\s+"([^"]+)"$/i)){intent='payment.create';parameters.amount=Domain.cents(match[1]);parameters.collection={cliente:'clients',factura:'bills',prestamo:'loans'}[norm(match[2])];parameters.title=match[3];}
  if(intent)return envelope(intent,parameters,source,'write');
  return envelope('unknown',{},source);
 }
 function prepare(command){
  A(command&&['text','voice','ui'].includes(command.source)&&IvyTools.intents.includes(command.intent)&&command.risk==='write'&&command.requiresConfirmation===true,'La herramienta requiere una propuesta de escritura válida.');
  // Proposals hold a clone, not caller-controlled parameters, and are bounded/expiring.
  pending.clear();const copy=structuredClone(command),snapshot=structuredClone(Store.get()),built=IvyTools.build(copy.intent,copy.parameters,snapshot),token=crypto.randomUUID();
  pending.set(token,{command:copy,snapshot,built,scope:DALI_CONFIG.storageKey,expires:Date.now()+300000});return Object.freeze({token,fields:built.fields,route:built.route,revision:snapshot.revision,notice:'Todavía no se ha guardado. Revisa y confirma la mutación exacta.'});
 }
 function confirm(token){const proposal=pending.get(token);A(proposal,'La propuesta ya fue cancelada o confirmada.');A(Date.now()<proposal.expires,'La propuesta venció. Vuelve a revisarla.');A(DALI_CONFIG.storageKey===proposal.scope&&Store.get()?.revision===proposal.snapshot.revision,'Los datos cambiaron. Genera una nueva propuesta.');
  // Validate current parameters and full state again, then commit the originally reviewed IDs.
  IvyTools.build(proposal.command.intent,proposal.command.parameters,Store.get());Store.save(proposal.built.mutate);pending.delete(token);const committed=Store.get().revision;
  return {route:proposal.built.route,undo:()=>{A(DALI_CONFIG.storageKey===proposal.scope&&Store.get()?.revision===committed,'Hay cambios posteriores. No es seguro deshacer.');Store.save(s=>{for(const key of Object.keys(s))delete s[key];Object.assign(s,structuredClone(proposal.snapshot));});}};
 }
 const cancel=token=>token?pending.delete(token):pending.clear();
 return Object.freeze({parse,prepare,confirm,cancel,examples,envelope,pendingCount:()=>pending.size});
})();
