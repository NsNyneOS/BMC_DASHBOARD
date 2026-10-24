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
	"sync"
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
		u, err := s.cachedUser(r.Context(), id)
		if err != nil || !u.Active {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		// A user still on the default password may only read their profile and change the password.
		if u.MustChangePassword && r.URL.Path != "/api/auth/me" && r.URL.Path != "/api/auth/change-password" {
			writeErr(w, http.StatusForbidden, "password change required")
			return
		}
		s.audited(u, next, w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	}
}

type cachedEntry struct {
	u       *user
	expires time.Time
}

var (
	userCache   = map[string]cachedEntry{}
	userCacheMu sync.RWMutex
)

const userCacheTTL = time.Minute

// cachedUser avoids a database round trip on every authenticated request.
func (s *server) cachedUser(ctx context.Context, id string) (*user, error) {
	userCacheMu.RLock()
	e, ok := userCache[id]
	userCacheMu.RUnlock()
	if ok && time.Now().Before(e.expires) {
		return e.u, nil
	}
	u, err := s.userByID(ctx, id)
	if err != nil {
		return nil, err
	}
	userCacheMu.Lock()
	userCache[id] = cachedEntry{u: u, expires: time.Now().Add(userCacheTTL)}
	userCacheMu.Unlock()
	return u, nil
}

func currentUser(r *http.Request) *user { return r.Context().Value(ctxKey{}).(*user) }

// clearUserCache forgets every cached user, so role / customer changes apply on the next request.
func clearUserCache() {
	userCacheMu.Lock()
	userCache = map[string]cachedEntry{}
	userCacheMu.Unlock()
}
