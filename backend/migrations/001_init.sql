-- 001_init.sql — BMC / NyneOS project dashboard schema
-- Derived from src/App.tsx, src/types/task.ts and src/store/seed.ts.
-- Run with:  psql "$DATABASE_URL" -f backend/migrations/001_init.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (mirror the TypeScript unions in src/types/task.ts)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE project_id    AS ENUM ('AML', 'EKYC', 'DPDP', 'WEB');
  CREATE TYPE task_status   AS ENUM ('todo', 'in_progress', 'in_review', 'done');   -- New / Testing / Deploying / Completed
  CREATE TYPE task_priority AS ENUM ('highest', 'high', 'medium', 'low', 'lowest');
  CREATE TYPE issue_type    AS ENUM ('task', 'bug', 'story', 'epic', 'subtask');
  CREATE TYPE link_type     AS ENUM ('blocks', 'is_blocked_by', 'relates_to');
  CREATE TYPE user_role     AS ENUM ('nyneos', 'bmc');   -- the two credential sets
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- user_data: login credentials + profile (NyneOS and BMC accounts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_data (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT        NOT NULL UNIQUE,
  name           TEXT        NOT NULL,
  initials       TEXT        NOT NULL,
  email          TEXT        UNIQUE,
  role           user_role   NOT NULL,
  password_hash  TEXT,                       -- bcrypt; set by the backend, never store plaintext
  can_manage_board BOOLEAN   NOT NULL DEFAULT TRUE,   -- BMC users get FALSE (kanban board hidden)
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- projects: AML / EKYC / DPDP / Website ("WEB")
-- Feeds the Project Summary Bar (dates, % completion, alert)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          project_id  PRIMARY KEY,
  name        TEXT        NOT NULL,           -- display name, e.g. 'Website' for WEB
  color       TEXT        NOT NULL,           -- CSS var token used by the UI
  start_date  DATE,
  end_date    DATE,
  task_counter INTEGER    NOT NULL DEFAULT 0, -- last issued number for AML-1, AML-2 ...
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- tasks: Board cards, My Tasks, Timeline bars, Progress and Overview widgets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT          NOT NULL UNIQUE,            -- e.g. AML-3
  project       project_id    NOT NULL REFERENCES projects(id),
  type          issue_type    NOT NULL DEFAULT 'task',
  summary       TEXT          NOT NULL,
  description   TEXT          NOT NULL DEFAULT '',
  status        task_status   NOT NULL DEFAULT 'todo',
  priority      task_priority NOT NULL DEFAULT 'medium',
  position      INTEGER       NOT NULL DEFAULT 0,         -- "order" within a board column
  assignee_id   UUID REFERENCES user_data(id) ON DELETE SET NULL,
  reporter_id   UUID REFERENCES user_data(id) ON DELETE SET NULL,
  start_date    DATE,
  due_date      DATE,
  estimate      TEXT,
  story_points  INTEGER,
  sprint        TEXT          NOT NULL DEFAULT '',
  labels        TEXT[]        NOT NULL DEFAULT '{}',
  components    TEXT[]        NOT NULL DEFAULT '{}',
  fix_version   TEXT          NOT NULL DEFAULT '',
  parent_key    TEXT REFERENCES tasks(key) ON DELETE SET NULL,
  source        TEXT          NOT NULL DEFAULT 'dashboard', -- 'dashboard' | 'deepika' (updates imported from Deepika ma'am)
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks (project, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date       ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee       ON tasks (assignee_id);

CREATE TABLE IF NOT EXISTS task_links (
  task_id    UUID      NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type       link_type NOT NULL,
  target_key TEXT      NOT NULL REFERENCES tasks(key) ON DELETE CASCADE,
  PRIMARY KEY (task_id, type, target_key)
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  size       BIGINT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity / comments shown in the task details popup
CREATE TABLE IF NOT EXISTS task_activity (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES user_data(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL DEFAULT 'comment',   -- comment | status_change | update
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity (task_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- project_alerts: clickable ALERT on each Project Summary Bar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project     project_id NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  message     TEXT       NOT NULL,
  severity    TEXT       NOT NULL DEFAULT 'warning',   -- info | warning | critical
  resolved    BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_alerts_open ON project_alerts (project) WHERE NOT resolved;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['user_data', 'projects', 'tasks'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Seed data (from the dashboard screenshots)
-- ---------------------------------------------------------------------------
INSERT INTO user_data (username, name, initials, email, role, can_manage_board) VALUES
  ('nyneos', 'NyneOS Admin', 'NO', NULL, 'nyneos', TRUE),
  ('bmc',    'BMC User',     'BM', NULL, 'bmc',    FALSE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO projects (id, name, color, task_counter) VALUES
  ('AML',  'AML',     'var(--aml)',  4),
  ('EKYC', 'EKYC',    'var(--ekyc)', 2),
  ('DPDP', 'DPDP',    'var(--dpdp)', 2),
  ('WEB',  'Website', 'var(--web)',  2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (key, project, summary, description, status, priority, position, due_date) VALUES
  ('AML-3',  'AML',  '12323',                           '', 'in_progress', 'medium',  0, '2026-10-08'),
  ('AML-4',  'AML',  'dfa',                             '', 'in_progress', 'medium',  2, '2026-10-17'),
  ('EKYC-2', 'EKYC', 'Improve PAN validation errors',   'Coordinate delivery, review evidence and record the final outcome for the project team.', 'in_progress', 'highest', 1, '2026-10-08'),
  ('DPDP-1', 'DPDP', 'Automate adverse media screening','Coordinate delivery, review evidence and record the final outcome for the project team.', 'in_review',   'medium',  0, '2026-10-02'),
  ('DPDP-2', 'DPDP', 'Audit video KYC recordings',      'Coordinate delivery, review evidence and record the final outcome for the project team.', 'in_review',   'high',    1, '2026-10-10'),
  ('WEB-1',  'WEB',  'Reconcile transaction exceptions','', 'done', 'medium', 0, '2026-10-04'),
  ('WEB-2',  'WEB',  'Add assisted KYC workflow',       '', 'done', 'medium', 1, '2026-10-12')
ON CONFLICT (key) DO NOTHING;

UPDATE tasks SET completed_at = now() WHERE status = 'done' AND completed_at IS NULL;

COMMIT;
