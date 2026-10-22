-- 014_task_assignees.sql — a task can be assigned to SEVERAL people (multi-select), so assignees move from the single
-- tasks.assignee_id column into a join table. Existing single assignments are copied across.
-- Requires 011. Safe to re-run. tasks.assignee_id is left in place but no longer used.
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id     UUID        NOT NULL REFERENCES tasks(id)     ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES user_data(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees (user_id);

INSERT INTO task_assignees (task_id, user_id)
SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;
