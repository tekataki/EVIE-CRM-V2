'use strict';
/* Narrow desktop actions for EVIE para Windows. The web build reports them as unavailable and never
   pretends they ran. Messages: resolve an explicitly configured contact (per account), read back the
   exact text, require a confirmation, then OPEN WhatsApp with the text prefilled. EVIE cannot press
   "send" for the user and never reports a message as delivered. */
window.EvieDesktopActions=(()=>{
 const desk=()=>!!window.evieDesktop&&window.evieDesktop.platform==='win32'&&typeof window.evieDesktop.desktop==='function';
 let pending=null;
 const contacts=()=>(Store.get()?.preferences?.evieContacts||[]).filter(c=>c&&typeof c.name==='string'&&/^\+?[0-9]{8,15}$/.test(c.phone||''));
 function resolveContact(n){const q=IvyTools.norm(String(n||''));if(!q)return {status:'needs_info',ask:'¿A quién se lo mando?'};const hit=contacts().filter(c=>{const k=IvyTools.norm(c.name);return k===q||k.split(' ')[0]===q;});if(hit.length===1)return {status:'ok',contact:hit[0]};if(hit.length>1)return {status:'ambiguous',options:hit.map(c=>c.name)};return {status:'unknown',note:`No tengo a «${n}» entre tus contactos de EVIE. Agrégalo en Configuración → Contactos de EVIE (nombre y número con lada).`};}
 async function run(action,{contact,message}={}){
  if(!desk())return {ok:false,status:'unavailable',note:'Esa acción solo existe en EVIE para Windows. En el navegador no puedo abrir ni controlar apps de tu computadora.'};
  if(action==='compose_message'){const r=resolveContact(contact);if(r.status!=='ok')return {ok:false,...r};const text=String(message||'').trim();if(!text)return {ok:false,status:'needs_info',ask:`¿Qué quieres que le diga a ${r.contact.name}?`};if(text.length>1000)return {ok:false,status:'invalid',error:'El mensaje es demasiado largo (máximo 1000 caracteres).'};
   const prep=await window.evieDesktop.desktop({action:'prepare_message',phone:r.contact.phone,message:text});if(!prep?.ok)return {ok:false,error:prep?.error||'No se pudo preparar.'};
   pending={token:prep.data.token,contact:r.contact.name,phone:r.contact.phone,message:text};window.EvieHUD?.open('message',{...pending,title:'Mensaje para '+r.contact.name});
   return {ok:true,status:'awaiting_confirmation',sent:false,read_back:`Para ${r.contact.name}: «${text}». ¿Lo abro en WhatsApp para que lo envíes?`};}
  const allowed=['open_spotify','open_whatsapp','media_next','media_previous','media_play_pause'];
  if(!allowed.includes(action))return {ok:false,error:'Acción no permitida.'};
  const r=await window.evieDesktop.desktop({action});
  if(!r?.ok)return {ok:false,error:r?.error||'Windows no completó la acción.'};
  return {ok:true,...r.data};
 }
 async function sendPrepared(d=pending){if(!d||!desk())return {ok:false,error:'No hay mensaje pendiente.'};const r=await window.evieDesktop.desktop({action:'open_prepared_message',token:d.token});pending=null;window.EvieHUD?.close('message',{silent:true});
  if(!r?.ok){App.toast(r?.error||'No se pudo abrir WhatsApp.','error');return {ok:false,error:r?.error};}
  window.EvieSounds?.play('success');window.EvieAssistant?.say?.('Abrí WhatsApp con el mensaje para '+d.contact+'. Revísalo y toca enviar ahí; yo no puedo confirmar la entrega.');return {ok:true,opened:true,sent:false};}
 function cancel(){if(!pending)return false;try{window.evieDesktop?.desktop?.({action:'cancel_message',token:pending.token});}catch{}pending=null;window.EvieHUD?.close('message',{silent:true});return true;}
 return Object.freeze({run,sendPrepared,cancel,resolveContact,contacts,available:desk,get pending(){return pending;}});
})();
