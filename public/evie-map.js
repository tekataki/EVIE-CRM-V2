'use strict';
/* EVIE Mapa (UI + navigation controller). Provider: Stadia Maps (OpenStreetMap data) via our authenticated
   Worker proxy (/api/map) for search and routing; MapLibre GL 4.7.1 (vendored, BSD-3) renders Stadia styles.
   Honest by design:
   - Never shows a route, turn, distance or ETA that did not come from the provider response.
   - Location only after an explicit tap ("Mi ubicación" / "Iniciar navegación"); live position only while a
     navigation session runs (foreground). Nothing about position is stored or synced.
   - Weak/stale GPS ⇒ says so instead of a confident instruction. Manual origin if GPS is denied/unavailable.
   - Spoken guidance goes through EvieAssistant.say (Fish/TTS or browser voice). It is not spoken while the user
     is talking, and EVIE never opens the mic while speaking, so directions are never transcribed back.
   - Foreground only: browsers/PWAs pause GPS and audio in the background. Offers handoff to a navigation app. */
window.EvieMap=(()=>{
 const C=()=>window.EvieMapCore,e=s=>Domain.escape(String(s??''));
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&!!EvieAccounts.config?.()?.accountsEnabled;
 const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ATTR='<a href="https://stadiamaps.com/attribution/" target="_blank" rel="noopener">© Stadia Maps</a> <a href="https://openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>';
 const ATTR_TXT='© Stadia Maps © OpenMapTiles © OpenStreetMap contributors';
 const CODE={outside_area:'outside',origin_outside_area:'outside',no_route:'no_route',quota:'quota',provider_auth:'provider',provider_rate:'provider',provider_timeout:'provider',provider_error:'provider',not_configured:'provider'};
 let cfg=null,map=null,loading=null,route=null,dest=null,origin=null,session=null,watchId=null,staleTimer=0,lastFix=null,muted=false,lastSpoken='',status='idle',statusText='Busca un destino dentro de la ciudad.',mode='auto',rerouting=false,lastEvent=null,candidates=[],manualOrigin=false,lastGpsQ=null,lastQuery='';
 function hudRefresh(){try{const r=window.EvieHUD?.resolve?.('mapa');if(r?.id&&r.type==='mapa')EvieHUD.update(r.id,{});}catch{}}
 function st(s,msg){status=s;if(msg!==undefined)statusText=msg;syncPanel();}
 function reset(){stop(true);cfg=null;route=dest=origin=null;candidates=[];muted=false;lastSpoken='';lastEvent=null;manualOrigin=false;status='idle';statusText='Busca un destino dentro de la ciudad.';try{map?.remove();}catch{}map=null;for(const k in markers)delete markers[k];}
 async function config(force=false){if(cfg&&!force)return cfg;
  if(!cloud()){cfg={configured:false,local:true,missing:['Inicia sesión con tu cuenta EVIE: el mapa usa el servidor para proteger la clave del proveedor.'],attribution:ATTR_TXT};return cfg;}
  try{cfg=await EvieAccounts.request('map/config');}catch(err){cfg={configured:false,missing:['No se pudo consultar la configuración del mapa: '+(err.message||'sin conexión')],attribution:ATTR_TXT};}return cfg;}
 /* ---------- MapLibre (lazy, vendored) ---------- */
 function loadLib(){if(window.maplibregl)return Promise.resolve(window.maplibregl);if(loading)return loading;loading=new Promise((res,rej)=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/vendor/maplibre/maplibre-gl.css';document.head.append(l);const s=document.createElement('script');s.src='/vendor/maplibre/maplibre-gl.js';s.onload=()=>res(window.maplibregl);s.onerror=()=>{loading=null;rej(Error('No se pudo cargar el visor del mapa.'));};document.head.append(s);});return loading;}
 const theme=()=>document.documentElement.dataset.theme==='light'?'light':'dark';
 async function mountMap(host){if(!host)return;const c=await config();
  if(!host.isConnected)return;
  if(!c.configured){host.innerHTML=`<div class="map-empty" role="note"><p><strong>El mapa todavía no está configurado.</strong></p><ul>${(c.missing||[]).map(m=>`<li>${e(m)}</li>`).join('')}</ul><p class="muted">EVIE no muestra rutas ni lugares simulados.</p><p class="map-attr">${e(c.attribution||ATTR_TXT)}</p></div>`;return;}
  let gl;try{gl=await loadLib();}catch(err){host.innerHTML=`<div class="map-empty"><p>${e(err.message)}</p></div>`;return;}
  if(!host.isConnected)return;
  if(gl.supported&&!gl.supported({failIfMajorPerformanceCaveat:false})){host.innerHTML='<div class="map-empty"><p>Este navegador no puede mostrar el mapa (WebGL no disponible). Aún puedes buscar destinos y ver la ruta en texto.</p></div>';return;}
  try{map?.remove();}catch{}for(const k in markers)delete markers[k];
  const A=C().AREA;
  try{map=new gl.Map({container:host,style:theme()==='light'?c.styleLight:c.styleDark,center:A.center,zoom:13.2,minZoom:11,maxBounds:[[A.bbox[0]-0.06,A.bbox[1]-0.05],[A.bbox[2]+0.06,A.bbox[3]+0.05]],attributionControl:{compact:false,customAttribution:ATTR},cooperativeGestures:matchMedia('(pointer:coarse)').matches,locale:{'NavigationControl.ZoomIn':'Acercar','NavigationControl.ZoomOut':'Alejar','NavigationControl.ResetBearing':'Orientar al norte'}});}
  catch(err){map=null;host.innerHTML=`<div class="map-empty"><p>No se pudo iniciar el visor del mapa: ${e(err.message)}. Aún puedes buscar destinos y ver la ruta en texto.</p><p class="map-attr">${e(ATTR_TXT)}</p></div>`;return;}
  map.addControl(new gl.NavigationControl({visualizePitch:false}),'top-right');
  map.on('error',ev=>{const m=String(ev?.error?.message||ev?.error?.status||'');if(/401|403|Unauthorized|Forbidden/i.test(m))st('provider','El proveedor rechazó el mapa base: falta autorizar este dominio en Stadia Maps.');});
  map.on('load',()=>{map.addSource('area',{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[A.polygon]}}});map.addLayer({id:'area-line',type:'line',source:'area',paint:{'line-color':'#8fb3ff','line-width':1.5,'line-dasharray':[2,2],'line-opacity':.7}});drawRoute();drawMarkers();});
  map.on('click',ev=>{if(!manualOrigin)return;manualOrigin=false;const p={lat:ev.lngLat.lat,lon:ev.lngLat.lng};if(!C().inArea(p)){st('outside','Ese punto está fuera de la zona del mapa.');return;}setOrigin({...p,label:'Punto elegido en el mapa',manual:true});});}
 function drawRoute(){if(!map?.isStyleLoaded?.())return;const data={type:'Feature',geometry:{type:'LineString',coordinates:(route?.shape||[]).map(p=>[p.lon,p.lat])}};
  if(map.getSource('route'))map.getSource('route').setData(data);else{map.addSource('route',{type:'geojson',data});map.addLayer({id:'route-casing',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#0b1020','line-width':9,'line-opacity':.55}});map.addLayer({id:'route-line',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#7aa2ff','line-width':5.5}});}
  if(route?.shape?.length&&!session){const b=route.shape.reduce((a,p)=>[[Math.min(a[0][0],p.lon),Math.min(a[0][1],p.lat)],[Math.max(a[1][0],p.lon),Math.max(a[1][1],p.lat)]],[[999,999],[-999,-999]]);map.fitBounds(b,{padding:60,duration:RM()?0:600});}}
 const markers={};
 function marker(id,p,cls,label){if(!map||!window.maplibregl){return;}if(!p){markers[id]?.remove();delete markers[id];return;}
  if(!markers[id]){const el=document.createElement('div');el.className='map-pin '+cls;el.setAttribute('aria-label',label);el.setAttribute('role','img');markers[id]=new maplibregl.Marker({element:el}).setLngLat([p.lon,p.lat]).addTo(map);}
  else{markers[id].setLngLat([p.lon,p.lat]);markers[id].getElement().className='map-pin '+cls;}}
 function drawMarkers(){marker('dest',dest,'pin-dest','Destino');marker('origin',session?null:origin,origin?.manual?'pin-origin':'pin-me','Origen');}
 /* ---------- search / route (provider via Worker) ---------- */
 async function search(text){const q=String(text||'').trim();lastQuery=q;candidates=[];
  if(q.length<2){st('idle','Escribe el lugar que buscas.');return {ok:false,status:'empty'};}
  const c=await config();if(!c.configured){st('provider','El mapa no está configurado: '+((c.missing||[])[0]||'falta el proveedor')+'.');return {ok:false,status:'not_configured',error:'El mapa todavía no está configurado.',missing:c.missing||[]};}
  if(!navigator.onLine){st('offline','Sin conexión: no puedo buscar lugares.');return {ok:false,status:'offline',error:'Sin conexión.'};}
  st('searching','Buscando «'+q+'»…');
  let r;try{r=await EvieAccounts.request('map/search',{method:'POST',body:{text:q}});}catch(err){const s=CODE[err.code]||(navigator.onLine?'provider':'offline');st(s,err.message||'No pude buscar ese lugar.');return {ok:false,status:s,error:err.message};}
  const res=C().resolveCandidates(q,r.results||[]);
  if(res.status==='not_found'){st('not_found','No encontré «'+q+'» en Ciudad Guzmán. Prueba con otro nombre o una calle cercana.');return {ok:false,status:'not_found',error:'No encontré ese lugar en Ciudad Guzmán.'};}
  if(res.status==='outside_area'){st('outside','Ese lugar está fuera de la zona del mapa (Ciudad Guzmán). Para viajes fuera de la ciudad usa una app de navegación.');return {ok:false,status:'outside_area',error:'Ese destino está fuera de Ciudad Guzmán.'};}
  if(res.status==='ambiguous'){candidates=res.candidates;st('choose','Encontré varios lugares. Elige el correcto.');return {ok:true,status:'ambiguous',candidates:res.candidates.map(x=>({name:x.name,label:x.label}))};}
  await choose(res.choice);return {ok:true,status:'unique',destination:{name:res.choice.name,label:res.choice.label}};}
 async function choose(x){dest={name:x.name,label:x.label,lat:x.lat,lon:x.lon};candidates=[];drawMarkers();
  if(!origin){st('need_origin','Destino: '+x.name+'. Ahora elige el origen: usa «Mi ubicación» o «Elegir origen en el mapa».');hudRefresh();return {ok:true,needOrigin:true};}
  return calculate();}
 async function routeTo(text){const r=await search(text);if(!r.ok||r.status==='ambiguous')return r;return {...r,route:route?summaryObj():null};}
 const summaryObj=()=>route?{distance:C().roundDist(route.lengthM),duration:C().fmtDuration(route.timeS),eta:route.etaLabel,maneuvers:route.maneuvers.length}:null;
 async function calculate({reroute=false}={}){if(!dest)return {ok:false,error:'Primero elige un destino.'};if(!origin)return {ok:false,error:'Falta el origen.'};
  if(!navigator.onLine){st('offline','Sin conexión: la ruta actual sigue en pantalla, pero no puedo recalcular.');return {ok:false,status:'offline',error:'Sin conexión.'};}
  st(reroute?'rerouting':'routing',reroute?'Recalculando la ruta…':'Calculando la ruta…');
  try{const r=await EvieAccounts.request('map/route',{method:'POST',body:{from:{lat:origin.lat,lon:origin.lon},to:{lat:dest.lat,lon:dest.lon},mode,...(Number.isFinite(lastFix?.heading)?{heading:lastFix.heading}:{})}});
   const parsed=C().parseValhalla({trip:r.trip},{mode,traffic:r.traffic});
   if(session&&reroute)C().markReroute(session,parsed);else if(session)session.route=parsed;route=parsed;drawRoute();drawMarkers();
   st(session?'navigating':'route',`${C().roundDist(parsed.lengthM)} · ${C().fmtDuration(parsed.timeS)} · ${parsed.etaLabel}`);hudRefresh();return {ok:true,route:parsed};}
  catch(err){st(CODE[err.code]||(navigator.onLine?'provider':'offline'),err.message||'No se pudo calcular la ruta.');return {ok:false,status:CODE[err.code]||'error',error:err.message};}}
 const fixOf=p=>({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,heading:Number.isFinite(p.coords.heading)?p.coords.heading:undefined,speed:p.coords.speed,timestamp:p.timestamp||Date.now()});
 function myLocation(){return new Promise(res=>{if(!('geolocation' in navigator)){st('nogps','Este dispositivo no ofrece ubicación. Elige el origen en el mapa.');res({ok:false,status:'nogps'});return;}
  st('locating','Pidiendo tu ubicación (solo para esta ruta, no se guarda)…');
  navigator.geolocation.getCurrentPosition(p=>{const f=fixOf(p),q=C().gpsQuality(f);
    if(!C().inArea(f)){st('outside','Tu ubicación está fuera de Ciudad Guzmán. Elige el origen en el mapa.');res({ok:false,status:'outside'});return;}
    if(q.state==='weak'){st('weak',q.say+' Puedes elegir el origen en el mapa.');}
    setOrigin({lat:f.lat,lon:f.lon,accuracy:f.accuracy,label:`Mi ubicación (±${Math.round(f.accuracy)} m)`});res({ok:true,accuracy:f.accuracy});},
   err=>{const denied=err.code===1;st(denied?'denied':'nogps',denied?'Sin permiso de ubicación. Elige el origen en el mapa o activa el permiso en el navegador.':'No pude obtener tu ubicación. Elige el origen en el mapa.');res({ok:false,status:denied?'denied':'nogps'});},
   {enableHighAccuracy:true,maximumAge:10000,timeout:15000});});}
 function setOrigin(o){origin=o;drawMarkers();if(dest)return calculate();st('origin','Origen listo. Ahora busca tu destino.');return Promise.resolve({ok:true});}
 /* ---------- navigation session (foreground) ---------- */
 function speak(text,{force=false}={}){if(!text)return;lastSpoken=text;const live=document.getElementById('map-live');if(live)live.textContent=text;if(muted&&!force)return;
  const v=document.documentElement.dataset.evieVoice||'';if(/listening|transcribing|recording|arming/.test(v))return;window.EvieAssistant?.say?.(text);}
 function start(){if(!route)return {ok:false,error:'Primero calcula una ruta.'};
  if(!('geolocation' in navigator)){st('nogps','Este dispositivo no ofrece GPS. Sigue la ruta en pantalla o ábrela en una app de navegación.');return {ok:false,status:'nogps'};}
  session=C().newSession(route);document.documentElement.dataset.mapNav='1';st('navigating','Navegación activa · solo con EVIE en primer plano.');drawMarkers();
  watchId=navigator.geolocation.watchPosition(p=>onFix(fixOf(p)),err=>{if(err.code===1){stop(true);st('denied','Se retiró el permiso de ubicación. Detuve la guía.');}else st('nogps','Perdí la señal de GPS. No daré indicaciones hasta recuperarla.');},{enableHighAccuracy:true,maximumAge:2000,timeout:20000});
  staleTimer=setInterval(()=>{if(session&&lastFix&&Date.now()-lastFix.timestamp>C().GPS.staleMs)onFix({...lastFix});},5000);
  speak(route.maneuvers[0]?.pre||'Inicia la ruta.');hudRefresh();return {ok:true};}
 async function onFix(f){if(!session)return;lastFix=f;marker('me',{lat:f.lat,lon:f.lon},'pin-me','Tu posición');const ev=C().update(session,f);lastEvent=ev;
  if(ev.kind==='gps'){st(ev.quality==='stale'?'stale':'weak',ev.say);if(ev.quality!==lastGpsQ)speak(ev.say);lastGpsQ=ev.quality;return ev;}
  lastGpsQ=ev.quality||null;
  if(ev.kind==='arrived'){speak(ev.say,{force:true});stop(true);st('arrived','Llegaste a tu destino.');hudRefresh();return ev;}
  if(ev.kind==='off_route'){st('off_route',ev.say);if(ev.reroute&&!rerouting){rerouting=true;speak(ev.say);origin={lat:f.lat,lon:f.lon,accuracy:f.accuracy,label:'Mi ubicación'};const r=await calculate({reroute:true});rerouting=false;if(!r.ok)speak('No pude recalcular: '+(r.error||'error del proveedor')+'.');}return ev;}
  if(ev.kind==='drifting'){syncPanel();return ev;}
  if(ev.kind==='progress'){st('navigating',`${ev.next?C().roundDist(ev.toNextM)+' · '+(ev.next.text||'')+' · ':''}faltan ${C().roundDist(ev.remainingM)}`);if(ev.announce)speak(ev.announce.text);if(map&&!RM())map.easeTo({center:[f.lon,f.lat],duration:400});}
  return ev;}
 function stop(silent=false){if(watchId!==null){try{navigator.geolocation.clearWatch(watchId);}catch{}watchId=null;}clearInterval(staleTimer);const was=!!session;session=null;lastFix=null;lastGpsQ=null;marker('me',null);delete document.documentElement.dataset.mapNav;drawMarkers();
  if(was&&!silent){st('stopped','Navegación detenida.');speak('Terminé la navegación.',{force:true});hudRefresh();}else syncPanel();return {ok:true};}
 function remainingText(){if(!session)return route?`La ruta mide ${C().roundDist(route.lengthM)}, unos ${C().fmtDuration(route.timeS)}. ${route.etaLabel}.`:'No hay una ruta activa.';
  if(lastEvent?.kind==='gps')return lastEvent.say;return C().summary(session);}
 function handoffUrl(){if(!dest)return null;const m={auto:'driving',pedestrian:'walking',bicycle:'bicycling',motor_scooter:'driving'}[mode];return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=${m}`;}
 /* ---------- view ---------- */
 function view(){setTimeout(mountView,0);return Views.heading('Mapa','Ciudad Guzmán, Jalisco · rutas con datos de OpenStreetMap. La guía funciona con EVIE abierta en primer plano.','','MAPA')+
  `<section class="map-page" id="map-page" aria-label="Mapa de Ciudad Guzmán"><div class="map-canvas" id="map-canvas" role="region" aria-label="Mapa interactivo"></div><aside class="map-panel panel" id="map-panel" aria-label="Destino y navegación"></aside></section>`;}
 async function mountView(){const host=document.getElementById('map-canvas');if(!host||host.dataset.mounted)return;host.dataset.mounted='1';await config();syncPanel();mountMap(host);}
 function panelHTML(){const c=cfg||{},nav=!!session,I=Views.icon;
  if(!c.configured)return `<h3 class="map-h">Mapa no disponible todavía</h3><div class="map-note" role="status" id="map-status" data-state="not_configured"><p>Falta configurar el proveedor de mapas. EVIE no inventa rutas ni lugares.</p><ul>${(c.missing||['Configuración pendiente']).map(m=>`<li>${e(m)}</li>`).join('')}</ul></div><p class="map-attr">${e(c.attribution||ATTR_TXT)}</p>`;
  return `<form class="map-search" id="map-search" role="search" data-draft-ignore><label class="sr-only" for="map-q">Buscar destino en Ciudad Guzmán</label><input class="input" id="map-q" name="q" placeholder="¿A dónde vas? Ej.: Tecnológico, Jardín Principal" autocomplete="off" maxlength="140" value="${e(dest?.name||lastQuery||'')}"><button class="button primary" type="submit">Buscar</button></form>
   ${candidates.length?`<div class="map-cands" role="group" aria-label="Elige el destino"><p class="map-h6">Encontré varios lugares. ¿Cuál es?</p>${candidates.map((x,i)=>`<button type="button" class="map-cand" data-map-cand="${i}"><strong>${e(x.name)}</strong><small>${e(x.label||'')}</small></button>`).join('')}</div>`:''}
   <div class="map-row"><button type="button" class="button map-me" data-map="me">${I('locate-fixed')} Mi ubicación</button><button type="button" class="button" data-map="pick-origin" aria-pressed="${manualOrigin}">${I('map-pin')} ${manualOrigin?'Toca el mapa…':'Elegir origen en el mapa'}</button></div>
   <p class="map-origin">${origin?`<span class="dot ${origin.manual?'manual':'gps'}"></span> Origen: ${e(origin.label)}`:'Sin origen todavía. Tu ubicación solo se usa si la permites y no se guarda.'}</p>
   <div class="map-row" role="radiogroup" aria-label="Modo de viaje">${[['auto','Auto','car'],['motor_scooter','Moto','bike'],['bicycle','Bici','bike'],['pedestrian','A pie','footprints']].map(([k,l,ic])=>`<button type="button" class="map-mode ${mode===k?'on':''}" role="radio" aria-checked="${mode===k}" data-map-mode="${k}">${I(ic)} ${l}</button>`).join('')}</div>
   <p class="map-status" id="map-status" role="status" aria-live="polite" data-state="${e(status)}">${e(statusText)}</p>
   ${route?`<div class="map-summary"><p><strong>${e(C().roundDist(route.lengthM))}</strong> · ${e(C().fmtDuration(route.timeS))}${dest?` · ${e(dest.name)}`:''}</p><p class="muted">${e(route.etaLabel)}. «Posición en vivo» es tu GPS; no equivale a tráfico en vivo.</p>
    <ol class="map-steps">${route.maneuvers.slice(0,12).map(m=>`<li>${e(m.text)}${m.lengthKm?` <small>${e(C().roundDist(m.lengthKm*1000))}</small>`:''}</li>`).join('')}</ol></div>`:''}
   <div class="map-row map-nav">${route&&!nav?`<button type="button" class="button primary" data-map="start">${I('navigation')} Iniciar navegación</button>`:''}${nav?`<button type="button" class="button danger map-stop" data-map="stop">${I('square')} Detener navegación</button><button type="button" class="button" data-map="repeat">${I('repeat')} Repetir</button><button type="button" class="button" data-map="mute" aria-pressed="${muted}">${I(muted?'volume-x':'volume-2')} ${muted?'Activar voz':'Silenciar'}</button><button type="button" class="button" data-map="reroute">${I('rotate-ccw')} Recalcular</button>`:''}</div>
   ${nav?`<p class="map-gps">${lastFix?`Posición en vivo · GPS ±${Math.round(lastFix.accuracy)} m${lastFix.accuracy>C().GPS.warnAccuracy?' · señal débil':''}`:'Esperando la primera lectura de GPS…'}</p>`:''}
   ${dest?`<a class="map-handoff" href="${e(handoffUrl())}" target="_blank" rel="noopener noreferrer">${I('external-link')} Abrir en una app de navegación</a>`:''}
   <p class="map-warn">${I('triangle-alert')} Prototipo: no lo uses como única guía al manejar. La guía se pausa si EVIE queda en segundo plano o se bloquea la pantalla.</p>
   <p class="map-attr">${e(c.attribution||ATTR_TXT)}</p>
   <p class="sr-only" id="map-live" aria-live="assertive"></p>`;}
 function syncPanel(){const p=document.getElementById('map-panel');if(!p)return;const a=document.activeElement,keep=a?.id==='map-q'?{v:a.value,s:a.selectionStart}:null,live=document.getElementById('map-live')?.textContent||'';p.innerHTML=panelHTML();window.lucide?.createIcons?.({root:p});const l=document.getElementById('map-live');if(l)l.textContent=live;
  if(keep){const q=document.getElementById('map-q');if(q){q.value=keep.v;q.focus();try{q.setSelectionRange(keep.s,keep.s);}catch{}}}}
 document.addEventListener('submit',ev=>{if(ev.target?.id!=='map-search')return;ev.preventDefault();search(ev.target.elements.q.value);});
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-map],[data-map-cand],[data-map-mode]');if(!b||!b.closest('#map-panel,.hud-card'))return;
  if(b.dataset.mapCand!==undefined){const x=candidates[Number(b.dataset.mapCand)];if(x)choose(x);return;}
  if(b.dataset.mapMode){mode=b.dataset.mapMode;syncPanel();if(route&&dest&&origin&&!session)calculate();return;}
  const a=b.dataset.map;
  if(a==='me')myLocation();else if(a==='pick-origin'){manualOrigin=!manualOrigin;st(status,manualOrigin?'Toca el mapa para fijar el origen.':statusText);}
  else if(a==='start')start();else if(a==='stop')stop();else if(a==='repeat')speak(lastSpoken||remainingText(),{force:true});
  else if(a==='mute'){muted=!muted;syncPanel();}else if(a==='reroute'){if(session&&lastFix)origin={lat:lastFix.lat,lon:lastFix.lon,accuracy:lastFix.accuracy,label:'Mi ubicación'};calculate({reroute:!!session});}});
 /* ---------- voice intents (local, no AI) ---------- */
 const WAKE=/^(?:oye |hey |hola )?(?:evie|evi|ivi|ivy|ibi)[, ]*/;
 const nq=t=>IvyTools.norm(String(t||'')).replace(/[¿?¡!.,]/g,'').trim().replace(WAKE,'').trim();
 function openMap(){if(UI.section==='mapa')return;location.hash='mapa';}
 function intent(text,{say}={}){const q=nq(text);if(!q)return null;
  if(/^(abre|abrir|muestra|ensename|ve a|ir a)( el)? mapa$|^mapa$/.test(q)){openMap();return 'Abrí el mapa de Ciudad Guzmán.';}
  let m=q.match(/^(?:calcula|calculame|traza|dame|busca|muestrame)?\s*(?:la )?(?:ruta|camino|como llego|como llegar|llevame|navega)(?: hacia| hasta| para| a)?(?: el| la| los| las| al)?\s+(.{2,120})$/)||q.match(/^como (?:llego|llegar|me voy)(?: hacia| hasta| a)?(?: el| la| al)?\s+(.{2,120})$/)||q.match(/^llevame (?:a|al|hasta)(?: el| la)?\s+(.{2,120})$/);
  if(m){const target=m[1].trim();openMap();routeTo(target).then(r=>{if(r.status==='not_configured')say?.('El mapa todavía no está configurado, así que no puedo calcular rutas. Falta la clave del proveedor.');else if(r.status==='ambiguous')say?.(`Encontré ${r.candidates.length} lugares para «${target}»: ${r.candidates.slice(0,3).map(x=>x.name).join(', ')}. Elige uno en pantalla.`);else if(!r.ok)say?.(r.error||'No pude calcular esa ruta.');else if(!route)say?.('Encontré '+(dest?.name||target)+'. Ahora dime desde dónde: toca «Mi ubicación» o elige el origen en el mapa.');else say?.(`Ruta a ${dest?.name||target}: ${C().roundDist(route.lengthM)}, unos ${C().fmtDuration(route.timeS)}. ${route.etaLabel}.`);});return '';}
  if(!route&&!session)return /^(cuanto falta|recalcula|silencia|termina|deten|deja de guiar|repite)/.test(q)?'No hay una ruta activa. Dime «calcula la ruta al» y el destino.':null;
  if(/^cuanto (?:falta|me falta|queda)|^a que distancia|^cuando llego|^en cuanto llego/.test(q))return remainingText();
  if(/^(recalcula|recalcular|recalcula la ruta|vuelve a calcular)/.test(q)){if(session&&lastFix)origin={lat:lastFix.lat,lon:lastFix.lon,accuracy:lastFix.accuracy,label:'Mi ubicación'};calculate({reroute:!!session}).then(r=>say?.(r.ok?'Ruta recalculada: '+C().roundDist(r.route.lengthM)+', unos '+C().fmtDuration(r.route.timeS)+'.':(r.error||'No pude recalcular.')));return '';}
  if(/^(silencia|silencio|callate|mute|quita la voz)( el mapa| la guia| la navegacion)?$/.test(q)){muted=true;syncPanel();return 'Guía de voz silenciada. La ruta sigue en pantalla.';}
  if(/^(activa la voz|habla de nuevo|quita el silencio)( del mapa| de la guia)?$/.test(q)){muted=false;syncPanel();return 'Guía de voz activada.';}
  if(/^(repite|repitelo|que dijiste)( la indicacion)?$/.test(q))return lastSpoken||remainingText();
  if(/^(termina|terminar|deten|detener|para|cancela)( la)? (navegacion|ruta|guia)$|^deja de guiarme$/.test(q)){const had=!!session;stop(true);return had?'Terminé la navegación.':'No hay una navegación activa.';}
  if(/^(inicia|empieza|comienza)( la)? (navegacion|ruta|guia)$|^vamonos$/.test(q)){const r=start();return r.ok?'':(r.error||'No pude iniciar la navegación.');}
  return null;}
 /* ---------- model tool ---------- */
 const tools={map_action:async({action,destination}={})=>{
  if(action==='open'){openMap();return {ok:true};}
  if(action==='route'){if(!destination)return {ok:false,error:'Falta el destino.'};openMap();const r=await routeTo(destination);return r.ok?{...r,route:summaryObj(),needs_origin:!route}:r;}
  if(action==='remaining')return {ok:!!route,answer:remainingText()};
  if(action==='reroute'){const r=await calculate({reroute:!!session});return {ok:r.ok,answer:r.ok?'Ruta recalculada: '+C().roundDist(r.route.lengthM)+', unos '+C().fmtDuration(r.route.timeS)+'.':r.error};}
  if(action==='mute'){muted=true;syncPanel();return {ok:true};}if(action==='unmute'){muted=false;syncPanel();return {ok:true};}
  if(action==='repeat')return {ok:true,answer:lastSpoken||remainingText()};
  if(action==='stop'){const had=!!session;stop(true);return {ok:true,answer:had?'Terminé la navegación.':'No hay una navegación activa.'};}return {ok:false,error:'Acción desconocida.'};}};
 /* HUD card */
 const card={title:'Mapa · Ciudad Guzmán',icon:'map',route:'mapa',scope:'account',
  load:async()=>({cfg:await config(),route,dest,nav:!!session}),
  render:d=>!d.cfg?.configured?`<p class="hud-sub">El mapa aún no está configurado: ${e((d.cfg?.missing||[])[0]||'falta el proveedor')}.</p><a class="button" href="#mapa">Abrir Mapa</a>`
   :d.route?`<p><strong>${e(d.dest?.name||'Destino')}</strong></p><p class="hud-sub">${e(C().roundDist(d.route.lengthM))} · ${e(C().fmtDuration(d.route.timeS))} · ${e(d.route.etaLabel)}</p><p class="hud-sub">${d.nav?'Navegación activa':'Lista para iniciar'}</p><a class="button" href="#mapa">Ver mapa completo</a>`
   :`<p class="hud-sub">Dime «Ivi, calcula la ruta al Tecnológico» o busca un destino.</p><a class="button" href="#mapa">Abrir Mapa</a>`};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&session)st('background','EVIE pasó a segundo plano: el navegador pausa el GPS y la voz. Vuelve a EVIE para continuar.');else if(!document.hidden&&session&&status==='background')st('navigating','Navegación reanudada.');});
 addEventListener('offline',()=>{if(session||route)st('offline','Sin conexión: la ruta actual sigue en pantalla, pero no puedo recalcular.');});addEventListener('online',()=>{if(status==='offline')st(session?'navigating':'route','Conexión restablecida.');});
 return Object.freeze({view,intent,tools,card,reset,config,search,routeTo,calculate,start,stop,myLocation,setOrigin,
  stats:()=>({status,statusText,nav:!!session,route:route?{lengthM:route.lengthM,timeS:route.timeS,maneuvers:route.maneuvers.length,etaLabel:route.etaLabel}:null,dest,origin:origin?{manual:!!origin.manual}:null,muted,candidates:candidates.length,lastSpoken,mapReady:!!map}),_onFix:onFix});
})();
