-- 005_add_custom_dependencies.sql — free-text ("custom") dependencies on a task,
-- e.g. 'Approval from BMC Bank IT'. Task-to-task dependencies stay in tasks.depends_on (004).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_dependencies TEXT[] NOT NULL DEFAULT '{}';
