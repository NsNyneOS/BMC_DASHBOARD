package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

type user struct {
	ID             string `json:"id"`
	Username       string `json:"username"`
	Name           string `json:"name"`
	Initials       string `json:"initials"`
	Role           string `json:"role"`
	CanManageBoard bool   `json:"canManageBoard"`
	Active         bool   `json:"-"`
	hash           string
}

const userCols = `id::text, username, name, initials, role::text, can_manage_board, is_active, coalesce(password_hash,'')`

func scanUser(row interface{ Scan(...any) error }) (*user, error) {
	var u user
	err := row.Scan(&u.ID, &u.Username, &u.Name, &u.Initials, &u.Role, &u.CanManageBoard, &u.Active, &u.hash)
	return &u, err
}

func (s *server) userByID(ctx context.Context, id string) (*user, error) {
	return scanUser(s.db.QueryRow(ctx, `SELECT `+userCols+` FROM user_data WHERE id=$1::uuid`, id))
}

// seedPasswords sets the initial password for accounts that have none yet.
func (s *server) seedPasswords(ctx context.Context) {
	for username, pw := range map[string]string{
		"nyneos": env("NYNEOS_PASSWORD", ""),
		"bmc":    env("BMC_PASSWORD", ""),
	} {
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
	u, err := scanUser(s.db.QueryRow(r.Context(), `SELECT `+userCols+` FROM user_data WHERE lower(username)=lower($1)`, in.Username))
	if err != nil || !u.Active || u.hash == "" || bcrypt.CompareHashAndPassword([]byte(u.hash), []byte(in.Password)) != nil {
		writeErr(w, 401, "invalid username or password")
		return
	}
	writeJSON(w, 200, map[string]any{"token": issueToken(s.secret, u.ID, 12*3600e9), "user": u})
}

func (s *server) me(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, currentUser(r)) }
