'use strict';
// v10 · Claude (Anthropic API) through the official SDK with a mocked fetch that speaks SSE. No network, no real keys.
// Covers: provider selection, request shape (model, effort per tier, adaptive thinking + drop_block, refusal fallbacks,
// prompt caching, no sampling params), the sealed tool round (replayed verbatim), server-side clock tool, refusals,
// typed errors, cost metering, Kisha structured output, two-step research with verified sources, schema cleaning.
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');
const A='11111111-1111-4111-8111-111111111111';
function sse(msg){const ev=[],push=(type,data)=>ev.push(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);
 push('message_start',{message:{id:'msg_'+Math.random().toString(36).slice(2),type:'message',role:'assistant',model:msg.model||'claude-opus-5-5',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:msg.usage?.input_tokens??1000,output_tokens:1,cache_read_input_tokens:msg.usage?.cache_read_input_tokens??0,cache_creation_input_tokens:msg.usage?.cache_creation_input_tokens??0,...(msg.usage?.server_tool_use?{server_tool_use:msg.usage.server_tool_use}:{})}}});
 (msg.content||[]).forEach((b,i)=>{
  if(b.type==='text'){push('content_block_start',{index:i,content_block:{type:'text',text:'',citations:null}});push('content_block_delta',{index:i,delta:{type:'text_delta',text:b.text}});for(const c of b.citations||[])push('content_block_delta',{index:i,delta:{type:'citations_delta',citation:c}});}
  else if(b.type==='tool_use'||b.type==='server_tool_use'){push('content_block_start',{index:i,content_block:{type:b.type,id:b.id,name:b.name,input:{}}});push('content_block_delta',{index:i,delta:{type:'input_json_delta',partial_json:JSON.stringify(b.input||{})}});}
  else if(b.type==='thinking'){push('content_block_start',{index:i,content_block:{type:'thinking',thinking:'',signature:''}});push('content_block_delta',{index:i,delta:{type:'signature_delta',signature:b.signature}});}
  else push('content_block_start',{index:i,content_block:b});
  push('content_block_stop',{index:i});});
 push('message_delta',{delta:{stop_reason:msg.stop_reason||'end_turn',stop_sequence:null},usage:{output_tokens:msg.usage?.output_tokens??100}});push('message_stop',{});
 return new Response(ev.join(''),{status:200,headers:{'content-type':'text/event-stream','request-id':'req_test'}});}
async function fixture(t,extra={}){
 const {createAccounts}=await import('../src/accounts.js');
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),ANTHROPIC_API_KEY:'test-anthropic',GROQ_API_KEY:'g',FISH_AUDIO_API_KEY:'f',FISH_AUDIO_VOICE_ID:'voice12345',...extra};
 const sent=[];let claude=()=>sse({content:[{type:'text',text:'Sistemas en línea, Sam.'}]});
 const fetcher=async(input,options={})=>{const url=typeof input==='string'?input:input.url;
  if(url.includes('grant_type=password'))return Response.json({user:{id:A},access_token:'acc',refresh_token:'ref',expires_in:3600});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:A});
  if(url.startsWith('https://api.anthropic.com')){const h=new Headers(options.headers);const body=JSON.parse(options.body);sent.push({url,headers:h,body});return claude(body,sent.length);}
  if(url.startsWith('https://api.openai.com'))return Response.json({output:[{type:'message',content:[{type:'output_text',text:'openai'}]}]});
  throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});
 const request=(route,{method='GET',body,cookie}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-Evie-User':A}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},env);
 const r=await request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'}});const cookie=r.headers.get('set-cookie').split(';')[0];
 return {request,cookie,sent,env,db,setClaude:f=>claude=f};}
const chat=(f,input,extra={})=>f.request('/ai/chat',{method:'POST',cookie:f.cookie,body:{input,context:{name:'Sam',timezone:'America/Mexico_City',currency:'MXN'},...extra}});

test('runtime and status report Claude as provider (refusal fallbacks on) without exposing keys',async t=>{const f=await fixture(t);
 const rt=await (await f.request('/runtime')).json();assert.equal(rt.ai.chat,true);assert.equal(rt.ai.provider,'claude');assert.equal(rt.ai.model,'claude-opus-5-5');assert.equal(rt.ai.refusalFallbacks,true);
 const st=await (await f.request('/ai/status',{cookie:f.cookie})).json();assert.equal(st.provider,'claude');assert.equal(st.refusal_fallbacks,true);assert.equal(st.model,'claude-opus-5-5');
 assert.ok(!JSON.stringify(rt).includes('test-anthropic')&&!JSON.stringify(st).includes('test-anthropic'));
 const o=await fixture(t,{ANTHROPIC_API_KEY:'',OPENAI_API_KEY:'o'});assert.equal((await (await o.request('/runtime')).json()).ai.provider,'openai','falls back to OpenAI only when there is no Claude key');
 const p=await fixture(t,{OPENAI_API_KEY:'o',EVIE_AI_PROVIDER:'openai'});assert.equal((await (await p.request('/runtime')).json()).ai.provider,'openai','explicit opt-out');});

test('request shape: opus 5.5, effort per tier, adaptive thinking + drop_block, fallbacks default, caching, no sampling params',async t=>{const f=await fixture(t);
 const r=await chat(f,[{role:'user',content:'¿qué tengo hoy?'}]);assert.equal(r.status,200);const j=await r.json();
 assert.equal(j.text,'Sistemas en línea, Sam.');assert.equal(j.provider,'claude');assert.equal(j.tier.model,'claude-opus-5-5');assert.equal(j.tier.effort,'medium');
 const {body,headers,url}=f.sent[0];assert.match(url,/\/v1\/messages(\?beta=true)?$/);
 assert.equal(body.model,'claude-opus-5-5');assert.equal(body.stream,true);assert.deepEqual(body.output_config,{effort:'medium'});assert.equal(body.fallbacks,'default');
 assert.deepEqual(body.thinking,{type:'adaptive',block_binding:{prefix_mismatch_behavior:'drop_block'}});
 const betas=headers.get('anthropic-beta');assert.match(betas,/server-side-fallback-2026-07-01/);assert.match(betas,/thinking-binding-controls-2026-08-01/);
 for(const k of ['temperature','top_p','top_k','tool_choice'])assert.ok(!(k in body),'no '+k);
 assert.ok(Array.isArray(body.system)&&body.system[0].cache_control?.type==='ephemeral'&&/Eres Ivi/.test(body.system[0].text),'frozen persona first, cached');
 assert.ok(!/\d{4}-\d{2}-\d{2}/.test(body.system[0].text),'no date in the cached prefix');assert.match(body.system.at(-1).text,/Fecha de referencia: \d{4}-\d{2}-\d{2}/);assert.deepEqual(body.cache_control,{type:'ephemeral'});
 const names=body.tools.map(x=>x.name);assert.ok(names.includes('get_today_overview')&&names.includes('get_current_time')&&names.includes('log_workout'));assert.ok(body.tools.every(x=>x.input_schema&&!x.parameters&&!x.type));
 assert.deepEqual(body.messages,[{role:'user',content:'¿qué tengo hoy?'}]);
 for(const [tier,effort] of [['chispa','low'],['profundo','high']]){await chat(f,[{role:'user',content:'hola'}],{tier});assert.equal(f.sent.at(-1).body.output_config.effort,effort,tier);}
 const cost=f.db.prepare("SELECT amount FROM ai_usage WHERE owner_id=? AND kind='cost_micro'").get(A).amount;assert.ok(cost>=3*(1000*4+100*20),'cost metered with Opus 5.5 prices');});

test('client tool round: assistant turn sealed and replayed verbatim (thinking + tool_use), then tool_result',async t=>{const f=await fixture(t);
 const turn1={stop_reason:'tool_use',content:[{type:'thinking',signature:'sig-abc'},{type:'text',text:'Reviso tu día.'},{type:'tool_use',id:'toolu_01ABC',name:'get_today_overview',input:{}}]};
 f.setClaude((b,n)=>n===1?sse(turn1):sse({content:[{type:'text',text:'Tienes 2 pendientes, Sam.'}]}));
 const r1=await (await chat(f,[{role:'user',content:'¿qué hay hoy?'}])).json();
 assert.equal(r1.calls.length,1);assert.equal(r1.calls[0].name,'get_today_overview');assert.equal(r1.calls[0].call_id,'toolu_01ABC');assert.equal(r1.reasoning.length,1);assert.match(r1.reasoning[0].id,/^cl_/);
 assert.ok(!r1.reasoning[0].encrypted_content.includes('sig-abc'),'sealed, not readable by the browser');
 const input=[{role:'user',content:'¿qué hay hoy?'},...r1.reasoning,...r1.calls,{type:'function_call_output',call_id:'toolu_01ABC',output:'{"pending":2}'}];
 const r2=await (await chat(f,input)).json();assert.equal(r2.text,'Tienes 2 pendientes, Sam.');assert.equal(r2.calls.length,0);
 const m=f.sent[1].body.messages;assert.equal(m.length,3);assert.equal(m[1].role,'assistant');
 assert.deepEqual(m[1].content.map(b=>b.type),['thinking','text','tool_use']);assert.equal(m[1].content[0].signature,'sig-abc');assert.equal(m[1].content[2].id,'toolu_01ABC');
 assert.deepEqual(m[2],{role:'user',content:[{type:'tool_result',tool_use_id:'toolu_01ABC',content:'{"pending":2}'}]});
 assert.deepEqual(f.sent[0].body.system,f.sent[1].body.system,'system identical inside the tool round');
 const bad=[...input];bad[1]={...bad[1],encrypted_content:bad[1].encrypted_content.slice(0,-6)+'AAAAAA'};assert.equal((await chat(f,bad)).status,400,'tampered sealed turn rejected');});

test('server clock tool resolves inside the Worker (no browser round); pause_turn continues',async t=>{const f=await fixture(t);
 f.setClaude((b,n)=>n===1?sse({stop_reason:'tool_use',content:[{type:'tool_use',id:'toolu_T',name:'get_current_time',input:{}}]}):n===2?sse({stop_reason:'pause_turn',content:[{type:'text',text:'Un momento…'}]}):sse({content:[{type:'text',text:'Son las 9:15.'}]}));
 const j=await (await chat(f,[{role:'user',content:'¿qué hora es?'}])).json();assert.equal(j.text,'Son las 9:15.');assert.equal(j.calls.length,0);assert.equal(f.sent.length,3);
 const m2=f.sent[1].body.messages;assert.equal(m2[1].content[0].name,'get_current_time');assert.equal(m2[2].content[0].tool_use_id,'toolu_T');assert.match(m2[2].content[0].content,/iso_local/);
 assert.equal(f.sent[2].body.messages.at(-1).role,'assistant','pause_turn re-sent with the paused assistant turn last');});

test('refusal, typed API errors and no key',async t=>{const f=await fixture(t);
 f.setClaude(()=>sse({stop_reason:'refusal',content:[]}));const j=await (await chat(f,[{role:'user',content:'x'}])).json();assert.match(j.text,/No puedo ayudar con eso/);assert.equal(j.stop_reason,'refusal');
 f.setClaude(()=>new Response(JSON.stringify({type:'error',error:{type:'rate_limit_error',message:'slow down'}}),{status:429,headers:{'content-type':'application/json'}}));
 const r=await chat(f,[{role:'user',content:'x'}]);assert.equal(r.status,429);assert.match((await r.json()).error,/limitó/);
 f.setClaude(()=>new Response(JSON.stringify({type:'error',error:{type:'authentication_error',message:'bad key'}}),{status:401,headers:{'content-type':'application/json'}}));
 const a=await chat(f,[{role:'user',content:'x'}]);assert.equal(a.status,502);assert.match((await a.json()).error,/ANTHROPIC_API_KEY/);
 const n=await fixture(t,{ANTHROPIC_API_KEY:''});const r0=await chat(n,[{role:'user',content:'x'}]);assert.equal(r0.status,503);assert.match((await r0.json()).error,/ANTHROPIC_API_KEY/);});

test('web search: server tool web_search_20260209 on explicit research; citations become sources',async t=>{const f=await fixture(t);
 f.setClaude(()=>sse({usage:{server_tool_use:{web_search_requests:1}},content:[{type:'server_tool_use',id:'srvtoolu_1',name:'web_search',input:{query:'noticias jalisco'}},{type:'web_search_tool_result',tool_use_id:'srvtoolu_1',content:[{type:'web_search_result',url:'https://example.org/a',title:'A',encrypted_content:'x',page_age:null}]},{type:'text',text:'Confirmado: pasó X.',citations:[{type:'web_search_result_location',url:'https://example.org/a',title:'A',cited_text:'X',encrypted_index:'e'}]}]}));
 const j=await (await chat(f,[{role:'user',content:'investiga las noticias de hoy en Jalisco'}])).json();
 const tool=f.sent[0].body.tools.find(x=>x.type==='web_search_20260209');assert.ok(tool&&tool.name==='web_search'&&tool.user_location.country==='MX');
 assert.equal(j.web,true);assert.deepEqual(j.sources.map(s=>s.url),['https://example.org/a']);assert.ok(j.checked_at);
 const ws=f.db.prepare("SELECT amount FROM ai_usage WHERE owner_id=? AND kind='web_search'").get(A).amount;assert.equal(ws,1);});

test('Kisha uses Claude structured outputs with a cleaned schema',async t=>{const f=await fixture(t);
 f.setClaude(()=>sse({content:[{type:'text',text:JSON.stringify({reply:'Te escucho. ¿Qué pasó después?',cue:'curious',intent:'follow_up',memory:null})}]}));
 const r=await f.request('/kisha/turn',{method:'POST',cookie:f.cookie,body:{session_id:'22222222-2222-4222-8222-222222222222',turn_id:'turn-0001',messages:[{role:'user',text:'Hoy tuve un día raro.'}]}});
 const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.reply,'Te escucho. ¿Qué pasó después?');assert.equal(j.cue,'curious');
 const b=f.sent[0].body;assert.equal(b.output_config.effort,'low');assert.equal(b.output_config.format.type,'json_schema');
 const s=JSON.stringify(b.output_config.format.schema);assert.ok(!/maxItems|minimum|maximum|"type":\["/.test(s));assert.match(s,/anyOf/);});

test('research: two steps (web search → JSON) and only URLs the search returned survive',async t=>{const f=await fixture(t);
 f.setClaude((b,n)=>n===1?sse({usage:{server_tool_use:{web_search_requests:2}},content:[{type:'server_tool_use',id:'srvtoolu_1',name:'web_search',input:{query:'q'}},{type:'web_search_tool_result',tool_use_id:'srvtoolu_1',content:[{type:'web_search_result',url:'https://real.example/n',title:'Real',encrypted_content:'x',page_age:null}]},{type:'text',text:'Hallazgo confirmado.',citations:[{type:'web_search_result_location',url:'https://real.example/n',title:'Real',cited_text:'c',encrypted_index:'e'}]}]})
  :sse({content:[{type:'text',text:JSON.stringify({summary:'Resumen.',spoken:'Resumen.',key_points:['Hecho'],inference:null,event_date:null,sources:[{url:'https://real.example/n',title:'Real',published_date:null},{url:'https://invented.example/x',title:'Fake',published_date:null}],insufficient:false})}]}));
 const r=await f.request('/info/research',{method:'POST',cookie:f.cookie,body:{query:'noticias de negocios en Jalisco'}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
 assert.equal(f.sent.length,2);assert.ok(f.sent[0].body.tools.some(x=>x.type==='web_search_20260209'));assert.ok(!f.sent[0].body.output_config.format,'no JSON format with citations');assert.equal(f.sent[1].body.output_config.format.type,'json_schema');
 assert.deepEqual(j.sources.map(s=>s.url),['https://real.example/n']);assert.equal(j.dropped,1);assert.equal(j.provider,'claude');});

test('claudeSchema drops unsupported constraints and turns type arrays into anyOf; tiers map to effort',async()=>{const {claudeSchema,claudeCost}=await import('../src/claude.js');const {tierConfig}=await import('../src/tiers.js');
 const s=claudeSchema({type:'object',additionalProperties:false,required:['a','b'],properties:{a:{type:'integer',minimum:0,maximum:5},b:{type:['string','null'],maxLength:3,description:'d'},c:{type:'array',minItems:3,maxItems:7,items:{type:'string'}}}});
 assert.deepEqual(s.properties.a,{type:'integer'});assert.deepEqual(s.properties.b,{description:'d',anyOf:[{type:'string'},{type:'null'}]});assert.deepEqual(s.properties.c,{type:'array',items:{type:'string'}});
 const env={ANTHROPIC_API_KEY:'k'};assert.deepEqual(['chispa','enfoque','profundo'].map(x=>tierConfig(env,x).effort),['low','medium','high']);assert.equal(tierConfig(env,'enfoque').model,'claude-opus-5-5');
 assert.equal(tierConfig({OPENAI_API_KEY:'o'},'enfoque').provider,'openai');
 assert.equal(claudeCost({},{model:'claude-opus-5-5',usage:{input_tokens:1e6,output_tokens:1e6,cache_read_input_tokens:1e6,cache_creation_input_tokens:1e6,server_tool_use:{web_search_requests:2}}}),(4+20+0.2+5+0.02)*1e6);});
