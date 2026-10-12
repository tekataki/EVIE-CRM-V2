'use strict';
/* SOMA client payment schedules, stored on the client record (clients[].schedules) so they sync with
   the account like any client field and never leak across accounts.
   schedule = {id,title,amount (cents per installment),frequency once|weekly|biweekly|monthly,
               days_of_month[], start, installments (int|null=open), forecast (bool), status active|paused|done,
               receipts:[{id,due,amount,date,payment_id}]}
   Confirming a collection creates exactly ONE client payment via Domain.linkedPayment, which creates
   exactly one Finance income (origin=payment.id). Idempotent per caller key. Projections are never
   written as transactions. */
window.SomaPayments=(()=>{
 const DAY=86400000,iso=t=>new Date(t).toISOString().slice(0,10),addDays=(d,n)=>iso(Date.parse(d+'T12:00:00Z')+n*DAY),dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&iso(Date.parse(d+'T12:00:00Z'))===d;
 function normalize(x){
  const f=['once','weekly','biweekly','monthly'].includes(x?.frequency)?x.frequency:null;if(!f)throw Error('Elige la frecuencia del cobro.');
  if(!Number.isSafeInteger(x.amount)||x.amount<=0)throw Error('El monto de cada cobro debe ser mayor a cero.');
  if(!valid(x.start))throw Error('Fecha de inicio no válida.');
  const days=f==='monthly'?[...new Set((x.days_of_month||[]).map(Number))].filter(n=>Number.isInteger(n)&&n>=1&&n<=31).sort((a,b)=>a-b).slice(0,4):[];
  if(f==='monthly'&&!days.length)throw Error('¿Qué día o días del mes se cobra?');
  const inst=x.installments==null||x.installments===''?null:Number(x.installments);
  if(inst!==null&&(!Number.isInteger(inst)||inst<1||inst>240))throw Error('Número de pagos no válido (1–240).');
  return {id:typeof x.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(x.id)?x.id:crypto.randomUUID(),title:String(x.title||'Cobro recurrente').trim().slice(0,120)||'Cobro recurrente',amount:x.amount,frequency:f,days_of_month:days,start:x.start,installments:f==='once'?1:inst,forecast:x.forecast===true,status:['active','paused','done'].includes(x.status)?x.status:'active',receipts:Array.isArray(x.receipts)?x.receipts:[]};
 }
 // Day 31 clamps to the month's last day (Feb 28/29); a month is never skipped.
 function dues(sc,until,cap=400){const out=[],max=Math.min(sc.installments??Infinity,cap);if(sc.frequency==='once')return sc.start<=until?[sc.start]:[];
  if(sc.frequency!=='monthly'){const step=sc.frequency==='weekly'?7:14;for(let d=sc.start;d<=until&&out.length<max;d=addDays(d,step))out.push(d);return out;}
  let [y,m]=sc.start.split('-').map(Number);
  while(out.length<max&&y<=9999){for(const day of sc.days_of_month){const d=`${y}-${String(m).padStart(2,'0')}-${String(Math.min(day,dim(y,m))).padStart(2,'0')}`;if(d<sc.start)continue;if(d>until)return out;if(out.length<max&&!out.includes(d))out.push(d);}if(++m>12){m=1;y++;}}
  return out;}
 const paidFor=(sc,due)=>(sc.receipts||[]).filter(r=>r.due===due).reduce((s,r)=>s+r.amount,0);
 const installmentsOf=(sc,{until})=>dues(sc,until).map((due,i)=>{const paid=paidFor(sc,due);return {due,index:i+1,paid,remaining:Math.max(0,sc.amount-paid),status:paid>=sc.amount?'paid':paid>0?'partial':'due'};});
 function upcoming(state,{today,until}){const out=[];for(const c of (state.clients||[]).filter(c=>!c.deleted_at))for(const sc of c.schedules||[]){if(sc.status!=='active')continue;for(const it of installmentsOf(sc,{until}))if(it.status!=='paid'&&it.due>=addDays(today,-60))out.push({client:c.title,client_id:c.id,schedule_id:sc.id,title:sc.title,due:it.due,remaining:it.remaining,partial:it.status==='partial',label:it.index+(sc.installments?'/'+sc.installments:''),forecast:sc.forecast});}return out.sort((a,b)=>a.due.localeCompare(b.due));}
 function forecast(state,{today,until}){const rows=upcoming(state,{today,until}).filter(x=>x.forecast&&x.due>=today);return {rows,total:rows.reduce((s,x)=>s+x.remaining,0)};}
 function balances(state,{today}){return (state.clients||[]).filter(c=>!c.deleted_at&&(c.schedules||[]).length).map(c=>{const list=upcoming({clients:[c]},{today,until:addDays(today,120)});return {client_id:c.id,client:c.title,overdue:list.filter(x=>x.due<today).reduce((s,x)=>s+x.remaining,0),next:list.find(x=>x.due>=today)||null,outstanding:Domain.outstanding(c)};});}
 function confirm(s,{client_id,schedule_id,due,amount,date,key}){
  const c=s.clients.find(x=>x.id===client_id&&!x.deleted_at);if(!c)throw Error('Cliente no encontrado.');
  const sc=(c.schedules||[]).find(x=>x.id===schedule_id);if(!sc)throw Error('Calendario de cobro no encontrado.');
  if(!valid(due)||!dues(sc,due).includes(due))throw Error('Esa fecha no pertenece al calendario.');
  if(!valid(date))throw Error('Fecha de cobro no válida.');
  if(typeof key!=='string'||!/^[a-zA-Z0-9-]{8,76}$/.test(key))throw Error('Solicitud sin clave de idempotencia.');
  const pid='sp-'+key;
  if((sc.receipts||[]).some(r=>r.payment_id===pid)||(c.payments||[]).some(p=>p.id===pid))return {created:false,payment_id:pid};
  const remaining=sc.amount-paidFor(sc,due);if(remaining<=0)throw Error('Esa cuota ya está cobrada.');
  if(!Number.isSafeInteger(amount)||amount<=0||amount>remaining)throw Error('El monto debe ser mayor a cero y no superar lo pendiente de la cuota ('+Domain.money(remaining)+').');
  if(amount>Domain.outstanding(c))throw Error('El cobro supera el saldo por cobrar del cliente. Actualiza el valor contratado primero.');
  Domain.linkedPayment(s,'clients',client_id,{id:pid,amount,date,link:true,note:'Cuota '+due+' · '+sc.title});
  sc.receipts=[...(sc.receipts||[]),{id:pid,due,amount,date,payment_id:pid}];
  if(sc.installments&&installmentsOf(sc,{until:'9999-12-31'}).every(i=>i.status==='paid'))sc.status='done';
  c.updated_at=new Date().toISOString();return {created:true,payment_id:pid};
 }
 function addSchedule(s,client_id,input){const c=s.clients.find(x=>x.id===client_id&&!x.deleted_at);if(!c)throw Error('Cliente no encontrado.');const sc=normalize(input);c.schedules=[...(c.schedules||[]).filter(x=>x.id!==sc.id),sc];c.updated_at=new Date().toISOString();return sc;}
 function setStatus(s,client_id,schedule_id,status){const c=s.clients.find(x=>x.id===client_id);const sc=c?.schedules?.find(x=>x.id===schedule_id);if(!sc||!['active','paused'].includes(status))throw Error('No se pudo cambiar el estado.');sc.status=status;c.updated_at=new Date().toISOString();}
 function validateClient(c){for(const sc of c.schedules||[]){normalize(sc);const paid=new Map();for(const r of sc.receipts||[]){if(!valid(r.due)||!Number.isSafeInteger(r.amount)||r.amount<=0||!(c.payments||[]).some(p=>p.id===r.payment_id&&p.amount===r.amount))throw Error('Cobro programado inconsistente con los abonos del cliente.');paid.set(r.due,(paid.get(r.due)||0)+r.amount);if(paid.get(r.due)>sc.amount)throw Error('Una cuota tiene más cobrado que su monto.');}}return true;}
 return Object.freeze({normalize,dues,installmentsOf,upcoming,forecast,balances,confirm,addSchedule,setStatus,validateClient,addDays});
})();
