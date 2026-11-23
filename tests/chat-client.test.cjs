'use strict';
// Chat client (public/evie-chat.js) · app-tools protocol without a browser: send → SSE «tools» → the calls run through
// EvieAssistant.runTool with STABLE op ids (regenerate never saves twice) → POST /continue with outputs + receipt labels
// → «done» with receipts → «Deshacer» calls the live undo. Disallowed tools never reach the runner.
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const A='11111111-1111-4111-8111-111111111111',C='33333333-3333-4333-8333-333333333333';
const sse=evs=>new Response(evs.map(([e,d])=>`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});
const plain=v=>JSON.parse(JSON.stringify(v)); // objects built inside the VM have another realm's prototypes

function load(){
 const handlers={},posts=[],ran=[],undone=[],toasts=[],state={transactions:[],profile:{},preferences:{}};let script=[];
 const ctx={console,Date,Math,JSON,Intl,structuredClone,setTimeout,clearTimeout,queueMicrotask,TextEncoder,TextDecoder,Response,ReadableStream,AbortController,DOMException,URL,Blob,atob,btoa};
 ctx.window=ctx;ctx.DALI_CONFIG={currency:'MXN'};ctx.UI={section:'chat',id:null};ctx.history={replaceState(){}};
 ctx.document={addEventListener:(t,fn)=>{(handlers[t]||=[]).push(fn);},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],documentElement:{dataset:{}},activeElement:null};
 ctx.matchMedia=()=>({matches:false});ctx.requestAnimationFrame=fn=>setTimeout(fn,0);
 ctx.App={toast:(m,t)=>toasts.push([m,t]),render(){}};ctx.Store={get:()=>state};
 ctx.EvieAccounts={current:()=>({id:A,role:'member'}),config:()=>({accountsEnabled:true,ai:{chat:true}}),request:async(p,o={})=>{posts.push({url:'/api/'+p,method:o.method||'GET',body:o.body});
  if(p==='chat/conversations'&&o.method==='POST')return {conversation:{id:C,title:'',private:false,tier:'enfoque',pinned:false,archived:false,message_count:0}};
  if(p.startsWith('chat/conversations'))return {conversations:[]};return {};}};
 // The runner the chat reuses: it saves like EvieFinance (op_id = call.call_id) and hands back an undo.
 ctx.EvieAssistant={runTool:async(name,args,call)=>{ran.push({name,args,call});
  if(name==='log_transaction'){if(!state.transactions.some(t=>t.op_id===call.call_id))state.transactions.push({id:'tx'+ran.length,op_id:call.call_id,type:args.type,amount:Math.round(args.amount*100),category:'Comida',evie_account:'acc1'});return {output:{status:'created',account:'Efectivo',summary:'Listo: gasto de $250.00 de Efectivo · Comida.'},undo:()=>undone.push(call.call_id)};}
  return {output:{period:'month',income:'$0.00'},undo:null};}};
 ctx.fetch=async(url,o)=>{posts.push({url,method:o.method,body:JSON.parse(o.body),headers:o.headers});return sse(script.shift()||[]);};
 vm.createContext(ctx);
 for(const f of ['evie-chat-md.js','evie-chat.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx,{filename:f});
 return {ctx,chat:ctx.EvieChat,handlers,posts,ran,undone,toasts,state,setScript:s=>{script=s;}};
}
const ARGS={type:'expense',amount:250,title:'Comida',account:null,category:'Comida',date:null,soma_client_name:null};
const round=(callId,args=ARGS,name='log_transaction')=>[['meta',{conversation:C,user_message:{id:'u1',seq:1},tier:{id:'enfoque',label:'Enfoque'},round:0}],['tools',{calls:[{call_id:callId,name,arguments:JSON.stringify(args)}],continuation:'SEALED-'+callId,round:1}]];
const answer=(text,actions)=>[['meta',{conversation:C,user_message:{id:'u1',seq:1},round:1}],['delta',{t:text}],['done',{message:{id:'a1',seq:2},text,sources:[],actions,model:'gpt-6-luna',stop_reason:'end_turn',title:'Gasto',tier:{id:'enfoque'}}]];

test('send → tools → runTool (stable op id) → /continue with outputs and receipt labels → done keeps the receipts; undo is live',async()=>{
 const t=load();const receipt={id:'call_1',name:'log_transaction',status:'created',summary:'Gasto registrado · $250 · Comida · Efectivo'};
 t.setScript([round('call_1'),answer('Listo, quedó en Finanzas.',[receipt])]);
 await t.chat.send({text:'hoy me gasté 250 en comida, ¿lo puedes poner en finanzas?'});
 const [first,second]=t.posts.filter(p=>p.headers);
 assert.equal(first.url,`/api/chat/conversations/${C}/messages`);assert.equal(first.body.tools,true,'the client declares it can run app tools');assert.equal(first.headers.Accept,'text/event-stream');
 assert.equal(t.ran.length,1);assert.equal(t.ran[0].name,'log_transaction');assert.deepEqual(plain(t.ran[0].args),ARGS);assert.match(t.ran[0].call.call_id,/^ivi-[a-z0-9]+$/,'op id derived from conversation + message + action');
 assert.equal(second.url,`/api/chat/conversations/${C}/continue`);assert.equal(second.body.continuation,'SEALED-call_1');assert.ok(second.body.context?.timezone);
 assert.equal(second.body.outputs.length,1);const out=second.body.outputs[0];assert.equal(out.call_id,'call_1');assert.equal(JSON.parse(out.output).status,'created');
 assert.equal(out.summary,'Gasto registrado · $250 · Comida · Efectivo','receipt label from the saved record');
 const msgs=plain(t.chat.state().msgs);assert.deepEqual(msgs.map(m=>m.role),['user','assistant']);assert.equal(msgs[1].text,'Listo, quedó en Finanzas.');assert.deepEqual(msgs[1].meta.actions,[receipt]);assert.equal(t.chat.state().stream,null);
 // «Deshacer» on the receipt runs the undo of THAT call, once
 const click=id=>{const btn={dataset:{ch:'undo',id},classList:{contains:()=>false}};for(const h of t.handlers.click)h({target:{closest:sel=>sel==='[data-ch]'?btn:null}});};
 click('call_1');click('call_1');assert.deepEqual(t.undone,[t.ran[0].call.call_id]);assert.ok(t.chat.state().undone.has('call_1'));
 // Regenerate: the model asks for the same expense again → same op id, so the runner finds what it already saved
 t.setScript([round('call_9'),answer('Ya estaba registrado.',[])]);await t.chat.send({regenerate:true});
 assert.equal(t.ran[1].call.call_id,t.ran[0].call.call_id,'stable across regenerate');assert.equal(t.state.transactions.length,1);
 const third=t.posts.filter(p=>p.headers).at(-1);assert.equal(third.body.outputs[0].call_id,'call_9','outputs answer the model\'s own call id');});

test('two identical expenses in one message get two op ids; tools outside the chat set never reach the runner',async()=>{
 const t=load();
 t.setScript([[['meta',{conversation:C,user_message:{id:'u1',seq:3}}],['tools',{calls:[{call_id:'c1',name:'log_transaction',arguments:JSON.stringify(ARGS)},{call_id:'c2',name:'log_transaction',arguments:JSON.stringify(ARGS)},{call_id:'c3',name:'edit_record',arguments:JSON.stringify({op:'agenda.delete',title:'x',date:null,time:null,priority:null,notes:null})},{call_id:'c4',name:'set_timer',arguments:'{"seconds":5}'},{call_id:'c5',name:'get_finance_summary',arguments:'{"period":"month"}'}],continuation:'S',round:1}]],answer('Listo.',[])]);
 await t.chat.send({text:'registra dos gastos de 250 en comida'});
 assert.deepEqual(t.ran.map(r=>r.name),['log_transaction','log_transaction','get_finance_summary']);assert.notEqual(t.ran[0].call.call_id,t.ran[1].call.call_id);
 assert.equal(t.ran[2].call.call_id,'c5','reads keep the model call id');
 const outs=t.posts.filter(p=>p.headers).at(-1).body.outputs;assert.deepEqual(outs.map(o=>o.call_id),['c1','c2','c3','c4','c5']);
 for(const o of outs.slice(2,4))assert.match(JSON.parse(o.output).error,/no está disponible en el chat/);
 assert.match(outs[2].summary,/^No se pudo registrar/,'a refused write still leaves an (error) receipt');assert.equal(outs[3].summary,undefined,'non-write tools have no receipt');});

test('EvieAssistant.runTool: the voice executors for the chat — op id from the call, the undo of THAT call, errors as outputs',async()=>{
 const logged=[],undo=()=>{};let voiceUndo=null;
 const ctx={console,Date,Math,JSON,Intl,structuredClone,setTimeout,clearTimeout,queueMicrotask,navigator:{userAgent:'node',platform:'test',maxTouchPoints:0}};ctx.window=ctx;ctx.addEventListener=()=>{};
 ctx.document={addEventListener(){},documentElement:{dataset:{}},querySelectorAll:()=>[]};
 ctx.App={render(){},toast(){}};ctx.Store={list:()=>[],get:()=>({preferences:{}})};ctx.IvyTools={norm:s=>String(s||'').toLowerCase()};
 ctx.EvieFinance={log:a=>{logged.push(a);return {status:'created',account:'Efectivo',balance:'saldo estimado $750.00',say:'Listo: gasto de $250.00 de Efectivo · Comida.',undo};},setLastUndo:f=>{voiceUndo=f;},lastUndo:()=>voiceUndo};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-assistant.js'),'utf8'),ctx,{filename:'evie-assistant.js'});
 const r=await ctx.EvieAssistant.runTool('log_transaction',ARGS,{call_id:'ivi-op1',name:'log_transaction'});
 assert.equal(r.output.status,'created');assert.equal(r.output.account,'Efectivo');assert.equal(r.undo,undo,'the undo of this very call');
 assert.equal(logged[0].op_id,'ivi-op1');assert.equal(logged[0].amount,25000,'pesos → cents, same as the voice loop');assert.equal(logged[0].source,'ivi-ai');
 const g=await ctx.EvieAssistant.runTool('get_goals',{},{call_id:'c2'});assert.equal(plain(g.output).goals.length,0);assert.equal(g.undo,null,'reads have nothing to undo');
 const x=await ctx.EvieAssistant.runTool('rm_rf',{});assert.equal(x.output.status,'error');assert.equal(x.undo,null);
 ctx.EvieFinance.log=()=>{throw Error('Store bloqueado');};const y=await ctx.EvieAssistant.runTool('log_transaction',ARGS,{call_id:'ivi-op2'});assert.deepEqual(plain(y.output),{status:'error',error:'Store bloqueado'});assert.equal(y.undo,null);});

test('a failed /continue keeps the receipts (with undo) on a partial answer and shows the error',async()=>{
 const t=load();t.setScript([round('call_1')]);
 const fetch0=t.ctx.fetch;let n=0;t.ctx.fetch=async(u,o)=>{if(++n===2){t.posts.push({url:u,headers:o.headers,body:JSON.parse(o.body)});return Response.json({error:'Pasó demasiado tiempo o cambió la configuración. Vuelve a enviar tu mensaje.',code:'stale_continuation'},{status:409});}return fetch0(u,o);};
 await t.chat.send({text:'anota 250 de comida'});
 const s=t.chat.state();assert.equal(s.msgs.at(-1).id,'tmp-a');assert.equal(s.msgs.at(-1).meta.stop_reason,'error');assert.equal(s.msgs.at(-1).meta.actions[0].status,'created');assert.match(s.error,/Vuelve a enviar/);});
