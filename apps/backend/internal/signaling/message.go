package signaling

import "encoding/json"

// ── Tipos de mensagem ─────────────────────────────────────────────────────────

// Mensagens que o cliente envia ao servidor.
const (
	TypeJoin             = "join"
	TypeOffer            = "offer"
	TypeAnswer           = "answer"
	TypeIceCandidate     = "ice-candidate"
	TypePublishRequest   = "publish-request"
	TypeSubscribeRequest = "subscribe-request"
	TypeChatMessage      = "chat-message"
)

// Mensagens que o servidor envia ao(s) cliente(s).
const (
	TypeSessionState      = "session-state"
	TypePublishApproved   = "publish-approved"
	TypeParticipantJoined = "participant-joined"
	TypeParticipantLeft   = "participant-left"
	TypeRoomClosed        = "room-closed"
	TypeIceServers        = "ice-servers"
	TypeError             = "error"
)

// SessionStatus reflete o estado da sala de transmissão.
type SessionStatus string

const (
	SessionWaiting      SessionStatus = "waiting"
	SessionPublishing   SessionStatus = "publishing"
	SessionReconnecting SessionStatus = "reconnecting"
	SessionClosed       SessionStatus = "closed"
)

// Role do participante (espelha auth.Role para evitar import circular).
type Role string

const (
	RoleProfessor Role = "professor"
	RoleAluno     Role = "aluno"
)

// ── Envelope ──────────────────────────────────────────────────────────────────

// WsMessage é o envelope JSON para todas as mensagens WebSocket.
type WsMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// mustMarshal serializa v para JSON; panic em caso de erro (tipos internos fixos).
func mustMarshal(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic("signaling: mustMarshal: " + err.Error())
	}
	return b
}

// buildMsg constrói um WsMessage serializado como []byte.
func buildMsg(msgType string, payload any) []byte {
	msg := WsMessage{
		Type:    msgType,
		Payload: mustMarshal(payload),
	}
	b, _ := json.Marshal(msg)
	return b
}

// ── Payloads: Cliente → Servidor ─────────────────────────────────────────────

type JoinPayload struct {
	RoomID string `json:"room_id"`
	Token  string `json:"token"`
}

type SDPPayload struct {
	SDP string `json:"sdp"`
}

type IceCandidatePayload struct {
	Candidate string `json:"candidate"`
}

type SubscribeRequestPayload struct {
	PublisherID string `json:"publisher_id"`
}

type ChatSendPayload struct {
	Content string `json:"content"`
}

// ── Payloads: Servidor → Cliente ─────────────────────────────────────────────

type SessionStatePayload struct {
	Status            SessionStatus `json:"status"`
	ParticipantsCount int           `json:"participants_count"`
}

type PublishApprovedPayload struct {
	PublisherID string `json:"publisher_id"`
}

type ParticipantJoinedPayload struct {
	ParticipantID string `json:"participant_id"`
	Name          string `json:"name"`
	Role          Role   `json:"role"`
}

type ParticipantLeftPayload struct {
	ParticipantID string `json:"participant_id"`
}

type ChatRecvPayload struct {
	MessageID     string `json:"message_id"`
	ParticipantID string `json:"participant_id"`
	Name          string `json:"name"`
	Role          Role   `json:"role"`
	Content       string `json:"content"`
	SentAt        string `json:"sent_at"`
}

type IceServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

type IceServersPayload struct {
	IceServers []IceServer `json:"ice_servers"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
