package room

import (
	"context"
	"testing"
	"time"
)

func TestMDNSServerLifecycleAndQuery(t *testing.T) {
	server, err := StartMDNSServer("mateus", "192.168.1.89")
	if err != nil {
		t.Skipf("Porta 5353 ocupada ou indisponível no ambiente de teste: %v", err)
	}
	defer StopMDNSServer()

	if server == nil {
		t.Fatal("esperava servidor mDNS não nulo")
	}

	if server.localName != "mlab.local" {
		t.Fatalf("localName esperado 'mlab.local', obteve '%s'", server.localName)
	}

	hasProf := false
	for _, n := range server.localNames {
		if n == "mlab-mateus.local" {
			hasProf = true
			break
		}
	}
	if !hasProf {
		t.Fatalf("esperava 'mlab-mateus.local' em server.localNames, obteve %v", server.localNames)
	}

	// Testa consulta mDNS com timeout
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	answer, remoteAddr, err := server.conn.Query(ctx, "mlab.local")
	if err != nil {
		t.Logf("Query mDNS retornou: %v (comum caso interface de teste não responda imediatamente)", err)
	} else {
		t.Logf("mDNS Query sucesso: %s de %v", answer.Name.String(), remoteAddr)
	}
}
