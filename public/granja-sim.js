'use strict';
/* EVIE v10 · Simulador de Granja «antes de comprar» (en #granja, pestaña Resumen). No toca tus registros de Granja.
   Con supuestos editables proyecta mes a mes la compra de cerdas, el alimento, montas, partos, destetes y ventas (lechón al
   destete o cerdo terminado); el flujo mensual, la caja acumulada (colchón + granja + respaldo de SOMA), el mes de equilibrio
   (desde el que lo acumulado ya no vuelve a negativo), el colchón mínimo para que la caja nunca quede en negativo y si tu flujo
   de SOMA cubre el alimento hasta la primera venta. SOMA: por defecto, tu ingreso real promedio de los últimos 90 días.
   SOMA respalda sin acumular: cada mes paga lo que la granja no alcanza a cubrir, hasta el monto mensual; el resto sale del colchón.
   Biología genérica y editable: gestación 114 d, destete 21–28 d, retorno al celo 5–7 d, ~2.2 partos por cerda al año, venta de
   terminado a 150–180 d de edad. Es una simulación, no una recomendación. Datos: preferences.farmSim. */
window.GranjaSim=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const money=c=>Domain.money(Math.round(Number(c)||0));
 const today=()=>Domain.today();
 const MONTH=365.25/12;
 const isDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'));
 const addDays=(d,n)=>window.V2Domain?.addDays?V2Domain.addDays(d,n):new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
 const cents=v=>{const s=String(v??'').replace(/[\s,$]/g,'');return s?Domain.cents(s):0;};
 const pesos=c=>(Math.round(Number(c)||0)/100).toFixed(2).replace(/\.00$/,'');
 const nf=(n,d=0)=>Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:d});
 const plural=(n,a,b)=>n===1?a:b;
 const fmtMonth=d=>new Date(d+'T12:00:00').toLocaleDateString('es-MX',{month:'short',year:'numeric'}).replace('.','');
 const fmtDate=d=>new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
 const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement?.dataset?.motion==='reduced';}catch{return true;}};
 /** Generic, editable defaults (money in cents). Nothing here describes a real farm. */
 const DEF=Object.freeze({sows:4,sow_price_cents:500000,setup_cents:0,feed_sow_kg:2.5,feed_grow_kg:1.8,feed_price_cents:900,other_monthly_cents:80000,litter_size:10,mortality_pct:10,sale_mode:'weaner',weaner_price_cents:100000,finisher_price_cents:450000,months:18,buffer_cents:3000000,soma_cents:null,start:null,gestation_days:114,lactation_days:28,return_days:6,litters_per_year:2.2,finishing_days:165,first_service_days:21});
 const LIM={sows:[1,500,1],sow_price_cents:[0,1e9,1],setup_cents:[0,1e10,1],feed_sow_kg:[0,20,.1],feed_grow_kg:[0,10,.1],feed_price_cents:[0,1e6,1],other_monthly_cents:[0,1e9,1],litter_size:[1,25,.1],mortality_pct:[0,90,.1],weaner_price_cents:[0,1e9,1],finisher_price_cents:[0,1e9,1],months:[12,24,1],buffer_cents:[0,1e11,1],gestation_days:[100,130,1],lactation_days:[14,60,1],return_days:[3,30,1],litters_per_year:[1,2.6,.1],finishing_days:[100,240,1],first_service_days:[0,120,1]};
 const clamp=(v,[min,max,step],d)=>{const n=typeof v==='string'&&!v.trim()?NaN:Number(v);if(v==null||typeof v==='boolean'||!Number.isFinite(n))return d;const c=Math.max(min,Math.min(max,n));return step>=1?Math.round(c):Math.round(c*10)/10;};
 /** Clamp every input to a sane range; unknown/invalid values fall back to the generic default. */
 function normalize(x,t=today()){const o=x&&typeof x==='object'?x:{},r={};for(const [k,lim] of Object.entries(LIM))r[k]=clamp(o[k],lim,DEF[k]);
  r.sale_mode=o.sale_mode==='finisher'?'finisher':'weaner';r.soma_cents=o.soma_cents==null||o.soma_cents===''||!Number.isFinite(Number(o.soma_cents))?null:Math.round(Math.max(0,Math.min(1e10,Number(o.soma_cents))));
  r.start=isDate(o.start)?o.start:t;r.finishing_days=Math.max(r.finishing_days,r.lactation_days+30);return r;}
 /** Average monthly SOMA income (cents) over the last 90 days, from real transactions (same rule as Misión). */
 function somaMonthly(tx,t=today()){const list=tx||Store.list('transactions'),from=addDays(t,-90);let sum=0;for(const x of list||[])if(x&&!x.deleted_at&&x.business_unit==='soma'&&x.type==='income'&&!x.transfer_id&&x.date>=from&&x.date<=t)sum+=Number(x.amount)||0;return Math.round(sum/3);}

 /** The simulation (pure). Months of 365.25/12 days from `start`; all sows bought on day 0 and following one calendar.
     Service k = first_service + k·cycle, cycle = max(gestation + lactation + return, 365 / litters per year).
     Farrowing = service + gestation; weaning = farrowing + lactation; sale = weaning (lechón) or farrowing + finishing (terminado).
     Feed: sows every day; growing pigs (finisher) from weaning to sale; nursing piglets add none. */
 function simulate(input={}){const x=normalize(input),N=x.sows,M=x.months,D=M*MONTH,mo=d=>Math.min(M-1,Math.floor(d/MONTH+1e-9)),fin=x.sale_mode==='finisher';
  const cycleMin=x.gestation_days+x.lactation_days+x.return_days,cycle=Math.max(cycleMin,365/x.litters_per_year),born=Math.round(N*x.litter_size),weaned=Math.floor(N*x.litter_size*(100-x.mortality_pct)/100+1e-9),price=fin?x.finisher_price_cents:x.weaner_price_cents,S=x.soma_cents||0;
  const rows=Array.from({length:M},(_,m)=>({m,n:m+1,date:addDays(x.start,Math.round(m*MONTH)),purchase_cents:0,feed_kg:0,feed_cents:0,other_cents:x.other_monthly_cents,services:0,litters:0,born:0,weaned:0,sold:0,sales_cents:0,growers:0,events:[]}));
  rows[0].purchase_cents=N*x.sow_price_cents+x.setup_cents;rows[0].events.push({type:'buy',sows:N,cents:rows[0].purchase_cents});
  const batches=[];for(let k=0;k<100;k++){const s=x.first_service_days+k*cycle;if(s>=D)break;const f=s+x.gestation_days,w=f+x.lactation_days;batches.push({k,service:s,farrow:f,wean:w,sale:fin?f+x.finishing_days:w});}
  const at=(d,fn)=>{if(d<D)fn(rows[mo(d)]);};
  for(const b of batches){at(b.service,r=>{r.services+=N;r.events.push({type:'service',sows:N});});at(b.farrow,r=>{r.litters+=N;r.born+=born;r.events.push({type:'birth',litters:N,born});});
   if(fin)at(b.wean,r=>{r.weaned+=weaned;r.events.push({type:'wean',weaned});});
   at(b.sale,r=>{if(!fin)r.weaned+=weaned;r.sold+=weaned;r.sales_cents+=weaned*price;r.events.push({type:'sale',sold:weaned,cents:weaned*price,mode:x.sale_mode});});}
  for(let t=0,end=Math.ceil(D-1e-9);t<end;t++){let g=0;if(fin)for(const b of batches)if(t>=b.wean&&t<b.sale)g+=weaned;const r=rows[mo(t)];r.feed_kg+=N*x.feed_sow_kg+g*x.feed_grow_kg;if(g>r.growers)r.growers=g;}
  let cum=0,adj=0,minCum=0,minAdj=0,box=x.buffer_cents,used=0,runsOut=null,minCash=Infinity,minCashAt=0;
  for(const r of rows){r.feed_cents=Math.round(r.feed_kg*x.feed_price_cents);r.feed_kg=Math.round(r.feed_kg*10)/10;r.out_cents=r.purchase_cents+r.feed_cents+r.other_cents;r.net_cents=r.sales_cents-r.out_cents;
   cum+=r.net_cents;r.cum_cents=cum;minCum=Math.min(minCum,cum);r.soma_cents=Math.min(S,Math.max(0,-r.net_cents));used+=r.soma_cents;adj+=r.net_cents+r.soma_cents;minAdj=Math.min(minAdj,adj);
   box+=r.net_cents+r.soma_cents;r.cash_cents=box;if(box<0&&runsOut==null)runsOut=r.m;if(box<minCash){minCash=box;minCashAt=r.m;}}
  let breakEven=null;for(let m=M-1;m>=0&&rows[m].cum_cents>=0;m--)breakEven=m;
  const firstBirth=rows.find(r=>r.born>0)?.m??null,firstSale=rows.find(r=>r.sales_cents>0)?.m??null,before=rows.filter(r=>firstSale==null||r.m<firstSale),sum=k=>rows.reduce((a,r)=>a+r[k],0);
  const feedMax=Math.max(0,...before.map(r=>r.feed_cents)),runMax=Math.max(0,...before.map(r=>r.feed_cents+r.other_cents)),minBuffer=Math.max(0,-minAdj);
  const onHand=batches.reduce((a,b)=>a+(b.farrow<D&&b.sale>=D?(b.wean<D?weaned:born):0),0);
  return {inputs:x,rows,summary:{months:M,cycle_days:Math.round(cycle*10)/10,cycle_min_days:cycleMin,born_per_batch:born,weaned_per_batch:weaned,price_cents:price,batches:batches.filter(b=>b.farrow<D).length,firstBirth,firstSale,breakEven,
   minCum,minBufferNoSoma:Math.max(0,-minCum),minBuffer,buffer:x.buffer_cents,bufferOk:x.buffer_cents>=minBuffer,shortfall:Math.max(0,minBuffer-x.buffer_cents),runsOut,minCash,minCashAt,somaUsed:used,finalCum:cum,finalCash:box,onHand,
   totals:{sales:sum('sales_cents'),feed:sum('feed_cents'),other:sum('other_cents'),purchase:sum('purchase_cents'),feed_kg:Math.round(sum('feed_kg')),sold:sum('sold'),born:sum('born'),litters:sum('litters')},
   soma:{monthly:S,untilSale:firstSale,months:before.length,feedMax,runMax,coversFeed:S>=feedMax,coversRunning:S>=runMax,gapFeed:Math.max(0,feedMax-S),gapRunning:Math.max(0,runMax-S),feedTotal:before.reduce((a,r)=>a+r.feed_cents,0)}}};}

 /* ---------------- chart (inline SVG; validated palette lives in granja-sim.css) ---------------- */
 const short=c=>{const v=Math.abs(c)/100,s=c<0?'−':'';return s+'$'+(v>=1e6?nf(v/1e6,1)+' M':v>=1e3?nf(v/1e3,v>=1e4?0:1)+' k':nf(v,0));};
 function ticks(lo,hi){if(!(hi>lo))hi=lo+100000;const raw=(hi-lo)/4,mag=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(f=>f*mag).find(s=>s>=raw),out=[];for(let v=Math.floor(lo/step)*step;v<=Math.ceil(hi/step)*step+step/2;v+=step)out.push(Math.round(v));return out;}
 const r1=v=>Math.round(v*10)/10;
 /** Column with a 4px rounded data end and a square end on the zero baseline. */
 function barPath(x,w,yv,yz){const h=Math.abs(yz-yv);if(h<.5)return '';const r=Math.min(4,w/2,h),a=r1(x),b=r1(x+w),z=r1(yz),v=r1(yv),k=yv<yz?r:-r;return `M${a} ${z}V${r1(yv+k)}Q${a} ${v} ${r1(a+r)} ${v}H${r1(b-r)}Q${b} ${v} ${b} ${r1(yv+k)}V${z}Z`;}
 /** Monthly farm flow as columns (+ blue / − red) and the cash box as a line, on ONE MXN axis. */
 function chartSVG(sim,{width=640,animate=false}={}){const rows=sim.rows,s=sim.summary,n=rows.length,W=Math.max(280,Math.round(width)),narrow=W<520,H=narrow?232:272,L=narrow?48:60,R=narrow?10:16,T=30,B=28,pw=W-L-R,ph=H-T-B;
  const vals=rows.flatMap(r=>[r.net_cents,r.cash_cents]),tk=ticks(Math.min(0,...vals),Math.max(0,...vals)),y0=tk[0],y1=tk.at(-1),Y=v=>T+(y1-v)/((y1-y0)||1)*ph,cw=pw/n,bw=Math.max(3,Math.min(20,cw*.58)),X=i=>L+cw*i+cw/2,z=Y(0);
  const grid=tk.map(v=>`<line class="${v===0?'gs-base':'gs-gridl'}" x1="${L}" x2="${W-R}" y1="${r1(Y(v))}" y2="${r1(Y(v))}"/><text class="gs-y" x="${L-7}" y="${r1(Y(v)+3.5)}" text-anchor="end">${e(short(v))}</text>`).join('');
  const bars=rows.map((r,i)=>{const p=barPath(X(i)-bw/2,bw,Y(r.net_cents),z);return p?`<path class="gs-bar ${r.net_cents<0?'neg':'pos'}" data-m="${i}" style="--i:${i}" d="${p}"/>`:'';}).join('');
  const pts=rows.map((r,i)=>[r1(X(i)),r1(Y(r.cash_cents))]),end=pts.at(-1),every=Math.max(1,Math.ceil(n/(narrow?6:12)));
  const xs=rows.map((r,i)=>i%every===0||(i===n-1&&(n-1)%every>=every/2)?`<text class="gs-x" x="${r1(X(i))}" y="${H-9}" text-anchor="middle">${r.n}</text>`:'').join('');
  const be=s.breakEven!=null&&s.breakEven>0?(()=>{const bx=r1(X(s.breakEven)),tx=Math.max(L+62,Math.min(W-R-62,bx));return `<g class="gs-be"><line x1="${bx}" x2="${bx}" y1="${T-8}" y2="${H-B}"/><text x="${r1(tx)}" y="${T-13}" text-anchor="middle">Equilibrio · mes ${s.breakEven+1}</text></g>`;})():'';
  const lo=s.minCashAt,lp=pts[lo],lowMark=lo<n-1?`<circle class="gs-dot low" cx="${lp[0]}" cy="${lp[1]}" r="4.5"/>`:'';
  const endLbl=`<text class="gs-lbl" x="${r1(end[0]-9)}" y="${r1(Math.max(T-14,Math.min(H-B-6,end[1]-10)))}" text-anchor="end">Caja ${e(short(rows.at(-1).cash_cents))}</text>`;
  const hits=rows.map((r,i)=>`<rect class="gs-hit" data-m="${i}" x="${r1(L+cw*i)}" y="${T}" width="${r1(cw)}" height="${r1(ph)}"/>`).join('');
  const label=`Flujo de la granja por mes y caja acumulada en ${n} meses. Caja mínima ${money(s.minCash)} en el mes ${s.minCashAt+1}; ${s.breakEven==null?'sin equilibrio en el periodo':'equilibrio en el mes '+(s.breakEven+1)}. Usa las flechas para recorrer los meses.`;
  return `<svg class="gs-svg${animate?' gs-anim':''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${e(label)}" tabindex="0">${grid}${be}<g class="gs-bars">${bars}</g><path class="gs-line" pathLength="100" d="M${pts.map(p=>p.join(' ')).join(' L')}"/><line class="gs-cross" x1="0" x2="0" y1="${T}" y2="${H-B}"/>${lowMark}<circle class="gs-dot end" cx="${end[0]}" cy="${end[1]}" r="4.5"/>${endLbl}<g class="gs-xs">${xs}</g><g class="gs-hits">${hits}</g></svg>`;}

 /* ---------------- view ---------------- */
 const UI2={tl:null,bio:false};let cur=null,lastKey='',lastW=0;
 const chartNote=sim=>{const s=sim.summary;return `Caja más baja: <b>${money(s.minCash)}</b> en el mes ${s.minCashAt+1}${s.breakEven!=null?` · equilibrio en el mes <b>${s.breakEven+1}</b>`:''}. Toca o pasa el cursor por un mes (con el teclado, ← →); los valores exactos están en la línea de tiempo.`;};
 const tile=(label,value,sub,tone,i)=>`<div class="gs-kpi" data-tone="${tone}"><span class="gs-kpi-l">${ic(i)}${label}</span><b>${value}</b><small>${sub}</small></div>`;
 function kpis(sim){const s=sim.summary,k=s.soma,row=m=>sim.rows[m];
  return tile('Mes de equilibrio',s.breakEven==null?'No llega':'Mes '+(s.breakEven+1),s.breakEven==null?`En ${s.months} meses no recuperas lo invertido.`:`${e(fmtMonth(row(s.breakEven).date))}: desde ahí lo acumulado ya no es negativo.`,s.breakEven==null?'warn':'good',s.breakEven==null?'hourglass':'flag')
   +tile('Colchón mínimo',money(s.minBuffer),`${s.bufferOk?`Tu colchón de ${money(s.buffer)} alcanza.`:`Te faltan ${money(s.shortfall)}${s.runsOut!=null?`: sin dinero en el mes ${s.runsOut+1}`:''}.`} Sin SOMA: ${money(s.minBufferNoSoma)}.`,s.bufferOk?'good':'bad',s.bufferOk?'shield-check':'triangle-alert')
   +tile('SOMA y el alimento',k.coversFeed?'Lo cubre':'No alcanza',k.monthly?`${money(k.monthly)}/mes vs. hasta ${money(k.feedMax)}/mes de alimento${k.untilSale!=null?' antes de vender':''}.`:'Sin dinero de SOMA: el alimento sale del colchón.',k.coversFeed?'good':'warn',k.coversFeed?'circle-check':'triangle-alert')
   +tile(`Resultado a ${s.months} meses`,money(s.finalCum),`Ventas ${money(s.totals.sales)} · caja final ${money(s.finalCash)}.`,s.finalCum>=0?'good':'warn','chart-column');}
 function somaBox(sim){const s=sim.summary,k=s.soma,pct=k.feedMax?Math.min(100,Math.round(k.monthly/k.feedMax*100)):100;
  return `<h3>${ic('hand-coins')}¿SOMA cubre el alimento hasta la primera venta?</h3>
   <p class="gs-verdict" data-tone="${k.coversFeed?'good':'warn'}">${ic(k.coversFeed?'circle-check':'triangle-alert')}<b>${k.coversFeed?'Sí':'No'}</b><span>${k.untilSale==null?`No hay ventas en ${s.months} meses: se revisa todo el periodo.`:`Primera venta en el mes ${k.untilSale+1} (${e(fmtMonth(sim.rows[k.untilSale].date))}).`}</span></p>
   <div class="gs-meter" role="img" aria-label="SOMA cubre ${pct} % del alimento del mes más caro antes de vender"><i style="--w:${pct}"></i></div>
   <dl class="gs-pairs"><div><dt>SOMA al mes</dt><dd>${money(k.monthly)}</dd><small>${sim.auto?.soma?'tu promedio real (90 días)':'el monto que escribiste'}</small></div><div><dt>Alimento, mes más caro</dt><dd>${money(k.feedMax)}</dd><small>${k.coversFeed?'cubierto':`faltan ${money(k.gapFeed)}/mes`}</small></div><div><dt>Alimento + otros gastos</dt><dd>${money(k.runMax)}</dd><small>${k.coversRunning?'también alcanza':`faltan ${money(k.gapRunning)}/mes`}</small></div><div><dt>SOMA usado en total</dt><dd>${money(s.somaUsed)}</dd><small>solo cuando la granja no alcanza</small></div></dl>`;}
 const chip=(i,t,k='')=>`<span class="gs-ev ${k}">${ic(i)}${e(t)}</span>`;
 function chips(r,fin){const out=[];for(const v of r.events){if(v.type==='buy')out.push(chip('shopping-cart',`Compra: ${v.sows} ${plural(v.sows,'cerda','cerdas')} · ${money(v.cents)}`,'buy'));else if(v.type==='service')out.push(chip('heart',`Montas: ${v.sows}`,'quiet'));
   else if(v.type==='birth')out.push(chip('sprout',`Partos: ${v.litters} · ${v.born} lechones`,'birth'));else if(v.type==='wean')out.push(chip('milk',`Destete: ${v.weaned}`,'quiet'));
   else if(v.type==='sale')out.push(chip('badge-dollar-sign',`${fin?'Venta':'Destete y venta'}: ${v.sold} ${fin?plural(v.sold,'cerdo','cerdos'):plural(v.sold,'lechón','lechones')} · ${money(v.cents)}`,'sale'));}
  if(r.soma_cents)out.push(chip('hand-coins',`SOMA aporta ${money(r.soma_cents)}`,'soma'));if(r.cash_cents<0)out.push(chip('triangle-alert','Caja en negativo','bad'));return out.join('');}
 function timeline(sim){const fin=sim.inputs.sale_mode==='finisher';
  return `<ol class="gs-tl">${sim.rows.map(r=>`<li class="gs-tl-row${r.sales_cents?' has-sale':''}${r.cash_cents<0?' is-neg':''}"><div class="gs-tl-when"><b>Mes ${r.n}</b><small>${e(fmtMonth(r.date))}</small></div><div class="gs-tl-ev">${chips(r,fin)||chip('clock-3','Sin eventos','quiet')}</div>
   <dl class="gs-tl-num"><div><dt>Gastos</dt><dd>${money(r.out_cents)}</dd><small>${nf(r.feed_kg)} kg de alimento</small></div><div><dt>Ventas</dt><dd>${r.sales_cents?money(r.sales_cents):'—'}</dd></div><div><dt>Flujo</dt><dd class="${r.net_cents<0?'neg':''}">${money(r.net_cents)}</dd></div><div><dt>Caja</dt><dd class="${r.cash_cents<0?'neg':''}">${money(r.cash_cents)}</dd></div></dl></li>`).join('')}</ol>`;}
 function assumptions(sim){const x=sim.inputs,s=sim.summary,fin=x.sale_mode==='finisher',li=t=>`<li>${t}</li>`;
  return [li(`Compras ${x.sows} ${plural(x.sows,'cerda','cerdas')} el ${e(fmtDate(x.start))} a ${money(x.sow_price_cents)} c/u${x.setup_cents?` más ${money(x.setup_cents)} de gastos iniciales`:''}. Llegan vacías; la primera monta es ${x.first_service_days} días después y todas siguen el mismo calendario.`),
   li(`Gestación de ${x.gestation_days} días, destete a los ${x.lactation_days} y retorno al celo en ${x.return_days}: un parto cada ${nf(s.cycle_days,1)} días por cerda (${nf(x.litters_per_year,1)} al año, nunca menos de ${s.cycle_min_days} días).`),
   li(`${nf(x.litter_size,1)} lechones vivos por camada y ${nf(x.mortality_pct,1)} % de mortalidad hasta la venta: ${s.weaned_per_batch} para vender por tanda de ${x.sows} ${plural(x.sows,'cerda','cerdas')} (redondeado hacia abajo).`),
   li(fin?`Vendes cerdo terminado a los ${x.finishing_days} días de edad a ${money(x.finisher_price_cents)}; del destete a la venta cada uno come ${nf(x.feed_grow_kg,1)} kg al día.`:`Vendes los lechones al destete a ${money(x.weaner_price_cents)} c/u.`),
   li(`Cada cerda come ${nf(x.feed_sow_kg,1)} kg al día (promedio del ciclo) a ${money(x.feed_price_cents)}/kg; los lechones lactantes no suman alimento. Otros gastos: ${money(x.other_monthly_cents)} al mes.`),
   li(`SOMA respalda hasta ${money(x.soma_cents||0)} al mes: paga lo que la granja no alcanza a cubrir ese mes, sin acumular; lo demás sale del colchón (${money(x.buffer_cents)}).`),
   li(`Meses de ${nf(MONTH,1)} días. No incluye reemplazo de cerdas, semental o inseminación, fletes ni impuestos, ni el valor de ${s.onHand?`los ${s.onHand} animales que quedan sin vender al cierre`:'los animales al cierre'}.`)].join('');}
 const moneyIn=(k,label,v,hint='')=>`<label class="gs-field"><span>${label}</span><span class="gs-in"><i aria-hidden="true">$</i><input class="input pre" name="${k}" inputmode="decimal" autocomplete="off" spellcheck="false" value="${e(pesos(v))}" data-kind="money"></span>${hint?`<small>${hint}</small>`:''}</label>`;
 const numIn=(k,label,v,unit='',hint='')=>{const [min,max,step]=LIM[k];return `<label class="gs-field"><span>${label}</span><span class="gs-in"><input class="input${unit?' unit':''}" name="${k}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${e(v)}" data-kind="num">${unit?`<em aria-hidden="true">${unit}</em>`:''}</span>${hint?`<small>${hint}</small>`:''}</label>`;};
 function formHTML(c,auto,avg){const fin=c.sale_mode==='finisher';
  return `<fieldset class="gs-set"><legend>${ic('shopping-cart')}Compra</legend>${numIn('sows','Cerdas a comprar',c.sows)}${moneyIn('sow_price_cents','Precio por cerda',c.sow_price_cents)}${moneyIn('setup_cents','Gastos iniciales',c.setup_cents,'Corrales, comederos, equipo.')}<label class="gs-field"><span>Fecha de compra</span><input class="input" type="date" name="start" value="${e(c.start)}" data-kind="date" data-auto="${auto.start?1:0}"></label></fieldset>
   <fieldset class="gs-set"><legend>${ic('wheat')}Alimento y gastos</legend>${numIn('feed_sow_kg','Por cerda al día',c.feed_sow_kg,'kg','Promedio del ciclo.')}${numIn('feed_grow_kg','Por cerdo en engorda',c.feed_grow_kg,'kg','Al día; solo si vendes terminado.')}${moneyIn('feed_price_cents','Precio del alimento (kg)',c.feed_price_cents)}${moneyIn('other_monthly_cents','Otros gastos al mes',c.other_monthly_cents,'Veterinario, agua, luz…')}</fieldset>
   <fieldset class="gs-set"><legend>${ic('sprout')}Producción y venta</legend>${numIn('litter_size','Lechones vivos por camada',c.litter_size)}${numIn('mortality_pct','Mortalidad hasta la venta',c.mortality_pct,'%')}
    <div class="gs-seg" role="radiogroup" aria-label="Qué vendes"><label class="${fin?'':'is-on'}"><input type="radio" name="sale_mode" value="weaner"${fin?'':' checked'}>Lechón al destete</label><label class="${fin?'is-on':''}"><input type="radio" name="sale_mode" value="finisher"${fin?' checked':''}>Cerdo terminado</label></div>
    <div class="gs-price${fin?' is-off':''}" data-mode="weaner">${moneyIn('weaner_price_cents','Precio por lechón',c.weaner_price_cents)}</div><div class="gs-price${fin?'':' is-off'}" data-mode="finisher">${moneyIn('finisher_price_cents','Precio por cerdo terminado',c.finisher_price_cents)}</div></fieldset>
   <fieldset class="gs-set"><legend>${ic('wallet')}Dinero y plazo</legend><label class="gs-field gs-wide"><span>Meses a simular: <output id="gs-months-out">${c.months}</output></span><input class="gs-range" type="range" name="months" min="12" max="24" step="1" value="${c.months}" data-kind="num"></label>${moneyIn('buffer_cents','Colchón inicial',c.buffer_cents,'Lo que tienes para empezar.')}
    <div class="gs-field"><label for="gs-soma">Dinero de SOMA al mes</label><span class="gs-in"><i aria-hidden="true">$</i><input class="input pre" id="gs-soma" name="soma_cents" inputmode="decimal" autocomplete="off" spellcheck="false" value="${e(pesos(c.soma_cents??avg))}" data-kind="money" data-auto="${auto.soma?1:0}" aria-describedby="gs-soma-hint"></span><small id="gs-soma-hint">${somaHint(auto.soma,avg)}</small></div></fieldset>
   <details class="gs-bio" data-gs-open="bio"${UI2.bio?' open':''}><summary>${ic('sliders-horizontal')}Biología (supuestos genéricos, editables)</summary><div class="gs-set gs-flat">${numIn('gestation_days','Gestación',c.gestation_days,'días')}${numIn('lactation_days','Lactancia / destete',c.lactation_days,'días','Típico: 21–28.')}${numIn('return_days','Retorno al celo',c.return_days,'días','Típico: 5–7.')}${numIn('litters_per_year','Partos por cerda al año',c.litters_per_year,'','Típico: ~2.2.')}${numIn('finishing_days','Edad de venta (terminado)',c.finishing_days,'días','Típico: 150–180.')}${numIn('first_service_days','De la compra a la 1.ª monta',c.first_service_days,'días')}</div></details>`;}
 const somaHint=(auto,avg)=>auto?'Tu promedio real de SOMA (últimos 90 días).':`Tu promedio real: ${money(avg)}/mes. <button type="button" class="gs-link" data-gs="soma-auto">Usar promedio</button>`;
 /** Inputs as stored: soma_cents/start stay null while automatic (live SOMA average · today). */
 function stored(){return Store.get()?.preferences?.farmSim||{};}
 function run(raw){const x=normalize(raw),avg=somaMonthly(),sim=simulate({...x,soma_cents:x.soma_cents??avg});sim.auto={soma:x.soma_cents==null,avg};return sim;}
 function panel(){const raw=stored(),c=normalize(raw),avg=somaMonthly(),auto={soma:c.soma_cents==null,start:!isDate(raw.start)};cur=run(raw);
  if(UI2.tl==null){try{UI2.tl=matchMedia('(min-width: 821px)').matches;}catch{UI2.tl=true;}}/* the month list starts folded on phones */
  return `<section class="panel gs v8-card" id="gs-panel" aria-labelledby="gs-title">
   <header class="gs-head"><div><span class="gs-eyebrow">SIMULADOR · ANTES DE COMPRAR</span><h2 id="gs-title">¿Te alcanza para empezar con cerdas?</h2><p class="gs-sub">Cambia los supuestos y mira mes a mes tu caja, cuándo recuperas lo invertido y cuánto colchón necesitas. Es una simulación, no una recomendación.</p></div><button type="button" class="button small" data-gs="reset">${ic('rotate-ccw')}Restablecer</button></header>
   <div class="gs-kpis" id="gs-kpis" aria-live="polite">${kpis(cur)}</div>
   <div class="gs-grid"><form class="gs-form" id="gs-form" aria-label="Supuestos del simulador">${formHTML(c,auto,avg)}</form>
    <div class="gs-side"><section class="gs-chart-box" aria-labelledby="gs-chart-h"><header class="gs-chart-head"><h3 id="gs-chart-h">Flujo y caja por mes</h3><div class="gs-legend"><span class="gs-key"><i class="pos"></i>Flujo del mes +</span><span class="gs-key"><i class="neg"></i>Flujo del mes −</span><span class="gs-key"><i class="line"></i>Caja acumulada</span><span class="gs-key"><i class="low"></i>Caja más baja</span></div></header>
     <div class="gs-chart" id="gs-chart"></div><div class="gs-tip" id="gs-tip" role="status" hidden></div><p class="gs-chart-note" id="gs-chart-note">${chartNote(cur)}</p></section>
     <section class="gs-soma" id="gs-somabox">${somaBox(cur)}</section></div></div>
   <details class="gs-tl-box" data-gs-open="tl"${UI2.tl?' open':''}><summary>${ic('list-ordered')}Línea de tiempo mes a mes</summary><div id="gs-timeline">${timeline(cur)}</div></details>
   <section class="gs-assume" aria-labelledby="gs-assume-h"><h3 id="gs-assume-h">${ic('info')}Supuestos de esta simulación</h3><ul id="gs-assume-list">${assumptions(cur)}</ul><p class="gs-disclaimer">Simulación con supuestos genéricos y editables, no asesoría veterinaria, financiera ni de inversión. Confirma precios, raciones y protocolos con tus proveedores y tu veterinario antes de comprar.</p></section></section>`;}

 /* ---------------- live chart + tooltip ---------------- */
 function tipNodes(r){const mk=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;},out=[mk('strong',`Mes ${r.n} · ${fmtMonth(r.date)}`),mk('span',`${money(r.net_cents)} · flujo del mes`),mk('span',`${money(r.cash_cents)} · caja`)];
  if(r.sales_cents)out.push(mk('span',`${money(r.sales_cents)} · ventas`));out.push(mk('span',`${money(r.out_cents)} · gastos`));if(r.soma_cents)out.push(mk('span',`${money(r.soma_cents)} · de SOMA`));if(r.born)out.push(mk('span',`${r.born} lechones nacen`));return out;}
 function bindChart(host){if(!host||host.dataset.bound)return;host.dataset.bound='1';
  const hide=()=>{host.classList.remove('is-hover');host.querySelectorAll('.gs-bar.is-hot').forEach(b=>b.classList.remove('is-hot'));const tip=document.getElementById('gs-tip');if(tip)tip.hidden=true;};
  const show=i=>{const svg=host.querySelector('svg'),r=cur?.rows?.[i],hit=svg?.querySelector(`.gs-hit[data-m="${i}"]`),tip=document.getElementById('gs-tip');if(!svg||!r||!hit)return;host.dataset.m=String(i);host.classList.add('is-hover');
   host.querySelectorAll('.gs-bar.is-hot').forEach(b=>b.classList.remove('is-hot'));svg.querySelector(`.gs-bar[data-m="${i}"]`)?.classList.add('is-hot');
   const cx=Number(hit.getAttribute('x'))+Number(hit.getAttribute('width'))/2,cross=svg.querySelector('.gs-cross');cross?.setAttribute('x1',cx);cross?.setAttribute('x2',cx);if(!tip)return;
   tip.replaceChildren(...tipNodes(r));tip.hidden=false;const w=host.clientWidth||1,vb=svg.viewBox?.baseVal?.width||w,px=cx*(svg.getBoundingClientRect().width||w)/vb,tw=tip.offsetWidth||180;tip.style.left=r1(host.offsetLeft+Math.max(4,Math.min(w-tw-4,px-tw/2)))+'px';tip.style.top=r1(host.offsetTop+6)+'px';};
  const hitOf=ev=>ev.target.closest?.('.gs-hit');
  host.addEventListener('pointermove',ev=>{const h=hitOf(ev);if(h)show(Number(h.dataset.m));});host.addEventListener('pointerdown',ev=>{const h=hitOf(ev);if(h)show(Number(h.dataset.m));});host.addEventListener('pointerleave',hide);
  host.addEventListener('focusin',()=>show(host.dataset.m?Number(host.dataset.m):Math.max(0,(cur?.rows?.length||1)-1)));host.addEventListener('focusout',hide);
  host.addEventListener('keydown',ev=>{const n=cur?.rows?.length||0;if(!n)return;let i=host.dataset.m?Number(host.dataset.m):n-1;
   if(ev.key==='ArrowRight')i=Math.min(n-1,i+1);else if(ev.key==='ArrowLeft')i=Math.max(0,i-1);else if(ev.key==='Home')i=0;else if(ev.key==='End')i=n-1;else if(ev.key==='Escape'){hide();return;}else return;ev.preventDefault();show(i);});}
 function drawChart(animate=false){const host=document.getElementById('gs-chart');if(!host||!cur)return;const w=Math.round(host.clientWidth||0)||640;lastW=w;host.innerHTML=chartSVG(cur,{width:w,animate:animate&&!reduced()});delete host.dataset.m;host.classList.remove('is-hover');bindChart(host);const tip=document.getElementById('gs-tip');if(tip)tip.hidden=true;}

 /* ---------------- form: live recompute, save on change ---------------- */
 function readForm(f){const base=stored(),out={};for(const el of f.querySelectorAll('input[name]')){const k=el.name;if(el.type==='radio'){if(el.checked)out[k]=el.value;continue;}
   if(el.dataset.auto==='1'){out[k]=null;el.removeAttribute('aria-invalid');continue;}
   try{const v=el.value.trim();if(el.dataset.kind==='money')out[k]=cents(v);else if(el.dataset.kind==='date'){if(!isDate(v))throw Error();out[k]=v;}else{if(v===''||!Number.isFinite(Number(v)))throw Error();out[k]=Number(v);}el.removeAttribute('aria-invalid');}
   catch{el.setAttribute('aria-invalid','true');out[k]=base[k];}}return out;}
 function setHTML(id,html){const n=document.getElementById(id);if(!n)return;n.innerHTML=html;try{window.lucide?.createIcons?.({root:n});}catch{}}
 function update(){const f=document.getElementById('gs-form');if(!f)return;cur=run(readForm(f));
  setHTML('gs-kpis',kpis(cur));setHTML('gs-somabox',somaBox(cur));setHTML('gs-chart-note',chartNote(cur));setHTML('gs-timeline',timeline(cur));setHTML('gs-assume-list',assumptions(cur));drawChart(false);
  const mode=cur.inputs.sale_mode;f.querySelectorAll('.gs-price').forEach(p=>p.classList.toggle('is-off',p.dataset.mode!==mode));f.querySelectorAll('.gs-seg label').forEach(l=>l.classList.toggle('is-on',!!l.querySelector('input:checked')));
  const o=document.getElementById('gs-months-out');if(o)o.textContent=String(cur.inputs.months);const soma=document.getElementById('gs-soma'),hint=document.getElementById('gs-soma-hint');if(soma&&hint)hint.innerHTML=somaHint(soma.dataset.auto==='1',cur.auto.avg);}
 /** Persist the simulator inputs in preferences.farmSim (soma_cents/start null = automatic). Returns what was stored. */
 function saveInputs(raw){const x=normalize(raw),next={v:1,...x,soma_cents:raw?.soma_cents==null?null:x.soma_cents,start:isDate(raw?.start)?x.start:null},prev=stored();
  if(JSON.stringify(prev)===JSON.stringify(next))return prev;Store.save(s=>{s.preferences.farmSim=next;});return next;}
 function persist(){const f=document.getElementById('gs-form');if(!f)return;try{saveInputs(readForm(f));window.FormSafety?.cleanPage?.(f);}catch(err){App.toast(err.message||'No pude guardar el simulador.','error');}}
 let timer=0;
 document.addEventListener('input',ev=>{const f=ev.target?.closest?.('#gs-form');if(!f)return;const t=ev.target;if(t!==f&&t.dataset?.auto==='1')t.dataset.auto='0';
  if(t.name==='months'){const o=document.getElementById('gs-months-out');if(o)o.textContent=t.value;}clearTimeout(timer);timer=setTimeout(update,90);});
 document.addEventListener('change',ev=>{if(!ev.target?.closest?.('#gs-form'))return;clearTimeout(timer);update();persist();});
 document.addEventListener('submit',ev=>{if(ev.target?.id!=='gs-form')return;ev.preventDefault();clearTimeout(timer);update();persist();});
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-gs]');if(!b)return;const a=b.dataset.gs;
  if(a==='reset')App.confirmAction('Restablecer el simulador','Vuelven los supuestos genéricos. Tus animales y registros de Granja no cambian.',()=>{const f=document.getElementById('gs-form');if(f)window.FormSafety?.cleanPage?.(f);Store.save(s=>{delete s.preferences.farmSim;});},'Restablecer');
  else if(a==='soma-auto'){const inp=document.getElementById('gs-soma');if(inp){inp.value=pesos(somaMonthly());inp.dataset.auto='1';inp.removeAttribute('aria-invalid');}update();persist();}});
 document.addEventListener('toggle',ev=>{const d=ev.target;if(d?.dataset?.gsOpen)UI2[d.dataset.gsOpen]=d.open;},true);
 let rz=0;window.addEventListener?.('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{const h=document.getElementById('gs-chart');if(h&&Math.round(h.clientWidth)!==lastW)drawChart(false);},160);});

 /* ---------------- lifecycle ---------------- */
 const tab=()=>window.UI?.tab?.granja||Store.get()?.preferences?.farmView||'summary';
 /** #granja (pestaña Resumen) → after the summary grid (or the tab rail). No-op elsewhere; idempotent by id. */
 function afterRender(){const sec=window.UI?.section,key=sec+'/'+(window.UI?.id||'');
  try{if(sec!=='granja'||UI.id||!Store.get()||tab()!=='summary')return;const main=document.getElementById('main-content');if(!main||main.querySelector('#gs-panel'))return;
   const anchor=[...(main.children||[])].find(n=>n.matches?.('.detail-grid'))||main.querySelector('.rancho-rail')||main.querySelector('.rancho-hero')||main.querySelector('.page-heading');if(!anchor)return;
   anchor.insertAdjacentHTML('afterend',panel());const box=main.querySelector('#gs-panel'),arrive=lastKey!==key;try{window.lucide?.createIcons?.({root:box||main});}catch{}drawChart(arrive);
   if(box&&arrive&&window.Motion?.animate&&!reduced()){try{Motion.animate([...box.querySelectorAll('.gs-head,.gs-kpi,.gs-set,.gs-chart-box,.gs-soma')].slice(0,14),{opacity:[0,1],y:[12,0]},{type:'spring',stiffness:260,damping:26,delay:Motion.stagger?.(.035)||0});}catch{}}
  }finally{lastKey=key;}}
 return Object.freeze({afterRender,panel,simulate,normalize,somaMonthly,saveInputs,chartSVG,DEFAULTS:DEF});
})();
