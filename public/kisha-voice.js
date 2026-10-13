'use strict';
/* Kisha voice I/O — turn-based (never full duplex). Reuses EVIE's server endpoints:
   /api/ai/stt (Groq) and /api/ai/tts (Fish Audio). Keys never reach the browser.
   - record(): mic → MediaRecorder with a simple VAD → transcript. Microphone tracks are always stopped.
   - speak(): TTS → one reusable <audio>. The mouth follows an amplitude envelope decoded from the SAME
     audio bytes and read at audio.currentTime, so lip-sync works on iOS too (no MediaElementSource routing).
     'speaking' is reported only between the real 'playing' and 'ended/pause' events.
   - If play() is refused (iOS autoplay), returns 'blocked' and keeps the clip: replay() plays it on a tap
     without a second paid TTS request.
   - Exclusive audio: starting Kisha stops EVIE's assistant audio/mic and vice versa (EvieAudio lock). */
window.KishaVoice=(()=>{
 const apple=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||(/Safari\//.test(navigator.userAgent)&&!/Chrome|Chromium|Android/.test(navigator.userAgent));
 const AC=()=>window.AudioContext||window.webkitAudioContext;
 function headers(extra={}){const u=window.EvieAccounts?.current?.();return {'X-Evie-Request':'1',...(u?{'X-Evie-User':u.id}:{}),...extra};}
 function pickType(){if(!window.MediaRecorder)return '';const ok=t=>{try{return MediaRecorder.isTypeSupported?.(t);}catch{return false;}};return (apple?['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm']:['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4']).find(ok)||'';}
 function create({onPhase=()=>{},onLevel=()=>{},canCloud=()=>false}={}){
  let ctx=null,player=null,silent=null,rec=null,clip=null,envelope=null,raf=0,disposed=false,speechUtter=null;
  const urls=new Set();
  function url(blob){const u=URL.createObjectURL(blob);urls.add(u);return u;}
  function revoke(u){if(u&&urls.has(u)){URL.revokeObjectURL(u);urls.delete(u);}}
  /** MUST run inside the user's tap: resumes audio and primes the reusable element for iOS. */
  function unlock(){window.EvieAssistant?.stopSpeaking?.();try{if(!ctx){const K=AC();if(K)ctx=new K();}if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{});}catch{}
   if(!player){player=new Audio();player.preload='auto';player.setAttribute('playsinline','');player.setAttribute('webkit-playsinline','');}
   if(player.paused&&!clip?.playing){try{if(!silent){const n=800,b=new ArrayBuffer(44+n*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);silent=URL.createObjectURL(new Blob([b],{type:'audio/wav'}));}player.src=silent;player.play()?.catch?.(()=>{});}catch{}}}
  /* ---------- listening ---------- */
  async function record(signal){window.EvieAssistant?.stopSpeaking?.();stopPlayback();
   if(!(canCloud('stt')&&window.MediaRecorder&&navigator.mediaDevices?.getUserMedia))return browserListen(signal);
   let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});}
   catch(e){throw Object.assign(Error(['NotAllowedError','SecurityError'].includes(e?.name)?'No tengo permiso para usar el micrófono. Puedes escribirle a Kisha o activarlo en los ajustes del navegador.':'No pude abrir el micrófono. Puedes escribirle a Kisha.'),{code:'mic'});}
   if(signal?.aborted||disposed||document.hidden){stream.getTracks().forEach(t=>t.stop());return null;}
   const type=pickType();let mr;try{mr=new MediaRecorder(stream,type?{mimeType:type}:{});}catch{stream.getTracks().forEach(t=>t.stop());throw Object.assign(Error('Este navegador no puede grabar audio aquí. Escribe tu mensaje.'),{code:'mic'});}
   onPhase('listening');
   const chunks=[],started=performance.now();let heard=false,quiet=null,src=null,an=null,buf=null,vad=false,floor=null,loop=0,drop=false,manual=false;
   try{if(ctx&&ctx.state!=='running')await ctx.resume().catch(()=>{});if(ctx?.state==='running'){src=ctx.createMediaStreamSource(stream);an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);buf=new Uint8Array(an.fftSize);vad=true;}}catch{vad=false;}
   const done=new Promise(resolve=>{
    mr.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    mr.onstop=()=>{cancelAnimationFrame(loop);stream.getTracks().forEach(t=>t.stop());try{src?.disconnect();}catch{}rec=null;onLevel(0);resolve({blob:new Blob(chunks,{type:(chunks[0]?.type||mr.mimeType||type||'audio/webm').split(';')[0]}),dur:(performance.now()-started)/1000,heard:(vad&&!manual)?heard:true,drop});};});
   const tick=()=>{const el=performance.now()-started;
    if(vad){an.getByteTimeDomainData(buf);let e2=0;for(const v of buf)e2+=((v-128)/128)**2;const rms=Math.sqrt(e2/buf.length);if(el<400)floor=floor==null?rms:Math.min(floor,rms)*.5+rms*.5;const thr=Math.min(.035,Math.max(.012,(floor||0)*2.5+.01));onLevel(Math.min(1,rms*8));
     if(el>400&&rms>thr){heard=true;quiet=null;}else if(heard){quiet??=performance.now();if(performance.now()-quiet>1500)return stop(false,true);}
     if(!heard&&el>9000)return stop(false,true);}
    if(el>(vad?45000:20000))return stop(false,true);loop=requestAnimationFrame(tick);};
   function stop(discard,auto){drop=drop||!!discard;if(!discard&&!auto)manual=true;try{mr.state!=='inactive'&&mr.stop();}catch{}}
   rec={stop};signal?.addEventListener('abort',()=>stop(true),{once:true});
   try{mr.start();}catch{stream.getTracks().forEach(t=>t.stop());rec=null;throw Object.assign(Error('No pude iniciar la grabación.'),{code:'mic'});}
   loop=requestAnimationFrame(tick);
   const r=await done;if(r.drop||signal?.aborted||disposed)return null;
   if(!r.heard)throw Object.assign(Error('No te escuché. Toca el micrófono y habla cuando veas «Escuchando…».'),{code:'silence'});
   if(r.blob.size<800||r.dur<.5)throw Object.assign(Error('No se grabó audio. ¿Lo intentas de nuevo?'),{code:'silence'});
   onPhase('transcribing');
   // Raw audio is sent once for transcription and never stored.
   let res;try{res=await fetch('/api/ai/stt',{method:'POST',credentials:'same-origin',signal,headers:headers({'Content-Type':r.blob.type,'X-Evie-Duration':String(Math.ceil(r.dur)),'X-Evie-Hint':encodeURIComponent('Kisha, EVIE')}),body:r.blob});}
   catch(e){if(e.name==='AbortError')return null;throw Object.assign(Error('Sin conexión para transcribir. Escribe tu mensaje; nada se perdió.'),{code:'stt'});}
   const j=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(Error((j.error||'No se pudo transcribir.')+' Puedes escribirlo.'),{code:'stt'});
   return String(j.text||'').trim()||null;}
  function browserListen(signal){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return Promise.reject(Object.assign(Error('La voz no está disponible aquí. Escribe tu mensaje.'),{code:'unavailable'}));
   return new Promise((resolve,reject)=>{const r=new SR();r.lang='es-MX';r.interimResults=false;let text='';r.onresult=e=>{text=[...e.results].map(x=>x[0].transcript).join(' ');};
    r.onerror=e=>{if(e.error==='not-allowed')reject(Object.assign(Error('No tengo permiso para usar el micrófono. Puedes escribirle a Kisha.'),{code:'mic'}));};
    r.onend=()=>{rec=null;onLevel(0);resolve(signal?.aborted?null:text.trim()||null);};rec={stop:()=>{try{r.stop();}catch{}}};signal?.addEventListener('abort',()=>rec?.stop(),{once:true});
    try{r.start();onPhase('listening');}catch{rec=null;reject(Object.assign(Error('No pude iniciar el dictado.'),{code:'mic'}));}});}
  function stopRecording(){rec?.stop(false);}
  const recording=()=>!!rec;
  /* ---------- speaking ---------- */
  async function makeEnvelope(blob){try{if(!ctx)return null;const data=await ctx.decodeAudioData(await blob.arrayBuffer());const ch=data.getChannelData(0),step=Math.max(1,Math.floor(data.sampleRate/50)),out=new Float32Array(Math.ceil(ch.length/step));let max=1e-4;
    for(let i=0;i<out.length;i++){let s=0;const a=i*step,b=Math.min(ch.length,a+step);for(let k=a;k<b;k++)s+=ch[k]*ch[k];out[i]=Math.sqrt(s/Math.max(1,b-a));if(out[i]>max)max=out[i];}
    for(let i=0;i<out.length;i++)out[i]=Math.min(1,out[i]/max*1.15);return out;}catch{return null;}}
  function drive(){cancelAnimationFrame(raf);const step=()=>{if(!clip?.playing){onLevel(0);return;}let lv;if(envelope){const i=Math.floor(player.currentTime*50);lv=envelope[i]??0;}else lv=.35+.35*Math.abs(Math.sin(player.currentTime*11));onLevel(lv);raf=requestAnimationFrame(step);};raf=requestAnimationFrame(step);}
  /** Returns 'played' | 'blocked' | 'fallback' | 'text' | 'cancelled'. Never throws for provider failures. */
  async function speak(text,signal){stopPlayback();if(clip){revoke(clip.url);clip=null;}envelope=null;
   if(canCloud('tts')){onPhase('synthesizing');
    try{const res=await fetch('/api/ai/tts',{method:'POST',credentials:'same-origin',signal,headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({text:String(text).slice(0,600)})});
     if(signal?.aborted)return 'cancelled';
     if(res.ok){const blob=await res.blob();if(signal?.aborted)return 'cancelled';envelope=await makeEnvelope(blob);clip={url:url(blob),text,playing:false,pending:true};return await play(signal);}}
    catch(e){if(e.name==='AbortError'||signal?.aborted)return 'cancelled';}}
   return browserSpeak(text,signal);}
  async function play(signal){if(!clip||!player)return 'text';player.src=clip.url;
   const ended=new Promise(r=>{const end=()=>{player.removeEventListener('ended',end);player.removeEventListener('pause',end);player.removeEventListener('error',end);clearTimeout(cap);if(clip)clip.playing=false;cancelAnimationFrame(raf);onLevel(0);r();};
    const cap=setTimeout(end,Math.max(15000,clip.text.length*110+8000));player.addEventListener('ended',end);player.addEventListener('error',end);
    player.addEventListener('playing',()=>{if(!clip)return;clip.playing=true;clip.pending=false;onPhase('speaking');drive();player.addEventListener('pause',end,{once:true});},{once:true});
    signal?.addEventListener('abort',()=>{try{player.pause();}catch{}end();},{once:true});});
   try{const started=await Promise.race([player.play().then(()=>true),new Promise(r=>setTimeout(()=>r(false),8000))]);if(!started){try{player.pause();}catch{}if(clip)clip.playing=false;return 'blocked';}}catch{if(clip)clip.playing=false;return 'blocked';}
   await ended;return signal?.aborted?'cancelled':'played';}
  function browserSpeak(text,signal){if(!('speechSynthesis' in window))return Promise.resolve('text');
   return new Promise(resolve=>{try{speechSynthesis.cancel();}catch{}const u=new SpeechSynthesisUtterance(text);u.lang='es-MX';u.rate=1;speechUtter=u;let pulse=0,iv=0;
    u.onstart=()=>{onPhase('speaking');iv=setInterval(()=>{pulse*=.6;onLevel(pulse);},60);};u.onboundary=()=>{pulse=.85;};
    const fin=r=>{clearInterval(iv);onLevel(0);speechUtter=null;resolve(r);};u.onend=()=>fin('fallback');u.onerror=()=>fin('text');
    signal?.addEventListener('abort',()=>{try{speechSynthesis.cancel();}catch{}fin('cancelled');},{once:true});
    setTimeout(()=>{if(speechUtter===u&&!speechSynthesis.speaking)fin('text');},2500);speechSynthesis.speak(u);});}
  /** "Tocar para escuchar": replays the already generated clip (no new TTS charge). */
  async function replay(signal){if(!clip)return 'text';unlock();return play(signal);}
  function stopPlayback(){cancelAnimationFrame(raf);try{if(player&&!player.paused)player.pause();}catch{}try{if(speechUtter)speechSynthesis.cancel();}catch{}onLevel(0);}
  const hasClip=()=>!!clip;
  function dispose(){disposed=true;rec?.stop(true);stopPlayback();for(const u of [...urls])revoke(u);clip=null;envelope=null;if(player){player.removeAttribute('src');try{player.load();}catch{}}
   try{ctx?.close?.();}catch{}ctx=null;}
  return {unlock,record,stopRecording,recording,speak,replay,stopPlayback,hasClip,dispose,stats:()=>({urls:urls.size,recording:!!rec,ctx:ctx?ctx.state:'none'})};
 }
 return Object.freeze({create,apple});
})();
