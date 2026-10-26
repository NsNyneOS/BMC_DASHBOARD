-- 023_today_permission.sql — new permission "today.view": shows the "Started today / Completed today" cards above the dashboard's
-- project summary. Granted to every existing role (internal and customer) so the dashboard keeps looking the same for everyone;
-- remove it from a role on the Roles screen to hide the cards. Requires 011. Safe to re-run. No table change.
INSERT INTO uam_permissions (code, module, name) VALUES ('today.view', 'Dashboard', 'View today''s activity (started / completed)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO uam_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM uam_roles r JOIN uam_permissions p ON p.code = 'today.view'
ON CONFLICT DO NOTHING;
