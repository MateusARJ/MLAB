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
	store           Store
	baseURL         string // ex: https://screenshare.example.com
	fileStore       *FileStore
	fileBroadcaster FileBroadcasterFunc
}

func getWebPort() string {
	if p := os.Getenv("WEB_PORT"); p != "" {
		return p
	}
	return "5173"
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
		webPort := getWebPort()
		ip := getOutboundIP()
		if ip != "" && ip != "localhost" && ip != "127.0.0.1" {
			base = fmt.Sprintf("http://%s:%s", ip, webPort)
		} else {
			base = fmt.Sprintf("http://localhost:%s", webPort)
		}
	}
	return &Handler{
		store:     store,
		baseURL:   base,
		fileStore: newFileStore(),
	}
}

// SetFileBroadcaster define a função de notificação WebSocket quando um arquivo é enviado.
func (h *Handler) SetFileBroadcaster(fn FileBroadcasterFunc) {
	h.fileBroadcaster = fn
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
	webPort := getWebPort()
	if r != nil && r.Host != "" && !strings.HasPrefix(r.Host, "localhost") && !strings.HasPrefix(r.Host, "127.0.0.1") {
		hostOnly := r.Host
		if idx := strings.Index(hostOnly, ":"); idx != -1 {
			hostOnly = hostOnly[:idx]
		}
		proto := "http"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			proto = "https"
		}
		return fmt.Sprintf("%s://%s:%s", proto, hostOnly, webPort)
	}
	ip := getOutboundIP()
	if ip != "" && ip != "127.0.0.1" && ip != "localhost" {
		return fmt.Sprintf("http://%s:%s", ip, webPort)
	}
	return fmt.Sprintf("http://localhost:%s", webPort)
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
	mux.HandleFunc("POST /rooms/{roomName}/{profName}/join", h.joinRoomByPath)
	mux.HandleFunc("POST /rooms/{roomId}/join", h.joinRoom)
	mux.HandleFunc("GET /rooms/{roomId}/files", h.listFiles)
	mux.HandleFunc("GET /rooms/{roomId}/files/{fileId}/download", h.downloadFile)
}

// RegisterProtectedRoutes registra os endpoints que exigem JWT de professor,
// aplicando o middleware fornecido em cada rota individualmente.
func (h *Handler) RegisterProtectedRoutes(mux *http.ServeMux, mw func(http.Handler) http.Handler) {
	mux.Handle("POST /rooms", mw(http.HandlerFunc(h.createRoom)))
	mux.Handle("GET /rooms/{roomId}/link", mw(http.HandlerFunc(h.getLink)))
	mux.Handle("POST /rooms/{roomId}/close", mw(http.HandlerFunc(h.closeRoom)))
	mux.Handle("POST /rooms/{roomId}/files", mw(http.HandlerFunc(h.uploadFile)))
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

	// Extrai e normaliza o título da sala (ex: "Algoritmos - Turma 04" -> "algoritmos-turma-04")
	req.Title = strings.TrimSpace(req.Title)
	roomSlug := slugify(req.Title)
	if roomSlug == "" {
		roomSlug = "sala"
	}

	// Extrai e normaliza o nome do professor (request > claims["name"] > claims["email"])
	profName := strings.TrimSpace(req.ProfessorName)
	if profName == "" {
		if nameClaim, ok := claims["name"].(string); ok && strings.TrimSpace(nameClaim) != "" {
			profName = strings.TrimSpace(nameClaim)
		} else if emailClaim, ok := claims["email"].(string); ok && strings.TrimSpace(emailClaim) != "" {
			profName = slugFromEmail(emailClaim)
		}
	}
	profSlug := slugify(profName)
	if profSlug == "" {
		profSlug = "professor"
	}

	// Slug composto no padrão: <nome-da-sala>/<nome-do-professor>
	slug := fmt.Sprintf("%s/%s", roomSlug, profSlug)

	// Se o professor já possui uma sala criada, reutiliza o registro, atualiza títulos e reativa a sala
	var room *Room
	existing, err := h.store.GetRoomByOwnerID(r.Context(), professorID)
	if err == nil && existing != nil {
		room = existing
		room.Title = req.Title
		room.ProfessorName = profName
		room.RoomSlug = roomSlug
		room.ProfessorSlug = profSlug
		room.Slug = slug
		room.Status = StatusWaiting
		room.ClosedAt = nil
		_ = h.store.UpdateRoomStatus(r.Context(), room.ID, StatusWaiting, nil)
	} else {
		room = &Room{
			ID:              newID(),
			Slug:            slug,
			Title:           req.Title,
			ProfessorName:   profName,
			RoomSlug:        roomSlug,
			ProfessorSlug:   profSlug,
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

// ── POST /rooms/{roomName}/{profName}/join & POST /rooms/{roomId}/join ────────

func (h *Handler) joinRoomByPath(w http.ResponseWriter, r *http.Request) {
	roomName := r.PathValue("roomName")
	profName := r.PathValue("profName")
	compositeSlug := fmt.Sprintf("%s/%s", roomName, profName)
	h.handleJoin(w, r, compositeSlug)
}

func (h *Handler) joinRoom(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("roomId")
	h.handleJoin(w, r, roomID)
}

func (h *Handler) handleJoin(w http.ResponseWriter, r *http.Request, identifier string) {
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
	room, err := h.store.GetRoomByID(r.Context(), identifier)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			room, err = h.store.GetRoomBySlug(r.Context(), identifier)
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
