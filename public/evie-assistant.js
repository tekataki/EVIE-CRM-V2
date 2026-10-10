'use strict';
/* EVIE assistant client.
   Voice loop: mic (MediaRecorder + simple VAD) -> /api/ai/stt (Groq) -> local intents or /api/ai/chat (OpenAI tools)
   -> /api/ai/tts (Fish Audio) -> speaker. Browser speech APIs are fallbacks when cloud is unavailable.
   Read tools run here against the local-first Store. Writes are DRAFTS confirmed by the user (IvyCommandBus). */
window.EvieAssistant=(()=>{
 const e=s=>Domain.escape(String(s??''));
 let panel=null,history=[],busy=false,audio=null,recorder=null,speakingCtx=null,ticket=0,clapOff=null,draft=null;
 const pref=()=>({clapWake:false,conversation:true,muted:false,cloudVoice:true,cloudAI:true,voiceId:'',...(Store.get()?.preferences?.evie||{})});
 const runtime=()=>window.EvieAccounts?.config?.()||{};
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&runtime().accountsEnabled;
 const can=k=>cloud()&&runtime().ai?.[k]===true;
 const name=()=>{const p=Store.get()?.profile||{};return (p.preferred||p.name||'').trim();};
 function setPhase(p){document.documentElement.dataset.evie=p;const map={idle:'idle',listening:'listening',thinking:'thinking',speaking:'speaking',error:'error'};document.querySelectorAll('[data-evie-phase]').forEach(n=>n.textContent=({idle:'Lista',listening:'Escuchando…',thinking:'Pensando…',speaking:'Hablando…',error:'Algo falló'})[p]||'');try{const cur=IvyState.get().phase,next={listening:'listening',thinking:'thinking',speaking:'speaking',idle:'idle',error:'error'}[map[p]];if(cur!==next){if(cur==='listening'&&next==='thinking')IvyState.transition('transcribing');IvyState.transition(next);}}catch{}window.EvieNeural?.kick();}
 /* ---------- local read tools (shared contract with src/assistant.js TOOLS) ---------- */
 const live=c=>Store.list(c)||[];
 const today=()=>Domain.today();
 const moneyStr=c=>Domain.money(c);
 function inRange(d,a,b){return d&&d>=a&&d<=b;}
 function periodFrom(period){const t=today();if(period==='today')return t;if(period==='week')return V2Domain.addDays(t,-6);if(period==='year')return t.slice(0,4)+'-01-01';return t.slice(0,7)+'-01';}
 const tools={
  get_today_overview(){const t=today(),ag=live('agendaItems').filter(r=>!['done','archived'].includes(r.status));
   const due=ag.filter(r=>Agenda.occurrence(r,t)&&!Agenda.isDone(r,t)).map(r=>({title:r.title,time:r.all_day||!(r.due_at||r.start_at)?null:Agenda.localValue(r.due_at||r.start_at).slice(11,16)}));
   const overdue=ag.filter(r=>{const d=(r.due_at||r.start_at)?Agenda.localValue(r.due_at||r.start_at).slice(0,10):null;return d&&d<t&&!r.recurrence&&!Agenda.isDone(r,d);}).map(r=>r.title).slice(0,8);
   const goals=live('goals').filter(g=>!g.archived&&g.progress<g.target&&g.date<=t).map(g=>g.title).slice(0,6);
   const bills=live('bills').filter(b=>Domain.outstanding(b)>0&&b.date<=V2Domain.addDays(t,3)).map(b=>({title:b.title,amount:moneyStr(Domain.outstanding(b)),date:b.date}));
   const follow=live('clients').filter(c=>c.nextDate&&c.nextDate<=t&&c.nextAction&&!['Perdido','Completado'].includes(c.stage)).map(c=>c.title+': '+c.nextAction).slice(0,6);
   const tx=live('transactions').filter(x=>x.date===t);const gym=live('gymSessions').some(s=>s.date===t);const journal=live('journal').some(j=>j.date===t);
   return {date:t,name:name()||null,pending_today:due,overdue,goals_open:goals,bills_due_soon:bills,client_followups:follow,money_today:{income:moneyStr(tx.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0)),expense:moneyStr(tx.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0))},trained_today:gym,journal_today:journal,mode:window.EvieModes?.current()||'normal'};},
  get_agenda({from,to}){const a=V2Domain.date(from)?from:today(),b=V2Domain.date(to)?to:a;const out=[];let d=a,guard=0;while(d<=b&&guard++<62){for(const r of live('agendaItems'))if(!['archived'].includes(r.status)&&Agenda.occurrence(r,d))out.push({date:d,title:r.title,done:Agenda.isDone(r,d),time:r.all_day?null:(r.due_at||r.start_at)?Agenda.localValue(r.due_at||r.start_at).slice(11,16):null});d=V2Domain.addDays(d,1);}return {from:a,to:b,items:out.slice(0,60)};},
  get_finance_summary({period='month'}={}){const from=periodFrom(period),t=today(),rows=live('transactions').filter(x=>inRange(x.date,from,t));const inc=rows.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0),exp=rows.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0);const cats={};for(const x of rows.filter(x=>x.type==='expense'))cats[x.category||'Otro']=(cats[x.category||'Otro']||0)+x.amount;
   const accounts=(window.EvieModules?.accounts?.()||[]).map(a=>({name:a.name,type:a.type,estimated:moneyStr(a.balance),...(a.type==='credit'?{available:moneyStr(a.available),cut_day:a.cut||null,due_day:a.due||null}:{})}));
   return {period,from,to:t,income:moneyStr(inc),expense:moneyStr(exp),net:moneyStr(inc-exp),ledger_balance_estimate:moneyStr(Domain.balance(live('transactions'))),top_expense_categories:Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({category:k,amount:moneyStr(v)})),accounts,bills_pending:live('bills').filter(b=>Domain.outstanding(b)>0).map(b=>({title:b.title,amount:moneyStr(Domain.outstanding(b)),date:b.date})).slice(0,8),note:'Estimación con registros del usuario; no es el saldo real del banco.'};},
  get_business_summary(){const s=DaliCore.select(Store.get()).sales,list=window.EvieModules?.businesses?.()||[];return {soma:{month:s.month,collected:moneyStr(s.collected),target:moneyStr(s.target),receivable:moneyStr(s.receivable),pipeline_weighted:moneyStr(s.pipeline)},businesses:list.map(b=>({name:b.name,kind:b.kind,summary:b.summary})),followups:live('clients').filter(c=>c.nextDate&&c.nextAction&&!['Perdido','Completado'].includes(c.stage)).map(c=>({client:c.title,action:c.nextAction,date:c.nextDate})).slice(0,8)};},
  get_goals(){return {goals:live('goals').filter(g=>!g.archived).map(g=>({title:g.title,progress:g.progress,target:g.target,date:g.date})).slice(0,20)};},
  get_journal_stats({days=30}={}){const n=Math.max(1,Math.min(365,days|0||30)),from=V2Domain.addDays(today(),-(n-1)),res={};for(const k of ['alegria','tristeza','enojo','calma','ansiedad','gratitud']){const st=JournalData.statistics(Store.list('journal'),k,from,today());const vals=(st.points||[]).filter(p=>p.value!=null).map(p=>p.value);res[k]=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;}return {days:n,averages_0_100:res,entries:live('journal').filter(j=>j.date>=from).length,note:'Promedios de intensidades reportadas/confirmadas. No es evaluación clínica.'};},
  get_gym_summary(){const rows=live('gymSessions').sort((a,b)=>b.date.localeCompare(a.date)),week=V2Domain.addDays(today(),-6),nut=Store.get().preferences.evieNutrition||null;return {last:rows[0]?{title:rows[0].title,date:rows[0].date}:null,sessions_last_7_days:rows.filter(r=>r.date>=week).length,calorie_target:nut?.target||null};},
  search_records({query=''}={}){const q=IvyTools.norm(String(query)).slice(0,80);if(q.length<2)return {results:[]};const out=[];for(const [c,r] of [['agendaItems','agenda'],['transactions','finanzas'],['goals','objetivos'],['clients','soma'],['journal','bitacora'],['books','libros'],['skills','aprendizaje']])for(const x of live(c))if(IvyTools.norm(String(x.title||'')+' '+String(x.note||x.text||'').slice(0,300)).includes(q))out.push({type:c,title:x.title,date:x.date||null,route:r});return {results:out.slice(0,12)};},
  navigate({route}){if(DALI_CONFIG.sections.some(s=>s.route===route)){location.hash=route;return {ok:true,opened:route};}return {ok:false};},
  set_mode({mode}){return window.EvieModes.set(mode);},
  draft_task({title,date,time}){return makeDraft('agenda.create',{title,...(V2Domain.date(date)?{date}:{}),...(time&&/^\d{2}:\d{2}$/.test(time)&&V2Domain.date(date)?{time}:{})});},
  draft_transaction({type,amount,title,date}){return makeDraft('finance.create',{type,amount:Math.round(Number(amount)*100),title,date:V2Domain.date(date)?date:today()});},
  draft_journal_note({title,text}){return makeDraft('journal.create',{title,text,date:today()});},
  draft_goal({title}){return makeDraft('goal.create',{title,date:today()});}
 };
 function makeDraft(intent,params){try{const cmd=IvyCommandBus.envelope(intent,params,'voice','write');const p=IvyCommandBus.prepare(cmd);draft={token:p.token,fields:p.fields,route:p.route};renderDraft();return {status:'draft_shown',needs_user_confirmation:true,fields:p.fields};}catch(err){return {status:'invalid',error:err.message};}}
 /* ---------- local fast-path (free, no network) ---------- */
 function tryLocal(text){const q=IvyTools.norm(text).replace(/[¿?¡!.,]/g,'').replace(/^(oye |hey |hola )?evie[, ]*/,'').trim();
  let m=q.match(/^(?:activa|activar|pon|entra en|cambia a)(?: el)? modo (\w+)/);if(m){const r=window.EvieModes.set(m[1]);return r.ok?r.say:'No conozco el modo '+m[1]+'. Tengo enfoque, gym, negocio, cierre, noche y normal.';}
  if(/^(?:desactiva|salir? del?|quita)(?: el)? modo/.test(q)){window.EvieModes.set('normal');return 'Listo, volví al modo normal.';}
  if(/^(callate|silencio|para|deten|detente|stop)$/.test(q)){stopSpeaking();return '';}
  try{const cmd=IvyCommandBus.parse(text,'voice');
   if(cmd.intent==='navigate'){location.hash=cmd.parameters.route;return 'Abriendo '+(DALI_CONFIG.sections.find(s=>s.route===cmd.parameters.route)?.label||cmd.parameters.route)+'.';}
   if(cmd.risk==='write'&&IvyTools.intents.includes(cmd.intent)){const p=IvyCommandBus.prepare(cmd);draft={token:p.token,fields:p.fields,route:p.route};renderDraft();return 'Te dejé la propuesta en pantalla. Confírmala para guardarla.';}
  }catch{}
  if(/(?:que|cual).*(?:pendiente|tengo|hay).*(?:hoy|dia)|como va mi dia|resumen de hoy/.test(q)&&!can('chat'))return speakOverview();
  return null;}
 function speakOverview(){const o=tools.get_today_overview(),n=o.name?o.name+', ':'',p=o.pending_today;let s=p.length?`${n}hoy tienes ${p.length} pendiente${p.length>1?'s':''}: ${p.slice(0,3).map(x=>x.title+(x.time?' a las '+x.time:'')).join(', ')}${p.length>3?' y más':''}.`:`${n}no tienes pendientes fechados para hoy.`;if(o.overdue.length)s+=` Ojo: ${o.overdue.length} vencido${o.overdue.length>1?'s':''}.`;if(o.bills_due_soon.length)s+=` Pagos próximos: ${o.bills_due_soon.map(b=>b.title).slice(0,2).join(' y ')}.`;return s;}
 /* ---------- OpenAI loop via server ---------- */
 async function chat(text){
  history.push({role:'user',content:text});history=history.slice(-14);
  const context={name:name(),timezone:DALI_CONFIG.timezone,currency:DALI_CONFIG.currency};let input=[...history];
  for(let step=0;step<4;step++){
   const r=await EvieAccounts.request('ai/chat',{method:'POST',body:{input,context}});
   if(!r.calls?.length){const say=(r.text||'').trim()||'Listo.';history.push({role:'assistant',content:say});return say;}
   input=[...input,...(r.reasoning||[]),...r.calls];
   for(const c of r.calls){let args={};try{args=JSON.parse(c.arguments||'{}');}catch{}let out;try{out=tools[c.name]?tools[c.name](args):{error:'unknown tool'};}catch(err){out={error:err.message};}input.push({type:'function_call_output',call_id:c.call_id,output:JSON.stringify(out).slice(0,12000)});}
  }
  return 'Necesito más contexto para eso. ¿Me lo dices de otra forma?';
 }
 async function ask(text,{speak=true}={}){
  text=String(text||'').trim();if(!text)return;open();append('user',text);const my=++ticket;busy=true;setPhase('thinking');
  let say;try{say=tryLocal(text);if(say===null){if(can('chat')&&pref().cloudAI)say=await chat(text);else say=fallbackAnswer(text);}}catch(err){say=err.status===429?err.message:(err.message||'No pude responder.');setPhase('error');}
  if(my!==ticket)return;busy=false;if(say){append('evie',say);if(speak&&!pref().muted)await speakText(say);}
  if(my!==ticket)return;setPhase('idle');
  if(speak&&pref().conversation&&panel?.dataset.voice==='1'&&!draft&&say&&/\?\s*$/.test(say))listen();
 }
 function fallbackAnswer(text){try{const cmd=IvyCommandBus.parse(text,'voice');if(cmd.intent==='summary')return IvyTools.read(cmd.parameters.kind).text;}catch{}return can('chat')?'':'Puedo abrir secciones, darte el resumen de hoy, crear pendientes o registrar gastos. Para preguntas libres, configura EVIE IA en Ajustes.';}
 /* ---------- TTS ---------- */
 function stopSpeaking(){try{audio?.pause();}catch{}audio=null;try{speechSynthesis.cancel();}catch{}}
 async function speakText(text){stopSpeaking();setPhase('speaking');
  if(can('tts')&&pref().cloudVoice){try{const res=await fetch('/api/ai/tts',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Evie-Request':'1','X-Evie-User':EvieAccounts.current().id},body:JSON.stringify({text:text.slice(0,600),...(pref().voiceId?{voice:pref().voiceId}:{})})});if(res.ok){const blob=await res.blob(),url=URL.createObjectURL(blob);audio=new Audio(url);try{const C=window.AudioContext||window.webkitAudioContext;speakingCtx=speakingCtx||new C();const src=speakingCtx.createMediaElementSource(audio),an=speakingCtx.createAnalyser();an.fftSize=256;src.connect(an);an.connect(speakingCtx.destination);const buf=new Uint8Array(an.frequencyBinCount);const loop=()=>{if(!audio||audio.paused)return;an.getByteFrequencyData(buf);let s=0;for(const v of buf)s+=v;const lv=s/buf.length/160;EvieNeural?.setOut(lv);EvieFX?.mic(lv);requestAnimationFrame(loop);};audio.addEventListener('play',loop,{once:true});}catch{}
    await new Promise(r=>{audio.onended=audio.onerror=r;audio.play().catch(r);});URL.revokeObjectURL(url);return;}}catch{}}
  if('speechSynthesis' in window){await new Promise(r=>{const u=new SpeechSynthesisUtterance(text);u.lang='es-MX';u.rate=1.03;const v=speechSynthesis.getVoices().find(v=>/es[-_](MX|US|419)/i.test(v.lang))||speechSynthesis.getVoices().find(v=>/^es/i.test(v.lang));if(v)u.voice=v;let id=setInterval(()=>EvieNeural?.setOut(.35+Math.random()*.3),120);u.onend=u.onerror=()=>{clearInterval(id);r();};speechSynthesis.speak(u);setTimeout(()=>{clearInterval(id);r();},Math.min(30000,text.length*90+2000));});}
 }
 /* ---------- STT ---------- */
 async function listen(){
  if(recorder){finishRecording();return;}stopSpeaking();open(true);
  if(can('stt')&&pref().cloudVoice&&window.MediaRecorder&&navigator.mediaDevices?.getUserMedia)return recordCloud();
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){append('evie','Tu navegador no permite dictado aquí. Escríbeme abajo.');return;}
  const rec=new SR();rec.lang='es-MX';rec.interimResults=true;rec.maxAlternatives=1;let final='';setPhase('listening');
  rec.onresult=ev=>{let txt='';for(const r of ev.results)txt+=r[0].transcript;final=txt;const inp=panel?.querySelector('#evie-input');if(inp)inp.value=txt;EvieNeural?.setMic(.5);};
  rec.onerror=()=>setPhase('idle');rec.onend=()=>{recorder=null;if(final.trim())ask(final);else setPhase('idle');};recorder={stop:()=>rec.stop(),browser:true};rec.start();
 }
 async function recordCloud(){let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});}catch{append('evie','Necesito permiso de micrófono. También puedes escribirme.');return;}
  const type=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].find(t=>MediaRecorder.isTypeSupported?.(t))||'';const mr=new MediaRecorder(stream,type?{mimeType:type,audioBitsPerSecond:24000}:{});const chunks=[];const started=performance.now();
  const C=window.AudioContext||window.webkitAudioContext,ctx=new C(),src=ctx.createMediaStreamSource(stream),an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);const buf=new Uint8Array(an.fftSize);let silentSince=null,heard=false,raf;
  const vad=()=>{an.getByteTimeDomainData(buf);let e2=0;for(const v of buf)e2+=((v-128)/128)**2;const rms=Math.sqrt(e2/buf.length),lv=Math.min(1,rms*8);EvieNeural?.setMic(lv);EvieFX?.mic(lv);const now=performance.now();if(rms>.035){heard=true;silentSince=null;}else if(heard){silentSince??=now;if(now-silentSince>1300)return finishRecording();}if(!heard&&now-started>7000)return finishRecording();if(now-started>30000)return finishRecording();raf=requestAnimationFrame(vad);};
  mr.ondataavailable=ev=>{if(ev.data.size)chunks.push(ev.data);};
  mr.onstop=async()=>{cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());ctx.close().catch(()=>{});recorder=null;EvieFX?.mic(0);const dur=(performance.now()-started)/1000;if(!heard){setPhase('idle');return;}setPhase('thinking');
   try{const blob=new Blob(chunks,{type:(mr.mimeType||'audio/webm').split(';')[0]});const hint=encodeURIComponent(['EVIE',name(),'SOMA','ALVENTO','BBVA','bitácora','pendiente'].filter(Boolean).join(', '));const res=await fetch('/api/ai/stt',{method:'POST',credentials:'same-origin',headers:{'Content-Type':blob.type,'X-Evie-Request':'1','X-Evie-User':EvieAccounts.current().id,'X-Evie-Duration':String(Math.ceil(dur)),'X-Evie-Hint':hint},body:blob});const j=await res.json();if(!res.ok)throw Error(j.error||'No se pudo transcribir.');if(j.text)ask(j.text);else{append('evie','No te escuché bien. ¿Lo repites?');setPhase('idle');}}catch(err){append('evie',err.message);setPhase('error');setTimeout(()=>setPhase('idle'),1500);}};
  recorder={stop:()=>{try{mr.state!=='inactive'&&mr.stop();}catch{}}};mr.start(250);setPhase('listening');raf=requestAnimationFrame(vad);
 }
 function finishRecording(){const r=recorder;if(r)r.stop();}
 /* ---------- panel UI ---------- */
 const suggestions=['¿Qué hay pendiente para hoy?','¿Cómo van mis finanzas este mes?','Activa el modo enfoque','¿Cómo me he sentido esta semana?','Registra gasto 120: Comida hoy'];
 function open(voice=false){if(!panel){panel=document.createElement('section');panel.id='evie-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','EVIE');panel.innerHTML=`<header class="evie-panel-head"><span class="evie-panel-orb" aria-hidden="true"></span><div><strong>EVIE</strong><small data-evie-phase>Lista</small></div><button class="icon-button" data-evie="stop" aria-label="Detener voz">${Views.icon('square')}</button><button class="icon-button" data-evie="close" aria-label="Cerrar EVIE">${Views.icon('x')}</button></header><div class="evie-log" id="evie-log" aria-live="polite"></div><div class="evie-draft" id="evie-draft" hidden></div><div class="evie-suggest">${suggestions.map(s=>`<button class="evie-chip" data-evie="suggest">${e(s)}</button>`).join('')}</div><form class="evie-form" id="evie-form"><label class="sr-only" for="evie-input">Escríbele a EVIE</label><input id="evie-input" autocomplete="off" maxlength="600" placeholder="Pregúntale algo a EVIE…"><button type="button" class="icon-button evie-mic" data-evie="listen" aria-label="Hablar">${Views.icon('mic')}</button><button class="icon-button primary" aria-label="Enviar">${Views.icon('arrow-up')}</button></form>`;document.body.append(panel);
   panel.querySelector('#evie-form').onsubmit=ev=>{ev.preventDefault();const i=panel.querySelector('#evie-input'),v=i.value;i.value='';panel.dataset.voice='0';ask(v,{speak:!pref().muted&&pref().conversation});};
   if(!history.length)append('evie',greet());window.lucide?.createIcons({root:panel});}
  panel.hidden=false;document.body.classList.add('evie-open');if(voice)panel.dataset.voice='1';EvieFX?.panelIn(panel);if(!voice)setTimeout(()=>panel.querySelector('#evie-input')?.focus({preventScroll:true}),60);}
 function close(){if(!panel)return;panel.hidden=true;document.body.classList.remove('evie-open');finishRecording();stopSpeaking();setPhase('idle');}
 function greet(){const h=new Date().getHours(),n=name();return `${h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'}${n?', '+n:''}. ¿En qué te ayudo?`;}
 function append(who,text){if(!panel)return;const log=panel.querySelector('#evie-log'),p=document.createElement('p');p.className='evie-msg '+who;p.textContent=text;log.append(p);while(log.children.length>30)log.firstChild.remove();log.scrollTop=log.scrollHeight;const lr=document.getElementById('evie-live');if(lr&&who==='evie')lr.textContent=text;}
 function renderDraft(){open();const box=panel.querySelector('#evie-draft');if(!draft){box.hidden=true;box.innerHTML='';return;}box.hidden=false;box.innerHTML=`<span class="eyebrow">PROPUESTA · AÚN NO SE GUARDA</span><dl>${Object.entries(draft.fields).map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl><div class="toolbar"><button class="button primary" data-evie="draft-confirm">Guardar</button><button class="button" data-evie="draft-cancel">Descartar</button></div>`;EvieFX?.panelIn(box);}
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-evie]');if(!b)return;const a=b.dataset.evie;
  if(a==='open')open();else if(a==='close')close();else if(a==='stop'){stopSpeaking();finishRecording();setPhase('idle');}
  else if(a==='listen'||a==='orb'){if(a==='orb'&&panel&&!panel.hidden&&!recorder&&document.documentElement.dataset.evie==='idle'&&ev.detail===0)return close();EvieFX?.pulse();listen();}
  else if(a==='suggest'){panel.dataset.voice='0';ask(b.textContent,{speak:!pref().muted&&pref().conversation});}
  else if(a==='draft-confirm'){try{const r=IvyCommandBus.confirm(draft.token);draft=null;renderDraft();App.render();append('evie','Guardado.');App.toast('EVIE guardó el registro.','success',r.undo);}catch(err){append('evie',err.message);}}
  else if(a==='draft-cancel'){try{IvyCommandBus.cancel(draft?.token);}catch{}draft=null;renderDraft();append('evie','Descartado.');}
 });
 document.addEventListener('keydown',ev=>{if(document.body.classList.contains('account-locked'))return;if(ev.ctrlKey&&!ev.shiftKey&&ev.code==='Space'&&!window.evieDesktop){ev.preventDefault();listen();}if(ev.key==='Escape'&&panel&&!panel.hidden&&!document.querySelector('dialog[open]'))close();});
 /* ---------- wake: double clap (opt-in, only while app is visible) ---------- */
 const Wake={async start(){if(clapOff)return;try{await IvyAudio.start('evie-wake',true);const det=IvyClap.detector();let noise=[],thr=.14,cal=performance.now()+1500;clapOff=IvyAudio.subscribe(s=>{if(s.now<cal){noise.push(s.rms);return;}if(noise.length){thr=Math.max(.08,Math.min(.5,noise.reduce((a,b)=>a+b,0)/noise.length*5+.04));noise=[];}if(!recorder&&document.documentElement.dataset.evie!=='speaking'&&det.sample(s,thr)){Wake.stop();open(true);listen().finally?.(()=>{});setTimeout(()=>{if(pref().clapWake)Wake.start();},4000);}});document.documentElement.dataset.evieWake='on';}catch(err){clapOff=null;App.toast(err.message,'error');}},
  stop(){clapOff?.();clapOff=null;IvyAudio.stop('evie-wake');delete document.documentElement.dataset.evieWake;},active:()=>!!clapOff};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)Wake.stop();else if(pref().clapWake&&Store.get())Wake.start();});
 // Deep link / PWA shortcut: /#inicio?evie=listen or ?evie=1
 function fromUrl(){const q=new URLSearchParams(location.search);if(q.get('evie')==='listen'||q.get('evie')==='1'){history.replaceState(null,'',location.pathname+location.hash);setTimeout(()=>open(true),400);}}
 setPhase('idle');
 return Object.freeze({open,close,ask,listen,tools,tryLocal,Wake,fromUrl,pref,stopSpeaking,stats:()=>({panel:!!panel,busy,history:history.length,draft:!!draft,wake:!!clapOff})});
})();

/* ---------- Modes: "activa el modo X" ---------- */
window.EvieModes=(()=>{
 const modes={
  normal:{label:'Normal',say:'Listo, modo normal.'},
  enfoque:{label:'Enfoque',route:'agenda',say:'Modo enfoque activado: 25 minutos sin distracciones. Te aviso al terminar.',timer:25},
  gym:{label:'Gym',route:'gimnasio',say:'Modo gym. Vamos con todo.'},
  negocio:{label:'Negocio',route:'negocios',say:'Modo negocio. Aquí están tus negocios.'},
  cierre:{label:'Cierre del día',route:'bitacora',say:'Modo cierre. Cuéntame cómo te fue hoy y lo guardamos en tu bitácora.'},
  noche:{label:'Noche',theme:'dark',say:'Modo noche: tema oscuro y menos movimiento. Descansa.'}
 };
 let timer=null,ends=0;
 const current=()=>Store.get()?.preferences?.evieMode||'normal';
 function badge(){let b=document.getElementById('evie-mode-badge');const m=current();if(m==='normal'){b?.remove();return;}if(!b){b=document.createElement('button');b.id='evie-mode-badge';b.type='button';b.addEventListener('click',()=>set('normal'));document.querySelector('.topbar-actions')?.prepend(b);}b.setAttribute('aria-label','Modo '+modes[m].label+'. Toca para salir');const left=ends?Math.max(0,Math.ceil((ends-Date.now())/60000)):0;b.innerHTML=`<span class="evie-live-dot"></span>${modes[m].label}${left?' · '+left+' min':''}`;}
 function set(m){m=IvyTools.norm(String(m||'')).replace('gimnasio','gym').replace('negocios','negocio');if(!modes[m])return {ok:false,say:'Modo desconocido.'};const def=modes[m];
  Store.save(s=>{s.preferences.evieMode=m;if(def.theme)s.preferences.theme=def.theme;if(m==='noche')s.preferences.motion='reduced';if(m==='normal'&&s.preferences.motion==='reduced'&&s.preferences.evieModeMotion!=='reduced')s.preferences.motion='subtle';});
  clearInterval(timer);timer=null;ends=0;if(def.timer){ends=Date.now()+def.timer*60000;timer=setInterval(()=>{badge();if(Date.now()>=ends){clearInterval(timer);timer=null;ends=0;App.toast('Terminó tu bloque de enfoque. Tómate 5 minutos.');window.EvieAssistant?.ask('Terminó mi bloque de enfoque',{speak:true});set('normal');}},20000);}
  document.documentElement.dataset.evieMode=m;if(def.route&&location.hash.slice(1)!==def.route)location.hash=def.route;else App.render();badge();return {ok:true,mode:m,say:def.say};}
 function apply(){document.documentElement.dataset.evieMode=current();badge();}
 return Object.freeze({set,current,apply,list:()=>Object.keys(modes)});
})();
