'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const call=(method,args={})=>ipcRenderer.invoke('evie:request',{method,args});
// Streamed account request (Ivi's chat answers, Server-Sent Events) over a private MessagePort.
// handler gets {type:'open',status,contentType} · {type:'chunk',text}… then exactly one of {type:'end'} |
// {type:'json',status,data} | {type:'error',error,status?,code?,aborted?}. Returns abort(): cancels upstream.
const FINAL=new Set(['end','json','error']);
function accountStream(args,handler){
 if(typeof handler!=='function')throw TypeError('Falta el manejador del flujo.');
 const {port1,port2}=new MessageChannel();let done=false;
 const emit=event=>{try{handler(event);}catch{}};
 const finish=event=>{if(done)return;done=true;port1.onmessage=null;try{port1.close();}catch{}emit(event);};
 port1.onmessage=({data})=>{if(done||!data||typeof data!=='object')return;if(FINAL.has(data.type))finish(data);else if(data.type==='open'||data.type==='chunk')emit(data);};
 try{ipcRenderer.postMessage('evie:account-stream',args,[port2]);}catch(error){done=true;port1.onmessage=null;try{port1.close();}catch{}throw error;}
 return ()=>{if(done)return;try{port1.postMessage({type:'abort'});}catch{}finish({type:'error',error:'Operación cancelada.',code:'aborted',aborted:true});};
}
// Global hotkeys arrive on evie:action as {type:'hotkey',mode:'type'|'voice'}. The newest one waits up to 15 s for a
// subscriber, so the hotkey that brought EVIE up while the UI was still loading is not lost.
const hotkeyHandlers=new Set();let pendingHotkey=null;
ipcRenderer.on('evie:action',(_e,a)=>{if(a?.type!=='hotkey'||(a.mode!=='type'&&a.mode!=='voice'))return;const event={type:'hotkey',mode:a.mode};if(!hotkeyHandlers.size){pendingHotkey={event,at:Date.now()};return;}for(const handler of [...hotkeyHandlers]){try{handler(event);}catch{}}});
function onHotkey(handler){
 if(typeof handler!=='function')throw TypeError('Falta el manejador del atajo.');
 hotkeyHandlers.add(handler);const held=pendingHotkey;pendingHotkey=null;
 if(held&&Date.now()-held.at<15000)setTimeout(()=>{if(hotkeyHandlers.has(handler)){try{handler(held.event);}catch{}}},0);
 return ()=>{hotkeyHandlers.delete(handler);};
}
contextBridge.exposeInMainWorld('evieDesktop',Object.freeze({
 version:2,platform:process.platform,account:args=>call('account',args),accountStream,
 diagnostics:()=>call('diagnostics'),settings:()=>call('settings.get'),configure:args=>call('settings.patch',args),models:()=>call('models'),microphone:action=>call('microphone',{action}),
 window:action=>call('window',{action}),chat:text=>call('chat',{text}),cancel:()=>call('cancel'),
 transcribe:wav=>call('transcribe',{wav}),speak:text=>call('speak',{text}),voices:()=>call('voices'),
 mapping:(kind,id)=>call('mapping',{kind,id}),asset:kind=>call('asset',{kind}),domain:host=>call('domain',{host}),
 tool:(name,args)=>call('tool',{name,args}),desktop:args=>call('desktop',args),googleSignIn:()=>call('google.signin'),onGoogle:handler=>{const fn=(_e,a)=>{if(a?.type==='google-auth')handler(a);};ipcRenderer.on('evie:action',fn);return ()=>ipcRenderer.removeListener('evie:action',fn);},google:action=>call('google',{action}),
 apps:Object.freeze({list:()=>call('apps.list'),discover:()=>call('apps.discover'),icon:id=>call('apps.icon',{id}),authorize:id=>call('apps.authorize',{id}),revoke:id=>call('apps.revoke',{id})}),revokeGrant:key=>call('grant.revoke',{key}),revokeMapping:(kind,id)=>call('mapping.revoke',{kind,id}),
 confirm:(token,approved,always=false)=>call('confirmation.answer',{token,approved,always}),confirmAudio:(token,wav)=>call('confirmation.audio',{token,wav}),
 update:Object.freeze({status:()=>call('update.status'),install:()=>call('update.install')}),
 wake:Object.freeze({start:()=>call('wake.start'),stop:()=>call('wake.stop'),status:()=>call('wake.status')}),
 onAction:handler=>{const fn=(_e,a)=>handler(a);ipcRenderer.on('evie:action',fn);return ()=>ipcRenderer.removeListener('evie:action',fn);},onHotkey,
 onCRM:handler=>{const fn=async(_e,request)=>{try{const result=await handler(request.action,request.payload);ipcRenderer.send('evie:crm-result',{id:request.id,result});}catch(error){const message=String(error?.message||'El libro local rechazó la operación.').replace(/[\u0000-\u001f]/g,' ').slice(0,1500);ipcRenderer.send('evie:crm-result',{id:request.id,result:{ok:false,error:message}});}};ipcRenderer.on('evie:crm',fn);return ()=>ipcRenderer.removeListener('evie:crm',fn);}
}));
