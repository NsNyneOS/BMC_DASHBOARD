-- 015_task_reporting_to.sql — each task can name the person it reports to / who reviews it (tasks.reporting_to).
-- "My Tasks" then lists both the tasks assigned to you and the tasks you are reviewing.
-- Requires 011. Safe to re-run.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reporting_to UUID REFERENCES user_data(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_reporting_to ON tasks (reporting_to);
