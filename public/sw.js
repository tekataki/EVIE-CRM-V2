'use strict';
importScripts('/sw-manifest.js');
const CACHE='evie-shell-'+SHELL_VERSION;
const allowed=new Set(SHELL_FILES.filter(file=>file.startsWith('/')&&!file.startsWith('/api/')&&!file.startsWith('/__')&&!file.includes('?')&&!file.includes('#')));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...allowed].map(file=>new Request(new URL(file,self.location.origin),{cache:'reload',credentials:'omit',redirect:'error'}))))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('evie-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Never cache authentication, account configuration, private API responses,
 // signed URLs, uploaded media, mutations or responses from another origin.
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/__'))return;
 if(request.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html')){
  // Keep HTML and its JS/CSS on the same installed version. A waiting worker
  // activates only after old clients close; no forced update of an open form.
  event.respondWith((async()=>await caches.match('/',{cacheName:CACHE})||fetch(request).catch(()=>new Response('Sin conexión. Vuelve a abrir EVIE cuando recuperes la conexión.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})))());return;
 }
 if(allowed.has(url.pathname)&&!url.search)event.respondWith(caches.open(CACHE).then(async cache=>await cache.match(request)||fetch(request)));
});
