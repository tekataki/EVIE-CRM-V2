// E2E v8 Físico: #gimnasio alias → #fisico, body map front/back, voice «hoy entrené pecho y espalda» (no duplicates,
// undo), Cuerpo tab = body map + measurements only (no training clutter), «Registrar medidas» ×2 (hace 30 días / hoy),
// tap bíceps → latest + change vs 1 month + sparkline, quick «Registrar peso» merges into today, history + delete/undo,
// mapping override (API), presentation preference, secondary tabs keep training/calories,
// manual form still saves and lands on #fisico/<id>, multi-card HUD «abre Finanzas y Kisha» persists.
import { chromium } from 'playwright'
const W=Number(process.env.W||1440),SHOT=process.env.SHOT
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:W,height:W<600?844:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:3000/index.html?qa=e2e-fisico-'+Date.now());await p.waitForFunction(()=>window.DALI_READY,null,{timeout:60000})
const r=await p.evaluate(async()=>{const out={};const wait=ms=>new Promise(r=>setTimeout(r,ms));const until=async(f,ms=5000)=>{const t=Date.now();while(Date.now()-t<ms){try{if(f())return true;}catch{}await wait(60);}return false;};
 window.Neural?.dismiss?.();Store.save(s=>{s.preferences.evieModulesChosen=true;s.gymSessions=[];});
 location.hash='gimnasio';await until(()=>UI.section==='fisico'&&document.querySelector('.fis-figures'));
 out.alias=location.hash==='#fisico'&&UI.section==='fisico';out.title=document.querySelector('main h1')?.textContent;out.navLabel=[...document.querySelectorAll('#main-nav a')].some(a=>/Físico/.test(a.textContent)&&a.hash==='#fisico');
 out.noOldLabel=![...document.querySelectorAll('#main-nav a')].some(a=>/Salud y gym/.test(a.textContent));
 out.figures=document.querySelectorAll('.fis-figures svg').length;out.regions=document.querySelectorAll('.fb-m').length;
 const say=EvieAssistant.tryLocal?await EvieAssistant.tryLocal('Ivi, hoy entrené pecho y espalda'):null;out.say=say;await wait(200);
 out.sessions=Store.list('gymSessions').length;out.fresh=(Store.list('gymSessions')[0]?.exercises||[]).map(x=>x.primary_muscles[0]).sort().join();
 out.toastUndo=!!document.querySelector('.toast button');
 const again=await EvieAssistant.tryLocal('hoy entrené pecho y espalda');out.again=again;out.sessions2=Store.list('gymSessions').length;
 // v8 Cuerpo: only the body map + measurements/weight tracker.
 out.noClutter=!document.querySelector('.fis-today,.fis-groups,.fis-legend,.fis-note,#fis-detail')&&!!document.querySelector('[data-fm-root] .fm-stage');
 Store.save(s=>{s.metrics=[];});App.render();await until(()=>document.querySelector('[data-fm="measure"]'));
 const lastToastUndo=()=>[...document.querySelectorAll('#toast-region .toast button')].at(-1);
 const measure=async vals=>{const n=Store.list('metrics').length;document.querySelector('[data-fm="measure"]').click();await until(()=>document.querySelector('#fm-form'));
  const mf=document.querySelector('#fm-form');for(const [k,v] of Object.entries(vals))mf.elements[k].value=v;mf.requestSubmit();await until(()=>Store.list('metrics').length>n);await wait(250);};
 out.decimalKeyboard=(()=>{document.querySelector('[data-fm="measure"]').click();const ok=document.querySelector('#fm-form [name="biceps_r"]')?.getAttribute('inputmode')==='decimal';App.closeDialog(true);return ok;})();
 await measure({date:V2Domain.addDays(Domain.today(),-30),biceps_r:'35,3',waist:'84'});await measure({biceps_r:'36.5',waist:'82.5'});
 out.metrics=Store.list('metrics').length;out.mFields=Object.keys(Store.list('metrics').find(m=>m.date===Domain.today())?.measurements||{}).sort().join();
 const bic=document.querySelector('.fm-stage .fb-m[data-m="biceps"]'),br=bic.getBoundingClientRect();
 bic.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:br.left+br.width*.2,clientY:br.top+br.height/2}));
 await until(()=>/Bíceps der\./.test(document.querySelector('#fm-part')?.textContent||''));const pt=document.querySelector('#fm-part')?.textContent||'';
 out.part=/36[.,]5/.test(pt)&&/\+1[.,]2 cm vs hace 1 mes/.test(pt)&&!!document.querySelector('#fm-part .fm-spark');
 out.partSel=!!document.querySelector('.fm-stage .fb-m[data-m="biceps"][data-selected]')&&!!document.querySelector('.fm-stage .fb-m[data-m="triceps"][data-selected]');
 document.querySelector('[data-fm="weight"]').click();await until(()=>document.querySelector('#fm-weight-form'));const wf=document.querySelector('#fm-weight-form');wf.elements.weight.value='79,9';wf.requestSubmit();
 await until(()=>Store.list('metrics').some(m=>m.weight===79.9));await wait(250);
 out.weightMerged=Store.list('metrics').length===2&&Store.list('metrics').find(m=>m.date===Domain.today())?.weight===79.9;
 out.cadence=/Próximo pesaje en 7 días/.test(document.querySelector('.fm-status')?.textContent||'');
 out.history=document.querySelectorAll('.fm-hist-row').length===2&&document.querySelector('.fm-hist-row')?.dataset.id===Store.list('metrics').find(m=>m.date===Domain.today())?.id;
 document.querySelector('.fm-hist-row [data-fm="del"]').click();await wait(250);out.deleted=Store.list('metrics').length===1;lastToastUndo()?.click();await wait(250);out.undoDelete=Store.list('metrics').length===2;
 // Mapping override still works (no longer surfaced on Cuerpo; kept as API).
 EvieFisico.mapDialog(Store.list('gymSessions')[0].id);await until(()=>document.querySelector('#fis-map-form'));
 const f=document.querySelector('#fis-map-form');f.querySelector('input[value="chest"]').checked=false;f.querySelector('input[value="shoulders"]').checked=true;f.requestSubmit();await wait(300);
 const s=Store.list('gymSessions')[0];out.override=(s.muscle_override||[]).join();
 const sel=document.querySelector('[data-fis="pres"]');sel.value='fem';sel.dispatchEvent(new Event('change',{bubbles:true}));await wait(200);out.pres=Store.get().preferences.fisicoPresentation;
 document.querySelector('[data-fis="tab"][data-tab="entrenos"]').click();await until(()=>document.querySelector('[data-evg="new"]')&&document.querySelector('.gym-tabs'));
 out.trainingTabs=document.querySelectorAll('.gym-tabs button').length;out.trainingNoFood=!document.querySelector('.gym-tabs [data-tab="nutrition"]');
 document.querySelector('[data-fis="tab"][data-tab="comidas"]').click();await until(()=>document.querySelector('#evm-calories'));out.calories=!!document.querySelector('#evm-calories');
 document.querySelector('[data-fis="tab"][data-tab="cuerpo"]').click();await wait(200);
 const before=Store.list('gymSessions').length;document.querySelector('[data-evg="new"]').click();await until(()=>document.querySelector('.gl-form'));
 const g=document.querySelector('.gl-form');g.elements.title.value='Pierna QA';const ex=g.querySelector('[data-gl-ex]');ex.querySelector('[name=name]').value='Sentadilla';ex.querySelector('[name=muscle]').value='quads';ex.querySelector('[name=reps]').value='8';
 g.querySelectorAll('input,select').forEach(x=>x.dispatchEvent(new Event('input',{bubbles:true})));g.requestSubmit();await until(()=>Store.list('gymSessions').length>before);await wait(300);
 out.manual=Store.list('gymSessions').length-before;out.manualHash=/^#fisico\//.test(location.hash);out.backLink=!!document.querySelector('main a[href="#fisico"]');
 location.hash='fisico';await wait(300);out.pageOverflow=document.documentElement.scrollWidth>innerWidth+1;
 location.hash='inicio';await until(()=>window.EvieHUD&&UI.section==='inicio');const m=await EvieAssistant.tryLocal('Ivi, abre Finanzas y Mascota Virtual');out.multi=m;await wait(500);
 out.cards=[...document.querySelectorAll('[data-hud-card],.hud-card')].map(x=>x.dataset.type||x.dataset.hudCard||'').filter(Boolean);
 return out;});
if(SHOT){await p.evaluate(()=>{location.hash='fisico';});await p.waitForTimeout(700);await p.screenshot({path:SHOT,fullPage:false});}
console.log(JSON.stringify(r),errs.length?errs:'no errors')
const checks={alias:r.alias,title:r.title==='Físico',nav:r.navLabel&&r.noOldLabel,figures:r.figures===2&&r.regions===16,voice:/Anotado/.test(r.say||'')&&r.sessions===1&&r.fresh==='back,chest'&&r.toastUndo,
 noDup:r.sessions2===1&&/Ya/.test(r.again||''),noClutter:r.noClutter,measures:r.decimalKeyboard&&r.metrics===2&&r.mFields==='biceps_r,waist',part:r.part&&r.partSel,
 weight:r.weightMerged&&r.cadence,history:r.history&&r.deleted&&r.undoDelete,override:r.override==='shoulders,back',pres:r.pres==='fem',
 training:r.trainingTabs===4&&r.trainingNoFood,calories:r.calories,manual:r.manual===1&&r.manualHash&&r.backLink,overflow:!r.pageOverflow,multi:/Te dejé/.test(r.multi||''),errors:!errs.length}
const bad=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k)
console.log(Object.keys(checks).length-bad.length+'/'+Object.keys(checks).length,bad.length?'FAIL '+bad.join(','):'E2E FISICO OK');await b.close();process.exitCode=bad.length?1:0
