package app

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

type ctxKey struct{}

type claims struct {
	Sub string `json:"sub"`
	Exp int64  `json:"exp"`
}

var b64 = base64.RawURLEncoding

func sign(secret []byte, payload string) string {
	m := hmac.New(sha256.New, secret)
	m.Write([]byte(payload))
	return b64.EncodeToString(m.Sum(nil))
}

func issueToken(secret []byte, userID string, ttl time.Duration) string {
	body, _ := json.Marshal(claims{Sub: userID, Exp: time.Now().Add(ttl).Unix()})
	p := b64.EncodeToString(body)
	return p + "." + sign(secret, p)
}

func parseToken(secret []byte, token string) (string, error) {
	p, sig, ok := strings.Cut(token, ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(sign(secret, p))) {
		return "", errors.New("bad token")
	}
	raw, err := b64.DecodeString(p)
	if err != nil {
		return "", err
	}
	var c claims
	if json.Unmarshal(raw, &c) != nil || c.Exp < time.Now().Unix() {
		return "", errors.New("expired token")
	}
	return c.Sub, nil
}

func (s *server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		id, err := parseToken(s.secret, tok)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		u, err := s.userByID(r.Context(), id)
		if err != nil || !u.Active {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	}
}

func currentUser(r *http.Request) *user { return r.Context().Value(ctxKey{}).(*user) }
