'use strict';
/* Narrow desktop actions for EVIE para Windows. The web build reports them as unavailable and never
   pretends they ran. Messages: resolve an explicitly configured contact (per account), read back the
   exact text, require a confirmation, then OPEN WhatsApp with the text prefilled. EVIE cannot press
   "send" for the user and never reports a message as delivered. */
window.EvieDesktopActions=(()=>{
 const desk=()=>!!window.evieDesktop&&window.evieDesktop.platform==='win32'&&typeof window.evieDesktop.desktop==='function';
 let pending=null;
 // The main process answers {ok:true,data:<action result>}; the action result itself is {ok,data|error}. One shape here.
 async function call(args){const r=await window.evieDesktop.desktop(args);return r?.ok&&r.data&&typeof r.data==='object'&&typeof r.data.ok==='boolean'?r.data:r;}
 const SIMPLE=new Set(['open_spotify','open_whatsapp','media_next','media_previous','media_play_pause','volume_up','volume_down','volume_mute','show_desktop','lock_pc']);
 // Spoken names → the fixed keys the main process accepts (electron/tools/desktop-actions.cjs FOLDERS / SETTINGS).
 const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/^(?:la |el |mis? |carpeta de |configuracion de |ajustes de )+/,'');
 const FOLDER_WORDS={descargas:'descargas',download:'descargas',downloads:'descargas',documentos:'documentos',documents:'documentos',escritorio:'escritorio',desktop:'escritorio',imagenes:'imagenes',fotos:'imagenes',pictures:'imagenes',musica:'musica',music:'musica',videos:'videos'};
 const SETTING_WORDS={wifi:'wifi','wi-fi':'wifi',internet:'wifi',red:'red',bluetooth:'bluetooth',pantalla:'pantalla',brillo:'pantalla',monitor:'pantalla',sonido:'sonido',audio:'sonido',bocinas:'sonido',notificaciones:'notificaciones',energia:'energia',bateria:'energia',actualizaciones:'actualizaciones','windows update':'actualizaciones',aplicaciones:'aplicaciones',apps:'aplicaciones',almacenamiento:'almacenamiento',disco:'almacenamiento',privacidad:'privacidad',microfono:'microfono',camara:'camara',fondo:'fondo','fondo de pantalla':'fondo',temas:'temas',mouse:'mouse',raton:'mouse',teclado:'teclado',hora:'hora',fecha:'hora',idioma:'idioma'};
 const PLAYLIST=/^[A-Za-z0-9]{22}$/;
 // «Ivi, a trabajar»: the person's work playlist (Configuración → Equipo), else Tony Stark's Workshop Playlist.
 const workPlaylist=()=>{const id=Store.get()?.preferences?.evie?.workPlaylist;return PLAYLIST.test(id||'')?id:null;};
 function playlistId(raw){const v=String(raw||'').trim();if(!v)return null;const m=/^(?:https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?playlist\/|spotify:playlist:)([A-Za-z0-9]{22})(?:[?#].*)?$/.exec(v);if(!m)throw Error('Pega el enlace de una playlist de Spotify (Compartir → Copiar enlace).');return m[1];}
 const contacts=()=>(Store.get()?.preferences?.evieContacts||[]).filter(c=>c&&typeof c.name==='string'&&/^\+?[0-9]{8,15}$/.test(c.phone||''));
 function resolveContact(n){const q=IvyTools.norm(String(n||''));if(!q)return {status:'needs_info',ask:'¿A quién se lo mando?'};const hit=contacts().filter(c=>{const k=IvyTools.norm(c.name);return k===q||k.split(' ')[0]===q;});if(hit.length===1)return {status:'ok',contact:hit[0]};if(hit.length>1)return {status:'ambiguous',options:hit.map(c=>c.name)};return {status:'unknown',note:`No tengo a «${n}» entre tus contactos de EVIE. Agrégalo en Configuración → Contactos de EVIE (nombre y número con lada).`};}
 async function run(action,{contact,message,app,query,url,level,folder,page,playlist}={}){
  if(!desk())return {ok:false,status:'unavailable',note:'Esa acción solo existe en EVIE para Windows. En el navegador no puedo abrir ni controlar apps de tu computadora.'};
  if(action==='compose_message'){const r=resolveContact(contact);if(r.status!=='ok')return {ok:false,...r};const text=String(message||'').trim();if(!text)return {ok:false,status:'needs_info',ask:`¿Qué quieres que le diga a ${r.contact.name}?`};if(text.length>1000)return {ok:false,status:'invalid',error:'El mensaje es demasiado largo (máximo 1000 caracteres).'};
   const prep=await call({action:'prepare_message',phone:r.contact.phone,message:text});if(!prep?.ok||!prep.data?.token)return {ok:false,error:prep?.error||'No se pudo preparar.'};
   pending={token:prep.data.token,contact:r.contact.name,phone:r.contact.phone,message:text};window.EvieHUD?.open('message',{...pending,title:'Mensaje para '+r.contact.name});
   return {ok:true,status:'awaiting_confirmation',sent:false,read_back:`Para ${r.contact.name}: «${text}». ¿Lo abro en WhatsApp para que lo envíes?`};}
  let args;
  if(SIMPLE.has(action))args={action};
  else if(action==='open_app'){const name=String(app||'').trim().slice(0,80);if(!name)return {ok:false,status:'needs_info',ask:'¿Qué aplicación abro?'};args={action,app:name};}
  else if(action==='spotify_search'||action==='search_web'){const q=String(query||'').trim().slice(0,200);if(!q)return {ok:false,status:'needs_info',ask:action==='spotify_search'?'¿Qué canción, artista o playlist busco en Spotify?':'¿Qué busco en Google?'};args={action,query:q};}
  else if(action==='open_url'){const u=String(url||'').trim();if(!/^https?:\/\/\S+$/i.test(u)||u.length>2048)return {ok:false,status:'invalid',error:'Necesito una dirección web completa (https://…).'};args={action,url:u};}
  else if(action==='work_mode'){const id=PLAYLIST.test(playlist||'')?playlist:workPlaylist();args=id?{action,playlist:id}:{action};}
  else if(action==='open_folder'){const k=FOLDER_WORDS[key(folder)];if(!k)return {ok:false,status:'invalid',error:'Puedo abrir Descargas, Documentos, Escritorio, Imágenes, Música o Videos.'};args={action,folder:k};}
  else if(action==='open_settings'){const k=SETTING_WORDS[key(page)];if(!k)return {ok:false,status:'invalid',error:'Esa página de Configuración no la tengo. Prueba con wifi, bluetooth, pantalla, sonido o actualizaciones.'};args={action,page:k};}
  else if(action==='set_volume'){const n=Math.round(Number(level));if(level===null||level===undefined||!Number.isFinite(n)||n<0||n>100)return {ok:false,status:'invalid',error:'Dime un volumen de 0 a 100.'};args={action,level:n};}
  else return {ok:false,error:'Acción no permitida.'};
  const r=await call(args);
  if(!r?.ok)return {ok:false,...(r?.status?{status:r.status}:{}),error:r?.error||r?.note||'Windows no completó la acción.',...(r?.note?{note:r.note}:{})};
  return {ok:true,...(r.data||{})};
 }
 async function sendPrepared(d=pending){if(!d||!desk())return {ok:false,error:'No hay mensaje pendiente.'};const r=await call({action:'open_prepared_message',token:d.token});pending=null;window.EvieHUD?.close('message',{silent:true});
  if(!r?.ok){App.toast(r?.error||'No se pudo abrir WhatsApp.','error');return {ok:false,error:r?.error};}
  window.EvieSounds?.play('success');window.EvieAssistant?.say?.('Abrí WhatsApp con el mensaje para '+d.contact+'. Revísalo y toca enviar ahí; yo no puedo confirmar la entrega.');return {ok:true,opened:true,sent:false};}
 function cancel(){if(!pending)return false;try{window.evieDesktop?.desktop?.({action:'cancel_message',token:pending.token});}catch{}pending=null;window.EvieHUD?.close('message',{silent:true});return true;}
 return Object.freeze({run,sendPrepared,cancel,resolveContact,contacts,available:desk,playlistId,workPlaylist,folderOf:v=>FOLDER_WORDS[key(v)]||null,settingOf:v=>SETTING_WORDS[key(v)]||null,get pending(){return pending;}});
})();
