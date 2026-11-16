package signaling

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
	"github.com/MateusARJ/MLAB/apps/backend/internal/room"
	"github.com/gorilla/websocket"
)

// Handler gerencia o ciclo de vida dos Hubs e faz upgrade HTTP → WebSocket.
type Handler struct {
	upgrader  websocket.Upgrader
	roomStore room.Store
	sfu       SFU // nil até T011

	mu   sync.RWMutex
	hubs map[string]*Hub // roomID → Hub

	// roomClosedListener é notificado quando um hub encerra a sala pelo WebSocket.
	// Configurado uma única vez na inicialização, antes de servir requisições.
	roomClosedListener func(roomID string)

	// roomStatusListener é notificado quando o status da sessão de um hub muda para `publishing` ou `reconnecting`
	// (035/RF-3501). Configurado uma única vez na inicialização, antes de servir requisições.
	roomStatusListener func(roomID string, status SessionStatus)
}

// NewHandler cria um Handler de sinalização.
// sfu pode ser nil — o hub opera em modo stub (chat + sinalização sem mídia).
func NewHandler(roomStore room.Store, sfu SFU) *Handler {
	return &Handler{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			// Allowlist de origem (002-security-hardening/S6): mesma regra do CORS.
			CheckOrigin: func(r *http.Request) bool {
				return room.IsAllowedOrigin(r.Header.Get("Origin"), r)
			},
		},
		roomStore: roomStore,
		sfu:       sfu,
		hubs:      make(map[string]*Hub),
	}
}

// RegisterRoutes registra o endpoint WebSocket no mux.
// Rota: GET /ws/rooms/{roomId}/signal?token=<jwt>
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /ws/rooms/{roomId}/signal", h.serveWS)
}

// serveWS valida o JWT, faz upgrade para WebSocket, cria/obtém o Hub e registra o cliente.
func (h *Handler) serveWS(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("roomId")

	// 1. Valida JWT via query param (Authorization header não funciona no WS handshake).
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "token ausente", http.StatusUnauthorized)
		return
	}
	claims, err := auth.ParseToken(token)
	if err != nil {
		http.Error(w, "token inválido", http.StatusUnauthorized)
		return
	}

	// 2. Verifica membership: o token deve ser para esta sala (alunos) ou professor.
	role := auth.ClaimRole(claims)
	participantID := auth.ClaimSub(claims)

	if role == auth.RoleAluno {
		claimRoom := auth.ClaimRoomID(claims)
		if claimRoom != roomID {
			http.Error(w, "token não pertence a esta sala", http.StatusForbidden)
			return
		}
	}

	// 3. Verifica se a sala existe.
	rm, err := h.roomStore.GetRoomByID(r.Context(), roomID)
	if err != nil {
		http.Error(w, "sala não encontrada", http.StatusNotFound)
		return
	}
	if rm.Status == room.StatusClosed {
		http.Error(w, "sala encerrada", http.StatusGone)
		return
	}

	// 4. Extrai nome do participante e matrícula (student_id) para alunos.
	name := extractName(claims, role)
	studentID := ""
	if role == auth.RoleAluno {
		if sid, ok := claims["student_id"].(string); ok {
			studentID = sid
		}
	}

	// 5. Obtém ou cria o Hub da sala antes do upgrade: sala com a sessão encerrada, ou que saiu do store depois da
	// consulta acima, não ganha hub novo e recebe 410 (037/RF-3704).
	hub, ok := h.getOrCreateHub(roomID)
	if !ok {
		http.Error(w, "sala encerrada", http.StatusGone)
		return
	}

	// 6. Upgrade para WebSocket.
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("signaling: upgrade error para room %s: %v", roomID, err)
		return
	}

	// 7. Cria o cliente e o registra no hub. A leitura só começa depois do register: o envio é síncrono e o hub
	// processa o registro antes de ler inbound de novo, então a primeira mensagem do cliente (publish-request,
	// subscribe-request, end-session) nunca chega antes do registro (039/RF-3901).
	client := newClient(hub, conn, participantID, roomID, name, studentID, Role(role))
	hub.register <- client
	client.startReading()

	// 8. Envia configuração de ICE servers ao novo cliente.
	client.sendJSON(TypeIceServers, h.buildIceServers(participantID))

	log.Printf("signaling: %s %s conectado à sala %s", role, participantID, roomID)
}

// getOrCreateHub retorna o Hub da sala, criando-o se preciso. ok=false quando a sala não aceita mais conexões:
//   - o hub da sala está encerrado. Ele fica no mapa como marcador e não é recriado, pois IDs de sala não se
//     repetem (037/RF-3702);
//   - não há hub e a sala está ausente ou closed no store. A consulta roda sob h.mu: a REST close marca a sala
//     closed antes de procurar o hub (GetHub, também sob h.mu), então ou a sala é vista closed aqui, ou o hub criado
//     é encontrado e encerrado (037/RF-3703). Ordem de locks: h.mu e depois o store, nunca o inverso (RNF-3701).
func (h *Handler) getOrCreateHub(roomID string) (*Hub, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if hub, ok := h.hubs[roomID]; ok {
		if hub.isClosed() {
			return nil, false
		}
		return hub, true
	}

	if h.roomStore != nil {
		rm, err := h.roomStore.GetRoomByID(context.Background(), roomID)
		if err != nil || rm.Status == room.StatusClosed {
			return nil, false
		}
	}

	hub := newHubWithCallbacks(roomID, h.sfu, hubCallbacks{
		onClosed:        h.notifyRoomClosed,
		onStatusChanged: h.notifyRoomStatus,
	})
	h.hubs[roomID] = hub
	log.Printf("signaling: hub criado para sala %s", roomID)
	return hub, true
}

// SetRoomClosedListener registra quem deve ser avisado quando um hub encerra a sala
// (end-session ou timeout de reconexão). Deve ser chamado antes de servir requisições.
func (h *Handler) SetRoomClosedListener(fn func(roomID string)) {
	h.roomClosedListener = fn
}

func (h *Handler) notifyRoomClosed(roomID string) {
	if h.roomClosedListener != nil {
		h.roomClosedListener(roomID)
	}
}

// SetRoomStatusListener registra quem deve ser avisado quando o status da sessão de um hub muda para `publishing`
// ou `reconnecting` (035/RF-3501). Deve ser chamado antes de servir requisições.
func (h *Handler) SetRoomStatusListener(fn func(roomID string, status SessionStatus)) {
	h.roomStatusListener = fn
}

func (h *Handler) notifyRoomStatus(roomID string, status SessionStatus) {
	if h.roomStatusListener != nil {
		h.roomStatusListener(roomID, status)
	}
}

// GetHub retorna o Hub de uma sala (nil se não existir).
// Usado pelo handler REST de close para chamar BroadcastRoomClosed.
func (h *Handler) GetHub(roomID string) *Hub {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.hubs[roomID]
}

// HasConnectedStudent informa se há aluno conectado por WebSocket na sala com a matrícula
// informada (RN-04, ADR 0010). Usado pelo join para recusar a matrícula em uso (027/RF-2701).
func (h *Handler) HasConnectedStudent(roomID, studentID string) bool {
	hub := h.GetHub(roomID)
	return hub != nil && hub.HasConnectedStudent(studentID)
}

// OnTrackReady é invocado quando a primeira track de vídeo do professor fica pronta no SFU.
func (h *Handler) OnTrackReady(roomID string) {
	if hub := h.GetHub(roomID); hub != nil {
		hub.BroadcastStreamStarted()
	}
}

// ── ICE Servers / TURN credentials ───────────────────────────────────────────

// buildIceServers constrói a lista de ICE servers com credenciais TURN temporárias.
// Usa HMAC-SHA1 com TURN_SECRET (RFC 8489 time-limited credentials).
func (h *Handler) buildIceServers(participantID string) IceServersPayload {
	servers := []IceServer{}

	// STUN: se STUN_URL estiver explicitamente configurada, usa-a.
	// Se não, e houver internet externa, usa o STUN padrão do Google.
	// Se não houver internet (rede local offline), não adiciona STUN externo inalcançável.
	stunURL := os.Getenv("STUN_URL")
	if stunURL != "" {
		servers = append(servers, IceServer{URLs: []string{stunURL}})
	} else if room.IsInternetAvailable() {
		servers = append(servers, IceServer{URLs: []string{"stun:stun.l.google.com:19302"}})
	}

	// TURN (apenas se configurado).
	turnURL := os.Getenv("TURN_URL")
	turnSecret := os.Getenv("TURN_SECRET")
	if turnURL != "" && turnSecret != "" {
		username, credential := turnCredentials(participantID, turnSecret)
		servers = append(servers, IceServer{
			URLs:       []string{turnURL},
			Username:   username,
			Credential: credential,
		})
	}

	return IceServersPayload{IceServers: servers}
}

// turnCredentials gera credenciais TURN temporárias válidas por 24h.
// username = "<unix_expiry>:<participantID>"
// credential = base64(HMAC-SHA1(secret, username))
func turnCredentials(participantID, secret string) (username, credential string) {
	expiry := time.Now().Add(24 * time.Hour).Unix()
	username = fmt.Sprintf("%s:%s", strconv.FormatInt(expiry, 10), participantID)

	mac := hmac.New(sha1.New, []byte(secret))
	mac.Write([]byte(username))
	credential = base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// extractName obtém o nome do participante da claim "name" do JWT, ou "Participante" sem ela (ADR 0009).
func extractName(claims map[string]interface{}, role auth.Role) string {
	if n, ok := claims["name"].(string); ok && n != "" {
		return n
	}
	return "Participante"
}
