'use strict';
const text=(max=500)=>({type:'string',minLength:1,maxLength:max});
const enumeration=values=>({type:'string',enum:values});
const object=(properties={},required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const routes=['inicio','agenda','finanzas','gimnasio','objetivos','soma','aprendizaje','bitacora','granja','libros','alvento','contenido','vision','subir','perfil','configuracion'];
const id={...text(80),pattern:'^[a-zA-Z0-9-]+$'};
const date={...text(10),pattern:'^\\d{4}-\\d{2}-\\d{2}$'};
const time={...text(5),pattern:'^([01][0-9]|2[0-3]):[0-5][0-9]$'};
const record={title:text(500),date,time,minutes:{type:'integer',minimum:1,maximum:10080},notes:{type:'string',maxLength:2000}};
const transaction={title:text(500),type:enumeration(['income','expense']),amount:{type:'integer',minimum:1,maximum:1e12},date,category:text(80),business_unit:enumeration(['personal','soma','granja','alvento']),client_id:id,entity_name:text(160),note:{type:'string',maxLength:2000}};
const specs={
 'finance.get_summary':['Resumen financiero del libro existente; importes en centavos MXN','read',object({from:date,to:date,business_unit:transaction.business_unit},[])],
 'finance.search_transactions':['Buscar movimientos existentes, devuelve IDs reales y centavos','read',object({query:text(200),date,type:transaction.type},[])],
 'finance.create_transaction':['Crear ingreso/gasto en Finanzas, NUNCA en Agenda; amount es centavos enteros','write',object(transaction,['title','type','amount'])],
 'finance.update_transaction':['Modificar movimiento financiero por ID; conserva referencias y centavos','write',object({id,...transaction},['id'])],
 'finance.delete_transaction':['Archivar movimiento financiero recuperable por ID; no pagos vinculados','strong',object({id})],
 'crm.search_entities':['Buscar clientes y entidades reales; preguntar si hay múltiples coincidencias','read',object({query:text(160),collection:enumeration(['clients','books','alventoProducts','farmAnimals','contentItems','goals'])},['query'])],
 'crm.verify_record':['Leer por ID el registro guardado para verificar resultado','read',object({collection:enumeration(['transactions','agendaItems']),id})],
 'crm.get_today_agenda':['Leer Agenda local de hoy','read',object()],
 'crm.search_events':['Buscar eventos/tareas por título, fecha y hora de México; devuelve IDs reales','read',object({query:text(200),date,time},[])],
 'crm.get_dashboard_summary':['Resumen de registros locales','read',object()],
 'crm.create_event':['Crear evento en Agenda local','write',object(record,['title','date'])],
 'crm.update_event':['Modificar por ID un evento local; no adivinar el ID','write',object({id,...record},['id'])],
 'crm.delete_event':['Archivar evento local de forma recuperable','strong',object({id})],
 'crm.create_task':['Crear tarea en Agenda local','write',object(record,['title'])],
 'crm.update_task':['Modificar tarea en Agenda local','write',object({id,...record,done:{type:'boolean'}},['id'])],
 'crm.navigate':['Abrir un módulo EVIE','light',object({route:enumeration(routes)})],
 'windows.open_app':['Abrir aplicación por ID configurado; nunca una ruta','light',object({appId:id})],
 'windows.focus_app':['Enfocar una aplicación permitida en ejecución','light',object({appId:id})],
 'windows.reveal_file':['Mostrar en Explorer un archivo previamente elegido por el usuario','light',object({fileId:id})],
 'windows.rename_file':['Renombrar archivo autorizado sin cambiar extensión ni sobrescribir destinos','write',object({fileId:id,name:text(160)})],
 'windows.move_file':['Mover archivo autorizado a carpeta autorizada en el mismo volumen, sin sobrescribir','write',object({fileId:id,alias:id})],
 'windows.trash_file':['Mover exclusivamente a Papelera un archivo autorizado; nunca borrar permanentemente','strong',object({fileId:id})],
 'windows.search_apps':['Buscar aplicaciones autorizadas, sus IDs y capacidades reales','read',object({query:text(160)},[])],
 'windows.window_action':['Controlar ventana de aplicación autorizada; sin cierre','light',object({appId:id,action:enumeration(['minimize','maximize','restore'])})],
 'windows.close_app':['Pedir cierre normal, puede haber datos sin guardar; siempre confirmar','strong',object({appId:id})],
 'windows.search_web':['Buscar texto codificado en el navegador predeterminado','light',object({query:text(300)})],
 'windows.spotify_search':['Abrir búsqueda Spotify autorizada; no garantiza reproducción exacta','light',object({appId:id,query:text(300)})],
 'windows.whatsapp_draft':['Preparar borrador WhatsApp con destinatario completo; nunca enviar','write',object({appId:id,recipient:{...text(16),pattern:'^\\+?[0-9]{8,15}$'},message:text(2000)})],
 'windows.open_url':['Abrir HTTPS de un dominio previamente permitido','light',object({url:text(2048)})],
 'windows.open_location':['Abrir carpeta configurada por alias','write',object({alias:id})],
 'windows.set_volume':['Cambiar volumen maestro de Windows','light',object({level:{type:'integer',minimum:0,maximum:100}})],
 'windows.media_control':['Control multimedia del sistema','light',object({action:enumeration(['play','pause','next','previous','mute'])})],
 'windows.show_notification':['Notificación local visible','write',object({title:text(80),body:text(300)})]
};
function validate(schema,value,depth=0){
 if(depth>12)throw Error('Estructura demasiado profunda.');
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Se esperaba un objeto.');
  for(const k of Object.keys(value)){if(['__proto__','prototype','constructor'].includes(k)||!Object.hasOwn(schema.properties,k))throw Error('Campo no permitido: '+k);validate(schema.properties[k],value[k],depth+1);}
  for(const k of schema.required||[])if(!Object.hasOwn(value,k))throw Error('Falta: '+k);
 }else if(schema.type==='string'){
  if(typeof value!=='string'||value.length<(schema.minLength||0)||value.length>(schema.maxLength||10000)||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))throw Error('Texto inválido.');
  if(schema.pattern&&!new RegExp(schema.pattern).test(value))throw Error('Formato inválido.');
 }else if(schema.type==='boolean'){if(typeof value!=='boolean')throw Error('Booleano requerido.');}
 else if(schema.type==='integer'||schema.type==='number'){if(!Number.isFinite(value)||(schema.type==='integer'&&!Number.isInteger(value))||value<schema.minimum||value>schema.maximum)throw Error('Número fuera de rango.');}
 if(schema.enum&&!schema.enum.includes(value))throw Error('Valor no permitido.');
 return value;
}
function tool(name,args){if(!Object.hasOwn(specs,name))throw Error('Herramienta fuera de allowlist.');validate(specs[name][2],args);return specs[name];}
function safeURL(raw,domains){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||!domains.includes(u.hostname)||/[^\x21-\x7e]/.test(u.hostname))throw Error('URL/dominio no autorizado.');return u.href;}
function rateLimit(max=30,ms=60000){const timestamps=[];return ()=>{const now=Date.now();while(timestamps[0]<=now-ms)timestamps.shift();if(timestamps.length>=max)throw Error('Demasiadas solicitudes. Espera un momento.');timestamps.push(now);};}
module.exports={text,enumeration,object,validate,tool,specs,routes,safeURL,rateLimit};
