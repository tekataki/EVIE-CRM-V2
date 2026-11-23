'use strict';
// Biblioteca de prompts (Automatizaciones → «Prompts»): public/evie-prompts.js (pure helpers) and the Prompts tab of
// public/evie-automations-ui.js run in a vm with small DOM/Store stubs. Values created inside the vm belong to
// another realm: compare them through JSON/join or primitives, never with deepStrictEqual.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../public',f),'utf8');
const J=x=>JSON.stringify(x);
const NOW='2026-11-22T18:00:00.000Z';
const day=(d,h=12)=>`2026-11-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:00:00.000Z`;
function helpers({state=null,extra={}}={}){const ctx={console,crypto:globalThis.crypto,location:{hash:''},Store:{get:()=>state},...extra};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('evie-prompts.js'),ctx);return ctx;}
/** Five prompts: p4 pinned, p5 copied most recently; «SOMA» and «soma» are the same tag. */
function sample(P){const mk=(id,name,tag,body,o={})=>{const r={...P.build({name,tag,body,notes:o.notes||''},null,{now:o.at,id})};if(o.pinned)r.pinned=true;if(o.copied){r.copies=1;r.last_copied_at=o.copied;}return r;};
 return [mk('p1','Prompt para backend de SOMA','SOMA','Eres un ingeniero backend. Usa Hono y Supabase.',{at:day(10)}),
  mk('p2','Ensayo de historia','Escuela','Redacta un ensayo sobre la Revolución Mexicana.',{at:day(12)}),
  mk('p3','Copy para Instagram','Alvento','Escribe captions para la tienda; menciona SOMA solo de pasada.',{at:day(14),notes:'Funciona mejor con Claude'}),
  mk('p4','Rutina de gym','Personal','Arma una rutina de 4 días.',{at:day(8),pinned:true}),
  mk('p5','Revisión de código','soma','Revisa este PR del backend con calma.',{at:day(9),copied:day(20)})];}
const ids=list=>list.map(x=>x.id).join();

test('validation: required name and body, length limits, clear Spanish errors naming the field to fix',()=>{const P=helpers().EviePrompts,L=P.limits;
 assert.equal(L.MAX_PROMPTS,300);assert.equal(L.MAX_BODY,50000);assert.equal(L.MAX_NAME,120);assert.equal(L.MAX_TAG,40);assert.equal(L.MAX_BYTES,1.5*1024*1024);
 const bad=(input,field,re)=>{let err=null;try{P.build(input,null,{now:NOW});}catch(x){err=x;}assert.ok(err,'debe fallar: '+J(input).slice(0,60));
  assert.equal(err.field,field);assert.match(err.message,re);assert.equal(J(P.check(input)),J({field,message:err.message}));};
 bad({name:'  ',body:'x'},'name',/^Ponle un nombre al prompt\.$/);
 bad({name:'x'.repeat(121),body:'x'},'name',/máximo 120 caracteres \(tiene 121\)/);
 bad({name:'Ok',tag:'t'.repeat(41),body:'x'},'tag',/etiqueta es demasiado larga: máximo 40/);
 bad({name:'Ok',body:' \n\t \n'},'body',/^Pega el texto del prompt\.$/);
 bad({name:'Ok',body:'a'.repeat(50001)},'body',/tiene 50,001 caracteres y el máximo es 50,000\. Divídelo en dos prompts\./);
 bad({name:'Ok',body:'x',notes:'n'.repeat(2001)},'notes',/notas son demasiado largas/);
 assert.equal(P.check({name:'x'.repeat(120),tag:'t'.repeat(40),body:'a'.repeat(50000)}),null,'exactly at the limits is fine');});

test('build: cleans the input, keeps the body formatting, edits keep id/stats/unknown fields',()=>{const P=helpers().EviePrompts,NUL=String.fromCharCode(0);
 const r=P.build({name:'  Prompt   para backend\nde SOMA ',tag:' SOMA ',body:'\r\n\n  Eres un backend senior.\r\n\tUsa Hono.'+NUL+'\n\n  ',notes:' Para Claude '},null,{now:NOW});
 assert.match(r.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);assert.equal(r.name,'Prompt para backend de SOMA');assert.equal(r.tag,'SOMA');
 assert.equal(r.body,'  Eres un backend senior.\n\tUsa Hono.','CRLF → LF, no NUL, no blank lines around, indentation kept');assert.equal(r.notes,'Para Claude');
 assert.equal(J([r.pinned,r.copies,r.last_copied_at,r.created_at,r.updated_at]),J([false,0,null,NOW,NOW]));assert.ok(P.valid(r));assert.ok(P.validate(r));assert.equal(P.validate({id:'x',name:'n',body:''}),false);
 const prev={...r,pinned:true,copies:4,last_copied_at:day(21),extra:'de una versión futura'},later='2026-11-23T00:00:00.000Z';
 const same=P.build({name:r.name,tag:'SOMA',body:r.body,notes:'Para Claude'},prev,{now:later});
 assert.equal(same.updated_at,NOW,'saving without real changes keeps updated_at');assert.equal(J([same.id,same.pinned,same.copies,same.extra]),J([r.id,true,4,'de una versión futura']));
 const edited=P.build({name:'Backend SOMA v2',body:'Nuevo'},prev,{now:later});
 assert.equal(J([edited.updated_at,edited.created_at,edited.last_copied_at,edited.tag]),J([later,NOW,day(21),'']));
 assert.throws(()=>P.build({name:'x',body:'y'},null,{id:'id con espacios'}),/Identificador/);});

test('list: reads preferences.promptLibrary defensively (bad entries dropped, duplicates ignored, missing fields repaired)',()=>{
 const good={id:'a1',name:'Uno',tag:'',body:'x',notes:'',pinned:false,copies:0,created_at:NOW,updated_at:NOW,last_copied_at:null};
 const state={preferences:{promptLibrary:[good,{...good,name:'Duplicado'},null,'texto',{id:'bad id',name:'x',body:'y'},{id:'b2',name:'',body:'y'},{id:'c3',name:'Sin cuerpo',body:''},{id:'d4',name:'Viejo',body:'z',copies:-3,pinned:'si',updated_at:'ayer'}]}};
 const P=helpers({state}).EviePrompts,l=P.list(state);
 assert.equal(ids(l),'a1,d4');assert.equal(l[0],good,'tidy records are returned as they are');
 assert.equal(J([l[1].copies,l[1].pinned,l[1].tag,l[1].notes,l[1].last_copied_at,l[1].updated_at]),J([0,false,'','',null,new Date(0).toISOString()]));
 assert.equal(P.list({preferences:{}}).length,0);assert.equal(P.list(null).length,0);assert.equal(P.list({preferences:{promptLibrary:'x'}}).length,0);});

test('search: name, tag, body and notes; accent/case-insensitive; every word must match; best matches first',()=>{const P=helpers().EviePrompts,lib=sample(P);
 assert.equal(ids(P.search(lib,'backend')),'p1,p5','name hit (p1) before body hit (p5)');
 assert.equal(ids(P.search(lib,'SOMA')),'p1,p5,p3','name > tag > body');
 assert.equal(ids(P.search(lib,'revolucion MEXICANA')),'p2');assert.equal(ids(P.search(lib,'revisión')),'p5');assert.equal(ids(P.search(lib,'código')),'p5');
 assert.equal(ids(P.search(lib,'backend hono')),'p1','all words must be present');
 assert.equal(ids(P.search(lib,'prompt de soma')),'p1,p5,p3','filler words are ignored');assert.equal(P.terms('de la').join(),'de,la','…unless the query is only filler');
 assert.equal(ids(P.search(lib,'claude')),'p3','notes are searchable');assert.equal(ids(P.search(lib,'rutina')),'p4');
 assert.equal(ids(P.search(lib,'','SOMA')),'p5,p1','tag filter is case-insensitive');assert.equal(ids(P.search(lib,'codigo','soma')),'p5');assert.equal(P.search(lib,'zzz').length,0);
 assert.equal(ids(P.search(lib,'')),ids(P.sort(lib)),'no query = the sorted library');});

test('sort: pinned first, then most recently used/updated, then name',()=>{const P=helpers().EviePrompts,lib=sample(P);
 assert.equal(ids(P.sort(lib)),'p4,p5,p3,p2,p1');
 const copied=P.markCopied(lib,'p1',day(21));assert.equal(ids(P.sort(copied)),'p4,p1,p5,p3,p2','a fresh copy moves it up');
 const pinned=P.togglePin(lib,'p2');assert.equal(ids(P.sort(pinned)).slice(0,5),'p2,p4','pinned prompts keep their own recency order');
 const tie=[{id:'b',name:'Beta',updated_at:NOW},{id:'a',name:'alfa',updated_at:NOW}];assert.equal(ids(P.sort(tie)),'a,b');
 assert.equal(P.recency({created_at:day(1),updated_at:day(2),last_copied_at:day(3)}),Date.parse(day(3)));});

test('limits: 300 prompts, 1.5 MB library measured in UTF-8, shrinking edits always pass',()=>{const P=helpers().EviePrompts;
 assert.equal(J([P.bytes('abc'),P.bytes('ñé'),P.bytes('€'),P.bytes('😀')]),J([3,4,3,4]));
 const lib=[];for(let k=0;k<300;k++)lib.push(P.build({name:'P'+k,body:'b'},null,{now:NOW,id:'id-'+k}));
 assert.throws(()=>P.upsert(lib,P.build({name:'Uno más',body:'b'},null,{now:NOW,id:'id-300'})),/Llegaste al límite de 300 prompts/);
 const edited=P.upsert(lib,P.build({name:'P0 editado',body:'c'},lib[0],{now:NOW}));assert.equal(edited.length,300);assert.equal(edited[0].name,'P0 editado');assert.equal(lib[0].name,'P0','upsert does not mutate');
 const big=k=>P.build({name:'Grande '+k,body:'x'.repeat(50000)},null,{now:NOW,id:'big-'+k});
 let heavy=[];for(let k=0;k<31;k++)heavy=P.upsert(heavy,big(k));assert.ok(P.size(heavy)<=P.limits.MAX_BYTES);
 assert.throws(()=>P.upsert(heavy,big(31)),err=>/llegó al límite de 1\.5 MB/.test(err.message)&&err.field==='body');
 const over=[...heavy,big(31),big(32)];assert.ok(P.size(over)>P.limits.MAX_BYTES,'e.g. synced from a device with other limits');
 assert.equal(P.upsert(over,P.build({name:'Grande 0',body:'corto'},over[0],{now:NOW}))[0].body,'corto','shrinking is allowed even over the limit');
 assert.throws(()=>P.upsert(over,P.build({name:'Grande 1 con un nombre bastante más largo',body:over[1].body},over[1],{now:NOW})),/1\.5 MB/);
 assert.throws(()=>P.upsert([],{id:'x',name:'',body:''}),/no es válido/);});

test('duplicate, pin, copy stats, delete and undo are pure list operations',()=>{const P=helpers().EviePrompts,lib=sample(P);
 const d=P.duplicate(lib,'p1',{now:NOW,id:'p6'});assert.equal(d.record.name,'Prompt para backend de SOMA (copia)');assert.equal(d.record.body,lib[0].body);
 assert.equal(J([d.record.pinned,d.record.copies,d.record.last_copied_at,d.record.created_at,d.list.length]),J([false,0,null,NOW,6]));
 assert.equal(P.duplicate(d.list,'p6',{now:NOW,id:'p7'}).record.name,'Prompt para backend de SOMA (copia 2)');assert.throws(()=>P.duplicate(lib,'nope'),/ya no existe/);
 const pinned=P.togglePin(lib,'p2');assert.equal(pinned.find(x=>x.id==='p2').pinned,true);assert.equal(pinned.find(x=>x.id==='p2').updated_at,lib[1].updated_at,'pinning is not an edit');
 assert.equal(P.togglePin(pinned,'p2',true).find(x=>x.id==='p2').pinned,true);
 const c=P.markCopied(P.markCopied(lib,'p1',day(21)),'p1',day(22)).find(x=>x.id==='p1');assert.equal(J([c.copies,c.last_copied_at]),J([2,day(22)]));
 const gone=P.remove(lib,'p3');assert.equal(ids(gone),'p1,p2,p4,p5');assert.equal(ids(P.restore(gone,lib[2],2)),'p1,p2,p3,p4,p5');assert.equal(ids(P.restore(gone,lib[2])),'p1,p2,p4,p5,p3');
 assert.equal(P.copyName([{name:'X (copia)'}],'X'),'X (copia 2)');assert.equal(P.copyName([],'x'.repeat(120)).length,120);});

test('tags and suggestions: counted case-insensitively; SOMA/Alvento/Escuela/Personal fill in as suggestions',()=>{const P=helpers().EviePrompts,lib=sample(P);
 assert.equal(P.tags(lib).map(t=>t.key+':'+t.count).join(),'soma:2,alvento:1,escuela:1,personal:1');assert.equal(P.tags(lib)[0].label,'soma','label of the most recent prompt');
 assert.equal(P.suggestions(lib).join(),'soma,Alvento,Escuela,Personal');assert.equal(P.suggestions([]).join(),'SOMA,Alvento,Escuela,Personal');
 assert.equal(P.suggestions([{id:'x',name:'n',body:'b',tag:'Clientes'}]).join(),'Clientes,SOMA,Alvento,Escuela,Personal');});

test('preview: short prompts show whole; long ones fold to an excerpt of the first lines',()=>{const P=helpers().EviePrompts;
 let p=P.preview('Hola\nmundo');assert.equal(J([p.text,p.truncated,p.fold]),J(['Hola\nmundo',false,false]));
 p=P.preview(Array.from({length:30},(_,k)=>'línea '+k).join('\n'));assert.equal(J([p.truncated,p.fold,p.text.split('\n').length]),J([true,true,12]));
 p=P.preview('a'.repeat(5000));assert.equal(J([p.text.length,p.truncated]),J([900,true]));
 p=P.preview('x'.repeat(899)+'😀y');assert.equal(p.text.length,899,'never cuts an emoji in half');
 p=P.preview('1\n2\n3\n4\n5\n6\n7');assert.equal(J([p.truncated,p.fold]),J([false,true]),'7 short lines: whole text, but may need folding');});

test('dates and numbers in es-MX: hoy / ayer / 3 nov / 15 ene 2025, 50,000, «1 vez»',()=>{const P=helpers().EviePrompts,now=new Date(2026,10,22,15,0);
 assert.equal(P.when(new Date(2026,10,22,9,0).toISOString(),now),'hoy');assert.equal(P.when(new Date(2026,10,21,23,0).toISOString(),now),'ayer');
 assert.match(P.when(new Date(2026,10,3,12).toISOString(),now),/^3 nov$/);assert.match(P.when(new Date(2025,0,15,12).toISOString(),now),/^15 ene\.? 2025$/);assert.equal(P.when('',now),'sin fecha');
 assert.equal(J([P.num(50000),P.times(1),P.times(3)]),J(['50,000','1 vez','3 veces']));});

test('voice: «Ivi, abre mis prompts» / «muéstrame mis prompts» open the tab and answer; anything else is null',()=>{
 const state={preferences:{promptLibrary:[]}},ctx=helpers({state}),P=ctx.EviePrompts;
 assert.equal(P.intent('Ivi, abre mis prompts'),'Abrí tus prompts. Aún no tienes ninguno guardado: toca «Guardar mi primer prompt» para empezar.');assert.equal(ctx.location.hash,'automatizaciones/prompts');
 ctx.location.hash='';assert.match(P.intent('muéstrame mis prompts'),/^Abrí tus prompts/);assert.equal(ctx.location.hash,'automatizaciones/prompts');
 for(const s of ['Evie, enséñame mis prompts.','abre la biblioteca de prompts','¿Dónde están mis prompts?','mis prompts','Oye Ivi, llévame a mis prompts por favor','quiero ver mis prompts guardados','Ivi — abre mis promts','ve a la sección de prompts'])
  assert.equal(J(P.parseIntent(s)),J({query:''}),s);
 assert.equal(J(P.parseIntent('Ivi, muéstrame mis prompts de SOMA')),J({query:'soma'}));assert.equal(J(P.parseIntent('abre el prompt para backend de SOMA')),J({query:'backend de soma'}));
 assert.equal(J(P.parseIntent('busca mis prompts de Alvento')),J({query:'alvento'}));
 ctx.location.hash='';
 for(const s of ['abre la página de SOMA','escríbeme un prompt para mi backend','crea un prompt de ventas','muéstrame un ejemplo de prompt','abre automatizaciones','busca prompts de marketing','mejora este prompt','','Ivi',null])
  assert.equal(P.intent(s),null,String(s));
 assert.equal(ctx.location.hash,'','non-matching phrases never navigate');});

test('voice: with prompts it counts them, filters by tag or searches through the view hook',()=>{
 const calls=[],state={preferences:{promptLibrary:[]}},ctx=helpers({state,extra:{EvieAutomationsView:{showPrompts:(q,t)=>calls.push(q+'|'+t)}}}),P=ctx.EviePrompts;
 state.preferences.promptLibrary=sample(P);
 assert.equal(P.intent('Ivi, abre mis prompts'),'Aquí están tus 5 prompts. Toca «Copiar» en el que necesites.');
 assert.equal(P.intent('muéstrame mis prompts de SOMA'),'Encontré 2 prompts de soma. Toca «Copiar» en el que necesites.');
 assert.equal(P.intent('abre mi prompt de la escuela'),'Aquí está «Ensayo de historia». Toca «Copiar» para usarlo.');
 assert.equal(P.intent('abre mis prompts de cocina'),'No encontré prompts de «cocina», así que te muestro todos.');
 assert.match(P.intent('busca mis prompts de backend'),/^Encontré 2 prompts de backend\./);
 assert.equal(calls.join(' / '),'| / |soma / |escuela / | / backend|');assert.equal(ctx.location.hash,'','the view navigates when it is loaded');});

/* ---------- the view (evie-automations-ui.js) with DOM/Store stubs ---------- */
function view({lib=[],id='prompts',section='automatizaciones',stored=null,clipboard='ok'}={}){
 const listeners={},toasts=[],calls={render:0,exec:0,copied:[],confirm:''},storage=new Map(stored?[['evie-test-automatizaciones-tab',stored]]:[]);
 const state={version:4,preferences:{promptLibrary:lib},automations:[]};
 const el=()=>({style:{},dataset:{},setAttribute(){},removeAttribute(){},focus(){},select(){},setSelectionRange(){},remove(){}});
 const ctx={console,crypto:globalThis.crypto,URL,structuredClone,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,location:{hash:''},
  navigator:{clipboard:{writeText:t=>clipboard==='ok'?(calls.copied.push(t),Promise.resolve()):Promise.reject(new Error('NotAllowedError'))}},
  DALI_CONFIG:{storageKey:'evie-test'},localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v))},
  document:{addEventListener(type,fn){(listeners[type]||=[]).push(fn);},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>el(),body:{append(){}},getSelection:()=>null,activeElement:null,
   execCommand:c=>{calls.exec++;if(c==='copy')calls.copied.push('legacy');return true;}},
  UI:{section,id},App:{render(){calls.render++;},toast:(msg,type,undo)=>toasts.push({msg,type,undo}),icons(){},confirmAction:(title,text,fn)=>{calls.confirm=title;fn();}},
  Domain:{escape:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
  Views:{icon:n=>`<i data-lucide="${n}"></i>`,heading:(t,s,a)=>`<div class="page-heading"><h1>${t}</h1><p>${s}</p>${a}</div>`},
  Store:{get:()=>state,list:c=>(state[c]||[]).filter(x=>!x.deleted_at),save(fn){const next=structuredClone(state);fn(next);for(const k of Object.keys(state))delete state[k];Object.assign(state,next);return state;}}};
 ctx.window=ctx;vm.createContext(ctx);for(const f of ['evie-automations.js','evie-prompts.js','evie-automations-ui.js'])vm.runInContext(read(f),ctx);
 const fire=(type,ev)=>{for(const fn of listeners[type]||[])fn(ev);};
 // A clicked element: closest() matches when it carries one of the [data-…] attributes of the selector list.
 const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
 const target=dataset=>{const t={dataset,closest:sel=>String(sel).split(',').some(s=>{const m=s.trim().match(/^\[data-([a-z-]+)\]$/);return !!m&&camel(m[1]) in dataset;})?t:null};return t;};
 return {V:ctx.EvieAutomationsView,P:ctx.EviePrompts,ctx,state,toasts,calls,storage,fire,click:dataset=>fire('click',{target:target(dataset),button:0,preventDefault(){}}),lib:()=>state.preferences.promptLibrary};}
const tick=()=>new Promise(r=>setImmediate(r));
const cards=html=>(html.match(/data-prompt-copy="/g)||[]).length;

test('view: tabs route and remember the last tab per device; an empty library invites the first prompt',()=>{
 const v=view({id:null});let html=v.V.render();
 assert.match(html,/role="tablist"/);assert.match(html,/id="auto-tab-atajos"[^>]*aria-selected="true"/);assert.match(html,/class="auto-empty-state panel"/);assert.match(html,/href="#automatizaciones\/prompts"/);
 v.ctx.UI.id='prompts';html=v.V.render();
 assert.match(html,/id="auto-tab-prompts"[^>]*aria-selected="true"/);assert.match(html,/id="prompts-page" role="tabpanel"/);assert.match(html,/Guardar mi primer prompt/);assert.match(html,/Nuevo prompt/);
 assert.equal(v.storage.get('evie-test-automatizaciones-tab'),'prompts');
 v.ctx.UI.id=null;assert.match(v.V.render(),/id="prompts-page"/,'plain #automatizaciones reopens the last tab');
 v.ctx.UI.id='atajos';assert.match(v.V.render(),/id="automations-page"/);assert.equal(v.storage.get('evie-test-automatizaciones-tab'),'atajos');
 const broken=view({id:null});broken.ctx.localStorage.getItem=()=>{throw new Error('SecurityError');};broken.ctx.localStorage.setItem=broken.ctx.localStorage.getItem;
 assert.match(broken.V.render(),/id="automations-page"/,'storage errors fall back to «Atajos web»');});

test('view: escaped prompt cards, pinned first, «Copiar» in the header above the prompt, tag chips',()=>{
 const P=helpers().EviePrompts,lib=sample(P);lib.push({...P.build({name:'<script>alert(1)</script>',body:'</textarea><img src=x onerror=alert(1)>'},null,{now:day(1),id:'p9'})});
 const html=view({lib}).V.render();
 assert.equal(cards(html),6);assert.match(html,/¡Copiado!/);assert.match(html,/Fijado/);assert.match(html,/6 prompts/);assert.match(html,/data-prompt-tag="soma" aria-pressed="false"><b>soma<\/b><span>2<\/span>/);
 assert.ok(!html.includes('<script>alert')&&!html.includes('<img src=x'),'user text is escaped');assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 const at=['p4','p5','p3','p2','p1','p9'].map(id=>html.indexOf(`data-prompt="${id}"`));assert.ok(at.every((x,k)=>x>0&&(!k||x>at[k-1])),'pinned first, then most recent: '+at.join());
 const p1=html.slice(html.indexOf('data-prompt="p1"'));assert.ok(p1.indexOf('data-prompt-copy')<p1.indexOf('class="pl-body'),'«Copiar» sits in the card header, above the prompt');
 assert.match(p1,/47 caracteres · Actualizado/);});

test('view: new prompt form, validation error on the field, then save closes the form',()=>{
 const v=view();v.click({promptNew:''});let html=v.V.render();
 assert.match(html,/id="prompt-form"[^>]*data-draft-manual/);assert.match(html,/<h2>Nuevo prompt<\/h2>/);assert.match(html,/name="name" required maxlength="120"/);assert.match(html,/name="tag" maxlength="40"/);
 assert.match(html,/0 \/ 50,000/);assert.match(html,/data-prompt-tagpick="SOMA">SOMA<\/button>/);assert.ok(!/name="body"[^>]*maxlength/.test(html),'no silent truncation of a pasted prompt');
 const err={textContent:''},form=values=>({id:'prompt-form',elements:Object.fromEntries(Object.entries(values).map(([k,val])=>[k,{value:val,setAttribute(n,x){this[n]=x;},focus(){}}])),querySelector:s=>s==='#prompt-error'?err:null,querySelectorAll:()=>[]});
 let f=form({name:'',tag:'',body:'algo',notes:''});v.fire('submit',{target:f,preventDefault(){}});
 assert.match(err.textContent,/Ponle un nombre/);assert.equal(f.elements.name['aria-invalid'],'true');assert.equal(v.lib().length,0);
 f=form({name:'Prompt para backend de SOMA',tag:'SOMA',body:'Eres un backend senior.\nUsa Hono.',notes:''});v.fire('submit',{target:f,preventDefault(){}});
 assert.equal(err.textContent,'');assert.equal(v.lib().length,1);assert.equal(v.lib()[0].name,'Prompt para backend de SOMA');assert.match(v.toasts.at(-1).msg,/^Prompt guardado/);
 html=v.V.render();assert.ok(!html.includes('id="prompt-form"'),'the form closes after saving');assert.equal(cards(html),1);
 const P=helpers().EviePrompts,many=[];for(let k=0;k<300;k++)many.push(P.build({name:'P'+k,body:'b'},null,{now:NOW,id:'m'+k}));
 const w=view({lib:many});w.click({promptNew:''});assert.match(w.toasts.at(-1).msg,/límite de 300 prompts/);assert.ok(!w.V.render().includes('id="prompt-form"'));});

test('view: «Copiar» copies the whole body, counts the copy, and falls back to execCommand',async()=>{
 const P=helpers().EviePrompts,long=P.build({name:'Largo',body:'x'.repeat(49999)+'!'},null,{now:NOW,id:'big'});let v=view({lib:[...sample(P),long]});
 v.click({promptCopy:'big'});await tick();
 assert.equal(v.calls.copied[0].length,50000);assert.ok(v.calls.copied[0].endsWith('!'),'the full text, not the preview');
 const big=v.lib().find(x=>x.id==='big');assert.equal(big.copies,1);assert.ok(big.last_copied_at);assert.equal(v.toasts.at(-1).msg,'«Largo» copiado. Ya puedes pegarlo.');
 v=view({lib:sample(P),clipboard:'denied'});v.click({promptCopy:'p2'});await tick();
 assert.equal(v.calls.exec,1);assert.equal(v.calls.copied.join(),'legacy');assert.equal(v.lib().find(x=>x.id==='p2').copies,1);});

test('view: duplicate, pin and delete (confirmed, with undo)',()=>{
 const P=helpers().EviePrompts,v=view({lib:sample(P)});
 v.click({promptDup:'p3'});assert.equal(v.lib().length,6);assert.equal(v.lib().at(-1).name,'Copy para Instagram (copia)');assert.match(v.toasts.at(-1).msg,/^Duplicado como/);
 v.click({promptPin:'p2'});assert.equal(v.lib().find(x=>x.id==='p2').pinned,true);assert.equal(v.toasts.at(-1).msg,'Fijado arriba de tu lista.');
 v.click({promptDel:'p1'});assert.equal(v.calls.confirm,'¿Eliminar «Prompt para backend de SOMA»?');assert.ok(!v.lib().some(x=>x.id==='p1'));
 const t=v.toasts.at(-1);assert.equal(t.msg,'Prompt eliminado.');assert.equal(typeof t.undo,'function');t.undo();assert.equal(v.lib()[0].id,'p1','undo puts it back in place');});

test('view: the voice hook opens the tab with a search or a tag; the search box filters the cards',()=>{
 const P=helpers().EviePrompts,v=view({lib:sample(P)});
 v.V.showPrompts('backend','');assert.equal(v.calls.render,1);assert.equal(v.ctx.location.hash,'');
 let html=v.V.render();assert.match(html,/id="prompt-q"[^>]*value="backend"/);assert.equal(cards(html),2);assert.match(html,/2 de 5/);
 v.V.showPrompts('','escuela');html=v.V.render();assert.match(html,/data-prompt-tag="escuela" aria-pressed="true"/);assert.equal(cards(html),1);
 v.V.showPrompts('nada que coincida','');html=v.V.render();assert.match(html,/Ningún prompt coincide con «nada que coincida»/);assert.match(html,/data-prompt-clear/);
 v.ctx.UI.section='inicio';v.V.showPrompts();assert.equal(v.ctx.location.hash,'automatizaciones/prompts');
 v.ctx.UI.section='automatizaciones';assert.match(v.P.intent('Ivi, muéstrame mis prompts de SOMA'),/^Encontré 2 prompts/);html=v.V.render();assert.match(html,/data-prompt-tag="soma" aria-pressed="true"/);assert.equal(cards(html),2);
 v.V.reset();assert.equal(cards(v.V.render()),5,'reset clears search and filters (account switch)');});
