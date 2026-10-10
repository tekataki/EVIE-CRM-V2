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
  document.addEventListener('click',ev=>{const t=ev.target.closest('#dali-core-control');if(!t||ev.detail===0||!document.documentElement.classList.contains('evie-ui'))return;ev.stopImmediatePropagation();ev.preventDefault();EvieFX.pulse();EvieAssistant.open(true);EvieAssistant.listen();},true);
  window.EvieModes?.apply();EvieAssistant.fromUrl();
  if(EvieAssistant.pref().clapWake)EvieAssistant.Wake.start();
 }
 function mobileNav(){const nav=document.querySelector('.mobile-nav');if(!nav||nav.querySelector('.evie-orb-button'))return;const links=[...nav.children];const mid=Math.floor(links.length/2);const orb=document.createElement('button');orb.type='button';orb.className='evie-orb-button';orb.dataset.evie='orb';orb.setAttribute('aria-label','Hablar con EVIE');orb.innerHTML='<span class="evie-orb-core" aria-hidden="true"></span>';
  // keep 4 shortcuts around the orb so nothing overlaps on 360px screens
  if(links[mid])links[mid].before(orb);else nav.append(orb);}
 function core(){const c=document.getElementById('neural-canvas');if(!c)return;if(window.IvyRenderer)try{IvyRenderer.stop();}catch{}EvieNeural.mount(c);const ctl=document.getElementById('dali-core-control');if(ctl){ctl.dataset.renderer='evie';ctl.setAttribute('aria-label','EVIE · toca para hablar');}
  const hint=document.querySelector('.neural-orb + *, .neural-core-hint');void hint;}
 function afterRender(){if(!Store.get())return;boot();mobileNav();core();EvieModes?.apply();EvieFX.enterRoute(UI.section+(UI.id?'/'+UI.id:''));
  // the legacy floating pill would overlap content on web: EVIE lives in the bottom orb / top button.
  const dock=document.getElementById('ivy-voice-dock');if(dock&&!window.evieDesktop)dock.hidden=true;
  document.querySelectorAll('.ivy-top-trigger').forEach(b=>{b.dataset.ivyShell='open';b.setAttribute('aria-label','Abrir EVIE');});
 }
 return Object.freeze({afterRender});
})();
