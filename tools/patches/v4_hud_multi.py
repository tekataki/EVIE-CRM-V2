# v4 HUD: one utterance opens several distinct cards in order («abre Finanzas y Mascota Virtual», «muéstrame el clima
# y dime qué hora es»); singleton cards are focused/updated, never stacked; speaking never closes cards. Route and
# wake aliases: Kisha → Mascota Virtual (bitacora), Físico (fisico) with #gimnasio legacy alias, Libi wake. Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:70]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('public/evie-assistant.js',[
 (".replace(/^(oye |hey |hola )?(?:evie|evi|ivi|ivy|ibi)[, ]+/,'').trim();",".replace(/^(oye |hey |hola |ok )?(?:evie|evi|ivi|ivy|ibi|libi|eby|evy)[, ]+/,'').trim();","|libi|eby|evy)[, ]+/,'').trim();"),
 ("['gimnasio',/gym|gimnasio|salud|entrenamiento/]","['gimnasio',/gym|gimnasio|salud|entrenamiento|fisico|musculos?|cuerpo/]","fisico|musculos?|cuerpo"),
 ("['clock',/reloj|la hora/],['weather',/clima|tiempo que hace/]","['timer',/temporizador(es)?|cronometro|timer/],['clock',/reloj|la hora|que hora|hora es/],['weather',/clima|tiempo que hace|pronostico|temperatura/]","['timer',/temporizador"),
 (" function cardFrom(t){for(const [k,rx] of CARD_WORDS)if(rx.test(t))return k;return null;}",
  " function cardFrom(t){for(const [k,rx] of CARD_WORDS)if(rx.test(t))return k;return null;}\n"
  " /* Several cards in ONE utterance, opened in the spoken order. Returns spoken text or null (0–1 card → other paths). */\n"
  " function multiOpen(q){const parts=q.replace(/^(?:por favor )?(?:abre|abrir|abreme|muestrame|muestra|ensename|pon|ponme|dame|dime)(?: (?:el|la|los|las|mi|mis))? /,'').split(/\\s*(?:,|\\by tambien\\b|\\by luego\\b|\\by despues\\b|\\btambien\\b|\\by\\b|\\be\\b)\\s+/).map(s=>s.replace(/^(?:abre|abreme|muestrame|muestra|ensename|dime|dame|pon|ponme)(?: (?:el|la|los|las|mi|mis|a))? /,'').trim()).filter(Boolean);if(parts.length<2)return null;\n"
  "  const cards=[];for(const p of parts){const k=cardFrom(p);if(!k||k==='timer')return null;if(!cards.includes(k))cards.push(k);}if(cards.length<2)return null;\n"
  "  const said=[];for(const k of cards){if(k==='weather'){if(!cloud()){said.push('el clima (necesita tu cuenta EVIE)');continue;}tools.get_weather({place:null}).catch(()=>{});said.push('el clima');continue;}const r=EvieHUD.open(k);if(r.ok)said.push(k==='clock'?'la hora':EvieHUD.REGISTRY[k]?.title||k);}\n"
  "  const t=cards.includes('clock')?' Son las '+new Intl.DateTimeFormat('es-MX',{timeZone:zone(),hour:'numeric',minute:'2-digit',hour12:true}).format(new Date())+'.':'';\n"
  "  return said.length?'Te dejé '+(said.length>1?said.slice(0,-1).join(', ')+' y '+said.at(-1):said[0])+' en pantalla.'+t:null;}","function multiOpen(q)"),
 (" function hudLocal(q){if(!window.EvieHUD)return null;q=q.replace(/^(oye |hey |ok )?(ivi|ivy|evie|evi|libi)[, ]*/,'').trim();",
  " function hudLocal(q){if(!window.EvieHUD)return null;q=q.replace(/^(oye |hey |ok )?(ivi|ivy|evie|evi|libi|ibi)[, ]*/,'').trim();\n  {const mo=multiOpen(q);if(mo!==null)return mo;}","{const mo=multiOpen(q);if(mo!==null)return mo;}"),
])
edit('public/app.js',[
 ("if(section==='mascota'||section==='kisha')section='bitacora';",
  "if(section==='mascota'||section==='kisha'||section==='mascota-virtual')section='bitacora';if(section==='gimnasio'||section==='salud'||section==='gym'){section='fisico';history.replaceState(null,'','#fisico'+(id?'/'+id:''));}","section==='gimnasio'||section==='salud'"),
])
edit('public/ivy-command-bus.js',[
 ("...(r.route==='bitacora'?['bitacora','mascota','mascota virtual','kisha']:[]),","...(r.route==='bitacora'?['bitacora','mascota','mascota virtual','kisha','a kisha','con kisha']:[]),...(r.route==='fisico'?['fisico','gimnasio','gym','salud','salud y gym','musculos','entrenamientos']:[]),","r.route==='fisico'?['fisico'"),
 ("const nav=q.match(/^(?:abre|abrir|ir a|ve a|muestra|muestrame)\\s+(?:la |el |mi )?(.+)$/);","const nav=q.replace(/^(?:oye |hey )?(?:ivi|ivy|evie|evi|ibi|libi)[, ]+/,'').match(/^(?:abre|abrir|ir a|ve a|muestra|muestrame|entra a|entra en|llevame a|vamos a)\\s+(?:a |al |la |el |mi )?(.+)$/);","entra a|entra en|llevame a"),
])
