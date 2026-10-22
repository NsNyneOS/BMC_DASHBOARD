-- 011_multi_customer.sql — turns the single-bank dashboard into a multi-customer product. ONE file, run once.
-- Requires 001-008. Take a backup first, and deploy it together with the matching backend + frontend release
-- (tasks.project changes from an enum to a text foreign key, which the previous backend cannot read).
--
--   New tables : customer_master, project_master, uam_roles, uam_permissions, uam_role_permissions, user_project_access
--   Altered    : user_data (+user_type, role_id, customer_id), tasks.project / project_alerts.project (enum -> TEXT FK)
--   NOT dropped: projects (kept as a frozen legacy copy; project_master is the live table) and the project_id enum.
BEGIN;

-- ---------------------------------------------------------------------------
-- customer_master: one row per customer (bank). NyneOS itself is the single 'internal' row: the OWNER that serves the customers (never listed as one).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_master (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT        NOT NULL UNIQUE,                       -- short stable id, e.g. 'BMC'
  name           TEXT        NOT NULL,                              -- legal / display name
  short_name     TEXT,
  customer_type  TEXT        NOT NULL DEFAULT 'client' CHECK (customer_type IN ('internal', 'client')),
  logo_url       TEXT,                                              -- shown in the header / login for this customer
  website        TEXT,
  contact_name   TEXT,
  contact_email  TEXT,
  contact_phone  TEXT,
  address        TEXT,
  status         TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_single_internal ON customer_master (customer_type) WHERE customer_type = 'internal';

-- ---------------------------------------------------------------------------
-- project_master: a customer has N projects. Replaces the hard-coded AML/EKYC/DPDP/WEB/CRM enum.
-- code is globally unique and is the task-key prefix (AML-3), so task keys stay unique across customers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_master (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID        NOT NULL REFERENCES customer_master(id) ON DELETE RESTRICT,
  code          TEXT        NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  color         TEXT        NOT NULL DEFAULT 'var(--accent)',       -- CSS colour / token used by the UI
  start_date    DATE,
  end_date      DATE,
  task_counter  INTEGER     NOT NULL DEFAULT 0,                     -- last issued number for <code>-1, <code>-2 ...
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  internal_only BOOLEAN     NOT NULL DEFAULT FALSE,                 -- TRUE: never shown to external (client) users
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_project_master_customer ON project_master (customer_id);

-- ---------------------------------------------------------------------------
-- UAM: roles -> permissions. A role belongs to one user type (internal / external).
-- Named uam_* on purpose: the shared 'public' schema already holds another application's roles / permissions / role_permissions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uam_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,                          -- e.g. NYNEOS_ADMIN
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  user_type   TEXT        NOT NULL CHECK (user_type IN ('internal', 'external')),
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE,                   -- seeded roles cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uam_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,                                 -- e.g. task.create
  module      TEXT NOT NULL,                                        -- grouping in the Roles screen
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS uam_role_permissions (
  role_id       UUID NOT NULL REFERENCES uam_roles(id)       ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES uam_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- user_data: every user is INTERNAL (NyneOS, sees all customers) or EXTERNAL (belongs to ONE customer).
-- ---------------------------------------------------------------------------
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS user_type   TEXT;
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS role_id     UUID REFERENCES uam_roles(id);
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customer_master(id);
CREATE INDEX IF NOT EXISTS idx_user_data_customer ON user_data (customer_id);

-- Optional narrowing: an external user with rows here only sees those projects (none = all of the customer's).
CREATE TABLE IF NOT EXISTS user_project_access (
  user_id    UUID NOT NULL REFERENCES user_data(id)      ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers for the new tables (set_updated_at() already exists)
-- ---------------------------------------------------------------------------
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['customer_master', 'project_master', 'uam_roles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- ===========================================================================
-- Seed + back-fill
-- ===========================================================================

-- Customers: NyneOS (internal) and the existing bank
INSERT INTO customer_master (code, name, short_name, customer_type) VALUES
  ('NYNEOS', 'NyneOS Technologies',                'NyneOS', 'internal'),
  ('BMC',    'Bombay Mercantile Co-operative Bank', 'BMC',   'client')
ON CONFLICT (code) DO NOTHING;

-- Projects: copy EVERY row of the existing projects table (id, name, colour, dates, task_counter, timestamps).
-- Rows flagged nyneos_only (CRM, if 010 was applied) go to the NyneOS customer; all others belong to BMC.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS nyneos_only BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO project_master (customer_id, code, name, color, start_date, end_date, task_counter, internal_only, created_at, updated_at)
SELECT (SELECT id FROM customer_master WHERE code = CASE WHEN p.nyneos_only THEN 'NYNEOS' ELSE 'BMC' END),
       p.id::text, p.name, p.color, p.start_date, p.end_date, p.task_counter, p.nyneos_only, p.created_at, p.updated_at
FROM projects p
ON CONFLICT (code) DO NOTHING;

-- CRM is the internal-only project owned by NyneOS (no-op if it was already copied above).
INSERT INTO project_master (customer_id, code, name, color, internal_only)
SELECT id, 'CRM', 'CRM', 'var(--crm)', TRUE FROM customer_master WHERE code = 'NYNEOS'
ON CONFLICT (code) DO NOTHING;

-- Safety net: stop here if any existing project did not make it across.
DO $$ DECLARE missing TEXT; BEGIN
  SELECT string_agg(p.id::text, ', ') INTO missing
  FROM projects p WHERE NOT EXISTS (SELECT 1 FROM project_master pm WHERE pm.code = p.id::text);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'projects not copied to project_master: %', missing; END IF;
END $$;

-- Permissions
INSERT INTO uam_permissions (code, module, name) VALUES
  ('dashboard.view',          'Dashboard', 'View dashboard & project summary'),
  ('calendar.view',           'Dashboard', 'View calendar / timeline'),
  ('alerts.view',             'Dashboard', 'View project alerts'),
  ('board.view',              'Board',     'View kanban board'),
  ('board.manage',            'Board',     'Move cards on the kanban board'),
  ('task.create',             'Tasks',     'Create tasks'),
  ('task.edit',               'Tasks',     'Edit tasks'),
  ('task.delete',             'Tasks',     'Delete tasks'),
  ('task.dependencies.edit',  'Tasks',     'Edit task dependencies'),
  ('task.visibility.manage',  'Tasks',     'Mark tasks visible / not visible to the customer'),
  ('task.team.manage',        'Tasks',     'Change a task''s team'),
  ('project.manage',          'Projects',  'Create / edit projects and their dates'),
  ('project.internal.view',   'Projects',  'See internal-only projects'),
  ('customer.view',           'Customers', 'View customers'),
  ('customer.manage',         'Customers', 'Create / edit customers'),
  ('user.view',               'UAM',       'View users'),
  ('user.manage',             'UAM',       'Create / edit / deactivate users'),
  ('role.manage',             'UAM',       'Create / edit roles and permissions')
ON CONFLICT (code) DO NOTHING;

-- Roles
INSERT INTO uam_roles (code, name, description, user_type, is_system) VALUES
  ('NYNEOS_ADMIN',  'NyneOS Admin',  'Full access to every customer, project and setting',          'internal', TRUE),
  ('NYNEOS_MEMBER', 'NyneOS Member', 'Works on customer projects; cannot manage customers or UAM',  'internal', TRUE),
  ('CUSTOMER_ADMIN',  'Customer Admin',  'Customer-side admin: sees the dashboard and manages its tasks', 'external', TRUE),
  ('CUSTOMER_VIEWER', 'Customer Viewer', 'Read-only customer user (current BMC / KYC logins)',          'external', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Role -> permission mapping
INSERT INTO uam_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM uam_roles r JOIN uam_permissions p ON
     r.code = 'NYNEOS_ADMIN'
  OR (r.code = 'NYNEOS_MEMBER' AND p.code NOT IN ('customer.manage', 'user.manage', 'role.manage'))
  OR (r.code = 'CUSTOMER_ADMIN'  AND p.code IN ('dashboard.view', 'calendar.view', 'alerts.view', 'task.create', 'task.edit'))
  OR (r.code = 'CUSTOMER_VIEWER' AND p.code IN ('dashboard.view', 'calendar.view', 'alerts.view'))
ON CONFLICT DO NOTHING;

-- Back-fill existing users: role 'nyneos' -> internal, role 'bmc' -> external user of BMC
UPDATE user_data SET user_type = CASE role::text WHEN 'nyneos' THEN 'internal' ELSE 'external' END WHERE user_type IS NULL;
UPDATE user_data SET customer_id = (SELECT id FROM customer_master WHERE code = 'BMC') WHERE user_type = 'external' AND customer_id IS NULL;
UPDATE user_data SET role_id = (SELECT id FROM uam_roles WHERE code = CASE user_data.user_type WHEN 'internal' THEN 'NYNEOS_ADMIN' ELSE 'CUSTOMER_VIEWER' END) WHERE role_id IS NULL;

ALTER TABLE user_data ALTER COLUMN user_type SET NOT NULL;
ALTER TABLE user_data ALTER COLUMN role_id   SET NOT NULL;
ALTER TABLE user_data DROP CONSTRAINT IF EXISTS user_data_type_customer_check;
ALTER TABLE user_data ADD  CONSTRAINT user_data_type_customer_check CHECK (user_type IN ('internal', 'external')
  AND ((user_type = 'internal' AND customer_id IS NULL) OR (user_type = 'external' AND customer_id IS NOT NULL)));

-- ===========================================================================
-- Re-point tasks / project_alerts at project_master (the old projects table is left untouched)
-- ===========================================================================
DO $$ DECLARE c RECORD; BEGIN
  FOR c IN SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
           WHERE contype = 'f' AND confrelid = 'projects'::regclass LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

ALTER TABLE tasks          ALTER COLUMN project TYPE TEXT USING project::text;
ALTER TABLE project_alerts ALTER COLUMN project TYPE TEXT USING project::text;

-- A project's counter must never be below the highest task number already issued (AML-34 -> 34).
UPDATE project_master pm
SET task_counter = GREATEST(pm.task_counter,
  COALESCE((SELECT max(substring(t.key from '-([0-9]+)$')::int) FROM tasks t WHERE t.project = pm.code), 0));

-- Every task / alert must point at a known project before the foreign keys go on.
DO $$ DECLARE bad TEXT; BEGIN
  SELECT string_agg(DISTINCT x.project, ', ') INTO bad
  FROM (SELECT project FROM tasks UNION SELECT project FROM project_alerts) x
  WHERE NOT EXISTS (SELECT 1 FROM project_master pm WHERE pm.code = x.project);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'tasks reference projects missing from project_master: %', bad; END IF;
END $$;

ALTER TABLE tasks          DROP CONSTRAINT IF EXISTS tasks_project_fkey;
ALTER TABLE project_alerts DROP CONSTRAINT IF EXISTS project_alerts_project_fkey;
ALTER TABLE tasks          ADD CONSTRAINT tasks_project_fkey          FOREIGN KEY (project) REFERENCES project_master(code) ON UPDATE CASCADE;
ALTER TABLE project_alerts ADD CONSTRAINT project_alerts_project_fkey FOREIGN KEY (project) REFERENCES project_master(code) ON UPDATE CASCADE ON DELETE CASCADE;

COMMENT ON TABLE projects IS 'LEGACY (pre multi-customer). Frozen copy kept for reference; the application reads project_master.';

COMMIT;
