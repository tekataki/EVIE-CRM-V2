'use strict';
/* EVIE timers: multiple named timers, pause/resume/cancel, persisted by absolute timestamps (survive reloads),
   gentle alarm (original Web Audio cue), system notification only if the user already granted permission.
   Device-scoped (an alarm rings on the device that set it): stored in localStorage under the account key.
   Honest limits: a web page cannot ring while the browser/tab is closed or suspended (iOS especially);
   on return, overdue timers are shown as «terminó mientras no estabas». */
window.EvieTimers=(()=>{
 const MAX=10,MAX_MS=24*3600e3,LATE_RING_MS=60e3;
 const key=()=>{try{return (DALI_CONFIG.storageKey?.()||'evie')+'-timers';}catch{return 'evie-timers';}};
 let list=[],tick=null,clock=()=>Date.now();
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9. ]/g,' ').replace(/\s+/g,' ').trim();
 function load(){try{const v=JSON.parse(localStorage.getItem(key())||'[]');list=Array.isArray(v)?v.filter(t=>t&&t.id&&Number.isFinite(t.duration_ms)).slice(-MAX*2):[];}catch{list=[];}}
 function save(){try{localStorage.setItem(key(),JSON.stringify(list.slice(-MAX*2)));}catch{}}
 const remaining=t=>t.state==='running'?Math.max(0,t.ends_at-clock()):t.state==='paused'?t.remaining_ms:0;
 const active=()=>list.filter(t=>t.state==='running'||t.state==='paused');
 function fmt(ms){const s=Math.ceil(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`;}
 function spoken(ms){const s=Math.round(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60,p=[];if(h)p.push(h+(h===1?' hora':' horas'));if(m)p.push(m+(m===1?' minuto':' minutos'));if(x&&!h)p.push(x+(x===1?' segundo':' segundos'));return p.length?p.length>1?p.slice(0,-1).join(', ')+' y '+p.at(-1):p[0]:'0 segundos';}
 const nameOf=t=>t.label?`«${t.label}»`:'de '+spoken(t.duration_ms);
 function changed(){save();schedule();document.querySelectorAll('[data-timer-card]').forEach(paintCard);try{dispatchEvent(new CustomEvent('evie-timers'));}catch{}}
 function start({seconds,label=null}={}){const ms=Math.round(Number(seconds)*1000);if(!Number.isFinite(ms)||ms<1000)return {ok:false,error:'Dime cuánto tiempo: por ejemplo, 10 minutos.'};if(ms>MAX_MS)return {ok:false,error:'El máximo es de 24 horas.'};
  if(active().length>=MAX)return {ok:false,error:`Ya tienes ${MAX} temporizadores activos.`};
  label=label?String(label).trim().slice(0,40)||null:null;
  if(label&&active().some(t=>norm(t.label)===norm(label)))return {ok:false,error:`Ya hay un temporizador «${label}». ¿Quieres cancelarlo o usar otro nombre?`};
  const now=clock(),t={id:'tmr-'+now.toString(36)+Math.random().toString(36).slice(2,6),label,duration_ms:ms,created_at:now,ends_at:now+ms,remaining_ms:ms,state:'running',done_at:null};
  list.push(t);changed();return {ok:true,timer:t,say:`Listo, temporizador ${nameOf(t)} en marcha.`};}
 /* Resolve a spoken reference: label words, «el de 10 minutos», or the only active timer. */
 function find(ref,{states=['running','paused']}={}){const pool=list.filter(t=>states.includes(t.state));if(!pool.length)return {none:true};
  const byId=pool.find(t=>t.id===ref);if(byId)return {timer:byId};
  const r=norm(ref).replace(/\b(el|la|los|las|de|del|temporizador(es)?|timer|alarma|para|al|a)\b/g,' ').replace(/\s+/g,' ').trim();
  if(!r)return pool.length===1?{timer:pool[0]}:{ambiguous:pool};
  const sec=parseDuration(ref);if(sec){const byDur=pool.filter(t=>Math.abs(t.duration_ms-sec*1000)<1000);if(byDur.length===1)return {timer:byDur[0]};}
  const byLabel=pool.filter(t=>t.label&&(norm(t.label)===r||norm(t.label).includes(r)||r.includes(norm(t.label))));if(byLabel.length===1)return {timer:byLabel[0]};
  return byLabel.length>1?{ambiguous:byLabel}:{notFound:true};}
 function act(action,ref){const states=action==='resume'?['paused']:action==='pause'?['running']:['running','paused'];const f=find(ref,{states});
  if(f.none){const any=active().length;return {ok:false,error:any?(action==='resume'?'No hay temporizadores en pausa.':'Ese temporizador ya está en pausa.'):'No tienes temporizadores activos.'};}
  if(f.notFound)return {ok:false,error:'No encontré ese temporizador.'};
  if(f.ambiguous)return {ok:false,ambiguous:f.ambiguous.map(nameOf),error:'¿Cuál? Tienes '+f.ambiguous.map(nameOf).join(', ')+'.'};
  const t=f.timer,now=clock();
  if(action==='pause'){t.remaining_ms=Math.max(0,t.ends_at-now);t.state='paused';changed();return {ok:true,timer:t,say:`Pausé el temporizador ${nameOf(t)}. Quedan ${spoken(t.remaining_ms)}.`};}
  if(action==='resume'){t.ends_at=now+t.remaining_ms;t.state='running';changed();return {ok:true,timer:t,say:`Reanudé ${nameOf(t)}. Quedan ${spoken(t.remaining_ms)}.`};}
  if(action==='cancel'){const prev={...t};t.state='cancelled';changed();return {ok:true,timer:t,say:`Cancelé el temporizador ${nameOf(t)}.`,undo:()=>{Object.assign(t,prev);if(t.state==='running'&&t.ends_at<=clock())t.ends_at=clock()+1000;changed();}};}
  if(action==='status')return {ok:true,timer:t,say:`Al temporizador ${nameOf(t)} le quedan ${spoken(remaining(t))}${t.state==='paused'?' (en pausa)':''}.`};
  return {ok:false,error:'Acción no válida.'};}
 function cancelAll(){const a=active();if(!a.length)return {ok:false,error:'No tienes temporizadores activos.'};const prev=a.map(t=>({...t}));a.forEach(t=>t.state='cancelled');changed();
  return {ok:true,count:a.length,say:a.length===1?'Cancelé el temporizador.':`Cancelé ${a.length} temporizadores.`,undo:()=>{prev.forEach(p=>{const t=list.find(x=>x.id===p.id);if(t)Object.assign(t,p);});changed();}};}
 function dismiss(id){const t=list.find(x=>x.id===id);if(t&&t.state==='done'){t.state='dismissed';changed();}stopRing();}
 /* ---- alarm ---- */
 let ringing=null;
 function ring(t,{late=false}={}){const say=late?`El temporizador ${nameOf(t)} terminó mientras no estabas.`:`Terminó el temporizador ${nameOf(t)}.`;
  try{window.App?.toast?.(say,'success');}catch{}
  if(!late){let n=0;stopRing();const beat=()=>{if(n++>=4){stopRing();return;}window.EvieSounds?.play?.('alarm');};beat();ringing=setInterval(beat,1600);}
  try{if(document.visibilityState!=='visible'&&'Notification' in window&&Notification.permission==='granted')new Notification('EVIE · temporizador',{body:say,tag:t.id});}catch{}
  try{const live=document.getElementById('evie-timer-live');if(live)live.textContent=say;}catch{}}
 function stopRing(){if(ringing){clearInterval(ringing);ringing=null;}}
 function check(){const now=clock();let any=false;for(const t of list)if(t.state==='running'&&t.ends_at<=now){t.state='done';t.done_at=now;any=true;ring(t,{late:now-t.ends_at>LATE_RING_MS});}
  if(any)changed();else document.querySelectorAll('[data-timer-left]').forEach(n=>{const t=list.find(x=>x.id===n.dataset.timerLeft);if(t)n.textContent=fmt(remaining(t));});}
 function schedule(){const need=list.some(t=>t.state==='running');if(need&&!tick)tick=setInterval(check,1000);else if(!need&&tick){clearInterval(tick);tick=null;}}
 /* Ask for notification permission ONLY from a user click (never automatically). */
 async function askNotify(){if(!('Notification' in window))return 'unsupported';if(Notification.permission!=='default')return Notification.permission;try{return await Notification.requestPermission();}catch{return 'denied';}}
 /* ---- Spanish duration parser ---- */
 const WORDS={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veinticinco:25,treinta:30,cuarenta:40,cuarentaicinco:45,cincuenta:50,noventa:90};
 function parseDuration(text){let q=' '+norm(String(text||'').replace(/(\d),(\d)/g,'$1.$2')).replace(/cuarenta y cinco/g,'cuarentaicinco')+' ';let s=0,hit=false;
  q=q.replace(/ (?:una )?hora y media /g,()=>{s+=5400;hit=true;return ' ';}).replace(/ media hora /g,()=>{s+=1800;hit=true;return ' ';}).replace(/ (?:un )?cuarto de hora /g,()=>{s+=900;hit=true;return ' ';});
  const num=w=>w==null?null:/^\d+(\.\d+)?$/.test(w)?Number(w):WORDS[w]??null;
  const re=/ (\d+(?:\.\d+)?|[a-z]+) (horas?|hrs?|h|minutos?|mins?|m|segundos?|segs?|s)\b( y media)?/g;let m;
  while((m=re.exec(q))){const n=num(m[1]);if(n==null)continue;const u=m[2][0]==='h'?3600:m[2][0]==='m'?60:1;s+=n*u+(m[3]?u/2:0);hit=true;}
  return hit&&s>0?Math.round(s):null;}
 /* «para la pasta», «llamado pasta», «que se llame pasta» → label */
 function parseLabel(text){const q=norm(text);const m=q.match(/(?:\bpara (?:el |la |los |las |mi |sacar |apagar |revisar )?|\bllamado |\bque se llame |\bde nombre )([a-z0-9 ]{2,40}?)(?: de \d| por \d| en \d|$)/);if(!m)return null;const l=m[1].trim();return /^(\d|un|una|dos|tres|cinco|diez|quince|veinte|treinta)\b/.test(l)?null:l;}
 /** Local voice intent. Returns spoken text or null. */
 function intent(text){const q=norm(text).replace(/^(?:oye |hey |hola |ok )?(?:evie|evi|ivi|ivy|ibi|libi|eby|evy) /,'').trim();if(!/temporizador|timer|cronometro|alarma de|avisame en|cuanto falta|cuanto le queda/.test(q))return null;
  const ref=q.replace(/^.*?(?:temporizador(?:es)?|timer)\s*/,'');
  if(/^(?:cancela|cancelar|quita|borra|elimina|deten|para) (?:todos los|todos mis|los) temporizadores/.test(q))return out(cancelAll());
  if(/^(?:cancela|cancelar|quita|borra|elimina|deten|detener|apaga)\b/.test(q))return out(act('cancel',ref));
  if(/^(?:pausa|pausar|pon en pausa)\b/.test(q))return out(act('pause',ref));
  if(/^(?:reanuda|reanudar|continua|sigue|quita la pausa)\b/.test(q))return out(act('resume',ref));
  if(/cuanto (?:falta|le queda|queda)|como va (?:el|mi) temporizador/.test(q)){const a=active();if(!a.length)return 'No tienes temporizadores activos.';if(a.length>1&&!ref.trim())return a.map(t=>`${nameOf(t)}: ${spoken(remaining(t))}${t.state==='paused'?' en pausa':''}`).join('. ')+'.';return out(act('status',ref));}
  if(/^(?:muestra|abre|ver|ensename|muestrame) (?:mis |los )?temporizadores/.test(q)){window.EvieHUD?.open?.('timer');return active().length?`Tienes ${active().length} temporizador${active().length>1?'es':''}.`:'No tienes temporizadores activos.';}
  const sec=parseDuration(q);if(!sec)return /pon|crea|inicia|programa|empieza|avisame/.test(q)?'¿De cuánto tiempo? Por ejemplo: 10 minutos.':null;
  return out(start({seconds:sec,label:parseLabel(q)}),true);}
 function out(r,show){if(r.ok){if(show)window.EvieHUD?.open?.('timer');if(r.undo)try{App.toast(r.say,'success',r.undo);window.EvieFinance?.setLastUndo?.(r.undo);}catch{}window.EvieSounds?.play?.('success');return r.say;}return r.error;}
 /* ---- HUD card ---- */
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const btn=(a,t,l,ic)=>`<button type="button" class="button small" data-tmr="${a}" data-id="${t.id}" aria-label="${l} ${esc(t.label||'temporizador')}">${window.Views?Views.icon(ic):''}${l}</button>`;
 function cardBody(){const a=list.filter(t=>t.state==='running'||t.state==='paused'||t.state==='done').slice(-MAX);
  if(!a.length)return `<p class="tmr-empty">Sin temporizadores. Di «Ivi, pon un temporizador de 10 minutos para la pasta».</p>`;
  return `<ul class="tmr-list">${a.map(t=>{const pct=t.state==='done'?100:Math.round(100-remaining(t)/t.duration_ms*100);return `<li class="tmr" data-state="${t.state}"><div class="tmr-main"><strong>${esc(t.label||'Temporizador')}</strong><small>${t.state==='paused'?'En pausa':t.state==='done'?'Terminado':'de '+esc(spoken(t.duration_ms))}</small></div><time class="tmr-left" data-timer-left="${t.id}" aria-label="Tiempo restante">${t.state==='done'?'0:00':fmt(remaining(t))}</time><span class="tmr-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><div class="tmr-actions">${t.state==='running'?btn('pause',t,'Pausar','pause'):t.state==='paused'?btn('resume',t,'Reanudar','play'):''}${t.state==='done'?btn('dismiss',t,'Listo','check'):btn('cancel',t,'Cancelar','x')}</div></li>`;}).join('')}</ul>
   ${'Notification' in window&&Notification.permission==='default'?`<button type="button" class="button small tmr-notify" data-tmr="notify">Avisarme también con notificaciones</button>`:''}`;}
 function paintCard(node){node.innerHTML=cardBody();window.lucide?.createIcons?.({root:node});}
 document.addEventListener('click',async ev=>{const b=ev.target.closest?.('[data-tmr]');if(!b)return;const a=b.dataset.tmr,t=list.find(x=>x.id===b.dataset.id);
  if(a==='notify'){await askNotify();document.querySelectorAll('[data-timer-card]').forEach(paintCard);return;}if(!t)return;
  if(a==='dismiss')return dismiss(t.id);const r=act(a,t.id);if(r.ok&&a==='cancel'&&r.undo)App.toast(r.say,'success',r.undo);});
 addEventListener('storage',ev=>{if(ev.key===key()){load();changed();}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
 function init(){load();check();schedule();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 return Object.freeze({start,act,cancelAll,dismiss,find,intent,parseDuration,parseLabel,list:()=>list.map(t=>({...t,remaining_ms:remaining(t)})),active:()=>active().map(t=>({...t,remaining_ms:remaining(t)})),cardBody,paintCard,askNotify,fmt,spoken,reload:init,_clock:f=>{clock=f;}});
})();
