package signaling

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"strings"
	"time"

	"github.com/screenshare/classroom/internal/chat"
	"golang.org/x/text/unicode/norm"
)

const (
	// Timeout para o professor reconectar após desconexão (media-session.md §10a).
	publisherReconnectTimeout = 30 * time.Second

	// Rate limit do chat (media-session.md §10b).
	chatWindowShort    = 5 * time.Second
	chatWindowShortMax = 5
	chatWindowLong     = 60 * time.Second
	chatWindowLongMax  = 30

	// Limite máximo de mensagens fixadas pelo professor por escopo (público ou privado).
	maxPinnedMessages = 3
)

// envelope empacota uma mensagem recebida com seu remetente.
type envelope struct {
	client *Client
	msg    WsMessage
}

// signal é usado para comunicação interna no hub (timeouts, fechamentos).
type signal int

const (
	sigPublisherTimeout signal = iota
	sigRoomClose
	sigStreamStarted
)

// chatTracker controla o rate limit de chat por participante.
type chatTracker struct {
	shortWindow []time.Time
	longWindow  []time.Time
}

func (ct *chatTracker) allow() bool {
	now := time.Now()
	cutShort := now.Add(-chatWindowShort)
	cutLong := now.Add(-chatWindowLong)

	// Remove entradas expiradas.
	filtered := ct.shortWindow[:0]
	for _, t := range ct.shortWindow {
		if t.After(cutShort) {
			filtered = append(filtered, t)
		}
	}
	ct.shortWindow = filtered

	filtered = ct.longWindow[:0]
	for _, t := range ct.longWindow {
		if t.After(cutLong) {
			filtered = append(filtered, t)
		}
	}
	ct.longWindow = filtered

	if len(ct.shortWindow) >= chatWindowShortMax || len(ct.longWindow) >= chatWindowLongMax {
		return false
	}
	ct.shortWindow = append(ct.shortWindow, now)
	ct.longWindow = append(ct.longWindow, now)
	return true
}

// SFU é a interface para interação com o módulo WebRTC (implementada em T011).
// Enquanto não há implementação concreta, o hub opera em modo stub (sem mídia).
type SFU interface {
	HandlePublisherOffer(roomID, participantID, sdp string) (answerSDP string, err error)
	CreateSubscriberOffer(roomID, subscriberID, publisherID string) (offerSDP string, err error)
	HandleSubscriberAnswer(roomID, subscriberID, sdp string) error
	AddICECandidate(roomID, participantID, candidate string) error
	PublisherDisconnected(roomID, participantID string) error
	RoomClosed(roomID string) error
	RequestKeyFrame(roomID string) error
}

// Hub gerencia todos os clientes WebSocket de uma sala.
// Todo estado interno é acessado exclusivamente pela goroutine run().
type Hub struct {
	roomID       string
	clients      map[string]*Client
	publisherID  string
	status       SessionStatus
	chatLimits   map[string]*chatTracker
	streamPaused bool // indica se a transmissão está pausada pelo professor

	chatHistory   []ChatRecvPayload          // mensagens públicas da turma mantidas em memória na sessão
	sharedFiles   []FileSharedPayload        // arquivos compartilhados pelo professor mantidos em memória na sessão
	pinnedPublic  map[string]bool            // IDs de mensagens públicas fixadas pelo professor (máx 3)
	pinnedPrivate map[string]map[string]bool // targetID -> IDs de mensagens privadas fixadas pelo professor (máx 3)

	register   chan *Client
	unregister chan *Client
	inbound    chan *envelope
	internal   chan signal // sinais internos (timeouts, fechamentos, streamStarted)
	fileShared chan FileSharedPayload

	publisherTimer *time.Timer
	sfu            SFU // nil até T011

	// onClosed é chamado (na goroutine do hub) quando a sala é encerrada pelo WebSocket
	// (end-session ou timeout de reconexão), para liberar recursos fora do hub, como arquivos.
	onClosed func(roomID string)
}

// newHub cria e inicia um Hub para a sala especificada.
// onClosed é opcional e recebe o roomID quando a sala é encerrada pelo hub.
func newHub(roomID string, sfu SFU, onClosed ...func(roomID string)) *Hub {
	h := &Hub{
		roomID:        roomID,
		clients:       make(map[string]*Client),
		chatLimits:    make(map[string]*chatTracker),
		chatHistory:   make([]ChatRecvPayload, 0, 50),
		sharedFiles:   make([]FileSharedPayload, 0, 10),
		pinnedPublic:  make(map[string]bool),
		pinnedPrivate: make(map[string]map[string]bool),
		status:        SessionWaiting,
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		inbound:     make(chan *envelope, 256),
		internal:    make(chan signal, 8),
		fileShared:  make(chan FileSharedPayload, 16),
		sfu:         sfu,
	}
	if len(onClosed) > 0 {
		h.onClosed = onClosed[0]
	}
	go h.run()
	return h
}

// run é o loop central do Hub — única goroutine que toca o estado.
func (h *Hub) run() {
	for {
		select {
		case c := <-h.register:
			h.onRegister(c)

		case c := <-h.unregister:
			h.onUnregister(c)

		case env := <-h.inbound:
			h.route(env)

		case sig := <-h.internal:
			switch sig {
			case sigPublisherTimeout:
				h.onPublisherTimeout()
			case sigRoomClose:
				h.onRoomClose()
			case sigStreamStarted:
				h.onStreamStarted()
			}

		case f := <-h.fileShared:
			h.sharedFiles = append(h.sharedFiles, f)
			h.broadcastAll(TypeFileShared, f)
		}
	}
}

// ── Registro / Desregistro ────────────────────────────────────────────────────

func (h *Hub) onRegister(c *Client) {
	// Se já existe uma conexão anterior ativa para este participante, encerra a anterior
	if oldClient, exists := h.clients[c.participantID]; exists && oldClient != c {
		log.Printf("hub[%s]: substituindo conexão anterior do participante %s (%s)", h.roomID, c.role, c.participantID)
		oldClient.close()
	}

	// Se o professor está se conectando ou reconectando, cancela timer de timeout se ativo
	if c.role == RoleProfessor {
		if h.publisherTimer != nil {
			h.publisherTimer.Stop()
			h.publisherTimer = nil
		}
		h.publisherID = c.participantID
		if h.status == SessionReconnecting || h.status == SessionWaiting {
			h.status = SessionPublishing
		}
		log.Printf("hub[%s]: professor ativo na sala (status=%s)", h.roomID, h.status)
	}

	h.clients[c.participantID] = c
	h.chatLimits[c.participantID] = &chatTracker{}

	// Notifica os outros do novo participante.
	h.broadcastExcept(c.participantID, TypeParticipantJoined, ParticipantJoinedPayload{
		ParticipantID: c.participantID,
		Name:          c.name,
		StudentID:     c.studentID,
		Role:          c.role,
	})

	// Envia estado atual da sala ao novo cliente.
	c.sendJSON(TypeSessionState, SessionStatePayload{
		Status:            h.status,
		ParticipantsCount: len(h.clients),
	})

	// Se a transmissão estiver pausada, notifica o novo cliente.
	if h.streamPaused {
		c.sendJSON(TypeStreamPaused, StreamPausedPayload{
			Paused: true,
		})
	}

	// Envia histórico de mensagens públicas do chat ao novo cliente
	if len(h.chatHistory) > 0 {
		c.sendJSON(TypeChatHistory, ChatHistoryPayload{
			Messages: h.chatHistory,
		})
	}

	// Envia histórico de arquivos compartilhados pelo professor ao novo cliente
	if len(h.sharedFiles) > 0 {
		c.sendJSON(TypeFilesHistory, FilesHistoryPayload{
			Files: h.sharedFiles,
		})
	}

	// Se for aluno conectando/reconectando e o professor já estiver transmitindo, solicita Keyframe imediato
	if c.role == RoleAluno && h.status == SessionPublishing && h.sfu != nil {
		_ = h.sfu.RequestKeyFrame(h.roomID)
	}

	// Atualiza lista de participantes para todos.
	h.broadcastParticipantsUpdate()

	log.Printf("hub[%s]: %s %s registrado (total=%d)",
		h.roomID, c.role, c.participantID, len(h.clients))
}

func (h *Hub) onUnregister(c *Client) {
	existing, ok := h.clients[c.participantID]
	if !ok || existing != c {
		// Conexão obsoleta que já foi substituída por uma mais recente do mesmo participante.
		log.Printf("hub[%s]: ignorando unregister de conexão obsoleta do participante %s", h.roomID, c.participantID)
		return
	}

	delete(h.clients, c.participantID)
	delete(h.chatLimits, c.participantID)
	c.close()

	h.broadcastExcept(c.participantID, TypeParticipantLeft, ParticipantLeftPayload{
		ParticipantID: c.participantID,
	})

	// Atualiza lista de participantes para todos.
	h.broadcastParticipantsUpdate()

	log.Printf("hub[%s]: %s %s desconectado (total=%d)",
		h.roomID, c.role, c.participantID, len(h.clients))

	// Se era o publisher, inicia o timer de reconexão (§10a).
	if c.participantID == h.publisherID && h.status == SessionPublishing {
		h.status = SessionReconnecting
		h.broadcastAll(TypeSessionState, SessionStatePayload{
			Status:            SessionReconnecting,
			ParticipantsCount: len(h.clients),
		})
		log.Printf("hub[%s]: publisher desconectado, reconexão em %s", h.roomID, publisherReconnectTimeout)

		h.publisherTimer = time.AfterFunc(publisherReconnectTimeout, func() {
			h.internal <- sigPublisherTimeout
		})

		if h.sfu != nil {
			_ = h.sfu.PublisherDisconnected(h.roomID, c.participantID)
		}
	}
}

// ── Roteamento de mensagens ───────────────────────────────────────────────────

func (h *Hub) route(env *envelope) {
	c := env.client
	existing, ok := h.clients[c.participantID]
	if !ok || existing != c {
		return
	}

	switch env.msg.Type {
	case TypePublishRequest:
		h.onPublishRequest(c)
	case TypeSubscribeRequest:
		h.onSubscribeRequest(c, env.msg)
	case TypeOffer:
		h.onOffer(c, env.msg)
	case TypeAnswer:
		h.onAnswer(c, env.msg)
	case TypeIceCandidate:
		h.onIceCandidate(c, env.msg)
	case TypeChatMessage:
		h.onChatMessage(c, env.msg)
	case TypeStreamPause:
		h.onStreamPause(c, env.msg)
	case TypeRequestKeyFrame:
		h.onRequestKeyFrame(c, time.Now())
	case TypeRaiseHand:
		h.onRaiseHand(c, env.msg)
	case TypeLowerHand:
		h.onLowerHand(c, env.msg)
	case TypePinMessage:
		h.onPinMessage(c, env.msg)
	case TypeEndSession:
		h.onEndSession(c)
	default:
		c.sendError("UNKNOWN_TYPE", fmt.Sprintf("tipo desconhecido: %s", env.msg.Type))
	}
}

// ── Handlers individuais ──────────────────────────────────────────────────────

func (h *Hub) onPublishRequest(c *Client) {
	if c.role != RoleProfessor {
		c.sendError("FORBIDDEN", "apenas o professor pode publicar")
		return
	}

	// Cancela timer ativo (professor reconectou antes do timeout expirar).
	if h.publisherTimer != nil {
		h.publisherTimer.Stop()
		h.publisherTimer = nil
	}

	h.publisherID = c.participantID
	h.status = SessionPublishing

	c.sendJSON(TypePublishApproved, PublishApprovedPayload{PublisherID: c.participantID})
	h.broadcastExcept(c.participantID, TypeSessionState, SessionStatePayload{
		Status:            SessionPublishing,
		ParticipantsCount: len(h.clients),
	})

	log.Printf("hub[%s]: publisher aprovado: %s", h.roomID, c.participantID)
}

func (h *Hub) onSubscribeRequest(c *Client, msg WsMessage) {
	if c.role != RoleAluno {
		c.sendError("FORBIDDEN", "apenas alunos podem assinar a transmissão")
		return
	}
	var p SubscribeRequestPayload
	if len(msg.Payload) > 0 {
		_ = json.Unmarshal(msg.Payload, &p)
	}
	publisherID := p.PublisherID
	if publisherID == "" {
		publisherID = h.publisherID
	}
	if h.sfu == nil {
		c.sendError("SFU_UNAVAILABLE", "SFU não inicializado")
		return
	}
	if h.status == SessionWaiting || h.status == SessionReconnecting {
		// Professor ainda não começou a transmitir — notifica estado de espera amigável
		c.sendJSON(TypeSessionState, SessionStatePayload{
			Status:            h.status,
			ParticipantsCount: len(h.clients),
		})
		return
	}

	offerSDP, err := h.sfu.CreateSubscriberOffer(h.roomID, c.participantID, publisherID)
	if err != nil {
		c.sendJSON(TypeSessionState, SessionStatePayload{
			Status:            SessionWaiting,
			ParticipantsCount: len(h.clients),
		})
		return
	}
	c.sendJSON(TypeOffer, SDPPayload{SDP: offerSDP})
	_ = h.sfu.RequestKeyFrame(h.roomID)
}

func (h *Hub) onOffer(c *Client, msg WsMessage) {
	var p SDPPayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil {
		c.sendError("INVALID_PAYLOAD", "payload de offer inválido")
		return
	}
	if h.sfu == nil {
		c.sendError("SFU_UNAVAILABLE", "SFU não inicializado (pendente T011)")
		return
	}
	answerSDP, err := h.sfu.HandlePublisherOffer(h.roomID, c.participantID, p.SDP)
	if err != nil {
		log.Printf("hub[%s]: HandlePublisherOffer: %v", h.roomID, err)
		c.sendError("SFU_ERROR", "erro ao processar offer")
		return
	}
	c.sendJSON(TypeAnswer, SDPPayload{SDP: answerSDP})
}

func (h *Hub) onAnswer(c *Client, msg WsMessage) {
	var p SDPPayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil {
		c.sendError("INVALID_PAYLOAD", "payload de answer inválido")
		return
	}
	if h.sfu == nil {
		return
	}
	if err := h.sfu.HandleSubscriberAnswer(h.roomID, c.participantID, p.SDP); err != nil {
		log.Printf("hub[%s]: HandleSubscriberAnswer: %v", h.roomID, err)
		c.sendError("SFU_ERROR", "erro ao processar answer")
	}
}

func (h *Hub) onIceCandidate(c *Client, msg WsMessage) {
	var p IceCandidatePayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil {
		c.sendError("INVALID_PAYLOAD", "payload de ice-candidate inválido")
		return
	}
	if h.sfu == nil {
		return // silencioso durante setup
	}
	if err := h.sfu.AddICECandidate(h.roomID, c.participantID, p.Candidate); err != nil {
		log.Printf("hub[%s]: AddICECandidate: %v", h.roomID, err)
	}
}

func (h *Hub) onChatMessage(c *Client, msg WsMessage) {
	var p ChatSendPayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil {
		c.sendError("INVALID_PAYLOAD", "payload de chat-message inválido")
		return
	}

	trimmed := strings.TrimSpace(p.Content)
	if len(trimmed) == 0 {
		return // descarta vazio
	}

	// Rate limit (§10b).
	if tracker, ok := h.chatLimits[c.participantID]; ok {
		if !tracker.allow() {
			c.sendError("CHAT_RATE_LIMITED", "muitas mensagens, aguarde")
			return
		}
	}

	// Máscara de segurança para termos ofensivos / palavrões (chat público e privado)
	// Garante padrão UTF-8 válido e normalização canônica Unicode (NFC)
	cleanContent := norm.NFC.String(strings.ToValidUTF8(trimmed, ""))

	// Máscara de segurança para termos ofensivos / palavrões (chat público e privado)
	masked := chat.MaskProfanity(cleanContent)
	sanitized := html.EscapeString(masked)

	targetID := p.TargetID
	if p.IsPrivate && targetID == "" && c.role == RoleAluno {
		targetID = h.publisherID
	}

	chatPayload := ChatRecvPayload{
		MessageID:     hubNewID(),
		ParticipantID: c.participantID,
		Name:          c.name,
		Role:          c.role,
		StudentID:     c.studentID,
		Content:       sanitized,
		IsPrivate:     p.IsPrivate,
		TargetID:      targetID,
		SentAt:        time.Now().UTC().Format(time.RFC3339),
	}

	if p.IsPrivate {
		data := buildMsg(TypeChatMessage, chatPayload)
		// Envia de volta para o remetente para feedback imediato
		c.safeSend(data)

		if c.role == RoleAluno {
			// Aluno mandando mensagem privada: apenas professor(es) recebem
			for _, client := range h.clients {
				if client.role == RoleProfessor && client.participantID != c.participantID {
					client.safeSend(data)
				}
			}
		} else if c.role == RoleProfessor {
			// Professor enviando mensagem privada
			if p.TargetID != "" {
				if target, ok := h.clients[p.TargetID]; ok {
					target.safeSend(data)
				}
			}
		}
	} else {
		h.chatHistory = append(h.chatHistory, chatPayload)
		if len(h.chatHistory) > 200 {
			h.chatHistory = h.chatHistory[len(h.chatHistory)-200:]
		}
		h.broadcastAll(TypeChatMessage, chatPayload)
	}
}

func (h *Hub) onStreamPause(c *Client, msg WsMessage) {
	if c.role != RoleProfessor {
		c.sendError("FORBIDDEN", "apenas o professor pode pausar ou retomar a transmissão")
		return
	}
	var p StreamPauseSendPayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil {
		c.sendError("INVALID_PAYLOAD", "payload de stream-pause inválido")
		return
	}
	h.streamPaused = p.Paused
	log.Printf("hub[%s]: transmissão pausada=%v pelo professor %s", h.roomID, h.streamPaused, c.participantID)
	h.broadcastAll(TypeStreamPaused, StreamPausedPayload{
		Paused: h.streamPaused,
	})
	if !h.streamPaused && h.sfu != nil {
		_ = h.sfu.RequestKeyFrame(h.roomID)
	}
}

func (h *Hub) onEndSession(c *Client) {
	if c.role != RoleProfessor {
		c.sendError("FORBIDDEN", "apenas o professor pode encerrar a transmissão")
		return
	}
	log.Printf("hub[%s]: encerramento solicitado pelo professor %s", h.roomID, c.participantID)
	h.onRoomClose()
}

// ── Sinais internos ───────────────────────────────────────────────────────────

func (h *Hub) onPublisherTimeout() {
	if h.status != SessionReconnecting {
		return // professor reconectou a tempo
	}
	log.Printf("hub[%s]: timeout de reconexão — encerrando sala", h.roomID)
	h.status = SessionClosed
	h.broadcastAll(TypeRoomClosed, struct{}{})
	for _, c := range h.clients {
		c.close()
	}
	h.clients = make(map[string]*Client)
	if h.sfu != nil {
		_ = h.sfu.RoomClosed(h.roomID)
	}
	if h.onClosed != nil {
		h.onClosed(h.roomID)
	}
}

func (h *Hub) onRoomClose() {
	log.Printf("hub[%s]: sala encerrada pelo professor", h.roomID)
	h.status = SessionClosed
	h.broadcastAll(TypeRoomClosed, struct{}{})
	for _, c := range h.clients {
		c.close()
	}
	h.clients = make(map[string]*Client)
	if h.sfu != nil {
		_ = h.sfu.RoomClosed(h.roomID)
	}
	if h.onClosed != nil {
		h.onClosed(h.roomID)
	}
}

func (h *Hub) onStreamStarted() {
	h.status = SessionPublishing
	log.Printf("hub[%s]: faixa de vídeo ativa — disparando stream-started para todos os participantes", h.roomID)
	h.broadcastAll(TypeStreamStarted, StreamStartedPayload{
		PublisherID: h.publisherID,
	})
	h.broadcastAll(TypeSessionState, SessionStatePayload{
		Status:            SessionPublishing,
		ParticipantsCount: len(h.clients),
	})
	if h.sfu != nil {
		_ = h.sfu.RequestKeyFrame(h.roomID)
	}
}

// BroadcastStreamStarted é chamado externamente quando o SFU inicializa a track de vídeo do professor.
func (h *Hub) BroadcastStreamStarted() {
	h.internal <- sigStreamStarted
}

// BroadcastRoomClosed é chamado externamente (ex: pelo handler REST de close).
func (h *Hub) BroadcastRoomClosed() {
	h.internal <- sigRoomClose
}

// BroadcastFileShared é chamado externamente quando o professor faz upload de arquivo na sala.
func (h *Hub) BroadcastFileShared(payload FileSharedPayload) {
	select {
	case h.fileShared <- payload:
	default:
		log.Printf("hub[%s]: buffer de fileShared cheio", h.roomID)
	}
}

// broadcastParticipantsUpdate envia a lista atualizada de participantes conectados.
func (h *Hub) broadcastParticipantsUpdate() {
	list := make([]ParticipantInfo, 0, len(h.clients))
	for _, client := range h.clients {
		var raisedAtStr string
		if client.handRaised && !client.handRaisedAt.IsZero() {
			raisedAtStr = client.handRaisedAt.UTC().Format(time.RFC3339)
		}
		list = append(list, ParticipantInfo{
			ParticipantID: client.participantID,
			Name:          client.name,
			StudentID:     client.studentID,
			Role:          client.role,
			HandRaised:    client.handRaised,
			HandRaisedAt:  raisedAtStr,
		})
	}
	h.broadcastAll(TypeParticipantsUpdate, ParticipantsUpdatePayload{
		Count:        len(list),
		Participants: list,
	})
}

func (h *Hub) onRaiseHand(c *Client, msg WsMessage) {
	if c.role != RoleAluno {
		c.sendError("FORBIDDEN", "apenas alunos podem levantar a mão")
		return
	}

	raised := true
	if len(msg.Payload) > 0 {
		var p RaiseHandPayload
		if err := json.Unmarshal(msg.Payload, &p); err == nil {
			raised = p.Raised
		}
	}

	c.handRaised = raised
	var raisedAtStr string
	if raised {
		c.handRaisedAt = time.Now()
		raisedAtStr = c.handRaisedAt.UTC().Format(time.RFC3339)
		log.Printf("hub[%s]: aluno %s (%s) levantou a mão", h.roomID, c.name, c.participantID)
	} else {
		c.handRaisedAt = time.Time{}
		log.Printf("hub[%s]: aluno %s (%s) abaixou a mão", h.roomID, c.name, c.participantID)
	}

	h.broadcastAll(TypeHandUpdated, HandUpdatedPayload{
		ParticipantID: c.participantID,
		Name:          c.name,
		StudentID:     c.studentID,
		Raised:        c.handRaised,
		RaisedAt:      raisedAtStr,
	})
	h.broadcastParticipantsUpdate()
}

func (h *Hub) onLowerHand(c *Client, msg WsMessage) {
	if c.role == RoleProfessor {
		var p LowerHandPayload
		if len(msg.Payload) > 0 {
			_ = json.Unmarshal(msg.Payload, &p)
		}
		targetID := p.ParticipantID
		if targetID == "" {
			c.sendError("BAD_REQUEST", "participant_id obrigatório para abaixar a mão")
			return
		}
		target, ok := h.clients[targetID]
		if !ok || target.role != RoleAluno {
			c.sendError("NOT_FOUND", "aluno não encontrado")
			return
		}
		target.handRaised = false
		target.handRaisedAt = time.Time{}
		log.Printf("hub[%s]: professor abaixou a mão do aluno %s (%s)", h.roomID, target.name, target.participantID)

		h.broadcastAll(TypeHandUpdated, HandUpdatedPayload{
			ParticipantID: target.participantID,
			Name:          target.name,
			StudentID:     target.studentID,
			Raised:        false,
		})
		h.broadcastParticipantsUpdate()
		return
	}

	// Se for o próprio aluno abaixando sua mão via lower-hand
	if c.role == RoleAluno {
		c.handRaised = false
		c.handRaisedAt = time.Time{}
		log.Printf("hub[%s]: aluno %s (%s) abaixou a própria mão", h.roomID, c.name, c.participantID)

		h.broadcastAll(TypeHandUpdated, HandUpdatedPayload{
			ParticipantID: c.participantID,
			Name:          c.name,
			StudentID:     c.studentID,
			Raised:        false,
		})
		h.broadcastParticipantsUpdate()
		return
	}

	c.sendError("FORBIDDEN", "operação não permitida")
}

func (h *Hub) onPinMessage(c *Client, msg WsMessage) {
	if c.role != RoleProfessor {
		c.sendError("FORBIDDEN", "apenas o professor pode fixar mensagens")
		return
	}

	var p PinMessageSendPayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil || strings.TrimSpace(p.MessageID) == "" {
		c.sendError("INVALID_PAYLOAD", "payload de pin-message inválido")
		return
	}

	if !p.IsPrivate {
		if h.pinnedPublic == nil {
			h.pinnedPublic = make(map[string]bool)
		}
		if p.Pinned {
			if !h.pinnedPublic[p.MessageID] && len(h.pinnedPublic) >= maxPinnedMessages {
				c.sendError("PIN_LIMIT_REACHED", "limite máximo de 3 mensagens fixadas atingido")
				return
			}
			h.pinnedPublic[p.MessageID] = true
		} else {
			delete(h.pinnedPublic, p.MessageID)
		}

		for i := range h.chatHistory {
			if h.chatHistory[i].MessageID == p.MessageID {
				h.chatHistory[i].Pinned = p.Pinned
				break
			}
		}

		h.broadcastAll(TypeChatMessagePinned, ChatMessagePinnedPayload{
			MessageID: p.MessageID,
			Pinned:    p.Pinned,
			IsPrivate: false,
		})
		return
	}

	// Mensagem privada: escopo por conversa privada (target_id do aluno ou geral)
	if h.pinnedPrivate == nil {
		h.pinnedPrivate = make(map[string]map[string]bool)
	}
	scopeKey := p.TargetID
	if scopeKey == "" {
		scopeKey = "__private__"
	}
	if h.pinnedPrivate[scopeKey] == nil {
		h.pinnedPrivate[scopeKey] = make(map[string]bool)
	}

	if p.Pinned {
		if !h.pinnedPrivate[scopeKey][p.MessageID] && len(h.pinnedPrivate[scopeKey]) >= maxPinnedMessages {
			c.sendError("PIN_LIMIT_REACHED", "limite máximo de 3 mensagens fixadas atingido")
			return
		}
		h.pinnedPrivate[scopeKey][p.MessageID] = true
	} else {
		delete(h.pinnedPrivate[scopeKey], p.MessageID)
	}

	pinnedEvent := buildMsg(TypeChatMessagePinned, ChatMessagePinnedPayload{
		MessageID: p.MessageID,
		Pinned:    p.Pinned,
		IsPrivate: true,
		TargetID:  p.TargetID,
	})

	for _, client := range h.clients {
		if client.role == RoleProfessor || (p.TargetID != "" && client.participantID == p.TargetID) {
			client.safeSend(pinnedEvent)
		}
	}
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

func (h *Hub) broadcastAll(msgType string, payload any) {
	data := buildMsg(msgType, payload)
	for _, c := range h.clients {
		c.safeSend(data)
	}
}

func (h *Hub) broadcastExcept(excludeID, msgType string, payload any) {
	data := buildMsg(msgType, payload)
	for id, c := range h.clients {
		if id == excludeID {
			continue
		}
		c.safeSend(data)
	}
}

// hubNewID gera um ID hexadecimal para mensagens de chat.
func hubNewID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("signaling: hubNewID: " + err.Error())
	}
	return hex.EncodeToString(b)
}
