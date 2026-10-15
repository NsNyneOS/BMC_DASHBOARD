-- 004_add_task_dependencies.sql — a task can depend on other tasks of the same project.
-- depends_on holds the keys (e.g. 'WEB-3') of the tasks that must be finished first.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on TEXT[] NOT NULL DEFAULT '{}';
