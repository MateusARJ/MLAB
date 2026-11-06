package room

import (
	"fmt"
	"log"
	"net"
	"strings"
	"sync"

	"github.com/pion/mdns/v2"
	"golang.org/x/net/ipv4"
)

// MDNSServer encapsula o servidor mDNS leve para anunciar mlab.local e mlab-<professor>.local na rede local.
type MDNSServer struct {
	conn       *mdns.Conn
	packetConn *ipv4.PacketConn
	rawConn    net.PacketConn
	localName  string
	localNames []string
	localIP    string
	mu         sync.Mutex
	isClosed   bool
}

var (
	activeMDNSServer   *MDNSServer
	activeMDNSServerMu sync.Mutex
)

// findInterfaceByIP localiza a interface de rede física que contém o endereço IP especificado.
func findInterfaceByIP(targetIP string) *net.Interface {
	ip := net.ParseIP(targetIP)
	if ip == nil {
		return nil
	}
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	for _, iface := range ifaces {
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var currIP net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				currIP = v.IP
			case *net.IPAddr:
				currIP = v.IP
			}
			if currIP != nil && currIP.Equal(ip) {
				ifc := iface
				return &ifc
			}
		}
	}
	return nil
}

// StartMDNSServer inicia o anúncio dos hostnames (mlab.local e mlab-<professor>.local) na rede local via mDNS (porta UDP 5353).
// Utiliza SO_REUSEADDR para permitir convivência sem conflitos com o DNS Cache do Windows ou navegadores.
func StartMDNSServer(profSlug string, ipStr string) (*MDNSServer, error) {
	activeMDNSServerMu.Lock()
	defer activeMDNSServerMu.Unlock()

	if activeMDNSServer != nil {
		_ = activeMDNSServer.Close()
		activeMDNSServer = nil
	}

	ip := net.ParseIP(ipStr)
	if ip == nil || ip.To4() == nil {
		return nil, fmt.Errorf("IP inválido para mDNS: %s", ipStr)
	}

	cleanProf := strings.TrimSpace(strings.ToLower(profSlug))
	if cleanProf == "" {
		cleanProf = "professor"
	}
	profHostName := fmt.Sprintf("mlab-%s.local", cleanProf)

	// Cria o socket UDP reutilizável na porta 5353 com suporte a SO_REUSEADDR
	rawConn, err := listenReusablePacketConn("0.0.0.0:5353")
	if err != nil {
		log.Printf("[mDNS] Aviso: Porta UDP 5353 não pôde ser associada para mDNS: %v. O link por IP continuará funcionando normalmente.", err)
		return nil, err
	}

	packetConn := ipv4.NewPacketConn(rawConn)

	// Garante que o anúncio multicast seja direcionado à placa de rede física onde o IP do professor está configurado,
	// filtrando rigorosamente apenas interfaces com MTU positivo para evitar erros no Windows.
	var ifacesToUse []net.Interface
	if targetIface := findInterfaceByIP(ipStr); targetIface != nil && targetIface.MTU > 0 {
		ifacesToUse = append(ifacesToUse, *targetIface)
	}

	// Fallback para outras interfaces ativas com multicast e MTU positivo se a interface alvo não foi encontrada
	if len(ifacesToUse) == 0 {
		if allIfaces, err := net.Interfaces(); err == nil {
			for _, ifc := range allIfaces {
				if ifc.Flags&net.FlagUp != 0 && ifc.Flags&net.FlagMulticast != 0 && ifc.MTU > 0 {
					ifacesToUse = append(ifacesToUse, ifc)
				}
			}
		}
	}

	if len(ifacesToUse) == 0 {
		_ = rawConn.Close()
		return nil, fmt.Errorf("nenhuma interface física com MTU positivo encontrada para mDNS")
	}

	// Anuncia mlab.local (link institucional fixo) e mlab-<prof>.local (compatibilidade)
	localNames := []string{"mlab.local"}
	if profHostName != "mlab.local" {
		localNames = append(localNames, profHostName)
	}

	// A pion/mdns v2 responde por unicast às consultas feitas de porta diferente da 5353 ("legacy unicast",
	// RFC 6762 §6.7) e às que pedem resposta unicast (bit QU), ecoando o ID e a pergunta. É assim que o
	// resolvedor .local do Android pergunta; a v0.0.12 só respondia por multicast e o celular não recebia.
	// Só IPv4: o socket IPv6 fica nulo.
	server, err := mdns.Server(packetConn, nil, &mdns.Config{
		LocalNames:   localNames,
		LocalAddress: ip.To4(),
		Interfaces:   ifacesToUse,
	})
	if err != nil {
		_ = rawConn.Close()
		return nil, fmt.Errorf("falha ao iniciar servidor mDNS: %w", err)
	}

	m := &MDNSServer{
		conn:       server,
		packetConn: packetConn,
		rawConn:    rawConn,
		localName:  "mlab.local",
		localNames: localNames,
		localIP:    ipStr,
	}

	activeMDNSServer = m
	log.Printf("[mDNS] Servidor mDNS ativo com sucesso: respondendo por %v em %s (Interface: %s)", localNames, ipStr, ifacesToUse[0].Name)
	return m, nil
}

// StopMDNSServer encerra o anúncio mDNS ativo no momento.
func StopMDNSServer() {
	activeMDNSServerMu.Lock()
	defer activeMDNSServerMu.Unlock()

	if activeMDNSServer != nil {
		_ = activeMDNSServer.Close()
		activeMDNSServer = nil
	}
}

// Close encerra a conexão do servidor mDNS de forma segura.
func (m *MDNSServer) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.isClosed {
		return nil
	}
	m.isClosed = true

	var firstErr error
	if m.conn != nil {
		if err := m.conn.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if m.rawConn != nil {
		if err := m.rawConn.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	log.Printf("[mDNS] Servidor mDNS encerrado para '%s'", m.localName)
	return firstErr
}
