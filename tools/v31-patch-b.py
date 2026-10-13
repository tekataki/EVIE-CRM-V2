# v3.1 patch B (idempotent):
# 1) Home topbar cascade fix at the source: shared-surface rules (evie-design.css :root[data-theme=dark] :is(...),
#    html[data-desktop=true] :is(...), evie-glass.css html.evie-ui :is(...), phase3.css) out-specify
#    `body.hud-home .topbar`, so the navy surface won on Home. Exclude the Home topbar from those lists.
# 2) Desktop hamburger opens the drawer on Home (sidebar is hidden in HUD mode).
# 3) Radial capabilities: elliptical rings sized from the core, controls centered, no per-node blur.
import os,re
os.chdir('/home/user/webapp')
def rw(p,fn):
    s=open(p).read();t=fn(s)
    if t!=s: open(p,'w').write(t);print('patched',p)
def surf(s):
    def rep(m):
        sel=m.group(0)
        if 'hud-home' in sel: return sel
        return sel.replace('.topbar,','.topbar:not(body.hud-home .topbar),',1).replace(',.topbar)',',.topbar:not(body.hud-home .topbar))',1)
    return re.sub(r':is\([^)]*\.topbar[^)]*\)',rep,s)
for p in ['public/evie-design.css','public/evie-glass.css','public/phase3.css']: rw(p,surf)
HB="""
/* v3.1 Home topbar: no surface, no border/shadow/blur band; ambient background continues behind it.
   Each control keeps a light glass chip so it stays legible, tappable and focusable. */
body.hud-home .topbar{position:sticky;top:0;z-index:30;border:0!important}
body.hud-home .topbar::before,body.hud-home .topbar::after{display:none!important}
body.hud-home .topbar :is(.icon-button,.search-trigger,#sync-status,.avatar){background:rgba(var(--g-rgb),.28)!important;border:1px solid rgba(255,255,255,.08)!important;box-shadow:none!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:999px}
body.hud-home .topbar :is(.icon-button,.search-trigger,#sync-status,.avatar):hover{background:rgba(var(--g-rgb),.5)!important}
body.hud-home .topbar :is(.icon-button,.search-trigger,#sync-status,.avatar):focus-visible{outline:2px solid var(--g-accent);outline-offset:2px}
:root[data-theme=light] body.hud-home .topbar :is(.icon-button,.search-trigger,#sync-status,.avatar){background:rgba(255,255,255,.55)!important;border-color:rgba(40,60,120,.12)!important}
body.hud-home .app-shell,body.hud-home main{background:transparent!important}
@media (min-width:1024px){body.hud-home.drawer-open .sidebar{transform:none!important;visibility:visible;box-shadow:0 20px 60px rgba(0,0,0,.45);z-index:60}body.hud-home.drawer-open .drawer-backdrop{display:block!important;z-index:55}}
"""
rw('public/evie-hud.css',lambda s: s if '/* v3.1 Home topbar:' in s else s+HB)
rw('public/app.js',lambda s: s.replace("document.getElementById('menu-toggle').onclick=()=>{if(window.innerWidth<1024){","document.getElementById('menu-toggle').onclick=()=>{if(window.innerWidth<1024||document.body.classList.contains('hud-home')){",1))
def caps_css(s):
    s=s.replace(" background:linear-gradient(150deg,rgba(var(--g-rgb),.78),rgba(var(--g-rgb),.52));backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);",
     " background:linear-gradient(150deg,rgba(var(--g-rgb),.94),rgba(var(--g-rgb),.82));/* no per-node backdrop-filter: 20+ blurred layers over the animated canvas are too costly */")
    s=s.replace("body.caps-open .hud-core canvas{opacity:.55;transition:opacity .4s}\n","")
    s=s.replace("transform:translate(-50%,-50%) translate(calc(var(--x)*var(--core-w)*.5*var(--k)),calc(var(--y)*var(--core-w)*.5*var(--k)));",
     "transform:translate(-50%,-50%) translate(calc(var(--x)*var(--rx)*var(--k)),calc(var(--y)*var(--ry)*var(--k)));")
    s=s.replace(".hud-caps-ring{position:absolute;inset:0;z-index:6;pointer-events:none}",
     ".hud-caps-ring{position:absolute;inset:0;z-index:6;pointer-events:none;--rx:calc(var(--core-w)*.78);--ry:calc(var(--core-w)*.47)}")
    s=s.replace(".caps-ctl{position:absolute;left:50%;bottom:-2%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;pointer-events:auto;white-space:nowrap}",
     ".caps-ctl{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;gap:8px;justify-items:center;pointer-events:auto;white-space:nowrap;padding:14px 18px;border-radius:22px;background:radial-gradient(closest-side,rgba(var(--g-rgb),.72),rgba(var(--g-rgb),0))}\n.caps-ctl .caps-close{white-space:nowrap;display:inline-flex;gap:6px;align-items:center;padding:0 16px}")
    return s
rw('public/evie-v31.css',caps_css)
rw('public/evie-caps.js',lambda s: s.replace("const html=list.map((x,k)=>k<inner?btn(x,at(k,inner,outer?.62:.72,0)):btn(x,at(k-inner,outer,.98,180/outer))).join('');",
 "const html=list.map((x,k)=>k<inner?btn(x,at(k,inner,outer?.6:.86,outer?360/inner/2:0)):btn(x,at(k-inner,outer,1,0))).join('');"))
print('patch B done')
# 4) The global `:root[data-theme=dark] :is(dialog,[role=dialog],[role=menu]…)` overlay painted a dark
#    square behind the radial ring. Neutralize it for the capability containers only.
FIX4="""
/* v3.1 caps: the ring/grid use role=menu for a11y, but must not inherit the global menu overlay surface. */
:root .caps-ring[role=menu],:root .caps-grid[role=menu]{background:none!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important}
.hud-caps-ring{--ry:calc(var(--core-w)*.44)}
.hud-caps-ring .cap-node .cap-label{max-width:150px}
"""
rw('public/evie-v31.css',lambda s: s if 'must not inherit the global menu overlay' in s else s+FIX4)
print('patch B4 done')
