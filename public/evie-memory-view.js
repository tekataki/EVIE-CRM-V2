'use strict';
/* "Memoria" panel inside Configuración personalizada. Plain-Spanish controls for the account's own memory:
   switches (uploaded only on "Guardar ajustes de memoria"), remembered items (edit, delete, source + date,
   open source conversation), saved conversation summaries (delete, with offer to delete derived memories),
   export JSON and permanent wipe. Sensitive items waiting for review show an explicit confirm button. */
window.EvieMemoryView=(()=>{
 const e=s=>Domain.escape(String(s??''));
 let root=null,data=null,busy=false;
 const day=ms=>{try{return new Intl.DateTimeFormat('es-MX',{timeZone:data?.settings?.timezone||'America/Mexico_City',day:'numeric',month:'short',year:'numeric'}).format(new Date(ms));}catch{return '';}};
 const SW=[
  ['enabled','Memoria de Ivi activada','Si la apagas, Ivi no guarda ni usa recuerdos ni conversaciones pasadas.'],
  ['use_memories','Usar lo que le pedí recordar','Ivi consulta solo los recuerdos relevantes a cada pregunta (unos pocos, nunca todos).'],
  ['save_history','Guardar resúmenes de mis conversaciones','Guarda tus preguntas (máx. 6 por conversación) para poder preguntar «¿qué te pregunté ayer?». No guarda audio, ni Kisha, ni el modo privado.'],
  ['reference_history','Permitir que Ivi consulte esas conversaciones','Solo cuando preguntas por una conversación pasada; como mucho 2 por respuesta.'],
  ['allow_health','Recordar datos de salud','Desactivado por defecto. Aun activado, cada dato de salud se confirma en pantalla antes de guardarse.'],
  ['allow_emotional','Recordar temas emocionales','Desactivado por defecto. Kisha nunca crea recuerdos automáticamente.']];
 function mount(host){root=host;if(!root)return;if(!window.EvieMemory?.cloud?.()){root.innerHTML=`<p class="mem-off">${Views.icon('cloud-off')} La memoria de Ivi se guarda en tu cuenta EVIE. Inicia sesión con tu cuenta para usarla. En modo local no se guarda nada.</p>`;return;}
  root.innerHTML='<p class="mem-loading">Cargando tu memoria…</p>';reload();}
 async function reload(){if(!root?.isConnected||busy)return;const r=await EvieMemory.load(true);if(!root?.isConnected)return;if(!r?.memories){root.innerHTML='<p class="mem-off">No se pudo cargar la memoria. Revisa tu conexión; nada se perdió.</p>';return;}data=r;
  const f=root.querySelector('#mem-settings');if(f&&f.contains(document.activeElement)&&window.FormSafety?.busy?.()){renderLists();return;}render();}
 function render(){const st=data.settings,pend=EvieMemory.pendingSensitive();
  root.innerHTML=`<form id="mem-settings" class="mem-settings" data-draft-manual>
    <div class="mem-switches">${SW.map(([k,l,h])=>`<label class="evp-switch"><input type="checkbox" name="${k}" ${st[k]?'checked':''} ${k!=='enabled'&&!st.enabled?'disabled':''}><span><strong>${e(l)}</strong><small>${e(h)}</small></span></label>`).join('')}</div>
    <div class="evp-actions"><button class="button primary" type="submit">Guardar ajustes de memoria</button><button class="button" type="button" data-memory-private="${EvieMemory.isPrivate()?'off':'on'}">${EvieMemory.isPrivate()?'Salir del modo privado':'Empezar conversación privada'}</button></div>
    <p class="evp-hint">Dile a Ivi «recuerda que…» u «olvida…». Lo que digas en una conversación privada no se guarda ni aparece después.</p>
   </form>
   ${pend?`<div class="mem-pending" role="group" aria-label="Recuerdo sensible por confirmar"><p><strong>¿Guardar este dato sensible?</strong> «${e(pend)}»</p><div class="toolbar"><button class="button primary" type="button" data-mem="confirm-sensitive">Sí, recordarlo</button><button class="button" type="button" data-mem="drop-sensitive">No guardar</button></div></div>`:''}
   <div id="mem-lists"></div>
   <div class="evp-actions mem-danger"><button class="button" type="button" data-mem="export">Exportar mi memoria (JSON)</button><button class="button danger" type="button" data-mem="wipe">Borrar toda mi memoria</button></div>`;
  renderLists();
  const form=root.querySelector('#mem-settings');form.elements.enabled.addEventListener('change',()=>{for(const el of form.elements)if(el.type==='checkbox'&&el.name!=='enabled')el.disabled=!form.elements.enabled.checked;});
  form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;const o={};for(const el of form.elements)if(el.type==='checkbox')o[el.name]=el.checked;
   try{const r=await EvieMemory.request('settings',{method:'PUT',body:{settings:o}});data.settings=r.settings;FormSafety.cleanPage(form);App.toast('Ajustes de memoria guardados.','success');render();}catch(err){App.toast(err.message||'No se pudo guardar.','error');}finally{b.disabled=false;}};}
 function renderLists(){const host=root.querySelector('#mem-lists');if(!host)return;const ms=data.memories||[],ss=data.sessions||[];
  host.innerHTML=`<section class="mem-block" aria-labelledby="mem-h1"><h4 id="mem-h1">Lo que Ivi recuerda <span class="mem-count">${ms.length}</span></h4>
    ${ms.length?`<ul class="mem-list">${ms.map(m=>`<li class="mem-item" data-id="${e(m.id)}"><div class="mem-text"><p>${e(m.text)}</p><small>${m.category!=='general'?`<span class="mem-tag">${e({health:'Salud',emotional:'Emocional'}[m.category]||m.category)}</span> `:''}${m.source==='conversation'?'De una conversación':'Me lo pediste'} · ${e(day(m.updated_at))}${m.source_session&&ss.some(s=>s.id===m.source_session)?` · <button type="button" class="linklike" data-mem="open-session" data-sid="${e(m.source_session)}">ver conversación</button>`:''}</small></div>
      <div class="mem-row-actions"><button type="button" class="icon-button" data-mem="edit" aria-label="Corregir recuerdo">${Views.icon('pencil')}</button><button type="button" class="icon-button" data-mem="del" aria-label="Olvidar este recuerdo">${Views.icon('trash-2')}</button></div></li>`).join('')}</ul>`:'<p class="evp-hint">Aún no hay recuerdos. Prueba: «Ivi, recuerda que prefiero respuestas cortas».</p>'}
   </section>
   <section class="mem-block" aria-labelledby="mem-h2"><h4 id="mem-h2">Conversaciones guardadas <span class="mem-count">${ss.length}</span></h4>
    ${data.settings.save_history?'':'<p class="evp-hint">Desactivado: Ivi no guarda tus conversaciones.</p>'}
    ${ss.length?`<ul class="mem-list">${ss.slice(0,30).map(s=>`<li class="mem-item" id="mem-s-${e(s.id)}"><div class="mem-text"><p>${s.questions.map(q=>'«'+e(q)+'»').join(' · ')}</p><small>${e(day(s.started_at))}</small></div><div class="mem-row-actions"><button type="button" class="icon-button" data-mem="del-session" data-sid="${e(s.id)}" aria-label="Borrar esta conversación">${Views.icon('trash-2')}</button></div></li>`).join('')}</ul>`:''}
   </section>`;window.lucide?.createIcons?.({root:host});}
 async function act(b){const a=b.dataset.mem,li=b.closest('.mem-item'),id=li?.dataset.id;busy=true;try{
  if(a==='del'){await EvieMemory.request('items/'+encodeURIComponent(id),{method:'DELETE'});data.memories=data.memories.filter(m=>m.id!==id);App.toast('Recuerdo olvidado.','success');renderLists();}
  else if(a==='edit'){const m=data.memories.find(x=>x.id===id);const t=prompt('Corrige el recuerdo:',m.text);if(t&&t.trim()&&t.trim()!==m.text){const r=await EvieMemory.request('items/'+encodeURIComponent(id),{method:'PATCH',body:{text:t.trim()}});m.text=r.text;m.updated_at=Date.now();renderLists();App.toast('Recuerdo corregido.','success');}}
  else if(a==='open-session'){const el=root.querySelector('#mem-s-'+CSS.escape(b.dataset.sid));el?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});el?.classList.add('mem-flash');setTimeout(()=>el?.classList.remove('mem-flash'),1600);}
  else if(a==='del-session'){if(!confirm('¿Borrar esta conversación guardada? Se borra también su resumen y su índice de búsqueda.'))return;const r=await EvieMemory.request('sessions/'+encodeURIComponent(b.dataset.sid),{method:'DELETE'});data.sessions=data.sessions.filter(s=>s.id!==b.dataset.sid);
   if(r.derived_memories?.length&&confirm(`Hay ${r.derived_memories.length} recuerdo(s) que salieron de esa conversación. ¿Borrarlos también?`)){for(const mid of r.derived_memories)await EvieMemory.request('items/'+encodeURIComponent(mid),{method:'DELETE'});data.memories=data.memories.filter(m=>!r.derived_memories.includes(m.id));}renderLists();App.toast('Conversación borrada.','success');}
  else if(a==='export'){const j=await EvieMemory.request('export');const blob=new Blob([JSON.stringify(j,null,2)],{type:'application/json'});const x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download='evie-memoria.json';x.click();setTimeout(()=>URL.revokeObjectURL(x.href),1000);}
  else if(a==='wipe'){if(!confirm('¿Borrar para siempre toda tu memoria de Ivi (recuerdos, conversaciones guardadas y ajustes)? No se puede deshacer. Tus registros del CRM no se tocan.'))return;await EvieMemory.request('',{method:'DELETE'});App.toast('Memoria borrada por completo.','success');busy=false;await reload();}
  else if(a==='confirm-sensitive'){const t=EvieMemory.pendingSensitive();const r=await EvieMemory.remember(t,{confirm:true});EvieMemory.clearPending();App.toast(r.say||'Guardado.',r.error?'error':'success');busy=false;await reload();}
  else if(a==='drop-sensitive'){EvieMemory.clearPending();render();}
 }catch(err){App.toast(err.message||'No se pudo completar.','error');}finally{busy=false;}}
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-mem]');if(b&&root?.contains(b))act(b);});
 return Object.freeze({mount,reload});
})();
