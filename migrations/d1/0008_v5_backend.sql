-- EVIE v5 backend (aditiva). Rollback: migrations/d1-rollback/0008_v5_backend_down.sql
-- Nada se borra ni se reescribe: solo tablas nuevas y columnas nuevas con DEFAULT.
-- Texto privado (títulos, notas, pasos, propuestas) siempre va SELLADO (AES-GCM, EVIE_SESSION_KEY).
-- Preferencias por cuenta (clave/valor). ai_reasoning_tier vive aquí; NO es el "modo de trabajo".
CREATE TABLE IF NOT EXISTS evie_user_settings (owner_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, key));
-- Invitaciones: 'member' = comportamiento anterior; 'guest' = acceso temporal 72 h desde el canje.
ALTER TABLE auth_invites ADD COLUMN kind TEXT NOT NULL DEFAULT 'member';
-- Cuentas invitadas temporales (rol 'guest'), separadas de auth_accounts (cuyo CHECK solo admite owner/member).
CREATE TABLE IF NOT EXISTS guest_accounts (owner_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, invite_id TEXT NOT NULL, created_by TEXT NOT NULL, redeemed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cleaning','cleaned','failed')), cleanup_attempts INTEGER NOT NULL DEFAULT 0, cleanup_log TEXT NOT NULL DEFAULT '', cleaned_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_guest_accounts_exp ON guest_accounts(status, expires_at);
-- Tareas (personales o de un cliente SOMA): registro canónico único para la vista del cliente y Pendientes.
CREATE TABLE IF NOT EXISTS evie_tasks (owner_id TEXT NOT NULL, id TEXT NOT NULL, client_id TEXT, data TEXT NOT NULL, due_date TEXT, due_time TEXT, tz TEXT NOT NULL DEFAULT 'America/Mexico_City', duration_min INTEGER, priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')), status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')), completed_at INTEGER, agenda_link TEXT, source TEXT NOT NULL DEFAULT 'manual', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id));
CREATE INDEX IF NOT EXISTS idx_evie_tasks_owner_due ON evie_tasks(owner_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_evie_tasks_owner_client ON evie_tasks(owner_id, client_id);
-- Escenas de automatización ("Ivi, modo SOMA"). Pasos tipados y validados en el servidor.
CREATE TABLE IF NOT EXISTS evie_scenes (owner_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, trigger_keys TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id));
-- Idempotencia de escrituras (call_id de herramientas, Idempotency-Key, propuesta:item).
CREATE TABLE IF NOT EXISTS evie_ops (owner_id TEXT NOT NULL, op_id TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, op_id));
-- Propuestas de "Preparar mi día" (selladas, caducan en 24 h).
CREATE TABLE IF NOT EXISTS evie_plans (owner_id TEXT NOT NULL, id TEXT NOT NULL, day TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','applied','discarded')), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id));
-- Métricas de latencia/uso SIN contenido: histogramas por etapa y nivel.
CREATE TABLE IF NOT EXISTS evie_metrics (owner_id TEXT NOT NULL, day TEXT NOT NULL, metric TEXT NOT NULL, bucket INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner_id, day, metric, bucket));
-- Memoria v2: tipo, proyecto (hash), confianza, sensibilidad. Registros existentes: 'fact', confianza 1.
ALTER TABLE evie_memories ADD COLUMN mtype TEXT NOT NULL DEFAULT 'fact';
ALTER TABLE evie_memories ADD COLUMN project TEXT NOT NULL DEFAULT '';
ALTER TABLE evie_memories ADD COLUMN confidence REAL NOT NULL DEFAULT 1;
ALTER TABLE evie_memories ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'normal';
