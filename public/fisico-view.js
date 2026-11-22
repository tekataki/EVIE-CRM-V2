'use strict';
/* Físico = solo «Cuerpo» (v10): escáner corporal frente/espalda con el mapa de recuperación muscular
   (rojo <24 h · amarillo 24–48 h · verde ≥48 h) + medidas y peso (FisicoMeasures, colección `metrics`).
   Los entrenos y las comidas se llevan en otras apps: aquí solo se anota QUÉ día se entrenó qué grupo
   («el lunes entrené pecho y espalda», chips «Entrené hoy»), como un registro ligero en la colección
   existente `gymSessions` (con `trained_at`). Los datos antiguos se conservan; solo dejaron de mostrarse.
   Preferencia de silueta en preferences.fisicoPresentation (la elige el usuario; nunca se infiere). */
window.EvieFisico=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const i=n=>window.Views?Views.icon(n):'';
 const C=()=>window.FisicoCore,B=()=>window.FisicoBody;
 const today=()=>Domain.today();
 const live=()=>Store.list('gymSessions').filter(s=>!s.deleted_at);
 const PRES={neutral:'Neutra (predeterminada)',masc:'Hombros más anchos',fem:'Caderas más anchas'};
 const pres=()=>{const p=Store.get()?.preferences?.fisicoPresentation;return PRES[p]?p:'neutral';};
 const trainHour=()=>{const h=Number(Store.get()?.preferences?.fisicoTrainHour);return Number.isInteger(h)&&h>=0&&h<=23?h:10;};
 const groupList=keys=>{const L=keys.map(k=>C().GROUPS[k]?.label||k);return L.length<2?L.join(''):L.slice(0,-1).join(', ')+' y '+L.at(-1);};
 /** Current recovery map (per muscle group) from the training-day records. */
 const recovery=(now=Date.now())=>C().recovery(live(),now,{hour:trainHour()});

 function heading(){return Views.heading('Físico','Tu cuerpo, tu recuperación y tus medidas. Dile a Ivi qué entrenaste y el mapa se pone al día.','','CUERPO Y RECUPERACIÓN');}
 function view(id){if(id){try{history.replaceState(null,'','#fisico');}catch{}UI.id=null;}return heading()+bodyView();}

 function bodyView(){const p=pres();
  const presControl=`<label class="fis-pres fm-pres">${i('person-standing')}<span class="sr-only">Silueta</span><select class="select" data-fis="pres" aria-label="Silueta del cuerpo">${Object.entries(PRES).map(([k,l])=>`<option value="${k}" ${p===k?'selected':''}>${e(l)}</option>`).join('')}</select></label>`;
  if(window.FisicoMeasures)return FisicoMeasures.tab({presentation:p,presControl});
  const sum=C().summary(live(),today());
  return `<section class="panel fis-body" aria-label="Mapa corporal"><div class="fis-body-head"><h2>Mapa corporal</h2>${presControl}</div><div class="fis-figures">${['front','back'].map(w=>`<figure class="fis-figure"><figcaption>${w==='front'?'Frente':'Espalda'}</figcaption>${B().view(w,{summary:sum,presentation:p})}</figure>`).join('')}</div></section>`;}

 /* Corregir un día de entreno: el usuario decide qué grupos cuenta (muscle_override). */
 function mapDialog(id){const s=live().find(x=>x.id===id);if(!s)return;const cur=new Set(C().sessionGroups(s).primary);
  App.openDialog('Corregir entrenamiento',`<p class="dialog-subtitle">${e(Views.date(s.date))}. Marca los grupos que entrenaste ese día; el mapa de recuperación se actualiza.</p><form id="fis-map-form" class="fis-map-form"><fieldset><legend>Grupos</legend>${Object.entries(C().GROUPS).map(([k,g])=>`<label><input type="checkbox" name="m" value="${k}" ${cur.has(k)?'checked':''}>${e(g.label)}</label>`).join('')}</fieldset><footer class="form-footer full"><button class="button primary">Guardar</button></footer></form>`);
  const f=document.getElementById('fis-map-form');
  f.onsubmit=ev=>{ev.preventDefault();const v=[...f.querySelectorAll('input:checked')].map(x=>x.value);if(!v.length){App.toast('Marca al menos un grupo, o borra el entrenamiento.','error');return;}
   const prev={muscle_override:s.muscle_override??null,title:s.title};Store.put('gymSessions',{muscle_override:v,title:groupList(v).slice(0,80)},id);App.closeDialog(true);App.render();App.toast('Entrenamiento corregido.','success',()=>{Store.put('gymSessions',prev,id);App.render();});};}
 function removeDay(id){const s=live().find(x=>x.id===id);if(!s)return;const {id:_i,deleted_at:_d,created_at:_c,updated_at:_u,...copy}=s;Store.remove('gymSessions',id);App.render();
  App.toast(`Entrenamiento del ${Views.date(s.date)} borrado.`,'success',()=>{Store.put('gymSessions',copy);App.render();});}

 /* Registro rápido «hoy entrené pecho y espalda»: crea UN día de entreno o completa el del mismo día; nunca duplica. */
 let lastOp=null;
 function logWorkout({groups,date,op_id,title,hint}={}){const G=C();groups=(groups||[]).filter(k=>G.GROUPS[k]);date=date||today();
  if(!groups.length)return {status:'needs',field:'muscles',question:'¿Qué músculos trabajaste? Por ejemplo: pecho y espalda, o pierna.'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today())return {status:'error',error:'Fecha no válida.'};
  const all=live();if(op_id&&all.some(s=>s.op_id===op_id))return {status:'duplicate',say:'Ya lo había registrado.'};
  const key=date+'|'+groups.slice().sort().join(',');if(lastOp&&lastOp.key===key&&Date.now()-lastOp.at<120000)return {status:'duplicate',say:'Ya lo había registrado.'};
  const day=G.sessionOn(all,date),covered=new Set(day.flatMap(s=>G.sessionGroups(s).primary)),missing=groups.filter(k=>!covered.has(k)),back=Math.round((Date.parse(today()+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000),
   label=back===0?'hoy':back===1?'ayer':back===2?'antier':back<7?'el '+['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][new Date(date+'T12:00:00Z').getUTCDay()]:'el '+Views.date(date);
  if(!missing.length)return {status:'duplicate',say:`Ya tenías ${groupList(groups)} registrado ${label}.`};
  const at=G.stamp({date,today:today(),hint,hour:trainHour()});
  const voice=day.find(s=>(s.uncertainties||[]).some(u=>/registrado por voz/i.test(u))&&!(Array.isArray(s.muscle_override)&&s.muscle_override.length));
  let res;
  if(voice){const prev={exercises:voice.exercises,title:voice.title,trained_at:voice.trained_at??null},m=G.mergeGroups(voice,missing),groupsNow=[...G.sessionGroups(voice).primary,...m.add];
   const patch={exercises:m.exercises,trained_at:voice.trained_at||at,title:/^[A-ZÁÉÍÓÚ]/.test(voice.title)&&voice.title===groupList(G.sessionGroups(voice).primary)?groupList(groupsNow).slice(0,80):voice.title};
   V2Domain.gym({...voice,...patch});Store.put('gymSessions',patch,voice.id);
   res={status:'updated',id:voice.id,undo:()=>{Store.put('gymSessions',prev,voice.id);App.render();}};}
  else{const row=G.quickSession({groups:missing,date,title,op_id,trained_at:at});V2Domain.gym(row);const saved=Store.put('gymSessions',row);res={status:'created',id:saved.id,undo:()=>{Store.remove('gymSessions',saved.id);App.render();}};}
  lastOp={key,at:Date.now()};
  const also=missing.length<groups.length?` (${groupList(groups.filter(k=>covered.has(k)))} ya estaba)`:'';
  res.say=`Anotado: ${groupList(missing)} ${label}${also}. Tu mapa de recuperación ya lo marca.`;res.groups=missing;res.date=date;return res;}

 const FILLER=/\b(?:yo|ya|tambien|pues|bueno|si|y|e|de|del|el|la|los|las|con|a|al|tocaba|toco|me toco|dia|hice)\b/g;
 let tokens=null;
 /** Every word that can name a muscle group (to accept «ayer pierna» without a verb, and nothing else). */
 const TOKENS=()=>tokens||(tokens=new Set([...Object.values(C().GROUPS).flatMap(g=>g.aliases),...Object.keys(C().COMBOS)].flatMap(w=>C().norm(w).split(' '))));
 const VERB=/^(?:(.+?)\s+)?(?:entrene|entreno|trabaje|hice|ejercite|me toco|fui al gym a hacer|fui al gimnasio a hacer)\s+(.+)$/;
 /** «el lunes entrené pecho y espalda», «ayer pierna», «hoy entrené upper en la mañana» → {groups,date,hint} or null. */
 function parse(text){const G=C();let q=G.norm(String(text||'')).replace(/^(?:oye |hey |hola |ok )?(?:evie|evi|ivi|ivy|ibi|libi|eby|evy)\s+/,'').replace(/\b(?:registra|anota|apunta) que\b/,' ').replace(/\s+/g,' ').trim();
  const m=q.match(VERB);
  if(!m){const w=G.parseWhen(q);if(w.back==null&&w.dow==null)return null;const left=w.rest.replace(FILLER,' ').trim();
   if(!left||!left.split(' ').every(t=>TOKENS().has(t)))return null;const groups=G.groupsFrom(left);if(!groups.length)return null;
   const r=G.resolveWhen(w,today());return {groups,date:r.date,hint:r.hint};}
  const pre=G.parseWhen(m[1]||''),tail=G.parseWhen(m[2]);pre.rest=pre.rest.replace(FILLER,' ').trim();
  if(pre.rest||/\bmanana\b/.test(tail.rest))return null;
  const groups=G.groupsFrom(tail.rest);if(!groups.length)return null;
  const w=G.resolveWhen({back:pre.back??tail.back,dow:pre.back==null?(pre.dow??(tail.back==null?tail.dow:null)):null,hint:pre.hint||tail.hint},today());
  return {groups,date:w.date,hint:w.hint};}
 /** Local intent; returns a spoken string or null (not a workout phrase). */
 function intent(text){const p=parse(text);if(!p)return null;
  try{const r=logWorkout(p);if(r.undo){App.render();App.toast(r.say,'success',r.undo);window.EvieSounds?.play?.('confirm');window.EvieFinance?.setLastUndo?.(r.undo);}return r.say||r.question||r.error;}catch(err){return 'No pude registrarlo: '+err.message;}}

 function migratePrefs(){const p=Store.get()?.preferences;if(!p)return;const keys=['hiddenSections','sectionOrder','favoriteSections','mobileShortcuts'];
  if(!keys.some(k=>Array.isArray(p[k])&&p[k].includes('gimnasio')))return;
  Store.save(s=>{for(const k of keys)if(Array.isArray(s.preferences[k]))s.preferences[k]=[...new Set(s.preferences[k].map(x=>x==='gimnasio'?'fisico':x))];});}
 let migrated=false;
 function afterRender(){if(!migrated){migrated=true;try{migratePrefs();}catch{}}
  try{window.FisicoMeasures?.afterRender?.();}catch{}
  if(UI.section!=='fisico')return;const main=document.getElementById('main-content');
  main.querySelectorAll('.fb-m').forEach(p=>p.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();p.dispatchEvent(new MouseEvent('click',{bubbles:true}));}}));}
 document.addEventListener('click',ev=>{const m=ev.target.closest?.('.fb-m');if(m&&UI.section==='fisico'){
   if(window.FisicoMeasures&&m.closest('.fm-stage')){FisicoMeasures.pickFromEvent(m,ev);return;}
   UI.fisicoSel=UI.fisicoSel===m.dataset.m?null:m.dataset.m;App.render();document.querySelector(`.fb-m[data-m="${UI.fisicoSel}"]`)?.focus();return;}
  const b=ev.target.closest?.('[data-fis]');if(!b)return;const a=b.dataset.fis;
  if(a==='map')mapDialog(b.dataset.id);else if(a==='del-day')removeDay(b.dataset.id);});
 document.addEventListener('change',ev=>{const s=ev.target.closest?.('[data-fis="pres"]');if(!s)return;Store.save(st=>{st.preferences.fisicoPresentation=PRES[s.value]?s.value:'neutral';});App.render();});
 return Object.freeze({view,logWorkout,intent,parse,recovery,trainHour,afterRender,migratePrefs,mapDialog,removeDay,PRES});
})();
