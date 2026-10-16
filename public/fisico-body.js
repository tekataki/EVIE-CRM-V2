'use strict';
/* Físico body: ORIGINAL schematic full-body figure (front + back) drawn as SVG paths, holographic wireframe style.
   Not traced from any reference image. Each major muscle group is a named <path data-m="key"> region so highlights,
   focus and accessibility labels map 1:1 to FisicoCore.GROUPS (= V2Domain.muscles keys).
   Coordinates: each view is a 200×440 box; the figure is symmetric (left half mirrored via mirror()).
   Presentation (presentation prop): 'neutral' (default), 'masc', 'fem' only nudges shoulder/hip width; the user
   chooses it — it is never inferred from an account field. */
window.FisicoBody=(()=>{
 const mirror=d=>d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,(m,x,y)=>`${(200-Number(x)).toFixed(1)},${y}`);
 const both=d=>d+' '+mirror(d);
 // Shared silhouette (outline) — drawn as a soft mesh behind the muscles.
 function silhouette(p){const s=p==='masc'?4:p==='fem'?-3:0,h=p==='fem'?4:p==='masc'?-2:0;
  const half=`M100,8 C112,8 120,18 120,32 C120,46 113,56 108,60 L108,68 C122,72 ${140+s},76 ${150+s},86 C160,96 162,112 164,128 L170,176 C173,196 176,212 176,226 L170,230 C166,214 160,198 156,182 L150,150 L146,176 C${144+h},196 ${146+h},214 ${148+h},230 C152,262 150,300 146,330 C144,356 144,384 146,406 C147,418 150,426 150,432 L126,432 C126,422 124,410 122,396 C118,366 116,338 112,304 L104,250 L100,248`;
  return half+' '+mirror(half).replace(/^M/,'L')+' Z';}
 /* Front regions (left side; mirrored automatically). */
 const FRONT={
  neck:'M93,60 L107,60 L108,70 C104,72 96,72 92,70 Z',
  shoulders:'M108,70 C124,72 140,76 148,88 C150,100 146,108 140,110 C134,98 124,90 112,86 Z',
  chest:'M100,84 L112,86 C124,90 134,98 138,110 C134,122 120,128 104,126 L100,124 Z',
  biceps:'M140,110 C148,108 154,116 156,130 C158,144 156,156 150,160 C144,152 140,138 138,122 Z',
  forearms:'M150,160 C156,158 162,166 166,180 C170,196 172,210 172,222 L166,224 C160,208 154,194 150,180 Z',
  core:'M100,126 L104,126 C118,128 128,124 134,122 C134,146 132,170 128,196 C120,210 110,218 100,220 Z',
  quads:'M102,232 C114,230 128,228 140,232 C146,256 146,284 142,306 C134,316 120,318 112,312 C106,290 102,262 102,232 Z',
  calves:'M114,330 C124,326 136,328 142,336 C144,358 142,380 138,398 L124,400 C120,380 116,356 114,330 Z'};
 const BACK={
  neck:'M92,58 L108,58 L118,72 C110,76 90,76 82,72 Z',
  shoulders:'M118,72 C130,74 142,78 148,88 C150,100 146,108 140,110 C134,98 126,90 116,86 Z',
  back:'M100,76 L116,86 C126,90 134,100 138,112 C136,140 128,168 116,190 C110,198 104,200 100,200 Z',
  triceps:'M140,110 C148,108 154,116 156,130 C158,144 156,156 150,160 C144,152 140,138 138,122 Z',
  forearms:'M150,160 C156,158 162,166 166,180 C170,196 172,210 172,222 L166,224 C160,208 154,194 150,180 Z',
  glutes:'M100,206 C114,204 130,208 140,220 C144,236 140,250 128,254 C116,256 106,252 100,246 Z',
  hamstrings:'M104,258 C116,258 130,258 140,262 C144,282 142,300 138,312 C128,318 116,318 110,312 C106,294 104,276 104,258 Z',
  calves:'M112,326 C124,320 138,324 144,336 C146,358 142,380 136,398 L122,400 C118,378 114,354 112,326 Z'};
 const BAND_FILL={fresh:'url(#fb-hatch-fresh-WHICH)',mid:'url(#fb-hatch-mid-WHICH)',ready:'url(#fb-dots-ready-WHICH)',idle:'none'};
 function view(which,{summary={},presentation='neutral',selected=null,title}={}){const R=which==='front'?FRONT:BACK;
  const parts=Object.entries(R).map(([k,d])=>{const s=summary[k]||{},b=s.band||'idle',label=`${s.label||k}: ${bandText(s)}`;
   return `<path class="fb-m" data-m="${k}" data-band="${b}" ${selected===k?'data-selected="1"':''} d="${both(d)}" fill="${BAND_FILL[b].replace('WHICH',which)}" tabindex="0" role="button" aria-pressed="${selected===k}" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`;}).join('');
  return `<svg class="fb-svg" viewBox="0 0 200 440" role="group" aria-label="${esc(title||(which==='front'?'Vista frontal':'Vista posterior'))}"><defs>
   <pattern id="fb-hatch-fresh-${which}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--fb-fresh)"/><line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/></pattern>
   <pattern id="fb-hatch-mid-${which}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="6" height="6" fill="var(--fb-mid)"/><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,.35)" stroke-width="1"/></pattern>
   <pattern id="fb-dots-ready-${which}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--fb-ready)"/><circle cx="3" cy="3" r="1" fill="rgba(255,255,255,.45)"/></pattern>
   <linearGradient id="fb-glow-${which}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--fb-line)" stop-opacity=".9"/><stop offset="1" stop-color="var(--fb-line)" stop-opacity=".35"/></linearGradient></defs>
   <path class="fb-sil" d="${silhouette(presentation)}"/>
   <g class="fb-mesh" aria-hidden="true">${mesh()}</g>
   <circle class="fb-head" cx="100" cy="32" r="0" aria-hidden="true"/>
   ${parts}</svg>`;}
 // Light procedural wireframe (horizontal contour lines clipped by the silhouette look) — purely decorative.
 function mesh(){let out='';for(let y=24;y<430;y+=14)out+=`<line x1="40" y1="${y}" x2="160" y2="${y}"/>`;for(let x=60;x<=140;x+=10)out+=`<line x1="${x}" y1="10" x2="${x}" y2="430"/>`;return out;}
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 function bandText(s){if(!s||!s.last_date)return 'sin registros';const d=s.days_since,when=d===0?'hoy':d===1?'ayer':`hace ${d} días`;return `${FisicoCore.BAND_TEXT[s.band]} · último ${when}${s.partial?' (como músculo secundario)':''}`;}
 return Object.freeze({view,bandText,FRONT,BACK});
})();
