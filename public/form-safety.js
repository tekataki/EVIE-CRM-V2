'use strict';
/* Unsaved input stays in the original DOM. No close/navigation operation commits records. */
window.FormSafety=(()=>{
 let root=null,baseline='',warning=null,focusBefore=null,pending=null;
 const controls=()=>root?[...root.querySelectorAll('input,select,textarea')].filter(el=>!['button','submit','reset'].includes(el.type)&&!el.disabled&&(el.name||el.dataset.field||el.type==='file'||el.id==='money-pad-input')):[];
 function values(){return JSON.stringify(controls().map(el=>({key:el.name||el.id||el.dataset.field||'',type:el.type,value:el.type==='file'?[...el.files].map(f=>[f.name,f.size,f.lastModified]):['checkbox','radio'].includes(el.type)?el.checked:el.value})));}
 function dialogDirty(){return !!root?.isConnected&&document.getElementById('app-dialog')?.open&&values()!==baseline;}
 /* ---- Page drafts (forms rendered directly in #main-content, e.g. Configuración personalizada) ----
    A page form is tracked from the moment the user focuses it: its values at that moment are the baseline.
    Background work (session refresh, sync, goal renewal, service-worker updates) asks busy() and defers
    instead of rebuilding the DOM; whenIdle() runs the deferred work once the draft is saved or discarded. */
 const IGNORE='#evie-stage-form,#kisha-form,[role=search],[data-draft-ignore]';
 const pages=new Map();let idle=[],stash=null;
 const field=el=>el?.matches?.('input,select,textarea')&&!['button','submit','reset','hidden','file','search'].includes(el.type);
 function pageRoot(el){const main=document.getElementById('main-content');if(!field(el)||!main?.contains(el)||el.closest('dialog')||el.closest(IGNORE))return null;return el.closest('form')||null;}
 const items=r=>[...r.querySelectorAll('input,select,textarea')].filter(field);
 function snap(r){return JSON.stringify(items(r).map(x=>[x.name||x.id,['checkbox','radio'].includes(x.type)?x.checked:x.value]));}
 function pageDirty(){for(const [r,b] of pages){if(!r.isConnected){pages.delete(r);continue;}if(snap(r)!==b)return true;}return false;}
 function dirty(){return dialogDirty()||pageDirty();}
 function editingNow(){const a=document.activeElement;return !!(a&&a!==document.body&&a.matches?.('input,select,textarea,[contenteditable=true]')&&document.getElementById('main-content')?.contains(a)&&!a.closest(IGNORE)&&!['button','submit','reset','checkbox','radio','range'].includes(a.type));}
 /** True while something would be lost or disturbed by a background re-render or reload. */
 function busy(){return dirty()||editingNow()||!!document.querySelector('dialog[open]');}
 const reasons=new Set();
 function notice(){let n=document.getElementById('draft-guard-notice');if(!reasons.size){if(n)n.hidden=true;return;}
  if(!n){n=document.createElement('p');n.id='draft-guard-notice';n.className='draft-guard-notice';n.setAttribute('role','status');document.body.append(n);}
  const what=[...reasons].map(r=>({remote:'cambios de otro dispositivo',update:'una actualización de EVIE',render:'datos actualizados'}[r]||r));
  n.textContent='Tienes cambios sin guardar. Hay '+what.join(' y ')+' esperando; se aplicarán cuando guardes o descartes tu borrador.';n.hidden=false;}
 function whenIdle(fn,reason){if(typeof fn==='function'&&!idle.includes(fn))idle.push(fn);if(reason&&busy()){reasons.add(reason);notice();}settle();}
 let settleTimer=0;function settle(){clearTimeout(settleTimer);settleTimer=setTimeout(()=>{if(busy()||!idle.length)return;const q=idle;idle=[];reasons.clear();notice();for(const fn of q){try{fn();}catch(err){console.error(err);}}},120);}
 function cleanPage(r){if(r){if(r.isConnected)pages.set(r,snap(r));}else for(const k of pages.keys())pages.set(k,snap(k));settle();}
 document.addEventListener('focusin',ev=>{const r=pageRoot(ev.target);if(r&&!pages.has(r))pages.set(r,snap(r));},true);
 document.addEventListener('focusout',()=>settle(),true);
 // Generic page forms: submitting is the explicit commit; manual forms (data-draft-manual) clean themselves after a successful save.
 document.addEventListener('submit',ev=>{const f=ev.target;if(pages.has(f)&&!f.hasAttribute('data-draft-manual'))queueMicrotask(()=>cleanPage(f));},true);
 /** Safety net for foreground renders: remember dirty page forms (by id) and put the draft back afterwards. */
 function save(){const out=[];const a=document.activeElement;for(const [r,b] of pages){if(!r.isConnected||!r.id||snap(r)===b)continue;out.push({id:r.id,base:b,values:items(r).map(x=>({k:x.name||x.id,v:['checkbox','radio'].includes(x.type)?x.checked:x.value})),focus:r.contains(a)?(a.name||a.id):null,sel:r.contains(a)&&'selectionStart' in a?[a.selectionStart,a.selectionEnd]:null});}
  stash=out.length?{list:out,y:scrollY,section:window.UI?.section}:null;return stash;}
 function put(f){const e=stash?.list.find(x=>x.id===f?.id);if(!e||!f.isConnected)return false;for(const {k,v} of e.values){const el=f.elements.namedItem?.(k)||f.querySelector('#'+CSS.escape(k));if(!el||el instanceof RadioNodeList)continue;if(['checkbox','radio'].includes(el.type))el.checked=v;else el.value=v;}
  pages.set(f,e.base);if(e.focus){const el=f.elements.namedItem?.(e.focus)||f.querySelector('#'+CSS.escape(e.focus));if(el&&!(el instanceof RadioNodeList)){el.focus({preventScroll:true});if(e.sel)try{el.setSelectionRange(...e.sel);}catch{}}}
  f.dispatchEvent(new Event('input',{bubbles:true}));stash.list=stash.list.filter(x=>x!==e);if(!stash.list.length)stash=null;return true;}
 function restore(){if(!stash)return;if(stash.section!==window.UI?.section){stash=null;return;}const y=stash.y;for(const e of [...stash.list]){const f=document.getElementById(e.id);if(f?.tagName==='FORM')put(f);}if(Math.abs(scrollY-y)>2)scrollTo(0,y);}
 /** Async-mounted page forms call adopt(form) so a stashed draft survives their own rebuild. */
 function adopt(f){if(f)put(f);}
 function attach(node){root=node;baseline=values();}
 function clean(){baseline=values();stash=null;cleanPage();}
 function dismiss(){if(!warning)return;warning.close();warning.remove();warning=null;pending=null;if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});focusBefore=null;}
 function request(leave,scope){if(!(scope==='dialog'?dialogDirty():dirty())){leave();return true;}if(warning)return false;pending=leave;focusBefore=document.activeElement;warning=document.createElement('dialog');warning.id='unsaved-dialog';warning.className='unsaved-dialog';warning.setAttribute('aria-labelledby','unsaved-title');warning.innerHTML='<h2 id="unsaved-title">Tienes cambios sin guardar</h2><p>Tu borrador sigue abierto. Puedes continuar editando o descartar estos cambios. No se guardará ningún registro al salir.</p><div class="form-footer"><button type="button" class="button primary" data-unsaved="stay">Seguir editando</button><button type="button" class="button" data-unsaved="discard">Descartar y salir</button></div>';document.body.append(warning);warning.addEventListener('cancel',ev=>{ev.preventDefault();dismiss();});warning.addEventListener('click',ev=>{const action=ev.target.closest('[data-unsaved]')?.dataset.unsaved;if(action==='stay')dismiss();if(action==='discard'){const next=pending;clean();dismiss();next?.();}});warning.addEventListener('keydown',ev=>{if(ev.key!=='Tab')return;const buttons=warning.querySelectorAll('button'),first=buttons[0],last=buttons[1];if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}});warning.showModal();warning.querySelector('button').focus();return false;}
 function release(){dismiss();root=null;baseline='';settle();}
 // A synchronous guard is needed when legacy functions replace a dialog and bind immediately.
 function replace(){if(!dirty())return;if(!window.confirm('Tienes cambios sin guardar. ¿Descartarlos y abrir otra ventana?'))throw new Error('Tu borrador sigue abierto; no se guardó ningún cambio.');clean();}
 function enhance(form){if(!form||form.dataset.safetyEnhanced)return;form.dataset.safetyEnhanced='true';const footer=form.querySelector('.form-footer');if(!footer)return;
  const button=document.createElement('button');button.type='button';button.className='button';button.textContent='Revisar antes de guardar';button.dataset.formReview='open';footer.prepend(button);
  const review=document.createElement('section');review.className='form-review';review.hidden=true;review.setAttribute('aria-label','Revisión del borrador');footer.before(review);
  button.onclick=()=>{if(!form.reportValidity())return;const entries=[...form.querySelectorAll('input,select,textarea')].filter(el=>el.name&&el.type!=='hidden'&&!el.disabled&&!(el.type==='radio'&&!el.checked));review.innerHTML='<h3 tabindex="-1">Revisa tu registro</h3><p class="muted">Esto es una vista previa. Todavía no se ha guardado.</p><dl>'+entries.map(el=>{const label=form.querySelector('label[for="'+CSS.escape(el.id)+'"]')?.textContent||el.closest('label')?.textContent||el.name,value=el.type==='checkbox'?(el.checked?'Sí':'No'):el.tagName==='SELECT'?el.selectedOptions[0]?.textContent:el.type==='file'?[...el.files].map(f=>f.name).join(', '):el.value;return '<div><dt>'+Domain.escape(label)+'</dt><dd>'+Domain.escape(value||'Sin registrar')+'</dd></div>';}).join('')+'</dl>';review.hidden=false;review.querySelector('h3').focus();};
  const hint=document.createElement('p');hint.className='form-validity-hint muted';hint.setAttribute('aria-live','polite');footer.before(hint);
  const update=()=>{const invalid=[...form.elements].filter(el=>el.willValidate&&!el.validity.valid),submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=invalid.length>0;hint.textContent=invalid.length?'Completa o corrige '+invalid.length+' campo(s) para habilitar el guardado.':'Listo para revisar y guardar; los datos aún no se han confirmado.';};
  update();form.addEventListener('input',()=>{review.hidden=true;update();});form.addEventListener('change',()=>{review.hidden=true;update();});
  form.addEventListener('click',()=>queueMicrotask(update));
  form.addEventListener('invalid',ev=>{for(let p=ev.target.parentElement;p&&p!==form;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;queueMicrotask(()=>{const first=form.querySelector(':invalid');first?.focus();});},true);
 }
 function wizard(form,steps,labels){
  if(!form||steps.length<2)return;
  const nav=document.createElement('nav');nav.className='form-stepper';nav.setAttribute('aria-label','Pasos del formulario');
  nav.innerHTML=labels.map((label,n)=>'<button type="button" class="button" data-form-step="'+n+'">'+(n+1)+'. '+Domain.escape(label)+'</button>').join('');
  steps[0].before(nav);const footer=form.querySelector('.form-footer'),back=document.createElement('button'),next=document.createElement('button');back.type=next.type='button';back.className=next.className='button';back.textContent='Anterior';next.textContent='Siguiente';footer.prepend(back,next);let current=0;
  const show=(n,focus=true)=>{current=Math.max(0,Math.min(steps.length-1,n));steps.forEach((step,i)=>{step.hidden=i!==current;});nav.querySelectorAll('button').forEach((button,i)=>{button.setAttribute('aria-current',i===current?'step':'false');button.classList.toggle('primary',i===current);});back.hidden=current===0;next.hidden=current===steps.length-1;if(focus){const heading=steps[current].querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus();}}};
  nav.addEventListener('click',ev=>{const button=ev.target.closest('[data-form-step]');if(button)show(Number(button.dataset.formStep));});back.onclick=()=>show(current-1);next.onclick=()=>{const invalid=[...steps[current].querySelectorAll('input,select,textarea')].find(el=>el.willValidate&&!el.validity.valid);if(invalid){invalid.reportValidity();return;}show(current+1);};form.addEventListener('invalid',ev=>{const n=steps.findIndex(step=>step.contains(ev.target));if(n>=0)show(n,false);},true);show(0,false);
 }
 window.addEventListener('beforeunload',ev=>{if(dirty()){ev.preventDefault();ev.returnValue='';}});
 return {attach,dirty,dialogDirty,clean,cleanPage,busy,whenIdle,stash:save,restore,adopt,request,release,replace,enhance,wizard,pageDirty};
})();
