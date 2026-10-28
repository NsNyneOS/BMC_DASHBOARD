package app

import (
	"net/http"
	"strings"
	"time"
)

type milestoneOut struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Summary      string `json:"summary"`
	Date         string `json:"date"`
	CustomerID   string `json:"customerId"`
	CustomerCode string `json:"customerCode"`
	CustomerName string `json:"customerName"`
	ProjectCode  string `json:"projectCode"` // "" = the whole customer
	ProjectName  string `json:"projectName"`
}

const milestoneSelect = `SELECT m.id::text, m.title, m.summary, to_char(m.milestone_date, 'YYYY-MM-DD'),
       c.id::text, c.code, c.name, coalesce(pm.code,''), coalesce(pm.name,'')
FROM milestones m JOIN customer_master c ON c.id = m.customer_id LEFT JOIN project_master pm ON pm.id = m.project_id`

type milestoneInput struct {
	Title       *string `json:"title"`
	Summary     *string `json:"summary"`
	Date        *string `json:"date"`
	CustomerID  *string `json:"customerId"`
	ProjectCode *string `json:"projectCode"` // optional: "" clears it
}

// listMilestones: customer users see their own customer's milestones; internal users see every customer's,
// or one customer's with ?customer=CODE ("ALL" and "" mean every active customer).
func (s *server) listMilestones(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	where, args := "TRUE", []any{}
	if !u.internal() {
		cid := ""
		if u.CustomerID != nil {
			cid = *u.CustomerID
		}
		where, args = "m.customer_id = $1::uuid", []any{cid}
	} else if cc := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("customer"))); cc != "" && cc != "ALL" {
		where, args = "c.code = $1", []any{cc}
	} else {
		where = "(c.customer_type = 'client' AND c.status = 'active') OR c.customer_type = 'internal'"
	}
	rows, err := s.db.Query(r.Context(), milestoneSelect+" WHERE "+where+" ORDER BY m.milestone_date, m.created_at", args...)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []milestoneOut{}
	for rows.Next() {
		var m milestoneOut
		if err := rows.Scan(&m.ID, &m.Title, &m.Summary, &m.Date, &m.CustomerID, &m.CustomerCode, &m.CustomerName, &m.ProjectCode, &m.ProjectName); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		out = append(out, m)
	}
	writeJSON(w, 200, out)
}

func (s *server) respondMilestone(w http.ResponseWriter, r *http.Request, id string, code int) {
	var m milestoneOut
	err := s.db.QueryRow(r.Context(), milestoneSelect+" WHERE m.id = $1::uuid", id).
		Scan(&m.ID, &m.Title, &m.Summary, &m.Date, &m.CustomerID, &m.CustomerCode, &m.CustomerName, &m.ProjectCode, &m.ProjectName)
	if err != nil {
		writeErr(w, 404, "milestone not found")
		return
	}
	writeJSON(w, code, m)
}

func (s *server) createMilestone(w http.ResponseWriter, r *http.Request) {
	var in milestoneInput
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid request")
		return
	}
	title := strings.TrimSpace(deref(in.Title))
	if title == "" {
		writeErr(w, 400, "title is required")
		return
	}
	if in.Date == nil || *in.Date == "" || !validDate(*in.Date) {
		writeErr(w, 400, "a valid date is required")
		return
	}
	if *in.Date < time.Now().Format("2006-01-02") {
		writeErr(w, 400, "the date cannot be in the past")
		return
	}
	if in.CustomerID == nil || *in.CustomerID == "" {
		writeErr(w, 400, "customer is required")
		return
	}
	// The project is optional, but when given it must be one of this customer's projects.
	var projectID any
	if pc := strings.ToUpper(strings.TrimSpace(deref(in.ProjectCode))); pc != "" {
		var pid string
		if s.db.QueryRow(r.Context(), `SELECT id::text FROM project_master WHERE code = $1 AND customer_id = $2::uuid`, pc, *in.CustomerID).Scan(&pid) != nil {
			writeErr(w, 400, "that project does not belong to the chosen customer")
			return
		}
		projectID = pid
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO milestones (customer_id, title, summary, milestone_date, created_by, project_id)
		SELECT c.id, $2, $3, $4::date, $5::uuid, $6::uuid FROM customer_master c WHERE c.id = $1::uuid 
		RETURNING id::text`, *in.CustomerID, title, strings.TrimSpace(deref(in.Summary)), *in.Date, currentUser(r).ID, projectID).Scan(&id)
	if err != nil {
		writeErr(w, 400, "that customer does not exist")
		return
	}
	s.respondMilestone(w, r, id, 201)
}

func (s *server) updateMilestone(w http.ResponseWriter, r *http.Request) {
	var in milestoneInput
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid request")
		return
	}
	sets, args := []string{"updated_at = now()"}, []any{}
	add := func(col, cast string, v any) {
		args = append(args, v)
		sets = append(sets, col+" = $"+itoa(len(args))+cast)
	}
	if in.Title != nil {
		if strings.TrimSpace(*in.Title) == "" {
			writeErr(w, 400, "title is required")
			return
		}
		add("title", "", strings.TrimSpace(*in.Title))
	}
	if in.Summary != nil {
		add("summary", "", strings.TrimSpace(*in.Summary))
	}
	if in.Date != nil {
		if *in.Date == "" || !validDate(*in.Date) {
			writeErr(w, 400, "a valid date is required")
			return
		}
		// A milestone already in the past may keep its date; a new date cannot be in the past.
		var same bool
		_ = s.db.QueryRow(r.Context(), `SELECT milestone_date = $2::date FROM milestones WHERE id = $1::uuid`, r.PathValue("id"), *in.Date).Scan(&same)
		if !same && *in.Date < time.Now().Format("2006-01-02") {
			writeErr(w, 400, "the date cannot be in the past")
			return
		}
		add("milestone_date", "::date", *in.Date)
	}
	if in.CustomerID != nil {
		add("customer_id", "::uuid", *in.CustomerID)
	}
	if in.ProjectCode != nil {
		pc := strings.ToUpper(strings.TrimSpace(*in.ProjectCode))
		if pc == "" {
			sets = append(sets, "project_id = NULL")
		} else {
			// Must belong to the milestone's (possibly new) customer.
			var pid string
			if s.db.QueryRow(r.Context(), `SELECT pm.id::text FROM project_master pm JOIN milestones m ON m.id = $2::uuid
				WHERE pm.code = $1 AND pm.customer_id = coalesce($3::uuid, m.customer_id)`, pc, r.PathValue("id"), nullable(in.CustomerID)).Scan(&pid) != nil {
				writeErr(w, 400, "that project does not belong to the chosen customer")
				return
			}
			add("project_id", "::uuid", pid)
		}
	}
	args = append(args, r.PathValue("id"))
	tag, err := s.db.Exec(r.Context(), "UPDATE milestones SET "+strings.Join(sets, ", ")+" WHERE id = $"+itoa(len(args))+"::uuid", args...)
	if err != nil {
		writeErr(w, 400, "could not update the milestone")
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, 404, "milestone not found")
		return
	}
	s.respondMilestone(w, r, r.PathValue("id"), 200)
}

func (s *server) deleteMilestone(w http.ResponseWriter, r *http.Request) {
	tag, err := s.db.Exec(r.Context(), `DELETE FROM milestones WHERE id = $1::uuid`, r.PathValue("id"))
	if err != nil || tag.RowsAffected() == 0 {
		writeErr(w, 404, "milestone not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
