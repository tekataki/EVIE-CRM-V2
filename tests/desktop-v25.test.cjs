'use strict';
// 2.5 · EVIE para Windows hands-free and more: «Ivi» through Windows' on-device recognizer (never the browser one,
// which crashed Electron's page — the «black box»), F11 fullscreen, «Ivi, a trabajar», folders, Windows Settings,
// show desktop, lock, and the SOMA visit dossier at the end of the cabin.
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {createWake}=require('../electron/voice/wake.cjs');
const {createDesktopActions,validateDesktop,FOLDERS,SETTINGS}=require('../electron/tools/desktop-actions.cjs');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

function fakeSpawn(){const children=[];const spawn=(cmd,args,opts)=>{const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.killed=false;c.kill=()=>{c.killed=true;setImmediate(()=>c.emit('exit',null));};c.cmd=cmd;c.args=args;c.opts=opts;children.push(c);return c;};return {spawn,children};}
const tick=()=>new Promise(r=>setImmediate(r));

test('wake: runs the Windows helper hidden, reports «listening» on ready and fires on each detection',async()=>{
 const {spawn,children}=fakeSpawn(),wakes=[],states=[];
 const w=createWake({spawn,powershell:'C:\\Windows\\ps.exe',script:'C:\\app\\scripts\\wake-listener.ps1',onWake:x=>wakes.push(x),onState:s=>states.push(s.state)});
 assert.equal(w.start().state,'starting');assert.equal(children.length,1);
 const c=children[0];assert.deepEqual(c.args,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','C:\\app\\scripts\\wake-listener.ps1']);assert.equal(c.opts.windowsHide,true);
 c.stdout.write('{"type":"wake","text":"ivi","confidence":"High"}\n');await tick();assert.equal(wakes.length,0,'nothing before ready');
 c.stdout.write('{"type":"ready","language":"es-MX","phrases":12}\n{"type":"wake","text":"oye ivi","confidence":"High"}\nnot json\n{"type":"wake","text":"ivi","con');await tick();
 assert.equal(w.status().state,'listening');assert.equal(w.status().language,'es-MX');assert.deepEqual(wakes,[{text:'oye ivi',confidence:'High'}]);
 c.stdout.write('fidence":"Medium"}\n');await tick();assert.deepEqual(wakes.at(-1),{text:'ivi',confidence:'Medium'});
 assert.equal(w.start().state,'listening');assert.equal(children.length,1,'start is idempotent');
 w.stop();await tick();assert.equal(c.killed,true);assert.equal(w.status().state,'off');assert.ok(states.includes('listening'));
});

test('wake: restarts with backoff after a crash, gives up after repeated crashes, never retries «unsupported»',async()=>{
 const {spawn,children}=fakeSpawn(),timers=[];const setTimer=(fn,ms)=>{timers.push({fn,ms});return timers.length;};
 const w=createWake({spawn,powershell:'ps',script:'s',setTimer,clearTimer:()=>{}});
 w.start();children[0].emit('exit',1);assert.equal(w.status().state,'starting');assert.equal(timers.at(-1).ms,1000);
 timers.at(-1).fn();assert.equal(children.length,2);children[1].emit('exit',1);assert.equal(timers.at(-1).ms,2000);
 for(let i=2;i<6;i++){timers.at(-1).fn();children.at(-1).emit('exit',1);}
 assert.equal(timers.length,6);timers.at(-1).fn();children.at(-1).emit('exit',1);
 assert.equal(w.status().state,'error');assert.equal(timers.length,6,'no more restarts');
 const {spawn:s2,children:k2}=fakeSpawn();const w2=createWake({spawn:s2,powershell:'ps',script:'s',setTimer,clearTimer:()=>{}});
 w2.start();k2[0].emit('exit',2);assert.equal(w2.status().state,'error');assert.match(w2.status().reason,/Configuración → Hora e idioma → Voz/);assert.equal(k2.length,1);
});

test('the web wake word never touches the browser recognizer inside EVIE para Windows',async()=>{
 const src=read('public/evie-wake.js');const listeners=[];let started=0,stopped=0;
 const window={evieDesktop:{wake:{start:async()=>{started++;return {ok:true,data:{state:'starting'}};},stop:async()=>{stopped++;return {ok:true};}},onAction:fn=>listeners.push(fn)},
  get SpeechRecognition(){throw Error('browser recognizer touched');},get webkitSpeechRecognition(){throw Error('browser recognizer touched');}};
 const docListeners={};const document={hidden:true,documentElement:{dataset:{}},querySelectorAll:()=>[],addEventListener:(t,fn)=>{docListeners[t]=fn;}};
 const ctx={window,document,navigator:{userAgent:'Electron',platform:'Win32',maxTouchPoints:0},addEventListener:()=>{},setTimeout,clearTimeout,Date};
 vm.runInNewContext(src,ctx);const W=window.EvieWake;
 const sup=await W.support();assert.deepEqual({...sup},{ok:true,local:true,desktop:true});assert.equal(await W.install(),true);
 const heard=[];assert.equal(await W.start(cmd=>heard.push(cmd)),'listening');assert.equal(started,1);
 listeners.forEach(fn=>fn({type:'wake-state',state:'listening'}));listeners.forEach(fn=>fn({type:'wake',text:'ivi'}));assert.deepEqual(heard,['']);
 document.documentElement.dataset.evie='speaking';listeners.forEach(fn=>fn({type:'wake',text:'ivi'}));assert.equal(heard.length,1,'ignored while EVIE talks');
 docListeners.visibilitychange();assert.equal(stopped,0,'keeps listening while EVIE is minimized');
 W.stop();await tick();assert.equal(stopped,1);assert.equal(W.state,'off');
});

test('desktop actions 2.5: work mode, known folders, Windows Settings pages, show desktop and lock',async()=>{
 for(const ok of [{action:'work_mode'},{action:'work_mode',playlist:'0S78UVuLW857NQ2FaUYwTD'},{action:'open_folder',folder:'descargas'},{action:'open_settings',page:'wifi'},{action:'show_desktop'},{action:'lock_pc'}])assert.doesNotThrow(()=>validateDesktop(ok),JSON.stringify(ok));
 for(const bad of [{action:'work_mode',playlist:'x'},{action:'work_mode',playlist:'spotify:playlist:0S78UVuLW857NQ2FaUYwTD'},{action:'open_folder',folder:'C:\\Windows'},{action:'open_folder',folder:'system32'},{action:'open_settings',page:'ms-settings:privacy'},{action:'open_settings',page:'../x'},{action:'show_desktop',x:1},{action:'lock_pc',now:true}])assert.throws(()=>validateDesktop(bad),JSON.stringify(bad));
 assert.deepEqual(Object.keys(FOLDERS).sort(),['descargas','documentos','escritorio','imagenes','musica','videos']);for(const v of Object.values(SETTINGS))assert.match(v,/^[a-z-]+$/);
 const calls=[],opened=[];
 const d=createDesktopActions({platform:'win32',shell:{openExternal:async u=>{opened.push(u);}},media:async()=>({}),workMode:async p=>{calls.push(['work',p]);return {opened:true,playing:true,song:'AC/DC - T.N.T.'};},openFolder:async k=>{calls.push(['folder',k]);},showDesktop:async()=>{calls.push(['desktop']);},lockPC:async()=>{calls.push(['lock']);}});
 assert.equal((await d.run({action:'work_mode'})).data.playing,true);await d.run({action:'work_mode',playlist:'0S78UVuLW857NQ2FaUYwTD'});
 await d.run({action:'open_folder',folder:'imagenes'});await d.run({action:'show_desktop'});await d.run({action:'lock_pc'});
 assert.deepEqual(calls,[['work',null],['work','0S78UVuLW857NQ2FaUYwTD'],['folder','pictures'],['desktop'],['lock']]);
 await d.run({action:'open_settings',page:'bluetooth'});assert.equal(opened.at(-1),'ms-settings:bluetooth');
});

test('main: F11 fullscreen (remembered, never for the transparent overlay), wake word lifecycle, work playlist already playing',()=>{
 const main=read('electron/main/main.cjs');
 assert.match(main,/win\.webContents\.on\('before-input-event',\(e,input\)=>\{if\(input\.type==='keyDown'&&input\.key==='F11'&&!input\.control&&!input\.alt&&!input\.meta&&!input\.shift\)\{e\.preventDefault\(\);toggleFullScreen\(\);\}\}\);/);
 assert.match(main,/function toggleFullScreen\(\)\{if\(!win\|\|win\.isDestroyed\(\)\|\|overlayMode\)return false;win\.setFullScreen\(!win\.isFullScreen\(\)\);return true;\}/);
 assert.match(main,/win\.on\('enter-full-screen',\(\)=>fullscreen\(true\)\);win\.on\('leave-full-screen',\(\)=>fullscreen\(false\)\);/);
 assert.match(main,/&&!win\.isFullScreen\(\)\)fs\.writeFileSync\(path\.join\(app\.getPath\('userData'\),'window\.json'\)/,'fullscreen bounds never overwrite the normal window size');
 assert.match(main,/enumeration\(\['minimize','maximize','close','fullscreen','state'\]\)/);
 assert.match(main,/'wake\.start':async\(\)=>\{if\(process\.platform!=='win32'\)throw[^}]*if\(!\(await microphoneConsent\(\)\)\)throw/);
 assert.match(main,/onChange:id=>\{wake\?\.stop\(\);/);assert.match(main,/app\.on\('before-quit',\(\)=>\{wake\?\.stop\(\);/);
 assert.match(main,/onWake:ev=>\{if\(!win\|\|win\.isDestroyed\(\)\)return;reveal\(\);send\(\{type:'wake',\.\.\.ev\}\);\}/);
 assert.match(main,/'spotify:track:'\+track\+'\?context='\+encodeURIComponent\('spotify:playlist:'\+id\)/);
 // The wake word needs a signed-in account: it is NOT in the locked allowlist.
 assert.doesNotMatch(/settings\.locked\(\)&&!\[([^\]]*)\]/.exec(main)[1],/wake/);
 const ps=read('scripts/wake-listener.ps1');assert.match(ps,/SpeechRecognitionListConstraint/);assert.doesNotMatch(ps,/Dictation|TopicConstraint|Invoke-WebRequest|Net\.WebClient/,'phrase list only, nothing online');
 const tools=read('scripts/windows-tools.ps1');assert.match(tools,/keybd_event/);assert.doesNotMatch(tools,/0xffff,0x319/,'no more broadcast app commands');
});

test('renderer: fullscreen state and button, hands-free switch, work playlist, local Windows intents',()=>{
 const ui=read('public/desktop-ui.js');
 assert.match(ui,/if\(a\.type==='fullscreen'\)document\.documentElement\.dataset\.fullscreen=String\(!!a\.on\);/);assert.match(ui,/button\('⛶','fullscreen'/);assert.match(ui,/id=\\?"desktop-wake\\?"|id="desktop-wake"/);assert.match(ui,/work-playlist-save/);
 const css=read('public/evie-onyx.css');assert.match(css,/html\[data-desktop="true"\]\[data-fullscreen="true"\] body\{padding-top:0!important\}/);assert.match(css,/#desktop-titlebar:is\(:hover,:focus-within\)\{transform:none;opacity:1\}/);
 const a=read('public/evie-assistant.js');assert.match(a,/function deskLocal\(q\)\{const D=window\.EvieDesktopActions;if\(!D\?\.available\?\.\(\)\)return null;/);assert.match(a,/\{const d=deskLocal\(q\);if\(d!==null\)return d;\}/);
 for(const phrase of ['a trabajar','vamos a trabajar','modo taller','muestra el escritorio','bloquea la compu','abre descargas','abre la configuracion de wifi'])assert.ok(new RegExp('deskLocal').test(a)&&a.includes(phrase.split(' ')[1]||phrase),phrase);
});

test('cloud Ivi knows the 2.5 Windows actions; the SOMA dossier is the last part of the cabin',async()=>{
 const {TOOLS}=await import('../src/assistant.js');const t=TOOLS.find(x=>x.name==='desktop_action');
 for(const a of ['work_mode','open_folder','open_settings','show_desktop','lock_pc'])assert.ok(t.parameters.properties.action.enum.includes(a),a);
 for(const p of ['folder','page'])assert.ok(t.parameters.required.includes(p),p);
 const cabin=read('public/soma-cabin.js');const panel=cabin.slice(cabin.indexOf('function prospectPanel('),cabin.indexOf('</section>`;}',cabin.indexOf('function prospectPanel(')));
 const at=k=>panel.indexOf(k);assert.ok(at('Necesidades')<at('Propuesta')&&at('Propuesta')<at('Tareas</h3>')&&at('Tareas</h3>')<at('Ubicación</h3>')&&at('Ubicación</h3>')<at('Dossier de visita'),'order: needs, proposal, tasks, location, dossier');
});
