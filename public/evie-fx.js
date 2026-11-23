'use strict';
/* Motion layer (GSAP 3, local vendor). Everything degrades to no-op without GSAP or with reduced motion. */
window.EvieFX=(()=>{
 const g=()=>window.gsap,reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.paused==='true';
 let lastRoute=null,lightRaf=null,splashTpl=null;
 // Soft white light that follows the pointer behind the glass.
 addEventListener('pointermove',ev=>{if(lightRaf)return;lightRaf=requestAnimationFrame(()=>{lightRaf=null;const r=document.documentElement;r.style.setProperty('--mx',(ev.clientX/innerWidth*100).toFixed(1)+'%');r.style.setProperty('--my',(ev.clientY/innerHeight*100).toFixed(1)+'%');});},{passive:true});
 // Tactile press feedback for every button/link.
 document.addEventListener('pointerdown',ev=>{const el=ev.target.closest('.button,.icon-button,.nav-item,.mobile-nav a,.mobile-nav button,.evie-chip,.evm-card');if(!el||reduced()||!g())return;g().fromTo(el,{scale:1},{scale:.96,duration:.08,yoyo:true,repeat:1,ease:'power1.out',clearProps:'scale'});},{passive:true});
 function splash({force=false}={}){
  let el=document.getElementById('evie-splash');
  if(el&&!splashTpl)splashTpl=el.outerHTML;
  if(!el&&force&&splashTpl){document.body.insertAdjacentHTML('beforeend',splashTpl);el=document.getElementById('evie-splash');}
  if(!el)return Promise.resolve();
  let seen=false;try{seen=sessionStorage.getItem('evie-splash')==='1';sessionStorage.setItem('evie-splash','1');}catch{}
  if((seen&&!force)||reduced()||!g()){el.remove();return Promise.resolve();}
  if(!el.classList.contains('v8'))return legacySplash(el);
  // v8 HUD boot: scan line → rings draw and spin → light core → «EVIE» from blur → boot lines decrypt →
  // «Created by Alejandro Dali» types itself → rings fly past the camera with a flash into the app.
  return new Promise(done=>{const G=g(),q=s=>el.querySelector(s),qa=s=>[...el.querySelectorAll(s)];let ended=false;
   const spin=[];const finish=()=>{if(ended)return;ended=true;spin.forEach(t=>t.kill());if(!el.isConnected)return done();
    G.timeline({onComplete:()=>{el.remove();done();}})
     .to(q('.sp-rings'),{scale:2.8,opacity:0,duration:.6,ease:'power3.in'},0)
     .to(q('.sp-text'),{y:-24,opacity:0,filter:'blur(10px)',duration:.45,ease:'power2.in'},0)
     .to(q('.sp-flash'),{opacity:.9,duration:.18,ease:'power1.in'},.32).to(q('.sp-flash'),{opacity:0,duration:.35,ease:'power2.out'},.5)
     .to(el,{opacity:0,duration:.4,ease:'power2.inOut'},.5);};
   el.addEventListener('click',finish,{once:true});setTimeout(finish,5200);
   // The credit stays one plain phrase in the HTML; split it here into «Created by» + the typed name.
   const credit=q('.sp-credit');if(credit&&!credit.querySelector('.sp-name')){const t=credit.textContent.trim(),m=t.match(/^(Created by)\s+(.+)$/i),by=m?m[1]:'',who=m?m[2]:t;const esc=c=>c.replace(/[<&>"]/g,'');credit.innerHTML=(by?'<span class="sp-by">'+esc(by)+'</span>':'')+'<span class="sp-name">'+[...who].map(c=>'<span>'+esc(c)+'</span>').join('')+'</span>';}
   const draw=qa('.sp-r:not(.r2)');draw.forEach(p=>{const L=p.getTotalLength?p.getTotalLength():1000;G.set(p,{strokeDasharray:L,strokeDashoffset:L});});
   const scramble=(node,dur)=>{const fin=node.dataset.final||node.textContent,chars='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#·/',o={p:0};
    return G.to(o,{p:1,duration:dur,ease:'none',onUpdate:()=>{const n=Math.floor(o.p*fin.length);node.textContent=fin.slice(0,n)+[...fin.slice(n)].map(c=>c===' '?' ':chars[Math.random()*chars.length|0]).join('');},onComplete:()=>{node.textContent=fin;}});};
   const tl=G.timeline({onComplete:()=>setTimeout(finish,450)});
   tl.set(qa('.sp-word span'),{opacity:0,yPercent:40,scale:1.35,filter:'blur(18px)'})
     .set([q('.sp-sub'),q('.sp-by'),q('.sp-caret')],{opacity:0}).set(qa('.sp-name span'),{opacity:0}).set(qa('.sp-boot span'),{opacity:0})
     .fromTo(q('.sp-grid'),{opacity:0,yPercent:20},{opacity:.5,yPercent:0,duration:1.4,ease:'expo.out'},0)
     .to(q('.sp-scan'),{scaleX:1,duration:.55,ease:'expo.out'},.05).to(q('.sp-scan'),{scaleY:30,opacity:0,duration:.5,ease:'power2.in'},.55)
     .to(draw,{strokeDashoffset:0,duration:1.1,stagger:.12,ease:'power3.inOut'},.3)
     .fromTo(q('.r2'),{opacity:0,scale:.9,transformOrigin:'50% 50%'},{opacity:1,scale:1,duration:.8,ease:'expo.out'},.45)
     .fromTo(q('.sp-ticks'),{opacity:0,rotation:-40,svgOrigin:'200 200'},{opacity:1,rotation:0,duration:1.2,ease:'expo.out'},.35)
     .to(q('.sp-core'),{scale:1,duration:.7,ease:'expo.out'},.5).to(q('.sp-core'),{scale:3.2,opacity:0,filter:'blur(14px)',duration:.7,ease:'power3.in'},1.0)
     .to(qa('.sp-word span'),{opacity:1,yPercent:0,scale:1,filter:'blur(0px)',duration:.9,stagger:.09,ease:'expo.out'},1.05)
     .to(q('.sp-sub'),{opacity:1,duration:.5},1.55).fromTo(q('.sp-sub'),{letterSpacing:'1.2em'},{letterSpacing:'.5em',duration:.8,ease:'expo.out'},1.55)
     .add(()=>{qa('.sp-boot span').forEach((s,i)=>{G.set(s,{opacity:1});G.delayedCall(i*.22,()=>scramble(s,.55));});},.6)
     .to(q('.sp-by'),{opacity:.7,duration:.4},1.9)
     .fromTo(qa('.sp-name span'),{opacity:0,filter:'blur(8px)',y:6},{opacity:1,filter:'blur(0px)',y:0,duration:.35,stagger:.045,ease:'power2.out'},2.0);
   spin.push(G.to(q('.r1'),{rotation:360,svgOrigin:'200 200',duration:24,ease:'none',repeat:-1}),G.to(q('.r2'),{rotation:-360,svgOrigin:'200 200',duration:40,ease:'none',repeat:-1}),
    G.to([q('.r3'),q('.r4')],{rotation:360,svgOrigin:'200 200',duration:6,ease:'none',repeat:-1}),G.to(q('.sp-ticks'),{rotation:'+=360',svgOrigin:'200 200',duration:60,ease:'none',repeat:-1,delay:1.5}));
  });
 }
 function legacySplash(el){
  return new Promise(done=>{const G=g(),finish=()=>{if(!el.isConnected)return done();G.to(el,{opacity:0,duration:.45,ease:'power2.inOut',onComplete:()=>{el.remove();done();}});};
   el.addEventListener('click',finish,{once:true});setTimeout(finish,3800);
   const tl=G.timeline({onComplete:()=>setTimeout(finish,250)});
   tl.from(el.querySelectorAll('.splash-dots i'),{scale:0,opacity:0,stagger:{each:.04,from:'random'},duration:.5,ease:'back.out(2)'})
     .from(el.querySelector('.splash-orb'),{scale:.2,opacity:0,duration:.8,ease:'expo.out'},'-=.3')
     .from(el.querySelectorAll('.splash-word span'),{yPercent:120,opacity:0,stagger:.07,duration:.6,ease:'power3.out'},'-=.5')
     .from(el.querySelector('.splash-credit'),{opacity:0,y:10,letterSpacing:'.5em',duration:.7,ease:'power3.out'},'-=.1');
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
  // v11: the hero (.page-heading) is animated by EvieOnyx and cards below the fold reveal while scrolling,
  // so the spring entrance only takes what is visible when the page opens.
  const vh=innerHeight;const items=[...main.querySelectorAll(':scope>*:not(script):not(.page-heading), .panel, .stat-card, .detail-card, .evm-card, .bank-card')].filter((n,i,a)=>a.indexOf(n)===i&&!n.closest('.page-heading')&&n.getBoundingClientRect().top<vh*.92).slice(0,24);
  if(window.EvieV8?.enter?.(items)){countUp(main);return;}
  G.fromTo(items,{y:18,opacity:0},{y:0,opacity:1,duration:.55,stagger:.035,ease:'power3.out',clearProps:'transform,opacity'});
  countUp(main);
 }
 function panelIn(el){if(!el||reduced()||!g())return;g().fromTo(el,{y:30,opacity:0,scale:.98},{y:0,opacity:1,scale:1,duration:.45,ease:'expo.out',clearProps:'transform'});}
 function pulse(){const o=document.querySelectorAll('.evie-orb-button');if(!o.length||reduced()||!g())return;g().fromTo(o,{boxShadow:'0 0 0 0 rgba(150,180,255,.6)'},{boxShadow:'0 0 0 18px rgba(150,180,255,0)',duration:.8,ease:'power2.out'});}
 function mic(v){document.documentElement.style.setProperty('--evie-level',Math.min(1,v||0).toFixed(3));}
 return Object.freeze({splash,gate,enterRoute,panelIn,pulse,mic,countUp,reduced});
})();
