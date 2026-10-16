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
  chest:{label:'Pecho',view:'front',aliases:['pecho','pectoral','pectorales']},
  shoulders:{label:'Hombros',view:'both',aliases:['hombro','hombros','deltoides']},
  biceps:{label:'Bíceps',view:'front',aliases:['biceps']},
  triceps:{label:'Tríceps',view:'back',aliases:['triceps']},
  forearms:{label:'Antebrazos',view:'both',aliases:['antebrazo','antebrazos']},
  core:{label:'Abdomen',view:'front',aliases:['abdomen','abdominales','abs','core','zona media','oblicuos']},
  quads:{label:'Cuádriceps',view:'front',aliases:['cuadriceps','cuadricep']},
  calves:{label:'Pantorrillas',view:'back',aliases:['pantorrilla','pantorrillas','gemelos']},
  neck:{label:'Cuello',view:'both',aliases:['cuello','trapecio','trapecios']},
  back:{label:'Espalda',view:'back',aliases:['espalda','dorsal','dorsales','lumbar','lats']},
  glutes:{label:'Glúteos',view:'back',aliases:['gluteo','gluteos','pompas']},
  hamstrings:{label:'Isquiotibiales',view:'back',aliases:['isquios','isquiotibiales','femoral','femorales']}});
 const COMBOS={pierna:['quads','hamstrings','glutes','calves'],piernas:['quads','hamstrings','glutes','calves'],brazo:['biceps','triceps','forearms'],brazos:['biceps','triceps','forearms'],
  'tren superior':['chest','back','shoulders','biceps','triceps'],'tren inferior':['quads','hamstrings','glutes','calves'],'cuerpo completo':Object.keys(GROUPS),'full body':Object.keys(GROUPS),
  push:['chest','shoulders','triceps'],empuje:['chest','shoulders','triceps'],pull:['back','biceps'],jalon:['back','biceps'],'jalón':['back','biceps']};
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
 function quickSession({groups,date,title,note,op_id}){const ex=groups.map(k=>({name:GROUPS[k].label,equipment:null,primary_muscles:[k],secondary_muscles:[],sets:[]}));
  return {title:(title||groups.map(k=>GROUPS[k].label).join(' y ')).slice(0,80),date,duration_seconds:null,completeness:'partial',source:'manual',exercises:ex,uncertainties:['Registrado por voz: faltan ejercicios, series y repeticiones.'],reported_total_sets:null,reported_volume_kg:null,notes:note||null,op_id:op_id||null};}
 /** Merge groups into an existing session without touching its exercises' data. */
 function mergeGroups(session,groups){const have=new Set(sessionGroups(session).primary);const add=groups.filter(k=>!have.has(k));return {add,exercises:[...(session.exercises||[]),...add.map(k=>({name:GROUPS[k].label,equipment:null,primary_muscles:[k],secondary_muscles:[],sets:[]}))]};}
 const api=Object.freeze({GROUPS,COMBOS,norm,groupsFrom,sessionGroups,summary,band,BAND_TEXT,sessionOn,quickSession,mergeGroups});
 root.FisicoCore=api;
})(typeof window!=='undefined'?window:globalThis);
