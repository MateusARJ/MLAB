package room

import (
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/pion/mdns/v2"
	"golang.org/x/net/ipv4"
)

// MDNSServer encapsula o servidor mDNS leve que anuncia o nome único deste backend (mlab.local, mlab-2.local …)
// na rede local (012, RF-124).
type MDNSServer struct {
	conn       *mdns.Conn
	packetConn *ipv4.PacketConn
	rawConn    net.PacketConn
	localName  string
	localIP    string
	mu         sync.Mutex
	isClosed   bool

	// Monitor de conflito (RF-125): stop é fechado no Close; done fecha quando a goroutine termina.
	prober nameProber
	ifaces []net.Interface
	stop   chan struct{}
	done   chan struct{}
}

var (
	activeMDNSServer   *MDNSServer
	activeMDNSServerMu sync.Mutex
)

// Reconsultas do próprio nome depois do anúncio (012, RF-125): +2 s, +5 s e depois a cada 60 s.
// Variáveis para os testes poderem encurtar.
var (
	conflictCheckWaits = []time.Duration{2 * time.Second, 3 * time.Second}
	conflictCheckEvery = 60 * time.Second
)

// newMDNSProber cria o prober usado para escolher o nome. Variável para os testes injetarem um prober falso.
var newMDNSProber = func(ifc *net.Interface, ip net.IP) nameProber {
	return legacyProber{ifc: ifc, ownIP: ip}
}

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

// ClaimMDNSName escolhe e anuncia o nome mDNS deste backend (012, RF-121 a RF-124): fecha o anúncio anterior,
// sonda os candidatos mlab.local, mlab-2.local … mlab-20.local, escolhe o primeiro livre e anuncia só esse nome com
// o IP dado. Devolve o nome anunciado. Em caso de erro não há anúncio e CurrentMDNSHost fica vazio (RF-126).
// Utiliza SO_REUSEADDR para conviver com o DNS Cache do Windows ou navegadores na porta 5353.
func ClaimMDNSName(ipStr string) (string, error) {
	activeMDNSServerMu.Lock()
	defer activeMDNSServerMu.Unlock()

	if activeMDNSServer != nil {
		_ = activeMDNSServer.Close()
		activeMDNSServer = nil
	}

	ip := net.ParseIP(ipStr)
	if ip == nil || ip.To4() == nil {
		return "", fmt.Errorf("IP inválido para mDNS: %s", ipStr)
	}

	// Cria o socket UDP reutilizável na porta 5353 antes de sondar, para falhar logo se a porta estiver indisponível.
	rawConn, err := listenReusablePacketConn("0.0.0.0:5353")
	if err != nil {
		log.Printf("[mDNS] Aviso: Porta UDP 5353 não pôde ser associada para mDNS: %v. O link por IP continuará funcionando normalmente.", err)
		return "", err
	}

	ifacesToUse := mdnsInterfaces(ipStr)
	if len(ifacesToUse) == 0 {
		_ = rawConn.Close()
		return "", fmt.Errorf("nenhuma interface física com MTU positivo encontrada para mDNS")
	}

	candidates := mdnsCandidates(mdnsMaxNames)
	inicio := time.Now()
	prober := newMDNSProber(&ifacesToUse[0], ip.To4())
	taken, err := prober.probe(candidates)
	if err != nil {
		// Sem sondagem não há como ver os outros backends; anuncia o primeiro candidato e o monitor de conflito
		// corrige depois, se for o caso.
		log.Printf("[mDNS] Aviso: sondagem dos nomes falhou: %v", err)
		taken = nil
	}
	name, ok := chooseName(candidates, taken)
	if !ok {
		_ = rawConn.Close()
		log.Printf("[mDNS] Aviso: os %d nomes mDNS (mlab.local … mlab-%d.local) já estão em uso na rede; sem anúncio, use o link por IP.", mdnsMaxNames, mdnsMaxNames)
		return "", fmt.Errorf("todos os %d nomes mDNS estão em uso na rede", mdnsMaxNames)
	}
	if len(taken) > 0 {
		log.Printf("[mDNS] Nomes já em uso na rede: %v; escolhido %s (sondagem em %v)", takenSummary(taken), name, time.Since(inicio).Round(time.Millisecond))
	}

	m, err := startMDNSResponder(rawConn, name, ipStr, ifacesToUse)
	if err != nil {
		return "", err
	}
	activeMDNSServer = m
	m.startMonitor(prober)
	return name, nil
}

// CurrentMDNSHost devolve o nome mDNS anunciado no momento, ou vazio sem anúncio ativo.
func CurrentMDNSHost() string {
	activeMDNSServerMu.Lock()
	defer activeMDNSServerMu.Unlock()

	if activeMDNSServer == nil {
		return ""
	}
	return activeMDNSServer.localName
}

// mdnsInterfaces escolhe a interface física onde o IP do professor está configurado, filtrando apenas interfaces com
// MTU positivo para evitar erros no Windows; sem ela, usa as interfaces ativas com multicast.
func mdnsInterfaces(ipStr string) []net.Interface {
	var ifacesToUse []net.Interface
	if targetIface := findInterfaceByIP(ipStr); targetIface != nil && targetIface.MTU > 0 {
		ifacesToUse = append(ifacesToUse, *targetIface)
	}
	if len(ifacesToUse) == 0 {
		if allIfaces, err := net.Interfaces(); err == nil {
			for _, ifc := range allIfaces {
				if ifc.Flags&net.FlagUp != 0 && ifc.Flags&net.FlagMulticast != 0 && ifc.MTU > 0 {
					ifacesToUse = append(ifacesToUse, ifc)
				}
			}
		}
	}
	return ifacesToUse
}

// startMDNSResponder sobe o responder pion/mdns/v2 no socket 5353 dado, anunciando só o nome escolhido.
// A pion/mdns v2 responde por unicast às consultas feitas de porta diferente da 5353 ("legacy unicast",
// RFC 6762 §6.7) e às que pedem resposta unicast (bit QU), ecoando o ID e a pergunta. É assim que o
// resolvedor .local do Android pergunta. Só IPv4: o socket IPv6 fica nulo.
func startMDNSResponder(rawConn net.PacketConn, name, ipStr string, ifaces []net.Interface) (*MDNSServer, error) {
	packetConn := ipv4.NewPacketConn(rawConn)
	server, err := mdns.Server(packetConn, nil, &mdns.Config{
		LocalNames:   []string{name},
		LocalAddress: net.ParseIP(ipStr).To4(),
		Interfaces:   ifaces,
	})
	if err != nil {
		_ = rawConn.Close()
		return nil, fmt.Errorf("falha ao iniciar servidor mDNS: %w", err)
	}

	log.Printf("[mDNS] Servidor mDNS ativo com sucesso: respondendo por %s em %s (Interface: %s)", name, ipStr, ifaces[0].Name)
	return &MDNSServer{
		conn:       server,
		packetConn: packetConn,
		rawConn:    rawConn,
		localName:  name,
		localIP:    ipStr,
		ifaces:     ifaces,
		stop:       make(chan struct{}),
		done:       make(chan struct{}),
	}, nil
}

// startMonitor inicia a goroutine que reconsulta o próprio nome e cede o nome em conflito (RF-125).
func (m *MDNSServer) startMonitor(prober nameProber) {
	m.prober = prober
	go m.monitor()
}

// monitor reconsulta o nome anunciado em +2 s, +5 s e a cada 60 s. Se outra máquina responder pelo mesmo nome, o
// IPv4 numericamente menor fica com ele: este backend cede (troca de nome) ou só registra o conflito em log.
func (m *MDNSServer) monitor() {
	defer close(m.done)
	ownIP := net.ParseIP(m.localIP)

	for i := 0; ; i++ {
		wait := conflictCheckEvery
		if i < len(conflictCheckWaits) {
			wait = conflictCheckWaits[i]
		}
		select {
		case <-m.stop:
			return
		case <-time.After(wait):
		}

		taken, err := m.prober.probe([]string{m.localName})
		if err != nil {
			continue
		}
		other, conflict := taken[m.localName]
		if !conflict {
			continue
		}
		if !yieldsName(ownIP, other) {
			log.Printf("[mDNS] Conflito: %s também é anunciado por %s; este backend (%s) mantém o nome (IP menor).", m.localName, other, m.localIP)
			continue
		}
		if m.yieldName(other) {
			return
		}
	}
}

// yieldName troca o nome deste backend depois de um conflito perdido: sonda de novo com o nome atual marcado como
// ocupado e anuncia o primeiro livre. Devolve verdadeiro quando este servidor deixou de ser o ativo.
func (m *MDNSServer) yieldName(other net.IP) bool {
	candidates := mdnsCandidates(mdnsMaxNames)
	taken, err := m.prober.probe(candidates)
	if err != nil || taken == nil {
		taken = map[string]net.IP{}
	}
	taken[m.localName] = other

	activeMDNSServerMu.Lock()
	defer activeMDNSServerMu.Unlock()

	if activeMDNSServer != m {
		return true // já foi encerrado ou substituído por uma nova sala
	}
	_ = m.Close()
	activeMDNSServer = nil

	name, ok := chooseName(candidates, taken)
	if !ok {
		log.Printf("[mDNS] Conflito: %s é de %s e não há nome livre; sem anúncio, use o link por IP.", m.localName, other)
		return true
	}
	rawConn, err := listenReusablePacketConn("0.0.0.0:5353")
	if err != nil {
		log.Printf("[mDNS] Aviso: Porta UDP 5353 não pôde ser associada ao trocar de nome: %v", err)
		return true
	}
	next, err := startMDNSResponder(rawConn, name, m.localIP, m.ifaces)
	if err != nil {
		log.Printf("[mDNS] Aviso: falha ao anunciar %s: %v", name, err)
		return true
	}
	activeMDNSServer = next
	next.startMonitor(m.prober)
	log.Printf("[mDNS] Conflito: %s também é anunciado por %s (IP menor); este backend passou a anunciar %s.", m.localName, other, name)
	return true
}

// takenSummary formata os nomes ocupados para o log.
func takenSummary(taken map[string]net.IP) string {
	parts := make([]string, 0, len(taken))
	for _, name := range mdnsCandidates(mdnsMaxNames) {
		if ip, ok := taken[name]; ok {
			parts = append(parts, fmt.Sprintf("%s=%s", name, ip))
		}
	}
	return strings.Join(parts, ", ")
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
	if m.stop != nil {
		close(m.stop)
	}

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
