'use strict';
/* EVIE single microphone owner + floating mic.
   - One owner at a time: 'assistant' (Ivi), 'kisha' (talks/long narratives), 'wake' (local wake word, lowest).
     acquire(owner,onRelease) pre-empts an equal/lower-priority owner through its onRelease callback, so two
     recorders never compete for the device. Any real owner pauses the wake listener.
   - Floating mic button on pages without another mic (desktop modules). Hidden on Home (the core is the mic),
     inside Mascota Virtual (Kisha has its own talk button) and on mobile when the bottom orb exists.
   This module captures no audio; it only coordinates. */
window.EvieMic=(()=>{
 const PRIORITY={wake:0,assistant:2,kisha:2};
 let owner=null,release=null;const listeners=new Set();
 function emit(){document.documentElement.dataset.micOwner=owner||'';listeners.forEach(f=>{try{f(owner);}catch{}});}
 /** Request the mic. Returns true when granted (and the previous owner was asked to stop). */
 function acquire(who,onRelease){if(!(who in PRIORITY))return false;if(owner===who){release=onRelease||release;return true;}
  if(owner&&PRIORITY[owner]>PRIORITY[who])return false;
  const prev=release,prevOwner=owner;owner=who;release=onRelease||null;
  if(prevOwner&&prev)try{prev(who);}catch{}
  if(who!=='wake')try{window.EvieWake?.pause?.(1500);}catch{}
  emit();return true;}
 function releaseMic(who){if(owner!==who)return;owner=null;release=null;emit();try{window.EvieWake?.pause?.(900);}catch{}}
 const current=()=>owner;
 function on(f){listeners.add(f);return ()=>listeners.delete(f);}
 function fab(){if(!document.body)return;let b=document.getElementById('evie-mic-fab');
  if(!b){b=document.createElement('button');b.id='evie-mic-fab';b.type='button';b.className='evie-mic-fab';b.setAttribute('aria-label','Hablar con EVIE');
   b.innerHTML='<span class="evie-mic-fab-ring" aria-hidden="true"></span><svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
   b.addEventListener('click',()=>{window.EvieSounds?.unlock?.();if(owner==='kisha'){window.App?.toast?.('Kisha está usando el micrófono. Termina esa charla primero.','error');return;}window.EvieAssistant?.listen?.({inline:false});});
   document.body.append(b);}
  const sec=window.UI?.section||'inicio',mobile=matchMedia('(max-width:1023px)').matches,hasOrb=!!document.querySelector('.mobile-nav .evie-orb-button');
  b.hidden=sec==='inicio'||sec==='bitacora'||(mobile&&hasOrb)||!window.EvieAssistant;
  b.dataset.state=document.documentElement.dataset.evie||'idle';
  // Never cover the right context rail: sit just left of it when it is visible on wide screens.
  const rail=document.getElementById('ivy-intelligence'),rr=rail&&getComputedStyle(rail).display!=='none'?rail.getBoundingClientRect():null;
  b.style.right=rr&&rr.width>40&&rr.left>innerWidth/2?Math.round(innerWidth-rr.left+20)+'px':'';}
 function afterRender(){try{fab();}catch{}}
 try{new MutationObserver(()=>{const b=document.getElementById('evie-mic-fab');if(b)b.dataset.state=document.documentElement.dataset.evie||'idle';}).observe(document.documentElement,{attributes:true,attributeFilter:['data-evie']});}catch{}
 addEventListener('resize',()=>{try{fab();}catch{}},{passive:true});
 return Object.freeze({acquire,release:releaseMic,current,on,afterRender,PRIORITY});
})();
