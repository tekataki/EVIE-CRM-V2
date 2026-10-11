// Verifica en el sitio desplegado que dos cuentas NO pueden ver ni modificar datos de la otra.
// Uso (las contraseñas se piden por teclado, no se guardan ni se imprimen):
//   node tools/verify-isolation.mjs https://TU-SITIO.pages.dev usuarioA usuarioB
import readline from 'node:readline'
const [base, ua, ub] = process.argv.slice(2)
if (!base || !ua || !ub) { console.error('Uso: node tools/verify-isolation.mjs URL usuarioA usuarioB'); process.exit(2) }
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.stdoutMuted = true; rl._writeToOutput = (s) => { if (!rl.stdoutMuted || s.includes(q)) rl.output.write(s) }; rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); res(a) }) })
const origin = new URL(base).origin
async function login(user, pass) {
  const r = await fetch(origin + '/api/auth/signin', { method: 'POST', redirect: 'manual', headers: { Origin: origin, 'X-Evie-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) })
  const j = await r.json(); if (!r.ok) throw Error(user + ': ' + (j.error || r.status))
  return { id: j.user.id, cookie: r.headers.get('set-cookie').split(';')[0] }
}
const call = (s, path, body, asUser = s.id) => fetch(origin + '/api/' + path, { method: body ? 'POST' : 'GET', headers: { Origin: origin, 'X-Evie-Request': '1', 'Content-Type': 'application/json', Cookie: s.cookie, 'X-Evie-User': asUser }, ...(body ? { body: JSON.stringify(body) } : {}) })
const A = await login(ua, await ask('Contraseña de ' + ua + ': ')), B = await login(ub, await ask('Contraseña de ' + ub + ': '))
const results = []; const check = (name, ok, detail = '') => { results.push([name, ok]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' · ' + detail : '')) }
check('Cuentas distintas', A.id !== B.id)
const marker = 'isolation-' + Date.now()
const push = await call(A, 'data/push', { changes: [{ collection: 'goals', record_id: marker, payload: { id: marker, title: 'Prueba de aislamiento (se puede borrar)', date: new Date().toISOString().slice(0, 10), progress: 0, target: 1, periodKey: '', deleted_at: new Date().toISOString() }, expected_revision: 0 }] })
check('A puede escribir su propio registro', push.ok, String(push.status))
const pullB = await (await call(B, 'data/pull', { after: '' })).json()
check('B no ve el registro de A', !(pullB.rows || []).some((r) => r.record_id === marker), (pullB.rows || []).length + ' filas de B')
check('Todas las filas que recibe B son de B', (pullB.rows || []).every((r) => r.owner_id === B.id))
const spoof = await call(B, 'data/pull', { after: '' }, A.id)
check('B no puede hacerse pasar por A (X-Evie-User)', spoof.status === 401, String(spoof.status))
const overwrite = await call(B, 'data/push', { changes: [{ collection: 'goals', record_id: marker, payload: { id: marker, title: 'B intentó sobrescribir', date: '2026-01-01', progress: 0, target: 1, periodKey: '' }, expected_revision: 1 }] })
const pullA = await (await call(A, 'data/pull', { after: '' })).json()
const mine = (pullA.rows || []).find((r) => r.record_id === marker)
check('B no puede modificar el registro de A', mine && mine.payload.title.startsWith('Prueba'), 'push de B → ' + overwrite.status)
const conn = await call(B, 'connections')
check('Conexiones de B son solo de B', conn.ok)
console.log(results.every((r) => r[1]) ? '\nAISLAMIENTO: PASS' : '\nAISLAMIENTO: FAIL'); process.exitCode = results.every((r) => r[1]) ? 0 : 1
