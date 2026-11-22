'use strict';
/* EVIE v10 · Briefing diario + «Sal ahora».
   - Tarjeta del HUD «briefing» (EvieCards.R.briefing): clima, bloques de hoy, ventana para entrenar antes de tus
     compromisos (según tu recuperación), seguimientos de ventas vencidos, avance de tu misión y una frase en inglés.
     «Escuchar» lo lee con la voz de Ivi (texto armado aquí, sin costo de IA). Se abre sola la primera vez que
     entras a Inicio en la mañana (desactivable).
   - Compromisos fijos (preferences.iviCommitments): etiqueta, hora, días y lugar opcional. Con lugar, Ivi calcula
     el tiempo de camino con tráfico (Mapa) y te avisa «Sal ahora» con notificación mientras la app esté abierta o
     en segundo plano. Sin servidor de push: con la app cerrada no hay aviso (se dice tal cual en pantalla).
   Nada personal vive en el código: horarios y lugares son datos del usuario. */
window.EvieBriefing=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const DAYS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
 const settings=()=>({wake:'07:00',gymMinutes:90,travelMinutes:15,auto:true,...(P().iviBriefing||{})});
 const commitments=()=>(Array.isArray(P().iviCommitments)?P().iviCommitments:[]).filter(c=>c&&/^\d{2}:\d{2}$/.test(c.time)&&Array.isArray(c.days));
 const toMin=t=>{const [h,m]=String(t).split(':').map(Number);return h*60+m;};
 const fmt=min=>{const h=Math.floor(min/60),m=min%60;return new Date(2000,0,1,h,m).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'});};
 const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes();};
 const todayDow=()=>new Date().getDay();
 // 60 useful B2 phrases (rotate by day; no API cost).
 const PHRASES=[['I\'ll get back to you by Friday.','Te respondo a más tardar el viernes.'],['Could you walk me through it?','¿Me lo puedes explicar paso a paso?'],['That makes sense, but…','Tiene sentido, pero…'],['Let\'s circle back to that later.','Retomemos eso más tarde.'],['What would it take to close this today?','¿Qué haría falta para cerrar esto hoy?'],['I\'m running a bit late.','Voy un poco tarde.'],['It\'s worth giving it a shot.','Vale la pena intentarlo.'],['I see where you\'re coming from.','Entiendo tu punto de vista.'],['Can we push it back an hour?','¿Lo podemos mover una hora?'],['That\'s a deal-breaker for me.','Eso es algo que no puedo aceptar.'],['Let me sleep on it.','Déjame pensarlo con calma.'],['We\'re on the same page.','Estamos en sintonía.'],['It boils down to cost.','Al final todo se reduce al costo.'],['I\'d rather not commit yet.','Prefiero no comprometerme todavía.'],['How does that sound to you?','¿Qué te parece?'],['That\'s out of my hands.','Eso no depende de mí.'],['Let\'s keep it short and sweet.','Hagámoslo breve y al punto.'],['I\'m all ears.','Soy todo oídos.'],['It slipped my mind.','Se me olvidó por completo.'],['Could you be more specific?','¿Podrías ser más específico?'],['We\'re running out of time.','Se nos acaba el tiempo.'],['That\'s a fair point.','Es un buen punto.'],['I\'ll look into it.','Lo voy a revisar.'],['It pays off in the long run.','A la larga vale la pena.'],['Let\'s split the difference.','Dividamos la diferencia.'],['I\'m on the fence about it.','Todavía no me decido.'],['Keep me posted.','Mantenme al tanto.'],['That rings a bell.','Eso me suena.'],['Let\'s get down to business.','Vamos al grano.'],['I didn\'t catch that.','No te entendí bien.'],['What\'s the bottom line?','¿Cuál es la conclusión?'],['It\'s not a big deal.','No es para tanto.'],['I\'ll take care of it.','Yo me encargo.'],['Let\'s touch base next week.','Hablemos la próxima semana.'],['It depends on the budget.','Depende del presupuesto.'],['I\'m swamped today.','Hoy estoy saturado.'],['That\'s a win-win.','Todos ganan.'],['Give it some thought.','Piénsalo un poco.'],['We need to cut corners.','Tenemos que recortar donde se pueda.'],['I\'ll keep that in mind.','Lo tendré en cuenta.'],['Better safe than sorry.','Más vale prevenir que lamentar.'],['It\'s a long shot.','Es poco probable.'],['Let\'s call it a day.','Dejémoslo por hoy.'],['I owe you one.','Te debo una.'],['No strings attached.','Sin compromiso.'],['That\'s the whole point.','Ese es justamente el punto.'],['I\'m looking forward to it.','Tengo muchas ganas de que llegue.'],['Let\'s play it by ear.','Vamos viendo sobre la marcha.'],['It\'s up to you.','Tú decides.'],['I\'ll walk you through the options.','Te explico las opciones.'],['What\'s your biggest headache right now?','¿Qué es lo que más te complica ahora?'],['Here\'s what I can offer.','Esto es lo que te puedo ofrecer.'],['Does that work for you?','¿Te funciona?'],['Let me know if anything changes.','Avísame si algo cambia.'],['I\'ll follow up tomorrow.','Te doy seguimiento mañana.'],['We can start small.','Podemos empezar con algo pequeño.'],['That\'s within budget.','Eso cabe en el presupuesto.'],['Let\'s set a deadline.','Pongamos una fecha límite.'],['I appreciate your time.','Gracias por tu tiempo.'],['See you around!','¡Nos vemos!']];
 function phrase(date=new Date()){const n=Math.floor(new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime()/864e5);return PHRASES[((n%PHRASES.length)+PHRASES.length)%PHRASES.length];}

 /* ---------------- data (pure-ish, from the local Store) ---------------- */
 /** Own fixed commitments + today's classes from Escuela (only the first class can trigger «Sal ahora»). */
 function todayCommitments(dow=todayDow()){const own=commitments().filter(c=>c.days.includes(dow)),seen=new Set(own.map(c=>String(c.label).toLowerCase()+c.time));
  const classes=(window.EvieSchool?.classesOn?.(dow)||[]).filter(c=>c&&/^\d{2}:\d{2}$/.test(c.time)&&!seen.has(String(c.label).toLowerCase()+c.time)).sort((a,b)=>toMin(a.time)-toMin(b.time)).map((c,i)=>({...c,days:c.days||[dow],alert:i===0&&c.alert!==false,school:true}));
  return [...own,...classes].sort((a,b)=>toMin(a.time)-toMin(b.time));}
 /** Gym window before the first commitment of the day (minus travel), from wake time + 30 min. */
 function gymWindow(dow=todayDow()){const s=settings(),first=todayCommitments(dow)[0],start=toMin(s.wake)+30;
  if(!first)return {start,end:null,minutes:null,label:'Sin compromisos fijos hoy: entrena cuando te acomode.'};
  const end=toMin(first.time)-(Number(s.travelMinutes)||15)-15,minutes=end-start;
  if(minutes<(Number(s.gymMinutes)||90))return {start,end,minutes,label:`Hoy el tiempo es justo (${Math.max(0,minutes)} min antes de «${first.label}»): una sesión corta o muévela a otro bloque.`,tight:true};
  return {start,end,minutes,label:`Ventana para entrenar: ${fmt(start)} – ${fmt(end)} (antes de «${first.label}»).`};}
 function agendaToday(){const st=Store.get()||{},t=Domain.today();if(!window.Agenda)return [];
  return (st.agendaItems||[]).filter(r=>!r.deleted_at&&!['done','archived'].includes(r.status)&&Agenda.occurrence(r,t)&&!Agenda.isDone(r,t)).map(r=>({title:r.title,time:r.start_at&&String(r.start_at).length>10?String(r.start_at).slice(11,16):null,area:r.area})).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));}
 function followUps(){const t=Domain.today(),closed=/complet|perdid|pausad|ganad/i;return (Store.get()?.clients||[]).filter(c=>!c.deleted_at&&c.nextDate&&c.nextDate<=t&&!closed.test(c.stage||'')).map(c=>({id:c.id,name:c.title||c.name||'Cliente',action:c.nextAction||'',late:c.nextDate<t}));}
 function mission(){const p=window.EvieMission?.plan?.();if(p)return {title:'Misión '+p.name,pct:Math.round(p.pct)};const g=(Store.get()?.goals||[]).filter(x=>!x.archived&&!x.deleted_at&&x.target>0&&/misi[oó]n/i.test(x.title||'')).sort((a,b)=>b.target-a.target)[0];return g?{title:g.title,pct:Math.max(0,Math.min(100,Math.round(g.progress/g.target*100)))}:null;}
 function recoveryReady(){const r=window.EvieFisico?.recovery?EvieFisico.recovery():{};return Object.values(r).filter(x=>x.state==='green').map(x=>x.label);}
 function build(){return {date:new Date(),agenda:agendaToday(),commitments:todayCommitments(),gym:gymWindow(),follow:followUps(),mission:mission(),ready:recoveryReady(),phrase:phrase()};}
 /** Spoken version (no markup), built locally. */
 function speech(b,weather=null){const name=(Store.get()?.profile?.preferred||'').trim(),h=new Date().getHours();const parts=[`${h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'}${name?', '+name:''}. Protocolo matutino.`];
  if(weather?.current)parts.push(`Clima: ${Math.round(weather.current.temperature_c)} grados, ${String(weather.current.condition||'').toLowerCase()}.`);
  parts.push(b.agenda.length?`Tienes ${b.agenda.length} ${b.agenda.length===1?'pendiente':'pendientes'} hoy${b.agenda[0]?.time?`; el primero a las ${b.agenda[0].time}`:''}.`:'No tienes pendientes con fecha para hoy.');
  for(const c of b.commitments.slice(0,2))parts.push(`${c.label} a las ${fmt(toMin(c.time))}.`);
  parts.push(b.gym.label+(b.ready.length?` Listos para entrenar: ${b.ready.slice(0,3).join(', ')}.`:''));
  if(b.follow.length)parts.push(`Seguimientos de ventas: ${b.follow.slice(0,3).map(f=>f.name).join(', ')}.`);
  if(b.mission)parts.push(`${b.mission.title} al ${b.mission.pct} por ciento.`);
  for(const a of localAlerts().slice(0,2))parts.push(`Aviso local: ${a.titulo}${a.cuando?', '+a.cuando:''}.`);
  parts.push(`Frase del día: ${b.phrase[0]} Significa: ${b.phrase[1]}`);
  return parts.join(' ');}

 /* ---------------- HUD card ---------------- */
 function render(d){const b=d.b,w=d.weather;
  const wx=w?.current?`<div class="bf-wx"><strong>${Math.round(w.current.temperature_c)}°</strong><span>${e(w.current.condition)}<small>${e(w.place||'')}</small></span></div>`:d.weatherNote?`<p class="bf-muted">${e(d.weatherNote)}</p>`:'';
  const blocks=[...b.commitments.map(c=>({time:c.time,title:c.label,kind:'fixed'})),...b.agenda.map(a=>({time:a.time,title:a.title,kind:a.area||'task'}))].sort((x,y)=>(x.time||'99').localeCompare(y.time||'99')).slice(0,7);
  const day=b.date.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  return `<div class="bf"><div class="bf-top"><div><span class="bf-eyebrow">PROTOCOLO MATUTINO</span><p class="bf-date">${e(day.charAt(0).toUpperCase()+day.slice(1))}</p></div>${wx}</div>
   ${departuresLine()}
   ${alertsBlock()}
   <section class="bf-sec"><h4>${ic('calendar-clock')}Hoy</h4>${blocks.length?`<ol class="bf-blocks">${blocks.map(x=>`<li data-kind="${e(x.kind)}"><time>${x.time?e(fmt(toMin(x.time))):'—'}</time><span>${e(x.title)}</span></li>`).join('')}</ol>`:'<p class="bf-muted">Sin bloques con hora. Día libre para avanzar.</p>'}</section>
   <section class="bf-sec ${b.gym.tight?'is-warn':''}"><h4>${ic('dumbbell')}Entreno</h4><p>${e(b.gym.label)}</p>${b.ready.length?`<p class="bf-muted">Listos: ${e(b.ready.slice(0,4).join(' · '))}</p>`:''}</section>
   ${b.follow.length?`<section class="bf-sec is-warn"><h4>${ic('handshake')}Seguimientos</h4><ul class="bf-list">${b.follow.slice(0,4).map(f=>`<li><a href="#soma/${e(f.id)}">${e(f.name)}</a>${f.action?`<small>${e(f.action)}</small>`:''}${f.late?'<em>atrasado</em>':''}</li>`).join('')}</ul></section>`:''}
   ${b.mission?`<section class="bf-sec"><h4>${ic('rocket')}${e(b.mission.title)}</h4><div class="bf-meter" style="--p:${b.mission.pct}"><i></i></div><small>${b.mission.pct} %</small></section>`:''}
   <section class="bf-sec bf-en"><h4>${ic('languages')}Frase en inglés</h4><p lang="en">«${e(b.phrase[0])}»</p><small>${e(b.phrase[1])}</small></section>
   <div class="bf-actions"><button type="button" class="button primary" data-bf="speak">${ic('volume-2')}Escuchar</button><button type="button" class="button" data-bf="schedule">${ic('clock-4')}Mi horario</button><button type="button" class="button" data-bf="ivi">${ic('sparkles')}Pedirle más a Ivi</button></div></div>`;}
 /** Verified local alerts for today from the Radar (street closures, events, outages, weather). */
 const localAlerts=()=>{try{return window.EvieRadar?.alerts?.()||[];}catch{return [];}};
 function alertsBlock(){const a=localAlerts();return a.length?`<section class="bf-sec is-warn"><h4>${ic('siren')}Avisos locales</h4><ul class="bf-list">${a.slice(0,3).map(x=>`<li><strong>${e(x.titulo)}</strong>${x.cuando?`<small>${e(x.cuando)}</small>`:''}</li>`).join('')}</ul></section>`:'';}
 function departuresLine(){const list=todayCommitments().filter(c=>c.place&&c.alert!==false);if(!list.length)return '';const m=nowMin();
  const next=list.find(c=>toMin(c.time)>m);if(!next)return '';const eta=etaCache[next.id];
  const leave=eta?toMin(next.time)-Math.ceil(eta.min)-(Number(next.buffer)||5):null;
  return `<p class="bf-depart">${ic('car-front')}<span>${leave!=null?`Para llegar a «${e(next.label)}» a las ${e(fmt(toMin(next.time)))}: sal a las <strong>${e(fmt(Math.max(0,leave)))}</strong> (${Math.round(eta.min)} min${eta.traffic?' con tráfico':''}).`:`Te aviso cuándo salir hacia «${e(next.label)}» (${e(fmt(toMin(next.time)))}).`}</span></p>`;}
 let lastWeather=null;
 const card={title:'Briefing del día',icon:'sunrise',scope:'account',
  load:async()=>{const b=build();let weather=null,weatherNote=null;if(cloud()){try{weather=await EvieAccounts.request('info/weather',{method:'POST',body:{}});if(weather?.needs_location){weatherNote='Guarda tu ciudad en Configuración personalizada para ver el clima.';weather=null;}}catch{weatherNote='Clima no disponible ahora.';}}else weatherNote='Inicia sesión para ver el clima.';lastWeather=weather;return {b,weather,weatherNote};},
  render};
 if(window.EvieCards?.R)EvieCards.R.briefing=card;

 /* ---------------- schedule dialog ---------------- */
 function scheduleDialog(){const s=settings(),list=commitments();
  const row=(c={},i)=>`<fieldset class="bf-commit" data-i="${i}"><legend class="sr-only">Compromiso ${i+1}</legend><input class="input" name="label" placeholder="Ej. Escuela" maxlength="40" value="${e(c.label||'')}" aria-label="Nombre"><input class="input" name="time" type="time" value="${e(c.time||'')}" aria-label="Hora"><div class="bf-days">${DAYS.map((d,k)=>`<label><input type="checkbox" name="d${k}" ${(c.days||[1,2,3,4,5]).includes(k)?'checked':''}><span>${d}</span></label>`).join('')}</div>
   <div class="bf-place"><input class="input" name="place" placeholder="Lugar (opcional, para «Sal ahora»)" value="${e(c.place?.name||'')}" aria-label="Lugar" data-lat="${c.place?.lat??''}" data-lon="${c.place?.lon??''}"><button type="button" class="button small" data-bf="find" aria-label="Buscar lugar">${ic('search')}</button></div><button type="button" class="bf-del" data-bf="del-row" aria-label="Quitar compromiso">${ic('x')}</button></fieldset>`;
  App.openDialog('Mi horario',`<form id="bf-form" class="bf-form"><p class="dialog-subtitle">Ivi usa esto para tu briefing, la ventana para entrenar y los avisos de «Sal ahora». Solo vive en tu cuenta.</p>
   <div class="bf-row"><label class="ch-field"><span>Me despierto</span><input class="input" type="time" name="wake" value="${e(s.wake)}"></label><label class="ch-field"><span>Entreno (min)</span><input class="input" type="number" name="gymMinutes" min="20" max="240" value="${e(s.gymMinutes)}"></label><label class="ch-field"><span>Traslado (min)</span><input class="input" type="number" name="travelMinutes" min="0" max="120" value="${e(s.travelMinutes)}"></label></div>
   <div class="bf-place bf-home"><input class="input" name="home" placeholder="Salgo desde (tu casa; se usa si no hay GPS)" value="${e(P().iviHome?.name||'')}" aria-label="Punto de salida" data-lat="${P().iviHome?.lat??''}" data-lon="${P().iviHome?.lon??''}"><button type="button" class="button small" data-bf="find" aria-label="Buscar punto de salida">${ic('search')}</button></div>
   <h3 class="bf-h">Compromisos fijos</h3><div id="bf-rows">${(list.length?list:[{}]).map(row).join('')}</div><button type="button" class="button small" data-bf="add-row">${ic('plus')}Agregar compromiso</button>
   <label class="ivi-switch"><input type="checkbox" name="auto" ${s.auto!==false?'checked':''}><span class="ivi-switch-ui" aria-hidden="true"></span><span><strong>Abrir el briefing en la mañana</strong><small>La primera vez que entras a Inicio antes de las 12:00</small></span></label>
   <label class="ivi-switch"><input type="checkbox" name="notify" ${typeof Notification!=='undefined'&&Notification.permission==='granted'?'checked':''}><span class="ivi-switch-ui" aria-hidden="true"></span><span><strong>Avisos «Sal ahora»</strong><small>Notificación con el tiempo de camino con tráfico. Funciona con EVIE abierta o en segundo plano.</small></span></label>
   <p class="ch-error" role="alert" hidden></p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('check')}Guardar</button></div></form>`);
  const f=document.getElementById('bf-form');
  f.addEventListener('click',async ev=>{const b=ev.target.closest('[data-bf]');if(!b)return;const a=b.dataset.bf;
   if(a==='add-row'){const box=document.getElementById('bf-rows');box.insertAdjacentHTML('beforeend',row({},box.children.length));window.lucide?.createIcons?.({root:box});}
   else if(a==='del-row')b.closest('.bf-commit')?.remove();
   else if(a==='find'){const inp=b.parentElement.querySelector('input'),q=inp.value.trim();if(q.length<3){App.toast('Escribe el lugar para buscarlo.','error');return;}
    try{const r=await EvieAccounts.request('map/search',{method:'POST',body:{text:q}});const hit=r.results?.[0];if(!hit){App.toast('No encontré ese lugar en el mapa.','error');return;}inp.value=hit.label||hit.name;inp.dataset.lat=hit.lat;inp.dataset.lon=hit.lon;App.toast('Lugar encontrado: '+(hit.label||hit.name),'success');}catch(err){App.toast(err.message||'El mapa no está disponible.','error');}}});
  f.onsubmit=async ev=>{ev.preventDefault();const err=f.querySelector('.ch-error');const rows=[...f.querySelectorAll('.bf-commit')].map((fs,i)=>{const g=n=>fs.querySelector(`[name=${n}]`);const label=g('label').value.trim().slice(0,40),time=g('time').value,days=DAYS.map((_,k)=>g('d'+k).checked?k:null).filter(x=>x!==null),pl=g('place'),lat=Number(pl.dataset.lat),lon=Number(pl.dataset.lon);
    return label&&time?{id:(list[i]?.id)||crypto.randomUUID(),label,time,days,place:pl.value.trim()&&Number.isFinite(lat)&&Number.isFinite(lon)&&pl.dataset.lat!==''?{name:pl.value.trim().slice(0,120),lat,lon}:null,alert:true,buffer:5}:null;}).filter(Boolean);
   const wake=f.elements.wake.value||'07:00',gym=Math.max(20,Math.min(240,Number(f.elements.gymMinutes.value)||90)),travel=Math.max(0,Math.min(120,Number(f.elements.travelMinutes.value)||15));
   if(f.elements.notify.checked&&typeof Notification!=='undefined'&&Notification.permission!=='granted'){try{const p=await Notification.requestPermission();if(p!=='granted'){err.hidden=false;err.textContent='El navegador no dio permiso para notificaciones; verás los avisos dentro de EVIE.';}}catch{}}
   const hm=f.elements.home,hlat=Number(hm.dataset.lat),hlon=Number(hm.dataset.lon),home=hm.value.trim()&&hm.dataset.lat!==''&&Number.isFinite(hlat)&&Number.isFinite(hlon)?{name:hm.value.trim().slice(0,120),lat:hlat,lon:hlon}:null;
   Store.save(s=>{s.preferences.iviBriefing={wake,gymMinutes:gym,travelMinutes:travel,auto:f.elements.auto.checked};s.preferences.iviCommitments=rows;s.preferences.iviHome=home;});App.closeDialog(true);App.toast('Horario guardado.','success');window.EvieHUD?.open?.('briefing');tick();};}

 /* ---------------- «Sal ahora» monitor ---------------- */
 const etaCache={},notified=new Set();
 async function origin(){try{const perm=await navigator.permissions?.query?.({name:'geolocation'});if(perm&&perm.state!=='granted')throw 0;return await new Promise((ok,ko)=>navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lon:p.coords.longitude}),ko,{maximumAge:300000,timeout:8000}));}catch{const h=P().iviHome;return h&&Number.isFinite(h.lat)?{lat:h.lat,lon:h.lon}:null;}}
 async function eta(c){const hit=etaCache[c.id];if(hit&&Date.now()-hit.at<10*60000)return hit;const s=settings();let min=Number(s.travelMinutes)||15,traffic=false;
  if(cloud()&&EvieAccounts.config?.()?.map?.configured){const from=await origin();if(from){try{const r=await EvieAccounts.request('map/route',{method:'POST',body:{from,to:{lat:c.place.lat,lon:c.place.lon},mode:'auto'}});const sec=Number(r.trip?.summary?.time);if(Number.isFinite(sec)&&sec>0){min=sec/60;traffic=!!r.traffic;}}catch{}}}
  return (etaCache[c.id]={min,traffic,at:Date.now()});}
 async function notify(title,body,tag){window.EvieSounds?.play?.('alert');App.toast(body,'success');
  try{if(typeof Notification!=='undefined'&&Notification.permission==='granted'){const reg=await navigator.serviceWorker?.getRegistration?.();if(reg?.showNotification)await reg.showNotification(title,{body,tag,renotify:true,icon:'icons/ivy-192.png',badge:'icons/ivy-192.png'});else new Notification(title,{body,tag});}}catch{}}
 let busy=false;
 async function tick(){if(busy)return;busy=true;try{const m=nowMin(),day=Domain.today();
  for(const c of todayCommitments().filter(x=>x.place&&x.alert!==false)){const arrive=toMin(c.time);if(m>arrive||arrive-m>90)continue;const key=day+'|'+c.id;if(notified.has(key))continue;
   const t=await eta(c),leave=arrive-Math.ceil(t.min)-(Number(c.buffer)||5);
   if(m>=leave-1){notified.add(key);const al=localAlerts()[0];notify('Sal ahora · '+c.label,`Para llegar a «${c.label}» a las ${fmt(arrive)}: son ${Math.round(t.min)} min${t.traffic?' con tráfico':''}. Sal ahora.${al?' Ojo: '+al.titulo+'.':''}`,'evie-depart-'+c.id);}}
  if(UI.section==='inicio'){const p=document.querySelector('.bf-depart');if(p){const fresh=departuresLine();if(fresh)p.outerHTML=fresh;}}}finally{busy=false;}}
 setInterval(()=>{if(!document.hidden||navigator.userActivation)tick();},60000);
 /* ---------------- auto-open + actions ---------------- */
 function afterRender(){if(UI.section!=='inicio'||!window.EvieHUD)return;const s=settings();if(s.auto===false||new Date().getHours()>=12)return;
  let last='';try{last=localStorage.getItem('evie-briefing-last')||'';}catch{}const today=Domain.today();if(last===today)return;try{localStorage.setItem('evie-briefing-last',today);}catch{}
  setTimeout(()=>{if(UI.section==='inicio')window.EvieHUD?.open?.('briefing');else try{localStorage.removeItem('evie-briefing-last');}catch{}},500);}
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-bf]');if(!b||b.closest('#bf-form'))return;const a=b.dataset.bf;
  if(a==='speak'){const text=speech(build(),lastWeather);if(window.EvieAssistant?.say)EvieAssistant.say(text);else App.toast(text,'success');}
  else if(a==='schedule')scheduleDialog();
  else if(a==='ivi')window.IviCore?.protocol?.('briefing');});
 return Object.freeze({build,speech,gymWindow,todayCommitments,phrase,scheduleDialog,afterRender,tick,card,PHRASES});
})();
