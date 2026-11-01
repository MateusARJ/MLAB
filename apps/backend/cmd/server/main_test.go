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
