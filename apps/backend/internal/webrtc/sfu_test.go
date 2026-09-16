package webrtc

import (
	"testing"

	"github.com/pion/webrtc/v3"
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

	// Cria uma PeerConnection de teste para gerar SDP Offer válida com ICE e codecs
	testPC, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("Erro ao criar test PeerConnection: %v", err)
	}
	defer testPC.Close()

	_, _ = testPC.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo, webrtc.RTPTransceiverInit{
		Direction: webrtc.RTPTransceiverDirectionSendonly,
	})
	_, _ = testPC.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio, webrtc.RTPTransceiverInit{
		Direction: webrtc.RTPTransceiverDirectionSendonly,
	})

	offer, err := testPC.CreateOffer(nil)
	if err != nil {
		t.Fatalf("Erro ao criar Offer de teste: %v", err)
	}

	answerSDP, err := sfu.HandlePublisherOffer(roomID, publisherID, offer.SDP)
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
