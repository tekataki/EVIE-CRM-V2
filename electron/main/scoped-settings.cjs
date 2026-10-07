'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const createSettings=require('./settings.cjs');
const {AsyncLocalStorage}=require('node:async_hooks');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
module.exports=function scopedSettings(dir,{enabled=false}={}){
 const legacy=createSettings(dir);const file=path.join(dir,'device-id.json');let deviceId;
 if(fs.existsSync(file)){deviceId=JSON.parse(fs.readFileSync(file,'utf8')).id;if(!UUID.test(deviceId))throw Error('Identidad de dispositivo inválida. Se conservó el archivo.');}
 else{deviceId=randomUUID();fs.writeFileSync(file,JSON.stringify({id:deviceId}),{flag:'wx',mode:0o600});}
 let active=enabled?null:legacy,owner=null,epoch=0;const context=new AsyncLocalStorage();
 function check(){const ticket=context.getStore();if(ticket!==undefined&&ticket!==epoch)throw Error('La cuenta cambió. Operación cancelada.');}
 function get(){check();if(active)return active.get();const s=legacy.get();return {...s,apps:{},files:{},locations:{},grants:{},domains:[],microphoneConsent:false,microphoneAsked:false,globalShortcut:false};}
 const methods={get,deviceId,owner:()=>owner,locked:()=>enabled&&!active,run:fn=>context.run(epoch,fn),select(id){if(!enabled){if(id!==null)throw Error('Cuentas desactivadas.');return;}if(id!==null&&!UUID.test(id))throw Error('Cuenta no válida.');epoch++;owner=id;active=id?createSettings(path.join(dir,'accounts',id,deviceId)):null;
   // Local model files are machine resources, not transferable account grants.
   if(active){const source=legacy.get();for(const key of ['whisperBinary','whisperModel'])if(!fs.existsSync(active.get()[key])&&fs.existsSync(source[key]))active.asset(key,source[key]);}
  }};
 for(const name of ['patch','microphone','grant','mapping','asset','domain'])methods[name]=(...args)=>{check();if(!active)throw Error('Inicia sesión antes de cambiar permisos.');return active[name](...args);};
 return methods;
};
