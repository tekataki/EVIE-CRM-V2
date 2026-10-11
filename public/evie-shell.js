'use strict';
/* EVIE shell: mobile bottom nav with central orb, top EVIE trigger, neural core on Inicio,
   route motion and wake-word state. Runs after every App.render(). */
window.EvieShell=(()=>{
 let booted=false;
 function boot(){if(booted)return;booted=true;
  document.documentElement.classList.add('evie-ui');
  // live region for screen readers
  if(!document.getElementById('evie-live')){const l=document.createElement('p');l.id='evie-live';l.className='sr-only';l.setAttribute('aria-live','polite');document.body.append(l);}
  // light blobs behind the glass
  if(!document.getElementById('evie-backdrop')){const b=document.createElement('div');b.id='evie-backdrop';b.setAttribute('aria-hidden','true');b.innerHTML='<i></i><i></i><i></i>';document.body.prepend(b);}
  // Replace legacy top trigger behaviour (IvyChat) with the EVIE panel.
  document.addEventListener('click',ev=>{const t=ev.target.closest('[data-ivy-shell="open"]');if(!t)return;ev.stopImmediatePropagation();ev.preventDefault();EvieAssistant.open();},true);
  // The home core opens EVIE listening (single tap = talk).
  document.addEventListener('click',ev=>{const t=ev.target.closest('#dali-core-control');if(!t||ev.detail===0||!document.documentElement.classList.contains('evie-ui'))return;ev.stopImmediatePropagation();ev.preventDefault();EvieFX.pulse();EvieAssistant.listen({inline:true});},true);
  window.EvieModes?.apply();EvieAssistant.fromUrl();
  if(EvieAssistant.pref().clapWake)EvieAssistant.Wake.start();
 }
 function mobileNav(){const nav=document.querySelector('.mobile-nav');if(!nav||nav.querySelector('.evie-orb-button'))return;
  // 4 shortcuts + centered orb = 5 equal columns: orb is geometrically centered at every width.
  const links=[...nav.children];links.slice(4).forEach(n=>n.remove());const kept=[...nav.children];
  const orb=document.createElement('button');orb.type='button';orb.className='evie-orb-button';orb.dataset.evie='orb';orb.setAttribute('aria-label','Hablar con EVIE');orb.innerHTML='<span class="evie-orb-core" aria-hidden="true"></span>';
  if(kept[2])kept[2].before(orb);else nav.append(orb);nav.style.setProperty('--nav-cols',String(kept.length+1));nav.style.setProperty('--orb-col',String(Math.min(3,kept.length+1)));}
 function core(){const c=document.getElementById('neural-canvas');if(!c)return;if(window.Neural?.orb)Neural.orb();else EvieNeural.mount(c);const ctl=document.getElementById('dali-core-control');if(ctl){ctl.dataset.renderer='evie';ctl.setAttribute('aria-label','EVIE · toca para hablar');}
  const hint=document.querySelector('.neural-orb + *, .neural-core-hint');void hint;}
 function afterRender(){if(!Store.get())return;boot();mobileNav();core();credit();stage();EvieModes?.apply();EvieFX.enterRoute(UI.section+(UI.id?'/'+UI.id:''));
  // the legacy floating pill would overlap content on web: EVIE lives in the bottom orb / top button.
  const dock=document.getElementById('ivy-voice-dock');if(dock&&!window.evieDesktop)dock.hidden=true;
  document.querySelectorAll('.ivy-top-trigger').forEach(b=>{b.dataset.ivyShell='open';b.setAttribute('aria-label','Abrir EVIE');});
 }

 function credit(){const txt=DALI_CONFIG.credit||'';if(!txt)return;const html=txt.replace(/^(Created by)\s+/,'$1 <strong>')+'</strong>';
  const side=document.querySelector('.sidebar-bottom');if(side&&!side.querySelector('.evie-credit')){const c=document.createElement('p');c.className='evie-credit';c.innerHTML=html;side.append(c);}
  const foot=document.querySelector('.app-footer');if(foot&&!document.getElementById('evie-credit-mobile')){const c=document.createElement('p');c.id='evie-credit-mobile';c.className='evie-credit';c.innerHTML=html;foot.append(c);}}
 // Inline EVIE stage (subtitles + composer) right under the neural core on Inicio.
 function stage(){if(UI.section!=='inicio'||UI.id)return;const orb=document.querySelector('#neural-home-hero .neural-orb');if(!orb||document.getElementById('evie-stage'))return;const st=document.createElement('section');st.id='evie-stage';st.className='evie-stage';st.setAttribute('aria-label','Conversación con EVIE');
  st.innerHTML=`<div class="evie-subs" id="evie-subs" aria-live="polite"><p class="status" data-evie-phase>Lista</p></div><div class="evie-draft" id="evie-stage-draft" hidden></div><form class="evie-composer" id="evie-stage-form"><label class="sr-only" for="evie-stage-input">Escríbele a EVIE</label><input id="evie-stage-input" autocomplete="off" maxlength="600" placeholder="Pregúntale algo a EVIE…"><button type="button" class="icon-button evie-mic" data-evie="listen" aria-label="Hablar con EVIE">${Views.icon('mic')}</button><button class="icon-button evie-send" aria-label="Enviar">${Views.icon('arrow-up')}</button></form><div class="evie-stage-links"><button type="button" data-evie="open">Ver conversación completa</button><button type="button" data-evie="stop">Detener</button></div>`;
  const hero=document.getElementById('neural-home-hero');hero.after(st);
  st.querySelector('form').onsubmit=ev=>{ev.preventDefault();const i=st.querySelector('input'),v=i.value;i.value='';EvieAssistant.ask(v,{speak:!EvieAssistant.pref().muted&&EvieAssistant.pref().conversation,inline:true});};
  EvieAssistant.syncInline();window.lucide?.createIcons({root:st});}
 return Object.freeze({afterRender});
})();
