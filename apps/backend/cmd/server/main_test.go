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
