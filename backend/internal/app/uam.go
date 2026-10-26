package app

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var usernameRe = regexp.MustCompile(`^[A-Za-z0-9._-]{3,40}$`)

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

type userOut struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	Name         string    `json:"name"`
	Initials     string    `json:"initials"`
	Email        string    `json:"email"`
	UserType     string    `json:"userType"`
	RoleID       string    `json:"roleId"`
	RoleCode     string    `json:"roleCode"`
	RoleName     string    `json:"roleName"`
	CustomerID   *string   `json:"customerId"`
	CustomerName string    `json:"customerName"`
	IsActive     bool      `json:"isActive"`
	ProjectCodes []string  `json:"projectCodes"`
	CreatedAt    time.Time `json:"createdAt"`
}

const userOutCols = `SELECT u.id::text, u.username, u.name, u.initials, coalesce(u.email,''), u.user_type, r.id::text, r.code, r.name,
       u.customer_id::text, coalesce(c.name,''), u.is_active, u.created_at,
       coalesce((SELECT array_agg(pm.code ORDER BY pm.code) FROM user_project_access x JOIN project_master pm ON pm.id = x.project_id WHERE x.user_id = u.id), '{}')
FROM user_data u JOIN uam_roles r ON r.id = u.role_id LEFT JOIN customer_master c ON c.id = u.customer_id`

func scanUserOut(row interface{ Scan(...any) error }) (userOut, error) {
	var u userOut
	err := row.Scan(&u.ID, &u.Username, &u.Name, &u.Initials, &u.Email, &u.UserType, &u.RoleID, &u.RoleCode, &u.RoleName,
		&u.CustomerID, &u.CustomerName, &u.IsActive, &u.CreatedAt, &u.ProjectCodes)
	if u.ProjectCodes == nil {
		u.ProjectCodes = []string{}
	}
	return u, err
}

func (s *server) listUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), userOutCols+` ORDER BY u.user_type DESC, c.name NULLS FIRST, u.name`)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []userOut{}
	for rows.Next() {
		u, err := scanUserOut(rows)
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		out = append(out, u)
	}
	writeJSON(w, 200, out)
}

func initialsOf(name string) string {
	var b strings.Builder
	for _, p := range strings.Fields(name) {
		if b.Len() >= 2 {
			break
		}
		b.WriteString(strings.ToUpper(string([]rune(p)[:1])))
	}
	if b.Len() == 0 {
		return "?"
	}
	return b.String()
}

// roleType returns the user type ("internal"/"external") of a role, or "" when the role does not exist.
func (s *server) roleType(ctx context.Context, roleID string) string {
	if !uuidRe.MatchString(roleID) {
		return ""
	}
	var t string
	if s.db.QueryRow(ctx, `SELECT user_type FROM uam_roles WHERE id=$1::uuid`, roleID).Scan(&t) != nil {
		return ""
	}
	return t
}

func (s *server) setProjectAccess(ctx context.Context, userID string, customerID *string, codes []string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM user_project_access WHERE user_id=$1::uuid`, userID); err != nil {
		return err
	}
	if customerID == nil || len(codes) == 0 {
		return nil
	}
	_, err := s.db.Exec(ctx, `INSERT INTO user_project_access (user_id, project_id)
		SELECT $1::uuid, pm.id FROM project_master pm WHERE pm.code = ANY($2::text[]) AND pm.customer_id = $3::uuid`, userID, codes, *customerID)
	return err
}

func (s *server) createUser(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username     string   `json:"username"`
		Name         string   `json:"name"`
		Initials     string   `json:"initials"`
		Email        string   `json:"email"`
		Password     string   `json:"password"`
		RoleID       string   `json:"roleId"`
		CustomerID   *string  `json:"customerId"`
		ProjectCodes []string `json:"projectCodes"`
	}
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid body")
		return
	}
	in.Username, in.Name = strings.TrimSpace(in.Username), strings.TrimSpace(in.Name)
	if !usernameRe.MatchString(in.Username) || in.Name == "" {
		writeErr(w, 400, "username (3-40 letters, digits, . _ -) and name are required")
		return
	}
	// No password given: issue the default one and force a change at first sign-in.
	mustChange := in.Password == ""
	if mustChange {
		in.Password = defaultPassword
	}
	if len(in.Password) < 8 {
		writeErr(w, 400, "password must be at least 8 characters")
		return
	}
	utype := s.roleType(r.Context(), in.RoleID)
	if utype == "" {
		writeErr(w, 400, "choose a valid role")
		return
	}
	if msg := s.checkCustomer(r.Context(), utype, in.CustomerID); msg != "" {
		writeErr(w, 400, msg)
		return
	}
	if utype == "internal" {
		in.CustomerID = nil
	}
	if in.Initials = strings.ToUpper(strings.TrimSpace(in.Initials)); in.Initials == "" {
		in.Initials = initialsOf(in.Name)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, 500, "could not hash password")
		return
	}
	var id string
	err = s.db.QueryRow(r.Context(), `
		INSERT INTO user_data (username, name, initials, email, role, user_type, role_id, customer_id, password_hash, can_manage_board, must_change_password)
		VALUES ($1, $2, $3, NULLIF($4,''), $5::user_role, $6, $7::uuid, $8::uuid, $9, TRUE, $10::boolean) RETURNING id::text`,
		in.Username, in.Name, in.Initials, strings.TrimSpace(in.Email), map[string]string{"internal": "nyneos", "external": "bmc"}[utype],
		utype, in.RoleID, in.CustomerID, string(hash), mustChange).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") {
			writeErr(w, 409, "that username or email is already in use")
			return
		}
		writeErr(w, 500, err.Error())
		return
	}
	if err := s.setProjectAccess(r.Context(), id, in.CustomerID, in.ProjectCodes); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	u, err := scanUserOut(s.db.QueryRow(r.Context(), userOutCols+` WHERE u.id=$1::uuid`, id))
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, u)
}

// checkCustomer validates the customer for a user type: external needs an active client customer, internal none.
func (s *server) checkCustomer(ctx context.Context, utype string, customerID *string) string {
	if utype == "internal" {
		return ""
	}
	if customerID == nil || !uuidRe.MatchString(*customerID) {
		return "external users must belong to a customer"
	}
	var ctype string
	if s.db.QueryRow(ctx, `SELECT customer_type FROM customer_master WHERE id=$1::uuid`, *customerID).Scan(&ctype) != nil {
		return "customer not found"
	}
	if ctype != "client" {
		return "external users must belong to a client customer"
	}
	return ""
}

func (s *server) updateUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidRe.MatchString(id) {
		writeErr(w, 404, "user not found")
		return
	}
	var in struct {
		Name          *string   `json:"name"`
		Initials      *string   `json:"initials"`
		Email         *string   `json:"email"`
		Password      *string   `json:"password"`
		RoleID        *string   `json:"roleId"`
		CustomerID    *string   `json:"customerId"`
		IsActive      *bool     `json:"isActive"`
		ProjectCodes  *[]string `json:"projectCodes"`
		ResetPassword *bool     `json:"resetPassword"`
	}
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid body")
		return
	}
	me := currentUser(r)
	var roleID string
	var customerID *string
	var name, initials string
	if err := s.db.QueryRow(r.Context(), `SELECT role_id::text, customer_id::text, name, initials FROM user_data WHERE id=$1::uuid`, id).
		Scan(&roleID, &customerID, &name, &initials); err != nil {
		writeErr(w, 404, "user not found")
		return
	}
	if id == me.ID && ((in.IsActive != nil && !*in.IsActive) || (in.RoleID != nil && *in.RoleID != roleID)) {
		writeErr(w, 400, "you cannot deactivate yourself or change your own role")
		return
	}
	if in.RoleID != nil {
		roleID = *in.RoleID
	}
	if in.CustomerID != nil {
		if *in.CustomerID == "" {
			customerID = nil
		} else {
			customerID = in.CustomerID
		}
	}
	utype := s.roleType(r.Context(), roleID)
	if utype == "" {
		writeErr(w, 400, "choose a valid role")
		return
	}
	if msg := s.checkCustomer(r.Context(), utype, customerID); msg != "" {
		writeErr(w, 400, msg)
		return
	}
	if utype == "internal" {
		customerID = nil
	}
	if in.Name != nil {
		if name = strings.TrimSpace(*in.Name); name == "" {
			writeErr(w, 400, "name is required")
			return
		}
	}
	if in.Initials != nil {
		initials = strings.ToUpper(strings.TrimSpace(*in.Initials))
	}
	if initials == "" {
		initials = initialsOf(name)
	}
	sets := []string{"name=$1", "initials=$2", "role_id=$3::uuid", "user_type=$4", "customer_id=$5::uuid", "role=$6::user_role"}
	args := []any{name, initials, roleID, utype, customerID, map[string]string{"internal": "nyneos", "external": "bmc"}[utype]}
	add := func(col, cast string, v any) {
		args = append(args, v)
		sets = append(sets, col+"=$"+itoa(len(args))+cast)
	}
	if in.Email != nil {
		add("email", "", nullable(in.Email))
	}
	if in.IsActive != nil {
		add("is_active", "", *in.IsActive)
	}
	if in.ResetPassword != nil && *in.ResetPassword {
		def := defaultPassword
		in.Password = &def // back to the default; the user must change it at next sign-in
		add("must_change_password", "", true)
	}
	if in.Password != nil && *in.Password != "" {
		if len(*in.Password) < 8 {
			writeErr(w, 400, "password must be at least 8 characters")
			return
		}
		h, err := bcrypt.GenerateFromPassword([]byte(*in.Password), bcrypt.DefaultCost)
		if err != nil {
			writeErr(w, 500, "could not hash password")
			return
		}
		add("password_hash", "", string(h))
	}
	args = append(args, id)
	if _, err := s.db.Exec(r.Context(), `UPDATE user_data SET `+strings.Join(sets, ", ")+` WHERE id=$`+itoa(len(args))+`::uuid`, args...); err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") {
			writeErr(w, 409, "that email is already in use")
			return
		}
		writeErr(w, 500, err.Error())
		return
	}
	// Project access follows the customer: reset it when the customer changed, or when a new list is sent.
	codes := []string{}
	if in.ProjectCodes != nil {
		codes = *in.ProjectCodes
	}
	if in.ProjectCodes != nil || in.CustomerID != nil || in.RoleID != nil {
		if err := s.setProjectAccess(r.Context(), id, customerID, codes); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
	}
	clearUserCache()
	u, err := scanUserOut(s.db.QueryRow(r.Context(), userOutCols+` WHERE u.id=$1::uuid`, id))
	if err != nil {
		writeErr(w, 404, "user not found")
		return
	}
	writeJSON(w, 200, u)
}

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

type roleOut struct {
	ID          string   `json:"id"`
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	UserType    string   `json:"userType"`
	IsSystem    bool     `json:"isSystem"`
	UserCount   int      `json:"userCount"`
	Permissions []string `json:"permissions"`
}

const roleCols = `SELECT r.id::text, r.code, r.name, r.description, r.user_type, r.is_system,
       (SELECT count(*) FROM user_data u WHERE u.role_id = r.id),
       coalesce((SELECT array_agg(p.code ORDER BY p.code) FROM uam_role_permissions rp JOIN uam_permissions p ON p.id = rp.permission_id WHERE rp.role_id = r.id), '{}')
FROM uam_roles r`

func scanRole(row interface{ Scan(...any) error }) (roleOut, error) {
	var r roleOut
	err := row.Scan(&r.ID, &r.Code, &r.Name, &r.Description, &r.UserType, &r.IsSystem, &r.UserCount, &r.Permissions)
	if r.Permissions == nil {
		r.Permissions = []string{}
	}
	return r, err
}

func (s *server) listRoles(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), roleCols+` ORDER BY r.user_type DESC, r.is_system DESC, r.name`)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := []roleOut{}
	for rows.Next() {
		ro, err := scanRole(rows)
		if err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		out = append(out, ro)
	}
	writeJSON(w, 200, out)
}

func (s *server) listPermissions(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `SELECT code, module, name FROM uam_permissions ORDER BY module, code`)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	type perm struct {
		Code   string `json:"code"`
		Module string `json:"module"`
		Name   string `json:"name"`
	}
	out := []perm{}
	for rows.Next() {
		var p perm
		if rows.Scan(&p.Code, &p.Module, &p.Name) == nil {
			out = append(out, p)
		}
	}
	writeJSON(w, 200, out)
}

// setRolePermissions replaces a role's permission set; every code must exist.
// Customer (external) roles may only ever hold Board, Project and Task permissions, plus the always-on dashboard
// views. Customer, user and role management, and internal-only project access, are NyneOS-only.
var externalAllowed = set(
	"dashboard.view", "calendar.view", "alerts.view", "today.view",
	"board.view", "board.manage",
	"project.manage",
	"task.create", "task.edit", "task.delete", "task.assign", "task.dependencies.edit", "task.visibility.manage", "task.team.manage",
)

var externalBase = []string{"dashboard.view", "calendar.view", "alerts.view"}

// externalPermissions validates a customer role's permission set and adds the always-on dashboard views.
// It returns the final list, or the first code that is not allowed for external roles.
func externalPermissions(codes []string) (final []string, bad string) {
	seen := map[string]bool{}
	for _, c := range append(append([]string{}, externalBase...), codes...) {
		if !externalAllowed[c] {
			return nil, c
		}
		if !seen[c] {
			seen[c] = true
			final = append(final, c)
		}
	}
	return final, ""
}

func (s *server) setRolePermissions(ctx context.Context, roleID string, codes []string) string {
	var utype string
	if err := s.db.QueryRow(ctx, `SELECT user_type FROM uam_roles WHERE id=$1::uuid`, roleID).Scan(&utype); err != nil {
		return "role not found"
	}
	if utype == "external" {
		final, bad := externalPermissions(codes)
		if bad != "" {
			return "customer roles cannot have the permission " + bad
		}
		codes = final
	}
	var known int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM uam_permissions WHERE code = ANY($1::text[])`, codes).Scan(&known); err != nil {
		return err.Error()
	}
	distinct := map[string]bool{}
	for _, c := range codes {
		distinct[c] = true
	}
	if known != len(distinct) {
		return "unknown permission"
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err.Error()
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM uam_role_permissions WHERE role_id=$1::uuid`, roleID); err != nil {
		return err.Error()
	}
	if len(codes) > 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO uam_role_permissions (role_id, permission_id)
			SELECT $1::uuid, id FROM uam_permissions WHERE code = ANY($2::text[])`, roleID, codes); err != nil {
			return err.Error()
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return err.Error()
	}
	clearUserCache()
	return ""
}

var nonCode = regexp.MustCompile(`[^A-Z0-9]+`)

func (s *server) createRole(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		UserType    string   `json:"userType"`
		Permissions []string `json:"permissions"`
	}
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid body")
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || (in.UserType != "internal" && in.UserType != "external") {
		writeErr(w, 400, "name and user type (internal / external) are required")
		return
	}
	code := strings.Trim(nonCode.ReplaceAllString(strings.ToUpper(in.Name), "_"), "_")
	if code == "" {
		writeErr(w, 400, "name must contain letters or digits")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO uam_roles (code, name, description, user_type) VALUES ($1,$2,$3,$4) RETURNING id::text`,
		code, in.Name, in.Description, in.UserType).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") {
			writeErr(w, 409, "a role with this name already exists")
			return
		}
		writeErr(w, 500, err.Error())
		return
	}
	if msg := s.setRolePermissions(r.Context(), id, in.Permissions); msg != "" {
		_, _ = s.db.Exec(r.Context(), `DELETE FROM uam_roles WHERE id=$1::uuid`, id)
		writeErr(w, 400, msg)
		return
	}
	ro, err := scanRole(s.db.QueryRow(r.Context(), roleCols+` WHERE r.id=$1::uuid`, id))
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, ro)
}

func (s *server) updateRole(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidRe.MatchString(id) {
		writeErr(w, 404, "role not found")
		return
	}
	var in struct {
		Name        *string   `json:"name"`
		Description *string   `json:"description"`
		Permissions *[]string `json:"permissions"`
	}
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid body")
		return
	}
	var code string
	if s.db.QueryRow(r.Context(), `SELECT code FROM uam_roles WHERE id=$1::uuid`, id).Scan(&code) != nil {
		writeErr(w, 404, "role not found")
		return
	}
	if code == "NYNEOS_ADMIN" && in.Permissions != nil {
		writeErr(w, 400, "the NyneOS Admin role always keeps every permission")
		return
	}
	if in.Name != nil {
		if strings.TrimSpace(*in.Name) == "" {
			writeErr(w, 400, "name is required")
			return
		}
		if _, err := s.db.Exec(r.Context(), `UPDATE uam_roles SET name=$1 WHERE id=$2::uuid`, strings.TrimSpace(*in.Name), id); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
	}
	if in.Description != nil {
		if _, err := s.db.Exec(r.Context(), `UPDATE uam_roles SET description=$1 WHERE id=$2::uuid`, *in.Description, id); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
	}
	if in.Permissions != nil {
		if msg := s.setRolePermissions(r.Context(), id, *in.Permissions); msg != "" {
			writeErr(w, 400, msg)
			return
		}
	}
	clearUserCache()
	ro, err := scanRole(s.db.QueryRow(r.Context(), roleCols+` WHERE r.id=$1::uuid`, id))
	if err != nil {
		writeErr(w, 404, "role not found")
		return
	}
	writeJSON(w, 200, ro)
}

func (s *server) deleteRole(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidRe.MatchString(id) {
		writeErr(w, 404, "role not found")
		return
	}
	ro, err := scanRole(s.db.QueryRow(r.Context(), roleCols+` WHERE r.id=$1::uuid`, id))
	if err != nil {
		writeErr(w, 404, "role not found")
		return
	}
	if ro.IsSystem {
		writeErr(w, 400, "built-in roles cannot be deleted")
		return
	}
	if ro.UserCount > 0 {
		writeErr(w, 400, "reassign the users of this role first")
		return
	}
	if _, err := s.db.Exec(r.Context(), `DELETE FROM uam_roles WHERE id=$1::uuid`, id); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// eligibleAssigneeSQL selects the users who may work on a project: NyneOS staff, plus the project's own customer users
// (respecting any per-user project access). $1 is the project code; callers that are not NyneOS staff only ever see
// customer users, never NyneOS staff.
const eligibleAssigneeSQL = `
FROM user_data u JOIN project_master pm ON pm.code = $1
WHERE u.is_active AND (
  ($2::boolean AND u.user_type = 'internal')
  OR (u.user_type = 'external' AND u.customer_id = pm.customer_id AND (
        NOT EXISTS (SELECT 1 FROM user_project_access x WHERE x.user_id = u.id)
        OR EXISTS (SELECT 1 FROM user_project_access x WHERE x.user_id = u.id AND x.project_id = pm.id))))`

// assigneeEligible reports whether the caller may assign the given user to a task of the project.
func (s *server) assigneeEligible(ctx context.Context, caller *user, userID, project string) bool {
	if !uuidRe.MatchString(userID) {
		return false
	}
	var ok bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 `+eligibleAssigneeSQL+` AND u.id = $3::uuid)`, project, caller.internal(), userID).Scan(&ok)
	return err == nil && ok
}

// listAssignees returns who a task of ?project=CODE can be assigned to (task.assign).
func (s *server) listAssignees(w http.ResponseWriter, r *http.Request) {
	code := strings.ToUpper(r.URL.Query().Get("project"))
	if !s.projectInScope(r, code) {
		writeErr(w, 404, "project not found")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT u.id::text, u.name, u.initials, u.username, u.user_type `+eligibleAssigneeSQL+` ORDER BY u.user_type DESC, u.name`,
		code, currentUser(r).internal())
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	type person struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Initials string `json:"initials"`
		Username string `json:"username"`
		UserType string `json:"userType"`
	}
	out := []person{}
	for rows.Next() {
		var p person
		if rows.Scan(&p.ID, &p.Name, &p.Initials, &p.Username, &p.UserType) == nil {
			out = append(out, p)
		}
	}
	writeJSON(w, 200, out)
}
