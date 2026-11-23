'use strict';
/* EVIE · Onyx shell (v11). App.render() calls EvieOnyx.afterRender() last.
   - No top bar: one floating menu button (+ search/bell on inner pages). Utilities live in the sidebar.
   - Section heroes: every .page-heading gets an animated scene (EvieScenes), its accent colour and a plain-language tip.
   - Motion (GSAP): hero titles rise word by word, eyebrows decode, numbers count up, cards reveal while scrolling,
     primary buttons are magnetic on desktop. Everything is skipped with reduced motion.
   - <html data-ox-route> lets CSS lay out special pages (Chat is a fixed page).
   - First-run tour (3 steps on Inicio) and an «Instalar app» entry when the browser offers it. */
window.EvieOnyx=(()=>{
 const G=()=>window.gsap;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.paused==='true';
 const fine=()=>matchMedia('(hover: hover) and (pointer: fine)').matches;
 const ic=n=>window.Views?Views.icon(n):'';
 const store=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch{return null;}};
 /* Scene, accent and a concrete first step for each section (what a first-time user should do here). */
 const SECTIONS={
  chat:['constellation','138,164,255','Pregúntale lo que sea a Ivi. También puedes adjuntar fotos o pedirle que anote un gasto por ti.'],
  agenda:['orbits','125,170,255','Toca un día para ver lo que tienes. O dile a Ivi «recuérdame mañana a las 9 llamar a…».'],
  finanzas:['flow','74,222,128','Registra un gasto con <b>Nuevo movimiento</b>, o dile a Ivi «gasté 200 en comida».'],
  fisico:['pulse','248,113,113','Dile a Ivi «hoy entrené pecho y espalda» y tu cuerpo se colorea según tu recuperación.'],
  pendientes:['radar','251,191,36','Aquí se junta todo lo que vence o está atrasado. Toca uno para resolverlo.'],
  habitos:['dots','74,222,128','Crea un hábito y márcalo cada día: la racha crece sola.'],
  objetivos:['target','167,139,250','Crea un objetivo con fecha. Tu misión y la revisión del domingo también viven aquí.'],
  negocios:['network','125,211,252','Tus negocios en un vistazo: SOMA, ALVENTO y la Granja.'],
  soma:['radar','251,191,36','Agrega un prospecto con su siguiente paso; Ivi te recuerda cada seguimiento.'],
  dojo:['sparks','251,146,60','Elige un giro y practica tu presentación; al final Ivi te califica.'],
  aprendizaje:['crystal','103,232,249','Crea una ruta con pasos pequeños y marca tu avance.'],
  escuela:['crystal','103,232,249','Captura tus materias y tu horario; tareas y exámenes te avisan solos.'],
  bitacora:['','196,181,253',''],
  granja:['terrain','163,230,53','Registra animales, partos y alimento; usa el simulador antes de comprar.'],
  libros:['pages','253,186,116','Agrega el libro que estás leyendo y anota tu avance.'],
  alvento:['cloth','244,114,182','Planea tu próximo drop: tallas, cotizaciones y margen en un solo lugar.'],
  contenido:['wave','248,113,113','Organiza cada video desde la idea hasta publicado.'],
  vision:['stars','196,181,253','Sube imágenes de lo que quieres lograr y velas seguido.'],
  tendencias:['scatter','125,170,255','Patrones de tus registros: cuándo rindes más y en qué gastas.'],
  logros:['burst','250,204,21','Tus insignias se desbloquean solas cuando avanzas.'],
  compras:['dots','74,222,128','Haz tu lista del súper y marca lo que ya compraste.'],
  automatizaciones:['circuit','250,204,21','Guarda atajos a sitios web y tus prompts favoritos para copiarlos con un toque.'],
  subir:['circuit','125,170,255','Sube un archivo JSON exportado de otra app para importarlo.'],
  perfil:['stars','138,164,255',''],
  configuracion:['circuit','161,161,170',''],
  personalizada:['constellation','138,164,255','Dile a Ivi cómo llamarte, tu ciudad y tu estilo: con eso te responde mejor.'],
  mapa:['',  '125,170,255','']};
 const tipsOff=()=>{try{return new Set(JSON.parse(store('evie-ox-tips')||'[]'));}catch{return new Set();}};

 /* ---------------- shell plumbing ---------------- */
 function plumbing(){
  const dot=document.getElementById('notification-dot');document.querySelectorAll('[data-ox-dot]').forEach(d=>{d.hidden=!dot||dot.hidden;});
  const utils=document.querySelector('.ox-sb-utils'),pause=document.querySelector('.topbar .ivy-pause');if(utils&&pause){pause.setAttribute('title','Pausar o reanudar animaciones');utils.insertBefore(pause,document.getElementById('sync-status'));}
  const head=document.querySelector('.ox-sb-head');if(head&&!head.querySelector('.ox-sb-close'))head.insertAdjacentHTML('beforeend',`<button type="button" class="ox-sb-close" data-ox="close-drawer" aria-label="Cerrar menú">${ic('x')}</button>`);
  install();}
 function openDrawer(){document.body.classList.add('drawer-open');document.getElementById('menu-toggle')?.setAttribute('aria-expanded','true');const g=G(),side=document.getElementById('sidebar');
  if(g&&!reduced()&&side)g.fromTo(side.querySelectorAll('.nav-item'),{opacity:0,x:-14},{opacity:1,x:0,duration:.45,stagger:.018,ease:'expo.out',clearProps:'opacity,transform'});
  setTimeout(()=>(document.querySelector('#main-nav .nav-item.active')||document.querySelector('#main-nav .nav-item'))?.focus({preventScroll:false}),60);}
 function closeDrawer(){document.body.classList.remove('drawer-open');document.getElementById('menu-toggle')?.setAttribute('aria-expanded','false');}
 document.addEventListener('click',ev=>{const t=ev.target.closest('[data-ox],[data-ox-tip],[data-ox-close-drawer],#ox-install');if(!t)return;
  if(t.dataset.ox==='menu'){ev.preventDefault();openDrawer();}
  else if(t.dataset.ox==='close-drawer'){closeDrawer();document.getElementById('menu-toggle')?.focus();}
  else if(t.dataset.oxTip){const s=tipsOff();s.add(t.dataset.oxTip);store('evie-ox-tips',JSON.stringify([...s]));const p=t.closest('.ox-tip'),g=G();if(p&&g&&!reduced())g.to(p,{opacity:0,height:0,marginTop:0,paddingTop:0,paddingBottom:0,duration:.35,ease:'power2.in',onComplete:()=>p.remove()});else p?.remove();}
  else if(t.id==='ox-install')promptInstall();
  if(t.hasAttribute('data-ox-close-drawer'))closeDrawer();});

 /* ---------------- section hero ---------------- */
 function hero(route){const h=document.querySelector('#main-content :is(.page-heading,.agv-head)');if(!h)return null;const [scene,rgb,tip]=SECTIONS[route]||['constellation','138,164,255',''];
  h.style.setProperty('--ox-hero-rgb',rgb);h.dataset.oxSection=route;
  if(scene&&window.EvieScenes&&!h.querySelector('.ox-scene')){const box=document.createElement('div');box.className='ox-scene';box.setAttribute('aria-hidden','true');h.prepend(box);EvieScenes.mount(box,scene,rgb);}
  if(tip&&!tipsOff().has(route)&&!h.querySelector('.ox-tip')){const text=h.querySelector(':scope>div:not(.heading-actions):not(.ox-scene)');text?.insertAdjacentHTML('beforeend',`<p class="ox-tip">${ic('lightbulb')}<span>${tip}</span><button type="button" data-ox-tip="${route}" aria-label="Ocultar este consejo" title="Ocultar consejo">×</button></p>`);}
  return h;}
 function split(h1){if(h1.dataset.oxSplit||h1.children.length||!h1.textContent.trim())return false;const words=h1.textContent.trim().split(/\s+/);h1.dataset.oxSplit='1';h1.setAttribute('aria-label',h1.textContent.trim());
  h1.innerHTML=words.map(w=>`<span class="ox-wm" aria-hidden="true"><span class="ox-w">${w.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span></span>`).join(' ');return true;}
 /* Motion that changes what a text shows (decode, count-up) paints into a ::after overlay (data-ox-cv) while the real
    text stays in the DOM: screen readers, search and tests always read the true value. */
 function overlay(el){const cs=getComputedStyle(el);el.style.setProperty('--ox-cc',cs.color);el.classList.add('ox-counting');}
 function unoverlay(el){el.classList.remove('ox-counting');delete el.dataset.oxCv;el.style.removeProperty('--ox-cc');}
 function scramble(el){const g=G();if(!g)return;const fin=el.textContent,chars='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/·';const o={p:0};overlay(el);
  g.to(o,{p:1,duration:.7,ease:'none',onUpdate:()=>{const n=Math.floor(o.p*fin.length);el.dataset.oxCv=fin.slice(0,n)+[...fin.slice(n)].map(c=>c===' '?' ':chars[Math.random()*chars.length|0]).join('');},onComplete:()=>unoverlay(el)});}
 function enterHero(h){const g=G();if(!g||reduced()||!h)return;const h1=h.querySelector('h1');if(h1)split(h1);
  const tl=g.timeline({defaults:{ease:'expo.out'}}),words=h.querySelectorAll('.ox-w');
  if(words.length)tl.from(words,{yPercent:115,rotate:4,opacity:0,duration:1,stagger:.07},.05);else if(h1)tl.from(h1,{y:18,opacity:0,duration:.8},.05);
  tl.from(h.querySelectorAll(':scope>div>p,.ox-tip,.heading-actions>*'),{y:14,opacity:0,duration:.7,stagger:.05,clearProps:'transform,opacity'},.18);
  const sc=h.querySelector('.ox-scene');if(sc)tl.from(sc,{opacity:0,scale:1.06,duration:1.4,ease:'power2.out',clearProps:'transform,opacity'},0);
  const eb=h.querySelector('.eyebrow');if(eb&&!eb.children.length&&eb.textContent.length<48)scramble(eb);}

 /* ---------------- numbers that count up (only when a page opens, never on re-renders) ---------------- */
 function countUp(root){const g=G();if(!g||reduced()||!root)return;
  root.querySelectorAll('.stat-card strong,.bank-amount,.evm-big,.ivi-sys-val,[data-ox-count]').forEach(el=>{if(el.children.length||el.dataset.oxCounted)return;const txt=el.textContent,m=txt.match(/-?\d[\d,]*(\.\d+)?/);if(!m)return;
   const raw=m[0],dec=m[1]?m[1].length-1:0,to=parseFloat(raw.replace(/,/g,''));if(!Number.isFinite(to)||Math.abs(to)<2)return;el.dataset.oxCounted='1';
   const pre=txt.slice(0,m.index),post=txt.slice(m.index+raw.length),grouped=raw.includes(','),fmt=v=>pre+(grouped?v.toLocaleString('es-MX',{minimumFractionDigits:dec,maximumFractionDigits:dec}):v.toFixed(dec))+post,o={v:0};
   overlay(el);el.dataset.oxCv=fmt(0);g.to(o,{v:to,duration:1.1,ease:'power3.out',onUpdate:()=>{el.dataset.oxCv=fmt(o.v);},onComplete:()=>unoverlay(el)});});}

 /* ---------------- reveal on scroll ---------------- */
 let io=null;
 function reveal(){const g=G();if(!g||reduced())return;io?.disconnect();io=new IntersectionObserver(es=>{for(const en of es){if(!en.isIntersecting)continue;io.unobserve(en.target);g.to(en.target,{opacity:1,y:0,duration:.85,ease:'expo.out',clearProps:'opacity,transform'});}},{rootMargin:'0px 0px -6% 0px',threshold:.04});
  const vh=innerHeight;document.querySelectorAll('#main-content :is(.panel,.stat-card,.evm-card,.detail-card,.v8-card,.empty-state)').forEach(n=>{if(n.closest('.page-heading,dialog'))return;const r=n.getBoundingClientRect();if(r.top>vh*.92){g.set(n,{opacity:0,y:28});io.observe(n);}});}

 /* ---------------- magnetic primary buttons (desktop pointers) ---------------- */
 let mag=null;
 document.addEventListener('pointermove',ev=>{if(!fine()||reduced()||!G())return;const b=ev.target.closest?.('#main-content .button.primary,.ox-ivi-talk');if(b!==mag&&mag){G().to(mag,{x:0,y:0,duration:.6,ease:'elastic.out(1,.45)'});mag=null;}if(!b)return;mag=b;const r=b.getBoundingClientRect(),dx=(ev.clientX-r.left-r.width/2)/r.width,dy=(ev.clientY-r.top-r.height/2)/r.height;G().to(b,{x:dx*8,y:dy*6,duration:.35,ease:'power3.out'});},{passive:true});

 /* ---------------- install as an app ---------------- */
 let deferred=null;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||document.documentElement.dataset.desktop==='true';
 const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)&&!/crios|fxios/i.test(navigator.userAgent);
 addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();deferred=ev;install();});
 addEventListener('appinstalled',()=>{deferred=null;install();window.App?.toast?.('EVIE quedó instalada como app.','success');});
 function install(){const utils=document.querySelector('.ox-sb-utils');if(!utils)return;let b=document.getElementById('ox-install');const show=!standalone()&&(deferred||ios());
  if(!show){b?.remove();return;}if(!b){utils.insertAdjacentHTML('afterbegin',`<button type="button" id="ox-install" class="icon-button" aria-label="Instalar EVIE como app" title="Instalar como app">${ic('download')}</button>`);window.lucide?.createIcons?.({root:utils});}}
 async function promptInstall(){if(deferred){deferred.prompt();try{await deferred.userChoice;}catch{}deferred=null;install();return;}
  if(ios())window.App?.openDialog?.('Instalar EVIE en tu iPhone',`<p class="dialog-subtitle">En Safari toca <b>Compartir</b> (el cuadro con la flecha) y luego <b>Agregar a inicio</b>. EVIE se abrirá a pantalla completa como una app.</p><div class="form-footer"><button class="button primary" data-action="close-dialog">Entendido</button></div>`);}

 /* ---------------- first-run tour ---------------- */
 let touring=false;
 function tour(){if(touring||store('evie-ox-tour')||navigator.webdriver||UI.section!=='inicio'||UI.id||document.getElementById('evie-splash')||document.querySelector('dialog[open]'))return;const core=document.getElementById('hud-core');if(!core)return;touring=true;store('evie-ox-tour','1');
  const steps=[[()=>document.getElementById('hud-core'),'Este es Ivi','Toca el orbe y háblale: «Ivi, ¿qué tengo hoy?». Te responde con voz y te muestra tarjetas.'],
   [()=>document.getElementById('evie-stage-form'),'¿No puedes hablar? Escríbele','Escribe aquí lo que necesites: «anota un gasto de 150 en gasolina» o «abre finanzas».'],
   [()=>document.getElementById('menu-toggle'),'Todas tus secciones','Este botón abre el menú: Finanzas, Agenda, Chat, Escuela y todo lo demás.']];
  let k=0;const wrap=document.createElement('div');wrap.className='ox-tour';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-label','Recorrido rápido');const ring=document.createElement('div');ring.className='ox-tour-ring';
  const done=()=>{const g=G();const end=()=>{wrap.remove();ring.remove();touring=false;document.getElementById('evie-stage-input')?.focus?.({preventScroll:true});};if(g&&!reduced())g.to([wrap,ring],{opacity:0,duration:.3,onComplete:end});else end();};
  const show=()=>{const [get,title,text]=steps[k],el=get(),r=el?.getBoundingClientRect();if(r){const pad=10;Object.assign(ring.style,{left:r.left-pad+'px',top:r.top-pad+'px',width:r.width+pad*2+'px',height:r.height+pad*2+'px',borderRadius:k===1?'999px':k===0?'50%':'999px'});}
   wrap.innerHTML=`<div class="ox-tour-card"><p class="eyebrow">Paso ${k+1} de ${steps.length}</p><h2>${title}</h2><p>${text}</p><div class="ox-tour-steps">${steps.map((_,j)=>`<i class="${j<=k?'on':''}"></i>`).join('')}</div><div class="ox-tour-foot"><button type="button" class="button" data-tour="skip">Saltar</button><button type="button" class="button primary" data-tour="next">${k===steps.length-1?'Listo, empezar':'Siguiente'}</button></div></div>`;
   wrap.querySelector('[data-tour="next"]').focus({preventScroll:true});const g=G();if(g&&!reduced())g.from(wrap.querySelector('.ox-tour-card'),{y:24,opacity:0,duration:.5,ease:'expo.out'});};
  wrap.addEventListener('click',ev=>{const b=ev.target.closest('[data-tour]');if(!b)return;if(b.dataset.tour==='skip'||k===steps.length-1)return done();k++;show();});
  wrap.addEventListener('keydown',ev=>{if(ev.key==='Escape')done();});
  document.body.append(ring,wrap);show();}

 /* ---------------- one-time: friendlier phone bar for people still on the old default (Subir → Chat/Agenda) ---------------- */
 let navChecked=false;
 function migrateNav(){if(navChecked)return false;navChecked=true;const p=Store.get()?.preferences;if(!p||p.oxNav)return false;
  try{Store.save(s=>{s.preferences.oxNav=1;if((s.preferences.mobileShortcuts||[]).join(',')==='inicio,finanzas,subir,objetivos,bitacora')s.preferences.mobileShortcuts=['inicio','chat','finanzas','agenda','objetivos'];});return true;}catch{return false;}}

 /* ---------------- phone keyboard ----------------
    <html class="ox-kb"> only while the on-screen keyboard is really open (the visible height drops). Layout must never
    depend on :focus: tapping a button blurs the field and the layout would move under the finger, losing the tap. */
 let vhMax=0;
 function kb(){const vv=window.visualViewport,h=Math.min(innerHeight,vv?vv.height:innerHeight);vhMax=Math.max(vhMax,innerHeight,vv?vv.height:0);const a=document.activeElement,typing=!!a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable);document.documentElement.classList.toggle('ox-kb',typing&&vhMax-h>140&&innerWidth<1024);}
 window.visualViewport?.addEventListener('resize',kb,{passive:true});addEventListener('resize',kb,{passive:true});addEventListener('orientationchange',()=>{vhMax=0;setTimeout(kb,350);});document.addEventListener('focusout',()=>setTimeout(kb,250));

 /* ---------------- per render ---------------- */
 let lastRoute='';
 function afterRender(){if(!window.UI)return;if(migrateNav()){queueMicrotask(()=>window.App?.render?.());return;}const route=UI.section,full=route+(UI.id?'/'+UI.id:'');document.documentElement.dataset.oxRoute=route;plumbing();const h=hero(route);
  if(full!==lastRoute){lastRoute=full;mag=null;enterHero(h);countUp(document.getElementById('main-content'));reveal();if(route==='inicio')setTimeout(tour,1800);}}
 return Object.freeze({afterRender,countUp,openDrawer,closeDrawer,sections:()=>Object.keys(SECTIONS),tour:()=>{store('evie-ox-tour','');tour();}});
})();
