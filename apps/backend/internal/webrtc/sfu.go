package webrtc

import (
	"fmt"
	"net"
	"os"
	"sync"

	"github.com/pion/webrtc/v3"
	"github.com/screenshare/classroom/internal/room"
)

// Config contém as opções de inicialização do SFU.
type Config struct {
	UDPPortMin uint16
	UDPPortMax uint16
	NAT1To1IP  string
}

// SFUService gerencia as salas e conexões WebRTC via Pion SFU.
type SFUService struct {
	api          *webrtc.API
	rooms        map[string]*Room
	mu           sync.RWMutex
	onTrackReady func(roomID string)
}

// SetOnTrackReady define a função executada quando a primeira track de vídeo de um publisher fica ativa no SFU.
func (s *SFUService) SetOnTrackReady(fn func(roomID string)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onTrackReady = fn
}

// NewSFUService cria uma nova instância do SFUService configurada com a faixa de portas UDP especificada.
func NewSFUService(cfg Config) (*SFUService, error) {
	if cfg.UDPPortMin == 0 {
		cfg.UDPPortMin = 50000
	}
	if cfg.UDPPortMax == 0 {
		cfg.UDPPortMax = 50100
	}

	settingEngine := webrtc.SettingEngine{}
	if err := settingEngine.SetEphemeralUDPPortRange(cfg.UDPPortMin, cfg.UDPPortMax); err != nil {
		return nil, fmt.Errorf("falha ao configurar faixa de portas UDP: %w", err)
	}

	// Descarta endereços de link-local / APIPA (169.254.x.x) para evitar timeouts de STUN e rotas mortas
	settingEngine.SetIPFilter(func(ip net.IP) bool {
		return !ip.IsLinkLocalUnicast()
	})

	natIP := cfg.NAT1To1IP
	if natIP == "" {
		natIP = os.Getenv("NAT_1TO1_IP")
	}
	if natIP == "" {
		natIP = os.Getenv("PUBLIC_IP")
	}
	if natIP == "" {
		natIP = room.GetPrimaryPhysicalIP()
	}
	if natIP != "" && natIP != "127.0.0.1" && natIP != "localhost" {
		settingEngine.SetNAT1To1IPs([]string{natIP}, webrtc.ICECandidateTypeHost)
	}

	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		return nil, fmt.Errorf("falha ao registrar codecs padrao: %w", err)
	}

	api := webrtc.NewAPI(
		webrtc.WithSettingEngine(settingEngine),
		webrtc.WithMediaEngine(mediaEngine),
	)

	return &SFUService{
		api:   api,
		rooms: make(map[string]*Room),
	}, nil
}

func (s *SFUService) getOrCreateRoom(roomID string) *Room {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, exists := s.rooms[roomID]
	if !exists {
		room = newRoom(roomID, s.api, s.onTrackReady)
		s.rooms[roomID] = room
	}
	return room
}

func (s *SFUService) getRoom(roomID string) (*Room, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	room, exists := s.rooms[roomID]
	return room, exists
}

// HandlePublisherOffer aceita o SDP Offer do professor, configura os leitores RTP e retorna a SDP Answer.
func (s *SFUService) HandlePublisherOffer(roomID, participantID, sdp string) (string, error) {
	room := s.getOrCreateRoom(roomID)
	return room.handlePublisherOffer(participantID, sdp)
}

// CreateSubscriberOffer adiciona as tracks ativas do professor à PeerConnection do aluno e retorna a SDP Offer.
func (s *SFUService) CreateSubscriberOffer(roomID, subscriberID, publisherID string) (string, error) {
	room, exists := s.getRoom(roomID)
	if !exists {
		return "", fmt.Errorf("sala nao encontrada: %s", roomID)
	}
	return room.createSubscriberOffer(subscriberID, publisherID)
}

// HandleSubscriberAnswer processa a SDP Answer enviada pelo aluno.
func (s *SFUService) HandleSubscriberAnswer(roomID, subscriberID, sdp string) error {
	room, exists := s.getRoom(roomID)
	if !exists {
		return fmt.Errorf("sala nao encontrada: %s", roomID)
	}
	return room.handleSubscriberAnswer(subscriberID, sdp)
}

// AddICECandidate adiciona um candidato ICE à PeerConnection do participante.
func (s *SFUService) AddICECandidate(roomID, participantID, candidateStr string) error {
	room, exists := s.getRoom(roomID)
	if !exists {
		return fmt.Errorf("sala nao encontrada: %s", roomID)
	}
	return room.addICECandidate(participantID, candidateStr)
}

// PublisherDisconnected trata a desconexão temporária ou definitiva do professor.
func (s *SFUService) PublisherDisconnected(roomID, participantID string) error {
	room, exists := s.getRoom(roomID)
	if !exists {
		return nil
	}
	return room.publisherDisconnected(participantID)
}

// RoomClosed destrói todas as conexões da sala e remove da memória.
func (s *SFUService) RoomClosed(roomID string) error {
	s.mu.Lock()
	room, exists := s.rooms[roomID]
	if exists {
		delete(s.rooms, roomID)
	}
	s.mu.Unlock()

	if exists {
		room.close()
	}
	return nil
}

// RequestKeyFrame envia uma solicitação de Keyframe (RTCP PLI) para o publisher da sala.
func (s *SFUService) RequestKeyFrame(roomID string) error {
	room, exists := s.getRoom(roomID)
	if !exists {
		return fmt.Errorf("sala nao encontrada: %s", roomID)
	}
	room.RequestKeyFrame()
	return nil
}
