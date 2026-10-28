//go:build !windows

package room

import (
	"context"
	"net"
	"syscall"

	"golang.org/x/sys/unix"
)

// listenReusablePacketConn cria um PacketConn UDP na porta 5353 com SO_REUSEADDR e SO_REUSEPORT configurados para sistemas Unix/POSIX.
func listenReusablePacketConn(addr string) (net.PacketConn, error) {
	lc := net.ListenConfig{
		Control: func(network, address string, c syscall.RawConn) error {
			var operr error
			err := c.Control(func(fd uintptr) {
				operr = unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEADDR, 1)
				if operr == nil {
					_ = unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEPORT, 1)
				}
			})
			if err != nil {
				return err
			}
			return operr
		},
	}
	return lc.ListenPacket(context.Background(), "udp4", addr)
}
