'use strict';
// v5 · Preparar mi día (propuesta, eventos fijos, estimaciones, aprobación explícita, idempotencia, ¿qué sigue?)
// y Rutas por voz (sección vs. tarjeta vs. ruta, geocodificación acotada, desambiguación, tráfico honesto, privacidad).
const {test}=require('node:test');const assert=require('node:assert/strict');const {fixture}=require('./v5-fixture.cjs');
test('planner core: batch parsing, time parsing, past/overflow/priority, ¿qué sigue?',async()=>{const p=await import('../src/planner.js');
 assert.deepEqual(p.parseBatch('Prepara mi día: llamar a Intensity 30 min, gym a las 6 de la tarde, revisar facturas urgente y luego terminar propuesta hora y media').map(x=>[x.title,x.start_min,x.duration_min,x.estimated,x.priority].join('|')),
  ['Llamar a Intensity||30|false|normal','Gym|1080|30|true|normal','Revisar facturas||30|true|urgent','Terminar propuesta||90|false|normal']);
 assert.equal(p.parseTime('junta 17:30'),1050);assert.equal(p.parseTime('cita a las 9'),540);assert.equal(p.parseTime('revisar 30 facturas'),null);
 const r=p.schedule({movable:[{item_id:'a',title:'Tarde',start_min:480,duration_min:30},{item_id:'b',title:'Larga',duration_min:700,priority:'low'},{item_id:'c',title:'Urgente',duration_min:30,priority:'urgent'}],nowMin:720});
 assert.ok(r.warnings.some(w=>w.code==='past'));assert.ok(r.unscheduled.some(u=>u.title==='Larga'));assert.equal(r.slots[0].title,'Urgente');assert.ok(r.slots[0].start>='12:05');
 const nx=p.nextOf([{title:'A',start:'09:00',end:'10:00'},{title:'B',start:'11:00',end:'12:00'}],570);assert.equal(nx.current.title,'A');assert.equal(nx.next.title,'B');});
test('plan propose: dictation + open tasks + Pendientes, fixed events kept, hours respected, estimates labeled, nothing written',async t=>{const f=await fixture(t);
 await f.call('a','/tasks','POST',{title:'Cotizar a Intensity',due_date:'2026-01-01',priority:'high',client_id:'c1'});
 const r=await f.call('a','/plan/propose','POST',{day:'tomorrow',timezone:'America/Mexico_City',text:'Prepara mañana: llamar al banco 20 min, gym a las 6 de la tarde, terminar propuesta hora y media',fixed:[{title:'Junta SOMA',start:'10:00',end:'11:00'},{title:'Dentista',start:'18:00',end:'19:00'}],pendientes:[{key:'bill:b1',title:'Pagar internet',severity:'yellow',kind:'Pago'},{key:'task:x',title:'Cotizar a Intensity',severity:'red'}],hours:{start:'09:00',end:'19:00'}});
 assert.equal(r.status,200);assert.equal(r.json.needs_approval,true);assert.equal(r.json.google_calendar,'no_write');
 const titles=r.json.slots.map(s=>s.title);for(const x of ['Junta SOMA','Dentista','Llamar al banco','Gym','Terminar propuesta','Cotizar a Intensity','Pagar internet'])assert.ok(titles.includes(x),x);
 assert.equal(titles.filter(x=>x==='Cotizar a Intensity').length,1,'no double counting task vs Pendiente');
 assert.equal(r.json.slots.find(s=>s.title==='Junta SOMA').fixed,true);
 for(const s of r.json.slots.filter(s=>!s.fixed&&!s.conflict)){assert.ok(!(s.start<'11:00'&&s.end>'10:00'),s.title);assert.ok(s.start>='09:00'&&s.end<='19:00',s.title);}
 assert.ok(r.json.warnings.some(w=>w.code==='conflict'&&/Gym/.test(w.message)));assert.ok(r.json.warnings.some(w=>w.code==='estimates'));
 assert.equal(r.json.slots.find(s=>s.title==='Llamar al banco').estimated,false);assert.equal(r.json.slots.find(s=>s.title==='Pagar internet').estimated,true);
 assert.equal((await f.call('a','/tasks')).json.tasks.length,1,'nothing written before approval');
 assert.ok(!/banco|propuesta/i.test(JSON.stringify(f.db.prepare('SELECT * FROM evie_plans').all())),'proposal sealed');});
test('plan apply: explicit approval; per-item results; idempotent; owner-only; ¿qué sigue?',async t=>{const f=await fixture(t);
 const p=(await f.call('a','/plan/propose','POST',{day:'tomorrow',text:'llamar al banco 20 min, revisar facturas'})).json;
 assert.equal((await f.call('a','/plan/'+p.plan_id+'/apply','POST',{})).json.code,'not_approved');
 const keep=p.slots.filter(s=>s.title==='Llamar al banco').map(s=>s.item_id);
 let r=await f.call('a','/plan/'+p.plan_id+'/apply','POST',{approved:true,items:keep,edits:{[keep[0]]:{start:'09:30'}}});
 assert.equal(r.json.applied,1);assert.ok(r.json.results.some(x=>x.status==='skipped'));assert.match(r.json.say,/No toqué Google Calendar/);
 await f.call('a','/plan/'+p.plan_id+'/apply','POST',{approved:true,items:keep});
 const ts=(await f.call('a','/tasks')).json.tasks;assert.equal(ts.length,1,'idempotent');assert.equal(ts[0].due_date,p.day);assert.equal(ts[0].due_time,'09:30');assert.equal(ts[0].source,'plan');
 assert.equal((await f.call('b','/plan/'+p.plan_id+'/apply','POST',{approved:true})).status,404);
 const n=await f.call('a','/plan/next?tz=America/Mexico_City');assert.equal(n.status,200);assert.equal(typeof n.json.say,'string');});
test('route parser: section vs card vs route; origin/destination/mode',async()=>{const m=await import('../src/map-query.js');
 assert.equal(m.parseRouteQuery('Ivi, abre el mapa').intent,'open_section');assert.equal(m.parseRouteQuery('abre la tarjeta del mapa').intent,'show_card');assert.equal(m.parseRouteQuery('abre finanzas').intent,null);
 const q=m.parseRouteQuery('¿cuánto me tardo de Bijiá 58 al Tecnológico en carro?');assert.deepEqual([q.intent,q.origin,q.destination,q.mode],['route','bijia 58','tecnologico','auto']);
 const w=m.parseRouteQuery('¿cómo llego al centro caminando?');assert.equal(w.origin,'here');assert.equal(w.mode,'pedestrian');
 assert.equal(m.parseRouteQuery('qué tan lejos está la Plaza Zapotlán').destination,'plaza zapotlan');});
const feat=(name,lat,lon,confidence=0.95)=>({properties:{gid:'g:'+name,name,label:name+', Ciudad Guzmán',confidence},geometry:{coordinates:[lon,lat]}});
test('route query: both ends geocoded inside the area, real route, honest traffic note, key server-side, address never stored or logged',async t=>{
 const logs=[];const ol=console.log,oe=console.error;console.log=(...a)=>logs.push(a.join(' '));console.error=(...a)=>logs.push(a.join(' '));t.after(()=>{console.log=ol;console.error=oe});
 const f=await fixture(t,{env:{STADIA_API_KEY:'sk-secret'},stadia:(url)=>url.includes('/geocoding/')?Response.json({features:/bijia/i.test(decodeURIComponent(url))?[feat('Bijiá 58',19.70,-103.47)]:[feat('Instituto Tecnológico',19.72,-103.45)]}):Response.json({trip:{status:0,summary:{length:3.4,time:540},legs:[]}})});
 const r=await f.call('a','/map/route-query','POST',{text:'¿cuánto me tardo de Bijiá 58 al Tecnológico en carro?'});
 assert.equal(r.json.status,'ok',r.text);assert.equal(r.json.distance_km,3.4);assert.equal(r.json.duration_min,9);assert.match(r.json.say,/9 minutos/);assert.match(r.json.say,/sin considerar el tráfico/);
 assert.equal(r.json.traffic_note,'El tiempo no incluye tráfico en tiempo real.');
 assert.ok(f.sent.stadia.every(x=>x.options.headers.Authorization==='Stadia-Auth sk-secret'&&!x.url.includes('sk-secret')));
 assert.ok(!/bijia|tecnol/i.test(JSON.stringify(['ai_usage','evie_metrics','evie_memories','evie_ops'].map(tb=>f.db.prepare('SELECT * FROM '+tb).all()))));
 assert.ok(!logs.some(l=>/bijia|tecnol/i.test(l)));});
test('route query: ambiguity, location permission, outside area, section intent, not configured',async t=>{
 const f=await fixture(t,{env:{STADIA_API_KEY:'sk'},stadia:(url)=>url.includes('/geocoding/')?Response.json({features:[feat('Oxxo Centro',19.70,-103.46,0.8),feat('Oxxo Norte',19.71,-103.46,0.78)]}):Response.json({trip:{status:0,summary:{length:1,time:120}}})});
 assert.equal((await f.call('a','/map/route-query','POST',{text:'¿cómo llego al oxxo desde el jardín?'})).json.status,'ambiguous');
 assert.equal((await f.call('a','/map/route-query','POST',{text:'¿cómo llego al oxxo caminando?'})).json.status,'needs_location');
 let r=await f.call('a','/map/route-query','POST',{text:'¿cómo llego al oxxo caminando?',here:{lat:19.70,lon:-103.46},choice:{destination:{lat:19.71,lon:-103.46}}});assert.equal(r.json.status,'ok');assert.equal(r.json.traffic_note,null);
 r=await f.call('a','/map/route-query','POST',{text:'¿cómo llego a Guadalajara?',here:{lat:19.70,lon:-103.46},choice:{destination:{lat:20.67,lon:-103.35}}});assert.equal(r.json.code,'outside_area');
 assert.equal((await f.call('a','/map/route-query','POST',{text:'abre el mapa'})).json.intent,'open_section');
 const g=await fixture(t);assert.equal((await g.call('a','/map/route-query','POST',{text:'¿cómo llego al centro desde la plaza?'})).json.code,'not_configured');});
