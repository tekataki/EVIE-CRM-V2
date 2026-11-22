'use strict';
// Global hotkeys. Registered only while the account's `globalShortcut` setting is on (off by default and while
// signed out), always unregistered before re-registering and on quit.
//  · TYPE_SHORTCUT  → EVIE comes to the front; renderer opens Inicio with Ivi's composer focused → {type:'hotkey',mode:'type'}
//  · voiceShortcut  → EVIE comes to the front; renderer starts Ivi's voice directly           → {type:'hotkey',mode:'voice'}
// The voice accelerator comes from a fixed list (never free text): the renderer cannot make EVIE capture arbitrary
// keys system-wide (Ctrl+C, single letters, AltGr characters of Spanish layouts…).
const TYPE_SHORTCUT='CommandOrControl+Space';
const VOICE_SHORTCUTS=Object.freeze(['CommandOrControl+Shift+Space','CommandOrControl+Alt+Space','Alt+Shift+Space','CommandOrControl+Shift+F9']);
const DEFAULT_VOICE_SHORTCUT=VOICE_SHORTCUTS[0];
const label=(accelerator,platform=process.platform)=>accelerator.split('+').map(key=>({CommandOrControl:platform==='darwin'?'Cmd':'Ctrl',Shift:'Mayús',Space:'Espacio'}[key]||key)).join('+');
function createShortcuts({globalShortcut,settings,reveal=()=>{},send=()=>{},platform=process.platform}){
 let registered=[];
 const voiceOf=s=>VOICE_SHORTCUTS.includes(s?.voiceShortcut)?s.voiceShortcut:DEFAULT_VOICE_SHORTCUT;
 function trigger(mode){try{reveal(mode);}catch{}send({type:'hotkey',mode});}
 function unregister(){registered=[];globalShortcut.unregisterAll();}
 function register(){
  unregister();const s=settings()||{};if(s.globalShortcut!==true)return [];
  const failed=[];
  for(const [accelerator,mode] of [[TYPE_SHORTCUT,'type'],[voiceOf(s),'voice']]){
   let ok=false;try{ok=globalShortcut.register(accelerator,()=>trigger(mode));}catch{ok=false;}
   if(ok)registered.push({accelerator,mode});else failed.push(label(accelerator,platform));
  }
  if(failed.length)send({type:'notice',text:failed.join(' y ')+(failed.length>1?' globales no están disponibles.':' global no está disponible.')});
  return registered.map(r=>r.accelerator);
 }
 function status(){const s=settings()||{};return {enabled:s.globalShortcut===true,type:TYPE_SHORTCUT,voice:voiceOf(s),registered:registered.map(r=>r.accelerator)};}
 return {register,unregister,trigger,status};
}
module.exports={createShortcuts,TYPE_SHORTCUT,VOICE_SHORTCUTS,DEFAULT_VOICE_SHORTCUT,label};
