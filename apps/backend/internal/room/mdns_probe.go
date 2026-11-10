package room

import (
	"encoding/binary"
	"fmt"
	"math/rand/v2"
	"net"
	"strings"
	"time"

	"golang.org/x/net/dns/dnsmessage"
	"golang.org/x/net/ipv4"
)

// mdnsMaxNames é o número de nomes candidatos: mlab.local, mlab-2.local … mlab-20.local (012, C-123).
const mdnsMaxNames = 20

// Parâmetros da sondagem (RF-121, RFC 6762 §8.1). Variáveis para os testes poderem encurtar.
var (
	probeRounds    = 3
	probeInterval  = 250 * time.Millisecond
	probeMaxJitter = 250 * time.Millisecond
)

// mdnsGroup é o endereço multicast mDNS IPv4.
var mdnsGroup = &net.UDPAddr{IP: net.IPv4(224, 0, 0, 251), Port: 5353}

// mdnsCandidates devolve os nomes candidatos na ordem de preferência: mlab.local, mlab-2.local … mlab-<max>.local.
func mdnsCandidates(max int) []string {
	names := make([]string, 0, max)
	for i := 1; i <= max; i++ {
		if i == 1 {
			names = append(names, "mlab.local")
			continue
		}
		names = append(names, fmt.Sprintf("mlab-%d.local", i))
	}
	return names
}

// chooseName devolve o primeiro candidato que não está ocupado. Falso quando todos estão ocupados.
func chooseName(candidates []string, taken map[string]net.IP) (string, bool) {
	for _, name := range candidates {
		if _, busy := taken[name]; !busy {
			return name, true
		}
	}
	return "", false
}

// yieldsName indica se o backend com o IP own deve ceder o nome ao backend com o IP other: o IPv4 numericamente
// menor mantém o nome (012, RF-125). IPs iguais ou inválidos não cedem.
func yieldsName(own, other net.IP) bool {
	o4, x4 := own.To4(), other.To4()
	if o4 == nil || x4 == nil {
		return false
	}
	return binary.BigEndian.Uint32(o4) > binary.BigEndian.Uint32(x4)
}

// nameProber descobre quais nomes já são anunciados na rede por outra máquina. Devolve, para cada nome ocupado,
// o IP de quem respondeu.
type nameProber interface {
	probe(names []string) (map[string]net.IP, error)
}

// legacyProber sonda os nomes com consultas A "legacy unicast" (porta efêmera, RFC 6762 §6.7), que a pion/mdns/v2
// de outro backend MLab responde por unicast nessa porta. Respostas com o próprio IP são ignoradas.
type legacyProber struct {
	ifc   *net.Interface
	ownIP net.IP
}

func (p legacyProber) probe(names []string) (map[string]net.IP, error) {
	conn, pc, err := openLegacySocket(p.ifc)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	if probeMaxJitter > 0 {
		time.Sleep(rand.N(probeMaxJitter))
	}

	wanted := make(map[string]bool, len(names))
	for _, n := range names {
		wanted[strings.ToLower(n)] = true
	}

	taken := make(map[string]net.IP)
	id := uint16(rand.N(1 << 16))
	for round := 0; round < probeRounds; round++ {
		if err := sendLegacyQuery(pc, id, names, dnsmessage.TypeA); err != nil {
			return nil, err
		}
		for _, msg := range readMDNSResponses(conn, time.Now().Add(probeInterval)) {
			for _, a := range msg.Answers {
				body, ok := a.Body.(*dnsmessage.AResource)
				if !ok {
					continue
				}
				name := strings.TrimSuffix(strings.ToLower(a.Header.Name.String()), ".")
				ip := net.IP(append([]byte(nil), body.A[:]...))
				if wanted[name] && !ip.Equal(p.ownIP) {
					taken[name] = ip
				}
			}
		}
	}
	return taken, nil
}

// openLegacySocket abre um socket UDP em porta efêmera para consultas mDNS pela interface dada.
func openLegacySocket(ifc *net.Interface) (net.PacketConn, *ipv4.PacketConn, error) {
	conn, err := net.ListenPacket("udp4", "0.0.0.0:0")
	if err != nil {
		return nil, nil, fmt.Errorf("sem socket UDP para a consulta mDNS: %w", err)
	}
	pc := ipv4.NewPacketConn(conn)
	if ifc != nil {
		if err := pc.SetMulticastInterface(ifc); err != nil {
			_ = conn.Close()
			return nil, nil, fmt.Errorf("sem multicast na interface %s: %w", ifc.Name, err)
		}
	}
	_ = pc.SetMulticastLoopback(true)
	return conn, pc, nil
}

// sendLegacyQuery envia uma consulta mDNS com uma pergunta do tipo dado para cada nome, num único pacote.
func sendLegacyQuery(pc *ipv4.PacketConn, id uint16, names []string, qtype dnsmessage.Type) error {
	msg := dnsmessage.Message{Header: dnsmessage.Header{ID: id}}
	for _, n := range names {
		if !strings.HasSuffix(n, ".") {
			n += "."
		}
		name, err := dnsmessage.NewName(n)
		if err != nil {
			return fmt.Errorf("nome mDNS inválido %q: %w", n, err)
		}
		msg.Questions = append(msg.Questions, dnsmessage.Question{Name: name, Type: qtype, Class: dnsmessage.ClassINET})
	}
	packet, err := msg.Pack()
	if err != nil {
		return fmt.Errorf("falha ao montar a consulta mDNS: %w", err)
	}
	if _, err := pc.WriteTo(packet, nil, mdnsGroup); err != nil {
		return fmt.Errorf("falha ao enviar a consulta mDNS: %w", err)
	}
	return nil
}

// readMDNSResponses lê as respostas mDNS que chegarem ao socket até o prazo.
func readMDNSResponses(conn net.PacketConn, until time.Time) []dnsmessage.Message {
	var out []dnsmessage.Message
	buf := make([]byte, 1500)
	for time.Now().Before(until) {
		_ = conn.SetReadDeadline(until)
		n, _, err := conn.ReadFrom(buf)
		if err != nil {
			break
		}
		var msg dnsmessage.Message
		if err := msg.Unpack(buf[:n]); err != nil || !msg.Header.Response {
			continue
		}
		out = append(out, msg)
	}
	return out
}
