# v4 Físico: «Salud y gym» → Físico (route 'fisico'; #gimnasio/#gym/#salud stay as aliases). Main view = body map;
# existing training views and calorie/nutrition tools move to secondary tabs (data untouched). Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:80]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('public/config.js',[
 ("{route:'gimnasio',label:'Salud y gym',icon:'dumbbell',group:'principal',searchTerms:['gimnasio','symmetry','entrenamientos','calorias','nutricion'],mobilePriority:0}",
  "{route:'fisico',label:'Físico',icon:'dumbbell',group:'principal',searchTerms:['fisico','gimnasio','gym','salud','musculos','cuerpo','entrenamientos','symmetry','calorias','nutricion'],mobilePriority:0}","route:'fisico'"),
])
edit('public/app.js',[
 ("soma:Views.soma,gimnasio:V2Views.gym,","soma:Views.soma,fisico:id=>window.EvieFisico?EvieFisico.view(id):V2Views.gym(id),gimnasio:V2Views.gym,","fisico:id=>window.EvieFisico"),
 ("window.KishaView?.afterRender();","window.KishaView?.afterRender();window.EvieFisico?.afterRender();","window.EvieFisico?.afterRender();"),
 ("location.hash='gimnasio/'+current.id","location.hash='fisico/'+current.id","location.hash='fisico/'+current.id"),
])
edit('public/module-experience.js',[
 ("if(section==='gimnasio'&&!id&&(UI.rcGymTab||'training')==='training'){","if((section==='gimnasio'||(section==='fisico'&&UI.fisicoTab==='entrenos'))&&!id&&(UI.rcGymTab||'training')==='training'){","section==='fisico'&&UI.fisicoTab==='entrenos'"),
 ("href=\"#gimnasio/${e(latest.id)}\"","href=\"#fisico/${e(latest.id)}\"","#fisico/${e(latest.id)}"),
])
edit('public/evie-modules.js',[
 ("if(sec==='gimnasio'&&!UI.id&&!main.querySelector('#evm-calories')){","if((sec==='gimnasio'||(sec==='fisico'&&UI.fisicoTab==='comidas'))&&!UI.id&&!main.querySelector('#evm-calories')){","sec==='fisico'&&UI.fisicoTab==='comidas'"),
 ("['gimnasio','Salud y gym','dumbbell']","['fisico','Físico','dumbbell']","['fisico','Físico','dumbbell']"),
 ("['agenda','finanzas','negocios','bitacora','gimnasio','objetivos']","['agenda','finanzas','negocios','bitacora','fisico','objetivos']","'bitacora','fisico','objetivos'"),
])
edit('public/evie-hud-cards.js',[
 ("['gimnasio','Salud y gym','dumbbell']","['gimnasio','Físico','dumbbell']","['gimnasio','Físico','dumbbell']"),
 ("gimnasio:mod('gimnasio',{","gimnasio:mod('fisico',{","gimnasio:mod('fisico',{"),
])
edit('public/gym-log.js',[("location.hash='gimnasio/'+saved.id","location.hash='fisico/'+saved.id","'fisico/'+saved.id")])
edit('public/v2-views.js',[
 ("<a class=\"button\" href=\"#gimnasio\">${i('arrow-left')}Resumen</a>","<a class=\"button\" href=\"#fisico\">${i('arrow-left')}Físico</a>","href=\"#fisico\">${i('arrow-left')}Físico"),
 ("card('Último entrenamiento','gimnasio',","card('Último entrenamiento','fisico',","card('Último entrenamiento','fisico',"),
])
edit('public/rc-app.js',[("aria-label=\"Secciones de Gimnasio\"","aria-label=\"Secciones de entrenamiento\"","Secciones de entrenamiento")])
edit('public/evie-assistant.js',[
 ("gym:{label:'Gym',route:'gimnasio'","gym:{label:'Gym',route:'fisico'","route:'fisico'"),
 ("navigate({route}){if(","navigate({route}){if(['gimnasio','gym','salud'].includes(route))route='fisico';if(","route='fisico';if("),
 ("hice.';}if(window.EvieFinance){","hice.';}if(window.EvieFisico){const fw=EvieFisico.intent(text);if(fw!==null)return fw;}if(window.EvieFinance){","EvieFisico.intent(text)"),
 ("  log_transaction(a={},call){",
  "  log_workout(a={},call){const groups=window.FisicoCore?FisicoCore.groupsFrom((a.muscles||[]).join(' y ')):[];const r=EvieFisico.logWorkout({groups,date:a.date||null,op_id:call?.call_id||null,title:a.title||null});if(r.undo){App.render();App.toast(r.say,'success',r.undo);lastUndo=r.undo;window.EvieFinance?.setLastUndo?.(r.undo);}return {status:r.status,question:r.question,summary:r.say||r.error};},\n  log_transaction(a={},call){","log_workout(a={},call)"),
])
edit('public/ivy-local-tools.js',[("route:row?'gimnasio/'+row.id:'gimnasio'","route:row?'fisico/'+row.id:'fisico'","'fisico/'+row.id")])
edit('public/neural-signals.js',[("gymSessions:'gimnasio'","gymSessions:'fisico'","gymSessions:'fisico'")])
edit('public/entity-links.js',[]) 
edit('src/assistant.js',[
 ("'finanzas', 'negocios', 'gimnasio', 'habitos'","'finanzas', 'negocios', 'fisico', 'gimnasio', 'habitos'","'negocios', 'fisico', 'gimnasio'"),
 ("  { name: 'transfer_money',",
  "  { name: 'log_workout', description: 'REGISTRA que el usuario entrenó ciertos grupos musculares («hoy entrené pecho y espalda»). Crea UNA sesión parcial en Físico (sin series) o completa la sesión de voz del día; nunca duplica. muscles = palabras del usuario (pecho, espalda, pierna, hombros, bíceps, tríceps, abdomen, glúteos…). date YYYY-MM-DD o null = hoy. No inventes ejercicios, series ni pesos.', parameters: S({ muscles: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 12 }, date: nstr('YYYY-MM-DD o null'), title: nstr('título opcional') }) },\n  { name: 'transfer_money',","name: 'log_workout'"),
])
edit('public/index.html',[
 ("<script defer src=\"gym-log.js\"></script>","<script defer src=\"gym-log.js\"></script><script defer src=\"fisico-core.js\"></script><script defer src=\"fisico-body.js\"></script><script defer src=\"fisico-view.js\"></script>","fisico-view.js"),
 ("<link rel=\"stylesheet\" href=\"evie-finance.css\">","<link rel=\"stylesheet\" href=\"evie-finance.css\"><link rel=\"stylesheet\" href=\"fisico.css\">","fisico.css"),
])
edit('public/tests-modules.js',[('nav[aria-label="Secciones de Gimnasio"]','nav[aria-label="Secciones de entrenamiento"]','Secciones de entrenamiento')])
edit('public/tests-ui.js',[("['gimnasio','gymSessions']","['fisico','gymSessions']","['fisico','gymSessions']")])
# Pantry moved to its own «Compras y despensa» section in v4 finance: fix the old hints.
edit('public/rc-app.js',[
 ("La despensa ahora vive en <a href=\"#finanzas\">Finanzas → Despensa</a>, junto a tus listas de compra y gastos.","La despensa ahora vive en <a href=\"#compras\">Compras y despensa</a>, junto a tus listas de compra.","href=\"#compras\">Compras y despensa</a>, junto"),
 ("¿Inventario de comida? Está en <a href=\"#finanzas\">Finanzas → Despensa</a>.","¿Inventario de comida? Está en <a href=\"#compras\">Compras y despensa</a>.","Está en <a href=\"#compras\">"),
])
