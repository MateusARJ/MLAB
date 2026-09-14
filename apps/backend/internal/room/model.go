package room

import (
	"time"
)

// Status da sala.
type Status string

const (
	StatusWaiting    Status = "waiting"
	StatusPublishing Status = "publishing"
	StatusClosed     Status = "closed"
)

// Room representa uma sala de transmissão.
type Room struct {
	ID              string    `json:"room_id"`
	Slug            string    `json:"slug"`
	OwnerID         string    `json:"owner_id"`
	Status          Status    `json:"status"`
	MaxParticipants int       `json:"max_participants"`
	CreatedAt       time.Time `json:"created_at"`
	ClosedAt        *time.Time `json:"closed_at,omitempty"`
}

// Participant representa um aluno que entrou na sala.
type Participant struct {
	ID        string    `json:"participant_id"`
	RoomID    string    `json:"room_id"`
	Name      string    `json:"name"`
	StudentID string    `json:"student_id"`
	JoinedAt  time.Time `json:"joined_at"`
}

// ── Request/Response DTOs ─────────────────────────────────────────────────────

// CreateRoomRequest é o payload de POST /rooms.
type CreateRoomRequest struct {
	MaxParticipants int `json:"max_participants"`
}

// CreateRoomResponse é a resposta de POST /rooms (201).
type CreateRoomResponse struct {
	RoomID    string `json:"room_id"`
	Slug      string `json:"slug"`
	Link      string `json:"link"`
	Status    Status `json:"status"`
	CreatedAt string `json:"created_at"`
}

// LinkResponse é a resposta de GET /rooms/{id}/link (200).
type LinkResponse struct {
	RoomID string `json:"room_id"`
	Link   string `json:"link"`
}

// JoinRequest é o payload de POST /rooms/{id}/join.
type JoinRequest struct {
	Name      string `json:"name"`
	StudentID string `json:"student_id"`
}

// JoinResponse é a resposta de POST /rooms/{id}/join (200).
type JoinResponse struct {
	Token         string `json:"token"`
	ExpiresAt     string `json:"expires_at"`
	ParticipantID string `json:"participant_id"`
	RoomStatus    Status `json:"room_status"`
}

// CloseResponse é a resposta de POST /rooms/{id}/close (200).
type CloseResponse struct {
	Status   Status `json:"status"`
	ClosedAt string `json:"closed_at"`
}
