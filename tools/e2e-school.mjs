// E2E v10 Fase 4 (browser): Escuela — materia con horario → bloques semanales en Agenda, tarea/examen → pendiente en
// Agenda (y se completa junto), tarjetas en lote + repaso SM-2 con teclado, calificaciones ponderadas, resumen en audio
// y «Generar con Ivi» (API emulada), más la conexión con el briefing (clases = compromisos), la barra de sistemas, la
// revisión semanal y las intenciones de voz. /api/school is emulated here (server side: tests/school.test.cjs).
import { chromium } from 'playwright'
const W = Number(process.env.W || 1440), THEME = process.env.THEME || 'dark', SHOT = process.env.SHOT || ''
const b = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept())
await p.route('**/api/school/summary', (r) => r.fulfill({ json: { summary: { title: 'Fracciones equivalentes', points: ['Representan la misma cantidad.', 'Se obtienen multiplicando arriba y abajo por el mismo número.', 'Se simplifican dividiendo entre un factor común.', 'Sirven para sumar fracciones.'], script: 'Las fracciones equivalentes representan la misma cantidad. Por ejemplo, un medio y dos cuartos. Para obtenerlas multiplicas el numerador y el denominador por el mismo número. Para simplificarlas, divides ambos entre un factor común.', questions: ['¿Un medio y tres sextos son equivalentes?', '¿Cómo simplificas seis octavos?'] }, generated_at: new Date().toISOString() } }))
await p.route('**/api/school/cards', (r) => r.fulfill({ json: { cards: [{ front: '¿Qué es un numerador?', back: 'El número de arriba de la fracción.' }, { front: '¿Qué es un denominador?', back: 'El número de abajo: en cuántas partes se divide.' }, { front: 'Simplifica 4/8', back: '1/2' }, { front: '¿2/3 y 4/6 son equivalentes?', back: 'Sí.' }, { front: 'Suma 1/4 + 1/4', back: '1/2' }] } }))
await p.goto('http://localhost:3000/index.html?qa=school' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
await p.evaluate((theme) => {
  window.Neural?.dismiss?.(); document.getElementById('evie-splash')?.remove()
  Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.theme = theme; s.profile.preferred = 'Sam'; s.preferences.iviBriefing = { wake: '06:00', gymMinutes: 60, travelMinutes: 15, auto: false } })
  const k = EvieAccounts.storageKey(), cfg = EvieAccounts.config(); cfg.accountsEnabled = true; cfg.ai = { chat: true, provider: 'openai', stt: true, tts: true }
  EvieAccounts.current = () => ({ id: 'aaaaaaaa-0000-4000-8000-000000000003' }); EvieAccounts.storageKey = () => k
  EvieAccounts.request = (path, o = {}) => fetch('/api/' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => { const j = await r.json(); if (!r.ok) throw Object.assign(Error(j.error || 'error'), { status: r.status }); return j })
  window.__said = []; if (window.EvieAssistant) window.EvieAssistant = { ...window.EvieAssistant, say: async (x) => { window.__said.push(x) } }
  App.render() }, THEME)
const until = async (fn, a, ms = 12000) => { try { return await p.waitForFunction(fn, a, { timeout: ms }) } catch (e) { console.log('STUCK', JSON.stringify(await p.evaluate(() => ({ hash: location.hash, dialog: document.querySelector('#app-dialog[open]')?.textContent?.slice(0, 200), err: document.querySelector('.es-error:not([hidden])')?.textContent, toasts: [...document.querySelectorAll('#toast-region .toast')].map((x) => x.textContent.slice(0, 80)) })))); throw e } }
const S = () => p.evaluate(() => EvieSchool.data())
const tab = async (k) => { await p.click(`[data-es="tab"][data-tab="${k}"]`); await until((k) => document.querySelector(`[data-es="tab"][data-tab="${k}"]`)?.getAttribute('aria-selected') === 'true', k) }
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
const out = {}
// ---- página
await p.evaluate(() => { location.hash = 'escuela' }); await until(() => document.getElementById('es-root'))
out.tabs = await p.evaluate(() => document.querySelectorAll('[data-es="tab"]').length)
out.nav = await p.evaluate(() => DALI_CONFIG.sections.some((s) => s.route === 'escuela' && s.searchTerms.includes('tarjetas')))
// ---- materia con horario → Agenda
await tab('materias'); await p.click('[data-es="subj-add"]'); await until(() => document.querySelector('#es-form [name=name]'))
await p.fill('#es-form [name=name]', 'Matemáticas'); await p.fill('#es-form [name=teacher]', 'Prof. Prueba')
await p.evaluate(() => { const row = document.querySelector('#es-form .es-srow'); for (const v of ['1', '3']) { const i = row.querySelector(`input[type=checkbox][value="${v}"]`); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })) } })
await p.fill('#es-form .es-srow [name=start]', '08:00'); await p.fill('#es-form .es-srow [name=end]', '09:30')
await p.click('#es-form button[type=submit]:not([name=more])'); await until(() => EvieSchool.data().subjects.length === 1)
out.subjectAgenda = await p.evaluate(() => { const s = EvieSchool.data().subjects[0], items = Store.list('agendaItems').filter((x) => s.agenda_ids.includes(x.id)); return items.length === 1 && items[0].area === 'school' && items[0].recurrence?.frequency === 'weekly' && JSON.stringify(items[0].recurrence.days_of_week) === '[1,3]' && items[0].recurrence.time_local === '08:00' && items[0].duration_minutes === 90 })
out.briefing = await p.evaluate(() => { const c = EvieBriefing.todayCommitments(1); return c.some((x) => x.label === 'Matemáticas' && x.time === '08:00' && x.school) && !EvieBriefing.todayCommitments(2).some((x) => x.label === 'Matemáticas') })
// ---- examen → pendiente en Agenda; hecho → se completa
await tab('tareas'); await p.click('[data-es="task-add"]'); await until(() => document.querySelector('#es-form [name=title]'))
const due = await p.evaluate(() => V2Domain.addDays(Domain.today(), 3))
await p.fill('#es-form [name=title]', 'Examen parcial'); await p.check('#es-form input[name=kind][value=examen]', { force: true }); await p.fill('#es-form [name=due]', due)
await p.click('#es-form button[type=submit]'); await until(() => EvieSchool.data().tasks.length === 1)
out.taskAgenda = await p.evaluate(() => { const t = EvieSchool.data().tasks[0], it = Store.list('agendaItems').find((x) => x.id === t.agenda_id); return !!it && it.area === 'school' && t.kind === 'examen' })
out.summary = await p.evaluate(() => { const s = EvieSchool.summary(); return s.tasksDue7 === 1 && s.nextExam?.title === 'Examen parcial' && s.nextExam.days === 3 })
out.say = await p.evaluate(() => EvieAssistant.tryLocal('Ivi, ¿cuándo es mi examen?')); out.examIntent = /Examen parcial/.test(out.say || '')
await p.click('[data-es="task-toggle"]'); await until(() => EvieSchool.data().tasks[0].done === true)
out.taskDone = await p.evaluate(() => { const t = EvieSchool.data().tasks[0], it = Store.list('agendaItems').find((x) => x.id === t.agenda_id); return !it || it.status === 'done' || !!it.completed_at })
// ---- tarjetas en lote + repaso con teclado
await tab('tarjetas'); await p.click('[data-es="card-bulk"]'); await until(() => document.querySelector('#es-form [name=lines]'))
await p.fill('#es-form [name=lines]', 'Capital de Francia :: París\n7 × 8 :: 56\nH2O :: Agua'); await p.click('#es-form button[type=submit]'); await until(() => EvieSchool.data().cards.length === 3)
await p.click('[data-es="review"]'); await until(() => document.getElementById('es-rv'))
if (SHOT) { await p.waitForTimeout(500); await p.screenshot({ path: `${SHOT}-repaso.png` }) }
for (let i = 0; i < 3; i++) { await until(() => document.querySelector('#es-rv [data-es="rv-flip"]')); await p.click('#es-rv [data-es="rv-flip"]'); await p.waitForTimeout(250); await p.keyboard.press('3'); await p.waitForTimeout(350) }
await until(() => document.querySelector('#es-rv .es-rv-end'))
out.review = await p.evaluate(() => { const d = EvieSchool.data(), t = Domain.today(); return (d.log.reviews[t] || 0) === 3 && d.cards.every((c) => c.reps === 1 && c.due > t) })
await p.keyboard.press('Escape'); await until(() => !document.getElementById('es-rv'))
// ---- «Generar con Ivi» → vista previa → guardar
await p.click('[data-es="card-gen"]'); await until(() => document.querySelector('#es-form [name=notes]'))
await p.fill('#es-form [name=notes]', 'Fracciones: el numerador es el número de arriba y el denominador el de abajo. Las fracciones equivalentes valen lo mismo.'); await p.click('#es-form button[type=submit]')
await until(() => /Revisa las tarjetas/.test(document.querySelector('#app-dialog[open]')?.textContent || '')); await p.click('#es-form button[type=submit]'); await until(() => EvieSchool.data().cards.length === 8)
out.generated = true
// ---- calificaciones ponderadas
await tab('calificaciones'); await until(() => document.querySelector('[data-es-form="grade"] [name=label]'))
await p.fill('[data-es-form="grade"] [name=label]', 'Parcial 1'); await p.fill('[data-es-form="grade"] [name=score]', '85'); await p.fill('[data-es-form="grade"] [name=max]', '100'); await p.fill('[data-es-form="grade"] [name=weight]', '30')
await p.press('[data-es-form="grade"] [name=weight]', 'Enter'); await until(() => EvieSchool.data().subjects[0].grades.length === 1)
out.grades = await p.evaluate(() => { const s = EvieSchool.data().subjects[0], n = EvieSchool.needed(s); return EvieSchool.average(s) === 85 && n.status === 'open' && n.remaining === 70 })
if (SHOT) { await p.waitForTimeout(500); await p.screenshot({ path: `${SHOT}-calificaciones.png` }) }
// ---- resumen en audio
await tab('resumenes'); await until(() => document.querySelector('[data-es-form="summary"] [name=topic]'))
await p.fill('[data-es-form="summary"] [name=topic]', 'Fracciones equivalentes'); await p.click('[data-es-form="summary"] button:not([type=button])'); await until(() => EvieSchool.data().summaries.length === 1)
await until(() => document.querySelector('[data-es="sum-play"]')); await p.click('[data-es="sum-play"]'); await until(() => window.__said.length >= 1)
out.audio = await p.evaluate(() => window.__said.join(' ').includes('fracciones equivalentes') && window.__said.every((x) => x.length <= 600))
// ---- Hoy + conexiones
await tab('hoy'); out.overflowSchool = await overflow()
if (SHOT) { await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500); await p.screenshot({ path: `${SHOT}-hoy.png` }) }
out.weekly = await p.evaluate(() => { const m = EvieWeekly.build(); return m.school && m.school.tasksDone === 1 && m.school.reviews === 3 })
await p.evaluate(() => { location.hash = 'inicio' }); await until(() => document.querySelector('#ivi-systems .ivi-sys[href="#escuela"]'))
out.systems = true; out.overflowHome = await overflow()
const checks = { tabs: out.tabs === 6, nav: out.nav, subjectAgenda: out.subjectAgenda, briefing: out.briefing, taskAgenda: out.taskAgenda, summary: out.summary, examIntent: out.examIntent, taskDone: out.taskDone, review: out.review, generated: out.generated, grades: out.grades, audio: out.audio, weekly: out.weekly, systems: out.systems, overflow: !out.overflowSchool && !out.overflowHome, errors: !errors.length }
console.log(JSON.stringify({ ...out, say: undefined }), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
await b.close()
if (failed.length) { console.log('FAILED:', failed.join(', ')); process.exit(1) }
console.log(`${Object.keys(checks).length}/${Object.keys(checks).length} E2E ESCUELA OK`)
