'use strict';
// «Ivi» wake word for EVIE para Windows. Runs scripts/wake-listener.ps1 (Windows' on-device recognizer with a fixed
// phrase list; no audio leaves that process) as a child process and turns its JSON lines into events:
// onWake({text,confidence}) per detection, onState({state,reason,language}) on changes. States: off · starting ·
// listening · error. If the helper dies it restarts with backoff (at most 6 times in 10 minutes); exit codes 2/3 mean
// «this Windows has no usable recognizer» and are not retried. stop() kills it.
const FATAL=Object.freeze({2:'Windows no tiene reconocimiento de voz para tu idioma. Agrégalo en Configuración → Hora e idioma → Voz.',3:'Windows no pudo preparar el reconocimiento de «Ivi».'});
const BACKOFF=[1000,2000,5000,10000,20000,30000];
function createWake({spawn,powershell,script,onWake=()=>{},onState=()=>{},log=()=>{},now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}){
 let child=null,wanted=false,state='off',reason='',language='',microphone='',restarts=[],timer=null,buffer='';const recent=[];
 const set=(s,why='')=>{state=s;reason=why;try{onState({state,reason,language});}catch{}};
 function line(text){let m;try{m=JSON.parse(text);}catch{return;}if(!m||typeof m!=='object')return;
  if(m.type==='ready'){language=String(m.language||'').slice(0,10);microphone=String(m.microphone||'').slice(0,80);set('listening');}
  // What the recognizer matched (only phrases from its fixed list), for the «¿Qué oye Ivi?» diagnostics.
  else if(m.type==='heard'){recent.unshift({text:String(m.text||'').slice(0,40),confidence:String(m.confidence||'').slice(0,10),ms:Number.isFinite(m.ms)?m.ms:0,accepted:m.accepted===true,at:now()});recent.length=Math.min(recent.length,12);}
  else if(m.type==='wake'){if(state==='listening'){try{onWake({text:String(m.text||'').slice(0,40),confidence:String(m.confidence||'').slice(0,10)});}catch{}}}
  else if(m.type==='error'){reason=String(m.error||'').slice(0,160);try{log('wake: '+reason);}catch{}}}
 function launch(){
  let c;try{c=spawn(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,stdio:['ignore','pipe','pipe']});}catch(error){wanted=false;set('error','No se pudo iniciar la escucha de «Ivi».');return;}
  child=c;buffer='';
  c.stdout.setEncoding?.('utf8');c.stdout.on('data',d=>{buffer+=String(d);let i;while((i=buffer.indexOf('\n'))>=0){const l=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(l)line(l);}if(buffer.length>65536)buffer='';});
  c.stderr?.on?.('data',()=>{});c.once('error',e=>{try{log('wake spawn: '+e.message);}catch{}});
  c.once('exit',code=>{if(child!==c)return;child=null;
   if(!wanted){set('off');return;}
   if(Object.hasOwn(FATAL,code)){wanted=false;set('error',FATAL[code]);return;}
   const t=now();restarts=restarts.filter(x=>t-x<600000);restarts.push(t);
   if(restarts.length>BACKOFF.length){wanted=false;set('error',reason||'La escucha de «Ivi» se detuvo varias veces.');return;}
   set('starting',reason);timer=setTimer(()=>{timer=null;if(wanted)launch();},BACKOFF[restarts.length-1]);});
 }
 function start(){if(wanted&&(child||timer))return status();wanted=true;restarts=[];set('starting');launch();return status();}
 function stop(){wanted=false;if(timer){clearTimer(timer);timer=null;}const c=child;child=null;if(c){try{c.kill();}catch{}}set('off');return status();}
 function status(){return {state,reason,language,microphone,running:!!child,recent:recent.map(x=>({...x}))};}
 return {start,stop,status};
}
module.exports={createWake};
