'use strict';
// EVIE Mapa core: route parsing, geofencing, GPS quality, progress, deviation with hysteresis + rate limits,
// announcements, arrival and destination disambiguation. Synthetic Valhalla response built with our own encoder
// over central Ciudad Guzmán (no provider call).
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function loadCore(){const ctx={window:{}};ctx.window.window=ctx.window;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-map-core.js'),'utf8'),ctx);return ctx.window.EvieMapCore;}
const C=loadCore();
const A={lat:19.7000,lon:-103.4650},B={lat:19.7054,lon:-103.4650},D={lat:19.7054,lon:-103.4612};
const line=(p,q,n)=>Array.from({length:n+1},(_, i)=>({lat:p.lat+(q.lat-p.lat)*i/n,lon:p.lon+(q.lon-p.lon)*i/n}));
const pts=[...line(A,B,12),...line(B,D,8).slice(1)];
function valhalla({status=0,shape=C.encode(pts,6),length=(C.dist(A,B)+C.dist(B,D))/1000,time=180}={}){return {trip:{status,status_message:status?'No route found':'Found route',units:'kilometers',summary:{length,time},legs:[{shape,maneuvers:[
 {type:1,instruction:'Dirígete al norte por Avenida Cristóbal Colón.',verbal_pre_transition_instruction:'Dirígete al norte por Avenida Cristóbal Colón.',street_names:['Avenida Cristóbal Colón'],length:0.6,time:110,begin_shape_index:0},
 {type:10,instruction:'Gira a la derecha en Calle Federico del Toro.',verbal_pre_transition_instruction:'Gira a la derecha en Calle Federico del Toro.',street_names:['Calle Federico del Toro'],length:0.4,time:70,begin_shape_index:12},
 {type:4,instruction:'Llegaste a tu destino.',verbal_pre_transition_instruction:'Llegaste a tu destino.',street_names:[],length:0,time:0,begin_shape_index:pts.length-1}]}]}};}
const fix=(p,{acc=8,t=Date.now(),speed=10}={})=>({lat:p.lat,lon:p.lon,accuracy:acc,timestamp:t,speed});

test('geofence: Ciudad Guzmán centre and outskirts inside; Guadalajara / Colima outside',()=>{
 assert.ok(C.inArea({lat:19.7045,lon:-103.4600}),'Jardín Principal');assert.ok(C.inArea({lat:19.7238,lon:-103.4612}),'north (ITCG area)');
 assert.ok(!C.inArea({lat:20.6767,lon:-103.3475}),'Guadalajara');assert.ok(!C.inArea({lat:19.2433,lon:-103.7250}),'Colima');assert.ok(!C.inArea({lat:NaN,lon:1}));});

test('polyline6 round-trips; parseValhalla keeps provider distance/time and ordered maneuvers',()=>{
 const back=C.decode(C.encode(pts,6),6);assert.equal(back.length,pts.length);assert.ok(C.dist(back[5],pts[5])<0.2);
 const r=C.parseValhalla(valhalla());assert.equal(r.maneuvers.map(m=>m.type).join(','),'1,10,4');
 assert.ok(r.maneuvers[1].along>590&&r.maneuvers[1].along<610,'turn at ~600 m along');assert.equal(r.timeS,180);assert.ok(Math.abs(r.lengthM-1000)<25);
 assert.match(r.etaLabel,/sin tráfico en vivo/);assert.match(C.parseValhalla(valhalla(),{traffic:true}).etaLabel,/con tráfico del proveedor/);});

test('parseValhalla rejects malformed or failed provider output instead of inventing a route',()=>{
 assert.throws(()=>C.parseValhalla({}),/no devolvió una ruta/);assert.throws(()=>C.parseValhalla(valhalla({status:442})),/No route found/);
 assert.throws(()=>C.parseValhalla(valhalla({shape:'_p~iF'})),/truncada|sin geometría/);assert.throws(()=>C.parseValhalla(valhalla({length:0})),/Resumen de ruta inválido/);});

test('GPS quality: stale, inaccurate or missing fixes never produce a turn instruction',()=>{
 const s=C.newSession(C.parseValhalla(valhalla())),now=Date.now();
 let e=C.update(s,fix(A,{t:now-60000}),now);assert.equal(e.kind,'gps');assert.equal(e.quality,'stale');assert.match(e.say,/desactualizada/);assert.ok(!('announce' in e));
 e=C.update(s,fix(A,{acc:180}),now);assert.equal(e.quality,'weak');assert.match(e.say,/±180 m/);
 assert.equal(C.update(s,null,now).quality,'none');});

test('simulated drive: progress, announcements once per threshold, remaining time from provider, arrival',()=>{
 const s=C.newSession(C.parseValhalla(valhalla()));const said=[];let last,t=Date.now();
 for(const p of pts){t+=6000;last=C.update(s,fix(p,{t}),t);if(last.announce)said.push(last.announce.text);if(last.kind==='arrived')break;}
 assert.equal(last.kind,'arrived');
 const turn=said.filter(x=>/derecha/.test(x));assert.ok(turn.length>=2&&turn.length<=3,'2–3 prompts for the turn: '+turn.join(' | '));
 assert.match(turn[0],/^En \d+ metros, gira a la derecha/);assert.equal(new Set(said).size,said.length,'no duplicate prompt');
 const s2=C.newSession(C.parseValhalla(valhalla()));const mid=C.update(s2,fix(pts[6]),Date.now());assert.equal(mid.kind,'progress');assert.ok(mid.remainingS<180&&mid.remainingS>100,'remaining time scales the provider time');
 assert.match(C.summary(s2),/^Faltan .+ unos \d+ min\. Tiempo estimado \(sin tráfico en vivo\)\.$/);});

test('deviation: jitter tolerated; a real detour triggers reroute after 3 fixes; 20 s debounce; max 6 per 10 min',()=>{
 const s=C.newSession(C.parseValhalla(valhalla()));let t=Date.now();
 assert.equal(C.update(s,fix({lat:pts[4].lat,lon:pts[4].lon+0.00025},{t,acc:20}),t).kind,'progress','~26 m jitter within tolerance');
 const off={lat:pts[5].lat,lon:pts[5].lon-0.0012};let e;
 for(let i=0;i<2;i++){t+=3000;e=C.update(s,fix(off,{t}),t);assert.equal(e.kind,'drifting');}
 t+=3000;e=C.update(s,fix(off,{t}),t);assert.equal(e.kind,'off_route');assert.equal(e.reroute,true);
 C.markReroute(s,C.parseValhalla(valhalla()),t);
 for(let i=0;i<3;i++){t+=2000;e=C.update(s,fix(off,{t}),t);}assert.equal(e.reroute,false,'debounced');assert.ok(e.wait>0);
 for(let i=0;i<5;i++){t+=21000;C.markReroute(s,C.parseValhalla(valhalla()),t);}
 t+=21000;for(let i=0;i<3;i++)e=C.update(s,fix(off,{t}),t);assert.equal(e.reroute,false);assert.equal(C.canReroute(s,t).reason,'limit');});

test('destination disambiguation: ambiguous ⇒ choices; outside ⇒ explained; unique ⇒ chosen',()=>{
 const tec=[{name:'Instituto Tecnológico de Ciudad Guzmán',lat:19.7238,lon:-103.4612,confidence:0.8},{name:'Tecnológico Nacional — Unidad Académica',lat:19.7010,lon:-103.4700,confidence:0.78},{name:'Tecnológico de Monterrey Guadalajara',lat:20.7341,lon:-103.4554,confidence:0.9}];
 let r=C.resolveCandidates('el tecnológico',tec);assert.equal(r.status,'ambiguous');assert.equal(r.candidates.length,2,'Guadalajara filtered by the geofence');
 r=C.resolveCandidates('Catedral de Guadalajara',[{name:'Catedral de Guadalajara',lat:20.6767,lon:-103.3475,confidence:0.95}]);assert.equal(r.status,'outside_area');assert.equal(r.outside.length,1);
 r=C.resolveCandidates('jardín principal',[{name:'Jardín Principal Ciudad Guzmán',lat:19.7045,lon:-103.46,confidence:0.95},{name:'Jardín de niños',lat:19.70,lon:-103.47,confidence:0.4}]);assert.equal(r.status,'unique');assert.match(r.choice.name,/Jardín Principal/);
 assert.equal(C.resolveCandidates('xyz',[]).status,'not_found');});
