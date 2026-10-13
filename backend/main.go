// Local development entry point. On Vercel the handler in api/index.go is used instead.
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"backend/internal/app"
)

func main() {
	app.LoadEnv(".env")
	h, err := app.New(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	addr := ":" + envPort()
	log.Printf("API listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, h))
}

func envPort() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}
