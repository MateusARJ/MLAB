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
	TypeEndSession       = "end-session"
	TypeStreamPause      = "stream-pause"     // professor envia para pausar/retomar transmissão
	TypeRequestKeyFrame  = "request-keyframe" // professor (após troca de fonte) ou aluno (ao conectar/congelar) pede keyframe; aluno limitado (002/S9)
	TypeRaiseHand        = "raise-hand"       // aluno levanta ou abaixa a mão
	TypeLowerHand        = "lower-hand"       // professor (ou aluno) abaixa a mão
	TypePinMessage       = "pin-message"      // professor fixa ou desafixa mensagem no chat público ou privado
)

// Mensagens que o servidor envia ao(s) cliente(s).
const (
	TypeSessionState       = "session-state"
	TypePublishApproved    = "publish-approved"
	TypeParticipantJoined  = "participant-joined"
	TypeParticipantLeft    = "participant-left"
	TypeRoomClosed         = "room-closed"
	TypeIceServers         = "ice-servers"
	TypeError              = "error"
	TypeStreamPaused       = "stream-paused"       // broadcast: transmissão pausada/retomada
	TypeFileShared         = "file-shared"         // broadcast: novo arquivo compartilhado
	TypeParticipantsUpdate = "participants-update" // broadcast: lista atualizada de participantes
	TypeChatHistory        = "chat-history"        // unicast: histórico de chat público para novo participante
	TypeFilesHistory       = "files-history"       // unicast: lista de arquivos já compartilhados para novo participante
	TypeStreamStarted      = "stream-started"      // broadcast: professor iniciou a transmissão e a mídia está pronta
	TypeHandUpdated        = "hand-updated"        // broadcast: status de mão levantada atualizado
	TypeChatMessagePinned  = "chat-message-pinned" // broadcast/unicast: mensagem fixada ou desafixada pelo professor
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
	Content   string `json:"content"`
	IsPrivate bool   `json:"is_private,omitempty"`
	TargetID  string `json:"target_id,omitempty"` // participantID do destinatário (para chat privado)
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
	StudentID     string `json:"student_id,omitempty"`
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
	StudentID     string `json:"student_id,omitempty"`
	Content       string `json:"content"`
	IsPrivate     bool   `json:"is_private"`
	TargetID      string `json:"target_id,omitempty"`
	SentAt        string `json:"sent_at"`
	Pinned        bool   `json:"pinned,omitempty"`
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

// ── Payloads: Novos recursos ──────────────────────────────────────────────────

// StreamPauseSendPayload é enviado pelo professor para pausar/retomar a transmissão.
type StreamPauseSendPayload struct {
	Paused bool `json:"paused"`
}

// StreamPausedPayload é retransmitido a todos os assinantes.
type StreamPausedPayload struct {
	Paused bool `json:"paused"`
}

// FileSharedPayload notifica os alunos sobre um novo arquivo compartilhado.
type FileSharedPayload struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Size int64  `json:"size"`
	URL  string `json:"url"`
}

// ParticipantInfo descreve um participante conectado.
type ParticipantInfo struct {
	ParticipantID string `json:"participant_id"`
	Name          string `json:"name"`
	StudentID     string `json:"student_id,omitempty"`
	Role          Role   `json:"role"`
	HandRaised    bool   `json:"hand_raised"`
	HandRaisedAt  string `json:"hand_raised_at,omitempty"`
}

// ParticipantsUpdatePayload envia a lista atualizada de participantes ao professor.
type ParticipantsUpdatePayload struct {
	Count        int               `json:"count"`
	Participants []ParticipantInfo `json:"participants"`
}

// ChatHistoryPayload envia as mensagens públicas acumuladas durante a sessão.
type ChatHistoryPayload struct {
	Messages []ChatRecvPayload `json:"messages"`
}

// FilesHistoryPayload envia a lista de arquivos compartilhados acumulados durante a sessão.
type FilesHistoryPayload struct {
	Files []FileSharedPayload `json:"files"`
}

// StreamStartedPayload notifica os alunos de que o professor iniciou a transmissão e a mídia está disponível.
type StreamStartedPayload struct {
	PublisherID string `json:"publisher_id"`
}

// RaiseHandPayload é enviado pelo aluno para levantar/abaixar a mão.
type RaiseHandPayload struct {
	Raised bool `json:"raised"`
}

// LowerHandPayload é enviado pelo professor (ou aluno) para abaixar a mão de um aluno.
type LowerHandPayload struct {
	ParticipantID string `json:"participant_id,omitempty"`
}

// HandUpdatedPayload notifica todos os clientes sobre alteração no estado de mão levantada.
type HandUpdatedPayload struct {
	ParticipantID string `json:"participant_id"`
	Name          string `json:"name"`
	StudentID     string `json:"student_id,omitempty"`
	Raised        bool   `json:"raised"`
	RaisedAt      string `json:"raised_at,omitempty"`
}

// PinMessageSendPayload é enviado exclusivamente pelo professor para fixar/desafixar uma mensagem.
type PinMessageSendPayload struct {
	MessageID string `json:"message_id"`
	Pinned    bool   `json:"pinned"`
	IsPrivate bool   `json:"is_private,omitempty"`
	TargetID  string `json:"target_id,omitempty"`
}

// ChatMessagePinnedPayload notifica os clientes sobre uma mensagem fixada ou desafixada pelo professor.
type ChatMessagePinnedPayload struct {
	MessageID string `json:"message_id"`
	Pinned    bool   `json:"pinned"`
	IsPrivate bool   `json:"is_private"`
	TargetID  string `json:"target_id,omitempty"`
}
