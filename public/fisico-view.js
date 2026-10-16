'use strict';
/* Físico (reemplaza «Salud y gym»). Vista principal = cuerpo frente/espalda con grupos musculares; las vistas
   existentes de entrenos (V2Views.gym) y de comidas/calorías se conservan como pestañas secundarias.
   Datos: SOLO la colección existente gymSessions (sin base paralela). Preferencia de silueta en
   preferences.fisicoPresentation (la elige el usuario; nunca se infiere). */
window.EvieFisico=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const i=n=>window.Views?Views.icon(n):'';
 const C=()=>window.FisicoCore,B=()=>window.FisicoBody;
 const today=()=>Domain.today();
 const live=()=>Store.list('gymSessions').filter(s=>!s.deleted_at);
 const PRES={neutral:'Neutra (predeterminada)',masc:'Hombros más anchos',fem:'Caderas más anchas'};
 const pres=()=>{const p=Store.get()?.preferences?.fisicoPresentation;return PRES[p]?p:'neutral';};
 const TABS=[['cuerpo','Cuerpo','person-standing'],['entrenos','Entrenamientos','dumbbell'],['comidas','Comidas y calorías','utensils']];
 const tab=()=>TABS.some(t=>t[0]===UI.fisicoTab)?UI.fisicoTab:'cuerpo';
 const when=d=>d==null?'sin registros':d===0?'hoy':d===1?'ayer':`hace ${d} días`;
 const groupList=keys=>{const L=keys.map(k=>C().GROUPS[k]?.label||k);return L.length<2?L.join(''):L.slice(0,-1).join(', ')+' y '+L.at(-1);};

 function nav(cur){return `<nav class="tabs fis-tabs" aria-label="Secciones de Físico">${TABS.map(([k,l,ic])=>`<button type="button" class="button ${cur===k?'primary':''}" data-fis="tab" data-tab="${k}" aria-current="${cur===k?'page':'false'}">${i(ic)}${l}</button>`).join('')}</nav>`;}
 function heading(){return Views.heading('Físico','Tu cuerpo, lo que entrenaste y cuándo. Sin presión: la recuperación es una referencia, no una regla.',`<button class="button primary" data-evg="new">${i('plus')}Registrar sesión</button>`,'MOVIMIENTO CON CONTEXTO');}

 function view(id){
  if(id)return relabel(V2Views.gym(id));
  const t=tab();
  if(t!=='cuerpo'){const food=['nutrition','pantry'].includes(UI.rcGymTab);const tt=food?'comidas':'entrenos';UI.fisicoTab=tt;return heading()+nav(tt)+secondary(V2Views.gym(),tt);}
  return heading()+nav(t)+bodyView();}
 // Delegated views keep their controls; only their big heading is demoted to a sub-heading.
 function secondary(html,tt){const tp=document.createElement('template');tp.innerHTML=html;const h=tp.content.querySelector('.page-heading');
  if(h){h.classList.add('fis-subheading');const h1=h.querySelector('h1');if(h1){const h2=document.createElement('h2');h2.innerHTML=h1.innerHTML==='Gimnasio'?'Entrenamientos':h1.innerHTML;h1.replaceWith(h2);}h.querySelector('.eyebrow')?.remove();
   h.querySelector('[data-evg="new"]')?.remove();}
  // The legacy nav mixes training + food; keep only the part that belongs to this tab.
  const gn=tp.content.querySelector('.gym-tabs');if(gn){if(tt==='comidas')gn.remove();else gn.querySelectorAll('.gym-tab-group').forEach((g,n)=>{if(n>0)g.remove();});}
  tp.content.querySelectorAll('a[href="#gimnasio"]').forEach(a=>a.setAttribute('href','#fisico'));return tp.innerHTML;}
 function relabel(html){return String(html).replace(/href="#gimnasio"/g,'href="#fisico"').replace('GIMNASIO / SESIÓN','FÍSICO / SESIÓN');}

 function bodyView(){const sessions=live(),sum=C().summary(sessions,today()),sel=C().GROUPS[UI.fisicoSel]?UI.fisicoSel:null,p=pres();
  const todays=C().sessionOn(sessions,today());
  const legend=`<ul class="fis-legend" aria-label="Leyenda">${['fresh','mid','ready','idle'].map(b=>`<li><span class="fis-swatch" data-band="${b}" aria-hidden="true"></span>${e(C().BAND_TEXT[b])}</li>`).join('')}</ul>`;
  const strip=todays.length?`<section class="panel fis-today" aria-label="Hoy"><span class="eyebrow">HOY</span>${todays.map(s=>{const g=C().sessionGroups(s);return `<p><a href="#fisico/${e(s.id)}">${e(s.title)}</a> · ${e(groupList(g.primary))||'sin músculos asignados'}${(s.exercises||[]).every(x=>!(x.sets||[]).length)?` <button class="button small" data-evg="edit" data-id="${e(s.id)}">${i('list-plus')}Agregar ejercicios y series</button>`:''}</p>`;}).join('')}</section>`
   :`<section class="panel fis-today"><span class="eyebrow">HOY</span><p>Aún no registras entrenamiento. Dile a Ivi «hoy entrené pecho y espalda» o pulsa <strong>Registrar sesión</strong>.</p></section>`;
  const fig=w=>`<figure class="fis-figure"><figcaption>${w==='front'?'Frente':'Espalda'}</figcaption>${B().view(w,{summary:sum,presentation:p,selected:sel})}</figure>`;
  const rows=Object.values(sum).sort((a,b)=>(a.days_since??999)-(b.days_since??999));
  const list=`<section class="panel fis-groups"><h2>Por grupo muscular</h2><ul>${rows.map(s=>`<li><button type="button" class="fis-row ${sel===s.key?'on':''}" data-fis="pick" data-m="${s.key}" aria-pressed="${sel===s.key}"><span class="fis-swatch" data-band="${s.band}" aria-hidden="true"></span><strong>${e(s.label)}</strong><small>${e(when(s.days_since))}${s.partial?' · secundario':''}${s.sessions_7d?` · ${s.sessions_7d}× en 7 días`:''}</small></button></li>`).join('')}</ul></section>`;
  return `${strip}<div class="fis-layout"><section class="panel fis-body" aria-label="Mapa corporal"><div class="fis-body-head"><h2>Mapa corporal</h2><label class="fis-pres">Silueta<select class="select" data-fis="pres" aria-label="Silueta del cuerpo">${Object.entries(PRES).map(([k,l])=>`<option value="${k}" ${p===k?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="fis-figures">${fig('front')}${fig('back')}</div>${legend}</section><aside class="fis-side">${detail(sel,sum,sessions)}${list}</aside></div>
   <p class="fis-note">${i('info')}<span>La franja de recuperación usa ~48–72 h como referencia práctica para trabajo intenso del mismo grupo. Las guías (ACSM 2026, OMS/HHS) recomiendan trabajar cada grupo mayor al menos 2 días por semana y ajustar según tu sueño, dolor, experiencia y objetivos. No es consejo médico.</span></p>`;}

 function detail(sel,sum,sessions){if(!sel)return `<section class="panel fis-detail"><h2>Toca un músculo</h2><p>Verás la última vez que lo trabajaste y las sesiones que lo incluyen.</p></section>`;
  const s=sum[sel],ids=new Set(s.session_ids),rows=sessions.filter(x=>ids.has(x.id)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  return `<section class="panel fis-detail" id="fis-detail" aria-live="polite"><span class="eyebrow">${e(s.label.toUpperCase())}</span><h2>${s.last_date?'Último: '+e(Views.date(s.last_date)):'Sin registros'}</h2><p class="fis-band"><span class="fis-swatch" data-band="${s.band}" aria-hidden="true"></span>${e(B().bandText(s))}</p>
   ${rows.length?`<ul class="fis-sessions">${rows.map(r=>{const g=C().sessionGroups(r),role=g.primary.includes(sel)?'principal':'secundario';return `<li><a href="#fisico/${e(r.id)}">${e(r.title)}</a><small>${e(Views.date(r.date))} · ${role}${Array.isArray(r.muscle_override)&&r.muscle_override.length?' · mapeo ajustado':''}</small><button class="button small" data-fis="map" data-id="${e(r.id)}">${i('sliders-horizontal')}Ajustar músculos</button></li>`;}).join('')}</ul>`:'<p>Ninguna sesión registrada incluye este grupo.</p>'}</section>`;}

 /* Ajuste de mapeo: el usuario decide qué grupos cuenta una sesión (muscle_override). No toca ejercicios ni series. */
 function mapDialog(id){const s=live().find(x=>x.id===id);if(!s)return;const cur=new Set(C().sessionGroups(s).primary);
  App.openDialog('Ajustar músculos',`<p class="dialog-subtitle">${e(s.title)} · ${e(Views.date(s.date))}. Elige qué grupos cuenta esta sesión en el mapa. Tus ejercicios y series no cambian.</p><form id="fis-map-form" class="fis-map-form"><fieldset><legend>Grupos</legend>${Object.entries(C().GROUPS).map(([k,g])=>`<label><input type="checkbox" name="m" value="${k}" ${cur.has(k)?'checked':''}>${e(g.label)}</label>`).join('')}</fieldset><footer class="form-footer full">${Array.isArray(s.muscle_override)&&s.muscle_override.length?'<button type="button" class="button" data-fis="map-reset">Usar los músculos de los ejercicios</button>':''}<button class="button primary">Guardar</button></footer></form>`);
  const f=document.getElementById('fis-map-form');
  f.onsubmit=ev=>{ev.preventDefault();const v=[...f.querySelectorAll('input:checked')].map(x=>x.value);const prev=s.muscle_override??null;Store.put('gymSessions',{muscle_override:v.length?v:null},id);App.closeDialog(true);App.render();App.toast('Mapeo actualizado.','success',()=>{Store.put('gymSessions',{muscle_override:prev},id);App.render();});};
  f.querySelector('[data-fis="map-reset"]')?.addEventListener('click',()=>{const prev=s.muscle_override;Store.put('gymSessions',{muscle_override:null},id);App.closeDialog(true);App.render();App.toast('Mapeo restablecido.','success',()=>{Store.put('gymSessions',{muscle_override:prev},id);App.render();});});}

 /* Registro rápido «hoy entrené pecho y espalda»: crea UNA sesión parcial o completa la de voz del día; nunca duplica. */
 let lastOp=null;
 function logWorkout({groups,date,op_id,title}={}){const G=C();groups=(groups||[]).filter(k=>G.GROUPS[k]);date=date||today();
  if(!groups.length)return {status:'needs',field:'muscles',question:'¿Qué músculos trabajaste? Por ejemplo: pecho y espalda, o pierna.'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today())return {status:'error',error:'Fecha no válida.'};
  const all=live();if(op_id&&all.some(s=>s.op_id===op_id))return {status:'duplicate',say:'Ya lo había registrado.'};
  const key=date+'|'+groups.slice().sort().join(',');if(lastOp&&lastOp.key===key&&Date.now()-lastOp.at<120000)return {status:'duplicate',say:'Ya lo había registrado.'};
  const day=G.sessionOn(all,date),covered=new Set(day.flatMap(s=>G.sessionGroups(s).primary)),missing=groups.filter(k=>!covered.has(k)),label=date===today()?'hoy':'el '+Views.date(date);
  if(!missing.length)return {status:'duplicate',say:`Ya tenías ${groupList(groups)} registrado ${label}.`};
  const voice=day.find(s=>(s.uncertainties||[]).some(u=>/registrado por voz/i.test(u))&&!(Array.isArray(s.muscle_override)&&s.muscle_override.length));
  let res;
  if(voice){const prev={exercises:voice.exercises,title:voice.title},m=G.mergeGroups(voice,missing),groupsNow=[...G.sessionGroups(voice).primary,...m.add];
   const patch={exercises:m.exercises,title:/^[A-ZÁÉÍÓÚ]/.test(voice.title)&&voice.title===groupList(G.sessionGroups(voice).primary)?groupList(groupsNow).slice(0,80):voice.title};
   V2Domain.gym({...voice,...patch});Store.put('gymSessions',patch,voice.id);
   res={status:'updated',id:voice.id,undo:()=>{Store.put('gymSessions',prev,voice.id);App.render();}};}
  else{const row=G.quickSession({groups:missing,date,title,op_id});V2Domain.gym(row);const saved=Store.put('gymSessions',row);res={status:'created',id:saved.id,undo:()=>{Store.remove('gymSessions',saved.id);App.render();}};}
  lastOp={key,at:Date.now()};
  const also=missing.length<groups.length?` (${groupList(groups.filter(k=>covered.has(k)))} ya estaba)`:'';
  res.say=`Anotado: ${groupList(missing)} ${label}${also}. Si quieres, agrega ejercicios y series en Físico.`;res.groups=missing;return res;}

 const DO=/^(?:(hoy|ayer|antier|anteayer)\s+)?(?:(?:registra|anota|apunta)\s+que\s+)?(?:(hoy|ayer)\s+)?(?:entrene|entreno|trabaje|hice|ejercite|me toco|fui al gym a hacer|fui al gimnasio a hacer)\s+(?:de\s+|el\s+|la\s+|los\s+|las\s+)?(.+?)(?:\s+(hoy|ayer))?$/;
 /** Local intent; returns a spoken string or null (not a workout phrase). */
 function intent(text){const q=C().norm(String(text||'')).replace(/^(?:oye |hey |hola |ok )?(?:evie|evi|ivi|ivy|ibi|libi|eby|evy)\s+/,'').trim();const m=q.match(DO);if(!m)return null;
  const groups=C().groupsFrom(m[3]);if(!groups.length)return null;const w=m[1]||m[2]||m[4]||'hoy',date=w==='hoy'?today():V2Domain.addDays(today(),w==='ayer'?-1:-2);
  try{const r=logWorkout({groups,date});if(r.undo){App.render();App.toast(r.say,'success',r.undo);window.EvieSounds?.play?.('confirm');window.EvieFinance?.setLastUndo?.(r.undo);}return r.say||r.question||r.error;}catch(err){return 'No pude registrarlo: '+err.message;}}

 function migratePrefs(){const p=Store.get()?.preferences;if(!p)return;const keys=['hiddenSections','sectionOrder','favoriteSections','mobileShortcuts'];
  if(!keys.some(k=>Array.isArray(p[k])&&p[k].includes('gimnasio')))return;
  Store.save(s=>{for(const k of keys)if(Array.isArray(s.preferences[k]))s.preferences[k]=[...new Set(s.preferences[k].map(x=>x==='gimnasio'?'fisico':x))];});}
 let migrated=false;
 function afterRender(){if(!migrated){migrated=true;try{migratePrefs();}catch{}}
  if(UI.section!=='fisico'||UI.id)return;const main=document.getElementById('main-content');
  main.querySelectorAll('.fb-m').forEach(p=>p.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();p.dispatchEvent(new MouseEvent('click',{bubbles:true}));}}));}
 document.addEventListener('click',ev=>{const m=ev.target.closest?.('.fb-m');if(m&&UI.section==='fisico'){UI.fisicoSel=UI.fisicoSel===m.dataset.m?null:m.dataset.m;App.render();document.querySelector(`.fb-m[data-m="${UI.fisicoSel}"]`)?.focus();return;}
  const b=ev.target.closest?.('[data-fis]');if(!b)return;const a=b.dataset.fis;
  if(a==='tab'){UI.fisicoTab=b.dataset.tab;if(b.dataset.tab==='entrenos')UI.rcGymTab='training';else if(b.dataset.tab==='comidas')UI.rcGymTab='nutrition';App.render();}
  else if(a==='pick'){UI.fisicoSel=UI.fisicoSel===b.dataset.m?null:b.dataset.m;App.render();document.querySelector(`[data-fis="pick"][data-m="${b.dataset.m}"]`)?.focus();}
  else if(a==='map')mapDialog(b.dataset.id);});
 document.addEventListener('change',ev=>{const s=ev.target.closest?.('[data-fis="pres"]');if(!s)return;Store.save(st=>{st.preferences.fisicoPresentation=PRES[s.value]?s.value:'neutral';});App.render();});
 return Object.freeze({view,logWorkout,intent,afterRender,migratePrefs,PRES});
})();
