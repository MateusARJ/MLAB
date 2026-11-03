package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSpaHandler(t *testing.T) {
	// Cria diretório temporário para simular webDir
	tempDir, err := os.MkdirTemp("", "mlab-web-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Cria index.html simulado
	indexContent := "<html><body><div id='root'>MLab Web App</div></body></html>"
	if err := os.WriteFile(filepath.Join(tempDir, "index.html"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("failed to write index.html: %v", err)
	}

	// Cria subpasta assets com um arquivo JS simulado
	assetsDir := filepath.Join(tempDir, "assets")
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		t.Fatalf("failed to create assets dir: %v", err)
	}
	jsContent := "console.log('mlab-test');"
	if err := os.WriteFile(filepath.Join(assetsDir, "index-123.js"), []byte(jsContent), 0644); err != nil {
		t.Fatalf("failed to write index-123.js: %v", err)
	}

	handler := spaHandler(tempDir)

	// 1. Testa rota raiz "/" -> deve retornar index.html
	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "MLab Web App") {
		t.Errorf("expected body to contain 'MLab Web App', got %q", rec.Body.String())
	}

	// 2. Testa rota de SPA de entrada de aluno "/algoritmos/professor/entrar" -> deve retornar index.html
	req = httptest.NewRequest("GET", "/algoritmos/professor/entrar", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for SPA route, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "MLab Web App") {
		t.Errorf("expected body to contain 'MLab Web App', got %q", rec.Body.String())
	}

	// 3. Testa rota de asset estático "/assets/index-123.js" -> deve retornar o arquivo JS
	req = httptest.NewRequest("GET", "/assets/index-123.js", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for static asset, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "mlab-test") {
		t.Errorf("expected body to contain 'mlab-test', got %q", rec.Body.String())
	}
}

func TestEnsureJWTSecret_GeneratesRandomWhenMissing(t *testing.T) {
	t.Setenv("JWT_SECRET", "")

	generated, err := ensureJWTSecret()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !generated {
		t.Fatal("expected secret to be generated when JWT_SECRET is empty")
	}
	first := os.Getenv("JWT_SECRET")
	if len(first) != jwtSecretBytes*2 {
		t.Fatalf("expected %d hex chars, got %d", jwtSecretBytes*2, len(first))
	}
	if first == "dev-secret-key-12345" {
		t.Fatal("secret must never be the legacy fixed value")
	}

	os.Setenv("JWT_SECRET", "")
	if _, err := ensureJWTSecret(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if second := os.Getenv("JWT_SECRET"); second == first {
		t.Fatal("expected a different secret on each generation")
	}
}

func TestEnsureJWTSecret_KeepsProvidedSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "segredo-fornecido-pelo-ambiente")

	generated, err := ensureJWTSecret()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if generated {
		t.Fatal("must not generate a secret when JWT_SECRET is provided")
	}
	if got := os.Getenv("JWT_SECRET"); got != "segredo-fornecido-pelo-ambiente" {
		t.Fatalf("provided secret was changed: %q", got)
	}
}

func TestCorsMiddleware_AllowlistedOriginIsReflected(t *testing.T) {
	t.Setenv("NAT_1TO1_IP", "192.168.0.50")
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	h := corsMiddleware(next)

	req := httptest.NewRequest("OPTIONS", "/auth/session", nil)
	req.Host = "localhost:8080"
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("expected reflected origin, got %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(got, "X-MLab-Host-Key") {
		t.Fatalf("expected X-MLab-Host-Key in allowed headers, got %q", got)
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for preflight, got %d", rec.Code)
	}
}

func TestCorsMiddleware_UnknownOriginGetsNoCorsHeaders(t *testing.T) {
	t.Setenv("NAT_1TO1_IP", "192.168.0.50")
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	h := corsMiddleware(next)

	req := httptest.NewRequest("GET", "/rooms/active", nil)
	req.Host = "192.168.0.50:8080"
	req.Header.Set("Origin", "https://site-malicioso.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no Access-Control-Allow-Origin for unknown origin, got %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got == "*" {
		t.Fatal("wildcard CORS must never be used")
	}
}

// ── 008-dev-entrada-unica-web ───────────────────────────────────────────────

// Faixa UDP própria (o harness do smoke só existe com a build tag "smoke").
const (
	devTestUDPPortMin = 53000
	devTestUDPPortMax = 53100
)

func newWebDirWithIndex(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>BUILD ANTIGO</html>"), 0644); err != nil {
		t.Fatalf("write index.html: %v", err)
	}
	return dir
}

func serve(h http.Handler, method, target, host string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	if host != "" {
		req.Host = host
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestResolveDevWebPort(t *testing.T) {
	t.Setenv("MLAB_DEV_MONOREPO", "")
	t.Setenv("WEB_PORT", "")
	if got := resolveDevWebPort(); got != "" {
		t.Errorf("fora do modo dev esperado \"\", obtido %q", got)
	}
	t.Setenv("MLAB_DEV_MONOREPO", "1")
	if got := resolveDevWebPort(); got != "5173" {
		t.Errorf("modo dev sem WEB_PORT: esperado 5173, obtido %q", got)
	}
	t.Setenv("WEB_PORT", "5180")
	if got := resolveDevWebPort(); got != "5180" {
		t.Errorf("modo dev com WEB_PORT: esperado 5180, obtido %q", got)
	}
}

// RF-801/RF-802/RNF-801: no modo dev as páginas vão para o Vite, a API continua na 8080.
func TestNewServer_DevMode_RedirectsPagesAndKeepsAPI(t *testing.T) {
	handler, err := newServer(serverConfig{
		UDPPortMin: devTestUDPPortMin,
		UDPPortMax: devTestUDPPortMax,
		WebDir:     newWebDirWithIndex(t),
		DevWebPort: "5173",
	})
	if err != nil {
		t.Fatalf("newServer: %v", err)
	}

	rec := serve(handler, http.MethodGet, "/algoritmos/prof/entrar?sala=abc", "192.168.0.10:8080")
	if rec.Code != http.StatusTemporaryRedirect {
		t.Fatalf("GET página: esperado 307, obtido %d", rec.Code)
	}
	if loc := rec.Header().Get("Location"); loc != "http://192.168.0.10:5173/algoritmos/prof/entrar?sala=abc" {
		t.Errorf("Location inesperado: %q", loc)
	}
	if strings.Contains(rec.Body.String(), "BUILD ANTIGO") {
		t.Error("o build antigo de WebDir não deve ser servido no modo dev")
	}

	if rec := serve(handler, http.MethodHead, "/", "localhost:8080"); rec.Code != http.StatusTemporaryRedirect ||
		rec.Header().Get("Location") != "http://localhost:5173/" {
		t.Errorf("HEAD /: esperado 307 para http://localhost:5173/, obtido %d %q", rec.Code, rec.Header().Get("Location"))
	}

	if rec := serve(handler, http.MethodGet, "/", "[fe80::1]:8080"); rec.Header().Get("Location") != "http://[fe80::1]:5173/" {
		t.Errorf("IPv6: Location inesperado %q", rec.Header().Get("Location"))
	}

	if rec := serve(handler, http.MethodPost, "/qualquer", "localhost:8080"); rec.Code != http.StatusNotFound {
		t.Errorf("POST fora da API: esperado 404, obtido %d", rec.Code)
	}

	if rec := serve(handler, http.MethodGet, "/health", "localhost:8080"); rec.Code != http.StatusOK {
		t.Errorf("/health no modo dev: esperado 200, obtido %d", rec.Code)
	}

	if rec := serve(handler, http.MethodPost, "/rooms/inexistente/join", "localhost:8080"); rec.Code == http.StatusTemporaryRedirect {
		t.Error("rota de API não pode ser redirecionada no modo dev")
	}
}

// RF-803: fora do modo dev (app empacotado) a 8080 continua servindo o web do aluno.
func TestNewServer_PackagedMode_ServesWebDir(t *testing.T) {
	handler, err := newServer(serverConfig{
		UDPPortMin: devTestUDPPortMin,
		UDPPortMax: devTestUDPPortMax,
		WebDir:     newWebDirWithIndex(t),
	})
	if err != nil {
		t.Fatalf("newServer: %v", err)
	}
	rec := serve(handler, http.MethodGet, "/algoritmos/prof/entrar", "192.168.0.10:8080")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "BUILD ANTIGO") {
		t.Errorf("modo empacotado: esperado 200 com o index de WebDir, obtido %d", rec.Code)
	}
}
