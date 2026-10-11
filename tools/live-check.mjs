import { chromium } from 'playwright'
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('https://evie-crm-v2.pages.dev/');await p.waitForTimeout(5000);await p.screenshot({path:'evidence/shots/live-login-390.png'})
console.log(await p.evaluate(()=>({gate:!!document.getElementById('account-gate'),h1:document.querySelector('#account-gate h1')?.textContent})),errs.length?errs:'no errors');await b.close()
