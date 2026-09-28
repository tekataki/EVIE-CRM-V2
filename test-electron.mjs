import {_electron as electron} from 'playwright';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'evie-electron-qa-')),checks=[];let app;
try{
 const packaged=process.env.EVIE_PACKAGED_EXECUTABLE;
 app=await electron.launch({...(packaged?{executablePath:path.resolve(packaged)}:{}),args:[...(process.platform==='linux'?['--no-sandbox']:[]),'--use-fake-device-for-media-stream',...(packaged?[]:[path.resolve('.')])],env:{...process.env,XDG_CONFIG_HOME:profile,APPDATA:profile},timeout:45000});
 const actualProfile=await app.evaluate(({app})=>app.getPath('userData'));assert.ok(actualProfile.startsWith(profile+path.sep),'QA must never use personal profile');
 app.process().stderr.on('data',d=>process.stderr.write(d));
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>window.DALI_READY,{},{timeout:20000});await page.evaluate(()=>{Neural.dismiss();document.getElementById('desktop-setup-wizard')?.close();});
 const state=await page.evaluate(()=>({desktop:!!window.evieDesktop,node:typeof window.require,version:Store.get().version,key:DALI_CONFIG.storageKey}));assert.equal(state.desktop,true);assert.equal(state.node,'undefined');assert.equal(state.version,4);assert.equal(state.key,'dali-os-local-v1');checks.push('Origen desktop estable y Node no expuesto');
 await page.evaluate(()=>evieDesktop.configure({setupDone:true}));
 const diag=await page.evaluate(()=>evieDesktop.diagnostics());assert.equal(diag.ok,true);assert.equal(diag.data.agenda.readable,true);checks.push('IPC y lectura real de Agenda');
 const bad=await page.evaluate(()=>evieDesktop.tool('execute_command',{command:'whoami'}));assert.equal(bad.ok,false);checks.push('Herramienta no autorizada rechazada');
 const malformed=await page.evaluate(()=>evieDesktop.tool('windows.set_volume',{level:'100;cmd'}));assert.equal(malformed.ok,false);checks.push('IPC rechaza argumentos inválidos');
 // Test-only button decisions travel through the real expiring confirmation IPC.
 await page.evaluate(()=>{window.qaApprove=false;evieDesktop.onAction(a=>{if(a.type==='confirmation'){window.qaLastToken=a.token;void evieDesktop.confirm(a.token,window.qaApprove);}});});
 const denied=await page.evaluate(()=>evieDesktop.tool('crm.create_task',{title:'QA rechazado'}));assert.equal(denied.data.ok,false);assert.equal(await page.evaluate(()=>Store.list('agendaItems').length),0);checks.push('Rechazo nativo no escribe');
 await page.evaluate(()=>window.qaApprove=true);await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
 const created=await page.evaluate(()=>evieDesktop.tool('crm.create_event',{title:'QA cita',date:Domain.today(),time:'16:00'}));assert.equal(created.data.ok,true);const id=created.data.data.record.id;checks.push('Alta por bridge con confirmación IPC simulada en QA');
 const changed=await page.evaluate(id=>evieDesktop.tool('crm.update_event',{id,date:V2Domain.addDays(Domain.today(),1),time:'17:00'}),id);assert.equal(changed.data.ok,true);assert.ok(changed.data.data.record.start.endsWith('17:00'));checks.push('Reprogramación verificada por bridge');
 const replay=await page.evaluate(()=>evieDesktop.confirm(window.qaLastToken,true));assert.equal(replay.ok,false);checks.push('Confirmación de un solo uso rechaza repetición');
 const financial=await page.evaluate(()=>evieDesktop.tool('finance.create_transaction',{title:'Venta de Intensity',amount:100000,type:'income',category:'Ventas',entity_name:'Intensity'}));assert.equal(financial.data.ok,true);assert.equal(financial.data.data.record.amount,100000);checks.push('Finanzas real en centavos por bridge y confirmación');
 assert.equal(await page.locator('#desktop-setup-wizard').count(),0);checks.push('Sin configuración automática');
 await page.reload();await page.waitForFunction(()=>window.DALI_READY);assert.equal(await page.evaluate(id=>Store.list('agendaItems').find(x=>x.id===id).title,id),'QA cita');checks.push('Recarga conserva registro desktop');
 await page.evaluate(()=>{Neural.dismiss();UI.section='configuracion';App.render();});assert.equal(await page.locator('#desktop-settings').count(),1);checks.push('Configuración desktop renderiza');
 await page.evaluate(()=>DesktopVoice.state('idle'));
 const read=await page.evaluate(()=>evieDesktop.tool('crm.get_today_agenda',{}));assert.equal(read.data.ok,true);await page.waitForFunction(()=>IvyState.get().phase==='success');checks.push('Consulta desde idle alcanza success sin transición inválida');
 await page.evaluate(()=>{DesktopVoice.state('idle');IvyChat.open();});assert.equal(await page.locator('#local-ivy-dialog').evaluate(el=>el.open),true);assert.equal(await page.locator('#dali-core-menu').count(),0);checks.push('Acceso legado abre conversación local, no dictado cloud');
 await page.evaluate(()=>new Promise(resolve=>{const dlg=document.getElementById('local-ivy-dialog');dlg.addEventListener('close',()=>setTimeout(resolve,0),{once:true});dlg.close();}));
 await page.evaluate(()=>DesktopVoice.start({diagnostic:true}));await page.waitForFunction(()=>DesktopVoice.stats().mode==='listening');assert.equal(await page.evaluate(()=>DesktopVoice.stats().tracks),1);await page.waitForFunction(()=>DesktopVoice.sample().level>0.001,{},{timeout:10000});checks.push('AudioWorklet y analyser reciben micrófono sintético real de Chromium');
 await page.evaluate(()=>DesktopVoice.stop());assert.equal(await page.evaluate(()=>DesktopVoice.stats().tracks),0);assert.equal(await page.evaluate(()=>DesktopVoice.stats().frames),false);checks.push('Detener libera micrófono y RAF');
 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(packaged?'evidence/phase3-packaged-electron.json':'evidence/phase3-electron.json',JSON.stringify({date:new Date().toISOString(),platform:process.platform,passed:checks.length,checks,errors,packaged:!!packaged,limits:'Confirmaciones IPC automatizadas y micrófono sintético Chromium; sin hardware, Windows, Whisper, SAPI ni Ollama reales.'},null,2));console.log(JSON.stringify({passed:checks.length,errors}));
}finally{if(app)await app.close();fs.rmSync(profile,{recursive:true,force:true});}
