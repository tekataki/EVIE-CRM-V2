'use strict';
/* Finance v4 UI pieces: account badge per movement, account selector in the manual form, review panels for
   legacy unassigned movements (with an honest double-count explanation), legacy adjustment review, safe type
   correction, and the link to Compras y despensa (moved out of Finanzas, data untouched). */
window.EvieFinanceUI=(()=>{
 const e=s=>Domain.escape(String(s??'')),i=n=>Views.icon(n),money=c=>Domain.money(c);
 const acc=()=>EvieFinance.accounts();
 const TY={cash:'banknote',wallet:'smartphone',debit:'landmark',credit:'credit-card'};
 function badge(t){if(t.transfer_id)return `<span class="fin-badges"><span class="fin-badge transfer" title="Transferencia entre tus cuentas">${i('arrow-left-right')}${e(EvieFinance.accountLabel(t.evie_account)||'Transferencia')}</span></span>`;
  const a=t.evie_account?(Store.get().preferences.evieAccounts||[]).find(x=>x.id===t.evie_account):null;
  const adj=FinanceCore.isAdjust(t)?`<span class="fin-badge adjust" title="Ajuste antiguo: afecta el saldo de la cuenta, no las estadísticas del mes">${i('scale')}Ajuste</span>`:'';
  if(a)return `<span class="fin-badges"><span class="fin-badge" data-type="${e(a.type)}">${i(TY[a.type]||'wallet')}${e(a.name)}${t.in_baseline?' · ya en saldo inicial':''}</span>${adj}</span>`;
  return `<span class="fin-badges"><button type="button" class="fin-badge none" data-fin="assign" data-id="${e(t.id)}" aria-label="Asignar cuenta a ${e(t.title)}">${i('circle-help')}Sin cuenta</button>${adj}</span>`;}
 /** Manual form field. With several accounts the user must choose (no silent default); with one, preselected. */
 function accountField(r){const list=acc();if(!list.length)return '';const cur=r.evie_account||(list.length===1?list[0].id:'');
  if(r.transfer_id)return `<div class="form-field full"><label>Cuenta</label><p class="muted">Transferencia: se edita desde la cuenta, ambos lados juntos.</p></div>`;
  return `<div class="form-field"><label for="field-evie_account">Cuenta</label><select id="field-evie_account" class="select" name="evie_account" ${r.id?'':'required'}><option value="">${r.id?'Sin cuenta':'Elige una cuenta…'}</option>${list.map(a=>`<option value="${e(a.id)}" ${a.id===cur?'selected':''}>${e(a.name)} · ${e(FinanceCore.TYPES[a.type]||a.type)}</option>`).join('')}</select></div>`;}
 function applyAccount(payload,data,r,isEdit){const v=String(data.evie_account||'');delete payload.evie_account;
  if(r.transfer_id)return;if(v){if(!acc().some(a=>a.id===v))throw Error('Esa cuenta ya no existe.');payload.evie_account=v;}else if(!isEdit&&acc().length)throw Error('Elige de qué cuenta salió o a cuál entró el dinero.');
  if(isEdit&&!v&&r.evie_account)payload.evie_account=null;
  if(!isEdit){payload.op_id='op-form-'+Store.uuid();payload.provenance={via:'form',at:new Date().toISOString()};}}
 /* ---------- review panels shown under the account cards ---------- */
 function reviewPanels(){const list=acc();if(!list.length)return '';const q=EvieFinance.reviewQueue(),adj=Store.list('transactions').filter(t=>FinanceCore.isAdjust(t)&&!t.adjust_reviewed_at),sug=EvieFinance.suggestions();let out='';
  if(sug.length)out+=`<div class="fin-review fin-suggest" role="note">${i('lightbulb')}<div><strong>¿«${e(sug[0].name)}» es efectivo?</strong><p>Está marcada como ${e(FinanceCore.TYPES[sug[0].from])}. Cambiar el tipo a Efectivo no cambia su saldo ni crea movimientos.</p></div><button class="button" data-fin="type-cash" data-id="${e(sug[0].id)}">Cambiar a Efectivo</button></div>`;
  if(q.length)out+=`<details class="fin-review" id="fin-review-unassigned"><summary>${i('list-checks')}<span>Revisar movimientos sin cuenta <b>${q.length}</b></span></summary><p class="fin-explain">Estos movimientos no cambian ningún saldo hasta que los asignes. <strong>Ojo con el doble conteo:</strong> si el saldo inicial que capturaste ya incluía un movimiento anterior, márcalo como «Ya incluido»: se muestra en esa cuenta pero no se resta ni se suma otra vez.</p><ul class="fin-queue">${q.slice(0,40).map(({t,impacts})=>`<li><span class="fin-q-main"><strong>${e(t.title)}</strong><small>${Views.date(t.date)} · ${e(t.category)}</small></span><span class="fin-q-amt ${t.type==='income'?'green-text':'red-text'}">${t.type==='income'?'+':'−'}${money(t.amount)}</span><span class="fin-q-act"><label class="sr-only" for="fq-${e(t.id)}">Cuenta para ${e(t.title)}</label><select class="select" id="fq-${e(t.id)}" data-fin-pick="${e(t.id)}"><option value="">Elegir cuenta…</option>${impacts.map(x=>`<option value="${e(x.account.id)}">${e(x.account.name)}${x.maybe_included?' · ¿ya incluido?':''}</option>`).join('')}</select><button class="button small" data-fin="assign-new" data-id="${e(t.id)}" title="El saldo de la cuenta cambia con este movimiento">Contar</button><button class="button small" data-fin="assign-base" data-id="${e(t.id)}" title="Ya estaba incluido en el saldo inicial: se muestra, no se cuenta otra vez">Ya incluido</button></span></li>`).join('')}</ul>${q.length>40?`<p class="muted">Mostrando 40 de ${q.length}.</p>`:''}</details>`;
  if(adj.length)out+=`<details class="fin-review"><summary>${i('scale')}<span>Ajustes de saldo antiguos <b>${adj.length}</b></span></summary><p class="fin-explain">Antes, «Ajustar saldo real» creaba un ingreso o gasto. Se conservan tal cual y siguen corrigiendo el saldo de su cuenta, pero ya <strong>no cuentan</strong> en ingresos, gastos ni balance del mes. Ahora un ajuste se guarda como saldo verificado.</p><ul class="fin-queue">${adj.map(t=>`<li><span class="fin-q-main"><strong>${e(t.title)}</strong><small>${Views.date(t.date)} · ${e(EvieFinance.accountLabel(t.evie_account)||'Sin cuenta')}</small></span><span class="fin-q-amt">${t.type==='income'?'+':'−'}${money(t.amount)}</span><span class="fin-q-act"><button class="button small" data-fin="adj-ok" data-id="${e(t.id)}">Entendido</button></span></li>`).join('')}</ul></details>`;
  return out;}
 function assign(id,base){const sel=document.querySelector(`[data-fin-pick="${CSS.escape(id)}"]`),aid=sel?.value;if(!aid){App.toast('Elige primero la cuenta.','error');sel?.focus();return;}
  const bal=()=>FinanceCore.balanceOf(EvieFinance.accounts(),Store.list('transactions'),aid,{today:Domain.today()});const before=bal();
  EvieFinance.setAccount(id,aid,{inBaseline:base});const after=bal();
  App.render();const name=EvieFinance.accountLabel(aid),d=(after?.balance??-(after?.used??0))-(before?.balance??-(before?.used??0));
  App.toast(base?`Asignado a ${name} como ya incluido: el saldo no cambia.`:`Asignado a ${name}. Saldo ${d>=0?'+':'−'}${money(Math.abs(d))}.`,'success',()=>{EvieFinance.setAccount(id,null);App.render();});}
 function comprasLink(){const d=window.EvieLife?.data?.(),n=d?.lists?.filter(l=>!l.archived).length||0,p=Store.list('pantryItems')?.length||0;return `<p class="fin-moved">${i('shopping-cart')}Tus listas${n?` (${n})`:''} y tu despensa${p?` (${p})`:''} ahora viven en <a href="#compras">Compras y despensa</a>. No se borró nada.</p>`;}
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-fin]');if(!b)return;const a=b.dataset.fin,id=b.dataset.id;try{
  if(a==='assign'){const open=()=>{const s=document.querySelector(`[data-fin-pick="${CSS.escape(id)}"]`);const d=s?.closest('details');if(d)d.open=true;s?.focus();s?.scrollIntoView({block:'center'});};if(UI.section!=='finanzas'){location.hash='finanzas';setTimeout(open,200);}else open();}
  else if(a==='assign-new'||a==='assign-base')assign(id,a==='assign-base');
  else if(a==='type-cash'){const prev=EvieFinance.accounts().find(x=>x.id===id)?.type;EvieFinance.setType(id,'cash');App.render();App.toast('Tipo cambiado a Efectivo. Saldo sin cambios.','success',()=>{EvieFinance.setType(id,prev||'debit');App.render();});}
  else if(a==='adj-ok'){Store.save(s=>{const t=s.transactions.find(x=>x.id===id);t.adjust_reviewed_at=new Date().toISOString();});App.render();}
 }catch(err){App.toast(err.message,'error');}});
 return Object.freeze({badge,accountField,applyAccount,reviewPanels,comprasLink});
})();
