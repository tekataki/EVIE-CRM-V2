'use strict';
/* EVIE v12 · Dojo de ventas (#dojo). Voice-first role play: Ivi plays a local-business owner with a hidden, human
   profile (you pick the business, the owner's attitude and the difficulty: fácil, medio or difícil), you pitch by voice
   or text and at the end you get a 0–100 score (rapport, descubrimiento, propuesta de valor, objeciones and cierre,
   weighted by difficulty) with a verdict, strengths, improvements, a model phrase and what the owner kept to himself.
   English mode (B2) with corrections. History keeps only scores, difficulty and learnings (preferences.dojo.sessions,
   last 30); the transcript and the hidden profile (an opaque server token, never shown) live in memory while you play.
   From the SOMA Cabina, «Practicar esta visita» presets the offer and the prospect's context.
   Server: /api/dojo/turn and /api/dojo/score (Claude or OpenAI). */
window.EvieDojo=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const BUSINESSES=['restaurante','cafetería','taller mecánico','tienda de ropa','consultorio','gimnasio','panadería','estética'];
 const STYLES=[['esceptico','Escéptico','Desconfía y pide pruebas'],['ocupado','Ocupado','Te da poco tiempo'],['precio','Cazador de precio','Todo le parece caro'],['proveedor','Ya tiene proveedor','«Un sobrino me lo hace»'],['pensar','Indeciso','«Lo voy a pensar»']];
 const LEVELS=[['facil','Fácil','Amable · 1 objeción suave','signal-low'],['medio','Medio','Ocupado · 2 a 3 objeciones','signal-medium'],['dificil','Difícil','Con prisa · puede colgarte','signal-high']];
 const DIMS=[['rapport','Rapport'],['descubrimiento','Descubrimiento'],['propuesta_valor','Propuesta de valor'],['objeciones','Objeciones'],['cierre','Cierre']];
 const MOOD={frio:['Frío','#5aa9ff',10],neutral:['Neutral','#9aa4bd',40],interesado:['Interesado','#ffb547',70],listo:['Listo para cerrar','#3ddc97',100]};
 const S={setup:{business:'restaurante',style:'esceptico',offer:'',lang:'es',voice:true,difficulty:'medio',soma:null},on:false,turns:[],mood:'neutral',objection:'',ended:false,agreed:false,patience:100,profile:'',busy:false,score:null,listening:false,draft:''};
 const history=()=>Array.isArray(P().dojo?.sessions)?P().dojo.sessions:[];
 const offerDefault=()=>{const pk=P().somaCabin?.packages;return Array.isArray(pk)&&pk[0]?.name?pk.map(p=>p.name).slice(0,3).join(', '):'';};
 const level=k=>LEVELS.find(l=>l[0]===k);
 const styleName=k=>(STYLES.find(s=>s[0]===k)||[])[1]||'';
 const badge=k=>{const l=level(k);return l?`<span class="dj-lvl" data-level="${l[0]}">${ic(l[3])}${l[1]}</span>`:'';};
 const sellers=()=>S.turns.filter(t=>t.role==='seller').length;
 const pts=x=>Math.max(0,Math.min(100,Math.round(Number(x?.puntuacion??x?.total)||0)));
 /* ---------------- view ---------------- */
 function setupView(){const st=S.setup,h=history(),last=h.slice(-12),best=h.reduce((a,x)=>Math.max(a,pts(x.score)),0),avg=k=>h.length?Math.round(h.reduce((a,x)=>a+(x.score?.[k]||0),0)/h.length*10)/10:null;
  return `<section class="panel dj v8-card" id="dj-setup" aria-label="Preparar práctica"><div class="dj-grid">
   <div class="dj-form"><span class="dj-eyebrow">NUEVA PRÁCTICA</span><h2>¿A quién le vas a vender?</h2>
    ${st.soma?`<p class="dj-soma">${ic('briefcase')}<span>Practicas la visita a <b>${e(st.soma.name||'tu prospecto')}</b>: el dueño se basa en su ficha de SOMA.</span><button type="button" class="icon-button" data-dj="soma-clear" aria-label="Practicar sin la ficha de SOMA">${ic('x')}</button></p>`:''}
    <label class="ch-field"><span>Negocio</span><select class="select" data-dj="business">${BUSINESSES.map(b=>`<option ${st.business===b?'selected':''}>${e(b)}</option>`).join('')}</select></label>
    <fieldset class="dj-fs"><legend>Personalidad del dueño</legend><div class="dj-styles" role="radiogroup">${STYLES.map(([k,l,d])=>`<label class="dj-style"><input type="radio" name="dj-style" value="${k}" ${st.style===k?'checked':''}><span><b>${l}</b><small>${d}</small></span></label>`).join('')}</div></fieldset>
    <fieldset class="dj-fs"><legend>Dificultad</legend><div class="dj-levels" role="radiogroup" aria-label="Dificultad">${LEVELS.map(([k,l,d,i])=>`<label class="dj-style dj-level" data-level="${k}"><input type="radio" name="dj-level" value="${k}" ${st.difficulty===k?'checked':''}><span><b>${ic(i)}${l}</b><small>${d}</small></span></label>`).join('')}</div></fieldset>
    <label class="ch-field"><span>Qué ofreces (opcional)</span><input class="input" data-dj="offer" maxlength="200" value="${e(st.offer||offerDefault())}" placeholder="Ej. menú digital con QR y pedidos a cocina"></label>
    <div class="dj-row"><div class="dj-seg" role="radiogroup" aria-label="Idioma"><label><input type="radio" name="dj-lang" value="es" ${st.lang!=='en'?'checked':''}><span>Español</span></label><label><input type="radio" name="dj-lang" value="en" ${st.lang==='en'?'checked':''}><span>English · B2</span></label></div>
     <label class="dj-check"><input type="checkbox" data-dj="voice" ${st.voice?'checked':''}><span>Voz del dueño</span></label></div>
    <button type="button" class="button primary dj-go" data-dj="start" ${cloud()?'':'disabled'}>${ic('swords')}Empezar práctica</button>${cloud()?'':'<p class="dj-muted">Inicia sesión para practicar: el dueño lo interpreta la IA de EVIE.</p>'}</div>
   <div class="dj-hist"><span class="dj-eyebrow">TU PROGRESO</span>${h.length?`<div class="dj-kpis"><div><b>${h.length}</b><small>prácticas</small></div><div><b>${best}</b><small>mejor puntaje</small></div><div><b>${avg('cierre')??'—'}</b><small>cierre promedio</small></div></div>${spark(last.map(x=>pts(x.score)))}
     <ol class="dj-list">${h.slice(-6).reverse().map(x=>`<li><span class="dj-badge" style="--v:${pts(x.score)}">${x.score?pts(x.score):'—'}</span><div><strong>${e(x.scenario?.business||'')} · ${e(styleName(x.scenario?.style))}${x.lang==='en'?' · EN':''}</strong><small>${badge(x.difficulty)}${e(new Date(x.at).toLocaleDateString('es-MX',{day:'numeric',month:'short'}))} · ${x.turns} turnos${x.veredicto?' · '+e(x.veredicto):x.mejoras?.[0]?' · '+e(x.mejoras[0]):''}</small></div></li>`).join('')}</ol>`:'<p class="dj-muted">Aquí verás tus puntajes y en qué mejorar después de cada práctica.</p>'}</div></div></section>`;}
 function spark(vals){if(vals.length<2)return '';const w=240,h=48,max=100,step=w/(vals.length-1),pl=vals.map((v,i)=>`${(i*step).toFixed(1)},${(h-4-(v/max)*(h-8)).toFixed(1)}`).join(' ');return `<svg class="dj-spark" viewBox="0 0 ${w} ${h}" aria-label="Tendencia de puntajes" role="img"><polyline points="${pl}" pathLength="100"/></svg>`;}
 function arenaView(){const m=MOOD[S.mood]||MOOD.neutral,sc=S.setup,n=sellers(),off=S.busy||S.ended,pc=S.patience>=60?'var(--dj-good)':S.patience>=30?'var(--dj-warn)':'var(--dj-bad)';
  return `<section class="panel dj dj-arena v8-card" id="dj-arena" aria-label="Práctica en curso">
   <header class="dj-owner"><div class="dj-avatar" style="--mood:${m[1]}" aria-hidden="true">${ic('store')}<i></i></div><div class="dj-owner-t"><div class="dj-owner-top"><span class="dj-eyebrow">${e(sc.business.toUpperCase())} · ${e(styleName(sc.style))}${sc.lang==='en'?' · ENGLISH':''}</span>${badge(sc.difficulty)}</div><strong>El dueño está ${e(m[0].toLowerCase())}</strong>
    <div class="dj-meters"><small>Interés</small><div class="dj-mood" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m[2]}" aria-label="Interés del dueño"><i style="--p:${m[2]};--mood:${m[1]}"></i></div><small>Paciencia</small><div class="dj-mood" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${S.patience}" aria-label="Paciencia del dueño"><i style="--p:${S.patience};--mood:${pc}"></i></div></div>${S.objection?`<span class="dj-obj">${ic('shield-alert')}${e(S.objection)}</span>`:''}</div>
    <button type="button" class="icon-button" data-dj="quit" aria-label="Salir de la práctica">${ic('x')}</button></header>
   <ol class="dj-log" id="dj-log" aria-live="polite">${S.turns.map(t=>`<li class="dj-msg ${t.role}"><span>${e(t.text)}</span></li>`).join('')}${S.busy?'<li class="dj-msg owner typing"><span><i></i><i></i><i></i></span></li>':''}</ol>
   ${S.ended?(S.agreed?`<p class="dj-ended">${ic('handshake')}El dueño aceptó un siguiente paso. ¡Califica tu práctica!</p>`:`<p class="dj-ended is-lost">${ic('phone-off')}${n<2?'El dueño cortó la llamada muy pronto. Intenta otra vez con otra entrada.':'El dueño terminó la llamada sin un siguiente paso. Califica para ver qué pasó.'}</p>`):''}
   <form class="dj-input" data-dj-form="say"><button type="button" class="dj-mic ${S.listening?'is-on':''}" data-dj="mic" aria-pressed="${S.listening}" aria-label="${S.listening?'Terminar de hablar':'Hablar'}" ${S.ended?'disabled':''}>${ic(S.listening?'square':'mic')}</button><input class="input" name="text" maxlength="800" autocomplete="off" aria-label="Tu respuesta" placeholder="${S.ended?'La llamada terminó':S.listening?'Te escucho…':sc.lang==='en'?'Your pitch…':'Tu respuesta…'}" value="${e(S.draft)}" ${off?'disabled':''}><button class="button primary" ${off?'disabled':''} aria-label="Enviar">${ic('send')}</button></form>
   <div class="dj-actions">${S.ended&&n<2?`<button type="button" class="button primary" data-dj="again">${ic('rotate-ccw')}Intentar otra vez</button>`:`<button type="button" class="button${S.ended?' primary':''}" data-dj="score" ${n<2||S.busy?'disabled':''}>${ic('gauge')}Terminar y calificar</button>`}</div></section>`;}
 function ring(v){const r=52,c=2*Math.PI*r;return `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="t"/><circle cx="60" cy="60" r="${r}" class="v" style="--dash:${(c*v/100).toFixed(1)};--c:${c.toFixed(1)}"/></svg>`;}
 function bar(label,v){v=Math.max(0,Math.min(10,Math.round(Number(v)||0)));return `<li><span>${label}</span><div class="dj-bar" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${v}"><i style="--p:${v*10}"></i></div><b>${v}</b></li>`;}
 function scoreView(){const s=S.score,t=pts(s),L=level(s.difficulty)||level(S.setup.difficulty)||LEVELS[1],lv=L[0],f=Number(s.ajuste),pf=s.perfil,tone=t>=70?'var(--dj-good)':t>=40?'var(--dj-warn)':'var(--dj-bad)';
  const adj=f>1?`En ${L[1].toLowerCase()} tu puntaje vale ${Math.round((f-1)*100)} % más.`:f<1?`En ${L[1].toLowerCase()} el puntaje se ajusta ${Math.round((1-f)*100)} % abajo: sube de nivel cuando cierres seguido.`:'Puntaje sin ajuste por dificultad.';
  const hidden=pf?.nombre?[['Su dolor real',(pf.ocultos||[]).join(' · ')],['Lo que sí admitía',pf.dolor],['Presupuesto',pf.presupuesto],['Quién decide',pf.decide],['Un detalle personal',pf.detalle]].filter(x=>x[1]):[];
  return `<section class="panel dj dj-score v8-card" id="dj-score" aria-label="Calificación">
  <div class="dj-hero"><div class="dj-ring" style="--rc:${tone}" role="img" aria-label="Puntuación: ${t} de 100">${ring(t)}<div class="dj-total" aria-hidden="true"><b data-count="${t}">${t}</b><small>de 100</small></div></div>
   <div class="dj-verdict"><span class="dj-eyebrow">CALIFICACIÓN</span><strong>${e(s.veredicto||'')}</strong><div class="dj-tags">${badge(lv)}<span class="dj-lvl" data-tone="${s.cerro?'good':'bad'}">${ic(s.cerro?'calendar-check':'calendar-x')}${s.cerro?'Siguiente paso logrado':'Sin siguiente paso'}</span></div><small class="dj-muted">${adj}</small></div></div>
  <ul class="dj-bars" aria-label="Calificación por dimensión">${DIMS.map(([k,l])=>bar(l,s[k])).join('')}</ul>
  ${s.resumen?`<p class="dj-sum">${e(s.resumen)}</p>`:''}
  <div class="dj-cols"><div><h3>${ic('thumbs-up')}Lo que hiciste bien</h3><ul>${(s.fortalezas||[]).map(x=>`<li>${e(x)}</li>`).join('')||'<li>—</li>'}</ul></div><div><h3>${ic('target')}Para la próxima</h3><ul>${(s.mejoras||[]).map(x=>`<li>${e(x)}</li>`).join('')||'<li>—</li>'}</ul></div></div>
  ${hidden.length?`<details class="dj-reveal"><summary>${ic('eye')}Lo que ${e(pf.nombre)} no te dijo</summary><dl>${hidden.map(([k,v])=>`<div><dt>${k}</dt><dd>${e(v)}</dd></div>`).join('')}</dl></details>`:''}
  ${s.frase_modelo?`<blockquote class="dj-quote"><span>${ic('quote')}Frase modelo</span><p>${e(s.frase_modelo)}</p><button type="button" class="button small" data-dj="say-model">${ic('volume-2')}Escuchar</button></blockquote>`:''}
  ${s.correcciones?.length?`<div class="dj-en"><h3>${ic('languages')}English · ${e(s.nivel_ingles||'')}</h3><ul>${s.correcciones.map(k=>`<li><s>${e(k.dije)}</s><span>${e(k.mejor)}</span></li>`).join('')}</ul></div>`:''}
  <div class="dj-actions"><button type="button" class="button primary" data-dj="again">${ic('rotate-ccw')}Practicar otra vez</button><button type="button" class="button" data-dj="new">${ic('settings-2')}Cambiar escenario</button></div></section>`;}
 function view(){return Views.heading('Dojo de ventas','Practica tu presentación con un dueño de verdad, en fácil, medio o difícil. Ivi te califica de 0 a 100.',`<a class="button small" href="#soma">${ic('briefcase')}Cabina SOMA</a>`,'DOJO')+`<div id="dj-root">${body()}</div>`;}
 const body=()=>S.score?scoreView():S.on?arenaView():setupView();
 function paint(){const root=document.getElementById('dj-root');if(!root)return;root.innerHTML=body();try{window.lucide?.createIcons?.({root});}catch{}const log=document.getElementById('dj-log');if(log)log.scrollTop=log.scrollHeight;
  const tot=root.querySelector('.dj-total b[data-count]');if(tot&&!reduced()){const end=Number(tot.dataset.count)||0,t0=performance.now();const step=t=>{const k=Math.min(1,(t-t0)/900);tot.textContent=String(Math.round(end*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);}}
 /* ---------------- flow ---------------- */
 // The hidden profile travels as the server's opaque token; the SOMA context only matters until the first answer.
 const payload=()=>({scenario:{business:S.setup.business,style:S.setup.style,offer:S.setup.offer},lang:S.setup.lang,difficulty:S.setup.difficulty,turns:S.turns,...(S.profile?{profile:S.profile}:S.setup.soma?{soma:S.setup.soma}:{})});
 async function ownerTurn(){S.busy=true;paint();try{const r=await EvieAccounts.request('dojo/turn',{method:'POST',body:payload()});S.turns.push({role:'owner',text:r.reply});S.mood=r.mood||'neutral';S.objection=r.objection||'';S.ended=!!r.ended;S.agreed=!!r.agreed;
   if(typeof r.profile==='string'&&r.profile.length<=12000)S.profile=r.profile;if(Number.isFinite(r.patience))S.patience=Math.max(0,Math.min(100,Math.round(r.patience)));
   if(S.setup.voice&&window.EvieAssistant?.say)try{EvieAssistant.say(r.reply);}catch{}}
  catch(err){App.toast(err.message||'El dueño no pudo responder. Intenta de nuevo.','error');}finally{S.busy=false;paint();(document.querySelector('#dj-arena [name=text]:not(:disabled)')||document.querySelector('#dj-arena .dj-actions .button:not(:disabled)'))?.focus();}}
 function readSetup(){const root=document.getElementById('dj-setup');if(!root)return;const lv=root.querySelector('input[name="dj-level"]:checked')?.value;S.setup.business=root.querySelector('[data-dj="business"]').value;S.setup.style=root.querySelector('input[name="dj-style"]:checked')?.value||'esceptico';S.setup.difficulty=level(lv)?lv:'medio';S.setup.offer=root.querySelector('[data-dj="offer"]').value.trim().slice(0,200);S.setup.lang=root.querySelector('input[name="dj-lang"]:checked')?.value==='en'?'en':'es';S.setup.voice=root.querySelector('[data-dj="voice"]').checked;}
 async function start(){readSetup();Object.assign(S,{on:true,turns:[],mood:'neutral',objection:'',ended:false,agreed:false,patience:100,profile:'',score:null,draft:''});await ownerTurn();}
 async function send(text){text=String(text||'').trim().slice(0,800);if(!text||S.busy||S.ended)return;S.turns.push({role:'seller',text});S.draft='';if(S.turns.length>=30){App.toast('Llegaste al máximo de turnos: califica tu práctica.','success');paint();return;}await ownerTurn();}
 async function score(){if(S.busy)return;S.busy=true;paint();try{const r=await EvieAccounts.request('dojo/score',{method:'POST',body:payload()}),s=r.score||{},t=pts(s);S.score=s;
   Store.save(st=>{const d=st.preferences.dojo&&typeof st.preferences.dojo==='object'?st.preferences.dojo:{};const list=Array.isArray(d.sessions)?d.sessions:[];
    list.push({id:crypto.randomUUID(),at:new Date().toISOString(),scenario:{business:S.setup.business,style:S.setup.style},lang:S.setup.lang,difficulty:level(s.difficulty)?s.difficulty:S.setup.difficulty,turns:S.turns.length,score:{puntuacion:t,total:t,rapport:s.rapport,descubrimiento:s.descubrimiento,propuesta_valor:s.propuesta_valor,objeciones:s.objeciones,cierre:s.cierre,cerro:!!s.cerro},veredicto:String(s.veredicto||'').slice(0,60),mejoras:(s.mejoras||[]).slice(0,3)});st.preferences.dojo={...d,sessions:list.slice(-30)};});
   window.EvieSounds?.play?.(t>=70?'success':'alert');}
  catch(err){App.toast(err.message||'No pude calificar ahora.','error');}finally{S.busy=false;paint();}}
 function mic(){if(S.listening){window.EvieDictation?.stop?.();return;}if(S.ended)return;if(!window.EvieDictation){App.toast('El dictado no está disponible en este navegador.','error');return;}
  EvieDictation.start({lang:S.setup.lang,maxSec:120,onUpdate:({text})=>{S.draft=text||'';const i=document.querySelector('#dj-arena [name=text]');if(i)i.value=S.draft;},onDone:({text})=>{S.listening=false;paint();if(text?.trim())send(text);}}).then(r=>{if(r&&r.ok===false){S.listening=false;App.toast(r.error,'error');}paint();});S.listening=true;paint();}
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-dj]');if(!b||b.matches('input,select'))return;const a=b.dataset.dj;
  if(a==='start')start();else if(a==='score')score();else if(a==='mic')mic();
  else if(a==='quit'){if(S.turns.length>2&&!confirm('¿Salir sin calificar? Se pierde esta práctica.'))return;window.EvieDictation?.cancel?.();Object.assign(S,{on:false,turns:[],busy:false,listening:false,score:null,ended:false,agreed:false,profile:''});paint();}
  else if(a==='again'){Object.assign(S,{score:null});start();}else if(a==='new'){Object.assign(S,{on:false,score:null,turns:[],profile:''});paint();}
  else if(a==='soma-clear'){readSetup();S.setup.soma=null;paint();document.querySelector('#dj-setup [data-dj="business"]')?.focus();}
  else if(a==='say-model'&&S.score?.frase_modelo)window.EvieAssistant?.say?.(S.score.frase_modelo);});
 document.addEventListener('submit',ev=>{const f=ev.target.closest?.('[data-dj-form="say"]');if(!f)return;ev.preventDefault();send(f.elements.text.value);});
 function afterRender(){if(UI.section!=='dojo')return;const root=document.getElementById('dj-root');if(!root||root.dataset.mounted)return;root.dataset.mounted='1';try{window.lucide?.createIcons?.({root});}catch{}
  if(window.Motion?.animate&&!reduced())try{Motion.animate(root.querySelectorAll('.dj-form,.dj-hist,.dj-owner,.dj-log'),{opacity:[0,1],y:[12,0]},{type:'spring',stiffness:260,damping:26,delay:Motion.stagger?.(.05)||0});}catch{}}
 function intent(text){const t=String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');if(!/\b(dojo|practicar (mi )?(venta|pitch|presentacion)|practica de ventas|role ?play)\b/.test(t))return '';
  const lv=/\bdificil\b/.test(t)?'dificil':/\bfacil\b/.test(t)?'facil':/\bmedi[oa]\b/.test(t)?'medio':'';if(lv)S.setup.difficulty=lv;location.hash='dojo';
  return `Abrí el Dojo de ventas${lv?' en nivel '+level(lv)[1].toLowerCase():''}. Elige el negocio, la personalidad y la dificultad del dueño, y empezamos.`;}
 /* SOMA prospect → practice context (name, project, notes, needs and the dossier's problem/objections, clipped like the server). */
 const GUESS=[[/taller|mecanic|refaccion|llanter|autolavado/,'taller mecánico'],[/\bcafe|cafeteria/,'cafetería'],[/panader|pasteler|reposter/,'panadería'],[/gimnasio|\bgym\b|crossfit/,'gimnasio'],[/consultorio|clinica|dental|dentista|\bmedic|doctor|psicolog|nutriolog|fisioterap/,'consultorio'],[/estetica|\bsalon\b|barber|manicur|\bspa\b|peluquer/,'estética'],[/\bropa\b|boutique|\bmoda\b|calzado|zapater/,'tienda de ropa'],[/restaur|taquer|\btacos?\b|fonda|cocina|comida|mariscos|pizz|antojit|birria/,'restaurante']];
 const guess=c=>{const t=[c?.title,c?.project,c?.note].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');return (GUESS.find(([r])=>r.test(t))||[])[1]||null;};
 function somaOf(c){let p={};try{p=window.SomaCabin?.payload?.(c)?.client||{};}catch{}const d=c.cabin?.dossier||{},s=(v,n)=>String(v??'').trim().slice(0,n);
  const x={name:s(p.name||c.title,80),project:s(p.project??c.project,300),notes:s(p.notes,600),problem:s(d.problema_probable,160),needs:(Array.isArray(p.needs)?p.needs:[]).map(v=>s(v,160)).filter(Boolean).slice(0,4),objections:(Array.isArray(d.objeciones)?d.objeciones:[]).map(o=>s(o?.si,160)).filter(Boolean).slice(0,3)};
  return x.name||x.problem||x.needs.length?x:null;}
 /** Preset from another module: the offer (e.g. a prospect's recommended packages) and the prospect itself, given as
     `client` (record or id) or taken from the open #soma/<id> page, so the server builds the hidden owner from it. */
 function preset({offer='',business=null,client=null}={}){let c=client&&typeof client==='object'?client:null;if(!c){const id=client||(window.UI?.section==='soma'?UI.id:null);try{c=id?Store.list('clients').find(x=>x.id===id)||null:null;}catch{c=null;}}
  if(offer)S.setup.offer=String(offer).slice(0,200);const b=business||(c?guess(c):null);if(b&&BUSINESSES.includes(b))S.setup.business=b;S.setup.soma=c?somaOf(c):null;
  Object.assign(S,{on:false,score:null,turns:[],ended:false,agreed:false,profile:''});}
 return Object.freeze({view,afterRender,intent,history,preset,_state:S});
})();
