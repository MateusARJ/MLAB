package signaling

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
	"github.com/MateusARJ/MLAB/apps/backend/internal/room"
	"github.com/gorilla/websocket"
)

// esperaTermino aguarda a goroutine run() do hub terminar (done fechado).
func esperaTermino(t *testing.T, hub *Hub) {
	t.Helper()
	select {
	case <-hub.done:
	case <-time.After(2 * time.Second):
		t.Fatal("a goroutine do hub não terminou depois do encerramento")
	}
}

// semBloquear falha se fn não retornar em 1 s.
func semBloquear(t *testing.T, descricao string, fn func()) {
	t.Helper()
	feito := make(chan struct{})
	go func() {
		defer close(feito)
		fn()
	}()
	select {
	case <-feito:
	case <-time.After(time.Second):
		t.Fatalf("%s bloqueou depois do término do hub", descricao)
	}
}

// salaComEstado registra professor e aluno pela goroutine run() e deixa chat, arquivo e fixado na sala.
func salaComEstado(t *testing.T, hub *Hub) (prof, aluno *Client) {
	t.Helper()
	prof = newSessionTestClient(hub, "prof-1", "", RoleProfessor)
	aluno = newSessionTestClient(hub, "aluno-1", "2025116TADS0001", RoleAluno)
	hub.register <- prof
	hub.register <- aluno
	chat, _ := json.Marshal(ChatSendPayload{Content: "bom dia"})
	hub.inbound <- &envelope{client: aluno, msg: WsMessage{Type: TypeChatMessage, Payload: chat}}
	hub.BroadcastFileShared(FileSharedPayload{ID: "f-1", Name: "aula.pdf"})
	pin, _ := json.Marshal(PinMessageSendPayload{MessageID: "m-1", Pinned: true})
	hub.inbound <- &envelope{client: prof, msg: WsMessage{Type: TypePinMessage, Payload: pin}}
	// A sonda registrada depois recebe o histórico: prova que chat e arquivo estavam na sala antes do encerramento.
	// O fileShared é outro canal, então a sonda é refeita até o histórico de arquivos chegar.
	prazo := time.Now().Add(2 * time.Second)
	for i := 0; ; i++ {
		sonda := newSessionTestClient(hub, fmt.Sprintf("aluno-sonda-%d", i), fmt.Sprintf("2025116TADS9%03d", i), RoleAluno)
		hub.register <- sonda
		hub.unregister <- sonda // a ida e volta pelo hub garante que o registro da sonda terminou
		types, _ := drainTypes(t, sonda)
		if containsString(types, TypeChatHistory) && containsString(types, TypeFilesHistory) {
			return prof, aluno
		}
		if time.Now().After(prazo) {
			t.Fatalf("a sala deveria ter chat e arquivo antes do encerramento; a sonda recebeu %v", types)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// confereEstadoLiberado cobre RF-4102: o hub encerrado não guarda clientes, chat, arquivos, fixados nem limites.
// Só pode ser chamado depois de done fechar.
func confereEstadoLiberado(t *testing.T, hub *Hub) {
	t.Helper()
	if len(hub.clients) != 0 || len(hub.chatLimits) != 0 || len(hub.chatHistory) != 0 || len(hub.sharedFiles) != 0 ||
		len(hub.pinnedPublic) != 0 || len(hub.pinnedPrivate) != 0 {
		t.Fatalf("estado não liberado: clients=%d chatLimits=%d chat=%d arquivos=%d fixados=%d privados=%d",
			len(hub.clients), len(hub.chatLimits), len(hub.chatHistory), len(hub.sharedFiles), len(hub.pinnedPublic),
			len(hub.pinnedPrivate))
	}
	if hub.publisherTimer != nil {
		t.Fatal("o timer de reconexão deveria ser parado")
	}
	if !hub.isClosed() {
		t.Fatal("o hub deveria continuar encerrado (marcador da 037)")
	}
}

// TestHub_TerminaDepoisDoEndSession cobre RF-4101 e RF-4102 (041, issue #109).
func TestHub_TerminaDepoisDoEndSession(t *testing.T) {
	hub := newHub("room-termino-1", nil)
	prof, _ := salaComEstado(t, hub)

	hub.inbound <- &envelope{client: prof, msg: WsMessage{Type: TypeEndSession}}

	esperaTermino(t, hub)
	confereEstadoLiberado(t, hub)
}

// TestHub_TerminaDepoisDeBroadcastRoomClosed cobre RF-4101 e RF-4102 (041, issue #109) pelo encerramento do REST.
func TestHub_TerminaDepoisDeBroadcastRoomClosed(t *testing.T) {
	hub := newHub("room-termino-2", nil)
	salaComEstado(t, hub)

	hub.BroadcastRoomClosed()

	esperaTermino(t, hub)
	confereEstadoLiberado(t, hub)
}

// TestHub_TerminaDepoisDoTimeoutDeReconexao cobre RF-4101 e RF-4102 (041, issue #109) pelo timeout de reconexão. O
// sinal é enviado direto, sem esperar os 30 s do timer, que também precisa ser parado.
func TestHub_TerminaDepoisDoTimeoutDeReconexao(t *testing.T) {
	hub := newHub("room-termino-3", nil)
	prof, _ := salaComEstado(t, hub)
	hub.inbound <- &envelope{client: prof, msg: WsMessage{Type: TypePublishRequest}}
	hub.unregister <- prof // publishing → reconnecting, com o timer de 30 s armado

	hub.internal <- sigPublisherTimeout

	esperaTermino(t, hub)
	confereEstadoLiberado(t, hub)
}

// TestHub_EnviosDepoisDoTerminoNaoBloqueiam cobre RF-4103 (041, issue #109): nenhum envio ao hub encerrado bloqueia, e
// o cliente que chega depois do término recebe room-closed e é fechado (037/RF-3701).
func TestHub_EnviosDepoisDoTerminoNaoBloqueiam(t *testing.T) {
	hub := newHub("room-termino-4", nil)
	hub.BroadcastRoomClosed()
	esperaTermino(t, hub)

	atrasado := newSessionTestClient(hub, "aluno-atrasado", "2025116TADS0003", RoleAluno)
	semBloquear(t, "enroll", func() {
		if hub.enroll(atrasado) {
			t.Error("enroll deveria recusar o cliente depois do término")
		}
	})
	types, closed := drainTypes(t, atrasado)
	if len(types) != 1 || types[0] != TypeRoomClosed || !closed {
		t.Fatalf("mensagens = %v, fechado = %v; esperado só %s e o fechamento", types, closed, TypeRoomClosed)
	}

	semBloquear(t, "leave", func() { hub.leave(atrasado) })
	semBloquear(t, "deliver", func() {
		for i := 0; i < cap(hub.inbound)+1; i++ { // mais que o buffer de inbound
			if hub.deliver(&envelope{client: atrasado, msg: WsMessage{Type: TypeChatMessage}}) {
				t.Error("deliver deveria recusar a mensagem depois do término")
				return
			}
		}
	})
	semBloquear(t, "sinais internos", func() {
		for i := 0; i < cap(hub.internal)+1; i++ { // mais que o buffer de internal
			hub.BroadcastRoomClosed()
			hub.BroadcastStreamStarted()
			hub.sendSignal(sigPublisherTimeout)
		}
	})
	semBloquear(t, "BroadcastFileShared", func() {
		for i := 0; i < cap(hub.fileShared)+1; i++ {
			hub.BroadcastFileShared(FileSharedPayload{ID: "f"})
		}
	})
	if len(hub.fileShared) != 0 || len(hub.inbound) != 0 || len(hub.internal) != 0 {
		t.Fatalf("o hub encerrado não deveria acumular envios (fileShared=%d, inbound=%d, internal=%d)",
			len(hub.fileShared), len(hub.inbound), len(hub.internal))
	}
}

// TestServeWS_HubEncerradoNaoDeixaGoroutine cobre RF-4101 (041, issue #109) de ponta a ponta: salas encerradas pelo
// professor não deixam goroutines para trás.
func TestServeWS_HubEncerradoNaoDeixaGoroutine(t *testing.T) {
	t.Setenv("JWT_SECRET", "ws-termino-do-hub-12345") // valor de teste, não é segredo real
	const salas = 20

	store := room.NewInMemoryStore()
	handler := NewHandler(store, nil)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	base := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws/rooms/"
	profToken, _, err := auth.SignProfessorToken("prof-1", "Professor")
	if err != nil {
		t.Fatalf("SignProfessorToken: %v", err)
	}

	antes := runtime.NumGoroutine()
	for i := 0; i < salas; i++ {
		roomID := fmt.Sprintf("room-goroutine-%d", i)
		if err := store.CreateRoom(context.Background(), &room.Room{ID: roomID, Slug: roomID + "-slug", OwnerID: "prof-1",
			Status: room.StatusWaiting, MaxParticipants: 50, CreatedAt: time.Now()}); err != nil {
			t.Fatalf("CreateRoom: %v", err)
		}
		prof, _, err := websocket.DefaultDialer.Dial(base+roomID+"/signal?token="+profToken, nil)
		if err != nil {
			t.Fatalf("sala %d: professor não conectou: %v", i, err)
		}
		if err := prof.WriteJSON(map[string]any{"type": TypeEndSession, "payload": map[string]any{}}); err != nil {
			t.Fatalf("sala %d: end-session: %v", i, err)
		}
		esperaMensagem(t, prof, fmt.Sprintf("sala %d: room-closed", i), func(m WsMessage) bool {
			return m.Type == TypeRoomClosed
		})
		_ = prof.Close()
		esperaTermino(t, handler.GetHub(roomID))
	}

	// As goroutines de cada conexão (readPump, writePump, servidor HTTP) terminam logo depois do fechamento; a do hub,
	// com a correção, também. Sem ela, sobram `salas` goroutines run().
	const folga = 5
	prazo := time.Now().Add(3 * time.Second)
	for {
		depois := runtime.NumGoroutine()
		if depois <= antes+folga {
			return
		}
		if time.Now().After(prazo) {
			t.Fatalf("goroutines: %d antes, %d depois de encerrar %d salas; esperado no máximo %d", antes, depois, salas,
				antes+folga)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
