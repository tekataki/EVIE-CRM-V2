'use strict';
// Finance v4: account-aware logging through Ivi (local parser + EvieFinance), transfers, reconciliation baselines,
// idempotency, legacy unassigned movements, double-count detection. Pure: runs both modules in a vm with a tiny Store.
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function env(accounts=[{id:'b',name:'BBVA',type:'debit',opening:392000},{id:'c',name:'Dinero Físico',type:'debit',opening:100000}],transactions=[]){
 const ctx={console,Date,Math,JSON,Intl,structuredClone};ctx.window=ctx;vm.createContext(ctx);
 const run=f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx);run('finance-core.js');
 const state={preferences:{evieAccounts:structuredClone(accounts)},transactions:structuredClone(transactions),clients:[{id:'cl1',title:'Intensity'}],categories:['Comida','Ventas','Personal','Otro','Clientes','Gasolina','Gimnasio','Escuela']};
 let n=0,clock=Date.parse('2026-10-15T18:00:00Z');ctx.Date=class extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}};
 ctx.Store={get:()=>state,list:c=>state[c].filter(x=>!x.deleted_at),save:fn=>fn(state),record:d=>({id:'t'+(++n),created_at:new Date(clock+n).toISOString(),updated_at:new Date(clock).toISOString(),...d}),uuid:()=>'u'+(++n)};
 ctx.Records={normalize:(c,p)=>p};ctx.Domain={today:()=>'2026-10-15',money:c=>'$'+(c/100).toFixed(2)};
 ctx.V2Domain={date:d=>/^\d{4}-\d{2}-\d{2}$/.test(d||''),addDays:(d,k)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+k);return x.toISOString().slice(0,10);}};
 ctx.DALI_CONFIG={categories:state.categories};const toasts=[];ctx.App={render(){},toast(t,k,u){toasts.push({t,u});}};
 run('evie-finance.js');
 return {E:ctx.EvieFinance,F:ctx.FinanceCore,state,toasts,tick:(ms)=>{clock+=ms;},av:()=>ctx.FinanceCore.available(state.preferences.evieAccounts,state.transactions,{today:'2026-10-15'})};}
const bal=(x,id)=>x.av().accounts.find(a=>a.id===id).balance;
test('3,920 BBVA + 1,000 cash = 4,920; a 200 cash expense → cash 800, total 4,720, period expense +200',()=>{
 const x=env();assert.equal(x.av().cents,492000);
 const say=x.E.intent('Ivi, gasté 200 pesos de mi dinero físico en comida');
 assert.match(say,/gasto de \$200\.00 de Dinero Físico/);assert.equal(bal(x,'c'),80000);assert.equal(x.av().cents,472000);
 const t=x.state.transactions[0];assert.equal(t.evie_account,'c');assert.equal(t.category,'Comida');assert.equal(t.title,'Comida');assert.ok(t.op_id);
 assert.deepEqual([x.F.periodTotals(x.state.transactions,'2026-10-01','2026-10-31').expense],[20000]);
 assert.equal(x.toasts.length,1);assert.equal(typeof x.toasts[0].u,'function','toast offers undo');});
test('income «en BBVA» records one income against BBVA; no SOMA link unless explicit',()=>{
 const x=env();const say=x.E.intent('Ivi, recibí 500 pesos por un Intensity en BBVA');assert.match(say,/ingreso de \$500\.00 en BBVA/);
 const t=x.state.transactions[0];assert.equal(t.type,'income');assert.equal(t.evie_account,'b');assert.equal(t.title,'Intensity');assert.equal(t.soma_client,undefined);assert.equal(bal(x,'b'),442000);
 const r=x.E.log({type:'income',amount:50000,title:'Intensity',account:'BBVA',soma_client:'cl1',op_id:'call-1'});assert.equal(r.record.soma_client,'cl1');assert.equal(r.record.business_unit,'soma');});
test('no account named with two accounts → asks which one; the answer completes exactly one movement',()=>{
 const x=env();assert.equal(x.E.intent('Ivi, agrega un gasto de 300 pesos'),'¿De cuál cuenta: BBVA o Dinero Físico?');assert.equal(x.state.transactions.length,0);
 assert.match(x.E.intent('BBVA'),/gasto de \$300\.00 de BBVA/);assert.equal(x.state.transactions.length,1);assert.equal(bal(x,'b'),362000);assert.equal(x.E.hasPending(),false);});
test('unknown answer re-asks once; «cancela» writes nothing',()=>{const x=env();x.E.intent('agrega un gasto de 300 pesos');assert.match(x.E.intent('Santander'),/No reconocí/);assert.equal(x.E.intent('cancela'),'Listo, no registré nada.');assert.equal(x.state.transactions.length,0);});
test('exactly one account → it is used without asking',()=>{const x=env([{id:'b',name:'BBVA',type:'debit',opening:1000}]);assert.match(x.E.intent('agrega un gasto de 300 pesos'),/de BBVA/);assert.equal(x.state.transactions[0].evie_account,'b');});
test('repeated utterance / network retry creates only one movement (op window and explicit op_id)',()=>{
 const x=env();x.E.intent('gasté 200 pesos de mi dinero físico en comida');assert.match(x.E.intent('gasté 200 pesos de mi dinero físico en comida'),/ya estaba registrado/);assert.equal(x.state.transactions.length,1);
 const a=x.E.log({type:'expense',amount:999,title:'x',account:'BBVA',op_id:'call_abc'}),b=x.E.log({type:'expense',amount:999,title:'x',account:'BBVA',op_id:'call_abc'});assert.equal(a.status,'created');assert.equal(b.status,'duplicate');assert.equal(x.state.transactions.length,2);
 x.tick(10*60*1000);x.E.intent('gasté 200 pesos de mi dinero físico en comida');assert.equal(x.state.transactions.length,3,'a genuinely new identical purchase later is allowed');});
test('cash → BBVA transfer keeps the combined total and does not inflate income/expenses',()=>{
 const x=env();const say=x.E.intent('pasa 200 de efectivo a BBVA');assert.match(say,/Pasé \$200\.00 de Dinero Físico a BBVA/);
 assert.equal(bal(x,'c'),80000);assert.equal(bal(x,'b'),412000);assert.equal(x.av().cents,492000);
 const p=x.F.periodTotals(x.state.transactions,'2026-10-01','2026-10-31');assert.deepEqual([p.income,p.expense,p.count],[0,0,0]);
 assert.equal(new Set(x.state.transactions.map(t=>t.transfer_id)).size,1);});
test('undo removes exactly what the operation created',()=>{const x=env();const r=x.E.log({type:'expense',amount:20000,title:'Comida',account:'efectivo'});r.undo();assert.equal(x.av().cents,492000);assert.equal(x.state.transactions[0].deleted_at!=null,true);assert.equal(x.state.transactions[0].id,r.record.id);});
test('legacy unassigned movements stay unassigned and do not change balances when the new code loads',()=>{
 const legacy=[{id:'L1',title:'Ventas de SOMA',type:'income',amount:92000,date:'2026-10-14',category:'Ventas',created_at:'2026-10-14T10:00:00Z'},{id:'L2',title:'Ajuste para equilibrar finanzas',type:'expense',amount:173300,date:'2026-10-15',category:'Otro',created_at:'2026-10-15T09:00:00Z'}];
 const x=env(undefined,legacy);assert.equal(x.av().cents,492000);assert.equal(x.av().unassigned_count,2);assert.equal(x.E.reviewQueue().length,2);
 const imp=x.E.reviewQueue()[0].impacts.find(i=>i.account.id==='b');assert.equal(imp.included,null,'no baseline time: honest unknown');assert.equal(imp.changes_balance,true);
 x.E.setAccount('L1','b',{inBaseline:true});assert.equal(bal(x,'b'),392000,'marked as already in the opening balance: not double-counted');assert.equal(x.state.transactions.find(t=>t.id==='L1').id,'L1');
 x.E.setAccount('L1','b');assert.equal(bal(x,'b'),484000,'assigned as new money: counted once');});
test('reconciliation is a baseline, never income/expense, and earlier movements are not double counted',()=>{
 const x=env();x.E.intent('gasté 200 pesos de mi dinero físico en comida');x.tick(1000);
 const r=x.E.reconcile('c',75000);assert.equal(r.diff,-5000);assert.equal(bal(x,'c'),75000);
 assert.equal(x.F.periodTotals(x.state.transactions,'2026-10-01','2026-10-31').expense,20000,'reconciliation does not add a statistic');assert.equal(x.state.transactions.length,1);
 x.tick(1000);x.E.log({type:'expense',amount:5000,title:'Café',account:'Dinero Físico'});assert.equal(bal(x,'c'),70000,'new movements after the baseline still count');
 r.undo();assert.equal(bal(x,'c'),75000);});
test('legacy adjustment transactions keep their balance effect but leave monthly statistics',()=>{
 const x=env(undefined,[{id:'A1',title:'Ajuste de saldo · BBVA',type:'expense',amount:10000,date:'2026-10-10',category:'Otro',source:'evie-reconcile',evie_account:'b',created_at:'2026-10-10T00:00:00Z'}]);
 assert.equal(bal(x,'b'),382000);assert.equal(x.F.periodTotals(x.state.transactions,'2026-10-01','2026-10-31').expense,0);assert.equal(x.av().adjustments,1);});
test('credit limit is never spendable; type correction keeps value and history',()=>{
 const x=env([{id:'b',name:'BBVA',type:'debit',opening:392000},{id:'c',name:'Dinero Físico',type:'debit',opening:100000},{id:'k',name:'Tarjeta Oro',type:'credit',opening:50000,limit:2000000}]);
 assert.equal(x.av().cents,492000);assert.equal(x.av().credit[0].available_credit,1950000);
 assert.deepEqual(x.E.suggestions().map(s=>[s.name,s.to]),[['Dinero Físico','cash']]);x.E.setType('c','cash');assert.equal(bal(x,'c'),100000);assert.equal(x.state.preferences.evieAccounts[1].type_history[0].from,'debit');
 assert.match(x.E.intent('gasté 100 de efectivo en tacos'),/de Dinero Físico/);});
test('amount formats: 1,250.50 · 1.250 · 300.5 and «en gasolina con BBVA»',()=>{const x=env();
 assert.equal(x.E.toCents('1,250.50'),125050);assert.equal(x.E.toCents('1.250'),125000);assert.equal(x.E.toCents('300.5'),30050);
 assert.match(x.E.intent('gasté 1,250.50 en gasolina con BBVA'),/\$1250\.50 de BBVA · Gasolina/);assert.equal(x.state.transactions[0].category,'Gasolina');
 assert.equal(x.E.intent('qué tal el clima'),null,'non-finance text is not captured');});
