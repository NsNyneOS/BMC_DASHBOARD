-- 025_alerts_permission_module.sql — keeps "alerts.view" (View project alerts) in the Dashboard group on the Roles screen and
-- makes sure it exists. Safe to re-run. No table change.
INSERT INTO uam_permissions (code, module, name) VALUES ('alerts.view', 'Dashboard', 'View project alerts')
ON CONFLICT (code) DO UPDATE SET module = 'Dashboard';
