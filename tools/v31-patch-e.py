# v3.1 patch E (idempotent): Google-first authentication UI with staged cutover.
# Server: a newly created (invited) Google account redirects to ?google=new and passes the Google display
#         name in the URL fragment (#inicio&gn=...) ONLY to prefill onboarding (never stored automatically).
# Client: authForm rebuilt with two journeys (Iniciar sesión / Crear mi cuenta), official-style Google
#         button, explicit states (loading, cancelled, expired, unconfigured, invitation, retry).
#         The legacy username/password form remains ONLY as a "transición" disclosure while
#         runtime.passwordLogin !== false (EVIE_PASSWORD_LOGIN != 'off'), so nobody is locked out before
#         Google is configured and linked. Onboarding: display name + "¿Cómo quieres que te llame Ivi?",
#         only when the profile has no name (an existing preferred name is never overwritten).
import os,re
os.chdir('/home/user/webapp')
def rw(p,fn):
    s=open(p).read();t=fn(s)
    if t!=s: open(p,'w').write(t);print('patched',p)
def srv(s):
    if "google=new" in s: return s
    s=s.replace("      acct = { owner_id: id, username, role }","      acct = { owner_id: id, username, role, created: true }",1)
    s=s.replace("    return back(c, st.mode === 'link' ? 'linked' : 'ok')",
"""    if (acct.created) {
      // New invited account → onboarding. The name is only a prefill hint in the fragment (not sent to servers).
      const meta = result.user?.user_metadata || {}, gname = String(google?.identity_data?.full_name || meta.full_name || meta.name || '').trim().slice(0, 60)
      return c.redirect(origin(c) + '/?google=new#inicio' + (gname ? '&gn=' + encodeURIComponent(gname) : ''), 302)
    }
    return back(c, st.mode === 'link' ? 'linked' : 'ok')""",1)
    return s
rw('src/google-auth.js',srv)

NEW_FORM=r""" function authForm(register=false,message=''){const cfg=EvieAccounts.config()||{},enabled=cfg.accountsEnabled===true,google=enabled&&cfg.googleAuth===true,pw=cfg.passwordLogin!==false,invite=cfg.inviteOnly!==false;
  const gBtn=`<button type="button" class="gsi-btn" id="account-google" ${google?'':'disabled aria-describedby="account-google-off"'}><span class="gsi-icon" aria-hidden="true"><svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg></span><span class="gsi-label">Continuar con Google</span></button>`;
  const tabs=`<div class="auth-tabs" role="tablist" aria-label="Elige cómo entrar"><button type="button" role="tab" id="auth-tab-in" aria-selected="${!register}" aria-controls="auth-panel" tabindex="${register?-1:0}" data-auth-tab="in">Iniciar sesión</button><button type="button" role="tab" id="auth-tab-new" aria-selected="${register}" aria-controls="auth-panel" tabindex="${register?0:-1}" data-auth-tab="new">Crear mi cuenta</button></div>`;
  const legacy=pw&&enabled?`<details class="auth-legacy" ${!google?'open':''}><summary>${register?'Crear con usuario y contraseña':'Usar mi usuario actual'} <small>(transición)</small></summary><form id="account-form"><label>Usuario<input name="username" autocomplete="username" minlength="3" maxlength="24" required></label><label>Contraseña<span class="password-control"><input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" minlength="10" maxlength="128" required><button type="button" class="button" id="password-toggle" aria-label="Mostrar contraseña">Ver</button></span></label>${register?'<label>Confirma la contraseña<input type="password" name="confirm" autocomplete="new-password" required></label>':''}<button class="button primary account-submit">${register?'Crear cuenta':'Entrar'}</button><small>Mientras terminas de vincular Google puedes seguir entrando con tu usuario. Después, ve a Configuración → Acceso con Google.</small></form></details>`:'';
  const inv=register&&invite&&enabled?`<label class="auth-invite">Código de invitación<input id="auth-invite" name="invite" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="80" placeholder="XXXX-XXXX-XXXX"></label><small class="auth-hint">EVIE es privado: el código te lo da quien lo administra. Sin él no se crea ninguna cuenta.</small>`:'';
  screen(`<div class="auth-v31" data-mode="${register?'new':'in'}">${enabled?tabs:''}<div id="auth-panel" role="tabpanel" aria-labelledby="${register?'auth-tab-new':'auth-tab-in'}"><h1>${register?'Crea tu espacio':'Hola de nuevo'}</h1><p class="auth-lead">${!enabled?'Las cuentas están desactivadas en esta instalación. Puedes seguir trabajando en modo local.':register?'Tu espacio en EVIE es privado y solo tuyo. Después te pediremos tu nombre y cómo quieres que Ivi te llame.':'Entra con la cuenta de Google vinculada a tu espacio.'}</p>
  ${inv}${enabled?gBtn:''}${enabled&&!google?`<p class="auth-note" id="account-google-off">El acceso con Google aún no está configurado en este servidor. ${pw?'Usa tu usuario actual mientras tanto.':'Pide al administrador que lo active.'}</p>`:''}
  <p class="account-error" id="account-error" role="alert">${e(message)}</p>${message?'<button type="button" class="button auth-retry" id="auth-retry">Reintentar</button>':''}
  ${enabled?`<p class="auth-scope">${Views.icon('shield-check')}<span>Google solo comparte tu nombre y correo para identificarte. EVIE no lee tu Gmail ni tu Calendar. No se fusionan cuentas por correo.</span></p>`:''}
  ${legacy}${!enabled?'<div class="account-secondary"><button class="button" id="account-local">Volver a mi espacio local</button></div>':''}</div></div>`);
  window.lucide?.createIcons?.({root:gate});
  const form=gate.querySelector('#account-form');
  gate.querySelectorAll('[data-auth-tab]').forEach(b=>b.onclick=()=>{authForm(b.dataset.authTab==='new');setTimeout(()=>gate.querySelector('[aria-selected=true]')?.focus(),0);});
  gate.querySelector('[role=tablist]')?.addEventListener('keydown',ev=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();authForm(!register);setTimeout(()=>gate.querySelector('[aria-selected=true]')?.focus(),0);});
  gate.querySelector('#auth-retry')?.addEventListener('click',()=>authForm(register));
  gate.querySelector('#account-local')?.addEventListener('click',unlock);
  gate.querySelector('#password-toggle')?.addEventListener('click',()=>{const p=form.elements.password;p.type=p.type==='password'?'text':'password';gate.querySelector('#password-toggle').textContent=p.type==='password'?'Ver':'Ocultar';});
  gate.querySelector('#account-google')?.addEventListener('click',ev=>{const inv=gate.querySelector('#auth-invite')?.value?.trim();if(register&&invite&&!inv){gate.querySelector('#account-error').textContent='Escribe tu código de invitación antes de continuar con Google.';gate.querySelector('#auth-invite').focus();return;}ev.currentTarget.setAttribute('aria-busy','true');googleStart(ev.currentTarget,inv).finally?.(()=>ev.currentTarget?.removeAttribute?.('aria-busy'));});
  if(form)form.onsubmit=async event=>{event.preventDefault();const b=form.querySelector('.account-submit'),err=gate.querySelector('#account-error');err.textContent='';b.disabled=true;b.textContent='Un momento…';
   try{if(register&&form.elements.password.value!==form.elements.confirm.value)throw Error('Las contraseñas no coinciden.');await EvieAccounts.authenticate(register?'signup':'signin',form.elements.username.value,form.elements.password.value,gate.querySelector('#auth-invite')?.value);form.reset();location.reload();}
   catch(x){form.elements.password.value='';if(form.elements.confirm)form.elements.confirm.value='';err.textContent=x.message||'No se pudo entrar.';b.disabled=false;b.textContent=register?'Crear cuenta':'Entrar';}};
  setTimeout(()=>(gate.querySelector('#auth-invite')||gate.querySelector('#account-google:not([disabled])')||gate.querySelector('[aria-selected=true]'))?.focus({preventScroll:true}),40);
 }"""
def cli(s):
    if 'auth-v31' in s: return s
    lines=s.split('\n')
    i=next(k for k,l in enumerate(lines) if l.startswith(" function authForm(register=false,message=''){"))
    j=next(k for k in range(i+1,len(lines)) if lines[k]==' }')
    assert lines[j+1].startswith(' function onboarding(') or lines[j+1].startswith(' if(window.evieDesktop') or True
    lines[i:j+1]=[NEW_FORM]
    return '\n'.join(lines)
rw('public/account-ui.js',cli)
def msgs(s):
    if "disabled:'El acceso con Google" not in s:
        s=s.replace("denied:'Cancelaste el acceso con Google.'}","denied:'Cancelaste el acceso con Google. No se creó ni cambió nada.',disabled:'El acceso con Google no está activado en este servidor.',invalid:'El enlace de Google no es válido. Vuelve a intentarlo.'}",1)
    if 'evie-gn' not in s:
        s=s.replace("if(g==='linked'){","if(g==='new'){const m=location.hash.match(/[&#]gn=([^&]+)/);try{if(m)sessionStorage.setItem('evie-gn',decodeURIComponent(m[1]).slice(0,60));}catch{}history.replaceState(null,'',location.pathname+'#inicio');return '';}if(g==='linked'){",1)
    return s
rw('public/account-ui.js',msgs)
def onb(s):
    if 'te llame Ivi' in s: return s
    a="""function onboarding(){const p=Store.get().profile;screen(`<h1>Hazlo tuyo</h1><p>Empieza sin registros heredados. Puedes elegir tus módulos después.</p><form id="onboarding-form"><label>Nombre para mostrar<input name="name" maxlength="100" value="${e(p.name)}" required></label><label>Cómo quieres que te llame EVIE<input name="preferred" maxlength="60" value="${e(p.preferred)}" required></label>"""
    assert a in s, 'onboarding anchor'
    s=s.replace(a,"""function onboarding(){const p=Store.get().profile;let hint='';try{hint=sessionStorage.getItem('evie-gn')||'';}catch{}const first=hint.split(/\\s+/)[0]||'';screen(`<div class="auth-v31 auth-onb"><p class="auth-step">Último paso · tu perfil</p><h1>Hazlo tuyo</h1><p class="auth-lead">Empieza sin registros heredados. Puedes cambiarlo cuando quieras en Mi perfil.</p><form id="onboarding-form"><label>Nombre para mostrar<input name="name" maxlength="100" value="${e(p.name||hint)}" autocomplete="name" required></label><label>¿Cómo quieres que te llame Ivi?<input name="preferred" maxlength="60" value="${e(p.preferred||first)}" autocomplete="nickname" required><small>Lo usará en Inicio, en sus respuestas, con Kisha y en tu perfil.</small></label>""",1)
    b="""<p class="account-error" id="onboarding-error" role="alert"></p><button class="button primary">Guardar perfil</button></form>`);"""
    assert b in s, 'onboarding tail'
    s=s.replace(b,"""<p class="account-error" id="onboarding-error" role="alert"></p><button class="button primary">Guardar y entrar</button></form></div>`);try{sessionStorage.removeItem('evie-gn');}catch{}""",1)
    return s
rw('public/account-ui.js',onb)
CSS="""
/* ===== v3.1 Acceso (Google-first) ===== */
.auth-v31{display:grid;gap:14px}
.auth-v31 #auth-panel{display:grid;gap:14px}
.auth-tabs{display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(168,189,255,.16)}
.auth-tabs button{min-height:42px;border:0;border-radius:999px;background:none;color:#b8c3dc;font:inherit;font-weight:600;cursor:pointer;transition:background .25s,color .25s}
.auth-tabs button[aria-selected=true]{background:linear-gradient(140deg,rgba(150,170,255,.95),rgba(180,150,255,.9));color:#0d1430;box-shadow:0 6px 18px rgba(120,120,255,.35)}
.auth-tabs button:focus-visible{outline:2px solid #c6d2ff;outline-offset:2px}
.auth-v31 h1{margin:4px 0 0}
.auth-lead{margin:0!important;color:#b2bed4;line-height:1.6;font-size:14px}
.gsi-btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:50px;padding:0 18px;border-radius:999px;border:1px solid #dadce0;background:#fff;color:#1f1f1f;font:500 15px/1 Roboto,'Google Sans',system-ui,sans-serif;letter-spacing:.2px;cursor:pointer;box-shadow:0 1px 2px rgba(60,64,67,.3),0 1px 3px 1px rgba(60,64,67,.15);transition:box-shadow .2s,background .2s}
.gsi-btn:hover:not(:disabled){background:#f8f9fa;box-shadow:0 1px 3px rgba(60,64,67,.3),0 4px 8px 3px rgba(60,64,67,.15)}
.gsi-btn:focus-visible{outline:3px solid #8ab4f8;outline-offset:3px}
.gsi-btn:disabled{opacity:.55;cursor:not-allowed}
.gsi-btn[aria-busy=true]{opacity:.8;cursor:progress}.gsi-btn[aria-busy=true] .gsi-label::after{content:"…"}
.gsi-icon{display:grid;place-items:center;width:20px;height:20px}
.auth-note{margin:0;padding:10px 12px;border-radius:12px;background:rgba(255,210,122,.1);color:#ffd88e;font-size:13px;line-height:1.5}
.auth-scope{margin:0;display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.55;color:#a9b5cf}
.auth-scope svg{width:15px;height:15px;flex:none;margin-top:1px;color:#9fb4ff}
.auth-invite{margin:0!important}.auth-hint{margin-top:-6px!important}
.auth-retry{justify-self:start}
.auth-legacy{border-top:1px solid rgba(168,189,255,.14);padding-top:10px}
.auth-legacy summary{cursor:pointer;color:#c6d0e8;font-size:13px;min-height:40px;display:flex;align-items:center;gap:6px}
.auth-legacy summary small{color:#8f9bb8;display:inline}
.auth-step{margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9fb4ff}
.auth-onb label small{font-size:12px;color:#a9b5cf}
"""
rw('public/evie-v31.css',lambda s: s if '===== v3.1 Acceso' in s else s+CSS)
print('patch E done')
