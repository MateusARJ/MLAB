package signaling

import "testing"

// Testes da sessão única por aluno (RN-04 — 005-correcoes-smoke/T501; ADR 0010 — 027/T2702).

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

// 027/RF-2703: outro aluno com a mesma matrícula é recusado com 4002 e o primeiro continua.
func TestHub_SessaoUnica_MesmaMatriculaRecusaNovaCom4002(t *testing.T) {
	hub := newHub("room-sessao-1", nil)
	first := newSessionTestClient(hub, "p-1", "2025116TADS0001", RoleAluno)
	second := newSessionTestClient(hub, "p-2", " 2025116tads0001 ", RoleAluno) // C-501: ignora caixa e espaços

	hub.onRegister(first)
	hub.onRegister(second)

	if isClosed(first) {
		t.Fatal("o aluno já conectado não deveria ser encerrado")
	}
	if hub.clients["p-1"] != first {
		t.Fatal("o aluno já conectado deveria continuar registrado")
	}
	if !isClosed(second) {
		t.Fatal("a nova conexão com a matrícula em uso deveria ser recusada")
	}
	if second.closeCode != CloseStudentIDInUse || second.closeReason != "Student ID In Use" {
		t.Fatalf("close code = %d %q; esperado 4002 \"Student ID In Use\"", second.closeCode, second.closeReason)
	}
	if _, ok := hub.clients["p-2"]; ok {
		t.Fatal("a conexão recusada não deveria entrar na sala")
	}

	// O unregister da conexão recusada não pode liberar a matrícula do primeiro aluno.
	hub.onUnregister(second)
	if !hub.HasConnectedStudent("2025116TADS0001") {
		t.Fatal("a matrícula do aluno conectado não deveria ser liberada pela conexão recusada")
	}
}

// 027/RF-2705: a matrícula fica livre quando o aluno sai.
func TestHub_SessaoUnica_MatriculaLiberadaAoSair(t *testing.T) {
	hub := newHub("room-sessao-5", nil)
	first := newSessionTestClient(hub, "p-1", "2025116TADS0001", RoleAluno)

	if hub.HasConnectedStudent("2025116TADS0001") {
		t.Fatal("matrícula não deveria constar antes do registro")
	}
	hub.onRegister(first)
	if !hub.HasConnectedStudent("2025116tads0001") {
		t.Fatal("HasConnectedStudent deveria ser verdadeiro com o aluno registrado (ignorando caixa)")
	}

	hub.onUnregister(first)
	if hub.HasConnectedStudent("2025116TADS0001") {
		t.Fatal("a matrícula deveria ser liberada após o desregistro")
	}

	again := newSessionTestClient(hub, "p-2", "2025116TADS0001", RoleAluno)
	hub.onRegister(again)
	if isClosed(again) || hub.clients["p-2"] != again {
		t.Fatal("a matrícula liberada deveria ser aceita numa nova entrada")
	}
}

// Encerrar a sala libera todas as matrículas.
func TestHub_SessaoUnica_EncerramentoLiberaMatriculas(t *testing.T) {
	hub := newHub("room-sessao-6", nil)
	hub.onRegister(newSessionTestClient(hub, "p-1", "2025116TADS0001", RoleAluno))
	hub.onRoomClose()
	if hub.HasConnectedStudent("2025116TADS0001") {
		t.Fatal("o encerramento da sala deveria liberar as matrículas")
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
	if isClosed(again) {
		t.Fatal("a reconexão do mesmo participante não deveria ser recusada com 4002 (RF-2704)")
	}

	// O unregister da conexão antiga não libera a matrícula da conexão atual.
	hub.onUnregister(first)
	if !hub.HasConnectedStudent("2025116TADS0001") {
		t.Fatal("a matrícula deveria continuar em uso pela conexão atual")
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
