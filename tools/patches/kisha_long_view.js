 /* Relato largo: the transcript fills the (editable) text box segment by segment; the person reviews/corrects
    and sends it with the normal Send button. Failed parts can be retried from audio still in memory. */
 async function longTalk(){if(!session)return;const v=ensureVoice();if(v.recording()){v.stopRecording();return;}if(machine.phase==='paused')return;
  v.unlock();v.stopPlayback();abort();if(['speaking','blocked','error','greeting'].includes(machine.phase))machine.go('idle');ctl=new AbortController();const sig=ctl.signal;
  const ta=document.getElementById('kisha-text'),btn=document.querySelector('[data-kisha=long]'),st=document.getElementById('kisha-status'),base=ta?.value.trim()||'';btn?.setAttribute('aria-pressed','true');
  const fmtT=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};const fit=()=>{if(ta){ta.style.height='auto';ta.style.height=Math.min(220,ta.scrollHeight)+'px';}};
  try{const r=await v.recordLong(sig,{onPartial:p=>{if(ta){ta.value=((base?base+' ':'')+p.text).trim();fit();}},onTime:ms=>{if(st)st.textContent='Grabando relato '+fmtT(ms)+' · toca de nuevo para terminar';}});
   btn?.setAttribute('aria-pressed','false');if(sig.aborted||!session||!r)return;if(machine.phase!=='idle')machine.go('idle');
   if(ta){ta.value=((base?base+' ':'')+r.text).trim();ta.disabled=false;ta.focus();fit();}
   const mins=Math.max(1,Math.round(r.seconds/60));
   note(r.failed?`Transcribí tu relato, pero ${r.failed} parte${r.failed>1?'s':''} no se pudo transcribir.`:`Listo: transcribí ${mins} min de relato. Revísalo, corrige lo que quieras y envíalo.`,r.failed?`<button class="button" data-kisha-long-retry>${i('rotate-cw')}Reintentar esas partes</button>`:'');App.icons();
   const rb=document.querySelector('[data-kisha-long-retry]');if(rb)rb.onclick=async()=>{rb.disabled=true;const x=await r.retry();if(ta){ta.value=((base?base+' ':'')+x.text).trim();fit();}rb.remove();if(x.failed)note('Aún faltan '+x.failed+' partes. Puedes escribirlas tú.');};}
  catch(err){btn?.setAttribute('aria-pressed','false');if(sig.aborted||!session)return;if(machine.phase!=='idle'&&machine.phase!=='error')machine.go('error');note(err.message);setTimeout(()=>{if(machine?.phase==='error')machine.go('idle');},1600);ta?.focus();}}
