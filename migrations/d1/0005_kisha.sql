-- v2.5 Mascota Virtual: short-lived (24 h) sealed idempotency cache for Kisha turns, keyed by owner.
-- Applied automatically by ensureSchema(). No journal content is stored server-side permanently.
CREATE TABLE IF NOT EXISTS kisha_turns (owner_id TEXT NOT NULL, turn_id TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, turn_id));
