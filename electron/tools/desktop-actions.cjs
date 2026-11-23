'use strict';
// EVIE v3 narrow desktop actions exposed to the renderer through ONE validated IPC method ("desktop").
// - No arbitrary commands, paths or URLs from the renderer: each action maps to a fixed operation.
// - Spotify / WhatsApp open through their registered protocol (or official https fallback).
// - Media keys go through the existing helper (windows-tools.ps1 -Action media).
// - Messages: prepare -> token (2 min) -> open_prepared_message opens WhatsApp with recipient+text
//   prefilled. EVIE never presses send and never reports delivery.
// 2.4 (cloud Ivi on Windows): open_app by NAME (resolved in main through app-names.cjs: fixed built-ins, apps the
// person authorized, or a native «¿Permitir?» first), Spotify search, Google search, volume keys and exact volume.
const {randomUUID}=require('node:crypto');
// 2.5: «Ivi, a trabajar» (work playlist in Spotify, already playing), known folders, Windows Settings pages, show the
// desktop and lock the session. Every target comes from a fixed map below; the model only picks a key.
const ACTIONS=new Set(['open_spotify','open_whatsapp','media_next','media_previous','media_play_pause','prepare_message','open_prepared_message','cancel_message','status','open_url','open_app','spotify_search','search_web','volume_up','volume_down','volume_mute','set_volume','work_mode','open_folder','open_settings','show_desktop','lock_pc']);
const FOLDERS=Object.freeze({descargas:'downloads',documentos:'documents',escritorio:'desktop',imagenes:'pictures',musica:'music',videos:'videos'});
const SETTINGS=Object.freeze({wifi:'network-wifi',red:'network',bluetooth:'bluetooth',pantalla:'display',sonido:'sound',notificaciones:'notifications',energia:'powersleep',actualizaciones:'windowsupdate',aplicaciones:'appsfeatures',almacenamiento:'storagesense',privacidad:'privacy',microfono:'privacy-microphone',camara:'privacy-webcam',fondo:'personalization-background',temas:'themes',mouse:'mousetouchpad',teclado:'typing',hora:'dateandtime',idioma:'regionlanguage'});
const PLAYLIST=/^[A-Za-z0-9]{22}$/;
const PHONE=/^\+?[0-9]{8,15}$/,TOKEN=/^[0-9a-f-]{36}$/;
const phrase=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
// v3.1 Automatizaciones: ONLY public http(s) websites, opened in the user's normal browser (shell.openExternal).
function safeWebUrl(raw){if(typeof raw!=='string'||raw.length>2048||/[\u0000-\u001f\s]/.test(raw))throw Error('Dirección inválida.');let u;try{u=new URL(raw);}catch{throw Error('Dirección inválida.');}
 if(!['http:','https:'].includes(u.protocol))throw Error('Solo se abren sitios web http/https.');if(u.username||u.password)throw Error('La dirección no puede incluir credenciales.');
 const h=u.hostname.toLowerCase();if(!h.includes('.')||/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.)/.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||/\.(local|internal|lan)$/.test(h))throw Error('Solo sitios públicos.');return u.href;}
function validateDesktop(args){
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Acción inválida.');
 const keys=Object.keys(args).sort().join(',');
 if(!ACTIONS.has(args.action))throw Error('Acción de escritorio no permitida.');
 if(args.action==='prepare_message'){if(keys!=='action,message,phone'||!PHONE.test(args.phone)||typeof args.message!=='string'||!args.message.trim()||args.message.length>1000)throw Error('Mensaje inválido.');}
 else if(args.action==='open_url'){if(keys!=='action,url')throw Error('Parámetros no permitidos.');safeWebUrl(args.url);}
 else if(['open_prepared_message','cancel_message'].includes(args.action)){if(keys!=='action,token'||!TOKEN.test(args.token))throw Error('Confirmación inválida.');}
 else if(args.action==='open_app'){if(keys!=='action,app'||!phrase(args.app,80))throw Error('Nombre de aplicación inválido.');}
 else if(['spotify_search','search_web'].includes(args.action)){if(keys!=='action,query'||!phrase(args.query,200))throw Error('Búsqueda inválida.');}
 else if(args.action==='set_volume'){if(keys!=='action,level'||!Number.isInteger(args.level)||args.level<0||args.level>100)throw Error('Volumen de 0 a 100.');}
 else if(args.action==='work_mode'){if(!(keys==='action'||(keys==='action,playlist'&&PLAYLIST.test(args.playlist))))throw Error('Playlist inválida.');}
 else if(args.action==='open_folder'){if(keys!=='action,folder'||!Object.hasOwn(FOLDERS,args.folder))throw Error('Carpeta no permitida.');}
 else if(args.action==='open_settings'){if(keys!=='action,page'||!Object.hasOwn(SETTINGS,args.page))throw Error('Página de configuración no permitida.');}
 else if(keys!=='action')throw Error('Parámetros no permitidos.');
 return args;
}
function createDesktopActions({shell,platform=process.platform,media,openApp=async()=>({ok:false,error:'No disponible.'}),setVolume=async()=>{throw Error('No disponible.');},workMode=async()=>{throw Error('No disponible.');},openFolder=async()=>{throw Error('No disponible.');},showDesktop=async()=>{throw Error('No disponible.');},lockPC=async()=>{throw Error('No disponible.');},now=()=>Date.now(),ttl=120000}){
 const prepared=new Map();
 const sweep=()=>{for(const [k,v] of prepared)if(v.expires<now())prepared.delete(k);};
 async function openProtocol(primary,fallback){try{await shell.openExternal(primary);return {opened:true,method:'protocol'};}catch{await shell.openExternal(fallback);return {opened:true,method:'web'};}}
 async function run(args){
  validateDesktop(args);
  if(args.action==='status')return {ok:true,data:{platform,media:platform==='win32',whatsapp:true,spotify:true,apps:platform==='win32',volume:platform==='win32',messaging:'prefill_only'}};
  if(platform!=='win32')return {ok:false,error:'Disponible solo en EVIE para Windows.'};
  sweep();
  switch(args.action){
   case 'open_spotify':return {ok:true,data:{...await openProtocol('spotify:','https://open.spotify.com/'),note:'Solicité abrir Spotify; no verifico reproducción.'}};
   case 'open_whatsapp':return {ok:true,data:{...await openProtocol('whatsapp:','https://web.whatsapp.com/'),note:'Solicité abrir WhatsApp.'}};
   case 'open_app':{const r=await openApp(args.app.trim());return r&&r.ok===false?r:{ok:true,data:r};}
   case 'spotify_search':{const q=encodeURIComponent(args.query.trim());return {ok:true,data:{...await openProtocol('spotify:search:'+q,'https://open.spotify.com/search/'+q),note:'Abrí la búsqueda en Spotify; elige qué reproducir (no verifico la reproducción).'}};}
   case 'search_web':await shell.openExternal('https://www.google.com/search?q='+encodeURIComponent(args.query.trim()));return {ok:true,data:{opened:true,method:'default_browser',note:'Abrí la búsqueda en tu navegador.'}};
   case 'set_volume':{const r=await setVolume(args.level);return {ok:true,data:{submitted:true,...(r||{}),note:'Volumen de Windows ajustado.'}};}
   case 'work_mode':return {ok:true,data:await workMode(args.playlist||null)};
   case 'open_folder':await openFolder(FOLDERS[args.folder]);return {ok:true,data:{opened:true,folder:args.folder}};
   case 'open_settings':await shell.openExternal('ms-settings:'+SETTINGS[args.page]);return {ok:true,data:{opened:true,page:args.page,note:'Abrí la Configuración de Windows; los cambios los haces tú.'}};
   case 'show_desktop':await showDesktop();return {ok:true,data:{submitted:true,note:'Minimicé las ventanas para mostrar el escritorio.'}};
   case 'lock_pc':await lockPC();return {ok:true,data:{submitted:true,note:'Bloqueé la sesión de Windows; no se cerró nada.'}};
   case 'media_next':case 'media_previous':case 'media_play_pause':case 'volume_up':case 'volume_down':case 'volume_mute':{
    const key={media_next:'next',media_previous:'previous',media_play_pause:'playpause',volume_up:'volumeup',volume_down:'volumedown',volume_mute:'mute'}[args.action];
    // Each volume key press moves Windows' volume ~2 %; five presses (one helper run) make a noticeable step.
    const r=await media(key,/^volume_(up|down)$/.test(args.action)?5:1);
    return {ok:true,data:{submitted:true,method:'windows_media_keys',note:args.action.startsWith('volume')?'Ajusté el volumen de Windows.':'Tecla multimedia enviada a Windows; el reproductor activo decide si la acepta.',...(r||{})}};}
   case 'open_url':{await shell.openExternal(safeWebUrl(args.url));return {ok:true,data:{opened:true,method:'default_browser',note:'Se pidió a Windows abrir el sitio en tu navegador.'}};}
   case 'prepare_message':{const token=randomUUID();prepared.set(token,{phone:args.phone.replace(/^\+/,''),message:args.message.trim(),expires:now()+ttl});return {ok:true,data:{token,expires_in:ttl/1000,sent:false}};}
   case 'cancel_message':prepared.delete(args.token);return {ok:true,data:{cancelled:true}};
   case 'open_prepared_message':{const p=prepared.get(args.token);prepared.delete(args.token);if(!p||p.expires<now())return {ok:false,error:'La confirmación expiró. Vuelve a pedir el mensaje.'};
    const q='phone='+encodeURIComponent(p.phone)+'&text='+encodeURIComponent(p.message);const r=await openProtocol('whatsapp://send?'+q,'https://wa.me/'+encodeURIComponent(p.phone)+'?text='+encodeURIComponent(p.message));
    return {ok:true,data:{...r,prefilled:true,sent:false,note:'Abrí el chat con el texto listo. Envíalo tú en WhatsApp.'}};}
  }
  return {ok:false,error:'Acción no permitida.'};
 }
 return {run,pending:()=>prepared.size};
}
module.exports={createDesktopActions,validateDesktop,ACTIONS,FOLDERS,SETTINGS,safeWebUrl};
