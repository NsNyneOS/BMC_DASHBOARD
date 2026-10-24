-- 017_mytasks_permission.sql — new permission "mytasks.view": shows the My Tasks page (tasks assigned to you / that you review).
-- Internal (NyneOS) roles only; every existing internal role is granted it so nobody loses access. Customer users always have
-- their My Tasks tab. Also fixes a permission label left over from the owner_team -> team rename.
-- Requires 011. Safe to re-run. No table change.
INSERT INTO uam_permissions (code, module, name) VALUES ('mytasks.view', 'My Tasks', 'View My Tasks (assigned to me / reviewing)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO uam_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM uam_roles r JOIN uam_permissions p ON p.code = 'mytasks.view'
WHERE r.user_type = 'internal'
ON CONFLICT DO NOTHING;

UPDATE uam_permissions SET name = 'Change a task''s team' WHERE code = 'task.team.manage';
