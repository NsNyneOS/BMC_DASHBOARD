package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

var (
	codeRe = regexp.MustCompile(`^[A-Z][A-Z0-9]{1,9}$`)
	uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

// need wraps a handler so it only runs for a signed-in user holding the permission.
func (s *server) need(perm string, next http.HandlerFunc) http.HandlerFunc {
	return s.auth(func(w http.ResponseWriter, r *http.Request) {
		if !currentUser(r).can(perm) {
			writeErr(w, http.StatusForbidden, "you do not have permission to do this ("+perm+")")
			return
		}
		next(w, r)
	})
}

// needAny is need for several acceptable permissions.
func (s *server) needAny(next http.HandlerFunc, perms ...string) http.HandlerFunc {
	return s.auth(func(w http.ResponseWriter, r *http.Request) {
		u := currentUser(r)
		for _, p := range perms {
			if u.can(p) {
				next(w, r)
				return
			}
		}
		writeErr(w, http.StatusForbidden, "you do not have permission to do this")
	})
}

func readJSON(r *http.Request, v any) bool { return json.NewDecoder(r.Body).Decode(v) == nil }

// projectScope returns an SQL predicate over project_master (alias pm) joined to customer_master (alias c)
// that limits rows to the projects u may see, and its positional args numbered from base+1.
//   - external users: only their own customer, never internal-only projects, narrowed by user_project_access
//   - internal users: every customer (or one, via customerCode, or the owner's internal projects); internal-only projects need project.internal.view
func projectScope(u *user, customerCode string, base int) (string, []any) {
	if !u.internal() {
		cid := ""
		if u.CustomerID != nil {
			cid = *u.CustomerID
		}
		return fmt.Sprintf(`pm.customer_id = $%[1]d::uuid AND NOT pm.internal_only AND (
			NOT EXISTS (SELECT 1 FROM user_project_access x WHERE x.user_id = $%[2]d::uuid)
			OR EXISTS (SELECT 1 FROM user_project_access x WHERE x.user_id = $%[2]d::uuid AND x.project_id = pm.id))`, base+1, base+2),
			[]any{cid, u.ID}
	}
	// "ALL" is the combined view of the customers NyneOS serves: the owner's own (internal) projects are not mixed in,
	// and neither is anything belonging to an inactive customer (it stays reachable on the Customers / Projects pages and
	// through that customer's own dashboard, so it can be reactivated).
	// "" means no filter at all (permission lookups); a code selects that customer, or the owner's internal projects.
	cond, args := "TRUE", []any{}
	switch cc := strings.ToUpper(strings.TrimSpace(customerCode)); {
	case cc == "ALL":
		cond = "c.customer_type = 'client' AND c.status = 'active'"
	case cc != "":
		args = append(args, cc)
		cond = fmt.Sprintf("c.code = $%d", base+len(args))
	}
	if !u.can("project.internal.view") {
		cond += " AND NOT pm.internal_only"
	}
	return cond, args
}

// taskScope returns a predicate over tasks (alias t) for the rows u may see, with args numbered from base+1.
func taskScope(u *user, customerCode string, base int) (string, []any) {
	cond, args := projectScope(u, customerCode, base)
	q := `EXISTS (SELECT 1 FROM project_master pm JOIN customer_master c ON c.id = pm.customer_id WHERE pm.code = t.project AND ` + cond + `)`
	if !u.internal() {
		q += " AND t.client_visible"
	}
	return q, args
}
func itoa(n int) string { return strconv.Itoa(n) }
