package room

import (
	"net"
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestMDNSCandidates(t *testing.T) {
	got := mdnsCandidates(mdnsMaxNames)
	if len(got) != 20 {
		t.Fatalf("esperava 20 candidatos, obteve %d", len(got))
	}
	want := []string{"mlab.local", "mlab-2.local", "mlab-3.local"}
	if !reflect.DeepEqual(got[:3], want) {
		t.Fatalf("início esperado %v, obteve %v", want, got[:3])
	}
	if got[19] != "mlab-20.local" {
		t.Fatalf("último esperado mlab-20.local, obteve %s", got[19])
	}
}

func TestChooseName(t *testing.T) {
	candidates := mdnsCandidates(mdnsMaxNames)
	other := net.ParseIP("192.168.0.10")

	cases := []struct {
		name  string
		taken []string
		want  string
		ok    bool
	}{
		{"rede vazia", nil, "mlab.local", true},
		{"mlab.local ocupado", []string{"mlab.local"}, "mlab-2.local", true},
		{"buraco na sequência", []string{"mlab.local", "mlab-3.local"}, "mlab-2.local", true},
		{"todos ocupados", candidates, "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			taken := map[string]net.IP{}
			for _, n := range tc.taken {
				taken[n] = other
			}
			got, ok := chooseName(candidates, taken)
			if got != tc.want || ok != tc.ok {
				t.Fatalf("chooseName = (%q, %v), esperado (%q, %v)", got, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestYieldsName(t *testing.T) {
	cases := []struct {
		own, other string
		want       bool
	}{
		{"192.168.0.20", "192.168.0.10", true},
		{"192.168.0.10", "192.168.0.20", false},
		{"192.168.0.9", "192.168.0.10", false}, // comparação numérica, não de texto
		{"192.168.0.10", "192.168.0.10", false},
		{"192.168.0.10", "::1", false},
	}
	for _, tc := range cases {
		if got := yieldsName(net.ParseIP(tc.own), net.ParseIP(tc.other)); got != tc.want {
			t.Errorf("yieldsName(%s, %s) = %v, esperado %v", tc.own, tc.other, got, tc.want)
		}
	}
}

// TestLegacyProberDetectaNomeOcupado cobre RF-121: o prober marca o nome anunciado por outra máquina e ignora o
// nome anunciado com o próprio IP.
func TestLegacyProberDetectaNomeOcupado(t *testing.T) {
	ip := GetPrimaryPhysicalIP()
	ifc := findInterfaceByIP(ip)
	if ifc == nil || net.ParseIP(ip).To4() == nil {
		t.Skipf("sem interface física com IPv4 para o teste (IP detectado: %q)", ip)
	}

	defer iniciaResponderAlheio(t, ifc, "mlab.local")()
	defer iniciaResponder(t, ifc, ip, "mlab-2.local")()
	time.Sleep(200 * time.Millisecond)

	inicio := time.Now()
	taken, err := legacyProber{ifc: ifc, ownIP: net.ParseIP(ip)}.probe([]string{"mlab.local", "mlab-2.local", "mlab-3.local"})
	duracao := time.Since(inicio)
	if err != nil {
		t.Skipf("sondagem indisponível no ambiente: %v", err)
	}
	if len(taken) == 0 {
		t.Skip("nenhuma resposta à sondagem (multicast indisponível no ambiente)")
	}

	if got := taken["mlab.local"]; !got.Equal(net.ParseIP(ipAlheio)) {
		t.Errorf("mlab.local deveria estar ocupado por %s, obteve %v", ipAlheio, got)
	}
	if _, busy := taken["mlab-2.local"]; busy {
		t.Errorf("mlab-2.local é anunciado com o próprio IP e não pode contar como ocupado")
	}
	if _, busy := taken["mlab-3.local"]; busy {
		t.Errorf("mlab-3.local não é anunciado e não pode contar como ocupado")
	}
	if duracao > 1500*time.Millisecond {
		t.Errorf("sondagem levou %v; limite é 1,5 s (RNF-121)", duracao)
	}
	t.Logf("sondagem em %v: %v", duracao, taken)
}

// proberFalso devolve sempre os mesmos nomes ocupados, sem usar a rede.
type proberFalso struct {
	taken map[string]net.IP
	err   error
}

func (p proberFalso) probe([]string) (map[string]net.IP, error) { return p.taken, p.err }

// usaProberFalso troca o prober do claim por um falso até o fim do teste.
func usaProberFalso(t *testing.T, taken map[string]net.IP) {
	t.Helper()
	original := newMDNSProber
	newMDNSProber = func(*net.Interface, net.IP) nameProber { return proberFalso{taken: taken} }
	t.Cleanup(func() { newMDNSProber = original })
}

// TestClaimMDNSNameEscolheNome cobre RF-122, RF-124 e RF-126 com prober falso (só o socket 5353 é real).
func TestClaimMDNSNameEscolheNome(t *testing.T) {
	ip := GetPrimaryPhysicalIP()
	if net.ParseIP(ip).To4() == nil {
		t.Skipf("sem IPv4 de rede para o teste (IP detectado: %q)", ip)
	}
	other := net.ParseIP("192.0.2.10")

	t.Run("mlab.local ocupado", func(t *testing.T) {
		usaProberFalso(t, map[string]net.IP{"mlab.local": other})
		name, err := ClaimMDNSName(ip)
		if err != nil {
			t.Skipf("Porta 5353 indisponível: %v", err)
		}
		defer StopMDNSServer()
		if name != "mlab-2.local" || CurrentMDNSHost() != "mlab-2.local" {
			t.Fatalf("esperava mlab-2.local, obteve %q (CurrentMDNSHost=%q)", name, CurrentMDNSHost())
		}
	})

	t.Run("todos ocupados", func(t *testing.T) {
		taken := map[string]net.IP{}
		for _, n := range mdnsCandidates(mdnsMaxNames) {
			taken[n] = other
		}
		usaProberFalso(t, taken)
		name, err := ClaimMDNSName(ip)
		defer StopMDNSServer()
		if err == nil || name != "" || CurrentMDNSHost() != "" {
			t.Fatalf("esperava erro e nenhum anúncio, obteve (%q, %v), CurrentMDNSHost=%q", name, err, CurrentMDNSHost())
		}
	})

	t.Run("IP inválido", func(t *testing.T) {
		if _, err := ClaimMDNSName("nao-e-ip"); err == nil || CurrentMDNSHost() != "" {
			t.Fatalf("esperava erro e nenhum anúncio para IP inválido")
		}
	})
}

// proberMutavel permite mudar, durante o teste, os nomes que "outra máquina" anuncia.
type proberMutavel struct {
	mu    sync.Mutex
	taken map[string]net.IP
}

func (p *proberMutavel) set(taken map[string]net.IP) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.taken = taken
}

func (p *proberMutavel) probe(names []string) (map[string]net.IP, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := map[string]net.IP{}
	for _, n := range names {
		if ip, ok := p.taken[n]; ok {
			out[n] = ip
		}
	}
	return out, nil
}

// monitorRapido encurta os intervalos do monitor de conflito e injeta o prober dado até o fim do teste.
func monitorRapido(t *testing.T, p nameProber) {
	t.Helper()
	origProber, origWaits, origEvery := newMDNSProber, conflictCheckWaits, conflictCheckEvery
	newMDNSProber = func(*net.Interface, net.IP) nameProber { return p }
	conflictCheckWaits = []time.Duration{20 * time.Millisecond, 30 * time.Millisecond}
	conflictCheckEvery = 50 * time.Millisecond
	t.Cleanup(func() {
		newMDNSProber, conflictCheckWaits, conflictCheckEvery = origProber, origWaits, origEvery
	})
}

// esperaHost espera CurrentMDNSHost chegar ao valor dado.
func esperaHost(want string, prazo time.Duration) string {
	fim := time.Now().Add(prazo)
	for {
		got := CurrentMDNSHost()
		if got == want || time.Now().After(fim) {
			return got
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// TestMonitorDeConflitoCedeOuMantemNome cobre RF-125 com prober falso (só o socket 5353 é real).
func TestMonitorDeConflitoCedeOuMantemNome(t *testing.T) {
	ip := GetPrimaryPhysicalIP()
	if net.ParseIP(ip).To4() == nil {
		t.Skipf("sem IPv4 de rede para o teste (IP detectado: %q)", ip)
	}

	t.Run("IP alheio menor: cede e troca de nome", func(t *testing.T) {
		p := &proberMutavel{}
		monitorRapido(t, p)
		if _, err := ClaimMDNSName(ip); err != nil {
			t.Skipf("Porta 5353 indisponível: %v", err)
		}
		defer StopMDNSServer()

		p.set(map[string]net.IP{"mlab.local": net.ParseIP("0.0.0.1")})
		if got := esperaHost("mlab-2.local", 2*time.Second); got != "mlab-2.local" {
			t.Fatalf("esperava trocar para mlab-2.local depois do conflito, ficou com %q", got)
		}
	})

	t.Run("IP alheio maior: mantém o nome", func(t *testing.T) {
		p := &proberMutavel{}
		monitorRapido(t, p)
		if _, err := ClaimMDNSName(ip); err != nil {
			t.Skipf("Porta 5353 indisponível: %v", err)
		}
		defer StopMDNSServer()

		p.set(map[string]net.IP{"mlab.local": net.ParseIP("255.255.255.254")})
		time.Sleep(300 * time.Millisecond) // várias reconsultas
		if got := CurrentMDNSHost(); got != "mlab.local" {
			t.Fatalf("com IP alheio maior, deveria manter mlab.local; ficou com %q", got)
		}
	})

	t.Run("StopMDNSServer encerra o monitor", func(t *testing.T) {
		monitorRapido(t, &proberMutavel{})
		if _, err := ClaimMDNSName(ip); err != nil {
			t.Skipf("Porta 5353 indisponível: %v", err)
		}
		activeMDNSServerMu.Lock()
		m := activeMDNSServer
		activeMDNSServerMu.Unlock()

		StopMDNSServer()
		select {
		case <-m.done:
		case <-time.After(time.Second):
			t.Fatal("a goroutine do monitor continuou viva depois do StopMDNSServer")
		}
	})
}
