'use strict';
/* Mascota Virtual · Kisha — pure logic (no DOM). Loaded in the browser and in node:vm tests.
   - Deterministic conversation state machine. Device facts (listening/thinking/speaking/error) always
     win over AI cues; an AI cue can only pick a facial expression from CUES while idle.
   - Bounded per-session context (recent turns + a faithful rolling memory) to keep each turn cheap.
   - Maps a USER-CONFIRMED review draft to a journal_version 4 record so statistics, exports, sync and
     get_journal_stats keep working with one collection ('journal'). */
window.KishaCore=(()=>{
 const CUES=['neutral','curious','calm','supportive','happy','confused'];
 const PHASES=['off','greeting','idle','listening','transcribing','thinking','speaking','blocked','paused','resting','error','review'];
 // Phases owned by the device/state machine. A cue never overrides them.
 const HARD=new Set(['listening','transcribing','thinking','speaking','error']);
 const EMOTIONS={alegria:'Felicidad',tristeza:'Tristeza',enojo:'Enojo',ansiedad:'Ansiedad / preocupación',calma:'Calma',miedo:'Miedo',gratitud:'Gratitud',entusiasmo:'Entusiasmo',frustracion:'Frustración',cansancio:'Cansancio',orgullo:'Orgullo',soledad:'Soledad',esperanza:'Esperanza'};
 const CORE=['alegria','tristeza','enojo','ansiedad','calma'];
 const T=(s,n)=>String(s??'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,n);
 const RECENT=8,MAX_TURNS=14;

 /* ---------- state machine ---------- */
 function machine(onChange=()=>{}){
  let phase='off',cue='neutral',reason='';
  const allowed={off:['greeting','idle'],greeting:['speaking','idle','blocked','error','off','paused'],idle:['listening','thinking','resting','paused','review','off','speaking','greeting','blocked'],listening:['transcribing','idle','error','paused','off'],transcribing:['thinking','idle','error','paused','off'],thinking:['speaking','idle','error','blocked','paused','off'],speaking:['idle','blocked','paused','off','listening','error'],blocked:['speaking','idle','listening','thinking','paused','off','review'],paused:['idle','off','review','resting'],resting:['idle','listening','thinking','paused','off','review','greeting'],error:['idle','listening','thinking','off','paused','review'],review:['idle','off','paused']};
  function go(next,why=''){if(!PHASES.includes(next))throw Error('Fase desconocida: '+next);if(next===phase)return true;if(!allowed[phase].includes(next))return false;phase=next;reason=why;if(next==='off')cue='neutral';onChange(view());return true;}
  /** Apply an AI cue. Ignored unless allow-listed; only changes the expression outside hard phases. */
  function suggest(c){if(!CUES.includes(c))return false;cue=c;if(!HARD.has(phase))onChange(view());return true;}
  function pose(){if(phase==='speaking')return 'speaking';if(phase==='listening')return 'listening';if(phase==='thinking'||phase==='transcribing')return 'thinking';if(phase==='error')return 'confused';if(phase==='resting'||phase==='paused')return 'resting';
   if(cue==='happy')return 'happy';if(cue==='supportive'||cue==='calm')return 'supportive';if(cue==='confused')return 'confused';if(cue==='curious')return 'curious';return 'idle';}
  function view(){return {phase,cue,pose:pose(),reason};}
  return {go,suggest,view,get phase(){return phase;},get cue(){return cue;}};
 }
 const STATUS={off:'Lista para conversar',greeting:'Kisha te saluda',idle:'Esperando tu respuesta',listening:'Escuchando…',transcribing:'Transcribiendo…',thinking:'Pensando…',speaking:'Hablando…',blocked:'Toca para escuchar',paused:'En pausa',resting:'Descansando',error:'Algo falló',review:'Revisando tu conversación'};

 /* ---------- per-session context ---------- */
 function context(session){const msgs=session.messages.filter(m=>m.role==='user'||m.role==='kisha').map(m=>({role:m.role,text:T(m.text,2000)}));
  const covered=session.memoryUpTo||0,older=msgs.length-RECENT;
  const recent=msgs.slice(Math.max(covered,msgs.length-RECENT));
  return {messages:recent.slice(-MAX_TURNS),memory:session.memory||null,need_memory:older>covered+4};}
 function greeting(name,hour){const n=T(name,60);const saludo=hour<12?'Buenos días':hour<19?'Buenas tardes':'Buenas noches';return `${saludo}${n?', '+n:''}. Soy Kisha. ¿Cómo estuvo tu día? Estoy aquí para escucharte.`;}
 const CLOSE='¿Quieres contarme algo más o concluimos por hoy?';
 function userWords(session){return session.messages.filter(m=>m.role==='user').map(m=>m.text).join(' ').split(/\s+/).filter(Boolean).length;}

 /* ---------- draft → journal v4 ---------- */
 function newId(){return crypto.randomUUID();}
 function toEntry(review,{session,keepTranscript,id=newId(),now=new Date()}){
  const A=(x,m)=>{if(!x)throw Error(m);};
  A(review&&typeof review==='object','Borrador inválido.');
  A(/^\d{4}-\d{2}-\d{2}$/.test(review.date||''),'Fecha inválida.');A(/^\d{2}:\d{2}$/.test(review.time_local||''),'Hora inválida.');
  const title=T(review.title,120);A(title,'Escribe un título.');
  const summary=T(review.summary,1200);
  const seen=new Set(),emotions=[];
  for(const x of review.emotions||[]){A(Object.hasOwn(EMOTIONS,x.key)&&!seen.has(x.key),'Emoción inválida o repetida.');A(Number.isInteger(x.value)&&x.value>=0&&x.value<=100,'Cada intensidad debe ser un entero de 0 a 100.');seen.add(x.key);
   emotions.push({key:x.key,label:EMOTIONS[x.key],intensity:x.value,basis:x.edited?'reported':'inferred',confidence:x.edited?1:.6,evidence:T(x.evidence||'Ajustado por ti en la revisión.',240)});}
  const moments=(review.moments||[]).slice(0,5).map(m=>T(m.text,240)).filter(Boolean);
  const transcript=keepTranscript?session.messages.filter(m=>m.role==='user'||m.role==='kisha').slice(-120).map(m=>({role:m.role,text:T(m.text,2000),at:m.at||null})):null;
  const raw=keepTranscript?transcript.filter(m=>m.role==='user').map(m=>m.text).join('\n').slice(0,15000):null;
  return {id,title,date:review.date,time_local:review.time_local,timezone:T(review.timezone,40)||'America/Mexico_City',recorded_at:now.toISOString(),
   text:raw||summary||title,raw_narrative:raw,summary:summary||'Sin resumen.',productivity:null,reason:'',source:'kisha',source_entry_id:'kisha:'+session.id,journal_version:4,kisha_version:1,
   highlights:moments,difficulties:[],learnings:[],tags:['kisha'],emotions,indicators:{},events:[],next_actions:[],
   review_required:false,confirmed_by_user:true,assistant_note:T(review.observation||'',400)||'Borrador revisado y confirmado por ti.',insufficient:!!review.insufficient,
   transcript};}
 function existing(rows,sessionId){return (rows||[]).find(r=>!r.deleted_at&&r.source_entry_id==='kisha:'+sessionId)||null;}
 const isKisha=r=>r&&r.source==='kisha';
 const isLegacy=r=>r&&!r.deleted_at&&r.source!=='kisha';

 /* ---------- history & honest patterns ---------- */
 function excerpt(r,n=140){const s=String(r.summary&&r.summary!=='Sin resumen.'?r.summary:r.text||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;}
 function filter(rows,{q='',from='',to=''}={}){const n=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const qq=n(q).trim();
  return rows.filter(r=>!r.deleted_at&&(!qq||n(r.title).includes(qq))&&(!from||r.date>=from)&&(!to||r.date<=to)).sort((a,b)=>(b.date+(b.time_local||'')).localeCompare(a.date+(a.time_local||'')));}
 function groupByDay(rows){const out=[];for(const r of rows){const g=out.at(-1);if(g&&g.date===r.date)g.rows.push(r);else out.push({date:r.date,rows:[r]});}return out;}
 function trends(rows,{from,to}){const conf=rows.filter(r=>!r.deleted_at&&r.journal_version===4&&r.confirmed_by_user&&r.date>=from&&r.date<=to);
  const emo={};for(const r of conf)for(const x of r.emotions||[]){(emo[x.key]??={key:x.key,label:EMOTIONS[x.key]||x.key,values:[],ids:[]}).values.push(x.intensity);emo[x.key].ids.push(r.id);}
  const emotions=Object.values(emo).map(e=>({key:e.key,label:e.label,mean:Math.round(e.values.reduce((a,b)=>a+b,0)/e.values.length),n:e.values.length,ids:e.ids})).sort((a,b)=>b.n-a.n||b.mean-a.mean);
  const topics={};for(const r of conf)for(const h of new Set((r.highlights||[]).map(x=>x.toLowerCase().trim()).filter(Boolean))){(topics[h]??={text:h,ids:[]}).ids.push(r.id);}
  const repeated=Object.values(topics).filter(t=>t.ids.length>=2).sort((a,b)=>b.ids.length-a.ids.length).slice(0,5).map(t=>({...t,sentence:`Este tema apareció en ${t.ids.length} de tus ${conf.length} entradas.`}));
  return {entries:conf.length,emotions,repeated};}

 /* ---------- private recoverable draft (per account) ---------- */
 function draftKey(owner){return 'evie-kisha-draft:'+String(owner||'local').replace(/[^a-zA-Z0-9-]/g,'').slice(0,64);}
 function serialize(session){return JSON.stringify({v:1,id:session.id,started_at:session.started_at,messages:session.messages.slice(-120),memory:session.memory||null,memoryUpTo:session.memoryUpTo||0,review:session.review||null,saved:session.saved||false,updated_at:new Date().toISOString()});}
 function restore(raw){try{const d=JSON.parse(raw);if(!d||d.v!==1||!/^[0-9a-f-]{36}$/i.test(d.id)||!Array.isArray(d.messages))return null;const messages=d.messages.filter(m=>m&&(m.role==='user'||m.role==='kisha')&&typeof m.text==='string').map(m=>({role:m.role,text:T(m.text,2000),at:m.at||null}));return {id:d.id,started_at:d.started_at,messages,memory:d.memory?T(d.memory,1200):null,memoryUpTo:Number.isInteger(d.memoryUpTo)?d.memoryUpTo:0,review:d.review||null,saved:!!d.saved};}catch{return null;}}

 return Object.freeze({CUES,PHASES,STATUS,EMOTIONS,CORE,CLOSE,machine,context,greeting,userWords,toEntry,existing,isKisha,isLegacy,excerpt,filter,groupByDay,trends,draftKey,serialize,restore,newId});
})();
