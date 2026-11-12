package room

import (
	"net"
	"os"
	"strings"
	"sync"
	"time"
)

var (
	virtualKeywords = []string{
		"vmnet",
		"vmware",
		"virtualbox",
		"vbox",
		"hyper-v",
		"vethernet",
		"tailscale",
		"docker",
		"wsl",
		"bluetooth",
		"loopback",
		"teredo",
		"pseudo",
		"tap",
		"tun",
	}

	physicalKeywords = []string{
		"wi-fi",
		"wifi",
		"wlan",
		"wireless",
		"ethernet",
		"eth",
		"en",
	}

	connectivityMu        sync.RWMutex
	lastConnectivityCheck time.Time
	cachedIsOnline        bool
)

// IsVirtualOrTunnelInterface verifica se o nome da interface corresponde a adaptadores virtuais,
// de máquinas virtuais (VMware/VirtualBox), túneis VPN ou interfaces de sistema.
func IsVirtualOrTunnelInterface(name string) bool {
	lower := strings.ToLower(name)
	for _, kw := range virtualKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

// isPhysicalInterface verifica se o nome da interface sugere uma placa de rede física (Wi-Fi / Ethernet).
func isPhysicalInterface(name string) bool {
	lower := strings.ToLower(name)
	for _, kw := range physicalKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

// isPrivateIPv4 verifica se o IP pertence às faixas privadas RFC 1918 (10.x.x.x, 172.16-31.x.x, 192.168.x.x).
func isPrivateIPv4(ip net.IP) bool {
	ip4 := ip.To4()
	if ip4 == nil {
		return false
	}
	return ip4[0] == 10 ||
		(ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31) ||
		(ip4[0] == 192 && ip4[1] == 168)
}

// GetPrimaryPhysicalIP descobre e retorna o endereço IPv4 da placa física primária ativa (Wi-Fi ou Ethernet),
// descartando rigorosamente adaptadores virtuais (VMware, VirtualBox, Hyper-V, WSL, Tailscale) e APIPA (169.254.x.x).
func GetPrimaryPhysicalIP() string {
	// Se variáveis explícitas forem fornecidas, respeita-as com prioridade
	if natIP := os.Getenv("NAT_1TO1_IP"); natIP != "" && natIP != "localhost" && natIP != "127.0.0.1" {
		return natIP
	}
	if pubIP := os.Getenv("PUBLIC_IP"); pubIP != "" && pubIP != "localhost" && pubIP != "127.0.0.1" {
		return pubIP
	}

	ifaces, err := net.Interfaces()
	if err != nil {
		return "localhost"
	}

	var tier1Candidates []string // Placas explicitamente físicas (Wi-Fi / Ethernet) com IP privado
	var tier2Candidates []string // Demais placas não-virtuais ativas com IP privado
	var genericCandidates []string

	for _, iface := range ifaces {
		// Ignora placas desativadas ou de loopback
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		// Descarta adaptadores virtuais conhecidos
		if IsVirtualOrTunnelInterface(iface.Name) {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}

			// Descarta IPv6, loopback e link-local (169.254.x.x)
			if ip == nil || ip.IsLoopback() || ip.To4() == nil || ip.IsLinkLocalUnicast() {
				continue
			}

			ipStr := ip.To4().String()
			if isPhysicalInterface(iface.Name) {
				if isPrivateIPv4(ip) {
					tier1Candidates = append(tier1Candidates, ipStr)
				} else {
					genericCandidates = append(genericCandidates, ipStr)
				}
			} else {
				if isPrivateIPv4(ip) {
					tier2Candidates = append(tier2Candidates, ipStr)
				} else {
					genericCandidates = append(genericCandidates, ipStr)
				}
			}
		}
	}

	if len(tier1Candidates) > 0 {
		return tier1Candidates[0]
	}
	if len(tier2Candidates) > 0 {
		return tier2Candidates[0]
	}
	if len(genericCandidates) > 0 {
		return genericCandidates[0]
	}

	// Fallback clássico por socket UDP caso nenhuma interface física tenha sido categorizada
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		defer conn.Close()
		if localAddr, ok := conn.LocalAddr().(*net.UDPAddr); ok {
			ipStr := localAddr.IP.String()
			if ipStr != "" && ipStr != "127.0.0.1" && ipStr != "localhost" {
				return ipStr
			}
		}
	}

	return "localhost"
}

// IsInternetAvailable testa rapidamente (com timeout de 500ms e cache de 5s) se a máquina possui
// conectividade TCP com a internet externa (servidores DNS 1.1.1.1 / 8.8.8.8 na porta 53).
func IsInternetAvailable() bool {
	connectivityMu.RLock()
	if time.Since(lastConnectivityCheck) < 5*time.Second {
		status := cachedIsOnline
		connectivityMu.RUnlock()
		return status
	}
	connectivityMu.RUnlock()

	connectivityMu.Lock()
	defer connectivityMu.Unlock()

	// Dupla checagem sob lock
	if time.Since(lastConnectivityCheck) < 5*time.Second {
		return cachedIsOnline
	}

	isOnline := checkInternetConnectivity()
	cachedIsOnline = isOnline
	lastConnectivityCheck = time.Now()
	return isOnline
}

func checkInternetConnectivity() bool {
	endpoints := []string{"1.1.1.1:53", "8.8.8.8:53"}
	for _, ep := range endpoints {
		conn, err := net.DialTimeout("tcp", ep, 500*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return true
		}
	}
	return false
}
