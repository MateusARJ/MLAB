package signaling

import (
	"sync"
	"testing"
	"time"
)

// keyframeCountingSFU conta os pedidos de keyframe que chegam à SFU.
type keyframeCountingSFU struct {
	mu       sync.Mutex
	requests int
}

func (s *keyframeCountingSFU) HandlePublisherOffer(string, string, string) (string, error) {
	return "", nil
}
func (s *keyframeCountingSFU) CreateSubscriberOffer(string, string, string) (string, error) {
	return "", nil
}
func (s *keyframeCountingSFU) HandleSubscriberAnswer(string, string, string) error { return nil }
func (s *keyframeCountingSFU) AddICECandidate(string, string, string) error        { return nil }
func (s *keyframeCountingSFU) PublisherDisconnected(string, string) error          { return nil }
func (s *keyframeCountingSFU) RoomClosed(string) error                             { return nil }
func (s *keyframeCountingSFU) RequestKeyFrame(string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.requests++
	return nil
}

func (s *keyframeCountingSFU) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.requests
}

func TestKeyframeLimiter_BurstThenRefill(t *testing.T) {
	var l keyframeLimiter
	t0 := time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC)

	for i := 1; i <= studentKeyFrameBurst; i++ {
		if !l.allow(t0) {
			t.Fatalf("pedido %d da rajada deveria passar", i)
		}
	}
	if l.allow(t0) {
		t.Fatal("pedido acima da rajada deveria ser descartado")
	}
	if l.allow(t0.Add(500 * time.Millisecond)) {
		t.Fatal("meio intervalo não recarrega um pedido inteiro")
	}
	if !l.allow(t0.Add(studentKeyFrameInterval)) {
		t.Fatal("após 1 intervalo um novo pedido deveria passar")
	}
	if l.allow(t0.Add(studentKeyFrameInterval)) {
		t.Fatal("só um pedido recarregado por intervalo")
	}
	// Muito tempo parado não acumula além da rajada.
	later := t0.Add(time.Hour)
	for i := 1; i <= studentKeyFrameBurst; i++ {
		if !l.allow(later) {
			t.Fatalf("pedido %d após pausa longa deveria passar", i)
		}
	}
	if l.allow(later) {
		t.Fatal("pausa longa não pode acumular além da rajada")
	}
}

func TestKeyframeLimiter_WatchdogCadenceStillServed(t *testing.T) {
	// O watchdog do web app pede keyframe a cada 500 ms enquanto o vídeo está congelado.
	// Em 10 s de congelamento, o aluno precisa continuar sendo atendido cerca de 1 vez por segundo.
	var l keyframeLimiter
	t0 := time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC)
	served := 0
	for i := 0; i < 20; i++ {
		if l.allow(t0.Add(time.Duration(i) * 500 * time.Millisecond)) {
			served++
		}
	}
	// 3 da rajada + ~1 por segundo nos 9,5 s seguintes.
	if served < 10 || served > 13 {
		t.Fatalf("esperado entre 10 e 13 pedidos atendidos em 10 s, obtido %d", served)
	}
}

func TestHub_RequestKeyFrame_ProfessorUnlimitedStudentLimited(t *testing.T) {
	sfu := &keyframeCountingSFU{}
	hub := &Hub{roomID: "room-kf", sfu: sfu}
	prof := &Client{participantID: "prof", role: RoleProfessor}
	student := &Client{participantID: "aluno-1", role: RoleAluno}
	other := &Client{participantID: "aluno-2", role: RoleAluno}
	now := time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC)

	for i := 0; i < 10; i++ {
		hub.onRequestKeyFrame(prof, now)
	}
	if got := sfu.count(); got != 10 {
		t.Fatalf("professor: esperado 10 pedidos repassados, obtido %d", got)
	}

	for i := 0; i < 100; i++ {
		hub.onRequestKeyFrame(student, now)
	}
	if got := sfu.count() - 10; got != studentKeyFrameBurst {
		t.Fatalf("aluno: esperado %d pedidos repassados de 100, obtido %d", studentKeyFrameBurst, got)
	}

	// Limite é por aluno: outro aluno não é afetado.
	hub.onRequestKeyFrame(other, now)
	if got := sfu.count() - 10 - studentKeyFrameBurst; got != 1 {
		t.Fatalf("outro aluno deveria ter o pedido repassado, obtido %d", got)
	}

	// Após 1 intervalo o primeiro aluno volta a ser atendido.
	hub.onRequestKeyFrame(student, now.Add(studentKeyFrameInterval))
	if got := sfu.count() - 11 - studentKeyFrameBurst; got != 1 {
		t.Fatalf("aluno deveria ser atendido após recarga, obtido %d", got)
	}
}

func TestHub_RequestKeyFrame_NoSFUIsNoop(t *testing.T) {
	hub := &Hub{roomID: "room-kf-nil"}
	student := &Client{participantID: "aluno", role: RoleAluno}
	hub.onRequestKeyFrame(student, time.Now()) // não deve entrar em pânico
}

func TestHub_RequestKeyFrame_RoutedThroughHub(t *testing.T) {
	// Garante que a mensagem request-keyframe do WebSocket passa pelo limite.
	sfu := &keyframeCountingSFU{}
	hub := newHub("room-kf-route", sfu)
	student := &Client{hub: hub, send: make(chan []byte, 64), participantID: "aluno-r", roomID: "room-kf-route", role: RoleAluno, name: "Aluno"}
	hub.register <- student

	for i := 0; i < 20; i++ {
		hub.inbound <- &envelope{client: student, msg: WsMessage{Type: TypeRequestKeyFrame, Payload: []byte(`{}`)}}
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && sfu.count() < studentKeyFrameBurst {
		time.Sleep(10 * time.Millisecond)
	}
	time.Sleep(100 * time.Millisecond) // dá tempo para pedidos excedentes, se existissem
	if got := sfu.count(); got != studentKeyFrameBurst {
		t.Fatalf("esperado %d pedidos repassados pelo hub, obtido %d", studentKeyFrameBurst, got)
	}
}
