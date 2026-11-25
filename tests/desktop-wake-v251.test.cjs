'use strict';
// 2.5.1 · «Ivi» catches the name more often: many spoken variants, a short low-confidence match counts (sensitivity
// high), and «¿Qué oye Ivi?» shows the microphone Windows listens with plus the last matches (accepted or ignored).
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {createWake}=require('../electron/voice/wake.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));

test('wake keeps the microphone name and the last matches (newest first, at most 12) for diagnostics',async()=>{
 let child;const spawn=()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};return child;};
 let t=1000;const wakes=[];const w=createWake({spawn,powershell:'ps',script:'s',onWake:x=>wakes.push(x),now:()=>t++});
 w.start();child.stdout.write('{"type":"ready","language":"es-MX","phrases":49,"microphone":"Headset Microphone (Realtek(R) Audio)","sensitivity":"high"}\n');await tick();
 assert.equal(w.status().microphone,'Headset Microphone (Realtek(R) Audio)');
 child.stdout.write('{"type":"heard","text":"ibi","confidence":"Low","ms":540,"accepted":true}\n{"type":"wake","text":"ibi","confidence":"Low"}\n{"type":"heard","text":"y vi","confidence":"Low","ms":2300,"accepted":false}\n');await tick();
 const r=w.status().recent;assert.deepEqual(r.map(x=>[x.text,x.accepted]),[['y vi',false],['ibi',true]]);assert.equal(r[1].confidence,'Low');assert.equal(r[1].ms,540);
 assert.deepEqual(wakes,[{text:'ibi',confidence:'Low'}]);
 for(let i=0;i<20;i++)child.stdout.write('{"type":"heard","text":"ivi","confidence":"High","ms":400,"accepted":true}\n');await tick();
 assert.equal(w.status().recent.length,12);
 r[0].text='changed';assert.equal(w.status().recent.some(x=>x.text==='changed'),false,'status hands out copies');
});

test('the listener knows how people say her name and accepts a short low-confidence match only on high sensitivity',()=>{
 const ps=read('scripts/wake-listener.ps1');
 for(const v of ["'ivi'","'ibi'","'evi'","'ebi'","'evie'","'eevee'","'ivy'","'y vi'"])assert.ok(ps.includes(v),v);
 for(const g of ["'oye'","'hey'","'ok'","'hola'"])assert.ok(ps.includes(g),g);
 assert.match(ps,/\$phrases=@\(\$names\)\+@\(foreach\(\$g in \$greets\)\{foreach\(\$n in \$core\)\{"\$g \$n"\}\}\)/);
 assert.match(ps,/\$accept=\(\$conf -eq 'High' -or \$conf -eq 'Medium' -or \(\$Sensitivity -eq 'high' -and \$conf -eq 'Low' -and \$ms -gt 0 -and \$ms -le 1600\)\)/);
 assert.match(ps,/\[ValidateSet\('high','normal'\)\]\[string\]\$Sensitivity='high'/);
 assert.match(ps,/EndSilenceTimeout=\[TimeSpan\]::FromMilliseconds\(350\)/);
 assert.doesNotMatch(ps,/Dictation|TopicConstraint|Invoke-WebRequest|Net\.WebClient|Out-File|Set-Content/,'phrase list only; nothing online, nothing written to disk');
});

test('«¿Qué oye Ivi?» in Configuración → Equipo shows the microphone and the last matches',()=>{
 const ui=read('public/desktop-ui.js');
 assert.match(ui,/<details class=\\?"desktop-wake-diag\\?"><summary>¿Qué oye Ivi\?<\/summary>/);
 assert.match(ui,/if\(a==='wake-diag'\)\{const st=await call\(bridge\.wake\.status\(\)\)/);
 assert.match(ui,/if\(a==='wake-mic'\)\{const r=await window\.EvieDesktopActions\.run\('open_settings',\{page:'sonido'\}\);/);
});
