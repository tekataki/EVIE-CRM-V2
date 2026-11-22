'use strict';
// v10 · Fase 3: Cabina SOMA (server: dossier + follow-up with Claude structured outputs) and Briefing logic
// (gym window before fixed commitments, daily English phrase, spoken text). Mocked Claude (SSE); no network.
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const A='11111111-1111-4111-8111-111111111111';
function sse(text){const ev=[],push=(type,data)=>ev.push(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);
 push('message_start',{message:{id:'msg_s',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:800,output_tokens:1,cache_read_input_tokens:0,cache_creation_input_tokens:0}}});
 push('content_block_start',{index:0,content_block:{type:'text',text:''}});push('content_block_delta',{index:0,delta:{type:'text_delta',text}});push('content_block_stop',{index:0});
 push('message_delta',{delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:200}});push('message_stop',{});return new Response(ev.join(''),{headers:{'content-type':'text/event-stream'}});}
async function fixture(t,extra={}){const {createAccounts}=await import('../src/accounts.js');const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),ANTHROPIC_API_KEY:'k',...extra};
 const sent=[];let reply='{}';const fetcher=async(input,o={})=>{const url=typeof input==='string'?input:input.url;if(url.includes('grant_type=password'))return Response.json({user:{id:A},access_token:'acc',refresh_token:'ref',expires_in:3600});if(url.endsWith('/auth/v1/user'))return Response.json({id:A});if(url.startsWith('https://api.anthropic.com')){sent.push(JSON.parse(o.body));return sse(reply);}throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});const request=(route,{method='GET',body,cookie}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-Evie-User':A}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},env);
 const r=await request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'}});return {request,cookie:r.headers.get('set-cookie').split(';')[0],sent,db,setReply:x=>reply=x};}
const prospect={client:{name:'Café de prueba',stage:'Diagnóstico',project:'Menú y pedidos',notes:'<script>x</script> Le interesa el QR',needs:['Le preguntan el menú por WhatsApp'],days_since_contact:4},packages:[{name:'Menú digital QR',includes:['Menú web','QR'],one_time:3500,monthly:250}],objections:[{if:'Está caro',then:'Empieza con el paquete chico'}]};

test('dossier: Claude structured output (effort medium), sanitized prospect data, metered',async t=>{const f=await fixture(t);
 f.setReply(JSON.stringify({resumen:'Café con mucho WhatsApp.',problema_probable:'Pierde tiempo contestando precios.',solucion:'Menú QR.',paquete_recomendado:{nombre:'Menú digital QR',por_que:'Resuelve lo urgente.'},objeciones:[{si:'Es caro',entonces:'Pago dividido'}],preguntas:['¿Cuántos mensajes recibes al día?'],cierre:'¿Arrancamos el lunes?',siguiente_paso:'Enviar propuesta.',supuestos:['Que tienen WhatsApp Business']}));
 const r=await f.request('/soma/dossier',{method:'POST',cookie:f.cookie,body:prospect});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
 assert.equal(j.dossier.paquete_recomendado.nombre,'Menú digital QR');assert.equal(j.dossier.cierre,'¿Arrancamos el lunes?');assert.ok(j.generated_at);
 const b=f.sent[0];assert.equal(b.model,'claude-opus-5-5');assert.equal(b.output_config.effort,'medium');assert.equal(b.output_config.format.type,'json_schema');
 assert.ok(!/<script>/.test(b.messages[0].content),'angle brackets stripped from prospect data');assert.match(b.messages[0].content,/Menú digital QR/);
 assert.ok(f.db.prepare("SELECT amount FROM ai_usage WHERE owner_id=? AND kind='cost_micro'").get(A).amount>0);
 assert.equal((await f.request('/soma/dossier',{method:'POST',cookie:f.cookie,body:{client:{}}})).status,400);});

test('follow-up: three messages (cercano/directo/valor), effort low; no Claude → clear 503; needs session',async t=>{const f=await fixture(t);
 f.setReply(JSON.stringify({mensajes:[{tono:'cercano',texto:'¡Hola! ¿Cómo va todo?'},{tono:'directo',texto:'¿Agendamos el arranque?'},{tono:'valor',texto:'Te comparto una idea para tu menú.'}]}));
 const j=await (await f.request('/soma/followup',{method:'POST',cookie:f.cookie,body:prospect})).json();assert.deepEqual(j.mensajes.map(m=>m.tono),['cercano','directo','valor']);assert.equal(f.sent[0].output_config.effort,'low');
 assert.equal((await f.request('/soma/followup',{method:'POST',body:prospect})).status,401);
 const n=await fixture(t,{ANTHROPIC_API_KEY:''});const r=await n.request('/soma/followup',{method:'POST',cookie:n.cookie,body:prospect});assert.equal(r.status,503);assert.match((await r.json()).error,/ANTHROPIC_API_KEY/);});

function briefing({commitments=[],settings={},now=new Date(2026,10,23,8,0)}={}){
 const ctx={console,Math,JSON,Intl,structuredClone,Number,String,Object,Array,Promise,setTimeout,setInterval:()=>0,crypto};const RealDate=Date;
 ctx.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[now.getTime()]));}static now(){return now.getTime();}};ctx.window=ctx;vm.createContext(ctx);
 const state={preferences:{iviCommitments:commitments,iviBriefing:settings},profile:{preferred:'Sam'},agendaItems:[],clients:[{id:'c1',title:'Taller de prueba',stage:'Propuesta',nextDate:'2026-11-20',nextAction:'Llamar'}],goals:[{id:'g',title:'Misión laptop',target:1000,progress:250}]};
 ctx.Store={get:()=>state,list:c=>state[c]||[]};ctx.Domain={today:()=>'2026-11-23',money:x=>'$'+x};ctx.UI={section:'inicio'};ctx.App={toast(){},render(){}};ctx.Views={icon:()=>'',date:d=>d};ctx.document={addEventListener(){},querySelector:()=>null};ctx.navigator={};ctx.localStorage={getItem:()=>null,setItem(){}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-briefing.js'),'utf8'),ctx);return ctx.EvieBriefing;}

test('briefing: gym window before the first fixed commitment (minus travel), tight days, no commitments',()=>{
 const B=briefing({commitments:[{id:'a',label:'Escuela',time:'13:00',days:[1]},{id:'b',label:'Recoger',time:'12:30',days:[1]}],settings:{wake:'07:00',gymMinutes:90,travelMinutes:15}});// 2026-11-23 = Monday
 const g=B.gymWindow(1);assert.equal(g.start,7*60+30);assert.equal(g.end,12*60+30-15-15);assert.match(g.label,/Ventana para entrenar: .* \(antes de «Recoger»\)/);
 const tight=briefing({commitments:[{id:'a',label:'Trabajo',time:'09:00',days:[1]}],settings:{wake:'07:00',gymMinutes:90}}).gymWindow(1);assert.equal(tight.tight,true);assert.match(tight.label,/tiempo es justo/);
 assert.match(briefing().gymWindow(1).label,/Sin compromisos fijos/);});

test('briefing: English phrase rotates daily, spoken text covers the day without markup',()=>{const B=briefing({commitments:[{id:'a',label:'Escuela',time:'13:00',days:[1]}]});
 assert.equal(B.PHRASES.length,60);assert.notDeepEqual(B.phrase(new Date(2026,10,23)),B.phrase(new Date(2026,10,24)));
 const s=B.speech(B.build(),{current:{temperature_c:18.4,condition:'Despejado'}});
 assert.match(s,/^Buenos días, Sam\. Protocolo matutino\./);assert.match(s,/Clima: 18 grados, despejado\./);assert.match(s,/Escuela a las/);assert.match(s,/Seguimientos de ventas: Taller de prueba\./);assert.match(s,/Misión laptop al 25 por ciento\./);assert.match(s,/Frase del día: /);assert.ok(!/[<>*#]/.test(s));});
