'use strict';
window.Store = (()=>{
  let state, revision=0;
  let key=DALI_CONFIG.storageKey;
  const listeners=new Set();
  const blankProfile=()=>({name:'',preferred:'',birth:'',location:'',role:'',school:'',languages:'',interests:'',projects:'',bio:'',financialGoal:0,greeting_form:'Hola'});
  function blank(){const s=Migrations.migrate(initial());s.profile=blankProfile();for(const c of collections)s[c]=[];s.preferences.greeting='';s.preferences.greeting_form='Hola';s.preferences.somaMonthlyTargetCents=1;delete s.preferences.visionLines;s.preferences.theme='dark';s.revision=0;validate(s);return s;}
  function lock(){state=undefined;revision=0;listeners.clear();}
  function subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
  const coreCollections=['transactions','bills','loans','goals','clients','routines','sessions','metrics','skills','studySessions','journal'];
  const collections=[...coreCollections,...V2Domain.collections,...RCData.collections];
  const uuid=()=>crypto.randomUUID();
  function record(data){return {id:uuid(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...data};}
  function initial(){
    const areas=['Mentalidad comercial y creación de valor','Cliente ideal e investigación del negocio','Construcción de una oferta','Prospección y preparación','Primer contacto y pitch','Preguntas de diagnóstico y escucha','Demostración y propuesta','Manejo de objeciones','Negociación','Cierre','Seguimiento y experiencia del cliente','Métricas, revisión y mejora','Automatización del proceso comercial','Prueba final: cerrar un cliente real'];
    return {version:1,revision:0,profile:{name:'Alejandro Dali Medina Ramírez',preferred:'Dali',birth:'2008-12-06',location:'Ciudad Guzmán, Jalisco, México',role:'Emprendedor y estudiante de Ingeniería en Gestión Empresarial',school:'Instituto Tecnológico de Ciudad Guzmán (ITCG)',languages:'Español, inglés, francés y ruso',interests:'Negocios, marketing digital, programación, fitness, psicología, filosofía, carros y basketball',projects:'SOMA, ALVENTO, Rancho familiar',bio:'Construir con intención. Aprender todos los días.',financialGoal:3300000},preferences:{theme:'light',hiddenWidgets:[],widgetOrder:['finance','goals','workout','soma','learning','journal']},transactions:[],bills:[],loans:[],goals:[],clients:[record({title:'Intensity',stage:'Prospecto',contact:'',phone:'',email:'',project:'',amount:0,date:Domain.today(),note:'Registro inicial editable. Completa la información real de este cliente.',payments:[],deliverables:[]})],routines:[['Upper',1,'Press de banca\nRemo con barra\nPress militar'],['Pierna',2,'Sentadilla\nPeso muerto rumano\nElevación de pantorrillas'],['Pecho / Espalda',4,'Press inclinado\nJalón al pecho\nRemo con mancuerna'],['Brazo',5,'Curl de bíceps\nExtensión de tríceps\nElevaciones laterales']].map(([title,day,exercises])=>record({title,day,exercises})),sessions:[],metrics:[],skills:[record({title:'Ventas para SOMA',category:'Negocios',reason:'Crear valor real y hacer crecer SOMA.',status:'Activa',minutes:120,date:Domain.today(),tasks:areas.map((title,i)=>({id:uuid(),title,points:i===13?5:2,done:false,final:i===13,evidence:'',level:Math.min(6,Math.floor(i/2))}))})],studySessions:[],journal:[]};
  }
  function init(){
    key=DALI_CONFIG.storageKey;
    const raw=localStorage.getItem(key), original=raw?JSON.parse(raw):(key.startsWith('dali-os-qa-')?initial():blank());
    // Fresh personal origins must not receive legacy demo clients/routines/skills.
    // Original fixtures are retained ONLY under explicitly isolated QA keys.
    if(!raw){original.preferences.theme='dark';if(!key.startsWith('dali-os-qa-'))for(const c of ['clients','routines','skills'])original[c]=[];}
    validate(original);
    if(original.version<4||original.farm_catalog_version!==4){
      const next=Migrations.migrate(original);
      if(raw)next.revision=(original.revision||0)+1;
      validate(next);
      if(raw&&original.version===1&&!localStorage.getItem(key+'-pre-v2'))localStorage.setItem(key+'-pre-v2',raw);
      if(raw&&original.version<3&&!localStorage.getItem(key+'-pre-v3'))localStorage.setItem(key+'-pre-v3',raw);
      if(raw&&!localStorage.getItem(key+'-pre-catalog-v4'))localStorage.setItem(key+'-pre-catalog-v4',raw);
      if(raw&&original.version<4&&!localStorage.getItem(key+'-pre-v4'))localStorage.setItem(key+'-pre-v4',raw);
      localStorage.setItem(key,JSON.stringify(next));state=next;
    }else state=original;
    revision=state.revision||0;
    if(Domain.renewGoals(structuredClone(state.goals)))save(s=>Domain.renewGoals(s.goals));
    return state;
  }
  function validate(s) {
    const fail = message => { throw new Error(message); };
    const text = value => typeof value === 'string' && value.length <= 15000;
    const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(+new Date(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
    const idValid = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
    if (!s || ![1,2,3,4].includes(s.version) || !s.profile || !s.preferences) fail('El archivo no es un respaldo compatible de DALI OS.');
    for (const key of ['name','preferred','birth','location','role','school','languages','interests','projects','bio']) if (!text(s.profile[key])) fail('Perfil incompleto o no válido.');
    if ((s.profile.birth!=='' && !date(s.profile.birth)) || !Number.isSafeInteger(s.profile.financialGoal) || s.profile.financialGoal < 0) fail('Perfil no válido.');
    const widgets = s.version===1?['finance','goals','workout','soma','learning','journal']:Object.keys(DALI_CONFIG.widgets);
    if (!['light','dark'].includes(s.preferences.theme) || !Array.isArray(s.preferences.widgetOrder) || !Array.isArray(s.preferences.hiddenWidgets) || s.preferences.widgetOrder.length !== widgets.length || new Set(s.preferences.widgetOrder).size !== widgets.length || s.preferences.widgetOrder.some(x=>!widgets.includes(x)) || s.preferences.hiddenWidgets.some(x=>!widgets.includes(x))) fail('Preferencias no válidas.');
    if (s.categories && (!Array.isArray(s.categories) || !s.categories.length || s.categories.length>50 || s.categories.some(x=>!text(x)||!x.trim()||x.length>80))) fail('Categorías no válidas.');
    const payments = new Map();
    for (const c of coreCollections) {
      if (!Array.isArray(s[c]) || s[c].length > 50000) fail('Colección no válida: '+c);
      const ids = new Set(); let total = 0;
      for (const r of s[c]) {
        if (!r || !idValid(r.id) || ids.has(r.id)) fail('Identificadores no válidos o duplicados en '+c);
        ids.add(r.id);
        if (!['metrics','studySessions'].includes(c) && (!text(r.title)||!r.title.trim())) fail('Título no válido en '+c);
        if (c !== 'routines' && !date(r.date)) fail('Fecha no válida en '+c);
        if (['transactions','bills','loans','clients'].includes(c)) {
          if (!Number.isSafeInteger(r.amount) || r.amount < 0 || !Number.isSafeInteger(total += r.amount)) fail('Importe fuera de rango en '+c);
          if (c !== 'transactions' && !Array.isArray(r.payments)) fail('Abonos no válidos.');
          let paid=0;
          for (const p of r.payments||[]) {
            if (!idValid(p.id) || payments.has(p.id) || !Number.isSafeInteger(p.amount) || p.amount<=0 || !date(p.date) || !Number.isSafeInteger(paid+=p.amount)) fail('Abonos no válidos o duplicados.');
            payments.set(p.id,{...p,source:c});
          }
          if (paid>r.amount) fail('Los abonos no pueden superar el monto total.');
        }
        if (c==='transactions' && (!['income','expense'].includes(r.type)||!text(r.category))) fail('Movimiento no válido.');
        if (c==='clients' && (!text(r.stage)||!text(r.phone)||!Array.isArray(r.deliverables||[])||(r.deliverables||[]).some(d=>!idValid(d.id)||!text(d.title)))) fail('Cliente no válido.');
        if (c==='goals' && (!Number.isInteger(r.target)||r.target<=0||!Number.isInteger(r.progress)||r.progress<0||r.progress>r.target||!['diario','semanal','mensual','anual'].includes(r.horizon)||!text(r.category)||!text(r.periodKey)||!Array.isArray(r.history))) fail('Objetivo no válido.');
        if (c==='routines' && (!text(r.exercises)||!r.exercises.trim()||!Number.isInteger(r.day)||r.day<0||r.day>6)) fail('Rutina no válida.');
        if (c==='sessions' && (!Array.isArray(r.sets)||r.sets.some(t=>!idValid(t.id)||!text(t.exercise)||!Number.isFinite(t.weight)||t.weight<0||t.weight>1000||!Number.isInteger(t.reps)||t.reps<0||t.reps>1000||!Number.isInteger(t.rir)||t.rir<0||t.rir>10))) fail('Series no válidas.');
        if (c==='metrics' && (!Number.isFinite(r.weight)||r.weight<=0||r.weight>500)) fail('Peso corporal no válido.');
        if (c==='skills' && (!Array.isArray(r.tasks)||r.tasks.some(t=>!idValid(t.id)||!text(t.title)||!Number.isInteger(t.points)||t.points<=0||!Number.isInteger(t.level)||t.level<0||t.level>6||!text(t.evidence)))) fail('Ruta de aprendizaje no válida.');
        if (c==='studySessions' && (!Number.isInteger(r.minutes)||r.minutes<=0||r.minutes>1440||!idValid(r.skillId))) fail('Sesión de estudio no válida.');
        if (c==='journal' && !(r.journal_version===4?JournalData.validate(r):Domain.validateJournal(r))) fail('Bitácora no válida.');
      }
    }
    const linked = new Map();
    for (const t of s.transactions.filter(t=>t.origin&&!t.deleted_at&&!['farm-sale','alvento-sale','farm-feed-purchase','grocery'].includes(t.source))) {
      const p=payments.get(t.origin);
      if (!p||!p.link||p.amount!==t.amount||t.type!==(p.source==='bills'?'expense':'income')||linked.has(t.origin)) fail('Movimiento vinculado inconsistente. Restaura un respaldo completo o revierte el abono desde su origen.');
      linked.set(t.origin,t);
    }
    for (const p of payments.values()) if (p.link&&!linked.has(p.id)) fail('Un abono vinculado no tiene su movimiento financiero. La importación se canceló sin modificar tus datos.');
    if(s.version>=2)V2Domain.validate(s);
    if(s.version>=3)Feed.validate(s);
    if(s.version>=4)RCData.validate(s);
    return true;
  }
  function save(mutator){if(!state||key!==DALI_CONFIG.storageKey)throw new Error('La sesión cambió. Recarga tu espacio antes de guardar.');const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored&&(stored.revision||0)!==revision)throw new Error('Los datos cambiaron en otra pestaña. Recarga antes de guardar.');const next=structuredClone(state);mutator(next);next.revision=revision+1;validate(next);localStorage.setItem(key,JSON.stringify(next));const previous=state;state=next;revision=next.revision;for(const fn of listeners){try{fn(structuredClone(previous),structuredClone(next));}catch(error){console.warn('EVIE: no se pudo preparar sincronización');}}return state;}
  function put(collection,data,id){let result;save(s=>{if(id){const index=s[collection].findIndex(x=>x.id===id);if(index<0)throw new Error('No se encontró el registro.');result={...s[collection][index],...data,updated_at:new Date().toISOString()};s[collection][index]=result;}else{result=record(data);s[collection].push(result);}});return result;}
  function remove(collection,id){save(s=>{const item=s[collection].find(x=>x.id===id);if(item)item.deleted_at=new Date().toISOString();});}
  function merge(incoming){validate(incoming);incoming=Migrations.migrate(incoming);validate(incoming);save(s=>{for(const c of collections){const ids=new Set(s[c].map(x=>x.id));for(const r of incoming[c])if(!ids.has(r.id)){s[c].push(r);ids.add(r.id);}}});}
  return {init,save,put,remove,merge,validate,uuid,record,blank,lock,subscribe,get:()=>state,list:c=>state[c].filter(x=>!x.deleted_at),collections};
})();
