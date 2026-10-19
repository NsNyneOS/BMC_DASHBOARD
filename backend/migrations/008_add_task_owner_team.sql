-- 008_add_task_owner_team.sql — each task is tagged with the team it belongs to: 'nyneos' or 'bmc'.
-- Existing tasks default to 'nyneos'.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_team TEXT NOT NULL DEFAULT 'nyneos';
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_owner_team_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_owner_team_check CHECK (owner_team IN ('nyneos', 'bmc'));
