'use strict';
// Físico v4: phrase → groups, per-group last date/band, quick voice log without duplicates, merge into the day's
// voice session, op_id idempotency, undo, mapping override, original SVG body (one region per group, no red-only).
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function env(sessions=[]){
 const ctx={console,Date,Math,JSON,Intl,structuredClone};ctx.window=ctx;vm.createContext(ctx);
 const run=f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx);
 const state={preferences:{},gymSessions:structuredClone(sessions)};let n=0;
 ctx.Store={get:()=>state,list:c=>state[c].filter(x=>!x.deleted_at),save:fn=>fn(state),
  put(c,d,id){if(id){const i=state[c].findIndex(x=>x.id===id);state[c][i]={...state[c][i],...d};return state[c][i];}const r={id:'g'+(++n),created_at:'x',...d};state[c].push(r);return r;},
  remove(c,id){const x=state[c].find(r=>r.id===id);if(x)x.deleted_at='now';}};
 ctx.Domain={today:()=>'2026-10-15'};ctx.UI={section:'fisico'};
 ctx.V2Domain={addDays:(d,k)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+k);return x.toISOString().slice(0,10);},
  gym(s){if(!s.title||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!['partial','complete'].includes(s.completeness)||!Array.isArray(s.exercises)||!Array.isArray(s.uncertainties))throw Error('invalid');return {};}};
 const toasts=[];ctx.App={render(){},toast(t,k,u){toasts.push({t,u});}};ctx.Views={date:d=>d,icon:()=>'',heading:t=>`<h1>${t}</h1>`};
 ctx.document={addEventListener(){}};
 run('fisico-core.js');run('fisico-body.js');run('fisico-view.js');
 return {C:ctx.FisicoCore,B:ctx.FisicoBody,V:ctx.EvieFisico,state,toasts};}
const sess=(id,date,prim,sec=[])=>({id,title:id,date,completeness:'complete',source:'manual',uncertainties:[],exercises:[{name:'x',primary_muscles:prim,secondary_muscles:sec,sets:[{reps:10}]}]});

test('phrase → ordered groups, combos and accents',()=>{const x=env();
 assert.deepEqual([...x.C.groupsFrom('pecho y espalda')],['chest','back']);
 assert.deepEqual([...x.C.groupsFrom('pierna')],['quads','hamstrings','glutes','calves']);
 assert.deepEqual([...x.C.groupsFrom('Bíceps, tríceps y hombros')],['biceps','triceps','shoulders']);
 assert.deepEqual([...x.C.groupsFrom('nada que ver')],[]);});

test('«Ivi, hoy entrené pecho y espalda» creates ONE partial session; repeating does not duplicate',()=>{const x=env();
 const say=x.V.intent('Ivi, hoy entrené pecho y espalda');assert.match(say,/Anotado: Pecho y Espalda hoy/);
 assert.equal(x.state.gymSessions.length,1);const s=x.state.gymSessions[0];assert.equal(s.date,'2026-10-15');assert.equal(s.completeness,'partial');
 assert.deepEqual([...s.exercises.map(e=>e.primary_muscles[0])],['chest','back']);assert.equal(s.exercises[0].sets.length,0,'no invented sets');
 assert.equal(typeof x.toasts[0].u,'function','undo offered');
 assert.match(x.V.intent('hoy entrené pecho y espalda'),/Ya lo había registrado|Ya tenías/);assert.equal(x.state.gymSessions.length,1);});

test('later «también hice hombros» merges into the same voice session; already-covered groups are skipped',()=>{const x=env();
 x.V.intent('hoy entrené pecho');const r=x.V.logWorkout({groups:['chest','shoulders']});assert.equal(r.status,'updated');
 assert.equal(x.state.gymSessions.length,1);assert.deepEqual([...x.state.gymSessions[0].exercises.map(e=>e.primary_muscles[0])],['chest','shoulders']);assert.match(r.say,/Pecho ya estaba/);
 r.undo();assert.deepEqual([...x.state.gymSessions[0].exercises.map(e=>e.primary_muscles[0])],['chest']);});

test('a detailed session for the day already covering the groups → no new record; op_id retry is idempotent',()=>{
 const x=env([sess('full','2026-10-15',['chest','back'])]);assert.equal(x.V.logWorkout({groups:['chest','back']}).status,'duplicate');assert.equal(x.state.gymSessions.length,1);
 const a=x.V.logWorkout({groups:['quads'],op_id:'call_1'}),b=x.V.logWorkout({groups:['calves'],op_id:'call_1'});assert.equal(a.status,'created');assert.equal(b.status,'duplicate');
 assert.equal(x.state.gymSessions.filter(s=>!s.deleted_at).length,2,'never edits the detailed session');});

test('«ayer entrené pierna» uses yesterday; undo removes it; future dates rejected; no muscles → question',()=>{const x=env();
 x.V.intent('ayer entrené pierna');assert.equal(x.state.gymSessions[0].date,'2026-10-14');x.toasts[0].u();assert.ok(x.state.gymSessions[0].deleted_at);
 assert.equal(x.V.logWorkout({groups:['chest'],date:'2026-10-20'}).status,'error');assert.equal(x.V.logWorkout({groups:[]}).status,'needs');
 assert.equal(x.V.intent('hoy fui al cine'),null,'not a workout phrase → other intents');});

test('summary: last date, secondary = partial, readiness band and override wins',()=>{
 const x=env([sess('a','2026-10-15',['chest'],['triceps']),sess('b','2026-10-12',['back']),sess('c','2026-10-01',['quads'])]);
 const s=x.C.summary(x.state.gymSessions,'2026-10-15');
 assert.equal(s.chest.band,'fresh');assert.equal(s.chest.days_since,0);assert.equal(s.triceps.partial,true);assert.equal(s.triceps.band,'mid');
 assert.equal(s.back.band,'ready');assert.equal(s.quads.band,'idle');assert.equal(s.calves.last_date,null);
 x.state.gymSessions[0].muscle_override=['shoulders'];const o=x.C.summary(x.state.gymSessions,'2026-10-15');assert.equal(o.chest.last_date,null);assert.equal(o.shoulders.band,'fresh');});

test('original SVG body: one accessible region per group, unique pattern ids per view, text label per band',()=>{const x=env();
 const sum=x.C.summary([sess('a','2026-10-15',['chest'])],'2026-10-15');const f=x.B.view('front',{summary:sum}),b=x.B.view('back',{summary:sum});
 for(const k of ['chest','core','quads','biceps'])assert.match(f,new RegExp(`data-m="${k}"`));for(const k of ['back','glutes','hamstrings','triceps'])assert.match(b,new RegExp(`data-m="${k}"`));
 assert.match(f,/data-m="chest" data-band="fresh"/);assert.match(f,/url\(#fb-hatch-fresh-front\)/);assert.match(b,/id="fb-hatch-fresh-back"/);
 assert.match(f,/aria-label="Pecho: Recién trabajado · último hoy"/);assert.doesNotMatch(f+b,/<image|href="http/,'no embedded raster/reference art');});

test('presentation preference only changes the silhouette and defaults to neutral',()=>{const x=env();
 const n=x.B.view('front',{}),m=x.B.view('front',{presentation:'masc'}),fm=x.B.view('front',{presentation:'fem'});assert.notEqual(n,m);assert.notEqual(n,fm);
 assert.equal((n.match(/class="fb-m"/g)||[]).length,(m.match(/class="fb-m"/g)||[]).length);});

test('legacy «gimnasio» preferences migrate to «fisico» without losing order',()=>{const x=env();
 x.state.preferences={hiddenSections:['gimnasio'],sectionOrder:['inicio','gimnasio','agenda'],mobileShortcuts:['inicio','gimnasio','a','b','c']};x.V.migratePrefs();
 assert.deepEqual([...x.state.preferences.sectionOrder],['inicio','fisico','agenda']);assert.deepEqual([...x.state.preferences.hiddenSections],['fisico']);assert.equal(x.state.preferences.mobileShortcuts[1],'fisico');});
