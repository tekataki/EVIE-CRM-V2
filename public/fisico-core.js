'use strict';
/* Físico core (pure). Reads the EXISTING gymSessions model (exercises[].primary_muscles/secondary_muscles with the
   V2Domain.muscles keys) — no second workout database. Provides:
   - muscle group catalogue (front/back view, Spanish names, aliases for voice),
   - phrase → groups («pecho y espalda», «pierna», «brazo»),
   - last trained per group and a contextual readiness band.
   Readiness is an approximate, transparent heuristic, NOT a biological rule or medical advice: ~48–72 h is a common
   practical reference for hard work on the same group; ACSM (2026 position stand) and HHS/WHO guidance emphasise
   training each major group ≥2 days/week and individualising by goals, soreness, sleep, experience and age. */
(function(root){
 const GROUPS=Object.freeze({
  chest:{label:'Pecho',view:'front',aliases:['pecho','pectoral','pectorales','chest']},
  shoulders:{label:'Hombros',view:'both',aliases:['hombro','hombros','deltoides','shoulders']},
  biceps:{label:'Bíceps',view:'front',aliases:['biceps','bicep']},
  triceps:{label:'Tríceps',view:'back',aliases:['triceps','tricep']},
  forearms:{label:'Antebrazos',view:'both',aliases:['antebrazo','antebrazos','forearms']},
  core:{label:'Abdomen',view:'front',aliases:['abdomen','abdominales','abs','core','zona media','oblicuos']},
  quads:{label:'Cuádriceps',view:'front',aliases:['cuadriceps','cuadricep','quads']},
  calves:{label:'Pantorrillas',view:'back',aliases:['pantorrilla','pantorrillas','gemelos','calves']},
  neck:{label:'Cuello',view:'both',aliases:['cuello','trapecio','trapecios']},
  back:{label:'Espalda',view:'back',aliases:['espalda','dorsal','dorsales','lumbar','lats']},
  glutes:{label:'Glúteos',view:'back',aliases:['gluteo','gluteos','pompas','glutes']},
  hamstrings:{label:'Isquiotibiales',view:'back',aliases:['isquios','isquiotibiales','femoral','femorales','hamstrings']}});
 const LEGS=['quads','hamstrings','glutes','calves'],ARMS=['biceps','triceps','forearms'],UPPER=['chest','back','shoulders','biceps','triceps'],PUSH=['chest','shoulders','triceps'],PULL=['back','biceps'];
 const COMBOS={pierna:LEGS,piernas:LEGS,legs:LEGS,leg:LEGS,'leg day':LEGS,brazo:ARMS,brazos:ARMS,arms:ARMS,
  'tren superior':UPPER,upper:UPPER,'upper body':UPPER,superior:UPPER,'tren inferior':LEGS,lower:LEGS,'lower body':LEGS,inferior:LEGS,torso:['chest','back','shoulders','core'],
  'cuerpo completo':Object.keys(GROUPS),'full body':Object.keys(GROUPS),'todo el cuerpo':Object.keys(GROUPS),
  push:PUSH,empuje:PUSH,pull:PULL,jalon:PULL,'jalón':PULL,tiron:PULL};
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 /** «pecho y espalda» → ['chest','back'] (order kept, deduped). Unknown words are ignored; [] if nothing matched. */
 function groupsFrom(text){const q=' '+norm(text)+' ',out=[];const add=k=>{if(!out.includes(k))out.push(k);};
  const hits=[];for(const [c,ks] of Object.entries(COMBOS)){const i=q.indexOf(' '+norm(c)+' ');if(i>=0)hits.push([i,ks]);}
  for(const [k,g] of Object.entries(GROUPS))for(const a of g.aliases){const i=q.indexOf(' '+a+' ');if(i>=0){hits.push([i,[k]]);break;}}
  hits.sort((a,b)=>a[0]-b[0]).forEach(([,ks])=>ks.forEach(add));return out;}
 const live=list=>(Array.isArray(list)?list:[]).filter(s=>s&&!s.deleted_at);
 /** Groups worked in one session: primary (full) and secondary (partial) muscles; manual override wins. */
 function sessionGroups(s){if(Array.isArray(s.muscle_override)&&s.muscle_override.length)return {primary:s.muscle_override.filter(k=>GROUPS[k]),secondary:[]};
  const p=new Set(),sec=new Set();for(const ex of s.exercises||[]){for(const m of ex.primary_muscles||[])if(GROUPS[m])p.add(m);for(const m of ex.secondary_muscles||[])if(GROUPS[m])sec.add(m);}
  for(const m of p)sec.delete(m);return {primary:[...p],secondary:[...sec]};}
 const DAY=86400000,dateMs=d=>Date.parse(d+'T12:00:00Z');
 /** Per-group summary: last date, hours since, sessions in the last 7 days and a readiness band. */
 function summary(sessions,today,{now=Date.now()}={}){const rows=live(sessions).filter(s=>typeof s.date==='string'&&s.date<=today).sort((a,b)=>b.date.localeCompare(a.date));
  const out={};for(const k of Object.keys(GROUPS)){let last=null,lastSecondary=null,week=0,ids=[];
   for(const s of rows){const g=sessionGroups(s),inP=g.primary.includes(k),inS=g.secondary.includes(k);if(!inP&&!inS)continue;ids.push(s.id);
    if(inP&&!last)last=s;if(inS&&!lastSecondary)lastSecondary=s;if(dateMs(today)-dateMs(s.date)<7*DAY&&inP)week++;}
   const ref=last||lastSecondary,days=ref?Math.round((dateMs(today)-dateMs(ref.date))/DAY):null;
   out[k]={key:k,label:GROUPS[k].label,view:GROUPS[k].view,last_date:ref?.date||null,last_session:ref?.id||null,partial:!last&&!!lastSecondary,days_since:days,sessions_7d:week,session_ids:ids.slice(0,12),band:band(days,!last&&!!lastSecondary)};}
  return out;}
 /** Bands (shown with icon+text+pattern, not colour alone):
     fresh  = trained today/yesterday (≈<48 h): «recién trabajado»
     mid    = 2–3 days (≈48–72 h): «recuperándose · referencia 48–72 h»
     ready  = ≥3 days: «listo según la referencia»
     idle   = ≥8 days or never: «sin entrenar esta semana». Partial (secondary) work lowers by one level. */
 function band(days,partial){if(days==null)return 'idle';let b=days<=1?'fresh':days<=2?'mid':days<=7?'ready':'idle';if(partial&&b==='fresh')b='mid';else if(partial&&b==='mid')b='ready';return b;}
 const BAND_TEXT={fresh:'Recién trabajado',mid:'Recuperándose (referencia 48–72 h)',ready:'Listo según la referencia',idle:'Sin entrenar esta semana'};
 /** Find an existing session for a date (to avoid duplicating «hoy entrené…»). */
 function sessionOn(sessions,date){return live(sessions).filter(s=>s.date===date);}
 /** Build a minimal gymSessions record compatible with V2Domain.gym (one exercise per group, sets unknown). */
 function quickSession({groups,date,title,note,op_id,trained_at}){const ex=groups.map(k=>({name:GROUPS[k].label,equipment:null,primary_muscles:[k],secondary_muscles:[],sets:[]}));
  return {title:(title||groups.map(k=>GROUPS[k].label).join(' y ')).slice(0,80),date,trained_at:trained_at||null,duration_seconds:null,completeness:'partial',source:'manual',exercises:ex,uncertainties:['Registrado por voz: faltan ejercicios, series y repeticiones.'],reported_total_sets:null,reported_volume_kg:null,notes:note||null,op_id:op_id||null};}

 /* ---------------- Recuperación por horas (mapa rojo / amarillo / verde) ----------------
    red    = entrenado hace menos de 24 h
    yellow = entre 24 y 48 h
    green  = 48 h o más (listo de nuevo), hasta 7 días
    idle   = sin entrenar en los últimos ~7 días (neutro)
    Es una referencia práctica y transparente, no una regla biológica ni consejo médico. */
 const HOUR=3600000,REC_TEXT=Object.freeze({red:'recién entrenado, dale descanso',yellow:'recuperándose',green:'listo para entrenar',idle:'sin entrenar esta semana'});
 const REC_LABEL=Object.freeze({red:'Menos de 24 h',yellow:'24 a 48 h',green:'Listo (48 h o más)',idle:'Sin entrenar en 7 días'});
 const HINT_HOUR=Object.freeze({morning:9,noon:13,afternoon:17,night:21});
 const clampHour=h=>{h=Number(h);return Number.isInteger(h)&&h>=0&&h<=23?h:10;};
 /** Local timestamp for a calendar date at a given hour (device time zone). */
 function atHour(date,hour){const [y,m,d]=String(date).split('-').map(Number);return new Date(y,m-1,d,clampHour(hour),0,0,0).getTime();}
 /** When a session happened: the stored `trained_at`, else its date at the user's usual training hour. */
 function trainedAt(s,{hour=10}={}){const t=s&&s.trained_at?Date.parse(s.trained_at):NaN;if(Number.isFinite(t))return t;return s&&typeof s.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)?atHour(s.date,hour):NaN;}
 function recState(hours,partial){if(hours==null||!(hours>=0))return 'idle';let r=hours<24?'red':hours<48?'yellow':hours<168?'green':'idle';if(partial&&r==='red')r='yellow';else if(partial&&r==='yellow')r='green';return r;}
 /** Per-group recovery from the training-day records: {state,hours,last_at,last_date,last_session,partial,sessions_7d}. */
 function recovery(sessions,now=Date.now(),{hour=10}={}){const rows=live(sessions).map(s=>({s,at:trainedAt(s,{hour}),g:sessionGroups(s)})).filter(x=>Number.isFinite(x.at)&&x.at<=now).sort((a,b)=>b.at-a.at);
  const out={};for(const k of Object.keys(GROUPS)){let p=null,sec=null,week=0;
   for(const x of rows){const inP=x.g.primary.includes(k),inS=x.g.secondary.includes(k);if(inP&&!p)p=x;if(inS&&!sec)sec=x;if(inP&&now-x.at<7*DAY)week++;}
   const ref=p||sec,partial=!p&&!!sec,hours=ref?(now-ref.at)/HOUR:null;
   out[k]={key:k,label:GROUPS[k].label,view:GROUPS[k].view,state:recState(hours,partial),hours,last_at:ref?ref.at:null,last_date:ref?ref.s.date:null,last_session:ref?ref.s.id:null,partial,sessions_7d:week};}
  return out;}
 const WEEKDAYS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
 const dayStart=ms=>{const d=new Date(ms);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();};
 /** «hace 3 h», «hace 26 h», «hace 2 días». */
 function agoText(hours){if(hours==null)return '';if(hours<1)return 'hace menos de 1 h';if(hours<48)return `hace ${Math.round(hours)} h`;return `hace ${Math.floor(hours/24)} días`;}
 /** «hoy», «ayer» or the weekday name of a past training. */
 function dayWord(at,now=Date.now()){const diff=Math.round((dayStart(now)-dayStart(at))/DAY);return diff<=0?'hoy':diff===1?'ayer':diff<7?WEEKDAYS[new Date(at).getDay()]:`el ${new Date(at).getDate()}/${new Date(at).getMonth()+1}`;}
 /** «Último entrenamiento: lunes (hace 2 días) · listo para entrenar». */
 function recoveryText(r,now=Date.now()){if(!r||r.last_at==null)return 'Sin entrenamientos registrados';return `Último entrenamiento: ${dayWord(r.last_at,now)} (${agoText(r.hours)})${r.partial?' como músculo secundario':''} · ${REC_TEXT[r.state]}`;}
 /** Counts per state, e.g. {red:2,yellow:1,green:5,idle:4}. */
 function recoveryCounts(rec){const c={red:0,yellow:0,green:0,idle:0};for(const r of Object.values(rec||{}))c[r.state]++;return c;}

 /* ---------------- Cuándo fue: «hoy», «ayer», «antier», «el lunes», «hace 2 días», «esta mañana», «anoche» ---------------- */
 const NUM={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6};
 const DOW={domingo:0,lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6};
 const WHEN=[
  [/\b(?:antier|anteayer|antes de ayer)\b/,()=>({back:2})],
  [/\banoche\b/,()=>({back:1,hint:'night'})],
  [/\bayer\b/,()=>({back:1})],
  [/\bhoy\b/,()=>({back:0})],
  [/\bhace (\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis) dias?\b/,m=>({back:NUM[m[1]]??Number(m[1])})],
  [/\b(?:el |este |el pasado )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?: pasado)?\b/,m=>({dow:DOW[m[1]]})],
  [/\b(?:esta|en la|por la|de la|a la) (manana|tarde|noche)\b/,m=>({hint:m[1]==='manana'?'morning':m[1]==='tarde'?'afternoon':'night'})],
  [/\b(?:a|al) medio ?dia\b/,()=>({hint:'noon'})],
  [/\btemprano\b/,()=>({hint:'morning'})]];
 /** Pull the date/time words out of a normalised phrase. Returns {back,dow,hint,rest}; `rest` is what was not a date. */
 function parseWhen(text){let rest=' '+norm(text)+' ',back=null,dow=null,hint=null;
  for(const [re,fn] of WHEN){const m=rest.match(re);if(!m)continue;const r=fn(m);if(r.back!=null&&back==null&&dow==null)back=r.back;else if(r.dow!=null&&dow==null&&back==null)dow=r.dow;if(r.hint&&!hint)hint=r.hint;rest=rest.replace(m[0],' ');}
  return {back,dow,hint,rest:rest.replace(/\s+/g,' ').trim()};}
 /** Resolve a parseWhen() result against today's date (YYYY-MM-DD). A weekday means the most recent PAST one. */
 function resolveWhen(w,today){let back=w.back;if(back==null&&w.dow!=null){const t=new Date(dateMs(today)).getUTCDay();back=(t-w.dow+7)%7||7;}if(back==null)back=0;
  const d=new Date(dateMs(today)-back*DAY).toISOString().slice(0,10);return {date:d,back,hint:w.hint||null};}
 /** ISO timestamp for a training logged for `date`: now when it is today without a time hint, else the hinted/usual hour (never in the future). */
 function stamp({date,today,hint,hour=10,now=Date.now()}){if(date===today&&!hint)return new Date(now).toISOString();return new Date(Math.min(now,atHour(date,hint?HINT_HOUR[hint]:hour))).toISOString();}
 /** Merge groups into an existing session without touching its exercises' data. */
 function mergeGroups(session,groups){const have=new Set(sessionGroups(session).primary);const add=groups.filter(k=>!have.has(k));return {add,exercises:[...(session.exercises||[]),...add.map(k=>({name:GROUPS[k].label,equipment:null,primary_muscles:[k],secondary_muscles:[],sets:[]}))]};}
 const api=Object.freeze({GROUPS,COMBOS,norm,groupsFrom,sessionGroups,summary,band,BAND_TEXT,sessionOn,quickSession,mergeGroups,
  REC_TEXT,REC_LABEL,HINT_HOUR,atHour,trainedAt,recState,recovery,recoveryText,recoveryCounts,agoText,dayWord,parseWhen,resolveWhen,stamp});
 root.FisicoCore=api;
})(typeof window!=='undefined'?window:globalThis);
