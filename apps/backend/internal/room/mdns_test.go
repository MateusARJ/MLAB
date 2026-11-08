package room

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/pion/mdns/v2"
	"golang.org/x/net/dns/dnsmessage"
	"golang.org/x/net/ipv4"
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

// consultaLegacy envia, de uma porta efêmera (consulta "legacy unicast", RFC 6762 §6.7), uma pergunta mDNS
// para 224.0.0.251:5353 pela interface do IP anunciado e devolve as respostas recebidas nessa porta até o prazo.
// É a forma como o resolvedor .local do Android 12+ pergunta: ele só escuta a própria porta efêmera.
func consultaLegacy(t *testing.T, ifc *net.Interface, id uint16, nome string, tipo dnsmessage.Type, prazo time.Duration) []dnsmessage.Message {
	t.Helper()

	conn, err := net.ListenPacket("udp4", "0.0.0.0:0")
	if err != nil {
		t.Skipf("sem socket UDP para a consulta: %v", err)
	}
	defer conn.Close()

	pc := ipv4.NewPacketConn(conn)
	if err := pc.SetMulticastInterface(ifc); err != nil {
		t.Skipf("sem multicast na interface %s: %v", ifc.Name, err)
	}
	_ = pc.SetMulticastLoopback(true)

	pergunta := dnsmessage.Message{
		Header: dnsmessage.Header{ID: id},
		Questions: []dnsmessage.Question{{
			Name:  dnsmessage.MustNewName(nome),
			Type:  tipo,
			Class: dnsmessage.ClassINET,
		}},
	}
	pacote, err := pergunta.Pack()
	if err != nil {
		t.Fatalf("falha ao montar a consulta: %v", err)
	}

	destino := &net.UDPAddr{IP: net.IPv4(224, 0, 0, 251), Port: 5353}
	if _, err := pc.WriteTo(pacote, nil, destino); err != nil {
		t.Skipf("falha ao enviar a consulta multicast: %v", err)
	}

	var respostas []dnsmessage.Message
	buf := make([]byte, 1500)
	fim := time.Now().Add(prazo)
	for time.Now().Before(fim) {
		_ = conn.SetReadDeadline(fim)
		n, _, err := conn.ReadFrom(buf)
		if err != nil {
			break
		}
		var msg dnsmessage.Message
		if err := msg.Unpack(buf[:n]); err != nil || !msg.Header.Response {
			continue
		}
		respostas = append(respostas, msg)
	}
	return respostas
}

// TestMDNSRespondeConsultaLegacyUnicast cobre RF-101 e RF-103 da feature 010: a consulta feita de porta efêmera
// recebe resposta unicast nessa porta, com o mesmo ID, a pergunta ecoada e o IP anunciado; AAAA não recebe A.
func TestMDNSRespondeConsultaLegacyUnicast(t *testing.T) {
	ip := GetPrimaryPhysicalIP()
	ifc := findInterfaceByIP(ip)
	if ifc == nil || net.ParseIP(ip).To4() == nil {
		t.Skipf("sem interface física com IPv4 para o teste (IP detectado: %q)", ip)
	}

	if _, err := StartMDNSServer("mateus", ip); err != nil {
		t.Skipf("Porta 5353 ocupada ou indisponível no ambiente de teste: %v", err)
	}
	defer StopMDNSServer()

	// Dá tempo ao servidor de entrar no grupo multicast.
	time.Sleep(200 * time.Millisecond)

	const id = 0x4d4c // "ML"
	respostas := consultaLegacy(t, ifc, id, "mlab.local.", dnsmessage.TypeA, 2*time.Second)
	if len(respostas) == 0 {
		t.Fatalf("nenhuma resposta unicast à consulta legacy de mlab.local (RF-101)")
	}

	var achou bool
	for _, r := range respostas {
		if r.Header.ID != id {
			continue
		}
		if len(r.Questions) != 1 || r.Questions[0].Name.String() != "mlab.local." {
			t.Errorf("resposta sem a pergunta original ecoada: %+v", r.Questions)
		}
		for _, a := range r.Answers {
			if body, ok := a.Body.(*dnsmessage.AResource); ok && net.IP(body.A[:]).Equal(net.ParseIP(ip)) {
				achou = true
			}
		}
	}
	if !achou {
		t.Fatalf("esperava resposta unicast com ID %#x e A=%s; recebeu %d resposta(s) sem esse conteúdo", id, ip, len(respostas))
	}

	// RF-103: pergunta AAAA não pode receber registro A.
	for _, r := range consultaLegacy(t, ifc, id+1, "mlab.local.", dnsmessage.TypeAAAA, time.Second) {
		for _, a := range r.Answers {
			if a.Header.Type == dnsmessage.TypeA {
				t.Fatalf("pergunta AAAA respondida com registro A (RF-103)")
			}
		}
	}
}

// ipAlheio é o IP anunciado pelo responder falso que faz o papel do backend de outro professor (TEST-NET-1).
const ipAlheio = "192.0.2.10"

// iniciaResponderAlheio sobe, num segundo socket 5353 (SO_REUSEADDR), um responder pion/mdns/v2 que anuncia os
// nomes dados com ipAlheio, como faria o backend de outro professor na mesma rede.
func iniciaResponderAlheio(t *testing.T, ifc *net.Interface, nomes ...string) func() {
	t.Helper()

	raw, err := listenReusablePacketConn("0.0.0.0:5353")
	if err != nil {
		t.Skipf("Porta 5353 ocupada ou indisponível para o responder falso: %v", err)
	}
	srv, err := mdns.Server(ipv4.NewPacketConn(raw), nil, &mdns.Config{
		LocalNames:   nomes,
		LocalAddress: net.ParseIP(ipAlheio).To4(),
		Interfaces:   []net.Interface{*ifc},
	})
	if err != nil {
		_ = raw.Close()
		t.Skipf("falha ao iniciar o responder falso: %v", err)
	}
	return func() {
		_ = srv.Close()
		_ = raw.Close()
	}
}

// ipsRespondidos devolve os IPs das respostas A com o ID dado para o nome perguntado.
func ipsRespondidos(respostas []dnsmessage.Message, id uint16, nome string) []string {
	var ips []string
	for _, r := range respostas {
		if r.Header.ID != id {
			continue
		}
		for _, a := range r.Answers {
			body, ok := a.Body.(*dnsmessage.AResource)
			if ok && a.Header.Name.String() == nome {
				ips = append(ips, net.IP(body.A[:]).String())
			}
		}
	}
	return ips
}

// TestMDNSNaoDisputaNomeDeOutroBackend cobre RF-121 e RF-122 da feature 012: com outro backend já anunciando
// mlab.local na rede, o backend não pode responder por mlab.local.
func TestMDNSNaoDisputaNomeDeOutroBackend(t *testing.T) {
	ip := GetPrimaryPhysicalIP()
	ifc := findInterfaceByIP(ip)
	if ifc == nil || net.ParseIP(ip).To4() == nil {
		t.Skipf("sem interface física com IPv4 para o teste (IP detectado: %q)", ip)
	}

	pararAlheio := iniciaResponderAlheio(t, ifc, "mlab.local")
	defer pararAlheio()
	time.Sleep(200 * time.Millisecond)

	// Confere que o ambiente entrega a consulta aos dois sockets 5353 antes de avaliar o backend.
	const idAntes = 0x4d01
	if ips := ipsRespondidos(consultaLegacy(t, ifc, idAntes, "mlab.local.", dnsmessage.TypeA, time.Second), idAntes, "mlab.local."); len(ips) == 0 {
		t.Skip("o responder falso não respondeu à consulta legacy (multicast indisponível no ambiente)")
	}

	if _, err := StartMDNSServer("mateus", ip); err != nil {
		t.Skipf("Porta 5353 ocupada ou indisponível no ambiente de teste: %v", err)
	}
	defer StopMDNSServer()
	time.Sleep(200 * time.Millisecond)

	const id = 0x4d02
	ips := ipsRespondidos(consultaLegacy(t, ifc, id, "mlab.local.", dnsmessage.TypeA, 2*time.Second), id, "mlab.local.")
	for _, got := range ips {
		if got == ip {
			t.Fatalf("o backend respondeu por mlab.local, já anunciado por outro backend (%s); respostas: %v", ipAlheio, ips)
		}
	}
}
