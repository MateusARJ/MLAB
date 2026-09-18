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
)

const (
	// Timeout para o professor reconectar após desconexão (media-session.md §10a).
	publisherReconnectTimeout = 30 * time.Second

	// Rate limit do chat (media-session.md §10b).
	chatWindowShort    = 5 * time.Second
	chatWindowShortMax = 5
	chatWindowLong     = 60 * time.Second
	chatWindowLongMax  = 30
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
}

// Hub gerencia todos os clientes WebSocket de uma sala.
// Todo estado interno é acessado exclusivamente pela goroutine run().
type Hub struct {
	roomID      string
	clients     map[string]*Client
	publisherID string
	status      SessionStatus
	chatLimits  map[string]*chatTracker

	register   chan *Client
	unregister chan *Client
	inbound    chan *envelope
	internal   chan signal // sinais internos (timeouts, fechamentos)

	publisherTimer *time.Timer
	sfu            SFU // nil até T011
}

// newHub cria e inicia um Hub para a sala especificada.
func newHub(roomID string, sfu SFU) *Hub {
	h := &Hub{
		roomID:     roomID,
		clients:    make(map[string]*Client),
		chatLimits: make(map[string]*chatTracker),
		status:     SessionWaiting,
		register:   make(chan *Client),
		unregister: make(chan *Client),
		inbound:    make(chan *envelope, 256),
		internal:   make(chan signal, 4),
		sfu:        sfu,
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
			}
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
		Role:          c.role,
	})

	// Envia estado atual da sala ao novo cliente.
	c.sendJSON(TypeSessionState, SessionStatePayload{
		Status:            h.status,
		ParticipantsCount: len(h.clients),
	})

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
	offerSDP, err := h.sfu.CreateSubscriberOffer(h.roomID, c.participantID, publisherID)
	if err != nil {
		log.Printf("hub[%s]: CreateSubscriberOffer: %v", h.roomID, err)
		c.sendError("SFU_ERROR", "erro ao criar oferta")
		return
	}
	c.sendJSON(TypeOffer, SDPPayload{SDP: offerSDP})
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

	sanitized := html.EscapeString(trimmed)

	h.broadcastAll(TypeChatMessage, ChatRecvPayload{
		MessageID:     hubNewID(),
		ParticipantID: c.participantID,
		Name:          c.name,
		Role:          c.role,
		Content:       sanitized,
		SentAt:        time.Now().UTC().Format(time.RFC3339),
	})
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
}

// BroadcastRoomClosed é chamado externamente (ex: pelo handler REST de close).
func (h *Hub) BroadcastRoomClosed() {
	h.internal <- sigRoomClose
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
