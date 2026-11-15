package signaling

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
	"github.com/MateusARJ/MLAB/apps/backend/internal/room"
	"github.com/gorilla/websocket"
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

// resultadoConexao descreve como terminou uma conexão aberta durante o encerramento da sala.
type resultadoConexao struct {
	handshake  int  // status HTTP quando o handshake foi recusado (0 se conectou)
	roomClosed bool // recebeu room-closed antes de a conexão fechar
	err        error
}

// conectaEAguarda abre o WebSocket da sala e lê até a conexão fechar ou o prazo vencer.
func conectaEAguarda(wsURL, token string) resultadoConexao {
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL+"?token="+token, nil)
	if err != nil {
		if resp != nil {
			return resultadoConexao{handshake: resp.StatusCode}
		}
		return resultadoConexao{err: err}
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var r resultadoConexao
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNoStatusReceived, websocket.CloseNormalClosure) &&
				!strings.Contains(err.Error(), "EOF") {
				r.err = err
			}
			return r
		}
		var msg WsMessage
		if json.Unmarshal(data, &msg) == nil && msg.Type == TypeRoomClosed {
			r.roomClosed = true
		}
	}
}

// TestServeWS_ConexaoDuranteEncerramento cobre US-3701 e US-3702 (037, issue #107) de ponta a ponta: alunos e o
// professor conectam o WebSocket enquanto o professor encerra a sala. Cada conexão termina com o handshake recusado
// (404/410) ou com room-closed; nenhuma fica registrada numa sessão viva, e a sala não ganha hub novo.
func TestServeWS_ConexaoDuranteEncerramento(t *testing.T) {
	t.Setenv("JWT_SECRET", "ws-closed-race-12345") // valor de teste, não é segredo real
	const rodadas, alunos = 15, 6

	for i := 0; i < rodadas; i++ {
		roomID := fmt.Sprintf("room-corrida-%d", i)
		store := newStoreComSala(t, roomID)
		handler := NewHandler(store, nil)
		handler.SetRoomClosedListener(func(id string) { // como o main.go (033): sala encerrada sai do store
			agora := time.Now()
			_ = store.UpdateRoomStatus(context.Background(), id, room.StatusClosed, &agora)
			_ = store.DeleteRoom(context.Background(), id)
		})
		mux := http.NewServeMux()
		handler.RegisterRoutes(mux)
		srv := httptest.NewServer(mux)
		wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws/rooms/" + roomID + "/signal"

		profToken, _, err := auth.SignProfessorToken("prof-1", "Professor")
		if err != nil {
			t.Fatalf("SignProfessorToken: %v", err)
		}
		prof, _, err := websocket.DefaultDialer.Dial(wsURL+"?token="+profToken, nil)
		if err != nil {
			t.Fatalf("professor não conectou: %v", err)
		}

		resultados := make([]resultadoConexao, alunos+1)
		var wg sync.WaitGroup
		for j := 0; j < alunos; j++ {
			token, err := auth.SignToken(auth.StudentMapClaims(fmt.Sprintf("aluno-%d", j), "Aluno",
				fmt.Sprintf("RA%02d", j), roomID))
			if err != nil {
				t.Fatalf("SignToken: %v", err)
			}
			wg.Add(1)
			go func(j int, token string) {
				defer wg.Done()
				resultados[j] = conectaEAguarda(wsURL, token)
			}(j, token)
		}
		// Um professor conecta durante o encerramento (como o desktop reconectando). Usa outro participant_id: com o
		// mesmo, o hub fecharia a conexão que envia o end-session com 4001 (RN-04) e a sala não encerraria.
		outroProf, _, err := auth.SignProfessorToken("prof-2", "Professor")
		if err != nil {
			t.Fatalf("SignProfessorToken: %v", err)
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			resultados[alunos] = conectaEAguarda(wsURL, outroProf)
		}()

		if err := prof.WriteJSON(map[string]any{"type": "end-session", "payload": map[string]any{}}); err != nil {
			t.Fatalf("end-session: %v", err)
		}
		wg.Wait()
		_ = prof.Close()
		srv.Close()

		for j, r := range resultados {
			switch {
			case r.err != nil:
				t.Fatalf("rodada %d, conexão %d: a conexão não terminou com room-closed nem foi fechada (sessão encerrada aceitou o registro?): %v", i, j, r.err)
			case r.handshake != 0:
				if r.handshake != http.StatusNotFound && r.handshake != http.StatusGone {
					t.Fatalf("rodada %d, conexão %d: handshake %d; esperado 404 ou 410", i, j, r.handshake)
				}
			case !r.roomClosed:
				t.Fatalf("rodada %d, conexão %d: conectou e não recebeu room-closed", i, j)
			}
		}
		if hub := handler.GetHub(roomID); hub == nil || !hub.isClosed() {
			t.Fatalf("rodada %d: a sala encerrada não deveria ter hub vivo", i)
		}
	}
}
