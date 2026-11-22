'use strict';
/* EVIE v10 · ALVENTO+ — estudio del drop. Extiende ALVENTO (no lo duplica): drops, SKUs (alventoProducts) y ventas
   (alventoSales → un único ingreso en Finanzas) siguen siendo la fuente de verdad. En #alvento (con selector de drop) y en
   #alvento/<id>:
   - Plan: piezas (texto libre), colores (chips), curva de tallas S–XL por color y fecha de lanzamiento (launch_at del drop).
   - Cotizaciones: proveedores por pieza → la más barata y la más rápida que aceptan tu cantidad (respeta mínimos) y el total.
   - Margen: cotización elegida + etiquetas, empaque, envío y otros por pieza vs. precio → margen %, utilidad por pieza y por
     drop, piezas para recuperar lo invertido.
   - Inventario por talla: stock de tus SKUs menos ventas registradas, aviso de stock bajo; «Vender» usa el flujo de siempre.
     El plan puede crear los SKUs (pieza × color × talla).
   Datos: el plan vive en su propio drop (alventoDrops[].plus, campo extra que V2Domain.validate permite y que Records.normalize
   y Store.put conservan al editar el drop); el umbral de stock bajo en preferences.alventoPlus. Sin colecciones nuevas.
   Nada viene precargado: piezas, proveedores y precios son tuyos. */
window.AlventoPlus=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const money=c=>Domain.money(Math.round(Number(c)||0));
 const uid=()=>crypto.randomUUID();
 const today=()=>Domain.today();
 const SIZES=Object.freeze(['S','M','L','XL']),EXTRAS=[['labels','Etiquetas'],['pack','Empaque'],['ship','Envío'],['other','Otros']];
 const STATUS={idea:'Idea',planning:'Planeación',production:'Producción',content:'Contenido',scheduled:'Programado',live:'A la venta',closed:'Cerrado',archived:'Archivado'};
 const TABS=[['plan','Plan','layers'],['quotes','Cotizaciones','scale'],['margin','Margen','percent'],['stock','Inventario','boxes']];
 const int=(v,min=0,max=1e9)=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;};
 const txt=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
 const okId=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v);
 const cents=v=>{const s=String(v??'').replace(/[\s,$]/g,'');return s?Domain.cents(s):0;};
 const pesos=c=>c?(Math.round(Number(c)||0)/100).toFixed(2).replace(/\.00$/,''):'';
 const nf=n=>Number(n||0).toLocaleString('es-MX');
 const plural=(n,a,b)=>n===1?a:b;
 const dayDiff=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
 const fmtDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'';
 const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement?.dataset?.motion==='reduced';}catch{return true;}};
 /* Swatches for common color names (constants only: user text never reaches a style attribute). */
 const SW={negro:'#16181d',blanco:'#f4f4f1',gris:'#8d929b',arena:'#d8c3a0',beige:'#d9c7a7',hueso:'#ece3cf',crema:'#efe3c2',cafe:'#6f4e37','café':'#6f4e37',chocolate:'#5a3a26',azul:'#2f5fb3',marino:'#1e2a4a',celeste:'#8ec5ff',rojo:'#c0392b',vino:'#6d1f2f',verde:'#2f7d4f',olivo:'#6b6b3a',militar:'#5b5e3a',rosa:'#e59bb4',morado:'#6a4c93',lila:'#b39ddb',amarillo:'#e8c33c',mostaza:'#c9a227',naranja:'#e07a2e'};
 const sw=c=>SW[String(c||'').trim().toLowerCase().split(/\s+/)[0]]||null;
 const dot=c=>{const h=sw(c);return `<i class="ap-dot"${h?` style="--c:${h}"`:''} aria-hidden="true"></i>`;};

 /* ---------------- data shape ---------------- */
 function normQuote(q,i){if(!q||typeof q!=='object')return null;const supplier=txt(q.supplier,60);if(!supplier)return null;
  return {id:okId(q.id)?q.id:'q'+i,supplier,unit_cents:int(q.unit_cents,0,1e9),min_qty:int(q.min_qty,0,1e6),lead_days:q.lead_days==null||q.lead_days===''?null:int(q.lead_days,0,3650),notes:txt(q.notes,200)};}
 function normPiece(p,i){if(!p||typeof p!=='object')return null;const name=txt(p.name,40);if(!name)return null;const seen=new Set(),colors=[];
  for(const c of Array.isArray(p.colors)?p.colors:[]){const v=txt(c,24),k=v.toLowerCase();if(v&&!seen.has(k)){seen.add(k);colors.push(v);}}
  const quotes=(Array.isArray(p.quotes)?p.quotes:[]).map(normQuote).filter(Boolean).slice(0,12);
  return {id:okId(p.id)?p.id:'p'+i,name,colors:colors.slice(0,12),sizes:Object.fromEntries(SIZES.map(s=>[s,int(p.sizes?.[s],0,99999)])),price_cents:int(p.price_cents,0,1e9),
   extras:Object.fromEntries(EXTRAS.map(([k])=>[k,int(p.extras?.[k],0,1e8)])),quotes,quote_id:quotes.some(q=>q.id===p.quote_id)?p.quote_id:null};}
 /** The plan stored on a drop (drop.plus), always in a safe, bounded shape. */
 function normalizePlus(x){const p=x&&typeof x==='object'?x:{};return {v:1,pieces:(Array.isArray(p.pieces)?p.pieces:[]).map(normPiece).filter(Boolean).slice(0,30),fixed_cents:int(p.fixed_cents,0,1e10)};}

 /* ---------------- pure math ---------------- */
 /** Units of a plan. The size curve is PER COLOR (no colors = 1 colorway): units = Σ sizes × colors. */
 function planTotals(pieces=[]){const perSize=Object.fromEntries(SIZES.map(s=>[s,0])),colors=new Set();let units=0;
  const rows=(pieces||[]).map(p=>{const n=Math.max(1,(p.colors||[]).length),curve=SIZES.reduce((a,s)=>a+int(p.sizes?.[s]),0);for(const s of SIZES)perSize[s]+=int(p.sizes?.[s])*n;for(const c of p.colors||[])colors.add(String(c).trim().toLowerCase());units+=curve*n;return {id:p.id,name:p.name,curve,colors:n,units:curve*n};});
  return {pieces:rows.length,units,perSize,colors:colors.size,rows};}
 /** Compare quotes for `qty` pieces. Minimums are respected: a quote whose minimum is above qty can only be bought at its
     minimum (extra pieces), so it does not compete for «más barata» / «más rápida»; «mejor total» is the cheapest way to get
     at least qty pieces (it may be a minimum order). Ties: cheaper → faster → first. qty ≤ 0: minimums are ignored. */
 function quoteSummary(quotes=[],qty=0){qty=int(qty,0,1e7);const L=r=>r.lead_days==null?Infinity:r.lead_days;
  const rows=(quotes||[]).filter(q=>q&&int(q.unit_cents)>0).map((q,i)=>{const unit=int(q.unit_cents),min=int(q.min_qty,0,1e6),lead=q.lead_days==null||q.lead_days===''||!Number.isFinite(Number(q.lead_days))?null:int(q.lead_days,0,3650),order=qty>0?Math.max(qty,min):0,total=unit*order;
   return {id:q.id,supplier:String(q.supplier||''),notes:String(q.notes||''),unit_cents:unit,min_qty:min,lead_days:lead,meets:qty<=0||qty>=min,order_qty:order,extra_units:Math.max(0,order-qty),total_cents:total,effective_cents:qty>0?Math.round(total/qty):unit,i};});
  const ok=rows.filter(r=>r.meets),cheapest=ok.slice().sort((a,b)=>a.unit_cents-b.unit_cents||L(a)-L(b)||a.i-b.i)[0]||null,fastest=ok.filter(r=>r.lead_days!=null).sort((a,b)=>L(a)-L(b)||a.unit_cents-b.unit_cents||a.i-b.i)[0]||null,best=qty>0?rows.slice().sort((a,b)=>a.total_cents-b.total_cents||L(a)-L(b)||a.i-b.i)[0]||null:null;
  for(const r of rows){r.cheapest=r===cheapest;r.fastest=r===fastest;r.best=r===best;delete r.i;}
  return {qty,rows,eligible:ok.length,cheapest:cheapest?.id??null,fastest:fastest?.id??null,best:best?.id??null};}
 /** The quote a piece uses: the one you picked, else the cheapest that accepts your quantity, else the best total. */
 function chosenQuote(piece,qs){const pick=qs.rows.find(r=>r.id===piece?.quote_id);if(pick)return {...pick,auto:false};const a=qs.rows.find(r=>r.cheapest)||qs.rows.find(r=>r.best)||qs.rows[0];return a?{...a,auto:true}:null;}
 /** Unit economics. extras: object/array of per-piece cents; units: pieces you pay for (the order); fixed: one-time drop costs.
     Break-even = pieces to SELL at `price` to recover everything you paid (cost × units + fixed). */
 function margin({unit_cents=0,extras=0,price_cents=0,units=0,fixed_cents=0}={}){
  const ex=Array.isArray(extras)?extras.reduce((a,x)=>a+int(x),0):extras&&typeof extras==='object'?Object.values(extras).reduce((a,x)=>a+int(x),0):int(extras);
  const unit=int(unit_cents),price=int(price_cents),n=int(units,0,1e7),fixed=int(fixed_cents,0,1e10),cost=unit+ex,profit=price-cost,investment=cost*n+fixed,revenue=price*n,be=price>0?Math.ceil(investment/price):null;
  return {unit_cents:unit,extras_cents:ex,cost_cents:cost,price_cents:price,profit_cents:profit,margin_pct:price>0?Math.round(profit/price*1000)/10:null,units:n,fixed_cents:fixed,investment_cents:investment,revenue_cents:revenue,drop_profit_cents:revenue-investment,break_even_units:be,recovers:be!=null&&be<=n};}
 /** Whole-drop economics from its plan: each piece with its chosen quote (order respects the minimum) + drop fixed costs. */
 function dropEconomics(plus){const pl=normalizePlus(plus),t=planTotals(pl.pieces);let inv=0,rev=0,units=0;
  const rows=pl.pieces.map(p=>{const qty=t.rows.find(r=>r.id===p.id)?.units||0,qs=quoteSummary(p.quotes,qty),ch=chosenQuote(p,qs),order=ch?ch.order_qty:qty,m=margin({unit_cents:ch?.unit_cents||0,extras:p.extras,price_cents:p.price_cents,units:order});inv+=m.investment_cents;rev+=m.revenue_cents;units+=order;return {piece:p,qty,qs,chosen:ch,m};});
  inv+=pl.fixed_cents;return {rows,units,fixed_cents:pl.fixed_cents,investment_cents:inv,revenue_cents:rev,profit_cents:rev-inv,margin_pct:rev>0?Math.round((rev-inv)/rev*1000)/10:null,recover_pct:rev>0?Math.round(inv/rev*1000)/10:null,missing:rows.filter(r=>!r.chosen||!r.piece.price_cents).length};}
 const RANK=['XXS','XS','S','M','L','XL','XXL','2XL','XXXL','3XL'];
 const sizeRank=s=>{const i=RANK.indexOf(String(s||'').trim().toUpperCase());return i<0?100:i;};
 /** Stock per product (title + color) and size: initial − sold, with sold = real sales (reverted ones excluded). */
 function inventory(products=[],sales=[],{low=3}={}){low=int(low,0,9999);const sold=new Map();for(const x of sales||[])if(x&&!x.deleted_at)sold.set(x.product_id,(sold.get(x.product_id)||0)+int(x.quantity));
  const groups=new Map(),sizes=new Map();let initial=0,soldAll=0;
  for(const p of (products||[]).filter(p=>p&&!p.deleted_at)){const title=txt(p.title,80)||'Sin nombre',color=txt(p.color,40),key=title.toLowerCase()+'\u0000'+color.toLowerCase();if(!groups.has(key))groups.set(key,{title,color,cells:[]});
   const i=int(p.initial_stock),s=sold.get(p.id)||0,r=i-s,size=txt(p.size,16).toUpperCase()||'ÚNICA';groups.get(key).cells.push({product_id:p.id,sku:p.sku||'',size,initial:i,sold:s,remaining:r,price_cents:int(p.unit_price),low:r>0&&r<=low,out:r<=0});
   const z=sizes.get(size)||{size,initial:0,sold:0,remaining:0};z.initial+=i;z.sold+=s;z.remaining+=r;sizes.set(size,z);initial+=i;soldAll+=s;}
  const order=(a,b)=>sizeRank(a.size)-sizeRank(b.size)||a.size.localeCompare(b.size,'es');
  const rows=[...groups.values()].map(g=>({...g,cells:g.cells.sort(order),initial:g.cells.reduce((a,c)=>a+c.initial,0),sold:g.cells.reduce((a,c)=>a+c.sold,0),remaining:g.cells.reduce((a,c)=>a+c.remaining,0)})).sort((a,b)=>a.title.localeCompare(b.title,'es')||a.color.localeCompare(b.color,'es'));
  const cells=rows.flatMap(r=>r.cells);return {rows,perSize:[...sizes.values()].sort(order),initial,sold:soldAll,remaining:initial-soldAll,low:cells.filter(c=>c.low).length,out:cells.filter(c=>c.out).length,threshold:low};}
 const slug=(s,n)=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,n);
 /** SKUs to create from the plan: one alventoProducts record per piece × color × size with quantity > 0. Existing ones
     (same drop, title, color and size) are skipped; SKU codes stay unique. Cost = chosen quote + extras. */
 function skuPlan(drop,products=[]){const eco=dropEconomics(drop?.plus),live=(products||[]).filter(p=>p&&!p.deleted_at),key=(...a)=>a.map(x=>String(x||'').trim().toLowerCase()).join('|');
  const have=new Set(live.filter(p=>p.drop_id===drop.id).map(p=>key(p.title,p.color,p.size))),skus=new Set(live.map(p=>String(p.sku||'').toUpperCase())),out=[];
  for(const r of eco.rows){const p=r.piece;for(const c of p.colors.length?p.colors:[''])for(const s of SIZES){const q=int(p.sizes[s]);if(!q||have.has(key(p.name,c,s)))continue;
    const base=['D'+int(drop.sequence||1,1,9999),slug(p.name,8)||'PZA',slug(c,3),s].filter(Boolean).join('-');let sku=base,k=2;while(skus.has(sku))sku=base+'-'+k++;skus.add(sku);
    out.push({drop_id:drop.id,title:p.name,sku,category:'',color:c,size:s,unit_price:p.price_cents,unit_cost:r.m.cost_cents,initial_stock:q,status:'active',notes:'Creado desde el plan del drop.'});}}
  return out;}

 /* ---------------- store ---------------- */
 const S={tab:'plan',drop:null,piece:null};
 const prefs=()=>Store.get()?.preferences?.alventoPlus||{};
 const lowStock=()=>int(prefs().low_stock??3,0,9999);
 const allDrops=()=>Store.list('alventoDrops').slice().sort((a,b)=>(a.launch_at||'9999-12-31').localeCompare(b.launch_at||'9999-12-31')||String(a.title||'').localeCompare(String(b.title||''),'es'));
 const dropOf=id=>id?Store.list('alventoDrops').find(d=>d.id===id)||null:null;
 function pickDefault(list=allDrops()){const t=today(),open=list.filter(d=>!['closed','archived'].includes(d.status));return open.find(d=>d.launch_at&&d.launch_at>=t)||open[0]||list[0]||null;}
 function current(){if(window.UI?.id)return dropOf(UI.id);const d=dropOf(S.drop)||pickDefault();S.drop=d?.id||null;return d;}
 const planOf=id=>normalizePlus(dropOf(id)?.plus);
 /** Mutate a drop's plan inside one Store.save (validated like any other save). */
 function savePlan(id,fn){let out;Store.save(s=>{const d=s.alventoDrops.find(x=>x.id===id&&!x.deleted_at);if(!d)throw Error('No encontré ese drop.');const p=normalizePlus(d.plus);out=fn(p,d);d.plus=normalizePlus(p);d.updated_at=new Date().toISOString();});return out;}

 /* ---------------- views ---------------- */
 const badge=(t,i,k='')=>`<span class="ap-badge ${k}">${ic(i)}${e(t)}</span>`;
 const selPiece=pl=>pl.pieces.find(p=>p.id===S.piece)||pl.pieces[0]||null;
 const noPieces=d=>`<div class="ap-empty">${ic('layers')}<div><strong>Primero planea las piezas</strong><p>Agrega una pieza en Plan para cotizarla y calcular su margen.</p></div></div><div class="ap-bar-actions"><button type="button" class="button primary" data-ap="piece-add" data-drop="${e(d.id)}">${ic('plus')}Agregar pieza</button></div>`;
 function pieceCard(d,p,r){const units=r?.units||0,qs=quoteSummary(p.quotes,units),ch=chosenQuote(p,qs);
  return `<li class="ap-piece"><div class="ap-piece-top"><h3>${e(p.name)}</h3><span class="ap-units"><b>${nf(units)}</b> ${plural(units,'pieza','piezas')}</span></div>
   <div class="ap-colors">${p.colors.length?p.colors.map(c=>`<span class="ap-color">${dot(c)}${e(c)}</span>`).join(''):'<span class="ap-muted">Sin colores: cuenta como uno</span>'}</div>
   <div class="ap-curve" role="group" aria-label="Curva de tallas por color">${SIZES.map(s=>`<span><small>${s}</small><b>${p.sizes[s]}</b></span>`).join('')}<em>× ${Math.max(1,p.colors.length)}<span class="sr-only"> ${plural(Math.max(1,p.colors.length),'color','colores')}</span></em></div>
   <p class="ap-piece-meta">${p.price_cents?'Precio '+money(p.price_cents):'Sin precio'} · ${p.quotes.length?`${p.quotes.length} ${plural(p.quotes.length,'cotización','cotizaciones')}${ch?` · ${e(ch.supplier)} ${money(ch.unit_cents)}/pza`:''}`:'Sin cotizaciones'}</p>
   <div class="ap-piece-actions"><button type="button" class="button small" data-ap="piece-edit" data-drop="${e(d.id)}" data-piece="${e(p.id)}">${ic('pencil')}Editar</button><button type="button" class="button small" data-ap="piece-quotes" data-piece="${e(p.id)}">${ic('scale')}Cotizar</button><button type="button" class="ap-icon" data-ap="piece-del" data-drop="${e(d.id)}" data-piece="${e(p.id)}" aria-label="Quitar ${e(p.name)} del plan">${ic('trash-2')}</button></div></li>`;}
 function planView(d){const pl=normalizePlus(d.plus),t=planTotals(pl.pieces),left=d.launch_at?dayDiff(today(),d.launch_at):null,max=Math.max(1,...SIZES.map(s=>t.perSize[s]));
  const when=d.launch_at?`Lanzamiento ${e(fmtDate(d.launch_at))} · ${left>0?`faltan ${left} ${plural(left,'día','días')}`:left===0?'es hoy':`fue hace ${-left} ${plural(-left,'día','días')}`}`:'Sin fecha de lanzamiento';
  return `<div class="ap-drop"><div class="ap-drop-meta"><strong>${e(d.title)}</strong><span class="ap-tag">${e(STATUS[d.status]||d.status||'')}</span><span class="ap-when">${ic('calendar-days')}${when}</span></div>
    <div class="ap-drop-actions"><button type="button" class="button small" data-action="v2-edit" data-collection="alventoDrops" data-id="${e(d.id)}">${ic('pencil')}${d.launch_at?'Fecha y datos':'Poner fecha'}</button>${window.UI?.id?'':`<a class="button small" href="#alvento/${e(d.id)}">${ic('arrow-up-right')}Abrir drop</a>`}</div></div>
   <div class="ap-plan-top"><dl class="ap-kpis"><div><dt>Piezas</dt><dd>${t.pieces}</dd></div><div><dt>Unidades</dt><dd>${nf(t.units)}</dd></div><div><dt>Colores</dt><dd>${t.colors}</dd></div></dl>
    <div class="ap-sizes" role="list" aria-label="Unidades por talla">${SIZES.map(s=>`<div class="ap-size" role="listitem"><b>${s}</b><i style="--w:${Math.round(t.perSize[s]/max*100)}" aria-hidden="true"></i><span>${nf(t.perSize[s])}</span></div>`).join('')}</div></div>
   ${pl.pieces.length?`<ul class="ap-pieces">${pl.pieces.map(p=>pieceCard(d,p,t.rows.find(r=>r.id===p.id))).join('')}</ul>`:`<div class="ap-empty">${ic('shirt')}<div><strong>Agrega la primera pieza</strong><p>Hoodie, playera, pants… con sus colores y cuántas van por talla.</p></div></div>`}
   <div class="ap-bar-actions"><button type="button" class="button primary" data-ap="piece-add" data-drop="${e(d.id)}">${ic('plus')}Agregar pieza</button>${t.units?`<button type="button" class="button" data-ap="skus" data-drop="${e(d.id)}">${ic('package-plus')}Crear SKUs en el inventario</button>`:''}</div>
   <p class="ap-note">${ic('info')}<span>La curva de tallas es por color: 10 S, 20 M, 20 L y 10 XL en 2 colores son 120 piezas.</span></p>`;}
 function quoteCard(d,p,r,ch,qty){const on=ch?.id===r.id,att=`data-drop="${e(d.id)}" data-piece="${e(p.id)}" data-quote="${e(r.id)}"`;
  return `<li class="ap-quote${on?' is-on':''}${r.meets?'':' is-below'}"><div class="ap-q-main"><strong>${e(r.supplier)}</strong><div class="ap-badges">${r.cheapest?badge('Más barata','badge-dollar-sign','cheap'):''}${r.fastest?badge('Más rápida','zap','fast'):''}${r.best&&!r.cheapest&&qty?badge('Mejor total','trophy','best'):''}${on?badge(ch.auto?'En uso':'Elegida','circle-check','on'):''}</div>${r.notes?`<p class="ap-q-notes">${e(r.notes)}</p>`:''}</div>
   <dl class="ap-q-nums"><div><dt>Por pieza</dt><dd>${money(r.unit_cents)}</dd></div><div><dt>Mínimo</dt><dd>${r.min_qty?nf(r.min_qty):'—'}</dd></div><div><dt>Entrega</dt><dd>${r.lead_days==null?'—':r.lead_days+' '+plural(r.lead_days,'día','días')}</dd></div><div><dt>${qty?`Total · ${nf(r.order_qty)} pzas`:'Total'}</dt><dd>${qty?money(r.total_cents):'—'}</dd></div></dl>
   ${!r.meets&&qty?`<p class="ap-warn">${ic('triangle-alert')}<span>Pide mínimo ${nf(r.min_qty)}: serían ${nf(r.extra_units)} ${plural(r.extra_units,'pieza','piezas')} de más (${money(r.effective_cents)} por pieza planeada).</span></p>`:''}
   <div class="ap-q-actions">${on&&!ch.auto?'':`<button type="button" class="button small${on?'':' primary'}" data-ap="quote-pick" ${att}>${ic('check')}${on?'Fijar':'Elegir'}</button>`}<button type="button" class="button small" data-ap="quote-edit" ${att}>${ic('pencil')}Editar</button><button type="button" class="ap-icon" data-ap="quote-del" ${att} aria-label="Quitar la cotización de ${e(r.supplier)}">${ic('trash-2')}</button></div></li>`;}
 function quotesView(d){const pl=normalizePlus(d.plus),p=selPiece(pl);if(!p)return noPieces(d);
  const qty=planTotals([p]).units,qs=quoteSummary(p.quotes,qty),ch=chosenQuote(p,qs),cheap=qs.rows.find(r=>r.cheapest),fast=qs.rows.find(r=>r.fastest),best=qs.rows.find(r=>r.best),rows=qs.rows.slice().sort((a,b)=>(b.meets-a.meets)||a.unit_cents-b.unit_cents);
  const tabs=pl.pieces.length>1?`<div class="ap-chips" role="group" aria-label="Pieza a cotizar">${pl.pieces.map(x=>`<button type="button" class="ap-chip" data-ap="piece-sel" data-piece="${e(x.id)}" aria-pressed="${x.id===p.id}">${e(x.name)}</button>`).join('')}</div>`:'';
  return `${tabs}<div class="ap-q-head"><p><strong>${e(p.name)}</strong> · ${qty?`${nf(qty)} piezas planeadas`:'sin cantidades: llena la curva de tallas para comparar totales'}</p><button type="button" class="button small primary" data-ap="quote-add" data-drop="${e(d.id)}" data-piece="${e(p.id)}">${ic('plus')}Cotización</button></div>
   ${qs.rows.length?`<div class="ap-q-sum">${cheap?`<span>${ic('badge-dollar-sign')}Más barata: <b>${e(cheap.supplier)}</b> ${money(cheap.unit_cents)}/pza</span>`:''}${fast?`<span>${ic('zap')}Más rápida: <b>${e(fast.supplier)}</b> ${fast.lead_days} ${plural(fast.lead_days,'día','días')}</span>`:''}${qty&&!qs.eligible?`<span class="warn">${ic('triangle-alert')}Ninguna acepta ${nf(qty)} piezas: revisa los mínimos.</span>`:''}${qty&&best&&!best.cheapest?`<span>${ic('trophy')}Mejor total: <b>${e(best.supplier)}</b> ${money(best.total_cents)} pidiendo ${nf(best.order_qty)}</span>`:''}</div>
    <ul class="ap-quotes">${rows.map(r=>quoteCard(d,p,r,ch,qty)).join('')}</ul>`:`<div class="ap-empty">${ic('scale')}<div><strong>Sin cotizaciones</strong><p>Agrega al menos dos proveedores: costo por pieza, mínimo de piezas y días de entrega.</p></div></div>`}`;}
 function marginRow(d,r){const p=r.piece,m=r.m,ch=r.chosen,costPct=p.price_cents?Math.min(100,Math.round(m.cost_cents/p.price_cents*100)):100;
  return `<li class="ap-mrow"><div class="ap-mrow-top"><h3>${e(p.name)}</h3><button type="button" class="button small" data-ap="piece-edit" data-drop="${e(d.id)}" data-piece="${e(p.id)}">${ic('pencil')}Precio y extras</button></div>
   ${ch?'':`<p class="ap-warn">${ic('triangle-alert')}<span>Sin cotización: el costo solo incluye los extras.</span></p>`}${p.price_cents?'':`<p class="ap-warn">${ic('triangle-alert')}<span>Sin precio de venta: no hay margen que calcular.</span></p>`}
   <div class="ap-split" role="img" aria-label="${p.price_cents?`Costo ${money(m.cost_cents)} de un precio de ${money(p.price_cents)}`:'Sin precio de venta'}">${p.price_cents?`<i class="cost${m.profit_cents<0?' loss':''}" style="--w:${costPct}"></i>${m.profit_cents>0?`<i class="gain" style="--w:${100-costPct}"></i>`:''}`:''}</div>
   <dl class="ap-break"><div><dt>Proveedor${ch?' · '+e(ch.supplier):''}</dt><dd>${money(m.unit_cents)}</dd></div>${EXTRAS.map(([k,l])=>p.extras[k]?`<div><dt>${l}</dt><dd>${money(p.extras[k])}</dd></div>`:'').join('')}<div class="tot"><dt>Costo por pieza</dt><dd>${money(m.cost_cents)}</dd></div><div class="tot"><dt>Precio</dt><dd>${p.price_cents?money(p.price_cents):'—'}</dd></div></dl>
   <dl class="ap-kpis ap-kpis-4 sm"><div><dt>Por pieza</dt><dd class="${m.profit_cents<0?'neg':''}">${money(m.profit_cents)}</dd><small>utilidad</small></div><div><dt>Margen</dt><dd class="${m.margin_pct<0?'neg':''}">${m.margin_pct==null?'—':m.margin_pct+' %'}</dd></div><div><dt>${nf(m.units)} piezas</dt><dd class="${m.drop_profit_cents<0?'neg':''}">${money(m.drop_profit_cents)}</dd><small>si vendes todo</small></div><div><dt>Para recuperar</dt><dd>${m.break_even_units==null?'—':nf(m.break_even_units)}</dd><small>${m.break_even_units==null?'define el precio':m.recovers?`de ${nf(m.units)} piezas`:`no alcanza con ${nf(m.units)}`}</small></div></dl></li>`;}
 function marginView(d){const pl=normalizePlus(d.plus);if(!pl.pieces.length)return noPieces(d);const eco=dropEconomics(pl),rp=eco.recover_pct;
  return `<dl class="ap-kpis ap-kpis-4"><div><dt>Inversión</dt><dd>${money(eco.investment_cents)}</dd><small>${nf(eco.units)} piezas${eco.fixed_cents?' + fijos':''}</small></div><div><dt>Si vendes todo</dt><dd>${money(eco.revenue_cents)}</dd></div><div><dt>Utilidad del drop</dt><dd class="${eco.profit_cents<0?'neg':''}">${money(eco.profit_cents)}</dd><small>${eco.margin_pct==null?'—':eco.margin_pct+' % de margen'}</small></div><div><dt>Recuperas lo invertido</dt><dd>${rp==null?'—':rp>100?'No':'al '+rp+' %'}</dd><small>${rp==null?'define precios':rp>100?'ni vendiendo todo':'de lo que puedes vender'}</small></div></dl>
   <div class="ap-fixed"><span>${ic('receipt')}Gastos fijos del drop (muestras, fotos, diseño): <b>${money(eco.fixed_cents)}</b></span><button type="button" class="button small" data-ap="fixed" data-drop="${e(d.id)}">${ic('pencil')}Editar</button></div>
   <div class="ap-split-key" aria-hidden="true"><span><i class="cost"></i>Costo</span><span><i class="gain"></i>Utilidad</span><span><i class="loss"></i>Pérdida</span></div>
   <ul class="ap-margins">${eco.rows.map(r=>marginRow(d,r)).join('')}</ul>
   <p class="ap-note">${ic('info')}<span>Supone que pagas por adelantado todas las piezas del pedido (con su mínimo) y sus extras. Margen = utilidad ÷ precio.</span></p>`;}
 function stockView(d){const inv=inventory(Store.list('alventoProducts').filter(p=>p.drop_id===d.id),Store.list('alventoSales'),{low:lowStock()}),units=planTotals(normalizePlus(d.plus).pieces).units;
  if(!inv.rows.length)return `<div class="ap-empty">${ic('boxes')}<div><strong>Este drop aún no tiene SKUs</strong><p>${units?`Tu plan suma ${nf(units)} piezas: crea sus SKUs (pieza × color × talla) y aquí verás el stock por talla.`:'Planea piezas y tallas, o agrega un SKU a mano.'}</p></div></div><div class="ap-bar-actions">${units?`<button type="button" class="button primary" data-ap="skus" data-drop="${e(d.id)}">${ic('package-plus')}Crear SKUs desde el plan</button>`:''}<button type="button" class="button" data-action="v2-edit" data-collection="alventoProducts" data-parent="${e(d.id)}">${ic('plus')}SKU manual</button></div>`;
  const maxS=Math.max(1,...inv.perSize.map(z=>z.initial));
  return `<div class="ap-stock-head"><dl class="ap-kpis"><div><dt>Stock inicial</dt><dd>${nf(inv.initial)}</dd></div><div><dt>Vendidas</dt><dd>${nf(inv.sold)}</dd></div><div><dt>Quedan</dt><dd>${nf(inv.remaining)}</dd></div></dl>
    <label class="ap-low">${ic('bell')}<span>Avisar con</span><input class="input" type="number" min="0" max="999" step="1" inputmode="numeric" value="${inv.threshold}" data-ap="low" aria-label="Avisar de stock bajo cuando queden esta cantidad o menos"><span>o menos</span></label></div>
   ${inv.low||inv.out?`<p class="ap-alert">${ic('triangle-alert')}<span>${inv.out?`${inv.out} ${plural(inv.out,'talla agotada','tallas agotadas')}`:''}${inv.out&&inv.low?' · ':''}${inv.low?`${inv.low} con stock bajo (${inv.threshold} o menos)`:''}</span></p>`:''}
   <div class="ap-sizes ap-sizes-inv" role="list" aria-label="Quedan por talla">${inv.perSize.map(z=>`<div class="ap-size" role="listitem"><b>${e(z.size)}</b><i style="--w:${Math.round(Math.max(0,z.remaining)/maxS*100)}" aria-hidden="true"></i><span>${nf(z.remaining)}<small>/${nf(z.initial)}</small></span></div>`).join('')}</div>
   <ul class="ap-inv">${inv.rows.map(r=>`<li class="ap-inv-row"><div class="ap-inv-name"><strong>${e(r.title)}</strong>${r.color?`<span class="ap-color">${dot(r.color)}${e(r.color)}</span>`:''}<small>${nf(r.remaining)} de ${nf(r.initial)} · ${nf(r.sold)} ${plural(r.sold,'vendida','vendidas')}</small></div>
    <div class="ap-cells">${r.cells.map(c=>`<button type="button" class="ap-cell${c.out?' is-out':c.low?' is-low':''}" data-action="v2-sale" data-id="${e(c.product_id)}"${c.remaining>0?'':' disabled'} aria-label="${e(r.title)}${r.color?' '+e(r.color):''}, talla ${e(c.size)}: quedan ${c.remaining} de ${c.initial}${c.remaining>0?'. Registrar venta':'. Agotado'}"><b>${e(c.size)}</b><span>${nf(c.remaining)}<small>/${nf(c.initial)}</small></span><i style="--w:${c.initial?Math.round(Math.max(0,c.remaining)/c.initial*100):0}" aria-hidden="true"></i><em>${c.out?ic('ban')+'Agotado':c.low?ic('triangle-alert')+'Bajo':ic('badge-dollar-sign')+'Vender'}</em></button>`).join('')}</div></li>`).join('')}</ul>
   <p class="ap-note">${ic('info')}<span>Vendidas = ventas registradas (las revertidas no cuentan). «Vender» abre el registro de venta de siempre: descuenta stock y crea el ingreso en Finanzas.</span></p>`;}
 function body(d){return S.tab==='quotes'?quotesView(d):S.tab==='margin'?marginView(d):S.tab==='stock'?stockView(d):planView(d);}
 /** The whole panel. opts.tab picks a tab (plan · quotes · margin · stock). */
 function panel(opts={}){if(TABS.some(t=>t[0]===opts.tab))S.tab=opts.tab;const fixed=!!window.UI?.id,list=allDrops(),d=current();
  const pick=!fixed&&list.length?`<label class="ap-select"><span>Drop</span><select class="select" data-ap="pick">${list.map(x=>`<option value="${e(x.id)}"${x.id===d?.id?' selected':''}>${e(x.title)}${x.launch_at?' · '+e(fmtDate(x.launch_at)):''}</option>`).join('')}</select></label>`:'';
  const head=`<header class="ap-head"><div><span class="ap-eyebrow">ESTUDIO DEL DROP</span><h2 id="ap-title">${fixed?'Plan, costos e inventario':'Planea tu próximo drop'}</h2><p class="ap-sub">Piezas y tallas, cotizaciones, margen e inventario por talla, con tus números.</p></div>${fixed?'':`<div class="ap-pick">${pick}<button type="button" class="button${list.length?'':' primary'}" data-ap="new-drop">${ic('plus')}Planear nuevo drop</button></div>`}</header>`;
  if(!d)return `<section class="panel ap v8-card" id="ap-panel" aria-labelledby="ap-title">${head}<div class="ap-empty">${ic('shirt')}<div><strong>Tu próximo drop empieza con un plan</strong><p>Ponle nombre y fecha; después agrega piezas, colores y la curva de tallas.</p></div></div></section>`;
  return `<section class="panel ap v8-card" id="ap-panel" aria-labelledby="ap-title" data-drop="${e(d.id)}">${head}
   <div class="ap-tabs" role="tablist" aria-label="Estudio del drop">${TABS.map(([k,l,i])=>`<button type="button" role="tab" id="ap-tab-${k}" data-ap="tab" data-tab="${k}" aria-selected="${S.tab===k}" aria-controls="ap-body" tabindex="${S.tab===k?0:-1}">${ic(i)}<span>${l}</span></button>`).join('')}</div>
   <div class="ap-body" id="ap-body" role="tabpanel" aria-labelledby="ap-tab-${S.tab}">${body(d)}</div></section>`;}
 /** Re-render only the tab body (keeps the drop picker and the page scroll). */
 function refresh(focusTab){const box=document.getElementById('ap-panel'),bd=document.getElementById('ap-body'),d=current();if(!box||!bd||!d){App.render();return;}box.dataset.drop=d.id;
  box.querySelectorAll('[data-ap="tab"]').forEach(t=>{const on=t.dataset.tab===S.tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;if(on&&focusTab)t.focus();});
  bd.setAttribute('aria-labelledby','ap-tab-'+S.tab);bd.innerHTML=body(d);try{window.lucide?.createIcons?.({root:bd});}catch{}}

 /* ---------------- dialogs ---------------- */
 const field=(name,label,value='',type='text',extra='')=>`<label class="ch-field"><span>${label}</span><input class="input" name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
 function form(title,html,onSubmit,after){App.openDialog(title,`<form id="ap-form" class="ch-form ap-form">${html}<p class="ap-error" role="alert" hidden></p><div class="form-footer"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary">${ic('check')}Guardar</button></div></form>`);
  const f=document.getElementById('ap-form');if(!f)return null;f.onsubmit=ev=>{ev.preventDefault();try{onSubmit(Object.fromEntries(new FormData(f)),f);App.closeDialog(true);App.render();after?.();}catch(err){const p=f.querySelector('.ap-error');p.hidden=false;p.textContent=err.message||'Revisa los datos.';}};return f;}
 const chipsHTML=list=>list.length?list.map((c,i)=>`<span class="ap-color is-edit">${dot(c)}${e(c)}<button type="button" class="ap-x" data-ap="color-del" data-i="${i}" aria-label="Quitar ${e(c)}">${ic('x')}</button></span>`).join(''):'<span class="ap-muted">Sin colores todavía.</span>';
 function colorsGet(){try{const v=JSON.parse(document.getElementById('ap-colors')?.value||'[]');return Array.isArray(v)?v.map(x=>txt(x,24)).filter(Boolean):[];}catch{return [];}}
 function colorsSet(list){const h=document.getElementById('ap-colors'),box=document.getElementById('ap-chiplist');if(!h||!box)return;h.value=JSON.stringify(list);box.innerHTML=chipsHTML(list);try{window.lucide?.createIcons?.({root:box});}catch{}preview();}
 function addColor(){const inp=document.getElementById('ap-color-in');if(!inp)return;const v=txt(inp.value.replace(/,/g,' '),24);if(!v)return;const list=colorsGet();
  if(!list.some(c=>c.toLowerCase()===v.toLowerCase())){if(list.length>=12){App.toast('Máximo 12 colores por pieza.','error');return;}list.push(v);colorsSet(list);}inp.value='';inp.focus();}
 function preview(){const f=document.getElementById('ap-form'),out=document.getElementById('ap-preview');if(!f||!out)return;const curve=SIZES.reduce((a,s)=>a+int(f.elements['size_'+s]?.value),0),n=Math.max(1,colorsGet().length);
  out.textContent=curve?`= ${nf(curve*n)} piezas (${nf(curve)} por color × ${n} ${plural(n,'color','colores')})`:'Escribe cuántas piezas van por talla.';}
 function pieceDialog(dropId,pieceId){const d=dropOf(dropId);if(!d)throw Error('No encontré ese drop.');const cur=normalizePlus(d.plus).pieces.find(p=>p.id===pieceId)||null,p=cur||normPiece({name:'·'},0);
  const f=form(cur?'Editar '+cur.name:'Nueva pieza',field('name','Pieza',cur?.name||'','text','required maxlength="40" placeholder="Ej. Hoodie, playera, pants" autocomplete="off"')+
   `<div class="ch-field ap-chipedit"><span id="ap-colors-l">Colores</span><div class="ap-chiplist" id="ap-chiplist" role="group" aria-labelledby="ap-colors-l">${chipsHTML(p.colors)}</div><div class="ap-chipadd"><input class="input" id="ap-color-in" maxlength="24" placeholder="Ej. Negro" autocomplete="off" aria-label="Nuevo color"><button type="button" class="button small" data-ap="color-add">${ic('plus')}Agregar</button></div><input type="hidden" name="colors" id="ap-colors" value="${e(JSON.stringify(p.colors))}"></div>`+
   `<fieldset class="ap-curve-in"><legend>Curva de tallas (piezas por color)</legend>${SIZES.map(s=>`<label><span>${s}</span><input class="input" name="size_${s}" type="number" min="0" max="99999" step="1" inputmode="numeric" value="${p.sizes[s]||''}" placeholder="0"></label>`).join('')}</fieldset><p class="ap-preview" id="ap-preview" aria-live="polite"></p>`+
   field('price','Precio de venta por pieza ($)',pesos(p.price_cents),'text','inputmode="decimal" placeholder="0.00" autocomplete="off"')+
   `<fieldset class="ap-extras"><legend>Extras por pieza ($)</legend>${EXTRAS.map(([k,l])=>field('x_'+k,l,pesos(p.extras[k]),'text','inputmode="decimal" placeholder="0.00" autocomplete="off"')).join('')}</fieldset>`,
   data=>{const name=txt(data.name,40);if(!name)throw Error('Ponle nombre a la pieza.');let colors=[];try{colors=JSON.parse(data.colors||'[]');}catch{}const pending=txt(document.getElementById('ap-color-in')?.value,24);if(pending)colors.push(pending);
    const next={name,colors,sizes:Object.fromEntries(SIZES.map(s=>[s,int(data['size_'+s],0,99999)])),price_cents:cents(data.price),extras:Object.fromEntries(EXTRAS.map(([k])=>[k,cents(data['x_'+k])]))};
    savePlan(dropId,pl=>{const x=pl.pieces.find(y=>y.id===pieceId);if(x){Object.assign(x,next);return;}if(pl.pieces.length>=30)throw Error('Máximo 30 piezas por drop.');pl.pieces.push({id:uid(),quotes:[],quote_id:null,...next});});
    App.toast(cur?'Pieza actualizada.':'Pieza agregada al plan.','success');});
  if(!f)return;f.addEventListener('input',preview);document.getElementById('ap-color-in')?.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===','){ev.preventDefault();addColor();}});preview();}
 function quoteDialog(dropId,pieceId,quoteId){const p=planOf(dropId).pieces.find(x=>x.id===pieceId);if(!p)throw Error('No encontré esa pieza.');const q=p.quotes.find(x=>x.id===quoteId)||null;
  form(q?'Editar cotización':'Cotización · '+p.name,field('supplier','Proveedor',q?.supplier||'','text','required maxlength="60" placeholder="Taller o proveedor" autocomplete="off"')+
   `<div class="ap-row">${field('unit','Costo por pieza ($)',pesos(q?.unit_cents),'text','required inputmode="decimal" placeholder="0.00" autocomplete="off"')}${field('min','Mínimo de piezas',q?.min_qty||'','number','min="0" max="1000000" step="1" inputmode="numeric" placeholder="0"')}</div>`+
   field('lead','Días de entrega',q?.lead_days??'','number','min="0" max="3650" step="1" inputmode="numeric" placeholder="—"')+`<label class="ch-field"><span>Notas</span><textarea class="input" name="notes" rows="2" maxlength="200" placeholder="Tela, gramaje, anticipo, muestras…">${e(q?.notes||'')}</textarea></label>`,
   data=>{const supplier=txt(data.supplier,60),unit=cents(data.unit);if(!supplier)throw Error('Escribe el proveedor.');if(!(unit>0))throw Error('Escribe el costo por pieza.');
    const next={supplier,unit_cents:unit,min_qty:int(data.min,0,1e6),lead_days:String(data.lead??'').trim()===''?null:int(data.lead,0,3650),notes:txt(data.notes,200)};
    savePlan(dropId,pl=>{const x=pl.pieces.find(y=>y.id===pieceId);if(!x)throw Error('No encontré esa pieza.');const y=x.quotes.find(z=>z.id===quoteId);if(y){Object.assign(y,next);return;}if(x.quotes.length>=12)throw Error('Máximo 12 cotizaciones por pieza.');x.quotes.push({id:uid(),...next});});
    S.piece=pieceId;S.tab='quotes';App.toast(q?'Cotización actualizada.':'Cotización agregada.','success');});}
 function newDropDialog(){form('Planear nuevo drop',field('title','Nombre del drop','','text','required maxlength="80" placeholder="Ej. Drop 03 · Invierno" autocomplete="off"')+field('launch','Fecha de lanzamiento (opcional)','','date',`min="${today()}"`)+'<p class="ap-muted">Se crea en tus drops con estado «planeación». Después agregas piezas, colores y tallas.</p>',
  data=>{const title=txt(data.title,80);if(!title)throw Error('Ponle nombre al drop.');const launch=/^\d{4}-\d{2}-\d{2}$/.test(data.launch||'')?data.launch:null,seq=Store.list('alventoDrops').reduce((a,x)=>Math.max(a,int(x.sequence)),0)+1;
   const r=Store.record(Records.normalize('alventoDrops',{title,status:'planning',launch_at:launch,sequence:seq,plus:normalizePlus({})}));Store.save(s=>{s.alventoDrops.push(structuredClone(r));});Object.assign(S,{drop:r.id,tab:'plan',piece:null});App.toast('Drop creado. Agrega su primera pieza.','success');},
  ()=>{const id=S.drop;setTimeout(()=>{try{pieceDialog(id);}catch{}},60);});}
 function fixedDialog(dropId){const pl=planOf(dropId);form('Gastos fijos del drop','<p class="ap-muted">Lo que pagas una vez por el drop: muestras, sesión de fotos, diseño, publicidad del lanzamiento.</p>'+field('fixed','Total ($)',pesos(pl.fixed_cents),'text','inputmode="decimal" placeholder="0.00" autocomplete="off"'),data=>{const c=cents(data.fixed);savePlan(dropId,p=>{p.fixed_cents=c;});S.tab='margin';});}
 function createSkus(dropId){const d=dropOf(dropId);if(!d)return;const list=skuPlan(d,Store.list('alventoProducts'));if(!list.length){App.toast('Los SKUs de este plan ya existen.','success');S.tab='stock';refresh();return;}
  const units=list.reduce((a,x)=>a+x.initial_stock,0),noPrice=new Set(list.filter(x=>!x.unit_price).map(x=>x.title)).size;
  App.confirmAction('Crear SKUs del plan',`Se crearán ${list.length} SKUs (pieza × color × talla) con ${units} piezas de stock inicial, su precio y su costo por pieza. Los que ya existen no se duplican.${noPrice?` ${noPrice} ${plural(noPrice,'pieza no tiene','piezas no tienen')} precio: quedará en $0 hasta que lo edites.`:''}`,
   ()=>{Store.save(s=>{for(const p of list)s.alventoProducts.push(Store.record(Records.normalize('alventoProducts',p)));});S.tab='stock';App.toast(`${list.length} SKUs creados en el inventario.`,'success');},'Crear SKUs');}

 /* ---------------- events + lifecycle ---------------- */
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-ap]');if(!b||b.matches('select,input'))return;const a=b.dataset.ap,id=b.dataset.drop,pc=b.dataset.piece,q=b.dataset.quote;
  try{
   if(a==='tab'){S.tab=b.dataset.tab;refresh();}
   else if(a==='piece-sel'){S.piece=pc;refresh();}
   else if(a==='piece-quotes'){S.piece=pc;S.tab='quotes';refresh();}
   else if(a==='new-drop')newDropDialog();
   else if(a==='piece-add')pieceDialog(id);
   else if(a==='piece-edit')pieceDialog(id,pc);
   else if(a==='piece-del'){const p=planOf(id).pieces.find(x=>x.id===pc);if(p)App.confirmAction('Quitar '+p.name,'Se quita del plan con sus cotizaciones. Los SKUs que ya creaste en el inventario no se borran.',()=>savePlan(id,pl=>{pl.pieces=pl.pieces.filter(x=>x.id!==pc);}),'Quitar');}
   else if(a==='quote-add')quoteDialog(id,pc);
   else if(a==='quote-edit')quoteDialog(id,pc,q);
   else if(a==='quote-del')App.confirmAction('Quitar cotización','Se quita del comparador de esta pieza.',()=>savePlan(id,pl=>{const x=pl.pieces.find(y=>y.id===pc);if(x){x.quotes=x.quotes.filter(z=>z.id!==q);if(x.quote_id===q)x.quote_id=null;}}),'Quitar');
   else if(a==='quote-pick'){savePlan(id,pl=>{const x=pl.pieces.find(y=>y.id===pc);if(x)x.quote_id=q;});refresh();App.toast('Cotización elegida: el margen ya la usa.','success');}
   else if(a==='fixed')fixedDialog(id);
   else if(a==='skus')createSkus(id);
   else if(a==='color-add')addColor();
   else if(a==='color-del'){const list=colorsGet();list.splice(Number(b.dataset.i),1);colorsSet(list);document.getElementById('ap-color-in')?.focus();}
  }catch(err){App.toast(err.message||'No se pudo completar.','error');}});
 document.addEventListener('change',ev=>{const t=ev.target;if(!t?.matches)return;
  if(t.matches('[data-ap="pick"]')){S.drop=t.value;S.piece=null;refresh();}
  else if(t.matches('[data-ap="low"]')){const v=int(t.value,0,9999);try{Store.save(s=>{s.preferences.alventoPlus={...(s.preferences.alventoPlus||{}),low_stock:v};});}catch(err){App.toast(err.message||'No se pudo guardar.','error');}refresh();}});
 document.addEventListener('keydown',ev=>{const t=ev.target.closest?.('[data-ap="tab"]');if(!t||!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();
  const keys=TABS.map(x=>x[0]),i=keys.indexOf(S.tab);S.tab=keys[ev.key==='Home'?0:ev.key==='End'?keys.length-1:(i+(ev.key==='ArrowRight'?1:-1)+keys.length)%keys.length];refresh(true);});
 function listAnchor(main){const grid=main.querySelector('.cards-grid');if(!grid)return main.querySelector('.alvento-editorial')||main.querySelector('.page-heading');const next=grid.nextElementSibling;return next?.matches?.('section.panel')&&next.querySelector?.('.empty-state')?next:grid;}
 let lastKey='';
 /** #alvento → after the drops grid; #alvento/<id> → after the drop's stats row. No-op elsewhere; idempotent by id. */
 function afterRender(){const sec=window.UI?.section,key=sec+'/'+(window.UI?.id||'');
  try{if(sec!=='alvento'||!Store.get())return;const main=document.getElementById('main-content');if(!main||main.querySelector('#ap-panel'))return;if(UI.id&&!dropOf(UI.id))return;
   const anchor=UI.id?(main.querySelector('.numeric-stats')||main.querySelector('.alvento-editorial')||main.querySelector('.page-heading')):listAnchor(main);if(!anchor)return;
   anchor.insertAdjacentHTML('afterend',panel());const box=main.querySelector('#ap-panel');try{window.lucide?.createIcons?.({root:box||main});}catch{}
   if(box&&lastKey!==key&&window.Motion?.animate&&!reduced()){try{Motion.animate([...box.querySelectorAll('.ap-head,.ap-tabs,.ap-body>*')].slice(0,12),{opacity:[0,1],y:[12,0]},{type:'spring',stiffness:260,damping:26,delay:Motion.stagger?.(.035)||0});}catch{}}
  }finally{lastKey=key;}}
 return Object.freeze({afterRender,panel,planOf,savePlan,normalizePlus,planTotals,quoteSummary,chosenQuote,margin,dropEconomics,inventory,skuPlan,SIZES});
})();
