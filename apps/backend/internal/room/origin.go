package room

import (
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// publicURLEnvs são as variáveis que podem expor o backend por outro host (ngrok, proxy, DNS).
var publicURLEnvs = []string{"NGROK_URL", "PUBLIC_URL", "BASE_URL"}

// IsAllowedOrigin decide se uma requisição de navegador pode usar a API ou o WebSocket a partir
// da origem informada (002-security-hardening/S6). É usada pelo CheckOrigin do WebSocket e pelo CORS.
//
// Aceita:
//   - Origin ausente (clientes que não são navegador);
//   - "null" e "file://" (renderer do app Electron empacotado);
//   - o mesmo host da requisição (web app servido pelo próprio backend, LAN, mlab.local, ngrok);
//   - localhost, 127.0.0.1 e ::1 em qualquer porta (desenvolvimento e app desktop);
//   - mlab.local e mlab-<professor>.local (mDNS);
//   - hosts de NGROK_URL, PUBLIC_URL e BASE_URL;
//   - o IP físico de rede anunciado pelo backend (ex.: Vite em desenvolvimento acessado pela LAN).
func IsAllowedOrigin(origin string, r *http.Request) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" || origin == "null" {
		return true
	}

	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	switch strings.ToLower(u.Scheme) {
	case "file":
		return true
	case "http", "https":
	default:
		return false
	}

	host := strings.ToLower(u.Hostname())
	if host == "" {
		return false
	}

	if r != nil && host == strings.ToLower(hostWithoutPort(r.Host)) {
		return true
	}

	switch host {
	case "localhost", "127.0.0.1", "::1", "mlab.local":
		return true
	}
	if strings.HasPrefix(host, "mlab-") && strings.HasSuffix(host, ".local") {
		return true
	}

	for _, env := range publicURLEnvs {
		if v := os.Getenv(env); v != "" {
			if pu, err := url.Parse(v); err == nil && strings.EqualFold(pu.Hostname(), host) {
				return true
			}
		}
	}

	if ip := GetPrimaryPhysicalIP(); ip != "" && strings.EqualFold(ip, host) {
		return true
	}
	return false
}

// hostWithoutPort remove a porta de um valor Host ("10.0.0.5:8080", "[::1]:8080").
func hostWithoutPort(hostport string) string {
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		return h
	}
	return strings.Trim(hostport, "[]")
}
