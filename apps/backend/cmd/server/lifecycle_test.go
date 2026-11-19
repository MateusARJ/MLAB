package main

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Testes do ciclo de vida do backend embarcado (034/T3401: RF-3407, RF-3408, RF-3414, RNF-3402).

// missingPID é um PID que não existe na prática (acima do pid_max do Linux e múltiplo de 4 no Windows).
const missingPID = 2147483000

func TestParseParentPID(t *testing.T) {
	cases := map[string]int{"": 0, "abc": 0, "0": 0, "-5": 0, " 1234 ": 1234, "42": 42}
	for raw, want := range cases {
		if got := parseParentPID(raw); got != want {
			t.Errorf("parseParentPID(%q) = %d, want %d", raw, got, want)
		}
	}
}

func TestWatchdogEnabled(t *testing.T) {
	t.Setenv(watchdogEnv, "")
	if watchdogEnabled() {
		t.Fatal("sem MLAB_PARENT_WATCHDOG o watchdog não deve ligar")
	}
	t.Setenv(watchdogEnv, "1")
	if !watchdogEnabled() {
		t.Fatal("MLAB_PARENT_WATCHDOG=1 deve ligar o watchdog")
	}
}

func expectReason(t *testing.T, ch <-chan string, within time.Duration) string {
	t.Helper()
	select {
	case reason := <-ch:
		return reason
	case <-time.After(within):
		t.Fatalf("watchdog não disparou em %s", within)
		return ""
	}
}

func expectNoReason(t *testing.T, ch <-chan string, during time.Duration) {
	t.Helper()
	select {
	case reason := <-ch:
		t.Fatalf("watchdog disparou sem motivo: %s", reason)
	case <-time.After(during):
	}
}

func TestWatchStdin_EOFDisparaEncerramento(t *testing.T) {
	r, w := io.Pipe()
	ch := watchStdin(r)
	expectNoReason(t, ch, 100*time.Millisecond)
	_ = w.Close()
	if reason := expectReason(t, ch, time.Second); !strings.Contains(reason, "EOF") {
		t.Fatalf("motivo inesperado: %q", reason)
	}
}

func TestWatchStdin_ErroDeLeituraDisparaEncerramento(t *testing.T) {
	r, w := io.Pipe()
	ch := watchStdin(r)
	_ = w.CloseWithError(errors.New("pipe quebrado"))
	if reason := expectReason(t, ch, time.Second); !strings.Contains(reason, "pipe quebrado") {
		t.Fatalf("motivo inesperado: %q", reason)
	}
}

func TestWatchParent_PaiInexistenteDispara(t *testing.T) {
	ch := watchParent(missingPID, 50*time.Millisecond)
	if reason := expectReason(t, ch, 2*time.Second); !strings.Contains(reason, "inexistente") {
		t.Fatalf("motivo inesperado: %q", reason)
	}
}

func TestWatchParent_PaiVivoNaoDispara(t *testing.T) {
	expectNoReason(t, watchParent(os.Getppid(), 50*time.Millisecond), 400*time.Millisecond)
}

func TestStartWatchdog_PrimeiroMotivoVence(t *testing.T) {
	r, w := io.Pipe()
	defer w.Close()
	ch := startWatchdog(r, missingPID, 50*time.Millisecond)
	if reason := expectReason(t, ch, 2*time.Second); !strings.Contains(reason, "inexistente") {
		t.Fatalf("motivo inesperado: %q", reason)
	}
	_ = w.Close()
	expectNoReason(t, ch, 200*time.Millisecond) // só um motivo é entregue
}

func TestStartWatchdog_SemPIDValeSoOStdin(t *testing.T) {
	r, w := io.Pipe()
	ch := startWatchdog(r, 0, 50*time.Millisecond)
	expectNoReason(t, ch, 200*time.Millisecond)
	_ = w.Close()
	expectReason(t, ch, time.Second)
}

func TestWaitStopReason(t *testing.T) {
	t.Run("sinal", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		reason, err := waitStopReason(ctx, make(chan error), nil)
		if err != nil || !strings.Contains(reason, "sinal") {
			t.Fatalf("reason=%q err=%v", reason, err)
		}
	})
	t.Run("watchdog", func(t *testing.T) {
		wd := make(chan string, 1)
		wd <- "stdin recebeu EOF (app encerrou)"
		reason, err := waitStopReason(context.Background(), make(chan error), wd)
		if err != nil || !strings.Contains(reason, "EOF") {
			t.Fatalf("reason=%q err=%v", reason, err)
		}
	})
	t.Run("erro do servidor", func(t *testing.T) {
		serveErr := make(chan error, 1)
		serveErr <- errors.New("porta ocupada")
		if _, err := waitStopReason(context.Background(), serveErr, nil); err == nil {
			t.Fatal("erro do servidor deve ser devolvido")
		}
	})
	t.Run("ErrServerClosed não é erro", func(t *testing.T) {
		serveErr := make(chan error, 1)
		serveErr <- http.ErrServerClosed
		if _, err := waitStopReason(context.Background(), serveErr, nil); err != nil {
			t.Fatalf("err=%v", err)
		}
	})
}

func TestGracefulShutdown_FechaServidorEMDNS(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})}
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()

	url := "http://" + ln.Addr().String() + "/health"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	mdnsStopped := false
	if err := gracefulShutdown(srv, gracefulShutdownTimeout, func() { mdnsStopped = true }); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
	if !mdnsStopped {
		t.Fatal("o anúncio mDNS deve ser encerrado")
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("Serve devolveu %v", err)
	}
	if _, err := http.Get(url); err == nil {
		t.Fatal("o servidor não deve aceitar conexões após o encerramento")
	}
}

type stuckServer struct{ closed bool }

func (s *stuckServer) Shutdown(ctx context.Context) error { <-ctx.Done(); return ctx.Err() }
func (s *stuckServer) Close() error                       { s.closed = true; return nil }

func TestGracefulShutdown_TimeoutForcaFechamento(t *testing.T) {
	s := &stuckServer{}
	mdnsStopped := false
	started := time.Now()
	err := gracefulShutdown(s, 100*time.Millisecond, func() { mdnsStopped = true })
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err=%v", err)
	}
	if !s.closed || !mdnsStopped {
		t.Fatalf("closed=%v mdns=%v", s.closed, mdnsStopped)
	}
	if time.Since(started) > time.Second {
		t.Fatal("o timeout deve limitar a espera")
	}
}

type brokenWriter struct{}

func (brokenWriter) Write([]byte) (int, error) { return 0, errors.New("pipe quebrado") }

func TestOpenLogOutput_ArquivoContinuaComStderrQuebrado(t *testing.T) {
	path := filepath.Join(t.TempDir(), "logs", "mlab-backend.log")
	out, closeFn := openLogOutput(path, brokenWriter{})
	logger := log.New(out, "", 0)
	logger.Println("linha 1")
	logger.Println("linha 2")
	closeFn()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := string(data); got != "linha 1\nlinha 2\n" {
		t.Fatalf("conteúdo do log: %q", got)
	}

	// append: uma nova execução não apaga o histórico
	out, closeFn = openLogOutput(path, brokenWriter{})
	_, _ = out.Write([]byte("linha 3\n"))
	closeFn()
	data, _ = os.ReadFile(path)
	if !strings.HasSuffix(string(data), "linha 2\nlinha 3\n") {
		t.Fatalf("o log deve ser aberto em append: %q", data)
	}
}

func TestOpenLogOutput_CaminhoInvalidoAvisaEContinua(t *testing.T) {
	dir := t.TempDir()
	blocker := filepath.Join(dir, "arquivo")
	if err := os.WriteFile(blocker, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	var fallback bytes.Buffer
	out, closeFn := openLogOutput(filepath.Join(blocker, "mlab-backend.log"), &fallback)
	defer closeFn()
	if !strings.Contains(fallback.String(), "AVISO") {
		t.Fatalf("deve avisar no stderr: %q", fallback.String())
	}
	fallback.Reset()
	_, _ = out.Write([]byte("segue\n"))
	if fallback.String() != "segue\n" {
		t.Fatal("o log deve continuar no stderr")
	}
}

func TestOpenLogOutput_SemCaminhoUsaSoFallback(t *testing.T) {
	var fallback bytes.Buffer
	out, closeFn := openLogOutput("", &fallback)
	defer closeFn()
	if out != io.Writer(&fallback) {
		t.Fatal("sem MLAB_LOG_FILE o destino é o stderr")
	}
}

func TestLogStartup_NaoRegistraSegredos(t *testing.T) {
	t.Setenv("MLAB_HOST_KEY", "chave-host-secreta-teste")
	t.Setenv("JWT_SECRET", "jwt-secreto-teste")
	var buf bytes.Buffer
	prev := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(prev)

	logStartup(true, 1234)
	logStartup(false, 0)

	got := buf.String()
	if strings.Contains(got, "chave-host-secreta-teste") || strings.Contains(got, "jwt-secreto-teste") {
		t.Fatalf("segredo no log: %q", got)
	}
	if !strings.Contains(got, fmt.Sprintf("pid=%d", os.Getpid())) || !strings.Contains(got, "watchdog=ativo") {
		t.Fatalf("partida sem PID/watchdog: %q", got)
	}
}

// ── Processo auxiliar: pai real morto com Kill ⇒ filho com watchdog sai em até 3 s ─────────────────────────

const helperModeEnv = "MLAB_LIFECYCLE_TEST_HELPER"
const helperMarkerEnv = "MLAB_LIFECYCLE_TEST_MARKER"

// helperChildStdin mantém o pipe do stdin do filho aberto enquanto o processo pai auxiliar viver.
var helperChildStdin io.WriteCloser

// TestLifecycleHelperProcess não é um teste: é o ponto de entrada dos processos auxiliares, reexecutados
// a partir do próprio binário de teste.
func TestLifecycleHelperProcess(t *testing.T) {
	switch os.Getenv(helperModeEnv) {
	case "parent":
		child := exec.Command(os.Args[0], "-test.run=^TestLifecycleHelperProcess$")
		child.Env = append(os.Environ(),
			helperModeEnv+"=child",
			fmt.Sprintf("%s=%d", parentPIDEnv, os.Getpid()),
		)
		stdin, err := child.StdinPipe()
		if err != nil {
			fmt.Println("erro:", err)
			os.Exit(1)
		}
		helperChildStdin = stdin
		if err := child.Start(); err != nil {
			fmt.Println("erro:", err)
			os.Exit(1)
		}
		fmt.Println("ready")
		select {} // espera ser morto pelo teste
	case "child":
		pid := parseParentPID(os.Getenv(parentPIDEnv))
		select {
		case reason := <-startWatchdog(os.Stdin, pid, 100*time.Millisecond):
			_ = os.WriteFile(os.Getenv(helperMarkerEnv), []byte(reason), 0o644)
			os.Exit(0)
		case <-time.After(15 * time.Second):
			os.Exit(2) // nunca sobra processo se o watchdog falhar
		}
	case "crash":
		if err := setCrashLog(os.Getenv(logFileEnv)); err != nil {
			fmt.Println("erro:", err)
			os.Exit(1)
		}
		panic("crash de teste 052")
	default:
		t.Skip("ponto de entrada de processo auxiliar")
	}
}

// TestSetCrashLog_PanicVaiParaArquivoEStderr cobre 052/RF-5202: o panic não tratado chega ao arquivo de log, em
// append, e continua no stderr.
func TestSetCrashLog_PanicVaiParaArquivoEStderr(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mlab-backend.log")
	if err := os.WriteFile(path, []byte("linha anterior\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(os.Args[0], "-test.run=^TestLifecycleHelperProcess$")
	cmd.Env = append(os.Environ(), helperModeEnv+"=crash", logFileEnv+"="+path)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err == nil {
		t.Fatal("o processo auxiliar deveria terminar com erro pelo panic")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	if !strings.HasPrefix(got, "linha anterior\n") {
		t.Fatalf("o log deve ser aberto em append: %q", got)
	}
	for _, want := range []string{"panic: crash de teste 052", "goroutine "} {
		if !strings.Contains(got, want) {
			t.Errorf("o arquivo deveria conter %q:\n%s", want, got)
		}
	}
	if !strings.Contains(stderr.String(), "panic: crash de teste 052") {
		t.Errorf("o stderr deveria continuar com o panic:\n%s", stderr.String())
	}
}

// TestSetCrashLog_CaminhoInvalidoDevolveErro cobre 052/RF-5203: sem conseguir abrir o arquivo, devolve o erro para o
// main avisar e seguir.
func TestSetCrashLog_CaminhoInvalidoDevolveErro(t *testing.T) {
	blocker := filepath.Join(t.TempDir(), "arquivo")
	if err := os.WriteFile(blocker, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := setCrashLog(filepath.Join(blocker, "mlab-backend.log")); err == nil {
		t.Fatal("caminho dentro de um arquivo deveria falhar")
	}
}

func TestWatchdog_PaiMortoEncerraFilho(t *testing.T) {
	if testing.Short() {
		t.Skip("processo auxiliar")
	}
	marker := filepath.Join(t.TempDir(), "watchdog-disparou")
	parent := exec.Command(os.Args[0], "-test.run=^TestLifecycleHelperProcess$")
	parent.Env = append(os.Environ(), helperModeEnv+"=parent", helperMarkerEnv+"="+marker)
	stdout, err := parent.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := parent.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = parent.Process.Kill(); _, _ = parent.Process.Wait() })

	line, err := bufio.NewReader(stdout).ReadString('\n')
	if err != nil || strings.TrimSpace(line) != "ready" {
		t.Fatalf("processo pai auxiliar não ficou pronto: %q %v", line, err)
	}
	if _, err := os.Stat(marker); err == nil {
		t.Fatal("o watchdog disparou com o pai vivo")
	}

	if err := parent.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	killedAt := time.Now()
	for time.Since(killedAt) < 3*time.Second {
		if data, err := os.ReadFile(marker); err == nil && len(data) > 0 {
			t.Logf("filho encerrou em %s: %s", time.Since(killedAt).Round(time.Millisecond), data)
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("o filho não encerrou em até 3 s após a morte do pai")
}
