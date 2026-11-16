package signaling

import (
	"reflect"
	"sync"
	"testing"
	"time"
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

// TestHandler_GetOrCreateHubConcorrenteAoEncerramento cobre RF-3601 (036, issue #102) e RF-3702 (037, issue #107): o
// handler lê o status do hub enquanto a goroutine run() o encerra, sem data race, e depois do encerramento recusa a
// sala sem criar hub novo (a 037 substitui a US-3601). Com `go test -race`, a leitura direta de hub.status que existia
// antes seria acusada aqui.
func TestHandler_GetOrCreateHubConcorrenteAoEncerramento(t *testing.T) {
	const roomID = "room-status-concorrente"
	handler := NewHandler(nil, nil)
	antigo, ok := handler.getOrCreateHub(roomID)
	if !ok {
		t.Fatal("a sala aberta deveria ganhar hub")
	}

	parar := make(chan struct{})
	var wg sync.WaitGroup
	var novos sync.Map // hubs diferentes do antigo devolvidos por getOrCreateHub
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-parar:
					return
				default:
					if h, ok := handler.getOrCreateHub(roomID); ok && h != antigo {
						novos.Store(h, true)
					}
				}
			}
		}()
	}

	// O encerramento passa pelo canal interno e é processado na goroutine run() do hub antigo.
	antigo.BroadcastRoomClosed()

	recusou := false
	prazo := time.Now().Add(2 * time.Second)
	for time.Now().Before(prazo) {
		if _, ok := handler.getOrCreateHub(roomID); !ok {
			recusou = true
			break
		}
		time.Sleep(time.Millisecond)
	}
	close(parar)
	wg.Wait()

	if !recusou {
		t.Fatal("getOrCreateHub continuou aceitando a sala encerrada")
	}
	if !antigo.isClosed() {
		t.Fatal("o hub antigo deveria estar encerrado")
	}
	novos.Range(func(any, any) bool {
		t.Fatal("nenhum hub novo deveria ser criado para a sala encerrada")
		return false
	})
	if handler.GetHub(roomID) != antigo {
		t.Fatal("o hub encerrado deveria continuar no mapa como marcador")
	}
}
