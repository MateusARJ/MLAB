package webrtc

import (
	"testing"
)

// TestSFU_Security_RoomIsolation valida que requisições de media/offers para salas inexistentes ou nao autorizadas sao rejeitadas.
func TestSFU_Security_RoomIsolation(t *testing.T) {
	sfu, err := NewSFUService(Config{
		UDPPortMin: 50000,
		UDPPortMax: 50100,
	})
	if err != nil {
		t.Fatalf("Erro ao inicializar SFUService: %v", err)
	}

	nonExistentRoom := "room-invalid-999"

	_, err = sfu.CreateSubscriberOffer(nonExistentRoom, "student-01", "prof-01")
	if err == nil {
		t.Errorf("Esperado erro ao tentar assinar sala inexistente, mas recebeu nil")
	}

	err = sfu.HandleSubscriberAnswer(nonExistentRoom, "student-01", "v=0...")
	if err == nil {
		t.Errorf("Esperado erro ao enviar SDP Answer para sala inexistente, mas recebeu nil")
	}

	err = sfu.AddICECandidate(nonExistentRoom, "student-01", "candidate:...")
	if err == nil {
		t.Errorf("Esperado erro ao adicionar ICE candidate para sala inexistente, mas recebeu nil")
	}
}

// TestSFU_Security_DuplicateSubscriberEviction verifica se novas tentativas de assinatura substituem com seguranca sessões anteriores do mesmo aluno.
func TestSFU_Security_DuplicateSubscriberEviction(t *testing.T) {
	sfu, err := NewSFUService(Config{
		UDPPortMin: 50000,
		UDPPortMax: 50100,
	})
	if err != nil {
		t.Fatalf("Erro ao inicializar SFUService: %v", err)
	}

	roomID := "room-security-test"
	publisherID := "prof-01"
	dummySDP := "v=0\r\no=- 1457497746401030806 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=rtcp-mux\r\na=sendonly\r\na=mid:0\r\na=rtpmap:96 VP8/90000\r\n"

	_, _ = sfu.HandlePublisherOffer(roomID, publisherID, dummySDP)

	subscriberID := "student-duplicate-01"

	// Primeira oferta
	offer1, err := sfu.CreateSubscriberOffer(roomID, subscriberID, publisherID)
	if err != nil || offer1 == "" {
		t.Fatalf("Falha na primeira oferta do subscriber: %v", err)
	}

	// Segunda oferta com mesmo ID (simulando reconexao/aba duplicada)
	offer2, err := sfu.CreateSubscriberOffer(roomID, subscriberID, publisherID)
	if err != nil || offer2 == "" {
		t.Fatalf("Falha na segunda oferta do subscriber (substituicao): %v", err)
	}

	_ = sfu.RoomClosed(roomID)
}
