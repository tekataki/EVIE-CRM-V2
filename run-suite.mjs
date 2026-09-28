import {chromium} from 'playwright';
import fs from 'node:fs';
// Test-harness limit: collect repeated renderer allocations before the 1 GiB
// sandbox starts swapping. This does not change the application's memory policy.
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--js-flags=--max-old-space-size=160']});
let watchdog;
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const start=Date.now();
 const deadline=new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('CRM regression exceeded its 150-second host deadline')),150000);});
 const run=async()=>{
  await page.goto('http://localhost:3000/tests.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.QA_RESULTS,null,{timeout:140000});
  const result=await page.evaluate(()=>({result:QA_RESULTS,tests:[...document.querySelectorAll('#test-results li')].map(x=>x.textContent)}));
  Object.assign(result,{errors,durationMs:Date.now()-start,browser:await browser.version(),date:new Date().toISOString(),browserHeapLimitMB:160});
  return result;
 };
 const result=await Promise.race([run(),deadline]);
 fs.writeFileSync(process.argv[2]||'evidence/final-suite.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,tests:result.tests.filter(t=>t.startsWith('\u2717'))},null,2));
 if(result.result.failed||result.errors.length)process.exitCode=1;
}finally{
 clearTimeout(watchdog);
 await browser.close();
}
