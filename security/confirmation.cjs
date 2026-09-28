'use strict';
const {randomUUID}=require('node:crypto');
// One active immutable action, one expiring token. Neither model tools nor
// a consent grant can produce an approval for a different sensitive action.
function createConfirmation({send,now=Date.now,ttl=90000}){
 let pending=null;
 function finish(approved){if(!pending)return;const p=pending;pending=null;clearTimeout(p.timer);send({type:'confirmation-ended',token:p.token});p.resolve(approved);}
 function current(token){if(!pending||pending.token!==token||pending.expires<=now())throw Error('Confirmación caducada o no corresponde a esta acción.');return pending;}
 return {request(action){if(pending)throw Error('Confirma o cancela la acción pendiente.');const token=randomUUID(),expires=now()+ttl,snapshot=structuredClone(action);return new Promise(resolve=>{pending={token,expires,action:snapshot,resolve,timer:setTimeout(()=>finish(false),ttl)};send({type:'confirmation',token,expires,...snapshot});});},
  answer(token,approved){current(token);if(typeof approved!=='boolean')throw Error('Decisión inválida.');finish(approved);return approved;},
  spoken(token,text){current(token);const normalized=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[.,!?¡¿]/g,'').replace(/\s+/g,' ');if(normalized!=='si confirma')throw Error('No se confirmó. Di exactamente «Sí, confirma» o usa el botón.');finish(true);return true;},
  inspect(token){return structuredClone(current(token).action);},cancel(){finish(false);}
 };
}
module.exports={createConfirmation};
