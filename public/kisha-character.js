'use strict';
/* Kisha · original rigged SVG Border Collie (no external asset, ~10 KB).
   One consistent model: black coat with white blaze, muzzle, chest ruff, socks and tail tip; amber-brown eyes.
   Poses are blends of a small set of joint parameters (head tilt/lift, ears, brows, lids, jaw, tail, body
   height/lying) driven by one requestAnimationFrame loop. Only allow-listed pose names are accepted.
   The jaw follows REAL audio amplitude (setMouth) while speaking; nothing else can open it.
   prefers-reduced-motion or the user's "animación desactivada" freezes a stable, still pose. */
window.KishaCharacter=(()=>{
 const POSES=['idle','listening','thinking','speaking','curious','confused','supportive','happy','resting'];
 // Target joint values per pose. Units: degrees / unitless 0..1.
 const P={
  idle:{tilt:0,lift:0,earL:0,earR:0,brow:0,lid:0,jaw:0,tail:.25,tailAmp:.12,lie:0,breathe:1,smile:.25},
  listening:{tilt:-6,lift:3,earL:-14,earR:-10,brow:.25,lid:-.1,jaw:0,tail:.35,tailAmp:.08,lie:0,breathe:.8,smile:.15},
  thinking:{tilt:10,lift:1,earL:-4,earR:8,brow:.45,lid:.15,jaw:0,tail:.2,tailAmp:.04,lie:0,breathe:.7,smile:0,look:1},
  speaking:{tilt:-2,lift:2,earL:-6,earR:-6,brow:.1,lid:0,jaw:0,tail:.35,tailAmp:.1,lie:0,breathe:.9,smile:.3},
  curious:{tilt:14,lift:2,earL:-12,earR:6,brow:.4,lid:-.05,jaw:0,tail:.4,tailAmp:.1,lie:0,breathe:.9,smile:.2},
  confused:{tilt:-16,lift:0,earL:8,earR:-14,brow:-.35,lid:.05,jaw:.05,tail:.15,tailAmp:.03,lie:0,breathe:.8,smile:0},
  supportive:{tilt:-5,lift:-3,earL:10,earR:10,brow:-.3,lid:.42,jaw:0,tail:.1,tailAmp:.03,lie:0,breathe:.6,smile:.1},
  happy:{tilt:4,lift:3,earL:-8,earR:-8,brow:.15,lid:.18,jaw:.25,tail:.6,tailAmp:.32,lie:0,breathe:1.1,smile:.7},
  resting:{tilt:0,lift:-6,earL:14,earR:14,brow:0,lid:.92,jaw:0,tail:.05,tailAmp:.02,lie:1,breathe:.5,smile:.1}
 };
 const SVG=`<svg class="kisha-svg" viewBox="0 0 400 400" role="img" aria-labelledby="kisha-title" focusable="false">
 <title id="kisha-title">Kisha, una perrita Border Collie</title>
 <defs>
  <radialGradient id="k-fur" cx="45%" cy="35%" r="75%"><stop offset="0" stop-color="#3a3f4b"/><stop offset=".55" stop-color="#1b1e26"/><stop offset="1" stop-color="#0d0f14"/></radialGradient>
  <radialGradient id="k-white" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#eef1f6"/><stop offset="1" stop-color="#cfd5df"/></radialGradient>
  <radialGradient id="k-eye" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#c58b45"/><stop offset=".6" stop-color="#7a4a1c"/><stop offset="1" stop-color="#3b220b"/></radialGradient>
  <radialGradient id="k-shadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <clipPath id="k-clipL"><ellipse cx="160" cy="140" rx="15" ry="16"/></clipPath><clipPath id="k-clipR"><ellipse cx="240" cy="140" rx="15" ry="16"/></clipPath>
  <linearGradient id="k-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fd4ff" stop-opacity=".55"/><stop offset=".4" stop-color="#9fd4ff" stop-opacity="0"/></linearGradient>
 </defs>
 <ellipse class="k-shadow" cx="200" cy="362" rx="128" ry="16" fill="url(#k-shadow)"/>
 <g class="k-tail-g" data-k="tail"><path d="M276 318 C 320 300 338 262 332 226 C 330 212 346 210 350 226 C 362 274 330 324 284 336 Z" fill="url(#k-fur)"/><path d="M332 226 C 330 212 346 210 350 226 C 352 236 350 246 347 254 C 340 246 334 236 332 226 Z" fill="url(#k-white)"/></g>
 <g class="k-lie-g" data-k="lieBody" opacity="0">
  <path d="M96 352 C 84 318 104 286 150 280 C 200 274 262 276 304 290 C 340 302 344 344 318 356 Z" fill="url(#k-fur)"/>
  <path d="M138 352 C 136 322 158 300 200 298 C 232 298 248 318 246 352 Z" fill="url(#k-white)"/>
  <path d="M108 352 C 100 340 106 330 130 330 C 160 330 176 338 176 350 C 176 360 150 364 124 362 C 114 360 110 356 108 352 Z" fill="url(#k-white)"/>
  <path d="M224 352 C 224 338 240 330 270 330 C 294 330 300 340 292 352 C 288 358 276 362 256 362 C 236 362 224 358 224 352 Z" fill="url(#k-white)"/>
 </g>
 <g class="k-body-g" data-k="body">
  <path d="M118 352 C 104 300 118 236 158 206 C 186 186 220 184 248 200 C 292 226 304 300 288 352 Z" fill="url(#k-fur)"/>
  <path d="M160 352 C 150 312 160 262 186 236 C 196 226 212 224 222 232 C 248 256 254 312 244 352 Z" fill="url(#k-white)"/>
  <path class="k-rim" d="M118 352 C 104 300 118 236 158 206 C 170 198 182 192 196 190 C 160 210 132 260 136 352 Z" fill="url(#k-rim)"/>
  <g data-k="legs"><path d="M150 292 C 144 318 144 340 148 352 C 152 362 176 362 180 352 C 183 338 182 314 178 292 Z" fill="url(#k-fur)"/><path d="M146 330 C 145 342 146 350 148 353 C 153 362 176 362 180 353 C 182 346 182 338 181 330 C 170 336 156 336 146 330 Z" fill="url(#k-white)"/><path d="M158 360 L158 352 M166 361 L166 352" stroke="#b9c1cc" stroke-width="1.6" stroke-linecap="round"/>
   <path d="M222 292 C 218 314 217 338 220 352 C 224 362 248 362 252 352 C 256 340 256 318 250 292 Z" fill="url(#k-fur)"/><path d="M219 330 C 218 338 218 346 220 353 C 224 362 248 362 252 353 C 254 350 255 342 254 330 C 244 336 230 336 219 330 Z" fill="url(#k-white)"/><path d="M232 361 L232 352 M240 361 L240 352" stroke="#b9c1cc" stroke-width="1.6" stroke-linecap="round"/></g>
 </g>
 <g class="k-head-g" data-k="head">
  <g data-k="earL"><path d="M128 120 C 112 86 116 52 132 36 C 146 50 160 82 164 108 Z" fill="url(#k-fur)"/><path data-k="tipL" d="M124 62 C 126 48 130 40 132 36 C 140 44 146 54 150 64 C 140 70 130 70 124 62 Z" fill="#14161c"/><path d="M134 104 C 126 82 128 62 134 52 C 142 64 150 84 152 102 Z" fill="#6b4b4f" opacity=".55"/></g>
  <g data-k="earR"><path d="M272 120 C 288 86 284 52 268 36 C 254 50 240 82 236 108 Z" fill="url(#k-fur)"/><path data-k="tipR" d="M276 62 C 274 48 270 40 268 36 C 260 44 254 54 250 64 C 260 70 270 70 276 62 Z" fill="#14161c"/><path d="M266 104 C 274 82 272 62 266 52 C 258 64 250 84 248 102 Z" fill="#6b4b4f" opacity=".55"/></g>
  <path d="M200 64 C 140 64 112 108 116 154 C 120 196 154 226 200 228 C 246 226 280 196 284 154 C 288 108 260 64 200 64 Z" fill="url(#k-fur)"/>
  <path d="M200 70 C 192 92 186 120 184 150 C 178 168 170 184 168 200 C 180 216 192 222 200 222 C 208 222 220 216 232 200 C 230 184 222 168 216 150 C 214 120 208 92 200 70 Z" fill="url(#k-white)"/>
  <path class="k-rim" d="M200 64 C 140 64 112 108 116 154 C 118 170 124 184 132 196 C 124 150 140 96 196 68 Z" fill="url(#k-rim)"/>
  <g data-k="browL"><path d="M146 124 C 154 116 166 114 174 118" stroke="#5a5f6b" stroke-width="3" stroke-linecap="round" fill="none"/></g>
  <g data-k="browR"><path d="M254 124 C 246 116 234 114 226 118" stroke="#5a5f6b" stroke-width="3" stroke-linecap="round" fill="none"/></g>
  <g data-k="eyes">
   <g data-k="eyeL"><ellipse cx="160" cy="140" rx="15" ry="16" fill="#0b0c10"/><ellipse cx="160" cy="140" rx="12" ry="13" fill="url(#k-eye)"/><g data-k="pupL"><ellipse cx="160" cy="141" rx="6" ry="7" fill="#0b0c10"/><circle cx="155" cy="135" r="3.4" fill="#fff"/><circle cx="164" cy="146" r="1.4" fill="#fff" opacity=".8"/></g></g>
   <g data-k="eyeR"><ellipse cx="240" cy="140" rx="15" ry="16" fill="#0b0c10"/><ellipse cx="240" cy="140" rx="12" ry="13" fill="url(#k-eye)"/><g data-k="pupR"><ellipse cx="240" cy="141" rx="6" ry="7" fill="#0b0c10"/><circle cx="235" cy="135" r="3.4" fill="#fff"/><circle cx="244" cy="146" r="1.4" fill="#fff" opacity=".8"/></g></g>
   <g clip-path="url(#k-clipL)"><rect data-k="lidL" x="140" y="122" width="40" height="0" fill="#23262f"/><path data-k="lashL" d="M145 124 Q160 120 175 124" stroke="#0b0c10" stroke-width="2.5" fill="none" stroke-linecap="round"/></g><g clip-path="url(#k-clipR)"><rect data-k="lidR" x="220" y="122" width="40" height="0" fill="#23262f"/><path data-k="lashR" d="M225 124 Q240 120 255 124" stroke="#0b0c10" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
  </g>
  <g data-k="muzzle">
   <path d="M200 160 C 172 160 158 178 160 194 C 162 210 180 218 200 218 C 220 218 238 210 240 194 C 242 178 228 160 200 160 Z" fill="url(#k-white)"/>
   <g data-k="jaw"><path d="M178 202 C 186 214 214 214 222 202 C 222 222 212 232 200 232 C 188 232 178 222 178 202 Z" fill="#3b2a2e"/><path data-k="tongue" d="M188 214 C 192 226 208 226 212 214 C 212 222 207 230 200 230 C 193 230 188 222 188 214 Z" fill="#e5788a"/></g>
   <path d="M186 168 C 186 160 214 160 214 168 C 214 178 206 184 200 184 C 194 184 186 178 186 168 Z" fill="#14161c"/><ellipse cx="195" cy="167" rx="5" ry="2.5" fill="#fff" opacity=".35"/>
   <path data-k="mouth" d="M200 184 L 200 194 M200 194 C 192 202 182 200 178 194 M200 194 C 208 202 218 200 222 194" stroke="#14161c" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g data-k="blush" opacity="0"><ellipse cx="148" cy="176" rx="11" ry="6" fill="#ff9fb0" opacity=".45"/><ellipse cx="252" cy="176" rx="11" ry="6" fill="#ff9fb0" opacity=".45"/></g>
 </g>
</svg>`;
 const lerp=(a,b,t)=>a+(b-a)*t;
 function create(host,{reduced=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,animated=true}={}){
  host.innerHTML=SVG;const svg=host.querySelector('svg');const q=k=>svg.querySelector(`[data-k="${k}"]`);
  const el={head:q('head'),body:q('body'),tail:q('tail'),earL:q('earL'),earR:q('earR'),browL:q('browL'),browR:q('browR'),lidL:q('lidL'),lidR:q('lidR'),jaw:q('jaw'),pupL:q('pupL'),pupR:q('pupR'),blush:q('blush'),mouth:q('mouth'),legs:q('legs'),lie:q('lieBody'),lashL:q('lashL'),lashR:q('lashR'),tipL:q('tipL'),tipR:q('tipR')};
  let pose='idle',cur={...P.idle,look:0},mouth=0,mouthTarget=0,raf=0,t0=performance.now(),blinkAt=t0+2500,blinkT=0,still=reduced||!animated,hidden=false;
  function apply(v,time){const s=time/1000,br=still?0:Math.sin(s*1.6)*v.breathe;
   const lie=v.lie,bodyY=lie*34,headY=-v.lift+lie*96-br*1.2;
   el.body.setAttribute('transform',`translate(0 ${bodyY.toFixed(2)}) scale(1 ${(1-lie*.12+br*.006).toFixed(4)})`);
   el.body.style.opacity=String(Math.max(0,Math.min(1,(1-lie)*2.2)).toFixed(3));el.lie.setAttribute('opacity',String(Math.max(0,Math.min(1,lie*2.2)).toFixed(3)));el.lie.setAttribute('transform',`scale(1 ${(1+br*.008).toFixed(4)})`);
   el.head.setAttribute('transform',`translate(0 ${headY.toFixed(2)}) rotate(${(v.tilt+(still?0:Math.sin(s*.7)*.8)).toFixed(2)} 200 160)`);
   el.earL.setAttribute('transform',`rotate(${v.earL.toFixed(2)} 146 112)`);el.earR.setAttribute('transform',`rotate(${(-v.earR).toFixed(2)} 254 112)`);const fold=(.5+Math.max(0,v.earL)/14*.5);el.tipL.setAttribute('transform',`rotate(${(-22*fold).toFixed(2)} 146 66)`);el.tipR.setAttribute('transform',`rotate(${(22*(.5+Math.max(0,v.earR)/14*.5)).toFixed(2)} 254 66)`);
   el.browL.setAttribute('transform',`translate(0 ${(-v.brow*6).toFixed(2)}) rotate(${(v.brow*-8).toFixed(2)} 160 120)`);el.browR.setAttribute('transform',`translate(0 ${(-v.brow*6).toFixed(2)}) rotate(${(v.brow*8).toFixed(2)} 240 120)`);
   const blink=blinkT>0?Math.sin(Math.PI*Math.min(1,blinkT)):0,lid=Math.max(0,Math.min(1,v.lid+blink));const h=(lid*36).toFixed(2);
   el.lidL.setAttribute('height',h);el.lidR.setAttribute('height',h);const ly=(122+lid*34).toFixed(2);for(const [l,c] of [[el.lashL,160],[el.lashR,240]]){l.setAttribute('d',`M${c-15} ${ly} Q${c} ${(+ly+(lid>.5?4:-4)).toFixed(2)} ${c+15} ${ly}`);l.style.opacity=String(lid>.08?1:0);}
   const look=(v.look||0)*(still?1:.6+.4*Math.sin(s*.9));el.pupL.setAttribute('transform',`translate(${(look*4).toFixed(2)} ${(-look*4).toFixed(2)})`);el.pupR.setAttribute('transform',`translate(${(look*4).toFixed(2)} ${(-look*4).toFixed(2)})`);
   const jaw=Math.max(v.jaw,mouth);el.jaw.setAttribute('transform',`translate(0 ${(jaw*10).toFixed(2)})`);el.jaw.style.opacity=String(Math.min(1,jaw*4));
   el.mouth.style.opacity=String(1-Math.min(1,jaw*3));el.blush.setAttribute('opacity',String((v.smile*.9).toFixed(2)));
   const wag=still?0:Math.sin(s*(2+v.tailAmp*14))*v.tailAmp*22;el.tail.setAttribute('transform',`translate(0 ${(lie*30).toFixed(2)}) rotate(${(-v.tail*18+wag-lie*40).toFixed(2)} 282 330)`);}
  function frame(time){raf=0;if(hidden)return;const tgt=P[pose];const k=still?1:.12;
   for(const key of Object.keys(P.idle))cur[key]=lerp(cur[key],tgt[key],k);cur.look=lerp(cur.look||0,tgt.look||0,k);
   mouth=lerp(mouth,pose==='speaking'?mouthTarget:0,.45);if(pose!=='speaking'&&mouth<.01)mouth=0;
   if(!still&&pose!=='resting'){if(time>blinkAt){blinkT=0.0001;blinkAt=time+2600+Math.random()*3400;}if(blinkT>0){blinkT+=.12;if(blinkT>=1)blinkT=0;}}
   apply(cur,time);if(!still||pose==='speaking'||Math.abs(cur.tilt-tgt.tilt)>.05)raf=requestAnimationFrame(frame);}
  function kick(){if(!raf&&!hidden)raf=requestAnimationFrame(frame);}
  function set(next){if(!POSES.includes(next))return false;pose=next;host.dataset.pose=next;if(next!=='speaking')mouthTarget=0;kick();return true;}
  /** Real audio amplitude 0..1 while speaking; ignored otherwise. */
  function setMouth(level){if(pose!=='speaking')return;mouthTarget=Math.max(0,Math.min(1,Number(level)||0));kick();}
  function setAnimated(on){still=reduced||!on;host.dataset.still=String(still);kick();}
  const vis=()=>{hidden=document.hidden;if(!hidden)kick();};document.addEventListener('visibilitychange',vis);
  host.dataset.still=String(still);set('idle');apply(cur,performance.now());
  return {set,setMouth,setAnimated,get pose(){return pose;},destroy(){cancelAnimationFrame(raf);raf=0;hidden=true;document.removeEventListener('visibilitychange',vis);}};
 }
 return Object.freeze({create,POSES});
})();
