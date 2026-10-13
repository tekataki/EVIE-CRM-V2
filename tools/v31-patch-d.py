# v3.1 patch D (idempotent): Finance spacing system + digital account cards. CSS + markup hooks only;
# no calculation changes. Account card color comes from the account type (and an optional,
# user-chosen 'tone' if present) — never implies an official bank affiliation.
import os
os.chdir('/home/user/webapp')
def rw(p,fn):
    s=open(p).read();t=fn(s)
    if t!=s: open(p,'w').write(t);print('patched',p)
# hook: tone attribute on account cards (deterministic per account id; purely decorative)
def mods(s):
    s=s.replace('`<article class="evm-acc credit"><header>','`<article class="evm-acc credit" data-tone="${toneOf(a)}"><header>',1)
    s=s.replace(':`<article class="evm-acc"><header>',':`<article class="evm-acc" data-tone="${toneOf(a)}" data-type="${e(a.type)}"><header>',1)
    if 'function toneOf(' not in s:
        s=s.replace("function accounts(){","/* v3.1: decorative tone per account (stable hash of the id); not tied to any real institution. */\n function toneOf(a){const t=['indigo','violet','teal','graphite','rose','ocean'];let h=0;for(const ch of String(a.id||a.name||''))h=(h*31+ch.charCodeAt(0))>>>0;return a.tone&&t.includes(a.tone)?a.tone:t[h%t.length];}\n function accounts(){",1)
    return s
rw('public/evie-modules.js',mods)
CSS="""
/* ===== v3.1 Finanzas: spacing system + digital cards (presentation only) ===== */
body[data-module=finanzas]{--fs-gap:clamp(16px,2.2vw,24px);--fs-pad:clamp(18px,2.6vw,28px)}
body[data-module=finanzas] #main-content>:is(section,.panel,.summary-grid,.evm-accounts,.ev-shop,.ev-pantry){margin-block:0 var(--fs-gap)!important}
body[data-module=finanzas] .summary-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))!important;gap:var(--fs-gap)!important;align-items:stretch}
body[data-module=finanzas] .summary-grid>*{min-width:0;margin:0!important}
body[data-module=finanzas] .stat-card{padding:var(--fs-pad)!important;display:grid;gap:10px;align-content:start;height:auto!important}
body[data-module=finanzas] .stat-card :is(.stat-value,.money,strong){font-variant-numeric:tabular-nums;overflow-wrap:anywhere;word-break:normal}
body[data-module=finanzas] :is(.panel,.ev-shop,.ev-pantry,.evm-accounts){padding:var(--fs-pad)!important;border-radius:22px!important}
body[data-module=finanzas] :is(.panel,.ev-shop,.ev-pantry,.evm-accounts)>.panel-header{padding:0 0 14px!important;margin:0 0 4px!important;border:0!important;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:flex-start}
body[data-module=finanzas] .panel-header h2{margin:4px 0 0;line-height:1.25}
body[data-module=finanzas] :is(.evm-muted,.evm-note,.panel p){line-height:1.6;max-width:78ch}
body[data-module=finanzas] .evm-note{margin-top:14px!important}
body[data-module=finanzas] .ev-pantry>:not(header){margin-top:14px}
body[data-module=finanzas] .ev-pantry .toolbar,body[data-module=finanzas] .ev-pantry .nutrition-grid{gap:12px;flex-wrap:wrap}
body[data-module=finanzas] .ev-templates{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
body[data-module=finanzas] .evm-grid{gap:var(--fs-gap)!important}
body[data-module=finanzas] .toolbar{gap:10px;flex-wrap:wrap}
body[data-module=finanzas] :is(td,th,.evm-dl dd,.evm-dl dt){overflow-wrap:anywhere;word-break:normal}
/* digital cards: hero balance card + account cards */
.bank-card{isolation:isolate;overflow:hidden;border-radius:24px!important;background:linear-gradient(135deg,#2b3a8f 0%,#4b2f8f 55%,#251c55 100%)!important;box-shadow:0 22px 50px rgba(20,16,70,.45),inset 0 1px 0 rgba(255,255,255,.18)!important;color:#f4f6ff;transform-style:preserve-3d;transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s}
.bank-card::after{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(120% 80% at 85% -10%,rgba(255,255,255,.22),transparent 55%),repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 2px,transparent 2px 7px);pointer-events:none}
.evm-acc-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))!important;gap:var(--fs-gap,18px)!important;margin-top:14px}
.evm-acc{--c1:#33407f;--c2:#1f2655;position:relative;isolation:isolate;overflow:hidden;display:grid;gap:10px;align-content:start;min-width:0;padding:22px 22px 18px!important;border-radius:22px!important;border:1px solid rgba(255,255,255,.12)!important;
 background:linear-gradient(140deg,var(--c1),var(--c2))!important;color:#f3f5ff;box-shadow:0 16px 36px rgba(6,10,40,.38),inset 0 1px 0 rgba(255,255,255,.16)!important;transition:transform .3s cubic-bezier(.2,.7,.2,1),box-shadow .3s}
.evm-acc::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(90% 70% at 100% 0%,rgba(255,255,255,.2),transparent 60%),radial-gradient(60% 60% at 0% 100%,rgba(0,0,0,.25),transparent 70%),repeating-linear-gradient(120deg,rgba(255,255,255,.03) 0 2px,transparent 2px 8px)}
.evm-acc::after{content:"";position:absolute;right:18px;bottom:16px;width:44px;height:28px;border-radius:6px;background:linear-gradient(135deg,rgba(255,226,160,.85),rgba(210,170,90,.75));box-shadow:inset 0 0 0 1px rgba(0,0,0,.15);opacity:.55;z-index:-1}
.evm-acc[data-type=cash]::after,.evm-acc[data-type=wallet]::after{display:none}
.evm-acc[data-tone=indigo]{--c1:#3b4cb8;--c2:#1d2463}.evm-acc[data-tone=violet]{--c1:#6a3fc2;--c2:#2a1a5e}.evm-acc[data-tone=teal]{--c1:#0f8a85;--c2:#0b3b4a}
.evm-acc[data-tone=graphite]{--c1:#3a4152;--c2:#151923}.evm-acc[data-tone=rose]{--c1:#b04a7a;--c2:#4a1d3c}.evm-acc[data-tone=ocean]{--c1:#1f6fd1;--c2:#0f2a63}
.evm-acc header{display:flex;justify-content:space-between;align-items:center;gap:10px;min-width:0}
.evm-acc header>span{display:flex;gap:8px;align-items:center;font-weight:600;letter-spacing:.01em;min-width:0;overflow-wrap:anywhere}
.evm-acc header .icon-button{color:#fff;background:rgba(255,255,255,.12)!important;border-color:rgba(255,255,255,.18)!important;flex:none}
.evm-acc .evm-big{margin:6px 0 0;font-size:clamp(24px,2.4vw,30px);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em;color:#fff;overflow-wrap:anywhere}
.evm-acc small,.evm-acc dt{color:rgba(240,243,255,.78)!important}
.evm-acc dd{color:#fff}
.evm-acc .evm-dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px 14px;margin:6px 0 0}
.evm-acc .evm-dl div{display:grid;gap:2px}.evm-acc .evm-dl dd{margin:0;font-variant-numeric:tabular-nums}
.evm-acc .evm-bar{background:rgba(255,255,255,.18)!important}.evm-acc .evm-bar i{background:linear-gradient(90deg,#fff,#d9e2ff)!important}
.evm-acc .toolbar{margin-top:6px}.evm-acc .toolbar .button{background:rgba(255,255,255,.14)!important;color:#fff!important;border-color:rgba(255,255,255,.22)!important}
@media (hover:hover) and (prefers-reduced-motion:no-preference){.evm-acc:hover,.bank-card:hover{transform:translateY(-3px) rotateX(2deg) rotateY(-2deg);box-shadow:0 26px 54px rgba(6,10,40,.48),inset 0 1px 0 rgba(255,255,255,.2)!important}}
.evm-acc:active{transform:scale(.99)}
:root[data-theme=light] .evm-acc{box-shadow:0 14px 30px rgba(30,40,110,.22),inset 0 1px 0 rgba(255,255,255,.2)!important}
"""
rw('public/evie-v31.css',lambda s: s if '===== v3.1 Finanzas' in s else s+CSS)
print('patch D done')
FIX2="""
/* v3.1 Finanzas · summary row: 4 even columns on wide screens, 2 on tablets, 1 on phones; content height. */
@media (min-width:1180px){body[data-module=finanzas] .summary-grid{grid-template-columns:minmax(0,1.25fr) repeat(3,minmax(0,1fr))!important}}
@media (min-width:640px) and (max-width:1179px){body[data-module=finanzas] .summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
body[data-module=finanzas] .summary-grid>*{min-height:0!important;height:auto!important}
body[data-module=finanzas] .evm-acc{min-height:0!important;height:auto!important}
body[data-module=finanzas] .evm-acc-grid{align-items:start}
"""
rw('public/evie-v31.css',lambda s: s if 'Finanzas · summary row' in s else s+FIX2)
