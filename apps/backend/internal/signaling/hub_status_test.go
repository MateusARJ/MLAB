package signaling

import (
	"reflect"
	"testing"
)

// TestHub_AvisaMudancaDeStatus cobre RF-3501 e RNF-3502 (035, issue #101): o hub avisa `publishing` quando o
// professor entra, `reconnecting` quando ele cai e `publishing` quando volta, só quando o status muda e nunca para o
// encerramento, que segue por onClosed (033).
func TestHub_AvisaMudancaDeStatus(t *testing.T) {
	var avisos []SessionStatus
	fechadas := 0
	hub := newHubWithCallbacks("room-status-1", nil, hubCallbacks{
		onClosed: func(string) { fechadas++ },
		onStatusChanged: func(roomID string, status SessionStatus) {
			if roomID != "room-status-1" {
				t.Errorf("roomID do aviso = %q", roomID)
			}
			avisos = append(avisos, status)
		},
	})

	professor := newSessionTestClient(hub, "prof-1", "", RoleProfessor)
	aluno := newSessionTestClient(hub, "aluno-1", "2025116TADS0001", RoleAluno)

	// Aluno entra antes do professor: a sala segue em waiting, sem aviso.
	hub.onRegister(aluno)
	if len(avisos) != 0 {
		t.Fatalf("entrada de aluno não deveria mudar o status, avisos=%v", avisos)
	}

	// Professor entra: publishing. publish-request e trilha pronta mantêm publishing sem aviso repetido.
	hub.onRegister(professor)
	hub.onPublishRequest(professor)
	hub.onStreamStarted()

	// Professor cai: reconnecting. Volta antes do timeout: publishing.
	hub.onUnregister(professor)
	if hub.publisherTimer != nil {
		hub.publisherTimer.Stop()
	}
	volta := newSessionTestClient(hub, "prof-1", "", RoleProfessor)
	hub.onRegister(volta)

	want := []SessionStatus{SessionPublishing, SessionReconnecting, SessionPublishing}
	if !reflect.DeepEqual(avisos, want) {
		t.Fatalf("avisos = %v; esperado %v", avisos, want)
	}

	// Encerramento: avisa por onClosed, não por onStatusChanged.
	hub.onRoomClose()
	if fechadas != 1 {
		t.Fatalf("onClosed chamado %d vezes; esperado 1", fechadas)
	}
	if !reflect.DeepEqual(avisos, want) {
		t.Fatalf("o encerramento não deveria passar por onStatusChanged, avisos=%v", avisos)
	}
}

// Sem callback configurado (newHub dos testes e do modo stub), mudar o status não falha.
func TestHub_StatusSemCallback(t *testing.T) {
	hub := newHub("room-status-2", nil)
	professor := newSessionTestClient(hub, "prof-1", "", RoleProfessor)
	hub.onRegister(professor)
	if hub.status != SessionPublishing {
		t.Fatalf("status = %s; esperado publishing", hub.status)
	}
}
