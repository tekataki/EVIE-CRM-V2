'use strict';
/* EVIE assistant client.
   Voice loop: mic (MediaRecorder + simple VAD) -> /api/ai/stt (Groq) -> local intents or /api/ai/chat (OpenAI tools)
   -> /api/ai/tts (Fish Audio) -> speaker. Browser speech APIs are fallbacks when cloud is unavailable.
   Read tools run here against the local-first Store. Writes are DRAFTS confirmed by the user (IvyCommandBus). */
window.EvieAssistant=(()=>{
 const e=s=>Domain.escape(String(s??''));
 let lastUndo=null,lastMemoryUsed=null,lastResearch=null,googleDraft=null,recurringDraft=null,habitDraft=null,panel=null,inlineLast={you:'',evie:''},history=[],busy=false,clapOff=null,draft=null,voiceInline=false;
 const pref=()=>({clapWake:false,conversation:true,muted:false,cloudVoice:true,cloudAI:true,voiceId:'',...(Store.get()?.preferences?.evie||{})});
 const runtime=()=>window.EvieAccounts?.config?.()||{};
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&runtime().accountsEnabled;
 const can=k=>cloud()&&runtime().ai?.[k]===true;
 const name=()=>{const x=window.EvieProfile?.current?.();if(x&&x.enabled!==false&&x.preferred_name)return x.preferred_name;const p=Store.get()?.profile||{};return (p.preferred||p.name||'').trim();};
 const zone=()=>{const x=window.EvieProfile?.current?.();return (x&&x.timezone)||DALI_CONFIG.timezone;};
 let prevPhase='idle';
 function setPhase(p){if(p!==prevPhase){if(p==='listening')window.EvieSounds?.play('listen');else if(p==='thinking'&&prevPhase==='listening')window.EvieSounds?.play('process');else if(p==='error')window.EvieSounds?.play('error');if(['speaking','thinking','listening'].includes(p))window.EvieWake?.pause(4000);if(prevPhase==='speaking')window.EvieWake?.pause(900);prevPhase=p;}document.documentElement.dataset.evie=p;const map={idle:'idle',listening:'listening',thinking:'thinking',speaking:'speaking',error:'error'};document.querySelectorAll('[data-evie-phase]').forEach(n=>n.textContent=({idle:'Lista',listening:'Escuchando…',thinking:'Pensando…',speaking:'Hablando…',error:'Algo falló'})[p]||'');try{const cur=IvyState.get().phase,next={listening:'listening',thinking:'thinking',speaking:'speaking',idle:'idle',error:'error'}[map[p]];if(cur!==next){if(cur==='listening'&&next==='thinking')IvyState.transition('transcribing');IvyState.transition(next);}}catch{}window.EvieNeural?.kick();}
 /* ---------- local read tools (shared contract with src/assistant.js TOOLS) ---------- */
 const live=c=>Store.list(c)||[];
 const dateOf=r=>window.Agenda?.dateOf?.(r)||null;
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
   return {date:t,name:name()||null,pending_today:due,overdue,goals_open:goals,bills_due_soon:bills,client_followups:follow,money_today:{income:moneyStr(tx.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0)),expense:moneyStr(tx.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0))},trained_today:gym,habits_today:(window.EvieLife?.todayList()||[]).map(x=>({title:x.h.title,done:x.done})),journal_today:journal,mode:window.EvieModes?.current()||'normal'};},
  get_agenda({from,to}){const a=V2Domain.date(from)?from:today(),b=V2Domain.date(to)?to:a;const out=[];let d=a,guard=0;while(d<=b&&guard++<62){for(const r of live('agendaItems'))if(!['archived'].includes(r.status)&&Agenda.occurrence(r,d))out.push({date:d,title:r.title,done:Agenda.isDone(r,d),time:r.all_day?null:(r.due_at||r.start_at)?Agenda.localValue(r.due_at||r.start_at).slice(11,16):null});d=V2Domain.addDays(d,1);}return {from:a,to:b,items:out.slice(0,60)};},
  get_finance_summary({period='month'}={}){const from=periodFrom(period),t=today(),rows=live('transactions').filter(x=>inRange(x.date,from,t));const inc=rows.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0),exp=rows.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0);const cats={};for(const x of rows.filter(x=>x.type==='expense'))cats[x.category||'Otro']=(cats[x.category||'Otro']||0)+x.amount;
   const accounts=(window.EvieModules?.accounts?.()||[]).map(a=>({name:a.name,type:a.type,estimated:moneyStr(a.balance),...(a.type==='credit'?{available:moneyStr(a.available),cut_day:a.cut||null,due_day:a.due||null}:{})}));
   return {period,from,to:t,income:moneyStr(inc),expense:moneyStr(exp),net:moneyStr(inc-exp),available_now:(()=>{const a=Views.availableNow();return {amount:moneyStr(a.cents),basis:a.basis==='accounts'?'cuentas de efectivo/débito/cartera (sin tarjetas de crédito)':'solo registros (ingresos-gastos históricos); NO es saldo real',unassigned_movements:a.unassigned_count,credit_card_debt:moneyStr(a.credit_debt)};})(),top_expense_categories:Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({category:k,amount:moneyStr(v)})),accounts,bills_pending:live('bills').filter(b=>Domain.outstanding(b)>0).map(b=>({title:b.title,amount:moneyStr(Domain.outstanding(b)),date:b.date})).slice(0,8),note:'Estimación con registros del usuario; no es el saldo real del banco.'};},
  get_business_summary(){const s=DaliCore.select(Store.get()).sales,list=window.EvieModules?.businesses?.()||[];return {soma:{month:s.month,collected:moneyStr(s.collected),target:moneyStr(s.target),receivable:moneyStr(s.receivable),pipeline_weighted:moneyStr(s.pipeline)},businesses:list.map(b=>({name:b.name,kind:b.kind,summary:b.summary})),followups:live('clients').filter(c=>c.nextDate&&c.nextAction&&!['Perdido','Completado'].includes(c.stage)).map(c=>({client:c.title,action:c.nextAction,date:c.nextDate})).slice(0,8)};},
  get_habits(){const l=window.EvieLife?.todayList()||[];return {today:l.map(x=>({title:x.h.title,done:x.done,minimum_done:x.min,streak:EvieLife.streak(EvieLife.data(),x.h)}))};},
  async get_google_calendar({date}){if(!cloud())return {connected:false,note:'Sin cuenta en la nube.'};const d=V2Domain.date(date)?date:today();try{return await EvieAccounts.request('connections/google/events?date='+d+'&tz='+encodeURIComponent(DALI_CONFIG.timezone));}catch(err){return {connected:false,error:err.message};}},
  get_goals(){return {goals:live('goals').filter(g=>!g.archived).map(g=>({title:g.title,progress:g.progress,target:g.target,date:g.date})).slice(0,20)};},
  get_journal_stats({days=30}={}){const pr=window.EvieProfile?.current?.();if(pr&&pr.use_journal!==true)return {not_allowed:true,note:'El usuario no habilitó usar su bitácora como contexto. Pídele que lo active en Configuración personalizada.'};const n=Math.max(1,Math.min(365,days|0||30)),from=V2Domain.addDays(today(),-(n-1)),res={};for(const k of ['alegria','tristeza','enojo','calma','ansiedad','gratitud']){const st=JournalData.statistics(Store.list('journal'),k,from,today());const vals=(st.points||[]).filter(p=>p.value!=null).map(p=>p.value);res[k]=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;}return {days:n,averages_0_100:res,entries:live('journal').filter(j=>j.date>=from).length,note:'Promedios de intensidades reportadas/confirmadas. No es evaluación clínica.'};},
  get_gym_summary(){const rows=live('gymSessions').sort((a,b)=>b.date.localeCompare(a.date)),week=V2Domain.addDays(today(),-6),nut=Store.get().preferences.evieNutrition||null;return {last:rows[0]?{title:rows[0].title,date:rows[0].date}:null,sessions_last_7_days:rows.filter(r=>r.date>=week).length,calorie_target:nut?.target||null};},
  search_records({query=''}={}){const q=IvyTools.norm(String(query)).slice(0,80);if(q.length<2)return {results:[]};const out=[];for(const [c,r] of [['agendaItems','agenda'],['transactions','finanzas'],['goals','objetivos'],['clients','soma'],['journal','bitacora'],['books','libros'],['skills','aprendizaje']])for(const x of live(c))if(IvyTools.norm(String(x.title||'')+' '+String(x.note||x.text||'').slice(0,300)).includes(q))out.push({type:c,title:x.title,date:x.date||null,route:r});return {results:out.slice(0,12)};},
  show_card({card}){if(!window.EvieHUD?.REGISTRY?.[card])return {ok:false,error:'Tarjeta no disponible.'};return EvieHUD.open(card);},
  async open_shortcut({name}){if(!window.EvieAutomations)return {ok:false,status:'unavailable'};const hits=EvieAutomations.match(Store.list('automations'),String(name||''));if(!hits.length)return {ok:false,status:'not_found',saved:Store.list('automations').map(r=>r.name).slice(0,20)};if(hits.length>1)return {ok:false,status:'ambiguous',options:hits.map(r=>r.name)};const r=hits[0];const c=EvieHUD.open('shortcut',{id:r.id,title:r.name,name:r.name});const x=await EvieAutomationsView.openShortcut(r);if(c.id)EvieHUD.update(c.id,{status:x.status,note:x.note||null});return {ok:x.ok,status:x.status,name:r.name,domain:r.domain,note:x.note||x.error,card_shown:true};},
  close_card({card}){if(!window.EvieHUD)return {ok:false};const r=EvieHUD.close(card==null?null:card);return r.ambiguous?{ok:false,status:'ambiguous',options:r.ambiguous}:r;},
  get_pendientes(){if(!window.EviePendientes)return {items:[]};const l=EviePendientes.build(Store.get(),{today:today(),now:new Intl.DateTimeFormat('en-GB',{timeZone:zone(),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())});const shown=window.EvieHUD?EvieHUD.open('pendientes').ok:false;return {counts:EviePendientes.counts(l),items:l.slice(0,15).map(x=>({title:x.title,source:x.source,kind:x.kind,date:x.date,time:x.time,severity:x.severity})),card_shown:shown};},
  async research_web({query}){if(!cloud())return {ok:false,status:'unavailable',note:'Necesitas iniciar sesión con tu cuenta EVIE.'};try{const r=await EvieAccounts.request('info/research',{method:'POST',body:{query}});lastResearch=r;window.EvieHUD?.open('research',{query,data:r,title:'Investigación'});return {ok:true,insufficient:r.insufficient,summary:r.summary,spoken:r.spoken,event_date:r.event_date,sources:r.sources.map(x=>({title:x.title,host:x.host,published:x.published})),retrieved_at:r.retrieved_at,card_shown:true};}catch(err){return {ok:false,error:err.message};}},
  async get_weather({place}){if(!cloud())return {ok:false,status:'unavailable',note:'Necesitas iniciar sesión con tu cuenta EVIE.'};try{const r=await EvieAccounts.request('info/weather',{method:'POST',body:place?{place}:{}});if(!r.needs_location)window.EvieHUD?.open('weather',{place,data:r});return r;}catch(err){return {ok:false,error:err.message};}},
  propose_learning_path({topic}){if(!window.EvieHUD)return {ok:false};const ex=EvieHUD.findSkill(topic);EvieHUD.open('learning',{topic,title:'Ruta: '+String(topic).slice(0,40)});return {status:'preview_shown',needs_user_confirmation:true,existing_topic:ex?ex.title:null,note:'La vista previa está en una tarjeta; nada se guarda sin confirmación.'};},
  async desktop_action({action,contact,message}){return window.EvieDesktopActions?EvieDesktopActions.run(action,{contact,message}):{ok:false,status:'unavailable'};},
  navigate({route}){if(['gimnasio','gym','salud'].includes(route))route='fisico';if(DALI_CONFIG.sections.some(s=>s.route===route)){location.hash=route;return {ok:true,opened:route};}return {ok:false};},
  set_mode({mode}){return window.EvieModes.set(mode);},
  draft_task({title,date,time}){return makeDraft('agenda.create',{title,...(V2Domain.date(date)?{date}:{}),...(time&&/^\d{2}:\d{2}$/.test(time)&&V2Domain.date(date)?{time}:{})});},
  list_accounts(){const av=FinanceCore.available(EvieFinance.accounts(),live('transactions'),{today:today()});return {accounts:av.accounts.map(a=>({name:a.name,type:a.type,estimated_balance:moneyStr(a.balance)})),credit:av.credit.map(c=>({name:c.name,used:moneyStr(c.used),available_credit:moneyStr(c.available_credit)})),available_total:moneyStr(av.cents),unassigned_movements:av.unassigned_count,note:'Estimaciones con registros del usuario; no es el saldo del banco.'};},
  log_workout(a={},call){const groups=window.FisicoCore?FisicoCore.groupsFrom((a.muscles||[]).join(' y ')):[];const r=EvieFisico.logWorkout({groups,date:a.date||null,op_id:call?.call_id||null,title:a.title||null});if(r.undo){App.render();App.toast(r.say,'success',r.undo);lastUndo=r.undo;window.EvieFinance?.setLastUndo?.(r.undo);}return {status:r.status,question:r.question,summary:r.say||r.error};},
  log_transaction(a={},call){const client=a.soma_client_name?Store.list('clients').filter(c=>IvyTools.norm(c.title)===IvyTools.norm(a.soma_client_name)):[];if(a.soma_client_name&&client.length!==1)return {status:'needs_client',question:client.length?'Hay varios clientes con ese nombre. ¿Cuál?':'No encontré a ese cliente en SOMA. ¿Lo registro sin vincular?'};
   const r=EvieFinance.log({type:a.type,amount:Math.round(Number(a.amount)*100),title:a.title,account:a.account||'',category:a.category,date:a.date,soma_client:client[0]?.id,op_id:call?.call_id,source:'ivi-ai'});
   if(r.status==='needs')return {status:r.field==='account'?'needs_account':'needs_'+r.field,question:r.question,accounts:r.candidates?.map(c=>c.name)};if(r.status==='created'){App.render();App.toast(r.say.replace(/^Listo: /,''),'success',r.undo);window.EvieSounds?.play?.('confirm');lastUndo=r.undo;EvieFinance.setLastUndo(r.undo);}
   return {status:r.status,account:r.account||null,balance:r.balance||null,summary:r.say||r.error};},
  transfer_money(a={},call){const r=EvieFinance.transfer({amount:Math.round(Number(a.amount)*100),from:a.from_account,to:a.to_account,date:a.date,op_id:call?.call_id,source:'ivi-ai'});if(r.status==='created'){App.render();App.toast('Traspaso registrado.','success',r.undo);lastUndo=r.undo;EvieFinance.setLastUndo(r.undo);}return {status:r.status,question:r.question,summary:r.say||r.error};},
  draft_transaction({type,amount,title,date}){return makeDraft('finance.create',{type,amount:Math.round(Number(amount)*100),title,date:V2Domain.date(date)?date:today()});},
  draft_journal_note({title,text}){return makeDraft('journal.create',{title,text,date:today()});},
  draft_habit_check({title}){const l=window.EvieLife?.todayList()||[],q=IvyTools.norm(String(title||'')),m=l.filter(x=>IvyTools.norm(x.h.title).includes(q)||q.includes(IvyTools.norm(x.h.title)));if(m.length!==1)return {status:'invalid',error:m.length?'Hay varios hábitos parecidos.':'No encontré ese hábito hoy.',options:l.map(x=>x.h.title)};if(m[0].done)return {status:'already_done'};habitDraft=m[0].h;draft={token:'habit',fields:{Hábito:m[0].h.title,Acción:'Marcar como cumplido hoy'},route:'habitos'};renderDraft();return {status:'draft_shown',needs_user_confirmation:true};},
  draft_recurring(a){const t=today(),start=V2Domain.date(a.start_date)&&a.start_date>=t?a.start_date:t,freq=['daily','weekly','monthly','yearly'].includes(a.frequency)?a.frequency:'monthly';
   const rec={frequency:freq,interval:1,timezone:DALI_CONFIG.timezone,time_local:/^\d{2}:\d{2}$/.test(a.time||'')?a.time:null,days_of_week:freq==='weekly'?(a.days_of_week||[]).filter(n=>n>=0&&n<=6):[],day_of_month:null,end_date:V2Domain.date(a.end_date)?a.end_date:null};
   if(freq==='monthly'){const d=[...new Set((a.days_of_month||[]).filter(n=>n>=1&&n<=31))].sort((x,y)=>x-y);if(!d.length)return {status:'needs_info',ask:'¿Qué día o días del mes?'};if(d.length===1)rec.day_of_month=d[0];else rec.days_of_month=d;}
   if(!rec.end_date)return {status:'needs_info',ask:'¿Hasta cuándo se repite? (o dime si es indefinido y lo pongo por 12 meses)'};
   const dates=AgendaRules.expand(start,rec,start,rec.end_date,120);if(!dates.length)return {status:'invalid',error:'No hay fechas en ese rango.'};
   const title=String(a.title||'').trim().slice(0,140);if(!title)return {status:'needs_info',ask:'¿Cómo lo llamo?'};
   const payment=/payment/.test(a.kind||'');const amount=Number.isFinite(a.amount)&&a.amount>0?Math.round(a.amount*100):null;
   const dupe=live('agendaItems').find(r=>!r.deleted_at&&r.recurrence&&IvyTools.norm(r.title)===IvyTools.norm(title)&&dateOf(r)===dates[0]);if(dupe)return {status:'duplicate',note:'Ya existe una serie igual que empieza el '+dates[0]+'. No se creó otra.'};
   recurringDraft={title,rec:{...rec,start:dates[0]},first:dates[0],dates,payment,amount,kind:a.kind||'task'};
   draft={token:'recurring',fields:{Título:title,Destino:'Agenda de EVIE (no Google Calendar)',Repetición:freq==='monthly'?'Días '+(rec.days_of_month||[rec.day_of_month]).join(' y ')+' de cada mes':freq,Hasta:Views.date(rec.end_date),[`Fechas (${dates.length})`]:dates.map(d=>Views.date(d,{day:'numeric',month:'short'})).join(' · '),...(payment?{Monto:amount?moneyStr(amount)+' cada vez':'Falta: escríbelo abajo',Nota:'Es un pago programado: no se registra como ingreso hasta que lo marques recibido.'}:{})},route:'agenda',needsAmount:payment&&!amount};
   renderDraft();return {status:'draft_shown',needs_user_confirmation:true,occurrences:dates,needs_amount:payment&&!amount,note:payment&&!amount?'Pregunta el monto; el usuario puede escribirlo en la tarjeta.':undefined};},
  async draft_google_event(a){if(!cloud())return {status:'unavailable',note:'Google Calendar requiere iniciar sesión con tu cuenta EVIE.'};
   let st=window.EvieSettings?.googleStatus?.();if(!st){try{const r=await EvieAccounts.request('connections');const g=r.connections.find(c=>c.id==='google_calendar');st={connected:g?.status==='connected',write:!!g?.write,setup:g?.setup};}catch{st={connected:false};}}
   if(st.setup)return {status:'unavailable',note:'Google Calendar aún no está configurado en el servidor: falta GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (ver docs/SETUP.md). Puedo guardarlo en la Agenda de EVIE.'};
   if(!st.connected)return {status:'unavailable',note:'No has conectado tu Google Calendar. Ve a Configuración → Conexiones. Mientras, puedo guardarlo en la Agenda de EVIE.'};
   if(!st.write)return {status:'unavailable',note:'Tu conexión con Google es de solo lectura. En Conexiones toca «Permitir que EVIE cree eventos».'};
   if(!V2Domain.date(a.date))return {status:'needs_info',ask:'¿Qué día?'};const title=String(a.title||'').trim();if(!title)return {status:'needs_info',ask:'¿Cómo se llama el evento?'};
   const key=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>'0123456789abcdefghijklmnopqrstuv'[b%32]).join('');
   googleDraft={title,date:a.date,time:/^\d{2}:\d{2}$/.test(a.time||'')?a.time:null,duration_minutes:a.duration_minutes||60,reminder_minutes:a.reminder_minutes??null,timezone:zone(),idempotency_key:key};
   draft={token:'google',fields:{Destino:'Google Calendar (tu cuenta)',Título:title,Fecha:Views.date(a.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}),Hora:googleDraft.time?googleDraft.time+' · '+googleDraft.duration_minutes+' min':'Todo el día',Zona:googleDraft.timezone,...(googleDraft.reminder_minutes!=null?{Recordatorio:googleDraft.reminder_minutes+' min antes'}:{})},route:'agenda'};renderDraft();return {status:'draft_shown',needs_user_confirmation:true};},
  draft_goal({title}){return makeDraft('goal.create',{title,date:today()});}
 };
 function makeDraft(intent,params){try{const cmd=IvyCommandBus.envelope(intent,params,'voice','write');const p=IvyCommandBus.prepare(cmd);draft={token:p.token,fields:p.fields,route:p.route};renderDraft();return {status:'draft_shown',needs_user_confirmation:true,fields:p.fields};}catch(err){return {status:'invalid',error:err.message};}}
 /* ---------- local fast-path (free, no network) ---------- */
 function tryLocal(text){const speakLater=t=>{if(t){append('evie',t);if(!pref().muted)Voice.speak(t,Voice.begin());}};if(window.EvieMemory){const mm=EvieMemory.intent(text,{say:speakLater});if(mm!==null)return mm;}if(window.EvieMap){const mp=EvieMap.intent(text,{say:speakLater});if(mp!==null)return mp;}if(/^(?:(?:oye |hey )?(?:ivi|ivy|evie|evi|ibi|libi)[, ]+)?(?:deshaz|deshacer|desase) (?:lo ultimo|el ultimo (?:movimiento|registro|gasto|ingreso)|eso)$/.test(IvyTools.norm(text).replace(/[¿?¡!.,]/g,''))){const u=lastUndo||window.EvieFinance?.lastUndo?.();if(!u)return 'No tengo un registro reciente que deshacer.';u();lastUndo=null;window.EvieFinance?.setLastUndo?.(null);return 'Listo, lo deshice.';}if(window.EvieFisico){const fw=EvieFisico.intent(text);if(fw!==null)return fw;}if(window.EvieFinance){const fi=EvieFinance.intent(text);if(fi!==null)return fi;}const q=IvyTools.norm(text).replace(/[¿?¡!.,]/g,'').replace(/^(oye |hey |hola |ok )?(?:evie|evi|ivi|ivy|ibi|libi|eby|evy)[, ]+/,'').trim();
  let m=q.match(/^(?:activa|activar|pon|entra en|cambia a)(?: el)? modo (\w+)/);if(m){const r=window.EvieModes.set(m[1]);return r.ok?r.say:'No conozco el modo '+m[1]+'. Tengo enfoque, gym, negocio, cierre, noche y normal.';}
  if(/^(?:desactiva|salir? del?|quita)(?: el)? modo/.test(q)){window.EvieModes.set('normal');return 'Listo, volví al modo normal.';}
  m=q.match(/^(?:marca|completa|ya (?:hice|fui a|fui al|termine))(?: el| la| mi)? (?:habito )?(.+)$/);if(m&&window.EvieLife){const r=tools.draft_habit_check({title:m[1]});if(r.status==='draft_shown')return 'Te dejo la confirmación en pantalla.';}
  if(/^(callate|silencio|para|deten|detente|stop)$/.test(q)){stopSpeaking();return '';}
  const hud=hudLocal(q);if(hud!==null)return hud;
  try{const cmd=IvyCommandBus.parse(text,'voice');
   if(cmd.intent==='navigate'){location.hash=cmd.parameters.route;return 'Abriendo '+(DALI_CONFIG.sections.find(s=>s.route===cmd.parameters.route)?.label||cmd.parameters.route)+'.';}
   if(cmd.risk==='write'&&IvyTools.intents.includes(cmd.intent)){const p=IvyCommandBus.prepare(cmd);draft={token:p.token,fields:p.fields,route:p.route};renderDraft();return 'Te dejé la propuesta en pantalla. Confírmala para guardarla.';}
  }catch{}
  if(!can('chat')&&window.AgendaRules){const pm=AgendaRules.parseMonthly(text,today());if(pm){const title=(text.match(/(?:pagos?|cobros?|recordatorios?) (?:de |del )?([\wÁÉÍÓÚáéíóúñÑ ]{2,40}?)(?: el | los | cada |$)/i)?.[1]||'Pago programado').trim();const r=tools.draft_recurring({title:/pago|cobro/i.test(text)?'Pago '+title:title,frequency:'monthly',days_of_month:pm.days_of_month,start_date:today(),end_date:pm.end_date,time:null,amount:null,kind:/pago|cobro/i.test(text)?'payment_expected':'task'});if(r.status==='draft_shown')return r.needs_amount?'Te dejé las fechas en pantalla. ¿De cuánto es cada pago?':'Te dejé las fechas en pantalla para confirmar.';if(r.ask)return r.ask;if(r.note)return r.note;}}
  if(/(?:que|cual).*(?:pendiente|tengo|hay).*(?:hoy|dia)|como va mi dia|resumen de hoy/.test(q)&&!can('chat'))return speakOverview();
  return null;}
 // HUD intents that need no paid AI call: open/close cards, time, capabilities, pendientes, desktop media.
 const CARD_WORDS=[['pendientes',/pendientes|notificaciones|avisos/],['finanzas',/finanzas|dinero|gastos|ingresos/],['agenda',/agenda|calendario/],['habitos',/habitos?/],['objetivos',/objetivos?|metas/],['gimnasio',/gym|gimnasio|salud|entrenamiento|fisico|musculos?|cuerpo/],['soma',/soma|clientes|cobros/],['aprendizaje',/aprendizaje|estudio|cursos?/],['negocios',/negocios?/],['libros',/libros|biblioteca|lectura/],['vision',/vision( board)?/],['tendencias',/tendencias/],['logros',/logros/],['automatizaciones',/automatizaciones|atajos/],['mapa',/\bmapa\b/],['kisha',/kisha|mascota( virtual)?|perrita/],['timer',/temporizador(es)?|cronometro|timer/],['clock',/reloj|la hora|que hora|hora es/],['weather',/clima|tiempo que hace|pronostico|temperatura/]];
 function cardFrom(t){for(const [k,rx] of CARD_WORDS)if(rx.test(t))return k;return null;}
 /* Several cards in ONE utterance, opened in the spoken order. Returns spoken text or null (0–1 card → other paths). */
 function multiOpen(q){const parts=q.replace(/^(?:por favor )?(?:abre|abrir|abreme|muestrame|muestra|ensename|pon|ponme|dame|dime)(?: (?:el|la|los|las|mi|mis))? /,'').split(/\s*(?:,|\by tambien\b|\by luego\b|\by despues\b|\btambien\b|\by\b|\be\b)\s+/).map(s=>s.replace(/^(?:abre|abreme|muestrame|muestra|ensename|dime|dame|pon|ponme)(?: (?:el|la|los|las|mi|mis|a))? /,'').trim()).filter(Boolean);if(parts.length<2)return null;
  const cards=[];for(const p of parts){const k=cardFrom(p);if(!k||k==='timer')return null;if(!cards.includes(k))cards.push(k);}if(cards.length<2)return null;
  const said=[];for(const k of cards){if(k==='weather'){if(!cloud()){said.push('el clima (necesita tu cuenta EVIE)');continue;}tools.get_weather({place:null}).catch(()=>{});said.push('el clima');continue;}const r=EvieHUD.open(k);if(r.ok)said.push(k==='clock'?'la hora':EvieHUD.REGISTRY[k]?.title||k);}
  const t=cards.includes('clock')?' Son las '+new Intl.DateTimeFormat('es-MX',{timeZone:zone(),hour:'numeric',minute:'2-digit',hour12:true}).format(new Date())+'.':'';
  return said.length?'Te dejé '+(said.length>1?said.slice(0,-1).join(', ')+' y '+said.at(-1):said[0])+' en pantalla.'+t:null;}
 /* Automatizaciones: "abre la página de SOMA" → saved website; "abre el apartado de SOMA" → module.
    Returns a spoken string, '' (reply comes async via say()) or null (not a shortcut request). */
 function shortcutIntent(target){const A=window.EvieAutomations,list=Store.list('automations'),it=A.intent(target);
  if(it.module&&!it.site)return null;
  const hits=A.match(list,target);
  if(!hits.length){if(it.site)return list.length?`No tengo guardada una automatización que coincida con «${target}». Puedes agregarla en Automatizaciones.`:'Aún no tienes automatizaciones guardadas. Agrégala en Automatizaciones con la dirección real del sitio.';return null;}
  if(hits.length>1)return '¿Cuál abro? '+hits.slice(0,4).map(r=>'«'+r.name+'»').join(', ')+'.';
  const r=hits[0],mod=cardFrom(target);
  if(!it.site&&mod&&EvieHUD.REGISTRY[mod]&&A.norm(r.name)!==A.norm(target))return `¿Te abro el apartado ${EvieHUD.REGISTRY[mod].title} o la página guardada «${r.name}»? Di «abre el apartado de…» o «abre la página de…».`;
  const card=EvieHUD.open('shortcut',{id:r.id,title:r.name,name:r.name});
  EvieAutomationsView.openShortcut(r).then(x=>{const nm='«'+r.name+'»';const msg=x.status==='opened_desktop'?`Abrí ${nm} en tu navegador.`:x.status==='opened'?`Abrí ${nm} en una pestaña nueva.`:x.status==='attempted'?`Intenté abrir ${nm}. Si tu navegador la bloqueó, toca «Abrir» en la tarjeta.`:`No pude abrir ${nm}: ${x.error||'error'}. El enlace está en la tarjeta.`;
   if(card.id)EvieHUD.update(card.id,{status:x.status,note:x.note||null});say(msg);});
  return '';}
 function hudLocal(q){if(!window.EvieHUD)return null;q=q.replace(/^(oye |hey |ok )?(ivi|ivy|evie|evi|libi|ibi)[, ]*/,'').trim();
  {const mo=multiOpen(q);if(mo!==null)return mo;}
  // Presentation-only: closes HUD cards; never completes/deletes CRM records ("finaliza esta tarjeta" included).
  let m=q.match(/^(?:cierra|quita|oculta|cerrar|quitar|finaliza|termina|descarta)(?: (?:el|la|los|las|este|esta|ese|esa))? ?(tarjetas?|ventanas?|apartado|esto|eso|todo|todas)?(?: (?:las )?tarjetas)?(?: (?:de|del|sobre|con))? ?(.*)$/);
  if(m&&(m[1]||/^(?:cierra|quita|oculta|cerrar|quitar)/.test(q))){let what=(m[2]||'').trim().replace(/^(?:la|el|las|los) /,'');
   if(/^(todo|todas)$/.test(m[1]||'')||/^(todo|todas)/.test(what)||/^tarjetas$/.test(m[1]||'')&&!what){if(window.EvieCaps?.visible())EvieCaps.hide();const r=EvieHUD.close('all');return r.ok?'Listo, cerré todas las tarjetas. Tus datos siguen intactos.':'No hay tarjetas abiertas.';}
   if(/^(?:lo que puedes hacer|capacidades|menu|modulos)$/.test(what)&&window.EvieCaps?.visible()){EvieCaps.hide();return 'Listo.';}
   const ref=what?(cardFrom(what)&&!/sobre|de la|del /.test(m[0])&&what.split(' ').length<=2?cardFrom(what):what):null;
   const r=EvieHUD.close(ref);if(r.ok)return 'Cerré '+(r.title?'«'+r.title+'»':'la tarjeta')+'.';
   if(r.ambiguous)return '¿Cuál cierro? Tengo abiertas: '+r.ambiguous.slice(0,4).join(', ')+'.';
   if(!what&&!EvieHUD.cards().length)return 'No hay tarjetas abiertas.';
   if(/^(?:finaliza|termina|descarta)/.test(q))return null;
   return 'No veo una tarjeta abierta que coincida con «'+what+'».';}
  if(/^(?:que|cual) hora es|^(?:dime|me dices) la hora|^que dia es hoy|^que fecha es/.test(q)){EvieHUD.open('clock');const d=new Date(),z=zone(),t=new Intl.DateTimeFormat('es-MX',{timeZone:z,hour:'numeric',minute:'2-digit',hour12:true}).format(d),f=new Intl.DateTimeFormat('es-MX',{timeZone:z,weekday:'long',day:'numeric',month:'long'}).format(d);return /dia|fecha/.test(q)?`Hoy es ${f}. Son las ${t}.`:`Son las ${t}, ${f}.`;}
  if(/^que (?:puedes|sabes) hacer|^(?:en )?que me (?:puedes )?ayudar|^ayuda$/.test(q)){EvieHUD.open('capabilities');const caps=EvieHUD.capabilities().flatMap(g=>g.items),ready=caps.filter(x=>x.state==='ready').length,cfg=caps.filter(x=>x.state==='config').length;return `Te dejé en pantalla lo que puedo hacer: ${ready} cosas listas${cfg?`, ${cfg} que necesitan configuración`:''} y lo que llegará después. Toca cualquiera para abrirla.`;}
  if(/^(?:que|cuales) pendientes tengo|^mis pendientes|^que tengo pendiente/.test(q)){tools.get_pendientes();return EviePendientes.spoken(EviePendientes.build(Store.get(),{today:today(),now:new Intl.DateTimeFormat('en-GB',{timeZone:zone(),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())}),name());}
  if(/^que tengo (?:hoy|para hoy)|^como (?:va|viene) mi dia|^resumen de hoy/.test(q)){EvieHUD.open('today');return speakOverview();}
  {const sm=q.match(/^(?:abre|abrir|abreme|ve a|vamos a|llevame a|entra a|entra en|ir a)(?: (?:el|la|los|las|mi|mis|a|al))? (.+)$/);if(sm&&window.EvieAutomations){const r=shortcutIntent(sm[1]);if(r!==null)return r;}}
  m=q.match(/^(?:abre|abrir|muestrame|muestra|ensename|ve a|vamos a|llevame a|abreme)(?: (?:el|la|los|las|mi|mis|a))? (.+)$/);
  if(m){const k=cardFrom(m[1]);if(k&&k!=='weather'){EvieHUD.open(k);return k==='kisha'?'Aquí está Kisha. Toca «Iniciar conversación» cuando quieras platicar con ella.':'Abriendo '+EvieHUD.REGISTRY[k].title+'.';}
   if(/spotify|whatsapp/.test(m[1])&&window.EvieDesktopActions){const sp=/spotify/.test(m[1]);EvieDesktopActions.run(sp?'open_spotify':'open_whatsapp').then(r=>append('evie',r.ok?'Solicité abrir '+(sp?'Spotify':'WhatsApp')+'.':(r.note||r.error)));return '';}}
  if(/^(?:cambia|siguiente|pasa|salta)(?: de| a la)?(?: la)? (?:cancion|rola|tema)|^siguiente cancion/.test(q)&&window.EvieDesktopActions){EvieDesktopActions.run('media_next').then(r=>append('evie',r.ok?'Envié «siguiente canción» a Windows; el reproductor decide si la acepta.':(r.note||r.error)));return '';}
  if(/^(?:pausa|pon pausa|reanuda|pon play)(?: a)?(?: la)? (?:musica|cancion)/.test(q)&&window.EvieDesktopActions){EvieDesktopActions.run('media_play_pause').then(r=>append('evie',r.ok?'Envié pausa/reproducir a Windows.':(r.note||r.error)));return '';}
  return null;}
 function speakOverview(){const o=tools.get_today_overview(),n=o.name?o.name+', ':'',p=o.pending_today;let s=p.length?`${n}hoy tienes ${p.length} pendiente${p.length>1?'s':''}: ${p.slice(0,3).map(x=>x.title+(x.time?' a las '+x.time:'')).join(', ')}${p.length>3?' y más':''}.`:`${n}no tienes pendientes fechados para hoy.`;if(o.overdue.length)s+=` Ojo: ${o.overdue.length} vencido${o.overdue.length>1?'s':''}.`;if(o.bills_due_soon.length)s+=` Pagos próximos: ${o.bills_due_soon.map(b=>b.title).slice(0,2).join(' y ')}.`;return s;}
 /* ---------- OpenAI loop via server ---------- */
 async function chat(text,signal){
  history.push({role:'user',content:text});history=history.slice(-14);
  window.EvieProfile?.load?.().catch(()=>{});const context={name:name(),timezone:zone(),currency:DALI_CONFIG.currency};let input=[...history];
  for(let step=0;step<4;step++){
   const r=await EvieAccounts.request('ai/chat',{method:'POST',body:{input,context,private:!!window.EvieMemory?.isPrivate?.()},signal});if(r.memory_used)lastMemoryUsed=r.memory_used;if(signal?.aborted)throw Object.assign(Error('cancelado'),{name:'AbortError'});
   if(!r.calls?.length){const say=(r.text||'').trim()||'Listo.';history.push({role:'assistant',content:say.slice(0,3900)});return {memory:lastMemoryUsed,text:say,spoken:(r.spoken||say).trim(),sources:Array.isArray(r.sources)?r.sources:[],checked:r.checked_at||null,webUnavailable:!!r.web_unavailable};}
   input=[...input,...(r.reasoning||[]),...r.calls];
   for(const c of r.calls){let args={};try{args=JSON.parse(c.arguments||'{}');}catch{}let out;try{const fn=tools[c.name]||window.EvieMemory?.tools?.[c.name]||window.EvieMap?.tools?.[c.name];out=fn?await fn(args,c):{error:'unknown tool'};}catch(err){out={error:err.message};}input.push({type:'function_call_output',call_id:c.call_id,output:JSON.stringify(out).slice(0,12000)});}
  }
  return 'Necesito más contexto para eso. ¿Me lo dices de otra forma?';
 }
 async function ask(text,{speak=true,inline=false,turnToken=null}={}){
  text=String(text||'').trim();if(!text)return;window.EvieMemory?.track?.(text);if(!turnToken)Voice.unlock();const t=turnToken||Voice.begin();if(!(inline||onStage()))open();append('user',text);busy=true;Voice.set('thinking');
  let say;try{say=tryLocal(text);if(say===null){if(can('chat')&&pref().cloudAI)say=await chat(text,t.signal);else say=fallbackAnswer(text);}}catch(err){if(!Voice.alive(t.id))return;say=err.name==='AbortError'?'':err.status===429?err.message:(err.message||'No pude responder.');}
  if(!Voice.alive(t.id))return;busy=false;
  const ans=typeof say==='object'&&say?say:{text:say,spoken:say,sources:[]};
  if(ans.text){append('evie',ans.text,ans);if(speak&&!pref().muted)await Voice.speak(ans.spoken||ans.text,t);}
  if(!Voice.alive(t.id))return;if(Voice.state!=='blocked')Voice.set('idle');
  if(speak&&pref().conversation&&(panel?.dataset.voice==='1'||voiceInline)&&!draft&&ans.text&&/\?\s*$/.test(ans.text)&&Voice.state==='idle')listen({inline:true});
 }
 function fallbackAnswer(text){try{const cmd=IvyCommandBus.parse(text,'voice');if(cmd.intent==='summary')return IvyTools.read(cmd.parameters.kind).text;}catch{}return can('chat')?'':'Puedo abrir secciones, darte el resumen de hoy, crear pendientes o registrar gastos. Para preguntas libres, configura EVIE IA en Ajustes.';}
 /* ---------- Voice controller: one explicit state machine per turn ----------
    idle → arming → listening → transcribing → thinking → synthesizing → speaking → idle
    blocked: iOS refused autoplay → text stays visible + "Toca para escuchar" replays the SAME audio (no new paid request)
    error(stage): mic | stt | chat | tts | play → short message, back to idle.
    Every async step carries its turn id; a newer turn aborts and outranks older ones. */
 const Voice=(()=>{
  let state='idle',turn=0,ctl=null,ctx=null,player=null,silent=null,last=null,rec=null,routed=false,simTimer=null;const diag=[];
  const AC=()=>window.AudioContext||window.webkitAudioContext;
  const apple=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||(/Safari\//.test(navigator.userAgent)&&!/Chrome|Chromium|Android/.test(navigator.userAgent));
  const visual={idle:'idle',arming:'listening',listening:'listening',transcribing:'thinking',thinking:'thinking',synthesizing:'thinking',speaking:'speaking',blocked:'idle',error:'error'};
  function note(stage,code){diag.push({t:Date.now(),stage,code:String(code||'').slice(0,40)});if(diag.length>20)diag.shift();}
  function set(s){state=s;setPhase(visual[s]||'idle');document.documentElement.dataset.evieVoice=s;syncReplay();}
  function silentWav(){const n=800,b=new ArrayBuffer(44+n*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);return URL.createObjectURL(new Blob([b],{type:'audio/wav'}));}
  // MUST run synchronously inside a user gesture: resumes the shared AudioContext and primes the single
  // reusable <audio> element so Safari allows the later (post-network) play() of the answer.
  function unlock(){try{if(!ctx){const K=AC();if(K)ctx=new K();}if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{});}catch{}
   if(!player){player=new Audio();player.preload='auto';player.setAttribute('playsinline','');player.setAttribute('webkit-playsinline','');}
   if(player.paused&&state!=='speaking'){try{player.src=silent||(silent=silentWav());const p=player.play();p?.catch?.(()=>{});}catch{}}}
  function begin(){turn++;try{ctl?.abort();}catch{}ctl=new AbortController();if(rec)rec.stop(true);halt();return {id:turn,signal:ctl.signal};}
  const alive=id=>id===turn;
  function halt(){clearInterval(simTimer);simTimer=null;try{if(player&&!player.paused&&player.src!==silent)player.pause();}catch{}try{speechSynthesis.cancel();}catch{}}
  function stop(){turn++;try{ctl?.abort();}catch{}if(rec)rec.stop(true);halt();set('idle');}
  function fail(stage,msg,id){if(id!=null&&!alive(id))return;note(stage,msg);if(msg)append('evie',msg);set('error');setTimeout(()=>{if(state==='error')set(last&&last.pending?'blocked':'idle');},1600);}
  function pickType(){if(!window.MediaRecorder)return '';const ok=t=>{try{return MediaRecorder.isTypeSupported?.(t);}catch{return false;}};const order=apple?['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm']:['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];return order.find(ok)||'';}
  function blobType(chunks,mr,type){const t=(chunks[0]?.type||mr.mimeType||type||'').split(';')[0];return /^audio\//.test(t)?t:(apple?'audio/mp4':'audio/webm');}
  async function record(t){set('arming');let stream;
   try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});}
   catch(e){return fail('mic',['NotAllowedError','SecurityError'].includes(e?.name)?'Necesito permiso de micrófono. Actívalo en los ajustes del navegador, o escríbeme.':'No pude abrir el micrófono. Puedes escribirme.',t.id);}
   if(!alive(t.id)||document.hidden){stream.getTracks().forEach(x=>x.stop());if(alive(t.id))set('idle');return;}
   const type=pickType();let mr;try{mr=new MediaRecorder(stream,type?{mimeType:type}:{});}catch{try{mr=new MediaRecorder(stream);}catch{stream.getTracks().forEach(x=>x.stop());return fail('mic','Este navegador no puede grabar audio aquí. Escríbeme abajo.',t.id);}}
   const chunks=[],started=performance.now();let heard=false,quietSince=null,raf=null,src=null,an=null,buf=null,vadOk=false,floor=null,flat=0,done=false,discard=false;
   try{if(ctx){if(ctx.state!=='running')await ctx.resume().catch(()=>{});if(ctx.state==='running'){src=ctx.createMediaStreamSource(stream);an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);buf=new Uint8Array(an.fftSize);vadOk=true;}}}catch{vadOk=false;}
   if(!vadOk)note('vad','unavailable');
   const vad=()=>{raf=null;if(done)return;const now=performance.now(),el=now-started;
    if(vadOk){an.getByteTimeDomainData(buf);let e2=0;for(const v of buf)e2+=((v-128)/128)**2;const rms=Math.sqrt(e2/buf.length);
     if(rms===0){if(++flat>90){vadOk=false;note('vad','flat');}}else flat=0;
     if(el<400)floor=floor==null?rms:Math.min(floor,rms)*.5+rms*.5;const thr=Math.min(.035,Math.max(.012,(floor||0)*2.5+.01));
     const lv=Math.min(1,rms*8);EvieNeural?.setMic(lv);EvieFX?.mic(lv);
     if(el>400&&rms>thr){heard=true;quietSince=null;}else if(heard){quietSince??=now;if(now-quietSince>1400)return rec?.stop(false);}
     if(!heard&&el>8000)return rec?.stop(false);}
    else{EvieNeural?.setMic(.3+Math.random()*.2);if(el>15000)return rec?.stop(false);}
    if(el>30000)return rec?.stop(false);raf=requestAnimationFrame(vad);};
   mr.ondataavailable=ev=>{if(ev.data&&ev.data.size)chunks.push(ev.data);};
   mr.onstop=async()=>{done=true;if(raf)cancelAnimationFrame(raf);stream.getTracks().forEach(x=>x.stop());try{src?.disconnect();}catch{}EvieFX?.mic(0);rec=null;
    const dur=(performance.now()-started)/1000;if(discard||!alive(t.id))return;
    if(vadOk&&!heard){append('evie','No te escuché. Toca el núcleo y habla cuando veas «Escuchando…».');note('vad','silence');return set('idle');}
    const blob=new Blob(chunks,{type:blobType(chunks,mr,type)});if(blob.size<800||dur<.5){append('evie','No se grabó audio. ¿Lo intentas de nuevo?');note('mic','empty');return set('idle');}
    set('transcribing');let text='';
    try{const hint=encodeURIComponent(['EVIE',name(),'SOMA','ALVENTO','BBVA','bitácora','pendiente'].filter(Boolean).join(', '));const to=setTimeout(()=>ctl?.abort(),30000);
     const res=await fetch('/api/ai/stt',{method:'POST',credentials:'same-origin',signal:t.signal,headers:{'Content-Type':blob.type,'X-Evie-Request':'1','X-Evie-User':EvieAccounts.current().id,'X-Evie-Duration':String(Math.ceil(dur)),'X-Evie-Hint':hint},body:blob});clearTimeout(to);
     const j=await res.json().catch(()=>({}));if(!res.ok){note('stt',res.status);throw Error(j.error||'No se pudo transcribir.');}text=String(j.text||'').trim();}
    catch(err){if(!alive(t.id))return;return fail('stt',err.name==='AbortError'?'La transcripción tardó demasiado. Intenta otra vez.':err.message,t.id);}
    if(!alive(t.id))return;if(!text){append('evie','No te entendí bien. ¿Lo repites?');return set('idle');}
    ask(text,{turnToken:t});};
   rec={stop:(drop)=>{discard=!!drop;try{mr.state!=='inactive'&&mr.stop();}catch{}},vad:()=>vadOk};
   try{mr.start();}catch{stream.getTracks().forEach(x=>x.stop());rec=null;return fail('mic','No pude iniciar la grabación.',t.id);}
   set('listening');if(!vadOk)append('evie','Habla y toca de nuevo para enviar.');raf=requestAnimationFrame(vad);}
  function browserListen(t){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){append('evie','Tu navegador no permite dictado aquí. Escríbeme abajo.');return set('idle');}
   const r=new SR();r.lang='es-MX';r.interimResults=true;r.maxAlternatives=1;let final='';
   r.onresult=ev=>{let txt='';for(const x of ev.results)txt+=x[0].transcript;final=txt;const inp=panel?.querySelector('#evie-input');if(inp)inp.value=txt;EvieNeural?.setMic(.5);};
   r.onerror=ev=>{note('stt',ev.error);};r.onend=()=>{rec=null;if(!alive(t.id))return;if(final.trim())ask(final,{turnToken:t});else set('idle');};
   rec={stop:(drop)=>{if(drop)t.id=-1;try{r.stop();}catch{}}};try{r.start();set('listening');}catch{rec=null;set('idle');}}
  function listen(){if(rec){rec.stop(false);return;}unlock();const t=begin();
   if(can('stt')&&pref().cloudVoice&&window.MediaRecorder&&navigator.mediaDevices?.getUserMedia)return record(t);return browserListen(t);}
  function simulate(){clearInterval(simTimer);simTimer=setInterval(()=>{EvieNeural?.setOut(.35+Math.random()*.35);EvieFX?.mic(.3+Math.random()*.3);},120);}
  async function playLast(t,gesture){if(!last?.url)return;if(gesture)unlock();if(!player)unlock();
   if(!apple&&ctx&&ctx.state==='running'&&!routed){try{const s=ctx.createMediaElementSource(player),an=ctx.createAnalyser();an.fftSize=256;s.connect(an);an.connect(ctx.destination);routed=an;}catch{routed=null;}}
   if(routed&&ctx.state!=='running')await ctx.resume().catch(()=>{});
   player.src=last.url;set('speaking');
   // Listen for the end BEFORE play(): short clips (or errors) can finish before play() resolves.
   let finish;const ended=new Promise(r=>{const end=()=>{player.removeEventListener('ended',end);player.removeEventListener('error',end);player.removeEventListener('pause',end);clearTimeout(cap);r();};const cap=setTimeout(end,Math.max(15000,(last.text.length*110)+8000));finish=end;player.addEventListener('ended',end);player.addEventListener('error',end);});
   try{await player.play();}catch(e){finish();if(!alive(t.id))return;note('play',e?.name);last.pending=true;set('blocked');append('evie','');return;}
   last.pending=false;if(!player.ended)player.addEventListener('pause',finish,{once:true});else finish();
   if(routed){const b=new Uint8Array(routed.frequencyBinCount);const loop=()=>{if(player.paused||!alive(t.id))return;routed.getByteFrequencyData(b);let s=0;for(const v of b)s+=v;const lv=s/b.length/160;EvieNeural?.setOut(lv);EvieFX?.mic(lv);requestAnimationFrame(loop);};loop();}else simulate();
   await ended;
   clearInterval(simTimer);simTimer=null;EvieFX?.mic(0);if(alive(t.id)&&state==='speaking')set('idle');}
  async function browserSpeak(text,t){if(!('speechSynthesis' in window))return;set('speaking');simulate();
   await new Promise(r=>{const u=new SpeechSynthesisUtterance(text);u.lang='es-MX';u.rate=1.03;const vs=speechSynthesis.getVoices(),v=vs.find(v=>/es[-_](MX|US|419)/i.test(v.lang))||vs.find(v=>/^es/i.test(v.lang));if(v)u.voice=v;u.onend=u.onerror=()=>r();speechSynthesis.speak(u);setTimeout(r,Math.min(30000,text.length*90+2000));});
   clearInterval(simTimer);simTimer=null;if(alive(t.id))set('idle');}
  async function speak(text,t){if(!alive(t.id))return;
   if(last?.url){URL.revokeObjectURL(last.url);}last=null;
   if(can('tts')&&pref().cloudVoice){set('synthesizing');
    try{const to=setTimeout(()=>ctl?.abort(),25000);const res=await fetch('/api/ai/tts',{method:'POST',credentials:'same-origin',signal:t.signal,headers:{'Content-Type':'application/json','X-Evie-Request':'1','X-Evie-User':EvieAccounts.current().id},body:JSON.stringify({text:text.slice(0,600),...(pref().voiceId?{voice:pref().voiceId}:{})})});clearTimeout(to);
     if(!alive(t.id))return;if(!res.ok){const j=await res.json().catch(()=>({}));note('tts',res.status);throw Error(j.error||'tts');}
     const blob=await res.blob();if(!alive(t.id))return;last={url:URL.createObjectURL(blob),text,pending:false};return await playLast(t,false);}
    catch(err){if(!alive(t.id))return;note('tts',err.name||'error');}}
   return browserSpeak(text,t);}
  function replay(){if(!last?.url)return;const t={id:++turn,signal:(ctl=new AbortController()).signal};unlock();playLast(t,true);}
  function syncReplay(){const show=state==='blocked'&&!!last?.url;document.querySelectorAll('[data-evie=replay]').forEach(b=>{b.hidden=!show;});}
  function onHide(){if(state==='arming'){turn++;set('idle');}if(rec){rec.stop(true);note('lifecycle','hidden-rec');set('idle');}
   if(state==='speaking'&&last?.url){try{player.pause();}catch{}last.pending=true;turn++;set('blocked');}
   else if(['transcribing','thinking','synthesizing'].includes(state)){/* keep the request; playback will need a tap if iOS blocks it */}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)onHide();});addEventListener('pagehide',onHide);
  return {listen,stop,begin,alive,speak,replay,unlock,set,get state(){return state;},get recording(){return !!rec;},finish:()=>rec?.stop(false),cancelRec:()=>rec?.stop(true),stats:()=>({state,turn,recording:!!rec,replay:!!last?.url,pending:!!last?.pending,diag:diag.slice(-8),ctx:ctx?.state||null})};
 })();
 function stopSpeaking(){Voice.stop();}
 function finishRecording(){Voice.finish();}
 function listen({inline=false}={}){if(!Voice.recording){if(!(inline||onStage()))open(true);else if(panel)panel.dataset.voice='1';else voiceInline=true;}Voice.listen();}
 /* ---------- panel UI ---------- */
 const suggestions=['¿Qué hay pendiente para hoy?','¿Cómo van mis finanzas este mes?','Activa el modo enfoque','¿Cómo me he sentido esta semana?','Registra gasto 120: Comida hoy'];
 function open(voice=false){if(!panel){panel=document.createElement('section');panel.id='evie-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','EVIE');panel.innerHTML=`<header class="evie-panel-head"><span class="evie-panel-orb" aria-hidden="true"></span><div><strong>EVIE</strong><small data-evie-phase>Lista</small></div><button class="icon-button" data-evie="stop" aria-label="Detener voz">${Views.icon('square')}</button><button class="icon-button" data-evie="close" aria-label="Cerrar EVIE">${Views.icon('x')}</button></header><div class="evie-log" id="evie-log" aria-live="polite"></div><button type="button" class="evie-replay" data-evie="replay" hidden>${Views.icon('play')} Toca para escuchar la respuesta</button><div class="evie-draft" id="evie-draft" hidden></div><div class="evie-suggest">${suggestions.map(s=>`<button class="evie-chip" data-evie="suggest">${e(s)}</button>`).join('')}</div><form class="evie-form" id="evie-form"><label class="sr-only" for="evie-input">Escríbele a EVIE</label><input id="evie-input" autocomplete="off" maxlength="600" placeholder="Pregúntale algo a EVIE…"><button type="button" class="icon-button evie-mic" data-evie="listen" aria-label="Hablar">${Views.icon('mic')}</button><button class="icon-button primary" aria-label="Enviar">${Views.icon('arrow-up')}</button></form>`;document.body.append(panel);
   panel.querySelector('#evie-form').onsubmit=ev=>{ev.preventDefault();const i=panel.querySelector('#evie-input'),v=i.value;i.value='';panel.dataset.voice='0';ask(v,{speak:!pref().muted&&pref().conversation});};
   if(!history.length)append('evie',greet());window.lucide?.createIcons({root:panel});}
  panel.hidden=false;document.body.classList.add('evie-open');if(voice)panel.dataset.voice='1';EvieFX?.panelIn(panel);if(!voice)setTimeout(()=>panel.querySelector('#evie-input')?.focus({preventScroll:true}),60);}
 function close(){if(!panel)return;panel.hidden=true;document.body.classList.remove('evie-open');Voice.stop();}
 function greet(){const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:zone(),hour:'2-digit',hourCycle:'h23'}).format(new Date())),n=name();return `${h<5?'Buenas noches':h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'}${n?', '+n:''}. ¿En qué te ayudo?`;}
 function onStage(){return !!(document.getElementById('evie-stage')||document.getElementById('evie-hud'))&&(!panel||panel.hidden);}
 function syncInline(){const box=document.getElementById('evie-subs');if(!box)return;box.innerHTML=`<button type="button" class="evie-replay" data-evie="replay" hidden>${Views.icon('play')} Toca para escuchar la respuesta</button><p class="status" data-evie-phase>${({idle:'Lista',listening:'Escuchando…',thinking:'Pensando…',speaking:'Hablando…',error:'Algo falló'})[document.documentElement.dataset.evie]||'Lista'}</p>${inlineLast.you?`<p class="you">${e(inlineLast.you)}</p>`:''}${inlineLast.evie?`<p class="evie">${e(inlineLast.evie)}</p>${srcHtml(inlineLast.meta)}`:`<p class="evie">${e(greet())}</p>`}`;syncInlineReplay();if(window.gsap&&!EvieFX.reduced())gsap.from(box.querySelectorAll('p:not(.status)'),{opacity:0,y:6,duration:.35,stagger:.05});}
 function srcHtml(meta){const list=(meta?.sources||[]).filter(x=>/^https:\/\//.test(x.url));if(!list.length)return meta?.webUnavailable?'<small class="evie-src-note">La búsqueda web no está disponible con el modelo actual.</small>':'';return `<div class="evie-sources"><span>Fuentes web${meta.checked?' · consultadas '+e(meta.checked.slice(0,16).replace('T',' ')):''}</span><ol>${list.map(x=>`<li><a href="${e(x.url)}" target="_blank" rel="noopener noreferrer nofollow">${e(x.title||x.host)}</a> <small>${e(x.host)}</small></li>`).join('')}</ol></div>`;}
 function plain(t){return String(t||'').replace(/\s*\(\[([^\]]+)\]\((https?:[^)]+)\)\)/g,'').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g,'$1');}
 function append(who,text,meta=null){if(who==='evie'&&!text){syncInlineReplay();return;}if(who==='evie')text=plain(text);if(who==='user'){inlineLast={you:text,evie:''};syncInline();}else if(who==='evie'){inlineLast.evie=text;inlineLast.meta=meta;syncInline();}const lr=document.getElementById('evie-live');if(lr&&who==='evie')lr.textContent=text;if(!panel)return;const log=panel.querySelector('#evie-log'),p=document.createElement('p');p.className='evie-msg '+who;p.textContent=text;log.append(p);if(meta&&(meta.sources?.length||meta.webUnavailable)){const d=document.createElement('div');d.innerHTML=srcHtml(meta);log.append(d);}while(log.children.length>30)log.firstChild.remove();log.scrollTop=log.scrollHeight;}
 function syncInlineReplay(){const show=Voice.stats().pending;document.querySelectorAll('[data-evie=replay]').forEach(b=>b.hidden=!show);}
 function renderDraft(){let box;if(onStage()){box=document.getElementById('evie-stage-draft');}else{open();box=panel.querySelector('#evie-draft');}if(!box)return;if(!draft){box.hidden=true;box.innerHTML='';return;}box.hidden=false;box.innerHTML=`<span class="eyebrow">PROPUESTA · AÚN NO SE GUARDA</span><dl>${Object.entries(draft.fields).map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>${draft.needsAmount?`<label class="evie-draft-amount">Monto por pago (MXN)<input class="input" inputmode="decimal" data-evie-amount placeholder="0.00"></label>`:''}<div class="toolbar"><button class="button primary" data-evie="draft-confirm">Guardar</button><button class="button" data-evie="draft-cancel">Descartar</button></div>`;EvieFX?.panelIn(box);}
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-evie]');if(!b)return;const a=b.dataset.evie;
  if(a==='open')open();else if(a==='close')close();else if(a==='stop'){Voice.stop();}
  else if(a==='replay'){Voice.replay();}
  else if(a==='listen'||a==='orb'){if(a==='orb'&&panel&&!panel.hidden&&!Voice.recording&&document.documentElement.dataset.evie==='idle'&&ev.detail===0)return close();EvieFX?.pulse();listen();}
  else if(a==='suggest'){panel.dataset.voice='0';ask(b.textContent,{speak:!pref().muted&&pref().conversation});}
  else if(a==='draft-confirm'&&draft?.token==='google'){const d=googleDraft;if(!d||b.disabled)return;b.disabled=true;EvieAccounts.request('connections/google/events',{method:'POST',body:{...d,confirm:true}}).then(r=>{googleDraft=null;draft=null;document.querySelectorAll('#evie-stage-draft,#evie-draft').forEach(x=>{x.hidden=true;x.innerHTML='';});append('evie',r.duplicate?'Ese evento ya estaba en tu Google Calendar; no lo dupliqué.':'Listo, quedó en tu Google Calendar.');App.toast('Evento creado en Google Calendar.','success');}).catch(err=>{b.disabled=false;append('evie',err.message||'No se pudo crear el evento.');});}
  else if(a==='draft-confirm'&&draft?.token==='recurring'){const d=recurringDraft;if(!d)return;let amount=d.amount;if(d.payment&&!amount){const v=b.closest('.evie-draft')?.querySelector('[data-evie-amount]')?.value;const c=v?Domain.cents(v):0;if(!(c>0)){append('evie','¿De cuánto es cada pago? Escríbelo en la tarjeta y vuelve a tocar Guardar.');return;}amount=c;}
   const dup=Store.list('agendaItems').find(r=>!r.deleted_at&&r.recurrence&&IvyTools.norm(r.title)===IvyTools.norm(d.title)&&Agenda.dateOf(r)===d.first);if(dup){append('evie','Esa serie ya existe; no la dupliqué.');draft=null;recurringDraft=null;renderDraft();return;}
   const now=new Date().toISOString(),{start,...rec}=d.rec,at=Agenda.toTimestamp(d.first+'T'+(rec.time_local||'09:00'));
   Store.save(s=>{s.agendaItems.push({...RCData.defaults('agendaItems'),id:crypto.randomUUID(),title:d.title+(amount?' · '+Domain.money(amount):''),kind:d.kind==='event'?'event':d.payment?'reminder':'task',area:d.payment?'finance':'personal',status:'scheduled',all_day:!rec.time_local,start_at:at,due_at:null,recurrence:rec,notes:d.payment?`Pago programado${amount?' de '+Domain.money(amount):''}. No es un ingreso registrado: cuando lo recibas, regístralo en Finanzas.`:'',source:'evie',history:[],created_at:now,updated_at:now});});
   recurringDraft=null;draft=null;document.querySelectorAll('#evie-stage-draft,#evie-draft').forEach(x=>{x.hidden=true;x.innerHTML='';});App.render();append('evie',`Listo: ${d.dates.length} fechas en tu Agenda de EVIE.`);App.toast('Serie guardada en Agenda.','success');}
  else if(a==='draft-confirm'&&draft?.token==='habit'){const h=habitDraft;EvieLife.complete(h.id);habitDraft=null;draft=null;document.querySelectorAll('#evie-stage-draft,#evie-draft').forEach(b=>{b.hidden=true;b.innerHTML='';});App.render();append('evie','Listo, '+h.title+' cumplido.');App.toast(h.title+' ✓','success',()=>EvieLife.undo(h.id));}
  else if(a==='draft-confirm'){try{const r=IvyCommandBus.confirm(draft.token);draft=null;document.querySelectorAll('#evie-stage-draft,#evie-draft').forEach(b=>{b.hidden=true;b.innerHTML='';});App.render();append('evie','Guardado.');App.toast('EVIE guardó el registro.','success',r.undo);}catch(err){append('evie',err.message);}}
  else if(a==='draft-cancel'){try{if(!['habit','recurring','google'].includes(draft?.token))IvyCommandBus.cancel(draft?.token);}catch{}habitDraft=null;recurringDraft=null;googleDraft=null;draft=null;renderDraft();document.querySelectorAll('#evie-stage-draft,#evie-draft').forEach(b=>{b.hidden=true;b.innerHTML='';});append('evie','Descartado.');}
 });
 document.addEventListener('keydown',ev=>{if(document.body.classList.contains('account-locked'))return;if(ev.ctrlKey&&!ev.shiftKey&&ev.code==='Space'&&!window.evieDesktop){ev.preventDefault();listen();}if(ev.key==='Escape'&&panel&&!panel.hidden&&!document.querySelector('dialog[open]'))close();});
 /* ---------- wake: double clap (opt-in, only while app is visible) ---------- */
 const Wake={async start(){if(clapOff)return;try{await IvyAudio.start('evie-wake',true);const det=IvyClap.detector();let noise=[],thr=.14,cal=performance.now()+1500;clapOff=IvyAudio.subscribe(s=>{if(s.now<cal){noise.push(s.rms);return;}if(noise.length){thr=Math.max(.08,Math.min(.5,noise.reduce((a,b)=>a+b,0)/noise.length*5+.04));noise=[];}if(!Voice.recording&&document.documentElement.dataset.evie!=='speaking'&&det.sample(s,thr)){Wake.stop();if(!onStage())open(true);listen();setTimeout(()=>{if(pref().clapWake)Wake.start();},4000);}});document.documentElement.dataset.evieWake='on';}catch(err){clapOff=null;App.toast(err.message,'error');}},
  stop(){clapOff?.();clapOff=null;IvyAudio.stop('evie-wake');delete document.documentElement.dataset.evieWake;},active:()=>!!clapOff};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)Wake.stop();else if(pref().clapWake&&Store.get())Wake.start();});
 // Wake word: per-account opt-in, on-device only (EvieWake refuses remote recognizers).
 function wakeWord(on=pref().wakeWord){if(!window.EvieWake)return;if(!on||!Store.get()){EvieWake.stop();return;}EvieWake.start(cmd=>{window.EvieSounds?.play('listen');if(cmd&&cmd.length>1)ask(cmd,{speak:!pref().muted,inline:true});else listen({inline:true});});}
 // Deep link / PWA shortcut: /#inicio?evie=listen or ?evie=1
 function fromUrl(){const q=new URLSearchParams(location.search);if(q.get('evie')==='listen'||q.get('evie')==='1'){history.replaceState(null,'',location.pathname+location.hash);setTimeout(()=>open(true),400);}}
 setPhase('idle');
 async function say(text){if(!text)return;append('evie',text);if(!pref().muted&&pref().conversation!==false){const t=Voice.begin();await Voice.speak(text,t);if(Voice.alive(t.id)&&Voice.state!=='blocked')Voice.set('idle');}}
 return Object.freeze({open,close,ask,listen,say,wakeWord,research:()=>lastResearch,syncInline,tools,tryLocal,Wake,fromUrl,pref,stopSpeaking,replay:()=>Voice.replay(),reset(){Voice.stop();window.EvieWake?.stop();history=[];inlineLast={you:'',evie:''};draft=null;habitDraft=null;if(panel){panel.remove();panel=null;}},stats:()=>({panel:!!panel,busy,history:history.length,draft:!!draft,wake:!!clapOff,voice:Voice.stats()})});
})();

/* ---------- Modes: "activa el modo X" ---------- */
window.EvieModes=(()=>{
 const modes={
  normal:{label:'Normal',say:'Listo, modo normal.'},
  enfoque:{label:'Enfoque',route:'agenda',say:'Modo enfoque activado: 25 minutos sin distracciones. Te aviso al terminar.',timer:25},
  gym:{label:'Gym',route:'fisico',say:'Modo gym. Vamos con todo.'},
  negocio:{label:'Negocio',route:'negocios',say:'Modo negocio. Aquí están tus negocios.'},
  cierre:{label:'Cierre del día',route:'bitacora',say:'Modo cierre. Abre Mascota Virtual y cuéntale a Kisha cómo te fue hoy.'},
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
