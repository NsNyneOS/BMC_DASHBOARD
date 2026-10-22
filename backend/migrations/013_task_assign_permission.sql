-- 013_task_assign_permission.sql — new permission "task.assign" (assign a task to a user), and the customer-side
-- roles are named for the customer: CLIENT_ADMIN -> CUSTOMER_ADMIN, CLIENT_VIEWER -> CUSTOMER_VIEWER.
-- Requires 011. Safe to re-run. tasks.assignee_id already exists (001), so there is no table change.

-- Rename the seeded customer roles (no-op on fresh installs, where 011 already uses the new names).
UPDATE uam_roles SET code = 'CUSTOMER_ADMIN', name = 'Customer Admin'
WHERE code = 'CLIENT_ADMIN' AND NOT EXISTS (SELECT 1 FROM uam_roles WHERE code = 'CUSTOMER_ADMIN');
UPDATE uam_roles SET code = 'CUSTOMER_VIEWER', name = 'Customer Viewer'
WHERE code = 'CLIENT_VIEWER' AND NOT EXISTS (SELECT 1 FROM uam_roles WHERE code = 'CUSTOMER_VIEWER');
UPDATE uam_permissions SET name = 'Mark tasks visible / not visible to the customer'
WHERE code = 'task.visibility.manage';

INSERT INTO uam_permissions (code, module, name) VALUES ('task.assign', 'Tasks', 'Assign tasks to users')
ON CONFLICT (code) DO NOTHING;

INSERT INTO uam_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM uam_roles r JOIN uam_permissions p ON p.code = 'task.assign'
WHERE r.code IN ('NYNEOS_ADMIN', 'NYNEOS_MEMBER', 'CUSTOMER_ADMIN')
ON CONFLICT DO NOTHING;
