// EVIE · restore a backup produced by supabase-export.mjs. DRY-RUN by default: it verifies every table's
// SHA-256 and prints what it would upsert. Pass --apply to write (upsert on the primary key, never deletes).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase-restore.mjs backup.json [--apply] [--only=crm_records,user_preferences]
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const URL_ = process.env.SUPABASE_URL?.replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const file = process.argv[2], apply = process.argv.includes('--apply')
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean)
if (!URL_ || !KEY || !file) { console.error('Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/supabase-restore.mjs respaldo.json [--apply]'); process.exit(2) }
const PK = { profiles: 'id', user_preferences: 'user_id', crm_records: 'owner_id,collection,record_id', sync_devices: 'user_id,device_id', contacts: 'owner_id,id', automations: 'id' }
const dump = JSON.parse(readFileSync(file, 'utf8'))
const head = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
for (const [t, v] of Object.entries(dump.tables || {})) {
  if (only.length && !only.includes(t)) continue
  const sha = createHash('sha256').update(JSON.stringify(v.rows)).digest('hex')
  if (sha !== v.sha256) { console.error(`✗ ${t}: la huella no coincide; el archivo está dañado. No se restaura nada.`); process.exit(1) }
  console.log(`${apply ? '→' : '·'} ${t}: ${v.rows.length} filas ${apply ? 'restaurando…' : '(simulación; usa --apply para escribir)'}`)
  if (!apply || !v.rows.length) continue
  for (let i = 0; i < v.rows.length; i += 500) {
    const res = await fetch(`${URL_}/rest/v1/${t}?on_conflict=${PK[t]}`, { method: 'POST', headers: head, body: JSON.stringify(v.rows.slice(i, i + 500)) })
    if (!res.ok) { console.error(`✗ ${t}: HTTP ${res.status} ${await res.text()}`); process.exit(1) }
  }
  console.log(`✓ ${t} restaurada`)
}
