package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/screenshare/classroom/internal/auth"
	"github.com/screenshare/classroom/internal/room"
	"github.com/screenshare/classroom/internal/signaling"
	"github.com/screenshare/classroom/internal/webrtc"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Chave secreta padrão para desenvolvimento local quando executado via Turborepo ou npm run dev
	if os.Getenv("JWT_SECRET") == "" {
		os.Setenv("JWT_SECRET", "dev-secret-key-12345")
		log.Println("AVISO: JWT_SECRET não configurado no ambiente. Usando chave padrão para desenvolvimento local.")
	}

	// ── Stores (desenvolvimento: em memória) ──────────────────────────────────
	authStore := auth.NewInMemoryStore()
	roomStore := room.NewInMemoryStore()

	// ── SFU Pion WebRTC (T011) ────────────────────────────────────────────────
	sfuService, err := webrtc.NewSFUService(webrtc.Config{
		UDPPortMin: 50000,
		UDPPortMax: 50100,
	})
	if err != nil {
		log.Fatalf("erro ao inicializar SFUService: %v", err)
	}

	// ── Handlers ──────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authStore)
	roomHandler := room.NewHandler(roomStore)
	sigHandler := signaling.NewHandler(roomStore, sfuService)

	// Conecta o broadcaster de arquivos da sala ao hub de sinalização
	roomHandler.SetFileBroadcaster(func(roomID, id, name string, size int64, url string) {
		if hub := sigHandler.GetHub(roomID); hub != nil {
			hub.BroadcastFileShared(signaling.FileSharedPayload{
				ID:   id,
				Name: name,
				Size: size,
				URL:  url,
			})
		}
	})

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

	addr := ":" + port
	log.Printf("MLab backend escutando em %s", addr)
	if err := http.ListenAndServe(addr, corsMiddleware(mux)); err != nil {
		log.Fatalf("erro no servidor: %v", err)
	}
}

// corsMiddleware permite requisições cross-origin durante o desenvolvimento local.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
