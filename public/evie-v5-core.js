'use strict';
/* EVIE v5 client core (pure, no DOM, testable in node:vm).
   - intent(text): routes v5 voice/text commands (scene, AI tier, route, plan, next, client tasks, memory v2).
     "abre el mapa" / "abre Finanzas" = SECTION; "abre (una) tarjeta de Finanzas" = CARD; "cierra esta tarjeta".
   - Long dictation: chunk plan with overlap, ordered assembly, seam de-duplication, gap report.
   - Wake: single-turn gate and self-trigger guard. Lifecycle: request-scoped events without private content. */
window.EvieV5Core=(()=>{
 const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();
 const WAKE=/^(?:(?:oye|hey|ey|ok)\s+)?(?:ivi|ivy|ivee|ibi|evie|evi|libi|liby|livi)\b[\s,]*/;
 const strip=t=>norm(t).replace(WAKE,'');
 const rawStrip=t=>String(t||'').replace(/^\s*(?:(?:oye|hey|ok)\s+)?(?:ivi|ivy|evie|evi|libi|liby)[\s,.:]+/i,'').trim();
 const SECTIONS={finanzas:'finanzas',agenda:'agenda',mapa:'mapa',negocios:'negocios',soma:'negocios',habitos:'habitos',objetivos:'objetivos',fisico:'fisico',gimnasio:'fisico',gym:'fisico',configuracion:'configuracion',automatizaciones:'automatizaciones',inicio:'inicio',bitacora:'bitacora',aprendizaje:'aprendizaje',libros:'libros',pendientes:'pendientes'};
 function surface(text){const q=strip(text);
  if(/^(?:cierra|quita|oculta)(?: (?:esta|la|esa))? tarjeta$/.test(q))return {kind:'close_card',card:null};
  let m=q.match(/^(?:abre|abrir|abreme|muestra|muestrame|pon|ponme)(?: (?:una|la|el))? (?:tarjeta|ventana) (?:de|del|de la) (\w+)$/);if(m&&SECTIONS[m[1]])return {kind:'card',card:m[1]==='gym'?'gimnasio':m[1]};
  m=q.match(/^(?:abre|abrir|abreme|ve a|vamos a|llevame a|entra a|entra en)(?: (?:la seccion de|el apartado de|el|la|al|a))? (\w+)$/);if(m&&SECTIONS[m[1]])return {kind:'section',section:SECTIONS[m[1]]};
  return null;}
 function intent(text){const raw=String(text||'').trim(),q=strip(raw),r=rawStrip(raw);if(!q)return null;
  const s=surface(raw);if(s)return {type:'surface',...s};
  if(/^(?:que sigue|que me toca|que hago ahora|que sigue ahora)$/.test(q))return {type:'plan_next'};
  if(/^(?:prepara(?:me)?|organiza(?:me)?|planea(?:me)?) (?:mi dia|el dia|manana|el dia de manana)\b|^reorganiza (?:mi|el) dia\b/.test(q))return {type:'plan',day:/manana/.test(q.slice(0,40))?'tomorrow':'today',text:raw};
  if(/\b(?:cuanto (?:me )?(?:tardo|tarda|hago)|como llego|que tan lejos|a que distancia)\b/.test(q))return {type:'route',text:raw};
  if(/^(?:usa|usar|cambia|pasa|pon|activa|responde|razona|piensa)\b.*\b(?:chispa|profundo|profunda|a fondo|nivel enfoque|nivel normal|ia en enfoque)\b|^nivel (?:chispa|enfoque|profundo)$/.test(q))return {type:'tier',text:raw};
  let m=r.match(/^(?:agrega|anota|crea|pon) (?:una )?tarea (?:para|de|a) ([\wÁÉÍÓÚÑáéíóúñ ]+?)(?::\s*| que | de )(.+)$/i);if(m)return {type:'task_create',client:m[1].trim(),title:m[2].trim()};
  m=q.match(/^(?:completa|marca (?:como )?(?:hecha|completada)|termina|ya hice) (?:la )?tarea (?:de )?(.+)$/);if(m)return {type:'task_complete',query:m[1]};
  m=q.match(/^(?:reabre|reactiva) (?:la )?tarea (?:de )?(.+)$/);if(m)return {type:'task_reopen',query:m[1]};
  m=q.match(/^(?:que tareas tengo|tareas)(?: (?:de|con|para) ([\wñ ]+))?$/);if(m)return {type:'task_list',client:m[1]||null};
  m=r.match(/^corrige(?: que)?[:,]?\s+(.{3,})$/i);if(m)return {type:'memory_correct',text:m[1].trim()};
  if(/^(?:te acuerdas|recuerdas|te acordas)\b.*\b(?:sobre|de|del)\b/.test(q)&&!/^recuerdas lo que te pregunte/.test(q))return {type:'memory_search',question:raw};
  return {type:'scene_candidate',text:raw};// server resolves exact triggers; no match ⇒ fall through to existing intents/AI
 }
 /* ---------- long dictation ---------- */
 const DICT={chunkSec:45,overlapSec:3,maxTotalSec:900,maxChunks:20};
 function chunkPlan(totalSec,o=DICT){const out=[];if(!(totalSec>0))return out;let start=0,i=0;while(start<totalSec&&i<o.maxChunks){const end=Math.min(totalSec,start+o.chunkSec);out.push({index:i,start,end});if(end>=totalSec)break;start=end-o.overlapSec;i++;}return out;}
 const words=t=>String(t||'').trim().split(/\s+/).filter(Boolean),nw=w=>norm(w);
 function joinPair(a,b,maxOverlap=14){const A=words(a),B=words(b);let best=0;for(let k=Math.min(maxOverlap,A.length,B.length);k>=2;k--){let ok=true;for(let i=0;i<k;i++)if(nw(A[A.length-k+i])!==nw(B[i])){ok=false;break;}if(ok){best=k;break;}}return [...A,...B.slice(best)].join(' ');}
 function assemble(chunks){const by=new Map();for(const c of chunks||[])if(c&&Number.isInteger(c.index)&&typeof c.text==='string'&&!by.has(c.index))by.set(c.index,c.text.trim());
  const idx=[...by.keys()].sort((x,y)=>x-y),max=idx.length?idx[idx.length-1]:-1,missing=[];for(let i=0;i<=max;i++)if(!by.has(i))missing.push(i);
  let text='';for(const i of idx){const t=by.get(i);if(!t)continue;text=text?joinPair(text,t):t;}return {text,missing,complete:!missing.length&&idx.length>0,count:idx.length};}
 function highImpact(text){const q=norm(text);return q.length>280||/\b(borr|elimin|quit|pag|transfier|registr|gast|cobr|envi|mand|agreg|cre[ao]|reorganiz)\w*|\bprepara (?:mi dia|manana)\b/.test(q);}
 /* ---------- wake word ---------- */
 const WAKE_VARIANTS=['ivi','ivy','evie','libi','liby','livi','ibi'];
 function wakeGate({phase='idle',speakingEndedAt=0,now=Date.now(),turnOpen=false}){if(['speaking','thinking','listening'].includes(phase))return {allow:false,why:'busy'};if(now-speakingEndedAt<1200)return {allow:false,why:'echo_guard'};if(turnOpen)return {allow:false,why:'turn_open'};return {allow:true};}
 /* ---------- lifecycle ---------- */
 const STAGES=['request_started','transcribing','thinking','searching','tool_running','speaking','completed','failed'],FINAL=new Set(['completed','failed']);
 function lifecycle(onEvent){const id='r-'+(crypto.randomUUID?crypto.randomUUID():String(Date.now())),t0=Date.now();let last=null,done=false;const log=[];
  const emit=(stage,meta={})=>{if(done||!STAGES.includes(stage))return false;const safe={};for(const k of ['tool','tier','code','chunk'])if(typeof meta[k]==='string'||typeof meta[k]==='number')safe[k]=String(meta[k]).slice(0,40);
   const ev={request_id:id,stage,at_ms:Date.now()-t0,...safe};log.push(ev);last=stage;if(FINAL.has(stage))done=true;try{onEvent?.(ev);}catch{}return true;};
  emit('request_started');return {id,emit,get stage(){return last;},get done(){return done;},log};}
 function cuePlan({stage,elapsedMs,muted=false,reduced=false,maxMs=20000,everyMs=2500}){if(muted||!['thinking','searching','tool_running'].includes(stage)||elapsedMs>maxMs)return {play:false};return {play:true,soft:reduced,next:everyMs};}
 return Object.freeze({norm,strip,surface,intent,DICT,chunkPlan,joinPair,assemble,highImpact,WAKE_VARIANTS,wakeGate,STAGES,lifecycle,cuePlan});
})();
