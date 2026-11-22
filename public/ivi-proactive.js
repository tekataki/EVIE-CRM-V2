'use strict';
/* EVIE v10 · Ivi proactiva: Ivi te habla primero, con sentido común, como una persona.
   - ~30 min antes de algo con hora (Agenda, «Mi horario» o tus clases): «Jefe, ¿vas a salir a las 12:20? Veo que a la
     1:00 tienes Escuela. Con tráfico son 35 min. Va a llover (70 %): lleva paraguas.» (voz de Ivi si la permites,
     aviso en pantalla y notificación del sistema si diste permiso). Una vez por compromiso y día.
   - Tarjeta del HUD «Ivi te avisa» con lo importante de las próximas horas: salidas, lluvia por hora a la hora en que
     sales, avisos locales verificados del Radar (cierres de calles, eventos, cortes), examen hoy o mañana,
     seguimientos de SOMA para hoy y la misión si va atrasada. Se abre sola una vez cuando hay algo cercano.
   - situation(): el mismo contexto viaja (como DATOS) al chat y a la voz para que Ivi responda con sentido común.
   Ajustes en preferences.iviProactive {enabled, voice, minutes, callMe}. Clima y mapa usan las rutas normales. */
window.IviProactive=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const cfg=()=>({enabled:true,voice:true,minutes:30,callMe:'',...(P().iviProactive||{})});
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const today=()=>Domain.today();
 const toMin=t=>{const [h,m]=String(t).split(':').map(Number);return h*60+m;};
 const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes();};
 const hm=min=>`${String(Math.floor(((min%1440)+1440)%1440/60)).padStart(2,'0')}:${String(((min%60)+60)%60).padStart(2,'0')}`;
 const fmt=min=>new Date(2000,0,1,Math.floor(((min%1440)+1440)%1440/60),((min%60)+60)%60).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'});
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
 const money=c=>Domain.money(Math.round(Number(c)||0));
 /** How Ivi addresses you: your setting («jefe»), else your preferred name. */
 function address(){const c=String(cfg().callMe||'').trim();if(c)return c.slice(0,30);const p=Store.get()?.profile||{};return String(p.preferred||'').trim().slice(0,30);}
 /* ---------------- what is coming today ---------------- */
 function localHM(r){if(r.recurrence?.time_local&&/^\d{2}:\d{2}$/.test(r.recurrence.time_local))return r.recurrence.time_local;const iso=r.start_at||r.due_at;if(!iso||String(iso).length<=10)return null;const d=new Date(iso);if(Number.isNaN(d.getTime()))return null;return hm(d.getHours()*60+d.getMinutes());}
 function upcoming(){const t=today(),m=nowMin(),out=[],seen=new Set(),add=x=>{const k=norm(x.label)+'|'+x.time;if(seen.has(k))return;seen.add(k);out.push(x);};
  for(const c of (window.EvieBriefing?.todayCommitments?.()||[]))add({id:'c:'+c.id,label:c.label,time:c.time,place:c.place||null,school:!!c.school,buffer:Number(c.buffer)||5});
  if(window.Agenda)for(const r of Store.list('agendaItems')){if(r.deleted_at||['done','archived'].includes(r.status)||r.all_day)continue;try{if(!Agenda.occurrence(r,t)||Agenda.isDone(r,t))continue;}catch{continue;}const time=localHM(r);if(!time)continue;add({id:'a:'+r.id,label:r.title,time,place:null,school:r.area==='school',buffer:5});}
  return out.filter(x=>toMin(x.time)>=m-5).sort((a,b)=>toMin(a.time)-toMin(b.time));}
 /* ---------------- weather (cached 30 min) and travel times ---------------- */
 let wx=null,wxAt=0,wxBusy=null;const etas={};
 async function weather(){if(!cloud())return null;if(wx&&Date.now()-wxAt<30*60000)return wx;if(wxBusy)return wxBusy;
  wxBusy=(async()=>{try{const r=await EvieAccounts.request('info/weather',{method:'POST',body:{}});if(r?.current){wx=r;wxAt=Date.now();}}catch{}finally{wxBusy=null;}return wx;})();return wxBusy;}
 const rainAt=(time)=>{const hh=String(time).slice(0,2);const h=(wx?.hours||[]).find(x=>String(x.time).slice(11,13)===hh&&String(x.time).slice(0,10)===today());return h&&Number.isFinite(h.rain_prob)?h.rain_prob:null;};
 const rainNext=(hours=6)=>{const list=(wx?.hours||[]).slice(0,hours).filter(x=>Number.isFinite(x.rain_prob));return list.reduce((a,x)=>x.rain_prob>(a?.rain_prob??-1)?x:a,null);};
 async function eta(item){if(!item.place||!Number.isFinite(item.place.lat))return null;const hit=etas[item.id];if(hit&&Date.now()-hit.at<10*60000)return hit;
  let from=null;const home=P().iviHome;if(home&&Number.isFinite(home.lat))from={lat:home.lat,lon:home.lon};
  try{const perm=await navigator.permissions?.query?.({name:'geolocation'});if(perm?.state==='granted')from=await new Promise(ok=>navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lon:p.coords.longitude}),()=>ok(from),{maximumAge:300000,timeout:6000}));}catch{}
  if(!from||!cloud()||!EvieAccounts.config?.()?.map?.configured)return null;
  try{const r=await EvieAccounts.request('map/route',{method:'POST',body:{from,to:{lat:item.place.lat,lon:item.place.lon},mode:'auto'}});const sec=Number(r.trip?.summary?.time);if(Number.isFinite(sec)&&sec>0)return (etas[item.id]={min:Math.round(sec/60),traffic:!!r.traffic,at:Date.now()});}catch{}return null;}
 const alerts=()=>{try{return window.EvieRadar?.alerts?.()||[];}catch{return [];}};
 /* ---------------- the nudges ---------------- */
 function departureText(it,t){const call=address(),lv=t?toMin(it.time)-t.min-(it.buffer||5):null,rain=rainAt(lv!=null?hm(lv):it.time),al=alerts()[0];
  const ask=lv!=null?`¿vas a salir a las ${fmt(lv)}?`:`¿ya tienes todo para «${it.label}»?`;
  return `${call?call.charAt(0).toUpperCase()+call.slice(1)+', ':''}${ask} Veo que a las ${fmt(toMin(it.time))} tienes «${it.label}».${t?` ${t.traffic?'Con tráfico':'De camino'} son ${t.min} min.`:''}${rain!=null&&rain>=50?` Va a llover (${rain} %): lleva paraguas.`:''}${al?` Ojo: ${al.titulo}.`:''}`;}
 async function nudges(){const out=[],m=nowMin(),c=cfg();await weather();
  const next=upcoming().filter(x=>toMin(x.time)-m>=0&&toMin(x.time)-m<=180).slice(0,2);
  for(const it of next){const t=await eta(it);out.push({id:'go:'+it.id,kind:'go',icon:'car-front',title:`${it.label} · ${fmt(toMin(it.time))}`,text:departureText(it,t),soon:toMin(it.time)-m<=c.minutes+15});}
  const r=rainNext(6);if(r&&r.rain_prob>=60&&!out.some(x=>/llover/.test(x.text)))out.push({id:'rain:'+String(r.time).slice(0,13),kind:'rain',icon:'cloud-rain',title:`Lluvia hacia las ${fmt(toMin(String(r.time).slice(11,16)))}`,text:`Hay ${r.rain_prob} % de probabilidad de lluvia. Si vas a salir, lleva paraguas o sal antes.`,soon:true});
  for(const a of alerts().slice(0,3))out.push({id:'al:'+norm(a.titulo).slice(0,40),kind:'alert',icon:'siren',title:a.titulo,text:[a.detalle,a.cuando].filter(Boolean).join(' · '),url:a.url||'',soon:true});
  try{const s=window.EvieSchool?.summary?.();if(s?.nextExam&&s.nextExam.days<=1)out.push({id:'exam:'+s.nextExam.title,kind:'exam',icon:'graduation-cap',title:`${s.nextExam.days<=0?'Hoy':'Mañana'}: ${s.nextExam.title}`,text:s.cardsDue?`¿Repasamos ${s.cardsDue} ${s.cardsDue===1?'tarjeta':'tarjetas'} ahora?`:'Dale un repaso hoy.',href:'#escuela/tarjetas',action:'Repasar'});}catch{}
  const closed=/complet|perdid|pausad|ganad/i,due=Store.list('clients').filter(x=>x.nextDate&&x.nextDate<=today()&&!closed.test(x.stage||'')&&!x.cabin?.outcome);if(due.length)out.push({id:'soma:'+today(),kind:'soma',icon:'handshake',title:`${due.length} ${due.length===1?'seguimiento':'seguimientos'} de SOMA`,text:due.slice(0,3).map(x=>x.title).join(' · '),href:'#soma',action:'Ver'});
  try{const mp=window.EvieMission?.plan?.();if(mp&&!mp.done&&!mp.onTrack&&mp.required>0)out.push({id:'mission:'+today(),kind:'mission',icon:'rocket',title:`Misión «${mp.name}» ${mp.eta?mp.late+(mp.late===1?' mes':' meses')+' tarde':'sin proyección'}`,text:`Aparta ${money(Math.ceil(mp.required/4.35))} esta semana para ir a tiempo.`,href:'#objetivos',action:'Ver'});}catch{}
  return out;}
 /* ---------------- HUD card ---------------- */
 function render(d){const list=d?.list||[],c=cfg();
  return `<div class="ivp">${list.length?`<ul class="ivp-list">${list.map(n=>`<li data-k="${e(n.kind)}" class="${n.soon?'is-soon':''}"><span class="ivp-ic">${ic(n.icon)}</span><div><strong>${e(n.title)}</strong><p>${e(n.text)}</p>${n.href?`<a class="ivp-act" href="${e(n.href)}">${e(n.action||'Ver')}${ic('arrow-right')}</a>`:''}${n.url?`<a class="ivp-src" href="${e(n.url)}" target="_blank" rel="noopener noreferrer">${ic('external-link')}Fuente</a>`:''}</div></li>`).join('')}</ul>`:'<p class="ivp-empty">Todo tranquilo por ahora. Te aviso si algo cambia.</p>'}
   <div class="ivp-foot"><span class="ivp-state">${c.enabled?`${ic('radio')}Te aviso ${c.minutes} min antes${c.voice?' con voz':''}`:`${ic('bell-off')}Avisos apagados`}</span><button type="button" class="button small" data-ivp="settings">${ic('settings-2')}Ajustes</button></div></div>`;}
 const card={title:'Ivi te avisa',icon:'bell-ring',scope:'account',load:async()=>({list:await nudges()}),render};
 if(window.EvieCards?.R)EvieCards.R.proactive=card;
 function settingsDialog(){const c=cfg();App.openDialog('Avisos de Ivi',`<form id="ivp-form" class="ch-form"><p class="dialog-subtitle">Ivi te pregunta antes de tus compromisos y te avisa de lluvia o calles cerradas. Todo se calcula en tu dispositivo.</p>
   <label class="ivi-switch"><input type="checkbox" name="enabled" ${c.enabled?'checked':''}><span class="ivi-switch-ui" aria-hidden="true"></span><span><strong>Ivi me habla primero</strong><small>Avisos antes de lo que tienes con hora</small></span></label>
   <label class="ivi-switch"><input type="checkbox" name="voice" ${c.voice?'checked':''}><span class="ivi-switch-ui" aria-hidden="true"></span><span><strong>Con voz</strong><small>Si el navegador lo permite; si no, aviso en pantalla</small></span></label>
   <label class="ch-field"><span>¿Cuántos minutos antes?</span><select class="select" name="minutes">${[15,20,30,45,60].map(v=>`<option value="${v}" ${c.minutes===v?'selected':''}>${v} min</option>`).join('')}</select></label>
   <label class="ch-field"><span>¿Cómo quieres que te llame?</span><input class="input" name="callMe" maxlength="30" value="${e(c.callMe)}" placeholder="Ej. jefe (vacío = tu nombre)"></label>
   <div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('check')}Guardar</button></div></form>`);
  const f=document.getElementById('ivp-form');f.onsubmit=ev=>{ev.preventDefault();Store.save(s=>{s.preferences.iviProactive={enabled:f.elements.enabled.checked,voice:f.elements.voice.checked,minutes:Number(f.elements.minutes.value)||30,callMe:f.elements.callMe.value.trim().slice(0,30)};});App.closeDialog(true);App.toast('Listo: así te aviso.','success');refresh();};}
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-ivp]');if(b?.dataset.ivp==='settings')settingsDialog();});
 function refresh(){try{const x=window.EvieHUD?.resolve?.('proactive');if(x?.id)EvieHUD.update(x.id,{});}catch{}}
 /* ---------------- the check-in loop ---------------- */
 const spoken=new Set();let opened='';
 const key=(id)=>today()+'|'+id;
 async function say(text){window.EvieSounds?.play?.('alert');const vis=!document.hidden;if(cfg().voice&&vis&&window.EvieAssistant?.say){try{await EvieAssistant.say(text);}catch{App.toast(text,'success');}}else App.toast(text,'success');
  try{if(document.hidden&&typeof Notification!=='undefined'&&Notification.permission==='granted'){const reg=await navigator.serviceWorker?.getRegistration?.();if(reg?.showNotification)await reg.showNotification('Ivi',{body:text,tag:'evie-ivi-checkin',icon:'icons/ivy-192.png'});}}catch{}}
 async function tick(){const c=cfg();if(!c.enabled||!window.DALI_READY)return;const m=nowMin();
  for(const it of upcoming()){const until=toMin(it.time)-m;if(until<c.minutes-3||until>c.minutes+2)continue;const k=key('go:'+it.id);if(spoken.has(k))continue;spoken.add(k);try{sessionStorage.setItem('evie-ivp-'+k,'1');}catch{}
   if(!c.enabled)return;await weather();const t=await eta(it);await say(departureText(it,t));refresh();break;}}
 try{for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(k?.startsWith('evie-ivp-'))spoken.add(k.slice(9));}}catch{}
 setInterval(()=>{tick().catch(()=>{});},60000);
 /** Inicio: open «Ivi te avisa» once a day when something is near (departure within the window, rain, alerts). */
 let checking=false,checkedAt=0;
 async function afterRender(){if(UI.section!=='inicio'||!window.EvieHUD||!cfg().enabled||!window.DALI_READY)return;const t=today();if(opened===t||checking||Date.now()-checkedAt<120000)return;let last='';try{last=localStorage.getItem('evie-ivp-open')||'';}catch{}if(last===t){opened=t;return;}
  checking=true;checkedAt=Date.now();try{const list=await nudges().catch(()=>[]);if(!list.some(n=>n.soon)||UI.section!=='inicio')return;opened=t;try{localStorage.setItem('evie-ivp-open',t);}catch{}
   // Never pull the user back to Inicio: open only if they are still there when the timer fires.
   setTimeout(()=>{if(UI.section==='inicio')window.EvieHUD?.open?.('proactive');else{opened='';try{localStorage.removeItem('evie-ivp-open');}catch{}}},1400);}finally{checking=false;}}
 /** The live situation that travels to chat/voice as DATA (so Ivi can say «¿vas a salir a las 12:20?»). */
 function situation(){const m=nowMin(),up=upcoming().filter(x=>toMin(x.time)-m>=-5&&toMin(x.time)-m<=360).slice(0,4).map(x=>{const t=etas[x.id],lv=t?toMin(x.time)-t.min-(x.buffer||5):null;return {label:String(x.label).slice(0,60),time:x.time,...(x.place?.name?{place:String(x.place.name).slice(0,60)}:{}),...(t?{eta_min:t.min,traffic:t.traffic,leave:hm(lv)}:{})};});
  const rain=(wx?.hours||[]).slice(0,6).filter(h=>Number.isFinite(h.rain_prob)&&h.rain_prob>=30).map(h=>({time:String(h.time).slice(11,16),prob:h.rain_prob}));
  return {address:address(),upcoming:up,weather:wx?.current?`${wx.current.condition||''} ${Math.round(wx.current.temperature_c)}°`.trim():'',rain,alerts:alerts().slice(0,3).map(a=>({titulo:a.titulo,cuando:a.cuando||''}))};}
 function intent(text){const t=norm(text);if(!/\b(que tengo (al rato|mas tarde|pronto)|algo pendiente (hoy|al rato)|me avisas|avisos de hoy|va a llover|llovera|necesito paraguas)\b/.test(t))return '';
  if(UI.section==='inicio'&&window.EvieHUD){EvieHUD.open('proactive');return 'Te dejo en pantalla lo que viene y los avisos de hoy.';}location.hash='inicio';setTimeout(()=>window.EvieHUD?.open?.('proactive'),800);return 'Abro tus avisos en Inicio.';}
 return Object.freeze({upcoming,nudges,situation,render,card,afterRender,intent,tick,address,departureText,settingsDialog,_reset:()=>{opened='';checkedAt=0;try{localStorage.removeItem('evie-ivp-open');}catch{}}});
})();
