'use strict';
// Local form editor: changes remain in the dialog until the settings callback commits.
window.NeuralMilestones = (() => {
  const e=Domain.escape;
  function row(m,key) {
    const categories=[['general','General'],['health','Salud'],['feed','Comida'],['reproduction','Reproducción'],['litter','Camada']];
    if(m.category&&!categories.some(([v])=>v===m.category))categories.push([m.category,m.category]);
    return `<article class="milestone-row" data-milestone-key="${key}"><label>Día relativo<input class="input" data-field="day" type="number" min="0" max="400" step="1" required value="${e(m.day??0)}"></label><label>Nombre<input class="input" data-field="title" type="text" maxlength="200" required value="${e(m.title||'')}"></label><label>Categoría<select class="select" data-field="category">${categories.map(([v,l])=>`<option value="${e(v)}" ${v===(m.category||'general')?'selected':''}>${e(l)}</option>`).join('')}</select></label><label>Nota<input class="input" data-field="note" maxlength="1000" value="${e(m.note||'')}"></label><div class="milestone-controls"><label class="form-check"><input data-field="enabled" type="checkbox" ${m.enabled?'checked':''}>Activo</label><div><button type="button" class="button" data-milestone="up" aria-label="Subir hito">↑</button><button type="button" class="button" data-milestone="down" aria-label="Bajar hito">↓</button><button type="button" class="button" data-milestone="remove" aria-label="Eliminar hito">Eliminar</button></div></div><div class="milestone-confirm" hidden><p>¿Eliminar esta fila? El cambio solo se aplicará al guardar los ajustes.</p><button type="button" class="button" data-milestone="confirm-remove">Sí, eliminar fila</button><button type="button" class="button" data-milestone="cancel-remove">Conservar</button></div></article>`;
  }
  function html(items) {
    return `<fieldset class="milestone-editor" id="milestone-editor" data-neural-essential><legend>Hitos y protocolos</legend><p>Días relativos al nacimiento de la camada. Son recordatorios, no tratamientos. Activar un hito no confirma ningún estado reproductivo.</p><div id="milestone-rows">${items.map((m,n)=>row(m,n)).join('')}</div><button type="button" class="button" id="milestone-add">+ Agregar hito</button><div class="milestone-preview" id="milestone-preview" aria-live="polite"></div></fieldset>`;
  }
  function mount(items) {
    const editor=document.getElementById('milestone-editor'),rows=document.getElementById('milestone-rows'), originals=new Map(items.map((m,n)=>[String(n),structuredClone(m)]));let nextKey=items.length;
    function read(){return [...rows.children].map(node=>{const m={...(originals.get(node.dataset.milestoneKey)||{})};for(const f of node.querySelectorAll('[data-field]'))m[f.dataset.field]=f.type==='checkbox'?f.checked:f.dataset.field==='day'?Number(f.value):f.value.trim();return m;});}
    function preview(){const list=read();document.getElementById('milestone-preview').textContent=list.length?list.map(m=>`Día ${m.day}: ${m.title||'Sin nombre'} · ${m.enabled?'Activo':'Inactivo'}`).join(' / '):'Sin hitos configurados. Agrega únicamente los protocolos confirmados del rancho.';[...rows.children].forEach((node,n)=>{node.querySelector('[data-milestone="up"]').disabled=n===0;node.querySelector('[data-milestone="down"]').disabled=n===rows.children.length-1;});}
    document.getElementById('milestone-add').onclick=()=>{rows.insertAdjacentHTML('beforeend',row({day:0,title:'',enabled:false},nextKey++));preview();rows.lastElementChild.querySelector('[data-field="title"]').focus();};
    editor.addEventListener('input',preview);
    editor.addEventListener('click',ev=>{const button=ev.target.closest('[data-milestone]');if(!button)return;const node=button.closest('.milestone-row'),action=button.dataset.milestone;
      if(action==='up'&&node.previousElementSibling)rows.insertBefore(node,node.previousElementSibling);
      if(action==='down'&&node.nextElementSibling)rows.insertBefore(node.nextElementSibling,node);
      if(action==='remove'){node.querySelector('.milestone-confirm').hidden=false;node.querySelector('[data-milestone="confirm-remove"]').focus();}
      if(action==='cancel-remove'){node.querySelector('.milestone-confirm').hidden=true;node.querySelector('[data-milestone="remove"]').focus();}
      if(action==='confirm-remove'){node.remove();document.getElementById('milestone-add').focus();}
      preview();
    });
    preview();return {read};
  }
  return {html,mount};
})();
