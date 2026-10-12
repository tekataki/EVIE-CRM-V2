'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const R=(()=>{const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/agenda-rules.js'),'utf8'),ctx);const A=ctx.AgendaRules,j=f=>(...a)=>JSON.parse(JSON.stringify(f(...a)));return {...A,expand:j(A.expand),parseMonthly:j(A.parseMonthly)};})();
test('15th and 30th each month until December: exact dates, February uses its last day once',()=>{
 const p=R.parseMonthly('Agrega los pagos de Intensity el 15 y 30 de cada mes hasta diciembre','2026-10-12');
 assert.deepEqual(p.days_of_month,[15,30]);assert.equal(p.end_date,'2026-12-31');
 assert.deepEqual(R.expand('2026-10-12',p,'2026-10-12','2027-12-31'),['2026-10-15','2026-10-30','2026-11-15','2026-11-30','2026-12-15','2026-12-30']);
 assert.deepEqual(R.expand('2027-01-01',{frequency:'monthly',interval:1,days_of_month:[29,30,31]},'2027-02-01','2027-02-28'),['2027-02-28']);});
test('year resolution never goes to the past',()=>{assert.equal(R.parseMonthly('el 1 de cada mes hasta marzo','2026-10-12').end_date,'2027-03-31');const p=R.parseMonthly('el 5 de cada mes hasta el 10 de noviembre de 2026','2026-10-12');assert.equal(p.end_date,'2026-11-10');assert.deepEqual(p.days_of_month,[5]);});
test('weekly by weekdays with interval, end date and per-occurrence cancellation',()=>{
 const rec={frequency:'weekly',interval:1,days_of_week:[1,3],end_date:'2026-10-21',exceptions:{'2026-10-14':{cancelled:true}}};
 assert.deepEqual(R.expand('2026-10-12',rec,'2026-10-01','2026-12-31'),['2026-10-12','2026-10-19','2026-10-21']);
 assert.deepEqual(R.expand('2026-10-12',{frequency:'weekly',interval:2,days_of_week:[1]},'2026-10-12','2026-11-10'),['2026-10-12','2026-10-26','2026-11-09']);});
test('daily, yearly and non-recurring',()=>{assert.equal(R.expand('2026-10-01',{frequency:'daily',interval:3},'2026-10-05','2026-10-12').join(),'2026-10-07,2026-10-10');assert.deepEqual(R.expand('2024-02-29',{frequency:'yearly',interval:1},'2025-01-01','2026-12-31'),['2025-02-28','2026-02-28']);assert.deepEqual(R.expand('2026-10-12',null,'2026-10-01','2026-10-31'),['2026-10-12']);});
test('not a monthly phrase → null (EVIE asks instead of inventing)',()=>{assert.equal(R.parseMonthly('paga la luz','2026-10-12'),null);});
