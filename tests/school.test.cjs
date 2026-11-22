'use strict';
// v10 · Escuela. Server: /api/school/summary and /api/school/cards through createAccounts, on Claude (mocked SSE) and on
// OpenAI (mocked Responses JSON); session, no-AI, validation, sanitizing and metering. Browser: public/evie-school.js in
// a vm (stubbed Store/Domain/UI/App/Views/document; real Agenda + Recurrence + RCData for the integration checks).
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const A='11111111-1111-4111-8111-111111111111';
const J=x=>JSON.parse(JSON.stringify(x));
function sse(text){const ev=[],push=(type,data)=>ev.push(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);
 push('message_start',{message:{id:'msg_s',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:800,output_tokens:1,cache_read_input_tokens:0,cache_creation_input_tokens:0}}});
 push('content_block_start',{index:0,content_block:{type:'text',text:''}});push('content_block_delta',{index:0,delta:{type:'text_delta',text}});push('content_block_stop',{index:0});
 push('message_delta',{delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:200}});push('message_stop',{});return new Response(ev.join(''),{headers:{'content-type':'text/event-stream'}});}
async function fixture(t,extra={}){const {createAccounts}=await import('../src/accounts.js');const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),ANTHROPIC_API_KEY:'k',...extra};
 const sent=[],oai=[];let reply='{}';const fetcher=async(input,o={})=>{const url=typeof input==='string'?input:input.url;if(url.includes('grant_type=password'))return Response.json({user:{id:A},access_token:'acc',refresh_token:'ref',expires_in:3600});if(url.endsWith('/auth/v1/user'))return Response.json({id:A});if(url.startsWith('https://api.anthropic.com')){sent.push(JSON.parse(o.body));return sse(reply);}
  if(url.startsWith('https://api.openai.com/v1/responses')){const b=JSON.parse(o.body);oai.push(b);return Response.json({status:'completed',model:b.model,output:[{type:'message',content:[{type:'output_text',text:reply}]}],usage:{input_tokens:900,output_tokens:300}});}throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});const request=(route,{method='GET',body,cookie}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-Evie-User':A}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},env);
 const r=await request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'}});return {request,cookie:r.headers.get('set-cookie').split(';')[0],sent,oai,db,setReply:x=>reply=x};}
const usageOf=(f,kind)=>f.db.prepare('SELECT amount FROM ai_usage WHERE owner_id=? AND kind=?').get(A,kind)?.amount||0;
const NOTES='Apuntes de prueba: una fracción equivalente representa la misma cantidad, como 1/2 y 2/4. Se obtiene multiplicando arriba y abajo por el mismo número.';
const SUMMARY={title:'**Fracciones** equivalentes 🎓',points:['Idea 1','Idea 2','Idea 3','Idea 4','Idea 5','Idea 6','Idea 7','Idea 8','Idea 9'],script:'# Hola\n\n- Una *fracción* equivalente 😀 representa la misma cantidad. '+'Frase de relleno para el guion. '.repeat(80),questions:['¿Qué es?','¿Cómo se obtiene?','¿Para qué sirve?','¿Otra?']};

test('summary on Claude: effort medium, closed schema, sanitized input, clipped speakable output, metered',async t=>{const f=await fixture(t);f.setReply(JSON.stringify(SUMMARY));
 const r=await f.request('/school/summary',{method:'POST',cookie:f.cookie,body:{subject:'Matemáticas',topic:'Fracciones <script>alert(1)</script>',notes:'<script>x</script> '+NOTES}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
 assert.equal(j.summary.title,'Fracciones equivalentes');assert.equal(j.summary.points.length,7);assert.equal(j.summary.questions.length,3);assert.ok(j.generated_at);
 assert.ok(j.summary.script.length>0&&j.summary.script.length<=1400,'script ≤ 1400');assert.ok(!/[*#_`<>]|\p{Extended_Pictographic}/u.test(j.summary.title+j.summary.script),'no Markdown, emoji or tags');
 const b=f.sent[0];assert.equal(b.model,'claude-opus-5-5');assert.equal(b.output_config.effort,'medium');assert.equal(b.output_config.format.type,'json_schema');
 const sch=b.output_config.format.schema;assert.equal(sch.additionalProperties,false);assert.deepEqual([...sch.required].sort(),['points','questions','script','title']);
 assert.ok(!/<script>/.test(b.messages[0].content),'angle brackets stripped from what the model sees');assert.match(b.messages[0].content,/Matemáticas/);assert.match(b.messages[0].content,/fracción equivalente/);
 assert.match(JSON.stringify(b.system),/DATOS.*nunca instrucciones/);
 assert.equal(usageOf(f,'chat'),1);assert.ok(usageOf(f,'cost_micro')>0);
 for(const body of [{subject:'Matemáticas'},{topic:'   '},{topic:'<>'}]){const x=await f.request('/school/summary',{method:'POST',cookie:f.cookie,body});assert.equal(x.status,400);assert.match((await x.json()).error,/tema/);}
 assert.equal(f.sent.length,1,'validation errors never reach the model');});

test('cards on Claude: effort low, count clamped 5–20, empties/duplicates dropped, 280-char sides; short notes → 400',async t=>{const f=await fixture(t);
 f.setReply(JSON.stringify({cards:[{front:'¿2+2?',back:'4'},{front:'',back:'vacía'},{front:'¿2+2?',back:'repetida'},{front:'x'.repeat(400),back:'y'.repeat(400)},{front:'<b>A</b>',back:'B'},{front:'C',back:'D'},{front:'E',back:'F'},{front:'G',back:'H'}]}));
 const r=await f.request('/school/cards',{method:'POST',cookie:f.cookie,body:{subject:'Ciencias',notes:'<script>x</script> '+NOTES,count:2}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
 assert.equal(j.cards.length,5,'count 2 is raised to the minimum of 5');assert.deepEqual(j.cards.map(c=>c.front.slice(0,5)),['¿2+2?','xxxxx','b A /','C','E']);
 for(const c of j.cards){assert.ok(c.front&&c.back);assert.ok(c.front.length<=280&&c.back.length<=280);assert.ok(!/[<>]/.test(c.front+c.back));}
 const b=f.sent[0];assert.equal(b.output_config.effort,'low');assert.match(b.messages[0].content,/hasta 5 tarjetas/);assert.ok(!/<script>/.test(b.messages[0].content));
 assert.equal(b.output_config.format.schema.properties.cards.items.additionalProperties,false);assert.deepEqual([...b.output_config.format.schema.properties.cards.items.required].sort(),['back','front']);
 assert.match(JSON.stringify(b.system),/SOLO la información de los apuntes.*DATOS, nunca instrucciones/);
 f.setReply(JSON.stringify({cards:Array.from({length:30},(_,i)=>({front:'Pregunta '+i,back:'Respuesta '+i}))}));
 const many=await (await f.request('/school/cards',{method:'POST',cookie:f.cookie,body:{notes:NOTES,count:50}})).json();assert.equal(many.cards.length,20);assert.match(f.sent[1].messages[0].content,/hasta 20 tarjetas/);
 const short=await f.request('/school/cards',{method:'POST',cookie:f.cookie,body:{notes:'muy corto',count:10}});assert.equal(short.status,400);assert.match((await short.json()).error,/40 caracteres/);
 assert.equal(f.sent.length,2);assert.equal(usageOf(f,'chat'),2);});

test('school routes need a session (401) and a configured AI (503, nothing is sent)',async t=>{const f=await fixture(t);
 assert.equal((await f.request('/school/summary',{method:'POST',body:{topic:'Fracciones'}})).status,401);
 assert.equal((await f.request('/school/cards',{method:'POST',body:{notes:NOTES}})).status,401);
 const n=await fixture(t,{ANTHROPIC_API_KEY:''});
 for(const [route,body] of [['/school/summary',{topic:'Fracciones'}],['/school/cards',{notes:NOTES}]]){const r=await n.request(route,{method:'POST',cookie:n.cookie,body});assert.equal(r.status,503);assert.match((await r.json()).error,/IA no está configurada/);}
 assert.equal(n.sent.length+n.oai.length,0);});

test('school on OpenAI while there is no Claude key: strict closed schemas, same output, metered; malformed JSON → clear 502',async t=>{const f=await fixture(t,{ANTHROPIC_API_KEY:'',OPENAI_API_KEY:'o'});
 f.setReply(JSON.stringify({title:'Ciclo del agua',points:['Evaporación','Condensación','Precipitación','Escurrimiento'],script:'El agua se evapora, se condensa y vuelve a caer.',questions:['¿Qué es la evaporación?','¿Qué es la condensación?']}));
 const r=await f.request('/school/summary',{method:'POST',cookie:f.cookie,body:{subject:'Ciencias',topic:'Ciclo del agua',notes:'<script>x</script> Apuntes.'}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
 assert.equal(j.summary.title,'Ciclo del agua');assert.equal(j.summary.points.length,4);assert.equal(j.summary.questions.length,2);
 const b=f.oai[0];assert.equal(b.text.format.type,'json_schema');assert.equal(b.text.format.strict,true);assert.equal(b.text.format.name,'school_summary');assert.equal(b.store,false);assert.equal(b.reasoning.effort,'medium');
 assert.equal(b.text.format.schema.additionalProperties,false);assert.deepEqual([...b.text.format.schema.required].sort(),['points','questions','script','title']);assert.ok(!/<script>/.test(b.input[0].content));
 assert.ok(usageOf(f,'cost_micro')>0);
 f.setReply(JSON.stringify({cards:[{front:'¿Qué es la evaporación?',back:'El paso de líquido a gas.'},{front:'¿Qué es la condensación?',back:'El paso de gas a líquido.'}]}));
 const c=await (await f.request('/school/cards',{method:'POST',cookie:f.cookie,body:{subject:'Ciencias',notes:NOTES,count:10}})).json();assert.equal(c.cards.length,2);
 const k=f.oai[1];assert.equal(k.text.format.name,'school_cards');assert.equal(k.text.format.strict,true);assert.equal(k.text.format.schema.properties.cards.items.additionalProperties,false);assert.ok(['none','low'].includes(k.reasoning.effort),'effort low → quick tier');
 f.setReply('esto no es json');const bad=await f.request('/school/summary',{method:'POST',cookie:f.cookie,body:{topic:'Ciclo del agua'}});assert.equal(bad.status,502);assert.match((await bad.json()).error,/incompleta/);
 assert.equal(usageOf(f,'chat'),3);});

/* ---------------- browser module ---------------- */
const TODAY='2026-11-23';// Monday
const mx=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
function periodKey(h,date){if(h==='anual')return date.slice(0,4);if(h==='mensual')return date.slice(0,7);if(h==='semanal'){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}return date;}
function el(nodes,tag){const cls=new Set();return {tagName:tag,id:'',className:'',innerHTML:'',dataset:{},attrs:{},style:{setProperty(k,v){this[k]=v;}},classList:{add:(...c)=>c.forEach(x=>cls.add(x)),remove:(...c)=>c.forEach(x=>cls.delete(x)),toggle:(c,on)=>on?cls.add(c):cls.delete(c),contains:c=>cls.has(c)},
 setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];if(k==='id')this.id='';},querySelector:()=>null,querySelectorAll:()=>[],remove(){nodes.delete(this);},focus(){},closest:()=>null,contains:()=>false,append(){}};}
/** Loads public/evie-school.js in a vm. real=true also loads the real Recurrence, RCData and Agenda modules. */
function school({school:sc,agendaItems=[],profile={},section='inicio',real=false,now=new Date(2026,10,23,9,30)}={}){
 const listeners={},nodes=new Set(),toasts=[],calls={render:0,confirm:0};const RealDate=Date;
 const ctx={console,Math,JSON,Intl,structuredClone,Number,String,Object,Array,Promise,Set,Map,RegExp,Error,TypeError,Boolean,Symbol,parseFloat,parseInt,isNaN,setTimeout:f=>{f();return 0;},clearTimeout(){},crypto};
 ctx.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[now.getTime()]));}static now(){return now.getTime();}};ctx.window=ctx;vm.createContext(ctx);
 const st={version:4,profile:{name:'',preferred:'Sam',...profile},preferences:{theme:'dark',school:sc},agendaItems};
 ctx.Store={get:()=>st,list:c=>(st[c]||[]).filter(x=>!x.deleted_at),save(fn){const next=structuredClone(st);fn(next);for(const k of Object.keys(st))delete st[k];Object.assign(st,next);return st;}};
 ctx.Domain={today:d=>d?mx(d):TODAY,escape:s=>String(s),periodKey,renewGoals:()=>false};
 ctx.UI={section,id:null};ctx.location={hash:''};
 ctx.App={toast:(msg,type,undo)=>toasts.push({msg,type,undo}),render(){calls.render++;},openDialog(){},closeDialog(){},confirmAction(title,text,fn){calls.confirm++;calls.confirmText=text;fn();}};
 ctx.Views={icon:n=>`<i data-lucide="${n}"></i>`,heading:(t,s,a,eb)=>`<header data-eyebrow="${eb}"><h1>${t}</h1><p>${s}</p><div>${a}</div></header>`};
 ctx.document={addEventListener(type,fn){(listeners[type]||=[]).push(fn);},querySelector:()=>null,querySelectorAll:()=>[],getElementById:id=>[...nodes].find(n=>n.id===id)||null,createElement:tag=>el(nodes,tag),body:{append:n=>nodes.add(n),classList:{add(){},remove(){}}},documentElement:{classList:{add(){},remove(){}},dataset:{}},activeElement:null};
 ctx.localStorage={getItem:()=>null,setItem(){}};
 if(real){ctx.DALI_CONFIG={timezone:'America/Mexico_City',sections:[]};ctx.V2Domain={assert:(c,m)=>{if(!c)throw new Error(m);},date:d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+'T12:00:00Z')),integer:(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b,text:v=>typeof v==='string'&&v.length<=15000,finite:(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b,addDays:(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10)};
  for(const f of ['recurrence.js','rc-data.js','agenda.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx);}
 else{ctx.RCData={defaults:()=>({title:'',kind:'task',status:'inbox',priority:'medium',area:'personal',notes:'',start_at:null,due_at:null,all_day:true,duration_minutes:null,energy:'medium',recurrence:null,history:[],source:'manual'})};
  ctx.Agenda={toTimestamp:v=>new Date(v+':00-06:00').toISOString(),complete(s,id){const r=s.agendaItems.find(x=>x.id===id);r.status='done';return true;},reopen(s,id){const r=s.agendaItems.find(x=>x.id===id);r.status='scheduled';return true;}};}
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-school.js'),'utf8'),ctx);
 const fire=(type,ev)=>{for(const fn of listeners[type]||[])fn(ev);};
 const click=(dataset)=>fire('click',{target:{closest:sel=>sel==='[data-es]'?{disabled:false,dataset,setAttribute(){},closest:()=>null}:null}});
 const key=k=>fire('keydown',{key:k,target:{closest:()=>null},preventDefault(){},stopPropagation(){}});
 return {S:ctx.EvieSchool,ctx,st,toasts,calls,click,key,nodes};}
const card=(id,extra={})=>({id,subject_id:'s1',front:'¿Pregunta '+id+'?',back:'Respuesta '+id,ef:2.5,interval:0,reps:0,lapses:0,due:TODAY,last:null,...extra});
const SCHOOL=()=>({subjects:[
  {id:'s1',name:'Matemáticas',color:'#4f8cff',teacher:'Prof. Ejemplo',room:'12',place:{name:'Escuela de prueba',lat:10.5,lon:-20.25},schedule:[{days:[1,3],start:'10:00',end:'10:50'}],target:80,grades:[{id:'g1',label:'Parcial 1',score:9,max:10,weight:50}],agenda:false,agenda_ids:[]},
  {id:'s2',name:'Historia',color:'#22c55e',teacher:'',room:'',place:null,schedule:[{days:[1],start:'08:00',end:'08:50'},{days:[2],start:'09:00',end:'09:50'}],target:80,grades:[{id:'g2',label:'Ensayo',score:7,max:10,weight:20}],agenda:false,agenda_ids:[]}],
 tasks:[{id:'t1',subject_id:'s1',title:'Ejercicios del tema 3',kind:'tarea',due:'2026-11-24',time:null,done:false,done_at:null,grade:null,agenda_id:null},{id:'t2',subject_id:'s2',title:'Parcial 2',kind:'examen',due:'2026-11-26',time:'09:00',done:false,done_at:null,grade:null,agenda_id:null},
  {id:'t3',subject_id:'s1',title:'Mapa conceptual',kind:'tarea',due:'2026-11-20',time:null,done:false,done_at:null,grade:null,agenda_id:null},{id:'t4',subject_id:'s1',title:'Examen final',kind:'examen',due:'2026-12-10',time:null,done:false,done_at:null,grade:null,agenda_id:null},
  {id:'t5',subject_id:'s1',title:'Lectura',kind:'tarea',due:'2026-11-22',time:null,done:true,done_at:'2026-11-22T18:00:00.000Z',grade:null,agenda_id:null}],
 cards:[card('c1'),card('c2',{reps:2,interval:6,last:'2026-11-14',due:'2026-11-20'}),card('c3',{subject_id:'s2',reps:2,interval:6,last:'2026-11-25',due:'2026-12-01'})],
 summaries:[],log:{reviews:{'2026-11-21':5,'2026-11-22':3,'2026-08-01':9}}});

test('SM-2 exact transitions: 1 → 6 → round(I×EF), a lapse resets reps and interval, EF floor 1.3; input not mutated',()=>{const {S}=school();
 const c0=card('c');let c=J(S.sm2(c0,4,'2026-11-23'));assert.deepEqual([c.reps,c.interval,c.ef,c.lapses,c.due,c.last],[1,1,2.5,0,'2026-11-24','2026-11-23']);
 c=J(S.sm2(c,4,'2026-11-24'));assert.deepEqual([c.reps,c.interval,c.ef,c.due],[2,6,2.5,'2026-11-30']);
 c=J(S.sm2(c,5,'2026-11-30'));assert.deepEqual([c.reps,c.interval,c.ef,c.due],[3,15,2.6,'2026-12-15']);
 c=J(S.sm2(c,1,'2026-12-15'));assert.deepEqual([c.reps,c.interval,c.lapses,c.ef,c.due],[0,1,1,2.06,'2026-12-16'],'lapse');
 c=J(S.sm2(c,3,'2026-12-16'));assert.deepEqual([c.reps,c.interval,c.ef,c.due],[1,1,1.92,'2026-12-17'],'q=3 passes but lowers EF');
 assert.equal(J(S.sm2({...c0,ef:1.4},0,TODAY)).ef,1.3);assert.equal(J(S.sm2({...c0,reps:2,interval:6,ef:2.6},5,TODAY)).interval,16);
 assert.equal(c0.reps,0);assert.equal(c0.due,TODAY);assert.equal(J(S.sm2(c0,3)).last,TODAY,'today defaults to Domain.today()');});

test('weighted average and «necesitas X en lo que falta»: open, secured, impossible, reached, missed, over 100 %, no weights, empty',()=>{const {S}=school(),g=(score,max,weight)=>({id:'g'+Math.random(),label:'x',score,max,weight});
 const s={target:80,grades:[g(8,10,30),g(9,10,30)]};assert.equal(S.average(s),85);
 assert.deepEqual(J(S.needed(s)),{status:'open',needed:72.5,remaining:40,earned:51,used:60,target:80,max:91});
 assert.deepEqual([S.needed({target:80,grades:[g(10,10,90)]}).status,S.needed({target:80,grades:[g(10,10,90)]}).needed],['secured',0]);
 const imp=J(S.needed({target:80,grades:[g(5,10,80)]}));assert.equal(imp.status,'impossible');assert.equal(imp.max,60);assert.equal(imp.needed,200);
 assert.deepEqual(J(S.needed({target:80,grades:[g(9,10,60),g(8,10,40)]})).status,'reached');assert.equal(S.average({grades:[g(9,10,60),g(8,10,40)]}),86);
 const missed=J(S.needed({target:80,grades:[g(7,10,100)]}));assert.equal(missed.status,'missed');assert.equal(missed.earned,70);
 assert.equal(S.needed({target:80,grades:[g(9,10,70),g(9,10,40)]}).status,'over');
 const plain={target:80,grades:[g(8,10,null),g(6,10,0)]};assert.equal(S.average(plain),70,'without weights: simple mean');assert.equal(S.needed(plain).status,'no_weights');
 assert.equal(S.average({grades:[]}),null);assert.deepEqual(J(S.needed({target:90,grades:[]})),{status:'empty',needed:90,remaining:100,earned:0,used:0,target:90,max:100});
 assert.equal(S.average({grades:[g(45,50,40),g(16,20,60)]}),84,'mixed scales: 90 % and 80 %');});

test('agendaItemsFor: one weekly time_block per schedule row (days, local time, duration, area school), first date from today',()=>{const {S}=school();
 const subj={id:'s1',name:'Matemáticas',teacher:'Prof. Ejemplo',room:'12',schedule:[{days:[3,1],start:'08:00',end:'08:50'},{days:[5],start:'10:00',end:'11:30'},{days:[],start:'09:00',end:'10:00'},{days:[2],start:'11:00',end:'10:00'}]};
 const items=J(S.agendaItemsFor(subj,'2026-11-24'));assert.equal(items.length,2,'invalid rows are skipped');const [a,b]=items;
 for(const x of items){assert.equal(x.kind,'time_block');assert.equal(x.area,'school');assert.equal(x.status,'scheduled');assert.equal(x.all_day,false);assert.equal(x.source,'school');assert.equal(x.title,'Matemáticas');assert.equal(x.due_at,null);assert.deepEqual(x.history,[]);assert.ok(x.created_at&&x.updated_at);}
 assert.deepEqual(a.recurrence,{frequency:'weekly',interval:1,timezone:'America/Mexico_City',time_local:'08:00',days_of_week:[1,3],day_of_month:null,end_date:null});
 assert.equal(a.duration_minutes,50);assert.equal(a.start_at,'2026-11-25T14:00:00.000Z','next Wednesday 08:00 (CST)');assert.match(a.notes,/Prof\. Ejemplo · Salón 12/);
 assert.equal(b.duration_minutes,90);assert.deepEqual(b.recurrence.days_of_week,[5]);assert.equal(b.recurrence.time_local,'10:00');assert.equal(b.start_at,'2026-11-27T16:00:00.000Z');
 assert.notEqual(a.id,b.id);assert.equal(J(S.agendaItemsFor(subj,TODAY))[0].start_at,'2026-11-23T14:00:00.000Z','today counts when it is a class day');});

test('agenda integration with the real Agenda/Recurrence/RCData: valid recurring blocks; marking a task done completes its Agenda item (undo reopens); deleting a subject removes its blocks',()=>{
 const {S,ctx}=school({real:true,profile:{timezone:'America/Tijuana'}});
 const items=S.agendaItemsFor({name:'Química',schedule:[{days:[1,3],start:'08:00',end:'08:50'}]},'2026-11-24');const it=items[0];
 assert.equal(it.recurrence.timezone,'America/Mexico_City','a timezone the Agenda rejects falls back to America/Mexico_City');ctx.Recurrence.validate(it.recurrence);assert.ok(ctx.RCData.stamp(it.start_at));
 assert.ok(ctx.RCData.areas.includes(it.area));assert.equal(ctx.Agenda.occurrence(it,'2026-11-25'),true);assert.equal(ctx.Agenda.occurrence(it,'2026-11-30'),true);assert.equal(ctx.Agenda.occurrence(it,'2026-11-26'),false);assert.equal(ctx.Agenda.occTime(it,'2026-12-02'),'08:00');
 const sc=SCHOOL();sc.tasks[0].agenda_id='a-task';sc.subjects[0].agenda=true;sc.subjects[0].agenda_ids=['a-b1'];
 const agenda=[{...ctx.RCData.defaults('agendaItems'),id:'a-task',title:'Tarea: Ejercicios del tema 3 · Matemáticas',kind:'task',area:'school',status:'scheduled',all_day:true,due_at:ctx.Agenda.toTimestamp('2026-11-24T23:59'),source:'school',created_at:'2026-11-20T00:00:00.000Z',updated_at:'2026-11-20T00:00:00.000Z'},{...it,id:'a-b1'},{...items[0],id:'a-other',title:'Otra cosa'}];
 const w=school({real:true,school:sc,agendaItems:agenda});
 w.click({es:'task-toggle',id:'t1'});const task=()=>w.st.preferences.school.tasks.find(x=>x.id==='t1'),item=id=>w.st.agendaItems.find(x=>x.id===id);
 assert.equal(task().done,true);assert.ok(task().done_at);assert.equal(item('a-task').status,'done');assert.ok(item('a-task').completed_at);
 const undo=w.toasts.find(x=>x.undo);assert.ok(undo,'toast offers Deshacer');undo.undo();assert.equal(task().done,false);assert.equal(item('a-task').status,'scheduled');
 w.click({es:'subj-del',id:'s1'});assert.equal(w.calls.confirm,1);assert.match(w.calls.confirmText,/Matemáticas/);
 const d=w.st.preferences.school;assert.deepEqual(d.subjects.map(s=>s.id),['s2']);assert.ok(d.tasks.every(x=>x.subject_id!=='s1'));assert.ok(d.cards.every(x=>x.subject_id!=='s1'));
 assert.ok(item('a-b1').deleted_at,'class block removed');assert.ok(item('a-task').deleted_at,'task item removed');assert.ok(!item('a-other').deleted_at,'other items untouched');});

test('classesOn (fixed commitments for the briefing), summary() and weekStats()',()=>{const {S}=school({school:SCHOOL()});
 const mon=J(S.classesOn(1));assert.deepEqual(mon.map(c=>[c.label,c.time,c.end]),[['Historia','08:00','08:50'],['Matemáticas','10:00','10:50']]);
 assert.deepEqual(mon[1],{id:'s1-0',label:'Matemáticas',time:'10:00',end:'10:50',days:[1,3],place:{name:'Escuela de prueba',lat:10.5,lon:-20.25},alert:true,buffer:5});
 assert.equal(mon[0].place,null);assert.deepEqual(J(S.classesOn(2)).map(c=>c.id),['s2-1']);assert.deepEqual(J(S.classesOn(0)),[]);assert.deepEqual(J(S.classesOn()).map(c=>c.label),['Historia','Matemáticas'],'default: today');
 const sm=J(S.summary());assert.deepEqual(sm.today,[{label:'Historia',time:'08:00',end:'08:50'},{label:'Matemáticas',time:'10:00',end:'10:50'}]);
 assert.equal(sm.tasksDue7,2);assert.equal(sm.overdue,1);assert.deepEqual(sm.nextExam,{title:'Parcial 2',subject:'Historia',due:'2026-11-26',days:3});assert.equal(sm.cardsDue,2);assert.equal(sm.average,80);
 assert.deepEqual(J(S.weekStats('2026-11-17','2026-11-23')),{tasksDone:1,reviews:8,examsNext7:[{title:'Parcial 2',subject:'Historia',due:'2026-11-26'}],average:80});
 const empty=J(school().S.summary());assert.deepEqual(empty,{today:[],tasksDue7:0,overdue:0,nextExam:null,cardsDue:0,average:null});});

test('caps on every save: done tasks and review log older than 120 days are pruned, summaries keep the newest 20',()=>{const sc=SCHOOL();
 sc.tasks.push({id:'old',subject_id:'s1',title:'Vieja',kind:'tarea',due:'2026-06-01',time:null,done:true,done_at:'2026-06-01T12:00:00.000Z',grade:null,agenda_id:null},{id:'oldopen',subject_id:'s1',title:'Pendiente vieja',kind:'tarea',due:'2026-06-01',time:null,done:false,done_at:null,grade:null,agenda_id:null});
 sc.log.reviews['2026-07-01']=4;sc.summaries=Array.from({length:25},(_,i)=>({id:'m'+i,subject_id:'s1',topic:'Tema',title:'Resumen '+i,points:['Idea'],script:'Guion.',questions:[],created_at:'2026-11-01T00:00:00.000Z'}));
 const w=school({school:sc});w.click({es:'task-toggle',id:'t1'});const d=w.st.preferences.school;
 assert.equal(d.tasks.find(x=>x.id==='t1').done,true);assert.ok(!d.tasks.some(x=>x.id==='old'),'old done task pruned');assert.ok(d.tasks.some(x=>x.id==='oldopen'),'open tasks are never pruned');
 assert.equal(d.log.reviews['2026-07-01'],undefined);assert.equal(d.log.reviews['2026-08-01'],9);assert.deepEqual(d.summaries.map(x=>x.id),Array.from({length:20},(_,i)=>'m'+i));});

test('review mode: Space flips, 1–4 grade (SM-2 saved, reviews logged), «Otra vez» shows the card again once, Esc exits',()=>{const sc=SCHOOL();sc.log.reviews={};const w=school({school:sc,section:'escuela'});
 w.S.startReview();assert.ok(w.ctx.document.getElementById('es-rv'),'overlay mounted');
 w.key(' ');w.key('3');// first in queue: learned card c2 (due 20) → «Bien» (q=4)
 let d=w.st.preferences.school,c2=d.cards.find(c=>c.id==='c2');assert.deepEqual([c2.reps,c2.interval,c2.due],[3,15,'2026-12-08']);assert.equal(d.log.reviews[TODAY],1);
 w.key('3');assert.equal(w.st.preferences.school.log.reviews[TODAY],1,'grading needs the answer shown first');
 w.key(' ');w.key('1');// new card c1 → «Otra vez»
 d=w.st.preferences.school;const c1=d.cards.find(c=>c.id==='c1');assert.deepEqual([c1.reps,c1.interval,c1.lapses,c1.due],[0,1,1,'2026-11-24']);assert.equal(d.log.reviews[TODAY],2);
 w.key(' ');w.key('4');assert.equal(w.st.preferences.school.cards.find(c=>c.id==='c1').lapses,1,'the extra look does not reschedule again');assert.equal(w.st.preferences.school.log.reviews[TODAY],2);
 assert.match(w.ctx.document.getElementById('es-rv').innerHTML,/Repaso terminado/);
 w.key('Escape');assert.equal(w.ctx.document.getElementById('es-rv'),null);assert.ok(w.toasts.some(x=>/Repaso guardado: 2 tarjetas/.test(x.msg)));
 const none=school({school:{...SCHOOL(),cards:[]}});none.S.startReview();assert.equal(none.ctx.document.getElementById('es-rv'),null);assert.match(none.toasts[0].msg,/Vas al día/);});

test('intent(): local spoken answers for tareas, examen, tarjetas, horario and promedio; «repasemos» opens the review; other text → empty string',()=>{const w=school({school:SCHOOL()}),S=w.S;
 for(const q of ['¿Cómo está el clima?','Pon música','¿Cuál es mi saldo?','¿Cuál es mi promedio de gastos?',''])assert.equal(S.intent(q),'',q);
 assert.match(S.intent('¿Qué tarea tengo?'),/2 entregas en los próximos 7 días: «Ejercicios del tema 3» de Matemáticas para mañana y «Parcial 2» de Historia para el jueves\. Y 1 vencida: «Mapa conceptual»\./);
 assert.match(S.intent('Ivi, ¿cuándo es mi examen?'),/^Tu próximo examen es «Parcial 2» de Historia, el jueves 26 de noviembre, en 3 días, a las 9:00\sa\.\s?m\.( Después tienes 1 examen más\.)$/);
 assert.match(S.intent('¿cuándo es mi examen de matemáticas?'),/^Tu próximo examen de Matemáticas es «Examen final», el jueves 10 de diciembre, en 17 días\.$/);
 assert.match(S.intent('¿Cuántas tarjetas tengo?'),/^Tienes 2 tarjetas para repasar hoy, 1 nueva, de 3 en total\./);
 assert.match(S.intent('mi horario de hoy'),/^Hoy tienes 2 clases: Historia a las 8:00\sa\.\s?m\. y Matemáticas a las 10:00\sa\.\s?m\.$/);
 assert.match(S.intent('¿Qué clases tengo mañana?'),/^Mañana tienes 1 clase: Historia a las 9:00/);
 assert.match(S.intent('¿Cuál es mi promedio?'),/Tu promedio general es 80/);assert.match(S.intent('¿Cómo voy en historia?'),/En Historia llevas 70 de promedio; tu meta es 80\. Necesitas 82\.5 en lo que falta/);
 assert.equal(S.intent('agrega un examen de historia el viernes'),'','creation commands are left to the assistant');
 assert.match(S.intent('repasemos'),/^Vamos a repasar: 2 tarjetas\./);assert.equal(w.ctx.location.hash,'escuela');
 assert.equal(school().S.intent('¿Qué tareas tengo hoy?'),'','without school data, generic «tareas» is not about school');});

test('view(): every tab renders inside #es-root with escaped user text and validated colors; afterRender is a no-op elsewhere',()=>{
 const sc=SCHOOL();sc.subjects[0].name='<img src=x onerror=alert(1)>';sc.subjects[0].color='red;background:url(x)';sc.tasks[0].title='<b>tarea</b>';sc.cards[0].front='<script>c</script>';
 sc.summaries=[{id:'m1',subject_id:'s1',topic:'Tema',title:'<i>Resumen</i>',points:['<u>p</u>'],script:'Guion.',questions:['¿<q>?'],created_at:'2026-11-20T10:00:00.000Z'}];
 const {S,ctx}=school({school:sc});
 for(const tab of ['hoy','materias','tareas','tarjetas','calificaciones','resumenes']){const html=S.view(tab);assert.match(html,/id="es-root"/);assert.match(html,new RegExp(`aria-labelledby="es-tab-${tab}"`));assert.match(html,/role="tablist"/);
  assert.ok(!/<img src=x|<b>tarea|<script>c|<i>Resumen|<u>p|<q>/.test(html),'escaped on '+tab);assert.ok(!/url\(x\)/.test(html),'color validated on '+tab);}
 assert.match(S.view('tareas'),/Vencidas.*Esta semana.*Después.*Hechas/s);assert.match(S.view('tarjetas'),/Total.*Pendientes.*Nuevas/s);assert.match(S.view('calificaciones'),/Necesitas/);
 assert.match(S.view('hoy'),/en 3 días|mañana|vencida/);assert.match(school().S.view(),/Arma tu semana escolar/);
 ctx.UI.section='inicio';assert.equal(S.afterRender(),undefined);
 assert.deepEqual(J(S.countdown('2026-11-22')),{n:-1,label:'vencida',tone:'late'});assert.equal(S.countdown(TODAY).label,'hoy');assert.equal(S.countdown('2026-11-24').label,'mañana');assert.equal(S.countdown('2026-11-26').label,'en 3 días');
 assert.deepEqual(J(S.parseBulk('Capital de Francia :: París\nsin separador\n2+2\t4\n:: vacío\n\n')),{ok:[{front:'Capital de Francia',back:'París'},{front:'2+2',back:'4'}],bad:['sin separador',':: vacío']});
 const parts=J(S.chunks('Una frase corta. '.repeat(200)));assert.ok(parts.length<=12&&parts.every(p=>p.length<=560));
 assert.ok(Object.isFrozen(S));for(const k of ['view','afterRender','classesOn','summary','weekStats','intent','sm2','average','needed','agendaItemsFor'])assert.equal(typeof S[k],'function',k);});
