# v3.1 patch C (idempotent): Tendencias redesign (data logic untouched).
# - Explains what a square means, readable weekday + every-3h hour labels, intensity legend (0 / 1 / max),
#   empty cells visibly distinct from active cells, selectable detail (day, hour, count, per-module sources)
#   via click/focus/keyboard, horizontally scrollable labeled chart on phones (no page overflow).
# - "Por área" and "Observaciones" become balanced, spacious cards.
import os
os.chdir('/home/user/webapp')
p='public/evie-life.js';s=open(p).read()
if 'ev-hm-v31' not in s:
    a=s.index("  return Views.heading('Tendencias'")
    b=s.index(" /* ===================== COMPRAS Y DESPENSA")
    new=r"""  // v3.1 (ev-hm-v31): per-cell sources for the detail panel; same events, same counts.
  const src=[...Array(7)].map(()=>[...Array(24)].map(()=>({})));for(const x of ev){const c=src[x.wd][x.hour];const k=AREAS[x.area]?.[0]||x.area;c[k]=(c[k]||0)+1;}
  window.__evHM={grid,src,days:['lunes','martes','miércoles','jueves','viernes','sábado','domingo'],max,range};
  const lvl=v=>v===0?0:Math.max(1,Math.ceil(v/max*4));
  const hourLbl=h=>h===0?'12a':h<12?h+'a':h===12?'12p':(h-12)+'p';
  const heat=ev.length?`<div class="ev-hm-v31" data-max="${max}">
   <p class="ev-hm-help">${i('info')}<span>Cada cuadro es <strong>una hora de un día de la semana</strong> (últimos ${range} días, tu zona horaria). Entre más intenso, más acciones registraste a esa hora. Un cuadro vacío significa que no hubo registros, no que no hiciste nada.</span></p>
   <div class="ev-hm-scroll" tabindex="0" aria-label="Mapa de actividad, desplázate horizontalmente si es necesario"><div class="ev-hm" role="grid" aria-label="Actividad por día y hora" aria-rowcount="7" aria-colcount="24">
    <div class="ev-hm-row ev-hm-head" role="row"><span></span>${[...Array(24)].map((_,h)=>`<b role="columnheader" aria-label="${h}:00">${h%3===0?hourLbl(h):''}</b>`).join('')}</div>
    ${days.map((dn,k)=>`<div class="ev-hm-row" role="row"><span role="rowheader">${dn}</span>${grid[k].map((v,h)=>`<button type="button" role="gridcell" class="ev-cell l${lvl(v)}" data-d="${k}" data-h="${h}" aria-label="${dn} ${h}:00 a ${h}:59, ${v} ${v===1?'acción':'acciones'}" tabindex="${k===0&&h===0?0:-1}"></button>`).join('')}</div>`).join('')}
   </div></div>
   <div class="ev-hm-foot"><div class="ev-legend" aria-label="Leyenda de intensidad"><span>Sin registros</span><i class="ev-cell l0"></i><i class="ev-cell l1"></i><i class="ev-cell l2"></i><i class="ev-cell l3"></i><i class="ev-cell l4"></i><span>Más (${max} ${max===1?'acción':'acciones'})</span></div>
   <p class="ev-hm-detail" id="ev-hm-detail" aria-live="polite">Toca o enfoca un cuadro para ver el día, la hora y de dónde vienen los registros.</p></div></div>`:'';
  return Views.heading('Tendencias','Cómo usas tu tiempo, con datos reales.',`<div class="toolbar ev-range">${[['7','7 días'],['30','30 días'],['90','90 días']].map(([k,l])=>`<button class="button ${range===k?'primary':''}" data-evl="trend-range" data-k="${k}" aria-pressed="${range===k}">${l}</button>`).join('')}</div>`,'TU MAPA DE ACTIVIDAD')+
  `<section class="panel ev-trends-main"><header class="panel-header"><div><span class="eyebrow">DÍA DE LA SEMANA × HORA · ${ev.length} REGISTROS</span><h2>Cuándo actúas</h2></div></header>${heat}${enough?'':`<p class="evm-muted ev-hm-few">${ev.length?'Aún hay pocos datos (':'Sin datos aún ('}${ev.length} de 12 mínimos para mostrar observaciones). Completa hábitos y pendientes: cada registro guarda su hora real.</p>`}<p class="evm-note">${i('shield-check')}Solo cuenta acciones con hora real: hábitos y pendientes completados, entrenos terminados y el momento en que registraste estudio, dinero o bitácora. Una fecha límite no es actividad. No se rastrea tu navegador ni tu micrófono.</p></section>`+
  `<div class="ev-trends-grid"><section class="panel ev-trend-card"><header><span class="eyebrow">DISTRIBUCIÓN</span><h2>Por área</h2></header>${Object.keys(byArea).length?`<ul class="ev-area-list">${Object.entries(byArea).sort((a,b)=>b[1]-a[1]).map(([a,n])=>`<li><span class="ev-area-name"><i style="background:${AREAS[a]?.[1]||'#a9c0ff'}"></i>${e(AREAS[a]?.[0]||a)}</span><span class="ev-area-bar" role="img" aria-label="${Math.round(n/ev.length*100)}% de los registros"><i style="width:${(n/ev.length*100).toFixed(1)}%;background:${AREAS[a]?.[1]||'#a9c0ff'}"></i></span><strong>${n}</strong><small>${Math.round(n/ev.length*100)}%</small></li>`).join('')}</ul>`:'<p class="evm-muted">Sin registros en este periodo.</p>'}</section>
  <section class="panel ev-trend-card"><header><span class="eyebrow">DESCRIPTIVO, NO CAUSAL</span><h2>Observaciones</h2></header>${obs.length?`<ul class="ev-obs-list">${obs.map(o=>`<li>${o}</li>`).join('')}</ul>`:'<p class="evm-muted">Mostraremos observaciones descriptivas cuando haya al menos 12 registros. Nunca afirmamos causas ni evaluamos tu productividad.</p>'}<label class="evie-switch ev-priv"><input type="checkbox" data-evl-set="trendsPrivate" ${data().settings.trendsPrivate?'checked':''}><span class="evie-switch-ui"></span><span><strong>Excluir bitácora y Kisha</strong><small>No usar tus entradas personales en Tendencias.</small></span></label></section></div>`;}
"""
    s=s[:a]+new+s[b:]
    open(p,'w').write(s);print('patched',p)
# interaction: detail panel + roving tabindex arrow keys
p='public/evie-life.js';s=open(p).read()
if 'ev-hm-interact' not in s:
    s=s.rstrip()
    s+=r"""
/* ev-hm-interact (v3.1): heatmap detail on click/focus/hover + arrow-key navigation. */
(()=>{const show=c=>{const m=window.__evHM;if(!m||!c)return;const d=+c.dataset.d,h=+c.dataset.h,v=m.grid[d][h],src=Object.entries(m.src[d][h]).sort((a,b)=>b[1]-a[1]);const el=document.getElementById('ev-hm-detail');if(!el)return;
 document.querySelectorAll('.ev-cell.sel').forEach(x=>x.classList.remove('sel'));c.classList.add('sel');
 el.innerHTML=`<strong>${m.days[d]} · ${h}:00–${h}:59</strong> · ${v} ${v===1?'acción registrada':'acciones registradas'} en los últimos ${m.range} días${src.length?' · '+src.map(([k,n])=>`${Domain.escape(k)}: ${n}`).join(', '):''}`;};
 document.addEventListener('click',ev=>{const c=ev.target.closest('.ev-cell[data-d]');if(c)show(c);});
 document.addEventListener('focusin',ev=>{const c=ev.target.closest?.('.ev-cell[data-d]');if(c)show(c);});
 document.addEventListener('pointerover',ev=>{const c=ev.target.closest?.('.ev-cell[data-d]');if(c&&ev.pointerType==='mouse')show(c);});
 document.addEventListener('keydown',ev=>{const c=ev.target.closest?.('.ev-cell[data-d]');if(!c)return;const mv={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]}[ev.key];if(!mv)return;ev.preventDefault();const d=Math.min(6,Math.max(0,+c.dataset.d+mv[0])),h=Math.min(23,Math.max(0,+c.dataset.h+mv[1]));const n=document.querySelector(`.ev-cell[data-d="${d}"][data-h="${h}"]`);if(n){c.tabIndex=-1;n.tabIndex=0;n.focus();}});})();
"""
    open(p,'w').write(s);print('patched interact')
css="""
/* ===== v3.1 Tendencias ===== */
.ev-trends-main{padding:clamp(18px,3vw,28px)!important;display:grid;gap:16px}
.ev-trends-main .panel-header{padding:0!important;border:0!important}
.ev-hm-help{margin:0;display:flex;gap:10px;align-items:flex-start;font-size:var(--fs-sm);line-height:1.55;color:var(--g-muted)}
.ev-hm-help svg{width:16px;height:16px;flex:none;margin-top:2px;color:var(--g-accent)}
.ev-hm-help strong{color:var(--g-text)}
.ev-hm-scroll{overflow-x:auto;overscroll-behavior-x:contain;padding:6px 2px 10px;border-radius:14px;scrollbar-width:thin}
.ev-hm-scroll:focus-visible{outline:2px solid var(--g-accent);outline-offset:2px}
.ev-hm{display:grid;gap:5px;min-width:620px}
.ev-hm-row{display:grid;grid-template-columns:44px repeat(24,minmax(18px,1fr));gap:5px;align-items:center}
.ev-hm-row>span{font-size:12px;color:var(--g-muted);font-weight:500}
.ev-hm-head b{font-size:11px;font-weight:500;color:var(--g-muted);text-align:left;white-space:nowrap;height:16px}
.ev-cell{aspect-ratio:1;min-height:18px;border-radius:6px;border:0;padding:0;cursor:pointer;position:relative;
 background:rgba(169,192,255,.05);box-shadow:inset 0 0 0 1px rgba(169,192,255,.08);transition:transform .15s,box-shadow .2s,background .3s}
.ev-cell.l1{background:linear-gradient(160deg,rgba(150,175,255,.34),rgba(130,150,255,.24));box-shadow:0 1px 2px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.12)}
.ev-cell.l2{background:linear-gradient(160deg,rgba(150,175,255,.55),rgba(140,140,255,.42));box-shadow:0 2px 5px rgba(20,30,90,.35),inset 0 1px 0 rgba(255,255,255,.16)}
.ev-cell.l3{background:linear-gradient(160deg,rgba(165,185,255,.78),rgba(160,130,255,.62));box-shadow:0 3px 8px rgba(40,40,140,.4),inset 0 1px 0 rgba(255,255,255,.22)}
.ev-cell.l4{background:linear-gradient(160deg,#c3d1ff,#a98cff);box-shadow:0 4px 12px rgba(120,100,255,.45),inset 0 1px 0 rgba(255,255,255,.4)}
button.ev-cell:hover,button.ev-cell:focus-visible{transform:translateY(-1px);outline:2px solid var(--g-accent);outline-offset:1px;z-index:1}
.ev-cell.sel{outline:2px solid #fff;outline-offset:1px;z-index:1}
.ev-hm-foot{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:space-between}
.ev-legend{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--g-muted)}
.ev-legend i{width:16px;height:16px;min-height:0;display:inline-block;cursor:default}
.ev-hm-detail{margin:0;font-size:var(--fs-sm);color:var(--g-muted);min-height:1.5em;flex:1 1 320px}
.ev-hm-detail strong{color:var(--g-text);text-transform:capitalize}
.ev-hm-few{margin:0}
.ev-trends-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px;margin-top:18px}
.ev-trend-card{padding:clamp(18px,3vw,26px)!important;display:grid;gap:14px;align-content:start}
.ev-trend-card header{display:grid;gap:4px}.ev-trend-card h2{margin:0;font-size:20px}
.ev-area-list,.ev-obs-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.ev-area-list li{display:grid;grid-template-columns:minmax(90px,130px) 1fr auto 44px;gap:12px;align-items:center;font-size:var(--fs-sm)}
.ev-area-name{display:flex;gap:8px;align-items:center}.ev-area-name i{width:9px;height:9px;border-radius:50%;flex:none}
.ev-area-bar{height:8px;border-radius:99px;background:rgba(169,192,255,.1);overflow:hidden}.ev-area-bar i{display:block;height:100%;border-radius:inherit}
.ev-area-list small{color:var(--g-muted);text-align:right}
.ev-obs-list li{padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.04);line-height:1.55;font-size:var(--fs-sm)}
.ev-priv{margin-top:6px;padding-top:14px;border-top:1px solid var(--g-line)}
:root[data-theme=light] .ev-cell{background:rgba(60,80,160,.06);box-shadow:inset 0 0 0 1px rgba(60,80,160,.1)}
:root[data-theme=light] .ev-cell.l1{background:#cfd8ff}:root[data-theme=light] .ev-cell.l2{background:#a9b8ff}:root[data-theme=light] .ev-cell.l3{background:#8a8cf2}:root[data-theme=light] .ev-cell.l4{background:#5b4fd6}
:root[data-theme=light] .ev-cell.sel{outline-color:#1b2440}
:root[data-theme=light] .ev-obs-list li{background:rgba(255,255,255,.7)}
@media (prefers-reduced-motion:reduce){.ev-cell{transition:none}}
@media (max-width:640px){.ev-area-list li{grid-template-columns:1fr auto 40px}.ev-area-list .ev-area-bar{grid-column:1/-1;grid-row:2}}
"""
p='public/evie-v31.css';t=open(p).read()
if '===== v3.1 Tendencias' not in t: open(p,'w').write(t+css);print('patched css')
print('patch C done')
