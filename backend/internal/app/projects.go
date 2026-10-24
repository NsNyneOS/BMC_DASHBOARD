package app

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
)

type alert struct {
	ID       string  `json:"id"`
	Message  string  `json:"message"`
	Severity string  `json:"severity"`
	TaskKey  *string `json:"taskKey"`
}

// projectOut is a project_master row as the UI sees it. ID is the project code (the task-key prefix).
type projectOut struct {
	ID           string  `json:"id"`
	UUID         string  `json:"uuid"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Color        string  `json:"color"`
	Status       string  `json:"status"`
	StartDate    *string `json:"startDate"`
	EndDate      *string `json:"endDate"`
	InternalOnly bool    `json:"internalOnly"`
	CustomerID   string  `json:"customerId"`
	CustomerCode string  `json:"customerCode"`
	CustomerName string  `json:"customerName"`
	CustomerType string  `json:"customerType"` // 'client', or 'internal' for the owner's own (NyneOS) projects
	TaskCount    int     `json:"taskCount"`
	Alerts       []alert `json:"alerts"`
}

var palette = []string{"#c95b12", "#c01f3a", "#9b1c31", "#5b4bc4", "#0e7868", "#1f6fd1", "#a15c00", "#b0368a"}

const projectCols = `SELECT pm.id::text, pm.code, pm.name, pm.description, pm.color, pm.status,
       to_char(pm.start_date,'YYYY-MM-DD'), to_char(pm.end_date,'YYYY-MM-DD'), pm.internal_only,
       c.id::text, c.code, c.name, c.customer_type, (SELECT count(*) FROM tasks t WHERE t.project = pm.code)
FROM project_master pm JOIN customer_master c ON c.id = pm.customer_id`

// listProjects returns the projects the caller may see (see projectScope) with their open alerts.
// Task-derived dates and overdue alerts are computed client side from live tasks.
// ?customer=CODE narrows an internal user to one customer.
func (s *server) listProjects(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	cond, args := projectScope(u, r.URL.Query().Get("customer"), 0)
	rows, err := s.db.Query(r.Context(), projectCols+` WHERE `+cond+` ORDER BY c.customer_type, c.name, pm.created_at, pm.code`, args...)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	out := []projectOut{}
	idx := map[string]int{}
	for rows.Next() {
		var p projectOut
		if err := rows.Scan(&p.UUID, &p.ID, &p.Name, &p.Description, &p.Color, &p.Status, &p.StartDate, &p.EndDate,
			&p.InternalOnly, &p.CustomerID, &p.CustomerCode, &p.CustomerName, &p.CustomerType, &p.TaskCount); err != nil {
			rows.Close()
			writeErr(w, 500, err.Error())
			return
		}
		p.Alerts = []alert{}
		idx[p.ID] = len(out)
		out = append(out, p)
	}
	rows.Close()

	hidden := ""
	if !u.internal() {
		hidden = " AND (t.id IS NULL OR t.client_visible)" // alerts on hidden tasks stay hidden from clients
	}
	ar, err := s.db.Query(r.Context(), `
		SELECT a.id::text, a.project, a.message, a.severity, t.key
		FROM project_alerts a
		JOIN project_master pm ON pm.code = a.project
		JOIN customer_master c ON c.id = pm.customer_id
		LEFT JOIN tasks t ON t.id = a.task_id
		WHERE NOT a.resolved AND `+cond+hidden+` ORDER BY a.created_at DESC`, args...)
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

func validDate(d string) bool {
	_, err := time.Parse("2006-01-02", d)
	return d == "" || err == nil
}

var validProjectStatuses = set("active", "on_hold", "completed", "archived")

// createProject adds a project to a customer (project.manage).
func (s *server) createProject(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CustomerID   string  `json:"customerId"`
		Code         string  `json:"code"`
		Name         string  `json:"name"`
		Description  string  `json:"description"`
		Color        string  `json:"color"`
		Status       string  `json:"status"`
		StartDate    *string `json:"startDate"`
		EndDate      *string `json:"endDate"`
		InternalOnly bool    `json:"internalOnly"`
	}
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid body")
		return
	}
	in.Code = strings.ToUpper(strings.TrimSpace(in.Code))
	in.Name = strings.TrimSpace(in.Name)
	if u := currentUser(r); !u.internal() {
		// A customer user can only ever work inside their own customer, and never make internal-only projects.
		if u.CustomerID == nil || in.CustomerID != *u.CustomerID {
			writeErr(w, 403, "you can only create projects for your own customer")
			return
		}
		in.InternalOnly = false
	}
	if in.Code != "" && !codeRe.MatchString(in.Code) {
		writeErr(w, 400, "code must be 2-10 characters: A-Z and 0-9, starting with a letter")
		return
	}
	if in.Name == "" || !uuidRe.MatchString(in.CustomerID) {
		writeErr(w, 400, "customer and name are required")
		return
	}
	if in.Code == "" { // no code given: generate a unique one from the name
		code, err := s.uniqueProjectCode(r.Context(), in.Name)
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		in.Code = code
	}
	// Projects of the owner (NyneOS) are internal by definition and never shown to customers.
	var ctype string
	if s.db.QueryRow(r.Context(), `SELECT customer_type FROM customer_master WHERE id=$1::uuid`, in.CustomerID).Scan(&ctype) != nil {
		writeErr(w, 400, "customer not found")
		return
	}
	if ctype == "internal" {
		in.InternalOnly = true
	}
	if in.Status == "" {
		in.Status = "active"
	}
	if !validProjectStatuses[in.Status] {
		writeErr(w, 400, "invalid status")
		return
	}
	for _, d := range []*string{in.StartDate, in.EndDate} {
		if d != nil && !validDate(*d) {
			writeErr(w, 400, "dates must be YYYY-MM-DD")
			return
		}
	}
	if in.StartDate != nil && in.EndDate != nil && *in.StartDate != "" && *in.EndDate != "" && *in.EndDate < *in.StartDate {
		writeErr(w, 400, "end date must be on or after start date")
		return
	}
	if in.Color = strings.TrimSpace(in.Color); in.Color == "" {
		var n int
		_ = s.db.QueryRow(r.Context(), `SELECT count(*) FROM project_master`).Scan(&n)
		in.Color = palette[n%len(palette)]
	}
	var id string
	err := s.db.QueryRow(r.Context(), `
		INSERT INTO project_master (customer_id, code, name, description, color, status, start_date, end_date, internal_only)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8::date, $9) RETURNING id::text`, // the start date defaults to the creation date,
		in.CustomerID, in.Code, in.Name, in.Description, in.Color, in.Status, nullable(in.StartDate), nullable(in.EndDate), in.InternalOnly).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") {
			writeErr(w, 409, "a project with this code already exists")
			return
		}
		if strings.Contains(err.Error(), "23503") || strings.Contains(err.Error(), "foreign key") {
			writeErr(w, 400, "customer not found")
			return
		}
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, map[string]string{"id": in.Code, "uuid": id})
}

// updateProject edits a project (project.manage). Omitted fields are unchanged; an empty date string
// clears that date so the UI falls back to task-derived dates.
func (s *server) updateProject(w http.ResponseWriter, r *http.Request) {
	if u := currentUser(r); !u.internal() {
		var own bool
		err := s.db.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM project_master WHERE code=$1 AND customer_id=$2::uuid AND NOT internal_only)`,
			strings.ToUpper(r.PathValue("id")), u.CustomerID).Scan(&own)
		if err != nil || !own {
			writeErr(w, 404, "project not found")
			return
		}
	}
	var in struct {
		Name         *string `json:"name"`
		Description  *string `json:"description"`
		Color        *string `json:"color"`
		Status       *string `json:"status"`
		StartDate    *string `json:"startDate"`
		EndDate      *string `json:"endDate"`
		InternalOnly *bool   `json:"internalOnly"`
	}
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid body")
		return
	}
	for _, d := range []*string{in.StartDate, in.EndDate} {
		if d != nil && !validDate(*d) {
			writeErr(w, 400, "dates must be YYYY-MM-DD")
			return
		}
	}
	if in.StartDate != nil && in.EndDate != nil && *in.StartDate != "" && *in.EndDate != "" && *in.EndDate < *in.StartDate {
		writeErr(w, 400, "end date must be on or after start date")
		return
	}
	if in.Name != nil && strings.TrimSpace(*in.Name) == "" {
		writeErr(w, 400, "name is required")
		return
	}
	if in.Status != nil && !validProjectStatuses[*in.Status] {
		writeErr(w, 400, "invalid status")
		return
	}
	sets, args := []string{}, []any{}
	add := func(col, cast string, v any) {
		args = append(args, v)
		sets = append(sets, col+"=$"+itoa(len(args))+cast)
	}
	if in.Name != nil {
		add("name", "", strings.TrimSpace(*in.Name))
	}
	if in.Description != nil {
		add("description", "", *in.Description)
	}
	if in.Color != nil && strings.TrimSpace(*in.Color) != "" {
		add("color", "", strings.TrimSpace(*in.Color))
	}
	if in.Status != nil {
		add("status", "", *in.Status)
	}
	if in.StartDate != nil {
		add("start_date", "::date", nullable(in.StartDate))
	}
	if in.EndDate != nil {
		add("end_date", "::date", nullable(in.EndDate))
	}
	if in.InternalOnly != nil {
		add("internal_only", "", *in.InternalOnly)
	}
	if len(sets) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	args = append(args, strings.ToUpper(r.PathValue("id")))
	tag, err := s.db.Exec(r.Context(), `UPDATE project_master SET `+strings.Join(sets, ", ")+` WHERE code=$`+itoa(len(args)), args...)
	if err != nil {
		if strings.Contains(err.Error(), "23514") || strings.Contains(err.Error(), "check") {
			writeErr(w, 400, "end date must be on or after start date")
			return
		}
		writeErr(w, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "project not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// projectCodeBase derives a task-key prefix from a project name: initials of up to five words ("Loan Origination" ->
// LO), or the first four characters of a single word ("Website" -> WEBS). It is always 2+ characters, starting with a letter.
func projectCodeBase(name string) string {
	words := strings.FieldsFunc(strings.ToUpper(name), func(r rune) bool { return !(r >= 'A' && r <= 'Z' || r >= '0' && r <= '9') })
	base := ""
	if len(words) == 1 {
		base = words[0]
		if len(base) > 4 {
			base = base[:4]
		}
	} else {
		for _, w := range words {
			base += w[:1]
			if len(base) == 5 {
				break
			}
		}
	}
	base = strings.TrimLeft(base, "0123456789")
	for len(base) < 2 {
		base += "P"
	}
	return base
}

// uniqueProjectCode returns projectCodeBase(name), with a number appended when it is taken (LO2, LO3 ...), so every
// project code is unique.
func (s *server) uniqueProjectCode(ctx context.Context, name string) (string, error) {
	return s.uniqueCode(ctx, "project_master", name)
}

// uniqueCode is the generator behind project and customer codes: table is one of the two fixed code-bearing tables.
func (s *server) uniqueCode(ctx context.Context, table, name string) (string, error) {
	if table != "project_master" && table != "customer_master" {
		return "", errors.New("unsupported table")
	}
	base := projectCodeBase(name)
	for n := 1; n < 1000; n++ {
		code := base
		if n > 1 {
			suffix := itoa(n)
			if len(base)+len(suffix) > 10 {
				code = base[:10-len(suffix)] + suffix
			} else {
				code = base + suffix
			}
		}
		var taken bool
		if err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM `+table+` WHERE code = $1)`, code).Scan(&taken); err != nil {
			return "", err
		}
		if !taken {
			return code, nil
		}
	}
	return "", errors.New("could not generate a code")
}
