'use strict';
// Explicit owner migration; normal account boot never reads the legacy profile.
window.LegacyMigration=(()=>{
 const sourceKey='dali-os-local-v1',previews=new WeakMap();let running=false;
 const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 function allowed(){const user=EvieAccounts.current();if(!user||user.id!==EvieAccounts.config()?.legacyOwnerId)throw Error('Esta cuenta no está autorizada para migrar el perfil anterior.');return user.id;}
 function validateRaw(raw){if(typeof raw!=='string')throw Error('No hay datos heredados en este origen.');const state=JSON.parse(raw);if(state.version!==4)throw Error('Solo se migra un respaldo válido de esquema 4. La fuente no se modificó.');Store.validate(state);return state;}
 async function readMedia(){return new Promise((resolve,reject)=>{const req=indexedDB.open(sourceKey+'-media',1);let absent=false;req.onupgradeneeded=()=>{absent=true;req.transaction.abort();};req.onerror=()=>absent?resolve([]):reject(Error('No se pudo leer el almacén de imágenes anterior.'));req.onsuccess=()=>{const db=req.result;try{const tx=db.transaction('media','readonly'),r=tx.objectStore('media').getAll();r.onerror=()=>{db.close();reject(Error('No se pudieron leer las imágenes.'));};r.onsuccess=()=>{db.close();resolve(r.result);};}catch(err){db.close();reject(err);}};});}
 async function prepare(){
  const owner=allowed(),raw=localStorage.getItem(sourceKey),state=validateRaw(raw),media=await readMedia();
  if(owner!==allowed())throw Error('La cuenta cambió.');
  const ids=new Set();for(const r of media){if(!/^[a-zA-Z0-9-]{1,80}$/.test(r.id)||ids.has(r.id)||!(r.blob instanceof Blob)||!(r.thumbnail instanceof Blob))throw Error('Imagen heredada inválida.');ids.add(r.id);}
  const missing=state.mediaMetadata.filter(r=>!r.deleted_at&&!ids.has(r.id));
  if(missing.length)throw Error('Faltan '+missing.length+' imágenes del respaldo. No se inició la migración.');
  const data={owner,raw,state,media,sha256:await hash(new TextEncoder().encode(raw)),counts:Object.fromEntries(Store.collections.map(c=>[c,state[c].length]))};
  // Keep a private snapshot: callers cannot change the state after its validation.
  const preview=structuredClone(data);previews.set(preview,data);return preview;
 }
 async function commit(preview,{confirmed=false,download}={}){
  if(!confirmed||typeof download!=='function')throw Error('Respaldo y confirmación requeridos.');
  if(running)throw Error('Ya hay una migración en curso.');
  const prepared=previews.get(preview);if(!prepared)throw Error('Abre una nueva vista previa antes de importar.');
  running=true;
  try{return await perform(prepared,download);}finally{running=false;}
 }
 async function perform(prepared,download){
  const targetKey=DALI_CONFIG.storageKey;
  const check=()=>{if(allowed()!==prepared.owner||DALI_CONFIG.storageKey!==targetKey||localStorage.getItem(sourceKey)!==prepared.raw)throw Error('La cuenta o los datos originales cambiaron. Abre una nueva vista previa.');};check();
  if(targetKey!==EvieAccounts.scope(prepared.owner))throw Error('El destino no es el espacio de la cuenta autorizada.');
  if(Store.collections.some(c=>Store.get()[c].length))throw Error('La cuenta de destino debe estar vacía. Exporta sus datos antes de combinar respaldos.');
  const markerKey=targetKey+'-legacy-import';
  if(localStorage.getItem(markerKey))throw Error('Existe una migración registrada o interrumpida. Conserva el respaldo y verifica el destino antes de repetir.');
  const revision=Store.get().revision||0,zip=new JSZip(),manifest=[],destination=MediaStore.capture();
  if(destination.key!==targetKey)throw Error('El almacén de imágenes no coincide con la cuenta.');
  zip.file('data.json',prepared.raw);
  for(const r of prepared.media){
   // ArrayBuffers work in both browsers and ZIP test environments without FileReader.
   const original=await r.blob.arrayBuffer(),thumbnail=await r.thumbnail.arrayBuffer();
   zip.file('media/'+r.id+'.webp',original);zip.file('media/'+r.id+'-thumb.webp',thumbnail);
   manifest.push({id:r.id,width:r.width,height:r.height,sha256:await hash(original),thumbnail_sha256:await hash(thumbnail)});
  }
  zip.file('manifest.json',JSON.stringify({format:'dali.backup',schema_version:4,media:manifest,created_at:new Date().toISOString(),source_sha256:prepared.sha256}));
  const backup=await zip.generateAsync({type:'blob'});check();
  if((Store.get().revision||0)!==revision)throw Error('El destino cambió. Repite la vista previa.');
  const backupKey=sourceKey+'-pre-accounts-'+Date.now()+'-'+crypto.randomUUID();
  localStorage.setItem(backupKey,prepared.raw);
  if(localStorage.getItem(backupKey)!==prepared.raw)throw Error('No se pudo verificar el respaldo byte-exacto.');
  await download(backup);check();
  const result={owner:prepared.owner,source_sha256:prepared.sha256,counts:prepared.counts,media:prepared.media.length,backupKey,localVerified:false,cloudVerified:false,at:new Date().toISOString()};
  // A durable journal is written before any import. If the process crashes, a
  // second import is blocked rather than silently duplicating or deleting data.
  localStorage.setItem(markerKey,JSON.stringify({...result,phase:'copying'}));
  const copied=[];let saved=false;
  try{
   for(const r of prepared.media){
    check();if(await destination.get(r.id))throw Error('Ya existe una imagen con ese ID en el destino.');check();
    await destination.add(r);copied.push(r.id);check();
    const stored=await destination.get(r.id),meta=manifest.find(m=>m.id===r.id);
    if(!stored||await hash(await stored.blob.arrayBuffer())!==meta.sha256||await hash(await stored.thumbnail.arrayBuffer())!==meta.thumbnail_sha256)throw Error('No se pudo verificar una imagen copiada.');
   }
   check();if((Store.get().revision||0)!==revision)throw Error('El destino cambió durante la copia.');
   localStorage.setItem(markerKey,JSON.stringify({...result,phase:'ready'}));
   Store.save(s=>{for(const k of Object.keys(s))delete s[k];Object.assign(s,structuredClone(prepared.state));});saved=true;
   for(const c of Store.collections)if(JSON.stringify(Store.get()[c])!==JSON.stringify(prepared.state[c]))throw Error('La lectura de verificación no coincide. Conserva el respaldo y revisa la migración interrumpida.');
  }catch(error){
   if(!saved){
    // Rollback stays pinned to the original database even if another account opens.
    let cleaned=true;for(const id of copied){try{await destination.remove(id);}catch{cleaned=false;}}
    if(cleaned){try{localStorage.removeItem(markerKey);}catch{cleaned=false;}}
    if(!cleaned)throw Error('La migración se interrumpió y requiere revisión del destino. La fuente y el respaldo permanecen intactos.');
   }
   throw error;
  }
  result.localVerified=true;result.phase='complete';
  try{localStorage.setItem(markerKey,JSON.stringify(result));}
  catch{result.warning='Datos importados y verificados. No se pudo finalizar el registro de migración por falta de espacio; conserva el ZIP y no repitas la importación.';}
  return result;
 }
 async function preview(){const p=await prepare();App.openDialog('Revisar datos heredados',`<p>Se importarán los datos a <strong>${Domain.escape(EvieAccounts.current().username)}</strong>. La fuente permanece intacta.</p><pre>${Domain.escape(JSON.stringify(p.counts,null,2))}</pre><p>${p.media.length} imágenes · esquema 4 · IDs conservados.</p><label><input type="checkbox" id="legacy-confirm"> Confirmo que estos son mis datos y guardaré el ZIP de seguridad.</label><p id="legacy-error" role="alert"></p><button class="button primary" id="legacy-run">Respaldar e importar</button>`);document.getElementById('legacy-run').onclick=async event=>{event.target.disabled=true;try{const result=await commit(p,{confirmed:document.getElementById('legacy-confirm').checked,download:blob=>App.download('EVIE-legacy-backup-'+Domain.today()+'.zip',blob,'application/zip')});App.closeDialog(true);App.render();App.toast(result.warning||'Datos e imágenes verificados localmente. La sincronización remota aún debe verificarse.');}catch(err){const error=document.getElementById('legacy-error');if(error)error.textContent=err.message;event.target.disabled=false;}};}
 return {prepare,commit,preview,validateRaw};
})();
