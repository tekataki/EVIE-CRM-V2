'use strict';
// v4: one microphone owner at a time (pre-emption + release), and Kisha long-narrative context stays bounded
// while asking for the rolling summary when older turns fall out of the window.
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function mic(){const ctx={console};ctx.window=ctx;vm.createContext(ctx);ctx.document={documentElement:{dataset:{}},body:null,getElementById:()=>null,querySelector:()=>null};ctx.MutationObserver=class{observe(){}};ctx.addEventListener=()=>{};ctx.matchMedia=()=>({matches:false});
 const paused=[];ctx.EvieWake={pause:ms=>paused.push(ms)};vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-mic.js'),'utf8'),ctx);return {M:ctx.EvieMic,ctx,paused};}
test('single mic owner: second owner pre-empts the first, wake has lowest priority, release frees it',()=>{const {M,ctx,paused}=mic();let stopped=0;
 assert.equal(M.acquire('wake',()=>stopped++),true);assert.equal(M.acquire('assistant',()=>stopped++),true);assert.equal(stopped,1,'wake released');assert.ok(paused.length,'wake paused');
 assert.equal(M.acquire('wake'),false,'wake cannot take it back while Ivi listens');
 assert.equal(M.acquire('kisha',()=>stopped++),true);assert.equal(stopped,2,'Ivi recorder stopped by Kisha');assert.equal(M.current(),'kisha');assert.equal(ctx.document.documentElement.dataset.micOwner,'kisha');
 M.release('assistant');assert.equal(M.current(),'kisha','only the owner can release');M.release('kisha');assert.equal(M.current(),null);assert.equal(M.acquire('nope'),false);});
function kisha(){const ctx={console,JSON,Math,Date};ctx.window=ctx;ctx.crypto={randomUUID:()=>'00000000-0000-4000-8000-000000000000'};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/kisha-core.js'),'utf8'),ctx);return ctx.KishaCore||ctx.Kisha||Object.values(ctx).find(v=>v&&v.context&&v.machine);}
test('long narrative: a 7,000-char turn is kept whole; context ≤ 20k chars; summary requested when turns drop out',()=>{const K=kisha();assert.ok(K,'core loaded');
 const long='Hoy pasó algo importante. '.repeat(280).trim();assert.ok(long.length>6900);
 const s={messages:[],memory:null,memoryUpTo:0};for(let k=0;k<6;k++){s.messages.push({role:'user',text:long});s.messages.push({role:'kisha',text:'Te escucho.'});}
 const c=K.context(s);const total=c.messages.reduce((n,m)=>n+m.text.length,0);
 assert.ok(c.messages.some(m=>m.text.length===long.length),'no 2000-char truncation');assert.ok(total<=20000+long.length,'bounded');assert.ok(c.messages.length<s.messages.length);assert.equal(c.need_memory,true);
 const short={messages:[{role:'user',text:'hola'},{role:'kisha',text:'hola'}],memory:null,memoryUpTo:0};assert.equal(K.context(short).need_memory,false);});
