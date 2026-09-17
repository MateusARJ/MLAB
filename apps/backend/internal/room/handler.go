package room

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/screenshare/classroom/internal/auth"
)

const defaultMaxParticipants = 50

// Handler agrupa os endpoints HTTP do módulo room.
type Handler struct {
	store   Store
	baseURL string // ex: https://screenshare.example.com
}

// NewHandler cria um Handler com o store e a URL base fornecidos.
// A URL base é lida de BASE_URL ou usa http://localhost:3000 como fallback.
func NewHandler(store Store) *Handler {
	base := os.Getenv("BASE_URL")
	if base == "" {
		base = "http://localhost:3000"
	}
	return &Handler{store: store, baseURL: base}
}

// RegisterRoutes registra os endpoints públicos (sem JWT).
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// Pública — aluno entra com nome + matrícula, sem JWT prévio.
	mux.HandleFunc("POST /rooms/{roomId}/join", h.joinRoom)
}

// RegisterProtectedRoutes registra os endpoints que exigem JWT de professor,
// aplicando o middleware fornecido em cada rota individualmente.
func (h *Handler) RegisterProtectedRoutes(mux *http.ServeMux, mw func(http.Handler) http.Handler) {
	mux.Handle("POST /rooms", mw(http.HandlerFunc(h.createRoom)))
	mux.Handle("GET /rooms/{roomId}/link", mw(http.HandlerFunc(h.getLink)))
	mux.Handle("POST /rooms/{roomId}/close", mw(http.HandlerFunc(h.closeRoom)))
}

// ── POST /rooms ───────────────────────────────────────────────────────────────

func (h *Handler) createRoom(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok || auth.ClaimRole(claims) != auth.RoleProfessor {
		writeError(w, http.StatusForbidden, "apenas professores podem criar salas")
		return
	}

	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// body vazio é permitido (usa defaults)
		req = CreateRoomRequest{}
	}
	if req.MaxParticipants <= 0 || req.MaxParticipants > 200 {
		req.MaxParticipants = defaultMaxParticipants
	}

	professorID := auth.ClaimSub(claims)
	slug := newSlug()
	room := &Room{
		ID:              newID(),
		Slug:            slug,
		OwnerID:         professorID,
		Status:          StatusWaiting,
		MaxParticipants: req.MaxParticipants,
		CreatedAt:       time.Now().UTC(),
	}

	if err := h.store.CreateRoom(r.Context(), room); err != nil {
		log.Printf("room: CreateRoom: %v", err)
		writeError(w, http.StatusInternalServerError, "erro ao criar sala")
		return
	}

	writeJSON(w, http.StatusCreated, CreateRoomResponse{
		RoomID:    room.ID,
		Slug:      room.Slug,
		Link:      buildLink(h.baseURL, room.Slug),
		Status:    room.Status,
		CreatedAt: room.CreatedAt.Format(time.RFC3339),
	})
}

// ── GET /rooms/{roomId}/link ──────────────────────────────────────────────────

func (h *Handler) getLink(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok || auth.ClaimRole(claims) != auth.RoleProfessor {
		writeError(w, http.StatusForbidden, "apenas professores podem acessar o link")
		return
	}

	roomID := r.PathValue("roomId")
	room, err := h.store.GetRoomByID(r.Context(), roomID)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			writeError(w, http.StatusNotFound, "sala não encontrada")
			return
		}
		writeError(w, http.StatusInternalServerError, "erro ao buscar sala")
		return
	}

	// Verifica propriedade da sala.
	if room.OwnerID != auth.ClaimSub(claims) {
		writeError(w, http.StatusForbidden, "você não é o dono desta sala")
		return
	}

	writeJSON(w, http.StatusOK, LinkResponse{
		RoomID: room.ID,
		Link:   buildLink(h.baseURL, room.Slug),
	})
}

// ── POST /rooms/{roomId}/join ─────────────────────────────────────────────────

func (h *Handler) joinRoom(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("roomId")

	var req JoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "corpo da requisição inválido")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.StudentID = strings.TrimSpace(req.StudentID)
	if req.Name == "" || req.StudentID == "" {
		writeError(w, http.StatusBadRequest, "name e student_id são obrigatórios")
		return
	}

	// 1. Tenta buscar por ID (UUID); se não encontrar, busca por Slug (usado no link público de convite)
	room, err := h.store.GetRoomByID(r.Context(), roomID)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			room, err = h.store.GetRoomBySlug(r.Context(), roomID)
		}
		if err != nil {
			if errors.Is(err, ErrRoomNotFound) {
				writeError(w, http.StatusNotFound, "sala não encontrada")
				return
			}
			writeError(w, http.StatusInternalServerError, "erro ao buscar sala")
			return
		}
	}

	if room.Status == StatusClosed {
		writeError(w, http.StatusConflict, "sala já encerrada")
		return
	}

	count, err := h.store.CountParticipants(r.Context(), room.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "erro ao verificar participantes")
		return
	}
	if count >= room.MaxParticipants {
		writeError(w, http.StatusTooManyRequests, "sala cheia")
		return
	}

	participantID := newID()
	participant := &Participant{
		ID:        participantID,
		RoomID:    room.ID,
		Name:      req.Name,
		StudentID: req.StudentID,
		JoinedAt:  time.Now().UTC(),
	}
	if err := h.store.AddParticipant(r.Context(), participant); err != nil {
		log.Printf("room: AddParticipant: %v", err)
		writeError(w, http.StatusInternalServerError, "erro ao registrar participante")
		return
	}

	// 2. Gera JWT do aluno com o ID canônico da sala (room.ID)
	claims := auth.StudentMapClaims(participantID, req.Name, req.StudentID, room.ID)
	tokenStr, err := auth.SignToken(claims)
	if err != nil {
		log.Printf("room: SignToken: %v", err)
		writeError(w, http.StatusInternalServerError, "erro ao gerar token")
		return
	}

	expUnix := int64(claims["exp"].(int64))
	expiresAt := time.Unix(expUnix, 0).UTC().Format(time.RFC3339)

	wsBase := os.Getenv("WS_URL")
	if wsBase == "" {
		wsBase = "ws://localhost:8080"
	}
	wsBase = strings.TrimRight(wsBase, "/")
	wsURL := fmt.Sprintf("%s/ws/rooms/%s/signal", wsBase, room.ID)

	writeJSON(w, http.StatusOK, JoinResponse{
		Token:         tokenStr,
		ExpiresAt:     expiresAt,
		ParticipantID: participantID,
		RoomStatus:    room.Status,
		RoomID:        room.ID,
		WsURL:         wsURL,
		IceServers:    []IceServer{{URLs: []string{"stun:stun.l.google.com:19302"}}},
	})
}

// ── POST /rooms/{roomId}/close ────────────────────────────────────────────────

func (h *Handler) closeRoom(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok || auth.ClaimRole(claims) != auth.RoleProfessor {
		writeError(w, http.StatusForbidden, "apenas professores podem encerrar salas")
		return
	}

	roomID := r.PathValue("roomId")
	room, err := h.store.GetRoomByID(r.Context(), roomID)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			writeError(w, http.StatusNotFound, "sala não encontrada")
			return
		}
		writeError(w, http.StatusInternalServerError, "erro ao buscar sala")
		return
	}

	if room.OwnerID != auth.ClaimSub(claims) {
		writeError(w, http.StatusForbidden, "você não é o dono desta sala")
		return
	}

	if room.Status == StatusClosed {
		writeError(w, http.StatusConflict, "sala já está encerrada")
		return
	}

	now := time.Now().UTC()
	if err := h.store.UpdateRoomStatus(r.Context(), roomID, StatusClosed, &now); err != nil {
		log.Printf("room: UpdateRoomStatus: %v", err)
		writeError(w, http.StatusInternalServerError, "erro ao encerrar sala")
		return
	}

	writeJSON(w, http.StatusOK, CloseResponse{
		Status:   StatusClosed,
		ClosedAt: now.Format(time.RFC3339),
	})
}

// ── helpers ───────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("room: writeJSON: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
