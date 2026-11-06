package tlsca

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/asn1"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

// oidNameConstraints é o OID da extensão Name Constraints (RFC 5280 §4.2.1.10).
var oidNameConstraints = asn1.ObjectIdentifier{2, 5, 29, 30}

func newTestCA(t *testing.T) (*CA, string) {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "tls")
	ca, created, err := LoadOrCreate(dir)
	if err != nil {
		t.Fatalf("LoadOrCreate: %v", err)
	}
	if !created {
		t.Fatal("esperava CA criada na primeira chamada")
	}
	return ca, dir
}

func TestLoadOrCreate_ReusesExistingCA(t *testing.T) {
	ca1, dir := newTestCA(t)

	ca2, created, err := LoadOrCreate(dir)
	if err != nil {
		t.Fatalf("segunda carga: %v", err)
	}
	if created {
		t.Fatal("a CA não deve ser recriada quando já existe")
	}
	if ca1.FingerprintSHA256() != ca2.FingerprintSHA256() {
		t.Fatal("a CA recarregada deve ser a mesma")
	}
}

func TestLoadOrCreate_KeyFilePermission(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("permissões POSIX não se aplicam no Windows (o userData já é do usuário)")
	}
	_, dir := newTestCA(t)
	info, err := os.Stat(filepath.Join(dir, keyFileName))
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("permissão da chave = %o, esperado 600", perm)
	}
}

func TestLoadOrCreate_IncompleteCAIsError(t *testing.T) {
	_, dir := newTestCA(t)
	if err := os.Remove(filepath.Join(dir, keyFileName)); err != nil {
		t.Fatal(err)
	}
	if _, _, err := LoadOrCreate(dir); err == nil {
		t.Fatal("CA sem chave deve falhar em vez de ser recriada silenciosamente")
	}
}

func TestCA_HasCriticalNameConstraints(t *testing.T) {
	ca, _ := newTestCA(t)
	cert := ca.Certificate()

	if !cert.IsCA || !cert.MaxPathLenZero || cert.MaxPathLen != 0 {
		t.Fatalf("CA deve ser IsCA com MaxPathLen 0 (IsCA=%v, MaxPathLen=%d)", cert.IsCA, cert.MaxPathLen)
	}
	if !cert.PermittedDNSDomainsCritical {
		t.Fatal("Name Constraints devem ser críticas")
	}
	var found bool
	for _, ext := range cert.Extensions {
		if ext.Id.Equal(oidNameConstraints) {
			found = true
			if !ext.Critical {
				t.Fatal("extensão Name Constraints deve ser crítica")
			}
		}
	}
	if !found {
		t.Fatal("extensão Name Constraints ausente")
	}
	if len(cert.PermittedDNSDomains) != 2 || len(cert.PermittedIPRanges) != len(PermittedIPRanges) {
		t.Fatalf("restrições inesperadas: dns=%v ips=%v", cert.PermittedDNSDomains, cert.PermittedIPRanges)
	}
}

func TestLeafFor_VerifiesForAllowedNames(t *testing.T) {
	ca, _ := newTestCA(t)
	pool := x509.NewCertPool()
	pool.AddCert(ca.Certificate())

	for _, name := range []string{"192.168.1.108", "10.0.0.5", "172.20.3.4", "127.0.0.1", "mlab.local", "mlab-prof-ana.local", "localhost"} {
		t.Run(name, func(t *testing.T) {
			cert, err := ca.LeafFor(name)
			if err != nil {
				t.Fatalf("LeafFor: %v", err)
			}
			_, err = cert.Leaf.Verify(x509.VerifyOptions{
				DNSName:   name,
				Roots:     pool,
				KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
			})
			if err != nil {
				t.Fatalf("Verify: %v", err)
			}
			if got := cert.Leaf.NotAfter.Sub(cert.Leaf.NotBefore); got > leafValidity+clockSkew {
				t.Fatalf("validade do servidor = %v, máximo %v", got, leafValidity+clockSkew)
			}
		})
	}
}

func TestLeafFor_RejectsNamesOutsideConstraints(t *testing.T) {
	ca, _ := newTestCA(t)
	for _, name := range []string{"example.com", "google.com", "8.8.8.8", "200.1.2.3", "mlab.local.evil.com", ""} {
		if _, err := ca.LeafFor(name); !errors.Is(err, ErrNameNotAllowed) {
			t.Fatalf("LeafFor(%q) err = %v, esperado ErrNameNotAllowed", name, err)
		}
	}
}

// Mesmo uma assinatura forçada para fora das restrições não é aceita pelo verificador (defesa em profundidade).
func TestNameConstraints_EnforcedByVerifier(t *testing.T) {
	ca, _ := newTestCA(t)
	pool := x509.NewCertPool()
	pool.AddCert(ca.Certificate())

	forged, err := ca.issue("example.com", time.Now())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := forged.Leaf.Verify(x509.VerifyOptions{DNSName: "example.com", Roots: pool}); err == nil {
		t.Fatal("certificado para domínio público não pode ser válido sob a CA local")
	}
}

func TestLeafFor_CachesAndRenews(t *testing.T) {
	ca, _ := newTestCA(t)
	base := time.Now()
	ca.now = func() time.Time { return base }

	a, err := ca.LeafFor("mlab.local")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := ca.LeafFor("MLAB.local.")
	if a != b {
		t.Fatal("mesmo nome (normalizado) deve reaproveitar o cache")
	}

	ca.now = func() time.Time { return a.Leaf.NotAfter.Add(-time.Hour) }
	c, err := ca.LeafFor("mlab.local")
	if err != nil {
		t.Fatal(err)
	}
	if c == a {
		t.Fatal("certificado perto de expirar deve ser renovado")
	}
}

func TestFingerprint_Format(t *testing.T) {
	ca, _ := newTestCA(t)
	fp := ca.Fingerprint()
	if len(fp) != 19 || fp[4] != ' ' || fp[9] != ' ' || fp[14] != ' ' {
		t.Fatalf("formato curto inesperado: %q", fp)
	}
	full := ca.FingerprintSHA256()
	if len(full) != 32*3-1 {
		t.Fatalf("formato completo inesperado: %q", full)
	}
	if full[:2]+full[3:5] != fp[:4] {
		t.Fatalf("curta (%q) deve ser prefixo da completa (%q)", fp, full)
	}
}

func TestGetCertificate_ServesTLSWithLocalIPWithoutSNI(t *testing.T) {
	ca, _ := newTestCA(t)
	// Servidor montado como em produção: sem Certificates fixos, só GetCertificate (o httptest injetaria o
	// próprio certificado e o GetCertificate não seria chamado em conexões sem SNI).
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = io.WriteString(w, "ok")
		}),
		TLSConfig: &tls.Config{GetCertificate: ca.GetCertificate, MinVersion: tls.VersionTLS12},
	}
	go func() { _ = srv.ServeTLS(ln, "", "") }()
	defer srv.Close()
	_, port, _ := net.SplitHostPort(ln.Addr().String())

	pool := x509.NewCertPool()
	pool.AddCert(ca.Certificate())
	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool}}}

	// Conexão por IP: sem SNI, o certificado sai para o IP local.
	resp, err := client.Get("https://127.0.0.1:" + port)
	if err != nil {
		t.Fatalf("GET por IP: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if string(body) != "ok" {
		t.Fatalf("corpo = %q", body)
	}

	// Por nome (SNI localhost) também é aceito.
	resp, err = client.Get("https://localhost:" + port)
	if err != nil {
		t.Fatalf("GET por localhost: %v", err)
	}
	resp.Body.Close()
}

func TestAllowed(t *testing.T) {
	cases := map[string]bool{
		"mlab.local": true, "local": true, "localhost": true, "LOCALHOST.": true,
		"192.168.0.1": true, "::1": true, "[fe80::1]": true,
		"evil.com": false, "localhost.evil.com": false, "1.1.1.1": false, "": false,
	}
	for name, want := range cases {
		if got := Allowed(name); got != want {
			t.Errorf("Allowed(%q) = %v, esperado %v", name, got, want)
		}
	}
}
