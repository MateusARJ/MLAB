package webrtc

import (
	"errors"
	"regexp"
	"strings"
	"testing"

	"github.com/pion/webrtc/v3"
)

var (
	testVideoCodec = webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8, ClockRate: 90000}
	testAudioCodec = webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2}
	iceUfragRe     = regexp.MustCompile(`a=ice-ufrag:(\S+)`)
)

// newTestRoom cria uma sala da SFU sem publisher; as tracks são preenchidas como o OnTrack faria.
func newTestRoom(t *testing.T) *Room {
	t.Helper()
	sfu, err := NewSFUService(Config{UDPPortMin: 50400, UDPPortMax: 50500})
	if err != nil {
		t.Fatalf("Erro ao inicializar SFUService: %v", err)
	}
	room := sfu.getOrCreateRoom("room-023")
	t.Cleanup(room.close)
	return room
}

func addLocalTrack(t *testing.T, room *Room, kind webrtc.RTPCodecType) bool {
	t.Helper()
	codec := testVideoCodec
	if kind == webrtc.RTPCodecTypeAudio {
		codec = testAudioCodec
	}
	track, notify, err := room.ensureLocalTrack(kind, codec)
	if err != nil || track == nil {
		t.Fatalf("Erro ao criar track local %s: %v", kind.String(), err)
	}
	return notify
}

func iceUfrag(t *testing.T, sdp string) string {
	t.Helper()
	m := iceUfragRe.FindStringSubmatch(sdp)
	if m == nil {
		t.Fatalf("oferta sem ice-ufrag:\n%s", sdp)
	}
	return m[1]
}

// 023/RF-2302: sem a track de vídeo do professor, a SFU não oferta nem registra PeerConnection do aluno.
func TestRoom_SubscriberOffer_SemTrackDeVideo(t *testing.T) {
	room := newTestRoom(t)

	_, err := room.createSubscriberOffer("aluno-01", "prof-01")
	if !errors.Is(err, ErrMediaNotReady) {
		t.Fatalf("esperado ErrMediaNotReady, recebeu: %v", err)
	}

	room.mu.RLock()
	defer room.mu.RUnlock()
	if len(room.subscribers) != 0 {
		t.Errorf("nenhuma PeerConnection deveria ser registrada, há %d", len(room.subscribers))
	}
}

// 023/RF-2303: a oferta pendente criada antes de uma track nova não é reaproveitada.
func TestRoom_SubscriberOffer_TrackNovaDescartaOfertaPendente(t *testing.T) {
	room := newTestRoom(t)
	addLocalTrack(t, room, webrtc.RTPCodecTypeVideo)

	offer1, err := room.createSubscriberOffer("aluno-01", "prof-01")
	if err != nil {
		t.Fatalf("primeira oferta: %v", err)
	}
	if strings.Contains(offer1, "m=audio") {
		t.Fatalf("a primeira oferta não deveria ter áudio:\n%s", offer1)
	}
	room.mu.RLock()
	pc1 := room.subscribers["aluno-01"]
	room.mu.RUnlock()

	// O áudio do professor chega depois; o aluno assina de novo sem ter respondido a primeira oferta.
	addLocalTrack(t, room, webrtc.RTPCodecTypeAudio)
	offer2, err := room.createSubscriberOffer("aluno-01", "prof-01")
	if err != nil {
		t.Fatalf("segunda oferta: %v", err)
	}

	for _, want := range []string{"m=video", "m=audio", "mlab-stream", "b=AS:6000", "b=TIAS:6000000"} {
		if !strings.Contains(offer2, want) {
			t.Errorf("a oferta nova deveria conter %q:\n%s", want, offer2)
		}
	}
	if iceUfrag(t, offer1) == iceUfrag(t, offer2) {
		t.Error("a oferta nova deveria vir de outra PeerConnection (ice-ufrag igual)")
	}
	if pc1.ConnectionState() != webrtc.PeerConnectionStateClosed {
		t.Errorf("a PeerConnection da oferta antiga deveria estar fechada, está %s", pc1.ConnectionState())
	}
}

// 023/RN-2301: assinatura duplicada sem track nova recebe a mesma oferta, com as linhas de banda.
func TestRoom_SubscriberOffer_DuplicadaMesmaGeracaoReaproveita(t *testing.T) {
	room := newTestRoom(t)
	addLocalTrack(t, room, webrtc.RTPCodecTypeVideo)
	addLocalTrack(t, room, webrtc.RTPCodecTypeAudio)

	offer1, err := room.createSubscriberOffer("aluno-01", "prof-01")
	if err != nil {
		t.Fatalf("primeira oferta: %v", err)
	}
	offer2, err := room.createSubscriberOffer("aluno-01", "prof-01")
	if err != nil {
		t.Fatalf("segunda oferta: %v", err)
	}

	if offer1 != offer2 {
		t.Errorf("a assinatura duplicada deveria receber a mesma oferta\n--- 1:\n%s\n--- 2:\n%s", offer1, offer2)
	}
	if strings.Count(offer2, "b=AS:6000") != 1 {
		t.Errorf("a oferta reaproveitada deveria ter exatamente uma linha b=AS:6000:\n%s", offer2)
	}
}

// 023/RF-2304: o áudio criado depois do vídeo sinaliza a prontidão de novo; antes do vídeo, não.
func TestRoom_EnsureLocalTrack_ProntidaoDoAudio(t *testing.T) {
	t.Run("áudio depois do vídeo", func(t *testing.T) {
		room := newTestRoom(t)
		if !addLocalTrack(t, room, webrtc.RTPCodecTypeVideo) {
			t.Error("o vídeo deveria sinalizar prontidão")
		}
		if !addLocalTrack(t, room, webrtc.RTPCodecTypeAudio) {
			t.Error("o áudio criado depois do vídeo deveria sinalizar prontidão")
		}
		if addLocalTrack(t, room, webrtc.RTPCodecTypeAudio) {
			t.Error("o áudio já existente não deveria sinalizar de novo")
		}
	})

	t.Run("áudio antes do vídeo", func(t *testing.T) {
		room := newTestRoom(t)
		if addLocalTrack(t, room, webrtc.RTPCodecTypeAudio) {
			t.Error("o áudio sem vídeo não deveria sinalizar prontidão")
		}
		if !addLocalTrack(t, room, webrtc.RTPCodecTypeVideo) {
			t.Error("o vídeo deveria sinalizar prontidão")
		}
	})

	t.Run("geração muda só ao criar track", func(t *testing.T) {
		room := newTestRoom(t)
		addLocalTrack(t, room, webrtc.RTPCodecTypeVideo)
		addLocalTrack(t, room, webrtc.RTPCodecTypeVideo)
		room.mu.RLock()
		defer room.mu.RUnlock()
		if room.trackGen != 1 {
			t.Errorf("trackGen deveria ser 1 após reutilizar a track de vídeo, é %d", room.trackGen)
		}
	})
}
