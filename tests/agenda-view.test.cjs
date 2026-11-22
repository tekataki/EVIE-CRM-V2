'use strict';
/* Agenda v8 view helpers (pure, in public/agenda-rules.js): sections, ordering, week strip, tabs and quick add. */
const {test}=require('node:test');const assert=require('node:assert/strict');
const R=(()=>{const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/agenda-rules.js'),'utf8'),ctx);const A=ctx.AgendaRules,j=f=>(...a)=>JSON.parse(JSON.stringify(f(...a)));return {...A,group:j(A.group),week:j(A.week),quick:j(A.quick)};})();
const TODAY='2026-11-18';// miércoles

test('bucket: Vencidos, Hoy, Mañana, Esta semana (hasta el domingo), Más adelante, Sin fecha',()=>{
 assert.equal(R.bucket('2026-11-17',TODAY),'overdue');assert.equal(R.bucket('2025-01-01',TODAY),'overdue');
 assert.equal(R.bucket(TODAY,TODAY),'today');assert.equal(R.bucket('2026-11-19',TODAY),'tomorrow');
 assert.equal(R.bucket('2026-11-20',TODAY),'week');assert.equal(R.bucket('2026-11-22',TODAY),'week');
 assert.equal(R.bucket('2026-11-23',TODAY),'later');
 for(const none of [null,undefined,'','mañana','2026-02-30','2026-13-01'])assert.equal(R.bucket(none,TODAY),'none');});

test('bucket: on Saturday tomorrow is Sunday and next Monday is already "Más adelante"; on Sunday the week is over',()=>{
 assert.equal(R.bucket('2026-11-22','2026-11-21'),'tomorrow');assert.equal(R.bucket('2026-11-23','2026-11-21'),'later');
 assert.equal(R.bucket('2026-11-23','2026-11-22'),'tomorrow');assert.equal(R.bucket('2026-11-24','2026-11-22'),'later');});

test('group: ordered sections, only non-empty ones, optional tab keys',()=>{
 const e=[{id:'a',date:'2026-11-25',title:'Más tarde'},{id:'b',date:null,title:'Idea'},{id:'c',date:'2026-11-10',title:'Viejo'},{id:'d',date:TODAY,time:'09:00',title:'Gym'},{id:'e',date:'2026-11-19',title:'Mañana'},{id:'f',date:'2026-11-21',title:'Sábado'}];
 const all=R.group(e,TODAY);
 assert.deepEqual(all.map(g=>g.key),['overdue','today','tomorrow','week','later','none']);
 assert.deepEqual(all.map(g=>g.label),['Vencidos','Hoy','Mañana','Esta semana','Más adelante','Sin fecha']);
 assert.deepEqual(R.group(e,TODAY,R.TABS.hoy).map(g=>g.key),['overdue','today']);
 assert.deepEqual(R.group(e,TODAY,R.TABS.proximos).map(g=>g.items[0].id),['e','f','a']);
 assert.deepEqual(R.group([],TODAY),[]);});

test('group order inside a section: todo el día first, then by hour, then priority, title, id',()=>{
 const e=[{id:'1',date:TODAY,time:'17:00',title:'Llamar'},{id:'2',date:TODAY,time:'',priority:'low',title:'Leer'},{id:'3',date:TODAY,time:'08:30',title:'Correr'},{id:'4',date:TODAY,time:'',priority:'high',title:'Pagar luz'},{id:'5',date:TODAY,time:'',priority:'high',title:'Agua'}];
 assert.deepEqual(R.group(e,TODAY)[0].items.map(x=>x.id),['5','4','2','3','1']);
 const late=[{id:'x',date:'2026-11-12',title:'B'},{id:'y',date:'2026-11-02',title:'A'}];
 assert.deepEqual(R.group(late,TODAY)[0].items.map(x=>x.id),['y','x'],'overdue: oldest first');});

test('week strip: Monday to Sunday around any day, including year boundaries',()=>{
 assert.deepEqual(R.week(TODAY),['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22']);
 assert.deepEqual(R.week('2026-11-22')[0],'2026-11-16');assert.deepEqual(R.week('2027-01-01'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);});

test('tab: new names pass through and every legacy tab maps to one of the four views',()=>{
 for(const t of ['hoy','proximos','todo','hechos'])assert.equal(R.tab(t),t);
 assert.equal(R.tab('today'),'hoy');assert.equal(R.tab('day'),'hoy');assert.equal(R.tab('week'),'proximos');assert.equal(R.tab('month'),'proximos');
 assert.equal(R.tab('tasks'),'todo');assert.equal(R.tab('done'),'hechos');assert.equal(R.tab(undefined),'hoy');assert.equal(R.tab('cualquier'),'hoy');});

test('quick add: same narrow suffix grammar as Ivy (hoy / mañana / fecha ISO + hora opcional)',()=>{
 assert.deepEqual(R.quick('Llamar a mamá mañana',TODAY),{title:'Llamar a mamá',date:'2026-11-19',time:null});
 assert.deepEqual(R.quick('Llamar a mamá manana a las 17:00',TODAY),{title:'Llamar a mamá',date:'2026-11-19',time:'17:00'});
 assert.deepEqual(R.quick('  Pagar   la luz hoy  ',TODAY),{title:'Pagar la luz',date:TODAY,time:null});
 assert.deepEqual(R.quick('Dentista 2026-12-01 9:05',TODAY),{title:'Dentista',date:'2026-12-01',time:'09:05'});
 assert.deepEqual(R.quick('Gym a las 7:30',TODAY),{title:'Gym',date:null,time:'07:30'});
 assert.deepEqual(R.quick('Junta 18:00',TODAY),{title:'Junta',date:null,time:'18:00'});
 assert.deepEqual(R.quick('Comprar pan MAÑANA',TODAY),{title:'Comprar pan',date:'2026-11-19',time:null});});

/* Real agenda.js + agenda-v8.js on top of the real data modules, with tiny DOM/Views/Store stubs. */
function app(){
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 const doc={documentElement:{dataset:{},classList:{add(){},contains:()=>false}},body:{append(){}},addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>({setAttribute(){},append(){},remove(){},style:{}})};
 const ctx={console,structuredClone,crypto:require('node:crypto').webcrypto,location:{search:'',hash:'#agenda'},document:doc,matchMedia:()=>({matches:true}),setTimeout,clearTimeout,CSS:{escape:s=>s}};ctx.window=ctx;vm.createContext(ctx);
 const load=f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx,{filename:f});
 for(const f of ['config.js','domain.js','v2-domain.js'])load(f);
 vm.runInContext(`window.Views={icon:n=>'<i data-lucide="'+n+'"></i>',date:(d,o={day:'numeric',month:'short'})=>new Date(d.length===10?d+'T12:00:00':d).toLocaleDateString('es-MX',o),heading:t=>'<h1>'+t+'</h1>',notFound:()=>'<p>404</p>'};
  window.UI={section:'agenda',id:null,tab:{}};let state={agendaItems:[]};
  window.Store={get:()=>state,list:c=>state[c].filter(x=>!x.deleted_at),save:m=>{const n=structuredClone(state);m(n);state=n;},set:s=>{state=s;}};`,ctx);
 for(const f of ['recurrence.js','agenda-rules.js','rc-data.js','agenda.js','agenda-v8.js'])load(f);
 const today=ctx.Domain.today(),at=(d,t='23:59')=>ctx.Agenda.toTimestamp(d+'T'+t),mk=o=>({...ctx.RCData.defaults('agendaItems'),id:ctx.crypto.randomUUID(),status:'scheduled',...o});
 return {w:ctx,today,at,mk,add:ctx.AgendaRules.add};
}
const sections=html=>[...html.matchAll(/class="agv-sec-h" id="agv-h-([^"]+)"/g)].map(m=>m[1]);
const titles=html=>[...html.matchAll(/class="agv-title">([^<]*)</g)].map(m=>m[1]);

test('screen: Hoy shows Vencidos + Hoy, Próximos the rest, Todo everything; titles are escaped; legacy tabs still work',()=>{
 const {w,today,at,mk,add}=app();
 w.Store.set({agendaItems:[mk({title:'Viejo',due_at:at(add(today,-2))}),mk({title:'Pagar <b>luz</b>',due_at:at(today),priority:'high'}),mk({title:'Dentista',start_at:at(add(today,1),'10:00'),all_day:false}),mk({title:'Idea',status:'inbox'}),mk({title:'Listo',status:'done',due_at:at(today),completed_at:new Date().toISOString()})]});
 w.UI.tab.agenda='hoy';let h=w.Agenda.render();
 assert.deepEqual(sections(h),['overdue','today']);assert.deepEqual(titles(h),['Viejo','Pagar &lt;b&gt;luz&lt;/b&gt;']);assert.ok(!h.includes('<b>luz</b>'));
 assert.match(h,/data-agv="new"/);assert.match(h,/id="agv-quick-input"/);assert.equal((h.match(/data-agv="day" data-date=/g)||[]).length,7);
 w.UI.tab.agenda='proximos';assert.deepEqual(sections(w.Agenda.render()),['tomorrow']);
 w.UI.tab.agenda='todo';assert.deepEqual(sections(w.Agenda.render()),['overdue','today','tomorrow','none']);
 w.UI.tab.agenda='hechos';assert.deepEqual(titles(w.Agenda.render()),['Listo']);
 w.UI.tab.agenda='today';assert.deepEqual(sections(w.Agenda.render()),['overdue','today']);assert.equal(w.UI.tab.agenda,'today','legacy value is read, not rewritten');
 w.UI.tab.agenda='hoy';w.UI.agendaDay=today;h=w.Agenda.render();assert.deepEqual(titles(h),['Pagar &lt;b&gt;luz&lt;/b&gt;','Listo']);assert.match(h,/agv-filter/);});

test('complete → reopen round trip keeps history (one-off task and one repetition of a series)',()=>{
 const {w,today,at,mk,add}=app();
 const one=mk({title:'Una vez',due_at:at(today)}),daily=mk({title:'Diario',start_at:at(add(today,-3),'07:00'),all_day:false,recurrence:{frequency:'daily',interval:1,timezone:'America/Mexico_City',time_local:'07:00',days_of_week:[],end_date:null}});
 w.Store.set({agendaItems:[one,daily]});
 w.Store.save(s=>{w.Agenda.complete(s,one.id,today);w.Agenda.complete(s,daily.id,today);});
 let [a,b]=w.Store.list('agendaItems');assert.equal(a.status,'done');assert.ok(w.Agenda.isDone(b,today));
 w.UI.tab.agenda='proximos';assert.ok(titles(w.Agenda.render()).includes('Diario'),'series moves to its next open day');
 let changed;w.Store.save(s=>{changed=[w.Agenda.reopen(s,one.id,today),w.Agenda.reopen(s,daily.id,today)];});assert.deepEqual(changed,[true,true]);
 [a,b]=w.Store.list('agendaItems');assert.equal(a.status,'scheduled');assert.equal(a.completed_at,null);assert.equal(a.history.length,2);assert.equal(a.history[1].reopened,true);
 assert.ok(!w.Agenda.isDone(b,today));assert.equal(b.history.length,1);assert.equal(b.history[0].completed,false);
 w.Store.save(s=>{changed=w.Agenda.reopen(s,one.id,today);});assert.equal(changed,false,'reopening an open task changes nothing');});

test('quick add never guesses: unknown words, impossible dates or a bare keyword stay as the title',()=>{
 assert.deepEqual(R.quick('Revisar propuesta el viernes',TODAY),{title:'Revisar propuesta el viernes',date:null,time:null});
 assert.deepEqual(R.quick('mañana',TODAY),{title:'mañana',date:null,time:null});
 assert.deepEqual(R.quick('Cita 2026-02-30',TODAY),{title:'Cita 2026-02-30',date:null,time:null});
 assert.deepEqual(R.quick('Alarma 25:00',TODAY),{title:'Alarma 25:00',date:null,time:null});
 assert.deepEqual(R.quick('Hoyos en la calle',TODAY),{title:'Hoyos en la calle',date:null,time:null});
 assert.equal(R.quick('   ',TODAY),null);});
