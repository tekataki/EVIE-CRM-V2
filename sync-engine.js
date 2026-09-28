'use strict';
// Durable queue = current Store minus the last verified server shadow.
// Never use object insertion order as a JSON equality test (PostgreSQL JSONB
// reorders keys). Array order and exact legacy identifier casing are preserved.
window.EvieSync=(()=>{
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const canonical=v=>v===undefined?'undefined':v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
 const same=(a,b)=>canonical(a)===canonical(b);
 function rows(state,collections){const result=Object.create(null);for(const c of collections)for(const r of state[c]||[])result[c+'/'+r.id]={collection:c,record_id:r.id,payload:structuredClone(r)};const meta=structuredClone(state);for(const c of collections)delete meta[c];delete meta.revision;result['$state/root']={collection:'$state',record_id:'root',payload:meta};return result;}
 function diff(local,shadow){return Object.entries(local).filter(([k,r])=>!shadow[k]||!same(r.payload,shadow[k].payload)).map(([k,r])=>({collection:r.collection,record_id:r.record_id,payload:structuredClone(r.payload),expected_revision:shadow[k]?.revision||0}));}
 function classify(local,base,remote){if(same(local,remote))return 'same';if(same(local,base))return 'remote';if(same(remote,base))return 'local';return 'conflict';}
 function create({owner,storage,key,store,api,notify=()=>{},beforePush=async()=>{}}){
  if(!UUID.test(owner))throw Error('Cuenta inválida.');let stopped=false,running=false,timer=null,muted=false,conflicts=[],ready=false,lastError=null,review=null,reviewVersion=0;
  const controller=new AbortController();
  function validateRow(r){if(!r||r.owner_id!==owner||!(store.collections.includes(r.collection)||r.collection==='$state')||typeof r.record_id!=='string'||!(/^[a-zA-Z0-9-]{1,80}$/).test(r.record_id)||!Number.isSafeInteger(r.revision)||r.revision<1||!r.payload||Array.isArray(r.payload)||typeof r.payload!=='object'||(r.collection==='$state'?r.record_id!=='root':r.payload.id!==r.record_id))throw Error('Registro remoto inválido o de otra cuenta.');return r;}
  let shadow=JSON.parse(storage.getItem(key+'-sync-shadow')||'{}');if(!shadow||Array.isArray(shadow)||typeof shadow!=='object')throw Error('Caché de sincronización inválida; se conservó intacta.');for(const [k,r]of Object.entries(shadow)){validateRow(r);if(k!==r.collection+'/'+r.record_id)throw Error('Identidad de caché inválida.');}
  const local=()=>rows(store.get(),store.collections);
  function persist(next){storage.setItem(key+'-sync-shadow',JSON.stringify(next));shadow=next;}
  function pending(){return stopped?0:diff(local(),shadow).length;}
  function apply(incoming){const s=structuredClone(incoming['$state/root']?.payload||store.get());for(const c of store.collections)s[c]=Object.values(incoming).filter(r=>r.collection===c).map(r=>structuredClone(r.payload));store.validate(s);if(same(rows(s,store.collections),local()))return;muted=true;try{store.save(current=>{for(const k of Object.keys(current))delete current[k];Object.assign(current,s);});}finally{muted=false;}}
  async function pull(){const remote=Object.create(null),cursors=new Set();let after='';do{
    if(cursors.has(after))throw Error('Cursor repetido.');cursors.add(after);if(cursors.size>5000)throw Error('Demasiadas páginas.');
    const data=await api('data/pull',{method:'POST',body:{after},signal:controller.signal});if(stopped)return;
    if(data.owner!==owner||!Array.isArray(data.rows)||typeof data.next!=='string')throw Error('Respuesta de otra cuenta o formato inválido.');
    for(const row of data.rows){const r=validateRow(row),k=r.collection+'/'+r.record_id;if(remote[k])throw Error('Registro remoto duplicado.');const known=shadow[k];if(known&&(r.revision<known.revision||(r.revision===known.revision&&!same(r.payload,known.payload))))throw Error('La revisión remota retrocedió o cambió sin revisión.');remote[k]=structuredClone(r);}
    after=data.next;
   }while(after);
   if(stopped)return;const current=local(),merged={...current},nextShadow={...shadow};conflicts=[];review=null;reviewVersion++;
   for(const [k,r]of Object.entries(remote)){const kind=classify(current[k]?.payload,shadow[k]?.payload,r.payload);if(kind==='conflict'){
     // An untouched fresh profile may accept existing same-account metadata.
     if(k==='$state/root'&&!shadow[k]&&!storage.getItem(key+'-sync-edited')){merged[k]=r;nextShadow[k]=r;}else conflicts.push({key:k,local:current[k],remote:r,reviewVersion});
    }else{if(kind==='remote'||kind==='same')merged[k]=r;nextShadow[k]=r;}}
   // Do not partially apply linked records while their companion is conflicted.
   if(conflicts.length){review={local:current,merged,nextShadow};return;}
   apply(merged);persist(nextShadow);ready=true;
  }
  async function sync(){if(stopped||running)return {ok:false,busy:running};running=true;lastError=null;notify('Guardando…');try{
    await pull();if(stopped)return {ok:false,cancelled:true};if(conflicts.length){notify('Conflicto por revisar');return {ok:false,conflict:true};}
    await beforePush(controller.signal);if(stopped)return {ok:false,cancelled:true};
    const changes=diff(local(),shadow);
    if(changes.length){const response=await api('data/push',{method:'POST',body:{changes},signal:controller.signal});if(stopped)return {ok:false,cancelled:true};
      if(response.owner!==owner||!Array.isArray(response.rows)||response.rows.length!==changes.length)throw Error('Lectura de verificación incompleta.');
      const expected=new Map(changes.map(c=>[c.collection+'/'+c.record_id,c])),next={...shadow};
      for(const row of response.rows){const r=validateRow(row),k=r.collection+'/'+r.record_id,c=expected.get(k);if(!c||r.revision!==c.expected_revision+1||!same(c.payload,r.payload))throw Error('El servidor no verificó el registro enviado.');expected.delete(k);next[k]=structuredClone(r);}
      if(expected.size)throw Error('Faltan registros guardados.');persist(next);
    }
    notify(pending()?'Guardando…':'Sincronizado');if(pending())schedule();return {ok:true,pending:pending()};
   }catch(error){if(stopped)return {ok:false,cancelled:true};
    // A CAS race can occur after pull. Fetch once to expose the actual conflicting
    // versions; never blindly retry a write or leave a conflict with no details.
    if(error.status===409){try{await pull();if(stopped)return {ok:false,cancelled:true};lastError=error;notify(conflicts.length?'Conflicto por revisar':'Cambios pendientes · sincroniza de nuevo');return {ok:false,conflict:conflicts.length>0,needsRetry:!conflicts.length,error:error.message,status:409};}catch(readError){if(stopped)return {ok:false,cancelled:true};error=readError;}}
    lastError=error;notify(error.status===401?'Sesión caducada':'Sincronización detenida · cambios conservados');return {ok:false,error:error.message,status:error.status};}finally{running=false;}
  }
  function schedule(){clearTimeout(timer);if(!stopped)timer=setTimeout(sync,1000);}
  const unsub=store.subscribe(()=>{if(muted||stopped)return;storage.setItem(key+'-sync-edited','1');notify('Guardando…');schedule();});
  function resolve(k,choice,version){if(stopped)throw Error('La sincronización está cerrada.');if(running)throw Error('Espera a que termine la sincronización y vuelve a revisar.');if(!['local','remote'].includes(choice))throw Error('Elige una versión.');const conflict=conflicts.find(c=>c.key===k);if(!conflict||!review)throw Error('Conflicto no disponible.');if(version!==conflict.reviewVersion)throw Error('La vista previa cambió. Abre los conflictos de nuevo.');if(!same(local(),review.local)){conflicts.forEach(c=>delete c.choice);throw Error('Los datos locales cambiaron. Sincroniza y revisa las versiones de nuevo.');}conflict.choice=choice;if(conflicts.some(c=>!c.choice))return;
   const rollback=JSON.parse(storage.getItem(key+'-rollback')||'[]');rollback.push({at:new Date().toISOString(),conflicts:structuredClone(conflicts),local:structuredClone(review.local),incoming:structuredClone(review.nextShadow)});storage.setItem(key+'-rollback',JSON.stringify(rollback.slice(-20)));
   const merged={...review.merged},next={...review.nextShadow};for(const c of conflicts){if(c.choice==='remote')merged[c.key]=c.remote;next[c.key]=c.remote;}apply(merged);persist(next);conflicts=[];review=null;schedule();
  }
  return {sync,pending,resolve,conflicts:()=>structuredClone(conflicts),ready:()=>ready,error:()=>lastError?.message||null,stop(){stopped=true;controller.abort();unsub();clearTimeout(timer);conflicts=[];review=null;}};
 }
 return {rows,diff,classify,create,canonical};
})();
