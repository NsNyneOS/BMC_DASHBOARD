// Package handler is the Vercel serverless entry point. vercel.json rewrites every
// /api/* request to this function, which serves the full router.
package handler

import (
	"context"
	"net/http"
	"sync"

	"backend/internal/app"
)

var (
	once    sync.Once
	handler http.Handler
	initErr error
)

func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(func() { handler, initErr = app.New(context.Background()) })
	if initErr != nil {
		http.Error(w, `{"error":"server is not configured"}`, http.StatusInternalServerError)
		return
	}
	handler.ServeHTTP(w, r)
}
