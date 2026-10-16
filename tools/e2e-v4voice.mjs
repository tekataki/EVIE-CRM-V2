// E2E v4 voice/timers/Kisha: «pon un temporizador…» opens the timer card and counts down; pause/resume from the
// card; several timers + ambiguity; reload keeps them; multi-card with timers; floating mic visible on modules and
// hidden on Home/Kisha (on phones the bottom orb is the mic, so the floating one stays hidden); single mic owner; Kisha shows «Relato largo», 8000-char box, tan markings; no page errors.
import { chromium } from 'playwright'
const W=Number(process.env.W||1440),SHOT=process.env.SHOT
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:W,height:W<600?844:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:3000/index.html?qa=e2e-v4voice-'+Date.now());await p.waitForFunction(()=>window.DALI_READY,null,{timeout:60000})
const shot=async path=>{if(SHOT)await p.screenshot({path,timeout:15000,animations:'disabled'}).catch(e=>console.log('shot skipped',e.name));}
const r=await p.evaluate(async()=>{const out={};const wait=ms=>new Promise(r=>setTimeout(r,ms));const until=async(f,ms=5000)=>{const t=Date.now();while(Date.now()-t<ms){try{if(f())return true;}catch{}await wait(60);}return false;};
 window.Neural?.dismiss?.();Store.save(s=>{s.preferences.evieModulesChosen=true;});location.hash='inicio';await until(()=>UI.section==='inicio'&&window.EvieHUD);
 out.say=await EvieAssistant.tryLocal('Ivi, pon un temporizador de 2 minutos para la pasta');await until(()=>document.querySelector('[data-timer-card] .tmr'));
 out.card=!!document.querySelector('[data-timer-card] .tmr');out.label=document.querySelector('[data-timer-card] .tmr strong')?.textContent;
 const left1=document.querySelector('[data-timer-left]')?.textContent;await wait(2200);out.counts=document.querySelector('[data-timer-left]')?.textContent!==left1;
 document.querySelector('[data-tmr="pause"]')?.click();await wait(200);out.paused=EvieTimers.active()[0]?.state==='paused';
 document.querySelector('[data-tmr="resume"]')?.click();await wait(200);out.resumed=EvieTimers.active()[0]?.state==='running';
 out.second=await EvieAssistant.tryLocal('pon un temporizador de 30 segundos');out.two=EvieTimers.active().length===2;
 out.ambig=await EvieAssistant.tryLocal('pausa el temporizador');
 out.multi=await EvieAssistant.tryLocal('abre Finanzas y temporizadores');
 out.fabHome=document.getElementById('evie-mic-fab')?.hidden!==false;
 location.hash='finanzas';await until(()=>UI.section==='finanzas');await wait(300);const fab=document.getElementById('evie-mic-fab');
 out.fabModule=!!fab&&!fab.hidden;if(fab){const q=fab.getBoundingClientRect();out.fabInView=q.right<=innerWidth&&q.bottom<=innerHeight;}
 out.micOwner=[EvieMic.acquire('wake',()=>{}),EvieMic.acquire('assistant',()=>{}),EvieMic.acquire('wake')].join();EvieMic.release('assistant');
 location.hash='bitacora';await until(()=>document.querySelector('[data-kisha-page]'));await wait(400);
 out.fabKisha=document.getElementById('evie-mic-fab')?.hidden===true;
 document.querySelector('[data-kisha="start"]')?.click();await until(()=>document.querySelector('[data-kisha="long"]'),6000);
 out.long=!!document.querySelector('[data-kisha="long"]');out.maxlen=document.getElementById('kisha-text')?.getAttribute('maxlength');
 out.tan=!!document.querySelector('#kisha-char .k-tan');out.pose=document.getElementById('kisha-char')?.dataset.pose;
 out.overflow=document.documentElement.scrollWidth>innerWidth+1;return out;});
await shot(SHOT&&SHOT.replace('.png','-kisha.png'))
await p.reload();await p.waitForFunction(()=>window.DALI_READY,null,{timeout:60000})
const r2=await p.evaluate(async()=>{await new Promise(r=>setTimeout(r,600));return {kept:EvieTimers.active().length,label:EvieTimers.active().find(t=>t.label)?.label};})
if(SHOT){await p.evaluate(()=>{location.hash='inicio';setTimeout(()=>EvieHUD.open('timer'),300);});await p.waitForTimeout(1800);await shot(SHOT);}
console.log(JSON.stringify({...r,...r2}),errs.length?errs:'no errors')
const checks={say:/pasta/.test(r.say||''),card:r.card&&r.label==='pasta',counts:r.counts,pause:r.paused&&r.resumed,two:r.two,ambig:/¿Cuál\?/.test(r.ambig||''),multi:/Te dejé/.test(r.multi||''),
 fab:r.fabHome&&(W<1024?true:r.fabModule&&r.fabInView)&&r.fabKisha,mic:r.micOwner==='true,true,false',kisha:r.long&&r.maxlen==='8000'&&r.tan,reload:r2.kept===2&&r2.label==='pasta',overflow:!r.overflow,errors:!errs.length}
const bad=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k)
console.log(Object.keys(checks).length-bad.length+'/'+Object.keys(checks).length,bad.length?'FAIL '+bad.join(','):'E2E V4 VOICE OK');await b.close();process.exitCode=bad.length?1:0
