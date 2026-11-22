'use strict';
/* EVIE long dictation (explicit mode; normal voice turns keep their 30 s cap).
   - One mic stream, overlapping MediaRecorders: a new recorder starts DICT.overlapSec before the previous
     one stops, so every chunk is an independently decodable file of ≤ chunkSec seconds (server cap 90 s).
   - Chunks are transcribed in order with X-Evie-Chunk; each audio blob is dropped as soon as its text
     arrives (audio is never stored). Failed chunks are retried (2x) — "resume" — and gaps are reported.
   - Assembly (ordering + seam de-dup) is EvieV5Core.assemble. The transcript is always shown editable;
     high-impact text (writes, payments, deletes, very long) is NEVER sent automatically.
   - Mic contention goes through EvieMic ('assistant' priority): Kisha/another owner pre-empts cleanly. */
window.EvieDictation=(()=>{
 const core=()=>window.EvieV5Core;
 let active=null;
 const headers=(extra)=>{const u=window.EvieAccounts?.current?.();return {'X-Evie-Request':'1',...(u?{'X-Evie-User':u.id}:{}),...extra};};
 function pickType(){if(!window.MediaRecorder)return '';for(const t of ['audio/webm;codecs=opus','audio/webm','audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/ogg;codecs=opus'])try{if(MediaRecorder.isTypeSupported?.(t))return t;}catch{}return '';}
 async function transcribe(blob,index,seconds,signal){let last;for(let attempt=0;attempt<3;attempt++){
   try{const res=await fetch('/api/ai/stt',{method:'POST',credentials:'same-origin',signal,headers:headers({'Content-Type':blob.type||'audio/webm','X-Evie-Duration':String(Math.ceil(seconds)),'X-Evie-Chunk':String(index),'X-Evie-Lang':sttLang}),body:blob});
    const j=await res.json().catch(()=>({}));if(res.ok)return String(j.text||'').trim();last=Object.assign(Error(j.error||'No se pudo transcribir.'),{status:res.status});if([400,401,403,413,429,503].includes(res.status))break;}
   catch(x){if(x.name==='AbortError')throw x;last=x;}
   await new Promise(r=>setTimeout(r,600*(attempt+1)));}
  throw last||Error('No se pudo transcribir.');}
 let sttLang='es';
 async function start({onUpdate=()=>{},onDone=()=>{},maxSec,lang='es'}={}){if(active)return {ok:false,error:'Ya hay un dictado en curso.'};sttLang=lang==='en'?'en':'es';
  const D=core().DICT,limit=Math.min(maxSec||D.maxTotalSec,D.chunkSec*D.maxChunks);
  if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia)return {ok:false,error:'Este navegador no puede grabar audio aquí.'};
  const st={chunks:[],texts:[],failed:[],pending:0,stopped:false,started:performance.now(),recs:[],ctl:new AbortController(),index:0,timers:[]};
  if(window.EvieMic&&!EvieMic.acquire('assistant',()=>stop(st,'preempted')))return {ok:false,error:'El micrófono está ocupado por otra función.'};
  try{st.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});}
  catch(e){window.EvieMic?.release('assistant');return {ok:false,error:['NotAllowedError','SecurityError'].includes(e?.name)?'Necesito permiso de micrófono.':'No pude abrir el micrófono.'};}
  active=st;st.onUpdate=onUpdate;st.onDone=onDone;const type=pickType();
  const emit=()=>{const a=core().assemble(st.texts);try{onUpdate({text:a.text,seconds:Math.round((performance.now()-st.started)/1000),chunks:st.index,pending:st.pending,failed:st.failed.slice(),recording:!st.stopped});}catch{}};
  st.emit=emit;
  function spawn(){if(st.stopped)return;const index=st.index++,parts=[],t0=performance.now();let mr;try{mr=new MediaRecorder(st.stream,type?{mimeType:type}:{});}catch{mr=new MediaRecorder(st.stream);}
   mr.ondataavailable=e=>{if(e.data?.size)parts.push(e.data);};
   mr.onstop=async()=>{st.recs=st.recs.filter(x=>x!==mr);const secs=(performance.now()-t0)/1000;let blob=new Blob(parts,{type:mr.mimeType||type||'audio/webm'});parts.length=0;
    if(blob.size<800){blob=null;finishCheck();return;}
    st.pending++;emit();const m0=performance.now();
    try{const text=await transcribe(blob,index,secs,st.ctl.signal);st.texts.push({index,text});window.EvieV5?.reportMetrics?.({dictation_chunk:Math.round(performance.now()-m0)});}
    catch(x){if(x.name!=='AbortError')st.failed.push(index);}
    finally{blob=null;st.pending--;emit();finishCheck();}};
   mr.start();st.recs.push(mr);
   const elapsed=(performance.now()-st.started)/1000,remain=limit-elapsed;
   const len=Math.min(D.chunkSec,Math.max(1,remain));
   if(remain>D.chunkSec)st.timers.push(setTimeout(spawn,(D.chunkSec-D.overlapSec)*1000));
   st.timers.push(setTimeout(()=>{try{mr.state!=='inactive'&&mr.stop();}catch{}if(remain<=D.chunkSec)stop(st,'limit');},len*1000));}
  function finishCheck(){if(st.stopped&&!st.recs.length&&st.pending===0&&!st.finished){st.finished=true;const a=core().assemble(st.texts);const missing=[...new Set([...a.missing,...st.failed])].sort((x,y)=>x-y);try{st.onDone({text:a.text,missing,reason:st.reason,high_impact:core().highImpact(a.text)});}catch{}}}
  st.finishCheck=finishCheck;
  spawn();emit();return {ok:true,stop:()=>stop(st,'user')};}
 function stop(st=active,reason='user'){if(!st||st.stopped)return;st.stopped=true;st.reason=reason;st.timers.forEach(clearTimeout);
  for(const mr of st.recs)try{mr.state!=='inactive'&&mr.stop();}catch{}
  st.stream?.getTracks().forEach(t=>t.stop());window.EvieMic?.release('assistant');if(active===st)active=null;
  if(reason==='cancel'){st.ctl.abort();st.finished=true;}
  st.emit?.();setTimeout(()=>st.finishCheck?.(),0);}
 const cancel=()=>stop(active,'cancel');

 /* ---------- minimal UI: live status + editable transcript ---------- */
 let box=null;
 function ui(){if(box)return box;box=document.createElement('section');box.id='evie-dictation';box.setAttribute('role','dialog');box.setAttribute('aria-label','Dictado largo');document.body.append(box);return box;}
 function open(){const b=ui();b.hidden=false;
  b.innerHTML=`<h2>Dictado largo</h2><p id="dict-status" role="status" aria-live="polite">Preparando micrófono…</p><textarea id="dict-text" rows="8" aria-label="Transcripción (editable)" readonly></textarea><p id="dict-warn" class="v5-warn"></p><div class="dict-actions"><button type="button" class="button primary" id="dict-stop">Terminar</button> <button type="button" class="button" id="dict-cancel">Cancelar</button></div>`;
  const status=b.querySelector('#dict-status'),ta=b.querySelector('#dict-text');
  b.querySelector('#dict-cancel').onclick=()=>{cancel();close();};
  start({onUpdate:u=>{status.textContent=u.recording?`Escuchando… ${Math.floor(u.seconds/60)}:${String(u.seconds%60).padStart(2,'0')} · ${u.chunks} parte${u.chunks===1?'':'s'}`:`Transcribiendo ${u.pending} parte${u.pending===1?'':'s'}…`;ta.value=u.text;},
   onDone:r=>review(r)}).then(res=>{if(!res.ok){status.textContent=res.error;b.querySelector('#dict-stop').hidden=true;return;}b.querySelector('#dict-stop').onclick=()=>res.stop();});}
 function review(r){const b=ui(),ta=b.querySelector('#dict-text'),warn=b.querySelector('#dict-warn'),status=b.querySelector('#dict-status');ta.readOnly=false;ta.value=r.text;
  status.textContent=r.text?'Revisa y corrige la transcripción antes de enviarla.':'No se obtuvo texto.';
  warn.textContent=(r.missing.length?`No pude transcribir ${r.missing.length} parte${r.missing.length>1?'s':''}; puede faltar texto. `:'')+(r.high_impact?'Contiene acciones (crear, pagar, borrar…): nada se ejecuta hasta que tú lo envíes.':'');
  b.querySelector('.dict-actions').innerHTML=`<button type="button" class="button primary" id="dict-send">Enviar a Ivi</button> <button type="button" class="button" id="dict-copy">Copiar</button> <button type="button" class="button" id="dict-close">Cerrar</button>`;
  b.querySelector('#dict-send').onclick=()=>{const v=ta.value.trim();if(!v)return;close();window.EvieAssistant?.ask?.(v,{speak:true});};
  b.querySelector('#dict-copy').onclick=()=>{navigator.clipboard?.writeText(ta.value).then(()=>window.App?.toast?.('Copiado.','success'));};
  b.querySelector('#dict-close').onclick=close;ta.focus();}
 function close(){if(box){box.hidden=true;box.innerHTML='';}}
 window.EvieAccounts?.subscribe?.(()=>{if(active)cancel();close();});
 return Object.freeze({start,stop:()=>stop(active,'user'),cancel,open,close,get active(){return !!active;}});
})();
