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
 (msg.content||[]).forEach((b,i)=>{push('content_block_start',{index:i,content_block:{type:'text',text:'',citations:null}});for(const part of b.text.match(/.{1,7}/gs)||[])push('content_block_delta',{index:i,delta:{type:'text_delta',text:part}});push('content_block_stop',{index:i});});
 push('message_delta',{delta:{stop_reason:msg.stop_reason||'end_turn',stop_sequence:null},usage:{output_tokens:80}});push('message_stop',{});
 return new Response(ev.join(''),{headers:{'content-type':'text/event-stream'}});}
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
 const sent=[],oai=[];let reply='Listo, Sam: tu plan está **en marcha**.',ops={ops:[]},oaiSources=[];
 const fetcher=async(input,options={})=>{const url=typeof input==='string'?input:input.url;
  if(url.startsWith('https://api.openai.com/v1/responses')){const body=JSON.parse(options.body);oai.push(body);
   if(body.text?.format?.type==='json_schema'){const isProfile=!!body.text.format.schema.properties.profile;return Response.json({status:'completed',model:body.model,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(isProfile?{profile:'- Quiere su laptop en 2027'}:typeof ops==='function'?ops(body):ops)}]}],usage:{input_tokens:300,output_tokens:60}});}
   return oaiSse(typeof reply==='function'?reply(body):reply,oaiSources);}
  if(url.includes('grant_type=password'))return Response.json({user:{id:A},access_token:'acc',refresh_token:'ref',expires_in:3600});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:A});
  if(url.includes('/rest/v1/'))return postgrest(url,options);
  if(url.startsWith('https://api.anthropic.com')){const body=JSON.parse(options.body);sent.push(body);
   if(body.output_config?.format){const isProfile=!!body.output_config.format.schema.properties.profile;return sse({content:[{type:'text',text:JSON.stringify(isProfile?{profile:'- Quiere su laptop en 2027'}:typeof ops==='function'?ops(body):ops)}]});}
   return sse({content:[{type:'text',text:typeof reply==='function'?reply(body):reply}]});}
  throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});
 const request=(route,{method='GET',body,cookie,accept}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(accept?{Accept:accept}:{}),...(cookie?{Cookie:cookie,'X-Evie-User':A}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},env);
 const r=await request('/auth/signin',{method:'POST',body:{username:'owner-a',password:'synthetic-password'}});const cookie=r.headers.get('set-cookie').split(';')[0];
 const call=(route,o={})=>request('/chat'+route,{cookie,...o});
 return {request,call,cookie,sent,oai,env,db,setReply:f=>reply=f,setOps:o=>ops=o,setSources:s=>oaiSources=s};}
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
