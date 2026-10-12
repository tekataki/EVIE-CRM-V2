'use strict';
/* Finance semantics (pure, integer cents). Used by Finanzas, Inicio and EVIE.
   "Saldo disponible estimado" = money you could spend NOW from cash/debit/wallet accounts:
     opening balance (or last reconciliation) + movements assigned to that account, up to today.
   - Credit cards are NEVER counted as available cash (their limit is not money you own).
   - Transfers between own accounts (paired by transfer_id, or category "Transferencia") cancel out.
   - Movements without an account are reported separately ("sin cuenta"); with no accounts at all the
     card falls back to the legacy ledger estimate, labelled as such (lifetime income − expenses ≠ cash). */
(function(root){
 const isTransfer=t=>!!t.transfer_id||/^transferencia/i.test(String(t.category||''));
 const live=list=>(Array.isArray(list)?list:[]).filter(t=>t&&!t.deleted_at&&Number.isInteger(t.amount));
 const signed=t=>t.type==='income'?t.amount:t.type==='expense'?-t.amount:0;
 function available(accounts,transactions,{today=null}={}){
  const acc=(Array.isArray(accounts)?accounts:[]).filter(a=>a&&!a.archived);
  const tx=live(transactions).filter(t=>!today||!t.date||t.date<=today);
  const cashAcc=acc.filter(a=>a.type!=='credit'),creditAcc=acc.filter(a=>a.type==='credit');
  const per=cashAcc.map(a=>{const net=tx.filter(t=>t.evie_account===a.id).reduce((s,t)=>s+signed(t),0);return {id:a.id,name:a.name,type:a.type,balance:(Number.isInteger(a.opening)?a.opening:0)+net,reconciled:!!a.reconciled_at||Number.isInteger(a.opening)};});
  const credit=creditAcc.map(a=>{const net=tx.filter(t=>t.evie_account===a.id).reduce((s,t)=>s+signed(t),0),used=Math.max(0,(a.opening||0)-net);return {id:a.id,name:a.name,used,limit:a.limit||0,available_credit:Math.max(0,(a.limit||0)-used)};});
  const unassigned=tx.filter(t=>!t.evie_account&&!isTransfer(t));
  const ledger=live(transactions).filter(t=>!isTransfer(t)).reduce((s,t)=>s+signed(t),0);
  const total=per.reduce((s,a)=>s+a.balance,0),basis=per.length?'accounts':'ledger';
  return {basis,cents:basis==='accounts'?total:ledger,accounts:per,credit,credit_debt:credit.reduce((s,c)=>s+c.used,0),
   unassigned_count:unassigned.length,unassigned_net:unassigned.reduce((s,t)=>s+signed(t),0),ledger_estimate:ledger,
   verified:basis==='accounts'&&per.every(a=>a.reconciled)};
 }
 function periodTotals(transactions,from,to){const rows=live(transactions).filter(t=>!isTransfer(t)&&t.date>=from&&t.date<=to);const income=rows.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),expense=rows.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);return {income,expense,net:income-expense,count:rows.length};}
 const addDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
 // Buckets for the grouped bar chart. 7 d → daily; 30 d → daily (weekly on narrow screens); 90 d → weekly.
 function buckets(transactions,days,today,{narrow=false}={}){const from=addDays(today,1-days),step=days>=90||(narrow&&days>=30)?7:1,out=[];
  for(let start=from;start<=today;start=addDays(start,step)){const end=step===1?start:(addDays(start,step-1)>today?today:addDays(start,step-1));out.push({start,end,...periodTotals(transactions,start,end)});}
  return {from,to:today,step,buckets:out,totals:periodTotals(transactions,from,today)};}
 const api=Object.freeze({available,periodTotals,buckets,isTransfer,addDays});
 root.FinanceCore=api;
})(typeof window!=='undefined'?window:globalThis);
