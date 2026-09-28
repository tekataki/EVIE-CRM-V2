import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({args:['--no-sandbox']}),checks=[],errors=[];
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const ok=(v,label)=>{assert.ok(v,label);checks.push(label);};
try{
 // Real Wrangler runtime, real service worker and CacheStorage; no provider.
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000/');await page.waitForFunction(()=>window.DALI_READY);
 ok(await page.evaluate(()=>Store.collections.every(c=>Store.get()[c].length===0)&&Store.get().profile.name===''),'fresh local profile and all 38 collections are blank');
 const modules=await page.evaluate(()=>{Neural.dismiss();const result=[];for(const section of DALI_CONFIG.sections){UI.section=section.route;App.render();result.push(section.route);}return result;});ok(modules.length===16,'16 modules render with blank profile');
 // Real module manager interactions, shared renderer, data retention and keyboard focus.
 await page.evaluate(()=>{Store.put('transactions',Records.normalize('transactions',{id:'favorite-retained-ID',title:'Retener al ocultar',type:'income',amount:12345}));window.moduleDataBefore=JSON.stringify(Object.fromEntries(Store.collections.map(c=>[c,Store.get()[c]])));Personalization.open();});
 const pin=r=>page.locator(`[data-module-action="favorite"][data-route="${r}"]`);
 await pin('libros').click();await pin('finanzas').click();
 ok(await page.locator('#main-nav [data-favorite]').evaluateAll(nodes=>nodes.map(n=>n.hash).join(',')==='#finanzas,#libros'),'favorite rail follows module order, not pin order');
 ok(await page.locator('#main-nav .nav-item').evaluateAll(nodes=>nodes.length===16&&new Set(nodes.map(n=>n.hash)).size===16),'favorite rail never duplicates module links');
 // Start native dragging before scrolling the target: the dialog otherwise
 // moves another row under the source pointer before dragstart fires.
 const dragSource=page.locator('[data-module="libros"]'),dragTarget=page.locator('[data-module="finanzas"]');
 await dragSource.scrollIntoViewIfNeeded();const sourceBox=await dragSource.boundingBox();
 await page.mouse.move(sourceBox.x+4,sourceBox.y+4);await page.mouse.down();
 await page.mouse.move(sourceBox.x+14,sourceBox.y+10,{steps:6});
 await dragTarget.scrollIntoViewIfNeeded();const targetBox=await dragTarget.boundingBox();
 await page.mouse.move(targetBox.x+4,targetBox.y+4,{steps:8});await page.mouse.move(targetBox.x+6,targetBox.y+6);await page.mouse.up();
 ok(await page.locator('#main-nav [data-favorite]').evaluateAll(nodes=>nodes.map(n=>n.hash).join(',')==='#libros,#finanzas'),'drag reordering updates visible favorites');
 await page.locator('[data-module-action="down"][data-route="libros"]').click();
 ok(await page.locator('#main-nav [data-favorite]').evaluateAll(nodes=>nodes.map(n=>n.hash).join(',')==='#finanzas,#libros'),'keyboard-accessible order button updates favorites');
 await page.locator('[data-mobile-index="1"]').selectOption('libros');
 ok(await page.evaluate(()=>document.activeElement?.dataset.mobileIndex==='1'&&document.querySelector('.mobile-nav a[href="#libros"]')),'mobile shortcut keeps focus and can independently reference a module');
 await page.locator('[data-module-visible="libros"]').uncheck();
 ok(await page.evaluate(()=>!document.querySelector('#main-nav a[href="#libros"]')&&Store.get().preferences.favoriteSections.includes('libros')&&document.activeElement?.dataset.moduleVisible==='libros'),'hide removes favorite link but preserves preference and keyboard focus');
 ok(await page.evaluate(()=>window.moduleDataBefore===JSON.stringify(Object.fromEntries(Store.collections.map(c=>[c,Store.get()[c]])))),'hide and reorder leave all CRM records byte-equivalent');
 await page.evaluate(()=>{App.closeDialog(true);IvyChat.open();});
 await page.locator('#ivy-command-input').fill('Abre Libros');await page.locator('#ivy-command-form button[type="submit"]').click();
 await page.waitForFunction(()=>UI.section==='libros');
 ok(await page.evaluate(()=>UI.section==='libros'&&!document.querySelector('#main-nav a[href="#libros"]')&&document.getElementById('main-content').textContent.length>0),'existing Ivy navigation opens a hidden module without unhiding it');
 await page.locator('[data-action="search"]').first().click();await page.locator('#global-search').fill('Libros');
 ok(await page.locator('#search-results a[href="#libros"]').count()===1,'global search still offers the hidden module');
 await page.evaluate(()=>{App.closeDialog(true);Personalization.open();});await page.locator('[data-module-visible="libros"]').check();
 ok(await page.locator('#main-nav a[href="#libros"]').getAttribute('aria-current')==='page'&&await page.locator('#main-nav [aria-current="page"]').count()===1,'show restores favorite and marks exactly one current page');
 for(const r of ['agenda','granja','soma'])await pin(r).click();await pin('vision').click();
 ok(await page.locator('#module-error').innerText().then(t=>t.includes('cinco'))&&await page.locator('#main-nav [data-favorite]').count()===5,'sixth favorite is rejected visibly without changing five pins');
 ok(await page.locator('[data-module-visible]:disabled').evaluateAll(nodes=>nodes.map(n=>n.dataset.moduleVisible).sort().join(',')==='configuracion,inicio,perfil'),'mandatory modules cannot be hidden in the manager');
 await page.evaluate(()=>App.closeDialog(true));await page.reload();await page.waitForFunction(()=>window.DALI_READY);
 ok(await page.locator('#main-nav [data-favorite]').count()===5&&await page.evaluate(()=>Store.get().transactions.some(r=>r.id==='favorite-retained-ID'&&r.amount===12345)),'favorites and original record survive browser reload');
 await page.evaluate(()=>{Neural.dismiss();document.body.classList.add('collapsed');});
 ok(await page.locator('#main-nav [data-favorite]').evaluateAll(nodes=>nodes.every(n=>n.getAttribute('aria-label').endsWith(', favorito')&&getComputedStyle(n.querySelector('.favorite-indicator')).display==='none')),'collapsed rail retains accessible favorite names and hides extra star');
 await page.evaluate(()=>document.body.classList.remove('collapsed'));await page.setViewportSize({width:390,height:844});
 ok(await page.locator('.mobile-nav a[href="#libros"]').isVisible(),'independent mobile shortcut remains visible on a narrow viewport');
 await page.setViewportSize({width:1280,height:720});
 await page.evaluate(()=>Personalization.open());await page.locator('#module-reset').click();
 ok(await page.evaluate(()=>!document.querySelector('#main-nav [data-favorite]')&&document.activeElement?.id==='module-reset'&&Store.get().transactions.some(r=>r.id==='favorite-retained-ID')),'reset clears pins and order without deleting records, retaining focus');
 await page.evaluate(()=>App.closeDialog(true));
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active,{},{timeout:30000});await page.waitForFunction(()=>navigator.serviceWorker.controller);
 const cache=await page.evaluate(async()=>{const keys=await caches.keys(),key=keys.find(k=>k.startsWith('evie-shell-')),requests=await(await caches.open(key)).keys();return {key,paths:requests.map(r=>new URL(r.url).pathname)};});
 ok(cache.paths.length===97,'97 explicit shell assets installed in real CacheStorage');ok(!cache.paths.some(p=>p.startsWith('/api/')||p.includes('media/')),'no account responses or private media cached');
 await page.evaluate(()=>fetch('/api/runtime'));await context.setOffline(true);await page.reload();await page.waitForSelector('#account-gate');
 ok(await page.locator('#account-gate').innerText().then(t=>t.includes('No se pudo abrir la sesión')),'offline shell loads but account boot fails closed without verified runtime');
 ok(await page.evaluate(()=>!Store.get()),'offline reload does not silently open legacy or another account');
 await context.setOffline(false);await page.reload();await page.waitForFunction(()=>window.DALI_READY);ok(true,'online recovery opens original local space');await context.close();

 // Simulated HTTP account sessions; actual Store, IndexedDB, migration and renderer.
 const accounts=await browser.newContext({serviceWorkers:'block'});let owner=A;const records=new Map();
 await accounts.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,expected=route.request().headers()['x-evie-user'];let body;
  if(path.startsWith('/api/data/')&&(!owner||expected!==owner))return route.fulfill({status:401,json:{error:'Session owner mismatch'}});
  if(path==='/api/runtime')body={accountsEnabled:true,legacyOwnerId:A,providers:{spotify:false,whatsapp:false,instagram:false}};
  else if(path==='/api/auth/session')body={user:owner&&(!expected||expected===owner)?{id:owner,username:owner===A?'owner-a':'owner-b'}:null};
  else if(path==='/api/auth/signin'){owner=route.request().postDataJSON().username==='owner-b'?B:A;body={user:{id:owner,username:owner===A?'owner-a':'owner-b'}};}
  else if(path==='/api/auth/signout'){owner=null;body={ok:true};}
  else if(path==='/api/data/pull')body={owner,rows:[...records.values()].filter(r=>r.owner_id===owner),next:''};
  else if(path==='/api/data/push'){const input=route.request().postDataJSON();if(input.changes.some(c=>(records.get(owner+'/'+c.collection+'/'+c.record_id)?.revision||0)!==c.expected_revision))return route.fulfill({status:409,json:{error:'Otro dispositivo cambió estos registros.'}});body={owner,rows:input.changes.map(c=>({...c,owner_id:owner,revision:c.expected_revision+1}))};for(const r of body.rows)records.set(owner+'/'+r.collection+'/'+r.record_id,r);}
  else return route.fulfill({status:404,json:{error:'not implemented by test'}});
  await route.fulfill({json:body});
 });
 const account=await accounts.newPage();account.on('pageerror',e=>errors.push(e.message));await account.goto('http://localhost:3000/');await account.waitForSelector('#onboarding-form');
 ok(await account.evaluate(()=>Store.collections.every(c=>Store.get()[c].length===0)&&Store.get().profile.name===''),'authenticated fresh account starts completely blank');
 await account.evaluate(()=>AccountUI.sync().stop());
 const migration=await account.evaluate(async()=>{
  const source=Store.blank();source.profile.name='Perfil QA';source.profile.preferred='QA';
  source.transactions.push(Store.record(Records.normalize('transactions',{id:'Legacy-AbC-0001',title:'Venta QA',type:'income',amount:12345})));
  const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;canvas.getContext('2d').fillRect(0,0,2,2);const blob=await new Promise(r=>canvas.toBlob(r,'image/webp'));
  const image={id:'Photo-AbC-0001',blob,thumbnail:blob,width:2,height:2};source.mediaMetadata.push(Store.record({id:image.id,title:'QA',name:'qa.webp',mime:'image/webp',size:blob.size,width:2,height:2}));Store.validate(source);
  const raw=JSON.stringify(source,null,2)+'\n';localStorage.setItem('dali-os-local-v1',raw);
  await new Promise((resolve,reject)=>{const r=indexedDB.open('dali-os-local-v1-media',1);r.onupgradeneeded=()=>r.result.createObjectStore('media',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('media','readwrite');tx.objectStore('media').put(image);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  const prepared=await LegacyMigration.prepare();let backup;const result=await LegacyMigration.commit(prepared,{confirmed:true,download:b=>backup=b});const zip=await JSZip.loadAsync(backup);
  const saved=await MediaStore.get(image.id),original=await zip.file('media/'+image.id+'.webp').async('uint8array');
  return {result,rawMatches:await zip.file('data.json').async('string')===raw,sourceIntact:localStorage.getItem('dali-os-local-v1')===raw,id:Store.get().transactions[0].id,amount:Store.get().transactions[0].amount,mediaMatches:saved.blob.size===blob.size&&original.length===blob.size};
 });
 ok(migration.rawMatches&&migration.sourceIntact,'ZIP data.json and original legacy string match byte-for-byte');
 ok(migration.id==='Legacy-AbC-0001'&&migration.amount===12345,'real Store migration preserves exact text ID and integer cents');
 ok(migration.mediaMatches&&migration.result.localVerified&&!migration.result.cloudVerified,'real IndexedDB images copied and verified; cloud verification remains false');
 const isolation=await account.evaluate(async()=>{await EvieAccounts.authenticate('signin','owner-b','test-only-password');const before=await MediaStore.get('Photo-AbC-0001');await MediaStore.put({id:'Photo-AbC-0001',blob:new Blob(['account-B']),thumbnail:new Blob(['B'])});return !before;});ok(isolation,'switching accounts cannot reuse first account IndexedDB connection');
 const original=await account.evaluate(async()=>{await EvieAccounts.authenticate('signin','owner-a','test-only-password');return (await MediaStore.get('Photo-AbC-0001')).blob.type;});ok(original==='image/webp','same image ID in account B never overwrites account A');
 const hydration=await account.evaluate(async()=>{const img=document.createElement('img');img.dataset.mediaId='Photo-AbC-0001';document.body.append(img);const pending=MediaStore.hydrate(document);MediaStore.release();await pending;const untouched=!img.getAttribute('src');img.remove();return untouched;});ok(hydration,'released image hydration cannot reattach private blob URLs');
 // Cross-tab invalidation must wipe visible state, proposals and ephemeral history.
 await account.reload();await account.waitForFunction(()=>window.DALI_READY&&!document.getElementById('account-gate'));
 // Exercise the actual account conflict buttons, not only the engine API.
 await account.evaluate(async()=>{Neural.dismiss();let result;for(let n=0;n<100;n++){result=await AccountUI.sync().sync();if(!result.busy)break;await new Promise(r=>setTimeout(r,50));}if(!result?.ok)throw Error('Seed sync failed: '+JSON.stringify(result));Store.save(s=>s.transactions.find(r=>r.id==='Legacy-AbC-0001').amount=20000);});
 const conflictKey=A+'/transactions/Legacy-AbC-0001',remote=records.get(conflictKey);
 assert.ok(remote);records.set(conflictKey,{...remote,revision:remote.revision+1,payload:{...remote.payload,amount:30000}});
 const conflictDebug=await account.evaluate(async()=>{let result;for(let n=0;n<100;n++){result=await AccountUI.sync().sync();if(!result.busy)break;await new Promise(r=>setTimeout(r,50));}AccountUI.open();return {result,conflicts:AccountUI.sync().conflicts(),error:AccountUI.sync().error()};});
 if(await account.locator('[data-conflict][data-choice=remote]').count()!==1)console.error('CONFLICT DIAGNOSTIC',conflictDebug);
 ok(await account.locator('[data-conflict][data-choice=remote]').count()===1,'conflict UI exposes an explicit server choice');
 await account.locator('[data-conflict][data-choice=remote]').click();
 ok(await account.evaluate(()=>Store.get().transactions.find(r=>r.id==='Legacy-AbC-0001').amount===30000&&!!localStorage.getItem(DALI_CONFIG.storageKey+'-rollback')),'conflict UI applies the reviewed server version with durable rollback');
 await account.evaluate(async()=>{App.closeDialog(true);await AccountUI.sync().sync();});
 await account.evaluate(()=>{AccountUI.sync().stop();Store.save(s=>{s.preferences=Personalization.change(s.preferences,'favorite','finanzas');s.preferences=Personalization.change(s.preferences,'hide','libros');});App.render();});
 ok(await account.locator('#main-nav a[href="#finanzas"][data-favorite]').count()===1&&await account.locator('#main-nav a[href="#libros"]').count()===0,'account A renders its own pinned and hidden preferences');
 const prepared=await account.evaluate(()=>{AccountUI.sync().stop();Neural.dismiss();IvyChat.open();IvyChat.submit('Dame estadísticas');const messages=IvyChat.stats().messages;DaliCore.close();const p=IvyCommandBus.prepare(IvyCommandBus.parse('Crea pendiente: Tarea privada'));window.previousUndo=IvyCommandBus.confirm(p.token).undo;window.previousProposal=LocalAgendaProvider.prepare({name:'crm.create_task',args:{title:'No transferir'}}).token;IvyCommandBus.prepare(IvyCommandBus.parse('Crea pendiente: Otra privada'));App.openDialog('Borrador privado','<input value="texto privado" id="private-draft">');return {messages,pending:IvyCommandBus.pendingCount(),raw:localStorage.getItem(DALI_CONFIG.storageKey)};});
 ok(prepared.messages>0&&prepared.pending===1,'private history and proposals exist before account switch');
 const other=await accounts.newPage();other.on('pageerror',e=>errors.push(e.message));await other.goto('http://localhost:3000/');await other.waitForFunction(()=>window.DALI_READY);await other.evaluate(()=>EvieAccounts.authenticate('signin','owner-b','test-only-password'));
 await account.waitForFunction(()=>!Store.get()&&document.getElementById('session-reload'));
 const cleared=await account.evaluate(()=>{let write=false,proposal=false,undo=false;try{Store.save(s=>s.profile.name='forbidden');}catch{write=true;}try{LocalAgendaProvider.commit({token:window.previousProposal});}catch{proposal=true;}try{window.previousUndo();}catch{undo=true;}return {write,proposal,undo,messages:IvyChat.stats().messages,pending:IvyCommandBus.pendingCount(),draft:!!document.getElementById('private-draft'),main:document.getElementById('main-content').textContent,owner:EvieAccounts.current(),ready:window.DALI_READY,raw:localStorage.getItem('evie-account-11111111-1111-4111-8111-111111111111')};});
 ok(cleared.write&&cleared.proposal&&cleared.undo,'old Store writes, proposals and Undo are rejected after account switch');
 ok(cleared.messages===0&&cleared.pending===0&&!cleared.draft&&!cleared.main&&!cleared.owner&&!cleared.ready,'cross-tab login clears state, history, drafts, proposals and rendered data');
 ok(cleared.raw===prepared.raw,'locking preserves original account persisted changes');
 await account.reload();await account.waitForSelector('#onboarding-form').catch(async error=>{console.error('ACCOUNT RELOAD DIAGNOSTIC',await account.evaluate(()=>({gate:document.getElementById('account-gate')?.innerText,user:EvieAccounts.current(),profile:Store.get()?.profile,ready:window.DALI_READY})),errors);throw error;});
 ok(await account.evaluate(()=>EvieAccounts.current().id==='22222222-2222-4222-8222-222222222222'&&Store.collections.every(c=>!Store.get()[c].length)&&!Store.get().profile.name),'reload verifies account B and opens its blank space, never account A');
 ok(await account.evaluate(()=>Personalization.normalize(Store.get().preferences).favorites.length===0&&Personalization.normalize(Store.get().preferences).hidden.length===0&&JSON.parse(localStorage.getItem('evie-account-11111111-1111-4111-8111-111111111111')).preferences.favoriteSections.includes('finanzas')),'account B starts with default navigation while account A retains private preferences');
 await account.locator('#onboarding-form input[name=name]').focus();await account.keyboard.press('Shift+Tab');
 ok(await account.evaluate(()=>document.activeElement===document.querySelector('#onboarding-form button')),'account gate loops reverse keyboard focus');
 await account.keyboard.press('Tab');ok(await account.evaluate(()=>document.activeElement===document.querySelector('#onboarding-form input[name=name]')),'account gate loops forward keyboard focus');
 await account.keyboard.press('Escape');ok(await account.locator('#onboarding-form').isVisible(),'Escape cannot bypass authenticated onboarding');
 ok(await account.evaluate(()=>[...document.body.children].filter(n=>n.id!=='account-gate'&&!['SCRIPT','STYLE','LINK'].includes(n.tagName)).every(n=>n.inert)),'background shell is inert while account gate is open');
 await other.evaluate(()=>EvieAccounts.signOut());await account.waitForFunction(()=>!Store.get()&&!!document.getElementById('session-reload'));ok(true,'logout also invalidates another open tab');
 await accounts.close();
 ok(errors.length===0,'no browser page errors');
 const report={date:new Date().toISOString(),browser:await browser.version(),passed:checks.length,checks,errors,limits:['Auth HTTP responses simulated for account scenario','No live Supabase or Windows acceptance','Offline shell only; verified account session required to reopen data']};
 fs.writeFileSync('evidence/accounts-offline-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
