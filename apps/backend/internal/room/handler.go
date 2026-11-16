package room

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
)

const defaultMaxParticipants = 50

// studentIDRegex valida que a matrícula contém números e até 4 letras da sigla do curso.
var studentIDRegex = regexp.MustCompile(`^[0-9]+[A-Za-z]{1,4}[0-9]+$`)

// RoomCloseBroadcasterFunc define a assinatura da função de broadcast para encerramento de sala.
type RoomCloseBroadcasterFunc func(roomID string)

// StudentConnectedFunc informa se há aluno conectado por WebSocket na sala com a matrícula
// informada (RN-04, ADR 0010 — 027/RF-2701).
type StudentConnectedFunc func(roomID, studentID string) bool

// errStudentIDInUse é a mensagem do 409 do join para matrícula já conectada (027/C-2703).
const errStudentIDInUse = "Esta matrícula já está conectada nesta transmissão."

// Handler agrupa os endpoints HTTP do módulo room.
type Handler struct {
	store                Store
	baseURL              string // ex: https://mlab.example.com
	fileStore            *FileStore
	fileBroadcaster      FileBroadcasterFunc
	roomCloseBroadcaster RoomCloseBroadcasterFunc
	studentConnected     StudentConnectedFunc
}

func getWebPort() string {
	if p := os.Getenv("WEB_PORT"); p != "" {
		return p
	}
	if os.Getenv("MLAB_DEV_MONOREPO") == "1" {
		return "5173"
	}
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
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

// SetRoomCloseBroadcaster define a função de notificação WebSocket quando a sala é encerrada.
func (h *Handler) SetRoomCloseBroadcaster(fn RoomCloseBroadcasterFunc) {
	h.roomCloseBroadcaster = fn
}

// SetStudentConnectedChecker define a consulta ao hub usada pelo join para recusar a matrícula
// já conectada na sala (027/RF-2701).
func (h *Handler) SetStudentConnectedChecker(fn StudentConnectedFunc) {
	h.studentConnected = fn
}

// mdnsClaim e mdnsHost escolhem/anunciam e leem o nome mDNS deste backend; mdnsStop encerra o anúncio no
// encerramento pelo hub. Variáveis para os testes do handler não usarem a rede.
var (
	mdnsClaim = ClaimMDNSName
	mdnsHost  = CurrentMDNSHost
	mdnsStop  = StopMDNSServer
)

// getOutboundIP descobre o endereço IP de saída da interface de rede primária física.
func getOutboundIP() string {
	return GetPrimaryPhysicalIP()
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
	mux.HandleFunc("GET /rooms/active", h.getActiveRoom)
	mux.HandleFunc("GET /rooms/{roomName}/{profName}/info", h.getRoomInfoByPath)
	mux.HandleFunc("GET /rooms/{roomId}/info", h.getRoomInfo)
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

	// Extrai e normaliza o nome do professor (request > claims["name"] > "professor"; ADR 0009)
	profName := strings.TrimSpace(req.ProfessorName)
	if profName == "" {
		if nameClaim, ok := claims["name"].(string); ok {
			profName = strings.TrimSpace(nameClaim)
		}
	}
	profSlug := slugify(profName)
	if profSlug == "" {
		profSlug = "professor"
	}

	// Invalida e remove permanentemente transmissões anteriores deste professor para que links passados não funcionem
	if existing, err := h.store.GetRoomByOwnerID(r.Context(), professorID); err == nil && existing != nil {
		_ = h.store.UpdateRoomStatus(r.Context(), existing.ID, StatusClosed, nil)
		_ = h.store.DeleteRoom(r.Context(), existing.ID)
		h.ReleaseRoomFiles(existing.ID)
		StopMDNSServer()
	}

	slug := fmt.Sprintf("%s/%s", roomSlug, profSlug)

	room := &Room{
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

	// O nome mDNS é escolhido antes de montar a resposta, para os links usarem o nome anunciado de fato
	// (012, RF-123). Falha só gera log: a sala existe e o link por IP funciona (RNF-123).
	lanIP := getOutboundIP()
	if lanIP != "" && lanIP != "127.0.0.1" && lanIP != "localhost" {
		if _, err := mdnsClaim(lanIP); err != nil {
			log.Printf("[mDNS] Aviso: falha ao registrar anúncio mDNS: %v", err)
		}
	}

	links := h.buildRoomLinks(r, room)
	writeJSON(w, http.StatusCreated, CreateRoomResponse{
		RoomID:        room.ID,
		Slug:          room.Slug,
		Link:          links.Link,
		IPLink:        links.IPLink,
		MDNSLink:      links.MDNSLink,
		ShortIPLink:   links.ShortIPLink,
		ShortMDNSLink: links.ShortMDNSLink,
		Status:        room.Status,
		CreatedAt:     room.CreatedAt.Format(time.RFC3339),
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

	links := h.buildRoomLinks(r, room)
	writeJSON(w, http.StatusOK, LinkResponse{
		RoomID:        room.ID,
		Link:          links.Link,
		IPLink:        links.IPLink,
		MDNSLink:      links.MDNSLink,
		ShortIPLink:   links.ShortIPLink,
		ShortMDNSLink: links.ShortMDNSLink,
	})
}

// ── GET /rooms/{roomName}/{profName}/info & GET /rooms/{roomId}/info ──────────

func (h *Handler) getRoomInfoByPath(w http.ResponseWriter, r *http.Request) {
	roomName := r.PathValue("roomName")
	profName := r.PathValue("profName")
	compositeSlug := fmt.Sprintf("%s/%s", roomName, profName)
	h.handleGetRoomInfo(w, r, compositeSlug)
}

func (h *Handler) getRoomInfo(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("roomId")
	h.handleGetRoomInfo(w, r, roomID)
}

func (h *Handler) handleGetRoomInfo(w http.ResponseWriter, r *http.Request, identifier string) {
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
		writeError(w, http.StatusNotFound, "esta transmissão já foi encerrada")
		return
	}

	writeJSON(w, http.StatusOK, RoomInfoResponse{
		RoomID:        room.ID,
		Slug:          room.Slug,
		Title:         room.Title,
		ProfessorName: room.ProfessorName,
		Status:        room.Status,
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
	if !studentIDRegex.MatchString(req.StudentID) {
		writeError(w, http.StatusBadRequest, "matrícula inválida: deve conter números e até 4 letras da sigla do curso (ex: 2025116TADS0000)")
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

	// Sala encerrada recusa novas entradas com 409 (RN-08, contracts/room-api.md — 029/RF-2901).
	if room.Status == StatusClosed {
		writeError(w, http.StatusConflict, "esta transmissão já foi encerrada e o link não está mais disponível")
		return
	}

	// Sessão única (RN-04, ADR 0010): a matrícula com WebSocket ativo na sala recusa a nova
	// entrada, antes da regra de sala cheia (027/RF-2701, RF-2702).
	if h.studentConnected != nil && h.studentConnected(room.ID, req.StudentID) {
		writeError(w, http.StatusConflict, errStudentIDInUse)
		return
	}

	count, err := h.store.CountParticipants(r.Context(), room.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "erro ao verificar participantes")
		return
	}
	if count >= room.MaxParticipants {
		// A reentrada do mesmo aluno (mesma matrícula, já desconectado) substitui o registro
		// anterior e não ocupa vaga nova (RN-04).
		rejoining, err := h.store.HasStudent(r.Context(), room.ID, req.StudentID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "erro ao verificar participantes")
			return
		}
		if !rejoining {
			writeError(w, http.StatusTooManyRequests, "sala cheia")
			return
		}
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

	var iceServers []IceServer
	stunURL := os.Getenv("STUN_URL")
	if stunURL != "" {
		iceServers = []IceServer{{URLs: []string{stunURL}}}
	} else if IsInternetAvailable() {
		iceServers = []IceServer{{URLs: []string{"stun:stun.l.google.com:19302"}}}
	} else {
		iceServers = []IceServer{}
	}

	writeJSON(w, http.StatusOK, JoinResponse{
		Token:         tokenStr,
		ExpiresAt:     expiresAt,
		ParticipantID: participantID,
		RoomStatus:    room.Status,
		RoomID:        room.ID,
		WsURL:         wsURL,
		IceServers:    iceServers,
		ProfessorName: room.ProfessorName,
		RoomTitle:     room.Title,
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
	if h.roomCloseBroadcaster != nil {
		h.roomCloseBroadcaster(roomID)
	}
	_ = h.store.DeleteRoom(r.Context(), roomID)
	h.ReleaseRoomFiles(roomID)
	StopMDNSServer()

	writeJSON(w, http.StatusOK, CloseResponse{
		Status:   StatusClosed,
		ClosedAt: now.Format(time.RFC3339),
	})
}

// CloseRoomFromSession encerra no store a sala que o hub de sinalização encerrou (end-session ou timeout de
// reconexão do professor — RN-13, RF-18; 033/RF-3301), na mesma sequência da REST close: a sala é marcada
// `closed`, removida do store e o link passa a responder 404 (033/RF-3302).
//
// O hub também chama este listener depois de uma REST close, que já removeu a sala. Nesse caso só os arquivos são
// liberados: o anúncio mDNS fica intacto, porque pode já pertencer a uma sala criada depois (033/RNF-3301). Repetir a
// chamada não falha (033/RNF-3302).
func (h *Handler) CloseRoomFromSession(roomID string) {
	ctx := context.Background()
	if rm, err := h.store.GetRoomByID(ctx, roomID); err == nil && rm.Status != StatusClosed {
		now := time.Now().UTC()
		if err := h.store.UpdateRoomStatus(ctx, roomID, StatusClosed, &now); err != nil {
			log.Printf("room: CloseRoomFromSession: UpdateRoomStatus: %v", err)
		}
		_ = h.store.DeleteRoom(ctx, roomID)
		mdnsStop()
		log.Printf("room: sala %s encerrada pelo hub de sinalização", roomID)
	}
	h.ReleaseRoomFiles(roomID)
}

// SyncStatusFromSession registra no store o status da sessão que o hub de sinalização mudou (`publishing` ou
// `reconnecting` — RF-18; 035/RF-3501), para que `/info`, `/rooms/active` e o `join` reflitam a transmissão
// (035/RF-3502). Sala já encerrada ou removida é ignorada: o aviso tardio do hub não a reabre (035/RNF-3501).
func (h *Handler) SyncStatusFromSession(roomID string, status Status) {
	err := h.store.SetSessionStatus(context.Background(), roomID, status)
	if err != nil && !errors.Is(err, ErrRoomNotFound) && !errors.Is(err, ErrRoomClosed) {
		log.Printf("room: SyncStatusFromSession: sala %s status %s: %v", roomID, status, err)
	}
}

// ── GET /rooms/active ─────────────────────────────────────────────────────────

func (h *Handler) getActiveRoom(w http.ResponseWriter, r *http.Request) {
	room, err := h.store.GetActiveRoom(r.Context())
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			writeError(w, http.StatusNotFound, "nenhuma sala ativa no momento")
			return
		}
		writeError(w, http.StatusInternalServerError, "erro ao buscar sala ativa")
		return
	}

	links := h.buildRoomLinks(r, room)
	writeJSON(w, http.StatusOK, map[string]any{
		"room_id":         room.ID,
		"slug":            room.Slug,
		"title":           room.Title,
		"professor_name":  room.ProfessorName,
		"status":          room.Status,
		"link":            links.Link,
		"ip_link":         links.IPLink,
		"mdns_link":       links.MDNSLink,
		"short_ip_link":   links.ShortIPLink,
		"short_mdns_link": links.ShortMDNSLink,
	})
}

// ── helpers ───────────────────────────────────────────────────────────────────

type roomLinks struct {
	Link          string
	IPLink        string
	MDNSLink      string
	ShortIPLink   string
	ShortMDNSLink string
}

func (h *Handler) buildRoomLinks(r *http.Request, room *Room) roomLinks {
	webPort := getWebPort()
	proto := "http"
	if r != nil && (r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https") {
		proto = "https"
	}

	ip := getOutboundIP()
	if ip == "" || ip == "127.0.0.1" {
		ip = "localhost"
	}

	profSlug := room.ProfessorSlug
	if profSlug == "" {
		profSlug = slugify(room.ProfessorName)
	}
	if profSlug == "" {
		profSlug = "professor"
	}

	// Sem anúncio mDNS ativo não há link .local e o link padrão é o por IP (012, RF-126).
	ipBase := fmt.Sprintf("%s://%s:%s", proto, ip, webPort)
	mdnsBase := ""
	defaultLink := ipBase
	if host := mdnsHost(); host != "" {
		mdnsBase = fmt.Sprintf("%s://%s:%s", proto, host, webPort)
		defaultLink = mdnsBase
	}

	if ngrok := os.Getenv("NGROK_URL"); ngrok != "" {
		defaultLink = strings.TrimRight(ngrok, "/")
	} else if pub := os.Getenv("PUBLIC_URL"); pub != "" {
		defaultLink = strings.TrimRight(pub, "/")
	} else if base := os.Getenv("BASE_URL"); base != "" {
		defaultLink = strings.TrimRight(base, "/")
	}

	return roomLinks{
		Link:          defaultLink,
		IPLink:        ipBase,
		MDNSLink:      mdnsBase,
		ShortIPLink:   ipBase,
		ShortMDNSLink: mdnsBase,
	}
}

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
