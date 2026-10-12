-- v3: Google sign-in (Supabase PKCE), explicit identity links and desktop deep-link handoff.
-- Reversible: DROP TABLE google_auth_states; DROP TABLE google_links; DROP TABLE desktop_handoffs;
CREATE TABLE IF NOT EXISTS google_auth_states (state TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS google_links (owner_id TEXT PRIMARY KEY, email TEXT NOT NULL DEFAULT '', linked_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS desktop_handoffs (code TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
