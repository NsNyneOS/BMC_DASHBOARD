-- 010_add_crm_project.sql — CRM is an internal project: only NyneOS (role 'nyneos') logins can see it.
-- BMC / KYC logins never receive the project, its tasks or its alerts.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS nyneos_only BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO projects (id, name, color, task_counter, nyneos_only) VALUES ('CRM', 'CRM', 'var(--crm)', 0, TRUE)
ON CONFLICT (id) DO UPDATE SET nyneos_only = TRUE;
