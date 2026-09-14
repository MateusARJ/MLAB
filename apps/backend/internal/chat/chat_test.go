package chat

import (
	"testing"
	"time"
)

func TestChatService_SanitizeAndFormat(t *testing.T) {
	svc := NewService()

	// Teste de mensagem valida
	msg, err := svc.SanitizeAndFormat("room-1", "user-1", "Professor Girafales", "professor", "  Ola turma!  ")
	if err != nil {
		t.Fatalf("Erro inesperado ao formatar mensagem: %v", err)
	}

	if msg.Content != "Ola turma!" {
		t.Errorf("Esperado 'Ola turma!', obteve '%s'", msg.Content)
	}

	if msg.SenderRole != "professor" {
		t.Errorf("Esperado papel 'professor', obteve '%s'", msg.SenderRole)
	}

	if msg.SentAt.IsZero() || msg.SentAt.After(time.Now().Add(time.Second)) {
		t.Errorf("Timestamp server-side invalido: %v", msg.SentAt)
	}

	// Teste de mensagem vazia
	_, err = svc.SanitizeAndFormat("room-1", "user-2", "Aluno", "aluno", "   \n\t  ")
	if err != ErrEmptyMessage {
		t.Errorf("Esperado erro ErrEmptyMessage, obteve %v", err)
	}
}
