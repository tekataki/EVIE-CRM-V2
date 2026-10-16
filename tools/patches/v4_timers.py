# v4 timers: EvieTimers wired into sounds, HUD card, local intent (before the model), model tools, index. Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:80]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('public/evie-sounds.js',[
 ("  error:()=>{tone(330,{d:.2,g:.07,to:247,type:'triangle'});}",
  "  error:()=>{tone(330,{d:.2,g:.07,to:247,type:'triangle'});},\n  // Gentle timer alarm: soft three-note rise (no harsh square waves).\n  alarm:()=>{tone(523,{d:.35,g:.09,type:'triangle'});tone(659,{t:.18,d:.35,g:.08,type:'triangle'});tone(784,{t:.36,d:.6,g:.08});}","alarm:()=>"),
])
edit('public/evie-hud-cards.js',[
 ("  clock:{title:'Hora y fecha',",
  "  timer:{title:'Temporizadores',icon:'timer',scope:'device',load:async()=>({}),render:()=>`<div data-timer-card>${window.EvieTimers?EvieTimers.cardBody():''}</div><p class=\"sr-only\" id=\"evie-timer-live\" aria-live=\"assertive\"></p>`},\n  clock:{title:'Hora y fecha',","timer:{title:'Temporizadores'"),
 ("{card:'clock',label:'Hora y fecha',icon:'clock-3',state:'ready'},","{card:'clock',label:'Hora y fecha',icon:'clock-3',state:'ready'},{card:'timer',label:'Temporizadores',icon:'timer',state:'ready'},","{card:'timer',label:'Temporizadores'"),
])
edit('public/evie-assistant.js',[
 ("if(window.EvieFisico){const fw=EvieFisico.intent(text);","if(window.EvieTimers){const tw=EvieTimers.intent(text);if(tw!==null)return tw;}if(window.EvieFisico){const fw=EvieFisico.intent(text);","EvieTimers.intent(text)"),
 ("  log_workout(a={},call){",
  "  set_timer(a={}){const r=EvieTimers.start({seconds:a.seconds,label:a.label||null});if(r.ok)window.EvieHUD?.open?.('timer');return r.ok?{ok:true,id:r.timer.id,summary:r.say}:{ok:false,error:r.error};},\n"
  "  control_timer(a={}){if(a.action==='cancel_all'){const r=EvieTimers.cancelAll();return r.ok?{ok:true,summary:r.say}:{ok:false,error:r.error};}if(a.action==='list')return {timers:EvieTimers.active().map(t=>({id:t.id,label:t.label,state:t.state,remaining_seconds:Math.round(t.remaining_ms/1000)}))};const r=EvieTimers.act(a.action,a.timer||'');return r.ok?{ok:true,summary:r.say}:{ok:false,error:r.error,ambiguous:r.ambiguous};},\n"
  "  log_workout(a={},call){","set_timer(a={})"),
])
edit('src/assistant.js',[
 ("'tendencias', 'logros']","'tendencias', 'logros', 'timer']","'logros', 'timer']"),
 ("  { name: 'transfer_money',",
  "  { name: 'set_timer', description: 'Inicia un temporizador real en este dispositivo («pon un temporizador de 10 minutos para la pasta»). seconds = duración total en segundos (1 a 86400). label = nombre corto opcional. Suena con una alarma suave y muestra la tarjeta. No lo uses para recordatorios de días futuros (usa la agenda).', parameters: S({ seconds: { type: 'integer', minimum: 1, maximum: 86400 }, label: nstr('nombre corto o null') }) },\n"
  "  { name: 'control_timer', description: 'Pausa, reanuda, cancela, consulta o lista temporizadores. timer = nombre o duración («pasta», «el de 10 minutos») o null si solo hay uno. Si la respuesta trae ambiguous, pregunta cuál.', parameters: S({ action: { type: 'string', enum: ['pause', 'resume', 'cancel', 'status', 'list', 'cancel_all'] }, timer: nstr('nombre o null') }) },\n"
  "  { name: 'transfer_money',","name: 'set_timer'"),
])
edit('public/index.html',[
 ("<script defer src=\"evie-hud-cards.js\"></script>","<script defer src=\"evie-timers.js\"></script><script defer src=\"evie-hud-cards.js\"></script>","evie-timers.js"),
 ("<link rel=\"stylesheet\" href=\"fisico.css\">","<link rel=\"stylesheet\" href=\"fisico.css\"><link rel=\"stylesheet\" href=\"evie-timers.css\">","evie-timers.css"),
])
