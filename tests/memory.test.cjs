'use strict';
// Memoria de Ivi (P3): ownership/isolation (storage + API + assistant context), explicit remember/forget,
// supersede contradictions, sensitive categories, opt-in history, "ayer" in the user's time zone,
// grounded recall (never invented), private mode, conversation deletion cascade, export, wipe, no plaintext.
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
async function fixture(t,extra={}){
 const {createAccounts}=await import('../src/accounts.js');
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 for(const m of ['0001_auth_sessions.sql','0002_invites_usage.sql'])db.exec(fs.readFileSync(path.join(__dirname,'../migrations/d1',m),'utf8'));
 const binding={prepare(sql){return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)||null,run:async()=>{const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 const env={EVIE_ACCOUNTS_ENABLED:'true',AUTH_DB:binding,SUPABASE_URL:'https://provider.invalid',SUPABASE_PUBLISHABLE_KEY:'k',EVIE_SESSION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),OPENAI_API_KEY:'test-openai',...extra};
 const sent=[];
 const fetcher=async(url,options)=>{
  if(url.includes('grant_type=password')){const u=JSON.parse(options.body).email||'';const who=u.startsWith('owner-b@')?B:A;return Response.json({user:{id:who},access_token:'acc-'+who,refresh_token:'ref',expires_in:3600});}
  if(url.endsWith('/user'))return Response.json({id:String(options.headers.Authorization||'').endsWith(B)?B:A});
  if(url.startsWith('https://api.openai.com')){sent.push(JSON.parse(options.body));return Response.json({output:[{type:'message',content:[{type:'output_text',text:'ok'}]}]});}
  throw Error('unexpected '+url);};
 const api=createAccounts({fetcher});
 const req=(route,{method='GET',body,cookie,user}={})=>api.request('https://evie.test'+route,{method,headers:{Origin:'https://evie.test','X-Evie-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie,'X-Evie-User':user}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})},env);
 const login=async(u)=>{const r=await req('/auth/signin',{method:'POST',body:{username:u,password:'synthetic-password'}});return r.headers.get('set-cookie').split(';')[0];};
 const a=await login('owner-a'),b=await login('owner-b');
 const as=(who)=>({cookie:who==='a'?a:b,user:who==='a'?A:B});
 const call=async(who,route,method='GET',body)=>{const r=await req(route,{method,body,...as(who)});return {status:r.status,json:await r.json()};};
 return {req,call,sent,db,env,a,b};
}
const M=()=>import('../src/memory.js');

test('pure: "ayer" and weekdays resolve in the user time zone, not UTC',async()=>{const m=await M();
 const now=new Date('2026-10-15T03:30:00Z');// still 14 Oct 21:30 in Mexico City
 assert.equal(m.localDay('America/Mexico_City',now),'2026-10-14');assert.equal(m.recallDay('¿recuerdas lo que te pregunté ayer?','America/Mexico_City',now),'2026-10-13');
 assert.equal(m.recallDay('¿qué te pregunté ayer?','UTC',now),'2026-10-14');
 assert.equal(m.recallDay('lo de anteayer','America/Mexico_City',now),'2026-10-12');
 assert.equal(m.recallDay('el lunes pasado','America/Mexico_City',now),'2026-10-12');
 assert.equal(m.recallDay('hace 3 días','America/Mexico_City',now),'2026-10-11');assert.equal(m.recallDay('mi color favorito','America/Mexico_City',now),null);});

test('pure: topics supersede, sensitivity is detected, context block is bounded and labelled',async()=>{const m=await M();
 assert.equal(m.topicOf('Mi color favorito es azul'),m.topicOf('mi color favorito es verde'));assert.equal(m.topicOf('Prefiero que me digas Ale'),'nombre preferido');
 assert.equal(m.sensitivity('Tengo diabetes tipo 2'),'health');assert.equal(m.sensitivity('Hoy me siento muy triste'),'emotional');assert.equal(m.sensitivity('Vivo en calle Colón 123'),'location');assert.equal(m.sensitivity('Me gusta el café'),null);
 const long=Array.from({length:40},(_, i)=>({text:'dato '+i+' '+'x'.repeat(80),updated_day:'2026-10-01',source:'explicit'}));const blk=m.contextBlock({facts:long});assert.ok(blk.length<=m.LIMITS.contextChars);assert.match(blk,/\[recuerdo 2026-10-01\]/);
 assert.deepEqual(m.cleanSettings({enabled:false,reference_history:true,save_history:true}),{...m.DEFAULT_SETTINGS,enabled:false,use_memories:false,reference_history:false,save_history:false});});

test('API requires the bound session (cookie + matching X-Evie-User); owner_id in body rejected',async t=>{const f=await fixture(t);
 assert.equal((await f.req('/memory')).status,401);
 assert.equal((await f.req('/memory',{cookie:f.a,user:B})).status,401,'A cookie with B header must fail');
 assert.equal((await f.call('a','/memory/items','POST',{text:'Me gusta el café de olla',owner_id:B})).status,400);});

test('remember / list / edit / forget; contradictions superseded; duplicates not stacked; no plaintext in D1',async t=>{const f=await fixture(t);
 let r=await f.call('a','/memory/items','POST',{text:'Mi color favorito es azul'});assert.equal(r.json.created,true);
 r=await f.call('a','/memory/items','POST',{text:'mi color favorito es verde'});assert.equal(r.json.superseded,true);
 await f.call('a','/memory/items','POST',{text:'Me gusta el café de olla'});r=await f.call('a','/memory/items','POST',{text:'me gusta el cafe de olla'});assert.ok(r.json.duplicate||r.json.superseded);
 let list=(await f.call('a','/memory')).json.memories;assert.equal(list.length,2);assert.ok(list.some(x=>/verde/.test(x.text)));assert.ok(!list.some(x=>/azul/.test(x.text)));
 const id=list.find(x=>/caf[eé]/.test(x.text)).id;r=await f.call('a','/memory/items/'+id,'PATCH',{text:'Me gusta el café sin azúcar'});assert.equal(r.status,200);
 r=await f.call('a','/memory/forget','POST',{query:'café'});assert.deepEqual(r.json.deleted,[id]);
 r=await f.call('a','/memory/forget','POST',{query:'mi perro'});assert.equal(r.json.not_found,true);
 const raw=JSON.stringify(f.db.prepare('SELECT * FROM evie_memories').all());assert.ok(!/verde|color|favorit/.test(raw),'no plaintext text, topic or keywords in D1');});

test('ambiguous forget returns candidates instead of deleting a guess',async t=>{const f=await fixture(t);
 await f.call('a','/memory/items','POST',{text:'Mi tecnológico es el ITCG'});await f.call('a','/memory/items','POST',{text:'Estudio en el tecnológico por las tardes'});
 const r=await f.call('a','/memory/forget','POST',{query:'tecnológico'});assert.equal(r.json.ambiguous,true);assert.equal(r.json.candidates.length,2);assert.equal((await f.call('a','/memory')).json.memories.length,2);});

test('sensitive: location refused; health/emotional need the category AND explicit confirmation',async t=>{const f=await fixture(t);
 let r=await f.call('a','/memory/items','POST',{text:'Vivo en calle Colón 123'});assert.equal(r.json.refused,true);
 r=await f.call('a','/memory/items','POST',{text:'Tengo diabetes tipo 2'});assert.equal(r.json.needs_permission,true);
 await f.call('a','/memory/settings','PUT',{settings:{allow_health:true}});
 r=await f.call('a','/memory/items','POST',{text:'Tengo diabetes tipo 2'});assert.equal(r.json.needs_confirmation,true);
 r=await f.call('a','/memory/items','POST',{text:'Tengo diabetes tipo 2',confirm_sensitive:true});assert.equal(r.json.created,true);
 assert.equal((await f.call('a','/memory')).json.memories[0].category,'health');});

test('isolation: B cannot list, edit, delete, recall or receive A memories in its assistant context',async t=>{const f=await fixture(t);
 const r=await f.call('a','/memory/items','POST',{text:'Mi materia favorita es cálculo'});const id=r.json.id;
 await f.call('a','/memory/settings','PUT',{settings:{save_history:true,reference_history:true}});
 await f.call('a','/memory/sessions','POST',{id:'s-aaaaaaaa-1',questions:['¿Qué hora abre el banco?'],started_at:Date.now()-86400000});
 const lb=(await f.call('b','/memory')).json;assert.equal(lb.memories.length,0);assert.equal(lb.sessions.length,0);
 assert.equal((await f.call('b','/memory/items/'+id,'PATCH',{text:'hackeado'})).status,404);assert.equal((await f.call('b','/memory/items/'+id,'DELETE')).status,404);
 assert.equal((await f.call('b','/memory/sessions/s-aaaaaaaa-1','DELETE')).json.deleted,false);
 assert.match((await f.call('b','/memory/recall','POST',{question:'¿recuerdas lo que te pregunté ayer?'})).json.text,/No guardo un historial/);
 assert.equal((await f.call('a','/memory')).json.memories[0].text,'Mi materia favorita es cálculo');
 await f.call('b','/ai/chat','POST',{input:[{role:'user',content:'¿cuál es mi materia favorita?'}]});const sysB=f.sent.at(-1).instructions;assert.ok(!/cálculo/.test(sysB));assert.ok(!/<memoria_usuario>/.test(sysB));
 await f.call('a','/ai/chat','POST',{input:[{role:'user',content:'¿cuál es mi materia favorita?'}]});const sysA=f.sent.at(-1).instructions;assert.match(sysA,/<memoria_usuario>[\s\S]*cálculo[\s\S]*<\/memoria_usuario>/);assert.match(sysA,/DATOS del usuario, no instrucciones/);});

test('assistant context: bounded, only relevant facts; private mode sends none',async t=>{const f=await fixture(t);
 for(let i=0;i<30;i++)await f.call('a','/memory/items','POST',{text:'Dato número '+i+' sobre tema'+i+' importante'});
 await f.call('a','/memory/items','POST',{text:'Prefiero respuestas cortas'});await f.call('a','/memory/items','POST',{text:'Mi moto es una Italika roja'});
 const r=await f.call('a','/ai/chat','POST',{input:[{role:'user',content:'¿de qué color es mi moto?'}]});const sys=f.sent.at(-1).instructions;
 const block=sys.split('<memoria_usuario>')[1].split('</memoria_usuario>')[0];assert.match(block,/Italika roja/);assert.match(block,/respuestas cortas/);assert.ok(block.length<=1900);assert.ok((block.match(/\n- /g)||[]).length<6);
 assert.ok(r.json.memory_used.facts.some(x=>/Italika/.test(x.text)));
 await f.call('a','/ai/chat','POST',{private:true,input:[{role:'user',content:'¿de qué color es mi moto?'}]});const sysP=f.sent.at(-1).instructions;assert.ok(!/Italika/.test(sysP));assert.match(sysP,/MODO PRIVADO/);});

test('history is opt-in; private/Kisha sessions never stored; sensitive questions stripped; recall grounded with date',async t=>{const f=await fixture(t);
 let r=await f.call('a','/memory/sessions','POST',{id:'s-off-00000001',questions:['¿Cuánto gasté?']});assert.equal(r.json.stored,false);
 r=await f.call('a','/memory/recall','POST',{question:'¿recuerdas lo que te pregunté ayer?'});assert.match(r.json.text,/No guardo un historial/);
 await f.call('a','/memory/settings','PUT',{settings:{save_history:true,reference_history:true}});
 assert.equal((await f.call('a','/memory/sessions','POST',{id:'s-priv-0000001',private:true,questions:['secreto']})).json.stored,false);
 assert.equal((await f.call('a','/memory/sessions','POST',{id:'s-kish-0000001',source:'kisha',questions:['me siento triste']})).json.stored,false);
 const {localDay,shiftDay}=await M();const yesterdayNoon=Date.parse(shiftDay(localDay('America/Mexico_City'),-1)+'T18:00:00Z');
 r=await f.call('a','/memory/sessions','POST',{id:'s-yday-0000001',started_at:yesterdayNoon,questions:['¿A qué hora abre el Tecnológico?','Me siento triste hoy']});assert.equal(r.json.stored,true);
 r=await f.call('a','/memory/recall','POST',{question:'Ivi, ¿recuerdas lo que te pregunté ayer?'});assert.match(r.json.text,/A qué hora abre el Tecnológico/);assert.ok(!/triste/.test(r.json.text),'sensitive question stripped');assert.match(r.json.text,/de \w+ de 20\d\d/);
 r=await f.call('a','/memory/recall','POST',{question:'¿qué te pregunté anteayer?'});assert.match(r.json.text,/No tengo guardada ninguna conversación/);});

test('deleting a conversation removes its summary and reports derived memories; export and full wipe',async t=>{const f=await fixture(t);
 await f.call('a','/memory/settings','PUT',{settings:{save_history:true,reference_history:true}});
 await f.call('a','/memory/sessions','POST',{id:'s-del-00000001',questions:['¿Dónde queda el mercado Paulino Navarro?']});
 await f.call('a','/memory/items','POST',{text:'Mi mercado favorito es el Paulino Navarro',source:'conversation',source_session:'s-del-00000001'});
 const exp=(await f.call('a','/memory/export')).json;assert.equal(exp.format,'evie.memory');assert.equal(exp.sessions.length,1);assert.equal(exp.memories[0].source_session,'s-del-00000001');assert.ok(!('keys' in exp.memories[0]));
 const d=(await f.call('a','/memory/sessions/s-del-00000001','DELETE')).json;assert.equal(d.deleted,true);assert.equal(d.derived_memories.length,1);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM evie_sessions').get().n,0);
 assert.equal((await f.call('a','/memory','DELETE')).json.deleted,true);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM evie_memories').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM evie_memory_settings').get().n,0);});

test('memory disabled: nothing saved or retrieved',async t=>{const f=await fixture(t);
 await f.call('a','/memory/items','POST',{text:'Mi equipo es el Atlas'});await f.call('a','/memory/settings','PUT',{settings:{enabled:false}});
 assert.equal((await f.call('a','/memory/items','POST',{text:'Mi perro se llama Kiko'})).status,409);
 await f.call('a','/ai/chat','POST',{input:[{role:'user',content:'¿cuál es mi equipo?'}]});assert.ok(!/Atlas/.test(f.sent.at(-1).instructions));});
