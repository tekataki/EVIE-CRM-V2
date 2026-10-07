-- Cuentas conocidas (rol), invitaciones de un solo uso y contadores diarios de IA.
CREATE TABLE IF NOT EXISTS auth_accounts (
 owner_id TEXT PRIMARY KEY,
 username TEXT NOT NULL UNIQUE,
 role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_invites (
 id TEXT PRIMARY KEY,            -- SHA-256 del código; el código nunca se guarda
 created_by TEXT NOT NULL,
 label TEXT NOT NULL DEFAULT '',
 expires_at INTEGER NOT NULL,
 used_at INTEGER,
 used_by TEXT
);
CREATE TABLE IF NOT EXISTS ai_usage (
 owner_id TEXT NOT NULL,
 day TEXT NOT NULL,
 kind TEXT NOT NULL,             -- chat | stt_seconds | tts_chars
 amount INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY (owner_id, day, kind)
);
