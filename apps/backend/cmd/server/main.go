package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/screenshare/classroom/internal/auth"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ── Store de desenvolvimento ──────────────────────────────────────────────
	// Em produção, substituir por uma implementação real com PostgreSQL (T009).
	store := auth.NewInMemoryStore()

	// ── Handlers ──────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(store)

	// ── Roteador ──────────────────────────────────────────────────────────────
	mux := http.NewServeMux()

	// Health check (público)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	// Auth (público)
	authHandler.RegisterRoutes(mux)

	// TODO T009: rotas de sala (protegidas com auth.Middleware + auth.RequireRole)
	// TODO T010: WebSocket de sinalização
	// TODO T012: WebSocket de chat

	addr := ":" + port
	log.Printf("ScreenShare Classroom backend escutando em %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("erro no servidor: %v", err)
	}
}
