import { chromium } from 'playwright'
import fs from 'node:fs'
const js=fs.readFileSync('/home/user/webapp/public/kisha-character.js','utf8')
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1200,height:620}})
await p.setContent(`<html><body style="margin:0;background:radial-gradient(circle at 50% 30%,#1d2a4a,#0a0f1d);display:grid;grid-template-columns:repeat(5,1fr);gap:4px;color:#cde;font:13px sans-serif">${['idle','listening','thinking','speaking','curious','confused','supportive','happy','resting'].map(x=>`<figure style="margin:0;text-align:center"><div id="h-${x}" style="width:230px;height:230px;margin:auto"></div><figcaption>${x}</figcaption></figure>`).join('')}</body></html>`)
await p.addScriptTag({content:js})
await p.evaluate(()=>{for(const x of KishaCharacter.POSES){const c=KishaCharacter.create(document.getElementById('h-'+x),{reduced:true});c.set(x);if(x==='speaking'){c.setMouth(.8);}}})
await p.waitForTimeout(300);await p.screenshot({path:'/tmp/kisha-poses.png'});await b.close()
