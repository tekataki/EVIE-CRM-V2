'use strict';
/* EVIE v10 · Conexiones entre módulos: lo que se relaciona, se conecta.
   - Cobro de SOMA (Finanzas) → te sugiere apartar tu % para la Misión con un toque.
   - Prospecto ganado (Cabina) → «Registrar cobro» del cliente (Finanzas lo recibe como ingreso SOMA).
   - Seguimiento de SOMA → «A la Agenda» crea el pendiente con su fecha (sin duplicar).
   - Ficha del prospecto → «Practicar esta visita» abre el Dojo con tus paquetes como oferta.
   - Radar local → los avisos verificados de hoy salen en el briefing y en el aviso «Sal ahora».
   Escuela ↔ Agenda ↔ briefing, Físico ↔ briefing, Misión ↔ Objetivos/Finanzas/Contenido, Independencia → Misión y la
   Revisión del domingo (lee todo) viven en sus propios módulos. */
window.EvieConnect=(()=>{
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=c=>Domain.money(Math.round(Number(c)||0));
 /** Toast with a custom action button (App.toast only offers «Deshacer»). */
 function actionToast(text,label,fn,ms=12000){const region=document.getElementById('toast-region');if(!region)return null;const node=document.createElement('div');node.className='toast ec-toast';node.setAttribute('role','status');
  node.innerHTML=(window.Views?Views.icon('sparkles'):'')+`<span>${e(text)}</span>`;const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{node.remove();try{fn();}catch(err){App.toast(err?.message||'No se pudo.','error');}};node.append(b);region.append(node);try{window.lucide?.createIcons?.({root:node});}catch{}setTimeout(()=>node.remove(),ms);return node;}
 /* 1) SOMA income → Misión. Only for small local changes (a sync pull of many rows never prompts). */
 const offered=new Set();
 function onChange(prev,next){if(!prev||!next||!Array.isArray(prev.transactions)||!Array.isArray(next.transactions))return;if(Math.abs(next.transactions.length-prev.transactions.length)>3)return;
  const old=new Set(prev.transactions.map(x=>x.id)),from=window.V2Domain?.addDays?V2Domain.addDays(Domain.today(),-3):Domain.today();
  const fresh=next.transactions.filter(x=>!old.has(x.id)&&!offered.has(x.id)&&!x.deleted_at&&x.business_unit==='soma'&&x.type==='income'&&!x.transfer_id&&x.date>=from);if(!fresh.length)return;fresh.forEach(x=>offered.add(x.id));
  const m=window.EvieMission?.cfg?.();if(!m||m.account_id||!(Number(m.soma_share)>0))return;const amt=fresh.reduce((a,x)=>a+(Number(x.amount)||0),0),part=Math.round(amt*m.soma_share/100);if(part<100)return;
  setTimeout(()=>actionToast(`Entró ${money(amt)} de SOMA. ¿Aparto ${money(part)} (${m.soma_share} %) para «${m.name}»?`,'Apartar',()=>window.EvieMission?.contribute?.(part)),350);}
 try{Store.subscribe(onChange);}catch{}
 /* 2) Won prospect → register the first payment. */
 function offerPayment(id){const c=Store.list('clients').find(x=>x.id===id);if(!c||!window.Forms?.payment)return;setTimeout(()=>actionToast(`¡${c.title} ganado! ¿Registras el anticipo o primer cobro?`,'Registrar cobro',()=>Forms.payment('clients',id)),300);}
 /* 3) SOMA follow-up → Agenda task (idempotent). */
 function followToAgenda(id){const c=Store.list('clients').find(x=>x.id===id);if(!c)return;if(!window.Agenda||!window.RCData)throw Error('La Agenda no está disponible.');
  const date=c.nextDate&&/^\d{4}-\d{2}-\d{2}$/.test(c.nextDate)?c.nextDate:Domain.today(),title=('Seguimiento: '+c.title+(c.nextAction?' · '+c.nextAction:'')).slice(0,140);
  const dup=Store.list('agendaItems').find(x=>x.source==='soma'&&x.title===title&&String(x.due_at||'').slice(0,10)===date&&x.status!=='done');if(dup){App.toast('Ya estaba en tu Agenda.','success');return;}
  const now=new Date().toISOString(),item={...RCData.defaults('agendaItems'),id:crypto.randomUUID(),title,kind:'task',area:'soma',status:'scheduled',priority:'high',all_day:false,due_at:Agenda.toTimestamp(date+'T10:00'),start_at:null,duration_minutes:15,source:'soma',history:[],created_at:now,updated_at:now};
  Store.save(s=>{s.agendaItems.push(item);});App.toast(`Seguimiento agregado a tu Agenda (${date}).`,'success');}
 /* 4) Prospect → Dojo practice with the recommended packages as the offer. */
 function practice(id){const c=Store.list('clients').find(x=>x.id===id),pk=(c?.cabin?.packages||[]).map(pid=>(Store.get()?.preferences?.somaCabin?.packages||[]).find(p=>p.id===pid)?.name).filter(Boolean);
  window.EvieDojo?.preset?.({offer:pk.join(', ')||c?.project||''});location.hash='dojo';}
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-ec]');if(!b)return;const a=b.dataset.ec,id=b.dataset.id;
  try{if(a==='fu-agenda')followToAgenda(id);else if(a==='practice')practice(id);}catch(err){App.toast(err.message||'No se pudo.','error');}});
 /* 5) Radar alerts for the briefing / departure notices. */
 const alerts=()=>{try{return window.EvieRadar?.alerts?.()||[];}catch{return [];}};
 /* 6) Desktop app (Electron) global hotkeys: Ctrl+Space → type to Ivi; Ctrl+Shift+Space (configurable) → talk to Ivi. */
 try{window.evieDesktop?.onHotkey?.(({mode}={})=>{const go=()=>{if(mode==='voice')window.EvieAssistant?.listen?.({inline:true});else document.getElementById('evie-stage-input')?.focus();};
  if(UI.section!=='inicio'||UI.id){location.hash='inicio';setTimeout(go,450);}else go();});}catch{}
 return Object.freeze({actionToast,offerPayment,followToAgenda,practice,alerts,_onChange:onChange});
})();
/* Speech-to-text transport shared by dictation and Ivi's voice: the browser posts to /api/ai/stt; the desktop app
   (evie:// origin) goes through its account proxy with the raw audio (it sets X-Evie-Request/X-Evie-User itself). */
window.EvieSTT=Object.freeze({async post(blob,extra={},signal=null){const d=window.evieDesktop,uid=window.EvieAccounts?.current?.()?.id||'';
 if(d?.account){if(signal?.aborted)throw new DOMException('Operación cancelada.','AbortError');const headers={'Content-Type':blob.type||'audio/webm'};for(const k of ['X-Evie-Duration','X-Evie-Chunk','X-Evie-Hint','X-Evie-Lang'])if(extra[k]!=null&&extra[k]!=='')headers[k]=String(extra[k]);
  const r=await d.account({path:'ai/stt',method:'POST',userId:uid,body:new Uint8Array(await blob.arrayBuffer()),headers});
  return {ok:!!r.ok,status:r.status||(r.ok?200:502),json:async()=>r.ok?(r.data||{}):{error:r.error||'No se pudo transcribir.',code:r.code}};}
 return fetch('/api/ai/stt',{method:'POST',credentials:'same-origin',signal,headers:{'Content-Type':blob.type||'audio/webm','X-Evie-Request':'1','X-Evie-User':uid,...extra},body:blob});}});
