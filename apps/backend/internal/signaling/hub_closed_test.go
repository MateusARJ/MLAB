package signaling

import (
	"encoding/json"
	"testing"
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
