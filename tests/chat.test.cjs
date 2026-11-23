'use strict';
// v10 · Chat + long-term memory end to end: Worker routes → (mini PostgREST over PGlite with the real migration and RLS)
// and a mocked Claude (SSE). Checks encryption at rest, streaming, regenerate/edit, conversation management, memory
// learning (add/update/forget with supersede), «Lo que Ivi sabe de ti» CRUD, private chats and the cross-device stamp.
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');const A='11111111-1111-4111-8111-111111111111';
let pg;
before(async()=>{const {PGlite}=await import('@electric-sql/pglite');pg=new PGlite();
 await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;grant usage on schema public to anon,authenticated;
  create function public.evie_guest_blocked() returns boolean language sql stable as $$select false$$;grant execute on function public.evie_guest_blocked() to authenticated;
  create function public.evie_sync_stamp() returns text language sql stable as $$select 'crm-1'$$;grant execute on function public.evie_sync_stamp() to authenticated;
  insert into auth.users values('${A}');`);
 await pg.exec(fs.readFileSync(path.join(root,'migrations/supabase/202611230001_ai_chat.sql'),'utf8'));});
after(async()=>{await pg?.close();});
// ---- mini PostgREST (only what src/ai-memory.js#supa uses), executed as the authenticated user ----
const SCALAR=new Set(['evie_chat_stamp','ai_truncate_messages','evie_sync_stamp']);
async function postgrest(url,options={}){const u=new URL(url),p=u.pathname.replace('/rest/v1/',''),method=options.method||'GET',body=options.body?JSON.parse(options.body):undefined;
 await pg.exec('reset role');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);await pg.exec('set role authenticated');
 try{
  if(p.startsWith('rpc/')){const fn=p.slice(4),keys=Object.keys(body||{}),args=keys.map((k,i)=>`${k}=>$${i+1}`).join(','),vals=keys.map(k=>typeof body[k]==='object'?JSON.stringify(body[k]):body[k]);
   if(SCALAR.has(fn)){const r=await pg.query(`select public.${fn}(${args}) as v`,vals);return Response.json(r.rows[0].v);}
   const r=await pg.query(`select * from public.${fn}(${args})`,vals);return Response.json(r.rows);}
  const where=[],vals=[];let order='',limit='';
  for(const [k,v] of u.searchParams){if(k==='select'||k==='on_conflict')continue;if(k==='order'){order=' order by '+v.split(',').map(x=>{const [c,d]=x.split('.');return `"${c}" ${d||'asc'}`;}).join(',');continue;}if(k==='limit'){limit=' limit '+Number(v);continue;}
   const [op,...rest]=v.split('.'),val=rest.join('.');if(op==='is'&&val==='null')where.push(`"${k}" is null`);else if(op==='eq'){vals.push(val);where.push(`"${k}"::text=$${vals.length}`);}else throw Error('filter '+v);}
  const W=where.length?' where '+where.join(' and '):'';
  let r;
  if(method==='GET')r=await pg.query(`select * from public.${p}${W}${order}${limit}`,vals);
  else if(method==='POST'){const rows=Array.isArray(body)?body:[body],out=[];for(const row of rows){const ks=Object.keys(row),vs=ks.map(k=>row[k]!==null&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]);const q=await pg.query(`insert into public.${p}(${ks.map(k=>`"${k}"`).join(',')}) values(${ks.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,vs);out.push(...q.rows);}return Response.json(out,{status:201});}
  else if(method==='PATCH'){const ks=Object.keys(body),sets=ks.map((k,i)=>`"${k}"=$${vals.length+i+1}`).join(',');r=await pg.query(`update public.${p} set ${sets}${W} returning *`,[...vals,...ks.map(k=>body[k])]);}
  else if(method==='DELETE')r=await pg.query(`delete from public.${p}${W} returning *`,vals);
  return Response.json(r.rows);
 }catch(e){return Response.json({message:e.message},{status:400});}finally{await pg.exec('reset role');}}
function sse(msg){const ev=[],push=(type,data)=>ev.push(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);
 push('message_start',{message:{id:'msg_x',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:500,output_tokens:1,cache_read_input_tokens:200,cache_creation_input_tokens:0}}});
 (msg.content||[]).forEach((b,i)=>{
  if(b.type==='tool_use'){push('content_block_start',{index:i,content_block:{type:'tool_use',id:b.id,name:b.name,input:{}}});push('content_block_delta',{index:i,delta:{type:'input_json_delta',partial_json:JSON.stringify(b.input)}});push('content_block_stop',{index:i});return;}
  if(b.type==='thinking'){push('content_block_start',{index:i,content_block:{type:'thinking',thinking:'',signature:''}});push('content_block_delta',{index:i,delta:{type:'thinking_delta',thinking:b.thinking}});push('content_block_delta',{index:i,delta:{type:'signature_delta',signature:b.signature}});push('content_block_stop',{index:i});return;}
  push('content_block_start',{index:i,content_block:{type:'text',text:'',citations:null}});for(const part of b.text.match(/.{1,7}/gs)||[])push('content_block_delta',{index:i,delta:{type:'text_delta',text:part}});push('content_block_stop',{index:i});});
 push('message_delta',{delta:{stop_reason:msg.stop_reason||'end_turn',stop_sequence:null},usage:{output_tokens:80}});push('message_stop',{});
 return new Response(ev.join(''),{headers:{'content-type':'text/event-stream'}});}
// OpenAI Responses stream that ends asking for function tools (store:false: reasoning comes with encrypted_content).
function oaiToolSse({text='',calls=[]}){const ev=[],push=o=>ev.push(`event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`);
 push({type:'response.created',response:{id:'resp_t',status:'in_progress'}});for(const part of text.match(/.{1,9}/gs)||[])push({type:'response.output_text.delta',delta:part});
 const output=[{type:'reasoning',id:'rs_1',summary:[],encrypted_content:'enc-reasoning-1'},...(text?[{type:'message',id:'msg_1',role:'assistant',status:'completed',content:[{type:'output_text',text,annotations:[]}]}]:[]),...calls.map((c,i)=>({type:'function_call',id:'fc_'+i,call_id:c.call_id,name:c.name,arguments:JSON.stringify(c.args),status:'completed'}))];
 push({type:'response.completed',response:{id:'resp_t',status:'completed',model:'gpt-6-luna',output,usage:{input_tokens:900,output_tokens:40}}});
 return new Response(ev.join(''),{headers:{'content-type':'text/event-stream'}});}
// Supabase Storage (user-media bucket) with the RLS rule: the first folder must be the token's user.
function storageMock(objects,log){return (url,options={})=>{const p=new URL(url).pathname.replace('/storage/v1/object/',''),method=options.method||'GET',h=options.headers||{};log.push({method,path:p,headers:h,body:options.body});
 if(h.Authorization!=='Bearer acc'||h.apikey!=='k')return Response.json({error:'Unauthorized'},{status:401});
 if(method==='DELETE'&&p==='user-media'){const {prefixes}=JSON.parse(options.body);if(prefixes.some(k=>!k.startsWith(A+'/')))return Response.json({error:'rls'},{status:403});for(const k of prefixes)objects.delete('user-media/'+k);return Response.json(prefixes.map(name=>({name})));}
 const key=p.replace(/^authenticated\//,'');if(!key.startsWith('user-media/'+A+'/'))return Response.json({error:'rls'},{status:403});
 if(method==='POST'){objects.set(key,{bytes:new Uint8Array(options.body),type:h['Content-Type']});return Response.json({Key:key});}
 if(method==='GET'){const o=objects.get(key);return o?new Response(o.bytes,{headers:{'content-type':o.type}}):Response.json({statusCode:'404',error:'not_found'},{status:400});}
 if(method==='DELETE'){objects.delete(key);return Response.json({message:'Successfully deleted'});}
 return Response.json({error:'method'},{status:405});};}
// OpenAI Responses API stream (used while there is no ANTHROPIC_API_KEY).
function oaiSse(text,sources=[]){const ev=[],push=o=>ev.push(`event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`);
 push({type:'response.created',response:{id:'resp_1',status:'in_progress'}});for(const part of text.match(/.{1,9}/gs)||[])push({type:'response.output_text.delta',delta:part});
 push({type:'response.completed',response:{id:'resp_1',status:'completed',model:'gpt-6-luna',output:[...(sources.length?[{type:'web_search_call',action:{type:'search',sources:sources.map(url=>({type:'url',url}))}}]:[]),{type:'message',content:[{type:'output_text',text,annotations:sources.map(url=>({type:'url_citation',url,title:'Fuente de prueba'}))}]}],usage:{input_tokens:1000,output_tokens:200,input_tokens_details:{cached_tokens:0}}}});
 return new Response(ev.join(''),{headers:{'content-type':'text/event-stream'}});}
async function fixture(t,extra={}){
 const {createAccounts}=await import('../src/accounts.js');
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(root,'migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),ANTHROPIC_API_KEY:'test-anthropic',...extra};
 const sent=[],oai=[],objects=new Map(),storage=[];let reply='Listo, Sam: tu plan está **en marcha**.',ops={ops:[]},oaiSources=[];const store=storageMock(objects,storage);
 const fetcher=async(input,options={})=>{const url=typeof input==='string'?input:input.url;
  if(url.startsWith('https://api.openai.com/v1/responses')){const body=JSON.parse(options.body);oai.push(body);
   if(body.text?.format?.type==='json_schema'){const isProfile=!!body.text.format.schema.properties.profile;return Response.json({status:'completed',model:body.model,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(isProfile?{profile:'- Quiere su laptop en 2027'}:typeof ops==='function'?ops(body):ops)}]}],usage:{input_tokens:300,output_tokens:60}});}
   const out=typeof reply==='function'?reply(body):reply;return out&&typeof out==='object'?oaiToolSse(out):oaiSse(out,oaiSources);}
  if(url.includes('grant_type=password'))return Response.json({user:{id:A},access_token:'acc',refresh_token:'ref',expires_in:3600});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:A});
  if(url.includes('/rest/v1/'))return postgrest(url,options);
  if(url.startsWith('https://provider.invalid/storage/v1/object/'))return store(url,options);
  if(url.startsWith('https://api.anthropic.com')){const body=JSON.parse(options.body);sent.push(body);
   if(body.output_config?.format){const isProfile=!!body.output_config.format.schema.properties.profile;return sse({content:[{type:'text',text:JSON.stringify(isProfile?{profile:'- Quiere su laptop en 2027'}:typeof ops==='function'?ops(body):ops)}]});}
   const out=typeof reply==='function'?reply(body):reply;return sse(out&&typeof out==='object'?out:{content:[{type:'text',text:out}]});}
  throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});
 const request=(route,{method='GET',body,cookie,accept}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(accept?{Accept:accept}:{}),...(cookie?{Cookie:cookie,'X-Evie-User':A}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},env);
 const r=await request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'}});const cookie=r.headers.get('set-cookie').split(';')[0];
 const call=(route,o={})=>request('/chat'+route,{cookie,...o});
 return {request,call,cookie,sent,oai,env,db,objects,storage,setReply:f=>reply=f,setOps:o=>ops=o,setSources:s=>oaiSources=s};}
const raw=async sql=>{await pg.exec('reset role');return (await pg.query(sql)).rows;};
function parseSSE(text){return text.split('\n\n').filter(Boolean).map(b=>{const ev=(b.match(/^event: (.*)$/m)||[])[1],d=(b.match(/^data: (.*)$/m)||[])[1];return {event:ev,data:d?JSON.parse(d):null};});}

test('conversation lifecycle: create, stream a reply (SSE), auto title, encrypted at rest, list/search/rename/pin/archive/delete',async t=>{const f=await fixture(t);
 const c=await (await f.call('/conversations',{method:'POST',body:{}})).json();assert.ok(c.conversation.id);assert.equal(c.conversation.title,'');
 const id=c.conversation.id;
 const r=await f.call(`/conversations/${id}/messages`,{method:'POST',accept:'text/event-stream',body:{text:'Ivi, ¿cómo voy con mi plan de ahorro para la laptop?',context:{name:'Sam',timezone:'America/Mexico_City',mode:'asistente',persona:{humor:'off'}}}});
 assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/event-stream/);
 const evs=parseSSE(await r.text());assert.equal(evs[0].event,'meta');assert.equal(evs[0].data.user_message.seq,1);
 const deltas=evs.filter(e=>e.event==='delta').map(e=>e.data.t);assert.ok(deltas.length>2,'streamed in pieces');assert.equal(deltas.join(''),'Listo, Sam: tu plan está **en marcha**.');
 const done=evs.find(e=>e.event==='done').data;assert.equal(done.message.seq,2);assert.equal(done.title,'Cómo voy con mi plan de ahorro para la laptop');
 const body=f.sent[0];assert.equal(body.model,'claude-opus-5-5');assert.equal(body.messages.at(-1).role,'system','per-turn note is a trailing system message');
 assert.equal(body.messages.at(-2).content[0].cache_control.type,'ephemeral','newest user turn is a cache breakpoint');assert.match(body.system.at(-1).text,/Canal: chat/);assert.match(body.system.at(-1).text,/Sin humor/);
 const stored=await raw(`select content_sealed from public.ai_messages where conversation_id='${id}'`);assert.equal(stored.length,2);assert.ok(stored.every(x=>!/ahorro|marcha/.test(x.content_sealed)),'no plaintext in Supabase');
 const [cv]=await raw(`select title_sealed from public.ai_conversations where id='${id}'`);assert.ok(cv.title_sealed&&!/laptop/.test(cv.title_sealed));
 const list=await (await f.call('/conversations')).json();assert.equal(list.conversations[0].title,'Cómo voy con mi plan de ahorro para la laptop');
 assert.equal((await (await f.call('/conversations?q=AHORRO')).json()).conversations.length,1);assert.equal((await (await f.call('/conversations?q=granja')).json()).conversations.length,0);
 const msgs=await (await f.call(`/conversations/${id}/messages`)).json();assert.deepEqual(msgs.messages.map(m=>[m.seq,m.role]),[[1,'user'],[2,'assistant']]);assert.equal(msgs.messages[1].meta.model,'claude-opus-5-5');
 await f.call(`/conversations/${id}`,{method:'PATCH',body:{title:'Misión laptop',pinned:true}});const l2=(await (await f.call('/conversations')).json()).conversations[0];assert.equal(l2.title,'Misión laptop');assert.equal(l2.pinned,true);
 await f.call(`/conversations/${id}`,{method:'PATCH',body:{archived:true}});assert.equal((await (await f.call('/conversations')).json()).conversations.length,0);assert.equal((await (await f.call('/conversations?archived=1')).json()).conversations.length,1);
 const st=await (await f.request('/data/stamp',{method:'POST',cookie:f.cookie,body:{}})).json();assert.match(st.chat,/^1\.\d+\|/);
 assert.equal((await (await f.call(`/conversations/${id}`,{method:'DELETE'})).json()).deleted,1);assert.equal((await raw(`select count(*)::int n from public.ai_messages where conversation_id='${id}'`))[0].n,0,'messages deleted with the chat');});

test('history, regenerate and edit-last; JSON mode for clients without SSE',async t=>{const f=await fixture(t);
 const id=(await (await f.call('/conversations',{method:'POST',body:{tier:'chispa'}})).json()).conversation.id;
 let n=0;f.setReply(()=>'Respuesta '+(++n));
 const a=await (await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'Primera pregunta'}})).json();assert.equal(a.text,'Respuesta 1');assert.equal(a.tier.id,'chispa');const chats=()=>f.sent.filter(b=>!b.output_config?.format);assert.equal(chats().at(-1).output_config.effort,'low');
 await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'Segunda pregunta'}});
 assert.deepEqual(chats().at(-1).messages.slice(0,3).map(m=>m.role),['user','assistant','user'],'history replayed as text');assert.equal(chats().at(-1).messages[1].content,'Respuesta 1');
 const g=await (await f.call(`/conversations/${id}/messages`,{method:'POST',body:{regenerate:true}})).json();assert.equal(g.text,'Respuesta 3');
 let m=(await (await f.call(`/conversations/${id}/messages`)).json()).messages;assert.deepEqual(m.map(x=>x.text),['Primera pregunta','Respuesta 1','Segunda pregunta','Respuesta 3']);
 await f.call(`/conversations/${id}/messages`,{method:'POST',body:{edit:true,text:'Segunda pregunta, corregida'}});
 m=(await (await f.call(`/conversations/${id}/messages`)).json()).messages;assert.deepEqual(m.map(x=>x.text),['Primera pregunta','Respuesta 1','Segunda pregunta, corregida','Respuesta 4']);assert.deepEqual(m.map(x=>x.seq),[1,2,3,4]);
 assert.equal((await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:''}})).status,400);
 assert.equal((await f.call('/conversations/not-a-uuid/messages')).status,400);});

test('memory engine: learns from an exchange (add), updates by superseding, forgets; private chats learn nothing',async t=>{const f=await fixture(t);
 const id=(await (await f.call('/conversations',{method:'POST',body:{}})).json()).conversation.id;
 f.setOps({ops:[{op:'add',id:null,kind:'goal',text:'Sam quiere comprar una laptop nueva en diciembre de 2027.',importance:5,confidence:0.95},{op:'add',id:null,kind:'fact',text:'Su contraseña es 1234',importance:3,confidence:1},{op:'update',id:'00000000-0000-4000-8000-000000000000',kind:'fact',text:'inventado',importance:3,confidence:1}]});
 await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'Quiero comprarme una laptop nueva para diciembre de 2027, ayúdame a planear.'}});
 let mem=await (await f.call('/memories')).json();assert.equal(mem.memories.length,1,'password and unknown-id ops are dropped');const goal=mem.memories[0];assert.equal(goal.kind,'goal');assert.equal(goal.importance,5);
 const extract=f.sent.find(b=>b.output_config?.format);assert.equal(extract.output_config.effort,'low');assert.match(extract.messages[0].content,/<intercambio>/);
 f.setOps(b=>({ops:[{op:'update',id:goal.id,kind:'goal',text:'Sam quiere comprar la laptop en noviembre de 2027.',importance:5,confidence:0.9}]}));
 await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'Cambio de planes: la laptop mejor para noviembre de 2027.'}});
 mem=await (await f.call('/memories')).json();assert.equal(mem.memories.length,1);assert.match(mem.memories[0].text,/noviembre/);
 const old=(await raw(`select superseded_by from public.ai_memories where id='${goal.id}'`))[0];assert.equal(old.superseded_by,mem.memories[0].id,'old fact superseded, not lost');
 const hist=await (await f.call(`/memories/${goal.id}/history`)).json();assert.ok(hist.history.some(h=>h.op==='update'&&/diciembre/.test(h.detail.before)));
 // The next chat sees the relevant memory in its per-turn note.
 f.setOps({ops:[]});await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'¿Cuánto debo ahorrar al mes para la laptop?'}});
 assert.match(f.sent.filter(b=>!b.output_config?.format).at(-1).messages.at(-1).content,/noviembre de 2027/);
 // Private chat: no memory in, nothing learned.
 const p=(await (await f.call('/conversations',{method:'POST',body:{private:true}})).json()).conversation.id;const before=f.sent.length;
 f.setOps({ops:[{op:'add',id:null,kind:'fact',text:'Esto no debe guardarse nunca jamás.',importance:3,confidence:1}]});
 await f.call(`/conversations/${p}/messages`,{method:'POST',body:{text:'Esto es privado, no lo guardes por favor, gracias.'}});
 const chatCall=f.sent.slice(before);assert.equal(chatCall.length,1,'no extraction call');assert.ok(!/memoria_usuario/.test(JSON.stringify(chatCall[0].messages)));assert.match(chatCall[0].system.at(-1).text,/CHAT PRIVADO/);
 assert.equal((await (await f.call('/memories')).json()).memories.length,1);});

test('«Lo que Ivi sabe de ti»: add, edit in place, forget and restore; memory profile regenerated after enough changes',async t=>{const f=await fixture(t);
 const a=await (await f.call('/memories',{method:'POST',body:{kind:'preference',text:'Prefiere explicaciones por audio.',importance:4}})).json();assert.equal(a.memory.kind,'preference');
 const e=await (await f.call(`/memories/${a.memory.id}`,{method:'PATCH',body:{text:'Prefiere explicaciones por audio y ejemplos prácticos.'}})).json();assert.equal(e.memory.id,a.memory.id);assert.match(e.memory.text,/ejemplos/);
 assert.equal((await (await f.call(`/memories/${a.memory.id}`,{method:'DELETE'})).json()).forgotten,true);assert.equal((await (await f.call('/memories')).json()).memories.length,0);
 const fg=await (await f.call('/memories?forgotten=1')).json();assert.equal(fg.forgotten.length,1);
 assert.equal((await (await f.call(`/memories/${a.memory.id}/restore`,{method:'POST',body:{}})).json()).restored,true);assert.equal((await (await f.call('/memories')).json()).memories.length,1);
 assert.equal((await f.call('/memories',{method:'POST',body:{text:'x'}})).status,400);
 // Engine: 5+ changes → profile regenerated and injected (cached block) into the next chat.
 const id=(await (await f.call('/conversations',{method:'POST',body:{}})).json()).conversation.id;
 f.setOps({ops:[1,2,3].map(i=>({op:'add',id:null,kind:'project',text:'Proyecto número '+i+' de prueba para la memoria.',importance:3,confidence:0.9}))});
 await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'Te cuento de mis tres proyectos nuevos de este mes, toma nota.'}});
 assert.equal((await (await f.call('/memories')).json()).profile,'- Quiere su laptop en 2027');
 f.setOps({ops:[]});await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'¿Qué sabes de mí?'}});
 const sys=f.sent.filter(b=>!b.output_config?.format).at(-1).system;assert.ok(sys.some(b=>/perfil_memoria/.test(b.text)&&/laptop en 2027/.test(b.text)));});

test('chat needs an AI provider and a session',async t=>{const f=await fixture(t,{ANTHROPIC_API_KEY:''});
 const id=(await (await f.call('/conversations',{method:'POST',body:{}})).json()).conversation.id;
 const r=await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'hola'}});assert.equal(r.status,503);assert.match((await r.json()).error,/IA no está configurada/);
 assert.equal((await f.request('/chat/conversations')).status,401);});

test('chat runs on OpenAI while there is no Claude key: same SSE contract, saved sealed, sources, memory learned with strict JSON',async t=>{
 const f=await fixture(t,{ANTHROPIC_API_KEY:'',OPENAI_API_KEY:'test-openai'});
 const id=(await (await f.call('/conversations',{method:'POST',body:{}})).json()).conversation.id;
 f.setOps({ops:[{op:'add',id:null,kind:'goal',text:'Quiere ahorrar para una laptop en 2027.',importance:4,confidence:0.9}]});
 const r=await f.call(`/conversations/${id}/messages`,{method:'POST',accept:'text/event-stream',body:{text:'Quiero ahorrar para una laptop en 2027, ¿cómo empiezo?'}});
 assert.equal(r.status,200);const raw=await r.text();
 assert.equal([...raw.matchAll(/event: delta\ndata: (.*)/g)].map(m=>JSON.parse(m[1]).t).join(''),'Listo, Sam: tu plan está **en marcha**.');
 const done=JSON.parse(raw.match(/event: done\ndata: (.*)/)[1]);assert.equal(done.model,'gpt-6-luna');assert.match(done.title,/^Quiero ahorrar para una laptop en 2027/);
 const call=f.oai.find(b=>b.stream===true);assert.equal(call.store,false);assert.match(call.instructions,/Ivi/);assert.match(call.instructions,/Hora local actual/);assert.deepEqual(call.input.map(m=>m.role),['user']);assert.equal(call.max_output_tokens,4000);
 const saved=(await (await f.call(`/conversations/${id}/messages`)).json()).messages;assert.equal(saved.at(-1).text,'Listo, Sam: tu plan está **en marcha**.');
 const ext=f.oai.find(b=>b.text?.format?.name==='memory_ops');assert.ok(ext,'memory extraction ran on OpenAI');assert.equal(ext.text.format.strict,true);
 const items=ext.text.format.schema.properties.ops.items;assert.equal(items.additionalProperties,false);assert.deepEqual(items.required,['op','id','kind','text','importance','confidence']);
 assert.ok((await (await f.call('/memories')).json()).memories.some(m=>/laptop en 2027/.test(m.text)));
 // follow-up turn carries the history; web search uses the hosted tool and returns verified-looking sources
 f.setSources(['https://example.org/tasas']);f.setReply('Según la fuente, la tasa subió.');
 const j=await (await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'Investiga en internet la tasa de ahorro actual',research:true}})).json();
 assert.equal(j.text,'Según la fuente, la tasa subió.');assert.deepEqual(j.sources.map(s=>s.host),['example.org']);
 const last=f.oai.filter(b=>b.stream===true).at(-1);assert.deepEqual(last.input.map(m=>m.role),['user','assistant','user']);assert.equal(last.tools[0].type,'web_search');});

// ---------- images in the chat + app tools (continuation flow) ----------
const PNG=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from('fake-png-pixels-for-tests')]);
const JPG=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.from('fake-jpeg-body-for-tests')]);
const WEBP=Buffer.concat([Buffer.from('RIFF'),Buffer.from([0x20,0,0,0]),Buffer.from('WEBPVP8 fake-webp')]);
const NAME=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpg)$/;
const upload=(f,bytes,mime)=>f.call('/attachments',{method:'POST',body:{mime,data:bytes.toString('base64')}});
const OPENAI={ANTHROPIC_API_KEY:'',OPENAI_API_KEY:'test-openai'};
const streams=f=>f.oai.filter(b=>b.stream===true);
const shape=input=>input.map(m=>m.type||(typeof m.content==='string'?m.role:m.role+':'+m.content.map(p=>p.type).join('+')));

test('helpers: magic bytes, strict base64 (native and fallback codecs), newest-first image picking',async()=>{const m=await import('../src/chat.js');
 assert.equal(m.sniffImage(PNG),'image/png');assert.equal(m.sniffImage(JPG),'image/jpeg');assert.equal(m.sniffImage(WEBP),'image/webp');assert.equal(m.sniffImage(Buffer.from('GIF89a-not-allowed')),null);
 const bytes=new Uint8Array(70000).map((_,i)=>i*7%256),b64=Buffer.from(bytes).toString('base64');
 assert.equal(m.toBase64(bytes),b64);assert.deepEqual(Buffer.from(m.fromBase64(b64)),Buffer.from(bytes));
 const B=globalThis.Buffer;let viaLoop,back;try{globalThis.Buffer=undefined;viaLoop=m.toBase64(bytes);back=m.fromBase64(b64);}finally{globalThis.Buffer=B;}
 assert.equal(viaLoop,b64,'btoa fallback');assert.deepEqual(Buffer.from(back),Buffer.from(bytes),'atob fallback');
 for(const bad of ['','abc','ab$c','YWJj\n','====','YWJjZA',null,42])assert.equal(m.fromBase64(bad),null,String(bad));
 assert.deepEqual(Buffer.from(m.fromBase64('data:image/png;base64,'+PNG.toString('base64'))),PNG);
 const turn=(role,n)=>({role,text:'x',images:Array.from({length:n},()=>crypto.randomUUID()+'.png')});
 assert.equal(m.pickImages([turn('user',2),turn('assistant',0),turn('user',1)]).size,3);
 const old=turn('user',3),recent=turn('user',2);assert.deepEqual([...m.pickImages([old,turn('assistant',0),recent])],recent.images,'newest turn first; an older one only if it fits whole');
 assert.equal(m.pickImages([turn('user',4)]).size,4);
 assert.deepEqual(m.historyMessages([{role:'user',text:'',images:old.images},{role:'assistant',text:'Veo un ticket.'}]),[{role:'user',content:'[Adjuntó 3 imágenes que ya no tienes a la vista.]'},{role:'assistant',content:'Veo un ticket.'}]);});

test('chat images: upload checks type, magic bytes and size; stored in <owner>/chat with the user token; served as bytes or JSON; guests get 403',async t=>{const f=await fixture(t,OPENAI);
 let r=await upload(f,PNG,'image/gif');assert.equal(r.status,415);
 r=await upload(f,JPG,'image/png');assert.equal(r.status,415,'magic bytes must match the declared type');assert.match((await r.json()).error,/no es una imagen válida/);
 r=await f.call('/attachments',{method:'POST',body:{mime:'image/png',data:'no es base64!'}});assert.equal(r.status,400);
 r=await f.call('/attachments',{method:'POST',body:{mime:'image/png',data:Buffer.concat([PNG,Buffer.alloc(6*1024*1024)]).toString('base64')}});assert.equal(r.status,413);assert.match((await r.json()).error,/6 MB/);
 r=await f.call('/attachments',{method:'POST',body:{mime:'image/png',data:'A'.repeat(8.5*1024*1024)}});assert.equal(r.status,413);assert.match((await r.json()).error,/6 MB/,'an 8.5 MB JSON body reaches the route (9 MB cap on this path)');
 r=await f.call('/memories',{method:'POST',body:{text:'x'.repeat(300*1024)}});assert.equal(r.status,413);assert.match((await r.json()).error,/supera el límite/,'other routes keep 256 KB');
 assert.equal(f.storage.length,0,'nothing reached Storage');
 r=await upload(f,PNG,'image/png');assert.equal(r.status,201);const {name,mime,size}=await r.json();assert.match(name,NAME);assert.ok(name.endsWith('.png'));assert.equal(mime,'image/png');assert.equal(size,PNG.length);
 const put=f.storage.at(-1);assert.equal(put.method,'POST');assert.equal(put.path,`user-media/${A}/chat-${name}`);assert.equal(put.headers.Authorization,'Bearer acc','the user\'s own token, never a service key');assert.equal(put.headers.apikey,'k');assert.equal(put.headers['Content-Type'],'image/png');assert.deepEqual(Buffer.from(put.body),PNG);
 assert.ok((await (await upload(f,WEBP,'image/webp')).json()).name.endsWith('.webp'));const jpg=(await (await upload(f,JPG,'image/jpeg')).json()).name;assert.ok(jpg.endsWith('.jpg'));
 r=await f.call('/attachments/'+name,{accept:'image/*'});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.match(r.headers.get('cache-control'),/private/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await r.arrayBuffer()),PNG);
 assert.equal(f.storage.at(-1).path,`authenticated/user-media/${A}/chat-${name}`);
 const js=await (await f.call('/attachments/'+name,{accept:'application/json'})).json();assert.equal(js.mime,'image/png');assert.deepEqual(Buffer.from(js.data,'base64'),PNG,'JSON for the desktop proxy');
 assert.equal((await f.call('/attachments/00000000-0000-4000-8000-000000000000.png',{accept:'image/*'})).status,404);
 for(const bad of ['x.png',name.toUpperCase(),name.replace('.png','.gif'),name+'.png'])assert.equal((await f.call('/attachments/'+bad,{accept:'image/*'})).status,400,bad);
 assert.equal((await (await f.call('/attachments/'+jpg,{method:'DELETE'})).json()).deleted,true);assert.ok(!f.objects.has(`user-media/${A}/chat-${jpg}`),'an unsent upload can be removed');
 assert.ok(f.storage.every(x=>x.path===`user-media/${A}/chat-${x.path.split('/').pop().replace(/^chat-/,'')}`||x.path===`authenticated/user-media/${A}/chat-${x.path.split('/').pop().replace(/^chat-/,'')}`),'only the owner\'s chat folder');
 // Production Storage RLS (evie_media_owner_guard, RESTRICTIVE) only accepts <uid>/<name>.<ext>: no subfolders.
 assert.ok(f.storage.filter(x=>x.path!=='user-media').every(x=>/^[0-9a-f-]{36}\/[a-zA-Z0-9-]{1,86}\.(webp|png|jpg|jpeg)$/.test(x.path.replace(/^(authenticated\/)?user-media\//,''))),'object names satisfy the Storage RLS name rule');
 f.db.prepare("INSERT INTO guest_accounts(owner_id,display_name,invite_id,created_by,redeemed_at,expires_at,status) VALUES(?,?,?,?,?,?,'active')").run(A,'Invitada','inv-1',A,Date.now(),Date.now()+3600000);
 r=await upload(f,PNG,'image/png');assert.equal(r.status,403);assert.match((await r.json()).error,/invitado/);
 assert.equal((await f.call('/attachments/'+name,{accept:'image/*'})).status,403);
 const id=(await (await f.call('/conversations',{method:'POST',body:{}})).json()).conversation.id;
 r=await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'mira',attachments:[name]}});assert.equal(r.status,403);assert.match((await r.json()).error,/invitado/);});

test('messages with images: names sealed; newest image turns go as bytes (≤4), older ones as a note; edit and regenerate keep them; deleting the chat deletes them',async t=>{const f=await fixture(t,OPENAI);
 const id=(await (await f.call('/conversations',{method:'POST',body:{}})).json()).conversation.id;
 const names=[];for(let i=0;i<5;i++)names.push((await (await upload(f,PNG,'image/png')).json()).name);
 assert.equal((await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'',attachments:names}})).status,400,'max 4 per message');
 assert.equal((await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'',attachments:['../../x.png']}})).status,400);
 assert.equal((await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:''}})).status,400,'text or images');
 f.setReply('Veo tres fotos de un ticket.');
 const a=await (await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'',attachments:names.slice(0,3)}})).json();
 assert.equal(a.text,'Veo tres fotos de un ticket.');assert.equal(a.title,'Análisis de imagen');
 let call=streams(f).at(-1);assert.deepEqual(shape(call.input),['user:input_image+input_image+input_image'],'image-only turn: no empty text part');
 assert.equal(call.input[0].content[0].image_url,'data:image/png;base64,'+PNG.toString('base64'));assert.match(call.instructions,/Imágenes: puedes ver/);
 assert.equal(call.tools,undefined,'clients that do not send tools:true get no app tools');assert.match(call.instructions,/En el chat no tienes las herramientas/);
 f.setReply('Dos más.');await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'Y estas dos',attachments:names.slice(3,5)}});
 f.setReply('Suman 980.');await f.call(`/conversations/${id}/messages`,{method:'POST',body:{edit:true,text:'Y estas dos, ¿cuánto suman?'}});
 let msgs=(await (await f.call(`/conversations/${id}/messages`)).json()).messages;assert.equal(msgs.length,4);assert.equal(msgs[2].text,'Y estas dos, ¿cuánto suman?');assert.deepEqual(msgs[2].images,names.slice(3,5),'edit keeps the images');assert.deepEqual(msgs[0].images,names.slice(0,3));assert.deepEqual(msgs[1].images,[]);
 assert.deepEqual(shape(streams(f).at(-1).input).at(-1),'user:input_text+input_image+input_image');
 f.setReply('Claro.');await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'¿Cuál es el total de todo?'}});
 call=streams(f).at(-1);assert.deepEqual(shape(call.input),['user','assistant','user:input_text+input_image+input_image','assistant','user'],'newest image turn as bytes, the older one as a note');
 assert.match(call.input[0].content,/Adjuntó 3 imágenes que ya no tienes a la vista/);
 await f.call(`/conversations/${id}/messages`,{method:'POST',body:{regenerate:true}});assert.deepEqual(shape(streams(f).at(-1).input),shape(call.input),'regenerate sends the same images');
 const rows=await raw(`select content_sealed,meta from public.ai_messages where conversation_id='${id}'`);assert.ok(rows.every(x=>!names.some(n=>x.content_sealed.includes(n)||JSON.stringify(x.meta).includes(n))),'names only inside the sealed content');
 const before=f.storage.length;assert.equal((await (await f.call(`/conversations/${id}`,{method:'DELETE'})).json()).deleted,1);
 const del=f.storage.slice(before).find(x=>x.method==='DELETE');assert.equal(del.path,'user-media');assert.deepEqual(JSON.parse(del.body).prefixes.sort(),names.map(n=>`${A}/chat-${n}`).sort());
 assert.ok(names.every(n=>!f.objects.has(`user-media/${A}/chat-${n}`)),'the chat\'s images are gone');});

test('app tools on OpenAI: the stream ends with «tools» + a sealed continuation; /continue replays reasoning + calls + outputs and saves the answer once, with receipts',async t=>{const f=await fixture(t,OPENAI);
 const {seal,unseal}=await import('../src/accounts.js');const key=f.env.EVIE_SESSION_KEY;
 const id=(await (await f.call('/conversations',{method:'POST',body:{}})).json()).conversation.id;
 const args={type:'expense',amount:250,title:'Comida',account:null,category:'Comida',date:null,soma_client_name:null};
 f.setReply(b=>b.input.some(x=>x.type==='function_call_output')?'Listo, quedó en Finanzas: $250 en Comida.':{calls:[{call_id:'call_1',name:'log_transaction',args}]});
 const evs=parseSSE(await (await f.call(`/conversations/${id}/messages`,{method:'POST',accept:'text/event-stream',body:{text:'hoy me gasté 250 en comida, ¿lo puedes poner en finanzas?',tools:true}})).text());
 assert.deepEqual(evs.map(e=>e.event),['meta','tools']);const tools=evs[1].data;
 assert.equal(tools.round,1);assert.deepEqual(tools.calls,[{call_id:'call_1',name:'log_transaction',arguments:JSON.stringify(args)}]);assert.ok(!/Comida|enc-reasoning/.test(tools.continuation),'the continuation is sealed');
 const first=streams(f).at(-1);
 assert.deepEqual(first.tools.map(x=>x.name).sort(),['edit_record','get_agenda','get_business_summary','get_finance_summary','get_goals','get_gym_summary','get_habits','get_today_overview','list_accounts','log_transaction','log_workout','search_records','transfer_money']);
 assert.ok(first.tools.every(x=>x.type==='function'&&x.strict===true&&x.parameters.additionalProperties===false&&x.parameters.required.length===Object.keys(x.parameters.properties).length));
 assert.equal(first.parallel_tool_calls,true);assert.ok(first.include.includes('reasoning.encrypted_content'));assert.equal(first.store,false);
 const er=first.tools.find(x=>x.name==='edit_record');assert.deepEqual(er.parameters.properties.op.enum,['agenda.create']);assert.deepEqual(Object.keys(er.parameters.properties),['op','title','date','time','priority','notes']);
 assert.match(first.instructions,/Herramientas en el chat/);assert.match(first.instructions,/status created/);assert.ok(!/En el chat no tienes las herramientas/.test(first.instructions));
 assert.equal((await (await f.call(`/conversations/${id}/messages`)).json()).messages.length,1,'nothing saved for Ivi until the end');
 const output=JSON.stringify({status:'created',account:'Efectivo',balance:'saldo estimado $750.00',summary:'Listo: gasto de $250.00 de Efectivo · Comida.'});
 const ev2=parseSSE(await (await f.call(`/conversations/${id}/continue`,{method:'POST',accept:'text/event-stream',body:{continuation:tools.continuation,outputs:[{call_id:'call_1',output,summary:'Gasto registrado · $250 · Comida · Efectivo'}],context:{timezone:'America/Mexico_City'}}})).text());
 assert.equal(ev2[0].event,'meta');assert.equal(ev2[0].data.round,1);assert.ok(ev2.some(e=>e.event==='delta'));assert.equal(ev2.at(-1).event,'done');
 const done=ev2.at(-1).data;assert.equal(done.text,'Listo, quedó en Finanzas: $250 en Comida.');assert.match(done.title,/^Hoy me gasté 250 en comida/);
 assert.deepEqual(done.actions,[{id:'call_1',name:'log_transaction',status:'created',summary:'Gasto registrado · $250 · Comida · Efectivo'}]);
 const second=streams(f).at(-1);assert.deepEqual(shape(second.input),['user','reasoning','function_call','function_call_output']);
 assert.equal(second.input[1].encrypted_content,'enc-reasoning-1');assert.equal(second.input[2].call_id,'call_1');assert.deepEqual(second.input[3],{type:'function_call_output',call_id:'call_1',output});assert.equal(second.tool_choice,undefined);
 const msgs=(await (await f.call(`/conversations/${id}/messages`)).json()).messages;assert.equal(msgs.length,2);assert.deepEqual(msgs[1].meta.actions,done.actions,'receipts come back after reload');
 const [stored]=await raw(`select content_sealed,meta from public.ai_messages where conversation_id='${id}' and role='assistant'`);assert.ok(!/Comida|Gasto registrado|actions/.test(stored.content_sealed+JSON.stringify(stored.meta)),'receipts sealed, never in the plaintext meta');
 assert.equal(f.db.prepare("SELECT amount FROM ai_usage WHERE kind='chat'").get().amount,2,'each model call is metered');
 assert.equal(f.oai.filter(b=>b.text?.format?.name==='memory_ops').length,1,'memory learns once, from the finished exchange');
 // replays, forgeries, foreign / stale / over-limit continuations are refused before any model call
 const calls0=streams(f).length;
 assert.equal((await f.call(`/conversations/${id}/continue`,{method:'POST',body:{continuation:tools.continuation,outputs:[]}})).status,409,'already answered');
 let r=await f.call(`/conversations/${id}/continue`,{method:'POST',body:{continuation:'x'.repeat(300*1024),outputs:[]}});assert.equal(r.status,400,'a 300 KB body reaches the route (1 MB cap on /continue)');
 r=await f.call(`/conversations/${id}/continue`,{method:'POST',body:{continuation:'x'.repeat(1100*1024),outputs:[]}});assert.equal(r.status,413);
 f.setReply(b=>b.input.some(x=>x.type==='function_call_output')?'Vas bien este mes.':{calls:[{call_id:'call_2',name:'get_finance_summary',args:{period:'month'}}]});
 const pend=parseSSE(await (await f.call(`/conversations/${id}/messages`,{method:'POST',accept:'text/event-stream',body:{text:'¿Cómo voy este mes?',tools:true}})).text()).find(e=>e.event==='tools').data;
 const pack=await unseal(pend.continuation,key),forge=async patch=>f.call(`/conversations/${id}/continue`,{method:'POST',body:{continuation:await seal({...pack,...patch},key),outputs:[{call_id:'call_2',output:'{}'}]}});
 assert.equal((await forge({o:'22222222-2222-4222-8222-222222222222'})).status,403);assert.equal((await forge({c:'33333333-3333-4333-8333-333333333333'})).status,403);
 assert.equal((await forge({t:Date.now()-11*60*1000})).status,409);assert.equal((await forge({p:'claude'})).status,409);assert.equal((await forge({r:4})).status,400);assert.equal((await forge({seq:99})).status,409);assert.equal((await forge({v:2})).status,400);
 assert.equal(streams(f).length,calls0+1,'no model call for refused continuations');
 // a call the browser did not answer still gets a result (the API requires one); reads leave no receipt
 const j=await (await f.call(`/conversations/${id}/continue`,{method:'POST',body:{continuation:pend.continuation,outputs:[]}})).json();assert.equal(j.text,'Vas bien este mes.');assert.deepEqual(j.actions,[]);
 const lastOut=streams(f).at(-1).input.at(-1);assert.equal(lastOut.type,'function_call_output');assert.equal(lastOut.call_id,'call_2');assert.match(lastOut.output,/No se ejecutó/);});

test('app tools: at most 3 tool rounds (the last asks for tool_choice none); private chats may use tools but never learn',async t=>{const f=await fixture(t,OPENAI);
 const id=(await (await f.call('/conversations',{method:'POST',body:{private:true}})).json()).conversation.id;let n=0;
 f.setReply(b=>b.tool_choice==='none'?'Con lo que tengo: vas bien hoy.':{calls:[{call_id:'call_r'+(++n),name:'get_today_overview',args:{}}]});
 let j=await (await f.call(`/conversations/${id}/messages`,{method:'POST',body:{text:'Revisa todo lo de hoy y dime cómo voy, porfa',tools:true}})).json();
 for(let round=1;round<=3;round++){assert.equal(j.tools.round,round);j=await (await f.call(`/conversations/${id}/continue`,{method:'POST',body:{continuation:j.tools.continuation,outputs:j.tools.calls.map(c=>({call_id:c.call_id,output:JSON.stringify({date:'2026-11-22',pending_today:[]})}))}})).json();}
 assert.equal(j.tools,undefined);assert.equal(j.text,'Con lo que tengo: vas bien hoy.');
 const calls=streams(f);assert.equal(calls.length,4);assert.deepEqual(calls.map(b=>b.tool_choice||'auto'),['auto','auto','auto','none']);
 assert.equal(calls.at(-1).input.filter(x=>x.type==='function_call_output').length,3,'every round is replayed');assert.match(calls[0].instructions,/CHAT PRIVADO/);
 assert.equal(f.oai.filter(b=>b.text?.format).length,0,'private chat: no memory learning');
 const msgs=(await (await f.call(`/conversations/${id}/messages`)).json()).messages;assert.deepEqual(msgs.map(m=>m.role),['user','assistant']);});

test('app tools on Claude: thinking + tool_use replayed verbatim with the tool_result; images go as base64 blocks with the cache breakpoint',async t=>{const f=await fixture(t);
 const id=(await (await f.call('/conversations',{method:'POST',body:{}})).json()).conversation.id;
 const img=(await (await upload(f,JPG,'image/jpeg')).json()).name;
 const input={type:'expense',amount:250,title:'Comida',account:null,category:'Comida',date:null,soma_client_name:null};
 f.setReply(b=>{const last=b.messages.at(-1);return Array.isArray(last.content)&&last.content.some(x=>x.type==='tool_result')?{content:[{type:'text',text:'Listo: $250 en Comida.'}]}:{stop_reason:'tool_use',content:[{type:'thinking',thinking:'Registro el gasto del ticket.',signature:'sig-123'},{type:'tool_use',id:'toolu_01',name:'log_transaction',input}]};});
 const evs=parseSSE(await (await f.call(`/conversations/${id}/messages`,{method:'POST',accept:'text/event-stream',body:{text:'Registra este ticket',attachments:[img],tools:true}})).text());
 assert.deepEqual(evs.map(e=>e.event),['meta','tools']);const tools=evs[1].data;assert.deepEqual(tools.calls,[{call_id:'toolu_01',name:'log_transaction',arguments:JSON.stringify(input)}]);
 const chats=()=>f.sent.filter(b=>!b.output_config?.format),first=chats()[0],user=first.messages[0];
 assert.deepEqual(user.content[0],{type:'image',source:{type:'base64',media_type:'image/jpeg',data:JPG.toString('base64')}});assert.equal(user.content.at(-1).type,'text');assert.equal(user.content.at(-1).cache_control.type,'ephemeral');
 assert.ok(first.tools.some(x=>x.name==='log_transaction'&&x.input_schema?.type==='object'));assert.ok(first.tools.some(x=>x.name==='get_current_time'));assert.match(first.system.at(-1).text,/Herramientas en el chat/);
 const out=JSON.stringify({status:'created',account:'Efectivo',summary:'Listo: gasto de $250.00 de Efectivo · Comida.'});
 const ev2=parseSSE(await (await f.call(`/conversations/${id}/continue`,{method:'POST',accept:'text/event-stream',body:{continuation:tools.continuation,outputs:[{call_id:'toolu_01',output:out,summary:'Gasto registrado · $250 · Comida · Efectivo'}]}})).text());
 assert.equal(ev2.at(-1).event,'done');const done=ev2.at(-1).data;assert.equal(done.text,'Listo: $250 en Comida.');assert.equal(done.actions[0].summary,'Gasto registrado · $250 · Comida · Efectivo');assert.equal(done.actions[0].status,'created');
 const second=chats()[1];assert.deepEqual(second.messages.map(m=>m.role),['user','system','assistant','user']);
 assert.deepEqual(second.messages[2].content,[{type:'thinking',thinking:'Registro el gasto del ticket.',signature:'sig-123'},{type:'tool_use',id:'toolu_01',name:'log_transaction',input}]);
 assert.deepEqual(second.messages[3].content,[{type:'tool_result',tool_use_id:'toolu_01',content:out}]);
 assert.equal(second.messages[0].content[0].source.data,JPG.toString('base64'),'the image goes again on the next round');
 const saved=(await (await f.call(`/conversations/${id}/messages`)).json()).messages;assert.deepEqual(saved[0].images,[img]);assert.equal(saved[1].meta.actions.length,1);});
