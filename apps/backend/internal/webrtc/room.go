package webrtc

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
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
					r.mu.RLock()
					pubPC := r.publisherPC
					ssrc := r.publisherVideoSSRC
					r.mu.RUnlock()

					if pubPC == nil || pubPC.ConnectionState() == webrtc.PeerConnectionStateClosed {
						return
					}
					if ssrc != 0 {
						_ = pubPC.WriteRTCP([]rtcp.Packet{
							&rtcp.PictureLossIndication{MediaSSRC: ssrc},
						})
					}
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

	// Fecha conexao existente do mesmo subscriber se houver (RN-04)
	if oldPC, exists := r.subscribers[subscriberID]; exists {
		_ = oldPC.Close()
		delete(r.subscribers, subscriberID)
	}

	pc, err := r.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return "", fmt.Errorf("falha ao criar PeerConnection do subscriber %s: %w", subscriberID, err)
	}

	r.subscribers[subscriberID] = pc

	// Dispara solicitação imediata de Keyframe (RTCP PLI) para o novo aluno decodificar o vídeo sem espera
	if r.publisherPC != nil && r.publisherVideoSSRC != 0 {
		_ = r.publisherPC.WriteRTCP([]rtcp.Packet{
			&rtcp.PictureLossIndication{MediaSSRC: r.publisherVideoSSRC},
		})
	}

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

	return pc.LocalDescription().SDP, nil
}

func (r *Room) handleSubscriberAnswer(subscriberID, sdp string) error {
	r.mu.RLock()
	pc, exists := r.subscribers[subscriberID]
	r.mu.RUnlock()

	if !exists {
		return fmt.Errorf("subscriber nao encontrado: %s", subscriberID)
	}

	answer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdp,
	}

	if err := pc.SetRemoteDescription(answer); err != nil {
		return fmt.Errorf("falha ao aplicar RemoteDescription do subscriber %s: %w", subscriberID, err)
	}

	return nil
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
