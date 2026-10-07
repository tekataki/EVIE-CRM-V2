'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {validate,object,enumeration,text}=require('../security/contracts.cjs');
const model={...text(160),pattern:'^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$'};
const schema=object({appearance:enumeration(['acrylic','transparent','solid']),opacity:{type:'number',minimum:0,maximum:100},lowGlow:{type:'boolean'},globalShortcut:{type:'boolean'},lightConfirm:{type:'boolean'},model,fastModel:model,preciseModel:model,modelMode:enumeration(['selected','fast','precise']),voice:{type:'string',maxLength:200},rate:{type:'integer',minimum:-5,maximum:5},volume:{type:'integer',minimum:0,maximum:100},setupDone:{type:'boolean'}},[]);
module.exports=dir=>{
 fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'desktop-settings.json'),root=path.join(process.env.LOCALAPPDATA||os.homedir(),'EVIE','ai');
 let state={settingsVersion:2,appearance:'acrylic',opacity:90,lowGlow:false,globalShortcut:false,lightConfirm:true,model:'qwen3.5:4b',modelMode:'selected',fastModel:'qwen3:4b',preciseModel:'qwen3.5:4b',voice:'',rate:0,volume:85,setupDone:true,microphoneConsent:false,microphoneAsked:false,apps:{},locations:{},files:{},grants:{},domains:['calendar.google.com','open.spotify.com'],whisperBinary:path.join(root,'whisper','whisper-cli.exe'),whisperModel:path.join(root,'models','ggml-small.bin')};
 const save=next=>{fs.writeFileSync(file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);state=next;};
 if(fs.existsSync(file)){
  const raw=fs.readFileSync(file,'utf8');let old;
  try{old=JSON.parse(raw);if(!old||Array.isArray(old)||typeof old!=='object')throw Error();}catch{throw Error('Preferencias incompatibles: desktop-settings.json se conservó intacto. Restaura una copia; no se creó un perfil vacío.');}
  if((old.settingsVersion||1)>2)throw Error('Preferencias de una versión posterior; no se sobrescribieron.');
  state={...state,...old};
  if(old.settingsVersion!==2){
   fs.writeFileSync(path.join(dir,'desktop-settings.pre-2.1.0.'+Date.now()+'.json'),raw,{flag:'wx',mode:0o600});
   state.opacity=Number.isFinite(old.opacity)?Math.round(Math.max(0,Math.min(100,(old.opacity-.28)/.57*100))):90;
   state.setupDone=true;state.settingsVersion=2;save(state);
  }
 }
 return {get:()=>structuredClone(state),patch:p=>{validate(schema,p);save({...state,...p});return structuredClone(state);},
  microphone:value=>{if(typeof value!=='boolean')throw Error('Permiso inválido.');save({...state,microphoneConsent:value,microphoneAsked:true});},
  grant:(key,value)=>{const grants={...state.grants};if(value)grants[key]=true;else delete grants[key];save({...state,grants});},
  mapping:(kind,id,value)=>{if(!['apps','locations','files'].includes(kind))throw Error('Mapping inválido.');const items={...state[kind]},grants={...state.grants};if(JSON.stringify(items[id])!==JSON.stringify(value))for(const key of Object.keys(grants))if(key.split(':')[1]===id)delete grants[key];if(value===null)delete items[id];else items[id]=value;save({...state,[kind]:items,grants});},
  asset:(key,value)=>{if(!['whisperBinary','whisperModel'].includes(key))throw Error('Componente inválido.');save({...state,[key]:value});},
  domain:host=>{if(!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,63}$/.test(host))throw Error('Dominio inválido.');save({...state,domains:[...new Set([...state.domains,host])].slice(-50)});}
 };
};
module.exports.schema=schema;
