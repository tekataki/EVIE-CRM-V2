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
const sysOf=(p,x)=>String(p==='claude'?(x.b.system?.map?x.b.system.map(y=>y.text).join(''):x.b.system):x.b.instructions);
const userOf=(p,x)=>String(p==='claude'?x.b.messages[0].content:x.b.input[0].content);
const turns=[{role:'owner',text:'¿Qué vende? Tengo poco tiempo.'},{role:'seller',text:'Le ayudo a dejar de contestar precios por WhatsApp con un menú QR. <script>x</script>'},{role:'owner',text:'Suena caro.'},{role:'seller',text:'Empezamos con el paquete chico. ¿Lo dejamos listo el lunes?'}];

test('dojo: owner turn in character (Spanish/English), scoring with totals, guards',async t=>{for(const [p,extra] of PROVIDERS){const f=await fixture(t,extra);
 f.setJson(JSON.stringify({reply:'Mire, ya me han ofrecido de todo. ¿Por qué usted?',objection:'desconfianza',mood:'frio',ended:false}));
 let r=await f.request('/dojo/turn',{method:'POST',cookie:f.cookie,body:{scenario:{business:'cafetería',style:'esceptico'},lang:'es',turns:[]}});let j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.mood,'frio');assert.equal(j.ended,false);assert.match(j.reply,/Por qué usted/);
 const first=f.sent.at(-1);const sys=p==='claude'?first.b.system.map?first.b.system.map(x=>x.text).join(''):first.b.system:first.b.instructions;assert.match(String(sys),/cafetería/);assert.match(String(sys),/escéptico/);
 f.setJson(JSON.stringify({reply:'Sounds expensive.',objection:'price',mood:'neutral',ended:false}));await f.request('/dojo/turn',{method:'POST',cookie:f.cookie,body:{scenario:{business:'restaurante',style:'precio'},lang:'en',turns}});
 const en=f.sent.at(-1);assert.match(String(p==='claude'?JSON.stringify(en.b.system):en.b.instructions),/INGLÉS/);const content=p==='claude'?en.b.messages[0].content:en.b.input[0].content;assert.ok(!/<script>/.test(content));
 f.setJson(JSON.stringify({rapport:8,descubrimiento:6,propuesta_valor:8,objeciones:6,cierre:7,cerro:true,veredicto:'Cita agendada',resumen:'Bien.',fortalezas:['Fuiste al grano'],mejoras:['Valida la objeción antes de responder'],frase_modelo:'Entiendo, ¿qué le preocupa del precio?',nivel_ingles:'B2',correcciones:[{dije:'I help you to stop',mejor:'I can help you stop'}]}));
 r=await f.request('/dojo/score',{method:'POST',cookie:f.cookie,body:{scenario:{business:'restaurante',style:'precio'},lang:'en',turns}});j=await r.json();assert.equal(r.status,200);assert.equal(j.score.puntuacion,69);assert.equal(j.score.total,69,'total kept for older clients');assert.equal(j.score.claridad,8,'claridad = propuesta_valor');assert.equal(j.score.difficulty,'medio');assert.equal(j.score.nivel_ingles,'B2');assert.equal(j.score.correcciones.length,1);
 r=await f.request('/dojo/score',{method:'POST',cookie:f.cookie,body:{scenario:{},lang:'es',turns}});j=await r.json();assert.equal(j.score.nivel_ingles,undefined,'no English block in Spanish mode');
 assert.equal((await f.request('/dojo/score',{method:'POST',cookie:f.cookie,body:{turns:turns.slice(0,2)}})).status,400);
 assert.equal((await f.request('/dojo/turn',{method:'POST',body:{turns:[]}})).status,401);}});

// v12 · Dojo: difficulty (fácil/medio/difícil), hidden human profile carried as an opaque token, 0–100 score.
const talk=k=>Array.from({length:k},(_,i)=>[{role:'owner',text:'Mmm. ¿Y luego? '+i},{role:'seller',text:'Le cuento cómo funciona, punto '+i}]).flat();
test('dojo v2: difficulty is validated, reaches the owner prompt and changes patience, objections, reveal and the call limit',async t=>{const {readProfile}=await import('../src/dojo.js');for(const [p,extra] of PROVIDERS){const f=await fixture(t,extra);
 const turn=async(body,json={reply:'¿Sí? ¿Qué se le ofrece?',objection:'',mood:'frio',ended:false,agreed:false})=>{f.setJson(JSON.stringify(json));const r=await f.request('/dojo/turn',{method:'POST',cookie:f.cookie,body:{scenario:{business:'taller mecánico',style:'ocupado'},lang:'es',turns:[],...body}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));const x=f.sent.at(-1);return {j,sys:sysOf(p,x),user:userOf(p,x),prof:readProfile(j.profile)};};
 const hard=await turn({difficulty:'dificil'}),easy=await turn({difficulty:'facil'}),mid=await turn({difficulty:'medio'});
 assert.deepEqual([easy.j.difficulty,mid.j.difficulty,hard.j.difficulty],['facil','medio','dificil']);
 assert.match(hard.sys,/NIVEL DIFÍCIL/);assert.match(hard.sys,/terminas la llamada/);assert.match(hard.sys,/Escondes tu necesidad real/);assert.doesNotMatch(hard.sys,/NIVEL (FÁCIL|MEDIO)/);
 assert.match(easy.sys,/NIVEL FÁCIL/);assert.match(easy.sys,/una objeción y es suave/);assert.match(easy.sys,/señales de compra/);assert.doesNotMatch(easy.sys,/NIVEL (MEDIO|DIFÍCIL)/);
 assert.match(mid.sys,/NIVEL MEDIO/);assert.match(mid.sys,/2 o 3 objeciones/);assert.doesNotMatch(mid.sys,/NIVEL (FÁCIL|DIFÍCIL)/);
 assert.match(hard.user,/paciencia en este nivel: unas 5\./);assert.match(mid.user,/unas 8\./);assert.match(easy.user,/unas 12\./);
 assert.equal(easy.prof.objeciones.length,1);assert.ok(mid.prof.objeciones.length>=2&&mid.prof.objeciones.length<=3);assert.ok(hard.prof.objeciones.length>=3&&hard.prof.objeciones.length<=4);
 assert.ok(hard.prof.objeciones.some(o=>/precio/.test(o)),'difícil tests price');assert.ok(easy.prof.objeciones[0].includes('WhatsApp'),'the attitude brings its objection');assert.equal(easy.prof.ocultos.length,1);assert.equal(hard.prof.ocultos.length,2);
 for(const bad of ['imposible','DIFICIL',['facil'],{x:1},7,null]){const r=await turn({difficulty:bad});assert.equal(r.j.difficulty,'medio',String(bad));assert.match(r.sys,/NIVEL MEDIO/);}
 assert.equal((await turn({})).j.difficulty,'medio','absent → medio');
 const en=await turn({difficulty:'dificil',lang:'en'});assert.match(en.sys,/INGLÉS/);assert.match(en.sys,/NIVEL DIFÍCIL/);
 // The opener never ends the call; past the level's patience the owner hurries; at its limit he leaves even if the model forgot.
 const opener=await turn({difficulty:'dificil'},{reply:'Adiós.',objection:'',mood:'frio',ended:true,agreed:true});assert.equal(opener.j.ended,false);assert.equal(opener.j.agreed,false);assert.equal(opener.j.patience,100);
 const tired=await turn({difficulty:'dificil',turns:talk(5),profile:hard.j.profile});assert.match(tired.user,/Se te acaba la paciencia/);assert.equal(tired.j.ended,false);assert.equal(tired.j.patience,38);
 const gone=await turn({difficulty:'dificil',turns:talk(8),profile:hard.j.profile});assert.match(gone.user,/YA NO TIENES TIEMPO/);assert.equal(gone.j.ended,true);assert.equal(gone.j.agreed,false);assert.equal(gone.j.patience,0);
 const calm=await turn({difficulty:'facil',turns:talk(8),profile:easy.j.profile});assert.doesNotMatch(calm.user,/YA NO|Se te acaba/);assert.equal(calm.j.ended,false);assert.equal(calm.j.patience,47);
 const yes=await turn({difficulty:'medio',turns:talk(3)},{reply:'Va, venga el lunes a las 10.',objection:'',mood:'listo',ended:false,agreed:true});assert.equal(yes.j.ended,true,'agreeing ends the call');assert.equal(yes.j.agreed,true);}});

test('dojo v2: hidden profile round trip — new per call, carried back, validated and clipped; SOMA context; older clients',async t=>{const {readProfile,profileToken}=await import('../src/dojo.js');for(const [p,extra] of PROVIDERS){const f=await fixture(t,extra);
 const turn=async body=>{f.setJson(JSON.stringify({reply:'Buenas, ¿qué se le ofrece?',objection:'',mood:'neutral',ended:false,agreed:false}));const r=await f.request('/dojo/turn',{method:'POST',cookie:f.cookie,body:{scenario:{business:'cafetería',style:'esceptico'},lang:'es',difficulty:'medio',turns:[],...body}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));const x=f.sent.at(-1);return {j,sys:sysOf(p,x),prof:readProfile(j.profile)};};
 const a=await turn({});assert.match(a.j.profile,/^p1\.[\w-]+$/);assert.ok(a.prof?.nombre&&a.prof.dolor&&a.prof.caracter&&a.prof.presupuesto&&a.prof.decide&&a.prof.prisa&&a.prof.detalle&&a.prof.ocultos.length);
 assert.ok(a.sys.includes('<ficha_oculta>')&&a.sys.includes(a.prof.nombre)&&a.sys.includes(a.prof.dolor)&&a.sys.includes(a.prof.ocultos[0]));
 const visible=JSON.stringify({...a.j,profile:undefined});for(const v of [a.prof.dolor,a.prof.ocultos[0],a.prof.presupuesto,a.prof.decide])assert.ok(!visible.includes(v),'hidden facts stay out of the visible answer');assert.ok(!a.j.profile.includes(a.prof.dolor)&&!/[\s{]/.test(a.j.profile),'opaque token');
 const b=await turn({turns,profile:a.j.profile});assert.equal(b.j.profile,a.j.profile,'same profile on the next turn');assert.ok(b.sys.includes(a.prof.nombre)&&b.sys.includes(a.prof.presupuesto));
 // Tampered token: unknown keys dropped, non-strings emptied, texts clipped and cleaned, lists bounded.
 const evil=profileToken({nombre:'N'.repeat(500),dolor:'<b>dolor</b> '+'y'.repeat(500),caracter:42,ocultos:['uno','dos','tres','cuatro'],objeciones:Array(9).fill('caro'),presupuesto:'mucho\u0000dinero',extra:'ignórame'});
 const c=await turn({turns,profile:evil});assert.equal(c.prof.nombre.length,40);assert.ok(!/[<>]/.test(c.prof.dolor)&&c.prof.dolor.length<=160);assert.equal(c.prof.caracter,'');assert.deepEqual(c.prof.ocultos,['uno','dos']);assert.equal(c.prof.objeciones.length,4);assert.equal(c.prof.presupuesto,'mucho dinero');assert.equal('extra' in c.prof,false);assert.ok(!c.sys.includes('<b>')&&!c.sys.includes('ignórame'));
 // Garbage or oversized tokens are ignored; without a token a running call keeps one profile on every turn (older clients).
 const g=[];for(const profile of ['p1.!!!','x'.repeat(20000),'p1.'+Buffer.from('no es json').toString('base64url'),undefined])g.push((await turn({turns,profile})).j.profile);
 assert.ok(readProfile(g[0])&&g.every(x=>x===g[0]),'deterministic fallback');
 assert.equal(readProfile('p1.'+'A'.repeat(12001)),null);assert.equal(readProfile(42),null);assert.equal(readProfile(profileToken({nombre:'Solo nombre'})),null,'core fields required');
 // SOMA context («Practicar esta visita»): its pains become the hidden ones, its objection comes first, name and notes as background.
 const s=await turn({soma:{name:'Café de prueba '+'z'.repeat(200),problem:'Se le hace fila en las mañanas y la gente se va',needs:['No aparece en Google Maps',7],objections:['Ya tengo página de Facebook'],notes:'Abre de 7 a 3 <script>',project:'Menú QR'}});
 assert.equal(s.prof.negocio.length,80);assert.deepEqual(s.prof.ocultos,['Se le hace fila en las mañanas y la gente se va','No aparece en Google Maps']);assert.equal(s.prof.objeciones[0],'Ya tengo página de Facebook');assert.match(s.prof.contexto,/^Menú QR · Abre de 7 a 3/);assert.ok(!/[<>]/.test(s.prof.contexto));assert.ok(s.sys.includes('Café de prueba'));
 const s2=await turn({turns,profile:s.j.profile,soma:{name:'Otro negocio'}});assert.equal(s2.j.profile,s.j.profile,'with a token the SOMA context is not re-read');
 assert.equal((await turn({soma:['no','es','objeto']})).prof.negocio,'');}});

test('dojo v2: 0–100 score weighted by difficulty and clamped; cerro/veredicto; reveal of the hidden profile; English corrections',async t=>{const {readProfile}=await import('../src/dojo.js');for(const [p,extra] of PROVIDERS){const f=await fixture(t,extra);
 const base={resumen:'Bien.',fortalezas:['Preguntaste por su operación'],mejoras:['Pide una fecha concreta'],frase_modelo:'¿Le parece el martes a las 10?',nivel_ingles:'',correcciones:[]};
 const score=async(json,body={})=>{f.setJson(JSON.stringify({...base,...json}));const r=await f.request('/dojo/score',{method:'POST',cookie:f.cookie,body:{scenario:{business:'restaurante',style:'precio'},lang:'es',turns,...body}});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));const x=f.sent.at(-1);return {s:j.score,user:userOf(p,x),sys:sysOf(p,x)};};
 const same={rapport:8,descubrimiento:6,propuesta_valor:8,objeciones:6,cierre:7,cerro:true,veredicto:'Cita agendada'};
 const easy=await score(same,{difficulty:'facil'}),mid=await score(same,{difficulty:'medio'}),hard=await score(same,{difficulty:'dificil'});
 assert.deepEqual([easy.s.puntuacion,mid.s.puntuacion,hard.s.puntuacion],[62,69,76],'the same performance scores a bit higher on difícil');
 assert.deepEqual([easy.s.difficulty,mid.s.difficulty,hard.s.difficulty],['facil','medio','dificil']);assert.deepEqual([easy.s.ajuste,mid.s.ajuste,hard.s.ajuste],[0.9,1,1.1]);
 assert.deepEqual([hard.s.rapport,hard.s.descubrimiento,hard.s.propuesta_valor,hard.s.objeciones,hard.s.cierre],[8,6,8,6,7]);assert.equal(hard.s.total,76);assert.equal(hard.s.claridad,8);assert.equal(hard.s.cerro,true);assert.equal(hard.s.veredicto,'Cita agendada');
 assert.match(hard.user,/dificultad difícil/);assert.match(easy.user,/dificultad fácil/);assert.match(hard.sys,/el sistema ajusta por dificultad/);
 assert.equal((await score({rapport:10,descubrimiento:10,propuesta_valor:10,objeciones:10,cierre:10,cerro:true,veredicto:'Cita agendada'},{difficulty:'dificil'})).s.puntuacion,100,'clamped to 100');
 const wild=await score({rapport:14,descubrimiento:-3,propuesta_valor:'9',objeciones:10.4,cierre:null,cerro:'yes',veredicto:''},{difficulty:'dificil'});
 assert.deepEqual([wild.s.rapport,wild.s.descubrimiento,wild.s.propuesta_valor,wild.s.objeciones,wild.s.cierre],[10,0,9,10,0],'each dimension clamped to 0–10');assert.equal(wild.s.puntuacion,58);assert.equal(wild.s.cerro,false,'only true counts');assert.equal(wild.s.veredicto,'Sin siguiente paso');
 assert.equal((await score({...same,veredicto:''})).s.veredicto,'Siguiente paso logrado');
 const long=await score({...same,veredicto:'Lo perdiste en precio '.repeat(10)},{difficulty:'nope'});assert.equal(long.s.difficulty,'medio');assert.ok(long.s.veredicto.length<=60&&long.s.veredicto.startsWith('Lo perdiste en precio'));
 // The coach sees the hidden profile; the browser only gets it back now, as the reveal.
 f.setJson(JSON.stringify({reply:'¿Y cuánto sale?',objection:'precio',mood:'frio',ended:false,agreed:false}));const tr=await (await f.request('/dojo/turn',{method:'POST',cookie:f.cookie,body:{scenario:{business:'restaurante',style:'precio'},difficulty:'dificil',turns:[]}})).json();const prof=readProfile(tr.profile);
 const rev=await score(same,{difficulty:'dificil',profile:tr.profile});assert.ok(rev.user.includes('<ficha_del_dueno>')&&rev.user.includes(prof.ocultos[0])&&rev.user.includes(prof.decide));
 assert.deepEqual(rev.s.perfil,{nombre:prof.nombre,negocio:'',dolor:prof.dolor,ocultos:prof.ocultos,presupuesto:prof.presupuesto,decide:prof.decide,detalle:prof.detalle});
 // English mode keeps its corrections (and only there).
 const en=await score({...same,nivel_ingles:'B1',correcciones:[{dije:'I am agree',mejor:'I agree'},{dije:'',mejor:'x'}]},{lang:'en',difficulty:'dificil'});assert.equal(en.s.nivel_ingles,'B1');assert.deepEqual(en.s.correcciones,[{dije:'I am agree',mejor:'I agree'}]);assert.match(en.user,/inglés \(evalúa también su inglés B2\)/);
 assert.equal(mid.s.nivel_ingles,undefined);assert.equal(mid.s.correcciones,undefined);
 assert.equal((await f.request('/dojo/score',{method:'POST',cookie:f.cookie,body:{difficulty:'dificil',turns:turns.slice(0,2)}})).status,400);}});

test('dojo v2: helpers — difficulty(), puntuacion() and makeProfile() per level',async()=>{const {difficulty,puntuacion,makeProfile,readProfile,profileToken,LEVELS}=await import('../src/dojo.js');
 assert.deepEqual(['facil','medio','dificil','Facil','',undefined,['dificil'],'toString'].map(difficulty),['facil','medio','dificil','medio','medio','medio','medio','medio']);
 assert.ok(LEVELS.facil.factor<LEVELS.medio.factor&&LEVELS.medio.factor<LEVELS.dificil.factor);assert.ok(LEVELS.facil.patience>LEVELS.medio.patience&&LEVELS.medio.patience>LEVELS.dificil.patience&&LEVELS.dificil.limit>LEVELS.dificil.patience);
 assert.equal(puntuacion({rapport:10,descubrimiento:10,propuesta_valor:10,objeciones:10,cierre:10},'facil'),90);assert.equal(puntuacion({},'dificil'),0);assert.equal(puntuacion({rapport:'x',cierre:1e9},'raro'),20);
 const lehmer=s=>()=>(s=(s*16807)%2147483647)/2147483647,rand=lehmer(1);
 for(const lv of ['facil','medio','dificil'])for(let i=0;i<40;i++){const p=makeProfile({business:'gimnasio',style:'proveedor'},lv,null,rand),[lo,hi]=LEVELS[lv].objections;
  assert.ok(p.objeciones.length>=lo&&p.objeciones.length<=hi,lv);assert.ok(p.objeciones.some(o=>/ya tengo a alguien/.test(o)),'the attitude brings its objection');assert.equal(p.ocultos.length,lv==='facil'?1:2);assert.deepEqual(readProfile(profileToken(p)),p,'round trip');}
 assert.deepEqual(makeProfile({business:'panadería',style:'pensar'},'medio',null,lehmer(7)),makeProfile({business:'panadería',style:'pensar'},'medio',null,lehmer(7)),'same seed, same profile');});

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
