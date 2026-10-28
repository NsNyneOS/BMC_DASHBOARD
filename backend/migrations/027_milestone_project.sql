-- 027_milestone_project.sql — a milestone can optionally belong to one project of its customer (empty = the whole customer).
-- Requires 026. Safe to re-run.
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project_master(id) ON DELETE SET NULL;
