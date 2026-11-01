package signaling

import "testing"

// Testes da sessão única por aluno (RN-04 — 005-correcoes-smoke/T501).

func newSessionTestClient(hub *Hub, participantID, studentID string, role Role) *Client {
	return &Client{
		hub:           hub,
		send:          make(chan []byte, 64),
		participantID: participantID,
		roomID:        hub.roomID,
		role:          role,
		name:          "Aluno " + participantID,
		studentID:     studentID,
	}
}

// isClosed drena o canal send e informa se ele foi fechado.
func isClosed(c *Client) bool {
	for {
		select {
		case _, ok := <-c.send:
			if !ok {
				return true
			}
		default:
			return false
		}
	}
}

func TestHub_SessaoUnica_MesmaMatriculaFechaAnteriorCom4001(t *testing.T) {
	hub := newHub("room-sessao-1", nil)
	first := newSessionTestClient(hub, "p-1", "2025116TADS0001", RoleAluno)
	second := newSessionTestClient(hub, "p-2", "2025116tads0001", RoleAluno) // C-501: ignora caixa

	hub.onRegister(first)
	hub.onRegister(second)

	if !isClosed(first) {
		t.Fatal("a sessão anterior com a mesma matrícula deveria ter sido encerrada")
	}
	if first.closeCode != CloseDuplicateSession || first.closeReason != "Duplicate Session" {
		t.Fatalf("close code = %d %q; esperado 4001 \"Duplicate Session\"", first.closeCode, first.closeReason)
	}
	if isClosed(second) {
		t.Fatal("a nova sessão não deveria ser encerrada")
	}
}

func TestHub_SessaoUnica_MesmoParticipanteFechaAnteriorCom4001(t *testing.T) {
	hub := newHub("room-sessao-2", nil)
	first := newSessionTestClient(hub, "p-1", "2025116TADS0001", RoleAluno)
	again := newSessionTestClient(hub, "p-1", "2025116TADS0001", RoleAluno)

	hub.onRegister(first)
	hub.onRegister(again)

	if !isClosed(first) || first.closeCode != CloseDuplicateSession {
		t.Fatalf("reconexão com o mesmo token deveria fechar a anterior com 4001 (code=%d)", first.closeCode)
	}
	if hub.clients["p-1"] != again {
		t.Fatal("a conexão registrada deveria ser a mais recente")
	}
}

func TestHub_SessaoUnica_MatriculasDiferentesNaoSeDerrubam(t *testing.T) {
	hub := newHub("room-sessao-3", nil)
	a := newSessionTestClient(hub, "p-1", "2025116TADS0001", RoleAluno)
	b := newSessionTestClient(hub, "p-2", "2025116TADS0002", RoleAluno)
	prof := newSessionTestClient(hub, "prof", "", RoleProfessor)

	hub.onRegister(prof)
	hub.onRegister(a)
	hub.onRegister(b)

	if isClosed(a) || isClosed(b) || isClosed(prof) {
		t.Fatal("participantes distintos não deveriam ser encerrados")
	}
}

func TestClient_CloseSemCodigoMantemFrameVazio(t *testing.T) {
	hub := newHub("room-sessao-4", nil)
	c := newSessionTestClient(hub, "p-1", "", RoleAluno)
	c.close()
	c.closeWithCode(CloseDuplicateSession, "Duplicate Session") // sem efeito após o primeiro fechamento
	if c.closeCode != 0 {
		t.Fatalf("close() não deveria definir close code (RNF-501), obtido %d", c.closeCode)
	}
}
