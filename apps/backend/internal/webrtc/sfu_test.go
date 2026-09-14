package webrtc

import (
	"testing"
)

func TestSFUService_Lifecycle(t *testing.T) {
	sfu, err := NewSFUService(Config{
		UDPPortMin: 50000,
		UDPPortMax: 50100,
	})
	if err != nil {
		t.Fatalf("Erro ao inicializar SFUService: %v", err)
	}

	roomID := "room-test-101"
	publisherID := "prof-01"

	// Mock SDP Offer valida
	dummySDP := "v=0\r\no=- 1457497746401030806 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=rtcp-mux\r\na=sendonly\r\na=mid:0\r\na=rtpmap:96 VP8/90000\r\n"

	answerSDP, err := sfu.HandlePublisherOffer(roomID, publisherID, dummySDP)
	if err != nil {
		t.Fatalf("Erro ao processar HandlePublisherOffer: %v", err)
	}

	if answerSDP == "" {
		t.Errorf("Answer SDP nao deveria ser vazia")
	}

	// Testar criacao de subscriber offer
	subscriberID := "student-01"
	subOfferSDP, err := sfu.CreateSubscriberOffer(roomID, subscriberID, publisherID)
	if err != nil {
		t.Fatalf("Erro ao criar SubscriberOffer: %v", err)
	}

	if subOfferSDP == "" {
		t.Errorf("Subscriber Offer SDP nao deveria ser vazia")
	}

	// Testar fechamento da sala
	if err := sfu.RoomClosed(roomID); err != nil {
		t.Errorf("Erro ao fechar sala: %v", err)
	}
}
