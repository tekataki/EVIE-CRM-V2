'use strict';
// «Ivi, abre X»: the model (or a local intent) only sends a NAME. It resolves to
//  1. a fixed Windows built-in below (an executable in System32/WindowsApps or a registered protocol), or
//  2. an app the person already authorized in EVIE (settings.apps), or
//  3. an installed app found by the catalog, which needs a native «¿Permitir?» before its first use.
// Never a path, argument or command taken from the model. EVIE's own sections («configuración», «reloj»…) are not
// built-ins, so «abre configuración» keeps opening EVIE's settings.
const STOP=new Set(['la','el','los','las','un','una','mi','mis','app','aplicacion','programa','abre','abrir','abreme','porfa','por','favor','de','del']);
function norm(value){return String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9+#]+/g,' ').split(' ').filter(w=>w&&!STOP.has(w)).join(' ').slice(0,80);}
const BUILTINS=Object.freeze([
 {id:'notepad',label:'Bloc de notas',names:['bloc de notas','block de notas','blog de notas','bloc notas','notepad'],exe:'notepad.exe'},
 {id:'calc',label:'Calculadora',names:['calculadora','calculator','calc'],exe:'calc.exe'},
 {id:'paint',label:'Paint',names:['paint','mspaint'],exe:'mspaint.exe',alias:true},
 {id:'explorer',label:'Explorador de archivos',names:['explorador de archivos','explorador','file explorer','mis archivos'],exe:'explorer.exe',windows:true},
 {id:'settings',label:'Configuración de Windows',names:['configuracion de windows','ajustes de windows','windows settings'],uri:'ms-settings:'},
 {id:'snip',label:'Recortes',names:['recortes','herramienta de recortes','snipping tool'],uri:'ms-screenclip:'},
 {id:'store',label:'Microsoft Store',names:['microsoft store','tienda de microsoft','tienda de windows'],uri:'ms-windows-store:'},
 {id:'camera',label:'Cámara',names:['camara','camara de windows'],uri:'microsoft.windows.camera:'},
 {id:'spotify',label:'Spotify',names:['spotify'],uri:'spotify:',web:'https://open.spotify.com/'},
 {id:'whatsapp',label:'WhatsApp',names:['whatsapp','whats','wasap','guasap'],uri:'whatsapp:',web:'https://web.whatsapp.com/'},
 {id:'discord',label:'Discord',names:['discord'],uri:'discord:'},
 {id:'steam',label:'Steam',names:['steam'],uri:'steam://open/main'}]);
const INDEX=new Map(BUILTINS.flatMap(b=>b.names.map(n=>[norm(n),b])));
function builtin(name){return INDEX.get(norm(name))||null;}
// Best catalog/authorized match for a spoken name: exact > prefix > whole word > substring (≥ 4 letters).
function match(name,items){
 const q=norm(name);if(!q)return null;let best=null,score=0,len=Infinity;
 for(const item of items||[]){const n=norm(item?.name);if(!n)continue;
  const s=n===q?100:n.startsWith(q+' ')?80:(' '+n+' ').includes(' '+q+' ')?60:q.length>=4&&n.includes(q)?40:0;
  if(s>score||(s&&s===score&&n.length<len)){best=item;score=s;len=n.length;}}
 return score?best:null;
}
module.exports={norm,builtin,match,BUILTINS};
