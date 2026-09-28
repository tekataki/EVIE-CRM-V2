'use strict';
/* SVG is a read-only view of known observations. Missing days break the line. */
window.InsightCharts=(()=>{
 const e=Domain.escape;
 function line(points,{label='Valores registrados',min=0,max=100,from,to,connect=true}={}){
  const rows=points.slice().sort((a,b)=>a.date.localeCompare(b.date)),known=rows.filter(p=>Number.isFinite(p.value));
  if(!known.length)return '<p class="empty-compact">Sin datos registrados para esta gráfica.</p>';
  from=from||rows[0].date;to=to||rows.at(-1).date;const span=Math.max(1,V2Domain.days(from,to)),width=640,height=210,x=p=>48+V2Domain.days(from,p.date)/span*560,y=p=>170-(p.value-min)/Math.max(1,max-min)*140;
  let previous=null,path='';for(const p of rows){if(!Number.isFinite(p.value)){previous=null;continue;}path+=(connect&&previous&&V2Domain.days(previous.date,p.date)===1?'L':'M')+x(p).toFixed(2)+','+y(p).toFixed(2)+' ';previous=p;}
  return `<figure class="insight-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${e(label)}. ${known.length} días con datos. Los huecos interrumpen la línea."><title>${e(label)}</title><desc>Valores exactos en la tabla siguiente. No se interpolan fechas sin registro.</desc>${[min,(min+max)/2,max].map(value=>`<path class="chart-grid" d="M48 ${170-(value-min)/Math.max(1,max-min)*140}H608"/><text x="5" y="${175-(value-min)/Math.max(1,max-min)*140}">${Math.round(value)}</text>`).join('')}<path class="chart-line" d="${path}"/>${known.map(p=>`<g class="chart-observation" tabindex="0" role="img" aria-label="${e(p.date)}: ${p.value}"><circle class="chart-point" cx="${x(p)}" cy="${y(p)}" r="4"/><text class="chart-tooltip" x="${Math.min(560,Math.max(80,x(p)))}" y="${Math.max(18,y(p)-12)}" text-anchor="middle">${e(p.date)} · ${Number(p.value.toFixed(2))}</text><title>${e(p.date)}: ${p.value}</title></g>`).join('')}<text x="48" y="200">${e(from)}</text><text x="608" y="200" text-anchor="end">${e(to)}</text></svg><figcaption>${e(label)} · Puntos reales; sin dato no equivale a cero.</figcaption></figure>`;
 }
 function distribution(points){const values=points.filter(p=>Number.isFinite(p.value)),bins=Array.from({length:5},(_,n)=>({from:n*20,to:(n+1)*20,count:0}));for(const p of values)bins[Math.min(4,Math.floor(p.value/20))].count++;return `<section class="metric-distribution"><h3>Distribución de días registrados</h3>${bins.map(b=>`<div><span>${b.from}–${b.to===100?'':'&lt;'}${b.to}</span><meter min="0" max="${Math.max(1,values.length)}" value="${b.count}" aria-label="${b.from} a ${b.to===100?'':'menos de '}${b.to}: ${b.count} días"></meter><strong>${b.count}</strong></div>`).join('')}</section>`;}
 return {line,distribution};
})();
