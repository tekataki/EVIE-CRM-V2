-- Rollback de 0008 (manual; ejecútalo SOLO tras exportar). No toca datos previos a v5.
-- npx wrangler d1 execute evie-auth --remote --file=migrations/d1-rollback/0008_v5_backend_down.sql
DROP TABLE IF EXISTS evie_user_settings;
DROP TABLE IF EXISTS guest_accounts;
DROP TABLE IF EXISTS evie_tasks;
DROP TABLE IF EXISTS evie_scenes;
DROP TABLE IF EXISTS evie_ops;
DROP TABLE IF EXISTS evie_plans;
DROP TABLE IF EXISTS evie_metrics;
ALTER TABLE auth_invites DROP COLUMN kind;
ALTER TABLE evie_memories DROP COLUMN mtype;
ALTER TABLE evie_memories DROP COLUMN project;
ALTER TABLE evie_memories DROP COLUMN confidence;
ALTER TABLE evie_memories DROP COLUMN sensitivity;
-- Después: DELETE FROM d1_migrations WHERE name='0008_v5_backend.sql';
