package signaling

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Tamanho máximo de mensagem WebSocket (64 KB).
	maxMessageSize = 64 * 1024

	// Prazos de read/write para evitar conexões zumbis.
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10 // deve ser menor que pongWait

	// CloseDuplicateSession é o close code enviado à conexão substituída por uma nova
	// conexão do mesmo participante, com o mesmo token (RN-04 — 001-screen-share-core).
	CloseDuplicateSession       = 4001
	closeDuplicateSessionReason = "Duplicate Session"

	// CloseStudentIDInUse é o close code enviado à conexão recusada porque outro aluno com a
	// mesma matrícula já está conectado na sala (RN-04, ADR 0010 — 027/RF-2703).
	CloseStudentIDInUse       = 4002
	closeStudentIDInUseReason = "Student ID In Use"
)

// Client representa um participante conectado via WebSocket.
// Cada Client pertence exatamente a um Hub.
type Client struct {
	hub           *Hub
	conn          *websocket.Conn
	send          chan []byte // mensagens de saída para este cliente
	participantID string
	roomID        string
	role          Role
	name          string
	studentID     string // matrícula do aluno (vazio para professor)
	handRaised    bool   // indica se o aluno está com a mão levantada
	handRaisedAt  time.Time
	keyframeLimit keyframeLimiter // limite de request-keyframe do aluno (002/S9); só o hub acessa
	closeOnce     sync.Once
	// sendMu serializa safeSend e closeWithCode: o hub, o handler (ice-servers) e o readPump enviam em goroutines
	// diferentes, e o envio nunca pode concorrer com close(send) (038/RF-3801). closed só muda sob sendMu.
	sendMu sync.Mutex
	closed bool
	// closeCode/closeReason são definidos por closeWithCode antes de fechar o canal send;
	// o writePump só os lê depois de observar o canal fechado. Código zero = frame vazio.
	closeCode   int
	closeReason string
}

// newClient cria um Client e inicia o writePump. O readPump só começa em startReading, depois de o hub processar o
// registro: assim nenhuma mensagem do cliente chega ao hub antes dele estar em clients (039/RF-3901).
func newClient(hub *Hub, conn *websocket.Conn, participantID, roomID, name, studentID string, role Role) *Client {
	c := &Client{
		hub:           hub,
		conn:          conn,
		send:          make(chan []byte, 256),
		participantID: participantID,
		roomID:        roomID,
		role:          role,
		name:          name,
		studentID:     studentID,
	}
	go c.writePump()
	return c
}

// startReading inicia o readPump. Deve ser chamado uma vez, depois de o hub receber o cliente por register
// (039/RF-3901). Cliente recusado no registro também lê: o readPump termina quando a conexão fecha e envia o unregister
// que o hub ignora.
func (c *Client) startReading() {
	go c.readPump()
}

// readPump lê mensagens do WebSocket e envia ao hub para processamento.
// Roda numa goroutine dedicada por cliente. Os envios ao hub não bloqueiam depois de a goroutine do hub terminar
// (041/RF-4103).
func (c *Client) readPump() {
	defer func() {
		c.hub.leave(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, rawMsg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {
				log.Printf("signaling: client %s read error: %v", c.participantID, err)
			}
			return
		}

		var msg WsMessage
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			c.sendError("INVALID_MESSAGE", "formato de mensagem inválido")
			continue
		}

		if !c.hub.deliver(&envelope{client: c, msg: msg}) {
			return
		}
	}
}

// writePump drena o canal send e escreve no WebSocket.
// Também envia pings periódicos para manter a conexão viva.
// Roda numa goroutine dedicada por cliente.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub fechou o canal. Envia o close code definido por closeWithCode, se houver.
				payload := []byte{}
				if c.closeCode != 0 {
					payload = websocket.FormatCloseMessage(c.closeCode, c.closeReason)
				}
				_ = c.conn.WriteMessage(websocket.CloseMessage, payload)
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("signaling: client %s write error: %v", c.participantID, err)
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// safeSend envia dados para o canal send de forma não-bloqueante. Depois do fechamento, descarta a mensagem e
// devolve false sem tocar no canal; o lock garante que o envio não concorre com close(send) (038/RF-3801).
func (c *Client) safeSend(data []byte) bool {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	if c.closed {
		return false
	}
	select {
	case c.send <- data:
		return true
	default:
		log.Printf("signaling: send buffer cheio para client %s, descartando mensagem", c.participantID)
		return false
	}
}

// sendJSON envia uma mensagem JSON ao cliente (não-bloqueante).
func (c *Client) sendJSON(msgType string, payload any) {
	c.safeSend(buildMsg(msgType, payload))
}

// sendError envia uma mensagem de erro ao cliente.
func (c *Client) sendError(code, message string) {
	c.sendJSON(TypeError, ErrorPayload{Code: code, Message: message})
}

// close fecha o canal send, encerrando o writePump de forma idempotente.
func (c *Client) close() {
	c.closeWithCode(0, "")
}

// closeWithCode fecha a conexão enviando o close code informado ao cliente.
// Só a primeira chamada (de close ou closeWithCode) tem efeito.
func (c *Client) closeWithCode(code int, reason string) {
	c.closeOnce.Do(func() {
		c.sendMu.Lock()
		defer c.sendMu.Unlock()
		c.closeCode = code
		c.closeReason = reason
		c.closed = true
		close(c.send)
	})
}
