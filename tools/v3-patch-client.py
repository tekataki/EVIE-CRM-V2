# Idempotent v3 client wiring: assistant tools + local HUD intents, app routes, config, index.html.
import sys
def edit(p, pairs):
    s = open(p, encoding='utf-8').read(); changed = False
    for a, b, *mark in pairs:
        m = mark[0] if mark else b
        if m in s: continue
        if a not in s: sys.exit(f'ANCHOR NOT FOUND in {p}: {a[:90]}')
        s = s.replace(a, b, 1); changed = True
    if changed: open(p, 'w', encoding='utf-8').write(s)
    print(('patched ' if changed else 'ok      ') + p)
NOW = "new Intl.DateTimeFormat('en-GB',{timeZone:zone(),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())"
TOOLS = """  show_card({card}){if(!window.EvieHUD?.REGISTRY?.[card])return {ok:false,error:'Tarjeta no disponible.'};return EvieHUD.open(card);},
  close_card({card}){if(!window.EvieHUD)return {ok:false};return EvieHUD.close(card==null?null:card);},
  get_pendientes(){if(!window.EviePendientes)return {items:[]};const l=EviePendientes.build(Store.get(),{today:today(),now:NOW});const shown=window.EvieHUD?EvieHUD.open('pendientes').ok:false;return {counts:EviePendientes.counts(l),items:l.slice(0,15).map(x=>({title:x.title,source:x.source,kind:x.kind,date:x.date,time:x.time,severity:x.severity})),card_shown:shown};},
  async research_web({query}){if(!cloud())return {ok:false,status:'unavailable',note:'Necesitas iniciar sesión con tu cuenta EVIE.'};try{const r=await EvieAccounts.request('info/research',{method:'POST',body:{query}});lastResearch=r;window.EvieHUD?.open('research',{query,data:r,title:'Investigación'});return {ok:true,insufficient:r.insufficient,summary:r.summary,spoken:r.spoken,event_date:r.event_date,sources:r.sources.map(x=>({title:x.title,host:x.host,published:x.published})),retrieved_at:r.retrieved_at,card_shown:true};}catch(err){return {ok:false,error:err.message};}},
  async get_weather({place}){if(!cloud())return {ok:false,status:'unavailable',note:'Necesitas iniciar sesión con tu cuenta EVIE.'};try{const r=await EvieAccounts.request('info/weather',{method:'POST',body:place?{place}:{}});if(!r.needs_location)window.EvieHUD?.open('weather',{place,data:r});return r;}catch(err){return {ok:false,error:err.message};}},
  propose_learning_path({topic}){if(!window.EvieHUD)return {ok:false};const ex=EvieHUD.findSkill(topic);EvieHUD.open('learning',{topic,title:'Ruta: '+String(topic).slice(0,40)});return {status:'preview_shown',needs_user_confirmation:true,existing_topic:ex?ex.title:null,note:'La vista previa está en una tarjeta; nada se guarda sin confirmación.'};},
  async desktop_action({action,contact,message}){return window.EvieDesktopActions?EvieDesktopActions.run(action,{contact,message}):{ok:false,status:'unavailable'};},
  navigate({route}){""".replace('NOW', NOW)
HUD = open('tools/v3-hud-local.js', encoding='utf-8').read().replace('NOW', NOW)
edit('public/evie-assistant.js', [
 ("let googleDraft=null,", "let lastResearch=null,googleDraft=null,"),
 ("  navigate({route}){", TOOLS, "show_card({card})"),
 ("  if(/^(callate|silencio|para|deten|detente|stop)$/.test(q)){stopSpeaking();return '';}", "  if(/^(callate|silencio|para|deten|detente|stop)$/.test(q)){stopSpeaking();return '';}\n  const hud=hudLocal(q);if(hud!==null)return hud;"),
 (" function speakOverview(){", HUD + " function speakOverview(){", "function hudLocal(q)"),
 (" function setPhase(p){document.documentElement.dataset.evie=p;", " let prevPhase='idle';\n function setPhase(p){if(p!==prevPhase){if(p==='listening')window.EvieSounds?.play('listen');else if(p==='thinking'&&prevPhase==='listening')window.EvieSounds?.play('process');else if(p==='error')window.EvieSounds?.play('error');if(['speaking','thinking','listening'].includes(p))window.EvieWake?.pause(4000);if(prevPhase==='speaking')window.EvieWake?.pause(900);prevPhase=p;}document.documentElement.dataset.evie=p;"),
 ("function onStage(){return !!document.getElementById('evie-stage')&&(!panel||panel.hidden);}", "function onStage(){return !!(document.getElementById('evie-stage')||document.getElementById('evie-hud'))&&(!panel||panel.hidden);}"),
 (" document.addEventListener('visibilitychange',()=>{if(document.hidden)Wake.stop();else if(pref().clapWake&&Store.get())Wake.start();});", " document.addEventListener('visibilitychange',()=>{if(document.hidden)Wake.stop();else if(pref().clapWake&&Store.get())Wake.start();});\n // Wake word: per-account opt-in, on-device only (EvieWake refuses remote recognizers).\n function wakeWord(on=pref().wakeWord){if(!window.EvieWake)return;if(!on||!Store.get()){EvieWake.stop();return;}EvieWake.start(cmd=>{window.EvieSounds?.play('listen');if(cmd&&cmd.length>1)ask(cmd,{speak:!pref().muted,inline:true});else listen({inline:true});});}"),
 ("setPhase('idle');\n return Object.freeze({open,close,ask,listen,", "setPhase('idle');\n async function say(text){if(!text)return;append('evie',text);if(!pref().muted&&pref().conversation!==false){const t=Voice.begin();await Voice.speak(text,t);if(Voice.alive(t.id)&&Voice.state!=='blocked')Voice.set('idle');}}\n return Object.freeze({open,close,ask,listen,say,wakeWord,research:()=>lastResearch,"),
 ("reset(){Voice.stop();", "reset(){Voice.stop();window.EvieWake?.stop();"),
])
edit('public/app.js', [
 ("inicio:V2Views.home,", "inicio:()=>window.EvieHUD?EvieHUD.home():V2Views.home(),pendientes:()=>window.EviePendientesView?EviePendientesView.render():Views.home(),"),
 ("window.KishaView?.afterRender();icons();}", "window.KishaView?.afterRender();window.EvieHUD?.afterRender();window.EvieV3?.afterRender();icons();}"),
])
edit('public/config.js', [("{route:'habitos',", "{route:'pendientes',label:'Pendientes',icon:'bell-ring',group:'principal',searchTerms:['pendientes','avisos','notificaciones','urgente','vence'],mobilePriority:0},{route:'habitos',")])
edit('public/evie-shell.js', [
 ("function stage(){if(UI.section!=='inicio'||UI.id)return;", "function stage(){if(UI.section!=='inicio'||UI.id||document.getElementById('evie-hud'))return;"),
 ("if(EvieAssistant.pref().clapWake)EvieAssistant.Wake.start();", "if(EvieAssistant.pref().clapWake)EvieAssistant.Wake.start();\n  if(EvieAssistant.pref().wakeWord)EvieAssistant.wakeWord(true);"),
])
edit('public/account-ui.js', [("window.KishaView?.reset?.()", "window.KishaView?.reset?.();window.EvieHUD?.dispose?.();window.EvieWake?.stop?.()")])
edit('public/index.html', [
 ('<script defer src="evie-assistant.js"></script>', '<script defer src="evie-sounds.js"></script><script defer src="evie-wake.js"></script><script defer src="soma-payments.js"></script><script defer src="evie-pendientes.js"></script><script defer src="evie-assistant.js"></script>'),
 ('<script defer src="evie-shell.js"></script>', '<script defer src="evie-shell.js"></script><script defer src="evie-desktop-actions.js"></script><script defer src="evie-hud-cards.js"></script><script defer src="evie-hud.js"></script><script defer src="evie-v3-views.js"></script>'),
 ('<link rel="stylesheet" href="kisha.css">', '<link rel="stylesheet" href="kisha.css"><link rel="stylesheet" href="evie-hud.css">'),
])
