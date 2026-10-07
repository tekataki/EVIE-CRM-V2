'use strict';
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const agenda=new Set(['crm.get_today_agenda','crm.search_events','crm.create_event','crm.update_event','crm.delete_event','crm.create_task','crm.update_task']);
const modules={finanzas:'finance',agenda:'agenda',calendario:'agenda',inicio:'general',gimnasio:'gimnasio',objetivos:'objetivos',soma:'soma',aprendizaje:'aprendizaje',bitacora:'bitacora',granja:'granja',libros:'libros',alvento:'alvento',contenido:'contenido',vision:'vision',subir:'subir',perfil:'perfil',configuracion:'configuracion'};
function classify(text){const s=norm(text);
 const explicit=[...s.matchAll(/\ben\s+(?:(?:el|la)\s+)?(?:(?:apartado|modulo|seccion)\s+(?:de\s+)?)?(finanzas|agenda|calendario|inicio|gimnasio|objetivos|soma|aprendizaje|bitacora|granja|libros|alvento|contenido|vision|subir|perfil|configuracion)\b/g)].map(m=>modules[m[1]]);
 if(new Set(explicit).size>1)return 'ambiguous';if(explicit.length)return explicit[0];
 // Scheduling a collection/payment is not a ledger entry.
 if(/\b(?:agenda(?:me)?|agendar|calendario|recuerdame|recordatorio|programa(?:me)?|cita)\b/.test(s))return 'agenda';
 if(/\b(finanzas|ingresos?|gastos?|ventas?|compras?|cobros?|pagos?|pesos|mxn|saldo)\b|\$\s*\d/.test(s))return 'finance';
 if(/\b(spotify|roblox|opera|whatsapp|discord|steam|epic|obs|capcut|canva|code|notepad|bloc|aplicacion|volumen|musica|explorador|archivo|navegador|calculadora)\b/.test(s))return 'windows';
 if(/\b(manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|\b\d{1,2}:\d{2}\b/.test(s))return 'agenda';
 if(/\b(agrega|crea|registra|cambia|elimina|borra|actualiza|anade)\b/.test(s))return 'ambiguous';return 'general';
}
function allowed(domain,name){if(['crm.navigate','crm.search_entities','crm.get_dashboard_summary'].includes(name))return true;if(name==='crm.verify_record')return ['finance','agenda'].includes(domain);if(name.startsWith('finance.'))return domain==='finance';if(agenda.has(name))return domain==='agenda';if(name.startsWith('windows.'))return domain==='windows';return false;}
function assertScope(domain,name,args){if(!allowed(domain,name)||name==='crm.verify_record'&&args.collection!==(domain==='finance'?'transactions':'agendaItems'))throw Error('Herramienta fuera del dominio solicitado. No se sustituye Finanzas por Agenda.');}
function cents(value){const s=norm(value);let result;
 if(/^\d+(?:[.,]\d{1,2})?$/.test(s)){const [whole,fraction='']=s.replace(',','.').split('.');result=Number(whole)*100+Number(fraction.padEnd(2,'0'));}
 else{const n={un:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,veinte:20,cien:100,quinientos:500};result=s==='mil'?100000:n[s]?n[s]*100:/^(?:un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) mil$/.test(s)?n[s.split(' ')[0]]*100000:null;}
 return Number.isSafeInteger(result)&&result>0&&result<=1e12?result:null;
}
function directFinance(text){
 // Deliberately narrow: never discard additional dates, commands, tax or currency qualifiers.
 const match=String(text).trim().match(/^(?:agrega|registra|añade)\s+en\s+finanzas\s+(\d+(?:[.,]\d{1,2})?|mil|(?:un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) mil)\s+pesos\s+de\s+una\s+venta\s+de\s+([\p{L}\p{N} .&'-]{1,160}?)\s*[.!]?$/iu);
 if(!match||classify(text)!=='finance'||/\b(y|manana|ayer|hoy|con|sin|iva|pero|luego)\b/.test(norm(match[2])))return null;
 const amount=cents(match[1]);if(!amount)return null;
 return {name:'finance.create_transaction',args:{type:'income',amount,title:'Venta de '+match[2].trim(),category:'Ventas',entity_name:match[2].trim()}};
}
function directAgenda(text,today){
 const match=String(text).trim().match(/^agenda\s+mañana\s+cobrarle\s+a\s+([\p{L}\p{N} .&'-]{1,160}?)\s+(mil|\d+(?:[.,]\d{1,2})?)\s+pesos\s*[.!]?$/iu);
 if(!match||classify(text)!=='agenda'||!/^\d{4}-\d{2}-\d{2}$/.test(today))return null;
 const next=new Date(today+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 return {name:'crm.create_task',args:{title:'Cobrarle a '+match[1].trim()+' '+match[2]+' pesos',date:next.toISOString().slice(0,10)}};
}
module.exports={classify,allowed,assertScope,directFinance,directAgenda,cents};
