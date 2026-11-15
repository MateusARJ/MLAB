package main

// Ciclo de vida do processo do backend embarcado (034-encerramento-backend-orfao, T3401).
// Contrato: spec-kit/specs/034-encerramento-backend-orfao/contracts/backend-embarcado.md.

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	// watchdogEnv ativa o watchdog do processo pai quando vale "1" (definido pelo app desktop).
	watchdogEnv = "MLAB_PARENT_WATCHDOG"
	// parentPIDEnv é o PID do processo principal do app, vigiado como segunda garantia além do stdin.
	parentPIDEnv = "MLAB_PARENT_PID"
	// logFileEnv é o caminho do log persistente do backend (append).
	logFileEnv = "MLAB_LOG_FILE"

	// gracefulShutdownTimeout é o tempo máximo de espera pelas requisições ativas (RF-3408).
	gracefulShutdownTimeout = 3 * time.Second
	// parentPollInterval é o intervalo da vigilância do processo pai onde ela é feita por consulta (Unix).
	parentPollInterval = 1 * time.Second
)

// watchdogEnabled informa se o backend foi iniciado pelo app com o watchdog ligado.
func watchdogEnabled() bool {
	return os.Getenv(watchdogEnv) == "1"
}

// parseParentPID converte MLAB_PARENT_PID; valor vazio, não numérico ou ≤ 0 devolve 0 (ignorado).
func parseParentPID(raw string) int {
	pid, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || pid <= 0 {
		return 0
	}
	return pid
}

// watchStdin lê r até EOF ou erro e então envia o motivo. Nenhum dado é esperado no canal (RF-3407a).
func watchStdin(r io.Reader) <-chan string {
	ch := make(chan string, 1)
	go func() {
		_, err := io.Copy(io.Discard, r)
		if err != nil {
			ch <- "stdin com erro de leitura: " + err.Error()
			return
		}
		ch <- "stdin recebeu EOF (app encerrou)"
	}()
	return ch
}

// startWatchdog combina a vigilância do stdin e do PID do pai; o primeiro motivo vence (RF-3407).
func startWatchdog(stdin io.Reader, parentPID int, interval time.Duration) <-chan string {
	out := make(chan string, 1)
	var once sync.Once
	forward := func(src <-chan string) {
		reason, ok := <-src
		if !ok {
			return
		}
		once.Do(func() { out <- reason })
	}
	go forward(watchStdin(stdin))
	if parentPID > 0 {
		go forward(watchParent(parentPID, interval))
	}
	return out
}

// waitStopReason espera o primeiro de: erro do servidor, sinal (ctx) ou watchdog. Devolve o motivo do
// encerramento ou o erro do servidor (porta ocupada, etc.). watchdog pode ser nil.
func waitStopReason(ctx context.Context, serveErr <-chan error, watchdog <-chan string) (string, error) {
	select {
	case err := <-serveErr:
		if err == nil || errors.Is(err, http.ErrServerClosed) {
			return "servidor encerrado", nil
		}
		return "", err
	case <-ctx.Done():
		return "sinal de encerramento recebido", nil
	case reason := <-watchdog:
		return reason, nil
	}
}

// httpShutdowner é a parte do *http.Server usada no encerramento gracioso.
type httpShutdowner interface {
	Shutdown(ctx context.Context) error
	Close() error
}

// gracefulShutdown para de aceitar conexões, espera as requisições ativas até timeout, força o fechamento
// se estourar e encerra o anúncio mDNS (RF-3408).
func gracefulShutdown(srv httpShutdowner, timeout time.Duration, stopMDNS func()) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	err := srv.Shutdown(ctx)
	if err != nil {
		_ = srv.Close()
	}
	if stopMDNS != nil {
		stopMDNS()
	}
	return err
}

// tolerantWriter replica a escrita em vários destinos e ignora a falha de qualquer um deles, para que um
// stdout/stderr quebrado (app morto) não impeça o registro no arquivo (RF-3414).
type tolerantWriter struct {
	writers []io.Writer
}

func (t tolerantWriter) Write(p []byte) (int, error) {
	for _, w := range t.writers {
		_, _ = w.Write(p)
	}
	return len(p), nil
}

// openLogOutput devolve o destino do log: com path, arquivo (append) + fallback; sem path ou se o arquivo não
// puder ser aberto, só o fallback (com aviso nele). close libera o arquivo.
func openLogOutput(path string, fallback io.Writer) (out io.Writer, closeFn func()) {
	if path == "" {
		return fallback, func() {}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		fmt.Fprintf(fallback, "AVISO: não foi possível criar a pasta do log %s: %v\n", path, err)
		return fallback, func() {}
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		fmt.Fprintf(fallback, "AVISO: não foi possível abrir o log %s: %v\n", path, err)
		return fallback, func() {}
	}
	return tolerantWriter{writers: []io.Writer{f, fallback}}, func() { _ = f.Close() }
}

// logStartup registra a partida do processo (RF-3414). Nunca registra o ambiente (RNF-3402).
func logStartup(watchdog bool, parentPID int) {
	if watchdog {
		log.Printf("[Lifecycle] partida: pid=%d ppid=%d watchdog=ativo parentPid=%d", os.Getpid(), os.Getppid(), parentPID)
		return
	}
	log.Printf("[Lifecycle] partida: pid=%d ppid=%d watchdog=inativo", os.Getpid(), os.Getppid())
}
