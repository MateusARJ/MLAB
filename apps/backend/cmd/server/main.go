package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
	"github.com/MateusARJ/MLAB/apps/backend/internal/room"
	"github.com/MateusARJ/MLAB/apps/backend/internal/signaling"
	"github.com/MateusARJ/MLAB/apps/backend/internal/tlsca"
	"github.com/MateusARJ/MLAB/apps/backend/internal/webrtc"
)

func main() {
	// Ciclo de vida (034/T3401): log persistente, SIGPIPE ignorado no Unix e registro da partida.
	ignoreBrokenPipe()
	logOut, closeLog := openLogOutput(os.Getenv(logFileEnv), os.Stderr)
	defer closeLog()
	log.SetOutput(logOut)
	// Crash do runtime também no log persistente (052/RF-5202); sem o arquivo, segue só no stderr (RF-5203).
	if path := os.Getenv(logFileEnv); path != "" {
		if err := setCrashLog(path); err != nil {
			log.Printf("AVISO: a saída de crash não irá para %s: %v", path, err)
		}
	}
	watchdogOn := watchdogEnabled()
	parentPID := parseParentPID(os.Getenv(parentPIDEnv))
	logStartup(watchdogOn, parentPID)

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

	// HTTPS na LAN com CA local (edição MLab HTTPS — ADR 0008, feature 011).
	ca, tlsPort, err := loadTLSFromEnv()
	if err != nil {
		log.Fatalf("erro ao preparar o HTTPS: %v", err)
	}

	handler, err := newServer(serverConfig{
		UDPPortMin: 50000,
		UDPPortMax: 50100,
		NAT1To1IP:  room.GetPrimaryPhysicalIP(),
		WebDir:     resolveWebDir(),
		DevWebPort: resolveDevWebPort(),
		TLS:        ca,
		TLSPort:    tlsPort,
	})
	if err != nil {
		log.Fatalf("%v", err)
	}

	var tlsServer *http.Server
	if ca != nil {
		tlsServer = newTLSServer(tlsPort, handler, ca)
		go func() {
			log.Printf("MLab backend escutando HTTPS em :%s", tlsPort)
			if err := tlsServer.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
				log.Fatalf("erro no servidor HTTPS: %v", err)
			}
		}()
	}

	addr := ":" + port
	srv := &http.Server{Addr: addr, Handler: handler}
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.ListenAndServe() }()
	log.Printf("MLab backend escutando em %s", addr)

	// Encerramento gracioso por sinal (RF-3408) ou, com o watchdog ligado, pela morte do app (RF-3407).
	sigCtx, stopSignals := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignals()
	var watchdog <-chan string
	if watchdogOn {
		watchdog = startWatchdog(os.Stdin, parentPID, parentPollInterval)
	}

	reason, err := waitStopReason(sigCtx, serveErr, watchdog)
	if err != nil {
		log.Fatalf("erro no servidor: %v", err)
	}
	log.Printf("[Lifecycle] encerramento iniciado: %s", reason)
	started := time.Now()
	if err := gracefulShutdown(srv, gracefulShutdownTimeout, room.StopMDNSServer); err != nil {
		log.Printf("[Lifecycle] encerramento gracioso excedeu %s; conexões fechadas à força: %v", gracefulShutdownTimeout, err)
	}
	if tlsServer != nil {
		_ = tlsServer.Close()
	}
	log.Printf("[Lifecycle] encerrado em %s (motivo: %s)", time.Since(started).Round(time.Millisecond), reason)
}

// serverConfig reúne o que varia entre a execução real e os testes de smoke (004/T401).
type serverConfig struct {
	UDPPortMin uint16
	UDPPortMax uint16
	NAT1To1IP  string
	WebDir     string
	// DevWebPort, quando preenchida (modo de desenvolvimento), faz a rota "/" redirecionar para o servidor
	// do Vite nessa porta em vez de servir o build de WebDir (008-dev-entrada-unica-web).
	DevWebPort string
	// TLS é a CA local da edição MLab HTTPS (nil = HTTPS desligado) e TLSPort a porta HTTPS (011, RF-1103/RF-1104).
	TLS     *tlsca.CA
	TLSPort string
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

	// O join recusa a matrícula já conectada no hub da sala (RN-04, ADR 0010 — 027/T2703)
	roomHandler.SetStudentConnectedChecker(sigHandler.HasConnectedStudent)

	// Quando o hub encerra a sala pelo WebSocket (end-session ou timeout de reconexão), a sala é encerrada e
	// removida do store e seus arquivos são liberados, como na REST close (RN-13, RF-18 — 033/T3302)
	sigHandler.SetRoomClosedListener(roomHandler.CloseRoomFromSession)

	// Quando o status da sessão muda no hub (publishing ou reconnecting), o store da sala acompanha, para que /info,
	// /rooms/active e o join reflitam a transmissão (RF-18 — 035/T3504)
	sigHandler.SetRoomStatusListener(func(roomID string, status signaling.SessionStatus) {
		roomHandler.SyncStatusFromSession(roomID, room.Status(status))
	})

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

	// HTTPS na LAN: /tls/info, /tls/ok e /mlab-ca.crt (011, RF-1104/RF-1105).
	registerTLSRoutes(mux, cfg.TLS, cfg.TLSPort, cfg.DevWebPort == "")

	// Servidor SPA do Aluno (Frontend Web). No modo de desenvolvimento a página é do Vite: a 8080 redireciona
	// para ele, para não servir o build antigo de apps/web/dist como segunda entrada (008, RF-801/RF-803).
	if cfg.DevWebPort != "" {
		log.Printf("Modo de desenvolvimento: páginas do web do aluno redirecionadas para a porta %s (Vite)", cfg.DevWebPort)
		mux.Handle("/", devWebRedirectHandler(cfg.DevWebPort))
	} else if cfg.WebDir != "" {
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

	// 2. Relativo ao executável (ex: resources/bin/mlab-backend.exe -> resources/web)
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

// resolveDevWebPort devolve a porta do servidor do Vite no modo de desenvolvimento (MLAB_DEV_MONOREPO=1):
// WEB_PORT ou 5173, a mesma regra do link da sala. Fora do modo de desenvolvimento devolve "".
func resolveDevWebPort() string {
	if os.Getenv("MLAB_DEV_MONOREPO") != "1" {
		return ""
	}
	if p := os.Getenv("WEB_PORT"); p != "" {
		return p
	}
	return "5173"
}

// devWebRedirectHandler redireciona páginas (GET/HEAD fora das rotas de API) para o mesmo caminho e query no
// servidor do Vite, mantendo o host da requisição; outros métodos recebem 404 (008, RF-801/RF-802).
func devWebRedirectHandler(webPort string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}
		host := r.Host
		if h, _, err := net.SplitHostPort(r.Host); err == nil {
			host = h
		}
		if host == "" {
			host = "localhost"
		}
		target := "http://" + net.JoinHostPort(host, webPort) + r.URL.RequestURI()
		http.Redirect(w, r, target, http.StatusTemporaryRedirect)
	})
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
