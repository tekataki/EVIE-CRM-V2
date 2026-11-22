'use strict';
/* EVIE v10 · Radar local (tarjeta del HUD «radar»). Noticias de negocios, IA, ventas y tu estado; avisos de tu ciudad
   (cierres de calles, eventos, cortes, clima) y planes del fin de semana dentro de tu presupuesto. Todo viene de una
   búsqueda web con etiqueta confirmado / no confirmado y solo enlaces que la búsqueda devolvió (/api/radar). Se
   actualiza solo una vez al día (noticias y avisos) y de jueves a sábado (planes), y se guarda en
   preferences.radar para no gastar de más en tus otros dispositivos. */
window.EvieRadar=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ic=n=>window.Views?Views.icon(n):'';
 const P=()=>Store.get()?.preferences||{};
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const today=()=>Domain.today();
 const R=()=>({budget:300,auto:true,...(P().radar||{})});
 const CAT={negocios:['Negocios','briefcase'],ia:['IA','cpu'],ventas:['Ventas','handshake'],local:['Local','map-pin']};
 const UIx={tab:'news',busy:null};
 function weekend(t=today()){const d=new Date(t+'T12:00:00').getDay(),to=d===0?-2:d===6?-1:5-d,add=(x,n)=>new Date(Date.parse(x+'T12:00:00Z')+n*864e5).toISOString().slice(0,10),fri=add(t,to);return {from:fri,to:add(fri,2)};}
 const fresh={news:r=>r.news?.date===today(),plans:r=>r.plans?.weekend?.from===weekend().from&&r.plans?.budget===r.budget};
 async function fetchNews(force=false){const r=R();if(!force&&fresh.news(r))return r.news;const j=await EvieAccounts.request('radar/news',{method:'POST',body:{}});
  const news={date:j.date||today(),city:j.city,items:j.items||[],avisos:j.avisos||[],at:j.generated_at};Store.save(s=>{s.preferences.radar={...R(),news};});return news;}
 async function fetchPlans(force=false){const r=R();if(!force&&fresh.plans(r))return r.plans;const j=await EvieAccounts.request('radar/plans',{method:'POST',body:{budget:r.budget}});
  const plans={weekend:j.weekend,budget:j.budget,city:j.city,planes:j.planes||[],at:j.generated_at};Store.save(s=>{s.preferences.radar={...R(),plans};});return plans;}
 const badge=ok=>`<span class="rd-badge ${ok?'ok':'no'}">${ok?ic('badge-check')+'Confirmado':ic('circle-help')+'No confirmado'}</span>`;
 const link=u=>u?`<a class="rd-src" href="${e(u)}" target="_blank" rel="noopener noreferrer">${ic('external-link')}${e((()=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return 'fuente';}})())}</a>`:'';
 const money=n=>n===0?'Gratis':n<0?'Costo por confirmar':'$'+Number(n).toLocaleString('es-MX')+' MXN';
 function render(d){const r=R(),n=d?.news,pl=d?.plans,err=d?.error;
  const tabs=`<div class="rd-tabs" role="tablist"><button type="button" role="tab" data-rd="tab" data-tab="news" aria-selected="${UIx.tab==='news'}">${ic('newspaper')}Noticias y avisos</button><button type="button" role="tab" data-rd="tab" data-tab="plans" aria-selected="${UIx.tab==='plans'}">${ic('party-popper')}Plan del finde</button></div>`;
  let body='';
  if(UIx.tab==='news'){body=!n?`<p class="rd-muted">${err?e(err):'Toca «Actualizar» para revisar las noticias y avisos de hoy.'}</p>`:
   `${n.avisos?.length?`<section class="rd-avisos"><h4>${ic('siren')}Avisos en ${e(n.city||'tu ciudad')}</h4><ul>${n.avisos.map(a=>`<li><strong>${e(a.titulo)}</strong>${a.cuando?`<small>${e(a.cuando)}</small>`:''}<p>${e(a.detalle)}</p><div class="rd-meta">${badge(a.confirmado)}${link(a.url)}</div></li>`).join('')}</ul></section>`:`<p class="rd-muted">${ic('shield-check')}Sin avisos locales verificados para hoy.</p>`}
   <ul class="rd-news">${(n.items||[]).map(x=>`<li><span class="rd-cat" data-c="${e(x.categoria)}">${ic((CAT[x.categoria]||CAT.local)[1])}${e((CAT[x.categoria]||CAT.local)[0])}</span><strong>${e(x.titulo)}</strong><p>${e(x.resumen)}</p><div class="rd-meta">${badge(x.confirmado)}${x.fecha?`<small>${e(x.fecha)}</small>`:''}${link(x.url)}</div></li>`).join('')}</ul>`;}
  else{body=!pl?`<p class="rd-muted">${err?e(err):`Busco planes para el fin de semana con tope de $${r.budget} MXN.`}</p>`:pl.planes.length?`<ul class="rd-plans">${pl.planes.map(x=>`<li><div class="rd-plan-top"><strong>${e(x.titulo)}</strong><span class="rd-cost ${x.costo_mxn===0?'free':''}">${e(money(x.costo_mxn))}</span></div><small>${ic('calendar')}${e(x.cuando||'')}${x.donde?' · '+e(x.donde):''}</small>${x.por_que?`<p>${e(x.por_que)}</p>`:''}<div class="rd-meta">${badge(x.confirmado)}${link(x.url)}</div></li>`).join('')}</ul>`:`<p class="rd-muted">No encontré planes verificados dentro de $${pl.budget} MXN. Prueba subir el presupuesto.</p>`;}
  const at=UIx.tab==='news'?n?.at:pl?.at;
  return `<div class="rd">${tabs}<div class="rd-body" aria-busy="${!!UIx.busy}">${UIx.busy?`<p class="rd-muted rd-loading">${ic('loader-circle')}Buscando en la web…</p>`:body}</div>
   <p class="rd-note">${ic('info')}Búsqueda web con IA: revisa la fuente antes de decidir. «No confirmado» = rumor, redes o fuente no oficial.</p>
   <div class="rd-foot"><button type="button" class="button small" data-rd="refresh" ${UIx.busy||!cloud()?'disabled':''}>${ic('refresh-cw')}Actualizar</button>${UIx.tab==='plans'?`<label class="rd-budget"><span>Tope</span><select class="select" data-rd="budget">${[150,300,500,800,1500].map(v=>`<option value="${v}" ${r.budget===v?'selected':''}>$${v}</option>`).join('')}</select></label>`:''}${at?`<small class="rd-at">Actualizado ${e(new Date(at).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'}))}</small>`:''}</div>
   </div>`;}
 async function load(){const r=R();if(!cloud())return {news:r.news||null,plans:r.plans||null,error:'Inicia sesión para usar el Radar local.'};if(UIx.busy)return {news:r.news||null,plans:r.plans||null};
  try{if(UIx.tab==='news'){const news=await fetchNews();return {news,plans:r.plans||null};}const plans=await fetchPlans();return {news:r.news||null,plans};}
  catch(err){return {news:r.news||null,plans:r.plans||null,error:err.message||'El radar no está disponible ahora.'};}}
 const card={title:'Radar local',icon:'radar',scope:'account',load,render};
 if(window.EvieCards?.R)EvieCards.R.radar=card;
 function refreshCard(){try{const x=window.EvieHUD?.resolve?.('radar');if(x?.id)EvieHUD.update(x.id,{});else window.EvieHUD?.open?.('radar');}catch{}}
 document.addEventListener('click',async ev=>{const b=ev.target.closest?.('[data-rd]');if(!b||b.matches('select'))return;const a=b.dataset.rd;
  if(a==='tab'){UIx.tab=b.dataset.tab==='plans'?'plans':'news';refreshCard();}
  else if(a==='refresh'){UIx.busy=UIx.tab;refreshCard();try{UIx.tab==='plans'?await fetchPlans(true):await fetchNews(true);}catch(err){App.toast(err.message||'No pude actualizar el radar.','error');}finally{UIx.busy=null;refreshCard();}}});
 document.addEventListener('change',ev=>{const s=ev.target.closest?.('[data-rd="budget"]');if(!s)return;Store.save(st=>{st.preferences.radar={...R(),budget:Number(s.value)||300};});refreshCard();});
 /** Background refresh: news/alerts once a day; weekend plans Thu–Sat. A short toast when there are verified local alerts. */
 let tried='';
 async function auto(){const r=R(),t=today();if(!cloud()||r.auto===false||tried===t)return;tried=t;
  try{if(!fresh.news(r)){const n=await fetchNews();const ok=(n.avisos||[]).filter(a=>a.confirmado);if(ok.length)App.toast(`Ivi: ${ok.length===1?'hay un aviso local':'hay '+ok.length+' avisos locales'} hoy · ${ok[0].titulo}`,'success');}
   const d=new Date().getDay();if([4,5,6].includes(d)&&!fresh.plans(R()))await fetchPlans();}catch{}}
 function afterRender(){if(UI.section==='inicio')setTimeout(auto,2500);}
 /** For Ivi's proactive cards: today's verified local alerts. */
 function alerts(){const n=R().news;return n?.date===today()?(n.avisos||[]).filter(a=>a.confirmado):[];}
 function intent(text){const t=String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const plans=/(que hay|que hacer|planes?) (para |este |el )?(el )?(fin de semana|finde)|plan (del|de) finde/.test(t),news=/\b(radar|noticias (de hoy|locales)|avisos locales|que paso hoy|calles cerradas|cierres? (de calles|viales))\b/.test(t);
  if(!plans&&!news)return '';UIx.tab=plans?'plans':'news';if(UI.section==='inicio'&&window.EvieHUD){refreshCard();return plans?'Te dejo los planes del fin de semana en pantalla.':'Te dejo el radar local en pantalla.';}location.hash='inicio';setTimeout(refreshCard,700);return 'Abro el Radar local en Inicio.';}
 return Object.freeze({card,render,afterRender,intent,alerts,weekend,fetchNews,fetchPlans});
})();
