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
	closeOnce     sync.Once
}

// newClient cria um Client e inicia os pumps em goroutines separadas.
func newClient(hub *Hub, conn *websocket.Conn, participantID, roomID, name string, role Role) *Client {
	c := &Client{
		hub:           hub,
		conn:          conn,
		send:          make(chan []byte, 256),
		participantID: participantID,
		roomID:        roomID,
		role:          role,
		name:          name,
	}
	go c.writePump()
	go c.readPump()
	return c
}

// readPump lê mensagens do WebSocket e envia ao hub para processamento.
// Roda numa goroutine dedicada por cliente.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
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

		c.hub.inbound <- &envelope{client: c, msg: msg}
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
				// Hub fechou o canal.
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
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

// sendJSON envia uma mensagem JSON ao cliente (não-bloqueante).
func (c *Client) sendJSON(msgType string, payload any) {
	select {
	case c.send <- buildMsg(msgType, payload):
	default:
		log.Printf("signaling: send buffer cheio para client %s, descartando %s", c.participantID, msgType)
	}
}

// sendError envia uma mensagem de erro ao cliente.
func (c *Client) sendError(code, message string) {
	c.sendJSON(TypeError, ErrorPayload{Code: code, Message: message})
}

// close fecha o canal send, encerrando o writePump de forma idempotente.
func (c *Client) close() {
	c.closeOnce.Do(func() {
		close(c.send)
	})
}
