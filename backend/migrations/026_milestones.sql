-- 026_milestones.sql — milestones: a dated marker (title, summary, date) that belongs to one customer. It shows on that customer's
-- timeline and board and in the alerts as an upcoming milestone. New permission "milestone.manage" (add / edit / delete);
-- granted to internal roles that can create tasks. Everyone who can see the customer's dashboard can see its milestones.
-- Requires 011. Safe to re-run.
CREATE TABLE IF NOT EXISTS milestones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customer_master(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  summary        TEXT NOT NULL DEFAULT '',
  milestone_date DATE NOT NULL,
  created_by     UUID REFERENCES user_data(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_milestones_customer_date ON milestones (customer_id, milestone_date);

INSERT INTO uam_permissions (code, module, name) VALUES ('milestone.manage', 'Tasks', 'Add / edit / delete milestones')
ON CONFLICT (code) DO NOTHING;

INSERT INTO uam_role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM uam_role_permissions rp
JOIN uam_permissions tc ON tc.id = rp.permission_id AND tc.code = 'task.create'
JOIN uam_roles r ON r.id = rp.role_id AND r.user_type = 'internal'
JOIN uam_permissions p ON p.code = 'milestone.manage'
ON CONFLICT DO NOTHING;
