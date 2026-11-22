'use strict';
// Físico v8 · Cuerpo: medidas corporales + peso en `metrics`. Validation (store.js ≡ FisicoMeasures.check), parsing,
// deltas vs ~1 month, cadence (weigh weekly / tape every 2–4 weeks), sparkline, region→measurement mapping,
// same-day merge + undo, and the decluttered tab markup (body map + tracker only).
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const J=x=>JSON.parse(JSON.stringify(x));
function env({metrics=[],today='2026-11-22',prefs={}}={}){
 const ctx={console,Date,Math,JSON,Intl,structuredClone,Number,String,Object,Array,Promise,setTimeout};ctx.window=ctx;vm.createContext(ctx);
 const run=f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx,{filename:f});
 const state={preferences:{...prefs},metrics:structuredClone(metrics)};let n=0;const toasts=[];
 ctx.document={addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,documentElement:{dataset:{}}};
 ctx.matchMedia=()=>({matches:true});
 // Real store.js is loaded only for its pure metrics rule (Store.validateMetric); a small in-memory Store drives the UI.
 ctx.DALI_CONFIG={storageKey:'t'};ctx.V2Domain={collections:[]};ctx.RCData={collections:[]};run('store.js');const realStore=ctx.Store;
 ctx.Store={get:()=>state,list:c=>state[c].filter(x=>!x.deleted_at),save:fn=>fn(state),
  put(c,d,id){const bad=realStore.validateMetric({...(id?state[c].find(x=>x.id===id):{}),...d});if(bad)throw new Error(bad);
   if(id){const i=state[c].findIndex(x=>x.id===id);state[c][i]={...state[c][i],...d};return state[c][i];}const r={id:'m'+(++n),created_at:'2026-11-22T0'+n,...d};state[c].push(r);return r;},
  remove(c,id){const x=state[c].find(r=>r.id===id);if(x)x.deleted_at='now';}};
 ctx.Domain={today:()=>today};ctx.UI={section:'fisico'};
 ctx.App={render(){},toast(t,k,u){toasts.push({t,k,u});},openDialog(){},closeDialog(){}};
 ctx.Views={icon:n=>`<i data-lucide="${n}"></i>`,date:d=>d};
 run('fisico-core.js');run('fisico-body.js');run('fisico-measures.js');
 return {M:ctx.FisicoMeasures,B:ctx.FisicoBody,validate:realStore.validateMetric,state,toasts,UI:ctx.UI};}
const rec=(id,date,o={})=>({id,date,created_at:date+'T08:00',...o});

test('Store.validateMetric: legacy weight-only stays valid; weight optional with measurements; ranges enforced; same rule as FisicoMeasures.check',()=>{const x=env();
 const cases=[
  [{date:'2026-11-01',weight:80},true],[{date:'2026-11-01',weight:0},false],[{date:'2026-11-01'},false],[{date:'2026-11-01',weight:501},false],[{date:'2026-11-01',weight:-3},false],
  [{date:'2026-11-01',measurements:{biceps_r:36.5}},true],[{date:'2026-11-01',weight:null,measurements:{waist:82}},true],[{date:'2026-11-01',weight:0,measurements:{waist:82}},true],
  [{date:'2026-11-01',measurements:{biceps_r:9.9}},false],[{date:'2026-11-01',measurements:{chest:301}},false],[{date:'2026-11-01',measurements:{chest:10,neck:300}},true],
  [{date:'2026-11-01',measurements:{chest:'98'}},false],[{date:'2026-11-01',measurements:[98]},false],[{date:'2026-11-01',measurements:{'Bad Key':40}},false],[{date:'2026-11-01',measurements:{}},false],
  [{date:'2026-11-01',body_fat:18},true],[{date:'2026-11-01',body_fat:1.9},false],[{date:'2026-11-01',weight:80,body_fat:70.5},false],[{date:'2026-11-01',weight:80,body_fat:null,measurements:null},true]];
 for(const [r,ok] of cases){assert.equal(x.validate(r)==='',ok,'store: '+JSON.stringify(r));assert.equal(x.M.check(r)==='',ok,'measures: '+JSON.stringify(r));}
 assert.equal(x.validate({date:'2026-11-01',weight:0}),'Peso corporal no válido.','legacy message kept');});

test('parseNum + fromForm: comma decimals, empty fields skipped, friendly range errors, at least one value, no future dates',()=>{const {M}=env();
 assert.equal(M.parseNum('36,5'),36.5);assert.equal(M.parseNum(' 80.25 '),80.25);assert.equal(M.parseNum(''),null);assert.ok(Number.isNaN(M.parseNum('abc')));assert.ok(Number.isNaN(M.parseNum('1234')));
 const ok=M.fromForm({date:'2026-11-20',weight:'80,4',biceps_r:'36.5',waist:'',note:'  inicio  '},{today:'2026-11-22'});
 assert.deepEqual(J(ok.record),{date:'2026-11-20',weight:80.4,body_fat:null,measurements:{biceps_r:36.5},note:'inicio'});
 const bad=M.fromForm({date:'2026-11-20',biceps_r:'5'},{today:'2026-11-22'});assert.equal(bad.field,'biceps_r');assert.match(bad.error,/Bíceps der\.: escribe un número entre 10 y 300 cm/);
 assert.match(M.fromForm({date:'2026-11-20',weight:'',chest:''}).error,/al menos una medida/);
 assert.equal(M.fromForm({date:'2026-11-25',weight:'80'},{today:'2026-11-22'}).field,'date');
 assert.equal(M.fromForm({date:'2026-11-20',body_fat:'80'}).field,'body_fat');
 for(const f of M.FIELDS)assert.equal(M.check({date:'2026-11-01',...(f.key==='weight'?{weight:80}:f.key==='body_fat'?{body_fat:20}:{measurements:{[f.key]:40}})}),'','every form field is storable: '+f.key);});

test('delta vs ~1 month: picks the point closest to 30 days among those ≥21 days old; otherwise the oldest',()=>{const {M}=env();
 const pts=[['2026-09-20',34.6],['2026-10-21',35.3],['2026-11-15',36.1],['2026-11-22',36.5]].map(([date,value],i)=>({date,value,id:'p'+i}));
 const d=M.delta(pts);assert.equal(d.ref.date,'2026-10-21');assert.equal(d.diff,1.2);assert.equal(d.days,32);
 assert.equal(M.deltaText('biceps_r',d),'+1.2 cm vs hace 1 mes');assert.equal(M.tone('biceps_r',d.diff),'good');assert.equal(M.tone('waist',-2),'down');assert.equal(M.tone('waist',1),'up');
 const recent=M.delta(pts.slice(2));assert.equal(recent.ref.date,'2026-11-15');assert.equal(M.deltaText('biceps_r',recent),'+0.4 cm vs hace 1 semana');
 assert.equal(M.delta(pts.slice(-1)).diff,null);assert.equal(M.deltaText('weight',M.delta(pts.slice(-1))),'Primera medida');assert.equal(M.delta([]),null);
 assert.equal(M.deltaText('weight',M.delta([{date:'2026-10-22',value:80},{date:'2026-11-22',value:79.4}])),'−0.6 kg vs hace 1 mes');
 assert.equal(M.deltaText('chest',M.delta([{date:'2026-11-01',value:98},{date:'2026-11-22',value:98}])),'sin cambio vs hace 3 semanas');
 assert.deepEqual([1,3,7,14,30,45,60,400].map(M.vsLabel),['vs ayer','vs hace 3 días','vs hace 1 semana','vs hace 2 semanas','vs hace 1 mes','vs hace 1 mes','vs hace 2 meses','vs hace 1 año']);});

test('cadence: weigh every 7 days, tape every 14 by default (7/14/28 selectable); texts for first time, due and countdown',()=>{const {M}=env();
 assert.equal(M.WEIGH_EVERY,7);assert.equal(M.MEASURE_EVERY,14);assert.deepEqual([...M.EVERY],[7,14,28]);
 const none=M.cadence([],'2026-11-22');assert.equal(M.cadenceText(none.weight,'weight'),'Registra tu primer peso');assert.equal(M.cadenceText(none.measure,'measure'),'Toma tus primeras medidas');
 const rs=[rec('a','2026-11-19',{weight:80}),rec('b','2026-11-08',{measurements:{chest:98}}),rec('c','2026-11-21',{weight:0,measurements:null,body_fat:20})];
 const c=M.cadence(rs,'2026-11-22');assert.equal(c.weight.last,'2026-11-19');assert.equal(c.weight.left,4);assert.equal(M.cadenceText(c.weight,'weight'),'Próximo pesaje en 4 días');
 assert.equal(c.measure.since,14);assert.equal(c.measure.due,true);assert.equal(M.cadenceText(c.measure,'measure'),'Te toca medirte');
 const c28=M.cadence(rs,'2026-11-22',{measureEvery:28});assert.equal(M.cadenceText(c28.measure,'measure'),'Próxima medición en 14 días');assert.equal(c28.measure.next,'2026-12-06');
 assert.equal(M.cadenceText(M.cadence([rec('a','2026-11-16',{weight:80})],'2026-11-22').weight,'weight'),'Próximo pesaje mañana');
 assert.equal(M.cadenceText(M.cadence([rec('a','2026-11-01',{weight:80})],'2026-11-22').weight,'weight'),'Te toca pesarte');
 assert.equal(M.cadence([rec('x','2026-11-21',{weight:80,deleted_at:'now'})],'2026-11-22').weight.last,null,'deleted check-ins ignored');});

test('weekly average needs ≥2 weigh-ins in the last 7 days; sparkline is inline SVG and needs ≥2 points',()=>{const {M}=env();
 const w=[{date:'2026-11-14',value:81},{date:'2026-11-17',value:80.4},{date:'2026-11-20',value:80},{date:'2026-11-22',value:79.6}];
 assert.deepEqual(J(M.weekAvg(w,'2026-11-22')),{avg:80,n:3});assert.equal(M.weekAvg(w.slice(-1),'2026-11-22'),null);
 const s=M.spark([34.6,35.3,36.1,36.5],{label:'Historial'});assert.match(s,/^<svg class="fm-spark" viewBox="0 0 120 34"/);assert.match(s,/aria-label="Historial"/);assert.match(s,/class="fm-spark-line" d="M3\.0,31\.0L/);
 assert.equal(M.spark([36]),'');assert.match(M.spark([5,5]),/aria-hidden="true"/,'flat series renders mid-line, decorative without label');});

test('body regions map to measurements (arms→bíceps, legs→muslo, abdomen→cintura, glúteos→cadera) with values in the label',()=>{const {M,B}=env();
 assert.equal(M.REGION_PART.biceps,'arm');assert.equal(M.REGION_PART.triceps,'arm');assert.equal(M.REGION_PART.quads,'thigh');assert.equal(M.REGION_PART.hamstrings,'thigh');
 assert.equal(M.REGION_PART.core,'waist');assert.equal(M.REGION_PART.glutes,'hips');assert.equal(M.REGION_PART.calves,'calf');
 for(const k of [...Object.keys(B.FRONT),...Object.keys(B.BACK)])assert.ok(M.PARTS[M.REGION_PART[k]],'every map region has a measurement: '+k);
 const info=M.regionInfo([rec('a','2026-11-22',{measurements:{biceps_r:36.5,biceps_l:36}})],{part:'arm',side:'r'});
 assert.equal(info.biceps.label,'Bíceps: der. 36.5 cm · izq. 36 cm');assert.equal(info.biceps.has,true);assert.equal(info.triceps.on,true);assert.equal(info.chest.has,false);assert.match(info.chest.label,/sin medidas/);
 const f=B.view('front',{measure:info}),b=B.view('back',{measure:info});
 assert.equal((f.match(/class="fb-m"/g)||[]).length,8);assert.equal((b.match(/class="fb-m"/g)||[]).length,8);
 assert.match(f,/data-m="biceps" data-band="idle" data-has="1" data-selected="1"/);assert.match(f,/id="fb-vol-front"/);assert.match(b,/id="fb-vol-back"/);assert.match(b,/clip-path="url\(#fb-clip-back\)"/);
 assert.doesNotMatch(f+b,/<image|href="http/,'still original vector art, no raster');assert.doesNotMatch(B.view('front',{}),/fb-vol-/,'legacy recovery mode unchanged');});

test('saveCheckin: creates, merges the same day (no duplicate date), edits replace, undo restores; delete is undoable',()=>{const x=env({metrics:[rec('old','2026-10-20',{weight:81,note:''})]});const M=x.M;
 const a=M.saveCheckin({date:'2026-11-22',weight:null,body_fat:null,measurements:{biceps_r:36.5},note:''});assert.equal(x.state.metrics.length,2);
 const saved=x.state.metrics.find(r=>r.id===a.id);assert.equal(saved.weight,null);assert.deepEqual(J(saved.measurements),{biceps_r:36.5});
 const b=M.saveCheckin({date:'2026-11-22',weight:79.9,body_fat:null,measurements:{},note:''});assert.equal(b.id,a.id,'quick weight merges into today');assert.equal(x.state.metrics.length,2);
 assert.deepEqual(J(x.state.metrics.find(r=>r.id===a.id)),J({...saved,weight:79.9,body_fat:null,measurements:{biceps_r:36.5},note:''}));
 b.undo();assert.equal(x.state.metrics.find(r=>r.id===a.id).weight,null,'undo restores previous values');
 M.saveCheckin({date:'2026-11-21',weight:80,body_fat:null,measurements:{},note:'editado'},{id:a.id,replace:true});const e=x.state.metrics.find(r=>r.id===a.id);
 assert.equal(e.date,'2026-11-21');assert.equal(e.measurements,null,'replace clears emptied fields');assert.equal(e.note,'editado');
 assert.throws(()=>M.saveCheckin({date:'2026-11-22',weight:null,body_fat:null,measurements:{chest:400},note:''}),/fuera de rango/,'store guard still applies');
 M.del('old');assert.ok(x.state.metrics.find(r=>r.id==='old').deleted_at);x.toasts.at(-1).u();const back=x.state.metrics.filter(r=>!r.deleted_at&&r.weight===81);assert.equal(back.length,1,'undo re-creates the check-in');});

test('Cuerpo tab: body map + tracker only (no today strip, group list, legend or recovery note); history newest first with deltas',()=>{
 const x=env({metrics:[rec('a','2026-10-21',{weight:80.6,measurements:{biceps_r:35.3}}),rec('b','2026-11-22',{weight:79.9,measurements:{biceps_r:36.5}})]});x.UI.fisicoPart={part:'arm',side:'r'};
 const h=x.M.tab({presentation:'neutral',presControl:'<select data-fis="pres"></select>'});
 for(const gone of ['fis-today','fis-groups','fis-legend','fis-note','fis-detail','sin registros'])assert.ok(!h.includes(gone),'removed: '+gone);
 assert.equal((h.match(/class="fb-m"/g)||[]).length,16);assert.equal((h.match(/<figure class="fis-figure fm-face"/g)||[]).length,2);assert.match(h,/class="fis-figures fm-figures"/);
 assert.match(h,/data-fm="measure"[^>]*>.*Registrar medidas/);assert.match(h,/data-fm="weight"/);assert.match(h,/data-fis="pres"/);
 assert.match(h,/Bíceps der\.<\/small><strong>36\.5<u>cm<\/u><\/strong><em class="good">\+1\.2 cm vs hace 1 mes<\/em>/,'tapped part shows latest + change vs 1 month');
 assert.match(h,/Te toca medirte|Próxima medición en/);assert.match(h,/Próximo pesaje en 7 días/);assert.match(h,/inputmode|Pésate cada semana y mide cada 2–4 semanas/);
 const hist=h.slice(h.indexOf('class="fm-hist"'));assert.ok(hist.indexOf('2026-11-22')<hist.indexOf('2026-10-21'),'newest first');assert.match(hist,/<em class="down">−0\.7<\/em>/);assert.match(hist,/data-fm="edit" data-id="b"/);assert.match(hist,/data-fm="del" data-id="b"/);
 const empty=env().M.tab({});assert.match(empty,/Tu punto de partida/);assert.match(empty,/Toca una parte del cuerpo/);assert.match(empty,/Registra tu primer peso/);});
