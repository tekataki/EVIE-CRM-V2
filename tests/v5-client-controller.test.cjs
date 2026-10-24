'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function load({role='owner',routes={}}={}){const calls=[];let subs=[];let user={id:'11111111-1111-4111-8111-111111111111',role};
 const store={clients:[{id:'c1',title:'Intensity'}],preferences:{theme:'light'},automations:[]};
 const s={console,structuredClone,Intl,crypto:globalThis.crypto,setTimeout:()=>0,clearTimeout(){},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},
  CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail;}},
  document:{documentElement:{dataset:{}},addEventListener(){},dispatchEvent(){},querySelector:()=>null,createElement:()=>({hidden:true,innerHTML:'',setAttribute(){},addEventListener(){},append(){},querySelector:()=>null,querySelectorAll:()=>[]}),body:{append(){}}},
  location:{hash:''},Store:{get:()=>store,save:f=>f(store),list:k=>store[k]||[]},App:{render(){},toast(){}},Domain:{today:()=>'2026-10-12'},
  EviePendientes:{addDays:(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10),build:()=>[]},
  EvieModes:{set:m=>({ok:m==='negocio'})},EvieHUD:{open:c=>({ok:c!=='nope'}),close:()=>({ok:true})},
  EvieAccounts:{current:()=>user,config:()=>({accountsEnabled:true}),subscribe:f=>{subs.push(f);},request:async(p,o={})=>{calls.push([p,o.method||'GET',o.body]);const k=Object.keys(routes).sort((a,b)=>b.length-a.length).find(r=>p.startsWith(r));if(!k)throw Error('no route '+p);return typeof routes[k]==='function'?routes[k](p,o):routes[k];}}};
 s.window=s;vm.createContext(s);for(const f of ['evie-v5-core.js','evie-v5.js'])vm.runInContext(fs.readFileSync(path.join(root,'public',f),'utf8'),s);
 return {s,calls,store,switchUser:u=>{user=u;subs.forEach(f=>f(u));}};}
test('non-v5 text falls through (null) and surface commands stay with the local router',async()=>{const {s}=load({routes:{scenes:{scenes:[]}}});
 assert.equal(await s.EvieV5.handle('abre el mapa'),null);assert.equal(await s.EvieV5.handle('hola cómo estás'),null);assert.equal(await s.EvieV5.handle('usa profundo solo para esta pregunta'),null);});
test('task create resolves the SOMA client and sends op_id; ambiguity/unknown asks back',async()=>{const {s,calls}=load({routes:{'tasks?':{tasks:[]},tasks:(p,o)=>({task:{id:'t1',title:o.body.title}})}});
 const r=await s.EvieV5.handle('Ivi, agrega una tarea para Intensity: enviar propuesta mañana');assert.match(r.text,/Anoté la tarea «enviar propuesta» para Intensity para mañana/);
 const post=calls.find(c=>c[0]==='tasks'&&c[1]==='POST');assert.equal(post[2].client_id,'c1');assert.equal(post[2].due_date,'2026-10-13');assert.match(post[2].op_id,/^op-/);
 const r2=await s.EvieV5.handle('agrega una tarea para Fulano: algo');assert.match(r2.text,/No encontré al cliente/);});
test('scene: guests never resolve scenes; owners run client steps and report per-step results',async()=>{
 const g=load({role:'guest',routes:{}});assert.equal(await g.s.EvieV5.handle('modo soma'),null);assert.equal(g.calls.length,0);
 const scene={id:'s1',name:'Modo SOMA',steps:[{action:'navigate',section:'negocios'},{action:'set_ai_tier',tier:'enfoque'},{action:'show_card',card:'nope'}]};
 const o=load({routes:{scenes:{scenes:[scene]},'scenes/resolve':{status:'match',scene},'scenes/s1/run':(p,o)=>({say:'parcial',client:o.body.client_results})}});
 const r=await o.s.EvieV5.handle('Ivi, modo SOMA');assert.equal(r.text,'parcial');
 const run=o.calls.find(c=>c[0]==='scenes/s1/run');const cr=JSON.parse(JSON.stringify(run[2].client_results));
 assert.deepEqual(cr.map(x=>[x.step,x.ok]),[[0,true],[2,false]]);assert.ok(run[2].run_id);assert.equal(o.s.location.hash,'negocios');});
test('plan proposal never applies without approval; account switch drops caches',async()=>{const {s,calls,switchUser}=load({routes:{'tasks?':{tasks:[{id:'t9',title:'x',status:'open'}]},'plan/propose':{plan_id:'p1',slots:[{item_id:'d0',kind:'nuevo',start:'09:00',end:'09:30',title:'a'}],warnings:[],hours:{start:'09:00',end:'18:00'},say:'Te propongo 1 bloque'}}});
 const r=await s.EvieV5.handle('prepara mi día: llamar a Intensity 30 min');assert.match(r.text,/Te propongo/);assert.ok(!calls.some(c=>/apply/.test(c[0])));
 const body=calls.find(c=>c[0]==='plan/propose')[2];assert.equal(body.day,'today');assert.ok(!/prepara/i.test(body.text));
 assert.equal(s.EvieV5.cachedTasks().length,1);switchUser({id:'22222222-2222-4222-8222-222222222222',role:'member'});assert.equal(s.EvieV5.cachedTasks(),null);});
test('once tier is sent a single time; lifecycle events carry no content',()=>{const {s}=load();assert.deepEqual(JSON.parse(JSON.stringify(s.EvieV5.chatExtras())),{});
 const lc=s.EvieV5.lifecycle();lc.emit('thinking',{tool:'x',text:'secreto'});lc.emit('completed');assert.ok(lc.log.every(e=>!('text' in e)));assert.equal(lc.done,true);});
