// EVIE v5: self-healing schema (same SQL as migrations/d1/0008_v5_backend.sql) + shared helpers
// (per-account settings, idempotent operations, content-free metrics). Additive only.
import { ensureMemorySchema } from './memory.js'

export const V5_TABLES = [
  "CREATE TABLE IF NOT EXISTS evie_user_settings (owner_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, key))",
  "CREATE TABLE IF NOT EXISTS guest_accounts (owner_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, invite_id TEXT NOT NULL, created_by TEXT NOT NULL, redeemed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cleaning','cleaned','failed')), cleanup_attempts INTEGER NOT NULL DEFAULT 0, cleanup_log TEXT NOT NULL DEFAULT '', cleaned_at INTEGER)",
  "CREATE INDEX IF NOT EXISTS idx_guest_accounts_exp ON guest_accounts(status, expires_at)",
  "CREATE TABLE IF NOT EXISTS evie_tasks (owner_id TEXT NOT NULL, id TEXT NOT NULL, client_id TEXT, data TEXT NOT NULL, due_date TEXT, due_time TEXT, tz TEXT NOT NULL DEFAULT 'America/Mexico_City', duration_min INTEGER, priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')), status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')), completed_at INTEGER, agenda_link TEXT, source TEXT NOT NULL DEFAULT 'manual', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id))",
  "CREATE INDEX IF NOT EXISTS idx_evie_tasks_owner_due ON evie_tasks(owner_id, status, due_date)",
  "CREATE INDEX IF NOT EXISTS idx_evie_tasks_owner_client ON evie_tasks(owner_id, client_id)",
  "CREATE TABLE IF NOT EXISTS evie_scenes (owner_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, trigger_keys TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id))",
  "CREATE TABLE IF NOT EXISTS evie_ops (owner_id TEXT NOT NULL, op_id TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, op_id))",
  "CREATE TABLE IF NOT EXISTS evie_plans (owner_id TEXT NOT NULL, id TEXT NOT NULL, day TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','applied','discarded')), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id))",
  "CREATE TABLE IF NOT EXISTS evie_metrics (owner_id TEXT NOT NULL, day TEXT NOT NULL, metric TEXT NOT NULL, bucket INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner_id, day, metric, bucket))"
]
// Columns added to pre-existing tables. Applied only when missing (SQLite has no ADD COLUMN IF NOT EXISTS).
export const V5_COLUMNS = [
  ['auth_invites', 'kind', "TEXT NOT NULL DEFAULT 'member'"],
  ['evie_memories', 'mtype', "TEXT NOT NULL DEFAULT 'fact'"],
  ['evie_memories', 'project', "TEXT NOT NULL DEFAULT ''"],
  ['evie_memories', 'confidence', 'REAL NOT NULL DEFAULT 1'],
  ['evie_memories', 'sensitivity', "TEXT NOT NULL DEFAULT 'normal'"]
]
const ready = new WeakMap()
export function ensureV5(db) {
  if (!db) return Promise.resolve()
  let p = ready.get(db)
  if (!p) {
    p = (async () => {
      await ensureMemorySchema(db)
      for (const sql of V5_TABLES) await db.prepare(sql).bind().run()
      for (const [table, col, def] of V5_COLUMNS) {
        const { results = [] } = await db.prepare(`PRAGMA table_info(${table})`).bind().all()
        if (!results.length || results.some((r) => r.name === col)) continue
        try { await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).bind().run() } catch (e) { if (!/duplicate column/i.test(String(e?.message))) throw e }
      }
    })().catch((e) => { ready.delete(db); throw e })
    ready.set(db, p)
  }
  return p
}

// ---------- per-account settings ----------
export async function getSetting(env, owner, key) { const r = await env.AUTH_DB.prepare('SELECT value FROM evie_user_settings WHERE owner_id=? AND key=?').bind(owner, key).first(); return r ? r.value : null }
export async function putSetting(env, owner, key, value) { await env.AUTH_DB.prepare('INSERT INTO evie_user_settings(owner_id,key,value,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(owner, key, String(value), Date.now()).run() }

// ---------- idempotency ----------
export const OP_ID = /^[A-Za-z0-9:_-]{6,160}$/
/** Runs fn once per (owner, op_id). A replay returns the stored result with replay:true. */
export async function once(env, owner, opId, fn) {
  if (!opId) return fn()
  if (!OP_ID.test(opId)) return { error: 'Identificador de operación inválido.', status: 400 }
  const prev = await env.AUTH_DB.prepare('SELECT result FROM evie_ops WHERE owner_id=? AND op_id=?').bind(owner, opId).first()
  if (prev) { try { return { ...JSON.parse(prev.result), replay: true } } catch { return { replay: true } } }
  const result = await fn()
  if (!result?.error) await env.AUTH_DB.prepare('INSERT INTO evie_ops(owner_id,op_id,result,created_at) VALUES(?,?,?,?) ON CONFLICT(owner_id,op_id) DO NOTHING').bind(owner, opId, JSON.stringify(result).slice(0, 4000), Date.now()).run()
  if (Math.random() < 0.02) await env.AUTH_DB.prepare('DELETE FROM evie_ops WHERE created_at<?').bind(Date.now() - 30 * 86400000).run()
  return result
}

// ---------- content-free latency/usage metrics ----------
// Log2 buckets of milliseconds (bucket b covers [2^b, 2^(b+1)) ms). Only metric names + counts are stored.
export const METRIC = /^[a-z0-9_]{2,40}(?::[a-z0-9_]{1,20})?$/
export function bucketOf(ms) { return Math.max(0, Math.min(20, Math.floor(Math.log2(Math.max(1, ms))))) }
export async function observe(env, owner, metric, ms) {
  if (!env?.AUTH_DB || !METRIC.test(metric) || !Number.isFinite(ms) || ms < 0) return
  const day = new Date().toISOString().slice(0, 10)
  try { await env.AUTH_DB.prepare('INSERT INTO evie_metrics(owner_id,day,metric,bucket,n) VALUES(?,?,?,?,1) ON CONFLICT(owner_id,day,metric,bucket) DO UPDATE SET n=n+1').bind(owner, day, metric, bucketOf(ms)).run() } catch {}
}
/** p50/p95 from bucket histograms (upper bound of the bucket, conservative). */
export function percentiles(rows) {
  const by = {}
  for (const r of rows) (by[r.metric] ||= []).push(r)
  const out = {}
  for (const [m, list] of Object.entries(by)) {
    list.sort((a, b) => a.bucket - b.bucket)
    const total = list.reduce((s, r) => s + r.n, 0)
    const at = (q) => { let acc = 0; for (const r of list) { acc += r.n; if (acc >= q * total) return 2 ** (r.bucket + 1) } return null }
    out[m] = { n: total, p50_ms_max: at(0.5), p95_ms_max: at(0.95) }
  }
  return out
}
export const rid = () => 'r-' + crypto.randomUUID()
export const newId = (p) => p + '-' + crypto.randomUUID()
export const STABLE_ID = /^[a-zA-Z0-9-]{1,80}$/
export const clean = (text, max) => String(text ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
export const norm = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim()
export async function readBody(c) { try { const b = await c.req.json(); if (!b || typeof b !== 'object' || Array.isArray(b) || 'owner_id' in b || 'user_id' in b) return null; return b } catch { return null } }
