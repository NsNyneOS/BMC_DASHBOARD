# Multi-customer Project Dashboard — implementation plan

> **Status: implemented.** One migration (`backend/migrations/011_multi_customer.sql`), the backend (`customers.go`,
> `uam.go`, `authz.go`, scoped `tasks.go` / `projects.go`) and the frontend (sidebar, Customers / Projects /
> Users & Access / Roles & Permissions pages, permission-based UI) are in place.
> The old `projects` table and `project_id` enum are **kept** (frozen legacy copy); `project_master` is the live table.
> Deploy order: back up → run 011 → deploy backend + frontend together (tasks.project is now a text FK).
> Backend env: `DB_SSLMODE` (default `require`; use `disable` for a local Postgres).
> The sections below are the original plan; where it says 012 / dropping `projects`, the single 011 file replaces it.

Goal: the dashboard stops being "the BMC bank dashboard" and becomes a product that any customer can be
configured on, with NyneOS staff (internal) managing many customers and each customer's staff (external)
seeing only their own.

## 1. Target model

```
customer_master 1 ──< project_master 1 ──< tasks / project_alerts
       │
       └──< user_data (external users only)      user_data >── roles >──< permissions
                                                  (internal users have customer_id = NULL)
```

| Table | What it holds |
|---|---|
| `customer_master` | One row per customer. NyneOS itself is the single `internal` customer (owns the CRM project). |
| `project_master` | A customer's projects. `code` is globally unique and is the task-key prefix (`AML-3`). Replaces the hard-coded project enum. |
| `roles`, `permissions`, `role_permissions` | UAM. Each role is `internal` or `external`. |
| `user_data` (+3 columns) | `user_type` (internal/external), `role_id`, `customer_id`. |
| `user_project_access` | Optional: narrows an external user to specific projects. |

Rules that fall out of this:
- **Internal user** (NyneOS): `customer_id` is NULL, sees every customer, switches between them.
- **External user** (client): belongs to exactly one customer; sees only that customer's projects, and never `internal_only` projects or tasks marked *not visible*.
- Authorisation is by **permission code** (`task.create`, `board.manage`, …), not by comparing role names.

Decisions I made (change them before step 3 if wrong):
1. An external user belongs to **one** customer.
2. Task keys stay globally unique because project codes are globally unique — no change to the key/dependency logic.
3. Existing `nyneos` login → role `NYNEOS_ADMIN`; `bmc` and `kycteam` → external users of customer BMC with role `CUSTOMER_VIEWER`. Behaviour for current users does not change.

## 2. Phases

### Phase 1 — Database (done as files, not yet applied)
- `011_multi_customer_expand.sql`: additive and backward compatible. Creates the new tables, seeds customers `NYNEOS` and `BMC`, copies the 5 projects into `project_master`, seeds 18 permissions and 4 roles, back-fills every user. **The current backend keeps working after this.**
- `012_multi_customer_cutover.sql`: not backward compatible. Drops `projects` and the `project_id` enum, makes `tasks.project` / `project_alerts.project` TEXT foreign keys to `project_master.code`. **Run only with the Phase 2 release.**

### Phase 2 — Backend (Go)
1. **Auth context**: load `userType`, `customerId`, role and the permission set into the cached user; return them from `/api/auth/login` and `/me`.
2. **Authorisation helpers**: `requirePermission("task.create")` middleware, and `visibleProjects(user)` which returns the project codes the user may see (internal: all; external: own customer, minus `internal_only`, narrowed by `user_project_access`).
3. **Replace every `Role != "nyneos"` check** (≈10 places in `tasks.go`, `projects.go`) with a permission check; replace `validProjects` with a lookup in `project_master`; replace the `'CRM'` special case with `visibleProjects`.
4. **Queries**: `projects` → `project_master`; drop the `::project_id` casts; task listing filters by `visibleProjects` plus `client_visible` for external users; key generation uses `project_master.task_counter`.
5. **New endpoints** (all permission-guarded): `/api/customers` (CRUD), `/api/projects` (create/update/archive), `/api/users` (CRUD, assign role/customer), `/api/roles`, `/api/permissions`.
6. Backend tests for the scoping rules (external user can never read another customer's tasks).

### Phase 3 — Frontend
1. **Sidebar, internal users only** (collapsible; becomes a slide-in drawer on phones, using the responsive work already in `global.css`):
   Dashboard · Customers · Projects · Users & Access · Roles & Permissions.
   External users keep today's layout with no sidebar.
2. **Customer switcher** at the top of the sidebar for internal users; the dashboard, board and calendar load for the selected customer (or "All customers").
3. **Dynamic projects**: `ProjectId` becomes `string`; remove the hard-coded `projects` arrays, `projectName()` and `--aml/--ekyc/...` colour tokens — colour comes from `project_master.color` (with a generated palette fallback for new projects).
4. **Per-customer branding**: header, login and footer show `customer_master.logo_url`/name instead of the bundled BMC logo; NyneOS logo stays as "powered by".
5. **Permission-based UI**: replace `role === 'bmc'` / `canManageBoard` checks with `can('board.manage')`-style checks fed from the login response.
6. **New screens**: Customers (list, create/edit, project count), Projects (per customer, dates, colour, internal-only toggle), Users (type, role, customer, active), Roles (permission matrix).

### Phase 4 — Rollout
1. Back up the database; apply 011 (safe, can be done any time).
2. Deploy backend + frontend together with 012.
3. Smoke test with one internal and one external login: external cannot see CRM, hidden tasks, or another customer.
4. Add a second (test) customer with one project to prove the multi-customer path end to end.
5. Later clean-up: drop `user_data.role` and `can_manage_board` once nothing reads them.

## 3. Access rules (default role set)

| Permission | NYNEOS_ADMIN | NYNEOS_MEMBER | CUSTOMER_ADMIN | CUSTOMER_VIEWER |
|---|:-:|:-:|:-:|:-:|
| dashboard / calendar / alerts view | ✔ | ✔ | ✔ | ✔ |
| board view / manage | ✔ | ✔ | – | – |
| task create / edit | ✔ | ✔ | ✔ | – |
| task delete, dependencies, visibility, team | ✔ | ✔ | – | – |
| project manage, internal projects | ✔ | ✔ | – | – |
| customer / user / role manage | ✔ | – | – | – |

## 4. Risks

- **Cutover is the risky step** (012 changes column types); it must ship with the backend and be rehearsed on a copy of the database.
- Every endpoint that returns tasks must go through the same scoping helper — one missed query leaks another customer's data. Hence the dedicated tests in Phase 2.
- The frontend has project names hard-coded in many places (`App.tsx`, `TaskModal.tsx`, the store, CSS tokens); budget time to find them all.

## 5. Open questions

1. Can one external user ever need access to **two** customers? (Today: no.)
2. Should internal users be restrictable to certain customers (the `user_project_access` table already supports it for projects)?
3. Does each customer need its own login page/branding URL, or one shared login?
4. Is self-service user management for a customer's admin (`CUSTOMER_ADMIN`) wanted, or NyneOS-only?

## 6. Suggested order of work

Phase 2 steps 1–4 (backend scoping, no UI change) → Phase 3 steps 3–5 (dynamic projects, permission-based UI) →
Phase 2 step 5 + Phase 3 steps 1, 2, 6 (new endpoints, sidebar and management screens) → Phase 4.
