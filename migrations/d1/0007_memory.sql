-- Memoria de Ivi (P3): additive only. Same SQL as src/memory.js MEMORY_SCHEMA (also self-applied by ensureMemorySchema).
-- Text columns hold AES-GCM sealed JSON (EVIE_SESSION_KEY); keys/topic hold truncated HMAC-SHA-256 hashes, never plaintext.
-- Rows are keyed by the authenticated owner_id only. Rollback: DROP TABLE evie_sessions; DROP TABLE evie_memories; DROP TABLE evie_memory_settings;
CREATE TABLE IF NOT EXISTS evie_memory_settings (owner_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS evie_memories (owner_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('preference','fact','priority','person','other')), category TEXT NOT NULL DEFAULT 'general', topic TEXT NOT NULL DEFAULT '', data TEXT NOT NULL, keys TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'explicit', source_session TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id));
CREATE INDEX IF NOT EXISTS idx_evie_memories_owner_topic ON evie_memories(owner_id, topic);
CREATE TABLE IF NOT EXISTS evie_sessions (owner_id TEXT NOT NULL, id TEXT NOT NULL, day TEXT NOT NULL, started_at INTEGER NOT NULL, data TEXT NOT NULL, keys TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, id));
CREATE INDEX IF NOT EXISTS idx_evie_sessions_owner_day ON evie_sessions(owner_id, day);
