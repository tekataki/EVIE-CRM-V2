'use strict';
const {specs,tool}=require('../security/contracts.cjs');
function createRegistry({crm,windows,confirm,audit,settings}){
 let generation=0;
 const catalog=()=>Object.entries(specs).map(([name,[description,permission,parameters]])=>({type:'function',function:{name,description,parameters},permission}));
 async function execute(name,args){const ticket=generation;let decision='not-requested';try{const [,permission]=tool(name,args);const local=name.startsWith('crm.')||name.startsWith('finance.');const prepared=local?await crm('prepare',{name,args}):await windows.prepare(name,args);
  if(prepared?.ok===false)throw Error(prepared.error||'La preparación falló.');if(!prepared||(!prepared.result&&local&&typeof prepared.token!=='string'))throw Error('Propuesta inválida.');
  if(prepared.result?.ok===false){audit(name,args,decision,prepared.result);return prepared.result;}
  const needs=permission!=='read'&&!(permission==='light'&&(name==='crm.navigate'||windows.isGranted?.(name,args)));
  if(needs){decision=await confirm({name,permission,args,preview:prepared.preview})?'approved':'rejected';if(decision==='rejected'){if(local&&prepared.token)await crm('cancel',{token:prepared.token});const r={ok:false,error:'Cancelado por el usuario; no se realizaron cambios.'};audit(name,args,decision,r);return r;}}
  if(ticket!==generation){if(local&&prepared.token)await crm('cancel',{token:prepared.token});throw Error('Acción cancelada antes de ejecutar.');}
  const result=prepared.result|| (local?await crm('commit',{token:prepared.token}):await windows.execute(name,args,prepared));if(!result||typeof result.ok!=='boolean')throw Error('Respuesta de herramienta inválida.');audit(name,args,decision,result);return result;
 }catch(error){const r={ok:false,error:error.message};audit(name,args,decision,r);return r;}}
 return {catalog,execute,cancel:()=>generation++};
}
module.exports={createRegistry};
