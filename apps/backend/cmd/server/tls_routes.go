package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/tlsca"
)

// defaultTLSPort é a porta HTTPS padrão da edição MLab HTTPS (ADR 0008, contrato 011/tls.md).
const defaultTLSPort = "8443"

// tlsInfo é a resposta de GET /tls/info (contrato 011/tls.md).
type tlsInfo struct {
	Enabled           bool   `json:"enabled"`
	Port              string `json:"port,omitempty"`
	Fingerprint       string `json:"fingerprint,omitempty"`
	FingerprintSHA256 string `json:"fingerprint_sha256,omitempty"`
	CAURL             string `json:"ca_url,omitempty"`
}

// loadTLSFromEnv carrega a CA local quando MLAB_TLS=1 (RF-1101, RF-1103). Devolve nil, "" com o TLS desligado.
// A CA fica em MLAB_TLS_DIR (padrão "tls", relativo ao diretório de trabalho — o userData do app).
func loadTLSFromEnv() (*tlsca.CA, string, error) {
	if os.Getenv("MLAB_TLS") != "1" {
		return nil, "", nil
	}
	dir := os.Getenv("MLAB_TLS_DIR")
	if dir == "" {
		dir = "tls"
	}
	ca, created, err := tlsca.LoadOrCreate(dir)
	if err != nil {
		return nil, "", err
	}
	if created {
		log.Printf("HTTPS: CA local criada em %s (impressão digital %s)", dir, ca.Fingerprint())
	} else {
		log.Printf("HTTPS: CA local carregada de %s (impressão digital %s)", dir, ca.Fingerprint())
	}
	port := os.Getenv("WEB_TLS_PORT")
	if port == "" {
		port = defaultTLSPort
	}
	return ca, port, nil
}

// newTLSServer monta o servidor HTTPS com o mesmo handler do HTTP (RF-1103): certificados sob demanda pela CA
// local, TLS 1.2 ou superior e só HTTP/1.1 (o WebSocket via gorilla exige HTTP/1.1).
func newTLSServer(port string, handler http.Handler, ca *tlsca.CA) *http.Server {
	return &http.Server{
		Addr:    ":" + port,
		Handler: handler,
		TLSConfig: &tls.Config{
			GetCertificate: ca.GetCertificate,
			MinVersion:     tls.VersionTLS12,
			NextProtos:     []string{"http/1.1"},
		},
		TLSNextProto:      map[string]func(*http.Server, *tls.Conn, http.Handler){},
		ReadHeaderTimeout: 10 * time.Second,
	}
}

// registerTLSRoutes registra /tls/info, /tls/ok e /mlab-ca.crt (RF-1104, RF-1105). ca nil = TLS desligado.
// gateEnabled é falso no modo de desenvolvimento que redireciona as páginas ao Vite, para a página do aluno não
// tentar ir para HTTPS (o que entraria em laço — C-1106).
func registerTLSRoutes(mux *http.ServeMux, ca *tlsca.CA, port string, gateEnabled bool) {
	mux.HandleFunc("GET /tls/info", func(w http.ResponseWriter, r *http.Request) {
		info := tlsInfo{Enabled: false}
		if ca != nil {
			info = tlsInfo{
				Enabled:           gateEnabled,
				Port:              port,
				Fingerprint:       ca.Fingerprint(),
				FingerprintSHA256: ca.FingerprintSHA256(),
				CAURL:             "/mlab-ca.crt",
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(info)
	})

	mux.HandleFunc("GET /tls/ok", func(w http.ResponseWriter, r *http.Request) {
		if ca == nil || r.TLS == nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		fmt.Fprint(w, `{"ok":true}`)
	})

	mux.HandleFunc("GET /mlab-ca.crt", func(w http.ResponseWriter, r *http.Request) {
		if ca == nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/x-x509-ca-cert")
		w.Header().Set("Content-Disposition", `attachment; filename="mlab-ca.crt"`)
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(ca.CertPEM())
	})
}
