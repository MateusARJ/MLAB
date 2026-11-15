package signaling

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
	"github.com/MateusARJ/MLAB/apps/backend/internal/room"
)

// drainTypes lê as mensagens pendentes do cliente e informa os tipos recebidos e se o canal send foi fechado.
func drainTypes(t *testing.T, c *Client) (types []string, closed bool) {
	t.Helper()
	for {
		select {
		case raw, ok := <-c.send:
			if !ok {
				return types, true
			}
			var msg WsMessage
			if err := json.Unmarshal(raw, &msg); err != nil {
				t.Fatalf("mensagem inválida: %v", err)
			}
			types = append(types, msg.Type)
		default:
			return types, false
		}
	}
}

// TestHub_RegistroAposEncerramento_AlunoRecebeRoomClosed cobre RF-3701 (037, issue #107): o aluno registrado depois
// do encerramento recebe room-closed, tem a conexão fechada e não ocupa a sala nem a matrícula.
func TestHub_RegistroAposEncerramento_AlunoRecebeRoomClosed(t *testing.T) {
	hub := newHub("room-encerrada-1", nil)
	hub.onRoomClose()

	aluno := newSessionTestClient(hub, "aluno-1", "2025116TADS0001", RoleAluno)
	hub.onRegister(aluno)

	types, closed := drainTypes(t, aluno)
	if len(types) != 1 || types[0] != TypeRoomClosed {
		t.Fatalf("mensagens = %v; esperado só %s", types, TypeRoomClosed)
	}
	if !closed {
		t.Fatal("a conexão do aluno deveria ser fechada")
	}
	if aluno.closeCode != 0 {
		t.Fatalf("close code = %d; esperado frame vazio", aluno.closeCode)
	}
	if len(hub.clients) != 0 {
		t.Fatalf("o aluno não deveria entrar na sala encerrada (clients=%d)", len(hub.clients))
	}
	if hub.HasConnectedStudent("2025116TADS0001") {
		t.Fatal("a matrícula não deveria ficar reservada na sala encerrada")
	}

	// O unregister enviado pelo readPump da conexão recusada é ignorado.
	hub.onUnregister(aluno)
	if hub.status != SessionClosed {
		t.Fatalf("status = %s; esperado closed", hub.status)
	}
}

// TestHub_RegistroAposEncerramento_ProfessorNaoReabreSessao cobre RF-3701 (037, issue #107): o professor registrado
// depois do encerramento é recusado, e o publish-request que o desktop envia ao abrir a conexão não volta a sessão para
// publishing nem aprova publicação.
func TestHub_RegistroAposEncerramento_ProfessorNaoReabreSessao(t *testing.T) {
	var avisos []SessionStatus
	hub := newHubWithCallbacks("room-encerrada-2", nil, hubCallbacks{
		onStatusChanged: func(_ string, s SessionStatus) { avisos = append(avisos, s) },
	})
	professor := newSessionTestClient(hub, "prof-1", "", RoleProfessor)
	hub.onRegister(professor)
	hub.onRoomClose()
	avisos = nil

	volta := newSessionTestClient(hub, "prof-1", "", RoleProfessor)
	hub.onRegister(volta)
	hub.route(&envelope{client: volta, msg: WsMessage{Type: TypePublishRequest}})

	types, closed := drainTypes(t, volta)
	if len(types) != 1 || types[0] != TypeRoomClosed {
		t.Fatalf("mensagens = %v; esperado só %s (sem %s)", types, TypeRoomClosed, TypePublishApproved)
	}
	if !closed {
		t.Fatal("a conexão do professor deveria ser fechada")
	}
	if hub.status != SessionClosed {
		t.Fatalf("status = %s; a sessão encerrada não deveria reabrir", hub.status)
	}
	if len(avisos) != 0 {
		t.Fatalf("nenhuma mudança de status deveria ser avisada ao store, avisos=%v", avisos)
	}
	if _, ok := hub.clients["prof-1"]; ok {
		t.Fatal("o professor não deveria entrar na sala encerrada")
	}
	if hub.publisherTimer != nil {
		t.Fatal("nenhum timer de reconexão deveria ser criado")
	}
}

// newStoreComSala cria um store em memória com uma sala aberta (waiting).
func newStoreComSala(t *testing.T, roomID string) room.Store {
	t.Helper()
	store := room.NewInMemoryStore()
	err := store.CreateRoom(context.Background(), &room.Room{
		ID:              roomID,
		Slug:            roomID + "-slug",
		OwnerID:         "prof-1",
		Status:          room.StatusWaiting,
		MaxParticipants: 50,
		CreatedAt:       time.Now(),
	})
	if err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	return store
}

// esperaEncerrar aguarda a goroutine run() processar o encerramento do hub.
func esperaEncerrar(t *testing.T, hub *Hub) {
	t.Helper()
	prazo := time.Now().Add(2 * time.Second)
	for !hub.isClosed() {
		if time.Now().After(prazo) {
			t.Fatal("o hub não encerrou a tempo")
		}
		time.Sleep(time.Millisecond)
	}
}

// TestHandler_GetOrCreateHub_ConsultaOStore cobre RF-3703 (037, issue #107): sem hub, só a sala aberta no store ganha
// hub; sala ausente ou closed não ganha.
func TestHandler_GetOrCreateHub_ConsultaOStore(t *testing.T) {
	ctx := context.Background()
	store := newStoreComSala(t, "room-aberta")
	if err := store.CreateRoom(ctx, &room.Room{ID: "room-fechada", Slug: "room-fechada-slug", OwnerID: "prof-2",
		Status: room.StatusWaiting, MaxParticipants: 50, CreatedAt: time.Now()}); err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	agora := time.Now()
	if err := store.UpdateRoomStatus(ctx, "room-fechada", room.StatusClosed, &agora); err != nil {
		t.Fatalf("UpdateRoomStatus: %v", err)
	}
	handler := NewHandler(store, nil)

	if hub, ok := handler.getOrCreateHub("room-aberta"); !ok || hub == nil {
		t.Fatal("a sala aberta deveria ganhar hub")
	}
	for _, roomID := range []string{"room-fechada", "room-inexistente"} {
		if _, ok := handler.getOrCreateHub(roomID); ok {
			t.Fatalf("%s não deveria ganhar hub", roomID)
		}
		if handler.GetHub(roomID) != nil {
			t.Fatalf("nenhum hub deveria ser criado para %s", roomID)
		}
	}
}

// TestHandler_HandshakeComHubEncerrado cobre RF-3702 e RF-3704 (037, issue #107): com a sessão já encerrada pelo hub e
// a sala ainda no store (antes do onClosed removê-la), o handshake responde 410 e o hub não é recriado.
func TestHandler_HandshakeComHubEncerrado(t *testing.T) {
	const roomID = "room-handshake-encerrada"
	t.Setenv("JWT_SECRET", "ws-closed-secret-12345") // valor de teste, não é segredo real
	handler := NewHandler(newStoreComSala(t, roomID), nil)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	antigo, ok := handler.getOrCreateHub(roomID)
	if !ok {
		t.Fatal("a sala aberta deveria ganhar hub")
	}
	antigo.BroadcastRoomClosed()
	esperaEncerrar(t, antigo)

	token, err := auth.SignToken(auth.StudentMapClaims("aluno-1", "Aluno", "RA-01", roomID))
	if err != nil {
		t.Fatalf("SignToken: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/ws/rooms/"+roomID+"/signal?token="+token, nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusGone {
		t.Fatalf("status = %d; esperado 410", rec.Code)
	}
	if handler.GetHub(roomID) != antigo {
		t.Fatal("o hub encerrado deveria continuar como marcador, sem hub novo")
	}
}
