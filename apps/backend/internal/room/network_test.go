package room

import (
	"net"
	"testing"
)

func TestIsVirtualOrTunnelInterface(t *testing.T) {
	virtualNames := []string{
		"VMware Network Adapter VMnet1",
		"VMware Network Adapter VMnet8",
		"VirtualBox Host-Only Ethernet Adapter",
		"vboxnet0",
		"vEthernet (Default Switch)",
		"vEthernet (WSL)",
		"Tailscale",
		"docker0",
		"Conexão de Rede Bluetooth",
		"Loopback Pseudo-Interface 1",
		"tun0",
		"tap0",
	}

	for _, name := range virtualNames {
		if !IsVirtualOrTunnelInterface(name) {
			t.Errorf("Esperado que %q fosse detectado como interface virtual/túnel", name)
		}
	}

	physicalNames := []string{
		"Wi-Fi",
		"Wi-Fi 2",
		"Ethernet",
		"Ethernet 2",
		"Conexão local",
		"wlan0",
		"eth0",
		"en0",
		"enp3s0",
	}

	for _, name := range physicalNames {
		if IsVirtualOrTunnelInterface(name) {
			t.Errorf("Interface física %q foi erroneamente marcada como virtual", name)
		}
	}
}

func TestIsPrivateIPv4(t *testing.T) {
	cases := []struct {
		ip       string
		expected bool
	}{
		{"192.168.1.50", true},
		{"192.168.0.1", true},
		{"10.0.0.1", true},
		{"172.16.0.1", true},
		{"172.31.255.255", true},
		{"172.32.0.1", false},
		{"8.8.8.8", false},
		{"1.1.1.1", false},
		{"169.254.1.1", false}, // APIPA
		{"127.0.0.1", false},   // Loopback não é private LAN
	}

	for _, c := range cases {
		ip := net.ParseIP(c.ip)
		got := isPrivateIPv4(ip)
		if got != c.expected {
			t.Errorf("isPrivateIPv4(%q) = %v; want %v", c.ip, got, c.expected)
		}
	}
}

func TestGetPrimaryPhysicalIP(t *testing.T) {
	ip := GetPrimaryPhysicalIP()
	if ip == "" {
		t.Fatal("GetPrimaryPhysicalIP retornou string vazia")
	}

	// Não pode ser link-local (169.254.x.x)
	parsed := net.ParseIP(ip)
	if parsed != nil {
		if parsed.IsLinkLocalUnicast() {
			t.Errorf("GetPrimaryPhysicalIP retornou IP link-local indesejado: %s", ip)
		}
	}
}

func TestIsInternetAvailable(t *testing.T) {
	// A função deve executar em menos de 1 segundo sem travar
	online := IsInternetAvailable()
	t.Logf("Status de conectividade com a internet: online=%v", online)
}
