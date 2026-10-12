-- v2.4: optional per-user personalization (sealed JSON). Applied automatically by ensureSchema().
CREATE TABLE IF NOT EXISTS user_profiles (owner_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
