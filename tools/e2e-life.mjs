// E2E: hábitos, logros (idempotencia), compras→finanzas (sin duplicar; v4: las listas viven en #compras), tendencias.
import { chromium } from 'playwright'
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:3000/index.html?qa=e2e-life-'+Date.now());await p.waitForFunction(()=>window.DALI_READY)
const r=await p.evaluate(async()=>{const out={};const wait=ms=>new Promise(r=>setTimeout(r,ms));
 Store.save(s=>{s.evieData={v:1,habits:[{id:'h-1',title:'Leer',cat:'aprendizaje',kind:'binary',target:1,unit:'',days:[0,1,2,3,4,5,6],minimum:'2 páginas',start:Domain.today(),tz:'America/Mexico_City'}],completions:[],events:[],awards:[],lists:[],settings:{gamification:true,sound:false,trendsPrivate:false}};});
 EvieLife.complete('h-1');EvieLife.complete('h-1');
 const d=EvieLife.data();out.completions=d.completions.filter(c=>!c.undone).length;out.doneToday=EvieLife.todayList()[0].done;out.awardsAfter=d.awards.map(a=>a.id).sort();
 EvieLife.undo('h-1');out.afterUndo=EvieLife.todayList()[0].done;EvieLife.complete('h-1');
 out.awardsNoDup=new Set(EvieLife.data().awards.map(a=>a.id)).size===EvieLife.data().awards.length;
 out.trendEvents=EvieLife.activity(V2Domain.addDays(Domain.today(),-7)).length;
 Store.save(s=>{s.evieData.lists.push({id:'l-1',name:'Súper',items:[{id:'i-1',name:'Leche',qty:2,price:2500,bought:true},{id:'i-2',name:'Pan',qty:1,price:3000,bought:false}],budget:10000});});
 const tx0=Store.list('transactions').length;
 location.hash='compras';await wait(600);
 document.querySelector('[data-evl="list-open"][data-id="l-1"]').click();await wait(200);
 document.querySelector('[data-evl="list-post"]').click();await wait(200);
 document.querySelector('#ev-post').requestSubmit();await wait(300);
 out.txAdded=Store.list('transactions').length-tx0;out.txAmount=Store.list('transactions').at(-1).amount;
 document.querySelector('[data-evl="list-open"][data-id="l-1"]')?.click();await wait(200);
 out.postDisabled=document.querySelector('[data-evl="list-post"]').disabled;
 return out;});
console.log(JSON.stringify(r),errs.length?errs:'no errors')
const ok=r.completions===1&&r.doneToday&&!r.afterUndo&&r.awardsNoDup&&r.awardsAfter.includes('first-habit')&&r.trendEvents>=1&&r.txAdded===1&&r.txAmount===5000&&r.postDisabled&&!errs.length
console.log(ok?'E2E OK':'E2E FAIL');await b.close();process.exitCode=ok?0:1
