'use strict';
/* EVIE HUD: the voice-first Home. Exactly one Neural Core (EvieNeural on #neural-canvas, via
   DaliCore.markup()), a personal greeting, and typed contextual cards from EvieCards.R.

   v3.1 WORKSPACE MODEL (fixes "cards disappear while EVIE speaks"):
   - Root cause: account-ui refreshSession() (every 60 s, and on window focus/online) and any other
     App.render() rebuilt #main-content; afterRender() then reset cards=[]. Speech overlapped those
     renders, so cards seemed to vanish "when EVIE started talking".
   - Now the card MODEL lives in `ws` (per account owner), separate from DOM and from voice state.
     Rerenders only rehydrate the DOM from the model (no reload, no paid request, no sound).
   - Cards stay until the user closes them. There is no eviction: when more than VISIBLE cards are
     open, the extras live in an accessible overflow tray (still open, one click to bring forward).
   - Every load carries a generation token; a closed card or an account switch invalidates it, so a
     late response can never resurrect a card or leak into another account.
   - Leaving Home keeps the workspace (in memory + sessionStorage per owner, without private payloads
     of other accounts). Sign-out / account switch calls reset(), which wipes it.
   Lifecycle per card: loading -> ready | empty | error | blocked. Closing never touches data. */
window.EvieHUD=(()=>{
 const e=s=>Domain.escape(String(s??'')),i=n=>Views.icon(n);
 const NEW_EACH_TIME=new Set(['research','learning','message','weather','shortcut']);
 const PERSIST_LIMIT=24;
 let ws={owner:null,cards:[],active:null,seq:0,caps:false},intro=false,clockTimer=null,lastFocus=null,ro=null,layoutRaf=null;
 const R=()=>EvieCards.R;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.paused==='true';
 const gs=()=>window.gsap&&!reduced()?window.gsap:null;
 const cloud=()=>!!window.EvieAccounts?.current?.()&&!!EvieAccounts.config?.()?.accountsEnabled;
 const ownerId=()=>window.EvieAccounts?.current?.()?.id||'local';
 const onHome=()=>UI.section==='inicio'&&!UI.id&&!!document.getElementById('hud-cards');
 const visibleMax=()=>innerWidth>=1280?4:innerWidth>=768?4:3;
 const key=o=>'evie-hud-ws:'+o;
 /* ---------- workspace (per account) ---------- */
 function ensureOwner(){const o=ownerId();if(ws.owner===o)return;ws.cards.forEach(c=>{c.gen++;});ws={owner:o,cards:[],active:null,seq:0,caps:false};restore();}
 function persist(){try{const keep=ws.cards.filter(c=>c.state!=='loading'||c.args).slice(-PERSIST_LIMIT).map(c=>({id:c.id,type:c.type,args:c.args&&!c.args.data?c.args:{...c.args,data:undefined},title:c.title,data:R()[c.type]?.keepData?c.data:undefined,state:R()[c.type]?.keepData?c.state:undefined}));sessionStorage.setItem(key(ws.owner),JSON.stringify({seq:ws.seq,active:ws.active,cards:keep}));}catch{}}
 function restore(){try{const raw=sessionStorage.getItem(key(ws.owner));if(!raw)return;const x=JSON.parse(raw);ws.seq=Number(x.seq)||0;ws.active=x.active||null;ws.cards=(x.cards||[]).filter(c=>R()[c.type]).map(c=>({...c,args:c.args||{},gen:0,state:c.state||'stale',data:c.data}));}catch{}}
 function clearOwnerStorage(o){try{sessionStorage.removeItem(key(o));}catch{}}
 /* ---------- rendering ---------- */
 function greetingName(){const p=window.EvieProfile?.current?.();if(p&&p.enabled!==false&&p.preferred_name)return p.preferred_name;const s=Store.get()?.profile||{};return (s.preferred||s.name||'').trim();}
 function greeting(){const s=Store.get()?.profile||{},p=window.EvieProfile?.current?.();const form=['Bienvenido','Bienvenida','Bienvenide','Hola'].includes(s.greeting_form)?s.greeting_form:'Bienvenido';const n=greetingName(),addr=(p&&p.enabled!==false&&p.address_as)||'';return e(form+(n?', '+n:''))+(addr&&addr.toLowerCase()!==n.toLowerCase()?`<small class="hud-address">${e(addr)}</small>`:'');}
 function title(c){return c.title||R()[c.type]?.title||'Tarjeta';}
 function cardHTML(c){const d=R()[c.type],t=title(c);return `<article class="hud-card" id="${c.id}" data-type="${e(c.type)}" data-state="${c.state}" role="region" aria-labelledby="${c.id}-t" tabindex="-1"><div class="hud-card-in"><header><span class="hud-card-icon">${i(d.icon)}</span><h3 id="${c.id}-t">${e(t)}</h3>${d.route?`<button type="button" class="icon-button" data-hud-expand="${c.id}" aria-label="Abrir ${e(t)} completo" title="Abrir módulo completo">${i('maximize-2')}</button>`:''}<button type="button" class="icon-button" data-hud-close="${c.id}" aria-label="Cerrar tarjeta ${e(t)}" title="Cerrar tarjeta (no borra datos)">${i('x')}</button></header><div class="hud-card-body" aria-live="polite" aria-busy="${c.state==='loading'}">${body(c)}</div>${c.state==='ready'&&d.primary?`<footer><button type="button" class="button primary" data-hud-primary="${c.id}">${e(d.primary(c.data).label)}</button></footer>`:''}</div></article>`;}
 function body(c){const d=R()[c.type];
  if(c.state==='loading'||c.state==='stale')return '<div class="hud-skeleton" role="status" aria-label="Cargando"><i></i><i></i><i></i></div>';
  if(c.state==='error')return `<p class="hud-error">${i('triangle-alert')} ${e(c.error)}</p><button type="button" class="button" data-hud-retry="${c.id}">Reintentar</button>`;
  if(c.state==='blocked')return `<p class="hud-note">${i('lock')} ${e(c.error)}</p>`;
  if(c.state==='empty'){const t=typeof d.emptyText==='function'?d.emptyText(c.data):d.emptyText;return `<p class="hud-empty">${e(t||'Sin datos todavía.')}</p>`;}
  try{return d.render(c.data,c);}catch(err){return `<p class="hud-error">No se pudo mostrar: ${e(err.message)}</p>`;}}
 function host(){return document.getElementById('hud-cards');}
 function visibleCards(){const max=visibleMax(),list=ws.cards;if(list.length<=max)return list;const act=list.find(c=>c.id===ws.active);const tail=list.slice(-max);if(act&&!tail.includes(act))return [...list.slice(-(max-1)),act].sort((a,b)=>list.indexOf(a)-list.indexOf(b));return tail;}
 /* Reconcile DOM with the model: keep existing nodes (scroll/focus preserved), add missing, remove stale. */
 function reconcile({animateNew=null}={}){const h=host();if(!h)return;const vis=visibleCards(),ids=new Set(vis.map(c=>c.id));
  for(const n of [...h.querySelectorAll(':scope>.hud-card')])if(!ids.has(n.id)&&!n.dataset.leaving){n._dispose?.();n.remove();}
  let prev=null;for(const c of vis){let n=document.getElementById(c.id);if(!n){const tmp=document.createElement('div');tmp.innerHTML=cardHTML(c);n=tmp.firstElementChild;if(prev)prev.after(n);else h.prepend(n);window.lucide?.createIcons({root:n});R()[c.type].mounted?.(n,c);if(animateNew===c.id)enter(n);}else if(prev&&prev.nextElementSibling!==n)prev.after(n);else if(!prev&&h.firstElementChild!==n)h.prepend(n);prev=n;n.classList.toggle('is-active',c.id===ws.active);}
  tray();layout();announce();}
 function paint(c){const n=document.getElementById(c.id);if(!n)return;const sc=n.querySelector('.hud-card-body')?.scrollTop||n.scrollTop,focusSel=document.activeElement&&n.contains(document.activeElement)?document.activeElement.dataset&&Object.keys(document.activeElement.dataset)[0]:null;n._dispose?.();n.outerHTML=cardHTML(c);const m=document.getElementById(c.id);m.classList.toggle('is-active',c.id===ws.active);window.lucide?.createIcons({root:m});R()[c.type].mounted?.(m,c);m.scrollTop=sc;if(focusSel){const f=m.querySelector(`[data-${focusSel.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())}]`);f?.focus?.({preventScroll:true});}const g=gs();if(g&&c.state!=='loading')g.fromTo(m.querySelector('.hud-card-body'),{opacity:0,y:6},{opacity:1,y:0,duration:.28,ease:'power2.out'});layout();}
 function tray(){const t=document.getElementById('hud-tray');if(!t)return;const vis=new Set(visibleCards().map(c=>c.id)),hidden=ws.cards.filter(c=>!vis.has(c.id));t.hidden=!hidden.length;t.innerHTML=hidden.length?`<p class="hud-tray-label">${hidden.length} tarjeta${hidden.length>1?'s':''} más abierta${hidden.length>1?'s':''} · ${ws.cards.length} en total</p><ul>${hidden.map(c=>`<li><button type="button" class="hud-chip" data-hud-front="${c.id}" title="Traer al frente">${i(R()[c.type].icon)}<span>${e(title(c))}</span></button><button type="button" class="hud-chip-x" data-hud-close="${c.id}" aria-label="Cerrar tarjeta ${e(title(c))}">${i('x')}</button></li>`).join('')}</ul>`:'';window.lucide?.createIcons({root:t});}
 /* ---------- motion ---------- */
 function enter(n){const g=gs();if(!g)return;const tl=g.timeline({defaults:{overwrite:'auto'}});n._tl=tl;
  tl.fromTo(n,{opacity:0,scale:.82,y:18,filter:'blur(8px)'},{opacity:1,scale:1.045,y:-3,filter:'blur(0px)',duration:.34,ease:'power3.out'})
    .to(n,{scale:1,y:0,duration:.42,ease:'elastic.out(1,.55)',clearProps:'filter,transform'});}
 function leave(n,done){const g=gs();if(!g||!n){done();return;}n.dataset.leaving='1';n._tl?.kill();g.timeline({onComplete:done}).to(n,{scale:1.03,duration:.1,ease:'power1.out'}).to(n,{opacity:0,scale:.86,y:14,filter:'blur(6px)',duration:.26,ease:'power2.in'});}
 /* Layout: count of visible cards drives CSS grid zones; the core gently shrinks (no restart). */
 function layout(){cancelAnimationFrame(layoutRaf);layoutRaf=requestAnimationFrame(()=>{const n=visibleCards().length;document.body.dataset.hudCards=String(n);document.body.dataset.hudTotal=String(ws.cards.length);const g=gs();const core=document.getElementById('hud-core');if(!core)return;if(g)g.to(core,{scale:n?(n>2?.86:.93):1,duration:.55,ease:'power3.out',overwrite:'auto'});});}
 /* ---------- loading with generation guard ---------- */
 async function load(c,{silent=false}={}){const d=R()[c.type],need=d.needs?.();const gen=++c.gen,owner=ws.owner;
  if(need){c.state='blocked';c.error=need;paint(c);persist();return;}
  c.state='loading';paint(c);
  try{const data=await d.load(c.args||{});if(gen!==c.gen||owner!==ws.owner||!ws.cards.includes(c))return;c.data=data;c.state=d.empty?.(data)?'empty':'ready';if(!silent)window.EvieSounds?.play('card');}
  catch(err){if(gen!==c.gen||owner!==ws.owner||!ws.cards.includes(c))return;c.state='error';c.error=err.status===401?'Tu sesión cambió. Vuelve a entrar.':err.status===429?err.message:(err.message||'No se pudo cargar.');if(!silent)window.EvieSounds?.play('error');}
  paint(c);persist();announce();}
 /* ---------- public actions ---------- */
 function open(type,args={},{focus=false}={}){
  if(!R()[type])return {ok:false,error:'Tarjeta desconocida.'};ensureOwner();
  if(type==='capabilities'&&window.EvieCaps&&EvieCaps.radial()){if(!onHome()){sessionStorage.setItem('evie-hud-caps','1');location.hash='inicio';return {ok:true,card:type,opened_on_home:true};}EvieCaps.show();return {ok:true,card:type,view:'radial'};}
  const same=NEW_EACH_TIME.has(type)?null:ws.cards.find(c=>c.type===type);
  if(same){ws.active=same.id;if(onHome()){reconcile();document.getElementById(same.id)?.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});pulse(same);load(same,{silent:true});}persist();return {ok:true,card:type,id:same.id,already_open:true};}
  const c={id:'hud-c'+(++ws.seq)+'-'+Math.random().toString(36).slice(2,6),type,args,state:'loading',title:args.title||null,gen:0};ws.cards.push(c);ws.active=c.id;
  if(!onHome()){persist();location.hash='inicio';return {ok:true,card:type,id:c.id,opened_on_home:true};}
  reconcile({animateNew:c.id});const n=document.getElementById(c.id);if(focus&&n){lastFocus=document.activeElement;n.focus({preventScroll:true});}
  load(c);persist();return {ok:true,card:type,id:c.id};}
 function pulse(c){const n=document.getElementById(c.id),g=gs();if(n&&g)g.fromTo(n,{outlineColor:'rgba(150,175,255,0)'},{outlineColor:'rgba(150,175,255,.7)',duration:.25,yoyo:true,repeat:1});}
 const norm=s=>IvyTools.norm(String(s||''));
 /* Resolve a spoken/explicit target. Returns {card} | {ambiguous:[...]} | null. */
 function resolve(ref){const list=ws.cards;if(!list.length)return null;
  if(ref==null||ref===''||ref==='active'||ref==='esta'||ref==='this'){const a=list.find(c=>c.id===ws.active)||list.at(-1);return {card:a};}
  const byId=list.find(c=>c.id===ref);if(byId)return {card:byId};
  const r=norm(ref).replace(/^(la |el |de |del |sobre )+/,'');
  const words=r.split(' ').filter(w=>w.length>2&&!['tarjeta','sobre','del','las','los','una'].includes(w));
  const score=c=>{const hay=norm(title(c)+' '+(R()[c.type].title||'')+' '+c.type+' '+(c.args?.query||'')+' '+(c.args?.place||'')+' '+(c.data?.query||'')+' '+(c.data?.place||'')+' '+(c.args?.topic||'')+' '+(c.args?.name||''));if(c.type===r)return 100;let s=0;for(const w of words)if(hay.includes(w))s++;return s;};
  const ranked=list.map(c=>[score(c),c]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]);if(!ranked.length)return null;
  const top=ranked.filter(x=>x[0]===ranked[0][0]).map(x=>x[1]);return top.length===1?{card:top[0]}:{ambiguous:top};}
 function close(ref,{silent=false}={}){ensureOwner();
  if(ref==='all'){const n=ws.cards.length;ws.cards.forEach(c=>{c.gen++;});ws.cards=[];ws.active=null;const h=host();h?.querySelectorAll('.hud-card').forEach(x=>leave(x,()=>{x._dispose?.();x.remove();}));persist();tray();layout();announce();if(n&&!silent)window.EvieSounds?.play('close');return {ok:n>0,closed:n};}
  const r=resolve(ref);if(!r)return {ok:false,error:'No hay una tarjeta abierta con ese nombre.'};
  if(r.ambiguous)return {ok:false,ambiguous:r.ambiguous.map(c=>title(c)+(c.args?.query?` («${c.args.query}»)`:c.args?.place?` (${c.args.place})`:'')),error:'Hay varias tarjetas que coinciden.'};
  const c=r.card;c.gen++;ws.cards=ws.cards.filter(x=>x!==c);if(ws.active===c.id)ws.active=ws.cards.at(-1)?.id||null;const n=document.getElementById(c.id);
  const done=()=>{n?._dispose?.();n?.remove();reconcile();if(!ws.cards.length){const t=lastFocus&&document.contains(lastFocus)?lastFocus:document.getElementById('dali-core-control');t?.focus?.({preventScroll:true});}};
  leave(n,done);persist();if(!silent)window.EvieSounds?.play('close');announce();return {ok:true,closed:c.type,title:title(c)};}
 /* Merge new args into an open card and reload it in place (same id, no new card, no sound). */
 function update(id,args={}){const c=ws.cards.find(x=>x.id===id);if(!c)return {ok:false};c.args={...c.args,...args};if(onHome()&&document.getElementById(c.id))load(c,{silent:true});else{c.state='stale';persist();}return {ok:true};}
 function front(id){const c=ws.cards.find(x=>x.id===id);if(!c)return;ws.cards=[...ws.cards.filter(x=>x!==c),c];ws.active=c.id;reconcile({animateNew:null});const n=document.getElementById(id);if(n){enter(n);n.focus({preventScroll:true});}persist();}
 function expand(id){const c=ws.cards.find(x=>x.id===id),d=c&&R()[c.type];if(!d?.route)return;persist();const n=document.getElementById(id),g=gs();const go=()=>{location.hash=d.route;};
  if(n&&g)g.timeline({onComplete:go}).to(n,{scale:1.04,opacity:0,duration:.26,ease:'power2.in'});else go();}
 function announce(){const s=document.getElementById('hud-open-list');if(s)s.textContent=ws.cards.length?'Tarjetas abiertas: '+ws.cards.map(title).join(', '):'Sin tarjetas abiertas';}
 function tick(){const f=EvieCards.fmt,now=new Date();document.querySelectorAll('[data-hud-clock]').forEach(n=>n.textContent=f(now,{hour:'numeric',minute:'2-digit',hour12:true}));const g=document.getElementById('hud-time');if(g)g.textContent=f(now,{weekday:'long',day:'numeric',month:'long'})+' · '+f(now,{hour:'numeric',minute:'2-digit',hour12:true});}
 function home(){const p=EvieAssistant.pref();
  return `<section class="hud" id="evie-hud" aria-label="Inicio · EVIE">
  <div class="hud-top"><p class="hud-time" id="hud-time"></p><div class="hud-status"><span class="hud-privacy" title="Tus datos se guardan en tu cuenta. El audio solo sale de tu dispositivo cuando le hablas a EVIE.">${i(cloud()?'shield-check':'hard-drive')}<span>${cloud()?'Datos privados de tu cuenta':'Datos solo en este navegador'}</span></span><button type="button" class="hud-mic-state" data-hud-wake data-wake-state title="Palabra clave y micrófono">${e(p.wakeWord?(window.EvieWake?.label()||''):'Micrófono solo al tocar')}</button></div></div>
  <div class="hud-stage"><div class="hud-core" id="hud-core">${DaliCore.markup()}<div class="hud-caps-ring" id="hud-caps-ring" hidden></div></div>
   <h1 class="hud-greeting" id="hud-greeting">${greeting()}</h1>
   <p class="hud-phase" data-evie-phase aria-live="polite">Lista</p>
   <div class="hud-cards" id="hud-cards" aria-label="Tarjetas de EVIE"></div>
   <nav class="hud-tray" id="hud-tray" aria-label="Más tarjetas abiertas" hidden></nav></div>
  <div class="hud-dock"><div class="evie-subs" id="evie-subs" aria-live="polite"></div><div class="evie-draft" id="evie-stage-draft" hidden></div>
   <form class="evie-composer hud-composer" id="evie-stage-form"><label class="sr-only" for="evie-stage-input">Escríbele a EVIE</label><input id="evie-stage-input" autocomplete="off" enterkeyhint="send" maxlength="600" placeholder="Habla o escribe: «Ivi, abre finanzas»"><button type="button" class="icon-button evie-mic" data-evie="listen" aria-label="Hablar con EVIE">${i('mic')}</button><button class="icon-button evie-send" aria-label="Enviar">${i('arrow-up')}</button></form>
   <div class="evie-stage-links"><button type="button" data-evie="open">Conversación completa</button><button type="button" data-hud-open="capabilities">¿Qué puedo hacer?</button><button type="button" data-hud-open="pendientes">Pendientes</button><button type="button" data-hud-close-all ${ws.cards.length?'':'hidden'}>Cerrar tarjetas</button><button type="button" data-evie="stop">Detener</button></div>
   <p class="sr-only" id="hud-open-list" aria-live="polite"></p></div></section>`;}
 /* Leaving Home: tear down DOM-bound resources only. The workspace model stays for this account. */
 function detach(){document.querySelectorAll('#hud-cards .hud-card').forEach(n=>{n._tl?.kill();n._dispose?.();});document.body.dataset.hudCards='0';clearInterval(clockTimer);clockTimer=null;ro?.disconnect();ro=null;window.gsap?.killTweensOf?.('#hud-core');window.EvieCaps?.detach?.();persist();}
 /* Sign-out / account switch: wipe the previous account's workspace everywhere. */
 function reset(){const o=ws.owner;ws.cards.forEach(c=>{c.gen++;});detach();ws={owner:null,cards:[],active:null,seq:0,caps:false};if(o)clearOwnerStorage(o);try{for(const k of Object.keys(sessionStorage))if(k.startsWith('evie-hud-'))sessionStorage.removeItem(k);}catch{}}
 function afterRender(){const home=UI.section==='inicio'&&!UI.id&&!!document.getElementById('evie-hud');document.body.classList.toggle('hud-home',home);
  if(!home){if(clockTimer||document.body.dataset.hudCards!=='0')detach();return;}
  ensureOwner();
  const st=document.getElementById('evie-stage-form');if(st&&!st.dataset.bound){st.dataset.bound='1';st.onsubmit=ev=>{ev.preventDefault();const inp=st.querySelector('input'),v=inp.value;inp.value='';if(v.trim())EvieAssistant.ask(v,{speak:!EvieAssistant.pref().muted&&EvieAssistant.pref().conversation,inline:true});};}
  EvieAssistant.syncInline?.();tick();clearInterval(clockTimer);clockTimer=setInterval(tick,15000);
  const g=gs(),first=!intro;
  if(g&&first){intro=true;g.timeline().fromTo('#hud-core',{opacity:0,scale:.84},{opacity:1,scale:1,duration:1.1,ease:'expo.out'}).from('.hud-greeting',{opacity:0,y:12,duration:.7,ease:'power2.out'},.3).from('.hud-dock',{opacity:0,y:18,duration:.6,ease:'power2.out'},.45);}
  intro=true;
  // Rehydrate: render the model's cards. Cards that only had args (data not persisted) reload silently once.
  reconcile();for(const c of ws.cards)if(c.state==='stale'||(c.state==='loading'&&c.gen===0))load(c,{silent:true});
  ro?.disconnect();ro=new ResizeObserver(()=>{reconcile();});ro.observe(document.getElementById('evie-hud'));
  const legacy=sessionStorage.getItem('evie-hud-pending');if(legacy){sessionStorage.removeItem('evie-hud-pending');sessionStorage.removeItem('evie-hud-data');}
  if(sessionStorage.getItem('evie-hud-caps')){sessionStorage.removeItem('evie-hud-caps');setTimeout(()=>window.EvieCaps?.show(),120);}
  window.EvieCaps?.afterRender?.();syncLinks();announce();}
 function syncLinks(){const b=document.querySelector('[data-hud-close-all]');if(b)b.hidden=!ws.cards.length;}
 document.addEventListener('click',ev=>{const t=ev.target.closest('[data-hud-open],[data-hud-close],[data-hud-close-all],[data-hud-expand],[data-hud-primary],[data-hud-retry],[data-hud-learn],[data-hud-wake],[data-hud-front]');if(!t)return;
  if(t.dataset.hudOpen!==undefined){window.EvieSounds?.unlock();open(t.dataset.hudOpen,{},{focus:true});}
  else if(t.dataset.hudCloseAll!==undefined)close('all');
  else if(t.dataset.hudClose)close(t.dataset.hudClose);
  else if(t.dataset.hudFront)front(t.dataset.hudFront);
  else if(t.dataset.hudExpand)expand(t.dataset.hudExpand);
  else if(t.dataset.hudRetry){const c=ws.cards.find(x=>x.id===t.dataset.hudRetry);if(c)load(c);}
  else if(t.dataset.hudPrimary){const c=ws.cards.find(x=>x.id===t.dataset.hudPrimary);if(c)R()[c.type].primary(c.data).act(c);}
  else if(t.dataset.hudLearn){const card=ws.cards.find(x=>x.id===t.closest('.hud-card')?.id);if(!card)return;if(t.dataset.hudLearn==='discard'){close(card.id);window.EvieAssistant?.say?.('Descartado. No guardé nada.');return;}t.disabled=true;try{const r=EvieCards.saveLearning(card.data);close(card.id,{silent:true});window.EvieSounds?.play('success');App.toast(r.message,'success');}catch(err){t.disabled=false;App.toast(err.message,'error');}}
  else if(t.dataset.hudWake!==undefined)location.hash='configuracion';
  syncLinks();});
 // Track the card the user is actually interacting with ("cierra esta tarjeta").
 document.addEventListener('focusin',ev=>{const c=ev.target.closest?.('.hud-card');if(c&&ws.active!==c.id){ws.active=c.id;document.querySelectorAll('.hud-card.is-active').forEach(n=>n.classList.toggle('is-active',n.id===c.id));c.classList.add('is-active');}});
 document.addEventListener('pointerdown',ev=>{const c=ev.target.closest?.('.hud-card');if(c){ws.active=c.id;document.querySelectorAll('.hud-card').forEach(n=>n.classList.toggle('is-active',n===c));}},{passive:true});
 document.addEventListener('keydown',ev=>{if(ev.key!=='Escape'||!onHome()||document.querySelector('dialog[open]'))return;const panel=document.getElementById('evie-panel');if(panel&&!panel.hidden)return;if(window.EvieCaps?.visible()){EvieCaps.hide();return;}const inCard=ev.target.closest?.('.hud-card');if(inCard)close(inCard.id);});
 return Object.freeze({home,afterRender,open,close,expand,front,update,reset,dispose:reset,detach,resolve:r=>{const x=resolve(r);return x?.card?{id:x.card.id,type:x.card.type,title:title(x.card)}:x?.ambiguous?{ambiguous:x.ambiguous.map(title)}:null;},
  cards:()=>ws.cards.map(c=>({id:c.id,type:c.type,state:c.state,title:title(c)})),visible:()=>visibleCards().map(c=>c.id),active:()=>ws.active,owner:()=>ws.owner,
  get REGISTRY(){return EvieCards.R;},capabilities:()=>EvieCards.capabilities(),findSkill:t=>EvieCards.findSkill(t),greeting});
})();
