package app

import (
	"encoding/json"
	"net/http"
	"time"
)

type alert struct {
	ID       string  `json:"id"`
	Message  string  `json:"message"`
	Severity string  `json:"severity"`
	TaskKey  *string `json:"taskKey"`
}

type projectOut struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	StartDate *string `json:"startDate"`
	EndDate   *string `json:"endDate"`
	Alerts    []alert `json:"alerts"`
}

// listProjects returns each project with its explicit date range and open manual
// alerts. Task-derived dates and overdue alerts are computed client side from live tasks.
func (s *server) listProjects(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := s.db.Query(ctx, `
		SELECT id::text, name, to_char(start_date, 'YYYY-MM-DD'), to_char(end_date, 'YYYY-MM-DD')
		FROM projects
		ORDER BY array_position(ARRAY['AML','EKYC','DPDP','WEB'], id::text)`)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []projectOut{}
	idx := map[string]int{}
	for rows.Next() {
		var p projectOut
		if err := rows.Scan(&p.ID, &p.Name, &p.StartDate, &p.EndDate); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		p.Alerts = []alert{}
		idx[p.ID] = len(out)
		out = append(out, p)
	}
	rows.Close()
	ar, err := s.db.Query(ctx, `
		SELECT a.id::text, a.project::text, a.message, a.severity, t.key
		FROM project_alerts a LEFT JOIN tasks t ON t.id = a.task_id
		WHERE NOT a.resolved AND (t.id IS NULL OR t.client_visible OR $1) ORDER BY a.created_at DESC`, currentUser(r).Role == "nyneos")
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer ar.Close()
	for ar.Next() {
		var pid string
		var a alert
		if ar.Scan(&a.ID, &pid, &a.Message, &a.Severity, &a.TaskKey) == nil {
			if i, ok := idx[pid]; ok {
				out[i].Alerts = append(out[i].Alerts, a)
			}
		}
	}
	writeJSON(w, 200, out)
}

// updateProject sets the explicit date range shown on a project's summary bar.
// An empty string clears a date so the UI falls back to task-derived dates.
func (s *server) updateProject(w http.ResponseWriter, r *http.Request) {
	var in struct {
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		writeErr(w, 400, "invalid body")
		return
	}
	for _, d := range []string{in.StartDate, in.EndDate} {
		if d != "" {
			if _, err := time.Parse("2006-01-02", d); err != nil {
				writeErr(w, 400, "dates must be YYYY-MM-DD")
				return
			}
		}
	}
	if in.StartDate != "" && in.EndDate != "" && in.EndDate < in.StartDate {
		writeErr(w, 400, "end date must be on or after start date")
		return
	}
	tag, err := s.db.Exec(r.Context(),
		`UPDATE projects SET start_date=$1::date, end_date=$2::date WHERE id::text=$3`,
		nullable(&in.StartDate), nullable(&in.EndDate), r.PathValue("id"))
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "project not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
