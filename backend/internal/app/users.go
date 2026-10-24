package app

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// user is the signed-in principal. UserType is "internal" (NyneOS staff, all customers) or
// "external" (one customer). What a user may do is decided by Permissions, never by role name.
type user struct {
	ID                 string   `json:"id"`
	Username           string   `json:"username"`
	Name               string   `json:"name"`
	Initials           string   `json:"initials"`
	UserType           string   `json:"userType"`
	Role               string   `json:"role"`
	RoleName           string   `json:"roleName"`
	CustomerID         *string  `json:"customerId"`
	CustomerCode       string   `json:"customerCode"`
	CustomerName       string   `json:"customerName"`
	CustomerLogo       string   `json:"customerLogo"`
	Permissions        []string `json:"permissions"`
	CanManageBoard     bool     `json:"canManageBoard"`
	MustChangePassword bool     `json:"mustChangePassword"`
	Active             bool     `json:"-"`
	hash               string
}

func (u *user) can(perm string) bool {
	for _, p := range u.Permissions {
		if p == perm {
			return true
		}
	}
	return false
}

func (u *user) internal() bool { return u.UserType == "internal" }

const userFrom = `
FROM user_data u
JOIN uam_roles r ON r.id = u.role_id
LEFT JOIN customer_master c ON c.id = u.customer_id`

const userCols = `SELECT u.id::text, u.username, u.name, u.initials, u.user_type, r.code, r.name,
       u.customer_id::text, coalesce(c.code,''), coalesce(c.name,''), coalesce(c.logo_url,''),
       u.is_active AND coalesce(c.status,'active') = 'active', coalesce(u.password_hash,''), u.must_change_password,
       coalesce((SELECT array_agg(p.code ORDER BY p.code) FROM uam_role_permissions rp
                 JOIN uam_permissions p ON p.id = rp.permission_id WHERE rp.role_id = u.role_id), '{}')` + userFrom

func scanUser(row interface{ Scan(...any) error }) (*user, error) {
	var u user
	err := row.Scan(&u.ID, &u.Username, &u.Name, &u.Initials, &u.UserType, &u.Role, &u.RoleName,
		&u.CustomerID, &u.CustomerCode, &u.CustomerName, &u.CustomerLogo, &u.Active, &u.hash, &u.MustChangePassword, &u.Permissions)
	if u.Permissions == nil {
		u.Permissions = []string{}
	}
	u.CanManageBoard = u.can("board.view")
	return &u, err
}

func (s *server) userByID(ctx context.Context, id string) (*user, error) {
	return scanUser(s.db.QueryRow(ctx, userCols+` WHERE u.id=$1::uuid`, id))
}

// seedPasswords sets the initial password for accounts that have none yet.
func (s *server) seedPasswords(ctx context.Context) {
	rows, err := s.db.Query(ctx, `SELECT username FROM user_data WHERE password_hash IS NULL`)
	if err != nil {
		log.Printf("seed passwords: %v", err)
		return
	}
	var missing []string
	for rows.Next() {
		var u string
		if rows.Scan(&u) == nil {
			missing = append(missing, u)
		}
	}
	rows.Close()
	for _, username := range missing {
		pw := env(strings.ToUpper(username)+"_PASSWORD", "")
		if pw == "" {
			log.Printf("no password configured for %q; login disabled until set", username)
			continue
		}
		h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
		if err != nil {
			log.Fatal(err)
		}
		if _, err := s.db.Exec(ctx, `UPDATE user_data SET password_hash=$1 WHERE username=$2 AND password_hash IS NULL`, string(h), username); err != nil {
			log.Fatal(err)
		}
	}
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var in struct{ Username, Password string }
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		writeErr(w, 400, "invalid body")
		return
	}
	u, err := scanUser(s.db.QueryRow(r.Context(), userCols+` WHERE lower(u.username)=lower($1)`, in.Username))
	if err != nil || !u.Active || u.hash == "" || bcrypt.CompareHashAndPassword([]byte(u.hash), []byte(in.Password)) != nil {
		writeErr(w, 401, "invalid username or password")
		return
	}
	writeJSON(w, 200, map[string]any{"token": issueToken(s.secret, u.ID, 12*3600e9), "user": u})
}

func (s *server) me(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, currentUser(r)) }

// defaultPassword is given to every user created without an explicit password; they must change it at first sign-in.
const defaultPassword = "NEWPASSWORD"

// changePassword lets the signed-in user set their own password (required once after the default one was issued).
func (s *server) changePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !readJSON(r, &in) {
		writeErr(w, 400, "invalid body")
		return
	}
	u := currentUser(r)
	if bcrypt.CompareHashAndPassword([]byte(u.hash), []byte(in.CurrentPassword)) != nil {
		writeErr(w, 400, "current password is incorrect")
		return
	}
	if len(in.NewPassword) < 8 {
		writeErr(w, 400, "new password must be at least 8 characters")
		return
	}
	if in.NewPassword == defaultPassword || in.NewPassword == in.CurrentPassword {
		writeErr(w, 400, "choose a password different from the current and default ones")
		return
	}
	h, err := bcrypt.GenerateFromPassword([]byte(in.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, 500, "could not hash password")
		return
	}
	if _, err := s.db.Exec(r.Context(), `UPDATE user_data SET password_hash=$1, must_change_password=FALSE WHERE id=$2::uuid`, string(h), u.ID); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	clearUserCache()
	w.WriteHeader(http.StatusNoContent)
}
