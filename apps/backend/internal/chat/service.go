package chat

import (
	"errors"
	"fmt"
	"html"
	"strings"
	"time"
)

var (
	ErrEmptyMessage = errors.New("mensagem vazia")
)

// Message representa uma mensagem de chat formatada e auditada pelo servidor.
type Message struct {
	ID         string    `json:"id"`
	RoomID     string    `json:"room_id"`
	SenderID   string    `json:"sender_id"`
	SenderName string    `json:"sender_name"`
	SenderRole string    `json:"sender_role"`
	Content    string    `json:"content"`
	SentAt     time.Time `json:"sent_at"`
}

// Service gerencia a higienização, sanitização XSS e formatação de mensagens do chat.
type Service struct{}

// NewService cria um novo serviço de chat.
func NewService() *Service {
	return &Service{}
}

// SanitizeAndFormat limpa espaços em branco, escapa HTML contra XSS e gera o timestamp server-side.
func (s *Service) SanitizeAndFormat(roomID, senderID, senderName, senderRole, rawContent string) (*Message, error) {
	trimmed := strings.TrimSpace(rawContent)
	if trimmed == "" {
		return nil, ErrEmptyMessage
	}

	// Máscara de segurança para termos ofensivos / palavrões
	maskedContent := MaskProfanity(trimmed)

	// Sanitização XSS estrita (RNF-17 / ADR 0004)
	sanitizedContent := html.EscapeString(maskedContent)

	// Formatação do nome de exibição conforme papel
	formattedRole := strings.ToLower(senderRole)

	return &Message{
		ID:         fmt.Sprintf("msg-%d", time.Now().UnixNano()),
		RoomID:     roomID,
		SenderID:   senderID,
		SenderName: senderName,
		SenderRole: formattedRole,
		Content:    sanitizedContent,
		SentAt:     time.Now().UTC(),
	}, nil
}
