'use strict';
/* EVIE wake word ("Ivi" / "Evie" / "Libi"), per-account opt-in.
   On-device only: uses the browser recognizer ONLY when it can process locally
   (SpeechRecognition.available({processLocally:true}) === 'available', e.g. recent Chrome/Edge with the
   Spanish language pack). If recognition would go to a remote service, wake listening is NOT started:
   room audio is never streamed anywhere (Groq included) just to find the name.
   Our own speech never triggers us: detection is ignored while EVIE listens/thinks/speaks and 900 ms after.
   Lifecycle: stops on page hide, sign-out, setting off or a fatal recognition error. */
window.EvieWake=(()=>{
 const NAME='(?:ivi|ivy|ivee|ibi|ivie|evie|evi|evy|ebi|libi|livi)';
 const RX=new RegExp('^(?:(?:oye|hey|ey|ok|okay|hola)\\s+)?'+NAME+'(?:\\s*[,.:;!?¡¿-]\\s*|\\s+|$)(.*)$','i');
 const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^[\s¡¿,.]+/,'').replace(/\s+/g,' ').trim();
 // Only at the very start of an utterance (optionally after oye/hey/ok): "le dije a Ivi…" never wakes EVIE.
 function match(text){const m=norm(text).match(RX);return m?{command:(m[1]||'').replace(/^[,.\s]+/,'').trim()}:null;}
 let rec=null,state='off',reason='',pauseUntil=0,onWake=null,restartTimer=null,gen=0,wanted=false;
 const SR=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
 const apple=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 async function support(){const K=SR();if(!K)return {ok:false,why:'Este navegador no incluye reconocimiento de voz en el dispositivo. Usa el núcleo, el micrófono o el doble aplauso.'};
  if(apple())return {ok:false,why:'En iPhone y iPad Safari no permite escucha continua fiable. Toca el núcleo o el micrófono para hablar.'};
  if(typeof K.available==='function'){try{const a=await K.available({langs:['es-MX'],processLocally:true});if(a==='available')return {ok:true,local:true};if(a==='downloadable'||a==='downloading')return {ok:false,installable:true,why:'Falta el paquete de voz en español del navegador. Toca «Preparar voz local».'};}catch{}}
  return {ok:false,why:'Tu navegador solo reconoce voz enviándola a un servicio externo. Por privacidad EVIE no escucha la palabra clave así; usa el micrófono o el doble aplauso.'};}
 async function install(){const K=SR();if(typeof K?.install!=='function')return false;try{return await K.install({langs:['es-MX'],processLocally:true});}catch{return false;}}
 const labels={off:'Palabra clave apagada',listening:'Escuchando «Ivi» en este dispositivo',paused:'En pausa mientras EVIE habla',unsupported:'No disponible en este navegador',error:'Se detuvo la escucha'};
 function set(s,why=''){state=s;reason=why;document.documentElement.dataset.evieWakeWord=s;document.querySelectorAll('[data-wake-state]').forEach(n=>{n.textContent=labels[s]||'';n.dataset.state=s;n.title=why;});}
 const busy=()=>['speaking','thinking','listening','error'].includes(document.documentElement.dataset.evie)||Date.now()<pauseUntil;
 async function start(handler){if(handler)onWake=handler;wanted=true;if(rec||document.hidden)return state;const s=await support();if(!wanted)return state;if(!s.ok){set('unsupported',s.why);return state;}
  const my=++gen,r=new (SR())();r.lang='es-MX';r.continuous=true;r.interimResults=true;r.maxAlternatives=2;try{r.processLocally=true;}catch{}
  r.onresult=ev=>{if(my!==gen)return;if(busy()){if(state!=='paused')set('paused');return;}if(state==='paused')set('listening');
   for(let i=ev.resultIndex;i<ev.results.length;i++){const res=ev.results[i];if(!res.isFinal)continue;for(const alt of res){const m=match(alt.transcript);if(!m)continue;pauseUntil=Date.now()+2500;gen++;try{r.abort();}catch{}rec=null;onWake?.(m.command);clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(wanted)start();},3200);return;}}};
  r.onerror=ev=>{if(my!==gen)return;if(['not-allowed','service-not-allowed','language-not-supported','network'].includes(ev.error)){gen++;rec=null;wanted=false;set('error',ev.error==='not-allowed'?'Permiso de micrófono denegado.':'El reconocimiento local no está disponible.');}};
  r.onend=()=>{if(my!==gen)return;rec=null;if(wanted){clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(wanted&&!document.hidden)start();},500);}};
  try{r.start();rec=r;set('listening');}catch{rec=null;set('error','No se pudo iniciar la escucha.');}
  return state;}
 function stop(){wanted=false;gen++;clearTimeout(restartTimer);try{rec?.abort();}catch{}rec=null;set('off');}
 const pause=(ms=900)=>{pauseUntil=Math.max(pauseUntil,Date.now()+ms);};
 let resume=false;
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(wanted){resume=true;const h=onWake;stop();onWake=h;}}else if(resume){resume=false;start();}});
 addEventListener('pagehide',()=>{resume=false;stop();});
 return Object.freeze({match,start,stop,pause,support,install,get state(){return state;},get reason(){return reason;},label:()=>labels[state]});
})();
