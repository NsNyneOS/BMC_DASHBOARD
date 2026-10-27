package app

import (
	"context"
	"log"
)

// checkSchema logs a warning at startup when the database is missing something this version of the code needs
// (a migration was not run), so the cause is obvious in the server log instead of surfacing later as a user error.
func (s *server) checkSchema(ctx context.Context) {
	checks := []struct{ what, sql string }{
		{"task_status value 'rework' (migration 020)", `SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'task_status' AND e.enumlabel = 'rework')`},
		{"tasks.client_visible (migration 007)", `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'client_visible')`},
		{"audit_log table (migration 019)", `SELECT to_regclass('audit_log') IS NOT NULL`},
		{"permission alltasks.view (migration 022)", `SELECT EXISTS (SELECT 1 FROM uam_permissions WHERE code = 'alltasks.view')`},
	}
	for _, c := range checks {
		var ok bool
		if err := s.db.QueryRow(ctx, c.sql).Scan(&ok); err != nil || !ok {
			log.Printf("WARNING: database is missing %s - run the pending migrations in backend/migrations", c.what)
		}
	}
}
