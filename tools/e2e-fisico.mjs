// E2E v10 Físico = solo Cuerpo: #gimnasio alias → #fisico, no training/meal tabs, recovery map (red <24 h, yellow 24–48 h,
// green ≥48 h, idle) driven by «entrené X» voice phrases («el lunes…», «ayer pierna», «hoy upper»), quick «Entrené» chips,
// tap a muscle → last training + readiness, correct/delete a day with undo, «Medidas» mode keeps measurements/weight,
// old #fisico/<id> links land on #fisico, presentation preference, no horizontal overflow, multi-card HUD still works.
import { chromium } from 'playwright'
const W=Number(process.env.W||1440),SHOT=process.env.SHOT,THEME=process.env.THEME||'dark'
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:W,height:W<600?844:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:3000/index.html?qa=e2e-fisico-'+Date.now());await p.waitForFunction(()=>window.DALI_READY,null,{timeout:60000})
const r=await p.evaluate(async(theme)=>{const out={};const wait=ms=>new Promise(r=>setTimeout(r,ms));const until=async(f,ms=5000)=>{const t=Date.now();while(Date.now()-t<ms){try{if(f())return true;}catch{}await wait(60);}return false;};
 const H=3600000,now=Date.now(),iso=ms=>new Date(ms).toISOString(),dt=ms=>{const d=new Date(ms);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const day=(id,ms,m)=>({id,title:m.join(' y '),date:dt(ms),trained_at:iso(ms),completeness:'partial',source:'manual',exercises:m.map(k=>({name:k,equipment:null,primary_muscles:[k],secondary_muscles:[],sets:[]})),uncertainties:['Registrado por voz: faltan ejercicios, series y repeticiones.'],reported_total_sets:null,reported_volume_kg:null,notes:null,op_id:null,duration_seconds:null});
 window.Neural?.dismiss?.();Store.save(s=>{s.preferences.evieModulesChosen=true;s.preferences.theme=theme;s.gymSessions=[day('s-red',now-3*H,['chest']),day('s-yel',now-30*H,['back']),day('s-grn',now-60*H,['quads'])];s.metrics=[];});
 location.hash='gimnasio';await until(()=>UI.section==='fisico'&&document.querySelector('.fm-stage'));
 out.alias=location.hash==='#fisico'&&UI.section==='fisico';out.title=document.querySelector('main h1')?.textContent;out.navLabel=[...document.querySelectorAll('#main-nav a')].some(a=>/Físico/.test(a.textContent)&&a.hash==='#fisico');
 out.noTabs=!document.querySelector('.fis-tabs,.gym-tabs,[data-fis="tab"],[data-evg],#evm-calories')&&!/Entrenamientos|Comidas y calorías/.test(document.querySelector('main').textContent);
 out.figures=document.querySelectorAll('.fm-stage svg').length;out.regions=document.querySelectorAll('.fm-stage .fb-m').length;
 const st=k=>document.querySelector(`.fm-stage .fb-m[data-m="${k}"]`)?.dataset.rec;out.states=[st('chest'),st('back'),st('quads'),st('calves')].join();
 const fill=k=>getComputedStyle(document.querySelector(`.fm-stage .fb-m[data-m="${k}"]`)).fill;out.colored=fill('chest')!==fill('quads')&&fill('chest')!==fill('back')&&!/url/.test(fill('chest'));
 out.legend=[...document.querySelectorAll('.fm-legend li')].map(li=>li.dataset.rec+':'+li.querySelector('b').textContent).join();
 // Tap a muscle → last training + readiness.
 document.querySelector('.fm-stage .fb-m[data-m="quads"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));await until(()=>/Último entrenamiento/.test(document.querySelector('#fm-part')?.textContent||''));
 const pt=document.querySelector('#fm-part').textContent;out.tap=/Último entrenamiento: .+\(hace 2 días\)/.test(pt)&&/listo para entrenar/.test(pt)&&!!document.querySelector('.fm-stage .fb-m[data-m="quads"][data-selected]');
 // Voice: «el lunes entrené pecho y espalda» (weekday in the past), «ayer pierna» (no verb), duplicates, undo.
 Store.save(s=>{s.gymSessions=[];});App.render();await wait(150);
 const say=await EvieAssistant.tryLocal('Ivi, el lunes entrené pecho y espalda');out.say=say;await wait(250);
 const monday=Store.list('gymSessions')[0];out.mondayOk=!!monday&&new Date(monday.date+'T12:00:00').getDay()===1&&monday.date<=Domain.today()&&!!monday.trained_at&&Date.parse(monday.trained_at)<=Date.now();
 out.toastUndo=!!document.querySelector('#toast-region .toast button');
 const again=await EvieAssistant.tryLocal('el lunes entrené pecho y espalda');out.noDup=/Ya/.test(again||'')&&Store.list('gymSessions').length===1;
 const leg=await EvieAssistant.tryLocal('ayer pierna');out.legSay=leg;await wait(250);const y=Store.list('gymSessions').find(s=>s.date===V2Domain.addDays(Domain.today(),-1)&&s.exercises.some(e=>e.primary_muscles[0]==='glutes'));out.leg=!!y;
 [...document.querySelectorAll('#toast-region .toast button')].at(-1)?.click();await wait(250);out.legUndo=!Store.list('gymSessions').some(s=>s.id===y?.id);
 // Quick chips: Bíceps + preset «Push» → one record for today, muscles turn red.
 Store.save(s=>{s.gymSessions=[];});App.render();await until(()=>document.querySelector('[data-fm="qchip"]'));
 out.saveDisabled=document.querySelector('[data-fm="qsave"]').disabled;
 document.querySelector('[data-fm="qchip"][data-key="biceps"]').click();document.querySelector('[data-fm="qpreset"][data-key="push"]').click();await wait(80);
 out.chips=[...document.querySelectorAll('[data-fm="qchip"][aria-pressed="true"]')].map(c=>c.dataset.key).sort().join();
 document.querySelector('[data-fm="qsave"]').click();await until(()=>Store.list('gymSessions').length===1);await wait(300);
 const q=Store.list('gymSessions')[0];out.quick=q?.date===Domain.today()&&q.exercises.map(e=>e.primary_muscles[0]).sort().join()==='biceps,chest,shoulders,triceps';
 out.quickRed=st('chest')==='red'&&st('triceps')==='red'&&st('back')==='idle';
 out.card=/Descansando/.test(document.querySelector('.fm-rec-card')?.textContent||'')&&document.querySelectorAll('.fm-day').length===1;
 // Correct the day (override) and delete with undo.
 document.querySelector('.fm-day [data-fis="map"]').click();await until(()=>document.querySelector('#fis-map-form'));
 const f=document.querySelector('#fis-map-form');f.querySelector('input[value="triceps"]').checked=false;f.querySelector('input[value="back"]').checked=true;f.requestSubmit();await wait(300);
 out.override=(Store.list('gymSessions')[0].muscle_override||[]).slice().sort().join();out.overrideMap=st('back')==='red'&&st('triceps')==='idle';
 document.querySelector('.fm-day [data-fis="del-day"]').click();await wait(250);out.deleted=Store.list('gymSessions').length===0;[...document.querySelectorAll('#toast-region .toast button')].at(-1)?.click();await wait(250);out.undoDelete=Store.list('gymSessions').length===1;
 // «Medidas» mode keeps the v8 tracker.
 document.querySelector('[data-fm="mode"][data-mode="measure"]').click();await until(()=>document.querySelector('[data-fm="measure"]'));
 document.querySelector('[data-fm="measure"]').click();await until(()=>document.querySelector('#fm-form'));const mf=document.querySelector('#fm-form');mf.elements.biceps_r.value='36,5';mf.requestSubmit();await until(()=>Store.list('metrics').length===1);await wait(250);
 const bic=document.querySelector('.fm-stage .fb-m[data-m="biceps"]'),br=bic.getBoundingClientRect();bic.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:br.left+br.width*.2,clientY:br.top+br.height/2}));
 await until(()=>/Bíceps/.test(document.querySelector('#fm-part')?.textContent||''));out.measure=/36[.,]5/.test(document.querySelector('#fm-part').textContent)&&!document.querySelector('.fm-legend');
 document.querySelector('[data-fm="mode"][data-mode="rec"]').click();await until(()=>document.querySelector('.fm-legend'));out.backToRec=!!document.querySelector('.fm-legend');
 const sel=document.querySelector('[data-fis="pres"]');sel.value='fem';sel.dispatchEvent(new Event('change',{bubbles:true}));await wait(200);out.pres=Store.get().preferences.fisicoPresentation;
 location.hash='fisico/'+Store.list('gymSessions')[0].id;await wait(400);out.oldLink=location.hash==='#fisico'&&!!document.querySelector('.fm-stage');
 out.pageOverflow=document.documentElement.scrollWidth>innerWidth+1;
 location.hash='inicio';await until(()=>window.EvieHUD&&UI.section==='inicio');const m=await EvieAssistant.tryLocal('Ivi, abre Finanzas y Mascota Virtual');out.multi=m;await wait(300);
 return out;},THEME);
if(SHOT){await p.evaluate(()=>{UI.fisicoRec='chest';location.hash='fisico';});await p.waitForTimeout(900);await p.screenshot({path:SHOT,fullPage:true});}
console.log(JSON.stringify(r),errs.length?errs:'no errors')
const checks={alias:r.alias,title:r.title==='Físico',nav:r.navLabel,noTabs:r.noTabs,figures:r.figures===2&&r.regions===16,
 states:r.states==='red,yellow,green,idle',colored:r.colored,legend:r.legend==='red:1,yellow:1,green:1,idle:9',tap:r.tap,
 voice:/Anotado: Pecho y Espalda/.test(r.say||'')&&r.mondayOk&&r.toastUndo,noDup:r.noDup,leg:/Anotado/.test(r.legSay||'')&&r.leg&&r.legUndo,
 chips:r.saveDisabled&&r.chips==='biceps,chest,shoulders,triceps',quick:r.quick,quickRed:r.quickRed,card:r.card,
 override:r.override==='back,biceps,chest,shoulders'&&r.overrideMap,del:r.deleted&&r.undoDelete,measure:r.measure&&r.backToRec,pres:r.pres==='fem',oldLink:r.oldLink,
 overflow:!r.pageOverflow,multi:/Te dejé/.test(r.multi||''),errors:!errs.length}
const bad=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k)
console.log(Object.keys(checks).length-bad.length+'/'+Object.keys(checks).length,bad.length?'FAIL '+bad.join(','):'E2E FISICO OK');await b.close();process.exitCode=bad.length?1:0
