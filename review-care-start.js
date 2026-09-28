'use strict';
// Load the real index markup at the browser's actual viewport, in an isolated QA store.
(async()=>{
 const scenario=location.pathname.includes('health')?'health':location.pathname.includes('milestones')?'milestones':'animal';
 history.replaceState(null,'',location.pathname+'?qa=visual-form-'+scenario+'#granja');
 try{
  const response=await fetch('index.html');if(!response.ok)throw new Error('No se pudo cargar index.html.');
  const source=await response.text(),parsed=new DOMParser().parseFromString(source,'text/html');
  const script=parsed.createElement('script');script.src='review-care-open.js';script.defer=true;parsed.head.append(script);
  document.open();document.write('<!doctype html>'+parsed.documentElement.outerHTML);document.close();
 }catch(error){document.body.textContent='No se pudo abrir la revisión: '+error.message;}
})();
