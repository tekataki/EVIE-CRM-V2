// E2E Finanzas v4 (browser, local mode): seeded BBVA 3,920 + Dinero Físico 1,000 (debit, as in the screenshot) and
// two legacy unassigned movements. Voice commands through EvieAssistant.tryLocal (no AI), account badges, manual form
// requires an account, review flow with double-count choice, reconciliation as baseline, Compras moved out.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const W = Number(process.env.W || 1440), SHOT = process.env.SHOT
const b = await chromium.launch({ args: ['--no-sandbox', '--js-flags=--max-old-space-size=220'] })
const ctx = await b.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, serviceWorkers: 'block', isMobile: W < 700, hasTouch: W < 700 }); const p = await ctx.newPage()
const errors = []; p.on('pageerror', (e) => errors.push(e.message))
const checks = []; const ok = (m) => { checks.push(m); console.log('  ✓', m) }
const until = (fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms })
await p.goto('http://localhost:3000/index.html?qa=fin' + Date.now(), { timeout: 90000 }); await p.waitForFunction(() => window.DALI_READY, null, { timeout: 60000 })
await p.evaluate(() => { document.getElementById('evie-splash')?.remove(); Store.save((s) => { s.preferences.evieModulesChosen = true; s.preferences.evieAccounts = [{ id: 'acc-bbva', name: 'BBVA', type: 'debit', opening: 392000 }, { id: 'acc-cash', name: 'Dinero Físico', type: 'debit', opening: 100000 }]
  s.transactions.push(Store.record(Records.normalize('transactions', { title: 'Ventas de SOMA', type: 'income', amount: 92000, date: Domain.today(), category: 'Ventas', business_unit: 'personal' })), Store.record(Records.normalize('transactions', { title: 'Ajuste para equilibrar finanzas', type: 'expense', amount: 173300, date: Domain.today(), category: 'Otro', business_unit: 'personal' }))) }); location.hash = 'finanzas'; App.render() })
const av = () => p.evaluate(() => { const a = FinanceCore.available(EvieFinance.accounts(), Store.list('transactions'), { today: Domain.today() }); return { total: a.cents, cash: a.accounts.find((x) => x.id === 'acc-cash').balance, bbva: a.accounts.find((x) => x.id === 'acc-bbva').balance, un: a.unassigned_count } })
const stats = () => p.evaluate(() => { const t = Views.totals(); return { income: t.income, expense: t.expense } })
const say = (t) => p.evaluate((t) => EvieAssistant.tryLocal(t), t)
await until(() => document.querySelector('.bank-amount') && document.querySelector('#evm-accounts'))
let s = await av(); assert.equal(s.total, 492000); assert.equal(s.un, 2)
assert.match(await p.innerText('.bank-amount'), /4,920\.00/); ok('4,920 MXN available; 2 legacy movements stay unassigned and do not change balances')
assert.equal(await p.locator('.record-row .fin-badge.none').count(), 2); ok('legacy movements show a visible «Sin cuenta» badge')
const e0 = (await stats()).expense
assert.match(await say('Ivi, gasté 200 pesos de mi dinero físico en comida'), /gasto de \$200\.00 de Dinero Físico/)
s = await av(); assert.equal(s.cash, 80000); assert.equal(s.total, 472000); assert.equal((await stats()).expense - e0, 20000)
await until(() => [...document.querySelectorAll('.record-row')].some((r) => /Comida/.test(r.innerText) && /Dinero Físico/.test(r.innerText)))
ok('«gasté 200 de mi dinero físico en comida» → cash 800, total 4,720, period expense +200, badge shows the account')
await until(() => document.querySelector('.toast')); assert.ok(await p.$('.toast button, .toast [data-action]')); ok('one concise confirmation toast with an undo action')
assert.match(await say('Ivi, gasté 200 pesos de mi dinero físico en comida'), /ya estaba registrado/); assert.equal((await av()).cash, 80000); ok('repeated utterance does not duplicate')
assert.equal(await say('Ivi, agrega un gasto de 300 pesos'), '¿De cuál cuenta: BBVA o Dinero Físico?'); assert.match(await say('BBVA'), /de BBVA/); assert.equal((await av()).bbva, 362000); ok('no account named → «¿De cuál cuenta: BBVA o Dinero Físico?» → answer completes one movement')
const before = await stats(); assert.match(await say('Ivi, pasa 200 de efectivo a BBVA'), /Pasé \$200\.00/)
s = await av(); assert.equal(s.cash, 60000); assert.equal(s.total, 442000); assert.deepEqual(await stats(), before); ok('cash → BBVA transfer keeps the combined total and period statistics unchanged')
assert.match(await say('Ivi, deshaz lo último'), /deshice/); assert.equal((await av()).cash, 80000); ok('«deshaz lo último» reverts the transfer')
assert.match(await say('Ivi, recibí 500 pesos por un Intensity en BBVA'), /ingreso de \$500\.00 en BBVA/); assert.equal(await p.evaluate(() => Store.list('transactions').find((t) => t.title === 'Intensity').soma_client), undefined); ok('income «en BBVA» is not linked to SOMA unless explicit')
// Manual form requires an account when several exist
await p.evaluate(() => { document.querySelectorAll('.toast').forEach((t) => t.remove()); App.closeDialog?.(true) })
await p.click('.page-heading [data-action="add-transaction"]'); await until(() => document.getElementById('money-pad-input')); await p.fill('#money-pad-input', '45'); await p.click('[data-action="amount-next"]'); await until(() => document.getElementById('field-evie_account'))
await p.fill('#field-title', 'Papelería'); await p.click('#record-form [type=submit]'); assert.equal(await p.evaluate(() => document.getElementById('field-evie_account').validity.valid), false); ok('manual form requires choosing an account')
await p.selectOption('#field-evie_account', 'acc-cash'); await p.click('#record-form [type=submit]'); await until(() => !document.getElementById('record-form'))
assert.equal((await av()).cash, 75500); assert.equal(await p.evaluate(() => Store.list('transactions').find((t) => t.title === 'Papelería').evie_account), 'acc-cash'); ok('manual movement saved against the chosen account')
const id = await p.evaluate(() => Store.list('transactions').find((t) => t.title === 'Papelería').id)
await p.click(`.record-row [data-action="edit"][data-id="${id}"]`); await until(() => document.getElementById('field-evie_account')); await p.selectOption('#field-evie_account', 'acc-bbva'); await p.click('#record-form [type=submit]'); await until(() => !document.getElementById('record-form'))
s = await av(); assert.equal(s.cash, 80000); assert.equal(s.bbva, 362000 + 50000 - 4500); assert.equal(await p.evaluate(() => Store.list('transactions').filter((t) => t.title === 'Papelería').length), 1); ok('editing a movement\'s account moves it between balances (same record, no duplicate)')
// Review legacy movements: one as «ya incluido», one counted
const L = await p.evaluate(() => Store.list('transactions').filter((t) => !t.evie_account && !FinanceCore.isTransfer(t)).map((t) => ({ id: t.id, title: t.title })))
const soma = L.find((x) => /Ventas/.test(x.title)), adj = L.find((x) => /Ajuste/.test(x.title))
const openReview = () => p.evaluate(() => { const d = document.getElementById('fin-review-unassigned'); if (d) d.open = true })
await openReview(); await p.selectOption(`[data-fin-pick="${soma.id}"]`, 'acc-bbva'); await p.click(`[data-fin="assign-base"][data-id="${soma.id}"]`)
assert.equal((await av()).bbva, 407500); ok('legacy movement marked «Ya incluido»: shown in BBVA, balance unchanged (no double count)')
await openReview(); await p.selectOption(`[data-fin-pick="${adj.id}"]`, 'acc-cash'); await p.click(`[data-fin="assign-new"][data-id="${adj.id}"]`)
assert.equal((await av()).cash, 80000 - 173300); ok('legacy movement «Contar» changes that balance exactly once')
await until(() => document.querySelector('[data-fin="type-cash"]')); await p.click('[data-fin="type-cash"]'); assert.equal(await p.evaluate(() => EvieFinance.accounts().find((a) => a.id === 'acc-cash').type), 'cash'); assert.equal((await av()).cash, 80000 - 173300); ok('«Dinero Físico» corrected to Efectivo without changing its value')
const st = await stats(); await p.click('[data-evm="acc-reconcile"][data-id="acc-cash"]'); await until(() => document.getElementById('evm-rec')); await p.fill('#evm-rec [name=real]', '650'); await p.click('#evm-rec .button.primary')
await until(() => !document.getElementById('evm-rec')); assert.equal((await av()).cash, 65000); assert.deepEqual(await stats(), st); ok('«Ajustar saldo real» sets an auditable baseline: no income/expense, statistics unchanged')
assert.equal(await p.$('#ev-shop'), null); assert.equal(await p.$('#ev-pantry'), null); assert.ok(await p.$('.fin-moved a[href="#compras"]'))
if (SHOT) { await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500); await p.screenshot({ path: `${SHOT}-finanzas.png`, fullPage: true }) }
await p.evaluate(() => { location.hash = 'compras' }); await until(() => document.getElementById('ev-shop')); ok('Compras y despensa removed from Finanzas, available in its own section (data intact)')
assert.equal((await p.evaluate(() => Store.list('transactions').filter((t) => t.op_id).length)) >= 4, true)
assert.deepEqual(errors, []); console.log(`FINANCE E2E OK (${checks.length} checks, ${W})`); await b.close()
