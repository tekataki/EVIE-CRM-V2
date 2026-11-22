'use strict';
/* EVIE v10 · Holograma de la Misión (Three.js vendorizado). Una moto deportiva de líneas que se ARMA pieza por pieza
   con tu avance (las piezas que faltan se ven como contorno tenue y la siguiente parpadea). Las piezas ganadas desde
   tu última visita entran volando. Otro tipo de misión: núcleo de capas. Mismo ciclo de vida que PigHologram: se
   pausa fuera de pantalla o con la pestaña oculta, respeta movimiento reducido (queda la silueta SVG) y libera la GPU
   al salir. Decorativo: el avance real está en el texto. */
window.MissionHologram=(()=>{
 let epoch=0,cleanup=null,active=false,metrics={frames:0,parts:0,built:0,paused:true};
 const SEEN='evie-mission-seen';
 function stop(){epoch++;cleanup?.();cleanup=null;active=false;metrics={frames:0,parts:0,built:0,paused:true};}
 const reduced=()=>window.Neural?.reduced?.()||matchMedia('(prefers-reduced-motion: reduce)').matches||!!Store.get()?.preferences?.motionPaused;
 async function mount(host){stop();host=host||document.querySelector('.ms-visual');const fallback=host?.querySelector('.ms-silhouette');if(!host||!fallback)return;const ticket=epoch;
  const pct=Math.max(0,Math.min(100,Number(host.dataset.progress)||0)),kind=host.dataset.kind==='orb'?'orb':'moto';
  if(reduced())return;
  try{const T=await import('./vendor/three.module.min.js');if(ticket!==epoch||!host.isConnected)return;
   const light=document.documentElement.dataset.theme==='light';
   const canvas=document.createElement('canvas');canvas.className='ms-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Holograma de la misión armado al ${Math.round(pct)} por ciento. Decorativo.`);canvas.tabIndex=0;
   const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);host.prepend(canvas);fallback.setAttribute('hidden','');active=true;
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.1,100);camera.position.set(4.1,2.15,5.3);camera.lookAt(0,.92,0);
   const C=light?{line:0x1d4fd8,fill:0x3d7bff,next:0x0a86a8,ghost:0x7f90b8,grid:0x9fb0d6}:{line:0xa6f3ff,fill:0x62f0ff,next:0xb69cff,ghost:0x7d93c7,grid:0x2f4a74};
   const blend=light?T.NormalBlending:T.AdditiveBlending;
   const mats={line:new T.LineBasicMaterial({color:C.line,transparent:true,opacity:light?.9:.85,blending:blend}),fill:new T.MeshBasicMaterial({color:C.fill,transparent:true,opacity:light?.08:.11,blending:blend,depthWrite:false,side:T.DoubleSide}),
    next:new T.LineBasicMaterial({color:C.next,transparent:true,opacity:.5,blending:blend}),ghost:new T.LineBasicMaterial({color:C.ghost,transparent:true,opacity:light?.34:.28})};
   const bike=new T.Group();scene.add(bike);const parts=[];
   function part(label){const g=new T.Group();bike.add(g);const p={label,group:g,lines:[],fills:[]};parts.push(p);return p;}
   function add(p,geo,{x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,fill=true}={}){const h=new T.Group();h.position.set(x,y,z);h.rotation.set(rx,ry,rz);h.scale.set(sx,sy,sz);
    const line=new T.LineSegments(new T.EdgesGeometry(geo,22),mats.ghost);h.add(line);p.lines.push(line);if(fill){const m=new T.Mesh(geo,mats.fill);m.visible=false;h.add(m);p.fills.push(m);}else geo.dispose();p.group.add(h);return h;}
   const tube=(pts,r=.04)=>new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(([x,y,z])=>new T.Vector3(x,y,z))),28,r,6,false);
   if(kind==='moto'){
    const wheel=(label,x)=>{const p=part(label);add(p,new T.TorusGeometry(.6,.11,10,44),{x,y:.62});add(p,new T.TorusGeometry(.42,.022,6,40),{x,y:.62,fill:false});
     for(let i=0;i<5;i++){const a=i/5*Math.PI*2;add(p,new T.CylinderGeometry(.016,.016,.4,5),{x:x+Math.cos(a)*.21,y:.62+Math.sin(a)*.21,rz:a+Math.PI/2,fill:false});}
     add(p,new T.CylinderGeometry(.09,.09,.24,12),{x,y:.62,rx:Math.PI/2});add(p,new T.TorusGeometry(.26,.012,4,30),{x,y:.62,z:.1,fill:false});};
    wheel('Rueda trasera',-1.42);wheel('Rueda delantera',1.42);
    {const p=part('Chasis');for(const z of [-.2,.2]){add(p,tube([[.98,1.56,z*.55],[.58,1.27,z],[.06,1.08,z],[-.38,.98,z]],.045));add(p,tube([[-.36,1.0,z],[-.74,1.24,z*.85],[-1.12,1.42,z*.6]],.028),{fill:false});}}
    {const p=part('Basculante');for(const z of [-.21,.21])add(p,tube([[-.36,.96,z],[-.9,.79,z],[-1.42,.62,z]],.055));add(p,new T.CylinderGeometry(.05,.05,.46,10),{x:-.36,y:.96,rx:Math.PI/2});}
    {const p=part('Suspensión');for(const z of [-.17,.17])add(p,tube([[1.0,1.63,z],[1.21,1.12,z],[1.42,.62,z]],.042));add(p,new T.BoxGeometry(.14,.06,.5),{x:1.0,y:1.65});add(p,new T.CylinderGeometry(.04,.04,.5,8),{x:-.62,y:1.02,rz:.9});}
    {const p=part('Motor');add(p,new T.BoxGeometry(.86,.6,.46),{x:.26,y:.79,rz:.08});for(let i=0;i<4;i++)add(p,new T.CylinderGeometry(.095,.095,.4,10),{x:.1+i*.16,y:1.12,rz:-.38,fill:false});add(p,new T.CylinderGeometry(.16,.16,.5,14),{x:-.05,y:.62,rx:Math.PI/2,fill:false});}
    {const p=part('Tanque');add(p,new T.SphereGeometry(1,20,10),{x:.42,y:1.44,sx:.5,sy:.21,sz:.27,rz:-.12});add(p,new T.CylinderGeometry(.07,.07,.03,12),{x:.36,y:1.66});}
    {const p=part('Asiento y cola');add(p,new T.BoxGeometry(.72,.09,.3),{x:-.38,y:1.31,rz:.13});add(p,new T.ConeGeometry(.21,.95,4),{x:-1.02,y:1.45,rz:Math.PI/2+.2,ry:Math.PI/4,sz:.62});add(p,new T.BoxGeometry(.06,.05,.22),{x:-1.48,y:1.36});}
    {const p=part('Carenado');add(p,new T.ConeGeometry(.35,.92,5),{x:1.34,y:1.3,rz:-Math.PI/2+.36,sz:.7});add(p,new T.PlaneGeometry(.44,.34),{x:1.13,y:1.68,ry:Math.PI/2,rx:-.55});add(p,new T.SphereGeometry(.09,12,8),{x:1.74,y:1.19,sx:.6,sz:1.5});for(const z of [-.27,.27])add(p,new T.PlaneGeometry(.95,.46),{x:.58,y:.96,z,rz:-.16});}
    {const p=part('Escape');add(p,tube([[.02,.5,.22],[-.42,.6,.3],[-.84,.95,.29]],.05));add(p,new T.CylinderGeometry(.09,.115,.48,14),{x:-1.0,y:1.06,z:.29,rz:Math.PI/2-.45});}
    {const p=part('Manubrio y luces');for(const z of [-.31,.31]){add(p,new T.CylinderGeometry(.024,.024,.3,6),{x:.95,y:1.68,z,rx:Math.PI/2,ry:.35,fill:false});add(p,new T.BoxGeometry(.03,.07,.13),{x:1.05,y:1.83,z:z*1.12});}add(p,new T.SphereGeometry(.05,8,6),{x:-1.5,y:1.4,sx:.5});}
   }else{
    for(let i=0;i<8;i++){const p=part('Capa '+(i+1)),r=.3+i*.16;add(p,i%2?new T.TorusGeometry(r,.012,4,60):new T.IcosahedronGeometry(r*.75,i>3?1:0),{y:1.1,rx:i*.4,ry:i*.7,fill:i%2===0});}
   }
   // Assembly state: built parts solid, the next one pulses, the rest is a faint outline.
   const n=parts.length,exact=pct/100*n,built=Math.min(n,Math.floor(exact+1e-9)),next=built<n?parts[built]:null;
   let seen=0;try{seen=Number(localStorage.getItem(SEEN+':'+kind))||0;}catch{}
   const fresh=new Set();const was=Math.min(n,Math.floor(seen/100*n+1e-9));for(let i=was;i<built;i++)fresh.add(parts[i]);
   parts.forEach((p,i)=>{const done=i<built;p.lines.forEach(l=>l.material=done?mats.line:p===next?mats.next:mats.ghost);p.fills.forEach(f=>f.visible=done);if(fresh.has(p)){p.group.userData.t0=null;p.group.userData.delay=[...fresh].indexOf(p)*260;p.group.position.y=1.2;p.group.scale.setScalar(.6);}});
   try{localStorage.setItem(SEEN+':'+kind,String(pct));}catch{}
   metrics.parts=n;metrics.built=built;
   // Stage: polar grid, scanning ring, rising particles.
   const grid=new T.PolarGridHelper(2.7,16,6,64,C.grid,C.grid);grid.material.transparent=true;grid.material.opacity=light?.55:.5;scene.add(grid);
   const ring=new T.Mesh(new T.TorusGeometry(2.25,.008,4,96),new T.MeshBasicMaterial({color:C.next,transparent:true,opacity:.55,blending:blend}));ring.rotation.x=Math.PI/2;scene.add(ring);
   const pts=new Float32Array(140*3);for(let i=0;i<140;i++){const a=i*2.39,r=1.2+(i%9)/6;pts[i*3]=Math.cos(a)*r;pts[i*3+1]=(i*.037)%2.4;pts[i*3+2]=Math.sin(a)*r;}
   const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(pts,3));const dust=new T.Points(pg,new T.PointsMaterial({color:C.line,size:.022,transparent:true,opacity:light?.45:.5,blending:blend,depthWrite:false}));scene.add(dust);
   bike.rotation.y=-.5;let frame=null,visible=true,hover=false,last=0,start=0;const can=()=>visible&&!document.hidden&&canvas.isConnected&&!reduced();
   // Fill the stage: on desktop the host is stretched by the stats column, on phones it follows the width.
   function resize(){const w=host.clientWidth||320,h=Math.round(Math.max(200,Math.min(460,Math.max(w*.62,(host.clientHeight||0)-2))));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);}
   const ro=new ResizeObserver(resize);ro.observe(host);resize();
   function loop(t){frame=null;if(!can())return;if(!start)start=t;if(t-last>40){const dt=Math.min(t-last,100);bike.rotation.y+=dt*.00022*(hover?1.6:1);bike.position.y=Math.sin(t*.0012)*.03;
     mats.next.opacity=.25+.3*(.5+.5*Math.sin(t*.004));ring.position.y=1.05+Math.sin(t*.0009)*1.0;ring.material.opacity=.25+.3*(1-Math.abs(Math.sin(t*.0009)));dust.rotation.y=t*.00005;const arr=pg.attributes.position.array;for(let i=1;i<arr.length;i+=3){arr[i]+=dt*.00025;if(arr[i]>2.4)arr[i]=0;}pg.attributes.position.needsUpdate=true;
     for(const p of fresh){const u=p.group.userData,k=Math.max(0,Math.min(1,(t-start-u.delay)/900)),ease=1-Math.pow(1-k,3);p.group.position.y=1.2*(1-ease);p.group.scale.setScalar(.6+.4*ease);if(k>=1)fresh.delete(p);}
     metrics.frames++;metrics.paused=false;renderer.render(scene,camera);last=t;}frame=requestAnimationFrame(loop);}
   const io=new IntersectionObserver(rows=>{visible=rows[0].isIntersecting;metrics.paused=!can();if(can()&&frame===null)frame=requestAnimationFrame(loop);else if(!visible&&frame!==null){cancelAnimationFrame(frame);frame=null;}});io.observe(canvas);
   const events=new AbortController();for(const name of ['pointerenter','focus'])canvas.addEventListener(name,()=>hover=true,{signal:events.signal});for(const name of ['pointerleave','blur'])canvas.addEventListener(name,()=>hover=false,{signal:events.signal});
   canvas.addEventListener('webglcontextlost',ev=>{ev.preventDefault();stop();},{signal:events.signal});
   cleanup=()=>{if(frame!==null)cancelAnimationFrame(frame);io.disconnect();ro.disconnect();events.abort();const geos=new Set(),ms=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)ms.add(o.material);});for(const g of geos)g.dispose();for(const m of ms)m.dispose();Object.values(mats).forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();fallback.removeAttribute('hidden');};
   frame=requestAnimationFrame(loop);
  }catch{fallback.removeAttribute('hidden');active=false;}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(window.DALI_READY&&['objetivos','finanzas'].includes(UI.section)&&document.querySelector('.ms-visual'))mount();});window.addEventListener('pagehide',stop);
 return Object.freeze({mount,stop,stats:()=>({renderer:active?1:0,...metrics})});
})();
