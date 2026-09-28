'use strict';
window.PigHologram=(()=>{
 let epoch=0,cleanup=null,activeRenderer=false,metrics={frames:0,rotation:0,paused:true,meshes:0};
 function stop(){epoch++;cleanup?.();cleanup=null;activeRenderer=false;metrics={frames:0,rotation:0,paused:true,meshes:0};}
 async function mount(){stop();const host=document.querySelector('.rancho-visual'),fallback=host?.querySelector('.rancho-silhouette');if(!host||!fallback)return;const ticket=epoch;if(Neural.reduced()||Store.get().preferences.motionPaused)return;
  try{const T=await import('./vendor/three.module.min.js');if(ticket!==epoch||!host.isConnected)return;
   const canvas=document.createElement('canvas');canvas.className='pig-hologram';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Cerdo holográfico tridimensional. Visual decorativo sin diagnóstico.');canvas.tabIndex=0;
   const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);host.prepend(canvas);fallback.setAttribute('hidden','');activeRenderer=true;
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.1,100);camera.position.set(0,2.5,8);camera.lookAt(0,.4,0);const pig=new T.Group();scene.add(pig);
   const white=new T.MeshBasicMaterial({color:0xe8f7f2,wireframe:true,transparent:true,opacity:.40}),mint=new T.MeshBasicMaterial({color:0x9adbc3,wireframe:true,transparent:true,opacity:.5});
   function mesh(g,x,y,z,sx=1,sy=1,sz=1,mat=white){const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);pig.add(m);return m;}
   mesh(new T.SphereGeometry(1,24,14),0,.5,0,1.4,.77,.65);mesh(new T.SphereGeometry(1,18,12),1.15,.68,0,.64,.60,.53);
   const snout=mesh(new T.CylinderGeometry(.31,.35,.35,16,2),1.77,.60,0,1,1,1,mint);snout.rotation.z=-Math.PI/2;
   for(const z of [-.15,.15])mesh(new T.SphereGeometry(.055,8,6),1.96,.64,z,1,1,1,mint);
   for(const z of [-.43,.43]){const ear=mesh(new T.ConeGeometry(.26,.6,4),1.03,1.36,z);ear.rotation.z=-.25;mesh(new T.SphereGeometry(.07,8,6),1.5,.95,z,1,1,1,mint);}
   for(const x of [-.87,.85])for(const z of [-.45,.45])mesh(new T.CylinderGeometry(.17,.13,.8,9,4),x,-.32,z);
   const tail=[];for(let i=0;i<50;i++){const a=i/49*Math.PI*4;tail.push(new T.Vector3(-1.35-i*.009,.70+Math.sin(a)*.12,Math.cos(a)*.12));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(tail),50,.028,5,false),0,0,0,1,1,1,mint);
   const ring=new T.Mesh(new T.TorusGeometry(2.1,.014,6,80),mint);ring.rotation.x=Math.PI/2;ring.position.y=-.83;scene.add(ring);
   const dots=new Float32Array(160*3);for(let i=0;i<160;i++){const a=i*2.4;dots[i*3]=Math.cos(a)*(1.9+(i%7)/25);dots[i*3+1]=-.8+(i%31)/15;dots[i*3+2]=Math.sin(a)*(1.9+(i%7)/25);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(dots,3));const particles=new T.Points(geo,new T.PointsMaterial({color:0xd9fff0,size:.025,transparent:true,opacity:.5}));scene.add(particles);
   metrics.meshes=pig.children.length;let frame=null,visible=true,hover=false,last=0;const can=()=>visible&&!document.hidden&&canvas.isConnected&&!Neural.reduced()&&!Store.get().preferences.motionPaused;
   function resize(){const w=host.clientWidth,h=Math.max(180,Math.min(330,w*.7));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);}
   const ro=new ResizeObserver(resize);ro.observe(host);resize();
   function loop(t){frame=null;if(!can())return;if(t-last>40){pig.rotation.y+=Math.min(t-last,100)*.00018*(hover?1.12:1);metrics.rotation=pig.rotation.y;metrics.frames++;metrics.paused=false;particles.rotation.y=-t*.000025;ring.scale.setScalar(1+(hover?.025:.01)*Math.sin(t*.001));renderer.render(scene,camera);last=t;}frame=requestAnimationFrame(loop);}
   const io=new IntersectionObserver(rows=>{visible=rows[0].isIntersecting;metrics.paused=!can();if(can()&&frame===null)frame=requestAnimationFrame(loop);else if(!visible&&frame!==null){cancelAnimationFrame(frame);frame=null;}});io.observe(canvas);const events=new AbortController();for(const name of ['pointerenter','focus'])canvas.addEventListener(name,()=>hover=true,{signal:events.signal});for(const name of ['pointerleave','blur'])canvas.addEventListener(name,()=>hover=false,{signal:events.signal});
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stop();},{signal:events.signal});
   cleanup=()=>{if(frame!==null)cancelAnimationFrame(frame);io.disconnect();ro.disconnect();events.abort();const geometries=new Set(),materials=new Set();scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);if(obj.material)materials.add(obj.material);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();fallback.removeAttribute('hidden');};frame=requestAnimationFrame(loop);
  }catch{fallback.removeAttribute('hidden');activeRenderer=false;}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(window.DALI_READY&&UI.section==='granja')mount();});window.addEventListener('pagehide',stop);
 return {mount,stop,stats:()=>({renderer:activeRenderer?1:0,...metrics})};
})();
