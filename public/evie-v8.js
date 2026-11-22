'use strict';
/* EVIE · v8 depth & motion layer (2026-11-22).
   - 3D-lit background scene (floating volumetric lights, perspective floor grid, grain, vignette) driven by GSAP.
   - Pointer light: every surface receives --lx/--ly so its specular highlight follows the cursor (CSS in evie-v8.css).
   - Physical tilt: elements with .v8-tilt rotate toward the pointer on a Motion spring (motion.dev, vanilla build).
   - Springy entrances for each screen (Motion) and a one-time cascade for the sidebar.
   Everything degrades to static when Motion/GSAP are missing or the person prefers reduced motion. */
window.EvieV8=(()=>{
 const M=()=>window.Motion,G=()=>window.gsap;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';
 const finePointer=()=>matchMedia('(hover: hover) and (pointer: fine)').matches;
 const SURF='.panel,.stat-card,.detail-card,.evm-card,.hud-card,.fc-panel,.v8-card';
 let sceneEl=null;

 function scene(){
  if(sceneEl||!document.body)return;
  sceneEl=document.createElement('div');sceneEl.className='v8-scene';sceneEl.setAttribute('aria-hidden','true');
  sceneEl.innerHTML='<div class="v8-light l1"></div><div class="v8-light l2"></div><div class="v8-light l3"></div><div class="v8-horizon"></div><div class="v8-grid"></div><div class="v8-noise"></div><div class="v8-vignette"></div>';
  document.body.prepend(sceneEl);
  if(reduced()||!G())return;
  const g=G();
  sceneEl.querySelectorAll('.v8-light').forEach((l,i)=>g.to(l,{x:()=>g.utils.random(-80,80),y:()=>g.utils.random(-60,60),scale:()=>g.utils.random(.85,1.2),
   duration:()=>g.utils.random(10,16),ease:'sine.inOut',repeat:-1,yoyo:true,repeatRefresh:true,delay:i*.7}));
 }

 // Pointer light + parallax (one rAF per frame, desktop pointers only for tilt/parallax).
 let raf=0,lastEv=null,tilted=null;
 function onMove(ev){lastEv=ev;if(raf)return;raf=requestAnimationFrame(frame);}
 function frame(){
  raf=0;const e=lastEv;if(!e)return;
  const card=e.target?.closest?.(SURF);
  if(card){const r=card.getBoundingClientRect();card.style.setProperty('--lx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');card.style.setProperty('--ly',((e.clientY-r.top)/r.height*100).toFixed(1)+'%');}
  if(reduced()||!finePointer())return;
  const t=e.target?.closest?.('.v8-tilt');
  if(tilted&&tilted!==t)untilt(tilted);
  if(t){tilted=t;const r=t.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5,max=Number(t.dataset.tilt||9);
   spring(t,{transformPerspective:900,rotateX:(-py*max).toFixed(2)+'deg',rotateY:(px*max).toFixed(2)+'deg',scale:1.02},{stiffness:260,damping:22});
   t.style.setProperty('--gx',((px+.5)*100).toFixed(1)+'%');t.style.setProperty('--gy',((py+.5)*100).toFixed(1)+'%');}
  if(sceneEl&&G()){const nx=e.clientX/innerWidth-.5,ny=e.clientY/innerHeight-.5;G().to(sceneEl.querySelector('.v8-grid'),{x:nx*-30,duration:1.2,ease:'power3.out',overwrite:'auto'});
   G().to(sceneEl.querySelectorAll('.v8-light'),{xPercent:nx*6,yPercent:ny*6,duration:1.6,ease:'power3.out',overwrite:'auto'});}
 }
 function untilt(el){spring(el,{transformPerspective:900,rotateX:'0deg',rotateY:'0deg',scale:1},{stiffness:200,damping:20});if(tilted===el)tilted=null;}
 function spring(el,props,opts={}){
  const m=M();if(m?.animate){try{return m.animate(el,props,{type:'spring',stiffness:opts.stiffness||300,damping:opts.damping||24,mass:opts.mass||1});}catch{}}
  el.style.transform=`perspective(900px) rotateX(${props.rotateX||'0deg'}) rotateY(${props.rotateY||'0deg'}) scale(${props.scale||1})`;return null;
 }

 // Springy entrance for a freshly rendered screen. Clears inline styles afterwards so CSS hover states keep working.
 function enter(items){
  const m=M();if(!m?.animate||reduced()||!items.length)return false;
  const small=innerWidth<768,list=items.slice(0,small?12:20);
  list.forEach(n=>{n.style.opacity='0';});
  const anim=m.animate(list,small?{opacity:[0,1],y:[16,0]}:{opacity:[0,1],y:[22,0],scale:[.985,1],filter:['blur(6px)','blur(0px)']},
   {delay:m.stagger?m.stagger(.035):0,type:'spring',stiffness:240,damping:28});
  const clean=()=>list.forEach(n=>{n.style.opacity='';n.style.transform='';n.style.filter='';});
  (anim?.finished||Promise.resolve()).then(clean,clean);setTimeout(clean,2200);
  return true;
 }

 // Sidebar: a single cascade the first time the navigation appears.
 let navDone=false;
 function navCascade(){
  if(navDone||reduced())return;const nav=document.getElementById('main-nav');const items=nav?[...nav.querySelectorAll('.nav-item,.nav-group-label')]:[];
  if(!items.length)return;navDone=true;const m=M();if(!m?.animate)return;
  items.forEach(n=>{n.style.opacity='0';});
  const a=m.animate(items,{opacity:[0,1],x:[-14,0]},{delay:m.stagger?m.stagger(.025,{startDelay:.15}):0,type:'spring',stiffness:300,damping:30});
  const clean=()=>items.forEach(n=>{n.style.opacity='';n.style.transform='';});(a?.finished||Promise.resolve()).then(clean,clean);setTimeout(clean,2500);
 }

 function start(){
  document.documentElement.classList.add('v8');scene();
  addEventListener('pointermove',onMove,{passive:true});
  document.addEventListener('pointerleave',()=>{if(tilted)untilt(tilted);},true);
  const nav=document.getElementById('main-nav');
  if(nav){if(nav.children.length)navCascade();else new MutationObserver((_,o)=>{if(nav.children.length){o.disconnect();navCascade();}}).observe(nav,{childList:true});}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 return Object.freeze({enter,spring,scene,reduced});
})();
