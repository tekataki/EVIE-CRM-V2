// v4 shell screenshots: Finanzas (glass rails + floating mic) dark/light at 1440 and 390, and no overlap of the
// mic button with interactive elements.
import { chromium } from 'playwright'
const b=await chromium.launch({args:['--no-sandbox']});const out={}
for(const [W,H] of [[1440,900],[390,844]])for(const theme of ['dark','light']){const p=await b.newPage({viewport:{width:W,height:H},reducedMotion:'reduce'});const errs=[];p.on('pageerror',e=>errs.push(e.message))
 await p.goto('http://localhost:3000/index.html?qa=v4shell-'+theme+W);await p.waitForFunction(()=>window.DALI_READY,null,{timeout:60000})
 const r=await p.evaluate(async t=>{Store.save(s=>{s.preferences.evieModulesChosen=true;s.preferences.theme=t;});window.Neural?.dismiss?.();location.hash='finanzas';await new Promise(r=>setTimeout(r,1500));
  const cs=sel=>{const n=document.querySelector(sel);if(!n)return null;const c=getComputedStyle(n);return {bf:c.backdropFilter||c.webkitBackdropFilter,bg:c.backgroundColor};};
  const fab=document.getElementById('evie-mic-fab');let overlap=null;if(fab&&!fab.hidden){const f=fab.getBoundingClientRect();overlap=[...document.querySelectorAll('main button, main a, main input, main select, #ivy-intelligence a, #ivy-intelligence button, #ivy-intelligence p, #ivy-intelligence h2, #ivy-intelligence h3, #ivy-intelligence strong')].filter(n=>{const q=n.getBoundingClientRect();return q.width&&q.right>f.left&&q.left<f.right&&q.bottom>f.top&&q.top<f.bottom;}).length;}
  return {side:cs('.sidebar'),top:cs('.topbar'),rail:cs('.ivy-intelligence'),fab:fab?!fab.hidden:false,overlap,hscroll:document.documentElement.scrollWidth>innerWidth+1};},theme)
 await p.screenshot({path:`evidence/v4-shell-${theme}-${W}.png`,timeout:15000,animations:'disabled'}).catch(()=>{});out[theme+W]={...r,errs:errs.length};await p.close()}
console.log(JSON.stringify(out,null,1));await b.close()
