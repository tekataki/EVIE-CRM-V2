'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const sourceKey='dali-os-local-v1',scope=id=>'evie-account-'+id;
function fixture({missing=false}={}){
 let owner=A,state={version:4,revision:0,transactions:[],mediaMetadata:[]};
 const source={version:4,revision:42,transactions:[{id:'Legacy-AbC-01',amount:12345}],mediaMetadata:[{id:'Image-AbC-01'}]};
 const raw=JSON.stringify(source,null,2)+'\n',items=new Map([[sourceKey,raw]]),databases=new Map(),blobs=[{id:'Image-AbC-01',blob:new Blob(['original-image']),thumbnail:new Blob(['thumbnail']),width:2,height:2}];
 const storage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,String(v)),removeItem:k=>items.delete(k)};
 const target=id=>{if(!databases.has(id))databases.set(id,new Map());return databases.get(id);};
 const media={capture(){const key=scope(owner),db=target(owner);return {key,get:async id=>db.get(id),add:async r=>{if(db.has(r.id))throw Error('duplicate image');db.set(r.id,r);await media.afterAdd?.(r);},remove:async id=>{if(media.failRemove)throw Error('quota');db.delete(id);}};}};
 const Store={collections:['transactions','mediaMetadata'],get:()=>state,validate:s=>{assert.equal(s.version,4);assert.ok(Array.isArray(s.transactions));},save:fn=>{if(Store.failSave)throw Error('quota');const next=structuredClone(state);fn(next);next.revision=state.revision+1;state=next;}};
 const indexedDB={open(){const req={};queueMicrotask(()=>{req.result={close(){},transaction(){return {objectStore(){return {getAll(){const r={};queueMicrotask(()=>{r.result=missing?[]:structuredClone(blobs);r.onsuccess();});return r;}};}};}};req.onsuccess();});return req;}};
 const s={console,Blob,JSZip,TextEncoder,crypto,structuredClone,indexedDB,localStorage:storage,Store,MediaStore:media,EvieAccounts:{current:()=>({id:owner,username:'test'}),config:()=>({legacyOwnerId:A}),scope},DALI_CONFIG:{get storageKey(){return scope(owner);}}};
 s.window=s;vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(root,'public/legacy-migration.js'),'utf8'),s);
 return {api:s.LegacyMigration,storage,items,source,raw,Store,media,target,setOwner:id=>owner=id};
}
const options={confirmed:true,download:async()=>{}};
test('legacy migration is explicit and rejects unauthorized and unconfirmed imports',async()=>{
 const f=fixture();assert.equal(f.items.size,1);f.setOwner(B);await assert.rejects(f.api.prepare(),/autorizada/);f.setOwner(A);const p=await f.api.prepare();await assert.rejects(f.api.commit(p),/confirmación/);await assert.rejects(f.api.commit({...p},options),/vista previa/);assert.equal(f.Store.get().transactions.length,0);
});
test('legacy ZIP preserves source bytes, text IDs, media and hashes without modifying source',async()=>{
 const f=fixture(),p=await f.api.prepare();let backup;const result=await f.api.commit(p,{confirmed:true,download:async b=>backup=b});
 const zip=await JSZip.loadAsync(await backup.arrayBuffer());assert.equal(await zip.file('data.json').async('string'),f.raw);
 assert.equal(await zip.file('media/Image-AbC-01.webp').async('string'),'original-image');assert.equal(await zip.file('media/Image-AbC-01-thumb.webp').async('string'),'thumbnail');
 const manifest=JSON.parse(await zip.file('manifest.json').async('string'));assert.equal(manifest.source_sha256,result.source_sha256);assert.equal(manifest.media[0].sha256.length,64);
 assert.equal(f.Store.get().transactions[0].id,'Legacy-AbC-01');assert.equal(f.Store.get().transactions[0].amount,12345);assert.equal(f.storage.getItem(sourceKey),f.raw);assert.equal(f.storage.getItem(result.backupKey),f.raw);
 assert.equal(result.localVerified,true);assert.equal(result.cloudVerified,false);assert.equal(JSON.parse(f.storage.getItem(scope(A)+'-legacy-import')).phase,'complete');await assert.rejects(f.api.commit(p,options),/vacía|registrada/);
});
test('mutating a preview cannot inject unvalidated records into the import',async()=>{const f=fixture(),p=await f.api.prepare();p.state.transactions[0].id='INJECTED';p.media.length=0;await f.api.commit(p,options);assert.equal(f.Store.get().transactions[0].id,'Legacy-AbC-01');assert.equal(f.target(A).size,1);});
test('missing legacy media blocks preview without writes',async()=>{const f=fixture({missing:true});await assert.rejects(f.api.prepare(),/Faltan/);assert.equal(f.items.size,1);});
test('changed source or nonempty target blocks migration',async()=>{const f=fixture(),p=await f.api.prepare();f.storage.setItem(sourceKey,f.raw+' ');await assert.rejects(f.api.commit(p,options),/cambiaron/);f.storage.setItem(sourceKey,f.raw);f.Store.save(s=>s.transactions.push({id:'existing'}));await assert.rejects(f.api.commit(p,options),/vacía/);});
test('download failure and backup quota failure never import records or images',async()=>{for(const kind of ['download','quota']){const f=fixture(),p=await f.api.prepare();if(kind==='quota')f.storage.setItem=()=>{throw Error('quota');};await assert.rejects(f.api.commit(p,{confirmed:true,download:async()=>{throw Error('download');}}),/quota|download/);assert.equal(f.Store.get().transactions.length,0);assert.equal(f.target(A).size,0);assert.equal(f.storage.getItem(sourceKey),f.raw);}});
test('failed Store commit removes only newly copied destination images',async()=>{const f=fixture(),p=await f.api.prepare();f.target(A).set('other-image',{id:'other-image'});f.Store.failSave=true;await assert.rejects(f.api.commit(p,options),/quota/);assert.equal(f.target(A).has('Image-AbC-01'),false);assert.equal(f.target(A).has('other-image'),true);assert.equal(f.storage.getItem(scope(A)+'-legacy-import'),null);assert.equal(f.storage.getItem(sourceKey),f.raw);});
test('account switch during image copy rolls back original scope, never the next account',async()=>{const f=fixture(),p=await f.api.prepare();f.target(B).set('Image-AbC-01',{id:'Image-AbC-01',keep:true});f.media.afterAdd=()=>f.setOwner(B);await assert.rejects(f.api.commit(p,options),/autorizada|cambiaron/);assert.equal(f.target(A).size,0);assert.equal(f.target(B).get('Image-AbC-01').keep,true);assert.equal(f.Store.get().transactions.length,0);});
test('destination revision change while copying is never overwritten',async()=>{const f=fixture(),p=await f.api.prepare();f.media.afterAdd=()=>f.Store.save(s=>s.transactions.push({id:'concurrent'}));await assert.rejects(f.api.commit(p,options),/destino cambió/);assert.equal(f.Store.get().transactions[0].id,'concurrent');assert.equal(f.target(A).size,0);});
test('existing media collision cannot overwrite another destination image',async()=>{const f=fixture(),p=await f.api.prepare(),original={id:'Image-AbC-01',keep:true};f.target(A).set(original.id,original);await assert.rejects(f.api.commit(p,options),/Ya existe/);assert.equal(f.target(A).get(original.id),original);});
test('failed rollback retains recovery journal and blocks repeat import',async()=>{const f=fixture(),p=await f.api.prepare();f.Store.failSave=true;f.media.failRemove=true;await assert.rejects(f.api.commit(p,options),/requiere revisión/);assert.ok(f.storage.getItem(scope(A)+'-legacy-import'));await assert.rejects(f.api.commit(p,options),/interrumpida/);});
test('journal quota after successful Store save does not delete imported images or invite retry',async()=>{const f=fixture(),p=await f.api.prepare(),set=f.storage.setItem;f.storage.setItem=(k,v)=>{if(k.endsWith('-legacy-import')&&JSON.parse(v).phase==='complete')throw Error('quota');return set(k,v);};const result=await f.api.commit(p,options);assert.equal(result.localVerified,true);assert.match(result.warning,/no repitas/);assert.equal(f.target(A).size,1);assert.equal(f.Store.get().transactions[0].id,'Legacy-AbC-01');assert.equal(JSON.parse(f.storage.getItem(scope(A)+'-legacy-import')).phase,'ready');});
test('concurrent commit is blocked while download is pending',async()=>{const f=fixture(),p=await f.api.prepare();let release;const first=f.api.commit(p,{confirmed:true,download:()=>new Promise(r=>release=r)});while(!release)await new Promise(r=>setTimeout(r,1));await assert.rejects(f.api.commit(p,options),/en curso/);release();await first;});

function worker(){
 const events={},writes=[],deleted=[],cache={addAll:async r=>writes.push(...r),match:async()=>new Response('versioned asset')};
 const s={URL,Request,Response,Set,fetch:async()=>new Response('network'),caches:{open:async()=>cache,match:async()=>new Response('versioned html'),keys:async()=>['unrelated','evie-shell-old','evie-shell-test'],delete:async k=>deleted.push(k)},self:{location:{origin:'https://evie.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>events[name]=fn},importScripts(){}};
 vm.createContext(s);vm.runInContext("const SHELL_VERSION='test';const SHELL_FILES=['/index.html','/app.js','/api/auth/session'];\n"+fs.readFileSync(path.join(root,'public/sw.js'),'utf8'),s);
 return {events,writes,deleted};
}
test('PWA installation omits credentials and cannot cache private API paths',async()=>{const f=worker();let p;f.events.install({waitUntil:v=>p=v});await p;assert.deepEqual(f.writes.map(r=>new URL(r.url).pathname),['/index.html','/app.js']);assert.ok(f.writes.every(r=>r.credentials==='omit'&&r.cache==='reload'&&r.redirect==='error'));});
test('PWA bypasses auth, media, signed URLs, external requests and writes',()=>{const f=worker();for(const [url,method] of [['/api/auth/session','GET'],['/api/data/pull','POST'],['/private/image.webp','GET'],['/app.js?token=secret','GET'],['https://other.test/app.js','GET'],['/__genspark_auth/me','GET'],['/app.js','POST']]){let intercepted=false;f.events.fetch({request:{url:new URL(url,'https://evie.test').href,method,mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false,url);}});
test('PWA navigation uses matching versioned HTML and activation preserves unrelated caches',async()=>{const f=worker();let p;f.events.fetch({request:{url:'https://evie.test/',method:'GET',mode:'navigate'},respondWith:v=>p=v});assert.equal(await (await p).text(),'versioned html');f.events.activate({waitUntil:v=>p=v});await p;assert.deepEqual(f.deleted,['evie-shell-old']);});
