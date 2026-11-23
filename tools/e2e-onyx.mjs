// E2E v11 · Onyx redesign (browser). Checks: no top bar (only floating controls, transparent), sidebar utilities,
// Jarvis home (big centred core, read-outs left + actions right on desktop; read-out strip + «Atajos» sheet on phones),
// HUD cards placed in side slots with a content-based size, animated hero + tip on sections (tip dismiss persists),
// phone bar = 3 shortcuts + orb + «Menú» (opens the drawer), Chat is a fixed page (no document scroll) with the list
// visible, light theme parity, no horizontal overflow and no page errors.
// Usage: W=1440 node tools/e2e-onyx.mjs   (W=412 for the Galaxy S25 Ultra width, W=390 for iPhone)
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), H = W < 700 ? 891 : 900, THEME = process.env.THEME || 'dark', mobile = W < 1024
const b = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: W < 700, hasTouch: W < 700 })
const p = await ctx.newPage(); const errors = []
p.on('pageerror', (e) => errors.push(e.message))
const out = {}
const ok = (k, v) => { out[k] = !!v; if (!v) console.log('FAIL', k) }
const until = (fn, a, ms = 10000) => p.waitForFunction(fn, a, { timeout: ms })
await p.route('**/api/chat/**', (r) => {
  const u = new URL(r.request().url()), path = u.pathname.replace('/api/chat/', '')
  if (path === 'conversations') return r.fulfill({ json: { conversations: Array.from({ length: 30 }, (_, i) => ({ id: '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'), title: 'Conversación ' + (i + 1), pinned: i === 0, archived: false, private: false, tier: 'enfoque', message_count: 2, created_at: new Date().toISOString(), updated_at: new Date(Date.now() - i * 3600e3).toISOString() })) } })
  if (path === 'stamp') return r.fulfill({ json: { stamp: 's1' } })
  return r.fulfill({ json: {} })
})
await p.goto('http://localhost:3000/index.html?qa=onyx' + W + Date.now(), { timeout: 90000 }); await until(() => window.DALI_READY, null, 60000)
await p.evaluate((theme) => { window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme; s.profile.preferred = 'Sam' }); App.render() }, THEME)
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.getElementById('ivi-systems')); await p.waitForTimeout(900)
await p.waitForTimeout(2600); await p.evaluate(() => EvieHUD.close('all', { silent: true })); await p.waitForTimeout(900)

// 1 · no top bar
const top = await p.evaluate(() => { const t = document.getElementById('ox-topbar'), cs = getComputedStyle(t), m = document.getElementById('menu-toggle').getBoundingClientRect(); return { bg: cs.backgroundColor, img: cs.backgroundImage, border: cs.borderBottomWidth, menu: m.width >= 40 && m.top >= 0 && m.top < 80 && m.left <= 20, actions: getComputedStyle(document.querySelector('#ox-topbar .topbar-actions')).display } })
ok('topbarTransparent', /rgba\(0, 0, 0, 0\)|transparent/.test(top.bg) && top.img === 'none' && top.border === '0px')
ok('menuButton', top.menu)
ok('homeNoTopActions', top.actions === 'none')
ok('sidebarUtilities', await p.evaluate(() => !!document.querySelector('#sidebar .ox-sb-utils [data-action="theme"]') && !!document.querySelector('#sidebar #sync-status') && !!document.querySelector('#sidebar .ox-sb-search') && /Created by/i.test(document.querySelector('.sidebar-bottom .evie-credit')?.textContent || '')))

// 2 · Jarvis home
const home = await p.evaluate(() => { const c = document.getElementById('hud-core').getBoundingClientRect(), comp = document.getElementById('evie-stage-form').getBoundingClientRect(), L = document.getElementById('ivi-rail-l'), R = document.getElementById('ivi-rail-r'); const lr = L.getBoundingClientRect(), rr = R.getBoundingClientRect(); return { core: c.width, cx: c.left + c.width / 2, composerVisible: comp.bottom <= innerHeight + 1 && comp.top > c.top, docH: document.documentElement.scrollHeight, lDisp: getComputedStyle(L).display, rDisp: getComputedStyle(R).display, lRight: lr.right, rLeft: rr.left, coreL: c.left, coreR: c.right, sys: L.querySelectorAll('.ivi-sys').length, lead: L.querySelector('.ivi-sys.is-lead small')?.textContent } })
ok('coreCentred', Math.abs(home.cx - W / 2) < 12)
ok('coreBig', mobile ? home.core >= Math.min(W * 0.8, 330) : home.core >= 480)
ok('composerOnScreen', home.composerVisible)
ok('fiveReadouts', home.sys === 5 && home.lead === 'Hoy')
if (!mobile) { ok('railsBesideCore', home.lRight <= home.coreL + 4 && home.rLeft >= home.coreR - 4 && home.rDisp !== 'none'); ok('homeNoScroll', home.docH <= H + 2) }
else {
  ok('readoutStrip', home.lDisp !== 'none')
  ok('actionsHidden', home.rDisp === 'none')
  await p.click('[data-hud-quick]'); await p.waitForTimeout(500)
  ok('atajosSheet', await p.evaluate(() => document.body.classList.contains('hud-quick-open') && getComputedStyle(document.getElementById('ivi-rail-r')).display !== 'none' && document.querySelectorAll('#ivi-rail-r .ivi-act').length >= 5))
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  ok('atajosClosed', await p.evaluate(() => !document.body.classList.contains('hud-quick-open')))
  ok('phoneBarHiddenOnHome', await p.evaluate(() => getComputedStyle(document.querySelector('.mobile-nav')).opacity === '0'))
}
// 3 · HUD cards: slots and sizes
await p.evaluate(() => { EvieHUD.open('clock'); EvieHUD.open('finanzas') }); await p.waitForTimeout(1400)
const cards = await p.evaluate(() => [...document.querySelectorAll('#hud-cards .hud-card')].map((n) => ({ slot: n.dataset.slot || '', size: n.dataset.size || '', r: n.getBoundingClientRect(), core: document.getElementById('hud-core').getBoundingClientRect() })))
ok('cardsSized', cards.length === 2 && cards.every((c) => ['sm', 'md', 'lg'].includes(c.size)))
if (W >= 1280) ok('cardsBesideCore', cards.every((c) => c.slot && (c.r.left >= c.core.right - 2 || c.r.right <= c.core.left + 2)))
else ok('cardsBelowCore', cards.every((c) => c.r.top >= c.core.bottom - 2))
ok('clockIsSmall', await p.evaluate(() => [...document.querySelectorAll('#hud-cards .hud-card')].some((n) => n.dataset.type === 'clock' && n.dataset.size === 'sm')))
await p.evaluate(() => EvieHUD.close('all', { silent: true })); await p.waitForTimeout(500)

// 4 · section hero, scene and tip
await p.evaluate(() => { localStorage.removeItem('evie-ox-tips'); location.hash = 'finanzas' }); await until(() => document.querySelector('.page-heading .ox-scene canvas')); await p.waitForTimeout(900)
ok('heroScene', await p.evaluate(() => { const c = document.querySelector('.page-heading .ox-scene canvas'); return c.width > 50 && c.height > 50 && EvieScenes.count() >= 1 }))
ok('heroTip', await p.evaluate(() => /Nuevo movimiento/.test(document.querySelector('.page-heading .ox-tip')?.textContent || '')))
await p.click('.page-heading .ox-tip [data-ox-tip]'); await p.waitForTimeout(600)
await p.evaluate(() => { location.hash = 'agenda' }); await p.waitForTimeout(700); await p.evaluate(() => { location.hash = 'finanzas' }); await p.waitForTimeout(900)
ok('tipStaysHidden', await p.evaluate(() => !document.querySelector('.page-heading .ox-tip')))
ok('primaryIsPill', await p.evaluate(() => { const b = document.querySelector('.page-heading .button.primary'); if (!b) return true; const cs = getComputedStyle(b); return parseFloat(cs.borderTopLeftRadius) >= 18 }))
ok('agendaHero', await p.evaluate(async () => { location.hash = 'agenda'; await new Promise((r) => setTimeout(r, 900)); return !!document.querySelector('.agv-head .ox-scene canvas') }))
ok('floatingSearchOnInner', await p.evaluate(() => getComputedStyle(document.querySelector('#ox-topbar .topbar-actions')).display !== 'none'))

// 5 · phone bar and drawer
if (mobile) {
  const bar = await p.evaluate(() => [...document.querySelector('.mobile-nav').children].map((n) => n.className.includes('evie-orb-button') ? 'ORB' : n.dataset.ox === 'menu' ? 'MENU' : (n.getAttribute('href') || '')))
  ok('phoneBar', bar.length === 5 && bar[2] === 'ORB' && bar[4] === 'MENU')
  await p.click('.mobile-nav [data-ox="menu"]'); await p.waitForTimeout(600)
  ok('menuOpensDrawer', await p.evaluate(() => document.body.classList.contains('drawer-open') && document.getElementById('sidebar').getBoundingClientRect().left >= -1))
  await p.click('.ox-sb-close'); await p.waitForTimeout(500)
  ok('drawerCloses', await p.evaluate(() => !document.body.classList.contains('drawer-open')))
}

// 5b · prompt library inside Automatizaciones: create → save → «Copiar» puts the whole body on the clipboard
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3000' })
await p.evaluate(() => { location.hash = 'automatizaciones/prompts' }); await until(() => document.querySelector('[data-prompt-new]')); await p.waitForTimeout(500)
await p.evaluate(() => document.querySelector('[data-prompt-new]').click()); await until(() => document.querySelector('#prompt-form [name="name"]'))
const BODY = 'Eres un ingeniero backend senior.\nDiseña la API con Hono y Supabase.\n1. Endpoints\n2. Esquema SQL con RLS'
await p.fill('#prompt-form [name="name"]', 'Prompt para backend'); await p.fill('#prompt-form [name="tag"]', 'SOMA'); await p.fill('#prompt-form [name="body"]', BODY)
await p.evaluate(() => document.getElementById('prompt-form').requestSubmit()); await until(() => document.querySelector('[data-prompt-copy]')); await p.waitForTimeout(400)
ok('promptSaved', await p.evaluate(() => (Store.get().preferences.promptLibrary || []).some((x) => x.name === 'Prompt para backend' && x.tag === 'SOMA')))
await p.evaluate(() => { window.__copied = []; const c = navigator.clipboard; if (c?.writeText) { const o = c.writeText.bind(c); c.writeText = (t) => { window.__copied.push(t); return o(t) } } const ex = document.execCommand.bind(document); document.execCommand = (cmd, ...a) => { if (cmd === 'copy') window.__copied.push(document.activeElement?.value ?? String(getSelection())); return ex(cmd, ...a) } })
await p.click('[data-prompt-copy]'); await p.waitForTimeout(500)
const copied = await p.evaluate(async () => ({ api: await navigator.clipboard.readText().catch(() => null), sent: window.__copied }))
// Headless browsers may not expose the system clipboard to readText (null/''): then what the app handed to the
// clipboard API is the proof; when readText works it must return the exact body.
const okCopy = copied.sent.includes(BODY) && (copied.api === null || copied.api === '' || copied.api.replace(/\r\n/g, '\n') === BODY)
if (!okCopy) console.log('COPIED', JSON.stringify(copied).slice(0, 400)); ok('promptCopied', okCopy)
ok('promptCopyFeedback', await p.evaluate(() => /Copiado/.test(document.querySelector('[data-prompt-copy]')?.textContent || '') && (Store.get().preferences.promptLibrary || [])[0]?.copies >= 1))
ok('promptVoice', await p.evaluate(() => typeof IviCore.intent('Ivi, abre mis prompts') === 'string'))

// 6 · Chat is a fixed page (signed-in account emulated, /api/chat mocked)
await p.evaluate(() => { const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: true, provider: 'openai', stt: true, tts: true }; EvieAccounts.current = () => ({ id: 'aaaaaaaa-0000-4000-8000-000000000001', username: 'dali' }); EvieAccounts.storageKey = () => k; EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j }); location.hash = 'chat' })
await until(() => document.querySelector('.ch[data-ch-root]')); await p.waitForTimeout(1200)
const chat = await p.evaluate(() => { const se = document.scrollingElement; window.scrollTo(0, 600); const after = se.scrollTop; const ch = document.querySelector('.ch[data-ch-root]').getBoundingClientRect(); return { scroll: se.scrollHeight - innerHeight, after, chBottom: ch.bottom, list: document.querySelectorAll('.ch-item').length, overflowY: getComputedStyle(document.documentElement).overflowY } })
ok('chatNoPageScroll', chat.after === 0 && chat.overflowY === 'hidden')
ok('chatFitsViewport', chat.chBottom <= H + 1)
if (!mobile) ok('chatListVisible', chat.list >= 10)

// 7 · overflow + errors
for (const r of ['inicio', 'finanzas', 'agenda', 'automatizaciones', 'soma']) {
  await p.evaluate((r) => { location.hash = r }, r); await p.waitForTimeout(700)
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  ok('noOverflow:' + r, !over)
}
ok('noPageErrors', !errors.length)
const fails = Object.entries(out).filter(([, v]) => !v)
console.log(JSON.stringify(out))
if (errors.length) console.log('ERRORS', errors.slice(0, 5).join('\n'))
console.log(fails.length ? `${fails.length} FALLAS E2E ONYX (${W})` : `${Object.keys(out).length}/${Object.keys(out).length} E2E ONYX OK (${W}, ${THEME})`)
await b.close(); process.exit(fails.length ? 1 : 0)
