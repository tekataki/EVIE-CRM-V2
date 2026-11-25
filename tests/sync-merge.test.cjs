'use strict';
// 2.5.1 · phone (web) and computer (EVIE para Windows) editing the same account: changes to different fields merge on
// their own (settings never freeze syncing again); a same-field clash inside a record still waits for the person.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const owner='11111111-1111-4111-8111-111111111111';
const source=fs.readFileSync(path.join(__dirname,'../public/sync-engine.js'),'utf8');
function server(){const records=new Map();return {records,pushes:0,async api(route,args){if(route==='data/pull')return {owner,rows:structuredClone([...records.values()]),next:''};this.pushes++;const rows=args.body.changes.map(c=>{const prev=records.get(c.collection+'/'+c.record_id);if((prev?.revision||0)!==c.expected_revision)throw Object.assign(Error('CAS conflict'),{status:409});return {...c,owner_id:owner,revision:c.expected_revision+1};});for(const r of rows)records.set(r.collection+'/'+r.record_id,structuredClone(r));return {owner,rows};}};}
function device(srv,name){
 const s={structuredClone,AbortController,setTimeout,clearTimeout};s.window=s;vm.createContext(s);vm.runInContext(source,s);
 let state={version:4,profile:{name:'Dali'},preferences:{theme:'dark',evie:{conversation:true}},transactions:[]},listener=()=>{};const cached=new Map();
 const storage={getItem:k=>cached.get(k)??null,setItem:(k,v)=>cached.set(k,v)};
 const store={collections:['transactions'],get:()=>state,validate:()=>{},save:fn=>{const next=structuredClone(state);fn(next);state=next;listener();},subscribe:fn=>{listener=fn;return()=>listener=()=>{};}};
 const engine=s.EvieSync.create({owner,storage,key:name,store,api:(...a)=>srv.api(...a)});
 return {s,engine,store,storage,get:()=>state,set:fn=>store.save(fn)};
}
async function pair(t){const srv=server(),phone=device(srv,'phone'),pc=device(srv,'pc');t.after(()=>{phone.engine.stop();pc.engine.stop();});
 assert.equal((await phone.engine.sync()).ok,true);assert.equal((await pc.engine.sync()).ok,true);return {srv,phone,pc};}

test('merge3: different fields merge, same field clashes are reported, arrays are leaves',()=>{
 const {s}=device(server(),'x'),J=v=>JSON.parse(JSON.stringify(v)),M=(...a)=>J(s.EvieSync.merge3(...a));
 const clashes=[];assert.deepEqual(M({a:1,b:2,n:{x:1,y:9}},{a:1,b:1,n:{x:1,y:1}},{a:5,b:1,n:{x:7,y:1}},clashes),{a:5,b:2,n:{x:7,y:9}});assert.deepEqual(clashes,[]);
 const c2=[];assert.deepEqual(M({t:'mine',l:[1,2]},{t:'base',l:[1]},{t:'theirs',l:[1,3]},c2),{t:'mine',l:[1,2]});assert.deepEqual(c2.sort(),['l','t']);
 const c3=[];assert.deepEqual(M({a:1,gone:true},{a:1,gone:true},{a:1},c3),{a:1},'a key removed remotely stays removed');assert.deepEqual(c3,[]);
 const c4=[];assert.deepEqual(M({evie:{wake:true}},{},{evie:{play:'x'}},c4),{evie:{wake:true,play:'x'}},'missing base counts as {}');assert.deepEqual(c4,[]);
 assert.deepEqual(M({a:1},{a:1},{a:1}),{a:1});
});

test('settings changed on the phone and on the computer both survive, and syncing never freezes',async t=>{
 const {srv,phone,pc}=await pair(t);
 pc.set(s=>{s.preferences.evie.wakeWord=true;});phone.set(s=>{s.preferences.theme='light';s.profile.name='Dalí';});
 assert.equal((await pc.engine.sync()).ok,true);
 const r=await phone.engine.sync();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(phone.engine.conflicts().length,0);
 assert.equal((await pc.engine.sync()).ok,true);
 for(const d of [phone,pc]){const st=d.get();assert.equal(st.preferences.theme,'light');assert.equal(st.preferences.evie.wakeWord,true);assert.equal(st.preferences.evie.conversation,true);assert.equal(st.profile.name,'Dalí');}
 assert.deepEqual(srv.records.get('$state/root').payload.preferences,{theme:'light',evie:{conversation:true,wakeWord:true}});
 assert.equal(phone.engine.merged(),1);
});

test('the same setting changed on both: the device syncing now wins, both versions kept in the rollback history',async t=>{
 const {phone,pc}=await pair(t);
 pc.set(s=>{s.preferences.theme='light';});phone.set(s=>{s.preferences.theme='auto';});
 assert.equal((await pc.engine.sync()).ok,true);assert.equal((await phone.engine.sync()).ok,true);assert.equal((await pc.engine.sync()).ok,true);
 assert.equal(phone.get().preferences.theme,'auto');assert.equal(pc.get().preferences.theme,'auto');
 const rb=JSON.parse(phone.storage.getItem('phone-rollback'));assert.equal(rb.at(-1).auto,true);assert.deepEqual([...rb.at(-1).merged[0].clashes],['preferences.theme']);
});

test('a record edited in different fields on each device merges; the same amount on both still asks',async t=>{
 const {srv,phone,pc}=await pair(t);
 pc.set(s=>s.transactions.push({id:'tx-1',amount:100000,category:'comida',note:''}));assert.equal((await pc.engine.sync()).ok,true);assert.equal((await phone.engine.sync()).ok,true);
 pc.set(s=>{s.transactions[0].note='tacos';});phone.set(s=>{s.transactions[0].category='salidas';});
 assert.equal((await pc.engine.sync()).ok,true);assert.equal((await phone.engine.sync()).ok,true);assert.equal((await pc.engine.sync()).ok,true);
 for(const d of [phone,pc])assert.deepEqual({...d.get().transactions[0]},{id:'tx-1',amount:100000,category:'salidas',note:'tacos'});
 assert.deepEqual(srv.records.get('transactions/tx-1').payload,{id:'tx-1',amount:100000,category:'salidas',note:'tacos'});
 pc.set(s=>{s.transactions[0].amount=300000;});phone.set(s=>{s.transactions[0].amount=400000;});
 assert.equal((await pc.engine.sync()).ok,true);const r=await phone.engine.sync();assert.equal(r.conflict,true);assert.equal(phone.get().transactions[0].amount,400000,'local edit kept until the person chooses');
});

test('EVIE para Windows keeps checking for phone changes while minimized or covered',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../public/account-ui.js'),'utf8');
 assert.match(ui,/const hiddenWeb=\(\)=>document\.hidden&&!window\.evieDesktop;/);
 assert.match(ui,/async function watchStamp\(\)\{if\(checking\|\|!openedOwner\|\|!sync\|\|!navigator\.onLine\|\|hiddenWeb\(\)\)return;/);
 assert.match(ui,/async function refreshSession\(\)\{if\(checking\|\|!openedOwner\|\|!navigator\.onLine\|\|hiddenWeb\(\)\)return;/);
});

test('a pull skipped because our own push was running never marks the phone\'s change as seen',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../public/account-ui.js'),'utf8');
 assert.match(ui,/async function syncStamped\(\)\{const s=await stampNow\(\),r=await sync\?\.sync\(\);if\(s!==null&&!r\?\.busy\)lastStamp=s;\}/);
 assert.match(ui,/r=await sync\.sync\(\);\/\*[^*]*\*\/if\(r\?\.busy\)\{setTimeout\(watchStamp,2000\);return;\}lastStamp=s;/);
});
