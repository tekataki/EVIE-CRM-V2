'use strict';
/* Kisha · Border Collie companion (v8, 2026-11-22).
   The owner's Border Collie artwork (public/kisha/kisha-collie.webp, background removed) brought to life with a
   light rig: real blinking eyelids, a mouth that opens with the REAL audio amplitude while speaking (setMouth),
   breathing, posture by mood (listening, thinking, happy…), a futuristic aura that reacts to the voice and a
   soft floor light. Same API as before: create(host,{reduced,animated}) → {set,setMouth,setAnimated,pose,destroy}.
   Only allow-listed pose names are accepted. prefers-reduced-motion or «animación desactivada» keeps it still. */
window.KishaCharacter=(()=>{
 const POSES=['idle','listening','thinking','speaking','curious','confused','supportive','happy','resting','greet','tilt','wag','sit'];
 // Target values per pose. tilt: body sway (deg); lift: px up; lid: eyelids 0..1; bounce: happy hop; glow: aura energy.
 const P={
  idle:{tilt:0,lift:0,lid:0,bounce:0,breathe:1,glow:.35},
  listening:{tilt:-2.2,lift:4,lid:-.05,bounce:0,breathe:.8,glow:.6},
  thinking:{tilt:2.6,lift:2,lid:.18,bounce:0,breathe:.7,glow:.5},
  speaking:{tilt:-.8,lift:3,lid:0,bounce:0,breathe:.9,glow:.7},
  curious:{tilt:3.2,lift:3,lid:-.05,bounce:0,breathe:.9,glow:.55},
  confused:{tilt:-3.4,lift:0,lid:.08,bounce:0,breathe:.8,glow:.35},
  supportive:{tilt:-1.4,lift:-2,lid:.42,bounce:0,breathe:.6,glow:.5},
  happy:{tilt:1,lift:5,lid:.15,bounce:1,breathe:1.1,glow:.85},
  resting:{tilt:0,lift:-6,lid:.92,bounce:0,breathe:.5,glow:.2},
  greet:{tilt:-2,lift:6,lid:.1,bounce:.8,breathe:1.1,glow:.9},
  tilt:{tilt:4,lift:2,lid:-.05,bounce:0,breathe:.9,glow:.5},
  wag:{tilt:.8,lift:3,lid:.1,bounce:.6,breathe:1,glow:.75},
  sit:{tilt:0,lift:-2,lid:.08,bounce:0,breathe:.8,glow:.35}
 };
 // Rig coordinates in the artwork's own pixel space (695×904).
 const W=695,H=904,EYES=[{cx:360,cy:345,rx:40,ry:47},{cx:556,cy:306,rx:37,ry:45}];
 const SMILE={x1:390,y1:452,cx:470,cy:480,x2:569,y2:434};
 const SVG=`<svg class="kisha-svg kisha-v8" viewBox="-70 -60 ${W+140} ${H+110}" role="img" aria-labelledby="kisha-title" focusable="false">
 <title id="kisha-title">Kisha, tu Border Collie</title>
 <defs>
  <radialGradient id="kc-aura" cx="50%" cy="46%" r="55%"><stop offset="0" stop-color="#6fb6ff" stop-opacity=".55"/><stop offset=".45" stop-color="#7b6bff" stop-opacity=".22"/><stop offset="1" stop-color="#7b6bff" stop-opacity="0"/></radialGradient>
  <radialGradient id="kc-floor" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".6" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="kc-floorlight" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8fc3ff" stop-opacity=".45"/><stop offset="1" stop-color="#8fc3ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="kc-mouth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0a0f"/><stop offset="1" stop-color="#5a1620"/></linearGradient>
  ${EYES.map((e,i)=>`<clipPath id="kc-eye${i}"><ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx-2}" ry="${e.ry}"/></clipPath>`).join('')}
  <linearGradient id="kc-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25221f"/><stop offset=".7" stop-color="#34302b"/><stop offset="1" stop-color="#3d3833"/></linearGradient>
  <clipPath id="kc-mouthclip"><path class="kc-mouthclip-path" d=""/></clipPath>
 </defs>
 <g class="kc-aura-g"><circle class="kc-glow" cx="${W/2}" cy="${H*.46}" r="430" fill="url(#kc-aura)"/>
  <circle class="kc-ring r1" cx="${W/2}" cy="${H*.46}" r="390" fill="none" stroke="rgba(140,190,255,.35)" stroke-width="2" stroke-dasharray="3 14"/>
  <circle class="kc-ring r2" cx="${W/2}" cy="${H*.46}" r="440" fill="none" stroke="rgba(160,140,255,.22)" stroke-width="1.5" stroke-dasharray="120 40 10 40"/></g>
 <ellipse class="kc-floorlight" cx="${W/2}" cy="${H-6}" rx="330" ry="40" fill="url(#kc-floorlight)"/>
 <ellipse class="kc-shadow" cx="${W/2-10}" cy="${H-8}" rx="270" ry="30" fill="url(#kc-floor)"/>
 <g class="kc-body">
  <image href="kisha/kisha-collie.webp" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet"/>
  ${EYES.map((e,i)=>`<g clip-path="url(#kc-eye${i})"><rect class="kc-lid kc-lid${i}" x="${e.cx-e.rx-2}" y="${e.cy-e.ry-2}" width="${e.rx*2+4}" height="0" fill="url(#kc-lid)"/><path class="kc-lash kc-lash${i}" d="" fill="none" stroke="#120d09" stroke-width="5.5" stroke-linecap="round" opacity="0"/></g>`).join('')}
  <g class="kc-mouth" opacity="0"><path class="kc-mouth-fill" d="" fill="url(#kc-mouth)"/><g clip-path="url(#kc-mouthclip)"><ellipse class="kc-tongue" cx="480" cy="480" rx="34" ry="14" fill="#e47888"/><ellipse class="kc-tongue-hi" cx="472" cy="476" rx="12" ry="4" fill="#f6a5b0" opacity=".7"/></g><path class="kc-mouth-line" d="" fill="none" stroke="#1c120c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>
 </g>
</svg>`;
 const lerp=(a,b,k)=>a+(b-a)*k;
 function create(host,{reduced=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,animated=true}={}){
  host.innerHTML=SVG;host.classList.add('kisha-host');
  const q=s=>host.querySelector(s),el={body:q('.kc-body'),aura:q('.kc-aura-g'),glow:q('.kc-glow'),r1:q('.kc-ring.r1'),r2:q('.kc-ring.r2'),shadow:q('.kc-shadow'),floor:q('.kc-floorlight'),
   lids:[q('.kc-lid0'),q('.kc-lid1')],lashes:[q('.kc-lash0'),q('.kc-lash1')],mouth:q('.kc-mouth'),fill:q('.kc-mouth-fill'),line:q('.kc-mouth-line'),clip:q('.kc-mouthclip-path'),tongue:q('.kc-tongue'),tongueHi:q('.kc-tongue-hi')};
  let pose='idle',still=reduced||!animated,raf=0,hidden=document.hidden,mouth=0,mouthTarget=0,blinkT=0,blinkAt=performance.now()+1800,level=0;
  const cur={...P.idle};
  function mouthPath(o){const {x1,y1,cx,cy,x2,y2}=SMILE,drop=o*46;
   const top=`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
   const bottom=`Q${(cx+x2)/2+8} ${(cy+y2)/2+drop*.95} ${cx+6} ${cy-4+drop} Q${(x1+cx)/2-6} ${(y1+cy)/2+drop*.9} ${x1} ${y1}`;
   return {shape:`${top} ${bottom} Z`,line:`${top} ${bottom}`};}
  function apply(v,time){
   const s=time/1000,breath=still?0:Math.sin(s*2.1)*.008*v.breathe,hop=still?0:Math.max(0,Math.sin(s*5.2))*v.bounce*10;
   const talk=still?0:mouth*4*Math.sin(s*9),sway=still?0:Math.sin(s*.7)*.5;
   const rot=(v.tilt+sway).toFixed(3),ty=(-v.lift-hop-talk*.6).toFixed(2),sy=(1+breath).toFixed(4);
   el.body.setAttribute('transform',`translate(${W/2} ${H}) rotate(${rot}) translate(0 ${ty}) scale(${(1-breath*.4).toFixed(4)} ${sy}) translate(${-W/2} ${-H})`);
   el.shadow.setAttribute('rx',(270-hop*2).toFixed(1));el.shadow.setAttribute('opacity',(1-hop/40).toFixed(3));
   // Aura: energy follows pose and the live voice level.
   const e=Math.min(1,v.glow+level*.8),pulse=still?0:Math.sin(s*2.4)*.04;
   el.glow.setAttribute('opacity',(.45+e*.55+pulse).toFixed(3));el.glow.setAttribute('r',(400+e*60+level*40).toFixed(1));
   el.r1.setAttribute('transform',`rotate(${still?0:(s*12)%360} ${W/2} ${H*.46})`);el.r2.setAttribute('transform',`rotate(${still?0:-(s*7)%360} ${W/2} ${H*.46})`);
   el.r1.style.opacity=String(.35+e*.65);el.r2.style.opacity=String(.25+e*.5);el.floor.setAttribute('opacity',(.5+e*.5).toFixed(3));
   // Eyelids (pose baseline + blink).
   const blink=blinkT>0?Math.sin(Math.PI*Math.min(1,blinkT)):0,lid=Math.max(0,Math.min(1,v.lid+blink));
   EYES.forEach((eye,i)=>{const h=lid*(eye.ry*2+4);el.lids[i].setAttribute('height',h.toFixed(2));const y=eye.cy-eye.ry-2+h;
    const ly=Math.min(y-2,eye.cy+eye.ry*.45),dip=lid>.6?eye.ry*.28:3;el.lashes[i].setAttribute('d',`M${eye.cx-eye.rx+6} ${(ly-dip*.4).toFixed(1)} Q${eye.cx} ${(ly+dip).toFixed(1)} ${eye.cx+eye.rx-6} ${(ly-dip*.4).toFixed(1)}`);el.lashes[i].setAttribute('opacity',lid>.12?'1':'0');});
   // Mouth: opens only with real audio amplitude.
   const o=Math.min(1,mouth*1.15);
   if(o>.02){const p=mouthPath(o);el.fill.setAttribute('d',p.shape);el.clip.setAttribute('d',p.shape);el.line.setAttribute('d',p.line);
    el.tongue.setAttribute('cy',(SMILE.cy-6+o*36).toFixed(1));el.tongue.setAttribute('ry',(8+o*12).toFixed(1));el.tongueHi.setAttribute('cy',(SMILE.cy-10+o*34).toFixed(1));
    el.mouth.setAttribute('opacity',Math.min(1,o*5).toFixed(3));}else el.mouth.setAttribute('opacity','0');
  }
  function frame(time){raf=0;if(hidden)return;const tgt=P[pose],k=still?1:.1;
   for(const key of Object.keys(P.idle))cur[key]=lerp(cur[key],tgt[key],k);
   mouth=lerp(mouth,pose==='speaking'?mouthTarget:0,.5);if(pose!=='speaking'&&mouth<.01)mouth=0;
   level=lerp(level,pose==='speaking'?mouthTarget:0,.25);
   if(!still&&pose!=='resting'){if(time>blinkAt){blinkT=0.0001;blinkAt=time+2400+Math.random()*3600;if(Math.random()<.18)blinkAt=time+260;}if(blinkT>0){blinkT+=.14;if(blinkT>=1)blinkT=0;}}
   apply(cur,time);
   if(!still||pose==='speaking'||Math.abs(cur.tilt-tgt.tilt)>.02||Math.abs(cur.lid-tgt.lid)>.01)raf=requestAnimationFrame(frame);}
  function kick(){if(!raf&&!hidden)raf=requestAnimationFrame(frame);}
  function set(next){if(!POSES.includes(next))return false;pose=next;host.dataset.pose=next;if(next!=='speaking')mouthTarget=0;kick();return true;}
  /** Real audio amplitude 0..1 while speaking; ignored otherwise. */
  function setMouth(levelIn){if(pose!=='speaking')return;mouthTarget=Math.max(0,Math.min(1,Number(levelIn)||0));kick();}
  function setAnimated(on){still=reduced||!on;host.dataset.still=String(still);kick();}
  const vis=()=>{hidden=document.hidden;if(!hidden)kick();};document.addEventListener('visibilitychange',vis);
  host.dataset.still=String(still);set('idle');apply(cur,performance.now());
  return {set,setMouth,setAnimated,get pose(){return pose;},destroy(){cancelAnimationFrame(raf);raf=0;hidden=true;document.removeEventListener('visibilitychange',vis);}};
 }
 return Object.freeze({create,POSES});
})();
