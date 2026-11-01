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

	// 3. Mensagem com palavrão pública e privada -> deve receber máscara de segurança
	profPayload := `Essa porra não funciona caralho!`
	pBytes, _ := json.Marshal(ChatSendPayload{Content: profPayload, IsPrivate: false})
	hub.onChatMessage(client, WsMessage{Type: TypeChatMessage, Payload: pBytes})

	select {
	case msgBytes := <-client.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		var chatRecv ChatRecvPayload
		_ = json.Unmarshal(wsMsg.Payload, &chatRecv)

		if strings.Contains(strings.ToLower(chatRecv.Content), "porra") || strings.Contains(strings.ToLower(chatRecv.Content), "caralho") {
			t.Errorf("palavrão vazou no broadcast público: %s", chatRecv.Content)
		}
		expectedMasked := "Essa ***** não funciona *******!"
		if chatRecv.Content != expectedMasked {
			t.Errorf("esperado %q, obteve %q", expectedMasked, chatRecv.Content)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout aguardando chat público mascarado")
	}

	// Chat privado com professor também deve ser mascarado
	privBytes, _ := json.Marshal(ChatSendPayload{Content: "merda professor", IsPrivate: true, TargetID: "prof-01"})
	hub.onChatMessage(client, WsMessage{Type: TypeChatMessage, Payload: privBytes})

	select {
	case msgBytes := <-client.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		var chatRecv ChatRecvPayload
		_ = json.Unmarshal(wsMsg.Payload, &chatRecv)

		if strings.Contains(strings.ToLower(chatRecv.Content), "merda") {
			t.Errorf("palavrão vazou no chat privado: %s", chatRecv.Content)
		}
		expectedPriv := "***** professor"
		if chatRecv.Content != expectedPriv {
			t.Errorf("esperado %q, obteve %q", expectedPriv, chatRecv.Content)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout aguardando chat privado mascarado")
	}
}

func TestHub_Reconnection_RaceConditionPrevention(t *testing.T) {
	hub := newHub("room-test-reconnect", nil)

	// Conexão inicial do professor
	prof1 := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "prof-01",
		roomID:        "room-test-reconnect",
		role:          RoleProfessor,
		name:          "Professor Titular",
	}
	hub.onRegister(prof1)
	hub.onPublishRequest(prof1)

	if hub.status != SessionPublishing {
		t.Fatalf("expected status SessionPublishing, got %s", hub.status)
	}

	// Nova conexão do professor (reconexão ou troca de modo/fonte)
	prof2 := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "prof-01",
		roomID:        "room-test-reconnect",
		role:          RoleProfessor,
		name:          "Professor Titular",
	}
	hub.onRegister(prof2)

	// Simula a conexão antiga fechando APÓS a nova registrar
	hub.onUnregister(prof1)

	// A conexão ativa prof2 NÃO deve ter sido removida do hub
	if activeClient, exists := hub.clients["prof-01"]; !exists || activeClient != prof2 {
		t.Fatal("expected prof2 to remain registered in hub after prof1 unregister")
	}

	// O status da sala deve permanecer publishing e NÃO entrar em reconnecting/timeout
	if hub.status != SessionPublishing {
		t.Fatalf("expected hub status to remain SessionPublishing, got %s", hub.status)
	}
	if hub.publisherTimer != nil {
		t.Fatal("expected publisherTimer to be nil, but timer was set")
	}
}

func TestHub_ChatHistory_StoredAndSentOnRegister(t *testing.T) {
	hub := newHub("room-test-chathistory", nil)

	prof := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "prof-01",
		roomID:        "room-test-chathistory",
		role:          RoleProfessor,
		name:          "Professor",
	}
	hub.onRegister(prof)

	// 1. Professor envia mensagem pública
	pubMsg := WsMessage{
		Type:    TypeChatMessage,
		Payload: []byte(`{"content":"Olá turma, sejam bem-vindos!","is_private":false}`),
	}
	hub.onChatMessage(prof, pubMsg)

	// 2. Professor envia mensagem privada para alguém
	privMsg := WsMessage{
		Type:    TypeChatMessage,
		Payload: []byte(`{"content":"Mensagem privada de teste","is_private":true,"target_id":"student-99"}`),
	}
	hub.onChatMessage(prof, privMsg)

	// O histórico deve conter apenas a mensagem pública
	if len(hub.chatHistory) != 1 {
		t.Fatalf("expected 1 message in hub.chatHistory, got %d", len(hub.chatHistory))
	}
	if hub.chatHistory[0].Content != "Olá turma, sejam bem-vindos!" {
		t.Errorf("unexpected content in chatHistory: %s", hub.chatHistory[0].Content)
	}

	// 3. Novo aluno entra na sala depois das mensagens
	student := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "student-02",
		roomID:        "room-test-chathistory",
		role:          RoleAluno,
		name:          "Aluno Novo",
	}
	hub.onRegister(student)

	// O aluno novo deve receber TypeChatHistory no canal send
	var receivedChatHistory bool
	for len(student.send) > 0 {
		msgBytes := <-student.send
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type == TypeChatHistory {
			receivedChatHistory = true
			var historyPayload ChatHistoryPayload
			_ = json.Unmarshal(wsMsg.Payload, &historyPayload)
			if len(historyPayload.Messages) != 1 {
				t.Errorf("expected 1 message in ChatHistoryPayload, got %d", len(historyPayload.Messages))
			}
			if historyPayload.Messages[0].Content != "Olá turma, sejam bem-vindos!" {
				t.Errorf("unexpected message in ChatHistoryPayload: %s", historyPayload.Messages[0].Content)
			}
		}
	}

	if !receivedChatHistory {
		t.Fatal("expected student to receive TypeChatHistory on register")
	}
}

func TestHub_FilesHistory_StoredAndSentOnRegister(t *testing.T) {
	hub := newHub("room-test-fileshistory", nil)

	// 1. Simula arquivo compartilhado na sala
	hub.sharedFiles = append(hub.sharedFiles, FileSharedPayload{
		ID:   "file-123",
		Name: "aula1.pdf",
		Size: 1024,
		URL:  "/rooms/room-test-fileshistory/files/file-123/download",
	})

	// 2. Novo aluno entra na sala
	student := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "student-files-01",
		roomID:        "room-test-fileshistory",
		role:          RoleAluno,
		name:          "Aluno Arquivos",
	}
	hub.onRegister(student)

	// O aluno deve receber TypeFilesHistory
	var receivedFilesHistory bool
	for len(student.send) > 0 {
		msgBytes := <-student.send
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type == TypeFilesHistory {
			receivedFilesHistory = true
			var filesPayload FilesHistoryPayload
			_ = json.Unmarshal(wsMsg.Payload, &filesPayload)
			if len(filesPayload.Files) != 1 {
				t.Fatalf("expected 1 file in FilesHistoryPayload, got %d", len(filesPayload.Files))
			}
			if filesPayload.Files[0].ID != "file-123" || filesPayload.Files[0].Name != "aula1.pdf" {
				t.Errorf("unexpected file in FilesHistoryPayload: %+v", filesPayload.Files[0])
			}
		}
	}

	if !receivedFilesHistory {
		t.Fatal("expected student to receive TypeFilesHistory on register")
	}
}

func TestHub_StreamStarted_Broadcast(t *testing.T) {
	hub := newHub("room-test-streamstarted", nil)

	student := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "student-stream-01",
		roomID:        "room-test-streamstarted",
		role:          RoleAluno,
		name:          "Aluno Stream",
	}
	hub.clients[student.participantID] = student

	// Dispara OnStreamStarted
	hub.onStreamStarted()

	if hub.status != SessionPublishing {
		t.Errorf("expected hub status SessionPublishing, got %s", hub.status)
	}

	// Aluno deve ter recebido stream-started
	var receivedStreamStarted bool
	for len(student.send) > 0 {
		msgBytes := <-student.send
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type == TypeStreamStarted {
			receivedStreamStarted = true
		}
	}

	if !receivedStreamStarted {
		t.Fatal("expected student to receive TypeStreamStarted")
	}
}

func TestHub_PinMessage_RoleEnforcementLimitAndBroadcast(t *testing.T) {
	hub := newHub("room-test-pin", nil)

	prof := &Client{
		hub:           hub,
		send:          make(chan []byte, 20),
		participantID: "prof-pin-01",
		roomID:        "room-test-pin",
		role:          RoleProfessor,
		name:          "Professor",
	}
	student1 := &Client{
		hub:           hub,
		send:          make(chan []byte, 20),
		participantID: "student-pin-01",
		roomID:        "room-test-pin",
		role:          RoleAluno,
		name:          "Aluno 1",
	}
	student2 := &Client{
		hub:           hub,
		send:          make(chan []byte, 20),
		participantID: "student-pin-02",
		roomID:        "room-test-pin",
		role:          RoleAluno,
		name:          "Aluno 2",
	}

	hub.clients[prof.participantID] = prof
	hub.clients[student1.participantID] = student1
	hub.clients[student2.participantID] = student2

	// Popula 4 mensagens públicas no histórico
	hub.chatHistory = []ChatRecvPayload{
		{MessageID: "msg-1", Content: "Msg 1", IsPrivate: false},
		{MessageID: "msg-2", Content: "Msg 2", IsPrivate: false},
		{MessageID: "msg-3", Content: "Msg 3", IsPrivate: false},
		{MessageID: "msg-4", Content: "Msg 4", IsPrivate: false},
	}

	// 1. Aluno tentando fixar mensagem -> FORBIDDEN
	hub.onPinMessage(student1, WsMessage{
		Type:    TypePinMessage,
		Payload: []byte(`{"message_id":"msg-1","pinned":true}`),
	})
	select {
	case msgBytes := <-student1.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type != TypeError {
			t.Fatalf("expected error for student pin, got %s", wsMsg.Type)
		}
		var errPayload ErrorPayload
		_ = json.Unmarshal(wsMsg.Payload, &errPayload)
		if errPayload.Code != "FORBIDDEN" {
			t.Errorf("expected FORBIDDEN, got %s", errPayload.Code)
		}
	default:
		t.Fatal("expected FORBIDDEN error for student pin")
	}

	// 2. Professor fixa 3 mensagens públicas -> permitido e atualizado no chatHistory
	for _, id := range []string{"msg-1", "msg-2", "msg-3"} {
		hub.onPinMessage(prof, WsMessage{
			Type:    TypePinMessage,
			Payload: []byte(`{"message_id":"` + id + `","pinned":true,"is_private":false}`),
		})
	}
	if !hub.chatHistory[0].Pinned || !hub.chatHistory[1].Pinned || !hub.chatHistory[2].Pinned {
		t.Fatal("expected first 3 messages in chatHistory to be marked Pinned=true")
	}

	// Limpa canais de send antes de testar a 4ª fixação
	for len(prof.send) > 0 {
		<-prof.send
	}
	for len(student1.send) > 0 {
		<-student1.send
	}
	for len(student2.send) > 0 {
		<-student2.send
	}

	// 3. Professor tenta fixar a 4ª mensagem pública -> bloqueado por PIN_LIMIT_REACHED (máx 3)
	hub.onPinMessage(prof, WsMessage{
		Type:    TypePinMessage,
		Payload: []byte(`{"message_id":"msg-4","pinned":true,"is_private":false}`),
	})
	if hub.chatHistory[3].Pinned {
		t.Fatal("expected 4th message NOT to be pinned when limit of 3 is reached")
	}
	select {
	case msgBytes := <-prof.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		var errPayload ErrorPayload
		_ = json.Unmarshal(wsMsg.Payload, &errPayload)
		if errPayload.Code != "PIN_LIMIT_REACHED" {
			t.Errorf("expected PIN_LIMIT_REACHED, got %s", errPayload.Code)
		}
	default:
		t.Fatal("expected PIN_LIMIT_REACHED error when pinning 4th message")
	}

	// 4. Professor desafixa msg-1 e fixa msg-4 -> permitido
	hub.onPinMessage(prof, WsMessage{
		Type:    TypePinMessage,
		Payload: []byte(`{"message_id":"msg-1","pinned":false,"is_private":false}`),
	})
	hub.onPinMessage(prof, WsMessage{
		Type:    TypePinMessage,
		Payload: []byte(`{"message_id":"msg-4","pinned":true,"is_private":false}`),
	})
	if hub.chatHistory[0].Pinned || !hub.chatHistory[3].Pinned {
		t.Fatal("expected msg-1 unpinned and msg-4 pinned")
	}

	// Limpa canais antes do teste de chat privado
	for len(prof.send) > 0 {
		<-prof.send
	}
	for len(student1.send) > 0 {
		<-student1.send
	}
	for len(student2.send) > 0 {
		<-student2.send
	}

	// 5. Professor fixa mensagem privada para student-pin-01 -> student2 NÃO recebe
	hub.onPinMessage(prof, WsMessage{
		Type:    TypePinMessage,
		Payload: []byte(`{"message_id":"priv-msg-1","pinned":true,"is_private":true,"target_id":"student-pin-01"}`),
	})
	if len(student1.send) != 1 {
		t.Fatalf("expected student1 to receive private pin event, got %d messages", len(student1.send))
	}
	if len(student2.send) != 0 {
		t.Fatalf("security violation: student2 received private pin event meant for student1")
	}
}



