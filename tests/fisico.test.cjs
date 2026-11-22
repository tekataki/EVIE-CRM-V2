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

// v10 · recovery map: red <24 h, yellow 24–48 h, green ≥48 h, idle >7 days (by hours, from trained_at or date+usual hour).
const H=3600000,NOW=Date.parse('2026-10-15T20:00:00Z');
const day=(id,at,prim,sec=[])=>({...sess(id,new Date(at).toISOString().slice(0,10),prim,sec),trained_at:new Date(at).toISOString()});
test('recovery(): hours since training → red / yellow / green / idle; secondary work is one level lighter',()=>{const x=env();
 const r=x.C.recovery([day('a',NOW-3*H,['chest'],['triceps']),day('b',NOW-30*H,['back']),day('c',NOW-60*H,['quads']),day('d',NOW-8*24*H,['calves'])],NOW);
 assert.equal(r.chest.state,'red');assert.equal(r.triceps.state,'yellow');assert.equal(r.triceps.partial,true);assert.equal(r.back.state,'yellow');
 assert.equal(r.quads.state,'green');assert.equal(r.calves.state,'idle');assert.equal(r.glutes.state,'idle');assert.equal(r.glutes.last_at,null);
 assert.equal(Math.round(r.back.hours),30);assert.equal(r.chest.sessions_7d,1);
 const c=x.C.recoveryCounts(r);assert.equal(c.red,1);assert.equal(c.yellow,2);assert.equal(c.green,1);assert.equal(c.red+c.yellow+c.green+c.idle,12);
 assert.match(x.C.recoveryText(r.quads,NOW),/^Último entrenamiento: .+ \(hace 2 días\) · listo para entrenar$/);
 assert.match(x.C.recoveryText(r.chest,NOW),/hace 3 h\) · recién entrenado/);assert.equal(x.C.recoveryText(r.glutes,NOW),'Sin entrenamientos registrados');
 const future=x.C.recovery([day('f',NOW+5*H,['chest'])],NOW);assert.equal(future.chest.state,'idle','future records are ignored');});

test('records without trained_at use their date at the usual training hour (preference)',()=>{const x=env();
 const s=sess('old','2026-10-14',['back']);assert.equal(x.C.trainedAt(s,{hour:10}),new Date(2026,9,14,10).getTime());
 assert.equal(new Date(x.C.trainedAt(s,{hour:18})).getHours(),18);
 assert.equal(x.C.recState(23.9),'red');assert.equal(x.C.recState(24),'yellow');assert.equal(x.C.recState(47.9),'yellow');assert.equal(x.C.recState(48),'green');assert.equal(x.C.recState(24*7),'idle');});

test('voice dates: «el lunes», «ayer pierna» (no verb), «hace 3 días», «upper en la mañana»; future/unrelated → null',()=>{const x=env();// 2026-10-15 is a Thursday
 const p=t=>{const r=x.V.parse(t);return r&&{g:[...r.groups],date:r.date,hint:r.hint};};
 assert.deepEqual(p('Ivi, el lunes entrené pecho y espalda'),{g:['chest','back'],date:'2026-10-12',hint:null});
 assert.deepEqual(p('ayer pierna'),{g:['quads','hamstrings','glutes','calves'],date:'2026-10-14',hint:null});
 assert.deepEqual(p('antier brazo'),{g:['biceps','triceps','forearms'],date:'2026-10-13',hint:null});
 assert.equal(p('hace 3 días hice push').date,'2026-10-12');assert.deepEqual(p('hace 3 días hice push').g,['chest','shoulders','triceps']);
 const up=p('hoy entrené upper en la mañana');assert.equal(up.date,'2026-10-15');assert.equal(up.hint,'morning');assert.deepEqual(up.g,['chest','back','shoulders','biceps','triceps']);
 assert.equal(p('el jueves entrené pull').date,'2026-10-08','same weekday = last week');assert.equal(p('anoche entrené pierna').hint,'night');
 for(const no of ['mañana entreno pierna','hoy fui al cine','ayer me sentí mal del pecho','hoy gasté 200 en el gym','el lunes'])assert.equal(p(no),null,no);});

test('logged days store trained_at (never in the future) and the hour hint',()=>{const x=env();
 x.V.intent('el lunes entrené pecho');const s=x.state.gymSessions[0];assert.equal(s.date,'2026-10-12');assert.ok(Date.parse(s.trained_at)<=Date.now());assert.equal(new Date(s.trained_at).getHours(),10);
 x.state.preferences.fisicoTrainHour=7;x.V.intent('ayer entrené espalda en la tarde');const t=x.state.gymSessions.find(r=>r.date==='2026-10-14');assert.equal(new Date(t.trained_at).getHours(),17);
 x.V.intent('antier entrené pierna');const u=x.state.gymSessions.find(r=>r.date==='2026-10-13');assert.equal(new Date(u.trained_at).getHours(),7,'usual hour preference');});

test('recovery body map: data-rec per muscle + state in words; recSel marks the tapped muscle',()=>{const x=env();
 const r=x.C.recovery([day('a',NOW-3*H,['chest']),day('b',NOW-60*H,['back'])],NOW);const f=x.B.view('front',{measure:{},recovery:r,recSel:'chest'}),b=x.B.view('back',{measure:{},recovery:r});
 assert.match(f,/data-m="chest" data-band="idle" data-rec="red"[^>]*data-selected="1"/);assert.match(b,/data-m="back" data-band="idle" data-rec="green"/);assert.match(b,/data-m="glutes" data-band="idle" data-rec="idle"/);
 assert.match(f,/aria-label="Pecho: Menos de 24 h\. Último entrenamiento: /);assert.equal((f.match(/class="fb-m"/g)||[]).length,8);});
