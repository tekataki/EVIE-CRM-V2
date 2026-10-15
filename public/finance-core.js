'use strict';
/* Finance semantics (pure, integer cents). Used by Finanzas, Inicio and EVIE. ONE balance formula for the app.
   "Saldo disponible estimado" = money you could spend NOW from cash/debit/wallet accounts:
     baseline (opening, or the latest reconciliation) + movements assigned to that account after the baseline.
   - Credit cards are NEVER counted as available cash (their limit is not money you own).
   - Transfers between own accounts (paired by transfer_id, or category "Transferencia") move money between two
     balances and never count as income/expense in period statistics.
   - Reconciliations (account.reconciliations[]) establish an auditable balance; they are NOT income/expense.
     Legacy "Ajuste de saldo" transactions (source evie-reconcile) are kept and still affect their account
     balance exactly as before, but are excluded from period statistics and flagged for review.
   - Movements without an account are reported separately ("sin cuenta") and never change account balances.
   - With no accounts at all the card falls back to the legacy ledger estimate, labelled as such. */
(function(root){
 const isTransfer=t=>!!t.transfer_id||/^transferencia/i.test(String(t.category||''));
 const isAdjust=t=>t.kind==='adjustment'||t.source==='evie-reconcile';
 const isStat=t=>!isTransfer(t)&&!isAdjust(t);
 const live=list=>(Array.isArray(list)?list:[]).filter(t=>t&&!t.deleted_at&&Number.isInteger(t.amount));
 const signed=t=>t.type==='income'?t.amount:t.type==='expense'?-t.amount:0;
 const TYPES=Object.freeze({cash:'Efectivo',debit:'Débito / nómina',wallet:'Cartera digital',credit:'Tarjeta de crédito'});
 /* Baseline: the latest reconciliation (if any) replaces the opening balance. A movement counts after the baseline
    when it was RECORDED after it (created_at > baseline.at) — so a back-dated expense logged today still counts,
    while movements already reflected in a reconciled real balance do not. Accounts created before v4 have no
    baseline timestamp: every assigned movement counts, exactly as before (no silent change). A movement the user
    marked as "ya estaba incluido en el saldo inicial" (in_baseline) never counts. */
 function baseline(a){const r=Array.isArray(a.reconciliations)?a.reconciliations.filter(x=>x&&Number.isInteger(x.balance)&&typeof x.date==='string'):[];const last=r.slice().sort((x,y)=>String(x.at||x.date).localeCompare(String(y.at||y.date))).at(-1);
  return last?{cents:last.balance,date:last.date,at:last.at||'',source:'reconcile',id:last.id}:{cents:Number.isInteger(a.opening)?a.opening:0,date:a.opening_date||null,at:a.opening_at||'',source:'opening'};}
 const afterBase=(t,b)=>!t.in_baseline&&(!b.at||String(t.created_at||'')>b.at);
 function accountNet(a,tx){const b=baseline(a);return {b,net:tx.filter(t=>t.evie_account===a.id&&afterBase(t,b)).reduce((s,t)=>s+signed(t),0)};}
 function available(accounts,transactions,{today=null}={}){
  const acc=(Array.isArray(accounts)?accounts:[]).filter(a=>a&&!a.archived);
  const tx=live(transactions).filter(t=>!today||!t.date||t.date<=today);
  const cashAcc=acc.filter(a=>a.type!=='credit'),creditAcc=acc.filter(a=>a.type==='credit');
  const per=cashAcc.map(a=>{const {b,net}=accountNet(a,tx);return {id:a.id,name:a.name,type:a.type,balance:b.cents+net,baseline:b,reconciled:b.source==='reconcile'||Number.isInteger(a.opening)};});
  const credit=creditAcc.map(a=>{const {b,net}=accountNet(a,tx),used=Math.max(0,b.cents-net);return {id:a.id,name:a.name,used,limit:a.limit||0,available_credit:Math.max(0,(a.limit||0)-used)};});
  const unassigned=tx.filter(t=>!t.evie_account&&!isTransfer(t));
  const ledger=live(transactions).filter(isStat).reduce((s,t)=>s+signed(t),0);
  const total=per.reduce((s,a)=>s+a.balance,0),basis=per.length?'accounts':'ledger';
  return {basis,cents:basis==='accounts'?total:ledger,accounts:per,credit,credit_debt:credit.reduce((s,c)=>s+c.used,0),
   unassigned_count:unassigned.length,unassigned_net:unassigned.reduce((s,t)=>s+signed(t),0),ledger_estimate:ledger,
   adjustments:live(transactions).filter(isAdjust).length,
   verified:basis==='accounts'&&per.every(a=>a.reconciled)};
 }
 function balanceOf(accounts,transactions,id,opts){const a=available(accounts,transactions,opts);return a.accounts.find(x=>x.id===id)||a.credit.find(x=>x.id===id)||null;}
 function periodTotals(transactions,from,to){const rows=live(transactions).filter(t=>isStat(t)&&t.date>=from&&t.date<=to);const income=rows.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),expense=rows.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);return {income,expense,net:income-expense,count:rows.length};}
 const addDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
 // Buckets for the grouped bar chart. 7 d → daily; 30 d → daily (weekly on narrow screens); 90 d → weekly.
 function buckets(transactions,days,today,{narrow=false}={}){const from=addDays(today,1-days),step=days>=90||(narrow&&days>=30)?7:1,out=[];
  for(let start=from;start<=today;start=addDays(start,step)){const end=step===1?start:(addDays(start,step-1)>today?today:addDays(start,step-1));out.push({start,end,...periodTotals(transactions,start,end)});}
  return {from,to:today,step,buckets:out,totals:periodTotals(transactions,from,today)};}
 /* ---------- account resolution for natural language ("de mi dinero físico", "en BBVA") ---------- */
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const ALIAS={cash:['efectivo','dinero fisico','fisico','cash','cartera fisica','billetes','en mano'],wallet:['cartera digital','mercado pago','spin','paypal'],debit:['debito','tarjeta de debito','nomina','banco'],credit:['credito','tarjeta de credito']};
 const STOP=['mi','mis','la','el','los','las','de','del','cuenta','tarjeta','dinero'];
 /** {status:'unique',account}|{status:'ambiguous',candidates}|{status:'not_found'|'no_accounts'}.
     With no phrase and fallback 'single', the only account is used. */
 function resolveAccount(accounts,phrase,{fallback='single'}={}){const acc=(Array.isArray(accounts)?accounts:[]).filter(a=>a&&!a.archived);const q=norm(phrase);
  if(!acc.length)return {status:'no_accounts',candidates:[]};
  if(q){const exact=acc.filter(a=>norm(a.name)===q);if(exact.length===1)return {status:'unique',account:exact[0],via:'name'};
   const words=q.split(' ').filter(w=>w.length>2&&!STOP.includes(w));
   const byName=acc.filter(a=>{const n=norm(a.name);return n.includes(q)||q.includes(n)||(words.length&&words.every(w=>n.includes(w)));});if(byName.length===1)return {status:'unique',account:byName[0],via:'name'};if(byName.length>1)return {status:'ambiguous',candidates:byName};
   const types=Object.entries(ALIAS).filter(([,list])=>list.some(x=>q.includes(x))).map(([t])=>t);
   const byType=acc.filter(a=>types.includes(a.type)||(types.includes('cash')&&/efectivo|fisico|cash/.test(norm(a.name))));if(byType.length===1)return {status:'unique',account:byType[0],via:'type'};if(byType.length>1)return {status:'ambiguous',candidates:byType};
   return {status:'not_found',candidates:acc};}
  if(fallback==='single'&&acc.length===1)return {status:'unique',account:acc[0],via:'only'};
  return {status:'ambiguous',candidates:acc};}
 /** Double-count check for assigning a legacy movement to an account.
     included=true  → recorded before the baseline (e.g. before a reconciliation): already reflected, no change.
     included=null  → legacy account without baseline time: assigning WILL change the balance by delta unless the
                      user says the opening balance already included it (then mark in_baseline).
     included=false → recorded after the baseline: assigning changes the balance by delta. */
 function assignmentImpact(account,t){if(!account||!t)return null;const b=baseline(account);const d=signed(t);
  if(b.at){const inc=!afterBase({...t,in_baseline:false},b);return {included:inc,baseline:b.source,baseline_date:b.date,changes_balance:!inc,delta:inc?0:d};}
  const created=String(account.created_at||'').slice(0,10),maybe=created?t.date<=created:true;return {included:null,maybe_included:maybe,baseline:b.source,baseline_date:created||null,changes_balance:true,delta:d};}
 function opKey(o){return [o.kind||'tx',o.type||'',o.amount,o.account||'',o.to||'',norm(o.title).slice(0,40),o.date].join('|');}
 const api=Object.freeze({available,balanceOf,periodTotals,buckets,isTransfer,isAdjust,isStat,addDays,baseline,resolveAccount,assignmentImpact,opKey,norm,TYPES,signed});
 root.FinanceCore=api;
})(typeof window!=='undefined'?window:globalThis);
