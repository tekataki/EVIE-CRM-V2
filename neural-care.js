'use strict';
window.NeuralCare = (() => {
  const e=Domain.escape,F=Forms;
  const observations=['Apetito','Respiración','Digestivo','Movilidad','Piel','Lesión','Reproducción','Otro'];
  const levels=[['observation','Observación'],['followup','Requiere seguimiento'],['urgent','Urgente']];
  function optional(title,fields){return `<details class="form-details care-details"><summary>${title}</summary><div class="form-grid">${fields}</div></details>`;}
  function animal(id){
    const r=id?Store.list('farmAnimals').find(a=>a.id===id):{};
    V2Domain.assert(r,'No se encontró el animal.');
    const roles=Object.entries(Pig.roles).filter(([key])=>key!=='breeding_sow'||r.role==='breeding_sow');
    const types=`<fieldset class="care-type-fieldset" data-neural-essential><legend>01 · Identidad</legend><p>Puedes guardar con el arete y el tipo. Los demás datos son opcionales.</p>${F.field('ear_tag','Arete / identificador',r.ear_tag||'','text','required maxlength="80"',true)}<div class="care-types">${roles.map(([key,label])=>`<label class="care-type"><input type="radio" name="role" value="${key}" required ${key===(r.role||'sow')?'checked':''}>${NeuralFarm.silhouette()}<span>${e(label)}</span></label>`).join('')}</div>${F.select('sex','Sexo',[['female','Hembra'],['male','Macho'],['unknown','Desconocido']],r.sex||'female',true)}<p id="care-sex-help">Se propone el sexo cuando el tipo lo indica. Puedes corregirlo si corresponde.</p></fieldset>`;
    const identity=F.field('name','Nombre opcional',r.name||'')+F.field('location','Corral / ubicación',r.location||'')+F.field('birth_date','Fecha de nacimiento',r.birth_date||'','date',`max="${Domain.today()}"`)+F.select('birth_precision','Precisión de nacimiento',[['unknown','Desconocida'],['approximate','Aproximada'],['exact','Exacta']],r.birth_precision||'unknown')+F.field('origin_description','Origen / procedencia',r.origin_description||'','text','',true)+`<p class="care-help full">La fotografía se añade desde la ficha después de guardar. No es obligatoria.</p>`;
    const detail=F.field('acquisition_date','Ingreso al rancho',r.acquisition_date||'','date',`max="${Domain.today()}"`)+F.field('acquisition_cost','Costo de adquisición · MXN',(r.acquisition_cost||0)/100,'text','inputmode="decimal"')+F.field('weight_kg','Peso observado · kg',r.weight_kg??'','number','min="0" max="1000" step=".1"')+F.area('notes','Notas',r.notes||'');
    F.form(id?'Editar cerdo':'Un nuevo integrante del rancho','Solo datos conocidos. El alta no confirma gestación ni crea gastos en Finanzas.',types+optional('02 · Nombre y origen · opcional',identity)+optional('03 · Más detalles · opcional',detail),data=>{
      V2Domain.assert(data.ear_tag.trim(),'Escribe un arete.');
      V2Domain.assert(Object.hasOwn(Pig.roles,data.role),'Selecciona un tipo de animal.');
      if(data.birth_date)V2Domain.assert(data.birth_precision!=='unknown'||data.birth_date===r.birth_date,'Si indicas una fecha de nacimiento, confirma si es exacta o aproximada.');
      if(!data.birth_date)V2Domain.assert(data.birth_precision==='unknown','Indica la fecha de nacimiento o selecciona precisión desconocida.');
      const next={...r,...data,species:'pig',title:'Arete '+data.ear_tag.trim(),ear_tag:data.ear_tag.trim(),name:data.name.trim(),birth_date:data.birth_date||null,acquisition_date:data.acquisition_date||null,acquisition_cost:Domain.cents(data.acquisition_cost||0),weight_kg:data.weight_kg?Number(data.weight_kg):null};
      if(!id){next.status='active';next.initial_status='active';next.reproductive_state=Pig.breeding(next)?'open':'not_applicable';next.current_state_since=Domain.today();}
      Store.put('farmAnimals',next,id);
    });
    document.getElementById('record-form').addEventListener('change',ev=>{if(ev.target.name==='role'){const sex=document.getElementById('field-sex'),role=ev.target.value;if(['sow','breeding_sow','gilt'].includes(role))sex.value='female';else if(role==='boar')sex.value='male';else if(!id)sex.value='unknown';}if(ev.target.name==='birth_precision'&&ev.target.value==='unknown')document.getElementById('field-birth_date').value='';});
    const birth=document.getElementById('field-birth_date');birth.addEventListener('change',()=>{const precision=document.getElementById('field-birth_precision');if(birth.value&&precision.value==='unknown')precision.value='approximate';});
  }
  function health(id){
    const r=id?Store.list('farmHealthRecords').find(h=>h.id===id):{};
    V2Domain.assert(r,'No se encontró el registro de salud.');
    const animals=Store.list('farmAnimals').filter(a=>!a.archived_at||a.id===r.animal_id);
    if(!animals.length){App.openDialog('Primero, registra un animal',`<p class="dialog-subtitle">Una observación de salud debe pertenecer a un animal real.</p>${Views.button('Agregar cerdo','pig-animal','primary')}`);return;}
    const choose=`<fieldset class="care-type-fieldset" data-neural-essential><legend>01 · ¿A quién observaste?</legend><label class="form-field">Buscar por arete o nombre<input type="search" class="input" id="care-animal-search" placeholder="Escribe un arete…"></label><div class="care-animal-picker">${animals.map(a=>`<label class="care-animal-option" data-animal-search="${e((a.ear_tag+' '+(a.name||'')).toLocaleLowerCase('es'))}"><input type="radio" name="animal_id" value="${e(a.id)}" required ${a.id===r.animal_id?'checked':''}><span><strong>${e(a.ear_tag)}</strong><small>${e(a.name||Pig.roles[a.role])}</small></span></label>`).join('')}</div><p id="care-search-empty" class="care-help" hidden>Sin coincidencias. Prueba otro arete.</p></fieldset>`;
    const observe=`<fieldset class="care-type-fieldset"><legend>02 · Lo que observaste</legend><div class="care-observation-chips">${observations.map(label=>`<label class="care-observation-chip"><input type="checkbox" data-observation="${e(label)}" ${(r.observation_categories||[]).includes(label)?'checked':''}>${e(label)}</label>`).join('')}</div>${F.select('operational_level','Atención operativa',levels,r.operational_level||'observation',true)}${F.area('observation','Describe la observación',r.observation||'','required')}${F.field('date','Fecha',r.date||Domain.today(),'date',`required max="${Domain.today()}"`,true)}${F.select('body_region','Zona observada · opcional',[['','Sin señalar'],['head','Cabeza'],['thorax','Tórax'],['abdomen','Abdomen'],['limbs','Extremidades'],['skin','Piel'],['reproduction','Zona reproductiva'],['general','General']],r.body_region||'',true)}<p class="care-help">Urgente es una prioridad indicada por ti, no un diagnóstico automático. La foto se añade al registro después de guardar.</p></fieldset>`;
    const follow=F.field('professional','Profesional responsable',r.professional||'','text','',true)+F.area('treatment','Indicación capturada del profesional',r.treatment||'')+F.field('medicine','Producto o medicina indicados',r.medicine||'','text','',true)+F.field('next_date','Siguiente revisión',r.next_date||'','date','',true)+F.area('notes','Notas de seguimiento',r.notes||'');
    F.form(id?'Editar observación':'Observar es el primer cuidado','DALI organiza observaciones y seguimientos; no sustituye la evaluación veterinaria.',choose+observe+optional('03 · Seguimiento profesional · opcional',follow),data=>{
      V2Domain.assert(data.animal_id&&animals.some(a=>a.id===data.animal_id),'Selecciona el animal observado.');
      V2Domain.assert(data.observation.trim(),'Describe lo que observaste.');
      V2Domain.assert(levels.some(([key])=>key===data.operational_level),'Selecciona una prioridad operativa.');
      const categories=[...document.querySelectorAll('[data-observation]:checked')].map(el=>el.dataset.observation);
      Store.put('farmHealthRecords',{...r,...data,observation:data.observation.trim(),observation_categories:categories,next_date:data.next_date||null},id);
    },'Guardar observación');
    document.getElementById('care-animal-search').addEventListener('input',ev=>{const query=ev.target.value.trim().toLocaleLowerCase('es');let visible=0;for(const node of document.querySelectorAll('[data-animal-search]')){node.hidden=!node.dataset.animalSearch.includes(query);if(!node.hidden)visible++;}document.getElementById('care-search-empty').hidden=visible>0;});
    document.getElementById('record-form').addEventListener('invalid',ev=>{if(ev.target.name==='animal_id'){document.getElementById('care-animal-search').value='';for(const node of document.querySelectorAll('[data-animal-search]'))node.hidden=false;}},true);
  }
  function setFollowup(s,id,closed,at=new Date().toISOString()){
    const r=s.farmHealthRecords.find(h=>h.id===id&&!h.deleted_at);
    V2Domain.assert(r,'No se encontró el seguimiento.');
    V2Domain.assert(typeof closed==='boolean'&&RCData.stamp(at),'Cambio de seguimiento inválido.');
    const wasClosed=!!r.completed_at||['closed','done'].includes(r.status);
    if(wasClosed===closed)return false;
    r.followup_history=[...(r.followup_history||[]),{at,status:r.status??null,completed_at:r.completed_at??null,next_status:closed?'closed':'open'}];
    r.status=closed?'closed':'open';r.completed_at=closed?at:null;r.updated_at=at;
    return true;
  }
  function healthView(s){
    const records=s.farmHealthRecords.filter(h=>!h.deleted_at).slice().sort((a,b)=>b.date.localeCompare(a.date));
    return PigViews.warning('DALI organiza observaciones y seguimientos; no sustituye la evaluación veterinaria.')+`<div class="toolbar">${PigViews.btn('Registrar observación','health','','primary')}<span class="muted">${records.length} registros · Prioridad indicada por el usuario</span></div>${records.length?`<div class="cards-grid">${records.map(h=>{const a=s.farmAnimals.find(a=>a.id===h.animal_id),level=levels.find(([key])=>key===h.operational_level)?.[1]||'Prioridad no registrada';return `<article class="panel care-health-record"><div class="care-record-header"><a class="tag" href="#granja/${e(h.animal_id)}">Arete ${e(a?.ear_tag||'No disponible')}</a><span class="tag ${h.operational_level==='urgent'?'red':h.operational_level==='followup'?'amber':''}">${e(level)}</span></div><h3>${Views.date(h.date)} · Observación</h3><p>${e(h.observation)}</p><div class="care-tags">${(h.observation_categories||[]).map(c=>`<span class="tag">${e(c)}</span>`).join('')}</div>${h.media_id?V2Views.image(h.media_id,'Fotografía de la observación'):''}<p><strong>${h.completed_at||['closed','done'].includes(h.status)?'Seguimiento cerrado':'Seguimiento abierto'}</strong>${h.next_date?' · Revisión registrada: '+Views.date(h.next_date):''}</p><details class="form-details"><summary>Seguimiento profesional</summary><p>${e(h.professional||'Sin profesional registrado')}</p><p>${e(h.treatment||'Sin indicación capturada')}</p>${h.medicine?`<p>Producto indicado: ${e(h.medicine)}</p>`:''}<p>${e(h.notes||'')}</p></details><div class="toolbar">${PigViews.btn('Editar','health',`data-id="${e(h.id)}"`)}${PigViews.btn(h.completed_at||['closed','done'].includes(h.status)?'Reabrir seguimiento':'Cerrar seguimiento','health-status',`data-id="${e(h.id)}" data-closed="${!(h.completed_at||['closed','done'].includes(h.status))}"`)}${Views.button(h.media_id?'Cambiar foto':'Añadir foto','v2-photo','',`data-collection="farmHealthRecords" data-id="${e(h.id)}"`)}${h.media_id?Views.button('Quitar foto','v2-remove-photo','',`data-collection="farmHealthRecords" data-id="${e(h.id)}"`):''}</div></article>`;}).join('')}</div>`:`<section class="panel feed-empty"><div class="feed-empty-art">${Views.icon('heart-pulse')}</div><h2>El cuidado empieza por observar.</h2><p>Registra lo que viste, a quién corresponde y cuándo revisar de nuevo. Sin diagnósticos ni tratamientos automáticos.</p></section>`}`;
  }
  return {animal,health,healthView,setFollowup,observations,levels};
})();
