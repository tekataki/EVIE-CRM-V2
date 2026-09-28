'use strict';
// This script is injected only by the review launcher, never by the production index.
if(window.DALI_READY&&new URLSearchParams(location.search).get('qa')?.startsWith('visual-form-')){
 const scenario=location.pathname.includes('health')?'health':location.pathname.includes('milestones')?'milestones':'animal';
 if(scenario==='health'&&!Store.list('farmAnimals').length)Store.put('farmAnimals',{...Records.defaults('farmAnimals'),ear_tag:'QA-SALUD',name:'Animal de prueba aislado'});
 UI.section='granja';UI.id=null;UI.tab.granja=scenario==='health'?'health':scenario==='milestones'?'settings':'animals';App.render();Neural.dismiss();
 if(scenario==='health')PigForms.health();else if(scenario==='milestones')PigForms.settings();else PigForms.animal();
 requestAnimationFrame(()=>{if(scenario==='milestones')document.getElementById('milestone-editor').scrollIntoView({block:'start'});document.documentElement.dataset.careReview='ready';});
}
