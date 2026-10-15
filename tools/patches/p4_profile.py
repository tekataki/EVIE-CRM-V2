# P4: Configuración personalizada redesign — vertical sequence of glass panels (≤2 field columns),
# collapsed "Salud", "Memoria" + "Privacidad y datos" panels, visible save status, preview that never covers
# the form. SAME field names ⇒ saved profiles load unchanged (no data migration needed). Idempotent.
R='/home/user/webapp/'
p='public/evie-profile.js';s=open(R+p).read()
if 'evp-v4' not in s:
    i=s.index(' const GROUPS=['); j=s.index(' ];',i)+3
    GROUPS=""" const GROUPS=[
  {id:'trato',icon:'message-circle-heart',title:'Cómo me habla Ivi',hint:'Lo que más cambia la experiencia. Todo es opcional.',fields:[
   ['preferred_name','Nombre preferido','text',60,'Cómo quieres que te llame. Ej.: Ale, Naomi.'],
   ['address_as','Forma de dirigirse','text',40,'Ej.: “jefe”, “tú”, “usted”. Vacío = trato neutral.'],
   ['tone','Tono','select',['','neutral','cálido','conciso','formal','motivador','divertido'],'Puedes cambiarlo cuando quieras.'],
   ['answer_length','Longitud de respuesta','select',['','muy corta','corta','media','detallada'],'Las respuestas habladas siempre se mantienen breves.'],
   ['language','Idioma de respuesta','select',['','español','English','español e inglés'],'Vacío = español de México.'],
   ['pronouns','Pronombres (opcional)','text',30,'Solo si quieres que Ivi los use.'],
   ['style_examples','Ejemplos de cómo te gusta que te hablen','textarea',400,'Ej.: “Directo al punto, sin rodeos. Dame el número primero.”']]},
  {id:'quien',icon:'user-round',title:'Quién soy y qué me importa',hint:'Contexto para que las sugerencias tengan sentido. Ivi lo trata como dato, nunca como órdenes.',fields:[
   ['occupation','Ocupación','text',120,'Ej.: estudiante, vendedor, diseñadora.'],
   ['gender_identity','Identidad de género (opcional)','text',40,'Solo para cómo te nombra Ivi; no se usa en cálculos.'],
   ['priorities','Prioridades actuales','textarea',400,'Ej.: ahorrar para la moto, terminar el semestre.'],
   ['business_context','Contexto de negocio','textarea',600,'Qué vendes, horarios, clientes.']]},
  {id:'lugar',icon:'map-pin',title:'Lugar y hora',hint:'Para responder “¿qué hora es?”, interpretar “ayer” y agendar bien. No es tu ubicación exacta.',fields:[
   ['city','Ciudad o región','text',80,'Ej.: Ciudad Guzmán, Jalisco.'],
   ['timezone','Zona horaria','select',null,'Ivi usa el reloj del servidor con esta zona (incluye horario de verano).']]},
  {id:'salud',icon:'heart-pulse',collapsed:true,title:'Salud (opcional y sensible)',hint:'Solo se usa en preguntas de salud, gym o comida. No es consejo médico.',fields:[
   ['age','Edad','number',3,'Si eres menor de 18, Ivi no propone déficits calóricos.'],
   ['activity','Actividad física','select',['','sedentaria','ligera','moderada','alta','muy alta'],''],
   ['height_cm','Estatura (cm)','number',3,''],
   ['weight_kg','Peso (kg)','number',4,''],
   ['sex_for_calculations','Sexo para fórmulas de calorías','select',['','hombre','mujer','prefiero no usarlo'],'La fórmula de gasto energético (Mifflin–St Jeor) usa un valor fisiológico. Puedes omitirlo.'],
   ['health_goals','Metas de salud','textarea',300,'Ej.: dormir 8 h, ganar fuerza.']]}
 ];"""
    s=s[:i]+GROUPS+s[j:]
    a=s.index('  root.innerHTML=`<form id="evp-form"'); b=s.index('  </form>`;',a)+len('  </form>`;')
    NEW='''  const panel=(g)=>{const body=`<p class="evp-hint">${e(g.hint)}</p><div class="evp-grid">${g.fields.map(f=>field(f,p)).join('')}</div>`;
   return g.collapsed?`<details class="evp-panel panel" id="evp-${g.id}"><summary><span class="evp-ph">${Views.icon(g.icon)}<span><strong>${e(g.title)}</strong><small>Toca para abrir · cerrado por defecto</small></span></span></summary>${body}</details>`
    :`<section class="evp-panel panel" id="evp-${g.id}" aria-labelledby="evp-${g.id}-t"><header class="evp-ph">${Views.icon(g.icon)}<h3 id="evp-${g.id}-t">${e(g.title)}</h3></header>${body}</section>`;};
  root.innerHTML=`<div class="evp-v4">
   <aside class="evp-preview panel" aria-live="polite" aria-label="Vista previa"><span class="eyebrow">ASÍ TE HABLARÍA IVI</span><p id="evp-preview">${e(preview(p))}</p><small>Ejemplo local; no consume IA.</small></aside>
   <form id="evp-form" class="evp-form" novalidate data-draft-manual>
    <section class="evp-panel panel evp-master"><label class="evp-switch"><input type="checkbox" name="enabled" ${p.enabled!==false?'checked':''}><span><strong>Usar mi configuración en las respuestas</strong><small>Si lo apagas, Ivi responde con un trato neutral.</small></span></label></section>
    ${GROUPS.filter(g=>!g.collapsed).map(panel).join('')}
    <section class="evp-panel panel" id="evp-memoria" aria-labelledby="evp-memoria-t"><header class="evp-ph">${Views.icon('brain')}<h3 id="evp-memoria-t">Memoria</h3></header>
     <p class="evp-hint">Lo que Ivi recuerda porque tú se lo pediste y, si quieres, un resumen de tus conversaciones. Tú decides qué se guarda; puedes corregirlo, exportarlo o borrarlo.</p>
     <div id="evp-memory-host" class="evp-memory-host"></div></section>
    <section class="evp-panel panel" id="evp-privacidad" aria-labelledby="evp-privacidad-t"><header class="evp-ph">${Views.icon('shield-check')}<h3 id="evp-privacidad-t">Privacidad y datos</h3></header>
     <label class="evp-switch"><input type="checkbox" name="use_journal" ${p.use_journal?'checked':''}><span><strong>Permitir usar mi bitácora como contexto</strong><small>Desactivado por defecto. Solo promedios de emociones recientes, nunca entradas completas. Las conversaciones con Kisha no se convierten en recuerdos.</small></span></label>
     <p class="evp-hint">Tus negocios, finanzas y agenda solo se consultan cuando preguntas por ellos. Tu ubicación exacta nunca se guarda como recuerdo ni se comparte con otra cuenta.</p>
     <p class="evp-privacy">${Views.icon('lock')} ${cloud()?'Se guarda cifrado en el servidor y ligado a tu sesión. Nadie más con una cuenta EVIE puede verlo.':'Modo local: se guarda solo en este navegador.'}</p>
     <div class="evp-actions"><button class="button" type="button" data-evp="export">Exportar mi configuración (JSON)</button><button class="button danger" type="button" data-evp="delete">Borrar mi configuración</button></div></section>
    ${GROUPS.filter(g=>g.collapsed).map(panel).join('')}
    <div class="evp-savebar panel" role="group" aria-label="Guardar"><p id="evp-status" class="evp-status" role="status" aria-live="polite" data-state="saved">Todo guardado</p><button class="button primary" type="submit">Guardar cambios</button></div>
   </form></div>`;'''
    s=s[:a]+NEW+s[b:]
    s=s.replace("form.addEventListener('input',()=>{document.getElementById('evp-preview').textContent=preview(read());});",
      "const st=document.getElementById('evp-status');const mark=(t,k)=>{if(st){st.textContent=t;st.dataset.state=k;}};let base=JSON.stringify(read());\n  form.addEventListener('input',()=>{document.getElementById('evp-preview').textContent=preview(read());const dirty=JSON.stringify(read())!==base;mark(dirty?'Cambios sin guardar · solo en este dispositivo':'Todo guardado',dirty?'dirty':'saved');});form.addEventListener('change',()=>form.dispatchEvent(new Event('input')));\n  window.EvieMemoryView?.mount(document.getElementById('evp-memory-host'));",1)
    s=s.replace("try{await save(read());FormSafety.cleanPage(form);App.toast(","mark('Guardando…','saving');try{await save(read());base=JSON.stringify(read());FormSafety.cleanPage(form);mark('Guardado ✓','saved');App.toast(",1)
    s=s.replace("}catch(err){App.toast(err.message||'No se pudo guardar.','error');}finally{b.disabled=false;}};","}catch(err){mark('No se guardó: '+(err.message||'error')+'. Tu borrador sigue aquí.','error');App.toast(err.message||'No se pudo guardar.','error');}finally{b.disabled=false;}};",1)
    s=s.replace("const shell=Views.heading('Configuración personalizada','Cómo quieres que EVIE te hable y qué puede tener en cuenta. Todo es opcional y solo aplica a tu cuenta.','','TU EVIE, A TU MANERA');","const shell=Views.heading('Configuración personalizada','Cómo quieres que Ivi te hable, qué recuerda y qué puede tener en cuenta. Todo es opcional y solo aplica a tu cuenta.','','TU EVIE, A TU MANERA');",1)
    s=s.replace("'type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"'+(k==='weight_kg'?'500':k==='age'?'120':'260')+'\"'","'type=\"number\" inputmode=\"'+(k==='weight_kg'?'decimal':'numeric')+'\" min=\"0\" step=\"'+(k==='weight_kg'?'0.1':'1')+'\" max=\"'+(k==='weight_kg'?'500':k==='age'?'120':'260')+'\"'",1)
    assert "mark('Guardado ✓'" in s and 'evp-memory-host' in s and "data-evp=\"export\"" in s
    open(R+p,'w').write(s)
print('p4 profile ok')
