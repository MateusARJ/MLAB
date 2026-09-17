package room

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
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
func NewHandler(store Store) *Handler {
	base := os.Getenv("NGROK_URL")
	if base == "" {
		base = os.Getenv("PUBLIC_URL")
	}
	if base == "" {
		base = os.Getenv("BASE_URL")
	}
	if base == "" {
		ip := getOutboundIP()
		if ip != "" && ip != "localhost" && ip != "127.0.0.1" {
			base = fmt.Sprintf("http://%s:3000", ip)
		} else {
			base = "http://localhost:3000"
		}
	}
	return &Handler{store: store, baseURL: base}
}

// getOutboundIP descobre o endereço IP de saída da interface de rede primária.
func getOutboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "localhost"
	}
	defer conn.Close()
	localAddr, ok := conn.LocalAddr().(*net.UDPAddr)
	if !ok {
		return "localhost"
	}
	return localAddr.IP.String()
}

// resolveBaseURL resolve a URL base a ser apresentada no link da sala (ngrok > PUBLIC_URL > BASE_URL > IP de rede > localhost).
func (h *Handler) resolveBaseURL(r *http.Request) string {
	if ngrok := os.Getenv("NGROK_URL"); ngrok != "" {
		return strings.TrimRight(ngrok, "/")
	}
	if pub := os.Getenv("PUBLIC_URL"); pub != "" {
		return strings.TrimRight(pub, "/")
	}
	if base := os.Getenv("BASE_URL"); base != "" {
		return strings.TrimRight(base, "/")
	}
	if r != nil && r.Host != "" && !strings.HasPrefix(r.Host, "localhost") && !strings.HasPrefix(r.Host, "127.0.0.1") {
		hostOnly := r.Host
		if idx := strings.Index(hostOnly, ":"); idx != -1 {
			hostOnly = hostOnly[:idx]
		}
		proto := "http"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			proto = "https"
		}
		return fmt.Sprintf("%s://%s:3000", proto, hostOnly)
	}
	ip := getOutboundIP()
	if ip != "" && ip != "127.0.0.1" && ip != "localhost" {
		return fmt.Sprintf("http://%s:3000", ip)
	}
	return "http://localhost:3000"
}

// resolveWsURL resolve a URL do WebSocket para sinalização com base no host requisitado ou variáveis de ambiente.
func (h *Handler) resolveWsURL(r *http.Request, roomID string) string {
	if ngrok := os.Getenv("NGROK_URL"); ngrok != "" {
		base := strings.TrimRight(ngrok, "/")
		base = strings.Replace(base, "http://", "ws://", 1)
		base = strings.Replace(base, "https://", "wss://", 1)
		return fmt.Sprintf("%s/ws/rooms/%s/signal", base, roomID)
	}
	if wsEnv := os.Getenv("WS_URL"); wsEnv != "" {
		return fmt.Sprintf("%s/ws/rooms/%s/signal", strings.TrimRight(wsEnv, "/"), roomID)
	}
	if pub := os.Getenv("PUBLIC_URL"); pub != "" {
		base := strings.TrimRight(pub, "/")
		base = strings.Replace(base, "http://", "ws://", 1)
		base = strings.Replace(base, "https://", "wss://", 1)
		return fmt.Sprintf("%s/ws/rooms/%s/signal", base, roomID)
	}
	if r != nil && r.Host != "" {
		scheme := "ws"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			scheme = "wss"
		}
		return fmt.Sprintf("%s://%s/ws/rooms/%s/signal", scheme, r.Host, roomID)
	}
	ip := getOutboundIP()
	if ip != "" && ip != "127.0.0.1" && ip != "localhost" {
		return fmt.Sprintf("ws://%s:8080/ws/rooms/%s/signal", ip, roomID)
	}
	return fmt.Sprintf("ws://localhost:8080/ws/rooms/%s/signal", roomID)
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

	// Gera slug fixo baseado no login/email do professor (ex: professor@screenshare.local -> "professor")
	email, _ := claims["email"].(string)
	slug := slugFromEmail(email)

	// Se o professor já possui uma sala criada, reutiliza o slug fixo e reativa a sala
	var room *Room
	existing, err := h.store.GetRoomByOwnerID(r.Context(), professorID)
	if err == nil && existing != nil {
		room = existing
		room.Status = StatusWaiting
		room.ClosedAt = nil
		_ = h.store.UpdateRoomStatus(r.Context(), room.ID, StatusWaiting, nil)
	} else {
		room = &Room{
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
	}

	baseURL := h.resolveBaseURL(r)
	writeJSON(w, http.StatusCreated, CreateRoomResponse{
		RoomID:    room.ID,
		Slug:      room.Slug,
		Link:      buildLink(baseURL, room.Slug),
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

	baseURL := h.resolveBaseURL(r)
	writeJSON(w, http.StatusOK, LinkResponse{
		RoomID: room.ID,
		Link:   buildLink(baseURL, room.Slug),
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

	wsURL := h.resolveWsURL(r, room.ID)

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
