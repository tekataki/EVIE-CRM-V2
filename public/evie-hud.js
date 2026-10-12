'use strict';
/* EVIE HUD: the voice-first Home. Exactly one Neural Core (EvieNeural on #neural-canvas, via
   DaliCore.markup()), a personal greeting, and typed contextual cards from EvieCards.R.
   Lifecycle per card: loading -> ready | empty | error | blocked. Max 4 cards: the oldest leaves.
   GSAP timelines choreograph core/card motion; reduced-motion skips all tweens.
   Closing never touches data. Leaving Home disposes cards, timers and tweens. */
window.EvieHUD=(()=>{
 const e=s=>Domain.escape(String(s??'')),i=n=>Views.icon(n);
 const MAX=4,NEW_EACH_TIME=new Set(['research','learning','message','weather']);
 let cards=[],seq=0,intro=false,clockTimer=null,lastFocus=null;
 const R=()=>EvieCards.R;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.paused==='true';
 const gs=()=>window.gsap&&!reduced()?window.gsap:null;
 const cloud=()=>!!window.EvieAccounts?.current?.()&&!!EvieAccounts.config?.()?.accountsEnabled;
 const onHome=()=>UI.section==='inicio'&&!UI.id&&!!document.getElementById('hud-cards');
 function name(){const p=window.EvieProfile?.current?.();if(p&&p.enabled!==false&&p.preferred_name)return p.preferred_name;const s=Store.get()?.profile||{};return (s.preferred||s.name||'').trim();}
 function greeting(){const s=Store.get()?.profile||{},p=window.EvieProfile?.current?.();const form=['Bienvenido','Bienvenida','Bienvenide','Hola'].includes(s.greeting_form)?s.greeting_form:'Bienvenido';const n=name(),addr=(p&&p.enabled!==false&&p.address_as)||'';return e(form+(n?', '+n:''))+(addr&&addr.toLowerCase()!==n.toLowerCase()?`<small class="hud-address">${e(addr)}</small>`:'');}
 function cardHTML(c){const d=R()[c.type],t=c.title||d.title;return `<article class="hud-card" id="${c.id}" data-type="${e(c.type)}" data-state="${c.state}" role="region" aria-labelledby="${c.id}-t" tabindex="-1"><header><span class="hud-card-icon">${i(d.icon)}</span><h3 id="${c.id}-t">${e(t)}</h3>${d.route?`<button type="button" class="icon-button" data-hud-expand="${c.id}" aria-label="Abrir ${e(t)} completo" title="Abrir módulo completo">${i('maximize-2')}</button>`:''}<button type="button" class="icon-button" data-hud-close="${c.id}" aria-label="Cerrar tarjeta ${e(t)}" title="Cerrar (no borra datos)">${i('x')}</button></header><div class="hud-card-body" aria-live="polite" aria-busy="${c.state==='loading'}">${body(c)}</div>${c.state==='ready'&&d.primary?`<footer><button type="button" class="button primary" data-hud-primary="${c.id}">${e(d.primary(c.data).label)}</button></footer>`:''}</article>`;}
 function body(c){const d=R()[c.type];
  if(c.state==='loading')return '<div class="hud-skeleton" role="status" aria-label="Cargando"><i></i><i></i><i></i></div>';
  if(c.state==='error')return `<p class="hud-error">${i('triangle-alert')} ${e(c.error)}</p><button type="button" class="button" data-hud-retry="${c.id}">Reintentar</button>`;
  if(c.state==='blocked')return `<p class="hud-note">${i('lock')} ${e(c.error)}</p>`;
  if(c.state==='empty'){const t=typeof d.emptyText==='function'?d.emptyText(c.data):d.emptyText;return `<p class="hud-empty">${e(t||'Sin datos todavía.')}</p>`;}
  try{return d.render(c.data,c);}catch(err){return `<p class="hud-error">No se pudo mostrar: ${e(err.message)}</p>`;}}
 function paint(c){const n=document.getElementById(c.id);if(!n)return;n._dispose?.();n.outerHTML=cardHTML(c);const m=document.getElementById(c.id);window.lucide?.createIcons({root:m});R()[c.type].mounted?.(m,c);const g=gs();if(g&&c.state!=='loading')g.fromTo(m.querySelector('.hud-card-body'),{opacity:0,y:6},{opacity:1,y:0,duration:.28,ease:'power2.out'});}
 async function load(c){const d=R()[c.type],need=d.needs?.();if(need){c.state='blocked';c.error=need;paint(c);return;}c.state='loading';paint(c);
  try{const data=await d.load(c.args||{});if(!cards.includes(c))return;c.data=data;c.state=d.empty?.(data)?'empty':'ready';window.EvieSounds?.play('card');}
  catch(err){if(!cards.includes(c))return;c.state='error';c.error=err.status===401?'Tu sesión cambió. Vuelve a entrar.':err.status===429?err.message:(err.message||'No se pudo cargar.');window.EvieSounds?.play('error');}
  paint(c);announce();}
 function layout(){const g=gs(),n=cards.length;document.body.dataset.hudCards=String(n);if(g)g.to('#hud-core',{scale:n?(n>1?.78:.88):1,y:n&&innerWidth<900?-12:0,duration:.55,ease:'power3.out',overwrite:'auto'});}
 function open(type,args={},{focus=false}={}){
  if(!R()[type])return {ok:false,error:'Tarjeta desconocida.'};
  if(!onHome()){sessionStorage.setItem('evie-hud-pending',JSON.stringify({type,args:args.data?{...args,data:undefined,query:args.query}:args}));if(args.data)sessionStorage.setItem('evie-hud-data',JSON.stringify(args.data));location.hash='inicio';return {ok:true,card:type,opened_on_home:true};}
  const same=NEW_EACH_TIME.has(type)?null:cards.find(c=>c.type===type);
  if(same){document.getElementById(same.id)?.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});pulse(same);load(same);return {ok:true,card:type,already_open:true};}
  while(cards.length>=MAX)close(cards[0].id,{silent:true});
  const c={id:'hud-c'+(++seq),type,args,state:'loading',title:args.title||null};cards.push(c);
  document.getElementById('hud-cards').insertAdjacentHTML('beforeend',cardHTML(c));const n=document.getElementById(c.id);window.lucide?.createIcons({root:n});
  const g=gs();if(g)g.fromTo(n,{opacity:0,y:30,scale:.94,filter:'blur(10px)'},{opacity:1,y:0,scale:1,filter:'blur(0px)',duration:.6,ease:'power3.out',clearProps:'filter'});
  layout();if(focus){lastFocus=document.activeElement;n.focus({preventScroll:true});}
  load(c);return {ok:true,card:type};}
 function pulse(c){const n=document.getElementById(c.id),g=gs();if(n&&g)g.fromTo(n,{outlineColor:'rgba(150,175,255,.0)'},{outlineColor:'rgba(150,175,255,.7)',duration:.25,yoyo:true,repeat:1});}
 function resolve(ref){if(!cards.length)return null;if(ref==null||ref===''||ref==='active')return cards.at(-1);const r=IvyTools.norm(String(ref));return [...cards].reverse().find(c=>c.id===ref||c.type===r||IvyTools.norm(R()[c.type].title).includes(r)||IvyTools.norm(c.title||'').includes(r))||null;}
 function close(ref,{silent=false}={}){
  if(ref==='all'){const n=cards.length;[...cards].forEach(c=>close(c.id,{silent:true}));if(n&&!silent)window.EvieSounds?.play('close');return {ok:n>0,closed:n};}
  const c=resolve(ref);if(!c)return {ok:false,error:'No hay una tarjeta abierta con ese nombre.'};
  cards=cards.filter(x=>x!==c);const n=document.getElementById(c.id);n?._dispose?.();
  const done=()=>{n?.remove();if(!cards.length){const t=lastFocus&&document.contains(lastFocus)?lastFocus:document.getElementById('dali-core-control');t?.focus?.({preventScroll:true});}};
  const g=gs();if(n&&g)g.to(n,{opacity:0,y:20,scale:.94,filter:'blur(8px)',duration:.32,ease:'power2.in',onComplete:done});else done();
  layout();if(!silent)window.EvieSounds?.play('close');announce();return {ok:true,closed:c.type};}
 function expand(id){const c=cards.find(x=>x.id===id),d=c&&R()[c.type];if(!d?.route)return;const n=document.getElementById(id),g=gs();const go=()=>{location.hash=d.route;};
  if(n&&g)g.timeline({onComplete:go}).to(n,{scale:1.05,opacity:0,duration:.28,ease:'power2.in'}).to('#hud-core',{opacity:0,scale:.6,duration:.3,ease:'power2.in'},0);else go();}
 function announce(){const s=document.getElementById('hud-open-list');if(s)s.textContent=cards.length?'Tarjetas abiertas: '+cards.map(c=>c.title||R()[c.type].title).join(', '):'Sin tarjetas abiertas';}
 function tick(){const f=EvieCards.fmt,now=new Date();document.querySelectorAll('[data-hud-clock]').forEach(n=>n.textContent=f(now,{hour:'numeric',minute:'2-digit',hour12:true}));const g=document.getElementById('hud-time');if(g)g.textContent=f(now,{weekday:'long',day:'numeric',month:'long'})+' · '+f(now,{hour:'numeric',minute:'2-digit',hour12:true});}
 function home(){const p=EvieAssistant.pref();
  return `<section class="hud" id="evie-hud" aria-label="Inicio · EVIE">
  <div class="hud-top"><p class="hud-time" id="hud-time"></p><div class="hud-status"><span class="hud-privacy" title="Tus datos se guardan en tu cuenta. El audio solo sale de tu dispositivo cuando le hablas a EVIE.">${i(cloud()?'shield-check':'hard-drive')}<span>${cloud()?'Datos privados de tu cuenta':'Datos solo en este navegador'}</span></span><button type="button" class="hud-mic-state" data-hud-wake data-wake-state title="Palabra clave y micrófono">${e(p.wakeWord?(window.EvieWake?.label()||''):'Micrófono solo al tocar')}</button></div></div>
  <div class="hud-stage"><div class="hud-core" id="hud-core">${DaliCore.markup()}</div>
   <h1 class="hud-greeting" id="hud-greeting">${greeting()}</h1>
   <p class="hud-phase" data-evie-phase aria-live="polite">Lista</p>
   <div class="hud-cards" id="hud-cards" aria-label="Tarjetas de EVIE"></div></div>
  <div class="hud-dock"><div class="evie-subs" id="evie-subs" aria-live="polite"></div><div class="evie-draft" id="evie-stage-draft" hidden></div>
   <form class="evie-composer hud-composer" id="evie-stage-form"><label class="sr-only" for="evie-stage-input">Escríbele a EVIE</label><input id="evie-stage-input" autocomplete="off" enterkeyhint="send" maxlength="600" placeholder="Habla o escribe: «Ivi, abre finanzas»"><button type="button" class="icon-button evie-mic" data-evie="listen" aria-label="Hablar con EVIE">${i('mic')}</button><button class="icon-button evie-send" aria-label="Enviar">${i('arrow-up')}</button></form>
   <div class="evie-stage-links"><button type="button" data-evie="open">Conversación completa</button><button type="button" data-hud-open="capabilities">¿Qué puedo hacer?</button><button type="button" data-hud-open="pendientes">Pendientes</button><button type="button" data-evie="stop">Detener</button></div>
   <p class="sr-only" id="hud-open-list" aria-live="polite"></p></div></section>`;}
 function dispose(){cards.forEach(c=>document.getElementById(c.id)?._dispose?.());cards=[];document.body.dataset.hudCards='0';clearInterval(clockTimer);clockTimer=null;window.gsap?.killTweensOf?.('#hud-core');}
 function afterRender(){const home=UI.section==='inicio'&&!UI.id;document.body.classList.toggle('hud-home',home&&!!document.getElementById('evie-hud'));
  if(!home||!document.getElementById('evie-hud')){if(cards.length||clockTimer)dispose();return;}
  cards=[];document.body.dataset.hudCards='0';
  const st=document.getElementById('evie-stage-form');if(st&&!st.dataset.bound){st.dataset.bound='1';st.onsubmit=ev=>{ev.preventDefault();const inp=st.querySelector('input'),v=inp.value;inp.value='';if(v.trim())EvieAssistant.ask(v,{speak:!EvieAssistant.pref().muted&&EvieAssistant.pref().conversation,inline:true});};}
  EvieAssistant.syncInline?.();tick();clearInterval(clockTimer);clockTimer=setInterval(tick,15000);
  const g=gs();if(g&&!intro){intro=true;g.timeline().fromTo('#hud-core',{opacity:0,scale:.84},{opacity:1,scale:1,duration:1.1,ease:'expo.out'}).from('.hud-greeting',{opacity:0,y:12,duration:.7,ease:'power2.out'},.3).from('.hud-dock',{opacity:0,y:18,duration:.6,ease:'power2.out'},.45);}
  else if(g)g.fromTo('#hud-core',{opacity:0,scale:.92},{opacity:1,scale:1,duration:.5,ease:'power2.out'});
  const p=sessionStorage.getItem('evie-hud-pending');if(p){sessionStorage.removeItem('evie-hud-pending');const raw=sessionStorage.getItem('evie-hud-data');sessionStorage.removeItem('evie-hud-data');try{const x=JSON.parse(p);if(raw)x.args.data=JSON.parse(raw);setTimeout(()=>open(x.type,x.args||{}),150);}catch{}}
  announce();}
 document.addEventListener('click',ev=>{const t=ev.target.closest('[data-hud-open],[data-hud-close],[data-hud-expand],[data-hud-primary],[data-hud-retry],[data-hud-learn],[data-hud-wake]');if(!t)return;
  if(t.dataset.hudOpen!==undefined){window.EvieSounds?.unlock();open(t.dataset.hudOpen,{},{focus:true});}
  else if(t.dataset.hudClose)close(t.dataset.hudClose);
  else if(t.dataset.hudExpand)expand(t.dataset.hudExpand);
  else if(t.dataset.hudRetry){const c=cards.find(x=>x.id===t.dataset.hudRetry);if(c)load(c);}
  else if(t.dataset.hudPrimary){const c=cards.find(x=>x.id===t.dataset.hudPrimary);if(c)R()[c.type].primary(c.data).act();}
  else if(t.dataset.hudLearn){const card=cards.find(x=>x.id===t.closest('.hud-card')?.id);if(!card)return;if(t.dataset.hudLearn==='discard'){close(card.id);window.EvieAssistant?.say?.('Descartado. No guardé nada.');return;}t.disabled=true;try{const r=EvieCards.saveLearning(card.data);close(card.id,{silent:true});window.EvieSounds?.play('success');App.toast(r.message,'success');}catch(err){t.disabled=false;App.toast(err.message,'error');}}
  else if(t.dataset.hudWake!==undefined)location.hash='configuracion';});
 document.addEventListener('keydown',ev=>{if(ev.key!=='Escape'||!onHome()||!cards.length||document.querySelector('dialog[open]'))return;const panel=document.getElementById('evie-panel');if(panel&&!panel.hidden)return;close(ev.target.closest?.('.hud-card')?.id||null);});
 return Object.freeze({home,afterRender,open,close,expand,dispose,cards:()=>cards.map(c=>({id:c.id,type:c.type,state:c.state})),get REGISTRY(){return EvieCards.R;},capabilities:()=>EvieCards.capabilities(),findSkill:t=>EvieCards.findSkill(t),greeting});
})();
