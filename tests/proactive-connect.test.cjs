'use strict';
// v10 · Ivi proactiva + conexiones (browser modules in a vm) and the server-side situation block.
// - IviProactive: upcoming() merges commitments/classes and timed Agenda items without duplicates; departureText() speaks
//   like a person (address, leave time with traffic, rain at that hour, local alert); situation() is bounded data.
// - EvieConnect: a new SOMA income suggests the mission share once; big sync pulls never prompt.
// - persona.iviSituation(): sanitized, bounded, '' when empty; IVI_CORE asks for common sense.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function ctxFor({state,today='2026-11-23',now=new Date(2026,10,23,12,0),extra={}}){
 const RealDate=Date;const ctx={console,Math,JSON,Intl,structuredClone,Number,String,Object,Array,Promise,Set,Map,RegExp,Error,crypto,setTimeout:(f)=>{ctx.__timers.push(f);return 0;},clearTimeout(){},setInterval:()=>0,clearInterval(){},__timers:[],...extra};
 ctx.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[now.getTime()]));}static now(){return now.getTime();}};ctx.window=ctx;vm.createContext(ctx);
 const subs=[];ctx.Store={get:()=>state,list:c=>(state[c]||[]).filter(x=>!x.deleted_at),save(fn){const prev=structuredClone(state);fn(state);subs.forEach(s=>s(prev,state));},subscribe(fn){subs.push(fn);return ()=>{};}};
 ctx.Domain={today:()=>today,money:c=>'$'+(c/100).toFixed(2)};ctx.V2Domain={addDays:(d,n)=>new RealDate(RealDate.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10)};
 ctx.UI={section:'inicio'};ctx.App={toasts:[],toast(t){ctx.App.toasts.push(t);},render(){},openDialog(){},closeDialog(){}};ctx.Views={icon:()=>''};
 ctx.document={addEventListener(){},querySelector:()=>null,getElementById:(id)=>id==='toast-region'?{append(n){ctx.__toasts.push(n);}}:null,createElement:()=>({set innerHTML(v){this.html=v;},append(b){this.btn=b;},setAttribute(){},remove(){}}),hidden:false};ctx.__toasts=[];
 ctx.localStorage={getItem:()=>null,setItem(){},removeItem(){}};ctx.sessionStorage={length:0,key:()=>null,getItem:()=>null,setItem(){}};ctx.navigator={};ctx.matchMedia=()=>({matches:false});
 return ctx;}
const load=(ctx,files)=>{for(const f of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx);return ctx;};

test('proactive: upcoming merges commitments and timed agenda items once; departure text sounds like a person',()=>{
 const state={preferences:{iviProactive:{callMe:'jefe',minutes:30,enabled:true,voice:true}},profile:{preferred:'Sam'},agendaItems:[{id:'a1',title:'Escuela',status:'scheduled',start_at:'2026-11-23T19:00:00.000Z',recurrence:{time_local:'13:00'}},{id:'a2',title:'Dentista',status:'scheduled',start_at:'2026-11-23T22:30:00.000Z'},{id:'a3',title:'Todo el día',status:'scheduled',all_day:true}],clients:[]};
 const c=ctxFor({state,extra:{Agenda:{occurrence:()=>true,isDone:()=>false},EvieBriefing:{todayCommitments:()=>[{id:'k1',label:'Escuela',time:'13:00',place:{name:'Campus',lat:1,lon:2},buffer:5}]},EvieRadar:{alerts:()=>[{titulo:'Cierre de calle por desfile'}]}}});
 load(c,['ivi-proactive.js']);const up=c.IviProactive.upcoming();
 assert.equal(up.map(x=>x.label).join('|'),'Escuela|Dentista','class from the timetable and the agenda block are the same event');assert.equal(up[0].place.name,'Campus');
 const t=c.IviProactive.departureText(up[0],{min:35,traffic:true});
 assert.match(t,/^Jefe, ¿vas a salir a las 12:20/);assert.match(t,/Veo que a las 1:00 p\. ?m\. tienes «Escuela»/);assert.match(t,/Con tráfico son 35 min\./);assert.match(t,/Ojo: Cierre de calle por desfile\./);
 assert.equal(c.IviProactive.address(),'jefe');
 const s=c.IviProactive.situation();assert.equal(s.address,'jefe');assert.equal(s.upcoming.length,2);assert.equal(s.alerts[0].titulo,'Cierre de calle por desfile');assert.ok(!('eta_min' in s.upcoming[0]),'no ETA until a route was computed');});

test('connect: a new SOMA payment suggests the mission share once; a big sync pull never prompts',()=>{
 const state={preferences:{},transactions:[{id:'t0',type:'income',business_unit:'soma',amount:100000,date:'2026-11-20'}],clients:[],agendaItems:[]};
 const contributed=[];const c=ctxFor({state,extra:{EvieMission:{cfg:()=>({name:'Laptop',soma_share:30,account_id:null}),contribute:(x)=>{contributed.push(x);return true;}}}});
 load(c,['evie-connect.js']);
 c.Store.save(s=>{s.transactions.push({id:'t1',type:'income',business_unit:'soma',amount:500000,date:'2026-11-23'});});
 c.__timers.splice(0).forEach(f=>f());assert.equal(c.__toasts.length,1);assert.match(c.__toasts[0].html,/Aparto \$1500\.00 \(30 %\) para «Laptop»/);
 c.__toasts[0].btn.onclick();assert.deepEqual(contributed,[150000]);
 c.Store.save(s=>{s.transactions=[...s.transactions];});c.__timers.splice(0).forEach(f=>f());assert.equal(c.__toasts.length,1,'same payment is not offered twice');
 c.Store.save(s=>{for(let i=0;i<10;i++)s.transactions.push({id:'p'+i,type:'income',business_unit:'soma',amount:100000,date:'2026-11-23'});});c.__timers.splice(0).forEach(f=>f());assert.equal(c.__toasts.length,1,'sync pull of many rows is ignored');
 c.Store.save(s=>{s.transactions.push({id:'t2',type:'income',business_unit:'personal',amount:900000,date:'2026-11-23'});});c.__timers.splice(0).forEach(f=>f());assert.equal(c.__toasts.length,1,'non-SOMA income is ignored');});

test('server situation block: sanitized, bounded, empty when nothing; persona asks for common sense',async()=>{
 const {iviSituation,IVI_CORE}=await import('../src/persona.js');
 assert.equal(iviSituation(null),'');assert.equal(iviSituation({}),'');assert.equal(iviSituation([1,2]),'');
 const s=iviSituation({address:'jefe',upcoming:[{label:'Escuela <script>',time:'13:00',place:'Campus',eta_min:34.6,traffic:true,leave:'12:20'},{label:'Sin hora',time:'1pm'},...Array.from({length:6},(_,i)=>({label:'X'+i,time:'18:0'+i}))],weather:'Nublado 21°',rain:[{time:'12:00',prob:172},{time:'x',prob:5}],alerts:[{titulo:'Cierre de calle',cuando:'9 a 13 h'}]});
 assert.match(s,/^<situacion_actual>/);assert.match(s,/«jefe»/);assert.match(s,/- 13:00 Escuela script \(Campus\) · camino ~35 min con tráfico · salir 12:20/);assert.ok(!/<script>/.test(s));assert.ok(!/Sin hora/.test(s),'invalid time dropped');
 assert.equal((s.match(/^- /gm)||[]).length,4,'max 4 upcoming');assert.match(s,/12:00 100 %/);assert.match(s,/Avisos locales verificados: Cierre de calle \(9 a 13 h\)\./);
 assert.match(IVI_CORE,/sentido común de persona/);});
