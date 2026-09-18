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
}

func newRoom(id string, api *webrtc.API) *Room {
	return &Room{
		id:          id,
		api:         api,
		subscribers: make(map[string]*webrtc.PeerConnection),
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

		localTrack, err := webrtc.NewTrackLocalStaticRTP(
			remoteTrack.Codec().RTPCodecCapability,
			trackID,
			"mlab-stream",
		)
		if err != nil {
			log.Printf("[SFU] Erro ao criar TrackLocalStaticRTP: %v", err)
			return
		}

		r.mu.Lock()
		if remoteTrack.Kind() == webrtc.RTPCodecTypeVideo {
			r.videoTrack = localTrack
			r.publisherVideoSSRC = uint32(remoteTrack.SSRC())
		} else if remoteTrack.Kind() == webrtc.RTPCodecTypeAudio {
			r.audioTrack = localTrack
		}
		r.mu.Unlock()

		// Se for track de vídeo, inicia ticker periódico para solicitar RTCP PLI (Keyframe)
		// Isso garante que novos espectadores decodifiquem o vídeo sem tela preta
		if remoteTrack.Kind() == webrtc.RTPCodecTypeVideo {
			go func() {
				ticker := time.NewTicker(2 * time.Second)
				defer ticker.Stop()
				for range ticker.C {
					r.requestKeyFrame()
				}
			}()
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
			r.requestKeyFrame()
			time.AfterFunc(300*time.Millisecond, r.requestKeyFrame)
		}
	})

	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		log.Printf("[SFU] Subscriber %s mudou iceConnectionState para: %s", subscriberID, state.String())
		if state == webrtc.ICEConnectionStateConnected {
			r.requestKeyFrame()
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
	subSDP = re.ReplaceAllString(subSDP, "$1\r\nb=AS:4000\r\nb=TIAS:4000000\r\n")
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
	r.requestKeyFrame()

	return nil
}

func (r *Room) requestKeyFrameLocked() {
	if r.publisherPC != nil && r.publisherVideoSSRC != 0 && r.publisherPC.ConnectionState() != webrtc.PeerConnectionStateClosed {
		_ = r.publisherPC.WriteRTCP([]rtcp.Packet{
			&rtcp.PictureLossIndication{MediaSSRC: r.publisherVideoSSRC},
			&rtcp.ReceiverEstimatedMaximumBitrate{
				Bitrate: 4_000_000,
				SSRCs:   []uint32{r.publisherVideoSSRC},
			},
		})
	}
}

func (r *Room) requestKeyFrame() {
	r.mu.RLock()
	defer r.mu.RUnlock()
	r.requestKeyFrameLocked()
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
