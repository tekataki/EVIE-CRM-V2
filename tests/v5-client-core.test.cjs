'use strict';
// v5 client core: intents (section vs card, tier vs work mode, scenes, routes, plan, tasks, memory), long dictation
// (chunk plan, seam de-dup, ordering, gaps, >1 min Spanish), wake single-turn guard, lifecycle + thinking cue.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(){const s={crypto:globalThis.crypto};s.window=s;vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-v5-core.js'),'utf8'),s);return s.EvieV5Core;}
const C=load(),J=x=>JSON.stringify(x);
test('section vs card vs close card',()=>{
 assert.equal(J(C.surface('Abre Finanzas')),J({kind:'section',section:'finanzas'}));
 assert.equal(J(C.surface('Ivi, abre una tarjeta de Finanzas')),J({kind:'card',card:'finanzas'}));
 assert.equal(J(C.surface('cierra esta tarjeta')),J({kind:'close_card',card:null}));
 assert.equal(C.surface('abre la página de SOMA'),null);assert.equal(C.intent('abre el mapa').section,'mapa');});
test('intent router: route, plan, next, tier (not work mode), tasks, memory, scene candidate',()=>{
 assert.equal(C.intent('¿cuánto me tardo de Bijiá 58 al Tecnológico en carro?').type,'route');
 assert.equal(C.intent('Prepara mi día: llamar al banco').type,'plan');assert.equal(C.intent('prepara mañana').day,'tomorrow');assert.equal(C.intent('reorganiza mi día').type,'plan');
 assert.equal(C.intent('¿qué sigue?').type,'plan_next');
 assert.equal(C.intent('usa nivel profundo').type,'tier');assert.equal(C.intent('usa Profundo solo para esta pregunta: x').type,'tier');assert.notEqual(C.intent('activa modo enfoque').type,'tier');
 assert.equal(J(C.intent('Ivi, agrega tarea para Intensity: enviar cotización')),J({type:'task_create',client:'Intensity',title:'enviar cotización'}));
 assert.equal(C.intent('completa la tarea de enviar cotización').type,'task_complete');assert.equal(C.intent('qué tareas tengo de Intensity').client,'intensity');
 assert.equal(C.intent('Ivi, corrige: mi junta es el martes').text,'mi junta es el martes');
 assert.equal(C.intent('¿te acuerdas de lo que hablamos ayer sobre SOMA?').type,'memory_search');assert.equal(C.intent('Ivi, modo SOMA').type,'scene_candidate');});
test('dictation: chunk plan with overlap, bounded',()=>{assert.equal(J(C.chunkPlan(100).map(x=>[x.start,x.end])),'[[0,45],[42,87],[84,100]]');assert.equal(C.chunkPlan(0).length,0);assert.ok(C.chunkPlan(5000).length<=C.DICT.maxChunks);});
test('dictation: >1 min Spanish assembled in order, overlap removed, duplicates ignored, gaps reported',()=>{
 const full='Hoy quiero preparar la propuesta para Intensity con tres paquetes de precios distintos y después llamar al banco para revisar la tarjeta de crédito y por último mandar la cotización a Alvento antes de las seis de la tarde porque mañana salgo temprano a Guadalajara con mi mamá';
 const w=full.split(' '),c0=w.slice(0,20).join(' '),c1=w.slice(16,36).join(' '),c2=w.slice(32).join(' ');
 const r=C.assemble([{index:2,text:c2},{index:0,text:c0},{index:1,text:c1},{index:1,text:'duplicado'}]);assert.equal(r.text,full);assert.equal(r.complete,true);assert.equal(r.count,3);
 const g=C.assemble([{index:0,text:c0},{index:2,text:c2}]);assert.equal(J(g.missing),'[1]');assert.equal(g.complete,false);
 assert.equal(C.joinPair('uno dos tres cuatro','Tres cuatro cinco'),'uno dos tres cuatro cinco');
 assert.equal(C.highImpact('borra el pendiente del banco'),true);assert.equal(C.highImpact('qué hora es'),false);assert.equal(C.highImpact(full),true);});
test('wake: single turn, no self-trigger while speaking or right after; variants',()=>{
 assert.equal(C.wakeGate({phase:'speaking'}).allow,false);assert.equal(C.wakeGate({phase:'idle',speakingEndedAt:Date.now()-300}).why,'echo_guard');
 assert.equal(C.wakeGate({phase:'idle',turnOpen:true}).why,'turn_open');assert.equal(C.wakeGate({phase:'idle',speakingEndedAt:0}).allow,true);
 for(const v of ['ivi','ivy','liby'])assert.ok(C.WAKE_VARIANTS.includes(v));});
test('lifecycle: request id, ordered stages, no private content, single terminal; cue bounded and mutable',()=>{const seen=[];const l=C.lifecycle(e=>seen.push(e));
 l.emit('transcribing');l.emit('thinking',{tier:'enfoque',text:'mi secreto'});l.emit('tool_running',{tool:'get_agenda'});l.emit('completed');assert.equal(l.emit('speaking'),false);
 assert.equal(J(seen.map(e=>e.stage)),J(['request_started','transcribing','thinking','tool_running','completed']));assert.ok(seen.every(e=>e.request_id===l.id));assert.ok(!J(seen).includes('secreto'));
 assert.equal(C.lifecycle().emit('bogus'),false);
 assert.equal(C.cuePlan({stage:'thinking',elapsedMs:1000}).play,true);assert.equal(C.cuePlan({stage:'thinking',elapsedMs:30000}).play,false);
 assert.equal(C.cuePlan({stage:'thinking',elapsedMs:0,muted:true}).play,false);assert.equal(C.cuePlan({stage:'speaking',elapsedMs:0}).play,false);assert.equal(C.cuePlan({stage:'searching',elapsedMs:0,reduced:true}).soft,true);});
