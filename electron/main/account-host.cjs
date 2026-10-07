'use strict';
// Renderer gets a narrow account API, never cookies, token storage or a URL.
const routes=new Map([['runtime','GET'],['auth/session','GET'],['auth/signin','POST'],['auth/signup','POST'],['auth/signout','POST'],['data/pull','POST'],['data/push','POST']]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function createAccountHost({origin='',fetcher,onChange=()=>{}}){
 let current=null,epoch=0,authBusy=false;const controllers=new Set();
 if(origin){const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('EVIE_ACCOUNT_API_ORIGIN debe ser un origen HTTPS sin ruta.');origin=u.origin;}
 function clear(){epoch++;controllers.forEach(c=>c.abort());controllers.clear();current=null;onChange(null);}
 async function request(args){
  if(!args||Array.isArray(args)||typeof args!=='object'||Object.keys(args).some(k=>!['path','method','body','userId'].includes(k))||!routes.has(args.path)||routes.get(args.path)!==args.method||JSON.stringify(args).length>16000000)throw Error('Solicitud de cuenta no permitida.');
  if(!origin){if(args.path==='runtime')return {accountsEnabled:false,legacyOwnerId:null,providers:{spotify:false,whatsapp:false,instagram:false}};throw Error('Las conexiones externas están desactivadas.');}
  if(args.path.startsWith('data/')&&(!current||args.userId!==current))throw Error('Cuenta no autorizada.');
  const authAction=['auth/signin','auth/signup','auth/signout','auth/session'].includes(args.path);if(authAction&&authBusy)throw Error('Espera a que termine la operación de cuenta.');
  if(authAction)authBusy=true;
  if(['auth/signin','auth/signup','auth/signout'].includes(args.path))clear();
  const ticket=epoch,controller=new AbortController();controllers.add(controller);
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
   const result=await fetcher(origin+'/api/'+args.path,{method:args.method,credentials:'include',cache:'no-store',redirect:'error',headers:{Origin:origin,'X-Evie-Request':'1',...(args.method==='POST'?{'Content-Type':'application/json'}:{}),...(args.userId?{'X-Evie-User':args.userId}:{})},...(args.method==='POST'?{body:JSON.stringify(args.body||{})}:{}),signal:controller.signal});
   const data=await result.json();if(ticket!==epoch)throw Error('La cuenta cambió.');
   if(!result.ok){if(result.status===401)clear();const error=Error(data.error||'No se pudo completar la solicitud de cuenta.');error.status=result.status;throw error;}
   if(args.path==='runtime'&&data.accountsEnabled!==true)throw Error('El servidor configurado no tiene cuentas habilitadas. No se abrió un perfil local alternativo.');
   if(['auth/session','auth/signin','auth/signup'].includes(args.path)){
    const id=data.user?.id||null;if(id&&!UUID.test(id))throw Error('Identidad remota no válida.');
    if(current!==id){epoch++;for(const c of controllers)if(c!==controller)c.abort();current=id;onChange(id);}
   }
   return data;
  }finally{clearTimeout(timeout);controllers.delete(controller);if(authAction)authBusy=false;}
 }
 return {request,clear,current:()=>current,enabled:()=>!!origin};
}
module.exports={createAccountHost};
