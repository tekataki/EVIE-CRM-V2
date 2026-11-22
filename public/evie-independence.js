'use strict';
/* EVIE v10 · Independencia (en Finanzas). Con tus números REALES:
   - Autonomía: cuántos meses aguantas con tu dinero disponible (saldo de tus cuentas) al ritmo de tus gastos.
   - Fondo de emergencia: N meses (3 por defecto) del costo de vivir por tu cuenta (o de tus gastos actuales).
   - Renta sola vs. compartida: costo mensual de cada opción y diferencia; se puede llevar como escenarios a tu Misión.
   Supuestos editables en preferences.independence (renta, servicios, comida, transporte, otros, % que pagas). */
window.EvieIndependence=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const money=c=>Domain.money(Math.round(Number(c)||0));
 const today=()=>Domain.today();
 const addDays=(d,n)=>window.V2Domain?.addDays?V2Domain.addDays(d,n):new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
 const cents=v=>{const s=String(v??'').replace(/[\s,$]/g,'');return s?Domain.cents(s):0;};
 const pesos=c=>(Math.round(Number(c)||0)/100).toFixed(2).replace(/\.00$/,'');
 const KEYS=[['rent_cents','Renta'],['services_cents','Servicios (luz, agua, gas, internet)'],['food_cents','Comida'],['transport_cents','Transporte'],['other_cents','Otros']];
 function cfg(){const x=P().independence||{};return {rent_cents:0,services_cents:0,food_cents:0,transport_cents:0,other_cents:0,share:50,fund_months:3,...x};}
 /** Real average monthly expenses (cents) over the last 90 days (transfers and adjustments excluded). */
 function realMonthly(){try{const t=today();return Math.round(FinanceCore.periodTotals(Store.list('transactions'),addDays(t,-89),t).expense/3);}catch{return 0;}}
 function liquid(){try{const a=FinanceCore.available(P().evieAccounts||[],Store.list('transactions'),{today:today()});return a.basis==='accounts'?Math.max(0,Math.round(a.cents)):null;}catch{return null;}}
 function calc(c=cfg()){const configured=c.rent_cents>0,share=Math.max(0,Math.min(100,Number(c.share)||0))/100;
  const alone=c.rent_cents+c.services_cents+c.food_cents+c.transport_cents+c.other_cents,shared=Math.round((c.rent_cents+c.services_cents)*share)+c.food_cents+c.transport_cents+c.other_cents;
  const real=realMonthly(),base=configured?alone:real,cash=liquid(),months=Math.max(1,Math.min(12,Number(c.fund_months)||3)),fund=base*months;
  const runway=cash!=null&&base>0?Math.round(cash/base*10)/10:null;
  return {configured,alone,shared,saving:alone-shared,real,base,cash,fund,fundMonths:months,fundPct:fund>0&&cash!=null?Math.min(100,Math.round(cash/fund*100)):0,fundMissing:cash!=null?Math.max(0,fund-cash):fund,runway,share:Math.round(share*100)};}
 function gauge(v){const max=6,f=v==null?0:Math.max(0,Math.min(1,v/max)),state=v==null?'idle':v<1?'red':v<3?'yellow':'green',a=Math.PI*(1-f),x=60+50*Math.cos(a),y=60-50*Math.sin(a);
  return `<svg class="ind-gauge-svg" viewBox="0 0 120 70" aria-hidden="true"><path d="M10 60 A50 50 0 0 1 110 60" class="ind-track"/><path d="M10 60 A50 50 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" class="ind-arc" data-s="${state}" pathLength="100"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="ind-dot" data-s="${state}"/></svg>`;}
 function panel(){const r=calc(),c=cfg();
  return `<section class="panel ind v8-card" id="ind-panel" aria-label="Independencia"><header class="ind-head"><div><span class="ms-eyebrow">INDEPENDENCIA</span><h3>¿Cuánto aguantas por tu cuenta?</h3></div><button type="button" class="button small" data-ind="edit">${ic('sliders-horizontal')}Ajustar</button></header>
   <div class="ind-grid">
    <div class="ind-gauge">${gauge(r.runway)}<b>${r.runway==null?'—':r.runway}</b><span>${r.runway==null?(r.cash==null?'Configura tus cuentas para medirla':'Faltan tus gastos'):'meses de autonomía'}</span></div>
    <div class="ind-box"><h4>${ic('shield')}Fondo de emergencia · ${r.fundMonths} meses</h4><div class="ms-meter"><i style="--p:${r.fundPct}"></i></div><p>${r.cash==null?`Meta: <b>${money(r.fund)}</b>. Registra tus cuentas en Finanzas para ver cuánto llevas.`:r.fundMissing?`Llevas <b>${money(r.cash)}</b> de <b>${money(r.fund)}</b>; te faltan <b>${money(r.fundMissing)}</b>.`:`Cubierto: <b>${money(r.cash)}</b> ≥ <b>${money(r.fund)}</b>.`}</p></div>
    <div class="ind-box"><h4>${ic('house')}Renta sola vs. compartida</h4>${r.configured?`<dl class="ind-rent"><div><dt>Solo</dt><dd>${money(r.alone)}<small>/mes</small></dd></div><div><dt>Compartida (${r.share} %)</dt><dd>${money(r.shared)}<small>/mes</small></dd></div><div><dt>Diferencia</dt><dd class="good">${money(r.saving)}<small>/mes</small></dd></div></dl>
      ${window.EvieMission?.cfg?.()?`<button type="button" class="button small" data-ind="to-mission">${ic('git-branch')}Llevar a escenarios de la misión</button>`:''}`:`<p class="ms-muted">Escribe la renta y tus gastos estimados para comparar vivir solo o con roomie.</p><button type="button" class="button small" data-ind="edit">${ic('calculator')}Calcular</button>`}</div>
   </div>
   <p class="ind-note">${ic('info')}<span>Tus gastos reales de los últimos 90 días: <b>${money(r.real)}</b>/mes.${r.configured?' La autonomía y el fondo usan el costo de vivir solo.':''}</span></p></section>`;}
 const field=(name,label,value='',extra='')=>`<label class="ch-field"><span>${label}</span><input class="input" name="${name}" value="${e(value)}" ${extra}></label>`;
 function editDialog(){const c=cfg();App.openDialog('Independencia',`<form id="ind-form" class="ch-form ms-form"><p class="dialog-subtitle">Estimaciones mensuales para vivir por tu cuenta. Solo viven en tu cuenta.</p>
   <div class="ms-row">${KEYS.map(([k,l])=>field(k,l+' ($)',c[k]?pesos(c[k]):'','inputmode="decimal" placeholder="0.00"')).join('')}</div>
   <div class="ms-row">${field('share','% de renta y servicios que pagarías con roomie',c.share,'type="number" min="0" max="100" step="5"')}${field('fund_months','Meses de fondo de emergencia',c.fund_months,'type="number" min="1" max="12" step="1"')}</div>
   <p class="ch-error" role="alert" hidden></p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('check')}Guardar</button></div></form>`);
  const f=document.getElementById('ind-form');f.onsubmit=ev=>{ev.preventDefault();try{const d=Object.fromEntries(new FormData(f)),next={share:Math.max(0,Math.min(100,Math.round(Number(d.share)||0))),fund_months:Math.max(1,Math.min(12,Math.round(Number(d.fund_months)||3)))};for(const [k] of KEYS)next[k]=cents(d[k]);
   Store.save(s=>{s.preferences.independence=next;});App.closeDialog(true);App.render();App.toast('Guardado.','success');}catch(err){const p=f.querySelector('.ch-error');p.hidden=false;p.textContent=err.message;}};}
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-ind]');if(!b)return;
  if(b.dataset.ind==='edit')editDialog();
  else if(b.dataset.ind==='to-mission'){const r=calc();const n=window.EvieMission?.addScenarios?.([{name:'Vivir solo',kind:'expense',monthly_cents:r.alone},{name:'Vivir con roomie',kind:'expense',monthly_cents:r.shared}])||0;App.render();App.toast(n?'Agregué «Vivir solo» y «Vivir con roomie» a los escenarios de tu misión.':'Esos escenarios ya estaban en tu misión.','success');}});
 function afterRender(){if(UI.section!=='finanzas'||UI.id)return;const main=document.getElementById('main-content');if(!main||main.querySelector('#ind-panel'))return;
  const a=main.querySelector('#ms-mini')||main.querySelector('#finance-chart')||main.querySelector('#evm-accounts')||main.querySelector('.summary-grid');a?.insertAdjacentHTML('afterend',panel());try{window.lucide?.createIcons?.({root:main.querySelector('#ind-panel')});}catch{}}
 return Object.freeze({cfg,calc,panel,afterRender,realMonthly,liquid});
})();
