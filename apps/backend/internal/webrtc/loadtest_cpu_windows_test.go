//go:build loadtest && windows

package webrtc

import (
	"syscall"
	"time"
)

// processCPUTime retorna o tempo de CPU (usuário + kernel) consumido pelo processo de teste.
func processCPUTime() time.Duration {
	h, err := syscall.GetCurrentProcess()
	if err != nil {
		return 0
	}
	var creation, exit, kernel, user syscall.Filetime
	if err := syscall.GetProcessTimes(h, &creation, &exit, &kernel, &user); err != nil {
		return 0
	}
	ft := func(f syscall.Filetime) time.Duration {
		return time.Duration((uint64(f.HighDateTime)<<32 | uint64(f.LowDateTime)) * 100)
	}
	return ft(kernel) + ft(user)
}
