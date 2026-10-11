'use strict';
/* EVIE neural core: a living, breathing sphere of connected nodes with light trails.
   Canvas 2D only (no WebGL) so it runs on any phone. Reacts to the assistant state
   (documentElement.dataset.evie = idle|listening|thinking|speaking) and to mic/voice level. */
window.EvieNeural=(()=>{
 let canvas=null,ctx=null,raf=null,nodes=[],edges=[],pulses=[],w=0,h=0,dpr=1,t0=0,visible=true,ro=null,io=null,mo=null,ptr={x:0,y:0,tx:0,ty:0},mic=0,out=0,energy=.2,ab=null;
 const palettes={
  idle:{a:[150,180,255],b:[190,160,255]},
  listening:{a:[110,231,255],b:[140,170,255]},
  thinking:{a:[200,150,255],b:[255,140,220]},
  speaking:{a:[120,255,214],b:[140,200,255]},
  error:{a:[255,140,150],b:[255,190,140]}
 };
 let col={a:[...palettes.idle.a],b:[...palettes.idle.b]};
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.paused==='true';
 const phase=()=>document.documentElement.dataset.evie||'idle';
 function build(){
  nodes=[];edges=[];pulses=[];
  const n=innerWidth<600?64:88,golden=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<n;i++){const y=1-(i/(n-1))*2,r=Math.sqrt(1-y*y),th=golden*i;const j=.82+Math.random()*.3;nodes.push({x:Math.cos(th)*r*j,y:y*j,z:Math.sin(th)*r*j,s:Math.random()*Math.PI*2,size:.6+Math.random()*1.6,hub:Math.random()<.12});}
  // satellites orbiting outside the sphere
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;nodes.push({x:Math.cos(a)*1.45,y:(Math.random()-.5)*.7,z:Math.sin(a)*1.45,s:a,size:1.4,hub:true,sat:true});}
  for(let i=0;i<nodes.length;i++){const d=[];for(let j=0;j<nodes.length;j++)if(i!==j){const a=nodes[i],b=nodes[j];d.push([(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2,j]);}d.sort((p,q)=>p[0]-q[0]);const k=nodes[i].hub?4:2;for(let m=0;m<k;m++){const j=d[m][1];if(i<j||!edges.some(e=>e[0]===j&&e[1]===i))edges.push([i,j,Math.random()]);}}
 }
 function size(){if(!canvas)return;const r=canvas.getBoundingClientRect();dpr=Math.min(2,devicePixelRatio||1);w=Math.max(1,r.width);h=Math.max(1,r.height);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
 const mix=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
 function frame(now){
  raf=null;if(!canvas?.isConnected){stop();return;}if(document.hidden)return;
  const light=document.documentElement.dataset.theme==='light';const t=(now-t0)/1000,p=phase(),base=palettes[p]||palettes.idle,pal=light?{a:base.a.map(v=>v*.45),b:base.b.map(v=>v*.5)}:base;
  col.a=mix(col.a,pal.a,.04);col.b=mix(col.b,pal.b,.04);
  const target=({idle:.18,listening:.45,thinking:.75,speaking:.55,error:.3}[p]||.2)+mic*1.4+out*1.2;
  energy+=(Math.min(1.6,target)-energy)*.07;
  ptr.x+=(ptr.tx-ptr.x)*.05;ptr.y+=(ptr.ty-ptr.y)*.05;
  // fade previous frame -> light trails, keeps transparency of the glass behind
  ctx.globalCompositeOperation='destination-out';ctx.fillStyle=`rgba(0,0,0,${reduced()?1:.22})`;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation=light?'source-over':'lighter';
  const cx=w/2,cy=h/2,R=Math.min(w,h)*.33*(1+energy*.06+Math.sin(t*1.3)*.012),rotY=t*(.12+energy*.25)+ptr.x*.6,rotX=Math.sin(t*.2)*.25+ptr.y*.4;
  const cy1=Math.cos(rotY),sy1=Math.sin(rotY),cx1=Math.cos(rotX),sx1=Math.sin(rotX);
  const P=nodes.map(nd=>{let {x,y,z}=nd;if(nd.sat){const a=nd.s+t*.35;x=Math.cos(a)*1.45;z=Math.sin(a)*1.45;}
   const wob=1+Math.sin(t*1.7+nd.s)*.035*(1+energy*2);x*=wob;y*=wob;z*=wob;
   const x1=x*cy1-z*sy1,z1=x*sy1+z*cy1,y1=y*cx1-z1*sx1,z2=y*sx1+z1*cx1,f=2.6/(2.6+z2);
   return {x:cx+x1*R*f,y:cy+y1*R*f,z:z2,f};});
  // curved edges
  ctx.lineWidth=.7;
  for(const [i,j,seed] of edges){const a=P[i],b=P[j],depth=(2-(a.z+b.z)/2)/3,alpha=Math.max(.03,Math.min(.55,depth*.38*(.6+energy*.6)));
   const c=mix(col.a,col.b,seed);ctx.strokeStyle=`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${alpha})`;
   const mx=(a.x+b.x)/2+(cy-(a.y+b.y)/2)*.18*Math.sin(t*.6+seed*6),my=(a.y+b.y)/2+((a.x+b.x)/2-cx)*.18*Math.cos(t*.5+seed*6);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mx,my,b.x,b.y);ctx.stroke();}
  // signals traveling along edges
  if(!reduced()&&Math.random()<.08+energy*.35&&pulses.length<40)pulses.push({e:edges[(Math.random()*edges.length)|0],k:0,v:.008+Math.random()*.02+energy*.02});
  for(const s of pulses){s.k+=s.v;const a=P[s.e[0]],b=P[s.e[1]],k=s.k,mx=(a.x+b.x)/2+(cy-(a.y+b.y)/2)*.18*Math.sin(t*.6+s.e[2]*6),my=(a.y+b.y)/2+((a.x+b.x)/2-cx)*.18*Math.cos(t*.5+s.e[2]*6);
   const x=(1-k)**2*a.x+2*(1-k)*k*mx+k*k*b.x,y=(1-k)**2*a.y+2*(1-k)*k*my+k*k*b.y,g=ctx.createRadialGradient(x,y,0,x,y,6);
   g.addColorStop(0,light?'rgba(60,70,200,.9)':'rgba(255,255,255,.95)');g.addColorStop(.4,`rgba(${col.a[0]|0},${col.a[1]|0},${col.a[2]|0},.5)`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-6,y-6,12,12);}
  pulses=pulses.filter(s=>s.k<1);
  // nodes
  for(let i=0;i<P.length;i++){const p=P[i],nd=nodes[i],depth=(2-p.z)/3,r=nd.size*p.f*(nd.hub?1.6:1)*(1+Math.sin(t*2+nd.s)*.2*energy);
   const c=nd.hub?col.b:col.a;ctx.fillStyle=`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${Math.min(1,.25+depth*.7)})`;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.4,r),0,7);ctx.fill();
   if(nd.hub&&depth>.5){ctx.fillStyle=light?`rgba(80,90,210,${.10*depth*(1+energy)})`:`rgba(255,255,255,${.12*depth*(1+energy)})`;ctx.beginPath();ctx.arc(p.x,p.y,r*3.2,0,7);ctx.fill();}}
  // core glow
  const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,R*1.1);glow.addColorStop(0,`rgba(${col.a[0]|0},${col.a[1]|0},${col.a[2]|0},${.05+energy*.08})`);glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='source-over';
  mic*=.9;out*=.9;
  if(raf===null&&visible&&!document.hidden&&!reduced())raf=requestAnimationFrame(frame);
 }
 // Exactly one loop: kick() never schedules a second frame; reduced/paused draws one static frame without RAF.
 function kick(){if(!canvas||!canvas.isConnected||document.hidden||!visible)return;if(reduced()){if(raf!==null){cancelAnimationFrame(raf);raf=null;}frame(performance.now());return;}if(raf===null)raf=requestAnimationFrame(frame);}
 function pause(){if(raf!==null)cancelAnimationFrame(raf);raf=null;}
 function mount(el){
  if(!el)return false;if(el===canvas){kick();return true;}stop();canvas=el;try{ctx=canvas.getContext('2d');}catch{ctx=null;}if(!ctx)return false;
  canvas.dataset.renderer='evie';canvas.parentElement?.setAttribute('data-renderer','evie');build();size();t0=performance.now();ab=new AbortController();
  ro=new ResizeObserver(()=>{size();if(reduced())frame(performance.now());});ro.observe(canvas);
  io=new IntersectionObserver(([en])=>{visible=en.isIntersecting;if(visible)kick();else pause();});io.observe(canvas);
  mo=new MutationObserver(()=>kick());mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','data-paused','data-theme']});
  addEventListener('pointermove',ev=>{ptr.tx=(ev.clientX/innerWidth-.5);ptr.ty=(ev.clientY/innerHeight-.5);if(reduced())return;kick();},{signal:ab.signal,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else kick();},{signal:ab.signal});
  canvas.addEventListener('contextlost',ev=>{ev.preventDefault();pause();canvas.parentElement?.setAttribute('data-renderer','css-fallback');},{signal:ab.signal});
  canvas.addEventListener('contextrestored',()=>{canvas.parentElement?.setAttribute('data-renderer','evie');size();kick();},{signal:ab.signal});
  addEventListener('pagehide',pause,{signal:ab.signal});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',kick,{signal:ab.signal});
  kick();return true;
 }
 function stop(){pause();ro?.disconnect();io?.disconnect();mo?.disconnect();ab?.abort();ro=io=mo=ab=null;if(canvas)delete canvas.dataset.renderer;canvas=null;ctx=null;visible=true;}
 return Object.freeze({mount,stop,kick,setMic:v=>{mic=Math.max(mic,Math.min(1,+v||0));kick();},setOut:v=>{out=Math.max(out,Math.min(1,+v||0));kick();},stats:()=>({mounted:!!canvas,renderer:canvas?1:0,raf:raf!==null,observers:(ro?1:0)+(io?1:0)+(mo?1:0),nodes:nodes.length,edges:edges.length,energy})});
})();
