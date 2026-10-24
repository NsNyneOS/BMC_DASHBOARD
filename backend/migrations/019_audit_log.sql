-- 019_audit_log.sql — audit trail: every create / update / delete made through the API is recorded (who, when, what).
-- New permission "audit.view" shows the Audit page; granted to internal roles that can manage roles. Requires 011. Safe to re-run.
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES user_data(id) ON DELETE SET NULL,
  user_name   TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,          -- create | update | delete
  entity      TEXT NOT NULL,          -- tasks | projects | customers | users | roles | auth
  entity_id   TEXT NOT NULL DEFAULT '',
  label       TEXT NOT NULL DEFAULT '',
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

INSERT INTO uam_permissions (code, module, name) VALUES ('audit.view', 'UAM', 'View the audit log')
ON CONFLICT (code) DO NOTHING;

INSERT INTO uam_role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM uam_role_permissions rp
JOIN uam_permissions rm ON rm.id = rp.permission_id AND rm.code = 'role.manage'
JOIN uam_roles r ON r.id = rp.role_id AND r.user_type = 'internal'
JOIN uam_permissions p ON p.code = 'audit.view'
ON CONFLICT DO NOTHING;
