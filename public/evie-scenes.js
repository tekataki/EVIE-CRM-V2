'use strict';
/* EVIE · section scenes (v11 · Onyx). Small generative illustrations for every section hero: monochrome lines with the
   section's accent glow that keep moving a little (finance flows, a heartbeat, a sales radar, a 3D crystal…).
   Performance: one shared requestAnimationFrame loop at ~30 fps; a scene only draws while it is on screen, attached and
   the tab is visible; device pixel ratio capped at 2 (lower on phones); reduced motion draws one still frame. */
window.EvieScenes=(()=>{
 const live=new Set();let raf=0,last=0,io=null,ro=null;
 const TAU=Math.PI*2;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.paused==='true';
 const isLight=()=>document.documentElement.dataset.theme==='light';
 const rnd=seed=>{let x=Math.sin(seed)*1e4;return ()=>{x=Math.sin(x*12.9898+78.233)*43758.5453;return x-Math.floor(x);};};
 function pal(s){const L=isLight(),ink=L?'9,9,11':'255,255,255';return {L,a:n=>`rgba(${s.rgb},${n})`,i:n=>`rgba(${ink},${L?n*.9:n})`};}

 /* ---------------- scenes: draw(s, ctx, w, h, t, P) — s.st holds per-size state (rebuilt on resize) ---------------- */
 const S={
  flow(s,x,w,h,t,P){
   const bars=Math.max(8,Math.round(w/34)),bw=w/bars*.44;
   for(let b=0;b<bars;b++){const v=.28+.55*Math.abs(Math.sin(b*1.7+t*.55+Math.sin(b*.7)*2)),bh=h*.46*v,bx=w*(b+.5)/bars-bw/2,by=h-bh-4;
    const g=x.createLinearGradient(0,by,0,h);g.addColorStop(0,P.i(.2));g.addColorStop(1,P.i(0));x.fillStyle=g;x.fillRect(bx,by,bw,bh);x.fillStyle=P.i(.5);x.fillRect(bx,by,bw,1.5);}
   for(let k=0;k<6;k++){x.beginPath();const amp=h*(.05+k*.012),base=h*(.24+k*.08),ph=t*(.5+k*.07)+k*.9;
    for(let i=0;i<=48;i++){const px=w*i/48,py=base+Math.sin(i*.26+ph)*amp+Math.sin(i*.1-ph*.6)*amp*.7;i?x.lineTo(px,py):x.moveTo(px,py);}
    const hot=k===2;x.strokeStyle=hot?P.a(.95):P.i(.06+k*.02);x.lineWidth=hot?1.8:1;if(hot){x.shadowColor=P.a(.9);x.shadowBlur=14;}x.stroke();x.shadowBlur=0;}
   const u=(t*.12)%1,px=w*u,py=h*.24+h*.08*2+Math.sin(u*48*.26+t*(.5+.14)+1.8)*h*.074;x.fillStyle=P.a(1);x.beginPath();x.arc(px,py,3,0,TAU);x.fill();},
  pulse(s,x,w,h,t,P){
   const cy=h*.56,amp=h*.3,f=u=>u<.18?0:u<.26?Math.sin((u-.18)/.08*Math.PI)*.12:u<.44?0:u<.47?-(u-.44)/.03*.18:u<.5?-.18+(u-.47)/.03*1.18:u<.53?1-(u-.5)/.03*1.35:u<.56?-.35+(u-.53)/.03*.35:u<.66?0:u<.8?Math.sin((u-.66)/.14*Math.PI)*.26:0;
   const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,P.a(0));g.addColorStop(.7,P.a(.55));g.addColorStop(1,P.a(1));
   x.beginPath();for(let px=0;px<=w;px+=2){const u=(((px-t*140)%260)+260)%260/260,y=cy-f(u)*amp;px?x.lineTo(px,y):x.moveTo(px,y);}
   x.strokeStyle=g;x.lineWidth=1.8;x.shadowColor=P.a(.8);x.shadowBlur=10;x.stroke();x.shadowBlur=0;
   x.strokeStyle=P.i(.06);x.lineWidth=1;for(let gy=h*.2;gy<h;gy+=h*.2){x.beginPath();x.moveTo(0,gy);x.lineTo(w,gy);x.stroke();}
   const cx=w*.84;for(let k=0;k<3;k++){const p=((t*.45+k/3)%1);x.beginPath();x.arc(cx,cy,8+p*h*.42,0,TAU);x.strokeStyle=P.a(.5*(1-p));x.lineWidth=1.2;x.stroke();}
   x.fillStyle=P.a(.95);x.beginPath();x.arc(cx,cy,4+Math.sin(t*6)*1.2,0,TAU);x.fill();},
  radar(s,x,w,h,t,P){
   const cx=w*.7,cy=h*.55,R=Math.min(w*.42,h*.9);if(!s.st){const r=rnd(s.seed);s.st={dots:Array.from({length:14},()=>({a:r()*TAU,d:.2+r()*.75}))};}
   x.lineWidth=1;for(let k=1;k<=4;k++){x.beginPath();x.arc(cx,cy,R*k/4,0,TAU);x.strokeStyle=P.i(.07+k*.01);x.stroke();}
   x.beginPath();x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.strokeStyle=P.i(.05);x.stroke();
   const a=(t*.9)%TAU;
   if(x.createConicGradient){const g=x.createConicGradient(a-1.1,cx,cy);g.addColorStop(0,P.a(0));g.addColorStop(.17,P.a(.28));g.addColorStop(.175,P.a(0));g.addColorStop(1,P.a(0));x.fillStyle=g;x.beginPath();x.arc(cx,cy,R,0,TAU);x.fill();}
   x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);x.strokeStyle=P.a(.85);x.lineWidth=1.4;x.stroke();
   for(const d of s.st.dots){const since=((a-d.a)%TAU+TAU)%TAU,glow=Math.max(0,1-since/2.4),px=cx+Math.cos(d.a)*R*d.d,py=cy+Math.sin(d.a)*R*d.d;
    x.fillStyle=glow>.05?P.a(.25+glow*.75):P.i(.18);x.beginPath();x.arc(px,py,1.6+glow*2.4,0,TAU);x.fill();
    if(glow>.6){x.strokeStyle=P.a((glow-.6)*1.5);x.beginPath();x.arc(px,py,4+(1-glow)*16,0,TAU);x.stroke();}}},
  orbits(s,x,w,h,t,P){
   const cx=w*.7,cy=h*.55,R=Math.min(w*.4,h*.85);x.lineWidth=1;
   for(let k=0;k<60;k++){const an=k/60*TAU-t*.05,r1=R,r2=R-(k%5?5:11);x.beginPath();x.moveTo(cx+Math.cos(an)*r1,cy+Math.sin(an)*r1);x.lineTo(cx+Math.cos(an)*r2,cy+Math.sin(an)*r2);x.strokeStyle=P.i(k%5?.12:.32);x.stroke();}
   const rings=[[.78,.35,.9],[.56,-.6,.6],[.34,1.1,.4]];
   for(const [rr,sp,len] of rings){const r=R*rr,st=t*sp;x.beginPath();x.arc(cx,cy,r,0,TAU);x.strokeStyle=P.i(.07);x.stroke();
    x.beginPath();x.arc(cx,cy,r,st,st+len*Math.PI);x.strokeStyle=P.a(.8);x.lineWidth=2;x.shadowColor=P.a(.8);x.shadowBlur=10;x.stroke();x.shadowBlur=0;x.lineWidth=1;
    x.fillStyle=P.a(1);x.beginPath();x.arc(cx+Math.cos(st+len*Math.PI)*r,cy+Math.sin(st+len*Math.PI)*r,3,0,TAU);x.fill();}
   x.fillStyle=P.i(.85);x.beginPath();x.arc(cx,cy,3,0,TAU);x.fill();},
  target(s,x,w,h,t,P){
   const cx=w*.7,cy=h*.55,R=Math.min(w*.38,h*.82);
   for(let k=5;k>=1;k--){const p=(Math.sin(t*1.4-k*.6)+1)/2;x.beginPath();x.arc(cx,cy,R*k/5,0,TAU);x.strokeStyle=k===1?P.a(.9):P.i(.06+p*.12);x.lineWidth=k===1?2:1;x.stroke();}
   if(!s.st){const r=rnd(s.seed);s.st={p:Array.from({length:22},()=>({a:r()*TAU,o:r(),sp:.25+r()*.4}))};}
   for(const q of s.st.p){const u=(t*q.sp+q.o)%1,d=R*1.6*(1-u),px=cx+Math.cos(q.a)*d,py=cy+Math.sin(q.a)*d;x.strokeStyle=P.a(.15+u*.6);x.beginPath();x.moveTo(px,py);x.lineTo(cx+Math.cos(q.a)*(d+14),cy+Math.sin(q.a)*(d+14));x.stroke();}
   x.fillStyle=P.a(1);x.shadowColor=P.a(1);x.shadowBlur=16;x.beginPath();x.arc(cx,cy,4,0,TAU);x.fill();x.shadowBlur=0;},
  crystal(s,x,w,h,t,P){
   if(!s.st){const p=(1+Math.sqrt(5))/2,v=[[-1,p,0],[1,p,0],[-1,-p,0],[1,-p,0],[0,-1,p],[0,1,p],[0,-1,-p],[0,1,-p],[p,0,-1],[p,0,1],[-p,0,-1],[-p,0,1]];
    const e=[];for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){const d=Math.hypot(v[i][0]-v[j][0],v[i][1]-v[j][1],v[i][2]-v[j][2]);if(Math.abs(d-2)<.01)e.push([i,j]);}const r=rnd(s.seed);s.st={v,e,motes:Array.from({length:30},()=>({x:r(),y:r(),z:r()}))};}
   const cx=w*.7,cy=h*.54,R=Math.min(w*.2,h*.36),ay=t*.45,ax=t*.27,pr=s.st.v.map(([a,b,c])=>{let X=a*Math.cos(ay)-c*Math.sin(ay),Z=a*Math.sin(ay)+c*Math.cos(ay),Y=b*Math.cos(ax)-Z*Math.sin(ax);Z=b*Math.sin(ax)+Z*Math.cos(ax);const k=3.2/(3.2+Z*.5);return [cx+X*R*k,cy+Y*R*k,Z];});
   for(const [i,j] of s.st.e){const z=(pr[i][2]+pr[j][2])/2;x.strokeStyle=z<0?P.a(.75):P.i(.16);x.lineWidth=z<0?1.4:1;x.beginPath();x.moveTo(pr[i][0],pr[i][1]);x.lineTo(pr[j][0],pr[j][1]);x.stroke();}
   for(const p of pr){x.fillStyle=p[2]<0?P.a(1):P.i(.4);x.beginPath();x.arc(p[0],p[1],p[2]<0?2.6:1.6,0,TAU);x.fill();}
   for(const m of s.st.motes){const yy=((m.y-t*.03*(.5+m.z))%1+1)%1;x.fillStyle=P.i(.1+m.z*.25);x.fillRect(w*(.35+m.x*.65),h*yy,1.5,1.5);}},
  network(s,x,w,h,t,P){
   if(!s.st){const r=rnd(s.seed);s.st={n:Array.from({length:26},(_,k)=>({x:.3+r()*.7,y:r(),vx:(r()-.5)*.02,vy:(r()-.5)*.02,hub:k<4}))};}
   const n=s.st.n;for(const p of n){p.x+=p.vx*.016*3;p.y+=p.vy*.016*3;if(p.x<.28||p.x>1)p.vx*=-1;if(p.y<0||p.y>1)p.vy*=-1;}
   for(let i=0;i<n.length;i++)for(let j=i+1;j<n.length;j++){const dx=(n[i].x-n[j].x)*w,dy=(n[i].y-n[j].y)*h,d=Math.hypot(dx,dy);if(d<130){x.strokeStyle=(n[i].hub||n[j].hub)?P.a(.5*(1-d/130)):P.i(.14*(1-d/130));x.lineWidth=1;x.beginPath();x.moveTo(n[i].x*w,n[i].y*h);x.lineTo(n[j].x*w,n[j].y*h);x.stroke();}}
   for(const p of n){x.fillStyle=p.hub?P.a(1):P.i(.5);x.beginPath();x.arc(p.x*w,p.y*h,p.hub?3.2+Math.sin(t*3+p.x*9)*.8:1.6,0,TAU);x.fill();}},
  constellation(s,x,w,h,t,P){
   if(!s.st){const r=rnd(s.seed);s.st={n:Array.from({length:44},()=>({a:r()*TAU,r:.15+r()*.85,sp:(r()-.5)*.15,z:r()}))};}
   const cx=w*.72,cy=h*.5,R=Math.min(w*.36,h*.95),pts=s.st.n.map(p=>[cx+Math.cos(p.a+t*p.sp)*R*p.r,cy+Math.sin(p.a+t*p.sp)*R*p.r*.62,p.z]);
   for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const d=Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]);if(d<70){x.strokeStyle=P.i(.12*(1-d/70));x.beginPath();x.moveTo(pts[i][0],pts[i][1]);x.lineTo(pts[j][0],pts[j][1]);x.stroke();}}
   pts.forEach((p,k)=>{x.fillStyle=k%7?P.i(.25+p[2]*.4):P.a(.95);x.beginPath();x.arc(p[0],p[1],k%7?1.3:2.6,0,TAU);x.fill();});
   const g=x.createRadialGradient(cx,cy,0,cx,cy,R*.5);g.addColorStop(0,P.a(.22));g.addColorStop(1,P.a(0));x.fillStyle=g;x.fillRect(0,0,w,h);},
  dots(s,x,w,h,t,P){
   const gap=18,cols=Math.ceil(w/gap),rows=Math.ceil(h/gap);
   for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){const px=c*gap+gap/2,py=r*gap+gap/2,wave=Math.sin(c*.35-r*.2-t*2.2),on=wave>.82;x.fillStyle=on?P.a(.35+(wave-.82)*3.6):P.i(.07+Math.max(0,wave)*.06);const sz=on?3.4:2;x.fillRect(px-sz/2,py-sz/2,sz,sz);}},
  terrain(s,x,w,h,t,P){
   const hor=h*.38,cols=24,rows=14,sun=x.createRadialGradient(w*.72,hor,0,w*.72,hor,h*.42);sun.addColorStop(0,P.a(.55));sun.addColorStop(.35,P.a(.18));sun.addColorStop(1,P.a(0));x.fillStyle=sun;x.fillRect(0,0,w,hor+4);
   x.beginPath();x.arc(w*.72,hor,h*.16,Math.PI,0);x.strokeStyle=P.a(.8);x.lineWidth=1.5;x.stroke();x.lineWidth=1;
   const hgt=(u,v)=>Math.sin(u*3.1+v*.9)*.5+Math.sin(u*7.3-v*1.7)*.25+Math.cos(u*1.7+v*2.3)*.35,off=t*.35;
   for(let r=0;r<rows;r++){const v=r/(rows-1),z=.08+v*v*1.0;x.beginPath();for(let c=0;c<=cols;c++){const u=c/cols,px=w*(.5+(u-.5)*(1+v*2.6)),py=hor+(h-hor)*v*v+(-hgt(u*3,v*4-off*4))*12*(.3+v);c?x.lineTo(px,py):x.moveTo(px,py);}x.strokeStyle=P.i(.05+v*.14);x.stroke();}
   for(let c=0;c<=cols;c+=2){x.beginPath();for(let r=0;r<rows;r++){const v=r/(rows-1),u=c/cols,px=w*(.5+(u-.5)*(1+v*2.6)),py=hor+(h-hor)*v*v+(-hgt(u*3,v*4-off*4))*12*(.3+v);r?x.lineTo(px,py):x.moveTo(px,py);}x.strokeStyle=P.i(.06);x.stroke();}},
  cloth(s,x,w,h,t,P){
   const cols=22,rows=12,pt=(c,r)=>{const u=c/cols,v=r/rows;return [w*(.3+u*.72)+Math.sin(v*5+t*1.3)*10,h*(.06+v*.9)+Math.sin(u*6+t*1.7)*9+Math.cos(u*3+v*4-t)*6];};
   for(let r=0;r<=rows;r++){x.beginPath();for(let c=0;c<=cols;c++){const [px,py]=pt(c,r);c?x.lineTo(px,py):x.moveTo(px,py);}x.strokeStyle=r===Math.round(rows/2)?P.a(.8):P.i(.09);x.lineWidth=r===Math.round(rows/2)?1.5:1;x.stroke();}
   for(let c=0;c<=cols;c+=2){x.beginPath();for(let r=0;r<=rows;r++){const [px,py]=pt(c,r);r?x.lineTo(px,py):x.moveTo(px,py);}x.strokeStyle=P.i(.07);x.lineWidth=1;x.stroke();}},
  wave(s,x,w,h,t,P){
   const n=Math.round(w/9),base=h*.62;for(let k=0;k<n;k++){const v=Math.abs(Math.sin(k*.42+t*3.2)*Math.cos(k*.13-t*1.1))*.85+.08,bh=h*.42*v,px=w*.25+k*(w*.75/n);x.fillStyle=k%9===0?P.a(.9):P.i(.16+v*.25);x.fillRect(px,base-bh,3,bh);x.fillStyle=P.i(.05);x.fillRect(px,base+3,3,bh*.35);}
   const cx=w*.16,cy=h*.42,r=Math.min(h*.2,40);x.beginPath();x.arc(cx,cy,r,0,TAU);x.strokeStyle=P.a(.85);x.lineWidth=1.6;x.stroke();x.beginPath();x.moveTo(cx-r*.32,cy-r*.45);x.lineTo(cx+r*.5,cy);x.lineTo(cx-r*.32,cy+r*.45);x.closePath();x.fillStyle=P.a(.9);x.fill();x.lineWidth=1;},
  pages(s,x,w,h,t,P){
   if(!s.st){const r=rnd(s.seed);s.st={l:Array.from({length:60},()=>.25+r()*.7)};}
   const lh=14,off=(t*14)%lh,startX=w*.42;for(let k=0;k<Math.ceil(h/lh)+1;k++){const y=k*lh-off+6,len=s.st.l[(k+Math.floor(t*14/lh))%60];x.fillStyle=k===Math.round(h/lh/2)?P.a(.8):P.i(.08+(1-Math.abs(y/h-.5))*.12);x.fillRect(startX,y,(w-startX-18)*len,2.5);}},
  stars(s,x,w,h,t,P){
   if(!s.st){const r=rnd(s.seed);s.st={p:Array.from({length:90},()=>({x:r(),y:r(),z:.2+r()*.8,tw:r()*TAU}))};}
   for(const p of s.st.p){const px=((p.x-t*.008*p.z)%1+1)%1*w,py=p.y*h,a=.15+p.z*.5*(.6+.4*Math.sin(t*2+p.tw));x.fillStyle=p.z>.93?P.a(a+.3):P.i(a*.8);x.beginPath();x.arc(px,py,p.z*1.6,0,TAU);x.fill();}},
  scatter(s,x,w,h,t,P){
   if(!s.st){const r=rnd(s.seed);s.st={p:Array.from({length:46},()=>({u:r(),n:(r()-.5)}))};}
   const y0=h*.82,y1=h*.18,x0=w*.34,x1=w*.96;x.strokeStyle=P.i(.08);x.beginPath();x.moveTo(x0,h*.08);x.lineTo(x0,y0);x.lineTo(x1,y0);x.stroke();
   for(const p of s.st.p){const u=p.u,px=x0+(x1-x0)*u,py=y0+(y1-y0)*u+p.n*h*.32+Math.sin(t*1.2+u*9)*4;x.fillStyle=P.i(.35);x.beginPath();x.arc(px,py,2,0,TAU);x.fill();}
   const k=(Math.sin(t*.7)+1)/2;x.strokeStyle=P.a(.9);x.lineWidth=1.6;x.beginPath();x.moveTo(x0,y0-h*.04);x.lineTo(x0+(x1-x0)*(.4+k*.6),y0+(y1-y0)*(.4+k*.6)-h*.04);x.stroke();x.lineWidth=1;},
  burst(s,x,w,h,t,P){
   const cx=w*.72,cy=h*.52,R=Math.min(w*.32,h*.9);for(let k=0;k<36;k++){const a=k/36*TAU+t*.12,l=R*(.45+.55*Math.abs(Math.sin(k*1.3+t*.9)));x.strokeStyle=k%4?P.i(.08):P.a(.45);x.beginPath();x.moveTo(cx+Math.cos(a)*R*.18,cy+Math.sin(a)*R*.18);x.lineTo(cx+Math.cos(a)*l,cy+Math.sin(a)*l);x.stroke();}
   x.save();x.translate(cx,cy);x.rotate(t*.3);x.beginPath();for(let k=0;k<10;k++){const r=k%2?R*.08:R*.2,a=k/10*TAU-Math.PI/2;k?x.lineTo(Math.cos(a)*r,Math.sin(a)*r):x.moveTo(Math.cos(a)*r,Math.sin(a)*r);}x.closePath();x.strokeStyle=P.a(1);x.lineWidth=1.6;x.shadowColor=P.a(1);x.shadowBlur=14;x.stroke();x.restore();x.shadowBlur=0;x.lineWidth=1;},
  circuit(s,x,w,h,t,P){
   if(!s.st){const r=rnd(s.seed),paths=[];for(let k=0;k<11;k++){let px=w*(.3+r()*.15),py=h*r();const pts=[[px,py]];for(let j=0;j<5;j++){if(j%2)py=Math.max(6,Math.min(h-6,py+(r()-.5)*h*.6));else px=Math.min(w-6,px+w*(.06+r()*.14));pts.push([px,py]);}paths.push({pts,o:r(),sp:.15+r()*.25});}s.st={paths};}
   for(const p of s.st.paths){x.strokeStyle=P.i(.1);x.beginPath();p.pts.forEach(([a,b],k)=>k?x.lineTo(a,b):x.moveTo(a,b));x.stroke();const [ex,ey]=p.pts.at(-1);x.strokeStyle=P.i(.25);x.strokeRect(ex-3,ey-3,6,6);
    const segs=[];let L=0;for(let k=1;k<p.pts.length;k++){const d=Math.hypot(p.pts[k][0]-p.pts[k-1][0],p.pts[k][1]-p.pts[k-1][1]);segs.push(d);L+=d;}
    let d=((t*p.sp+p.o)%1)*L;for(let k=1;k<p.pts.length;k++){if(d<=segs[k-1]){const f=d/segs[k-1],qx=p.pts[k-1][0]+(p.pts[k][0]-p.pts[k-1][0])*f,qy=p.pts[k-1][1]+(p.pts[k][1]-p.pts[k-1][1])*f;x.fillStyle=P.a(1);x.shadowColor=P.a(1);x.shadowBlur=10;x.beginPath();x.arc(qx,qy,2.4,0,TAU);x.fill();x.shadowBlur=0;break;}d-=segs[k-1];}}},
  sparks(s,x,w,h,t,P){
   const cx=w*.7,cy=h*.52,R=Math.min(w*.26,h*.7);if(!s.st)s.st={trail:[]};
   const a1=t*1.6,a2=-t*1.25+1,p1=[cx+Math.cos(a1)*R,cy+Math.sin(a1*1.3)*R*.6],p2=[cx+Math.cos(a2)*R*.8,cy+Math.sin(a2*1.1)*R*.7];
   s.st.trail.push([p1,p2]);if(s.st.trail.length>28)s.st.trail.shift();
   s.st.trail.forEach(([q1,q2],k)=>{const a=k/28;x.fillStyle=P.a(a*.7);x.fillRect(q1[0]-1,q1[1]-1,2.2,2.2);x.fillStyle=P.i(a*.6);x.fillRect(q2[0]-1,q2[1]-1,2.2,2.2);});
   const d=Math.hypot(p1[0]-p2[0],p1[1]-p2[1]);if(d<R*.5){x.strokeStyle=P.a(1-d/(R*.5));x.beginPath();x.moveTo(p1[0],p1[1]);x.lineTo(p2[0],p2[1]);x.stroke();}
   x.fillStyle=P.a(1);x.beginPath();x.arc(p1[0],p1[1],3.4,0,TAU);x.fill();x.fillStyle=P.i(.9);x.beginPath();x.arc(p2[0],p2[1],3,0,TAU);x.fill();},
  blobs(s,x,w,h,t,P){
   for(let k=0;k<5;k++){const cx=w*(.5+.38*Math.sin(t*.21+k*1.7)),cy=h*(.5+.34*Math.cos(t*.17+k*2.3)),r=Math.min(w,h)*(.28+.08*Math.sin(t*.5+k));const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,k%2?P.a(.22):P.i(.07));g.addColorStop(1,P.a(0));x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();}
   for(let k=0;k<3;k++){x.beginPath();x.arc(w*.72,h*.5,Math.min(w,h)*(.18+k*.12)+Math.sin(t*1.2+k)*4,0,TAU);x.strokeStyle=P.i(.07);x.stroke();}}
 };

 /* ---------------- engine ---------------- */
 function size(s){const r=s.box.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1)*(innerWidth<768?.8:1),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));if(w===s.w&&h===s.h)return;s.w=w;s.h=h;s.c.width=Math.round(w*dpr);s.c.height=Math.round(h*dpr);s.x.setTransform(dpr,0,0,dpr,0,0);s.st=null;}
 function draw(s,dt){s.t+=dt;const P=pal(s);s.x.clearRect(0,0,s.w,s.h);s.x.lineWidth=1;try{S[s.kind](s,s.x,s.w,s.h,s.t,P);}catch(err){console.warn('scene',s.kind,err?.message);live.delete(s);}}
 function loop(now){raf=0;if(document.hidden){last=0;return;}if(last&&now-last<31){raf=requestAnimationFrame(loop);return;}const dt=last?Math.min(.06,(now-last)/1000):.016;last=now;let any=false;
  for(const s of [...live]){if(!s.c.isConnected){live.delete(s);io?.unobserve(s.box);ro?.unobserve(s.box);continue;}if(!s.vis)continue;any=true;if(s.dirty){size(s);s.dirty=false;}draw(s,dt);}
  if(any&&!reduced())raf=requestAnimationFrame(loop);else last=0;}
 function kick(){if(!raf&&!reduced()&&live.size)raf=requestAnimationFrame(loop);}
 function mount(box,kind,rgb){if(!box||!S[kind])return null;const c=document.createElement('canvas');box.append(c);const x=c.getContext('2d');if(!x)return null;
  const s={box,c,x,kind,rgb:rgb||'138,164,255',t:Math.random()*40,w:0,h:0,vis:true,dirty:false,seed:kind.length*97+Math.round(Math.random()*999),st:null};
  size(s);live.add(s);
  io=io||new IntersectionObserver(es=>{for(const en of es)for(const v of live)if(v.box===en.target)v.vis=en.isIntersecting;kick();},{rootMargin:'40px'});io.observe(box);
  ro=ro||new ResizeObserver(es=>{for(const en of es)for(const v of live)if(v.box===en.target){v.dirty=true;if(reduced()){size(v);draw(v,0);}}});ro.observe(box);
  draw(s,0);kick();return s;}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;kick();}});
 function stopAll(){for(const s of live){io?.unobserve(s.box);ro?.unobserve(s.box);}live.clear();cancelAnimationFrame(raf);raf=0;}
 return Object.freeze({mount,kick,stopAll,kinds:()=>Object.keys(S),count:()=>live.size});
})();
