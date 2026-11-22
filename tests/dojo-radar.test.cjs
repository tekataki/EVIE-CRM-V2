'use strict';
// v10 · Fase 5 (server): Dojo de ventas (owner turn + scoring, English mode) and Radar local (news + local alerts +
// weekend plans with web search). Both providers mocked: Claude (SSE, two-step search) and OpenAI (one call with the
// hosted web search + strict schema). URLs not returned by the search are dropped and the item becomes «no confirmado».
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');
const A='11111111-1111-4111-8111-111111111111';
function claudeSse(blocks,stop='end_turn'){const ev=[],push=(type,data)=>ev.push(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);
 push('message_start',{message:{id:'m',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:900,output_tokens:1,cache_read_input_tokens:0,cache_creation_input_tokens:0}}});
 blocks.forEach((b,i)=>{if(b.type==='text'){push('content_block_start',{index:i,content_block:{type:'text',text:'',...(b.citations?{citations:[]}:{})}});push('content_block_delta',{index:i,delta:{type:'text_delta',text:b.text}});for(const c of b.citations||[])push('content_block_delta',{index:i,delta:{type:'citations_delta',citation:c}});}else push('content_block_start',{index:i,content_block:b});push('content_block_stop',{index:i});});
 push('message_delta',{delta:{stop_reason:stop,stop_sequence:null},usage:{output_tokens:200,server_tool_use:{web_search_requests:blocks.filter(b=>b.type==='server_tool_use').length}}});push('message_stop',{});return new Response(ev.join(''),{headers:{'content-type':'text/event-stream'}});}
async function fixture(t,extra={}){const {createAccounts}=await import('../src/accounts.js');const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),ANTHROPIC_API_KEY:'k',...extra};
 const sent=[];let json='{}',searchUrls=['https://noticias.example.org/nota-1','https://eventos.example.org/feria'];
 const fetcher=async(input,o={})=>{const url=typeof input==='string'?input:input.url;if(url.includes('grant_type=password'))return Response.json({user:{id:A},access_token:'acc',refresh_token:'ref',expires_in:3600});if(url.endsWith('/auth/v1/user'))return Response.json({id:A});
  if(url.startsWith('https://api.anthropic.com')){const b=JSON.parse(o.body);sent.push({p:'claude',b});
   if(b.tools?.some(x=>String(x.type).startsWith('web_search')))return claudeSse([{type:'server_tool_use',id:'srvtoolu_1',name:'web_search',input:{query:'q'}},{type:'web_search_tool_result',tool_use_id:'srvtoolu_1',content:searchUrls.map(u=>({type:'web_search_result',url:u,title:'Fuente',encrypted_content:'x',page_age:null}))},{type:'text',text:'Hallazgos con fuentes.',citations:searchUrls.map(u=>({type:'web_search_result_location',url:u,title:'Fuente',encrypted_index:'x',cited_text:'texto'}))}]);
   return claudeSse([{type:'text',text:json}]);}
  if(url.startsWith('https://api.openai.com/v1/responses')){const b=JSON.parse(o.body);sent.push({p:'openai',b});const out=[...(b.tools?[{type:'web_search_call',status:'completed',action:{type:'search',query:'q',sources:searchUrls.map(u=>({type:'url',url:u}))}}]:[]),{type:'message',content:[{type:'output_text',text:json,annotations:[]}]}];return Response.json({status:'completed',model:b.model,output:out,usage:{input_tokens:900,output_tokens:300}});}
  throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});const request=(route,{method='GET',body,cookie}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-Evie-User':A}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},env);
 const r=await request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'}});return {request,cookie:r.headers.get('set-cookie').split(';')[0],sent,db,setJson:x=>json=x};}
const PROVIDERS=[['claude',{}],['openai',{ANTHROPIC_API_KEY:'',OPENAI_API_KEY:'o'}]];
const turns=[{role:'owner',text:'¿Qué vende? Tengo poco tiempo.'},{role:'seller',text:'Le ayudo a dejar de contestar precios por WhatsApp con un menú QR. <script>x</script>'},{role:'owner',text:'Suena caro.'},{role:'seller',text:'Empezamos con el paquete chico. ¿Lo dejamos listo el lunes?'}];

test('dojo: owner turn in character (Spanish/English), scoring with totals, guards',async t=>{for(const [p,extra] of PROVIDERS){const f=await fixture(t,extra);
 f.setJson(JSON.stringify({reply:'Mire, ya me han ofrecido de todo. ¿Por qué usted?',objection:'desconfianza',mood:'frio',ended:false}));
 let r=await f.request('/dojo/turn',{method:'POST',cookie:f.cookie,body:{scenario:{business:'cafetería',style:'esceptico'},lang:'es',turns:[]}});let j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.mood,'frio');assert.equal(j.ended,false);assert.match(j.reply,/Por qué usted/);
 const first=f.sent.at(-1);const sys=p==='claude'?first.b.system.map?first.b.system.map(x=>x.text).join(''):first.b.system:first.b.instructions;assert.match(String(sys),/cafetería/);assert.match(String(sys),/escéptico/);
 f.setJson(JSON.stringify({reply:'Sounds expensive.',objection:'price',mood:'neutral',ended:false}));await f.request('/dojo/turn',{method:'POST',cookie:f.cookie,body:{scenario:{business:'restaurante',style:'precio'},lang:'en',turns}});
 const en=f.sent.at(-1);assert.match(String(p==='claude'?JSON.stringify(en.b.system):en.b.instructions),/INGLÉS/);const content=p==='claude'?en.b.messages[0].content:en.b.input[0].content;assert.ok(!/<script>/.test(content));
 f.setJson(JSON.stringify({claridad:8,objeciones:6,cierre:7,resumen:'Bien.',fortalezas:['Fuiste al grano'],mejoras:['Valida la objeción antes de responder'],frase_modelo:'Entiendo, ¿qué le preocupa del precio?',nivel_ingles:'B2',correcciones:[{dije:'I help you to stop',mejor:'I can help you stop'}]}));
 r=await f.request('/dojo/score',{method:'POST',cookie:f.cookie,body:{scenario:{business:'restaurante',style:'precio'},lang:'en',turns}});j=await r.json();assert.equal(r.status,200);assert.equal(j.score.total,70);assert.equal(j.score.nivel_ingles,'B2');assert.equal(j.score.correcciones.length,1);
 r=await f.request('/dojo/score',{method:'POST',cookie:f.cookie,body:{scenario:{},lang:'es',turns}});j=await r.json();assert.equal(j.score.nivel_ingles,undefined,'no English block in Spanish mode');
 assert.equal((await f.request('/dojo/score',{method:'POST',cookie:f.cookie,body:{turns:turns.slice(0,2)}})).status,400);
 assert.equal((await f.request('/dojo/turn',{method:'POST',body:{turns:[]}})).status,401);}});

test('radar: news + local alerts and weekend plans; only URLs the search returned survive; city required',async t=>{for(const [p,extra] of PROVIDERS){const f=await fixture(t,extra);
 f.setJson(JSON.stringify({items:[{titulo:'Nota real',resumen:'Algo pasó.',categoria:'negocios',url:'https://noticias.example.org/nota-1?utm_source=x',fuente:'',fecha:'2026-11-21',confirmado:true},{titulo:'Nota inventada',resumen:'Rumor.',categoria:'ia',url:'https://inventada.example.com/x',fuente:'Blog',fecha:'ayer',confirmado:true}],avisos:[{titulo:'Cierre de calle por desfile',detalle:'Centro cerrado de 9 a 13 h.',cuando:'domingo',url:'https://eventos.example.org/feria',confirmado:true}]}));
 let r=await f.request('/radar/news',{method:'POST',cookie:f.cookie,body:{city:'Ciudad de prueba'}});let j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
 assert.equal(j.items[0].confirmado,true);assert.equal(j.items[0].url,'https://noticias.example.org/nota-1');assert.equal(j.items[0].fuente,'noticias.example.org');
 assert.equal(j.items[1].url,'');assert.equal(j.items[1].confirmado,false,'unverified URL → no confirmado');assert.equal(j.items[1].fecha,'');
 assert.equal(j.avisos[0].confirmado,true);assert.match(j.avisos[0].titulo,/Cierre de calle/);
 if(p==='openai'){const call=f.sent.find(x=>x.p==='openai');assert.equal(call.b.tools[0].type,'web_search');assert.equal(call.b.tool_choice,'required');assert.equal(call.b.text.format.strict,true);}
 else{assert.ok(f.sent.some(x=>x.b.tools?.some(y=>y.type==='web_search_20260209')));assert.ok(f.sent.some(x=>x.b.output_config?.format),'second step is structured');}
 assert.ok(f.db.prepare("SELECT amount FROM ai_usage WHERE owner_id=? AND kind='web_search'").get(A).amount>=1);
 f.setJson(JSON.stringify({planes:[{titulo:'Feria',cuando:'sábado',donde:'Centro',costo_mxn:0,url:'https://eventos.example.org/feria',por_que:'Gratis',confirmado:true},{titulo:'Concierto caro',cuando:'viernes',donde:'Auditorio',costo_mxn:900,url:'',por_que:'',confirmado:false},{titulo:'Café nuevo',cuando:'todo el finde',donde:'Centro',costo_mxn:-1,url:'',por_que:'',confirmado:false}]}));
 r=await f.request('/radar/plans',{method:'POST',cookie:f.cookie,body:{city:'Ciudad de prueba',budget:300}});j=await r.json();assert.equal(r.status,200);assert.deepEqual(j.planes.map(x=>x.titulo),['Feria','Café nuevo'],'over budget dropped');assert.equal(j.budget,300);assert.ok(j.weekend.from<=j.weekend.to);
 r=await f.request('/radar/news',{method:'POST',cookie:f.cookie,body:{}});assert.equal(r.status,400);assert.equal((await r.json()).code,'needs_city');}});

test('radar weekend: the coming or running Friday–Sunday',async()=>{const {weekend}=await import('../src/radar.js');
 assert.deepEqual(weekend('2026-11-19'),{from:'2026-11-20',to:'2026-11-22'});assert.deepEqual(weekend('2026-11-21'),{from:'2026-11-20',to:'2026-11-22'});assert.deepEqual(weekend('2026-11-22'),{from:'2026-11-20',to:'2026-11-22'});assert.deepEqual(weekend('2026-11-23'),{from:'2026-11-27',to:'2026-11-29'});});
