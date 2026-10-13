'use strict';
/* Automatizaciones UI + opener.
   Opening rules (honest by design):
   - Manual "Abrir" is a real <a target=_blank rel=noopener> inside the user's click: always works.
   - Voice: the answer arrives after the network, outside the user gesture, so the browser may block a
     new tab. We try ONCE with window.open(...,'noopener'); with noopener browsers return null even on
     success, so EVIE says "intenté abrirla" and the HUD card keeps a big "Abrir" link.
     Never retries, never navigates the CRM tab away.
   - Windows app: validated desktop bridge (open_url → shell.openExternal in the normal browser). */
window.EvieAutomationsView=(()=>{
 const e=s=>Domain.escape(String(s??'')),i=n=>Views.icon(n),A=()=>window.EvieAutomations;
 let editing=null,query='';
 const list=()=>Store.list('automations').sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
 const desktop=()=>typeof window.evieDesktop?.desktop==='function'&&window.evieDesktop.platform==='win32';
 function card(r){return `<article class="auto-card" data-auto="${e(r.id)}"><header><span class="auto-fav" aria-hidden="true">${e((r.name||'?').trim().charAt(0).toUpperCase())}</span><div><h3>${e(r.name)}</h3><p class="auto-domain">${i('globe')}<span>${e(r.domain)}</span></p></div></header>${r.description?`<p class="auto-desc">${e(r.description)}</p>`:''}${r.aliases?.length?`<p class="auto-aliases"><span>Dile a Ivi:</span> ${r.aliases.slice(0,4).map(a=>`<q>${e(a)}</q>`).join(' ')}</p>`:''}<footer><a class="button primary auto-open" href="${e(r.url)}" target="_blank" rel="noopener noreferrer" data-auto-open="${e(r.id)}">${i('external-link')} Abrir</a><button type="button" class="button" data-auto-edit="${e(r.id)}" aria-label="Editar ${e(r.name)}">${i('pencil')} Editar</button><button type="button" class="icon-button" data-auto-del="${e(r.id)}" aria-label="Eliminar ${e(r.name)}" title="Eliminar">${i('trash-2')}</button></footer></article>`;}
 function form(r){const L=A().limits;return `<form class="auto-form panel" id="auto-form" novalidate><h2>${r?'Editar automatización':'Nueva automatización'}</h2>
  <div class="auto-grid"><label>Nombre<input class="input" name="name" required maxlength="${L.MAX_NAME}" value="${e(r?.name||'')}" placeholder="Página de SOMA" autocomplete="off"></label>
  <label>Dirección del sitio<input class="input" name="url" required inputmode="url" maxlength="${L.MAX_URL}" value="${e(r?.url||'')}" placeholder="https://…" autocomplete="off" spellcheck="false"></label></div>
  <label>Descripción <small>(opcional)</small><input class="input" name="description" maxlength="${L.MAX_DESC}" value="${e(r?.description||'')}" placeholder="Para qué la usas"></label>
  <label>Frases para Ivi <small>(opcional, separadas por coma)</small><input class="input" name="aliases" maxlength="500" value="${e((r?.aliases||[]).join(', '))}" placeholder="web de SOMA, sitio de SOMA"></label>
  <p class="auto-help">${i('info')} Solo sitios web (http/https). EVIE abre la página en tu navegador; no inicia sesión por ti ni ejecuta tareas en segundo plano.</p>
  <p class="form-error" id="auto-error" role="alert"></p>
  <div class="toolbar"><button class="button primary" type="submit">${i('check')} ${r?'Guardar cambios':'Guardar'}</button><button class="button" type="button" data-auto-cancel>Cancelar</button></div></form>`;}
 function render(){const rows=list(),q=A().norm(query),shown=q?rows.filter(r=>A().norm([r.name,r.domain,r.description,...(r.aliases||[])].join(' ')).includes(q)):rows;
  return `${Views.heading('Automatizaciones','Tus atajos a sitios web. Dile «Ivi, abre la página de…» y EVIE la abre.',`<button class="button primary" type="button" data-auto-new>${i('plus')} Agregar automatización</button>`,'HERRAMIENTAS')}
  <section class="auto-page" id="automations-page">${editing!==null?form(editing==='new'?null:rows.find(r=>r.id===editing)):''}
  ${rows.length?`<div class="auto-search"><label class="sr-only" for="auto-q">Buscar automatizaciones</label>${i('search')}<input class="input" id="auto-q" type="search" placeholder="Buscar por nombre, sitio o frase" value="${e(query)}" autocomplete="off"><small>${shown.length} de ${rows.length}</small></div>`:''}
  ${shown.length?`<div class="auto-cards">${shown.map(card).join('')}</div>`:rows.length?`<p class="auto-empty">Ninguna coincide con «${e(query)}».</p>`:editing!==null?'':`<div class="auto-empty-state panel">${i('zap')}<h2>Crea tu primer atajo</h2><p>Por ejemplo «Página de SOMA» con la dirección real de tu sitio. Luego di «Ivi, abre la página de SOMA».</p><button class="button primary" type="button" data-auto-new>${i('plus')} Agregar automatización</button></div>`}</section>`;}
 function refresh(){if(UI.section==='automatizaciones')App.render();}
 function save(f){const err=f.querySelector('#auto-error');err.textContent='';
  try{const data={name:f.elements.name.value,url:f.elements.url.value,description:f.elements.description.value,aliases:f.elements.aliases.value};
   const prev=editing&&editing!=='new'?Store.list('automations').find(r=>r.id===editing):null;const rec=A().build(data,prev);
   const dup=Store.list('automations').find(r=>r.id!==prev?.id&&A().norm(r.name)===A().norm(rec.name));if(dup)throw Error('Ya tienes una automatización llamada «'+dup.name+'».');
   Store.save(s=>{if(prev){const x=s.automations.find(r=>r.id===prev.id);Object.assign(x,rec);}else s.automations.push({...rec,id:crypto.randomUUID()});});
   editing=null;window.EvieSounds?.play('success');App.toast(prev?'Automatización actualizada.':'Automatización guardada. Dile «Ivi, abre '+rec.name+'».','success');refresh();}
  catch(x){err.textContent=x.message;window.EvieSounds?.play('error');f.querySelector('[name=url]')?.setAttribute('aria-invalid',/direcci|sitio|http/i.test(x.message)?'true':'false');}}
 function markOpened(id){try{Store.save(s=>{const r=s.automations.find(x=>x.id===id);if(r){r.opened_count=(r.opened_count||0)+1;r.last_opened_at=new Date().toISOString();r.updated_at=r.last_opened_at;}});}catch{}}
 /* Programmatic open (voice/tool). Returns an honest status: opened_desktop | opened | attempted | error. */
 async function openShortcut(r){if(!r)return {ok:false,status:'not_found'};
  let url;try{url=A().normalizeUrl(r.url);}catch(x){return {ok:false,status:'invalid',error:x.message};}
  if(desktop()){try{const res=await window.evieDesktop.desktop({action:'open_url',url});if(res?.ok){markOpened(r.id);window.EvieSounds?.play('open');return {ok:true,status:'opened_desktop',note:'Se abrió en tu navegador predeterminado.'};}return {ok:false,status:'desktop_error',error:res?.error||'Windows no abrió el sitio.'};}catch(x){return {ok:false,status:'desktop_error',error:x.message};}}
  let w=null;try{w=window.open(url,'_blank','noopener,noreferrer');}catch{w=null;}
  markOpened(r.id);window.EvieSounds?.play('open');
  return w?{ok:true,status:'opened',note:'Abierta en una pestaña nueva.'}:{ok:true,status:'attempted',note:'Intenté abrirla en una pestaña nueva. Si tu navegador la bloqueó, toca «Abrir».'};}
 document.addEventListener('click',ev=>{const t=ev.target.closest('[data-auto-new],[data-auto-edit],[data-auto-del],[data-auto-cancel],[data-auto-open]');if(!t)return;
  if(t.dataset.autoOpen){const r=Store.list('automations').find(x=>x.id===t.dataset.autoOpen);if(!r){ev.preventDefault();return;}if(desktop()){ev.preventDefault();openShortcut(r).then(x=>{if(!x.ok)App.toast(x.error||'No se pudo abrir.','error');});}else{markOpened(r.id);window.EvieSounds?.play('open');}return;}
  if(t.dataset.autoNew!==undefined){editing='new';refresh();setTimeout(()=>document.querySelector('#auto-form [name=name]')?.focus(),60);}
  else if(t.dataset.autoEdit){editing=t.dataset.autoEdit;refresh();setTimeout(()=>document.querySelector('#auto-form [name=name]')?.focus(),60);}
  else if(t.dataset.autoCancel!==undefined){editing=null;refresh();}
  else if(t.dataset.autoDel){const r=Store.list('automations').find(x=>x.id===t.dataset.autoDel);if(!r)return;App.confirmAction('¿Eliminar «'+r.name+'»?','Solo se borra el atajo; el sitio web no cambia.',()=>{Store.save(s=>{const x=s.automations.find(y=>y.id===r.id);x.deleted_at=new Date().toISOString();x.updated_at=x.deleted_at;});window.EvieSounds?.play('close');App.toast('Automatización eliminada.','success');refresh();},'Eliminar');}});
 document.addEventListener('submit',ev=>{if(ev.target.id!=='auto-form')return;ev.preventDefault();save(ev.target);});
 document.addEventListener('input',ev=>{if(ev.target.id!=='auto-q')return;query=ev.target.value;const pos=ev.target.selectionStart;App.render();const n=document.getElementById('auto-q');if(n){n.focus();n.setSelectionRange(pos,pos);}});
 function reset(){editing=null;query='';}
 return Object.freeze({render,openShortcut,reset,list});
})();
