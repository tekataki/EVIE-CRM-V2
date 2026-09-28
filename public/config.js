'use strict';
window.DALI_CONFIG = Object.freeze({
  name:'EVIE CRM V2', assistant:'Ivy', version:'2.1.0-local', locale:'es-MX', timezone:'America/Mexico_City', currency:'MXN',
  get storageKey(){return window.EvieAccounts?EvieAccounts.storageKey():(new URLSearchParams(location.search).has('qa')?'dali-os-qa-'+new URLSearchParams(location.search).get('qa').replace(/[^a-zA-Z0-9-]/g,'').slice(0,50):'dali-os-local-v1');},
  categories:['Ventas','Clientes','Reembolso','Inversión','Gasolina','Comida','Gimnasio','Escuela','Personal','Alimento','Veterinario','Producción','Otro'],
  stages:['Prospecto','Contactado','Interesado','Diagnóstico','Propuesta','Negociación','Cliente activo','Entrega','Completado','Pausado','Perdido'],
  widgets:{finance:'Tu dinero',goals:'Objetivos de hoy',workout:'Último entrenamiento',soma:'SOMA en marcha',learning:'Aprende algo nuevo',journal:'Un momento para ti',farm:'Granja',books:'Tu lectura',alvento:'Próximo drop',content:'Contenido próximo',vision:'Tu horizonte'},
  limits:{jsonBytes:1048576,operations:500,depth:18,imageBytes:10485760,imageDimension:1600},
  sections:[
    {route:'inicio',label:'Inicio',icon:'layout-dashboard',group:'principal',searchTerms:['hoy','resumen'],mobilePriority:1},
    {route:'agenda',label:'Agenda',icon:'calendar-days',group:'principal',searchTerms:['hoy','pendientes','semana'],mobilePriority:0},
    {route:'finanzas',label:'Finanzas',icon:'wallet',group:'principal',searchTerms:['dinero','pagos'],mobilePriority:2},
    {route:'gimnasio',label:'Gimnasio',icon:'dumbbell',group:'principal',searchTerms:['symmetry','entrenamientos'],mobilePriority:0},
    {route:'objetivos',label:'Objetivos',icon:'target',group:'principal',searchTerms:['tareas','metas'],mobilePriority:4},
    {route:'soma',label:'SOMA',icon:'briefcase-business',group:'principal',searchTerms:['clientes'],mobilePriority:0},
    {route:'aprendizaje',label:'Aprendizaje',icon:'graduation-cap',group:'principal',searchTerms:['rutas','habilidades'],mobilePriority:0},
    {route:'bitacora',label:'Bitácora personal',icon:'book-open',group:'principal',searchTerms:['día','diario'],mobilePriority:5},
    {route:'granja',label:'Granja',icon:'sprout',group:'principal',searchTerms:['cerdos','rancho','camadas'],mobilePriority:0},
    {route:'libros',label:'Libros',icon:'library-big',group:'principal',searchTerms:['lectura','biblioteca'],mobilePriority:0},
    {route:'alvento',label:'ALVENTO',icon:'shirt',group:'principal',searchTerms:['drops','ropa'],mobilePriority:0},
    {route:'contenido',label:'Contenido',icon:'clapperboard',group:'principal',searchTerms:['videos','youtube'],mobilePriority:0},
    {route:'vision',label:'Vision Board',icon:'image',group:'principal',searchTerms:['aspiraciones','collage'],mobilePriority:0},
    {route:'subir',label:'Subir',icon:'upload',group:'herramientas',searchTerms:['importar','json','chatgpt'],mobilePriority:3},
    {route:'perfil',label:'Mi perfil',icon:'user-round',group:'cuenta',searchTerms:['identidad','foto'],mobilePriority:0},
    {route:'configuracion',label:'Configuración',icon:'settings-2',group:'cuenta',searchTerms:['respaldo','exportar','tema'],mobilePriority:0}
  ]
});
