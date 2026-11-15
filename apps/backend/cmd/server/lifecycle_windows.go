//go:build windows

package main

import (
	"fmt"
	"os"
	"time"
)

// watchParent envia o motivo quando o processo pid termina. No Windows a espera é feita no handle do
// processo, sem consulta periódica; pid inexistente dispara imediatamente (RF-3407b).
func watchParent(pid int, _ time.Duration) <-chan string {
	ch := make(chan string, 1)
	p, err := os.FindProcess(pid)
	if err != nil {
		ch <- fmt.Sprintf("processo pai %d inexistente", pid)
		return ch
	}
	go func() {
		_, _ = p.Wait()
		ch <- fmt.Sprintf("processo pai %d encerrou", pid)
	}()
	return ch
}

// ignoreBrokenPipe não se aplica ao Windows: escrita em pipe quebrado só devolve erro.
func ignoreBrokenPipe() {}
