// Fails if the production build ships QA harnesses, docs or known personal strings.
import fs from 'node:fs'; import path from 'node:path'
const dist = path.resolve('dist'); const bad = []
const banned = [/Alejandro/i, /Medina Ram/i, /2008-12-06/, /Instituto Tecnol[oó]gico de Ciudad Guzm/i]
function walk(d) { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) { walk(f); continue }
  if (/^(review-|tests)/.test(n) || (/\.(md|txt)$/.test(n) && !f.includes('vendor'))) bad.push('archivo interno: ' + path.relative(dist, f))
  if (/\.(js|html|json|css)$/.test(n)) { const t = fs.readFileSync(f, 'utf8'); for (const r of banned) if (r.test(t)) bad.push(`dato personal ${r} en ${path.relative(dist, f)}`) } } }
if (!fs.existsSync(dist)) { console.error('Ejecuta npm run build primero.'); process.exit(1) }
walk(dist); if (bad.length) { console.error(bad.join('\n')); process.exit(1) } console.log('Privacidad OK: dist/ sin datos personales ni archivos internos.')
