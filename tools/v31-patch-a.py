# EVIE v3.1 patch A (idempotent): Automatizaciones wiring, desktop open_url, assistant intents/tools,
# e2e-hud updates for the persistent workspace, capability registry. Safe to re-run.
import os, re
os.chdir('/home/user/webapp')
def rw(p, fn):
    s = open(p).read(); t = fn(s)
    if t != s: open(p, 'w').write(t); print('patched', p)
def once(s, old, new, mark=None):
    if (mark or new) in s: return s
    assert old in s, ('anchor missing', old[:80]); return s.replace(old, new, 1)

# ---- e2e-hud: workspace semantics ----
def e2e(s):
    s = once(s, "await p.keyboard.press('Escape'); await p.waitForTimeout(500); assert.equal((await cards()).length, 1); ok('Escape closes the active card')",
        "await p.focus('.hud-card'); await p.keyboard.press('Escape'); await p.waitForTimeout(500); assert.equal((await cards()).length, 1); ok('Escape closes the focused card')")
    s = once(s, "assert.equal(s.n, 4); assert.equal(s.overlap, 0); assert.ok(s.sw <= s.vw + 1, 'no horizontal scroll'); ok(`max 4 cards, no overlap, no horizontal scroll at ${W}px`)",
        "assert.ok(s.n >= 3 && s.n <= 4); assert.equal((await cards()).length, 5, 'no card evicted'); assert.equal(s.overlap, 0); assert.ok(s.sw <= s.vw + 1, 'no horizontal scroll'); ok(`5 open (${s.n} visible, rest in tray), no overlap, no horizontal scroll at ${W}px`)")
    s = once(s, "assert.deepEqual(s, { cards: 0, cls: false }); ok('leaving Home disposes cards and restores normal layout')",
        "assert.deepEqual(s, { cards: 5, cls: false }); ok('leaving Home detaches the HUD (workspace kept for return)')")
    return s
rw('tools/e2e-hud.mjs', e2e)

# ---- data model ----
rw('public/rc-data.js', lambda s: once(once(once(s,
    "const collections=['agendaItems','entityLinks','nutritionDays','pantryItems','groceryRuns'];",
    "const collections=['agendaItems','entityLinks','nutritionDays','pantryItems','groceryRuns','automations'];"),
    "const s=structuredClone(input);if(s.version===4)return s;",
    "const s=structuredClone(input);if(s.version===4){if(s.automations===undefined)s.automations=[];return s;}"),
    "  for(const r of s.journal)if(r.journal_version===4)JournalData.validate(r);\n  return true;",
    "  for(const r of s.journal)if(r.journal_version===4)JournalData.validate(r);\n  if(window.EvieAutomations)for(const r of s.automations)A(EvieAutomations.validate(r),'Automatización inválida: «'+String(r?.name||'').slice(0,40)+'». Solo se permiten sitios web http/https.');\n  return true;"))
rw('public/migrations.js', lambda s: once(s, "if(input.version===4){const next=structuredClone(input);if(next.farm_catalog_version",
    "if(input.version===4){const next=structuredClone(input);if(next.automations===undefined)next.automations=[];if(next.farm_catalog_version"))
rw('public/index.html', lambda s: once(once(s, '<script defer src="rc-data.js"></script>',
    '<script defer src="evie-automations.js"></script><script defer src="rc-data.js"></script>'),
    '<script defer src="evie-v3-views.js"></script>',
    '<script defer src="evie-v3-views.js"></script><script defer src="evie-automations-ui.js"></script><script defer src="evie-caps.js"></script>'))
rw('public/config.js', lambda s: once(s, "{route:'subir',label:'Subir',icon:'upload',group:'herramientas'",
    "{route:'automatizaciones',label:'Automatizaciones',icon:'zap',group:'herramientas',searchTerms:['atajos','sitios','paginas','enlaces','web','abrir'],mobilePriority:0},{route:'subir',label:'Subir',icon:'upload',group:'herramientas'"))
rw('public/app.js', lambda s: once(s, "pendientes:()=>window.EviePendientesView?",
    "automatizaciones:()=>window.EvieAutomationsView?EvieAutomationsView.render():Views.home(),pendientes:()=>window.EviePendientesView?"))
rw('tests/accounts.test.cjs', lambda s: s.replace('length,18', 'length,19').replace(',18)', ',19)'))
rw('public/account-ui.js', lambda s: once(s, "window.EvieHUD?.dispose?.();", "window.EvieHUD?.reset?.();window.EvieAutomationsView?.reset?.();"))

# ---- desktop open_url ----
def desk(s):
    s = once(s, "'cancel_message','status']);", "'cancel_message','status','open_url']);")
    s = once(s, "const PHONE=/^\\+?[0-9]{8,15}$/,TOKEN=/^[0-9a-f-]{36}$/;",
"""const PHONE=/^\\+?[0-9]{8,15}$/,TOKEN=/^[0-9a-f-]{36}$/;
// v3.1 Automatizaciones: ONLY public http(s) websites, opened in the user's normal browser (shell.openExternal).
function safeWebUrl(raw){if(typeof raw!=='string'||raw.length>2048||/[\\u0000-\\u001f\\s]/.test(raw))throw Error('Dirección inválida.');let u;try{u=new URL(raw);}catch{throw Error('Dirección inválida.');}
 if(!['http:','https:'].includes(u.protocol))throw Error('Solo se abren sitios web http/https.');if(u.username||u.password)throw Error('La dirección no puede incluir credenciales.');
 const h=u.hostname.toLowerCase();if(!h.includes('.')||/^(localhost|0\\.0\\.0\\.0|127\\.|10\\.|192\\.168\\.|169\\.254\\.)/.test(h)||/^172\\.(1[6-9]|2\\d|3[01])\\./.test(h)||/\\.(local|internal|lan)$/.test(h))throw Error('Solo sitios públicos.');return u.href;}""", mark='function safeWebUrl')
    s = once(s, " else if(['open_prepared_message','cancel_message'].includes(args.action)){",
        " else if(args.action==='open_url'){if(keys!=='action,url')throw Error('Parámetros no permitidos.');safeWebUrl(args.url);}\n else if(['open_prepared_message','cancel_message'].includes(args.action)){", mark="args.action==='open_url'")
    s = once(s, "   case 'prepare_message':{", "   case 'open_url':{await shell.openExternal(safeWebUrl(args.url));return {ok:true,data:{opened:true,method:'default_browser',note:'Se pidió a Windows abrir el sitio en tu navegador.'}};}\n   case 'prepare_message':{", mark="case 'open_url'")
    s = once(s, "module.exports={createDesktopActions,validateDesktop,ACTIONS};", "module.exports={createDesktopActions,validateDesktop,ACTIONS,safeWebUrl};")
    return s
rw('electron/tools/desktop-actions.cjs', desk)

# ---- server tool contract ----
def srv(s):
    s = once(s, "enum: ['finanzas', 'agenda', 'pendientes',", "enum: ['finanzas', 'automatizaciones', 'agenda', 'pendientes',")
    s = once(s, "  { name: 'get_pendientes',", "  { name: 'open_shortcut', description: 'Abre una automatización guardada por el usuario (atajo a un SITIO WEB) por su nombre o frase, p. ej. \"abre la página de SOMA\". Si el usuario dice \"apartado\"/\"módulo\" de SOMA usa show_card(soma). Nunca inventes URLs: solo existen las guardadas. Devuelve opened|attempted|ambiguous|not_found; si es attempted di que el usuario puede tocar Abrir en la tarjeta.', parameters: S({ name: { type: 'string' } }) },\n  { name: 'get_pendientes',", mark="name: 'open_shortcut'")
    s = once(s, "Para clima usa get_weather.'", "Para clima usa get_weather. Para abrir un sitio web guardado (Automatizaciones) usa open_shortcut; \"cierra esta tarjeta\" o \"finaliza esta tarjeta\" solo cierra la tarjeta (close_card), nunca completa tareas.'", mark='usa open_shortcut')
    return s
rw('src/assistant.js', srv)

# ---- client assistant: tools + intents ----
def cli(s):
    s = once(s, "  close_card({card}){if(!window.EvieHUD)return {ok:false};return EvieHUD.close(card==null?null:card);},",
"""  async open_shortcut({name}){if(!window.EvieAutomations)return {ok:false,status:'unavailable'};const hits=EvieAutomations.match(Store.list('automations'),String(name||''));if(!hits.length)return {ok:false,status:'not_found',saved:Store.list('automations').map(r=>r.name).slice(0,20)};if(hits.length>1)return {ok:false,status:'ambiguous',options:hits.map(r=>r.name)};const r=hits[0];const c=EvieHUD.open('shortcut',{id:r.id,title:r.name,name:r.name});const x=await EvieAutomationsView.openShortcut(r);if(c.id)EvieHUD.update(c.id,{status:x.status,note:x.note||null});return {ok:x.ok,status:x.status,name:r.name,domain:r.domain,note:x.note||x.error,card_shown:true};},
  close_card({card}){if(!window.EvieHUD)return {ok:false};const r=EvieHUD.close(card==null?null:card);return r.ambiguous?{ok:false,status:'ambiguous',options:r.ambiguous}:r;},""", mark='async open_shortcut')
    a = "  m=q.match(/^(?:abre|abrir|muestrame|muestra|ensename|ve a|vamos a|llevame a|abreme)(?: (?:el|la|los|las|mi|mis|a))? (.+)$/);"
    s = once(s, a, "  {const sm=q.match(/^(?:abre|abrir|abreme|ve a|vamos a|llevame a|entra a|entra en|ir a)(?: (?:el|la|los|las|mi|mis|a|al))? (.+)$/);if(sm&&window.EvieAutomations){const r=shortcutIntent(sm[1]);if(r!==null)return r;}}\n" + a, mark='shortcutIntent(sm[1])')
    s = once(s, " function hudLocal(q){", r""" /* Automatizaciones: "abre la página de SOMA" → saved website; "abre el apartado de SOMA" → module.
    Returns a spoken string, '' (reply comes async via say()) or null (not a shortcut request). */
 function shortcutIntent(target){const A=window.EvieAutomations,list=Store.list('automations'),it=A.intent(target);
  if(it.module&&!it.site)return null;
  const hits=A.match(list,target);
  if(!hits.length){if(it.site)return list.length?`No tengo guardada una automatización que coincida con «${target}». Puedes agregarla en Automatizaciones.`:'Aún no tienes automatizaciones guardadas. Agrégala en Automatizaciones con la dirección real del sitio.';return null;}
  if(hits.length>1)return '¿Cuál abro? '+hits.slice(0,4).map(r=>'«'+r.name+'»').join(', ')+'.';
  const r=hits[0],mod=cardFrom(target);
  if(!it.site&&mod&&EvieHUD.REGISTRY[mod]&&A.norm(r.name)!==A.norm(target))return `¿Te abro el apartado ${EvieHUD.REGISTRY[mod].title} o la página guardada «${r.name}»? Di «abre el apartado de…» o «abre la página de…».`;
  const card=EvieHUD.open('shortcut',{id:r.id,title:r.name,name:r.name});
  EvieAutomationsView.openShortcut(r).then(x=>{const nm='«'+r.name+'»';const msg=x.status==='opened_desktop'?`Abrí ${nm} en tu navegador.`:x.status==='opened'?`Abrí ${nm} en una pestaña nueva.`:x.status==='attempted'?`Intenté abrir ${nm}. Si tu navegador la bloqueó, toca «Abrir» en la tarjeta.`:`No pude abrir ${nm}: ${x.error||'error'}. El enlace está en la tarjeta.`;
   if(card.id)EvieHUD.update(card.id,{status:x.status,note:x.note||null});say(msg);});
  return '';}
 function hudLocal(q){""", mark='function shortcutIntent')
    # close commands
    if 'Presentation-only: closes HUD cards' not in s:
        i = s.index("  let m=q.match(/^(?:cierra|quita|oculta|cerrar)"); j = s.index("No veo esa tarjeta abierta.';}", i) + len("No veo esa tarjeta abierta.';}")
        s = s[:i] + r"""  // Presentation-only: closes HUD cards; never completes/deletes CRM records ("finaliza esta tarjeta" included).
  let m=q.match(/^(?:cierra|quita|oculta|cerrar|quitar|finaliza|termina|descarta)(?: (?:el|la|los|las|este|esta|ese|esa))? ?(tarjetas?|ventanas?|apartado|esto|eso|todo|todas)?(?: (?:las )?tarjetas)?(?: (?:de|del|sobre|con))? ?(.*)$/);
  if(m&&(m[1]||/^(?:cierra|quita|oculta|cerrar|quitar)/.test(q))){let what=(m[2]||'').trim().replace(/^(?:la|el|las|los) /,'');
   if(/^(todo|todas)$/.test(m[1]||'')||/^(todo|todas)/.test(what)||/^tarjetas$/.test(m[1]||'')&&!what){if(window.EvieCaps?.visible())EvieCaps.hide();const r=EvieHUD.close('all');return r.ok?'Listo, cerré todas las tarjetas. Tus datos siguen intactos.':'No hay tarjetas abiertas.';}
   if(/^(?:lo que puedes hacer|capacidades|menu|modulos)$/.test(what)&&window.EvieCaps?.visible()){EvieCaps.hide();return 'Listo.';}
   const ref=what?(cardFrom(what)&&!/sobre|de la|del /.test(m[0])&&what.split(' ').length<=2?cardFrom(what):what):null;
   const r=EvieHUD.close(ref);if(r.ok)return 'Cerré '+(r.title?'«'+r.title+'»':'la tarjeta')+'.';
   if(r.ambiguous)return '¿Cuál cierro? Tengo abiertas: '+r.ambiguous.slice(0,4).join(', ')+'.';
   if(!what&&!EvieHUD.cards().length)return 'No hay tarjetas abiertas.';
   if(/^(?:finaliza|termina|descarta)/.test(q))return null;
   return 'No veo una tarjeta abierta que coincida con «'+what+'».';}""" + s[j:]
    s = once(s, "['kisha',/kisha|mascota( virtual)?|perrita/]", "['automatizaciones',/automatizaciones|atajos/],['kisha',/kisha|mascota( virtual)?|perrita/]")
    return s
rw('public/evie-assistant.js', cli)

# ---- HUD: update() + shortcut/automatizaciones cards + capabilities ----
rw('public/evie-hud.js', lambda s: once(once(s, " function front(id){",
    " /* Merge new args into an open card and reload it in place (same id, no new card, no sound). */\n function update(id,args={}){const c=ws.cards.find(x=>x.id===id);if(!c)return {ok:false};c.args={...c.args,...args};if(onHome()&&document.getElementById(c.id))load(c,{silent:true});else{c.state='stale';persist();}return {ok:true};}\n function front(id){", mark='function update('),
    "return Object.freeze({home,afterRender,open,close,expand,front,", "return Object.freeze({home,afterRender,open,close,expand,front,update,"))
def cards(s):
    s = once(s, "  kisha:{title:'Kisha · Mascota Virtual'", r"""  shortcut:{title:'Automatización',icon:'zap',route:'automatizaciones',scope:'account',
   load:async({id,status,note})=>{const r=Store.list('automations').find(x=>x.id===id&&!x.deleted_at);if(!r)throw Error('Esa automatización ya no existe.');return {r,status:status||null,note:note||null};},
   render:d=>`<div class="hud-auto"><span class="auto-fav" aria-hidden="true">${e(d.r.name.charAt(0).toUpperCase())}</span><div><p class="hud-auto-name">${e(d.r.name)}</p><small>${i('globe')} ${e(d.r.domain)}</small></div></div>${d.r.description?`<p class="hud-note">${e(d.r.description)}</p>`:''}${d.note?`<p class="hud-meta ${d.status==='attempted'?'yellow':''}">${e(d.note)}</p>`:''}<a class="button primary hud-auto-open" href="${e(d.r.url)}" target="_blank" rel="noopener noreferrer" data-auto-open="${e(d.r.id)}">${i('external-link')} Abrir ${e(d.r.domain)}</a>`},
  automatizaciones:mod('automatizaciones',{load:async()=>Store.list('automations'),empty:d=>!d.length,emptyText:'Aún no tienes automatizaciones. Agrega un sitio y dile a Ivi que lo abra.',render:d=>`<ul class="hud-list">${d.slice(0,6).map(r=>`<li><span class="auto-fav sm" aria-hidden="true">${e(r.name.charAt(0).toUpperCase())}</span><span>${e(r.name)}<small class="hud-sub">${e(r.domain)}</small></span><a class="button" href="${e(r.url)}" target="_blank" rel="noopener noreferrer" data-auto-open="${e(r.id)}">Abrir</a></li>`).join('')}</ul>`}),
  kisha:{title:'Kisha · Mascota Virtual'""", mark="shortcut:{title:'Automatización'")
    s = once(s, "['aprendizaje','Aprendizaje','graduation-cap'],['kisha','Kisha · Mascota Virtual','dog']]",
        "['aprendizaje','Aprendizaje','graduation-cap'],['kisha','Kisha · Mascota Virtual','dog'],['automatizaciones','Automatizaciones','zap'],['libros','Biblioteca','library-big'],['vision','Vision Board','image'],['tendencias','Tendencias','chart-scatter'],['logros','Logros','trophy'],['negocios','Negocios','briefcase-business']]")
    return s
rw('public/evie-hud-cards.js', cards)
print('patch A done')
