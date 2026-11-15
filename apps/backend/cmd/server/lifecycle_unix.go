//go:build !windows

package main

import (
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// watchParent envia o motivo quando o pai some: o PPID deste processo mudou (o pai morreu e o processo foi
// adotado) ou o pid informado não existe mais. A consulta é feita a cada interval (RF-3407b).
func watchParent(pid int, interval time.Duration) <-chan string {
	ch := make(chan string, 1)
	initialPPID := os.Getppid()
	gone := func() (string, bool) {
		if ppid := os.Getppid(); ppid != initialPPID {
			return fmt.Sprintf("processo pai mudou de %d para %d", initialPPID, ppid), true
		}
		if err := syscall.Kill(pid, 0); errors.Is(err, syscall.ESRCH) {
			return fmt.Sprintf("processo pai %d inexistente", pid), true
		}
		return "", false
	}
	go func() {
		if reason, ok := gone(); ok {
			ch <- reason
			return
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			if reason, ok := gone(); ok {
				ch <- reason
				return
			}
		}
	}()
	return ch
}

// ignoreBrokenPipe evita que a escrita em stdout/stderr com o app já morto encerre o processo por SIGPIPE
// antes do encerramento gracioso e do registro em arquivo (RF-3414).
func ignoreBrokenPipe() {
	signal.Ignore(syscall.SIGPIPE)
}
