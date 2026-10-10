'use strict';
/* Motion layer (GSAP 3, local vendor). Everything degrades to no-op without GSAP or with reduced motion. */
window.EvieFX=(()=>{
 const g=()=>window.gsap,reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.paused==='true';
 let lastRoute=null,lightRaf=null;
 // Soft white light that follows the pointer behind the glass.
 addEventListener('pointermove',ev=>{if(lightRaf)return;lightRaf=requestAnimationFrame(()=>{lightRaf=null;const r=document.documentElement;r.style.setProperty('--mx',(ev.clientX/innerWidth*100).toFixed(1)+'%');r.style.setProperty('--my',(ev.clientY/innerHeight*100).toFixed(1)+'%');});},{passive:true});
 // Tactile press feedback for every button/link.
 document.addEventListener('pointerdown',ev=>{const el=ev.target.closest('.button,.icon-button,.nav-item,.mobile-nav a,.mobile-nav button,.evie-chip,.evm-card');if(!el||reduced()||!g())return;g().fromTo(el,{scale:1},{scale:.96,duration:.08,yoyo:true,repeat:1,ease:'power1.out',clearProps:'scale'});},{passive:true});
 function splash(){
  const el=document.getElementById('evie-splash');if(!el)return Promise.resolve();
  let seen=false;try{seen=sessionStorage.getItem('evie-splash')==='1';sessionStorage.setItem('evie-splash','1');}catch{}
  if(seen||reduced()||!g()){el.remove();return Promise.resolve();}
  return new Promise(done=>{const G=g(),finish=()=>{if(!el.isConnected)return done();G.to(el,{opacity:0,duration:.45,ease:'power2.inOut',onComplete:()=>{el.remove();done();}});};
   el.addEventListener('click',finish,{once:true});setTimeout(finish,3200);
   const tl=G.timeline({onComplete:()=>setTimeout(finish,250)});
   tl.from(el.querySelectorAll('.splash-dots i'),{scale:0,opacity:0,stagger:{each:.04,from:'random'},duration:.5,ease:'back.out(2)'})
     .from(el.querySelector('.splash-orb'),{scale:.2,opacity:0,duration:.8,ease:'expo.out'},'-=.3')
     .to(el.querySelectorAll('.splash-dots i'),{x:()=>G.utils.random(-14,14),y:()=>G.utils.random(-14,14),duration:.9,ease:'sine.inOut'},'<')
     .from(el.querySelectorAll('.splash-word span'),{yPercent:120,opacity:0,stagger:.07,duration:.6,ease:'power3.out'},'-=.5')
     .from(el.querySelector('.splash-tag'),{opacity:0,y:8,duration:.4},'-=.2');
  });
 }
 function gate(root){
  const c=root.querySelector('.gate-orb canvas');if(c)orbit(c);
  if(reduced()||!g())return;const G=g();
  G.from(root.querySelector('.account-card'),{y:26,opacity:0,scale:.98,duration:.7,ease:'expo.out'});
  G.from(root.querySelectorAll('.account-card h1,.account-card>p,.account-card label,.account-card .account-submit,.account-secondary'),{y:12,opacity:0,stagger:.05,duration:.5,delay:.15,ease:'power2.out'});
 }
 // Small orbiting-dots orb for the login card.
 function orbit(c){const x=c.getContext('2d');if(!x)return;let t=0;const dots=[...Array(26)].map((_,i)=>({a:i/26*Math.PI*2,r:22+Math.random()*16,s:.4+Math.random()*.9,z:Math.random()}));
  const draw=()=>{if(!c.isConnected)return;x.clearRect(0,0,96,96);t+=.016;for(const d of dots){const a=d.a+t*d.s,px=48+Math.cos(a)*d.r,py=48+Math.sin(a*1.3)*d.r*.7;x.fillStyle=`rgba(${170+d.z*60|0},${190+d.z*40|0},255,${.35+d.z*.6})`;x.beginPath();x.arc(px,py,1+d.z*1.6,0,7);x.fill();}
   const gr=x.createRadialGradient(48,48,0,48,48,26);gr.addColorStop(0,'rgba(220,230,255,.55)');gr.addColorStop(1,'rgba(150,170,255,0)');x.fillStyle=gr;x.fillRect(0,0,96,96);if(!reduced())requestAnimationFrame(draw);};draw();}
 function countUp(root){if(!g())return;root.querySelectorAll('[data-evie-count]').forEach(el=>{const to=Number(el.dataset.evieCount);if(!Number.isFinite(to))return;const fmt=el.dataset.evieFormat,o={v:0};g().to(o,{v:to,duration:.9,ease:'power2.out',onUpdate:()=>{el.textContent=fmt==='money'?Domain.money(Math.round(o.v)):Math.round(o.v).toLocaleString('es-MX');}});});}
 function enterRoute(route){
  const main=document.getElementById('main-content');if(!main)return;const changed=route!==lastRoute;lastRoute=route;
  if(!changed||reduced()||!g())return;const G=g();
  const items=[...main.querySelectorAll(':scope>*:not(script), .page-heading, .panel, .stat-card, .detail-card, .evm-card, .bank-card')].filter((n,i,a)=>a.indexOf(n)===i).slice(0,24);
  G.fromTo(items,{y:18,opacity:0},{y:0,opacity:1,duration:.55,stagger:.035,ease:'power3.out',clearProps:'transform,opacity'});
  countUp(main);
 }
 function panelIn(el){if(!el||reduced()||!g())return;g().fromTo(el,{y:30,opacity:0,scale:.98},{y:0,opacity:1,scale:1,duration:.45,ease:'expo.out',clearProps:'transform'});}
 function pulse(){const o=document.querySelectorAll('.evie-orb-button');if(!o.length||reduced()||!g())return;g().fromTo(o,{boxShadow:'0 0 0 0 rgba(150,180,255,.6)'},{boxShadow:'0 0 0 18px rgba(150,180,255,0)',duration:.8,ease:'power2.out'});}
 function mic(v){document.documentElement.style.setProperty('--evie-level',Math.min(1,v||0).toFixed(3));}
 return Object.freeze({splash,gate,enterRoute,panelIn,pulse,mic,countUp,reduced});
})();
