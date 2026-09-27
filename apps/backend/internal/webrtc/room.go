package webrtc

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"regexp"
	"sync"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v3"
)

// Room gerencia as PeerConnections do publisher (professor) e subscribers (alunos) de uma sala.
type Room struct {
	id  string
	api *webrtc.API
	mu  sync.RWMutex

	publisherID        string
	publisherPC        *webrtc.PeerConnection
	publisherVideoSSRC uint32

	// Tracks locais encaminhadas do professor para os alunos (repasse RTP em memória)
	videoTrack *webrtc.TrackLocalStaticRTP
	audioTrack *webrtc.TrackLocalStaticRTP

	subscribers map[string]*webrtc.PeerConnection

	onTrackReady func(roomID string)
	lastPLI      time.Time
}

func newRoom(id string, api *webrtc.API, onTrackReady func(roomID string)) *Room {
	return &Room{
		id:           id,
		api:          api,
		subscribers:  make(map[string]*webrtc.PeerConnection),
		onTrackReady: onTrackReady,
	}
}

func (r *Room) handlePublisherOffer(publisherID, sdp string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.publisherPC != nil {
		_ = r.publisherPC.Close()
	}

	r.publisherID = publisherID

	pc, err := r.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return "", fmt.Errorf("falha ao criar PeerConnection do publisher: %w", err)
	}

	r.publisherPC = pc

	// Trata o recebimento das tracks de vídeo e áudio do professor
	pc.OnTrack(func(remoteTrack *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		log.Printf("[SFU] Nova track recebida do professor (%s): Kind=%s, MimeType=%s, SSRC=%d", publisherID, remoteTrack.Kind().String(), remoteTrack.Codec().MimeType, remoteTrack.SSRC())

		trackID := "video"
		if remoteTrack.Kind() == webrtc.RTPCodecTypeAudio {
			trackID = "audio"
		}

		r.mu.Lock()
		var localTrack *webrtc.TrackLocalStaticRTP
		if remoteTrack.Kind() == webrtc.RTPCodecTypeVideo {
			if r.videoTrack == nil {
				var err error
				r.videoTrack, err = webrtc.NewTrackLocalStaticRTP(
					remoteTrack.Codec().RTPCodecCapability,
					trackID,
					"mlab-stream",
				)
				if err != nil {
					log.Printf("[SFU] Erro ao criar TrackLocalStaticRTP de vídeo: %v", err)
					r.mu.Unlock()
					return
				}
			}
			localTrack = r.videoTrack
			r.publisherVideoSSRC = uint32(remoteTrack.SSRC())
		} else if remoteTrack.Kind() == webrtc.RTPCodecTypeAudio {
			if r.audioTrack == nil {
				var err error
				r.audioTrack, err = webrtc.NewTrackLocalStaticRTP(
					remoteTrack.Codec().RTPCodecCapability,
					trackID,
					"mlab-stream",
				)
				if err != nil {
					log.Printf("[SFU] Erro ao criar TrackLocalStaticRTP de áudio: %v", err)
					r.mu.Unlock()
					return
				}
			}
			localTrack = r.audioTrack
		}
		r.mu.Unlock()

		// Se for track de vídeo, notifica que a mídia está pronta no SFU
		if remoteTrack.Kind() == webrtc.RTPCodecTypeVideo {
			r.requestKeyFrame()
			time.AfterFunc(300*time.Millisecond, r.requestKeyFrame)

			r.mu.RLock()
			readyCb := r.onTrackReady
			r.mu.RUnlock()
			if readyCb != nil {
				go readyCb(r.id)
			}
		}

		// Repasse de pacotes RTP em memória (Zero gravação em disco, RNF-15 / RNF-16)
		buf := make([]byte, 4096)
		for {
			n, _, err := remoteTrack.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("[SFU] Erro de leitura RTP da track %s: %v", remoteTrack.ID(), err)
				}
				break
			}

			if _, err := localTrack.Write(buf[:n]); err != nil && err != io.ErrClosedPipe {
				// Pipe fechado quando nao ha subscribers ou track encerrada
			}
		}
	})

	offer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  sdp,
	}

	if err := pc.SetRemoteDescription(offer); err != nil {
		return "", fmt.Errorf("falha ao aplicar RemoteDescription do publisher: %w", err)
	}

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return "", fmt.Errorf("falha ao criar Answer do publisher: %w", err)
	}

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		return "", fmt.Errorf("falha ao aplicar LocalDescription do publisher: %w", err)
	}
	<-gatherComplete

	return pc.LocalDescription().SDP, nil
}

func (r *Room) createSubscriberOffer(subscriberID, publisherID string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Se já existe um PeerConnection com oferta pendente com SDP local válido, reutiliza a oferta existente
	if existingPC, exists := r.subscribers[subscriberID]; exists {
		if existingPC.SignalingState() == webrtc.SignalingStateHaveLocalOffer && existingPC.LocalDescription() != nil {
			return existingPC.LocalDescription().SDP, nil
		}
		_ = existingPC.Close()
		delete(r.subscribers, subscriberID)
	}

	pc, err := r.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return "", fmt.Errorf("falha ao criar PeerConnection do subscriber %s: %w", subscriberID, err)
	}

	r.subscribers[subscriberID] = pc

	// Escuta mudanças de estado do subscriber para disparar Keyframe (PLI) no momento exato em que a rede estabiliza
	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		log.Printf("[SFU] Subscriber %s mudou connectionState para: %s", subscriberID, state.String())
		if state == webrtc.PeerConnectionStateConnected {
			r.RequestKeyFrame()
		}
	})

	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		log.Printf("[SFU] Subscriber %s mudou iceConnectionState para: %s", subscriberID, state.String())
		if state == webrtc.ICEConnectionStateConnected {
			r.RequestKeyFrame()
		}
	})

	// Dispara solicitação imediata de Keyframe (RTCP PLI) e REMB para o novo aluno decodificar o vídeo em 4 Mbps
	r.requestKeyFrameLocked()

	// Adiciona as tracks ativas do professor (video e audio independentes)
	if r.videoTrack != nil {
		sender, err := pc.AddTrack(r.videoTrack)
		if err != nil {
			log.Printf("[SFU] Erro ao adicionar videoTrack para %s: %v", subscriberID, err)
		} else {
			go func() {
				rtcpBuf := make([]byte, 1500)
				for {
					if _, _, rtcpErr := sender.Read(rtcpBuf); rtcpErr != nil {
						return
					}
				}
			}()
		}
	}

	if r.audioTrack != nil {
		sender, err := pc.AddTrack(r.audioTrack)
		if err != nil {
			log.Printf("[SFU] Erro ao adicionar audioTrack para %s: %v", subscriberID, err)
		} else {
			go func() {
				rtcpBuf := make([]byte, 1500)
				for {
					if _, _, rtcpErr := sender.Read(rtcpBuf); rtcpErr != nil {
						return
					}
				}
			}()
		}
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		return "", fmt.Errorf("falha ao criar Offer do subscriber %s: %w", subscriberID, err)
	}

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		return "", fmt.Errorf("falha ao aplicar LocalDescription do subscriber %s: %w", subscriberID, err)
	}
	<-gatherComplete

	subSDP := pc.LocalDescription().SDP
	re := regexp.MustCompile(`(m=video [^\r\n]+)\r\n`)
	subSDP = re.ReplaceAllString(subSDP, "$1\r\nb=AS:8000\r\nb=TIAS:8000000\r\n")
	return subSDP, nil
}

func (r *Room) handleSubscriberAnswer(subscriberID, sdp string) error {
	r.mu.RLock()
	pc, exists := r.subscribers[subscriberID]
	r.mu.RUnlock()

	if !exists {
		return fmt.Errorf("subscriber nao encontrado: %s", subscriberID)
	}

	// Se o PeerConnection já concluiu a negociação e está em stable, ignora respostas redundantes sem erro
	if pc.SignalingState() == webrtc.SignalingStateStable {
		log.Printf("[SFU] Subscriber %s já está em estado stable, ignorando answer redundante", subscriberID)
		return nil
	}

	answer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdp,
	}

	if err := pc.SetRemoteDescription(answer); err != nil {
		return fmt.Errorf("falha ao aplicar RemoteDescription do subscriber %s: %w", subscriberID, err)
	}

	// Dispara solicitação de Keyframe imediatamente após a aplicação da resposta remota
	r.RequestKeyFrame()

	return nil
}

func (r *Room) requestKeyFrameLocked() {
	now := time.Now()
	if !r.lastPLI.IsZero() && now.Sub(r.lastPLI) < 1500*time.Millisecond {
		return // Rate limit para consolidar múltiplos pedidos de keyframe e evitar congelamentos no encoder
	}
	r.lastPLI = now

	if r.publisherPC != nil && r.publisherVideoSSRC != 0 && r.publisherPC.ConnectionState() != webrtc.PeerConnectionStateClosed {
		_ = r.publisherPC.WriteRTCP([]rtcp.Packet{
			&rtcp.PictureLossIndication{MediaSSRC: r.publisherVideoSSRC},
			&rtcp.ReceiverEstimatedMaximumBitrate{
				Bitrate: 8_000_000, // REMB amplo de até 8 Mbps para dar vazão plena a 1080p 60fps sem estrangulamento
				SSRCs:   []uint32{r.publisherVideoSSRC},
			},
		})
	}
}

func (r *Room) requestKeyFrame() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.requestKeyFrameLocked()
}

// RequestKeyFrame solicita um RTCP PLI (Keyframe) e REMB de forma controlada.
func (r *Room) RequestKeyFrame() {
	r.requestKeyFrame()
}

func (r *Room) addICECandidate(participantID, candidateStr string) error {
	r.mu.RLock()
	var pc *webrtc.PeerConnection
	if r.publisherID == participantID {
		pc = r.publisherPC
	} else {
		pc = r.subscribers[participantID]
	}
	r.mu.RUnlock()

	if pc == nil {
		return fmt.Errorf("participante %s nao possui PeerConnection ativa", participantID)
	}

	var candidateInit webrtc.ICECandidateInit
	if err := json.Unmarshal([]byte(candidateStr), &candidateInit); err != nil {
		// Se nao for JSON, tenta tratar como string simples
		candidateInit = webrtc.ICECandidateInit{Candidate: candidateStr}
	}

	return pc.AddICECandidate(candidateInit)
}

func (r *Room) publisherDisconnected(participantID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.publisherID == participantID && r.publisherPC != nil {
		log.Printf("[SFU] Publisher %s desconectado temporariamente na sala %s", participantID, r.id)
	}
	return nil
}

func (r *Room) close() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.publisherPC != nil {
		_ = r.publisherPC.Close()
		r.publisherPC = nil
	}

	for id, pc := range r.subscribers {
		_ = pc.Close()
		delete(r.subscribers, id)
	}

	r.videoTrack = nil
	r.audioTrack = nil
	r.publisherVideoSSRC = 0
}
