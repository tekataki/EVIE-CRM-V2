'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ctx={document:{addEventListener(){}},Domain:{today:()=>'2026-10-12'}};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['v2-domain.js','gym-log.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx);
const G=ctx.EvieGym,D=ctx.V2Domain;
const field=v=>({value:v});
function fakeForm({title='Pierna',date='2026-10-12',minutes='45',notes='',ex=[]}){const sets=ex.map(x=>({querySelector:sel=>field(String(x[sel.match(/name=(\w+)/)[1]]??''))}));return {elements:{title:field(title),date:field(date),minutes:field(minutes),notes:field(notes)},querySelectorAll:()=>sets};}
test('parseDetail understands weight x reps and bodyweight sets',()=>{assert.deepEqual(JSON.parse(JSON.stringify(G.parseDetail('40x10, 42.5x8; x12'))),[{weight:40,reps:10},{weight:42.5,reps:8},{weight:null,reps:12}]);assert.throws(()=>G.parseDetail('diez'),/No entendí/);});
test('manual session is valid for the shared validator and computes volume',()=>{const row=G.build(fakeForm({ex:[{name:'Sentadilla',muscle:'quads',sets:3,reps:10,weight:60},{name:'Zancadas',muscle:'glutes',detail:'20x12, 20x10'},{name:'Caminata',sets:1,reps:'',weight:''}]}));
 assert.equal(row.source,'manual');assert.equal(row.completeness,'complete');assert.equal(row.duration_seconds,2700);assert.equal(row.reported_total_sets,6);assert.equal(row.reported_volume_kg,3*600+240+200);
 const calc=D.gym(row);assert.equal(calc.computed_total_sets,6);assert.equal(row.exercises[2].sets[0].weight_unit,null);assert.deepEqual(JSON.parse(JSON.stringify(row.exercises[0].primary_muscles)),['quads']);});
test('manual form rejects future dates, empty sessions and bad set counts',()=>{assert.throws(()=>G.build(fakeForm({date:'2026-10-13',ex:[{name:'A',sets:1,reps:1}]})),/futuro/);assert.throws(()=>G.build(fakeForm({ex:[{name:''}]})),/al menos un ejercicio/);assert.throws(()=>G.build(fakeForm({ex:[{name:'A',sets:0}]})),/series entre/);});
