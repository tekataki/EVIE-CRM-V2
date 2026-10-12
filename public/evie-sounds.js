'use strict';
/* EVIE sound system: tiny original cues synthesized with Web Audio (no audio files, no licensing).
   listen = soft rising pair, process = muted tick, card = glassy chime, speak = airy swell,
   close = descending pair, success = bright pair, error = low gentle dip.
   Per-account toggle + volume (preferences.evie.sounds / soundVolume). Never plays before a user
   gesture: the AudioContext is created/resumed inside pointer/keyboard events only. */
window.EvieSounds=(()=>{
 let ctx=null;const last={};
 const pref=()=>{const p=window.Store?.get?.()?.preferences?.evie||{};return {on:p.sounds!==false,vol:Number.isFinite(p.soundVolume)?Math.max(0,Math.min(1,p.soundVolume)):.45};};
 function unlock(){try{if(!ctx){const K=window.AudioContext||window.webkitAudioContext;if(K)ctx=new K();}if(ctx?.state==='suspended')ctx.resume().catch(()=>{});}catch{}}
 function tone(f,{t=0,d=.12,type='sine',g=.1,to=null,attack=.008}={}){const now=ctx.currentTime+t,o=ctx.createOscillator(),a=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,now);if(to)o.frequency.exponentialRampToValueAtTime(to,now+d);a.gain.setValueAtTime(0,now);a.gain.linearRampToValueAtTime(g*pref().vol,now+attack);a.gain.exponentialRampToValueAtTime(.0001,now+d);o.connect(a);a.connect(ctx.destination);o.start(now);o.stop(now+d+.02);}
 const cues={
  listen:()=>{tone(660,{d:.11,g:.09});tone(990,{t:.07,d:.16,g:.08});},
  process:()=>{tone(1400,{d:.035,type:'triangle',g:.035});},
  card:()=>{tone(1318,{d:.22,g:.06});tone(1976,{t:.03,d:.28,g:.035});},
  speak:()=>{tone(420,{d:.25,g:.03,to:620,attack:.06});},
  close:()=>{tone(880,{d:.1,g:.05});tone(587,{t:.07,d:.16,g:.045});},
  success:()=>{tone(784,{d:.1,g:.06});tone(1175,{t:.08,d:.2,g:.06});},
  error:()=>{tone(330,{d:.2,g:.07,to:247,type:'triangle'});}
 };
 function play(name){const p=pref();if(!p.on||!p.vol||!cues[name]||!ctx||ctx.state!=='running')return false;const now=performance.now();if(now-(last[name]||0)<140)return false;last[name]=now;try{cues[name]();return true;}catch{return false;}}
 addEventListener('pointerdown',unlock,{passive:true});addEventListener('keydown',unlock);
 return Object.freeze({play,unlock,names:Object.keys(cues)});
})();
