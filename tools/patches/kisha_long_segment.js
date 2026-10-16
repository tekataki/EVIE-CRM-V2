  /* Long narrative («relato largo»): ONE microphone stream recorded as self-contained ~50 s segments (the
     MediaRecorder is restarted per segment so every piece is a complete, decodable file), transcribed in order
     through a queue while the person keeps talking. Ends on the button, 7 s of silence after speech, or the
     15 min cap. A failed segment keeps its audio only in memory for an explicit retry; nothing is stored. */
  const SEG_MS=50000,LONG_CAP_MS=15*60000,LONG_SILENCE_MS=7000;
  async function sttBlob(blob,dur){const res=await fetch('/api/ai/stt',{method:'POST',credentials:'same-origin',headers:headers({'Content-Type':blob.type,'X-Evie-Duration':String(Math.ceil(dur)),'X-Evie-Hint':encodeURIComponent('Kisha, EVIE')}),body:blob});
   const j=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(Error(j.error||'No se pudo transcribir.'),{status:res.status});return String(j.text||'').trim();}
  async function recordLong(signal,{onPartial=()=>{},onTime=()=>{}}={}){window.EvieAssistant?.stopSpeaking?.();stopPlayback();
   if(!(canCloud('stt')&&window.MediaRecorder&&navigator.mediaDevices?.getUserMedia))throw Object.assign(Error('El relato largo necesita tu cuenta EVIE con voz. Puedes escribir o usar el micrófono normal.'),{code:'unavailable'});
   let stopAll=()=>{};
   if(window.EvieMic&&!EvieMic.acquire('kisha',()=>stopAll(false)))throw Object.assign(Error('El micrófono está ocupado.'),{code:'mic'});
   let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});}
   catch(e){window.EvieMic?.release('kisha');throw Object.assign(Error(['NotAllowedError','SecurityError'].includes(e?.name)?'No tengo permiso para usar el micrófono.':'No pude abrir el micrófono.'),{code:'mic'});}
   const type=pickType(),parts=[],failed=[];let pending=0,seq=0,stopped=false,cur=null,segStart=0,started=performance.now(),segHeard=false,everHeard=false,quiet=null,loop=0,src=null,an=null,buf=null,vad=false,floor=null,working=Promise.resolve(),drop=false,finish=null;
   try{if(ctx&&ctx.state!=='running')await ctx.resume().catch(()=>{});if(ctx?.state==='running'){src=ctx.createMediaStreamSource(stream);an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);buf=new Uint8Array(an.fftSize);vad=true;}}catch{vad=false;}
   const joined=()=>parts.filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
   const emit=()=>onPartial({text:joined(),segments:seq,pending,failed:failed.length});
   function transcribe(seg){pending++;emit();working=working.then(async()=>{try{parts[seg.n]=await sttBlob(seg.blob,seg.dur);}catch(err){seg.err=err.message;failed.push(seg);}pending--;emit();});}
   function startSeg(){const chunks=[];let mr;try{mr=new MediaRecorder(stream,type?{mimeType:type}:{});}catch{mr=new MediaRecorder(stream);}const n=seq++;segStart=performance.now();segHeard=false;
    mr.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    mr.onstop=()=>{const dur=(performance.now()-segStart)/1000,blob=new Blob(chunks,{type:(chunks[0]?.type||mr.mimeType||type||'audio/webm').split(';')[0]});
     if(!drop&&(segHeard||!vad)&&blob.size>=800&&dur>=.5)transcribe({n,blob,dur});
     if(!stopped)startSeg();else finish?.();};
    mr.start();cur=mr;}
   stopAll=discard=>{if(stopped)return;stopped=true;drop=!!discard;cancelAnimationFrame(loop);try{if(cur&&cur.state!=='inactive')cur.stop();else finish?.();}catch{finish?.();}};
   const tick=()=>{if(stopped)return;const now=performance.now(),el=now-started;onTime(el);
    if(vad){an.getByteTimeDomainData(buf);let e2=0;for(const v of buf)e2+=((v-128)/128)**2;const rms=Math.sqrt(e2/buf.length);if(el<400)floor=floor==null?rms:Math.min(floor,rms)*.5+rms*.5;const thr=Math.min(.035,Math.max(.012,(floor||0)*2.5+.01));onLevel(Math.min(1,rms*8));
     if(el>400&&rms>thr){segHeard=true;everHeard=true;quiet=null;}else if(everHeard){quiet??=now;if(now-quiet>LONG_SILENCE_MS)return stopAll(false);}
     if(!everHeard&&el>12000)return stopAll(false);}
    if(el>LONG_CAP_MS)return stopAll(false);
    if(now-segStart>SEG_MS){try{cur.stop();}catch{}}
    loop=requestAnimationFrame(tick);};
   const ended=new Promise(r=>{finish=r;});
   rec={stop:d=>stopAll(!!d)};signal?.addEventListener('abort',()=>stopAll(true),{once:true});
   onPhase('listening');startSeg();loop=requestAnimationFrame(tick);
   await ended;await working;
   stream.getTracks().forEach(t=>t.stop());try{src?.disconnect();}catch{}rec=null;onLevel(0);window.EvieMic?.release('kisha');
   if(drop||signal?.aborted||disposed)return null;
   if(!everHeard&&vad)throw Object.assign(Error('No te escuché. Toca «Relato largo» y habla cuando veas «Escuchando…».'),{code:'silence'});
   const retry=async()=>{for(const seg of [...failed]){try{parts[seg.n]=await sttBlob(seg.blob,seg.dur);failed.splice(failed.indexOf(seg),1);}catch{}}emit();return {text:joined(),failed:failed.length,retry};};
   return {text:joined(),segments:seq,failed:failed.length,retry,seconds:Math.round((performance.now()-started)/1000)};}
