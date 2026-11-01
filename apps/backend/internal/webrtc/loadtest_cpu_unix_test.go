//go:build loadtest && !windows

package webrtc

import (
	"syscall"
	"time"
)

// processCPUTime retorna o tempo de CPU (usuário + kernel) consumido pelo processo de teste.
func processCPUTime() time.Duration {
	var ru syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_SELF, &ru); err != nil {
		return 0
	}
	return time.Duration(ru.Utime.Nano() + ru.Stime.Nano())
}
