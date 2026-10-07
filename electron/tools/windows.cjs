'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {safeURL,tool}=require('../security/contracts.cjs'),{run}=require('../voice/process.cjs');
const {executable,validateApp,protocols,capabilities,target}=require('./catalog.cjs');
const grantKey=(name,args)=>name+':'+(args.appId||args.fileId|| (name==='windows.open_url'?new URL(args.url).hostname:'system'))+(args.action?':'+args.action:'');
function windowsTools({settings,shell,Notification,helper,platform=process.platform,runner=run,launcher=spawn,updateFile=()=>{}}){
 const files=require('./files.cjs').createFileTools({settings,shell});
 const fileActions=new Set(['windows.reveal_file','windows.rename_file','windows.move_file','windows.trash_file']);
 const fingerprint=(s,args)=>JSON.stringify({app:args.appId?s.apps[args.appId]:null,folder:args.alias?s.locations[args.alias]:null});
 function check(name,args){tool(name,args);if(platform!=='win32')throw Error('Disponible en EVIE Desktop para Windows.');const s=settings();
  if(args.appId){const app=validateApp(s.apps[args.appId]);if(['windows.focus_app','windows.window_action','windows.close_app'].includes(name)&&(app.kind||'exe')!=='exe')throw Error('Este tipo de aplicación solo admite apertura; no control de ventana.');if(name==='windows.spotify_search'&&app.protocol!=='spotify')throw Error('Autoriza el protocolo Spotify específico.');if(name==='windows.whatsapp_draft'&&app.protocol!=='whatsapp')throw Error('Autoriza el protocolo WhatsApp específico.');}
  if(name==='windows.open_url')safeURL(args.url,s.domains);
  if(name==='windows.open_location'){const folder=s.locations[args.alias];if(!folder||!path.isAbsolute(folder)||folder.startsWith('\\\\')||!fs.statSync(folder).isDirectory())throw Error('Alias de carpeta no configurado.');}return s;
 }
 function isGranted(name,args){const s=settings();if(args.appId&&!s.apps[args.appId]||args.fileId&&!s.files?.[args.fileId])return false;return s.grants?.[grantKey(name,args)]===true;}
 async function launch(file,args=[]){return new Promise((resolve,reject)=>{const child=launcher(file,args,{shell:false,windowsHide:false,detached:true,stdio:'ignore'});child.once('error',()=>reject(Error('Windows no pudo abrir la aplicación.')));child.once('spawn',()=>{child.unref();resolve({launched:true,pid:child.pid,note:'Solicitud de apertura aceptada; no se verifica contenido ni reproducción.'});});});}
 return {isGranted,grantKey,prepare:async(name,args)=>{const s=check(name,args);if(fileActions.has(name))return files.prepare(name,args);if(name==='windows.search_apps')return {result:{ok:true,data:{apps:Object.entries(s.apps).filter(([id,v])=>(id+' '+v.name).toLowerCase().includes((args.query||'').toLowerCase())).map(([id,v])=>({id,name:v.name||id,capabilities:capabilities(v)}))}}};return {fingerprint:fingerprint(s,args),preview:{tool:name,...args,target:args.appId?target(s.apps[args.appId]):args.alias?s.locations[args.alias]:undefined,warning:name==='windows.close_app'?'Puede haber cambios sin guardar. No se fuerza el cierre.':name==='windows.whatsapp_draft'?'Solo borrador. No se enviará ningún mensaje.':undefined}};},
 execute:async(name,args,prepared)=>{const s=check(name,args);if(fileActions.has(name)){const result=await files.execute(name,args,prepared);if(result.data.moved)updateFile(args.fileId,result.data.destination);if(result.data.trashed)updateFile(args.fileId,null);return result;}if(prepared?.fingerprint!==undefined&&prepared.fingerprint!==fingerprint(s,args))throw Error('El destino autorizado cambió. Confirma una nueva propuesta.');let data;const app=args.appId?s.apps[args.appId]:null;
  if(name==='windows.open_app'){if(app.kind==='protocol'){await shell.openExternal(protocols[app.protocol]);data={submitted:true,note:'Se solicitó abrir la aplicación, sin otras acciones.'};}else if(app.kind==='store'){data=await launch(path.join(process.env.SystemRoot,'explorer.exe'),['shell:AppsFolder\\'+app.aumid]);}else data=await launch(executable(app.path));}
  else if(name==='windows.spotify_search'){await shell.openExternal('spotify:search:'+encodeURIComponent(args.query));data={searchOpened:true,playingVerified:false};}
  else if(name==='windows.whatsapp_draft'){await shell.openExternal('whatsapp://send?phone='+encodeURIComponent(args.recipient.replace(/^\+/,''))+'&text='+encodeURIComponent(args.message));data={draftPrepared:true,sent:false,recipient:args.recipient,message:args.message};}
  else if(name==='windows.search_web'){await shell.openExternal('https://www.google.com/search?q='+encodeURIComponent(args.query));data={searchOpened:true};}
  else if(name==='windows.open_url'){await shell.openExternal(safeURL(args.url,s.domains));data={opened:true};}
  else if(name==='windows.open_location'){const error=await shell.openPath(s.locations[args.alias]);if(error)throw Error('No se pudo abrir la carpeta.');data={opened:true};}
  else if(name==='windows.show_notification'){if(!Notification.isSupported())throw Error('Notificaciones no disponibles.');new Notification({title:args.title,body:args.body}).show();data={submitted:true};}
  else{const action=name==='windows.focus_app'?'focus':name==='windows.window_action'?args.action:name==='windows.close_app'?'close':name==='windows.set_volume'?'volume':'media';const value=app?executable(app.path):action==='volume'?String(args.level):args.action;const ps=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');data=JSON.parse(await runner(ps,['-NoProfile','-NonInteractive','-File',helper,'-Action',action,'-Value',value]));}return {ok:true,data};
 }};
}
module.exports={windowsTools,executable,grantKey};
