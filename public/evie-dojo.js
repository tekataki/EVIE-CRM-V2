'use strict';
/* EVIE v10 · Dojo de ventas (#dojo). Práctica por voz: Ivi interpreta al dueño de un negocio local exigente (elige el
   negocio y su personalidad), tú presentas por voz o texto y al final te califica claridad, objeciones y cierre, con
   fortalezas, mejoras y una frase modelo. Modo inglés (B2) con correcciones. El historial guarda solo puntajes y
   aprendizajes (preferences.dojo.sessions, últimas 30); la transcripción vive en memoria mientras practicas.
   Servidor: /api/dojo/turn y /api/dojo/score (Claude u OpenAI). */
window.EvieDojo=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const BUSINESSES=['restaurante','cafetería','taller mecánico','tienda de ropa','consultorio','gimnasio','panadería','estética'];
 const STYLES=[['esceptico','Escéptico','Desconfía y pide pruebas'],['ocupado','Ocupado','Te da poco tiempo'],['precio','Cazador de precio','Todo le parece caro'],['proveedor','Ya tiene proveedor','«Un sobrino me lo hace»'],['pensar','Indeciso','«Lo voy a pensar»']];
 const MOOD={frio:['Frío','#5aa9ff',10],neutral:['Neutral','#9aa4bd',40],interesado:['Interesado','#ffb547',70],listo:['Listo para cerrar','#3ddc97',100]};
 const S={setup:{business:'restaurante',style:'esceptico',offer:'',lang:'es',voice:true},on:false,turns:[],mood:'neutral',objection:'',ended:false,busy:false,score:null,listening:false,draft:''};
 const history=()=>Array.isArray(P().dojo?.sessions)?P().dojo.sessions:[];
 const offerDefault=()=>{const pk=P().somaCabin?.packages;return Array.isArray(pk)&&pk[0]?.name?pk.map(p=>p.name).slice(0,3).join(', '):'';};
 /* ---------------- view ---------------- */
 function setupView(){const st=S.setup,h=history(),last=h.slice(-12),best=h.reduce((a,x)=>Math.max(a,x.score?.total||0),0),avg=k=>h.length?Math.round(h.reduce((a,x)=>a+(x.score?.[k]||0),0)/h.length*10)/10:null;
  return `<section class="panel dj v8-card" id="dj-setup" aria-label="Preparar práctica"><div class="dj-grid">
   <div class="dj-form"><span class="dj-eyebrow">NUEVA PRÁCTICA</span><h2>¿A quién le vas a vender?</h2>
    <label class="ch-field"><span>Negocio</span><select class="select" data-dj="business">${BUSINESSES.map(b=>`<option ${st.business===b?'selected':''}>${e(b)}</option>`).join('')}</select></label>
    <fieldset class="dj-fs"><legend>Personalidad del dueño</legend><div class="dj-styles" role="radiogroup">${STYLES.map(([k,l,d])=>`<label class="dj-style"><input type="radio" name="dj-style" value="${k}" ${st.style===k?'checked':''}><span><b>${l}</b><small>${d}</small></span></label>`).join('')}</div></fieldset>
    <label class="ch-field"><span>Qué ofreces (opcional)</span><input class="input" data-dj="offer" maxlength="200" value="${e(st.offer||offerDefault())}" placeholder="Ej. menú digital con QR y pedidos a cocina"></label>
    <div class="dj-row"><div class="dj-seg" role="radiogroup" aria-label="Idioma"><label><input type="radio" name="dj-lang" value="es" ${st.lang!=='en'?'checked':''}><span>Español</span></label><label><input type="radio" name="dj-lang" value="en" ${st.lang==='en'?'checked':''}><span>English · B2</span></label></div>
     <label class="dj-check"><input type="checkbox" data-dj="voice" ${st.voice?'checked':''}><span>Voz del dueño</span></label></div>
    <button type="button" class="button primary dj-go" data-dj="start" ${cloud()?'':'disabled'}>${ic('swords')}Empezar práctica</button>${cloud()?'':'<p class="dj-muted">Inicia sesión para practicar: el dueño lo interpreta la IA de EVIE.</p>'}</div>
   <div class="dj-hist"><span class="dj-eyebrow">TU PROGRESO</span>${h.length?`<div class="dj-kpis"><div><b>${h.length}</b><small>prácticas</small></div><div><b>${best}</b><small>mejor puntaje</small></div><div><b>${avg('cierre')??'—'}</b><small>cierre promedio</small></div></div>${spark(last.map(x=>x.score?.total||0))}
     <ol class="dj-list">${h.slice(-6).reverse().map(x=>`<li><span class="dj-badge" style="--v:${x.score?.total||0}">${x.score?.total??'—'}</span><div><strong>${e(x.scenario?.business||'')} · ${e((STYLES.find(s=>s[0]===x.scenario?.style)||[])[1]||'')}${x.lang==='en'?' · EN':''}</strong><small>${e(new Date(x.at).toLocaleDateString('es-MX',{day:'numeric',month:'short'}))} · ${x.turns} turnos${x.mejoras?.[0]?' · '+e(x.mejoras[0]):''}</small></div></li>`).join('')}</ol>`:'<p class="dj-muted">Aquí verás tus puntajes y en qué mejorar después de cada práctica.</p>'}</div></div></section>`;}
 function spark(vals){if(vals.length<2)return '';const w=240,h=48,max=100,step=w/(vals.length-1),pts=vals.map((v,i)=>`${(i*step).toFixed(1)},${(h-4-(v/max)*(h-8)).toFixed(1)}`).join(' ');return `<svg class="dj-spark" viewBox="0 0 ${w} ${h}" aria-label="Tendencia de puntajes" role="img"><polyline points="${pts}" pathLength="100"/></svg>`;}
 function arenaView(){const m=MOOD[S.mood]||MOOD.neutral,sc=S.setup;
  return `<section class="panel dj dj-arena v8-card" id="dj-arena" aria-label="Práctica en curso">
   <header class="dj-owner"><div class="dj-avatar" style="--mood:${m[1]}" aria-hidden="true">${ic('store')}<i></i></div><div class="dj-owner-t"><span class="dj-eyebrow">${e(sc.business.toUpperCase())} · ${e((STYLES.find(s=>s[0]===sc.style)||[])[1]||'')}${sc.lang==='en'?' · ENGLISH':''}</span><strong>El dueño está ${e(m[0].toLowerCase())}</strong><div class="dj-mood" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m[2]}" aria-label="Interés del dueño"><i style="--p:${m[2]};--mood:${m[1]}"></i></div>${S.objection?`<span class="dj-obj">${ic('shield-alert')}${e(S.objection)}</span>`:''}</div>
    <button type="button" class="icon-button" data-dj="quit" aria-label="Salir de la práctica">${ic('x')}</button></header>
   <ol class="dj-log" id="dj-log" aria-live="polite">${S.turns.map(t=>`<li class="dj-msg ${t.role}"><span>${e(t.text)}</span></li>`).join('')}${S.busy?'<li class="dj-msg owner typing"><span><i></i><i></i><i></i></span></li>':''}</ol>
   ${S.ended?`<p class="dj-ended">${ic('handshake')}El dueño aceptó un siguiente paso. ¡Califica tu práctica!</p>`:''}
   <form class="dj-input" data-dj-form="say"><button type="button" class="dj-mic ${S.listening?'is-on':''}" data-dj="mic" aria-pressed="${S.listening}" aria-label="${S.listening?'Terminar de hablar':'Hablar'}">${ic(S.listening?'square':'mic')}</button><input class="input" name="text" maxlength="800" autocomplete="off" placeholder="${S.listening?'Te escucho…':sc.lang==='en'?'Your pitch…':'Tu respuesta…'}" value="${e(S.draft)}" ${S.busy?'disabled':''}><button class="button primary" ${S.busy?'disabled':''} aria-label="Enviar">${ic('send')}</button></form>
   <div class="dj-actions"><button type="button" class="button" data-dj="score" ${S.turns.filter(t=>t.role==='seller').length<2||S.busy?'disabled':''}>${ic('gauge')}Terminar y calificar</button></div></section>`;}
 function gauge(label,v){const p=Math.max(0,Math.min(10,v))/10,r=34,c=2*Math.PI*r;return `<div class="dj-g"><svg viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${r}" class="t"/><circle cx="42" cy="42" r="${r}" class="v" style="--dash:${(c*p).toFixed(1)};--c:${c.toFixed(1)}"/></svg><b>${v}</b><span>${label}</span></div>`;}
 function scoreView(){const s=S.score;return `<section class="panel dj dj-score v8-card" id="dj-score" aria-label="Calificación"><div class="dj-total"><span class="dj-eyebrow">CALIFICACIÓN</span><b data-count="${s.total}">${s.total}</b><small>de 100</small></div>
  <div class="dj-gauges">${gauge('Claridad',s.claridad)}${gauge('Objeciones',s.objeciones)}${gauge('Cierre',s.cierre)}</div>
  ${s.resumen?`<p class="dj-sum">${e(s.resumen)}</p>`:''}
  <div class="dj-cols"><div><h3>${ic('thumbs-up')}Lo que hiciste bien</h3><ul>${(s.fortalezas||[]).map(x=>`<li>${e(x)}</li>`).join('')||'<li>—</li>'}</ul></div><div><h3>${ic('target')}Para la próxima</h3><ul>${(s.mejoras||[]).map(x=>`<li>${e(x)}</li>`).join('')||'<li>—</li>'}</ul></div></div>
  ${s.frase_modelo?`<blockquote class="dj-quote"><span>${ic('quote')}Frase modelo</span><p>${e(s.frase_modelo)}</p><button type="button" class="button small" data-dj="say-model">${ic('volume-2')}Escuchar</button></blockquote>`:''}
  ${s.correcciones?.length?`<div class="dj-en"><h3>${ic('languages')}English · ${e(s.nivel_ingles||'')}</h3><ul>${s.correcciones.map(k=>`<li><s>${e(k.dije)}</s><span>${e(k.mejor)}</span></li>`).join('')}</ul></div>`:''}
  <div class="dj-actions"><button type="button" class="button primary" data-dj="again">${ic('rotate-ccw')}Practicar otra vez</button><button type="button" class="button" data-dj="new">${ic('settings-2')}Cambiar escenario</button></div></section>`;}
 function view(){return Views.heading('Dojo de ventas','Practica tu presentación con un dueño difícil. Ivi te califica claridad, objeciones y cierre.',`<a class="button small" href="#soma">${ic('briefcase')}Cabina SOMA</a>`,'DOJO')+`<div id="dj-root">${body()}</div>`;}
 const body=()=>S.score?scoreView():S.on?arenaView():setupView();
 function paint(){const root=document.getElementById('dj-root');if(!root)return;root.innerHTML=body();try{window.lucide?.createIcons?.({root});}catch{}const log=document.getElementById('dj-log');if(log)log.scrollTop=log.scrollHeight;
  const tot=root.querySelector('.dj-total b[data-count]');if(tot&&!reduced()){const end=Number(tot.dataset.count)||0,t0=performance.now();const step=t=>{const k=Math.min(1,(t-t0)/900);tot.textContent=String(Math.round(end*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);}}
 /* ---------------- flow ---------------- */
 const payload=()=>({scenario:{business:S.setup.business,style:S.setup.style,offer:S.setup.offer},lang:S.setup.lang,turns:S.turns});
 async function ownerTurn(){S.busy=true;paint();try{const r=await EvieAccounts.request('dojo/turn',{method:'POST',body:payload()});S.turns.push({role:'owner',text:r.reply});S.mood=r.mood||'neutral';S.objection=r.objection||'';S.ended=!!r.ended;
   if(S.setup.voice&&window.EvieAssistant?.say)try{EvieAssistant.say(r.reply);}catch{}}
  catch(err){App.toast(err.message||'El dueño no pudo responder. Intenta de nuevo.','error');}finally{S.busy=false;paint();document.querySelector('#dj-arena [name=text]')?.focus();}}
 async function start(){const root=document.getElementById('dj-setup');if(root){S.setup.business=root.querySelector('[data-dj="business"]').value;S.setup.style=root.querySelector('input[name="dj-style"]:checked')?.value||'esceptico';S.setup.offer=root.querySelector('[data-dj="offer"]').value.trim().slice(0,200);S.setup.lang=root.querySelector('input[name="dj-lang"]:checked')?.value==='en'?'en':'es';S.setup.voice=root.querySelector('[data-dj="voice"]').checked;}
  Object.assign(S,{on:true,turns:[],mood:'neutral',objection:'',ended:false,score:null,draft:''});await ownerTurn();}
 async function send(text){text=String(text||'').trim().slice(0,800);if(!text||S.busy)return;S.turns.push({role:'seller',text});S.draft='';if(S.turns.length>=30){App.toast('Llegaste al máximo de turnos: califica tu práctica.','success');paint();return;}await ownerTurn();}
 async function score(){if(S.busy)return;S.busy=true;paint();try{const r=await EvieAccounts.request('dojo/score',{method:'POST',body:payload()});S.score=r.score;
   Store.save(s=>{const d=s.preferences.dojo&&typeof s.preferences.dojo==='object'?s.preferences.dojo:{};const list=Array.isArray(d.sessions)?d.sessions:[];list.push({id:crypto.randomUUID(),at:new Date().toISOString(),scenario:{business:S.setup.business,style:S.setup.style},lang:S.setup.lang,turns:S.turns.length,score:{claridad:r.score.claridad,objeciones:r.score.objeciones,cierre:r.score.cierre,total:r.score.total},mejoras:(r.score.mejoras||[]).slice(0,3)});s.preferences.dojo={...d,sessions:list.slice(-30)};});
   window.EvieSounds?.play?.(r.score.total>=70?'success':'alert');}
  catch(err){App.toast(err.message||'No pude calificar ahora.','error');}finally{S.busy=false;paint();}}
 function mic(){if(S.listening){window.EvieDictation?.stop?.();return;}if(!window.EvieDictation){App.toast('El dictado no está disponible en este navegador.','error');return;}
  EvieDictation.start({lang:S.setup.lang,maxSec:120,onUpdate:({text})=>{S.draft=text||'';const i=document.querySelector('#dj-arena [name=text]');if(i)i.value=S.draft;},onDone:({text})=>{S.listening=false;paint();if(text?.trim())send(text);}}).then(r=>{if(r&&r.ok===false){S.listening=false;App.toast(r.error,'error');}paint();});S.listening=true;paint();}
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-dj]');if(!b||b.matches('input,select'))return;const a=b.dataset.dj;
  if(a==='start')start();else if(a==='score')score();else if(a==='mic')mic();
  else if(a==='quit'){if(S.turns.length>2&&!confirm('¿Salir sin calificar? Se pierde esta práctica.'))return;window.EvieDictation?.cancel?.();Object.assign(S,{on:false,turns:[],busy:false,listening:false,score:null});paint();}
  else if(a==='again'){Object.assign(S,{score:null});start();}else if(a==='new'){Object.assign(S,{on:false,score:null,turns:[]});paint();}
  else if(a==='say-model'&&S.score?.frase_modelo)window.EvieAssistant?.say?.(S.score.frase_modelo);});
 document.addEventListener('submit',ev=>{const f=ev.target.closest?.('[data-dj-form="say"]');if(!f)return;ev.preventDefault();send(f.elements.text.value);});
 function afterRender(){if(UI.section!=='dojo')return;const root=document.getElementById('dj-root');if(!root||root.dataset.mounted)return;root.dataset.mounted='1';try{window.lucide?.createIcons?.({root});}catch{}
  if(window.Motion?.animate&&!reduced())try{Motion.animate(root.querySelectorAll('.dj-form,.dj-hist,.dj-owner,.dj-log'),{opacity:[0,1],y:[12,0]},{type:'spring',stiffness:260,damping:26,delay:Motion.stagger?.(.05)||0});}catch{}}
 function intent(text){const t=String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');if(!/\b(dojo|practicar (mi )?(venta|pitch|presentacion)|practica de ventas|role ?play)\b/.test(t))return '';location.hash='dojo';return 'Abrí el Dojo de ventas. Elige el negocio y la personalidad del dueño, y empezamos.';}
 /** Preset from another module (e.g. a prospect's recommended packages as the offer). */
 function preset({offer='',business=null}={}){if(offer)S.setup.offer=String(offer).slice(0,200);if(business&&BUSINESSES.includes(business))S.setup.business=business;Object.assign(S,{on:false,score:null,turns:[]});}
 return Object.freeze({view,afterRender,intent,history,preset,_state:S});
})();
