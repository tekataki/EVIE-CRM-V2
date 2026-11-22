'use strict';
// v10 · ALVENTO+ (plan de drop, comparador de cotizaciones, costo y margen, inventario por talla) and the Granja simulator
// «antes de comprar» (timeline, break-even, minimum buffer, SOMA coverage). Browser modules run in a vm with stubs (pattern of
// tests/mission-weekly.test.cjs) plus the REAL V2Domain and Records, so every save is validated like in the app.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const iso=d=>d.toISOString().slice(0,10);const add=(d,n)=>iso(new Date(Date.parse(d+'T12:00:00Z')+n*864e5));const J=x=>JSON.parse(JSON.stringify(x));
const MONTH=365.25/12,mo=d=>Math.floor(d/MONTH+1e-9);
/** vm values carry another realm's prototypes: compare their JSON shape. */
const same=(a,b,msg)=>assert.deepEqual(J(a),J(b),msg);
function browser(files,{state,today='2026-11-22',ui={}}={}){
 const ctx={console,Math,JSON,Intl,structuredClone,Number,String,Object,Array,Promise,Set,Map,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},crypto,Date,RegExp,Error,encodeURIComponent};ctx.window=ctx;vm.createContext(ctx);
 let n=0,saves=0;ctx.Store={get:()=>state,list:c=>(state[c]||[]).filter(x=>!x.deleted_at),save(fn){fn(state);ctx.V2Domain.validate(state);saves++;return state;},record:d=>({id:'r'+(++n),created_at:'2026-11-22T00:00:00Z',updated_at:'2026-11-22T00:00:00Z',...d}),saves:()=>saves};
 ctx.Domain={today:()=>today,money:c=>'$'+(c/100).toFixed(2),cents:s=>{if(!/^\d{1,10}(\.\d{1,2})?$/.test(String(s)))throw Error('Ingresa un monto válido.');return Math.round(Number(s)*100);},periodKey:(h,d)=>h+':'+d};
 ctx.Pig={roles:{sow:'Reproductora',piglet:'Lechón'},states:{open:'Vacía'},events:{note:'Nota'},collections:[],breeding:()=>true};ctx.RCData={collections:[],defaults:()=>({})};ctx.Recurrence={validate(){}};ctx.DALI_CONFIG={limits:{depth:18}};
 ctx.UI={section:'inicio',id:null,tab:{},...ui};ctx.App={toast(){},render(){},openDialog(){},closeDialog(){},confirmAction(t,x,fn){fn();}};ctx.Views={icon:()=>''};
 ctx.document={addEventListener(){},querySelector:()=>null,getElementById:()=>null,documentElement:{dataset:{}}};ctx.matchMedia=()=>({matches:true});ctx.addEventListener=()=>{};
 for(const f of ['v2-domain.js','records.js',...files])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx);return ctx;}
const V2=['gymSessions','gymRanks','importBatches','farmAnimals','farmEvents','farmLitters','farmHealthRecords','farmSettings','books','alventoDrops','alventoProducts','alventoSales','alventoMilestones','contentItems','visionItems','mediaMetadata'];
const base=()=>({version:4,preferences:{},goals:[],studySessions:[],skills:[],transactions:[],...Object.fromEntries(V2.map(c=>[c,[]]))});
/** Minimal #main-content: anchors by selector, records insertAdjacentHTML, answers #id lookups from what was inserted. */
function fakeMain(sels){const inserted=[],mk=sel=>({sel,nextElementSibling:null,matches:s=>s===sel,insertAdjacentHTML(pos,html){inserted.push({sel,pos,html});},querySelector:()=>null,querySelectorAll:()=>[]}),nodes=sels.map(mk);
 return {inserted,children:nodes,querySelector:s=>s.startsWith('#')?(inserted.some(x=>x.html.includes(`id="${s.slice(1)}"`))?{querySelectorAll:()=>[],querySelector:()=>null}:null):nodes.find(x=>x.sel===s)||null,querySelectorAll:()=>[]};}
const withMain=(ctx,main)=>{ctx.document.getElementById=id=>id==='main-content'?main:null;return main;};

/* ============================== ALVENTO+ ============================== */
test('alvento quotes: cheapest/fastest only among quotes that accept the quantity; minimums force extra units; best total; ties',()=>{
 const {AlventoPlus:A}=browser(['alvento-plus.js'],{state:base()});
 const Q=[{id:'a',supplier:'Taller A',unit_cents:15000,min_qty:50,lead_days:20},{id:'b',supplier:'Taller B',unit_cents:12000,min_qty:100,lead_days:30},{id:'c',supplier:'Taller C',unit_cents:16000,min_qty:0,lead_days:7}];
 let s=A.quoteSummary(Q,60);assert.equal(s.cheapest,'a','B is cheaper per unit but its minimum (100) is above 60');assert.equal(s.fastest,'c');assert.equal(s.eligible,2);
 const b=s.rows.find(r=>r.id==='b');assert.equal(b.meets,false);assert.equal(b.order_qty,100);assert.equal(b.extra_units,40);assert.equal(b.total_cents,1200000);assert.equal(b.effective_cents,20000);
 assert.equal(s.rows.find(r=>r.id==='a').total_cents,900000);assert.equal(s.rows.find(r=>r.id==='c').total_cents,960000);assert.equal(s.best,'a');
 s=A.quoteSummary(Q,90);assert.equal(s.cheapest,'a');assert.equal(s.best,'b','ordering B\'s minimum (100 × $120) beats 90 × $150');assert.equal(s.rows.find(r=>r.id==='b').total_cents,1200000);
 s=A.quoteSummary(Q,100);assert.equal(s.cheapest,'b','at 100 pieces B qualifies');assert.equal(s.fastest,'c');assert.equal(s.best,'b');
 s=A.quoteSummary(Q,0);assert.equal(s.cheapest,'b','no quantity yet: minimums are ignored');assert.equal(s.best,null);assert.ok(s.rows.every(r=>r.total_cents===0));
 s=A.quoteSummary([{id:'x',supplier:'X',unit_cents:10000,min_qty:0,lead_days:15},{id:'y',supplier:'Y',unit_cents:10000,min_qty:0,lead_days:5},{id:'z',supplier:'Z',unit_cents:0,min_qty:0,lead_days:1}],10);
 assert.equal(s.cheapest,'y','same unit cost → the faster one');assert.equal(s.fastest,'y');assert.equal(s.rows.length,2,'quotes without a unit cost do not compete');
 s=A.quoteSummary([{id:'p',supplier:'P',unit_cents:9000,min_qty:500,lead_days:3}],20);assert.equal(s.cheapest,null);assert.equal(s.fastest,null);assert.equal(s.eligible,0);assert.equal(s.best,'p');
 const ch=A.chosenQuote({quote_id:null},A.quoteSummary(Q,60));assert.equal(ch.id,'a');assert.equal(ch.auto,true);assert.equal(A.chosenQuote({quote_id:'c'},A.quoteSummary(Q,60)).auto,false);});

test('alvento margin: unit cost = quote + extras, margin %, profit per piece and per drop, break-even units',()=>{
 const {AlventoPlus:A}=browser(['alvento-plus.js'],{state:base()});
 let m=A.margin({unit_cents:15000,extras:{labels:500,pack:1500,ship:2000,other:0},price_cents:45000,units:60,fixed_cents:300000});
 assert.equal(m.cost_cents,19000);assert.equal(m.profit_cents,26000);assert.equal(m.margin_pct,57.8);assert.equal(m.investment_cents,1440000);assert.equal(m.revenue_cents,2700000);assert.equal(m.drop_profit_cents,1260000);
 assert.equal(m.break_even_units,32,'⌈$14,400 ÷ $450⌉');assert.equal(m.recovers,true);
 m=A.margin({unit_cents:15000,extras:[500,1500,2000],price_cents:18000,units:60});assert.equal(m.cost_cents,19000);assert.equal(m.profit_cents,-1000);assert.equal(m.margin_pct,-5.6);
 assert.equal(m.break_even_units,64);assert.equal(m.recovers,false,'selling at a loss never recovers the order');assert.equal(m.drop_profit_cents,-60000);
 m=A.margin({unit_cents:15000,price_cents:0,units:10});assert.equal(m.margin_pct,null);assert.equal(m.break_even_units,null);assert.equal(m.recovers,false);
 // whole drop: orders respect minimums, fixed costs once
 const eco=A.dropEconomics({fixed_cents:100000,pieces:[{id:'h',name:'Hoodie',colors:['Negro'],sizes:{S:5,M:10,L:10,XL:5},price_cents:60000,extras:{labels:1000},quotes:[{id:'q1',supplier:'T',unit_cents:20000,min_qty:50,lead_days:10}]}]});
 assert.equal(eco.rows[0].qty,30);assert.equal(eco.rows[0].chosen.id,'q1');assert.equal(eco.rows[0].m.units,50,'30 planned, minimum 50 → you pay for 50');
 assert.equal(eco.investment_cents,50*21000+100000);assert.equal(eco.revenue_cents,50*60000);assert.equal(eco.recover_pct,Math.round((50*21000+100000)/(50*60000)*1000)/10);});

test('alvento plan: units per size come from a per-color curve; totals per piece, per size and distinct colors',()=>{
 const {AlventoPlus:A}=browser(['alvento-plus.js'],{state:base()});
 const t=A.planTotals([{id:'h',name:'Hoodie',colors:['Negro','Arena'],sizes:{S:10,M:20,L:20,XL:10}},{id:'p',name:'Playera',colors:[],sizes:{S:5,M:5,L:5,XL:5}},{id:'k',name:'Pants',colors:['negro'],sizes:{S:0,M:4,L:4,XL:0}}]);
 assert.equal(t.pieces,3);assert.equal(t.units,120+20+8);same(J(t.perSize),{S:25,M:49,L:49,XL:25});assert.equal(t.colors,2,'«Negro» and «negro» are one color');
 same(J(t.rows.map(r=>[r.curve,r.colors,r.units])),[[60,2,120],[20,1,20],[8,1,8]]);
 const n=A.normalizePlus({pieces:[{name:'  Hoodie  ',colors:['Negro','negro',' '],sizes:{S:-3,M:'7',L:2.6},quotes:[{supplier:''},{id:'q',supplier:'T',unit_cents:'1500'}],quote_id:'nope'},{name:''},null],fixed_cents:-5});
 assert.equal(n.pieces.length,1);assert.equal(n.pieces[0].name,'Hoodie');same(n.pieces[0].colors,['Negro']);same(J(n.pieces[0].sizes),{S:0,M:7,L:3,XL:0});assert.equal(n.pieces[0].quotes.length,1);assert.equal(n.pieces[0].quote_id,null);assert.equal(n.fixed_cents,0);});

test('alvento inventory per size: initial − real sales (reverted excluded), size order, low/out flags, totals per size',()=>{
 const {AlventoPlus:A}=browser(['alvento-plus.js'],{state:base()});
 const P=[['p1','Hoodie','Negro','S',10],['p2','Hoodie','Negro','m',20],['p3','Hoodie','Negro','XL',10],['p4','Hoodie','Negro','L',20],['p5','Hoodie','Arena','M',5],['p6','Playera','','XXL',3]].map(([id,title,color,size,initial_stock])=>({id,title,color,size,initial_stock,sku:id,unit_price:45000,drop_id:'d1'}));
 const S=[{product_id:'p2',quantity:10},{product_id:'p2',quantity:8},{product_id:'p1',quantity:5,deleted_at:'2026-11-20T00:00:00Z'},{product_id:'p5',quantity:5},{product_id:'zz',quantity:9}];
 const inv=A.inventory(P,S,{low:3});
 same(inv.rows.map(r=>[r.title,r.color]),[['Hoodie','Arena'],['Hoodie','Negro'],['Playera','']]);
 const negro=inv.rows[1];same(negro.cells.map(c=>c.size),['S','M','L','XL'],'S, M, L, XL order (case-insensitive)');
 same(J(negro.cells.map(c=>[c.size,c.initial,c.sold,c.remaining,c.low,c.out])),[['S',10,0,10,false,false],['M',20,18,2,true,false],['L',20,0,20,false,false],['XL',10,0,10,false,false]]);
 assert.equal(inv.rows[0].cells[0].out,true,'Arena M sold out');assert.equal(inv.rows[2].cells[0].low,true,'3 left with threshold 3 is low');
 same(J(inv.perSize.map(z=>[z.size,z.initial,z.sold,z.remaining])),[['S',10,0,10],['M',25,23,2],['L',20,0,20],['XL',10,0,10],['XXL',3,0,3]]);
 assert.equal(inv.initial,68);assert.equal(inv.sold,23);assert.equal(inv.remaining,45);assert.equal(inv.low,2);assert.equal(inv.out,1);
 assert.equal(A.inventory(P,S,{low:0}).low,0,'threshold 0 disables the low warning');});

test('alvento storage: the plan lives on the drop record (extra field), passes real validation; SKUs from the plan, no duplicates',()=>{
 const st=base();st.alventoDrops.push({id:'d1',title:'Drop 02',sequence:2,status:'planning',launch_at:'2027-02-14',goal_units:0,goal_revenue:0,budget:0,notes:''});
 const c=browser(['alvento-plus.js'],{state:st}),A=c.AlventoPlus,keys=Object.keys(st).sort();
 A.savePlan('d1',p=>{p.pieces.push({id:'h1',name:'Hoodie',colors:['Negro','Arena'],sizes:{S:2,M:3,L:3,XL:0},price_cents:65000,extras:{labels:800,pack:1200},quotes:[{id:'q1',supplier:'Taller A',unit_cents:21000,min_qty:10,lead_days:15},{id:'q2',supplier:'Taller B',unit_cents:19000,min_qty:40,lead_days:25}]});p.fixed_cents=150000;});
 const d=st.alventoDrops[0];assert.equal(d.title,'Drop 02');assert.equal(d.launch_at,'2027-02-14');assert.equal(d.plus.pieces[0].name,'Hoodie');assert.equal(d.plus.fixed_cents,150000);
 same(Object.keys(st).sort(),keys,'no new collections or top-level keys');assert.equal(A.planOf('d1').pieces[0].quotes.length,2);
 // existing SKU (same piece/color/size) is skipped; codes are unique; cost = chosen quote (cheapest that accepts 16 pcs → A) + extras
 st.alventoProducts.push({id:'p0',drop_id:'d1',title:'Hoodie',sku:'D2-HOODIE-NEG-S',category:'',color:'Negro',size:'S',unit_price:65000,unit_cost:0,initial_stock:2,status:'active'});
 const plan=A.skuPlan(A.planOf('d1')&&st.alventoDrops[0],st.alventoProducts);
 assert.equal(plan.length,5,'2 colors × 3 sizes with quantity, minus the existing Negro S');assert.ok(plan.every(p=>p.drop_id==='d1'&&p.unit_price===65000&&p.unit_cost===21000+800+1200));
 same(plan.map(p=>p.sku),['D2-HOODIE-NEG-M','D2-HOODIE-NEG-L','D2-HOODIE-ARE-S','D2-HOODIE-ARE-M','D2-HOODIE-ARE-L']);same(plan.map(p=>p.initial_stock),[3,3,2,3,3]);
 c.Store.save(s=>{for(const p of plan)s.alventoProducts.push(c.Store.record(c.Records.normalize('alventoProducts',p)));});assert.equal(st.alventoProducts.length,6);
 assert.equal(A.skuPlan(st.alventoDrops[0],st.alventoProducts).length,0,'running it again creates nothing');
 assert.throws(()=>A.savePlan('missing',()=>{}),/No encontré ese drop/);});

test('alvento view: escaped user text on every tab, picker on the list, fixed drop on the detail; afterRender anchors and is idempotent',()=>{
 const st=base();st.alventoDrops.push({id:'d1',title:'<img src=x onerror=alert(1)>',sequence:1,status:'planning',launch_at:'2026-12-20',plus:{pieces:[{id:'h1',name:'<b>Hoodie</b>',colors:['<i>Negro</i>'],sizes:{S:1,M:2,L:2,XL:1},price_cents:50000,quotes:[{id:'q1',supplier:'<script>x</script>',unit_cents:20000,min_qty:0,lead_days:10,notes:'<u>tela</u>'}]}]}});
 st.alventoProducts.push({id:'p1',drop_id:'d1',title:'<b>Hoodie</b>',sku:'S1',color:'<i>Negro</i>',size:'M',unit_price:50000,unit_cost:20000,initial_stock:2,status:'active'});
 const c=browser(['alvento-plus.js'],{state:st,ui:{section:'alvento'}}),A=c.AlventoPlus;
 for(const tab of ['plan','quotes','margin','stock']){const html=A.panel({tab});assert.match(html,/id="ap-panel"/);assert.match(html,new RegExp(`aria-labelledby="ap-tab-${tab}"`));assert.match(html,/role="tablist"/);
  assert.ok(!/<img src=x|<b>Hoodie|<i>Negro|<script>x|<u>tela/.test(html),'escaped on '+tab);}
 assert.match(A.panel({tab:'plan'}),/data-ap="pick"/);assert.match(A.panel({tab:'plan'}),/faltan 28 días/);assert.match(A.panel({tab:'quotes'}),/Más barata/);assert.match(A.panel({tab:'stock'}),/data-action="v2-sale" data-id="p1"/);
 c.UI.id='d1';assert.ok(!/data-ap="pick"/.test(A.panel({tab:'plan'})),'no picker on the drop page');
 // anchors: list page → after the drops grid; detail → after the stats row; elsewhere → no-op; second call → nothing new
 c.UI.id=null;let main=withMain(c,fakeMain(['.page-heading','.cards-grid']));A.afterRender();A.afterRender();assert.equal(main.inserted.length,1);assert.equal(main.inserted[0].sel,'.cards-grid');assert.equal(main.inserted[0].pos,'afterend');
 c.UI.id='d1';main=withMain(c,fakeMain(['.page-heading','.numeric-stats']));A.afterRender();assert.equal(main.inserted[0].sel,'.numeric-stats');
 c.UI.id='missing';main=withMain(c,fakeMain(['.numeric-stats']));A.afterRender();assert.equal(main.inserted.length,0,'unknown drop: leave the not-found page alone');
 c.UI.section='finanzas';c.UI.id=null;main=withMain(c,fakeMain(['.cards-grid']));assert.equal(A.afterRender(),undefined);assert.equal(main.inserted.length,0);
 assert.ok(Object.isFrozen(A));for(const k of ['afterRender','panel','quoteSummary','margin','planTotals','inventory','skuPlan','dropEconomics','savePlan','planOf'])assert.equal(typeof A[k],'function',k);});

/* ============================== GRANJA ============================== */
const FARM={sows:2,sow_price_cents:500000,setup_cents:0,feed_sow_kg:2,feed_price_cents:1000,other_monthly_cents:50000,litter_size:10,mortality_pct:10,sale_mode:'weaner',weaner_price_cents:100000,months:12,buffer_cents:1200000,soma_cents:150000,start:'2026-12-01'};
test('granja sim (lechón al destete): births/sales months, monthly flow, break-even month, minimum buffer, SOMA coverage',()=>{
 const {GranjaSim:G}=browser(['granja-sim.js'],{state:base()});const r=G.simulate(FARM),s=r.summary;
 // biology: first service day 21, farrowing +114, weaning +28; cycle = max(114+28+6, 365/2.2) days
 assert.equal(s.cycle_days,165.9);assert.equal(s.cycle_min_days,148);assert.equal(s.born_per_batch,20);assert.equal(s.weaned_per_batch,18,'⌊2 × 10 × 90 %⌋');
 assert.equal(s.firstBirth,mo(21+114));assert.equal(s.firstBirth,4);assert.equal(s.firstSale,mo(21+114+28));assert.equal(s.firstSale,5);
 same(r.rows.filter(x=>x.born).map(x=>x.m),[4,mo(21+114+365/2.2)]);same(r.rows.filter(x=>x.sold).map(x=>[x.m,x.sold,x.sales_cents]),[[5,18,1800000],[10,18,1800000]]);
 same(r.rows.filter(x=>x.services).map(x=>x.m),[0,6,11]);assert.equal(r.rows[0].purchase_cents,1000000);same(r.rows[0].events.map(v=>v.type),['buy','service']);
 // feed: 2 sows × 2 kg × $10 per day; months of 365.25/12 days binned by day → 31 or 30 days
 same(r.rows.map(x=>x.feed_cents),[124000,120000,124000,120000,124000,120000,124000,120000,120000,124000,120000,124000]);assert.equal(s.totals.feed,366*4000);
 same(r.rows.map(x=>x.net_cents),[-1174000,-170000,-174000,-170000,-174000,1630000,-174000,-170000,-170000,-174000,1630000,-174000]);
 same(r.rows.map(x=>x.cum_cents),[-1174000,-1344000,-1518000,-1688000,-1862000,-232000,-406000,-576000,-746000,-920000,710000,536000]);
 assert.equal(s.breakEven,10,'from month 11 the accumulated result stays ≥ 0');assert.equal(s.finalCum,536000);
 assert.equal(s.minBufferNoSoma,1862000,'without SOMA you need the deepest accumulated deficit');
 // SOMA backs each month's deficit up to $1,500 (never banked): deficits ≥ 150k in 10 months
 assert.equal(s.somaUsed,1500000);same(r.rows.map(x=>x.soma_cents),[150000,150000,150000,150000,150000,0,150000,150000,150000,150000,0,150000]);assert.equal(s.minBuffer,1112000);
 assert.equal(s.bufferOk,true);assert.equal(s.runsOut,null);same(r.rows.slice(0,6).map(x=>x.cash_cents),[176000,156000,132000,112000,88000,1718000]);assert.equal(s.minCash,88000);assert.equal(s.minCashAt,4);
 assert.equal(s.soma.untilSale,5);assert.equal(s.soma.feedMax,124000);assert.equal(s.soma.coversFeed,true);assert.equal(s.soma.coversRunning,false);assert.equal(s.soma.gapRunning,24000);
 // a smaller buffer runs out in month 1; a smaller SOMA flow does not cover the feed
 const t=G.simulate({...FARM,buffer_cents:1000000}).summary;assert.equal(t.bufferOk,false);assert.equal(t.shortfall,112000);assert.equal(t.runsOut,0);
 const u=G.simulate({...FARM,soma_cents:100000}).summary;assert.equal(u.soma.coversFeed,false);assert.equal(u.soma.gapFeed,24000);
 assert.equal(u.minBuffer,1862000-5*100000,'the trough is month 5: by then SOMA paid $1,000 in each of 5 deficit months');
 assert.equal(s.minBuffer,1862000-5*150000,'same rule with $1,500');
 const v=G.simulate({...FARM,soma_cents:0}).summary;assert.equal(v.minBuffer,v.minBufferNoSoma);assert.equal(v.somaUsed,0);});

test('granja sim (cerdo terminado): sale after finishing, growing pigs eat from weaning to sale, coverage uses that feed',()=>{
 const {GranjaSim:G}=browser(['granja-sim.js'],{state:base()});const r=G.simulate({...FARM,sale_mode:'finisher',finishing_days:165,feed_grow_kg:1.5,finisher_price_cents:450000}),s=r.summary;
 assert.equal(s.firstSale,mo(21+114+165));assert.equal(s.firstSale,9);same(r.rows.filter(x=>x.sold).map(x=>[x.m,x.sold,x.sales_cents]),[[9,18,8100000]]);
 same(r.rows.filter(x=>x.weaned).map(x=>x.m),[5,10],'weaning is its own event when finishing');
 assert.equal(r.rows[5].feed_kg,30*4+20*18*1.5,'weaned on day 163: 20 days of 18 growers');assert.equal(r.rows[6].feed_kg,31*4+31*18*1.5);assert.equal(r.rows[9].feed_kg,31*4+26*18*1.5,'sold on day 300');
 assert.equal(s.soma.feedMax,961000);assert.equal(s.soma.coversFeed,false);assert.equal(s.soma.gapFeed,961000-150000);assert.equal(s.onHand,18,'the second batch is still growing at the end');assert.equal(s.breakEven,9);});

test('granja sim: inputs are clamped (12–24 months, biology bounds), cycle never below biology, SOMA average from real income',()=>{
 const t='2026-11-22',st=base();
 st.transactions=[{date:add(t,-10),type:'income',business_unit:'soma',amount:300000},{date:add(t,-40),type:'income',business_unit:'soma',amount:300000},{date:add(t,-70),type:'income',business_unit:'soma',amount:300000},{date:add(t,-120),type:'income',business_unit:'soma',amount:9000000},{date:add(t,-5),type:'income',business_unit:'personal',amount:500000},{date:add(t,-5),type:'expense',business_unit:'soma',amount:70000},{date:add(t,-3),type:'income',business_unit:'soma',amount:400000,transfer_id:'tr1'},{date:add(t,-2),type:'income',business_unit:'soma',amount:999,deleted_at:'x'}];
 const {GranjaSim:G}=browser(['granja-sim.js'],{state:st,today:t});assert.equal(G.somaMonthly(),300000,'3 × $3,000 in 90 days ÷ 3; other units, expenses, transfers and deleted rows excluded');
 assert.equal(G.simulate({months:30}).rows.length,24);assert.equal(G.simulate({months:6}).rows.length,12);assert.equal(G.simulate({months:'18'}).rows.length,18);
 const n=G.normalize({sows:0,litters_per_year:9,mortality_pct:-4,lactation_days:200,finishing_days:50,sale_mode:'x',soma_cents:'',start:'2026-13-40',feed_sow_kg:'abc'});
 assert.equal(n.sows,1);assert.equal(n.litters_per_year,2.6);assert.equal(n.mortality_pct,0);assert.equal(n.lactation_days,60);assert.equal(n.finishing_days,100,'clamped to 100–240 days (always after weaning)');assert.equal(n.sale_mode,'weaner');assert.equal(n.soma_cents,null);assert.equal(n.start,t);assert.equal(n.feed_sow_kg,2.5);
 assert.equal(G.simulate({litters_per_year:2.6}).summary.cycle_days,148,'365/2.6 < 114+28+6 → biology wins');assert.equal(G.simulate({litters_per_year:2}).summary.cycle_days,182.5);
 assert.equal(G.simulate({}).rows[0].date,t,'start defaults to today');assert.equal(G.DEFAULTS.gestation_days,114);});

test('granja sim: chart (one MXN axis, accessible, break-even marker, animated only on request), panel, storage, afterRender',()=>{
 const st=base();const c=browser(['granja-sim.js'],{state:st,ui:{section:'granja'}}),G=c.GranjaSim,r=G.simulate(FARM);
 const svg=G.chartSVG(r,{width:600});assert.match(svg,/role="img"/);assert.match(svg,/aria-label="[^"]*equilibrio en el mes 11/);assert.match(svg,/Equilibrio · mes 11/);assert.match(svg,/tabindex="0"/);
 assert.equal((svg.match(/class="gs-bar /g)||[]).length,12);assert.equal((svg.match(/class="gs-bar neg"/g)||[]).length,10);assert.equal((svg.match(/class="gs-hit"/g)||[]).length,12);assert.equal((svg.match(/class="gs-line"/g)||[]).length,1);
 assert.ok(!/gs-anim/.test(svg));assert.match(G.chartSVG(r,{width:340,animate:true}),/class="gs-svg gs-anim"/);assert.match(G.chartSVG(r,{width:340}),/viewBox="0 0 340 232"/);
 // panel: form + KPIs + SOMA + timeline + assumptions, with the SOMA field automatic until edited
 const html=G.panel();for(const s of ['id="gs-panel"','id="gs-form"','name="sows"','name="sale_mode"','name="soma_cents"','data-auto="1"','Mes de equilibrio','Colchón mínimo','¿SOMA cubre el alimento','Línea de tiempo','no asesoría'])assert.ok(html.includes(s),s);
 // storage: preferences.farmSim only (soma/start stay automatic when null), unchanged input → no extra save
 const keys=Object.keys(st).sort();let saved=G.saveInputs({...FARM,soma_cents:null,start:null});assert.equal(st.preferences.farmSim.sows,2);assert.equal(st.preferences.farmSim.soma_cents,null);assert.equal(st.preferences.farmSim.start,null);
 const n=c.Store.saves();G.saveInputs({...FARM,soma_cents:null,start:null});assert.equal(c.Store.saves(),n,'same inputs are not saved twice');same(Object.keys(st).sort(),keys);assert.equal(saved.months,12);
 saved=G.saveInputs({...FARM,months:40,soma_cents:250000});assert.equal(st.preferences.farmSim.months,24);assert.equal(st.preferences.farmSim.soma_cents,250000);assert.equal(st.preferences.farmSim.start,'2026-12-01');
 // afterRender: only #granja, summary tab, list (not an animal page); after the summary grid; idempotent
 let main=withMain(c,fakeMain(['.rancho-hero','.rancho-rail','.quick-actions','.detail-grid']));G.afterRender();G.afterRender();assert.equal(main.inserted.length,1);assert.equal(main.inserted[0].sel,'.detail-grid');
 st.preferences.farmView='animals';main=withMain(c,fakeMain(['.rancho-rail','.detail-grid']));G.afterRender();assert.equal(main.inserted.length,0,'other tabs stay untouched');
 c.UI.tab.granja='summary';c.UI.id='a1';G.afterRender();assert.equal(main.inserted.length,0,'animal page untouched');
 c.UI.id=null;main=withMain(c,fakeMain(['.rancho-hero','.rancho-rail']));G.afterRender();assert.equal(main.inserted[0].sel,'.rancho-rail','no summary grid → after the tab rail');
 c.UI.section='alvento';main=withMain(c,fakeMain(['.detail-grid']));assert.equal(G.afterRender(),undefined);assert.equal(main.inserted.length,0);
 assert.ok(Object.isFrozen(G));for(const k of ['afterRender','panel','simulate','normalize','somaMonthly','saveInputs','chartSVG'])assert.equal(typeof G[k],'function',k);});

test('both modules coexist in one page: frozen globals, each afterRender ignores the other section',()=>{
 const st=base();st.alventoDrops.push({id:'d1',title:'Drop',sequence:1,status:'idea'});const c=browser(['alvento-plus.js','granja-sim.js'],{state:st,ui:{section:'granja'}});
 assert.ok(Object.isFrozen(c.AlventoPlus)&&Object.isFrozen(c.GranjaSim));
 let main=withMain(c,fakeMain(['.cards-grid','.detail-grid']));c.AlventoPlus.afterRender();assert.equal(main.inserted.length,0);c.GranjaSim.afterRender();assert.equal(main.inserted.length,1);assert.match(main.inserted[0].html,/id="gs-panel"/);
 c.UI.section='alvento';main=withMain(c,fakeMain(['.cards-grid','.detail-grid']));c.GranjaSim.afterRender();assert.equal(main.inserted.length,0);c.AlventoPlus.afterRender();assert.equal(main.inserted.length,1);assert.match(main.inserted[0].html,/id="ap-panel"/);});
