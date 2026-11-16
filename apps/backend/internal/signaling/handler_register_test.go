package signaling

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
	"github.com/MateusARJ/MLAB/apps/backend/internal/room"
	"github.com/gorilla/websocket"
)

// esperaMensagem lê a conexão até receber uma mensagem que satisfaça ok, ou falha quando o prazo vence.
func esperaMensagem(t *testing.T, conn *websocket.Conn, descricao string, ok func(WsMessage) bool) {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("%s não chegou: %v", descricao, err)
		}
		var msg WsMessage
		if json.Unmarshal(data, &msg) == nil && ok(msg) {
			return
		}
	}
}

// TestServeWS_PrimeiraMensagemDepoisDoRegistro cobre RF-3901 e RF-3902 (039, issue #114): a mensagem que o cliente
// envia logo depois do Dial é processada pelo hub mesmo quando o hub está ocupado no momento do registro.
//
// O listener de status segura a goroutine do hub quando o professor entra (waiting → publishing). Enquanto isso, o aluno
// conecta e envia subscribe-request. Antes da correção, o readPump já colocava a mensagem em inbound, e ao soltar o hub
// o select escolhia ao acaso entre register e inbound: metade das rodadas descartava a mensagem. Com a leitura começando
// só depois do register, a mensagem nunca chega antes do registro.
func TestServeWS_PrimeiraMensagemDepoisDoRegistro(t *testing.T) {
	t.Setenv("JWT_SECRET", "ws-primeira-mensagem-12345") // valor de teste, não é segredo real
	const rodadas = 20

	store := room.NewInMemoryStore()
	handler := NewHandler(store, nil)
	ocupado := make(chan struct{}, 1)    // avisa que o hub entrou no listener
	gates := make(chan chan struct{}, 1) // entrega ao listener o gate da rodada
	handler.SetRoomStatusListener(func(_ string, s SessionStatus) {
		if s != SessionPublishing {
			return
		}
		gate := <-gates
		ocupado <- struct{}{}
		<-gate
	})
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	base := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws/rooms/"

	profToken, _, err := auth.SignProfessorToken("prof-1", "Professor")
	if err != nil {
		t.Fatalf("SignProfessorToken: %v", err)
	}

	for i := 0; i < rodadas; i++ {
		roomID := fmt.Sprintf("room-primeira-%d", i)
		if err := store.CreateRoom(context.Background(), &room.Room{ID: roomID, Slug: roomID + "-slug", OwnerID: "prof-1",
			Status: room.StatusWaiting, MaxParticipants: 50, CreatedAt: time.Now()}); err != nil {
			t.Fatalf("CreateRoom: %v", err)
		}
		wsURL := base + roomID + "/signal?token="
		liberaHub := make(chan struct{})
		gates <- liberaHub

		// O registro do professor muda o status para publishing e prende o hub no listener.
		prof, _, err := websocket.DefaultDialer.Dial(wsURL+profToken, nil)
		if err != nil {
			t.Fatalf("rodada %d: professor não conectou: %v", i, err)
		}
		select {
		case <-ocupado:
		case <-time.After(2 * time.Second):
			t.Fatalf("rodada %d: o hub não entrou no listener de status", i)
		}

		// Com o hub ocupado, o aluno conecta e envia subscribe-request logo depois do Dial, como o web.
		alunoToken, err := auth.SignToken(auth.StudentMapClaims("aluno-1", "Aluno", "RA01", roomID))
		if err != nil {
			t.Fatalf("SignToken: %v", err)
		}
		aluno, _, err := websocket.DefaultDialer.Dial(wsURL+alunoToken, nil)
		if err != nil {
			t.Fatalf("rodada %d: aluno não conectou: %v", i, err)
		}
		if err := aluno.WriteJSON(map[string]any{"type": TypeSubscribeRequest, "payload": map[string]any{}}); err != nil {
			t.Fatalf("rodada %d: subscribe-request: %v", i, err)
		}
		time.Sleep(50 * time.Millisecond) // dá tempo de um readPump já iniciado pôr a mensagem em inbound
		close(liberaHub)

		// Sem SFU, o hub responde SFU_UNAVAILABLE: a mensagem foi roteada depois do registro, e não descartada.
		esperaMensagem(t, aluno, fmt.Sprintf("rodada %d: resposta ao subscribe-request", i), func(m WsMessage) bool {
			if m.Type != TypeError {
				return false
			}
			var p ErrorPayload
			return json.Unmarshal(m.Payload, &p) == nil && p.Code == "SFU_UNAVAILABLE"
		})

		_ = aluno.Close()
		_ = prof.Close()
	}
}
