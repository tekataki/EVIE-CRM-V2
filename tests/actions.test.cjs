'use strict';
// v4 Ivi typed CRUD (EvieActions): allow-list only, validation, ambiguity questions, idempotency, soft delete,
// undo restores exact previous state, audit trail without note text.
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function env(){const ctx={console,JSON,Math,Date,structuredClone};ctx.window=ctx;vm.createContext(ctx);let n=0;
 const state={preferences:{},agendaItems:[{id:'a1',title:'Pagar la luz',status:'inbox',history:[],due_at:null,priority:'medium'},{id:'a2',title:'Llamar al banco BBVA',status:'inbox',history:[]},{id:'a3',title:'Llamar al banco Santander',status:'inbox',history:[]}],
  clients:[{id:'c1',title:'Intensity',stage:'Prospecto',notes:[]}],skills:[{id:'s1',title:'Inglés',tasks:[{id:'t1',title:'Practicar listening 20 min',done:false}]}]};
 ctx.Store={get:()=>state,list:c=>state[c],save:f=>f(state),uuid:()=>'u'+(++n),record:d=>({id:'r'+(++n),created_at:'x',...d})};
 ctx.RCData={defaults:()=>({title:'',kind:'task',status:'inbox',priority:'medium',area:'personal',notes:'',due_at:null,all_day:true,history:[]})};
 ctx.Agenda={toTimestamp:v=>v+':00-06:00',isDone:r=>r.status==='done',complete:(s,id)=>{const r=s.agendaItems.find(x=>x.id===id);r.status='done';}};
 ctx.Domain={today:()=>'2026-10-15'};const toasts=[];ctx.App={render(){},toast:(t,k,u)=>toasts.push({t,u})};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-actions.js'),'utf8'),ctx);return {A:ctx.EvieActions,state,toasts};}
test('only allow-listed operations; bad args rejected and nothing written',()=>{const {A,state}=env();const before=JSON.stringify(state);
 assert.equal(A.run('eval',{code:'1'}).status,'error');assert.equal(A.run('agenda.drop_all',{}).status,'error');assert.equal(A.run('agenda.create',[1]).status,'error');
 assert.match(A.run('agenda.create',{title:'x',date:'mañana'}).error,/AAAA-MM-DD/);assert.match(A.run('agenda.create',{title:'x',date:'2026-10-16',time:'25:00'}).error,/HH:MM/);
 assert.match(A.run('agenda.create',{title:'x'.repeat(200)}).error,/140/);assert.match(A.run('agenda.create',{title:'x',priority:'urgentísimo'}).error,/no permitido/);
 assert.equal(JSON.stringify(state),before);});
test('agenda create → toast with undo; duplicate and op_id retry write once',()=>{const x=env();
 const r=x.A.run('agenda.create',{title:'Dentista',date:'2026-10-17',time:'10:00'},{op_id:'call_1'});assert.equal(r.status,'created');assert.equal(x.state.agendaItems.at(-1).due_at,'2026-10-17T10:00:00-06:00');assert.equal(x.state.agendaItems.at(-1).status,'scheduled');
 assert.equal(x.A.run('agenda.create',{title:'Dentista',date:'2026-10-17',time:'10:00'},{op_id:'call_1'}).status,'duplicate');assert.equal(x.A.run('agenda.create',{title:'dentista',date:'2026-10-17'}).status,'duplicate');
 assert.equal(x.state.agendaItems.filter(a=>a.title==='Dentista').length,1);assert.equal(typeof x.toasts[0].u,'function');
 x.toasts[0].u();assert.ok(x.state.agendaItems.find(a=>a.title==='Dentista').deleted_at,'undo create = soft delete');});
test('ambiguous / not found → one question, no write; unique partial match resolves',()=>{const x=env();
 const amb=x.A.run('agenda.complete',{item:'llamar al banco'});assert.equal(amb.status,'needs');assert.match(amb.question,/BBVA.*Santander|Santander.*BBVA/);assert.equal(amb.candidates.length,2);
 assert.equal(x.A.run('agenda.complete',{item:'renovar pasaporte'}).status,'needs');
 assert.equal(x.A.run('agenda.complete',{item:'banco bbva'}).status,'updated');assert.equal(x.state.agendaItems[1].status,'done');assert.equal(x.A.run('agenda.complete',{item:'a2'}).status,'duplicate');});
test('update / delete restore exactly on undo',()=>{const x=env();const orig=structuredClone(x.state.agendaItems[0]);
 const u=x.A.run('agenda.update',{item:'pagar la luz',date:'2026-10-20',priority:'high'});assert.equal(u.status,'updated');assert.equal(x.state.agendaItems[0].priority,'high');assert.equal(x.state.agendaItems[0].status,'scheduled');
 u.undo();assert.deepEqual({...x.state.agendaItems[0]},orig);
 const d=x.A.run('agenda.delete',{item:'Pagar la luz'});assert.equal(d.status,'deleted');assert.ok(x.state.agendaItems[0].deleted_at);d.undo();assert.equal(x.state.agendaItems[0].deleted_at,undefined);
 assert.equal(x.A.run('agenda.update',{item:'pagar la luz'}).status,'needs','nothing to change → asks');});
test('SOMA note + stage, learning task + done; audit keeps titles only',()=>{const x=env();
 assert.equal(x.A.run('soma.note',{client:'intensity',note:'Pagará el lunes',next_date:'2026-10-19'}).status,'updated');assert.equal(x.state.clients[0].notes[0].text,'Pagará el lunes');assert.equal(x.state.clients[0].nextDate,'2026-10-19');
 assert.equal(x.A.run('soma.stage',{client:'Intensity',stage:'Activo'}).status,'updated');assert.match(x.A.run('soma.stage',{client:'Intensity',stage:'Ganado'}).error,/no permitido/);
 assert.equal(x.A.run('learning.task',{skill:'ingles',task:'Ver una serie en inglés',level:2}).status,'updated');assert.equal(x.A.run('learning.task',{skill:'ingles',task:'ver una serie en ingles'}).status,'duplicate');
 assert.equal(x.A.run('learning.done',{skill:'Inglés',task:'listening'}).status,'updated');assert.equal(x.state.skills[0].tasks[0].done,true);
 const au=x.A.audit();assert.ok(au.length>=4);assert.ok(!JSON.stringify(au).includes('Pagará el lunes'),'note text not copied into audit');});
