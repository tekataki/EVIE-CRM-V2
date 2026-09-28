'use strict';
window.DesktopVoice=(()=>{
 let ctx=null,stream=null,source=null,analyser=null,recorder=null,mute=null,player=null,frame=null,timer=null;
 let chunks=[],rate=48000,level=0,mode='idle',epoch=0,recorded=0,diagnostic=false,sessionActive=false,sessionEpoch=0,playbackDone=null,vad=null,confirmationToken=null;
 // Energy VAD: calibrate stationary room noise, require sustained voice, then
 // 1100 ms of real PCM silence. No timer invents speech from ambient noise.
 function createVAD(){let elapsed=0,noise=.004,voiced=0,silence=0,heard=false,ended=false;return {push(samples,sampleRate){if(ended)return false;const ms=samples.length/sampleRate*1000;let sum=0;for(const x of samples)sum+=x*x;const rms=Math.sqrt(sum/Math.max(1,samples.length));elapsed+=ms;if(elapsed<=300){noise+=(rms-noise)*.3;return false;}const speech=rms>Math.max(.012,noise*3.2);if(speech){voiced+=ms;silence=0;if(voiced>=240)heard=true;}else{silence+=ms;if(!heard&&silence>180)voiced=0;if(!heard)noise+=(rms-noise)*.02;}if(heard&&silence>=1100){ended=true;return true;}return false;},get heard(){return heard;},get elapsed(){return elapsed;}};}
 const unwrap=async promise=>{const r=await promise;if(!r.ok)throw Error(r.error);return r.data;};
 function state(phase){
  if(!Object.hasOwn(IvyState.labels,phase))throw Error('Estado de voz desconocido.');
  if(IvyState.get().phase===phase)return;
  // Cancellation is a failed/interrupted execution, never a successful tool result.
  if(phase==='idle'&&IvyState.get().phase==='executing')IvyState.transition('error','Ejecución interrumpida.');
  if(['listening','speaking','thinking'].includes(phase)&&!['idle','thinking','success'].includes(IvyState.get().phase)){
   if(IvyState.get().phase==='executing')IvyState.transition('error','Ejecución interrumpida.');
   IvyState.transition('idle');
  }
  if(phase==='listening'&&IvyState.get().phase!=='idle')IvyState.transition('idle');
  IvyState.transition(phase);
 }
 function meter(){if(!analyser)return;const a=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(a);const rms=Math.sqrt(a.reduce((n,x)=>n+x*x,0)/a.length);level+=(Math.min(1,rms*7)-level)*.28;document.querySelectorAll('[data-live-audio]').forEach(el=>el.value=level);frame=requestAnimationFrame(meter);}
 function wav(samples,sampleRate){const size=Math.floor(samples.length*16000/sampleRate),buffer=new ArrayBuffer(44+size*2),view=new DataView(buffer),ascii=(offset,s)=>[...s].forEach((c,n)=>view.setUint8(offset+n,c.charCodeAt(0)));ascii(0,'RIFF');view.setUint32(4,36+size*2,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,size*2,true);for(let i=0;i<size;i++){const start=Math.floor(i*sampleRate/16000),end=Math.max(start+1,Math.floor((i+1)*sampleRate/16000));let sum=0;for(let j=start;j<end&&j<samples.length;j++)sum+=samples[j];const v=Math.max(-1,Math.min(1,sum/(end-start)));view.setInt16(44+i*2,v<0?v*32768:v*32767,true);}return new Uint8Array(buffer);}
 async function release(){
  clearTimeout(timer);timer=null;if(frame!==null)cancelAnimationFrame(frame);frame=null;
  if(recorder){recorder.port.onmessage=null;recorder.port.postMessage('stop');}
  stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});stream=null;
  if(player)player.onended=null;try{player?.stop();}catch{}if(playbackDone){const done=playbackDone;playbackDone=null;done(false);}
  for(const n of [source,analyser,recorder,mute,player])try{n?.disconnect();}catch{}
  source=analyser=recorder=mute=player=null;const previous=ctx;ctx=null;level=0;
  document.querySelectorAll('[data-live-audio]').forEach(el=>el.value=0);
  if(previous&&previous.state!=='closed')await previous.close();
 }
 async function stop(){sessionActive=false;sessionEpoch++;epoch++;mode='idle';chunks=[];diagnostic=false;vad=null;confirmationToken=null;state('idle');await release();}
 async function endConfirmation(token){if(confirmationToken!==token)return;confirmationToken=null;epoch++;mode='idle';chunks=[];state('thinking');state('awaiting_confirmation');await release();}
 async function beginSession(){await stop();sessionActive=true;await start({continuous:true});}
 async function resumeSession(ticket){if(sessionActive&&ticket===sessionEpoch)await start({continuous:true});}
 async function start({diagnostic:testing=false,continuous=false,confirmationToken:confirmToken=null}={}){
  if(!window.evieDesktop)throw Error('Voz completamente local disponible en EVIE Desktop. En web puedes escribir comandos a Ivy.');
  const ticket=++epoch;mode='opening';chunks=[];await release();if(ticket!==epoch)return;
  diagnostic=testing;confirmationToken=confirmToken;vad=continuous?createVAD():null;state('listening');
  try{
   const acquired=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
   if(ticket!==epoch){acquired.getTracks().forEach(t=>t.stop());return;}
   stream=acquired;const audioContext=new AudioContext();ctx=audioContext;await audioContext.resume();if(ticket!==epoch)return;
   rate=audioContext.sampleRate;await audioContext.audioWorklet.addModule('pcm-recorder.js');if(ticket!==epoch)return;
   source=audioContext.createMediaStreamSource(stream);analyser=audioContext.createAnalyser();analyser.fftSize=1024;source.connect(analyser);
   recorder=new AudioWorkletNode(audioContext,'evie-pcm');mute=audioContext.createGain();mute.gain.value=0;source.connect(recorder);recorder.connect(mute).connect(audioContext.destination);
   chunks=[];recorded=0;recorder.port.onmessage=event=>{if(ticket!==epoch||mode!=='listening'||diagnostic)return;recorded+=event.data.length;if(recorded>rate*60)return;chunks.push(event.data);if(vad?.push(event.data,rate))void finish().catch(err=>window.DesktopUI?.notice(err.message));};
   mode='listening';meter();timer=setTimeout(()=>{const session=sessionEpoch;const work=testing?stop():vad&&!vad.heard?release().then(()=>resumeSession(session)):finish();work.catch(err=>window.DesktopUI?.notice(err.message));},59000);
   stream.getTracks()[0].onended=()=>{if(ticket===epoch)void stop();};
  }catch(err){if(ticket!==epoch)return;await stop();state('error');throw Error(err.name==='NotAllowedError'?'Micrófono denegado. Autorízalo en Configuración de EVIE y en Privacidad de Windows; no se reintentará automáticamente.':err.message);}
 }
 async function finish(){
  if(mode!=='listening')return;if(diagnostic)return stop();
  const ticket=epoch,session=sessionEpoch,confirmToken=confirmationToken;confirmationToken=null;mode='transcribing';const all=new Float32Array(chunks.reduce((n,x)=>n+x.length,0));let i=0;
  for(const chunk of chunks){all.set(chunk,i);i+=chunk.length;}chunks=[];const audio=wav(all,rate);
  await release();if(ticket!==epoch)return;state('transcribing');
  try{if(confirmToken){state('thinking');state('awaiting_confirmation');await unwrap(evieDesktop.confirmAudio(confirmToken,audio));if(ticket===epoch)mode='idle';return;}const result=await unwrap(evieDesktop.transcribe(audio));if(ticket!==epoch)return;mode='idle';const text=String(result.text||'').trim();if(!text){state('idle');await resumeSession(session);return;}window.DesktopUI?.transcript(text);const completed=await window.DesktopUI?.ask(text);if(completed===false){await stop();return;}await resumeSession(session);}
  catch(err){if(session!==sessionEpoch)return;await stop();state('error');throw err;}
 }
 async function speak(text){
  const ticket=++epoch;mode='loading';chunks=[];await release();if(ticket!==epoch)return;state('idle');
  try{
   const result=await unwrap(evieDesktop.speak(text.slice(0,5000)));if(ticket!==epoch)return;
   const audioContext=new AudioContext();ctx=audioContext;await audioContext.resume();if(ticket!==epoch)return;
   const bytes=new Uint8Array(result.audio),buffer=await audioContext.decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));if(ticket!==epoch)return;
   player=audioContext.createBufferSource();player.buffer=buffer;analyser=audioContext.createAnalyser();analyser.fftSize=1024;player.connect(analyser).connect(audioContext.destination);
   mode='speaking';state('speaking');meter();const ended=new Promise(resolve=>{playbackDone=resolve;player.onended=()=>{if(ticket!==epoch)return;playbackDone=null;resolve(true);};});player.start();if(result.warning)window.DesktopUI?.notice(result.warning);const completed=await ended;if(ticket!==epoch)return false;await release();mode='idle';state('idle');return completed;
  }catch(err){if(ticket!==epoch)return;await stop();state('error');throw err;}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void stop();});window.addEventListener('pagehide',()=>void stop());
 return {start,beginSession,endConfirmation,startConfirmation:token=>start({continuous:true,confirmationToken:token}),createVAD,finish,stop,speak,wav,state,unwrap,sample:()=>({level,mode}),stats:()=>({mode,diagnostic,session:sessionActive,tracks:stream?.getTracks().length||0,frames:frame!==null})};
})();
