package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

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

	// Conecta o broadcaster de encerramento da sala ao hub de sinalização
	roomHandler.SetRoomCloseBroadcaster(func(roomID string) {
		if hub := sigHandler.GetHub(roomID); hub != nil {
			hub.BroadcastRoomClosed()
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

	// Servidor SPA do Aluno (Frontend Web)
	webDir := resolveWebDir()
	if webDir != "" {
		log.Printf("MLab servindo frontend web do aluno a partir de: %s", webDir)
		mux.Handle("/", spaHandler(webDir))
	} else {
		log.Println("AVISO: Diretório do frontend web não encontrado. Servidor operando apenas como API/SFU.")
	}

	addr := ":" + port
	log.Printf("MLab backend escutando em %s", addr)
	if err := http.ListenAndServe(addr, corsMiddleware(mux)); err != nil {
		log.Fatalf("erro no servidor: %v", err)
	}
}

// resolveWebDir descobre o diretório onde os arquivos compilados do web app dos alunos estão localizados.
func resolveWebDir() string {
	// 1. Variável de ambiente explícita (injetada pelo Electron ou script)
	if dir := os.Getenv("WEB_DIR"); dir != "" {
		if stat, err := os.Stat(dir); err == nil && stat.IsDir() {
			return dir
		}
	}

	// 2. Relativo ao executável (ex: resources/bin/server.exe -> resources/web)
	if execPath, err := os.Executable(); err == nil {
		execDir := filepath.Dir(execPath)
		candidates := []string{
			filepath.Join(execDir, "web"),
			filepath.Join(execDir, "../web"),
			filepath.Join(execDir, "../../web/dist"),
			filepath.Join(execDir, "../../../apps/web/dist"),
		}
		for _, c := range candidates {
			if stat, err := os.Stat(c); err == nil && stat.IsDir() {
				return c
			}
		}
	}

	// 3. Relativo ao diretório de trabalho atual (CWD)
	cwdCandidates := []string{
		"web",
		"dist",
		"apps/web/dist",
		"../web/dist",
		"../../apps/web/dist",
	}
	for _, c := range cwdCandidates {
		if stat, err := os.Stat(c); err == nil && stat.IsDir() {
			return c
		}
	}

	return ""
}

// spaHandler serve os arquivos estáticos da pasta webDir e faz fallback para index.html para rotas de SPA.
func spaHandler(webDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(webDir))
	indexPath := filepath.Join(webDir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Se for requisição GET ou HEAD, verifica se existe arquivo estático físico
		if r.Method == http.MethodGet || r.Method == http.MethodHead {
			cleanPath := filepath.Clean(r.URL.Path)
			fullPath := filepath.Join(webDir, cleanPath)

			info, err := os.Stat(fullPath)
			if err == nil && !info.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}

			// Se não for arquivo físico ou se for a raiz, serve o index.html como SPA fallback
			if _, err := os.Stat(indexPath); err == nil {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				http.ServeFile(w, r, indexPath)
				return
			}
		}

		http.NotFound(w, r)
	})
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
