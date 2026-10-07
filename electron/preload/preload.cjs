'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const call=(method,args={})=>ipcRenderer.invoke('evie:request',{method,args});
contextBridge.exposeInMainWorld('evieDesktop',Object.freeze({
 version:1,platform:process.platform,account:args=>call('account',args),
 diagnostics:()=>call('diagnostics'),settings:()=>call('settings.get'),configure:args=>call('settings.patch',args),models:()=>call('models'),microphone:action=>call('microphone',{action}),
 window:action=>call('window',{action}),chat:text=>call('chat',{text}),cancel:()=>call('cancel'),
 transcribe:wav=>call('transcribe',{wav}),speak:text=>call('speak',{text}),voices:()=>call('voices'),
 mapping:(kind,id)=>call('mapping',{kind,id}),asset:kind=>call('asset',{kind}),domain:host=>call('domain',{host}),
 tool:(name,args)=>call('tool',{name,args}),google:action=>call('google',{action}),
 apps:Object.freeze({list:()=>call('apps.list'),discover:()=>call('apps.discover'),icon:id=>call('apps.icon',{id}),authorize:id=>call('apps.authorize',{id}),revoke:id=>call('apps.revoke',{id})}),revokeGrant:key=>call('grant.revoke',{key}),revokeMapping:(kind,id)=>call('mapping.revoke',{kind,id}),
 confirm:(token,approved,always=false)=>call('confirmation.answer',{token,approved,always}),confirmAudio:(token,wav)=>call('confirmation.audio',{token,wav}),
 onAction:handler=>{const fn=(_e,a)=>handler(a);ipcRenderer.on('evie:action',fn);return ()=>ipcRenderer.removeListener('evie:action',fn);},
 onCRM:handler=>{const fn=async(_e,request)=>{try{const result=await handler(request.action,request.payload);ipcRenderer.send('evie:crm-result',{id:request.id,result});}catch(error){const message=String(error?.message||'El libro local rechazó la operación.').replace(/[\u0000-\u001f]/g,' ').slice(0,1500);ipcRenderer.send('evie:crm-result',{id:request.id,result:{ok:false,error:message}});}};ipcRenderer.on('evie:crm',fn);return ()=>ipcRenderer.removeListener('evie:crm',fn);}
}));
