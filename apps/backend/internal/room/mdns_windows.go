//go:build windows

package room

import (
	"context"
	"net"
	"syscall"

	"golang.org/x/sys/windows"
)

// listenReusablePacketConn cria um PacketConn UDP na porta 5353 com SO_REUSEADDR configurado para o Winsock do Windows.
func listenReusablePacketConn(addr string) (net.PacketConn, error) {
	lc := net.ListenConfig{
		Control: func(network, address string, c syscall.RawConn) error {
			var operr error
			err := c.Control(func(fd uintptr) {
				operr = windows.SetsockoptInt(windows.Handle(fd), windows.SOL_SOCKET, windows.SO_REUSEADDR, 1)
			})
			if err != nil {
				return err
			}
			return operr
		},
	}
	return lc.ListenPacket(context.Background(), "udp4", addr)
}
