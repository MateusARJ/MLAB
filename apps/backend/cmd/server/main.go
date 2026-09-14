package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/screenshare/classroom/internal/auth"
	"github.com/screenshare/classroom/internal/room"
	"github.com/screenshare/classroom/internal/signaling"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ── Stores (desenvolvimento: em memória) ──────────────────────────────────
	authStore := auth.NewInMemoryStore()
	roomStore := room.NewInMemoryStore()

	// ── Handlers ──────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authStore)
	roomHandler := room.NewHandler(roomStore)

	// sfu=nil até T011 (Pion WebRTC) — signaling funciona em modo chat/stub.
	sigHandler := signaling.NewHandler(roomStore, nil)

	// ── Roteador ──────────────────────────────────────────────────────────────
	mux := http.NewServeMux()

	// Público: health check.
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	// Público: POST /auth/login.
	authHandler.RegisterRoutes(mux)

	// Público: POST /rooms/{id}/join (aluno sem JWT prévio).
	roomHandler.RegisterRoutes(mux)

	// Protegido: POST /rooms, GET /rooms/{id}/link, POST /rooms/{id}/close.
	roomHandler.RegisterProtectedRoutes(mux, auth.Middleware)

	// WebSocket: GET /ws/rooms/{id}/signal?token=<jwt>
	sigHandler.RegisterRoutes(mux)

	// TODO T011: injetar SFU Pion em sigHandler via sigHandler.SetSFU(sfuImpl)
	// TODO T012: módulo de chat (rate limit já implementado no hub)

	addr := ":" + port
	log.Printf("ScreenShare Classroom backend escutando em %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("erro no servidor: %v", err)
	}
}
