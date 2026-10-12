'use strict';
// EVIE v3 narrow desktop actions exposed to the renderer through ONE validated IPC method ("desktop").
// - No arbitrary commands, paths or URLs from the renderer: each action maps to a fixed operation.
// - Spotify / WhatsApp open through their registered protocol (or official https fallback).
// - Media keys go through the existing helper (windows-tools.ps1 -Action media).
// - Messages: prepare -> token (2 min) -> open_prepared_message opens WhatsApp with recipient+text
//   prefilled. EVIE never presses send and never reports delivery.
const {randomUUID}=require('node:crypto');
const ACTIONS=new Set(['open_spotify','open_whatsapp','media_next','media_previous','media_play_pause','prepare_message','open_prepared_message','cancel_message','status']);
const PHONE=/^\+?[0-9]{8,15}$/,TOKEN=/^[0-9a-f-]{36}$/;
function validateDesktop(args){
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Acción inválida.');
 const keys=Object.keys(args).sort().join(',');
 if(!ACTIONS.has(args.action))throw Error('Acción de escritorio no permitida.');
 if(args.action==='prepare_message'){if(keys!=='action,message,phone'||!PHONE.test(args.phone)||typeof args.message!=='string'||!args.message.trim()||args.message.length>1000)throw Error('Mensaje inválido.');}
 else if(['open_prepared_message','cancel_message'].includes(args.action)){if(keys!=='action,token'||!TOKEN.test(args.token))throw Error('Confirmación inválida.');}
 else if(keys!=='action')throw Error('Parámetros no permitidos.');
 return args;
}
function createDesktopActions({shell,platform=process.platform,media,now=()=>Date.now(),ttl=120000}){
 const prepared=new Map();
 const sweep=()=>{for(const [k,v] of prepared)if(v.expires<now())prepared.delete(k);};
 async function openProtocol(primary,fallback){try{await shell.openExternal(primary);return {opened:true,method:'protocol'};}catch{await shell.openExternal(fallback);return {opened:true,method:'web'};}}
 async function run(args){
  validateDesktop(args);
  if(args.action==='status')return {ok:true,data:{platform,media:platform==='win32',whatsapp:true,spotify:true,messaging:'prefill_only'}};
  if(platform!=='win32')return {ok:false,error:'Disponible solo en EVIE para Windows.'};
  sweep();
  switch(args.action){
   case 'open_spotify':return {ok:true,data:{...await openProtocol('spotify:','https://open.spotify.com/'),note:'Solicité abrir Spotify; no verifico reproducción.'}};
   case 'open_whatsapp':return {ok:true,data:{...await openProtocol('whatsapp:','https://web.whatsapp.com/'),note:'Solicité abrir WhatsApp.'}};
   case 'media_next':case 'media_previous':case 'media_play_pause':{const key={media_next:'next',media_previous:'previous',media_play_pause:'play'}[args.action];const r=await media(key);return {ok:true,data:{submitted:true,method:'windows_media_keys',note:'Tecla multimedia enviada a Windows; el reproductor activo decide si la acepta.',...(r||{})}};}
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
module.exports={createDesktopActions,validateDesktop,ACTIONS};
