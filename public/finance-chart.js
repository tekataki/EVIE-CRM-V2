'use strict';
/* Grouped income/expense bars for 7/30/90 days (SVG, no dependency). Every bar is a real total from
   FinanceCore.buckets; empty buckets draw nothing (no decorative bars). Exact values in a table. */
window.FinanceChart=(()=>{
 const e=s=>Domain.escape(String(s??''));
 const m=c=>Domain.money(c);
 const short=c=>{const v=Math.abs(c)/100;return (c<0?'−':'')+(v>=1e6?(v/1e6).toFixed(1)+' M':v>=1e3?(v/1e3).toFixed(v>=1e4?0:1)+' k':v.toFixed(0));};
 const label=(d,step)=>{const x=new Date(d+'T12:00:00');const s=x.toLocaleDateString('es-MX',{day:'numeric',month:'short'}).replace('.','');return step===1?s:'Sem. '+s;};
 function render(days=30){
  if(!window.FinanceCore)return '';
  const narrow=matchMedia('(max-width: 600px)').matches;
  const b=FinanceCore.buckets(Store.list('transactions'),days,Domain.today(),{narrow});
  const max=Math.max(1,...b.buckets.flatMap(x=>[x.income,x.expense]));
  const W=Math.max(320,b.buckets.length*(narrow?26:22)),H=200,pad=34,gw=(W-pad)/b.buckets.length,bw=Math.max(3,Math.min(16,gw*.34));
  const y=v=>H-pad-(v/max)*(H-pad-12);
  const grid=[0,.5,1].map(f=>`<g class="fc-grid"><line x1="${pad}" x2="${W}" y1="${y(max*f)}" y2="${y(max*f)}"/><text x="${pad-4}" y="${y(max*f)+3}" text-anchor="end">${short(max*f)}</text></g>`).join('');
  const every=Math.ceil(b.buckets.length/(narrow?5:8));
  const bars=b.buckets.map((x,i)=>{const cx=pad+gw*i+gw/2,parts=[];
   if(x.income>0)parts.push(`<rect class="fc-in" x="${(cx-bw-1).toFixed(1)}" y="${y(x.income).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H-pad-y(x.income)).toFixed(1)}" rx="3"><title>${e(label(x.start,b.step))}: ingresos ${m(x.income)}</title></rect>`);
   if(x.expense>0)parts.push(`<rect class="fc-out" x="${(cx+1).toFixed(1)}" y="${y(x.expense).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H-pad-y(x.expense)).toFixed(1)}" rx="3"><title>${e(label(x.start,b.step))}: gastos ${m(x.expense)}</title></rect>`);
   if(i%every===0||i===b.buckets.length-1)parts.push(`<text class="fc-x" x="${cx.toFixed(1)}" y="${H-10}" text-anchor="middle">${e(label(x.start,b.step).replace('Sem. ',''))}</text>`);
   return parts.join('');}).join('');
  const t=b.totals,empty=!t.count;
  return `<section class="panel fc-panel" id="finance-chart" aria-labelledby="fc-title">
   <header class="fc-head"><div><span class="eyebrow">${days} DÍAS · MXN${b.step===7?' · POR SEMANA':' · POR DÍA'}</span><h2 id="fc-title">Ingresos y gastos registrados</h2></div>
    <nav class="fc-range" aria-label="Periodo de la gráfica">${[7,30,90].map(n=>`<button type="button" class="fc-chip ${n===days?'active':''}" data-action="rc-module-period" data-days="${n}" aria-pressed="${n===days}">${n} días</button>`).join('')}</nav></header>
   <div class="fc-sum"><div><small><i class="fc-dot in"></i>Ingresos</small><strong>${m(t.income)}</strong></div><div><small><i class="fc-dot out"></i>Gastos</small><strong>${m(t.expense)}</strong></div><div><small>Neto</small><strong class="${t.net>=0?'green-text':'red-text'}">${m(t.net)}</strong></div></div>
   ${empty?`<div class="fc-empty"><strong>Sin movimientos en estos ${days} días</strong><span>Registra un ingreso o gasto y aparecerá aquí. No dibujamos barras sin datos.</span></div>`:`<div class="fc-scroll"><svg class="fc-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Ingresos ${m(t.income)} y gastos ${m(t.expense)} en ${days} días, agrupados por ${b.step===7?'semana':'día'}">${grid}${bars}</svg></div>`}
   <details class="fc-table"><summary>Ver valores exactos · ${b.buckets.filter(x=>x.count).length} ${b.step===7?'semanas':'días'} con movimientos</summary><div class="table-wrap"><table><caption>${e(b.from)} a ${e(b.to)} · MXN · transferencias entre tus cuentas excluidas</caption><thead><tr><th>${b.step===7?'Semana':'Fecha'}</th><th>Ingresos</th><th>Gastos</th><th>Neto</th></tr></thead><tbody>${b.buckets.filter(x=>x.count).map(x=>`<tr><td>${e(x.start)}${x.end!==x.start?' – '+e(x.end):''}</td><td>${m(x.income)}</td><td>${m(x.expense)}</td><td>${m(x.net)}</td></tr>`).join('')||'<tr><td colspan="4">Sin registros en este periodo</td></tr>'}</tbody></table></div></details>
  </section>`;}
 return Object.freeze({render});
})();
