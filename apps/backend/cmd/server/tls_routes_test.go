package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/MateusARJ/MLAB/apps/backend/internal/tlsca"
)

func newRoutesCA(t *testing.T) *tlsca.CA {
	t.Helper()
	ca, _, err := tlsca.LoadOrCreate(filepath.Join(t.TempDir(), "tls"))
	if err != nil {
		t.Fatal(err)
	}
	return ca
}

func tlsMux(ca *tlsca.CA, gate bool) http.Handler {
	mux := http.NewServeMux()
	registerTLSRoutes(mux, ca, "8443", gate)
	return corsMiddleware(mux)
}

func getInfo(t *testing.T, h http.Handler) tlsInfo {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/tls/info", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("/tls/info = %d", rec.Code)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("/tls/info deve ter Cache-Control: no-store")
	}
	var info tlsInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &info); err != nil {
		t.Fatal(err)
	}
	return info
}

func TestTLSRoutes_Disabled(t *testing.T) {
	h := tlsMux(nil, true)
	if info := getInfo(t, h); info.Enabled || info.Fingerprint != "" {
		t.Fatalf("TLS desligado deve devolver só enabled=false: %+v", info)
	}
	for _, path := range []string{"/mlab-ca.crt", "/tls/ok"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s com TLS desligado = %d, esperado 404", path, rec.Code)
		}
	}
}

func TestTLSRoutes_InfoEnabled(t *testing.T) {
	ca := newRoutesCA(t)
	info := getInfo(t, tlsMux(ca, true))
	if !info.Enabled || info.Port != "8443" || info.CAURL != "/mlab-ca.crt" {
		t.Fatalf("info inesperada: %+v", info)
	}
	if info.Fingerprint != ca.Fingerprint() || info.FingerprintSHA256 != ca.FingerprintSHA256() {
		t.Fatalf("impressão digital divergente: %+v", info)
	}
}

// No modo dev com redirecionamento ao Vite a página do aluno não pode ir para HTTPS (RF-1105, C-1106).
func TestTLSRoutes_InfoDisabledInDevRedirectMode(t *testing.T) {
	ca := newRoutesCA(t)
	info := getInfo(t, tlsMux(ca, false))
	if info.Enabled {
		t.Fatal("enabled deve ser false no modo de desenvolvimento")
	}
	if info.Fingerprint == "" {
		t.Fatal("a impressão digital continua disponível para o app do professor")
	}
}

func TestTLSRoutes_CACertDownload(t *testing.T) {
	ca := newRoutesCA(t)
	rec := httptest.NewRecorder()
	tlsMux(ca, true).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/mlab-ca.crt", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	for k, want := range map[string]string{
		"Content-Type":           "application/x-x509-ca-cert",
		"Content-Disposition":    `attachment; filename="mlab-ca.crt"`,
		"Cache-Control":          "no-store",
		"X-Content-Type-Options": "nosniff",
	} {
		if got := rec.Header().Get(k); got != want {
			t.Fatalf("%s = %q, esperado %q", k, got, want)
		}
	}
	block, rest := pem.Decode(rec.Body.Bytes())
	if block == nil || block.Type != "CERTIFICATE" || len(rest) != 0 {
		t.Fatal("corpo deve ser exatamente um certificado PEM (nunca a chave)")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil || !cert.Equal(ca.Certificate()) {
		t.Fatalf("certificado servido difere da CA: %v", err)
	}
}

func TestTLSRoutes_OkOnlyOverHTTPS(t *testing.T) {
	ca := newRoutesCA(t)
	rec := httptest.NewRecorder()
	tlsMux(ca, true).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/tls/ok", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("/tls/ok por HTTP = %d, esperado 404", rec.Code)
	}
}

// Servidor HTTPS real (mesma montagem do main): o aparelho que confia na CA recebe /tls/ok com CORS para a
// origem HTTP do mesmo host (RF-1103, RF-1104).
func TestTLSServer_OkWithCORSForHTTPOrigin(t *testing.T) {
	ca := newRoutesCA(t)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	_, port, _ := net.SplitHostPort(ln.Addr().String())
	srv := newTLSServer(port, tlsMux(ca, true), ca)
	go func() { _ = srv.ServeTLS(ln, "", "") }()
	defer srv.Close()

	pool := x509.NewCertPool()
	pool.AddCert(ca.Certificate())
	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool}}}

	req, _ := http.NewRequest(http.MethodGet, "https://127.0.0.1:"+port+"/tls/ok", nil)
	req.Header.Set("Origin", "http://127.0.0.1:8080")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET /tls/ok: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK || string(body) != `{"ok":true}` {
		t.Fatalf("resposta = %d %q", resp.StatusCode, body)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "http://127.0.0.1:8080" {
		t.Fatalf("CORS = %q, esperado a origem HTTP do mesmo host", got)
	}
	if resp.ProtoMajor != 1 {
		t.Fatalf("protocolo = %s, esperado HTTP/1.1", resp.Proto)
	}
	if resp.TLS == nil || resp.TLS.Version < tls.VersionTLS12 {
		t.Fatal("conexão deve usar TLS 1.2 ou superior")
	}

	// Sem a CA no pool o aparelho não confia: é o caso em que a página mostra a instalação.
	untrusted := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{}}}
	if _, err := untrusted.Get("https://127.0.0.1:" + port + "/tls/ok"); err == nil {
		t.Fatal("cliente sem a CA instalada não deve confiar no servidor")
	}
}
