'use strict';
/* EVIE v10 · Misión (en Objetivos y Finanzas).
   - Una meta de ahorro con nombre, monto y fecha límite: son datos del usuario (preferences.mission), nada personal
     vive en el código. Se refleja en un objetivo normal («Misión: …») que usan Inicio, el briefing e Ivi.
   - Cuenta regresiva, ahorro mensual requerido, proyección con tus ingresos REALES de SOMA (promedio de 90 días × el %
     que destinas + tu aporte extra) y escenarios (+ingreso / −gasto) con su fecha estimada.
   - Ahorro registrado a mano (aportes) o ligado al saldo real de una de tus cuentas de Finanzas.
   - Holograma que se arma con el avance (MissionHologram) y planificador de la serie de contenido (colección Contenido). */
window.EvieMission=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const money=c=>Domain.money(Math.round(Number(c)||0));
 const uid=()=>crypto.randomUUID();
 const DAY=864e5,MONTH=30.44;
 const today=()=>Domain.today();
 const diff=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/DAY);
 const addDays=(d,n)=>window.V2Domain?.addDays?V2Domain.addDays(d,n):new Date(Date.parse(d+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
 const fmtDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'—';
 const cents=v=>{const s=String(v??'').replace(/[\s,$]/g,'');return s?Domain.cents(s):0;};
 const pesos=c=>(Math.round(Number(c)||0)/100).toFixed(2).replace(/\.00$/,'');
 const STATUS={idea:'Idea',research:'Idea',script:'Guion',ready:'Listo',recording:'Grabando',editing:'Edición',scheduled:'Programado',published:'Publicado',analyzed:'Publicado'};
 const DEF={soma_share:30,monthly_extra_cents:0,scenarios:[],series:{name:'',platform:'tiktok'},hologram:'moto',history:[],account_id:null,saved_cents:0};
 function cfg(){const m=P().mission;return m&&Number(m.target_cents)>0&&/^\d{4}-\d{2}-\d{2}$/.test(m.deadline||'')?{...DEF,...m,series:{...DEF.series,...(m.series||{})},scenarios:Array.isArray(m.scenarios)?m.scenarios:[],history:Array.isArray(m.history)?m.history:[]}:null;}
 function accountBalance(id){if(!id||!window.FinanceCore)return null;try{const a=FinanceCore.available(P().evieAccounts||[],Store.list('transactions'),{today:today()});const x=(a.accounts||[]).find(r=>r.id===id);return x?Math.max(0,Math.round(x.balance)):null;}catch{return null;}}
 function savedOf(m=cfg()){if(!m)return 0;const b=accountBalance(m.account_id);return b!=null?b:Math.max(0,Math.round(m.saved_cents||0));}
 /** Average monthly SOMA income (cents) over the last 90 days, from real transactions. */
 function somaMonthly(){const t=today(),from=addDays(t,-90);let sum=0;for(const x of Store.list('transactions'))if(x.business_unit==='soma'&&x.type==='income'&&!x.transfer_id&&x.date>=from&&x.date<=t)sum+=Number(x.amount)||0;return Math.round(sum/3);}
 const delta=s=>(s.kind==='income'?1:-1)*Math.max(0,Math.round(s.monthly_cents||0));
 /** The whole projection (pure given the store). */
 function plan(m=cfg()){if(!m)return null;const t=today(),saved=savedOf(m),target=Math.round(m.target_cents),remaining=Math.max(0,target-saved),left=Math.max(0,diff(t,m.deadline)),months=left/MONTH;
  const soma=somaMonthly(),base=Math.round(soma*Math.max(0,Math.min(100,Number(m.soma_share)||0))/100)+Math.max(0,Math.round(m.monthly_extra_cents||0));
  const capacity=base+m.scenarios.filter(s=>s.active).reduce((a,s)=>a+delta(s),0);
  const eta=c=>remaining===0?t:c>0?addDays(t,Math.ceil(remaining/c*MONTH)):null;
  const late=d=>d&&d>m.deadline?Math.max(1,Math.round(diff(m.deadline,d)/MONTH)):0;
  const finish=eta(capacity);
  return {name:m.name,target,saved,remaining,pct:target?Math.min(100,Math.round(saved/target*1000)/10):0,left,months,soma,base,capacity,required:remaining===0?0:months>=1?Math.ceil(remaining/months):remaining,eta:finish,late:late(finish),onTrack:remaining===0||(!!finish&&finish<=m.deadline),done:remaining===0,deadline:m.deadline,
   scenarios:m.scenarios.map(s=>{const c=base+delta(s),d=eta(c);return {...s,capacity:c,eta:d,late:late(d)};})};}
 /** The linked goal (Objetivos, Inicio, briefing, Ivi) mirrors the mission in whole pesos. */
 function syncGoal(s,m){const title=('Misión: '+(m.name||'mi meta')).slice(0,120),target=Math.max(1,Math.round(m.target_cents/100)),progress=Math.min(target,Math.max(0,Math.floor(savedOf(m)/100)));
  const g=m.goal_id&&s.goals.find(x=>x.id===m.goal_id&&!x.deleted_at);
  if(!g){const r=Store.record(Records.normalize('goals',{title,date:m.deadline,horizon:'anual',category:'Finanzas',target,progress,unit:'pesos',description:'Misión de ahorro: se actualiza sola desde el panel Misión.',periodKey:Domain.periodKey('anual',m.deadline)}));s.goals.push(r);m.goal_id=r.id;return;}
  if(g.title!==title||g.target!==target||g.progress!==progress||g.date!==m.deadline||g.archived)Object.assign(g,{title,target,progress,date:m.deadline,unit:'pesos',archived:false,updated_at:new Date().toISOString()});}
 /** One history row per day: `open` = saved at the start of that day (or at creation), `saved_cents` = latest. */
 function save(fn,{snapshot=true}={}){Store.save(s=>{const m={...DEF,...(s.preferences.mission||{})};fn(m);if(snapshot&&m.target_cents>0){const t=today(),v=savedOf(m),all=Array.isArray(m.history)?m.history:[],cur=all.find(x=>x.date===t),before=all.filter(x=>x.date<t).at(-1),h=all.filter(x=>x.date!==t);h.push({date:t,open:cur?.open??before?.saved_cents??v,saved_cents:v});m.history=h.sort((a,b)=>a.date.localeCompare(b.date)).slice(-180);}s.preferences.mission=m;if(m.target_cents>0)syncGoal(s,m);});}
 /** Saved amount on a past date (from the daily history) — used by the weekly review. */
 function savedOn(date){const m=cfg();if(!m)return 0;const h=m.history.filter(x=>x.date<=date).at(-1);return h?h.saved_cents:0;}
 function addScenarios(list){if(!cfg())return 0;let n=0;save(m=>{const names=new Set(m.scenarios.map(s=>s.name.toLowerCase()));for(const s of list){if(!s?.name||names.has(s.name.toLowerCase())||!(s.monthly_cents>0))continue;m.scenarios.push({id:uid(),name:String(s.name).slice(0,50),kind:s.kind==='income'?'income':'expense',monthly_cents:Math.round(s.monthly_cents),active:false});names.add(s.name.toLowerCase());n++;}m.scenarios=m.scenarios.slice(0,12);},{snapshot:false});return n;}

 /* ---------------- view ---------------- */
 /** SVG fallback (reduced motion / no WebGL): a faint full outline plus the same strokes drawn up to the progress. */
 function silhouette(kind){const shapes=kind==='orb'?'<circle cx="160" cy="100" r="74" pathLength="100"/><circle cx="160" cy="100" r="50" pathLength="100"/><circle cx="160" cy="100" r="26" pathLength="100"/><path pathLength="100" d="M86 100h148M160 26v148"/>'
  :'<circle cx="74" cy="146" r="40" pathLength="100"/><circle cx="74" cy="146" r="13" pathLength="100"/><circle cx="252" cy="146" r="40" pathLength="100"/><circle cx="252" cy="146" r="13" pathLength="100"/><path pathLength="100" d="M74 146 L128 124 L156 146"/><path pathLength="100" d="M252 146 L224 70"/><path pathLength="100" d="M30 98 L92 86 L126 90 L148 70 L196 62 L224 52 L250 60 L268 88 L236 100 L198 116 L150 124 L118 116 L94 104 Z"/><path pathLength="100" d="M146 70 L174 50 L208 46"/>';
  return `<svg class="ms-silhouette" viewBox="0 0 320 200" aria-hidden="true"><g class="ghost">${shapes}</g><g class="draw">${shapes}</g></svg>`;}
 function countParts(deadline){const ms=Math.max(0,new Date(deadline+'T23:59:59').getTime()-Date.now());return {d:Math.floor(ms/DAY),h:Math.floor(ms/36e5)%24,m:Math.floor(ms/6e4)%60};}
 function countHTML(deadline){const c=countParts(deadline);return `<span><b data-u="d">${c.d}</b><small>días</small></span><span><b data-u="h">${String(c.h).padStart(2,'0')}</b><small>horas</small></span><span><b data-u="m">${String(c.m).padStart(2,'0')}</b><small>min</small></span>`;}
 function pill(p){return p.done?`<span class="ms-pill good">${ic('badge-check')}Misión cumplida</span>`:p.onTrack?`<span class="ms-pill good">${ic('trending-up')}A tiempo · ${e(fmtDate(p.eta))}</span>`:p.eta?`<span class="ms-pill warn">${ic('triangle-alert')}${p.late} ${p.late===1?'mes':'meses'} tarde · ${e(fmtDate(p.eta))}</span>`:`<span class="ms-pill warn">${ic('triangle-alert')}Sin capacidad de ahorro definida</span>`;}
 function episodes(m){const name=(m.series?.name||'').trim().toLowerCase();if(!name)return [];return Store.list('contentItems').filter(c=>String(c.series||'').trim().toLowerCase()===name).sort((a,b)=>(a.episode_number||0)-(b.episode_number||0));}
 function scenariosBox(m,p){return `<section class="ms-box"><h3>${ic('git-branch')}Escenarios</h3><p class="ms-note">Cada uno suma o resta a lo que puedes apartar al mes. Actívalo para verlo en la proyección.</p>
  ${p.scenarios.length?`<ul class="ms-scen">${p.scenarios.map(s=>`<li class="${s.active?'on':''}"><label class="ms-switch"><input type="checkbox" data-ms="scen-toggle" data-id="${e(s.id)}" ${s.active?'checked':''}><span aria-hidden="true"></span><span class="sr-only">Activar ${e(s.name)}</span></label><div><strong>${e(s.name)}</strong><small>${s.kind==='income'?'+':'−'}${money(s.monthly_cents)}/mes · solo con este: ${s.eta?e(fmtDate(s.eta)):'sin fecha'} ${s.eta?(s.late?`<em class="warn">${s.late} m tarde</em>`:'<em class="good">a tiempo</em>'):''}</small></div><button type="button" class="icon-button" data-ms="scen-del" data-id="${e(s.id)}" aria-label="Quitar ${e(s.name)}">${ic('x')}</button></li>`).join('')}</ul>`:'<p class="ms-muted">Sin escenarios todavía. Ejemplos: un trabajo de fin de semana (+) o rentar solo (−).</p>'}
  <button type="button" class="button small" data-ms="scen-add">${ic('plus')}Agregar escenario</button></section>`;}
 function seriesBox(m){const name=(m.series?.name||'').trim();
  if(!name)return `<section class="ms-box"><h3>${ic('clapperboard')}Serie de contenido</h3><p class="ms-note">Documenta la misión en una serie (TikTok, Reels o Shorts). Los episodios viven en Contenido.</p><button type="button" class="button small" data-ms="edit">${ic('plus')}Nombrar la serie</button></section>`;
  const eps=episodes(m),pub=eps.filter(x=>['published','analyzed'].includes(x.status)).length,ideas=eps.filter(x=>['idea','research'].includes(x.status)).length;
  return `<section class="ms-box"><h3>${ic('clapperboard')}${e(name)}</h3><div class="ms-ep-stats"><span><b>${pub}</b>publicados</span><span><b>${eps.length-pub-ideas}</b>en producción</span><span><b>${ideas}</b>ideas</span></div>
   ${eps.length?`<ol class="ms-eps">${eps.slice(-6).map(x=>`<li><a href="#contenido/${e(x.id)}"><span class="ms-ep-n">${e(x.episode_number||'·')}</span><span>${e(x.title||'Sin título')}</span></a><em data-s="${e(x.status)}">${e(STATUS[x.status]||x.status)}</em></li>`).join('')}</ol>`:'<p class="ms-muted">Aún no hay episodios.</p>'}
   <form class="ms-idea" data-ms-form="idea"><input class="input" name="title" maxlength="140" placeholder="Idea de episodio…" aria-label="Idea de episodio"><button class="button small">${ic('plus')}Idea</button></form>
   <a class="ms-link" href="#contenido">${ic('arrow-up-right')}Abrir Contenido</a></section>`;}
 function panel(){const m=cfg();
  if(!m)return `<section class="panel ms ms-empty v8-card" id="ms-panel" aria-label="Misión"><div class="ms-empty-in"><div class="ms-visual ms-static">${silhouette('moto')}</div><div><span class="ms-eyebrow">MISIÓN</span><h2>Define tu misión</h2><p>Ponle nombre, meta en pesos y fecha límite. Ivi calcula cuánto apartar al mes, te proyecta con tus ingresos reales de SOMA y el holograma se arma conforme avanzas.</p><button type="button" class="button primary" data-ms="edit">${ic('rocket')}Crear misión</button></div></div></section>`;
  const p=plan(m);
  return `<section class="panel ms v8-card" id="ms-panel" aria-label="Misión ${e(m.name)}">
   <header class="ms-head"><div><span class="ms-eyebrow">MISIÓN · ${p.pct} %</span><h2>${e(m.name)}</h2><p class="ms-sub">${money(p.saved)} de ${money(p.target)}${m.account_id?' · saldo de tu cuenta':''}</p></div>
    <div class="ms-actions">${m.account_id?'':`<button type="button" class="button primary" data-ms="add">${ic('plus')}Aportar</button>`}<button type="button" class="button" data-ms="edit">${ic('settings-2')}<span>Ajustes</span></button></div></header>
   <div class="ms-grid">
    <div class="ms-visual" data-progress="${p.pct}" data-kind="${e(m.hologram)}" style="--p:${p.pct}">${silhouette(m.hologram)}<div class="ms-ring" aria-hidden="true"><b>${Math.round(p.pct)}<small>%</small></b><span>armado</span></div></div>
    <div class="ms-side">
     <div class="ms-count" data-deadline="${e(m.deadline)}" role="timer" aria-label="Cuenta regresiva a la fecha límite">${countHTML(m.deadline)}</div>
     <p class="ms-until">Hasta el ${e(fmtDate(m.deadline))} ${pill(p)}</p>
     <div class="ms-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}" aria-label="Avance de la misión"><i style="--p:${p.pct}"></i></div>
     <dl class="ms-kpis"><div><dt>Te falta</dt><dd>${money(p.remaining)}</dd></div><div><dt>Necesitas al mes</dt><dd>${money(p.required)}</dd></div>
      <div><dt>Puedes al mes</dt><dd>${money(p.capacity)}</dd><small>SOMA ${money(p.soma)}/mes × ${e(m.soma_share)} %${m.monthly_extra_cents?' + '+money(m.monthly_extra_cents):''}</small></div><div><dt>Proyección</dt><dd>${p.eta?e(fmtDate(p.eta)):'—'}</dd></div></dl>
    </div></div>
   <div class="ms-cols">${scenariosBox(m,p)}${seriesBox(m)}</div></section>`;}
 function financeCard(){const m=cfg();
  if(!m)return `<section class="panel ms-mini v8-card" id="ms-mini" aria-label="Misión"><div class="ms-mini-top"><span class="ms-eyebrow">MISIÓN</span><strong>Ahorra con propósito</strong></div><p class="ms-muted">Define una meta con fecha y Ivi te dice cuánto apartar al mes según tus ingresos reales.</p><a class="button small" href="#objetivos">${ic('rocket')}Crear misión</a></section>`;
  const p=plan(m);
  return `<section class="panel ms-mini v8-card" id="ms-mini" aria-label="Misión ${e(m.name)}"><div class="ms-mini-top"><span class="ms-eyebrow">MISIÓN</span><strong>${e(m.name)}</strong><span class="ms-mini-pct">${p.pct} %</span></div><div class="ms-meter"><i style="--p:${p.pct}"></i></div>
   <p>Te faltan <b>${money(p.remaining)}</b> · necesitas <b>${money(p.required)}</b>/mes · puedes <b>${money(p.capacity)}</b>/mes ${p.done?'':p.onTrack?'<em class="good">a tiempo</em>':`<em class="warn">${p.eta?p.late+' m tarde':'sin fecha'}</em>`}</p>
   <div class="ms-mini-actions">${m.account_id?'':`<button type="button" class="button small primary" data-ms="add">${ic('plus')}Aportar</button>`}<a class="button small" href="#objetivos">${ic('arrow-up-right')}Ver misión</a></div></section>`;}

 /* ---------------- dialogs ---------------- */
 const field=(name,label,value='',type='text',extra='')=>`<label class="ch-field"><span>${label}</span><input class="input" name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
 const form=(title,html,onSubmit)=>{App.openDialog(title,`<form id="ms-form" class="ch-form ms-form">${html}<p class="ch-error" role="alert" hidden></p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('check')}Guardar</button></div></form>`);const f=document.getElementById('ms-form');f.onsubmit=ev=>{ev.preventDefault();try{onSubmit(Object.fromEntries(new FormData(f)),f);App.closeDialog(true);App.render();}catch(err){const p=f.querySelector('.ch-error');p.hidden=false;p.textContent=err.message;}};};
 function editDialog(){const cur=cfg(),m=cur||{...DEF,name:'',target_cents:0,deadline:addDays(today(),365)},acc=(P().evieAccounts||[]).filter(a=>!a.archived&&a.type!=='credit');
  form(cur?'Ajustes de la misión':'Nueva misión',field('name','Nombre de la misión',m.name,'text','required maxlength="60" placeholder="Ej. Moto, viaje, laptop"')+
   `<div class="ms-row">${field('target','Meta ($)',m.target_cents?pesos(m.target_cents):'','text','required inputmode="decimal" placeholder="0.00"')}${field('deadline','Fecha límite',m.deadline,'date','required')}</div>`+
   `<label class="ch-field"><span>¿De dónde sale lo ahorrado?</span><select class="select" name="account_id"><option value="">Lo registro yo (aportes)</option>${acc.map(a=>`<option value="${e(a.id)}" ${m.account_id===a.id?'selected':''}>Saldo de mi cuenta «${e(a.name)}»</option>`).join('')}</select></label>`+
   field('saved','Ahorro actual ($) · si lo registras tú',m.saved_cents?pesos(m.saved_cents):'','text','inputmode="decimal" placeholder="0.00"')+
   `<div class="ms-row">${field('soma_share','% de SOMA para la misión',m.soma_share,'number','min="0" max="100" step="1"')}${field('extra','Aporte extra al mes ($)',m.monthly_extra_cents?pesos(m.monthly_extra_cents):'','text','inputmode="decimal" placeholder="0.00"')}</div>`+
   `<div class="ms-row">${field('series','Serie de contenido (opcional)',m.series?.name||'','text','maxlength="80" placeholder="Nombre de la serie"')}<label class="ch-field"><span>Plataforma</span><select class="select" name="platform">${[['tiktok','TikTok'],['instagram_reels','Reels'],['youtube_shorts','Shorts'],['multiple','Varias']].map(([v,l])=>`<option value="${v}" ${m.series?.platform===v?'selected':''}>${l}</option>`).join('')}</select></label></div>`+
   `<label class="ch-field"><span>Holograma</span><select class="select" name="hologram"><option value="moto" ${m.hologram!=='orb'?'selected':''}>Moto deportiva</option><option value="orb" ${m.hologram==='orb'?'selected':''}>Núcleo de energía</option></select></label>`+
   (cur?`<button type="button" class="button small ms-del" data-ms="delete">${ic('trash-2')}Borrar misión</button>`:''),
   d=>{const name=d.name.trim().slice(0,60),target=cents(d.target);if(!name)throw Error('Ponle nombre a tu misión.');if(!(target>0))throw Error('Escribe la meta en pesos.');if(!/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)||d.deadline<=today())throw Error('La fecha límite debe ser futura.');
    const saved=d.account_id?null:cents(d.saved),extra=cents(d.extra);
    save(x=>{Object.assign(x,{name,target_cents:target,deadline:d.deadline,account_id:d.account_id||null,saved_cents:saved==null?(x.saved_cents||0):saved,soma_share:Math.max(0,Math.min(100,Math.round(Number(d.soma_share)||0))),monthly_extra_cents:extra,series:{name:String(d.series||'').trim().slice(0,80),platform:d.platform||'tiktok'},hologram:d.hologram==='orb'?'orb':'moto',created_at:x.created_at||new Date().toISOString()});});
    App.toast('Misión guardada.','success');});}
 function addDialog(){const m=cfg();if(!m)return;form('Aportar a «'+m.name+'»',field('amount','Monto ($)','','text','required inputmode="decimal" placeholder="0.00" autofocus'),d=>{const c=cents(d.amount);if(!(c>0))throw Error('Escribe el monto.');save(x=>{x.saved_cents=Math.max(0,Math.round(x.saved_cents||0)+c);});window.EvieSounds?.play?.('success');App.toast(`Aporte de ${money(c)} guardado. Vas al ${plan().pct} %.`,'success');});}
 function scenDialog(){form('Nuevo escenario',field('name','Nombre','','text','required maxlength="50" placeholder="Ej. Trabajo de fin de semana"')+`<div class="ms-row"><label class="ch-field"><span>Tipo</span><select class="select" name="kind"><option value="income">Ingreso extra (+)</option><option value="expense">Gasto nuevo (−)</option></select></label>${field('amount','Monto al mes ($)','','text','required inputmode="decimal" placeholder="0.00"')}</div>`,
  d=>{const c=cents(d.amount),name=d.name.trim();if(!name||!(c>0))throw Error('Escribe el nombre y el monto.');save(x=>{x.scenarios=[...(x.scenarios||[]),{id:uid(),name:name.slice(0,50),kind:d.kind==='expense'?'expense':'income',monthly_cents:c,active:false}].slice(0,12);},{snapshot:false});});}
 function remove(){if(!confirm('¿Borrar la misión? El objetivo vinculado se archiva; tus aportes registrados se pierden.'))return;Store.save(s=>{const g=s.preferences.mission?.goal_id&&s.goals.find(x=>x.id===s.preferences.mission.goal_id);if(g)Object.assign(g,{archived:true,updated_at:new Date().toISOString()});delete s.preferences.mission;});App.closeDialog(true);App.render();App.toast('Misión borrada.','success');}

 /* ---------------- events + lifecycle ---------------- */
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-ms]');if(!b||b.matches('input'))return;const a=b.dataset.ms;
  if(a==='edit')editDialog();else if(a==='add')addDialog();else if(a==='scen-add')scenDialog();else if(a==='delete')remove();
  else if(a==='scen-del'){save(x=>{x.scenarios=(x.scenarios||[]).filter(s=>s.id!==b.dataset.id);},{snapshot:false});App.render();}});
 document.addEventListener('change',ev=>{const b=ev.target.closest?.('[data-ms="scen-toggle"]');if(!b)return;save(x=>{const s=(x.scenarios||[]).find(y=>y.id===b.dataset.id);if(s)s.active=b.checked;},{snapshot:false});App.render();});
 document.addEventListener('submit',ev=>{const f=ev.target.closest?.('[data-ms-form="idea"]');if(!f)return;ev.preventDefault();const t=f.elements.title.value.trim(),m=cfg();if(!t||!m?.series?.name)return;
  const n=episodes(m).reduce((a,x)=>Math.max(a,Number(x.episode_number)||0),0)+1;const r=Store.record(Records.normalize('contentItems',{title:t.slice(0,140),platform:m.series.platform||'tiktok',format:'short',series:m.series.name,episode_number:n,status:'idea'}));
  Store.save(s=>s.contentItems.push(structuredClone(r)));App.render();App.toast('Idea guardada en Contenido.','success');});
 let timer=null,lastSection='',snapKey='';
 function tick(){const box=document.querySelector('.ms-count[data-deadline]');if(!box){clearInterval(timer);timer=null;return;}const c=countParts(box.dataset.deadline);for(const [u,v] of Object.entries({d:c.d,h:String(c.h).padStart(2,'0'),m:String(c.m).padStart(2,'0')})){const n=box.querySelector(`[data-u="${u}"]`);if(n&&n.textContent!==String(v))n.textContent=v;}}
 /** Daily snapshot of the saved amount + goal mirror, so account-linked missions and the weekly review stay current. */
 function snapshot(){const m=cfg();if(!m)return;const t=today(),v=savedOf(m),last=m.history.at(-1),g=m.goal_id&&Store.list('goals').find(x=>x.id===m.goal_id);
  const goalOk=!!g&&g.target===Math.max(1,Math.round(m.target_cents/100))&&g.progress===Math.min(g.target,Math.floor(v/100));
  if(last?.date===t&&last.saved_cents===v&&goalOk)return;const key=t+':'+v;if(snapKey===key)return;snapKey=key;setTimeout(()=>{try{save(()=>{});}catch{}},0);}
 function afterRender(){const sec=UI.section;if(sec!=='objetivos'&&sec!=='finanzas'){window.MissionHologram?.stop?.();clearInterval(timer);timer=null;lastSection=sec;return;}
  const main=document.getElementById('main-content');if(!main)return;let inserted=null;
  if(sec==='objetivos'&&!UI.id&&!main.querySelector('#ms-panel')){main.querySelector('.page-heading')?.insertAdjacentHTML('afterend',panel());inserted=main.querySelector('#ms-panel');}
  if(sec==='finanzas'&&!UI.id&&!main.querySelector('#ms-mini')){const a=main.querySelector('#finance-chart')||main.querySelector('#evm-accounts')||main.querySelector('.summary-grid')||main.querySelector('.page-heading');a?.insertAdjacentHTML('afterend',financeCard());inserted=main.querySelector('#ms-mini');}
  try{window.lucide?.createIcons?.({root:main});}catch{}
  const host=main.querySelector('.ms-visual:not(.ms-static)');if(host&&!host.querySelector('canvas'))window.MissionHologram?.mount?.(host);
  if(main.querySelector('.ms-count')){tick();if(!timer)timer=setInterval(tick,30000);}
  snapshot();
  if(inserted&&lastSection!==sec&&window.Motion?.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){try{Motion.animate(inserted.querySelectorAll('.ms-head,.ms-visual,.ms-side,.ms-box,.ms-mini-top,.ms-meter'),{opacity:[0,1],y:[12,0]},{type:'spring',stiffness:260,damping:26,delay:Motion.stagger?.(.04)||0});}catch{}}
  lastSection=sec;}
 /** «¿Cómo va mi misión?» → spoken status from real numbers (no AI). */
 function intent(text){const t=String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');if(!/\bmision\b/.test(t)||!/(como va|como vamos|cuanto (me )?falta|avance|estado|status|proyeccion)/.test(t))return '';const p=plan();
  if(!p)return 'Todavía no tienes una misión. Créala en Objetivos con nombre, meta y fecha límite.';
  if(p.done)return `Misión «${p.name}» cumplida: juntaste ${money(p.saved)}. Bien hecho.`;
  return `Misión «${p.name}» al ${p.pct} por ciento: llevas ${money(p.saved)} de ${money(p.target)}. Te faltan ${money(p.remaining)}; necesitas ${money(p.required)} al mes y hoy puedes ${money(p.capacity)}. ${p.eta?(p.onTrack?`A este ritmo llegas el ${fmtDate(p.eta)}, a tiempo.`:`A este ritmo llegas el ${fmtDate(p.eta)}, ${p.late} ${p.late===1?'mes':'meses'} tarde.`):'Sin una capacidad de ahorro definida no puedo proyectar la fecha.'}`;}
 return Object.freeze({cfg,plan,savedOf,savedOn,somaMonthly,panel,financeCard,afterRender,intent,addScenarios,editDialog,addDialog});
})();
