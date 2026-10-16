'use strict';
// Timers v4: Spanish durations, named timers, pause/resume/cancel/undo, persistence by timestamps (reload-safe),
// ambiguity, alarm on finish, late finish while away, limits.
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function env(storage={}){
 const ctx={console,Math,JSON,Intl};ctx.window=ctx;vm.createContext(ctx);let now=Date.parse('2026-10-15T18:00:00Z');ctx.Date=class extends Date{static now(){return now;}};
 ctx.localStorage={getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=String(v);}};ctx.DALI_CONFIG={storageKey:()=>'qa'};
 const sounds=[],toasts=[],cards=[];ctx.EvieSounds={play:n=>sounds.push(n)};ctx.App={toast:(t,k,u)=>toasts.push({t,u})};ctx.EvieHUD={open:c=>cards.push(c)};
 ctx.document={readyState:'complete',visibilityState:'visible',addEventListener(){},querySelectorAll:()=>[],getElementById:()=>null};ctx.addEventListener=()=>{};ctx.CustomEvent=class{};ctx.dispatchEvent=()=>{};
 const timers=[];ctx.setInterval=f=>{timers.push(f);return timers.length;};ctx.clearInterval=()=>{};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-timers.js'),'utf8'),ctx);const T=ctx.EvieTimers;T._clock(()=>now);
 return {T,storage,sounds,toasts,cards,adv:ms=>{now+=ms;},tickAll:()=>timers.forEach(f=>f())};}
test('Spanish durations',()=>{const {T}=env();
 assert.equal(T.parseDuration('pon un temporizador de 10 minutos'),600);assert.equal(T.parseDuration('media hora'),1800);assert.equal(T.parseDuration('una hora y media'),5400);
 assert.equal(T.parseDuration('1 hora 20 minutos'),4800);assert.equal(T.parseDuration('cinco minutos y media'),330);assert.equal(T.parseDuration('90 segundos'),90);
 assert.equal(T.parseDuration('2.5 minutos'),150);assert.equal(T.parseDuration('2,5 minutos'),150);assert.equal(T.parseDuration('un cuarto de hora'),900);assert.equal(T.parseDuration('hola'),null);});
test('«Ivi, pon un temporizador de 10 minutos para la pasta» → named timer + card',()=>{const x=env();
 assert.match(x.T.intent('Ivi, pon un temporizador de 10 minutos para la pasta'),/temporizador «pasta» en marcha/);
 assert.equal(x.T.active().length,1);assert.equal(x.T.active()[0].label,'pasta');assert.equal(x.T.active()[0].remaining_ms,600000);assert.deepEqual([...x.cards],['timer']);});
test('multiple named timers; pause / resume / status / cancel by name, duration or single',()=>{const x=env();
 x.T.intent('pon un temporizador de 10 minutos para la pasta');x.T.intent('pon un temporizador de 3 minutos para el té');
 assert.match(x.T.intent('pausa el temporizador'),/¿Cuál\?/);
 assert.match(x.T.intent('pausa el temporizador de la pasta'),/Pausé el temporizador «pasta»/);x.adv(60000);
 assert.equal(x.T.active().find(t=>t.label==='pasta').remaining_ms,600000,'paused does not run');
 assert.match(x.T.intent('reanuda el temporizador'),/Reanudé «pasta»/,'only one paused → resolved');
 x.adv(120000);assert.match(x.T.intent('cuánto le queda al temporizador de la pasta'),/8 minutos/);
 assert.match(x.T.intent('cancela el temporizador de 3 minutos'),/Cancelé el temporizador «te»/);assert.equal(x.T.active().length,1);
 x.toasts.at(-1).u();assert.equal(x.T.active().length,2,'undo restores');});
test('persistence: reload rebuilds remaining time from timestamps',()=>{const x=env();x.T.start({seconds:300,label:'horno'});
 const y=env(x.storage);y.adv(100000);assert.ok(Math.abs(y.T.active()[0].remaining_ms-200000)<1000);});
test('finishing rings a gentle alarm and marks done; late finish is reported, not rung',()=>{const x=env();x.T.start({seconds:60,label:'café'});x.adv(61000);x.tickAll();
 assert.equal(x.T.list()[0].state,'done');assert.ok(x.sounds.includes('alarm'));assert.match(x.toasts.at(-1).t,/Terminó el temporizador «café»/);
 const y=env();y.T.start({seconds:60});const z=env(y.storage);z.adv(10*60000);z.T.reload();assert.match(z.toasts.at(-1).t,/terminó mientras no estabas/);assert.ok(!z.sounds.includes('alarm'));});
test('limits and errors: no duration, duplicate label, >24 h, cancel all with undo',()=>{const x=env();
 assert.equal(x.T.intent('pon un temporizador'),'¿De cuánto tiempo? Por ejemplo: 10 minutos.');assert.equal(x.T.start({seconds:90000}).ok,false);
 x.T.start({seconds:60,label:'pan'});assert.match(x.T.start({seconds:60,label:'Pan'}).error,/Ya hay un temporizador «Pan»/);
 x.T.start({seconds:120});assert.match(x.T.intent('cancela todos los temporizadores'),/Cancelé 2/);assert.equal(x.T.active().length,0);x.toasts.at(-1).u();assert.equal(x.T.active().length,2);
 assert.equal(x.T.intent('qué hora es'),null,'unrelated phrase → other intents');});
