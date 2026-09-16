package signaling

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/screenshare/classroom/internal/auth"
	"github.com/screenshare/classroom/internal/room"
)

// TestSignalingSecurity_ChatRateLimit valida que o limite de 5 msgs / 5s
// gera erro CHAT_RATE_LIMITED sem derrubar o cliente (ADR 0004 §2.2.3, RN-15, RN-16).
func TestSignalingSecurity_ChatRateLimit(t *testing.T) {
	hub := newHub("room-sec-rate", nil)

	client := &Client{
		hub:           hub,
		send:          make(chan []byte, 20),
		participantID: "spam-user",
		roomID:        "room-sec-rate",
		role:          RoleAluno,
		name:          "Spammer",
	}
	hub.clients[client.participantID] = client
	hub.chatLimits[client.participantID] = &chatTracker{}

	// Envia 5 mensagens normais
	for i := 1; i <= 5; i++ {
		msg := WsMessage{
			Type:    TypeChatMessage,
			Payload: []byte(`{"content":"mensagem valida ` + strconv.Itoa(i) + `"}`),
		}
		hub.onChatMessage(client, msg)

		// Deve receber o broadcast de chat
		select {
		case msgBytes := <-client.send:
			var wsMsg WsMessage
			_ = json.Unmarshal(msgBytes, &wsMsg)
			if wsMsg.Type != TypeChatMessage {
				t.Errorf("expected chat-message, got %s", wsMsg.Type)
			}
		case <-time.After(500 * time.Millisecond):
			t.Fatalf("timeout waiting for broadcast of message %d", i)
		}
	}

	// 6ª mensagem no mesmo segundo -> deve retornar erro CHAT_RATE_LIMITED
	sixthMsg := WsMessage{
		Type:    TypeChatMessage,
		Payload: []byte(`{"content":"mensagem excedente"}`),
	}
	hub.onChatMessage(client, sixthMsg)

	select {
	case msgBytes := <-client.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type != TypeError {
			t.Fatalf("expected error message for 6th message, got %s", wsMsg.Type)
		}
		var errPayload ErrorPayload
		_ = json.Unmarshal(wsMsg.Payload, &errPayload)
		if errPayload.Code != "CHAT_RATE_LIMITED" {
			t.Errorf("expected code CHAT_RATE_LIMITED, got %s", errPayload.Code)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timeout waiting for CHAT_RATE_LIMITED error response")
	}

	// Cliente NÃO deve ter sido desconectado (RN-16)
	if _, ok := hub.clients[client.participantID]; !ok {
		t.Errorf("violation of RN-16: client was disconnected after rate limit exceeded")
	}
}

// TestSignalingSecurity_TurnHMACCredentials valida geração de credenciais efêmeras TURN (ADR 0004 §2.2.5, RF-23, RN-11).
func TestSignalingSecurity_TurnHMACCredentials(t *testing.T) {
	secret := "turn-master-secret-98765"
	partID := "participant-turn-1"

	before := time.Now().Add(24 * time.Hour).Unix()
	username, credential := turnCredentials(partID, secret)
	after := time.Now().Add(24 * time.Hour).Unix()

	// Validação do formato username = "<unix_expiry>:<participantID>"
	parts := strings.Split(username, ":")
	if len(parts) != 2 {
		t.Fatalf("expected username format <expiry>:<partID>, got %s", username)
	}

	expiry, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		t.Fatalf("invalid expiry timestamp in username: %v", err)
	}
	if expiry < before || expiry > after {
		t.Errorf("expected expiry around 24h from now, got %d (expected between %d and %d)", expiry, before, after)
	}
	if parts[1] != partID {
		t.Errorf("expected participantID %s in username, got %s", partID, parts[1])
	}

	// Validação da assinatura HMAC-SHA1
	mac := hmac.New(sha1.New, []byte(secret))
	mac.Write([]byte(username))
	expectedCredential := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	if credential != expectedCredential {
		t.Errorf("security violation: credential HMAC does not match expected signature")
	}
}

// TestSignalingSecurity_WSUpgradeAuth valida validações de JWT no handshake WebSocket (ADR 0004 §2.1.A).
func TestSignalingSecurity_WSUpgradeAuth(t *testing.T) {
	t.Setenv("JWT_SECRET", "ws-auth-secret-12345")

	store := room.NewInMemoryStore()
	testRoom := &room.Room{
		ID:              "room-valid-1",
		Slug:            "room-valid-slug",
		OwnerID:         "prof-1",
		Status:          room.StatusWaiting,
		MaxParticipants: 50,
		CreatedAt:       time.Now(),
	}
	_ = store.CreateRoom(nil, testRoom)

	handler := NewHandler(store, nil)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 1. Handshake sem token -> 401 Unauthorized
	reqNoToken := httptest.NewRequest("GET", "/ws/rooms/room-valid-1/signal", nil)
	recNoToken := httptest.NewRecorder()
	mux.ServeHTTP(recNoToken, reqNoToken)
	if recNoToken.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for WS without token, got %d", recNoToken.Code)
	}

	// 2. Handshake com token de outra sala -> 403 Forbidden
	otherRoomClaims := auth.StudentMapClaims("stud-1", "Aluno Outro", "RA-01", "other-room-id")
	otherToken, _ := auth.SignToken(otherRoomClaims)

	reqWrongRoom := httptest.NewRequest("GET", "/ws/rooms/room-valid-1/signal?token="+otherToken, nil)
	recWrongRoom := httptest.NewRecorder()
	mux.ServeHTTP(recWrongRoom, reqWrongRoom)
	if recWrongRoom.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for token belonging to another room, got %d", recWrongRoom.Code)
	}

	// 3. Handshake com token em sala inexistente -> 404 Not Found
	validClaims := auth.StudentMapClaims("stud-1", "Aluno", "RA-01", "non-existent-room")
	validToken, _ := auth.SignToken(validClaims)

	reqNotFound := httptest.NewRequest("GET", "/ws/rooms/non-existent-room/signal?token="+validToken, nil)
	recNotFound := httptest.NewRecorder()
	mux.ServeHTTP(recNotFound, reqNotFound)
	if recNotFound.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found for non-existent room, got %d", recNotFound.Code)
	}
}
