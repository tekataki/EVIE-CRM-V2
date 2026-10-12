'use strict';
/* "Configuración personalizada": optional, per-account profile EVIE may use in replies.
   Stored server-side (encrypted, bound to the signed-in session) via /api/profile. Never shared
   between accounts; nothing here is required. Local-only mode keeps a copy in this browser only. */
window.EvieProfile=(()=>{
 const e=s=>Domain.escape(String(s??''));
 let cache=null,owner=null,loading=null;
 const cloud=()=>!!(window.EvieAccounts?.current?.())&&EvieAccounts.config?.()?.accountsEnabled;
 const LOCAL='evie-profile-local';
 const GROUPS=[
  {id:'trato',title:'Cómo te habla EVIE',hint:'Lo que más cambia la experiencia. Todo es opcional.',fields:[
   ['preferred_name','Nombre preferido','text',60,'Cómo quieres que te llame. Ej.: Ale, Naomi.'],
   ['address_as','Forma de dirigirse','text',40,'Ej.: “jefe”, “tú”, “usted”. Vacío = trato neutral.'],
   ['pronouns','Pronombres (opcional)','text',30,'Solo si quieres que EVIE los use.'],
   ['language','Idioma de respuesta','select',['','español','English','español e inglés'],'Vacío = español de México.'],
   ['answer_length','Longitud de respuesta','select',['','muy corta','corta','media','detallada'],'Las respuestas habladas siempre se mantienen breves.'],
   ['tone','Tono','select',['','neutral','cálido','conciso','formal','motivador','divertido'],'Puedes cambiarlo cuando quieras.'],
   ['style_examples','Ejemplos de cómo te gusta que te hablen','textarea',400,'Ej.: “Directo al punto, sin rodeos. Dame el número primero.”']]},
  {id:'lugar',title:'Lugar y hora',hint:'Para responder “¿qué hora es?” y agendar bien.',fields:[
   ['city','Ciudad o región','text',80,'Ej.: Ciudad Guzmán, Jalisco. Ayuda en búsquedas locales.'],
   ['timezone','Zona horaria','select',null,'EVIE usa el reloj del servidor con esta zona (incluye horario de verano).']]},
  {id:'trabajo',title:'Trabajo y prioridades',hint:'Contexto para que las sugerencias tengan sentido.',fields:[
   ['occupation','Ocupación','text',120,'Ej.: estudiante, vendedor, diseñadora.'],
   ['business_context','Contexto de negocio','textarea',600,'Qué vendes, horarios, clientes. EVIE lo trata como dato.'],
   ['priorities','Prioridades actuales','textarea',400,'Ej.: ahorrar para la moto, terminar el semestre.']]},
  {id:'salud',title:'Salud (opcional y sensible)',hint:'Solo se usa en preguntas de salud, gym o comida. No es consejo médico.',fields:[
   ['age','Edad','number',3,'Si eres menor de 18, EVIE no propone déficits calóricos.'],
   ['height_cm','Estatura (cm)','number',3,''],
   ['weight_kg','Peso (kg)','number',4,''],
   ['activity','Actividad física','select',['','sedentaria','ligera','moderada','alta','muy alta'],''],
   ['health_goals','Metas de salud','textarea',300,'Ej.: dormir 8 h, ganar fuerza.'],
   ['gender_identity','Identidad de género (opcional)','text',40,'Solo para cómo te nombra EVIE; no se usa en cálculos.'],
   ['sex_for_calculations','Sexo para fórmulas de calorías','select',['','hombre','mujer','prefiero no usarlo'],'La fórmula de gasto energético (Mifflin–St Jeor) usa un valor fisiológico. Puedes omitirlo.']]}
 ];
 const ZONES=['America/Mexico_City','America/Cancun','America/Chihuahua','America/Hermosillo','America/Mazatlan','America/Tijuana','America/Monterrey','America/Matamoros','America/Bogota','America/Lima','America/Santiago','America/Argentina/Buenos_Aires','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/Madrid','UTC'];
 function localKey(){return LOCAL+':'+(EvieAccounts?.current?.()?.id||'local');}
 async function load(force=false){const id=EvieAccounts?.current?.()?.id||'local';if(owner!==id){cache=null;owner=id;}if(cache&&!force)return cache;
  if(loading)return loading;loading=(async()=>{try{if(cloud()){const r=await EvieAccounts.request('profile');cache=r.profile||{};}else{cache=JSON.parse(localStorage.getItem(localKey())||'{}');}}catch{cache=cache||{};}finally{loading=null;}return cache;})();return loading;}
 async function save(p){if(cloud()){const r=await EvieAccounts.request('profile',{method:'PUT',body:{profile:p}});cache=r.profile;}else{cache=p;localStorage.setItem(localKey(),JSON.stringify(p));}return cache;}
 async function remove(){if(cloud())await EvieAccounts.request('profile',{method:'DELETE'});localStorage.removeItem(localKey());cache={};}
 function current(){return (owner===(EvieAccounts?.current?.()?.id||'local'))?cache:null;}
 function reset(){cache=null;owner=null;}
 function field([k,label,type,opt,hint],p){const v=p[k]??'',id='evp-'+k,h=hint?`<small id="${id}-h">${e(hint)}</small>`:'',aria=hint?` aria-describedby="${id}-h"`:'';
  if(type==='select'){const opts=opt||['',...ZONES];return `<label class="evp-field" for="${id}"><span>${e(label)}</span><select class="select" id="${id}" name="${k}"${aria}>${opts.map(o=>`<option value="${e(o)}" ${String(v)===o?'selected':''}>${o?e(o):'— Sin preferencia —'}</option>`).join('')}</select>${h}</label>`;}
  if(type==='textarea')return `<label class="evp-field wide" for="${id}"><span>${e(label)}</span><textarea class="input" id="${id}" name="${k}" maxlength="${opt}" rows="3"${aria}>${e(v)}</textarea>${h}</label>`;
  return `<label class="evp-field" for="${id}"><span>${e(label)}</span><input class="input" id="${id}" name="${k}" ${type==='number'?'type="number" inputmode="numeric" min="0" max="'+(k==='weight_kg'?'500':k==='age'?'120':'260')+'"':'type="text" maxlength="'+opt+'"'} value="${e(v)}" autocomplete="off"${aria}>${h}</label>`;}
 // Local, deterministic preview so users see the effect without spending AI credits.
 function preview(p){const n=p.preferred_name||'',a=p.address_as||'',hi=a?`${a[0].toUpperCase()+a.slice(1)}${n&&a.toLowerCase()!==n.toLowerCase()?', '+n:''}`:(n?n:'Hola');
  const short=['muy corta','corta'].includes(p.answer_length)||p.tone==='conciso';const en=p.language==='English';
  if(en)return `${hi}, you have 2 tasks today: gym at 6 pm and pay the phone bill.${short?'':' Want me to remind you an hour before?'}`;
  const tone={cálido:' Con calma, vas bien.',motivador:' ¡Tú puedes!',divertido:' Ánimo, que hoy se puede.'}[p.tone]||'';
  return short?`${hi}: 2 pendientes hoy — gym 6 pm y pago del teléfono.`:`${hi}, hoy tienes 2 pendientes: el gym a las 6 de la tarde y pagar el teléfono.${tone} ¿Quieres que te recuerde una hora antes?`;}
 function view(){
  const shell=Views.heading('Configuración personalizada','Cómo quieres que EVIE te hable y qué puede tener en cuenta. Todo es opcional y solo aplica a tu cuenta.','','TU EVIE, A TU MANERA');
  setTimeout(mount,0);
  return shell+`<section class="panel evp" id="evp-root" aria-busy="true"><p class="evp-loading">Cargando tu configuración…</p></section>`;}
 async function mount(){const root=document.getElementById('evp-root');if(!root)return;const p=await load();if(!root.isConnected)return;root.removeAttribute('aria-busy');
  root.innerHTML=`<form id="evp-form" class="evp-form" novalidate>
   <div class="evp-top">
    <label class="evp-switch"><input type="checkbox" name="enabled" ${p.enabled!==false?'checked':''}><span><strong>Usar mi configuración en las respuestas</strong><small>Si lo apagas, EVIE responde con un trato neutral.</small></span></label>
    <aside class="evp-preview" aria-live="polite"><span class="eyebrow">VISTA PREVIA</span><p id="evp-preview">${e(preview(p))}</p><small>Ejemplo local; no consume IA.</small></aside>
   </div>
   ${GROUPS.map(g=>`<fieldset class="evp-group" id="evp-${g.id}"><legend>${e(g.title)}</legend><p class="evp-hint">${e(g.hint)}</p><div class="evp-grid">${g.fields.map(f=>field(f,p)).join('')}</div></fieldset>`).join('')}
   <fieldset class="evp-group"><legend>Contexto adicional (opt-in)</legend><p class="evp-hint">Desactivado por defecto. Si lo activas, EVIE solo lo consulta cuando es relevante a tu pregunta, con un tamaño limitado, y te dice de dónde salió.</p>
    <label class="evp-switch"><input type="checkbox" name="use_journal" ${p.use_journal?'checked':''}><span><strong>Permitir usar mi bitácora</strong><small>Solo promedios de emociones recientes, nunca entradas completas.</small></span></label>
    <p class="evp-hint">Tus negocios, finanzas y agenda se consultan solo cuando preguntas por ellos directamente.</p></fieldset>
   <p class="evp-privacy">${Views.icon('shield-check')} ${cloud()?'Se guarda cifrado en el servidor y ligado a tu sesión. Nadie más con una cuenta EVIE puede verlo.':'Modo local: se guarda solo en este navegador.'}</p>
   <div class="evp-actions"><button class="button primary" type="submit">Guardar</button><button class="button" type="button" data-evp="export">Exportar JSON</button><button class="button danger" type="button" data-evp="delete">Borrar mi configuración</button></div>
  </form>`;
  window.lucide?.createIcons({root});const form=root.querySelector('form');
  const read=()=>{const o={};for(const el of form.elements){if(!el.name)continue;if(el.type==='checkbox')o[el.name]=el.checked;else if(el.value.trim())o[el.name]=el.type==='number'?Number(el.value):el.value.trim();}return o;};
  form.addEventListener('input',()=>{document.getElementById('evp-preview').textContent=preview(read());});
  form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;try{await save(read());App.toast('Configuración guardada. EVIE la usará desde tu próxima pregunta.','success');}catch(err){App.toast(err.message||'No se pudo guardar.','error');}finally{b.disabled=false;}};
  root.querySelector('[data-evp=export]').onclick=()=>{const blob=new Blob([JSON.stringify({format:'evie.profile',version:1,exported_at:new Date().toISOString(),profile:read()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='evie-configuracion-personalizada.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  root.querySelector('[data-evp=delete]').onclick=async()=>{if(!confirm('¿Borrar tu configuración personalizada? Tus registros no se tocan.'))return;try{await remove();App.toast('Configuración borrada.','success');mount();}catch(err){App.toast(err.message||'No se pudo borrar.','error');}};}
 return Object.freeze({view,load,save,remove,current,reset,preview});
})();
