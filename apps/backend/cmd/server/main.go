package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/screenshare/classroom/internal/auth"
	"github.com/screenshare/classroom/internal/room"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ── Stores ────────────────────────────────────────────────────────────────
	// Desenvolvimento: stores em memória.
	// Produção: substituir pelas implementações PostgreSQL.
	authStore := auth.NewInMemoryStore()
	roomStore := room.NewInMemoryStore()

	// ── Handlers ──────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authStore)
	roomHandler := room.NewHandler(roomStore)

	// ── Roteador ──────────────────────────────────────────────────────────────
	mux := http.NewServeMux()

	// Público: health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	// Público: POST /auth/login
	authHandler.RegisterRoutes(mux)

	// Público: POST /rooms/{roomId}/join (aluno sem JWT)
	roomHandler.RegisterRoutes(mux)

	// Protegido: POST /rooms, GET /rooms/{id}/link, POST /rooms/{id}/close
	roomHandler.RegisterProtectedRoutes(mux, auth.Middleware)

	// TODO T010: WebSocket de sinalização (wss://.../ws/rooms/{id}/signal)
	// TODO T012: WebSocket de chat (wss://.../ws/rooms/{id}/chat)

	addr := ":" + port
	log.Printf("ScreenShare Classroom backend escutando em %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("erro no servidor: %v", err)
	}
}
