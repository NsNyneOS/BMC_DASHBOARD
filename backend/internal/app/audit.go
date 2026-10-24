package app

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

// statusRecorder remembers the response status so a change is logged only when it succeeded.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (w *statusRecorder) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// auditBody keeps the request body as the "what changed" detail, with every password field removed.
func auditBody(raw []byte) json.RawMessage {
	var m map[string]any
	if len(raw) == 0 || len(raw) > 64<<10 || json.Unmarshal(raw, &m) != nil {
		return json.RawMessage("{}")
	}
	for k := range m {
		if strings.Contains(strings.ToLower(k), "password") {
			delete(m, k)
		}
	}
	out, _ := json.Marshal(m)
	return out
}

// record writes one audit row for a successful create / update / delete.
func (s *server) record(u *user, r *http.Request, raw []byte, label string) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/"), "/"), "/")
	entity, id := parts[0], ""
	if len(parts) > 1 {
		id = parts[1]
	}
	action := map[string]string{http.MethodPost: "create", http.MethodPatch: "update", http.MethodDelete: "delete"}[r.Method]
	if action == "" {
		return
	}
	if label == "" && entity == "tasks" && id != "" {
		_ = s.db.QueryRow(r.Context(), `SELECT key FROM tasks WHERE id=$1::uuid`, id).Scan(&label)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = s.db.Exec(ctx, `INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, label, detail)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)`, u.ID, u.Name, action, entity, id, label, string(auditBody(raw)))
}

// audited runs next and logs the request when it changed something and succeeded.
func (s *server) audited(u *user, next http.HandlerFunc, w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
		next(w, r)
		return
	}
	raw, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	r.Body = io.NopCloser(bytes.NewReader(raw))
	// A deleted task is gone afterwards, so read its key (easier to read than the id) first.
	var label string
	if r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/api/tasks/") {
		_ = s.db.QueryRow(r.Context(), `SELECT key FROM tasks WHERE id=$1::uuid`, r.PathValue("id")).Scan(&label)
	}
	rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
	next(rec, r)
	if rec.status < 300 && !strings.HasSuffix(r.URL.Path, "/change-password") {
		s.record(u, r, raw, label)
	}
}

type auditEntry struct {
	ID        string          `json:"id"`
	UserName  string          `json:"userName"`
	Action    string          `json:"action"`
	Entity    string          `json:"entity"`
	EntityID  string          `json:"entityId"`
	Label     string          `json:"label"`
	Detail    json.RawMessage `json:"detail"`
	CreatedAt time.Time       `json:"createdAt"`
}

func (s *server) listAudit(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `SELECT id::text, user_name, action, entity, entity_id, label, detail::text, created_at
		FROM audit_log ORDER BY created_at DESC LIMIT 1000`)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []auditEntry{}
	for rows.Next() {
		var e auditEntry
		var detail string
		if rows.Scan(&e.ID, &e.UserName, &e.Action, &e.Entity, &e.EntityID, &e.Label, &detail, &e.CreatedAt) == nil {
			e.Detail = json.RawMessage(detail)
			out = append(out, e)
		}
	}
	writeJSON(w, 200, out)
}
