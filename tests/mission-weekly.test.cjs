'use strict';
// v10 · Fase 4: Misión (projection with real SOMA income, scenarios, account-linked savings, goal mirror), Independencia
// (runway, emergency fund, rent alone vs shared) and Revisión del domingo (weekly metrics, local priorities, privacy of the
// diary, server review on Claude AND OpenAI with whitelisted metrics). Browser modules run in a vm with stubs.
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const A='11111111-1111-4111-8111-111111111111';
const iso=(d)=>d.toISOString().slice(0,10);
const add=(d,n)=>iso(new Date(Date.parse(d+'T12:00:00Z')+n*864e5));
function browser(files,{state,today='2026-11-22',extra={}}={}){
 const ctx={console,Math,JSON,Intl,structuredClone,Number,String,Object,Array,Promise,Set,Map,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},crypto,Date,RegExp,Error,encodeURIComponent,...extra};ctx.window=ctx;vm.createContext(ctx);
 let n=0;ctx.Store={get:()=>state,list:c=>(state[c]||[]).filter(x=>!x.deleted_at),save(fn){fn(state);return state;},record:d=>({id:'r'+(++n),created_at:'2026-11-22T00:00:00Z',updated_at:'2026-11-22T00:00:00Z',...d})};
 ctx.Records={normalize:(c,d)=>({...(c==='goals'?{horizon:'diario',category:'Personal',target:1,progress:0,history:[],recurring:false,archived:false,unit:'',description:''}:{}),...d})};
 ctx.Domain={today:()=>today,money:c=>'$'+(c/100).toFixed(2),cents:s=>{if(!/^\d{1,10}(\.\d{1,2})?$/.test(String(s)))throw Error('Ingresa un monto válido.');return Math.round(Number(s)*100);},periodKey:(h,d)=>h+':'+d};
 ctx.V2Domain={addDays:add};ctx.UI={section:'inicio'};ctx.App={toast(){},render(){},openDialog(){},closeDialog(){}};ctx.Views={icon:()=>''};
 ctx.document={addEventListener(){},querySelector:()=>null,getElementById:()=>null,documentElement:{dataset:{}}};ctx.localStorage={getItem:()=>null,setItem(){}};ctx.matchMedia=()=>({matches:true});ctx.addEventListener=()=>{};
 ctx.FinanceCore={available:()=>({basis:'accounts',cents:3000000,accounts:[{id:'acc-1',name:'Ahorro',balance:5000000}]}),periodTotals:(tx,from,to)=>{const r=tx.filter(x=>x.date>=from&&x.date<=to&&!x.transfer_id);const income=r.filter(x=>x.type==='income').reduce((a,x)=>a+x.amount,0),expense=r.filter(x=>x.type==='expense').reduce((a,x)=>a+x.amount,0);return {income,expense,net:income-expense,count:r.length};}};
 for(const f of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx);return ctx;}
const base=()=>({preferences:{},goals:[],transactions:[],clients:[],gymSessions:[],contentItems:[],journal:[]});

test('mission: required monthly, capacity from real SOMA income × share + extra, ETA, scenarios, goal mirror in pesos',()=>{
 const st=base();const t='2026-11-22';
 // SOMA income in the last 90 days: 3 × $6,000 → $6,000/month average
 st.transactions=[{date:add(t,-10),type:'income',business_unit:'soma',amount:600000},{date:add(t,-40),type:'income',business_unit:'soma',amount:600000},{date:add(t,-70),type:'income',business_unit:'soma',amount:600000},{date:add(t,-200),type:'income',business_unit:'soma',amount:9900000},{date:add(t,-5),type:'income',business_unit:'personal',amount:100000}];
 st.preferences.mission={name:'Laptop',target_cents:3000000,deadline:add(t,365),saved_cents:600000,soma_share:50,monthly_extra_cents:100000,scenarios:[{id:'s1',name:'Trabajo extra',kind:'income',monthly_cents:200000,active:false},{id:'s2',name:'Renta',kind:'expense',monthly_cents:350000,active:false}]};
 const c=browser(['evie-mission.js'],{state:st});const p=c.EvieMission.plan();
 assert.equal(p.soma,600000);assert.equal(p.base,400000);assert.equal(p.capacity,400000);assert.equal(p.remaining,2400000);assert.equal(p.pct,20);
 assert.equal(p.required,Math.ceil(2400000/(365/30.44)));assert.equal(p.onTrack,true);assert.equal(p.eta,add(t,Math.ceil(2400000/400000*30.44)));
 const rent=p.scenarios.find(s=>s.id==='s2');assert.equal(rent.capacity,50000);assert.ok(rent.late>0,'renting alone makes it late');assert.equal(p.scenarios.find(s=>s.id==='s1').late,0);
 // activating the expense scenario changes the main projection
 st.preferences.mission.scenarios[1].active=true;const q=c.EvieMission.plan();assert.equal(q.capacity,50000);assert.equal(q.onTrack,false);assert.ok(q.late>0);
 // goal mirror: created once, whole pesos, updated on save
 const save=c.EvieMission.addScenarios([{name:'Renta',kind:'expense',monthly_cents:1},{name:'Bici',kind:'expense',monthly_cents:50000}]);assert.equal(save,1,'dedupe by name');
 const g=st.goals.find(x=>x.id===st.preferences.mission.goal_id);assert.ok(g);assert.equal(g.title,'Misión: Laptop');assert.equal(g.target,30000);assert.equal(g.progress,6000);assert.equal(g.horizon,'anual');
 assert.match(c.EvieMission.intent('Ivi, ¿cómo va mi misión?'),/Misión «Laptop» al 20 por ciento/);assert.equal(c.EvieMission.intent('abre finanzas'),'');});

test('mission: savings linked to a real account balance; history snapshots give the saved amount on a past date',()=>{
 const st=base();st.preferences.mission={name:'Viaje',target_cents:10000000,deadline:'2027-12-31',account_id:'acc-1',saved_cents:0,history:[{date:'2026-11-10',saved_cents:4000000},{date:'2026-11-15',saved_cents:4500000}]};
 const c=browser(['evie-mission.js'],{state:st});assert.equal(c.EvieMission.savedOf(),5000000);assert.equal(c.EvieMission.plan().pct,50);
 assert.equal(c.EvieMission.savedOn('2026-11-12'),4000000);assert.equal(c.EvieMission.savedOn('2026-11-20'),4500000);assert.equal(c.EvieMission.savedOn('2026-11-01'),0);
 assert.equal(browser(['evie-mission.js'],{state:base()}).EvieMission.plan(),null);});

test('independence: runway from liquid cash and real spending, fund target, rent alone vs shared',()=>{
 const st=base();const t='2026-11-22';st.transactions=[{date:add(t,-3),type:'expense',amount:900000},{date:add(t,-33),type:'expense',amount:900000},{date:add(t,-63),type:'expense',amount:900000},{date:add(t,-120),type:'expense',amount:5000000}];
 let c=browser(['evie-independence.js'],{state:st});let r=c.EvieIndependence.calc();assert.equal(r.real,900000);assert.equal(r.configured,false);assert.equal(r.base,900000);assert.equal(r.cash,3000000);assert.equal(r.runway,3.3);assert.equal(r.fund,2700000);assert.equal(r.fundMissing,0);
 st.preferences.independence={rent_cents:500000,services_cents:100000,food_cents:300000,transport_cents:100000,other_cents:0,share:50,fund_months:3};
 c=browser(['evie-independence.js'],{state:st});r=c.EvieIndependence.calc();assert.equal(r.alone,1000000);assert.equal(r.shared,700000);assert.equal(r.saving,300000);assert.equal(r.fund,3000000);assert.equal(r.runway,3);});

test('weekly: metrics from real data, diary only with explicit permission, local priorities by urgency',()=>{
 const st=base();const t='2026-11-22';// Sunday
 st.gymSessions=[{date:add(t,-1),exercises:[{muscles:['chest']},{muscles:['back']}]},{date:add(t,-9)},{date:add(t,-10)},{date:add(t,-11)}];
 st.clients=[{id:'c1',title:'Café',stage:'Diagnóstico',nextDate:add(t,-2),created_at:add(t,-3)+'T10:00:00Z'},{id:'c2',title:'Taller',stage:'Propuesta',created_at:'2026-01-01T00:00:00Z',cabin:{outcome:{result:'won',at:add(t,-1)+'T09:00:00Z'}}}];
 st.transactions=[{date:add(t,-2),type:'income',business_unit:'soma',amount:250000},{date:add(t,-1),type:'expense',amount:400000}];
 st.journal=[{date:add(t,-1),summary:'texto privado del diario'}];
 const trends={called:0};const c=browser(['evie-weekly.js'],{state:st,extra:{KishaCore:{trends(){trends.called++;return {entries:2,emotions:[{key:'calma',label:'Calma',mean:61.4,n:2},{key:'ansiedad',label:'Ansiedad',mean:30,n:1}]};}}}});
 let m=c.EvieWeekly.build(t);assert.equal(m.from,add(t,-6));assert.equal(m.fisico.sessions,1);assert.equal(m.fisico.prev,3);assert.equal(m.fisico.groups,2);
 assert.deepEqual({...m.soma},{income:250000,newClients:1,won:1,lost:0,overdue:1,dojo:0,dojoBest:0});assert.equal(m.finance.net,-150000);assert.equal(m.mood.locked,true);assert.equal(trends.called,0,'diary not read without permission');
 const pr=c.EvieWeekly.priorities(m);assert.equal(pr.length,3);assert.match(pr[0].text,/seguimiento de SOMA/);assert.match(pr[1].text,/Entrena al menos 3 veces/);assert.match(pr[2].text,/Revisa tus gastos/);
 st.preferences.journalPrivacy={crossModule:true};m=c.EvieWeekly.build(t);assert.equal(m.mood.locked,false);assert.deepEqual(m.mood.top.map(x=>x.label),['Calma','Ansiedad']);
 const pay=c.EvieWeekly.aiPayload(m);assert.ok(!JSON.stringify(pay).includes('texto privado'),'no diary text leaves the browser');assert.equal(pay.mood.entries,2);});

async function server(t,extra={}){const {createAccounts}=await import('../src/accounts.js');const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),ANTHROPIC_API_KEY:'k',...extra};
 const sent=[];let reply='{}';
 const sse=(text)=>{const ev=[],push=(type,data)=>ev.push(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);push('message_start',{message:{id:'m',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:700,output_tokens:1,cache_read_input_tokens:0,cache_creation_input_tokens:0}}});push('content_block_start',{index:0,content_block:{type:'text',text:''}});push('content_block_delta',{index:0,delta:{type:'text_delta',text}});push('content_block_stop',{index:0});push('message_delta',{delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:150}});push('message_stop',{});return new Response(ev.join(''),{headers:{'content-type':'text/event-stream'}});};
 const fetcher=async(input,o={})=>{const url=typeof input==='string'?input:input.url;if(url.includes('grant_type=password'))return Response.json({user:{id:A},access_token:'acc',refresh_token:'ref',expires_in:3600});if(url.endsWith('/auth/v1/user'))return Response.json({id:A});
  if(url.startsWith('https://api.anthropic.com')){sent.push({p:'claude',b:JSON.parse(o.body)});return sse(reply);}
  if(url.startsWith('https://api.openai.com/v1/responses')){const b=JSON.parse(o.body);sent.push({p:'openai',b});return Response.json({status:'completed',model:b.model,output:[{type:'message',content:[{type:'output_text',text:reply}]}],usage:{input_tokens:600,output_tokens:200}});}throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});const request=(route,{method='GET',body,cookie}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-Evie-User':A}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},env);
 const r=await request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'}});return {request,cookie:r.headers.get('set-cookie').split(';')[0],sent,db,setReply:x=>reply=x};}
const metrics={range:{from:'2026-11-16',to:'2026-11-22'},mission:{name:'<b>Laptop</b>',pct:20,week_cents:150000,on_track:true,required_monthly_cents:200000},fisico:{sessions:2,prev:3,groups:4},soma:{income:250000,newClients:1,won:1,lost:0,overdue:2},finance:{income:300000,expense:400000,net:-100000},school:{tasks_done:3,reviews:40,exams:[{title:'Parcial',subject:'Mate',due:'2026-11-25'}],average:88,overdue:0},mood:{entries:2,top:[{label:'Calma',mean:61}]},priorities:['Repasar'],diary:'texto libre que no debe pasar'};
const REVIEW={resumen:'Buena semana de ventas.',logros:['Ganaste un cliente'],alertas:['Dos seguimientos atrasados'],prioridades:[{titulo:'Llamar a 2 prospectos',por_que:'Atrasados'},{titulo:'Estudiar para el parcial',por_que:'Es el miércoles'},{titulo:'Entrenar 3 veces',por_que:'Bajaste a 2'}]};

test('weekly review route: Claude (effort medium) and OpenAI (strict schema); only whitelisted numbers reach the model',async t=>{
 for(const extra of [{},{ANTHROPIC_API_KEY:'',OPENAI_API_KEY:'o'}]){const f=await server(t,extra);f.setReply(JSON.stringify(REVIEW));
  const r=await f.request('/weekly/review',{method:'POST',cookie:f.cookie,body:metrics});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
  assert.equal(j.review.prioridades.length,3);assert.equal(j.review.prioridades[1].titulo,'Estudiar para el parcial');
  const call=f.sent[0];const text=call.p==='claude'?call.b.messages[0].content:call.b.input[0].content;
  assert.ok(!/texto libre/.test(text),'unknown fields are dropped');assert.ok(!/<b>/.test(text),'angle brackets stripped');assert.match(text,/"ahorro_semana_mxn":1500/);
  if(call.p==='claude')assert.equal(call.b.output_config.effort,'medium');else{assert.equal(call.b.text.format.strict,true);assert.equal(call.b.text.format.name,'weekly_review');assert.equal(call.b.reasoning.effort,'medium');}
  assert.ok(f.db.prepare("SELECT amount FROM ai_usage WHERE owner_id=? AND kind='cost_micro'").get(A).amount>0);}});

test('weekly review route: session, dates and AI configuration are required',async t=>{const f=await server(t);
 assert.equal((await f.request('/weekly/review',{method:'POST',body:metrics})).status,401);
 assert.equal((await f.request('/weekly/review',{method:'POST',cookie:f.cookie,body:{...metrics,range:{}}})).status,400);
 const n=await server(t,{ANTHROPIC_API_KEY:''});const r=await n.request('/weekly/review',{method:'POST',cookie:n.cookie,body:metrics});assert.equal(r.status,503);assert.match((await r.json()).error,/IA no está configurada/);});
