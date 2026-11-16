package webrtc

import (
	"errors"
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

	// Sem a track de vídeo do professor não há oferta (023/RF-2302)
	subscriberID := "student-01"
	if _, err := sfu.CreateSubscriberOffer(roomID, subscriberID, publisherID); !errors.Is(err, ErrMediaNotReady) {
		t.Fatalf("Esperado ErrMediaNotReady antes da track de vídeo, recebeu: %v", err)
	}

	// Simula a track de vídeo criada pelo OnTrack e testa a criacao de subscriber offer
	room, _ := sfu.getRoom(roomID)
	if _, _, err := room.ensureLocalTrack(webrtc.RTPCodecTypeVideo, webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8, ClockRate: 90000}); err != nil {
		t.Fatalf("Erro ao criar track de vídeo: %v", err)
	}
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

func TestSFUService_PublisherSourceChange_TrackReuse(t *testing.T) {
	sfu, err := NewSFUService(Config{
		UDPPortMin: 50200,
		UDPPortMax: 50300,
	})
	if err != nil {
		t.Fatalf("Erro ao inicializar SFUService: %v", err)
	}

	roomID := "room-test-source-change"
	publisherID := "prof-source-change"

	// 1. Publisher envia primeira oferta (ex: Tela Cheia)
	pubPC1, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("Erro ao criar pubPC1: %v", err)
	}
	defer pubPC1.Close()

	_, _ = pubPC1.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo, webrtc.RTPTransceiverInit{
		Direction: webrtc.RTPTransceiverDirectionSendonly,
	})
	offer1, err := pubPC1.CreateOffer(nil)
	if err != nil {
		t.Fatalf("Erro ao criar offer1: %v", err)
	}

	answer1, err := sfu.HandlePublisherOffer(roomID, publisherID, offer1.SDP)
	if err != nil || answer1 == "" {
		t.Fatalf("Erro ao processar primeira offer: %v", err)
	}

	// Simula que a track de vídeo já havia sido recebida e ativada pelo SFU
	room, exists := sfu.getRoom(roomID)
	if !exists {
		t.Fatal("Sala deveria existir após primeira offer")
	}
	mockTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8, ClockRate: 90000},
		"video",
		"mlab-stream",
	)
	if err != nil {
		t.Fatalf("Erro ao criar mockTrack: %v", err)
	}
	room.mu.Lock()
	room.videoTrack = mockTrack
	room.mu.Unlock()

	// 2. Aluno se conecta à transmissão e recebe o videoTrack ativo
	subscriberID := "student-watching"
	subOfferSDP, err := sfu.CreateSubscriberOffer(roomID, subscriberID, publisherID)
	if err != nil || subOfferSDP == "" {
		t.Fatalf("Erro ao criar oferta do subscriber: %v", err)
	}

	// 3. Professor altera a fonte (ex: para Janela) e envia uma nova oferta
	pubPC2, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("Erro ao criar pubPC2: %v", err)
	}
	defer pubPC2.Close()

	_, _ = pubPC2.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo, webrtc.RTPTransceiverInit{
		Direction: webrtc.RTPTransceiverDirectionSendonly,
	})
	offer2, err := pubPC2.CreateOffer(nil)
	if err != nil {
		t.Fatalf("Erro ao criar offer2: %v", err)
	}

	answer2, err := sfu.HandlePublisherOffer(roomID, publisherID, offer2.SDP)
	if err != nil || answer2 == "" {
		t.Fatalf("Erro ao processar segunda offer (troca de fonte): %v", err)
	}

	// 4. Verifica que a sala continua com o subscriber registrado e com o mesmo videoTrack preservado
	room.mu.RLock()
	if _, ok := room.subscribers[subscriberID]; !ok {
		t.Errorf("Subscriber %s deveria continuar registrado na sala", subscriberID)
	}
	if room.videoTrack != mockTrack {
		t.Errorf("videoTrack da sala deveria ser o mesmo mockTrack preservado após troca de fonte")
	}
	room.mu.RUnlock()

	_ = sfu.RoomClosed(roomID)
}
