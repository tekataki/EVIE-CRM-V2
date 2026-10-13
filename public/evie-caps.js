'use strict';
/* "¿Qué puedes hacer?" as a radial constellation around the Neural Core (desktop ≥1024×600) and a
   grouped sheet on narrow screens. Uses the REAL capability registry (EvieCards.capabilities())
   and the user's hidden-section settings. Selecting an item opens its real card/module.
   Independent from the card workspace: showing/hiding capabilities never closes cards.
   Two balanced rings; more items than fit → pages with a visible count. Labels never rotate.
   Esc / "Cerrar" / "cierra lo que puedes hacer" dismiss it. */
window.EvieCaps=(()=>{
 const e=s=>Domain.escape(String(s??'')),i=n=>Views.icon(n);
 const STATE={ready:'Disponible',config:'Requiere configuración',future:'Próximamente',desktop:'Solo EVIE para Windows'};
 let open=false,page=0,tl=null,lastFocus=null;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';
 const radial=()=>innerWidth>=1024&&innerHeight>=600;
 const ROUTE={kisha:'bitacora'};
 function items(){let hidden=new Set();try{hidden=new Set(window.Personalization?.normalize?.(Store.get()?.preferences||{})?.hidden||[]);}catch{}
  return EvieCards.capabilities().flatMap(g=>g.items.map(x=>({...x,group:g.group}))).filter(x=>!x.card||!hidden.has(ROUTE[x.card]||x.card));}
 const perPage=()=>innerHeight<760?14:18;
 function pages(){const all=items(),n=perPage(),out=[];for(let k=0;k<all.length;k+=n)out.push(all.slice(k,k+n));return out.length?out:[[]];}
 function btn(x,style=''){const can=x.card&&x.state==='ready';return `<button type="button" role="menuitem" class="cap-node cap-${x.state}" ${can?`data-cap-open="${e(x.card)}"`:'aria-disabled="true"'} ${style?`style="${style}"`:''} title="${e(x.label)} · ${STATE[x.state]}"><span class="cap-ico">${i(x.icon)}</span><span class="cap-label">${e(x.label)}</span>${x.state!=='ready'?`<small>${STATE[x.state]}</small>`:''}</button>`;}
 function ringHTML(){const ps=pages();page=Math.max(0,Math.min(page,ps.length-1));const list=ps[page],n=list.length;
  const inner=n>9?Math.ceil(n*.42):n,outer=n-inner;
  const at=(k,count,r,off)=>{const a=(-90+off+k*360/count)*Math.PI/180;return `--x:${(Math.cos(a)*r).toFixed(2)};--y:${(Math.sin(a)*r).toFixed(2)}`;};
  const html=list.map((x,k)=>k<inner?btn(x,at(k,inner,outer?.6:.86,outer?360/inner/2:0)):btn(x,at(k-inner,outer,1,0))).join('');
  const total=items().length;
  return `<div class="caps-ring" role="menu" aria-label="Lo que puedo hacer · ${total} opciones">${html}</div>
   <div class="caps-ctl"><p class="caps-count">${total} cosas que puedo hacer · elige una</p>${ps.length>1?`<div class="caps-pager"><button type="button" class="icon-button" data-cap-page="-1" aria-label="Página anterior" ${page===0?'disabled':''}>${i('chevron-left')}</button><span>${page+1} / ${ps.length}</span><button type="button" class="icon-button" data-cap-page="1" aria-label="Página siguiente" ${page===ps.length-1?'disabled':''}>${i('chevron-right')}</button></div>`:''}<button type="button" class="button caps-close" data-cap-close>${i('x')} Cerrar</button></div>`;}
 function sheetHTML(){const vis=new Set(items().map(x=>x.label));
  return `<div class="caps-sheet" role="region" aria-labelledby="caps-sheet-t"><header><h2 id="caps-sheet-t">Lo que puedo hacer</h2><button type="button" class="icon-button" data-cap-close aria-label="Cerrar lo que puedo hacer">${i('x')}</button></header>${EvieCards.capabilities().map(g=>{const xs=g.items.filter(x=>vis.has(x.label));return xs.length?`<section><h3>${e(g.group)}</h3><div class="caps-grid" role="menu">${xs.map(x=>btn(x)).join('')}</div></section>`:'';}).join('')}</div>`;}
 function hostRadial(){return document.getElementById('hud-caps-ring');}
 function hostSheet(){let h=document.getElementById('hud-caps-sheet');if(!h){const stage=document.querySelector('#evie-hud .hud-stage');if(!stage)return null;stage.insertAdjacentHTML('afterend','<div id="hud-caps-sheet" class="hud-caps-sheet" hidden></div>');h=document.getElementById('hud-caps-sheet');}return h;}
 function current(){return radial()?hostRadial():hostSheet();}
 function show(){if(!document.getElementById('evie-hud'))return false;if(open)hide({restore:false,instant:true});const h=current();if(!h)return false;lastFocus=document.activeElement;open=true;
  document.body.classList.add('caps-open');document.body.dataset.caps=radial()?'radial':'sheet';h.innerHTML=radial()?ringHTML():sheetHTML();h.hidden=false;window.lucide?.createIcons({root:h});
  animateIn(h);window.EvieSounds?.play('card');
  if(!radial())h.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});
  h.querySelector('[data-cap-open]')?.focus({preventScroll:true});
  const st=document.getElementById('hud-open-list');if(st)st.textContent='Mostrando '+items().length+' cosas que puedo hacer. Usa las flechas para moverte.';return true;}
 function animateIn(h){if(reduced()||!window.gsap)return;tl?.kill();const nodes=h.querySelectorAll('.cap-node');tl=gsap.timeline();
  if(radial())tl.fromTo(nodes,{'--k':0,opacity:0,scale:.55},{'--k':1,opacity:1,scale:1,duration:.7,ease:'back.out(1.5)',stagger:{each:.03}}).from(h.querySelector('.caps-ctl'),{opacity:0,y:8,duration:.3},.25);
  else tl.from(h.querySelector('.caps-sheet'),{y:24,opacity:0,duration:.35,ease:'power3.out'}).from(nodes,{opacity:0,y:8,duration:.25,stagger:.015},.1);}
 function hide({restore=true,instant=false}={}){if(!open)return;open=false;const hs=[hostRadial(),document.getElementById('hud-caps-sheet')].filter(Boolean);
  const done=()=>{document.body.classList.remove('caps-open');delete document.body.dataset.caps;hs.forEach(h=>{h.hidden=true;h.innerHTML='';});if(restore&&lastFocus?.isConnected)lastFocus.focus({preventScroll:true});};
  tl?.kill();if(instant||reduced()||!window.gsap){done();return;}const nodes=document.querySelectorAll('.hud-caps-ring .cap-node,.hud-caps-sheet .cap-node');
  tl=gsap.timeline({onComplete:done}).to(nodes,{'--k':0,opacity:0,scale:.6,duration:.28,ease:'power2.in',stagger:{each:.01,from:'end'}});}
 function detach(){tl?.kill();open=false;document.body.classList.remove('caps-open');delete document.body.dataset.caps;}
 function afterRender(){if(open){open=false;show();}}
 document.addEventListener('click',ev=>{const t=ev.target.closest('[data-cap-open],[data-cap-close],[data-cap-page]');if(!t)return;
  if(t.dataset.capClose!==undefined){hide();window.EvieSounds?.play('close');}
  else if(t.dataset.capPage){page+=Number(t.dataset.capPage);const h=hostRadial();if(h){h.innerHTML=ringHTML();window.lucide?.createIcons({root:h});animateIn(h);h.querySelector('.cap-node')?.focus();}}
  else if(t.dataset.capOpen){const k=t.dataset.capOpen;hide({restore:false});EvieHUD.open(k,{},{focus:true});}});
 document.addEventListener('keydown',ev=>{if(!open||!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(ev.key))return;const nodes=[...document.querySelectorAll('.hud-caps-ring:not([hidden]) .cap-node,.hud-caps-sheet:not([hidden]) .cap-node')];const k=nodes.indexOf(document.activeElement);if(k<0)return;ev.preventDefault();
  const n=ev.key==='Home'?0:ev.key==='End'?nodes.length-1:(k+(['ArrowRight','ArrowDown'].includes(ev.key)?1:-1)+nodes.length)%nodes.length;nodes[n].focus();});
 let rz=null;addEventListener('resize',()=>{if(!open)return;clearTimeout(rz);rz=setTimeout(()=>{if((document.body.dataset.caps==='radial')!==radial()){hide({restore:false,instant:true});show();}},150);});
 return Object.freeze({show,hide,detach,afterRender,radial:()=>true,isRadial:radial,visible:()=>open,items:()=>items().map(x=>({card:x.card||null,label:x.label,state:x.state}))});
})();
