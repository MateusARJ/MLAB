package signaling

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestChatTracker_RateLimit(t *testing.T) {
	tracker := &chatTracker{}

	// Deve permitir até 5 mensagens na janela curta de 5 segundos
	for i := 1; i <= 5; i++ {
		if !tracker.allow() {
			t.Fatalf("expected message %d to be allowed by rate limiter", i)
		}
	}

	// A 6ª mensagem consecutiva dentro da janela de 5s deve ser bloqueada
	if tracker.allow() {
		t.Fatal("expected 6th message within 5s window to be blocked by rate limiter")
	}
}

func TestChatTracker_SlidingWindowExpiration(t *testing.T) {
	tracker := &chatTracker{
		shortWindow: []time.Time{
			time.Now().Add(-6 * time.Second), // expirada
			time.Now().Add(-7 * time.Second), // expirada
		},
		longWindow: []time.Time{
			time.Now().Add(-65 * time.Second), // expirada
		},
	}

	// Com mensagens antigas expiradas, deve permitir nova mensagem
	if !tracker.allow() {
		t.Fatal("expected message to be allowed after window expiration")
	}

	// As mensagens expiradas devem ter sido limpas
	if len(tracker.shortWindow) != 1 {
		t.Errorf("expected 1 active message in shortWindow, got %d", len(tracker.shortWindow))
	}
}

func TestHub_PublishRequest_RoleEnforcement(t *testing.T) {
	hub := newHub("room-test-1", nil)

	profClient := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "prof-01",
		roomID:        "room-test-1",
		role:          RoleProfessor,
		name:          "Professor Girafales",
	}

	studentClient := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "student-01",
		roomID:        "room-test-1",
		role:          RoleAluno,
		name:          "Chaves",
	}

	// 1. Aluno tentando publicar tela -> deve receber erro FORBIDDEN
	hub.onPublishRequest(studentClient)
	select {
	case msgBytes := <-studentClient.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type != TypeError {
			t.Errorf("expected error message type, got %s", wsMsg.Type)
		}
		var errPayload ErrorPayload
		_ = json.Unmarshal(wsMsg.Payload, &errPayload)
		if errPayload.Code != "FORBIDDEN" {
			t.Errorf("expected FORBIDDEN error code for student publish, got %s", errPayload.Code)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for error response on student publish request")
	}

	// 2. Professor publicando tela -> deve receber publish-approved
	hub.onPublishRequest(profClient)
	select {
	case msgBytes := <-profClient.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type != TypePublishApproved {
			t.Errorf("expected publish-approved message type, got %s", wsMsg.Type)
		}
		if hub.publisherID != profClient.participantID {
			t.Errorf("expected hub publisherID to be %s, got %s", profClient.participantID, hub.publisherID)
		}
		if hub.status != SessionPublishing {
			t.Errorf("expected hub status to be publishing, got %s", hub.status)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for publish-approved response for professor")
	}
}

func TestHub_ChatMessage_SanitizationAndDiscard(t *testing.T) {
	hub := newHub("room-test-chat", nil)

	client := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "part-chat-1",
		roomID:        "room-test-chat",
		role:          RoleAluno,
		name:          "Aluno Chat",
	}
	hub.clients[client.participantID] = client
	hub.chatLimits[client.participantID] = &chatTracker{}

	// 1. Mensagem vazia ou apenas espaços -> deve ser descartada sem broadcast
	emptyMsg := WsMessage{
		Type:    TypeChatMessage,
		Payload: []byte(`{"content":"   \n\t  "}`),
	}
	hub.onChatMessage(client, emptyMsg)

	select {
	case <-client.send:
		t.Fatal("expected empty chat message to be discarded, but message was sent")
	default:
		// Correto: nada enviado
	}

	// 2. Mensagem com script malicioso -> deve ser sanitizada com html.EscapeString
	xssPayload := `<script>alert('pwned')</script>&"test"`
	payloadBytes, _ := json.Marshal(ChatSendPayload{Content: xssPayload})
	xssMsg := WsMessage{
		Type:    TypeChatMessage,
		Payload: payloadBytes,
	}
	hub.onChatMessage(client, xssMsg)

	select {
	case msgBytes := <-client.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type != TypeChatMessage {
			t.Errorf("expected type chat-message, got %s", wsMsg.Type)
		}

		var chatRecv ChatRecvPayload
		_ = json.Unmarshal(wsMsg.Payload, &chatRecv)

		if strings.Contains(chatRecv.Content, "<script>") {
			t.Errorf("security violation: raw <script> tag found in chat content: %s", chatRecv.Content)
		}
		expectedSanitized := "&lt;script&gt;alert(&#39;pwned&#39;)&lt;/script&gt;&amp;&#34;test&#34;"
		if chatRecv.Content != expectedSanitized {
			t.Errorf("expected sanitized content %q, got %q", expectedSanitized, chatRecv.Content)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for sanitized chat message broadcast")
	}
}
