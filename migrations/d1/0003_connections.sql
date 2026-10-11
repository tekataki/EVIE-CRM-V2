-- Per-account provider connections (sealed tokens) and single-use OAuth states.
CREATE TABLE IF NOT EXISTS provider_tokens (
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar')),
  tokens TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_ok INTEGER,
  error TEXT,
  PRIMARY KEY (owner_id, provider)
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_exp ON oauth_states(expires_at);
