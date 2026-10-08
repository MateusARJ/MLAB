package signaling

import (
	"encoding/json"
	"testing"
	"time"
)

func TestHub_RaiseHand_StudentSuccessAndBroadcast(t *testing.T) {
	hub := newHub("room-test-hand-1", nil)

	prof := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "prof-01",
		roomID:        "room-test-hand-1",
		role:          RoleProfessor,
		name:          "Professor Girafales",
	}
	student := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "student-01",
		roomID:        "room-test-hand-1",
		role:          RoleAluno,
		name:          "Chaves",
		studentID:     "2025116TADS0001",
	}

	hub.clients[prof.participantID] = prof
	hub.clients[student.participantID] = student

	// Aluno levanta a mão
	payloadBytes, _ := json.Marshal(RaiseHandPayload{Raised: true})
	hub.onRaiseHand(student, WsMessage{
		Type:    TypeRaiseHand,
		Payload: payloadBytes,
	})

	if !student.handRaised {
		t.Fatal("expected student.handRaised to be true")
	}

	// Verifica recebimento de hand-updated pelo professor
	select {
	case msgBytes := <-prof.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type != TypeHandUpdated {
			t.Fatalf("expected hand-updated message, got %s", wsMsg.Type)
		}
		var updated HandUpdatedPayload
		_ = json.Unmarshal(wsMsg.Payload, &updated)
		if updated.ParticipantID != "student-01" || !updated.Raised || updated.Name != "Chaves" {
			t.Fatalf("unexpected hand-updated payload: %+v", updated)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for hand-updated message on professor")
	}

	// Verifica recebimento de participants-update com HandRaised=true
	select {
	case msgBytes := <-prof.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type != TypeParticipantsUpdate {
			t.Fatalf("expected participants-update message, got %s", wsMsg.Type)
		}
		var pUpdate ParticipantsUpdatePayload
		_ = json.Unmarshal(wsMsg.Payload, &pUpdate)
		var found bool
		for _, p := range pUpdate.Participants {
			if p.ParticipantID == "student-01" {
				found = true
				if !p.HandRaised {
					t.Fatalf("expected student-01 to have HandRaised=true in participants-update")
				}
			}
		}
		if !found {
			t.Fatal("student-01 not found in participants-update")
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for participants-update on professor")
	}
}

func TestHub_RaiseHand_ProfessorForbidden(t *testing.T) {
	hub := newHub("room-test-hand-2", nil)

	prof := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "prof-01",
		roomID:        "room-test-hand-2",
		role:          RoleProfessor,
		name:          "Professor Girafales",
	}
	hub.clients[prof.participantID] = prof

	hub.onRaiseHand(prof, WsMessage{
		Type:    TypeRaiseHand,
		Payload: []byte(`{"raised":true}`),
	})

	select {
	case msgBytes := <-prof.send:
		var wsMsg WsMessage
		_ = json.Unmarshal(msgBytes, &wsMsg)
		if wsMsg.Type != TypeError {
			t.Fatalf("expected error message type, got %s", wsMsg.Type)
		}
		var errPayload ErrorPayload
		_ = json.Unmarshal(wsMsg.Payload, &errPayload)
		if errPayload.Code != "FORBIDDEN" {
			t.Fatalf("expected FORBIDDEN error code, got %s", errPayload.Code)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for error response on professor raise hand")
	}
}

func TestHub_LowerHand_ProfessorAndStudent(t *testing.T) {
	hub := newHub("room-test-hand-3", nil)

	prof := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "prof-01",
		roomID:        "room-test-hand-3",
		role:          RoleProfessor,
		name:          "Professor Girafales",
	}
	student := &Client{
		hub:           hub,
		send:          make(chan []byte, 10),
		participantID: "student-01",
		roomID:        "room-test-hand-3",
		role:          RoleAluno,
		name:          "Chaves",
		studentID:     "2025116TADS0001",
		handRaised:    true,
		handRaisedAt:  time.Now(),
	}

	hub.clients[prof.participantID] = prof
	hub.clients[student.participantID] = student

	// 1. Professor abaixa a mão do aluno
	lowerPayload, _ := json.Marshal(LowerHandPayload{ParticipantID: "student-01"})
	hub.onLowerHand(prof, WsMessage{
		Type:    TypeLowerHand,
		Payload: lowerPayload,
	})

	if student.handRaised {
		t.Fatal("expected student.handRaised to be false after professor lowered it")
	}

	// 2. Aluno levanta a mão de novo e abaixa a própria mão
	student.handRaised = true
	hub.onLowerHand(student, WsMessage{
		Type:    TypeLowerHand,
		Payload: []byte(`{}`),
	})

	if student.handRaised {
		t.Fatal("expected student.handRaised to be false after student lowered own hand")
	}
}
