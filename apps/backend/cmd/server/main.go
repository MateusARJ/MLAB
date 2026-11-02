package main

import (
	"crypto/rand"
	"encoding/hex"
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

	// Segredo JWT: usa JWT_SECRET do ambiente ou gera um aleatório para esta execução (ADR 0006).
	if generated, err := ensureJWTSecret(); err != nil {
		log.Fatalf("erro ao gerar JWT_SECRET: %v", err)
	} else if generated {
		log.Println("JWT_SECRET não configurado: segredo aleatório gerado para esta execução (tokens emitidos valem até o backend reiniciar).")
	}
	if os.Getenv(auth.HostKeyEnv) == "" {
		log.Printf("AVISO: %s não configurado: sessões de professor serão recusadas. Inicie pelo app MLab ou por `npm run dev`.", auth.HostKeyEnv)
	}

	handler, err := newServer(serverConfig{
		UDPPortMin: 50000,
		UDPPortMax: 50100,
		NAT1To1IP:  room.GetPrimaryPhysicalIP(),
		WebDir:     resolveWebDir(),
	})
	if err != nil {
		log.Fatalf("%v", err)
	}

	addr := ":" + port
	log.Printf("MLab backend escutando em %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("erro no servidor: %v", err)
	}
}

// serverConfig reúne o que varia entre a execução real e os testes de smoke (004/T401).
type serverConfig struct {
	UDPPortMin uint16
	UDPPortMax uint16
	NAT1To1IP  string
	WebDir     string
}

// newServer monta store, SFU, handlers, ligações entre eles e rotas, e devolve o handler HTTP com CORS.
// É a mesma montagem usada pelo main; os testes de smoke sobem o servidor real por aqui.
func newServer(cfg serverConfig) (http.Handler, error) {
	// ── Store de salas (em memória — ADR 0005) ───────────────────────────────
	roomStore := room.NewInMemoryStore()

	// ── SFU Pion WebRTC (T011) ────────────────────────────────────────────────
	sfuService, err := webrtc.NewSFUService(webrtc.Config{
		UDPPortMin: cfg.UDPPortMin,
		UDPPortMax: cfg.UDPPortMax,
		NAT1To1IP:  cfg.NAT1To1IP,
	})
	if err != nil {
		return nil, fmt.Errorf("erro ao inicializar SFUService: %w", err)
	}

	// ── Handlers ──────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler()
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

	// Libera os arquivos da sala quando o hub a encerra pelo WebSocket (end-session ou timeout)
	sigHandler.SetRoomClosedListener(roomHandler.ReleaseRoomFiles)

	// Conecta a notificação de vídeo pronto do SFU ao hub de sinalização (inicia transmissão aos alunos sem F5)
	sfuService.SetOnTrackReady(func(roomID string) {
		sigHandler.OnTrackReady(roomID)
	})

	// ── Roteador ──────────────────────────────────────────────────────────────
	mux := http.NewServeMux()

	// Público: health check.
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	// Sessão do professor: POST /auth/session (exige chave de host — ADR 0006).
	authHandler.RegisterRoutes(mux)

	// Público: POST /rooms/{id}/join (aluno sem JWT prévio).
	roomHandler.RegisterRoutes(mux)

	// Protegido: POST /rooms, GET /rooms/{id}/link, POST /rooms/{id}/close.
	roomHandler.RegisterProtectedRoutes(mux, auth.Middleware)

	// WebSocket: GET /ws/rooms/{id}/signal?token=<jwt>
	sigHandler.RegisterRoutes(mux)

	// Servidor SPA do Aluno (Frontend Web)
	if cfg.WebDir != "" {
		log.Printf("MLab servindo frontend web do aluno a partir de: %s", cfg.WebDir)
		mux.Handle("/", spaHandler(cfg.WebDir))
	} else {
		log.Println("AVISO: Diretório do frontend web não encontrado. Servidor operando apenas como API/SFU.")
	}

	return corsMiddleware(mux), nil

}

// jwtSecretBytes é o tamanho do segredo JWT gerado quando JWT_SECRET não é fornecido.
const jwtSecretBytes = 32

// ensureJWTSecret garante que JWT_SECRET esteja definido. Quando ausente, gera um segredo aleatório
// de 32 bytes (hex) e o define no ambiente do processo, onde internal/auth o lê.
// Retorna true quando o segredo foi gerado. O valor nunca é registrado em log.
func ensureJWTSecret() (bool, error) {
	if os.Getenv("JWT_SECRET") != "" {
		return false, nil
	}
	buf := make([]byte, jwtSecretBytes)
	if _, err := rand.Read(buf); err != nil {
		return false, err
	}
	if err := os.Setenv("JWT_SECRET", hex.EncodeToString(buf)); err != nil {
		return false, err
	}
	return true, nil
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

// corsMiddleware aplica a allowlist de origem (002-security-hardening/S6): reflete a origem
// permitida em Access-Control-Allow-Origin e não envia cabeçalhos CORS para origens recusadas,
// o que faz o navegador bloquear a resposta.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		origin := r.Header.Get("Origin")
		if origin != "" && room.IsAllowedOrigin(origin, r) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, "+auth.HostKeyHeader)
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
