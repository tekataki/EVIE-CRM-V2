# P2 client wiring: Mapa section in navigation/search, app view, scripts/CSS, HUD card, capabilities, card words,
# and server error codes propagated by EvieAccounts.request. Idempotent (skips edits whose marker exists).
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:60]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('public/config.js',[("{route:'subir',label:'Subir'","{route:'mapa',label:'Mapa',icon:'map',group:'herramientas',searchTerms:['ruta','rutas','navegacion','navegación','gps','ciudad guzman','ciudad guzmán','como llego','cómo llego','direcciones'],mobilePriority:0},{route:'subir',label:'Subir'","route:'mapa'")])
edit('public/app.js',[("personalizada:()=>window.EvieProfile?EvieProfile.view():''","personalizada:()=>window.EvieProfile?EvieProfile.view():'',mapa:()=>window.EvieMap?EvieMap.view():'<p>Cargando mapa…</p>'","mapa:()=>")])
edit('public/index.html',[
 ('<link rel="stylesheet" href="evie-memory.css">','<link rel="stylesheet" href="evie-memory.css"><link rel="stylesheet" href="evie-map.css">','evie-map.css'),
 ('<script defer src="evie-assistant.js"></script>','<script defer src="evie-map-core.js"></script><script defer src="evie-map.js"></script><script defer src="evie-assistant.js"></script>','evie-map.js')])
edit('public/evie-hud-cards.js',[
 ("['automatizaciones','Automatizaciones','zap'],","['automatizaciones','Automatizaciones','zap'],['mapa','Mapa · Ciudad Guzmán','map'],","['mapa','Mapa"),
 ("  kisha:{title:'Kisha · Mascota Virtual'","  mapa:{title:'Mapa · Ciudad Guzmán',icon:'map',route:'mapa',scope:'account',load:async(a)=>window.EvieMap?EvieMap.card.load(a):{cfg:{configured:false,missing:['El módulo del mapa no cargó.']}},render:d=>window.EvieMap?EvieMap.card.render(d):''},\n  kisha:{title:'Kisha · Mascota Virtual'","  mapa:{title:")])
edit('public/evie-assistant.js',[("['automatizaciones',/automatizaciones|atajos/],","['automatizaciones',/automatizaciones|atajos/],['mapa',/\\bmapa\\b/],","['mapa',/")])
edit('public/account-core.js',[("error.status=response.status;throw error;","error.status=response.status;if(typeof result.code==='string')error.code=result.code;throw error;","error.code=result.code")])
