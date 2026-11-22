'use strict';
/* fisico-measures.js · v8 (2026-11-22) — Físico › Cuerpo: escáner corporal + medidas + peso.
   Datos: SOLO la colección existente `metrics` (sin base paralela). Cada registro (check-in):
     {id,date,weight?,body_fat?,measurements?:{neck,shoulders,chest,waist,hips,biceps_l,biceps_r,forearm,thigh_l,thigh_r,calf_l,calf_r},note?}
   El peso es opcional si hay medidas; los registros antiguos de solo peso siguen siendo válidos.
   Cadencia (referencias prácticas, no consejo médico):
   - Peso: 1 vez por semana en las mismas condiciones (mañana, tras ir al baño, antes de comer o beber, poca ropa),
     o pesajes diarios leídos como promedio semanal (The Conversation 2024; WebMD; Cleveland Clinic).
   - Cinta: cada 2–4 semanas (14 días por defecto; el usuario elige 1/2/4 semanas), en la mañana, en ayunas, sin
     el bombeo del entreno, misma tensión y mismos puntos; 2 lecturas por sitio (MacroFactor; Built With Science).
   Parte pura (sin DOM) exportada para pruebas; la UI usa Store/App/Views/UI en tiempo de ejecución. */
(function(root){
 const DAY=86400000;
 const FIELDS=Object.freeze([
  {key:'weight',label:'Peso',unit:'kg',group:'peso',part:'weight',goal:'none',how:'En la mañana, tras ir al baño y antes de comer.'},
  {key:'body_fat',label:'% grasa',unit:'%',group:'peso',part:'weight',goal:'none',how:'Opcional. Usa siempre el mismo método.'},
  {key:'neck',label:'Cuello',unit:'cm',group:'torso',part:'neck',goal:'none',how:'Justo debajo de la manzana de Adán.'},
  {key:'shoulders',label:'Hombros',unit:'cm',group:'torso',part:'shoulders',goal:'up',how:'Parte más ancha, brazos relajados.'},
  {key:'chest',label:'Pecho',unit:'cm',group:'torso',part:'chest',goal:'up',how:'A la altura de los pezones, tras exhalar.'},
  {key:'waist',label:'Cintura',unit:'cm',group:'torso',part:'waist',goal:'none',how:'A la altura del ombligo, sin meter panza.'},
  {key:'hips',label:'Cadera',unit:'cm',group:'torso',part:'hips',goal:'none',how:'Parte más ancha de los glúteos.'},
  {key:'biceps_l',label:'Bíceps izq.',unit:'cm',group:'brazos',part:'arm',side:'l',goal:'up',how:'Parte más ancha; siempre flexionado o siempre relajado.'},
  {key:'biceps_r',label:'Bíceps der.',unit:'cm',group:'brazos',part:'arm',side:'r',goal:'up',how:'Parte más ancha; siempre flexionado o siempre relajado.'},
  {key:'forearm',label:'Antebrazo',unit:'cm',group:'brazos',part:'forearm',goal:'up',how:'Parte más ancha, mano relajada.'},
  {key:'thigh_l',label:'Muslo izq.',unit:'cm',group:'piernas',part:'thigh',side:'l',goal:'up',how:'Parte más ancha, justo bajo el glúteo.'},
  {key:'thigh_r',label:'Muslo der.',unit:'cm',group:'piernas',part:'thigh',side:'r',goal:'up',how:'Parte más ancha, justo bajo el glúteo.'},
  {key:'calf_l',label:'Pantorrilla izq.',unit:'cm',group:'piernas',part:'calf',side:'l',goal:'up',how:'Parte más ancha, de pie.'},
  {key:'calf_r',label:'Pantorrilla der.',unit:'cm',group:'piernas',part:'calf',side:'r',goal:'up',how:'Parte más ancha, de pie.'}].map(Object.freeze));
 const F=Object.freeze(Object.fromEntries(FIELDS.map(f=>[f.key,f])));
 const CM_KEYS=Object.freeze(FIELDS.filter(f=>f.unit==='cm').map(f=>f.key));
 const GROUPS=[['peso','Peso y composición'],['torso','Torso'],['brazos','Brazos'],['piernas','Piernas']];
 const PARTS=Object.freeze({weight:{label:'Peso',keys:['weight','body_fat']},neck:{label:'Cuello',keys:['neck']},shoulders:{label:'Hombros',keys:['shoulders']},chest:{label:'Pecho',keys:['chest']},
  arm:{label:'Bíceps',keys:['biceps_r','biceps_l']},forearm:{label:'Antebrazo',keys:['forearm']},waist:{label:'Cintura',keys:['waist']},hips:{label:'Cadera',keys:['hips']},
  thigh:{label:'Muslo',keys:['thigh_r','thigh_l']},calf:{label:'Pantorrilla',keys:['calf_r','calf_l']}});
 /* Body-map region (FisicoBody keys) → measurement. Arms→bíceps (tríceps is the same arm circumference), legs→muslo,
    abdomen→cintura, glúteos→cadera, espalda→contorno de pecho (the tape goes around the back). */
 const REGION_PART=Object.freeze({neck:'neck',shoulders:'shoulders',chest:'chest',back:'chest',biceps:'arm',triceps:'arm',forearms:'forearm',core:'waist',glutes:'hips',quads:'thigh',hamstrings:'thigh',calves:'calf'});
 const RANGE=Object.freeze({weight:[1,500],body_fat:[2,70],cm:[10,300]});
 const EVERY=Object.freeze([7,14,28]),WEIGH_EVERY=7,MEASURE_EVERY=14;

 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const round2=n=>Math.round(n*100)/100;
 const dateMs=d=>Date.parse(d+'T12:00:00Z');
 const isDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(dateMs(v))&&new Date(dateMs(v)).toISOString().slice(0,10)===v;
 const daysBetween=(a,b)=>Math.round((dateMs(b)-dateMs(a))/DAY);
 const addDays=(d,k)=>new Date(dateMs(d)+k*DAY).toISOString().slice(0,10);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const range=key=>RANGE[key]||RANGE.cm;

 /** Value of one field in a record, or null. Weight 0 (legacy default) counts as «no weight». */
 function valueOf(r,key){if(!r)return null;if(key==='weight')return num(r.weight)&&r.weight>0?r.weight:null;if(key==='body_fat')return num(r.body_fat)?r.body_fat:null;
  const v=r.measurements&&typeof r.measurements==='object'?r.measurements[key]:null;return num(v)?v:null;}
 const live=list=>(Array.isArray(list)?list:[]).filter(r=>r&&!r.deleted_at&&isDate(r.date));
 const byDate=(a,b)=>a.date.localeCompare(b.date)||String(a.created_at||'').localeCompare(String(b.created_at||''));
 /** Ascending [{date,value,id}] for one field. */
 function series(records,key){return live(records).filter(r=>valueOf(r,key)!=null).sort(byDate).map(r=>({date:r.date,value:valueOf(r,key),id:r.id}));}

 /** «36,5» / «36.5» → 36.5 · '' → null · anything else → NaN. Up to 3 integer digits and 2 decimals. */
 function parseNum(v){if(v==null)return null;if(typeof v==='number')return Number.isFinite(v)?round2(v):NaN;const s=String(v).trim().replace(/\s+/g,'').replace(',','.');if(!s)return null;
  if(!/^\d{1,3}(\.\d{1,2})?$/.test(s))return NaN;return round2(Number(s));}

 /** Same rule as Store.validateMetric (kept in sync by tests): '' when valid, otherwise a Spanish message. */
 function check(r){if(!r||!isDate(r.date))return 'Fecha no válida.';
  const has=v=>v!==undefined&&v!==null;
  if(has(r.weight)&&r.weight!==0&&(!num(r.weight)||r.weight<=0||r.weight>500))return 'Peso corporal no válido.';
  if(has(r.body_fat)&&(!num(r.body_fat)||r.body_fat<2||r.body_fat>70))return 'Porcentaje de grasa no válido (2–70 %).';
  let n=0;if(has(r.measurements)){if(typeof r.measurements!=='object'||Array.isArray(r.measurements))return 'Medidas corporales no válidas.';const ks=Object.keys(r.measurements);if(ks.length>30)return 'Medidas corporales no válidas.';
   for(const k of ks){const v=r.measurements[k];if(!/^[a-z][a-z0-9_]{0,23}$/.test(k))return 'Medidas corporales no válidas.';if(v==null)continue;if(!num(v)||v<10||v>300)return 'Medida fuera de rango (10–300 cm).';n++;}}
  if(!(num(r.weight)&&r.weight>0)&&!n&&!has(r.body_fat))return 'Peso corporal no válido.';return '';}

 /** Form entries → {record} or {error, field}. Only keys present in `data` are read. */
 function fromForm(data,{today=null}={}){data=data||{};const date=String(data.date||'');
  if(!isDate(date))return {error:'Elige una fecha válida.',field:'date'};if(today&&date>today)return {error:'La fecha no puede ser futura.',field:'date'};
  const out={date,weight:null,body_fat:null,measurements:{},note:String(data.note||'').trim().slice(0,200)};
  for(const f of FIELDS){if(!Object.prototype.hasOwnProperty.call(data,f.key))continue;const v=parseNum(data[f.key]);if(v==null)continue;const [lo,hi]=range(f.key);
   if(Number.isNaN(v)||v<lo||v>hi)return {error:`${f.label}: escribe un número entre ${lo} y ${hi} ${f.unit}.`,field:f.key};
   if(f.key==='weight')out.weight=v;else if(f.key==='body_fat')out.body_fat=v;else out.measurements[f.key]=v;}
  if(out.weight==null&&out.body_fat==null&&!Object.keys(out.measurements).length)return {error:'Escribe al menos una medida o tu peso.',field:Object.keys(data).find(k=>F[k])||'date'};
  return {record:out};}

 /** Change vs ~1 month: reference = the point closest to `days` before the latest among those ≥ minDays old; otherwise the oldest. */
 function delta(points,{days=30,minDays=21}={}){if(!points||!points.length)return null;const latest=points[points.length-1],prev=points.filter(p=>p.date<latest.date);
  if(!prev.length)return {latest,ref:null,diff:null,days:null};
  const aged=prev.filter(p=>daysBetween(p.date,latest.date)>=minDays),gap=p=>Math.abs(daysBetween(p.date,latest.date)-days);
  const ref=aged.length?aged.reduce((a,b)=>gap(b)<gap(a)?b:a):prev[0];
  return {latest,ref,diff:round2(latest.value-ref.value),days:daysBetween(ref.date,latest.date)};}
 function vsLabel(d){if(d==null)return '';if(d<=0)return 'vs el mismo día';if(d===1)return 'vs ayer';if(d<7)return `vs hace ${d} días`;
  if(d<25){const w=Math.round(d/7);return w===1?'vs hace 1 semana':`vs hace ${w} semanas`;}if(d<=45)return 'vs hace 1 mes';
  const m=Math.round(d/30);if(m<12)return `vs hace ${m} meses`;const y=Math.round(d/365);return y===1?'vs hace 1 año':`vs hace ${y} años`;}
 const fmt=n=>num(n)?n.toLocaleString('es-MX',{maximumFractionDigits:2}):'—';
 const fmtIn=n=>num(n)?String(n):'';
 const signed=n=>!num(n)?'':n===0?'±0':(n>0?'+':'−')+fmt(Math.abs(n));
 /** «+1.2 cm vs hace 1 mes» · «sin cambio vs hace 2 semanas» · «Primera medida» */
 function deltaText(key,d){const f=F[key];if(!d)return '';if(d.diff==null)return 'Primera medida';if(d.diff===0)return `sin cambio ${vsLabel(d.days)}`;return `${signed(d.diff)} ${f?f.unit:''} ${vsLabel(d.days)}`.replace(/\s+/g,' ').trim();}
 /** Tone of a change (never «bad»): good = growth where growth is the usual gym goal; up/down = neutral direction. */
 function tone(key,diff){if(!num(diff)||diff===0)return 'flat';const f=F[key];if(diff>0)return f&&f.goal==='up'?'good':'up';return 'down';}
 function relDay(date,today){if(!isDate(date)||!isDate(today))return '';const d=daysBetween(date,today);if(d<=0)return d<0?'fecha futura':'hoy';if(d===1)return 'ayer';if(d<60)return `hace ${d} días`;
  const m=Math.round(d/30);return m<12?`hace ${m} meses`:'hace más de un año';}

 /** Next weigh-in / tape check from the last check-in of each kind. */
 function cadence(records,today,{weighEvery=WEIGH_EVERY,measureEvery=MEASURE_EVERY}={}){const L=live(records).filter(r=>r.date<=today);
  const last=pred=>L.filter(pred).map(r=>r.date).sort().pop()||null;
  const one=(d,every)=>{if(!d)return {last:null,since:null,left:0,due:true,next:today,every};const since=daysBetween(d,today),left=Math.max(0,every-since);return {last:d,since,left,due:left===0,next:addDays(d,every),every};};
  return {weight:one(last(r=>valueOf(r,'weight')!=null),weighEvery),measure:one(last(r=>CM_KEYS.some(k=>valueOf(r,k)!=null)),measureEvery)};}
 function cadenceText(c,kind){const w=kind==='weight';if(!c||!c.last)return w?'Registra tu primer peso':'Toma tus primeras medidas';if(c.due)return w?'Te toca pesarte':'Te toca medirte';
  if(c.left===1)return w?'Próximo pesaje mañana':'Próxima medición mañana';return w?`Próximo pesaje en ${c.left} días`:`Próxima medición en ${c.left} días`;}
 /** Average of the weigh-ins in the last 7 days (needs ≥2), to smooth daily water swings. */
 function weekAvg(points,today){const r=(points||[]).filter(p=>p.date<=today&&daysBetween(p.date,today)<7);if(r.length<2)return null;return {avg:round2(r.reduce((s,p)=>s+p.value,0)/r.length),n:r.length};}
 /** Tiny inline SVG trend line (≥2 values). */
 function spark(values,{w=120,h=34,label=''}={}){const v=(values||[]).filter(num);if(v.length<2)return '';const min=Math.min(...v),max=Math.max(...v),pad=3;
  const pts=v.map((y,i)=>[pad+(w-2*pad)*i/(v.length-1),max===min?h/2:h-pad-(h-2*pad)*(y-min)/(max-min)]);
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(''),last=pts[pts.length-1];
  const a=label?`role="img" aria-label="${esc(label)}"`:'aria-hidden="true"';
  return `<svg class="fm-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${a} focusable="false"><path class="fm-spark-area" d="${d}L${last[0].toFixed(1)},${h}L${pts[0][0].toFixed(1)},${h}Z"/><path class="fm-spark-line" d="${d}" pathLength="1"/><circle class="fm-spark-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6"/></svg>`;}
 /** Accessible label + state for every body-map region. */
 function regionInfo(records,sel){const out={};for(const [region,part] of Object.entries(REGION_PART)){const P=PARTS[part],vals=P.keys.map(k=>{const s=series(records,k);return s.length?[k,s[s.length-1].value]:null;}).filter(Boolean);
   const txt=vals.length?vals.map(([k,v])=>`${F[k].side?(F[k].side==='r'?'der.':'izq.'):''} ${fmt(v)} ${F[k].unit}`.trim()).join(' · '):'sin medidas, toca para ver';
   out[region]={has:vals.length>0,on:!!sel&&sel.part===part,label:`${P.label}: ${txt}`};}return out;}

 /* ------------------------------ UI (browser) ------------------------------ */
 const ic=n=>root.Views?root.Views.icon(n):'';
 const recs=()=>root.Store.list('metrics');
 const today=()=>root.Domain.today();
 const UIx=()=>root.UI||{};
 const prefEvery=()=>{const v=Number(root.Store.get()?.preferences?.fisicoMeasureEvery);return EVERY.includes(v)?v:MEASURE_EVERY;};
 const dateLabel=d=>{if(!root.Views?.date)return d;const y=String(d).slice(0,4)!==String(today()).slice(0,4);return root.Views.date(d,y?{day:'numeric',month:'short',year:'numeric'}:{day:'numeric',month:'short'});};
 const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';}catch{return true;}};
 const M=()=>reduced()?null:root.Motion&&root.Motion.animate?root.Motion:null;
 /** Motion spring entrance that clears its inline styles afterwards (so CSS hover/transform states keep working). */
 function anim(list,keyframes,opts){const m=M(),els=[...(list||[])];if(!m||!els.length)return;
  const clean=()=>els.forEach(n=>{n.style.opacity='';n.style.transform='';});
  try{const a=m.animate(els,keyframes,{type:'spring',stiffness:260,damping:26,...opts});(a?.finished||Promise.resolve()).then(clean,clean);setTimeout(clean,2000);}catch{clean();}}
 const stagger=(s,o)=>{const m=M();return m&&m.stagger?m.stagger(s,o):0;};
 const current=()=>{const s=UIx().fisicoPart;return s&&PARTS[s.part]?s:null;};
 const allSeries=all=>Object.fromEntries(FIELDS.map(f=>[f.key,series(all,f.key)]));

 function tab({presentation='neutral',presControl=''}={}){const all=recs(),t=today(),S=allSeries(all),cad=cadence(all,t,{measureEvery:prefEvery()}),sel=current(),info=regionInfo(all,sel);
  const face=UIx().fisicoFace==='back'?'back':'front';
  const fig=w=>`<figure class="fis-figure fm-face" data-view="${w}"><figcaption>${w==='front'?'Frente':'Espalda'}</figcaption>${root.FisicoBody.view(w,{presentation,measure:info})}</figure>`;
  return `<div class="fm" data-fm-root><div class="fm-grid">
   <section class="fm-hero" aria-label="Mapa corporal"><header class="fm-hero-head"><div><span class="fm-eyebrow">ESCÁNER CORPORAL</span><h2>Tu cuerpo</h2></div>${presControl}</header>
    <div class="fm-stage v8-tilt" data-tilt="4" data-face="${face}"><div class="fis-figures fm-figures">${fig('front')}${fig('back')}</div><div class="fm-floor" aria-hidden="true"></div></div>
    <div class="fm-face-toggle" role="group" aria-label="Vista del cuerpo">${[['front','Frente'],['back','Espalda']].map(([k,l])=>`<button type="button" data-fm="face" data-face="${k}" aria-pressed="${face===k}">${l}</button>`).join('')}<button type="button" class="fm-turn" data-fm="face" data-face="${face==='front'?'back':'front'}" aria-label="Girar el cuerpo">${ic('rotate-3d')}</button></div>
    <div class="fm-actions fm-hero-actions">${actions()}</div>
    <div class="fm-part" id="fm-part" aria-live="polite">${partPanel(S,sel,t)}</div></section>
   <div class="fm-side">${status(S,cad,t)}${progress(S)}${history(all,S,t)}</div></div></div>`;}

 // Rendered twice (inside the hero for single-column/phone layouts, in the status card on wide screens); CSS shows one.
 const actions=()=>`<button type="button" class="button primary fm-cta" data-fm="measure">${ic('ruler')}Registrar medidas</button><button type="button" class="button fm-ghost" data-fm="weight">${ic('scale')}Registrar peso</button>`;
 function status(S,cad,t){const w=S.weight,lw=w[w.length-1],avg=weekAvg(w,t),every=prefEvery(),pct=c=>c.last?Math.min(100,Math.round(c.since/c.every*100)):100;
  const tile=(kind,icon,label,value,extra,c)=>`<div class="fm-stat ${c.due?'is-due':''}" data-kind="${kind}"><span class="fm-stat-ic" aria-hidden="true">${ic(icon)}</span><div class="fm-stat-txt"><small>${label}</small><strong>${value}</strong>${extra}<span class="fm-stat-sub">${esc(cadenceText(c,kind))}</span></div><span class="fm-ring" style="--p:${pct(c)}" aria-hidden="true"></span></div>`;
  const mLast=cad.measure.last;
  return `<section class="fm-status v8-card" aria-label="Tus próximos registros"><div class="fm-stats">
    ${tile('weight','scale','Peso',lw?`${fmt(lw.value)}<u>kg</u>`:'—',avg?`<span class="fm-stat-avg">Promedio 7 días: ${fmt(avg.avg)} kg</span>`:'',cad.weight)}
    ${tile('measure','ruler','Medidas',mLast?esc(relDay(mLast,t).replace(/^./,c=>c.toUpperCase())):'—','',cad.measure)}</div>
   <div class="fm-actions fm-side-actions">${actions()}</div>
   <div class="fm-foot"><p class="fm-tip">${ic('sunrise')}<span>Pésate cada semana y mide cada 2–4 semanas: en la mañana, en ayunas y tras ir al baño. Cinta sin apretar, siempre en el mismo punto.</span></p>
    <label class="fm-every"><span>Medir cada</span><select class="select" data-fm="every" aria-label="Cada cuánto tomar medidas">${EVERY.map(d=>`<option value="${d}" ${d===every?'selected':''}>${d===7?'semana':d/7+' semanas'}</option>`).join('')}</select></label></div></section>`;}

 function row(S,key,on,t){const f=F[key],pts=S[key],d=delta(pts);
  if(!pts.length)return `<li class="fm-row is-empty ${on?'on':''}"><div><small>${esc(f.label)}</small><strong>—</strong><em class="flat">Sin medidas aún</em></div></li>`;
  return `<li class="fm-row ${on?'on':''}" data-key="${key}"><div><small>${esc(f.label)}</small><strong>${fmt(d.latest.value)}<u>${f.unit}</u></strong><em class="${tone(key,d.diff)}">${esc(deltaText(key,d))}</em><span class="fm-row-when">${esc(relDay(d.latest.date,t))}</span></div>${spark(pts.slice(-12).map(p=>p.value),{label:`Historial de ${f.label}: ${pts.slice(-12).map(p=>fmt(p.value)).join(', ')} ${f.unit}`})}</li>`;}
 function partPanel(S,sel,t){if(!sel)return `<div class="fm-part-empty"><span class="fm-orb" aria-hidden="true">${ic('scan-line')}</span><div><strong>Toca una parte del cuerpo</strong><p>Verás tu última medida, cuánto cambió en el último mes y su historial.</p></div></div>`;
  const P=PARTS[sel.part],keys=[...P.keys].sort((a,b)=>(sel.side&&F[b].side===sel.side)-(sel.side&&F[a].side===sel.side));
  const avg=sel.part==='weight'?weekAvg(S.weight,t):null,first=keys[0];
  return `<div class="fm-part-head"><span class="fm-eyebrow">${esc(P.label.toUpperCase())}</span><button type="button" class="fm-x" data-fm="clear" aria-label="Cerrar detalle">${ic('x')}</button></div>
   <ul class="fm-rows">${keys.map(k=>row(S,k,!!sel.side&&F[k].side===sel.side,t)).join('')}</ul>${avg?`<p class="fm-how">${ic('sigma')}<span>Promedio de 7 días: ${fmt(avg.avg)} kg (${avg.n} pesajes)</span></p>`:''}
   <div class="fm-part-foot"><p class="fm-how">${ic('ruler')}<span>${esc(F[first].how)}</span></p><button type="button" class="button small" data-fm="${sel.part==='weight'?'weight':'measure'}" data-focus="${first}">${ic('plus')}${sel.part==='weight'?'Registrar peso':'Medir '+esc(P.label.toLowerCase())}</button></div>`;}

 function progress(S){const tiles=FIELDS.filter(f=>S[f.key].length);
  if(!tiles.length)return `<section class="fm-card v8-card fm-empty"><span class="fm-orb" aria-hidden="true">${ic('ruler')}</span><h2>Tu punto de partida</h2><p>Registra tus medidas de hoy. En unas semanas verás cuánto creció cada músculo.</p><button type="button" class="button primary" data-fm="measure">${ic('plus')}Registrar medidas</button></section>`;
  return `<section class="fm-card v8-card"><header class="fm-card-head"><h2>Tu progreso</h2><small>vs hace ~1 mes</small></header><div class="fm-tiles">${tiles.map(f=>{const d=delta(S[f.key]);
   return `<button type="button" class="fm-tile" data-fm="part" data-part="${f.part}" data-side="${f.side||''}" data-key="${f.key}" aria-label="${esc(`${f.label}: ${fmt(d.latest.value)} ${f.unit}. ${deltaText(f.key,d)}`)}"><small>${esc(f.label)}</small><strong>${fmt(d.latest.value)}<u>${f.unit}</u></strong><em class="${tone(f.key,d.diff)}">${d.diff==null?'1.ª medida':esc(signed(d.diff)+' '+f.unit)}</em>${spark(S[f.key].slice(-8).map(p=>p.value),{w:84,h:22})}</button>`;}).join('')}</div></section>`;}

 function history(all,S,t){const rows=live(all).sort(byDate).reverse();if(!rows.length)return '';const showAll=!!UIx().fisicoHistAll,list=showAll?rows:rows.slice(0,8);
  const prevOf=(key,r)=>{const pts=S[key],i=pts.findIndex(p=>p.id===r.id);for(let j=i-1;j>=0;j--)if(pts[j].date<r.date)return pts[j].value;return null;};
  const item=r=>{const chips=FIELDS.filter(f=>valueOf(r,f.key)!=null).map(f=>{const v=valueOf(r,f.key),p=prevOf(f.key,r),d=p==null?null:round2(v-p);
    return `<li class="fm-chip"><small>${esc(f.label)}</small><b>${fmt(v)} ${f.unit}</b>${d==null?'':`<em class="${tone(f.key,d)}">${d===0?'=':esc(signed(d))}</em>`}</li>`;}).join('');const dl=esc(dateLabel(r.date));
   return `<li class="fm-hist-row" data-id="${esc(r.id)}"><div class="fm-hist-head"><div><strong>${dl}</strong><small>${esc(relDay(r.date,t))}</small></div><div class="fm-hist-actions"><button type="button" class="fm-icon" data-fm="edit" data-id="${esc(r.id)}" aria-label="Editar registro del ${dl}">${ic('pencil')}</button><button type="button" class="fm-icon" data-fm="del" data-id="${esc(r.id)}" aria-label="Borrar registro del ${dl}">${ic('trash-2')}</button></div></div><ul class="fm-chips">${chips}</ul>${r.note?`<p class="fm-note">${esc(r.note)}</p>`:''}</li>`;};
  return `<section class="fm-card v8-card"><header class="fm-card-head"><h2>Historial</h2><small>${rows.length} ${rows.length===1?'registro':'registros'}</small></header><ol class="fm-hist">${list.map(item).join('')}</ol>${rows.length>8?`<button type="button" class="button small fm-more" data-fm="more">${showAll?'Ver menos':`Ver todo (${rows.length})`}</button>`:''}</section>`;}

 /* ---- Saving ---- */
 let pulseKeys=null;
 /** Create a check-in, or merge into the same day's record (never duplicates a date); replace=true when editing. */
 function saveCheckin(rec,{id=null,replace=false}={}){const all=recs();let target=id?all.find(x=>x.id===id):null;if(id&&!target)throw new Error('No se encontró el registro.');
  if(!target)target=all.filter(x=>x.date===rec.date).sort(byDate).pop()||null;
  const keys=[...(rec.weight!=null?['weight']:[]),...(rec.body_fat!=null?['body_fat']:[]),...Object.keys(rec.measurements||{})];const mm=m=>m&&Object.keys(m).length?m:null;
  if(target){const prev={date:target.date,weight:target.weight??null,body_fat:target.body_fat??null,measurements:target.measurements?{...target.measurements}:null,note:target.note??''};
   const patch=replace?{date:rec.date,weight:rec.weight,body_fat:rec.body_fat,measurements:mm(rec.measurements),note:rec.note}
    :{weight:rec.weight??valueOf(target,'weight'),body_fat:rec.body_fat??valueOf(target,'body_fat'),measurements:mm({...(target.measurements||{}),...rec.measurements}),note:rec.note||target.note||''};
   root.Store.put('metrics',patch,target.id);pulseKeys=keys;
   return {id:target.id,keys,say:replace?'Registro actualizado.':'Listo, lo sumé al registro de ese día.',undo:()=>{root.Store.put('metrics',prev,target.id);root.App.render();}};}
  const saved=root.Store.put('metrics',{date:rec.date,weight:rec.weight,body_fat:rec.body_fat,measurements:mm(rec.measurements),note:rec.note});pulseKeys=keys;
  return {id:saved.id,keys,say:'Guardado. Tu progreso ya se ve en el mapa.',undo:()=>{root.Store.remove('metrics',saved.id);root.App.render();}};}
 function finish(out){root.App.closeDialog(true);root.App.render();root.App.toast(out.say,'success',out.undo);root.EvieSounds?.play?.('confirm');}
 function bindForm(form,onValid){const err=form.querySelector('.fm-error');form.addEventListener('submit',ev=>{ev.preventDefault();form.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));err.textContent='';
  const res=onValid.parse(Object.fromEntries(new FormData(form)));if(res.error){err.textContent=res.error;const el=form.elements[res.field];if(el){el.setAttribute('aria-invalid','true');el.focus();}return;}
  try{finish(onValid.save(res.record));}catch(e){err.textContent=e.message||'No se pudo guardar.';}});}

 function open(id=null,focus=null){const all=recs(),r=id?all.find(x=>x.id===id):null;if(id&&!r){root.App.toast('No encontré ese registro.','error');return;}const t=today(),S=allSeries(all.filter(x=>!r||x.id!==r.id));
  const input=f=>{const v=r?valueOf(r,f.key):null,l=S[f.key][S[f.key].length-1];
   return `<label class="fm-field" data-key="${f.key}"><span class="fm-label">${esc(f.label)}</span><span class="fm-input"><input name="${f.key}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" ${l?`placeholder="${fmtIn(l.value)}"`:''} value="${fmtIn(v)}" aria-describedby="fm-h-${f.key}"><span class="fm-unit">${f.unit}</span></span><small id="fm-h-${f.key}">${l?`Antes: ${fmt(l.value)} ${f.unit} · ${esc(relDay(l.date,t))}`:esc(f.how)}</small></label>`;};
  root.App.openDialog(r?'Editar registro':'Registrar medidas',`<form id="fm-form" class="fm-form" novalidate><p class="dialog-subtitle">Llena solo lo que mediste. Lo demás puede quedar vacío.</p>
   <label class="fm-field fm-date"><span class="fm-label">Fecha</span><input class="input" type="date" name="date" value="${r?r.date:t}" max="${t}" required></label>
   ${GROUPS.map(([g,l])=>`<fieldset class="fm-group"><legend>${l}</legend><div class="fm-fields">${FIELDS.filter(f=>f.group===g).map(input).join('')}</div></fieldset>`).join('')}
   <details class="fm-howto"><summary>${ic('info')}Cómo medir para comparar bien</summary><ul><li>En la mañana, en ayunas y antes de entrenar: el bombeo puede sumar 1–1.5 cm.</li><li>Cinta pegada a la piel, sin apretar y paralela al piso.</li><li>Siempre el mismo punto y el mismo estado (flexionado o relajado).</li><li>Mide 2 veces; si no coinciden, una tercera y promedia.</li></ul></details>
   <label class="fm-field fm-note-f"><span class="fm-label">Nota (opcional)</span><input class="input" name="note" maxlength="200" value="${esc(r?.note||'')}" placeholder="Ej. inicio de volumen"></label>
   <p class="fm-error" role="alert"></p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button type="submit" class="button primary">${ic('check')}${r?'Guardar cambios':'Guardar medidas'}</button></div></form>`);
  const form=document.getElementById('fm-form');bindForm(form,{parse:d=>fromForm(d,{today:t}),save:rec=>saveCheckin(rec,{id:r?.id||null,replace:!!r})});
  const el=focus&&form.elements[focus];if(el)setTimeout(()=>{el.focus();el.scrollIntoView?.({block:'center'});},60);}

 function openWeight(){const all=recs(),w=series(all,'weight'),l=w[w.length-1],t=today();
  root.App.openDialog('Registrar peso',`<form id="fm-weight-form" class="fm-form fm-wform" novalidate><p class="dialog-subtitle">${l?`Último: ${fmt(l.value)} kg · ${esc(relDay(l.date,t))}`:'Tu primer pesaje será tu punto de partida.'}</p>
   <label class="fm-big"><span class="sr-only">Peso en kilogramos</span><input name="weight" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="${l?fmtIn(l.value):'0.0'}" required><span class="fm-unit">kg</span></label>
   <label class="fm-field fm-date"><span class="fm-label">Fecha</span><input class="input" type="date" name="date" value="${t}" max="${t}" required></label>
   <p class="fm-tip">${ic('sunrise')}<span>Mismas condiciones cada vez: en la mañana, después de ir al baño, antes de comer o beber y con poca ropa.</span></p>
   <p class="fm-error" role="alert"></p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button type="submit" class="button primary">${ic('check')}Guardar peso</button></div></form>`);
  const form=document.getElementById('fm-weight-form');
  bindForm(form,{parse:d=>parseNum(d.weight)==null?{error:'Escribe tu peso en kg.',field:'weight'}:fromForm({date:d.date,weight:d.weight},{today:t}),save:rec=>saveCheckin(rec)});
  setTimeout(()=>form.elements.weight?.focus(),60);}

 function del(id){const r=recs().find(x=>x.id===id);if(!r)return;const {id:_i,deleted_at:_d,created_at:_c,updated_at:_u,...copy}=r;root.Store.remove('metrics',id);root.App.render();
  root.App.toast(`Registro del ${dateLabel(r.date)} borrado.`,'success',()=>{root.Store.put('metrics',copy);root.App.render();});}

 /* ---- Body-map interaction (in place, no full re-render) ---- */
 const FACE_OF=part=>{const B=root.FisicoBody||{FRONT:{},BACK:{}},rs=Object.keys(REGION_PART).filter(k=>REGION_PART[k]===part);return {front:rs.some(k=>k in B.FRONT),back:rs.some(k=>k in B.BACK)};};
 function sideFrom(el,ev){if(!ev||(!ev.clientX&&!ev.clientY))return null;const svg=el.ownerSVGElement,view=el.closest('[data-view]')?.dataset.view;
  try{const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const x=pt.matrixTransform(svg.getScreenCTM().inverse()).x,viewerLeft=x<100;return view==='back'?(viewerLeft?'l':'r'):(viewerLeft?'r':'l');}catch{return null;}}
 /** Tap a region: selects its measurement; tapping the same part again (same side, or no side info) closes it. */
 function pickFromEvent(el,ev){const part=REGION_PART[el.dataset.m];if(!part)return;const paired=PARTS[part].keys.length>1,side=paired?sideFrom(el,ev):null,cur=current();
  const same=!!cur&&cur.part===part&&(!paired||!side||cur.side===side);setPart(same?null:part,side||(cur&&cur.part===part?cur.side:null));}
 function setPart(part,side,{scroll=false}={}){const U=UIx();U.fisicoPart=part&&PARTS[part]?{part,side:side||null}:null;
  const faces=part?FACE_OF(part):null,face=U.fisicoFace==='back'?'back':'front';if(faces&&!faces[face])setFace(face==='front'?'back':'front');refreshPart();
  if(scroll){const box=document.getElementById('fm-part');box?.scrollIntoView?.({behavior:reduced()?'auto':'smooth',block:'nearest'});}}
 function refreshPart(){const box=document.getElementById('fm-part');if(!box){root.App.render();return;}const all=recs(),sel=current();box.innerHTML=partPanel(allSeries(all),sel,today());
  document.querySelectorAll('.fm-stage .fb-m').forEach(p=>{const on=!!sel&&REGION_PART[p.dataset.m]===sel.part;p.toggleAttribute('data-selected',on);p.setAttribute('aria-pressed',String(on));});
  document.querySelectorAll('.fm-tile').forEach(b=>b.classList.toggle('on',!!sel&&b.dataset.part===sel.part&&(!sel.side||!b.dataset.side||b.dataset.side===sel.side)));
  if(root.lucide)try{root.lucide.createIcons({root:box});}catch{}
  anim(box.children,{opacity:[0,1],y:[8,0]},{stiffness:320,damping:28,delay:stagger(.03)});}
 function setFace(face){const U=UIx();U.fisicoFace=face==='back'?'back':'front';const st=document.querySelector('.fm-stage');if(!st)return;if(st.dataset.face===U.fisicoFace)return;
  st.dataset.face=U.fisicoFace;st.classList.remove('is-turning');void st.offsetWidth;if(!reduced())st.classList.add('is-turning');
  document.querySelectorAll('[data-fm="face"]').forEach(b=>{if(b.classList.contains('fm-turn'))b.dataset.face=U.fisicoFace==='front'?'back':'front';else b.setAttribute('aria-pressed',String(b.dataset.face===U.fisicoFace));});}

 let entered=false;
 function afterRender(){const box=document.querySelector('[data-fm-root]');if(!box){entered=false;return;}
  if(!entered){entered=true;anim(box.querySelectorAll('.fm-face'),{opacity:[0,1],scale:[.94,1],y:[18,0]},{stiffness:170,damping:22,delay:stagger(.08)});
   anim(box.querySelectorAll('.fm-tile,.fm-hist-row,.fm-stat'),{opacity:[0,1],y:[10,0]},{delay:stagger(.025,{startDelay:.12})});}
  if(pulseKeys&&pulseKeys.length){const parts=new Set(pulseKeys.map(k=>F[k]?.part).filter(Boolean));pulseKeys=null;
   const els=[...box.querySelectorAll('.fb-m')].filter(p=>parts.has(REGION_PART[p.dataset.m])),tiles=[...box.querySelectorAll('.fm-tile')].filter(b=>parts.has(b.dataset.part));
   [...els,...tiles].forEach(x=>x.classList.add('is-pulse'));setTimeout(()=>[...els,...tiles].forEach(x=>x.classList.remove('is-pulse')),1700);}}

 if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-fm]');if(!b||b.tagName==='SELECT')return;const a=b.dataset.fm;
   if(a==='measure')open(null,b.dataset.focus||null);else if(a==='weight')openWeight();else if(a==='edit')open(b.dataset.id);else if(a==='del')del(b.dataset.id);
   else if(a==='part')setPart(b.dataset.part,b.dataset.side||null,{scroll:true});else if(a==='clear')setPart(null);else if(a==='face')setFace(b.dataset.face);
   else if(a==='more'){UIx().fisicoHistAll=!UIx().fisicoHistAll;root.App.render();}});
  document.addEventListener('change',ev=>{const s=ev.target.closest?.('[data-fm="every"]');if(!s)return;const v=Number(s.value);root.Store.save(st=>{st.preferences.fisicoMeasureEvery=EVERY.includes(v)?v:MEASURE_EVERY;});root.App.render();});}

 root.FisicoMeasures=Object.freeze({FIELDS,PARTS,REGION_PART,RANGE,EVERY,WEIGH_EVERY,MEASURE_EVERY,CM_KEYS,
  valueOf,series,parseNum,check,fromForm,delta,vsLabel,deltaText,tone,fmt,signed,relDay,cadence,cadenceText,weekAvg,spark,regionInfo,daysBetween,
  tab,open,openWeight,saveCheckin,del,pickFromEvent,setPart,setFace,afterRender});
})(typeof window!=='undefined'?window:globalThis);
