import { chromium } from 'playwright'
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:844}})
await p.goto('http://localhost:3000/index.html?qa=shots#bitacora');await p.waitForFunction(()=>window.DALI_READY);await p.waitForTimeout(1200)
console.log(await p.evaluate(()=>{const t=document.querySelector('.journal-tools'),bt=t.querySelector('.button'),cs=getComputedStyle(t),cb=getComputedStyle(bt);return {display:cs.display,flexDir:cs.flexDirection,gridCols:cs.gridTemplateColumns,wrap:cs.flexWrap,btnW:bt.offsetWidth,ws:cb.whiteSpace,flex:cb.flex,width:cb.width,parent:t.parentElement.className,pcs:getComputedStyle(t.parentElement).display+' '+getComputedStyle(t.parentElement).gridTemplateColumns}}))
await b.close()
