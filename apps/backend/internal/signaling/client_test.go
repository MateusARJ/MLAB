package signaling

import (
	"sync"
	"testing"
)

// Testes do envio e do fechamento do cliente sem corrida (038/T3801, issue #111).

func newSendTestClient(buffer int) *Client {
	return &Client{send: make(chan []byte, buffer), participantID: "cli-1"}
}

// 038/RF-3801: depois do fechamento, o envio é descartado, devolve false e não toca no canal (sem panic).
func TestClient_EnvioDepoisDoFechamentoEDescartado(t *testing.T) {
	c := newSendTestClient(4)
	c.close()

	if c.safeSend([]byte("x")) {
		t.Fatal("safeSend devolveu true depois do fechamento")
	}
	c.sendJSON(TypeIceServers, struct{}{}) // o caminho do handler; não pode entrar em pânico
	if _, ok := <-c.send; ok {
		t.Fatal("o canal recebeu mensagem depois do fechamento")
	}
}

// 038/RF-3802: com o buffer cheio, o envio descarta a mensagem sem bloquear.
func TestClient_BufferCheioDescartaSemBloquear(t *testing.T) {
	c := newSendTestClient(1)
	if !c.safeSend([]byte("a")) {
		t.Fatal("primeiro envio deveria entrar no buffer")
	}
	if c.safeSend([]byte("b")) {
		t.Fatal("envio com buffer cheio deveria ser descartado")
	}
}

// 038/RF-3803: o fechamento é idempotente e mantém o close code da primeira chamada.
func TestClient_SegundoFechamentoSemEfeito(t *testing.T) {
	c := newSendTestClient(1)
	c.closeWithCode(CloseStudentIDInUse, closeStudentIDInUseReason)
	c.close()
	c.closeWithCode(CloseDuplicateSession, closeDuplicateSessionReason)

	c.sendMu.Lock()
	code, reason, closed := c.closeCode, c.closeReason, c.closed
	c.sendMu.Unlock()
	if !closed || code != CloseStudentIDInUse || reason != closeStudentIDInUseReason {
		t.Fatalf("fechamento = (%v, %d, %q), want (true, %d, %q)", closed, code, reason,
			CloseStudentIDInUse, closeStudentIDInUseReason)
	}
}

// 038/US-3801, RNF-3801: vários remetentes (hub, handler, readPump) enviam enquanto outro fecha o cliente. Com
// -race, nenhuma corrida; cada envio entra antes do fechamento ou é descartado depois dele.
func TestClient_EnviosConcorrentesAoFechamento(t *testing.T) {
	const rodadas, remetentes, envios = 200, 4, 20

	for i := 0; i < rodadas; i++ {
		c := newSendTestClient(remetentes * envios)
		var entregues sync.WaitGroup
		var aceitos [remetentes]int
		inicio := make(chan struct{})

		for r := 0; r < remetentes; r++ {
			entregues.Add(1)
			go func(r int) {
				defer entregues.Done()
				<-inicio
				for k := 0; k < envios; k++ {
					if c.safeSend([]byte("m")) {
						aceitos[r]++
					}
				}
			}(r)
		}
		entregues.Add(1)
		go func() {
			defer entregues.Done()
			<-inicio
			c.closeWithCode(CloseStudentIDInUse, closeStudentIDInUseReason)
		}()

		close(inicio)
		entregues.Wait()

		total := 0
		for _, n := range aceitos {
			total += n
		}
		recebidos := 0
		for range c.send { // o canal está fechado: drena o que entrou antes do fechamento
			recebidos++
		}
		if recebidos != total {
			t.Fatalf("rodada %d: %d envios aceitos, %d mensagens no canal", i, total, recebidos)
		}
	}
}
