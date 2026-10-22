-- 009_add_crm_project_enum.sql — adds the CRM project id.
-- Run outside a transaction block, then run 010_add_crm_project.sql.
ALTER TYPE project_id ADD VALUE IF NOT EXISTS 'CRM';
