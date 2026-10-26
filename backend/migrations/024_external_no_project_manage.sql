-- 024_external_no_project_manage.sql — customer (external) roles can no longer create / edit projects ("project.manage" is NyneOS-only).
-- Revokes it from every external role. Requires 011. Safe to re-run. No table change.
DELETE FROM uam_role_permissions rp
USING uam_roles r, uam_permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.user_type = 'external' AND p.code = 'project.manage';
