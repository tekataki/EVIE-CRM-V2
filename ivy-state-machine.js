'use strict';
/* Session-only state; operational severity is independent from voice activity. */
window.IvyState=(()=>{
 const labels=Object.freeze({booting:'Preparando Ivy',idle:'En espera',listening:'Escuchando',transcribing:'Entendiendo',thinking:'Pensando',speaking:'Hablando',executing:'Ejecutando',awaiting_confirmation:'Requiere confirmación',success:'Acción completada',attention:'Requiere atención',urgent:'Prioridad urgente',error:'No se pudo completar',offline:'Integración no disponible'});
 const edges={booting:['idle','error'],idle:['listening','thinking','speaking','awaiting_confirmation','attention','urgent','offline','error'],listening:['transcribing','idle','error'],transcribing:['thinking','idle','error'],thinking:['speaking','awaiting_confirmation','success','idle','offline','error'],speaking:['idle','listening','thinking','error'],awaiting_confirmation:['executing','idle','thinking','error'],executing:['success','error'],success:['idle','thinking','speaking'],attention:['idle','thinking','listening'],urgent:['idle','thinking','listening'],error:['idle','thinking','listening'],offline:['idle','thinking','listening']};
 let value={phase:'booting',severity:'stable',message:'Datos locales listos'};const listeners=new Set();
 const get=()=>Object.freeze({...value,label:labels[value.phase]});
 function publish(){for(const fn of listeners)fn(get());return get();}
 function transition(phase,message=''){if(!Object.hasOwn(labels,phase)||phase!==value.phase&&!edges[value.phase].includes(phase))throw new Error('Transición de Ivy no permitida.');value={...value,phase,message};return publish();}
 function operational(severity){if(!['stable','attention','urgent'].includes(severity))throw new Error('Severidad inválida.');if(value.severity!==severity){value={...value,severity};publish();}}
 function subscribe(fn){listeners.add(fn);fn(get());return ()=>listeners.delete(fn);}
 return Object.freeze({labels,transition,operational,get,subscribe,stats:()=>({listeners:listeners.size})});
})();
window.IvyCapabilities=Object.freeze({list:()=>[
 {id:'commands',label:'Comandos y registros',status:'Local',detail:'Consultas y propuestas revisadas. Sin IA generativa.'},
 {id:'voice',label:'Micrófono y dictado',status:(window.SpeechRecognition||window.webkitSpeechRecognition)&&navigator.mediaDevices?'Depende del navegador':'No disponible',detail:'Solo con permiso. El proveedor del navegador puede procesar la voz; no guardamos audio.'},
 {id:'speech',label:'Voz de Ivy',status:'speechSynthesis' in window?'Depende del navegador':'No disponible',detail:'Texto siempre visible. Animación por eventos, no análisis exacto de voz sintetizada.'},
 {id:'sync',label:'Supabase',status:'No conectado',detail:'Fase futura. Datos separados por navegador y origen; sin cifrado de aplicación.'},
 {id:'ai',label:'IA conversacional',status:'No conectado',detail:'Futuras credenciales efímeras y herramientas revisadas.'},
 {id:'calendar',label:'Google Calendar',status:'No conectado',detail:'Agenda local y .ics disponibles; sin sincronización bidireccional.'},
 {id:'media',label:'Spotify',status:'No conectado',detail:'Requiere autorización y dispositivo compatible en una fase posterior.'},
 {id:'bridge',label:'Ivy Bridge',status:'No conectado',detail:'Windows y activación global requieren el complemento local futuro.'}
]});
window.IvyAdapters=Object.freeze({sync:Object.freeze({status:'local-only',snapshot:()=>structuredClone(Store.get())}),calendar:Object.freeze({status:'local-only',exportICS:rows=>Agenda.ics(rows)}),media:Object.freeze({status:'disconnected'}),desktop:Object.freeze({status:'disconnected',message:'Ivy Bridge no está conectado. Esta acción estará disponible cuando instales el complemento local de Windows.'})});
