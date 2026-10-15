'use strict';
/* EvieFinance: the ONE write path for ordinary money movements (manual form, Ivi local intents, model tools).
   - Every movement gets an account when one is meaningful; ambiguity returns ONE short question instead of guessing.
   - Idempotency: each write carries a stable op_id (caller-supplied, e.g. the model call id, or derived from
     content + a 2-minute window). A retry / repeated utterance with the same op_id returns the existing record.
   - Transfers: two linked records (expense from A, income to B) sharing transfer_id → balances move,
     period statistics do not change.
   - Reconciliation: stored on the account as an auditable baseline ({balance,date,at,previous_estimate});
     it never creates income/expense. Legacy adjustment transactions are preserved and only flagged.
   - Undo: soft-deletes exactly the records this operation created (same IDs → sync propagates the tombstone).
   Data lives in the existing Store (transactions + preferences.evieAccounts) and syncs through the existing
   Supabase crm_records / user_preferences path. No new tables. */
window.EvieFinance=(()=>{
 const F=()=>window.FinanceCore,money=c=>Domain.money(c),today=()=>Domain.today();
 const accounts=()=>{const a=Store.get()?.preferences?.evieAccounts;return Array.isArray(a)?a.filter(x=>x&&!x.archived):[];};
 const live=()=>Store.list('transactions');
 const WINDOW=120000;
 const findOp=op=>op?Store.get().transactions.filter(t=>t.op_id===op&&!t.deleted_at):[];
 function hash(s){let h1=0x811c9dc5,h2=0x1000193;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,16777619)>>>0;h2=Math.imul(h2+c,2654435761)>>>0;}return h1.toString(36)+h2.toString(36);}
 const deriveOp=o=>'op-'+hash(F().opKey(o)+'|'+Math.floor(Date.now()/WINDOW));
 const cleanOp=v=>String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
 const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
 function balanceText(id){const b=F().balanceOf(accounts(),live(),id,{today:today()});if(!b)return '';return b.used!==undefined?`deuda estimada ${money(b.used)}`:`saldo estimado ${money(b.balance)}`;}
 function accountLabel(id){const a=(Store.get()?.preferences?.evieAccounts||[]).find(x=>x.id===id);return a?a.name:null;}
 const listNames=c=>{const n=c.map(a=>a.name);return n.length>1?n.slice(0,-1).join(', ')+' o '+n.at(-1):n[0]||'';};
 /** Resolve the account for a movement. Returns {account}|{question,candidates}. */
 function pickAccount(phrase){const acc=accounts();if(!acc.length)return {account:null,note:'no_accounts'};
  let r=F().resolveAccount(acc,phrase);
  if(!phrase&&r.status==='ambiguous'){const nonCredit=acc.filter(a=>a.type!=='credit');if(nonCredit.length===1)r={status:'unique',account:nonCredit[0],via:'only'};}
  if(r.status==='unique')return {account:r.account,via:r.via};
  const c=r.status==='ambiguous'?r.candidates:acc;
  return {question:r.status==='not_found'?`No encontré la cuenta «${phrase}». ¿Es ${listNames(c)}?`:`¿De cuál cuenta: ${listNames(c)}?`,candidates:c.map(a=>({id:a.id,name:a.name,type:a.type})),status:r.status};}
 function guessCategory(t){const q=F().norm(t);return /comida|taco|super|despensa|restaurante|cafe|almuerzo|cena|desayuno|antojo|lonche|torta/.test(q)?'Comida':/gasolina|uber|taxi|camion|transporte/.test(q)?'Gasolina':/gym|gimnasio|proteina/.test(q)?'Gimnasio':/escuela|colegiatura|libro|papeleria/.test(q)?'Escuela':'Personal';}
 /** Log one ordinary income/expense. args: {type,amount (cents),title,date,account (id|name|phrase),account_id,
     category,note,op_id,source,soma_client (id; ONLY when the user explicitly links a SOMA client)}. */
 function log(args={}){
  const type=args.type;if(!['income','expense'].includes(type))return {status:'needs',field:'type',question:'¿Es un gasto o un ingreso?'};
  const amount=Number(args.amount);if(!Number.isSafeInteger(amount)||amount<=0||amount>1e12)return {status:'needs',field:'amount',question:'¿De cuánto fue?'};
  const title=String(args.title||'').trim().slice(0,140)||(type==='expense'?'Gasto':'Ingreso');
  const date=V2Domain.date(args.date)&&args.date<=V2Domain.addDays(today(),1)?args.date:today();
  let accId=null;if(args.account_id&&accounts().some(a=>a.id===args.account_id))accId=args.account_id;
  else{const p=pickAccount(args.account||'');if(p.question)return {status:'needs',field:'account',question:p.question,candidates:p.candidates};accId=p.account?.id||null;}
  const op=cleanOp(args.op_id)||deriveOp({type,amount,account:accId,title,date});
  const dup=findOp(op);if(dup.length)return {status:'duplicate',record:dup[0],op_id:op,say:`Ese movimiento ya estaba registrado: ${dup[0].title}, ${money(dup[0].amount)}. No lo dupliqué.`};
  const cats=Store.get().categories||DALI_CONFIG.categories;
  const category=args.category&&cats.includes(args.category)?args.category:(type==='income'?(args.soma_client?'Clientes':'Ventas'):guessCategory(title));
  let client=null;if(args.soma_client){client=Store.list('clients').find(c=>c.id===args.soma_client)||null;if(!client)return {status:'error',error:'No encontré ese cliente de SOMA.'};}
  let rec;
  Store.save(s=>{const t=Store.record(Records.normalize('transactions',{title,date,amount,type,category,business_unit:client?'soma':'personal',note:String(args.note||'').slice(0,2000),source:args.source||'evie'}));
   if(accId)t.evie_account=accId;t.op_id=op;if(client){t.soma_client=client.id;t.soma_client_name=client.title;}t.provenance={via:args.source||'evie',at:t.created_at};s.transactions.push(t);rec=t;});
  const acc=accId?accountLabel(accId):null;
  return {status:'created',record:rec,op_id:op,account:acc,balance:accId?balanceText(accId):null,
   say:`Listo: ${type==='expense'?'gasto':'ingreso'} de ${money(amount)}${acc?(type==='expense'?' de ':' en ')+acc:' (sin cuenta)'} · ${title}.${accId?' '+cap(balanceText(accId))+'.':''}`,
   undo:()=>undoIds([rec.id])};}
 /** Transfer between own accounts: two records sharing transfer_id; statistics unchanged. */
 function transfer({amount,from,to,from_id,to_id,date,note,op_id,source}={}){
  amount=Number(amount);if(!Number.isSafeInteger(amount)||amount<=0)return {status:'needs',field:'amount',question:'¿Cuánto vas a pasar?'};
  if(accounts().length<2)return {status:'error',error:'Para una transferencia necesitas al menos dos cuentas.'};
  const byId=id=>accounts().find(a=>a.id===id);
  const a=from_id&&byId(from_id)?{account:byId(from_id)}:pickAccount(from||'__none__');if(a.question)return {status:'needs',field:'from',question:a.question.replace('¿De cuál cuenta','¿Desde cuál cuenta'),candidates:a.candidates};
  const b=to_id&&byId(to_id)?{account:byId(to_id)}:pickAccount(to||'__none__');if(b.question)return {status:'needs',field:'to',question:b.question.replace('¿De cuál cuenta','¿A cuál cuenta'),candidates:b.candidates};
  if(a.account.id===b.account.id)return {status:'needs',field:'to',question:'El origen y el destino son la misma cuenta. ¿A cuál cuenta lo paso?'};
  date=V2Domain.date(date)?date:today();const op=cleanOp(op_id)||deriveOp({kind:'transfer',amount,account:a.account.id,to:b.account.id,title:'',date});
  if(findOp(op).length)return {status:'duplicate',op_id:op,say:'Esa transferencia ya estaba registrada. No la dupliqué.'};
  const tid=Store.uuid(),ids=[];
  Store.save(s=>{for(const [acc,type,title] of [[a.account,'expense','Transferencia a '+b.account.name],[b.account,'income','Transferencia desde '+a.account.name]]){const t=Store.record(Records.normalize('transactions',{title,date,amount,type,category:'Otro',business_unit:'personal',note:String(note||'').slice(0,500),source:source||'evie-transfer'}));t.evie_account=acc.id;t.transfer_id=tid;t.op_id=op;t.kind='transfer';s.transactions.push(t);ids.push(t.id);}});
  return {status:'created',transfer_id:tid,op_id:op,say:`Pasé ${money(amount)} de ${a.account.name} a ${b.account.name}. ${a.account.name}: ${balanceText(a.account.id)}; ${b.account.name}: ${balanceText(b.account.id)}. Tus ingresos y gastos del periodo no cambian.`,undo:()=>undoIds(ids)};}
 /** Reconcile: record the real balance as an auditable baseline (no income/expense, no monthly statistics). */
 function reconcile(id,realCents,{date=today()}={}){const acc=(Store.get().preferences.evieAccounts||[]).find(a=>a.id===id);if(!acc)throw Error('Cuenta no encontrada.');if(!Number.isSafeInteger(realCents)||realCents<0)throw Error('Saldo inválido.');
  const credit=acc.type==='credit',before=F().balanceOf(accounts(),live(),id,{today:today()}),prev=credit?before?.used:before?.balance;
  const entry={id:Store.uuid(),date,at:new Date().toISOString(),balance:realCents,previous_estimate:Number.isInteger(prev)?prev:null};
  Store.save(s=>{const a=s.preferences.evieAccounts.find(x=>x.id===id);a.reconciliations=[...(Array.isArray(a.reconciliations)?a.reconciliations:[]),entry].slice(-50);});
  return {status:'reconciled',entry,diff:entry.previous_estimate==null?null:realCents-entry.previous_estimate,undo:()=>Store.save(s=>{const a=s.preferences.evieAccounts.find(x=>x.id===id);a.reconciliations=(a.reconciliations||[]).filter(r=>r.id!==entry.id);})};}
 function undoIds(ids){const set=new Set(ids);Store.save(s=>{for(const t of s.transactions)if(set.has(t.id)&&!t.deleted_at){t.deleted_at=new Date().toISOString();t.updated_at=t.deleted_at;}});App.render?.();}
 /** Change the account of an existing movement (same id/date/note/provenance). inBaseline=true marks it as
     already included in the account's starting balance (shown, but not counted twice). */
 function setAccount(txId,accId,{inBaseline=false}={}){const acc=accId?accounts().find(a=>a.id===accId):null;if(accId&&!acc)throw Error('Cuenta no encontrada.');let impact=null;
  Store.save(s=>{const t=s.transactions.find(x=>x.id===txId);if(!t)throw Error('Movimiento no encontrado.');if(t.transfer_id)throw Error('Es una transferencia: edítala completa, no solo un lado.');impact=acc?F().assignmentImpact(acc,t):null;
   if(acc){t.evie_account=acc.id;if(inBaseline)t.in_baseline=true;else delete t.in_baseline;}else{delete t.evie_account;delete t.in_baseline;}t.account_reviewed_at=new Date().toISOString();t.updated_at=t.account_reviewed_at;});return impact;}
 /** Legacy unassigned movements, newest first, with the double-count assessment per account. */
 function reviewQueue(){const acc=accounts();return live().filter(t=>!t.evie_account&&!F().isTransfer(t)).sort((a,b)=>b.date.localeCompare(a.date)).map(t=>({t,impacts:acc.map(a=>({account:a,...F().assignmentImpact(a,t)}))}));}
 /** Safe account-type correction (e.g. «Dinero Físico» labelled debit → cash). Value/history untouched. */
 function suggestions(){return accounts().filter(a=>a.type!=='cash'&&/efectivo|f[ií]sico|cash|cartera f/i.test(a.name)).map(a=>({id:a.id,name:a.name,from:a.type,to:'cash'}));}
 function setType(id,type){if(!F().TYPES[type])throw Error('Tipo inválido.');Store.save(s=>{const a=s.preferences.evieAccounts.find(x=>x.id===id);a.type_history=[...(a.type_history||[]),{from:a.type,to:type,at:new Date().toISOString()}].slice(-10);a.type=type;});}
 /* ---------- Spanish phrase parser for local (no-AI) logging ----------
    «gasté 200 pesos de mi dinero físico en comida» · «recibí 500 pesos por un Intensity en BBVA»
    «agrega un gasto de 300 pesos» · «pasa 200 de efectivo a BBVA» · «transfiere 1,000 de BBVA a dinero físico» */
 const NUM='(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
 const CUR='(?:\\s*(?:pesos|peso|mxn|varos|\\$))?';
 function toCents(s){let v=String(s).trim();if(/^\d{1,3}([.,]\d{3})+$/.test(v))v=v.replace(/[.,]/g,'');else if(/^\d{1,3}([.,]\d{3})+[.,]\d{1,2}$/.test(v))v=v.slice(0,-3).replace(/[.,]/g,'')+'.'+v.slice(-2);else v=v.replace(',','.');return Math.round(Number(v)*100);}
 const WAKE=/^(?:oye |hey |hola )?(?:ivi|ivy|evie|evi|ibi|libi)[, ]+/;
 const ACC_PREP=/\s(?:de|desde|con|en)\s+(?:mi cuenta |la cuenta |mi tarjeta |la tarjeta |mi |mis |la |el )?(dinero fisico|efectivo|cash|cartera digital|tarjeta de credito|tarjeta de debito|[a-z0-9]+(?: [a-z0-9]+)?)(?=\s)/g;
 function parse(text){const q=F().norm(text).replace(WAKE,'').trim();if(!q)return null;
  let m=q.match(new RegExp('^(?:pasa|pase|transfiere|transferi|mueve|movi)\\s+\\$?'+NUM+CUR+'\\s+(?:de|desde)\\s+(?:mi |la |el )?(.+?)\\s+(?:a|al|hacia)\\s+(?:mi |la |el )?(.+)$'));
  if(m)return {kind:'transfer',amount:toCents(m[1]),from:m[2],to:m[3]};
  let type='expense';m=q.match(new RegExp('^(?:gaste|pague|compre|me gaste|(?:registra|agrega|anota|apunta|pon)(?:r|me)?\\s+un gasto de|un gasto de|gasto de)\\s+\\$?'+NUM+CUR+'(.*)$'));
  if(!m){type='income';m=q.match(new RegExp('^(?:recibi|me pagaron|cobre|me depositaron|me transfirieron|gane|me entraron|(?:registra|agrega|anota|apunta|pon)(?:r|me)?\\s+un ingreso de|un ingreso de|ingreso de)\\s+\\$?'+NUM+CUR+'(.*)$'));}
  if(!m)return null;const amount=toCents(m[1]);let rest=' '+m[2].trim()+' ',account=null;
  for(const seg of rest.match(ACC_PREP)||[]){const w=seg.replace(/^\s(?:de|desde|con|en)\s+(?:mi cuenta |la cuenta |mi tarjeta |la tarjeta |mi |mis |la |el )?/,'').trim();const r=F().resolveAccount(accounts(),w,{fallback:'none'});
   if(r.status==='unique'||(r.status==='ambiguous'&&/efectivo|fisico|cash|tarjeta|cuenta/.test(w))||/^(dinero fisico|efectivo|cash)$/.test(w)){account=w;rest=rest.replace(seg,' ');break;}}
  const title=rest.replace(/\s+/g,' ').trim().replace(/^(?:en|por|de|para|del)\s+(?:un |una |el |la |los |las |unos |unas )?/,'').trim();
  return {kind:'tx',type,amount,account,title:cap(title||(type==='expense'?'Gasto':'Ingreso')).slice(0,140)};}
 let pending=null; // one short clarification at a time (which account)
 /** Local intent for Ivi. Returns spoken text, or null if not a finance command. */
 function intent(text){
  if(pending){const q=F().norm(text).replace(WAKE,'').replace(/^(?:de |en |la |el |mi |a )+/,'').trim();if(/^(cancela|cancelalo|olvidalo|nada|ninguna|no)$/.test(q)){pending=null;return 'Listo, no registré nada.';}
   if(!parse(text)){const r=F().resolveAccount(accounts(),q,{fallback:'none'});if(r.status==='unique'){const p=pending;pending=null;return finish(p.kind==='transfer'?transfer({...p.args,[p.field+'_id']:r.account.id}):log({...p.args,account_id:r.account.id}));}
    if(Date.now()-pending.at<90000)return `No reconocí «${q}». Dime ${listNames(accounts())}, o «cancela».`;}pending=null;}
  const p=parse(text);if(!p)return null;
  if(!(p.amount>0))return '¿De cuánto fue?';
  const args=p.kind==='transfer'?{amount:p.amount,from:p.from,to:p.to,source:'ivi-voice'}:{type:p.type,amount:p.amount,title:p.title,account:p.account,source:'ivi-voice'};
  const r=p.kind==='transfer'?transfer(args):log(args);
  if(r.status==='needs'){if(['account','from','to'].includes(r.field)){if(r.field==='account')delete args.account;pending={kind:p.kind,field:r.field,args,at:Date.now()};}return r.question;}
  return finish(r);}
 function finish(r){if(r.status==='created'){App.render?.();App.toast?.(r.say.replace(/^Listo: /,''),'success',r.undo);window.EvieSounds?.play?.('confirm');return r.say;}if(r.status==='duplicate')return r.say;return r.error||r.question||'No pude registrarlo.';}
 return Object.freeze({log,transfer,reconcile,setAccount,reviewQueue,suggestions,setType,parse,intent,pickAccount,accounts,balanceText,accountLabel,undoIds,toCents,clearPending:()=>{pending=null;},hasPending:()=>!!pending});
})();
