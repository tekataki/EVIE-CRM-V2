// E2E v2.4 M9 (v4: under Físico → Entrenamientos / Comidas; pantry in Compras): registro manual de gym, pestañas simplificadas, menores sin IMC, despensa en Finanzas.
import { chromium } from 'playwright'
const W=Number(process.env.W||390)
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:W,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:3000/index.html?qa=e2e-gym-'+Date.now());await p.waitForFunction(()=>window.DALI_READY)
const r=await p.evaluate(async()=>{const out={};const wait=ms=>new Promise(r=>setTimeout(r,ms));const until=async(f,ms=4000)=>{const t=Date.now();while(Date.now()-t<ms){if(f())return true;await wait(50);}return false;};
 location.hash='gimnasio';await until(()=>UI.section==='fisico');UI.fisicoTab='entrenos';UI.rcGymTab='training';App.render();await until(()=>document.querySelector('.gym-tabs'));out.aliasHash=location.hash;
 out.heading=document.querySelector('main .page-heading p')?.textContent||'';out.noSymmetryHeading=!/Symmetry/.test(document.querySelector('main .page-heading')?.textContent||'');
 out.groups=[...document.querySelectorAll('.gym-tab-group>small')].map(x=>x.textContent);out.tabs=[...document.querySelectorAll('.gym-tabs [data-action="rc-gym-section"]')].map(x=>x.textContent.trim());
 out.importIsSecondary=!document.querySelector('[data-action="gym-upload"]')?.classList.contains('primary');
 const before=Store.list('gymSessions').length;document.querySelector('[data-evg="new"]').click();await until(()=>document.querySelector('.gl-form'));
 const f=document.querySelector('.gl-form');f.elements.title.value='Pierna QA';f.elements.minutes.value='50';
 const ex=f.querySelector('[data-gl-ex]');ex.querySelector('[name=name]').value='Sentadilla';ex.querySelector('[name=muscle]').value='quads';ex.querySelector('[name=sets]').value='3';ex.querySelector('[name=reps]').value='8';ex.querySelector('[name=weight]').value='70';
 f.querySelector('[data-evg="add-ex"]').click();const ex2=f.querySelectorAll('[data-gl-ex]')[1];ex2.querySelector('[name=name]').value='Plancha';ex2.querySelector('[name=detail]').value='x60, x45';
 out.formOverflow=[...f.querySelectorAll('.gl-ex input,.gl-ex select')].some(x=>x.getBoundingClientRect().right>f.getBoundingClientRect().right+1);
 f.requestSubmit();await until(()=>Store.list('gymSessions').length>before);await wait(300);
 const s=Store.list('gymSessions').at(-1);out.saved=Store.list('gymSessions').length-before;out.source=s?.source;out.sets=s?.reported_total_sets;out.vol=s?.reported_volume_kg;out.hash=location.hash;
 out.detailEdit=!!document.querySelector('[data-evg="edit"]');
 document.querySelector('[data-evg="repeat"]').click();await until(()=>document.querySelector('.gl-form'));out.repeatPrefill=document.querySelector('.gl-form').elements.title.value;App.closeDialog(true);
 // menor de edad
 Store.save(st=>{st.preferences.evieNutrition={sex:'f',age:15,weight:55,height:160,activity:1.55,goal:'cut'};});location.hash='fisico';await wait(200);UI.fisicoTab='comidas';UI.rcGymTab='nutrition';App.render();await until(()=>document.querySelector('#evm-calories'));
 const cal=document.querySelector('#evm-calories').textContent;out.minorNoBMI=!/IMC\s*\d/.test(cal.replace(/IMC (infantil|de adulto)/g,''));out.minorLabel=/Estimación orientativa/.test(cal);out.goalHidden=document.querySelector('#evm-cal-form select[name=goal]').closest('label').hidden;
 Store.save(st=>{st.preferences.evieNutrition={sex:'f',age:30,weight:65,height:165,activity:1.55,goal:'cut'};});App.render();await until(()=>document.querySelector('#evm-calories'));out.adultBMI=/IMC/.test(document.querySelector('#evm-calories').textContent);
 // despensa en finanzas
 location.hash='compras';await until(()=>document.querySelector('#ev-pantry'));out.pantryInFinance=!!document.querySelector('#ev-pantry [data-action="rc-pantry-edit"]');
 location.hash='fisico';await wait(400);document.querySelector('[data-fis="tab"][data-tab="comidas"]')?.click();await wait(300);out.nutritionLink=!!document.querySelector('main a[href="#compras"]');
 out.pageOverflow=document.documentElement.scrollWidth>innerWidth+1;
 return out;});
console.log(JSON.stringify(r),errs.length?errs:'no errors')
const ok=r.noSymmetryHeading&&r.aliasHash==='#fisico'&&r.groups.join()==='Entrenamiento'&&r.tabs.length===4&&r.importIsSecondary&&r.saved===1&&r.source==='manual'&&r.sets===5&&r.vol===1680&&r.hash.startsWith('#fisico/')&&r.detailEdit&&r.repeatPrefill==='Pierna QA'&&r.minorNoBMI&&r.minorLabel&&r.goalHidden&&r.adultBMI&&r.pantryInFinance&&r.nutritionLink&&!r.formOverflow&&!r.pageOverflow&&!errs.length
console.log(ok?'E2E GYM OK':'E2E GYM FAIL');await b.close();process.exitCode=ok?0:1
