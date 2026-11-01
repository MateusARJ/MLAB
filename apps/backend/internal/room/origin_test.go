package room

import (
	"net/http/httptest"
	"testing"
)

func TestIsAllowedOrigin(t *testing.T) {
	t.Setenv("NGROK_URL", "https://aula-mlab.ngrok-free.app")
	t.Setenv("PUBLIC_URL", "")
	t.Setenv("BASE_URL", "")
	t.Setenv("NAT_1TO1_IP", "192.168.0.50") // fixa o IP físico anunciado pelo backend
	t.Setenv("PUBLIC_IP", "")

	cases := []struct {
		name    string
		origin  string
		reqHost string
		want    bool
	}{
		// Cenários legítimos (não podem regredir)
		{"sem Origin (cliente não navegador)", "", "localhost:8080", true},
		{"renderer Electron empacotado (null)", "null", "localhost:8080", true},
		{"renderer Electron empacotado (file://)", "file://", "localhost:8080", true},
		{"renderer Electron em dev", "http://localhost:5173", "localhost:8080", true},
		{"127.0.0.1 em qualquer porta", "http://127.0.0.1:4173", "127.0.0.1:8080", true},
		{"IPv6 loopback", "http://[::1]:5173", "[::1]:8080", true},
		{"web do aluno servido pelo backend na LAN", "http://192.168.0.50:8080", "192.168.0.50:8080", true},
		{"web do aluno em outra interface do mesmo host", "http://10.1.2.3:8080", "10.1.2.3:8080", true},
		{"link institucional mlab.local", "http://mlab.local:8080", "mlab.local:8080", true},
		{"mlab-professor.local via proxy", "http://mlab-silva.local:8080", "localhost:8080", true},
		{"túnel ngrok", "https://aula-mlab.ngrok-free.app", "aula-mlab.ngrok-free.app", true},
		{"túnel ngrok via proxy local", "https://aula-mlab.ngrok-free.app", "localhost:8080", true},
		{"Vite dev acessado pela LAN (proxy para localhost)", "http://192.168.0.50:5173", "localhost:8080", true},
		{"celular acessando IP do professor", "http://192.168.0.50:8080", "192.168.0.50:8080", true},

		// Origens que devem ser recusadas
		{"site de terceiros", "https://site-malicioso.example", "192.168.0.50:8080", false},
		{"outro IP da LAN", "http://192.168.0.77:8080", "192.168.0.50:8080", false},
		{"domínio parecido com mlab.local", "http://mlab.local.example.com", "localhost:8080", false},
		{"esquema não suportado", "ftp://localhost", "localhost:8080", false},
		{"origem malformada", "http://%zz", "localhost:8080", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/ws/rooms/x/signal", nil)
			r.Host = tc.reqHost
			if got := IsAllowedOrigin(tc.origin, r); got != tc.want {
				t.Fatalf("IsAllowedOrigin(%q, host=%q) = %v, want %v", tc.origin, tc.reqHost, got, tc.want)
			}
		})
	}
}
