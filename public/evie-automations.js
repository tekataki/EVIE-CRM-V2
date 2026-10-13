'use strict';
/* EVIE Automatizaciones (v3.1): user-defined website shortcuts EVIE can open by voice.
   Pure core (no DOM): URL normalization/validation, record validation, voice matching.
   Records live in the account-scoped collection `automations` (Store + sync engine + Supabase
   crm_records). They are only shortcuts: no background workflows, no auto-login, no scraping. */
window.EvieAutomations=(()=>{
 const MAX_NAME=80,MAX_DESC=280,MAX_ALIASES=8,MAX_ALIAS=60,MAX_URL=2048;
 const PRIVATE=h=>/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.)/.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||/\.(local|internal|lan|localhost)$/.test(h)||h.startsWith('[');
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();
 /* Accepts "soma.mx", "www.soma.mx/x", "https://…". Rejects javascript:, data:, file:, blob:,
    ftp:, app schemes, credentials in the URL, and local/private network hosts. */
 function normalizeUrl(raw){let s=String(raw||'').trim();if(!s)throw Error('Escribe la dirección del sitio.');if(s.length>MAX_URL)throw Error('La dirección es demasiado larga.');
  if(/[\u0000-\u001f\s]/.test(s))throw Error('La dirección no puede tener espacios.');
  const scheme=s.match(/^([a-z][a-z0-9+.-]*):(?!\d)/i);
  if(scheme&&!/^https?$/i.test(scheme[1]))throw Error('Solo se permiten sitios web (http o https). «'+scheme[1]+':» no está permitido.');
  if(!/^https?:\/\//i.test(s))s='https://'+s.replace(/^\/+/,'');
  let u;try{u=new URL(s);}catch{throw Error('Esa dirección no parece válida.');}
  if(!['http:','https:'].includes(u.protocol))throw Error('Solo se permiten sitios web (http o https).');
  if(u.username||u.password)throw Error('No guardes usuario ni contraseña dentro de la dirección.');
  const h=u.hostname.toLowerCase();if(!h.includes('.')||h.endsWith('.')||PRIVATE(h))throw Error('Usa la dirección pública del sitio.');
  return u.href;}
 function domain(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '';}}
 function cleanAliases(list){const out=[],seen=new Set();for(const a of (Array.isArray(list)?list:String(list||'').split(/[,\n;]/))){const t=String(a).trim().slice(0,MAX_ALIAS);const k=norm(t);if(!k||seen.has(k))continue;seen.add(k);out.push(t);if(out.length>=MAX_ALIASES)break;}return out;}
 function build(input,prev=null){const name=String(input.name??input.title??'').trim();if(!name)throw Error('Ponle un nombre a la automatización.');if(name.length>MAX_NAME)throw Error('El nombre es demasiado largo (máx. '+MAX_NAME+').');
  const description=String(input.description||'').trim();if(description.length>MAX_DESC)throw Error('La descripción es demasiado larga (máx. '+MAX_DESC+').');
  const url=normalizeUrl(input.url);const now=new Date().toISOString();
  return {...(prev||{}),title:name,name,url,domain:domain(url),description,aliases:cleanAliases(input.aliases),kind:'website',date:prev?.date||now.slice(0,10),updated_at:now,created_at:prev?.created_at||now,opened_count:prev?.opened_count||0,last_opened_at:prev?.last_opened_at||null};}
 /* Store-level validator (also guards synced/imported data). Deleted tombstones only need identity. */
 function validate(r){if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(r.id))return false;if(r.deleted_at)return true;
  const ok=typeof r.name==='string'&&r.name.trim()&&r.name.length<=MAX_NAME&&r.title===r.name&&typeof r.url==='string'&&r.kind==='website'&&typeof r.description==='string'&&r.description.length<=MAX_DESC&&Array.isArray(r.aliases)&&r.aliases.length<=MAX_ALIASES&&r.aliases.every(a=>typeof a==='string'&&a.length<=MAX_ALIAS);
  if(!ok)return false;try{return normalizeUrl(r.url)===r.url;}catch{return false;}}
 const STOP=new Set(['la','el','los','las','de','del','mi','mis','pagina','sitio','web','website','portal','enlace','link','liga','url','abre','abrir','ir','a','al','en','por','favor']);
 const words=s=>norm(s).split(' ').filter(w=>w&&!STOP.has(w));
 const SITE_WORDS=/\b(pagina|sitio|web|website|portal|liga|link|enlace|url)\b/;
 const MODULE_WORDS=/\b(apartado|modulo|seccion|crm|tarjeta|panel)\b/;
 /* Is this phrase about a WEBSITE (vs an internal CRM module)? */
 function intent(text){const q=norm(text);return {site:SITE_WORDS.test(q),module:MODULE_WORDS.test(q)};}
 /* Match saved shortcuts: exact name/alias > all name words present > partial. Ties → ambiguity. */
 function match(list,text){const q=norm(text),qw=words(text);if(!qw.length)return [];
  const scored=[];for(const r of list){if(r.deleted_at)continue;let best=0;
   for(const n of [r.name,...(r.aliases||[])]){const nn=norm(n),nw=words(n);if(!nw.length)continue;if(nn===q||nw.join(' ')===qw.join(' '))best=Math.max(best,100);else if(nw.every(w=>qw.includes(w)))best=Math.max(best,60+nw.length);else{const hit=nw.filter(w=>qw.includes(w)).length;if(hit)best=Math.max(best,hit*10);}}
   if(best)scored.push([best,r]);}
  scored.sort((a,b)=>b[0]-a[0]);if(!scored.length)return [];const top=scored[0][0];return scored.filter(x=>x[0]===top).map(x=>x[1]);}
 return Object.freeze({normalizeUrl,domain,cleanAliases,build,validate,match,intent,norm,limits:{MAX_NAME,MAX_DESC,MAX_ALIASES,MAX_ALIAS,MAX_URL}});
})();
