package room

import (
	"net"
	"reflect"
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
