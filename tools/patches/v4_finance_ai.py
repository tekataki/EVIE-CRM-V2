# v4: Ivi finance tools — log_transaction (account-aware, completes once + undo), transfer_money, list_accounts,
# «deshaz lo último». Model writes carry op_id = tool call_id so retries never duplicate. Local intent first. Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:70]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('src/assistant.js',[
 ("  { name: 'draft_transaction', description: 'Propone un movimiento financiero (ingreso o gasto). El usuario debe confirmarlo.',",
  "  { name: 'list_accounts', description: 'Cuentas del usuario (efectivo, débito, cartera, tarjeta de crédito) con su saldo estimado. Úsala antes de registrar si no sabes qué cuentas existen.', parameters: S({}) },\n"
  "  { name: 'log_transaction', description: 'REGISTRA un ingreso o gasto ordinario cuando el usuario lo pide de forma explícita y completa («gasté 200 de mi dinero físico en comida»). Se guarda una sola vez y la app ofrece deshacer; no pidas otra confirmación. account = nombre o frase de la cuenta que dijo el usuario (\"dinero físico\", \"BBVA\") o null si no la dijo: si hay varias cuentas la herramienta devuelve needs_account con la pregunta exacta; hazla tal cual y vuelve a llamar con la respuesta. Un cobro esperado o programado NO es dinero recibido: usa draft_recurring. soma_client_name solo si el usuario dijo que es un cobro de ese cliente de SOMA.', parameters: S({ type: { type: 'string', enum: ['income', 'expense'] }, amount: { type: 'number', description: 'Monto positivo en MXN' }, title: { type: 'string', maxLength: 140 }, account: nstr('cuenta mencionada o null'), category: nstr('categoría o null'), date: nstr('YYYY-MM-DD o null (hoy)'), soma_client_name: nstr('cliente de SOMA explícito o null') }) },\n"
  "  { name: 'transfer_money', description: 'Registra un traspaso entre dos cuentas propias (\"pasé 200 de efectivo a BBVA\"). Cambia los dos saldos; no es ingreso ni gasto. Se guarda una vez con deshacer.', parameters: S({ amount: { type: 'number' }, from_account: { type: 'string', maxLength: 60 }, to_account: { type: 'string', maxLength: 60 }, date: nstr('YYYY-MM-DD o null') }) },\n"
  "  { name: 'draft_transaction', description: 'Propone un movimiento financiero (ingreso o gasto) sin guardarlo, solo si el usuario pidió revisarlo antes. Para registros explícitos usa log_transaction.',","name: 'log_transaction'"),
 ("    'Para crear algo usa las herramientas draft_*: solo PROPONEN; el usuario confirmará en pantalla. Nunca digas que ya se guardó.',",
  "    'Para crear algo usa las herramientas draft_*: solo PROPONEN; el usuario confirmará en pantalla. Nunca digas que ya se guardó. Excepción: un ingreso, gasto o traspaso ordinario pedido de forma explícita y completa se registra con log_transaction / transfer_money (una vez, con deshacer); si falta el monto o la cuenta, pregunta solo eso. Di lo registrado solo si la herramienta devolvió status created.',","log_transaction / transfer_money"),
 ("    'No puedes borrar datos, mover dinero, hacer compras ni pagos,","    'No puedes borrar datos, mover dinero real del banco, hacer compras ni pagos (registrar un movimiento en EVIE no mueve dinero),","mover dinero real del banco")])
edit('public/evie-finance.js',[
 (" function finish(r){if(r.status==='created'){"," let lastUndoFn=null;\n function finish(r){if(r.status==='created'){lastUndoFn=r.undo;","lastUndoFn=r.undo"),
 ("return Object.freeze({log,transfer,","return Object.freeze({lastUndo:()=>lastUndoFn,setLastUndo:f=>{lastUndoFn=f;},log,transfer,","lastUndo:()=>lastUndoFn")])
edit('public/evie-assistant.js',[
 ("let lastMemoryUsed=null,","let lastUndo=null,lastMemoryUsed=null,","let lastUndo=null"),
 ("  draft_transaction({type,amount,title,date}){",
  "  list_accounts(){const av=FinanceCore.available(EvieFinance.accounts(),live('transactions'),{today:today()});return {accounts:av.accounts.map(a=>({name:a.name,type:a.type,estimated_balance:moneyStr(a.balance)})),credit:av.credit.map(c=>({name:c.name,used:moneyStr(c.used),available_credit:moneyStr(c.available_credit)})),available_total:moneyStr(av.cents),unassigned_movements:av.unassigned_count,note:'Estimaciones con registros del usuario; no es el saldo del banco.'};},\n"
  "  log_transaction(a={},call){const client=a.soma_client_name?Store.list('clients').filter(c=>IvyTools.norm(c.title)===IvyTools.norm(a.soma_client_name)):[];if(a.soma_client_name&&client.length!==1)return {status:'needs_client',question:client.length?'Hay varios clientes con ese nombre. ¿Cuál?':'No encontré a ese cliente en SOMA. ¿Lo registro sin vincular?'};\n"
  "   const r=EvieFinance.log({type:a.type,amount:Math.round(Number(a.amount)*100),title:a.title,account:a.account||'',category:a.category,date:a.date,soma_client:client[0]?.id,op_id:call?.call_id,source:'ivi-ai'});\n"
  "   if(r.status==='needs')return {status:r.field==='account'?'needs_account':'needs_'+r.field,question:r.question,accounts:r.candidates?.map(c=>c.name)};if(r.status==='created'){App.render();App.toast(r.say.replace(/^Listo: /,''),'success',r.undo);window.EvieSounds?.play?.('confirm');lastUndo=r.undo;EvieFinance.setLastUndo(r.undo);}\n"
  "   return {status:r.status,account:r.account||null,balance:r.balance||null,summary:r.say||r.error};},\n"
  "  transfer_money(a={},call){const r=EvieFinance.transfer({amount:Math.round(Number(a.amount)*100),from:a.from_account,to:a.to_account,date:a.date,op_id:call?.call_id,source:'ivi-ai'});if(r.status==='created'){App.render();App.toast('Traspaso registrado.','success',r.undo);lastUndo=r.undo;EvieFinance.setLastUndo(r.undo);}return {status:r.status,question:r.question,summary:r.say||r.error};},\n"
  "  draft_transaction({type,amount,title,date}){","log_transaction(a={},call)"),
 ("const fn=tools[c.name]||window.EvieMemory?.tools?.[c.name]||window.EvieMap?.tools?.[c.name];out=fn?await fn(args):{error:'unknown tool'};",
  "const fn=tools[c.name]||window.EvieMemory?.tools?.[c.name]||window.EvieMap?.tools?.[c.name];out=fn?await fn(args,c):{error:'unknown tool'};","await fn(args,c)"),
 ("if(window.EvieMap){const mp=EvieMap.intent(text,{say:speakLater});if(mp!==null)return mp;}",
  "if(window.EvieMap){const mp=EvieMap.intent(text,{say:speakLater});if(mp!==null)return mp;}"
  "if(/^(?:(?:oye |hey )?(?:ivi|ivy|evie|evi|ibi|libi)[, ]+)?(?:deshaz|deshacer|desase) (?:lo ultimo|el ultimo (?:movimiento|registro|gasto|ingreso)|eso)$/.test(IvyTools.norm(text).replace(/[¿?¡!.,]/g,''))){const u=lastUndo||window.EvieFinance?.lastUndo?.();if(!u)return 'No tengo un registro reciente que deshacer.';u();lastUndo=null;window.EvieFinance?.setLastUndo?.(null);return 'Listo, lo deshice.';}"
  "if(window.EvieFinance){const fi=EvieFinance.intent(text);if(fi!==null)return fi;}","EvieFinance.intent(text)")])
