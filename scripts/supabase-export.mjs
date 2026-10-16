// EVIE · read-only Supabase export (run BEFORE any migration). Writes one JSON file per run with every row of
// the EVIE tables visible to the service role, plus row counts and a SHA-256 of each table, so it can be
// verified and restored with scripts/supabase-restore.mjs. It never modifies data.
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase-export.mjs [out-dir]
//
// The service-role key bypasses RLS: run this only on your own computer, never commit the output (it contains
// private data) and never paste the key into the browser or the repo.
import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
const URL_ = process.env.SUPABASE_URL?.replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.'); process.exit(2) }
const TABLES = ['profiles', 'user_preferences', 'crm_records', 'sync_devices', 'contacts', 'automations']
const out = process.argv[2] || 'supabase-backup'
mkdirSync(out, { recursive: true })
const head = { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/json' }
const dump = { exported_at: new Date().toISOString(), project: new URL(URL_).hostname.split('.')[0], tables: {} }
for (const t of TABLES) {
  const rows = []; let from = 0; const page = 1000
  for (;;) {
    const res = await fetch(`${URL_}/rest/v1/${t}?select=*`, { headers: { ...head, Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' } })
    if (res.status === 404 || res.status === 400) { console.warn(`· ${t}: no existe en este proyecto (se omite).`); break }
    if (!res.ok) { console.error(`✗ ${t}: HTTP ${res.status} ${await res.text()}`); process.exit(1) }
    const chunk = await res.json(); rows.push(...chunk); if (chunk.length < page) break; from += page
  }
  const json = JSON.stringify(rows)
  dump.tables[t] = { count: rows.length, sha256: createHash('sha256').update(json).digest('hex'), rows }
  console.log(`✓ ${t}: ${rows.length} filas`)
}
const file = `${out}/evie-supabase-${dump.exported_at.replace(/[:.]/g, '-')}.json`
writeFileSync(file, JSON.stringify(dump), { mode: 0o600 })
console.log('Respaldo escrito en', file, '— guárdalo fuera del repositorio.')
