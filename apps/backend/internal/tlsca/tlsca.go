// Package tlsca mantém a autoridade certificadora (CA) local da edição MLab HTTPS (ADR 0008, feature 011).
//
// A CA é criada uma vez por instalação do professor e reaproveitada nas execuções seguintes. Ela tem Name
// Constraints críticas que a limitam a nomes .local, localhost e IPs privados/loopback, de modo que não pode
// personificar sites da internet. Os certificados de servidor são emitidos sob demanda, em memória, para o nome
// (SNI) ou IP local de cada conexão TLS.
package tlsca

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	certFileName = "mlab-ca.crt"
	keyFileName  = "mlab-ca.key"

	caValidity   = 10 * 365 * 24 * time.Hour
	leafValidity = 30 * 24 * time.Hour
	// leafRenewBefore renova o certificado de servidor quando falta menos que isso para expirar.
	leafRenewBefore = 24 * time.Hour
	// clockSkew antecipa o NotBefore para tolerar relógios de aparelhos levemente atrasados.
	clockSkew = time.Hour
)

// PermittedDNSDomains são os únicos sufixos DNS que a CA pode emitir (RF-1101).
var PermittedDNSDomains = []string{"local", "localhost"}

// PermittedIPRanges são as únicas faixas de IP que a CA pode emitir (RF-1101).
var PermittedIPRanges = mustParseCIDRs(
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"169.254.0.0/16",
	"127.0.0.0/8",
	"::1/128",
	"fc00::/7",
	"fe80::/10",
)

// ErrNameNotAllowed indica um nome ou IP fora das Name Constraints da CA.
var ErrNameNotAllowed = errors.New("tlsca: nome fora das restrições da CA local")

// CA é a autoridade certificadora local carregada em memória.
type CA struct {
	cert    *x509.Certificate
	certPEM []byte
	key     *ecdsa.PrivateKey

	leafKey *ecdsa.PrivateKey
	now     func() time.Time

	mu    sync.Mutex
	cache map[string]*tls.Certificate
}

// LoadOrCreate lê a CA de dir (mlab-ca.crt e mlab-ca.key) ou, se ainda não existir, cria uma nova e grava os
// dois arquivos (a chave com permissão 0600). created informa se a CA foi gerada nesta chamada.
func LoadOrCreate(dir string) (ca *CA, created bool, err error) {
	certPath := filepath.Join(dir, certFileName)
	keyPath := filepath.Join(dir, keyFileName)

	certPEM, certErr := os.ReadFile(certPath)
	keyPEM, keyErr := os.ReadFile(keyPath)
	switch {
	case certErr == nil && keyErr == nil:
		ca, err = parse(certPEM, keyPEM)
		if err != nil {
			return nil, false, fmt.Errorf("tlsca: CA existente em %s é inválida: %w", dir, err)
		}
		return ca, false, nil
	case errors.Is(certErr, os.ErrNotExist) && errors.Is(keyErr, os.ErrNotExist):
		// segue para criar
	default:
		return nil, false, fmt.Errorf("tlsca: CA incompleta em %s (certificado: %v; chave: %v)", dir, certErr, keyErr)
	}

	certPEM, keyPEM, err = generateCA(time.Now())
	if err != nil {
		return nil, false, err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, false, fmt.Errorf("tlsca: criar %s: %w", dir, err)
	}
	if err := os.WriteFile(keyPath, keyPEM, 0o600); err != nil {
		return nil, false, fmt.Errorf("tlsca: gravar chave: %w", err)
	}
	if err := os.WriteFile(certPath, certPEM, 0o644); err != nil {
		return nil, false, fmt.Errorf("tlsca: gravar certificado: %w", err)
	}
	ca, err = parse(certPEM, keyPEM)
	if err != nil {
		return nil, false, err
	}
	return ca, true, nil
}

func generateCA(now time.Time) (certPEM, keyPEM []byte, err error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("tlsca: gerar chave da CA: %w", err)
	}
	host, _ := os.Hostname()
	cn := "MLab CA local"
	if host != "" {
		cn = fmt.Sprintf("MLab CA local (%s)", host)
	}
	serial, err := randomSerial()
	if err != nil {
		return nil, nil, err
	}
	tmpl := &x509.Certificate{
		SerialNumber:                serial,
		Subject:                     pkix.Name{CommonName: cn, Organization: []string{"MLab"}},
		NotBefore:                   now.Add(-clockSkew),
		NotAfter:                    now.Add(caValidity),
		IsCA:                        true,
		BasicConstraintsValid:       true,
		MaxPathLen:                  0,
		MaxPathLenZero:              true,
		KeyUsage:                    x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		PermittedDNSDomainsCritical: true,
		PermittedDNSDomains:         PermittedDNSDomains,
		PermittedIPRanges:           PermittedIPRanges,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return nil, nil, fmt.Errorf("tlsca: assinar CA: %w", err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return nil, nil, fmt.Errorf("tlsca: serializar chave: %w", err)
	}
	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM = pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
	return certPEM, keyPEM, nil
}

func parse(certPEM, keyPEM []byte) (*CA, error) {
	cb, _ := pem.Decode(certPEM)
	if cb == nil || cb.Type != "CERTIFICATE" {
		return nil, errors.New("certificado PEM ausente")
	}
	cert, err := x509.ParseCertificate(cb.Bytes)
	if err != nil {
		return nil, err
	}
	if !cert.IsCA {
		return nil, errors.New("certificado não é de CA")
	}
	kb, _ := pem.Decode(keyPEM)
	if kb == nil {
		return nil, errors.New("chave PEM ausente")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(kb.Bytes)
	if err != nil {
		return nil, err
	}
	key, ok := parsed.(*ecdsa.PrivateKey)
	if !ok {
		return nil, errors.New("chave da CA não é ECDSA")
	}
	pub, ok := cert.PublicKey.(*ecdsa.PublicKey)
	if !ok || !pub.Equal(&key.PublicKey) {
		return nil, errors.New("chave não corresponde ao certificado")
	}
	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	return &CA{
		cert:    cert,
		certPEM: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Raw}),
		key:     key,
		leafKey: leafKey,
		now:     time.Now,
		cache:   map[string]*tls.Certificate{},
	}, nil
}

// Certificate devolve o certificado da CA.
func (c *CA) Certificate() *x509.Certificate { return c.cert }

// CertPEM devolve o certificado da CA em PEM (nunca a chave).
func (c *CA) CertPEM() []byte { return append([]byte(nil), c.certPEM...) }

// FingerprintSHA256 devolve o SHA-256 do certificado da CA em hex maiúsculo separado por ":".
func (c *CA) FingerprintSHA256() string {
	sum := sha256.Sum256(c.cert.Raw)
	parts := make([]string, len(sum))
	for i, b := range sum {
		parts[i] = strings.ToUpper(hex.EncodeToString([]byte{b}))
	}
	return strings.Join(parts, ":")
}

// Fingerprint devolve a impressão digital curta para conferência visual: os 8 primeiros bytes do SHA-256 em
// 4 grupos de 4 dígitos hex (ex.: "A1B2 C3D4 E5F6 0718").
func (c *CA) Fingerprint() string {
	sum := sha256.Sum256(c.cert.Raw)
	h := strings.ToUpper(hex.EncodeToString(sum[:8]))
	return h[0:4] + " " + h[4:8] + " " + h[8:12] + " " + h[12:16]
}

// GetCertificate é o callback de tls.Config: emite (ou reaproveita) o certificado de servidor para o SNI da
// conexão ou, sem SNI, para o IP local em que o cliente se conectou.
func (c *CA) GetCertificate(hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
	name := strings.TrimSuffix(strings.ToLower(hello.ServerName), ".")
	if name == "" && hello.Conn != nil {
		if addr, ok := hello.Conn.LocalAddr().(*net.TCPAddr); ok {
			name = addr.IP.String()
		}
	}
	if name == "" {
		name = "localhost"
	}
	return c.LeafFor(name)
}

// LeafFor devolve o certificado de servidor para um nome DNS ou IP permitido, emitindo um novo quando não houver
// em cache ou quando o atual estiver perto de expirar.
func (c *CA) LeafFor(name string) (*tls.Certificate, error) {
	name = normalizeName(name)
	if !Allowed(name) {
		return nil, fmt.Errorf("%w: %q", ErrNameNotAllowed, name)
	}
	now := c.now()

	c.mu.Lock()
	defer c.mu.Unlock()
	if cert, ok := c.cache[name]; ok && cert.Leaf != nil && now.Add(leafRenewBefore).Before(cert.Leaf.NotAfter) {
		return cert, nil
	}
	cert, err := c.issue(name, now)
	if err != nil {
		return nil, err
	}
	c.cache[name] = cert
	return cert, nil
}

func (c *CA) issue(name string, now time.Time) (*tls.Certificate, error) {
	serial, err := randomSerial()
	if err != nil {
		return nil, err
	}
	tmpl := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: name, Organization: []string{"MLab"}},
		NotBefore:             now.Add(-clockSkew),
		NotAfter:              now.Add(leafValidity),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}
	if ip := net.ParseIP(name); ip != nil {
		tmpl.IPAddresses = []net.IP{ip}
	} else {
		tmpl.DNSNames = []string{name}
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, c.cert, &c.leafKey.PublicKey, c.key)
	if err != nil {
		return nil, fmt.Errorf("tlsca: emitir certificado para %q: %w", name, err)
	}
	leaf, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, err
	}
	return &tls.Certificate{
		Certificate: [][]byte{der, c.cert.Raw},
		PrivateKey:  c.leafKey,
		Leaf:        leaf,
	}, nil
}

// Allowed informa se um nome DNS ou IP está dentro das Name Constraints da CA.
func Allowed(name string) bool {
	name = normalizeName(name)
	if name == "" {
		return false
	}
	if ip := net.ParseIP(name); ip != nil {
		for _, r := range PermittedIPRanges {
			if r.Contains(ip) {
				return true
			}
		}
		return false
	}
	for _, d := range PermittedDNSDomains {
		if name == d || strings.HasSuffix(name, "."+d) {
			return true
		}
	}
	return false
}

func normalizeName(name string) string {
	return strings.TrimSuffix(strings.Trim(strings.ToLower(strings.TrimSpace(name)), "[]"), ".")
}

func randomSerial() (*big.Int, error) {
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 127))
	if err != nil {
		return nil, fmt.Errorf("tlsca: gerar número de série: %w", err)
	}
	return serial, nil
}

func mustParseCIDRs(cidrs ...string) []*net.IPNet {
	out := make([]*net.IPNet, 0, len(cidrs))
	for _, c := range cidrs {
		_, n, err := net.ParseCIDR(c)
		if err != nil {
			panic(err)
		}
		out = append(out, n)
	}
	return out
}
