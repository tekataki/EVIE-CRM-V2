-- Cloudflare D1: opaque session IDs and encrypted provider tokens only.
CREATE TABLE IF NOT EXISTS auth_sessions (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 username TEXT NOT NULL,
 tokens TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 refresh_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS auth_sessions_owner ON auth_sessions(owner_id);
CREATE TABLE IF NOT EXISTS auth_attempts(id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
