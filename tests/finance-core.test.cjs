'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const F=(()=>{const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/finance-core.js'),'utf8'),ctx);return ctx.FinanceCore;})();
const tx=(o)=>({id:Math.random().toString(36),date:'2026-10-05',type:'income',amount:0,...o});
test('available balance uses cash/debit accounts, excludes credit limits and future-dated items',()=>{
 const acc=[{id:'d',name:'BBVA',type:'debit',opening:100000},{id:'c',name:'Tarjeta',type:'credit',opening:20000,limit:3000000},{id:'w',name:'Efectivo',type:'cash',opening:5000}];
 const t=[tx({evie_account:'d',type:'expense',amount:25050}),tx({evie_account:'d',type:'income',amount:10000}),tx({evie_account:'c',type:'expense',amount:15000}),tx({evie_account:'w',type:'expense',amount:1000}),tx({evie_account:'d',type:'income',amount:999999,date:'2026-12-30'}),tx({type:'income',amount:700000})];
 const r=F.available(acc,t,{today:'2026-10-11'});
 assert.equal(r.basis,'accounts');assert.equal(r.cents,100000-25050+10000+5000-1000);assert.equal(r.credit_debt,35000);assert.equal(r.credit[0].available_credit,3000000-35000);
 assert.equal(r.unassigned_count,1);assert.equal(r.unassigned_net,700000);assert.ok(Number.isInteger(r.cents));});
test('transfers between own accounts do not change totals or period income/expense',()=>{
 const acc=[{id:'a',type:'debit',opening:0},{id:'b',type:'cash',opening:0}];
 const t=[tx({evie_account:'a',type:'income',amount:50000,category:'Salario'}),tx({evie_account:'a',type:'expense',amount:20000,transfer_id:'x'}),tx({evie_account:'b',type:'income',amount:20000,transfer_id:'x'})];
 const r=F.available(acc,t);assert.equal(r.cents,50000);const p=F.periodTotals(t,'2026-10-01','2026-10-31');assert.deepEqual([p.income,p.expense],[50000,0]);});
test('without accounts it falls back to an explicitly labelled ledger estimate',()=>{const r=F.available([],[tx({amount:1000}),tx({type:'expense',amount:300}),tx({amount:5,deleted_at:'x'})]);assert.equal(r.basis,'ledger');assert.equal(r.cents,700);assert.equal(r.verified,false);});
test('chart buckets match the period totals exactly (7/30/90, narrow aggregation)',()=>{
 const t=[tx({date:'2026-10-11',amount:12345}),tx({date:'2026-10-10',type:'expense',amount:2345}),tx({date:'2026-09-01',amount:100}),tx({date:'2026-07-20',type:'expense',amount:50})];
 for(const days of [7,30,90])for(const narrow of [false,true]){const b=F.buckets(t,days,'2026-10-11',{narrow});const si=b.buckets.reduce((s,x)=>s+x.income,0),se=b.buckets.reduce((s,x)=>s+x.expense,0);assert.equal(si,b.totals.income);assert.equal(se,b.totals.expense);assert.equal(b.buckets.at(-1).end,'2026-10-11');}
 assert.equal(F.buckets(t,7,'2026-10-11').buckets.length,7);assert.equal(F.buckets(t,30,'2026-10-11',{narrow:true}).step,7);assert.equal(F.buckets(t,90,'2026-10-11').totals.income,12445);});
