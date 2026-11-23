'use strict';
// 2.3.2 regression: before any session exists the desktop host is "locked", and the lock used to block the very
// request that opens Google in the browser (the sign-in screen then waited forever). These checks read the
// sources because main.cjs only runs inside Electron.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(ROOT,'electron/main/main.cjs'),'utf8');
const ui=fs.readFileSync(path.join(ROOT,'public/account-ui.js'),'utf8');

test('the desktop lock lets google.signin through before a session exists',()=>{
 const m=/settings\.locked\(\)&&!\[([^\]]*)\]\.includes\(message\.method\)/.exec(main);
 assert.ok(m,'the locked() guard is still in evie:request');
 const allowed=m[1].split(',').map(s=>s.trim().replace(/^'|'$/g,''));
 const expected=['account','window','cancel','google.signin','update.status','update.install'];
 for(const method of expected)assert.ok(allowed.includes(method),method+' allowed while locked');
 // Nothing else that needs a signed-in account slipped into the list (updates may install from the sign-in screen).
 assert.deepEqual(allowed.filter(x=>!expected.includes(x)),[]);
});

test('google.signin needs the cloud origin and only opens an https URL',()=>{
 const body=/'google\.signin':async\(\)=>\{([\s\S]*?)return \{opened:true\};\}/.exec(main);
 assert.ok(body,'google.signin handler present');
 assert.match(body[1],/if\(!accountOrigin\)throw/);
 assert.match(body[1],/desktop_nonce_hash:hash/);
 assert.match(body[1],/\/\^https:\\\/\\\/\/\.test\(r\?\.url\|\|''\)/);
 assert.match(body[1],/shell\.openExternal\(r\.url\)/);
});

test('a QA profile never takes over the evie-crm:// handler of the installed app',()=>{
 const calls=main.match(/setAsDefaultProtocolClient\(/g)||[];
 assert.equal(calls.length,1);
 assert.match(main,/if\(!qaProfile&&!app\.isDefaultProtocolClient\('evie-crm'\)\)app\.setAsDefaultProtocolClient\('evie-crm'/);
 // The deep link itself is handled through the single-instance lock, which also works for test profiles.
 assert.match(main,/app\.on\('second-instance',\(_e,argv\)=>\{const link=\(argv\|\|\[\]\)\.find\(a=>typeof a==='string'&&a\.startsWith\('evie-crm:\/\/'\)\);if\(link\)handleDeepLink\(link\);/);
});

test('the sign-in screen surfaces a desktop failure instead of waiting',()=>{
 const fn=/async function googleStart\(btn,invite\)\{([\s\S]*?)\n/.exec(ui);
 assert.ok(fn,'googleStart present');
 const desktop=/if\(window\.evieDesktop\?\.googleSignIn\)\{([\s\S]*?)return;\}/.exec(fn[1]);
 assert.ok(desktop,'desktop branch present');
 assert.match(desktop[1],/const r=await window\.evieDesktop\.googleSignIn\(\);if\(r&&r\.ok===false\)throw Error\(/);
 // The "browser opened" note comes only after the check, and the button comes back for a retry.
 assert.ok(desktop[1].indexOf('r.ok===false')<desktop[1].indexOf('Se abrió tu navegador'));
 assert.match(desktop[1],/btn\.disabled=false/);
});
