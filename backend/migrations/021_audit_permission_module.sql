-- 021_audit_permission_module.sql — the audit permission gets its own "Audit" group in Roles & permissions
-- (it was listed under UAM). Requires 019. Safe to re-run.
UPDATE uam_permissions SET module = 'Audit', name = 'View the Audit page (activity log)' WHERE code = 'audit.view';
