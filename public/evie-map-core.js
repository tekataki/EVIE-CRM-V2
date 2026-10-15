'use strict';
/* EVIE Mapa · pure navigation core (no DOM, no network). Shared by the browser, the tests and any future
   native wrapper. Deterministic and unit-tested (tests/map-core.test.cjs).
   - Supported area (geofence) for Ciudad Guzmán / Zapotlán el Grande, Jalisco.
   - Valhalla (Stadia Maps) response parsing: polyline6 geometry, distance, time, ordered maneuvers.
     Nothing here invents a road, turn, distance, ETA or closure — it only reshapes provider output.
   - Progress along the route (snap to polyline), next maneuver, remaining distance/time.
   - Deviation detection with hysteresis (accuracy-aware; several consecutive fixes off-route) + reroute limits.
   - Announcement scheduler (distance thresholds, one announcement per threshold per maneuver).
   - GPS quality classification (stale / weak / fair / good): no confident instruction on weak GPS. */
(function(root){
 const R=6371008.8,rad=d=>d*Math.PI/180;
 const AREA={name:'Ciudad Guzmán (Zapotlán el Grande), Jalisco',center:[-103.4600,19.7045],
  polygon:[[-103.5250,19.7480],[-103.4300,19.7560],[-103.3880,19.7250],[-103.3900,19.6650],[-103.4450,19.6420],[-103.5150,19.6580],[-103.5400,19.7050],[-103.5250,19.7480]],
  bbox:[-103.5400,19.6420,-103.3880,19.7560]};
 function inside(lon,lat,poly=AREA.polygon){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))c=!c;}return c;}
 const inArea=p=>!!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&inside(p.lon,p.lat);
 function dist(a,b){const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));}
 function proj(o){const k=Math.cos(rad(o.lat));return p=>({x:rad(p.lon-o.lon)*R*k,y:rad(p.lat-o.lat)*R});}
 /** Decode an encoded polyline (precision 6 for Valhalla). → [{lat,lon}] */
 function decode(str,precision=6){const f=10**precision,out=[];let i=0,lat=0,lon=0;if(typeof str!=='string')throw Error('Geometría inválida.');
  while(i<str.length){let r=0,s=0,b;do{if(i>=str.length)throw Error('Geometría truncada.');b=str.charCodeAt(i++)-63;r|=(b&31)<<s;s+=5;}while(b>=32);lat+=(r&1)?~(r>>1):(r>>1);r=0;s=0;do{if(i>=str.length)throw Error('Geometría truncada.');b=str.charCodeAt(i++)-63;r|=(b&31)<<s;s+=5;}while(b>=32);lon+=(r&1)?~(r>>1):(r>>1);out.push({lat:lat/f,lon:lon/f});}
  return out;}
 function encode(points,precision=6){const f=10**precision;let out='',pl=0,pn=0;const enc=v=>{v=v<0?~(v<<1):(v<<1);let s='';while(v>=32){s+=String.fromCharCode((32|(v&31))+63);v>>=5;}return s+String.fromCharCode(v+63);};for(const p of points){const la=Math.round(p.lat*f),lo=Math.round(p.lon*f);out+=enc(la-pl)+enc(lo-pn);pl=la;pn=lo;}return out;}
 function cumulative(shape){const c=[0];for(let i=1;i<shape.length;i++)c.push(c[i-1]+dist(shape[i-1],shape[i]));return c;}
 /** Snap a position to the route polyline → {index, t, along (m), offset (m), point}. */
 function snap(route,pos,hint=0){const P=proj(pos),S=route.shape,C=route.cum;let best=null;
  for(let i=Math.max(0,hint-40);i<S.length-1;i++){const a=P(S[i]),b=P(S[i+1]),dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;let t=L2?((-a.x)*dx+(-a.y)*dy)/L2:0;t=Math.max(0,Math.min(1,t));const x=a.x+t*dx,y=a.y+t*dy,d=Math.hypot(x,y);
   if(!best||d<best.offset)best={index:i,t,offset:d,along:C[i]+t*(C[i+1]-C[i]),point:{lat:S[i].lat+t*(S[i+1].lat-S[i].lat),lon:S[i].lon+t*(S[i+1].lon-S[i].lon)}};}
  return best||{index:0,t:0,offset:dist(pos,S[0]),along:0,point:S[0]};}
 const MODES={auto:'auto',pedestrian:'pedestrian',bicycle:'bicycle',motor_scooter:'motor_scooter'};
 /** Parse a Valhalla /route response. Throws on anything malformed; never fills gaps with guesses. */
 function parseValhalla(json,{mode='auto',traffic=false}={}){
  const trip=json?.trip;if(!trip||trip.status!==0||!Array.isArray(trip.legs)||!trip.legs.length)throw Object.assign(Error(trip?.status_message||'El proveedor no devolvió una ruta.'),{code:'no_route'});
  const shape=[],maneuvers=[];
  for(const leg of trip.legs){const pts=decode(leg.shape,6);if(pts.length<2)throw Object.assign(Error('Ruta sin geometría.'),{code:'bad_geometry'});
   const base=shape.length?shape.length-1:0;if(shape.length)pts.shift();shape.push(...pts);
   for(const m of leg.maneuvers||[]){if(!Number.isInteger(m.begin_shape_index))throw Object.assign(Error('Maniobra inválida.'),{code:'bad_maneuver'});
    maneuvers.push({type:Number(m.type)||0,text:String(m.instruction||'').slice(0,240),pre:String(m.verbal_pre_transition_instruction||m.instruction||'').slice(0,240),post:String(m.verbal_post_transition_instruction||'').slice(0,240),street:Array.isArray(m.street_names)?m.street_names.slice(0,2).map(x=>String(x).slice(0,80)):[],lengthKm:Number(m.length)||0,timeS:Number(m.time)||0,shapeIndex:base+m.begin_shape_index});}}
  const cum=cumulative(shape),lengthM=Math.round(Number(trip.summary?.length)*(trip.units==='miles'?1609.344:1000)),timeS=Math.round(Number(trip.summary?.time));
  if(!Number.isFinite(lengthM)||!Number.isFinite(timeS)||lengthM<=0)throw Object.assign(Error('Resumen de ruta inválido.'),{code:'bad_summary'});
  for(const m of maneuvers)m.along=cum[Math.min(m.shapeIndex,cum.length-1)];
  return {shape,cum,maneuvers,lengthM,timeS,mode:MODES[mode]||'auto',traffic:!!traffic,provider:'stadia-valhalla',etaLabel:traffic?'Tiempo estimado con tráfico del proveedor':'Tiempo estimado (sin tráfico en vivo)'};}
 const GPS={maxAccuracy:50,warnAccuracy:25,staleMs:15000};
 function gpsQuality(fix,now=Date.now()){if(!fix)return {state:'none',say:'No tengo tu ubicación.'};
  if(now-fix.timestamp>GPS.staleMs)return {state:'stale',say:'La señal de GPS está desactualizada; no puedo darte una indicación segura.'};
  if(!(fix.accuracy<=GPS.maxAccuracy))return {state:'weak',say:`El GPS es impreciso (±${Math.round(fix.accuracy||0)} m). Espera a tener mejor señal.`};
  return {state:fix.accuracy>GPS.warnAccuracy?'fair':'good',say:''};}
 const DEV={baseM:35,consecutive:3,arriveM:25,minRerouteGapMs:20000,maxReroutesPer10Min:6};
 function newSession(route,{now=Date.now()}={}){return {route,segment:0,along:0,offTrack:0,lastReroute:0,reroutes:[],announced:new Set(),arrived:false,startedAt:now};}
 /** Update a navigation session with a GPS fix → event for the UI (the core never speaks itself). */
 function update(s,fix,now=Date.now()){
  const q=gpsQuality(fix,now);
  if(q.state==='none'||q.state==='stale'||q.state==='weak')return {kind:'gps',quality:q.state,say:q.say,remainingM:remaining(s),remainingS:remainingTime(s)};
  const pos={lat:fix.lat,lon:fix.lon},sn=snap(s.route,pos,s.segment),tol=Math.max(DEV.baseM,1.5*(fix.accuracy||0));
  if(sn.offset>tol){s.offTrack++;if(s.offTrack>=DEV.consecutive){const can=canReroute(s,now);return {kind:'off_route',offsetM:Math.round(sn.offset),reroute:can.ok,wait:can.wait,say:can.ok?'Te saliste de la ruta. Estoy recalculando.':'Te saliste de la ruta. Recalcularé en unos segundos.'};}return {kind:'drifting',offsetM:Math.round(sn.offset)};}
  s.offTrack=0;s.segment=sn.index;s.along=Math.max(s.along-30,sn.along);
  if(s.route.cum.at(-1)-s.along<=DEV.arriveM||dist(pos,s.route.shape.at(-1))<=DEV.arriveM){s.arrived=true;return {kind:'arrived',say:'Llegaste a tu destino.'};}
  const next=s.route.maneuvers.find(m=>m.along>s.along+5)||null,toNext=next?Math.max(0,next.along-s.along):0;
  return {kind:'progress',quality:q.state,next,toNextM:Math.round(toNext),remainingM:remaining(s),remainingS:remainingTime(s),announce:announcement(s,next,toNext,fix.speed)};}
 function remaining(s){return Math.max(0,Math.round(s.route.cum.at(-1)-s.along));}
 // Remaining time = PROVIDER time × remaining fraction of the provider's geometry (no invented speeds).
 function remainingTime(s){const L=s.route.cum.at(-1)||1;return Math.max(0,Math.round(s.route.timeS*(1-s.along/L)));}
 function canReroute(s,now=Date.now()){s.reroutes=s.reroutes.filter(t=>now-t<600000);if(s.reroutes.length>=DEV.maxReroutesPer10Min)return {ok:false,wait:Math.ceil((600000-(now-s.reroutes[0]))/1000),reason:'limit'};const gap=now-s.lastReroute;if(gap<DEV.minRerouteGapMs)return {ok:false,wait:Math.ceil((DEV.minRerouteGapMs-gap)/1000),reason:'debounce'};return {ok:true};}
 function markReroute(s,newRoute,now=Date.now()){s.lastReroute=now;s.reroutes.push(now);s.route=newRoute;s.segment=0;s.along=0;s.offTrack=0;s.announced=new Set();}
 function thresholds(speed){const v=Number(speed)||0;return v>8?[500,200,50]:v>3?[300,120,35]:[120,40,15];}
 function announcement(s,next,toNext,speed){if(!next)return null;for(const th of thresholds(speed)){const key=next.shapeIndex+':'+th;if(toNext<=th&&!s.announced.has(key)){for(const t2 of thresholds(speed))if(t2>=th)s.announced.add(next.shapeIndex+':'+t2);return {threshold:th,text:spoken(next,toNext)};}}return null;}
 function spoken(m,toNext){const d=toNext<=20?'Ahora, ':`En ${roundDist(toNext)}, `;const t=(m.pre||m.text||'').replace(/\.$/,'');return d+(t?t.charAt(0).toLowerCase()+t.slice(1):'continúa')+'.';}
 function roundDist(m){if(m>=1000)return (Math.round(m/100)/10).toString().replace('.',',')+' kilómetros';if(m>=100)return Math.round(m/50)*50+' metros';return Math.max(10,Math.round(m/10)*10)+' metros';}
 function fmtDuration(s){const m=Math.round(s/60);if(m<1)return 'menos de un minuto';if(m<60)return m+' min';return Math.floor(m/60)+' h'+(m%60?' '+m%60+' min':'');}
 function summary(s){return `Faltan ${roundDist(remaining(s))}, unos ${fmtDuration(remainingTime(s))}. ${s.route.etaLabel}.`;}
 const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ ]/g,' ').replace(/\s+/g,' ').trim();
 /** Rank geocoder candidates inside the area. Ambiguous (≥2 plausible) ⇒ the user must choose; never auto-pick. */
 function resolveCandidates(query,list){const all=list||[],inA=all.filter(c=>inArea(c)),q=norm(query);
  const ranked=inA.map(c=>({...c,score:(Number(c.confidence)||0.5)+(norm(c.name).includes(q.replace(/^(el|la|los|las) /,''))?0.2:0)})).sort((a,b)=>b.score-a.score).slice(0,5);
  if(!ranked.length)return {status:all.length?'outside_area':'not_found',candidates:[],outside:all.filter(c=>!inArea(c)).slice(0,3)};
  if(ranked.length===1||ranked[0].score-ranked[1].score>=0.25)return {status:'unique',choice:ranked[0],candidates:ranked};
  return {status:'ambiguous',candidates:ranked};}
 root.EvieMapCore=Object.freeze({AREA,inside,inArea,dist,decode,encode,cumulative,snap,parseValhalla,gpsQuality,GPS,DEV,newSession,update,remaining,remainingTime,canReroute,markReroute,thresholds,spoken,roundDist,fmtDuration,summary,resolveCandidates,norm});
})(typeof window!=='undefined'?window:globalThis);
