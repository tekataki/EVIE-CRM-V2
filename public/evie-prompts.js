'use strict';
/* EVIE · Biblioteca de prompts (Automatizaciones → pestaña «Prompts»). Pure helpers, no DOM.
   Records live in Store.get().preferences.promptLibrary — an array that syncs inside the account's state row.
   It is deliberately NOT a Store collection: older desktop builds reject unknown collections.
   Record: {id,name,tag,body,notes,pinned,copies,created_at,updated_at,last_copied_at}
   Limits: 300 prompts · name ≤ 120 · tag ≤ 40 · body ≤ 50,000 characters · notes ≤ 2,000 · whole library ≤ 1.5 MB
   (UTF-8 bytes of its JSON). Every write goes through build() + upsert(), which throw Spanish errors with
   error.field ('name' | 'tag' | 'body' | 'notes' | null) so the form can point at the right input.
   intent(text) handles «Ivi, abre mis prompts» / «muéstrame mis prompts (de SOMA)»: it opens
   #automatizaciones/prompts and returns a short spoken reply, or null when the phrase is not about the library.
   (No \u escapes for printable characters in this file: \p{Mn}, [^\S\n] and fromCharCode keep it tool-safe.) */
window.EviePrompts=(()=>{
 const MAX_PROMPTS=300,MAX_NAME=120,MAX_TAG=40,MAX_BODY=50000,MAX_NOTES=2000,MAX_BYTES=1.5*1024*1024;
 // Preview: an excerpt of the first lines; «fold» = may be taller than the collapsed block (7 lines) → fade + «Ver completo».
 const PREVIEW_LINES=12,PREVIEW_CHARS=900,FOLD_LINES=6,FOLD_CHARS=180;
 const DEFAULT_TAGS=Object.freeze(['SOMA','Alvento','Escuela','Personal']);
 const ID=/^[A-Za-z0-9-]{1,80}$/;
 const limits=Object.freeze({MAX_PROMPTS,MAX_NAME,MAX_TAG,MAX_BODY,MAX_NOTES,MAX_BYTES});

 /* ---------- text helpers ---------- */
 const fold=s=>String(s??'').normalize('NFD').replace(/\p{Mn}/gu,'').toLowerCase();
 const norm=s=>fold(s).replace(/\s+/g,' ').trim();
 const NF=(()=>{try{return new Intl.NumberFormat('es-MX');}catch{return null;}})();
 const num=n=>{const v=Number(n)||0;return NF?NF.format(v):String(v).replace(/\B(?=(\d{3})+(?!\d))/g,',');};
 const times=n=>n===1?'1 vez':num(n)+' veces';
 // Lone surrogates and NUL break the synced JSON (PostgreSQL jsonb rejects both), so they never reach a record.
 const LONE=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,REPLACEMENT=String.fromCharCode(0xFFFD);
 const wf=s=>typeof s.toWellFormed==='function'?s.toWellFormed():s.replace(LONE,REPLACEMENT);
 const line=v=>wf(String(v??'')).replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim();// \s also covers U+2028/U+2029
 const text=v=>wf(String(v??'')).replace(/\r\n?/g,'\n').replace(/\u0000/g,'');
 // Body: keep the user's formatting; only drop blank lines at the start and whitespace at the end.
 const cleanBody=v=>text(v).replace(/^(?:[^\S\n]*\n)+/,'').replace(/\s+$/,'');
 const cleanNotes=v=>text(v).trim();
 /** UTF-8 byte length (what the library limit measures). */
 function bytes(v){const s=String(v??'');let n=0;for(let k=0;k<s.length;k++){const c=s.charCodeAt(k);
   if(c<0x80)n+=1;else if(c<0x800)n+=2;else if(c>=0xD800&&c<0xDC00&&k+1<s.length&&(s.charCodeAt(k+1)&0xFC00)===0xDC00){n+=4;k++;}else n+=3;}
  return n;}
 const size=lib=>bytes(JSON.stringify(Array.isArray(lib)?lib:[]));
 const mb=n=>String(Math.round(n/1048576*100)/100)+' MB';
 const count=v=>Number.isSafeInteger(v)&&v>=0?v:0;
 const isoOrNull=v=>typeof v==='string'&&!Number.isNaN(Date.parse(v))?v:null;
 function fail(message,field=null){const err=new Error(message);err.field=field;return err;}
 function uid(){try{if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();}catch{}
  return 'p'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}

 /* ---------- validation + building ---------- */
 function clean(input={}){const x=input||{};return {name:line(x.name),tag:line(x.tag),body:cleanBody(x.body),notes:cleanNotes(x.notes)};}
 function problem(c){
  if(!c.name)return fail('Ponle un nombre al prompt.','name');
  if(c.name.length>MAX_NAME)return fail(`El nombre es demasiado largo: máximo ${MAX_NAME} caracteres (tiene ${num(c.name.length)}).`,'name');
  if(c.tag.length>MAX_TAG)return fail(`La etiqueta es demasiado larga: máximo ${MAX_TAG} caracteres.`,'tag');
  if(!c.body)return fail('Pega el texto del prompt.','body');
  if(c.body.length>MAX_BODY)return fail(`El prompt tiene ${num(c.body.length)} caracteres y el máximo es ${num(MAX_BODY)}. Divídelo en dos prompts.`,'body');
  if(c.notes.length>MAX_NOTES)return fail(`Las notas son demasiado largas: máximo ${num(MAX_NOTES)} caracteres.`,'notes');
  return null;}
 /** First problem of a form input as {field,message}, or null when it can be saved. */
 function check(input){const p=problem(clean(input));return p?{field:p.field,message:p.message}:null;}
 /** Validated record from form input. Editing keeps id, created_at, pinned, copies and unknown fields; updated_at
     only moves when name/tag/body/notes really changed. opts: {now, id}. Throws Error(.field) when invalid. */
 function build(input={},prev=null,opts={}){const c=clean(input),p=problem(c);if(p)throw p;
  const now=opts.now||new Date().toISOString(),id=String(prev?.id||opts.id||uid());
  if(!ID.test(id))throw fail('Identificador de prompt no válido.');
  const same=!!prev&&prev.name===c.name&&(prev.tag||'')===c.tag&&prev.body===c.body&&(prev.notes||'')===c.notes;
  return {...(prev||{}),id,name:c.name,tag:c.tag,body:c.body,notes:c.notes,
   pinned:typeof input?.pinned==='boolean'?input.pinned:prev?.pinned===true,copies:count(prev?.copies),
   created_at:isoOrNull(prev?.created_at)||now,updated_at:same?(isoOrNull(prev.updated_at)||now):now,last_copied_at:isoOrNull(prev?.last_copied_at)};}
 /** A stored record that can be shown and copied (synced data may come from another device or version). */
 function valid(r){return !!r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.id==='string'&&ID.test(r.id)&&typeof r.name==='string'&&!!r.name.trim()&&typeof r.body==='string'&&!!r.body;}
 const tidy=r=>typeof r.tag==='string'&&typeof r.notes==='string'&&typeof r.pinned==='boolean'&&count(r.copies)===r.copies&&!!isoOrNull(r.created_at)&&!!isoOrNull(r.updated_at)&&(r.last_copied_at===null||!!isoOrNull(r.last_copied_at));
 function sane(r){if(!valid(r))return null;if(tidy(r))return r;
  const created=isoOrNull(r.created_at)||isoOrNull(r.updated_at)||new Date(0).toISOString();
  return {...r,tag:typeof r.tag==='string'?r.tag:'',notes:typeof r.notes==='string'?r.notes:'',pinned:r.pinned===true,copies:count(r.copies),created_at:created,updated_at:isoOrNull(r.updated_at)||created,last_copied_at:isoOrNull(r.last_copied_at)};}
 /** The library of a Store state: valid records only, first copy of each id (same objects when already tidy). */
 function list(state){const raw=state?.preferences?.promptLibrary;if(!Array.isArray(raw))return [];
  const seen=new Set(),out=[];for(const r of raw){const x=sane(r);if(!x||seen.has(x.id))continue;seen.add(x.id);out.push(x);}return out;}

 /* ---------- library operations (pure: they return a new array) ---------- */
 /** Insert or replace a record, enforcing the 300-prompt and 1.5 MB limits (shrinking edits always pass). */
 function upsert(lib,rec){const cur=Array.isArray(lib)?[...lib]:[];if(!valid(rec))throw fail('El prompt no es válido.');const at=cur.findIndex(x=>x.id===rec.id);
  if(at<0&&cur.length>=MAX_PROMPTS)throw fail(`Llegaste al límite de ${MAX_PROMPTS} prompts. Borra alguno que ya no uses para guardar uno nuevo.`);
  const next=at<0?[...cur,rec]:cur.map((x,k)=>k===at?rec:x),after=size(next);
  if(after>MAX_BYTES&&after>size(cur))throw fail(`Tu biblioteca de prompts llegó al límite de 1.5 MB (con este cambio ocuparía ${mb(after)}). Borra prompts que ya no uses o acorta este.`,'body');
  return next;}
 const remove=(lib,id)=>(Array.isArray(lib)?lib:[]).filter(x=>x.id!==id);
 /** Undo of a delete: puts the record back at its old position (limits still apply). */
 function restore(lib,rec,index=-1){const cur=remove(lib,rec?.id),next=upsert(cur,rec);if(index<0||index>=cur.length)return next;const r=next.pop();next.splice(index,0,r);return next;}
 function copyName(lib,name){const base=line(name).replace(/\s*\(copia(?: \d+)?\)$/i,'')||'Prompt',taken=new Set((lib||[]).map(x=>norm(x.name)));
  for(let k=1;k<1000;k++){const suf=k===1?' (copia)':` (copia ${k})`,n=base.slice(0,MAX_NAME-suf.length).trimEnd()+suf;if(!taken.has(norm(n)))return n;}
  return base.slice(0,MAX_NAME);}
 /** Copy of a prompt as a new unpinned record named «… (copia)». Returns {list, record}. */
 function duplicate(lib,id,opts={}){const src=(lib||[]).find(x=>x.id===id);if(!src)throw fail('Ese prompt ya no existe.');
  const now=opts.now||new Date().toISOString(),rec={...src,id:String(opts.id||uid()),name:copyName(lib,src.name),pinned:false,copies:0,created_at:now,updated_at:now,last_copied_at:null};
  return {list:upsert(lib,rec),record:rec};}
 const togglePin=(lib,id,on)=>(lib||[]).map(x=>x.id===id?{...x,pinned:typeof on==='boolean'?on:!x.pinned}:x);
 const markCopied=(lib,id,now=new Date().toISOString())=>(lib||[]).map(x=>x.id===id?{...x,copies:count(x.copies)+1,last_copied_at:now}:x);

 /* ---------- ordering, search, tags ---------- */
 const ms=v=>{const t=Date.parse(v||'');return Number.isNaN(t)?0:t;};
 /** Most recent of: last copy, last edit, creation. */
 const recency=r=>Math.max(ms(r?.last_copied_at),ms(r?.updated_at),ms(r?.created_at));
 const byName=(a,b)=>String(a.name).localeCompare(String(b.name),'es',{sensitivity:'base'});
 const order=(a,b)=>((b.pinned===true)-(a.pinned===true))||(recency(b)-recency(a))||byName(a,b);
 /** Pinned first, then most recently used/updated, then name. */
 const sort=lib=>[...(lib||[])].sort(order);
 const STOP=new Set(['de','del','la','el','los','las','lo','un','una','unos','unas','para','por','con','en','y','o','a','al','mi','mis','tu','tus','su','sus','que','prompt','prompts']);
 /** Search words: accent/case-insensitive; filler words are ignored unless the query is only filler. */
 function terms(q){const all=norm(q).split(' ').filter(Boolean),keep=all.filter(w=>!STOP.has(w));return keep.length?keep:all;}
 const hay=new WeakMap();
 function fields(r){let h=hay.get(r);if(!h){h={name:norm(r.name),tag:norm(r.tag),text:norm(r.body+' '+(r.notes||''))};hay.set(r,h);}return h;}
 /** Prompts matching every word in name, tag, body or notes (optionally one tag), best matches first:
     pinned → more name/tag hits → most recent. An empty query returns the whole (filtered) library sorted. */
 function search(lib,query='',tag=''){const t=terms(query),k=norm(tag),rows=[];
  for(const r of lib||[]){if(k&&norm(r.tag)!==k)continue;if(!t.length){rows.push([0,r]);continue;}
   const h=fields(r);let score=0,ok=true;for(const w of t){const s=h.name.includes(w)?3:h.tag.includes(w)?2:h.text.includes(w)?1:0;if(!s){ok=false;break;}score+=s;}
   if(ok)rows.push([score,r]);}
  rows.sort((a,b)=>((b[1].pinned===true)-(a[1].pinned===true))||(b[0]-a[0])||order(a[1],b[1]));
  return rows.map(x=>x[1]);}
 /** Tags in use: [{key,label,count}], most used first; label keeps the casing of the most recent prompt. */
 function tags(lib){const m=new Map();for(const r of sort(lib)){const k=norm(r.tag);if(!k)continue;const t=m.get(k);if(t)t.count++;else m.set(k,{key:k,label:r.tag,count:1});}
  return [...m.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'es',{sensitivity:'base'}));}
 /** Tag suggestions for the form: tags already used, then the defaults (SOMA, Alvento, Escuela, Personal). */
 function suggestions(lib,max=10){const used=tags(lib),seen=new Set(used.map(t=>t.key));return [...used.map(t=>t.label),...DEFAULT_TAGS.filter(d=>!seen.has(norm(d)))].slice(0,max);}
 /** Card preview: the first lines (excerpt), whether the body continues (truncated) and whether it needs folding. */
 function preview(body,{lines=PREVIEW_LINES,chars=PREVIEW_CHARS}={}){const s=String(body??'');let end=-1;
  for(let k=0;k<lines;k++){end=s.indexOf('\n',end+1);if(end<0)break;}
  let cut=Math.min(end<0?s.length:end,chars);if(cut<s.length&&cut>0){const c=s.charCodeAt(cut-1);if(c>=0xD800&&c<0xDC00)cut--;}
  const excerpt=s.slice(0,cut).replace(/\s+$/,''),truncated=cut<s.length;
  return {text:excerpt,truncated,fold:truncated||excerpt.split('\n').length>FOLD_LINES||excerpt.length>FOLD_CHARS};}
 /** «hoy», «ayer», «20 nov» or «20 nov 2025» (local time). */
 function when(iso,now=new Date()){const d=new Date(iso||'');if(!iso||Number.isNaN(+d))return 'sin fecha';
  const key=x=>x.getFullYear()+'-'+x.getMonth()+'-'+x.getDate(),y=new Date(now);y.setDate(y.getDate()-1);
  if(key(d)===key(now))return 'hoy';if(key(d)===key(y))return 'ayer';
  const o={day:'numeric',month:'short'};if(d.getFullYear()!==now.getFullYear())o.year='numeric';
  try{return d.toLocaleDateString('es-MX',o).replace(/\./g,'').replace(/ de /g,' ');}catch{return String(iso).slice(0,10);}}

 /* ---------- voice: «Ivi, abre mis prompts» ---------- */
 const WAKE=/^(?:(?:oye|hey|hola|ok|okey|okay|oiga)\s+)?(?:evie|evi|ivi|ivy|ibi|ebi|libi|eby|evy|ivie)\b[\s,]*/;
 const PW='(?:prompts?|promts?|promps?|proms)';
 const VERB='(?:abre(?:me)?|abrir|abri|muestra(?:me)?|mostrar(?:me)?|mostrame|ensena(?:me)?|ensenar(?:me)?|quiero ver|dejame ver|deja ver|ver|me (?:muestras|ensenas|abres)|lleva(?:me)? a|ir a|ve a|vamos a|entra a|entrar a|pasa(?:me)? a|pon(?:me)?|despliega|busca(?:me)?|copia(?:me)?|copiar)';
 const FILL='(?:(?:a |al )?(?:(?:mis|mi|los|las|la|el|tus|tu) )?(?:(?:biblioteca|lista|listado|seccion|apartado|pestana|carpeta|coleccion) (?:de |del )?(?:(?:mis|los) )?)?)';
 const RE_OPEN=new RegExp('^(?<verb>'+VERB+') (?<fill>'+FILL+')'+PW+'(?: (?:guardados|que (?:guarde|tengo)(?: guardados)?))?(?: en automatizaciones)?(?: (?:de|del|para|sobre|con) (?<q>.{1,60}))?$');
 const RE_BARE=new RegExp('^(?:(?:mis|los) )?'+PW+'(?: guardados)?$');
 const RE_WHERE=new RegExp('^donde (?:estan|tengo|guarde|guardo|quedaron|deje) (?:(?:mis|los) )?'+PW+'$');
 /** {query} when the phrase asks to open/show the prompt library (query = «de SOMA» part, normalized), else null.
     Requests to WRITE a prompt («escríbeme un prompt…», «crea un prompt…») are not ours: they go to the AI. */
 function parseIntent(input){let q=fold(input).replace(/['’`´]/g,'').replace(/[¿?¡!.,;:"«»“”()[\]{}…–—]/g,' ').replace(/\s+/g,' ').trim();
  q=q.replace(WAKE,'').replace(/\s+(?:por favor|porfa|porfavor|gracias)$/,'').trim();if(!q)return null;
  const m=q.match(RE_OPEN);
  if(m){if(/^busca/.test(m.groups.verb)&&!/\b(?:mis|mi|tus|tu|biblioteca|lista|listado|coleccion|carpeta)\b/.test(m.groups.fill))return null;
   const query=(m.groups.q||'').trim();return {query:/^(?:mi|mis|ellos|eso|esos)$/.test(query)?'':query};}
  return RE_BARE.test(q)||RE_WHERE.test(q)?{query:''}:null;}
 /** Show the Prompts tab (optionally searching or filtering by tag) through the view when it is loaded. */
 function open(query='',tag=''){try{const V=window.EvieAutomationsView;if(typeof V?.showPrompts==='function'){V.showPrompts(query,tag);return;}}catch{}
  try{location.hash='automatizaciones/prompts';}catch{}}
 /** Voice router hook: navigates to #automatizaciones/prompts and returns a short spoken reply; null = not ours. */
 function intent(input){const m=parseIntent(input);if(!m)return null;
  let all=[];try{all=list(window.Store?.get?.());}catch{all=[];}
  const q=m.query,key=q?terms(q).join(' '):'',tag=q?tags(all).find(t=>t.key===norm(q)||t.key===key)||null:null,hits=!q?all:tag?search(all,'',tag.key):search(all,q);
  open(q&&hits.length&&!tag?q:'',tag&&hits.length?tag.key:'');
  if(!all.length)return 'Abrí tus prompts. Aún no tienes ninguno guardado: toca «Guardar mi primer prompt» para empezar.';
  if(q&&!hits.length)return `No encontré prompts de «${q}», así que te muestro todos.`;
  const what=tag?tag.label:q;
  if(hits.length===1)return `Aquí está «${hits[0].name}». Toca «Copiar» para usarlo.`;
  return q?`Encontré ${hits.length} prompts de ${what}. Toca «Copiar» en el que necesites.`:`Aquí están tus ${hits.length} prompts. Toca «Copiar» en el que necesites.`;}

 // validate(r) mirrors EvieAutomations.validate: true when a stored record is usable; check(input) is for form input.
 return Object.freeze({limits,DEFAULT_TAGS,norm,num,times,bytes,size,clean,check,build,valid,validate:valid,list,upsert,remove,restore,copyName,duplicate,togglePin,markCopied,recency,sort,terms,search,tags,suggestions,preview,when,parseIntent,open,intent});
})();
