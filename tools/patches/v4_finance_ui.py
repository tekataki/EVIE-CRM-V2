# v4 Finance UI wiring (idempotent). Account badge per movement, account in the manual form, review panels via
# EvieFinanceUI, reconciliation = baseline (EvieFinance.reconcile), opening_at on new accounts, Compras y despensa
# moved from Finanzas to its own section (same EvieLife/Nutrition data, nothing deleted).
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:70]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('public/views.js',[
 ("<p>${date(x.date)} · ${e(x.category)}${x.origin?' · Vinculado':''}</p></div>","<p>${date(x.date)} · ${e(x.category)}${x.origin?' · Vinculado':''}</p>${window.EvieFinanceUI?EvieFinanceUI.badge(x):''}</div>","EvieFinanceUI.badge(x)"),
 ("function totals(){const t=periodTransactions();","function totals(){const t=periodTransactions().filter(x=>!window.FinanceCore||FinanceCore.isStat(x));","FinanceCore.isStat(x)")])
edit('public/forms.js',[
 ("+select('category','Categoría',categories,r.category||'Personal')+dateField+area('note','Nota opcional',r.note);}","+(window.EvieFinanceUI?EvieFinanceUI.accountField(r):'')+select('category','Categoría',categories,r.category||'Personal')+dateField+area('note','Nota opcional',r.note);}","EvieFinanceUI.accountField(r)"),
 ("if(collection==='metrics')payload.weight=Number(data.weight);","if(collection==='transactions'&&window.EvieFinanceUI){EvieFinanceUI.applyAccount(payload,data,r,isEdit);}\n if(collection==='metrics')payload.weight=Number(data.weight);","EvieFinanceUI.applyAccount")])
edit('public/evie-modules.js',[
 ("   Store.save(s=>{const t=Store.record(Records.normalize('transactions',{title:'Ajuste de saldo · '+a.name,date:today(),amount:diff,type,category:'Otro',business_unit:'personal',source:'evie-reconcile'}));t.evie_account=a.id;s.transactions.push(t);});App.closeDialog(true);App.render();App.toast('Saldo ajustado.');}",
  "   /* v4: the real balance becomes an auditable baseline on the account — no income/expense is created. */\n   const r=EvieFinance.reconcile(a.id,real);App.closeDialog(true);App.render();App.toast('Saldo real registrado: '+money(real)+(r.diff?` (diferencia ${r.diff>0?'+':'−'}${money(Math.abs(r.diff))} respecto a la estimación)`:'')+'. No cuenta como ingreso ni gasto.','success',r.undo);}","EvieFinance.reconcile(a.id,real)"),
 ("EVIE registra un ajuste por la diferencia.</p>","EVIE guarda ese saldo como punto de partida verificado (con fecha y la estimación anterior). <strong>No se registra como ingreso ni gasto</strong> y no altera tus estadísticas del mes.</p>","punto de partida verificado"),
 ("let diff=real-cur;if(diff===0){App.closeDialog(true);return;}let type=credit?(diff>0?'expense':'income'):(diff>0?'income':'expense');diff=Math.abs(diff);\n","","/* v4: the real balance"),
 ("function unassigned(){const acc=Array.isArray(P().evieAccounts)?P().evieAccounts:[];","function unassigned(){if(window.EvieFinanceUI)return EvieFinanceUI.reviewPanels();const acc=Array.isArray(P().evieAccounts)?P().evieAccounts:[];","EvieFinanceUI.reviewPanels()"),
 ("else arr.push({id:uid(),...row});});App.closeDialog(true);App.render();}","else arr.push({id:uid(),...row,created_at:new Date().toISOString(),opening_date:today(),opening_at:new Date().toISOString()});});App.closeDialog(true);App.render();}","opening_at:new Date().toISOString()"),
 ("Store.save(st=>{const t=st.transactions.find(x=>x.id===s.dataset.evmAssign);if(s.value)t.evie_account=s.value;else delete t.evie_account;});App.render();","EvieFinance.setAccount(s.dataset.evmAssign,s.value||null);App.render();","EvieFinance.setAccount(s.dataset.evmAssign")])
edit('public/evie-life.js',[
 ("if(UI.section==='finanzas'&&!UI.id&&!document.getElementById('ev-shop')){","if(UI.section==='compras'&&!UI.id&&!document.getElementById('ev-shop')){","UI.section==='compras'&&!UI.id&&!document.getElementById('ev-shop')"),
 ("if(UI.section==='finanzas'&&!UI.id&&!document.getElementById('ev-pantry')&&window.Nutrition){","if(UI.section==='compras'&&!UI.id&&!document.getElementById('ev-pantry')&&window.Nutrition){","UI.section==='compras'&&!UI.id&&!document.getElementById('ev-pantry')")])
edit('public/config.js',[("{route:'automatizaciones',label:'Automatizaciones'","{route:'compras',label:'Compras y despensa',icon:'shopping-cart',group:'herramientas',searchTerms:['listas','super','súper','despensa','compras','alacena'],mobilePriority:0},{route:'automatizaciones',label:'Automatizaciones'","route:'compras'")])
edit('public/app.js',[("finanzas:Views.finance,","finanzas:()=>Views.finance()+(window.EvieFinanceUI?EvieFinanceUI.comprasLink():''),","EvieFinanceUI.comprasLink()")])
edit('public/index.html',[
 ('<script defer src="evie-map-core.js"></script>','<script defer src="evie-finance.js"></script><script defer src="evie-finance-ui.js"></script><script defer src="evie-map-core.js"></script>','evie-finance-ui.js'),
 ('<link rel="stylesheet" href="evie-map.css">','<link rel="stylesheet" href="evie-map.css"><link rel="stylesheet" href="evie-finance.css">','evie-finance.css')])
