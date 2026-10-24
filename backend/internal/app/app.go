package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type server struct {
	db     *pgxpool.Pool
	secret []byte
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

// cors allows the origins listed in a comma-separated CORS_ORIGIN value (default
// "*": any origin) and echoes back the request's Origin. Auth uses a bearer token,
// not cookies, so allowing any origin does not expose a logged-in session.
func cors(origins string, next http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range strings.Split(origins, ",") {
		if o = strings.TrimRight(strings.TrimSpace(o), "/"); o != "" {
			allowed[o] = true
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		if origin := r.Header.Get("Origin"); allowed["*"] || allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// New builds the HTTP handler: it connects to the database, seeds missing
// passwords and registers all routes. Safe to call once per process / cold start.
func New(ctx context.Context) (http.Handler, error) {
	if tz := os.Getenv("TZ"); tz != "" {
		if loc, err := time.LoadLocation(tz); err == nil {
			time.Local = loc
		}
	}
	secret := env("JWT_SECRET", "")
	if secret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	// Built from parts so special characters in the password need no URL escaping.
	dsn := (&url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD")),
		Host:     fmt.Sprintf("%s:%s", os.Getenv("DB_HOST"), env("DB_PORT", "5432")),
		Path:     env("DB_NAME", "postgres"),
		RawQuery: "sslmode=" + env("DB_SSLMODE", "require"),
	}).String()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	// Simple protocol keeps this compatible with Supabase's pooled connections.
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	cfg.MaxConns = 6
	cfg.MinConns = 2
	cfg.MaxConnIdleTime = 10 * time.Minute
	cfg.HealthCheckPeriod = 30 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("database unreachable: %w", err)
	}
	s := &server{db: pool, secret: []byte(secret)}
	s.seedPasswords(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("GET /api/auth/me", s.auth(s.me))
	mux.HandleFunc("POST /api/auth/change-password", s.auth(s.changePassword))
	mux.HandleFunc("GET /api/projects", s.auth(s.listProjects))
	mux.HandleFunc("POST /api/projects", s.need("project.manage", s.createProject))
	mux.HandleFunc("PATCH /api/projects/{id}", s.need("project.manage", s.updateProject))
	mux.HandleFunc("GET /api/owner", s.needAny(s.getOwner, "customer.view", "project.manage"))
	mux.HandleFunc("GET /api/customers", s.need("customer.view", s.listCustomers))
	mux.HandleFunc("POST /api/customers", s.need("customer.manage", s.createCustomer))
	mux.HandleFunc("PATCH /api/customers/{id}", s.need("customer.manage", s.updateCustomer))
	mux.HandleFunc("GET /api/users", s.need("user.view", s.listUsers))
	mux.HandleFunc("POST /api/users", s.need("user.manage", s.createUser))
	mux.HandleFunc("PATCH /api/users/{id}", s.need("user.manage", s.updateUser))
	mux.HandleFunc("GET /api/roles", s.needAny(s.listRoles, "user.view", "role.manage"))
	mux.HandleFunc("POST /api/roles", s.need("role.manage", s.createRole))
	mux.HandleFunc("PATCH /api/roles/{id}", s.need("role.manage", s.updateRole))
	mux.HandleFunc("DELETE /api/roles/{id}", s.need("role.manage", s.deleteRole))
	mux.HandleFunc("GET /api/permissions", s.needAny(s.listPermissions, "user.view", "role.manage"))
	mux.HandleFunc("GET /api/audit", s.need("audit.view", s.listAudit))
	mux.HandleFunc("GET /api/assignees", s.need("task.assign", s.listAssignees))
	mux.HandleFunc("GET /api/tasks", s.auth(s.listTasks))
	mux.HandleFunc("POST /api/tasks", s.auth(s.createTask))
	mux.HandleFunc("PATCH /api/tasks/{id}", s.auth(s.updateTask))
	mux.HandleFunc("DELETE /api/tasks/{id}", s.auth(s.deleteTask))
	return cors(env("CORS_ORIGIN", "*"), mux), nil
}

// LoadEnv reads a local .env file (no-op when absent, e.g. on Vercel).
func LoadEnv(path string) { loadEnv(path) }
