-- 007_add_task_client_visible.sql — NyneOS users can mark a task VISIBLE / NOT VISIBLE.
-- Not-visible tasks are hidden from the BMC and KYC (role 'bmc') logins. Existing tasks stay visible.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT TRUE;
