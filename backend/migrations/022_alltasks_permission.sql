-- 022_alltasks_permission.sql — new permission "alltasks.view": shows the All Tasks page (every task across every customer, in a filterable table).
-- Internal (NyneOS) roles only; every existing internal role is granted it so nobody loses access. Requires 011. Safe to re-run. No table change.
INSERT INTO uam_permissions (code, module, name) VALUES ('alltasks.view', 'All Tasks', 'View the All Tasks page (every task, with filters)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO uam_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM uam_roles r JOIN uam_permissions p ON p.code = 'alltasks.view'
WHERE r.user_type = 'internal'
ON CONFLICT DO NOTHING;
