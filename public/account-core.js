'use strict';
// No access/refresh tokens or passwords are persisted in the renderer.
window.EvieAccounts=(()=>{
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 let user=null,runtime=null,generation=0,channel=null;const controllers=new Set(),subscribers=new Set();
 const signalKey='evie-session-change';
 // Notifications only invalidate; they never carry credentials or select an owner.
 function changed(){try{channel?.postMessage('invalidate');}catch{}try{localStorage.setItem(signalKey,crypto.randomUUID());}catch{}}
 function invalidated(){if(runtime?.accountsEnabled)clear('external');}
 if(typeof window.BroadcastChannel==='function'){try{channel=new BroadcastChannel(signalKey);channel.onmessage=event=>{if(event.data==='invalidate')invalidated();};}catch{}}
 window.addEventListener?.('storage',event=>{if(event.key===signalKey&&event.newValue)invalidated();});
 function username(value){if(typeof value!=='string')throw Error('Escribe tu nombre de usuario.');const key=value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(!/^[a-z0-9._-]{3,24}$/.test(key))throw Error('Usa de 3 a 24 letras, números, punto, guion o guion bajo.');return key;}
 function scope(id){if(!UUID.test(id))throw Error('Cuenta no válida.');return 'evie-account-'+id.toLowerCase();}
 function storageKey(){if(user)return scope(user.id);if(runtime?.accountsEnabled)throw Error('La sesión está bloqueada.');const q=new URLSearchParams(location.search);return q.has('qa')?'dali-os-qa-'+q.get('qa').replace(/[^a-zA-Z0-9-]/g,'').slice(0,50):'dali-os-local-v1';}
 function clear(reason='cleared'){generation++;for(const c of controllers)c.abort();controllers.clear();user=null;subscribers.forEach(fn=>fn(null,reason));}
 async function request(path,{method='GET',body,signal}={}){const ticket=generation,controller=new AbortController();controllers.add(controller);const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();let result;try{
  if(controller.signal.aborted)throw new DOMException('Operación cancelada.','AbortError');
  if(window.evieDesktop?.account){const response=await window.evieDesktop.account({path,method,...(body===undefined?{}:{body}),...(user?{userId:user.id}:{})});if(!response.ok)throw Object.assign(Error(response.error||'Servicio no disponible.'),{status:response.status});result=response.data;}
  else {const response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'X-Evie-Request':'1',...(body===undefined?{}:{'Content-Type':'application/json'}),...(user?{'X-Evie-User':user.id}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal});result=await response.json();if(!response.ok){const error=Error(result.error||'No se pudo completar la solicitud.');error.status=response.status;throw error;}}
  if(ticket!==generation)throw Error('La cuenta cambió. Operación cancelada.');if(controller.signal.aborted)throw new DOMException('Operación cancelada.','AbortError');return result;
 }catch(error){if(error.status===401&&user&&path!=='auth/signin'&&path!=='auth/signup')clear('expired');throw error;}finally{controllers.delete(controller);signal?.removeEventListener('abort',abort);}}
 async function restore(){runtime=await request('runtime');if(!runtime.accountsEnabled){clear();return null;}const session=await request('auth/session');if(session.user){scope(session.user.id);if(user&&user.id!==session.user.id)clear();user={id:session.user.id,username:session.user.username};}else{clear();}subscribers.forEach(fn=>fn(user));return user;}
 async function authenticate(mode,name,password){if(!runtime?.accountsEnabled)throw Error('Las cuentas aún no están habilitadas.');const key=username(name);if(typeof password!=='string'||password.length<10||password.length>128)throw Error('Usa una contraseña de 10 a 128 caracteres.');const result=await request('auth/'+mode,{method:'POST',body:{username:key,password}});if(!result.user)throw Error('No se pudo abrir la sesión. Revisa la configuración de cuentas.');scope(result.user.id);clear();user={id:result.user.id,username:result.user.username};subscribers.forEach(fn=>fn(user));changed();return user;}
 async function verify(){if(!runtime?.accountsEnabled||!user)return false;const expected=user.id,session=await request('auth/session');if(!session.user||session.user.id!==expected){clear('expired');return false;}return true;}
 async function signOut(all=false){changed();try{return await request('auth/signout',{method:'POST',body:{all}});}finally{clear('signout');changed();}}
 const capabilities=()=>Object.freeze({desktop:!!window.evieDesktop,windows:window.evieDesktop?.platform==='win32',localAI:!!window.evieDesktop,accounts:runtime?.accountsEnabled===true,online:navigator.onLine,providers:runtime?.providers||{spotify:false,whatsapp:false,instagram:false}});
 return {username,scope,storageKey,request,restore,verify,authenticate,signOut,clear,capabilities,current:()=>user?{...user}:null,config:()=>runtime,subscribe:fn=>{subscribers.add(fn);return ()=>subscribers.delete(fn);}};
})();
