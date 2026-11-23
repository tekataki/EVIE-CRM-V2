'use strict';
/* Automatizaciones UI + opener. Two tabs: «Atajos web» (website shortcuts) and «Prompts» (prompt library).
   Opening rules (honest by design):
   - Manual "Abrir" is a real <a target=_blank rel=noopener> inside the user's click: always works.
   - Voice: the answer arrives after the network, outside the user gesture, so the browser may block a
     new tab. We try ONCE with window.open(...,'noopener'); with noopener browsers return null even on
     success, so EVIE says "intenté abrirla" and the HUD card keeps a big "Abrir" link.
     Never retries, never navigates the CRM tab away.
   - Windows app: validated desktop bridge (open_url → shell.openExternal in the normal browser).
   Prompts: the logic lives in evie-prompts.js (window.EviePrompts, looked up lazily so script order does not
   matter); records are Store.get().preferences.promptLibrary (synced in the account's state row, NOT a Store
   collection). #automatizaciones/prompts opens the Prompts tab, #automatizaciones/atajos the shortcuts and plain
   #automatizaciones the last tab used on this device. «Copiar» = navigator.clipboard.writeText with a hidden
   textarea + execCommand fallback. Search and tag chips repaint only the results, so the search box keeps focus. */
window.EvieAutomationsView=(()=>{
 const e=s=>Domain.escape(String(s??'')),i=n=>Views.icon(n),A=()=>window.EvieAutomations,P=()=>window.EviePrompts;
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

 /* ---------- tabs: route #automatizaciones/<tab>; the last tab is remembered per device ---------- */
 const TABS=[['atajos','globe','Atajos web'],['prompts','message-square-text','Prompts']];
 const tabKey=()=>(window.DALI_CONFIG?.storageKey||'evie')+'-automatizaciones-tab';
 function storedTab(){try{const v=localStorage.getItem(tabKey());return v==='prompts'||v==='atajos'?v:null;}catch{return null;}}
 function rememberTab(t){try{if(localStorage.getItem(tabKey())!==t)localStorage.setItem(tabKey(),t);}catch{}}
 function currentTab(){const id=String(window.UI?.id||'').toLowerCase();if(id==='prompts')return 'prompts';if(id==='atajos'||id==='web')return 'atajos';return storedTab()||'atajos';}
 function tabs(t){const n={atajos:Store.list('automations').length,prompts:P()?P().list(Store.get()).length:0};
  return `<div class="tabs pl-tabs" role="tablist" aria-label="Secciones de Automatizaciones">${TABS.map(([k,ico,label])=>{const on=k===t;return `<a class="pl-tab" role="tab" id="auto-tab-${k}" href="#automatizaciones/${k}" data-auto-tab="${k}" aria-selected="${on}"${on?` aria-controls="${k==='prompts'?'prompts-page':'automations-page'}"`:''} tabindex="${on?0:-1}">${i(ico)}<span>${label}</span>${n[k]?`<span class="pl-tab-n">${n[k]}</span>`:''}</a>`;}).join('')}</div>`;}
 function render(){const t=currentTab();rememberTab(t);schedule();return t==='prompts'?renderPrompts():renderShortcuts();}
 function renderShortcuts(){const rows=list(),q=A().norm(query),shown=q?rows.filter(r=>A().norm([r.name,r.domain,r.description,...(r.aliases||[])].join(' ')).includes(q)):rows;
  return `${Views.heading('Automatizaciones','Tus atajos a sitios web. Dile «Ivi, abre la página de…» y EVIE la abre.',`<button class="button primary" type="button" data-auto-new>${i('plus')} Agregar automatización</button>`,'HERRAMIENTAS')}${tabs('atajos')}
  <section class="auto-page" id="automations-page" role="tabpanel" aria-labelledby="auto-tab-atajos">${editing!==null?form(editing==='new'?null:rows.find(r=>r.id===editing)):''}
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
 document.addEventListener('submit',ev=>{if(ev.target.id==='prompt-form'){ev.preventDefault();savePrompt(ev.target);return;}if(ev.target.id!=='auto-form')return;ev.preventDefault();save(ev.target);});
 document.addEventListener('input',ev=>{const t=ev.target;
  if(t.id==='prompt-q'){PS.query=String(t.value||'').slice(0,200);clearTimeout(searchTimer);searchTimer=setTimeout(paintResults,90);return;}
  const pf=t.closest?.('#prompt-form');if(pf){updateCounter(pf);return;}
  if(t.id!=='auto-q')return;query=t.value;const pos=t.selectionStart;App.render();const n=document.getElementById('auto-q');if(n){n.focus();n.setSelectionRange(pos,pos);}});

 /* ---------- Prompts tab ---------- */
 const PS={editing:null,query:'',tag:'',open:new Set(),copied:null,flash:null,focus:null,formIn:false};let searchTimer=0;
 const sound=n=>{try{window.EvieSounds?.play?.(n);}catch{}};
 const reduced=()=>{try{const fx=window.EvieFX?.reduced;return typeof fx==='function'?!!fx():matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}};
 const sel=s=>window.CSS?.escape?CSS.escape(String(s)):String(s).replace(/[^A-Za-z0-9_-]/g,'\\$&');
 const setLib=(s,lib)=>{s.preferences.promptLibrary=lib;};
 const findPrompt=id=>P()?P().list(Store.get()).find(r=>r.id===id)||null:null;
 const short=(s,n=48)=>{const a=[...String(s||'')];return a.length>n?a.slice(0,n-1).join('').trimEnd()+'…':a.join('');};
 const canPaste=()=>{try{return typeof navigator.clipboard?.readText==='function';}catch{return false;}};
 const countText=(n,total)=>n===total?`${total} ${total===1?'prompt':'prompts'}`:`${n} de ${total}`;
 const counterText=n=>`${P().num(n)} / ${P().num(P().limits.MAX_BODY)}`;
 const counterCls=n=>{const M=P().limits.MAX_BODY;return n>M?' is-over':n>M*.9?' is-near':'';};
 function friendly(x){if(x&&(x.name==='QuotaExceededError'||/quota/i.test(String(x.message))))return 'No hay espacio en este dispositivo para guardar más. Borra prompts que ya no uses o acorta este.';return x?.message||'No se pudo guardar. Inténtalo de nuevo.';}
 /** Run fn now, or after the person confirms discarding an unsaved draft (FormSafety's dialog). */
 function guard(fn){if(typeof window.FormSafety?.request==='function')FormSafety.request(fn);else fn();}
 function renderPrompts(){const L=P();
  const head=Views.heading('Automatizaciones','Guarda tus prompts con nombre y cópialos completos con un toque. Dile «Ivi, abre mis prompts».',`<button class="button primary" type="button" data-prompt-new>${i('plus')} Nuevo prompt</button>`,'HERRAMIENTAS');
  const wrap=html=>`${head}${tabs('prompts')}<section class="pl-page" id="prompts-page" role="tabpanel" aria-labelledby="auto-tab-prompts">${html}</section>`;
  if(!L)return wrap('<p class="auto-empty">La biblioteca de prompts no se cargó. Recarga la página para usarla.</p>');
  const all=L.list(Store.get());
  if(PS.editing&&PS.editing!=='new'&&!all.some(r=>r.id===PS.editing))PS.editing=null;
  if(PS.tag&&!all.some(r=>L.norm(r.tag)===PS.tag))PS.tag='';
  const f=PS.editing!==null?promptForm(PS.editing==='new'?null:all.find(r=>r.id===PS.editing),all):'';
  if(!all.length)return wrap(f+(PS.editing!==null?'':emptyPrompts()));
  const shown=L.search(all,PS.query,PS.tag);
  return wrap(`${f}${tools(all,shown)}<div class="pl-results" id="pl-results">${results(all,shown)}</div>`);}
 function emptyPrompts(){return `<div class="auto-empty-state pl-empty panel">${i('message-square-text')}<h2>Tu biblioteca de prompts</h2><p>Guarda aquí los prompts que usas seguido, como «Prompt para backend de SOMA», y cópialos completos con un solo toque cuando los necesites.</p><button class="button primary" type="button" data-prompt-new>${i('plus')} Guardar mi primer prompt</button></div>`;}
 const chip=(key,label,n)=>`<button type="button" class="pl-chip v8-press" data-prompt-tag="${e(key)}" aria-pressed="${PS.tag===key}"><b>${e(label)}</b><span>${n}</span></button>`;
 function tools(all,shown){const tg=P().tags(all);
  return `<div class="pl-tools"><div class="auto-search pl-search" role="search"><label class="sr-only" for="prompt-q">Buscar prompts</label>${i('search')}<input class="input" id="prompt-q" type="search" placeholder="Buscar por nombre, etiqueta o texto" value="${e(PS.query)}" autocomplete="off" spellcheck="false" enterkeyhint="search"><small id="pl-count">${countText(shown.length,all.length)}</small></div>${tg.length?`<div class="pl-filters" id="pl-filters" role="group" aria-label="Filtrar por etiqueta">${chip('','Todos',all.length)}${tg.map(t=>chip(t.key,t.label,t.count)).join('')}</div>`:''}</div>`;}
 function results(all,shown){if(shown.length)return `<div class="pl-cards">${shown.map(r=>promptCard(r)).join('')}</div>`;
  const tag=PS.tag?P().tags(all).find(t=>t.key===PS.tag)?.label||'':'',q=PS.query.trim();
  const what=q&&tag?`«${e(q)}» en ${e(tag)}`:q?`«${e(q)}»`:tag?`la etiqueta ${e(tag)}`:'tu búsqueda';
  return `<div class="pl-none panel">${i('search-x')}<p>Ningún prompt coincide con ${what}.</p><button type="button" class="button" data-prompt-clear>${i('eraser')} Limpiar búsqueda</button></div>`;}
 function meta(r){const L=P(),parts=[`${L.num(r.body.length)} caracteres`,`Actualizado ${L.when(r.updated_at||r.created_at)}`];if(r.copies)parts.push(`Copiado ${L.times(r.copies)}`);return parts.map(x=>e(x)).join(' · ');}
 function promptCard(r){const pv=P().preview(r.body),open=PS.open.has(r.id),id=e(r.id),nm=e(r.name),fold=pv.fold;
  const body=open?r.body:pv.text,state=fold?(open?' is-open':' is-collapsed'):'',full=open||!pv.truncated;
  return `<article class="pl-card v8-card${r.pinned?' is-pinned':''}" data-prompt="${id}" aria-labelledby="pl-name-${id}">
<header class="pl-head"><div class="pl-title">${r.pinned||r.tag?`<p class="pl-badges">${r.pinned?`<span class="pl-badge pl-badge-pin">${i('pin')}Fijado</span>`:''}${r.tag?`<span class="pl-badge">${i('tag')}${e(r.tag)}</span>`:''}</p>`:''}<h3 id="pl-name-${id}">${nm}</h3><p class="pl-meta">${meta(r)}</p></div>
<button type="button" class="button primary pl-copy${PS.copied?.id===r.id?' is-copied':''}" data-prompt-copy="${id}" aria-label="Copiar «${nm}»"><span class="pl-copy-idle">${i('copy')}Copiar</span><span class="pl-copy-done" aria-hidden="true">${i('check')}¡Copiado!</span></button></header>
<div class="pl-body${state}" id="pl-body-${id}"${fold&&!open&&!pv.truncated?' data-fit':''}><div class="pl-pre"${full?' data-full="1"':''}${open?' tabindex="0" role="region" aria-label="Prompt completo"':''}>${e(body)}</div></div>
${fold?`<button type="button" class="pl-more v8-press" data-prompt-more="${id}" aria-expanded="${open}" aria-controls="pl-body-${id}">${i('chevron-down')}<span>${open?'Ver menos':'Ver completo'}</span></button>`:''}
${r.notes?`<p class="pl-notes">${i('sticky-note')}<span>${e(r.notes)}</span></p>`:''}
<footer class="pl-actions"><button type="button" class="button" data-prompt-edit="${id}" aria-label="Editar «${nm}»">${i('pencil')}<span>Editar</span></button><button type="button" class="button" data-prompt-dup="${id}" aria-label="Duplicar «${nm}»">${i('copy-plus')}<span class="pl-lbl">Duplicar</span></button><button type="button" class="icon-button" data-prompt-pin="${id}" aria-pressed="${r.pinned===true}" aria-label="Fijar arriba «${nm}»" title="${r.pinned?'Desfijar':'Fijar arriba'}">${i(r.pinned?'pin-off':'pin')}</button><button type="button" class="icon-button pl-del" data-prompt-del="${id}" aria-label="Eliminar «${nm}»" title="Eliminar">${i('trash-2')}</button></footer></article>`;}
 function promptForm(r,all){const L=P(),M=L.limits,sug=L.suggestions(all),n=(r?.body||'').length;
  return `<form class="auto-form pl-form panel" id="prompt-form" novalidate data-draft-manual autocomplete="off"><h2>${r?'Editar prompt':'Nuevo prompt'}</h2>
<div class="auto-grid"><label>Nombre<input class="input" name="name" required maxlength="${M.MAX_NAME}" value="${e(r?.name||'')}" placeholder="Prompt para backend de SOMA" autocomplete="off" enterkeyhint="next"></label>
<div class="pl-tag-field"><label>Etiqueta o proyecto <small>(opcional)</small><input class="input" name="tag" maxlength="${M.MAX_TAG}" value="${e(r?.tag||'')}" placeholder="SOMA, Escuela, Personal…" list="pl-tag-list" autocomplete="off" enterkeyhint="next"></label>${sug.length?`<div class="pl-suggest" role="group" aria-label="Etiquetas sugeridas">${sug.slice(0,6).map(t=>`<button type="button" class="pl-chip pl-chip-sm v8-press" data-prompt-tagpick="${e(t)}">${e(t)}</button>`).join('')}</div>`:''}</div></div>
<datalist id="pl-tag-list">${sug.map(t=>`<option value="${e(t)}"></option>`).join('')}</datalist>
<div class="pl-field"><div class="pl-label-row"><label for="pl-body-input">Texto del prompt</label><span class="pl-label-tools">${canPaste()?`<button type="button" class="pl-paste v8-press" data-prompt-paste>${i('clipboard-paste')}Pegar</button>`:''}<small class="pl-counter${counterCls(n)}" id="pl-body-count">${counterText(n)}</small></span></div>
<textarea class="pl-body-input" id="pl-body-input" name="body" required rows="12" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="pl-body-count" placeholder="Pega aquí el prompt completo…">\n${e(r?.body||'')}</textarea></div>
<label>Notas <small>(opcional)</small><textarea name="notes" rows="2" maxlength="${M.MAX_NOTES}" placeholder="Para qué lo usas o con qué IA funciona mejor">\n${e(r?.notes||'')}</textarea></label>
<p class="form-error" id="prompt-error" role="alert"></p>
<div class="toolbar"><button class="button primary" type="submit">${i('check')} ${r?'Guardar cambios':'Guardar prompt'}</button><button class="button" type="button" data-prompt-cancel>Cancelar</button></div></form>`;}
 function updateCounter(f){const L=P(),ta=f.elements?.body,c=f.querySelector('#pl-body-count');if(!L||!ta||!c)return;const n=ta.value.length;
  c.textContent=counterText(n);c.className='pl-counter'+counterCls(n);if(ta.getAttribute('aria-invalid')==='true'&&n&&n<=L.limits.MAX_BODY)ta.removeAttribute('aria-invalid');}
 function openForm(id){guard(()=>{PS.editing=id;PS.formIn=true;refresh();});}
 function closeForm(){guard(()=>{PS.editing=null;refresh();});}
 function savePrompt(f){const L=P(),err=f.querySelector('#prompt-error');if(!L||!err)return;err.textContent='';f.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));
  const data={name:f.elements.name.value,tag:f.elements.tag.value,body:f.elements.body.value,notes:f.elements.notes.value},prevId=PS.editing&&PS.editing!=='new'?PS.editing:null;let saved=null;
  try{Store.save(s=>{const lib=L.list(s),prev=prevId?lib.find(x=>x.id===prevId):null;if(prevId&&!prev)throw Error('Este prompt ya no existe; quizá lo borraste en otro dispositivo.');saved=L.build(data,prev);setLib(s,L.upsert(lib,saved));});}
  catch(x){err.textContent=friendly(x);sound('error');const fld=x?.field?f.elements[x.field]:null;if(fld){fld.setAttribute('aria-invalid','true');try{fld.focus();}catch{}}return;}
  window.FormSafety?.cleanPage?.(f);PS.editing=null;PS.flash=saved.id;if(!L.search([saved],PS.query,PS.tag).length){PS.query='';PS.tag='';}
  sound('success');App.toast(prevId?'Cambios guardados.':'Prompt guardado. Toca «Copiar» cuando lo necesites.','success');refresh();}
 /* Clipboard: the async API first; if it is missing or refused, a hidden textarea + execCommand (still inside the tap). */
 async function copyText(text){try{if(window.isSecureContext!==false&&typeof navigator.clipboard?.writeText==='function'){await navigator.clipboard.writeText(text);return true;}}catch{}return legacyCopy(text);}
 function legacyCopy(text){let ta=null;const active=document.activeElement,s=document.getSelection?.(),ranges=[];
  try{if(s)for(let k=0;k<s.rangeCount;k++)ranges.push(s.getRangeAt(k));
   ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.setAttribute('aria-hidden','true');ta.tabIndex=-1;
   ta.style.cssText='position:fixed;top:0;left:0;width:2px;height:2px;margin:0;padding:0;border:0;opacity:0;pointer-events:none;font-size:16px;z-index:-1';
   document.body.append(ta);ta.focus({preventScroll:true});ta.select();ta.setSelectionRange(0,ta.value.length);
   return document.execCommand('copy')===true;}
  catch{return false;}
  finally{ta?.remove();try{if(s&&ranges.length){s.removeAllRanges();ranges.forEach(r=>s.addRange(r));}}catch{}try{active?.focus?.({preventScroll:true});}catch{}}}
 let copyTimer=0;
 function showCopied(id){clearTimeout(copyTimer);document.querySelectorAll('.pl-copy.is-copied').forEach(b=>b.classList.remove('is-copied'));PS.copied={id};
  const b=document.querySelector(`[data-prompt-copy="${sel(id)}"]`);if(b){b.classList.add('is-copied');pop(b);flash(b.closest('[data-prompt]')?.querySelector('.pl-body'));}
  copyTimer=setTimeout(()=>{PS.copied=null;document.querySelectorAll('.pl-copy.is-copied').forEach(x=>x.classList.remove('is-copied'));},1600);}
 async function copyPrompt(id){const L=P(),r=findPrompt(id);if(!L||!r){App.toast('Ese prompt ya no existe.','error');return;}
  if(!await copyText(r.body)){sound('error');App.toast('No pude copiar automáticamente. Abre «Ver completo», mantén presionado el texto y elige «Copiar».','error');return;}
  showCopied(id);
  try{Store.save(s=>setLib(s,L.markCopied(L.list(s),id)));}catch{}
  const fresh=findPrompt(id),m=document.querySelector(`[data-prompt="${sel(id)}"] .pl-meta`);if(fresh&&m)m.innerHTML=meta(fresh);
  sound('success');App.toast(`«${short(r.name)}» copiado. Ya puedes pegarlo.`,'success');}
 /* Light motion (GSAP when present; nothing with reduced motion): height tween for «Ver completo», a pop on «Copiar». */
 function animateHeight(el,mutate){const G=window.gsap;if(!G||reduced()||!el){mutate();return;}
  const from=el.getBoundingClientRect().height;mutate();const to=el.getBoundingClientRect().height;if(Math.abs(to-from)<2)return;
  G.fromTo(el,{height:from},{height:to,duration:Math.min(.5,.24+Math.abs(to-from)/2400),ease:'power2.out',overwrite:'auto',clearProps:'height'});}
 function pop(el){const G=window.gsap;if(!G||reduced()||!el)return;G.fromTo(el,{scale:.93},{scale:1,duration:.5,ease:'back.out(2.6)',overwrite:'auto',clearProps:'transform'});}
 function flash(el){if(!el||reduced())return;el.classList.remove('pl-flash');void el.offsetWidth;el.classList.add('pl-flash');el.addEventListener('animationend',()=>el.classList.remove('pl-flash'),{once:true});}
 function toggleMore(id,btn){const card=btn.closest('[data-prompt]'),box=card?.querySelector('.pl-body'),pre=box?.querySelector('.pl-pre');if(!box||!pre)return;
  const open=!PS.open.has(id),r=open?findPrompt(id):null;
  animateHeight(box,()=>{if(open){PS.open.add(id);if(r&&pre.dataset.full!=='1'){pre.textContent=r.body;pre.dataset.full='1';}box.classList.remove('is-collapsed');box.classList.add('is-open');box.removeAttribute('data-fit');pre.tabIndex=0;pre.setAttribute('role','region');pre.setAttribute('aria-label','Prompt completo');}
   else{PS.open.delete(id);box.classList.remove('is-open');box.classList.add('is-collapsed');pre.scrollTop=0;pre.removeAttribute('tabindex');pre.removeAttribute('role');pre.removeAttribute('aria-label');}
   btn.setAttribute('aria-expanded',String(open));const lbl=btn.querySelector('span');if(lbl)lbl.textContent=open?'Ver menos':'Ver completo';});
  if(!open){try{card.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});}catch{}}}
 function duplicatePrompt(id){const L=P();if(!L)return;let rec=null;
  try{Store.save(s=>{const out=L.duplicate(L.list(s),id);rec=out.record;setLib(s,out.list);});}catch(x){sound('error');App.toast(friendly(x),'error');return;}
  PS.flash=rec.id;if(!L.search([rec],PS.query,PS.tag).length){PS.query='';PS.tag='';}sound('success');App.toast(`Duplicado como «${short(rec.name)}».`,'success');refresh();}
 function pinPrompt(id){const L=P();if(!L)return;let on=false;
  try{Store.save(s=>{const lib=L.list(s),r=lib.find(x=>x.id===id);if(!r)throw Error('Ese prompt ya no existe.');on=r.pinned!==true;setLib(s,L.togglePin(lib,id,on));});}catch(x){App.toast(friendly(x),'error');return;}
  PS.flash=id;sound('card');App.toast(on?'Fijado arriba de tu lista.':'Ya no está fijado.','success');refresh();}
 function deletePrompt(id){const L=P(),r=findPrompt(id);if(!L||!r)return;
  App.confirmAction(`¿Eliminar «${short(r.name,60)}»?`,'Se borra de tu biblioteca de prompts en todos tus dispositivos. Podrás deshacerlo durante unos segundos.',()=>{let removed=null,index=-1;
   Store.save(s=>{const lib=L.list(s);index=lib.findIndex(x=>x.id===id);if(index<0)return;removed=lib[index];setLib(s,L.remove(lib,id));});
   PS.open.delete(id);if(PS.editing===id)PS.editing=null;sound('close');
   App.toast('Prompt eliminado.','success',removed?()=>{Store.save(s=>setLib(s,L.restore(L.list(s),removed,index)));PS.flash=removed.id;}:undefined);},'Eliminar');}
 function paintResults(){const L=P(),box=document.getElementById('pl-results');if(!L||!box){refresh();return;}
  const all=L.list(Store.get()),shown=L.search(all,PS.query,PS.tag);box.innerHTML=results(all,shown);
  const c=document.getElementById('pl-count');if(c)c.textContent=countText(shown.length,all.length);
  document.querySelectorAll('#pl-filters [data-prompt-tag]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.promptTag===PS.tag)));
  try{App.icons();}catch{}schedule();}
 async function pasteInto(f){const ta=f?.elements?.body;if(!ta)return;let clip=null;try{clip=await navigator.clipboard.readText();}catch{clip=null;}
  if(clip===null){App.toast('No pude leer el portapapeles. Mantén presionado el cuadro del prompt y elige «Pegar».','error');try{ta.focus();}catch{}return;}
  if(!clip){App.toast('Tu portapapeles está vacío.','error');return;}
  // Never focused yet → append at the end; otherwise paste where the caret was.
  let a=ta.selectionStart??ta.value.length,b=ta.selectionEnd??a;if(!ta.dataset.caret)a=b=ta.value.length;ta.focus();
  if(typeof ta.setRangeText==='function')ta.setRangeText(clip,a,b,'end');else ta.value=ta.value.slice(0,a)+clip+ta.value.slice(b);
  ta.dispatchEvent(new Event('input',{bubbles:true}));}
 function goTab(k){rememberTab(k);PS.focus={sel:'#auto-tab-'+k,until:Date.now()+1500};const h='#automatizaciones/'+k;if(location.hash===h)refresh();else location.hash=h;}
 document.addEventListener('click',ev=>{const t=ev.target.closest?.('[data-auto-tab],[data-prompt-new],[data-prompt-cancel],[data-prompt-copy],[data-prompt-more],[data-prompt-edit],[data-prompt-dup],[data-prompt-pin],[data-prompt-del],[data-prompt-tag],[data-prompt-clear],[data-prompt-tagpick],[data-prompt-paste]');if(!t)return;const d=t.dataset;
  try{
   if(d.autoTab){if(ev.button||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)return;ev.preventDefault();goTab(d.autoTab);return;}
   if(d.promptNew!==undefined){const L=P();if(L&&L.list(Store.get()).length>=L.limits.MAX_PROMPTS){sound('error');App.toast(`Llegaste al límite de ${L.limits.MAX_PROMPTS} prompts. Borra alguno que ya no uses para guardar uno nuevo.`,'error');return;}openForm('new');return;}
   if(d.promptCancel!==undefined){closeForm();return;}
   if(d.promptCopy){copyPrompt(d.promptCopy).catch(()=>{});return;}
   if(d.promptMore){toggleMore(d.promptMore,t);return;}
   if(d.promptEdit){openForm(d.promptEdit);return;}
   if(d.promptDup){duplicatePrompt(d.promptDup);return;}
   if(d.promptPin){pinPrompt(d.promptPin);return;}
   if(d.promptDel){deletePrompt(d.promptDel);return;}
   if(d.promptTag!==undefined){PS.tag=PS.tag===d.promptTag?'':d.promptTag;paintResults();return;}
   if(d.promptClear!==undefined){PS.query='';PS.tag='';const q=document.getElementById('prompt-q');if(q)q.value='';paintResults();q?.focus();return;}
   if(d.promptTagpick!==undefined){const inp=t.closest('form')?.elements?.tag;if(inp){inp.value=d.promptTagpick;inp.dispatchEvent(new Event('input',{bubbles:true}));}return;}
   if(d.promptPaste!==undefined){pasteInto(t.closest('form')).catch(()=>{});return;}
  }catch(x){App.toast(friendly(x),'error');}});
 document.addEventListener('keydown',ev=>{const t=ev.target;
  if(t?.dataset?.autoTab){const keys=TABS.map(x=>x[0]);let k=keys.indexOf(t.dataset.autoTab);
   if(ev.key===' '){ev.preventDefault();goTab(t.dataset.autoTab);return;}
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();
   k=ev.key==='Home'?0:ev.key==='End'?keys.length-1:(k+(ev.key==='ArrowRight'?1:-1)+keys.length)%keys.length;goTab(keys[k]);return;}
  // Ctrl/⌘ + Enter saves the prompt from any field of the form.
  const f=t?.closest?.('#prompt-form');if(f&&ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();if(typeof f.requestSubmit==='function')f.requestSubmit();else f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}});
 document.addEventListener('focusin',ev=>{if(ev.target?.id==='pl-body-input')ev.target.dataset.caret='1';});
 /* After App.render() has put the markup in the page (render() queues this for the next frame). */
 let queued=false;
 function schedule(){if(queued)return;queued=true;const run=()=>{queued=false;try{after();}catch(x){console.warn('EVIE · prompts:',x?.message||x);}};try{(window.requestAnimationFrame||(f=>setTimeout(f,16)))(run);}catch{queued=false;}}
 function after(){if(window.UI?.section!=='automatizaciones')return;
  const fx=PS.focus;PS.focus=null;if(fx&&fx.until>Date.now()){try{document.querySelector(fx.sel)?.focus({preventScroll:true});}catch{}}
  const page=document.getElementById('prompts-page');if(!page)return;
  if(PS.formIn){PS.formIn=false;const f=document.getElementById('prompt-form');if(f){try{f.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});}catch{}try{window.EvieFX?.panelIn?.(f);}catch{}
   const n=f.elements.name;if(n){try{n.focus({preventScroll:true});n.setSelectionRange(n.value.length,n.value.length);}catch{}}}}
  // Short prompts that the fold heuristic flagged but that fit in the collapsed block: no fade, no «Ver completo».
  const fit=[...page.querySelectorAll('.pl-body[data-fit]')].slice(0,40).filter(b=>{const p=b.querySelector('.pl-pre');return !!p&&p.scrollHeight<=p.clientHeight+2;});
  for(const b of fit){b.classList.remove('is-collapsed');b.removeAttribute('data-fit');b.closest('[data-prompt]')?.querySelector('[data-prompt-more]')?.remove();}
  if(PS.flash){const id=PS.flash;PS.flash=null;const c=page.querySelector(`[data-prompt="${sel(id)}"]`);if(c){try{c.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});}catch{}flash(c);}}}
 /** Open the Prompts tab, optionally searching (q) or filtering by a tag key (used by EviePrompts.intent). */
 function showPrompts(q='',tag=''){PS.query=String(q||'').slice(0,200);PS.tag=String(tag||'');rememberTab('prompts');
  if(window.UI?.section==='automatizaciones'&&currentTab()==='prompts'){refresh();return;}
  try{location.hash='automatizaciones/prompts';}catch{}}
 function reset(){editing=null;query='';clearTimeout(copyTimer);clearTimeout(searchTimer);Object.assign(PS,{editing:null,query:'',tag:'',copied:null,flash:null,focus:null,formIn:false});PS.open.clear();}
 return Object.freeze({render,openShortcut,reset,list,showPrompts});
})();
