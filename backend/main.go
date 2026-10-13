package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
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

func cors(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	loadEnv(".env")
	if tz := os.Getenv("TZ"); tz != "" {
		if loc, err := time.LoadLocation(tz); err == nil {
			time.Local = loc
		}
	}
	// Built from parts so special characters in the password need no URL escaping.
	dsn := (&url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD")),
		Host:     fmt.Sprintf("%s:%s", os.Getenv("DB_HOST"), env("DB_PORT", "5432")),
		Path:     env("DB_NAME", "postgres"),
		RawQuery: "sslmode=require",
	}).String()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		log.Fatal(err)
	}
	// Simple protocol keeps this compatible with Supabase's pooled connections.
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("database unreachable: %v", err)
	}

	secret := env("JWT_SECRET", "")
	if secret == "" {
		log.Fatal("JWT_SECRET is required")
	}
	s := &server{db: pool, secret: []byte(secret)}
	s.seedPasswords(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("GET /api/auth/me", s.auth(s.me))
	mux.HandleFunc("GET /api/projects", s.auth(s.listProjects))
	mux.HandleFunc("PATCH /api/projects/{id}", s.auth(s.updateProject))
	mux.HandleFunc("GET /api/tasks", s.auth(s.listTasks))
	mux.HandleFunc("POST /api/tasks", s.auth(s.createTask))
	mux.HandleFunc("PATCH /api/tasks/{id}", s.auth(s.updateTask))
	mux.HandleFunc("DELETE /api/tasks/{id}", s.auth(s.deleteTask))

	addr := ":" + env("PORT", "8080")
	log.Printf("API listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, cors(env("CORS_ORIGIN", "http://localhost:5173"), mux)))
}
