//go:build smoke

// Harness do smoke de backend (004/T402). Sobe o servidor real (newServer) num httptest.Server e
// fornece clientes HTTP, WebSocket e WebRTC (Pion) que falam o protocolo como o desktop e o web.
//
//	go test -tags smoke -run TestSmoke -v -count=1 ./cmd/server/
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v3"
)

const (
	smokeHostKey      = "smoke-host-key"
	smokeFilesMaxCnt  = 3
	smokeUDPPortMin   = 52000
	smokeUDPPortMax   = 52100
	smokeValidStudent = "2025116TADS0001"
)

func TestMain(m *testing.M) {
	secret := make([]byte, 32)
	_, _ = rand.Read(secret)
	os.Setenv("JWT_SECRET", hex.EncodeToString(secret))
	os.Setenv("MLAB_HOST_KEY", smokeHostKey)
	os.Setenv("MLAB_ROOM_FILES_MAX_COUNT", fmt.Sprint(smokeFilesMaxCnt))
	if os.Getenv("MLAB_SMOKE_LOGS") != "1" {
		log.SetOutput(io.Discard)
	}
	os.Exit(m.Run())
}

// ── Servidor ────────────────────────────────────────────────────────────────

type smokeEnv struct {
	t   *testing.T
	srv *httptest.Server
}

func newSmokeEnv(t *testing.T) *smokeEnv {
	t.Helper()
	handler, err := newServer(serverConfig{UDPPortMin: smokeUDPPortMin, UDPPortMax: smokeUDPPortMax})
	if err != nil {
		t.Fatalf("newServer: %v", err)
	}
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return &smokeEnv{t: t, srv: srv}
}

func (e *smokeEnv) do(method, path, token string, body io.Reader, contentType string, header map[string]string) (int, []byte, http.Header) {
	e.t.Helper()
	req, err := http.NewRequest(method, e.srv.URL+path, body)
	if err != nil {
		e.t.Fatalf("NewRequest: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	for k, v := range header {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, data, resp.Header
}

func (e *smokeEnv) postJSON(path, token string, v any, header map[string]string) (int, []byte) {
	e.t.Helper()
	b, _ := json.Marshal(v)
	code, data, _ := e.do(http.MethodPost, path, token, bytes.NewReader(b), "application/json", header)
	return code, data
}

func mustDecode[T any](t *testing.T, data []byte) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(data, &v); err != nil {
		t.Fatalf("JSON inválido (%v): %s", err, data)
	}
	return v
}

// profSession abre uma sessão de professor com a chave de host do smoke.
func (e *smokeEnv) profSession(name string) string {
	e.t.Helper()
	code, data := e.postJSON("/auth/session", "", map[string]string{"name": name}, map[string]string{"X-MLab-Host-Key": smokeHostKey})
	if code != http.StatusOK {
		e.t.Fatalf("POST /auth/session: %d %s", code, data)
	}
	return mustDecode[struct {
		Token string `json:"token"`
	}](e.t, data).Token
}

type smokeRoom struct {
	ID   string `json:"room_id"`
	Slug string `json:"slug"`
}

func (e *smokeEnv) createRoom(profToken, title string) smokeRoom {
	e.t.Helper()
	code, data := e.postJSON("/rooms", profToken, map[string]any{"title": title, "max_participants": 50}, nil)
	if code != http.StatusCreated {
		e.t.Fatalf("POST /rooms: %d %s", code, data)
	}
	return mustDecode[smokeRoom](e.t, data)
}

type smokeJoin struct {
	Token         string `json:"token"`
	ParticipantID string `json:"participant_id"`
	RoomID        string `json:"room_id"`
}

func (e *smokeEnv) join(roomID, name, studentID string) (int, smokeJoin) {
	e.t.Helper()
	code, data := e.postJSON("/rooms/"+roomID+"/join", "", map[string]string{"name": name, "student_id": studentID}, nil)
	var j smokeJoin
	if code == http.StatusOK {
		j = mustDecode[smokeJoin](e.t, data)
	}
	return code, j
}

func (e *smokeEnv) mustJoin(roomID, name, studentID string) smokeJoin {
	e.t.Helper()
	code, j := e.join(roomID, name, studentID)
	if code != http.StatusOK {
		e.t.Fatalf("join %s: %d", name, code)
	}
	return j
}

func (e *smokeEnv) upload(roomID, profToken, name string, content []byte) (int, []byte) {
	e.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", name)
	_, _ = fw.Write(content)
	_ = mw.Close()
	code, data, _ := e.do(http.MethodPost, "/rooms/"+roomID+"/files", profToken, &buf, mw.FormDataContentType(), nil)
	return code, data
}

// ── WebSocket ───────────────────────────────────────────────────────────────

type wsMsg struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type wsClient struct {
	t        *testing.T
	name     string
	conn     *websocket.Conn
	msgs     chan wsMsg
	closed   chan struct{}
	closeErr atomic.Value // error
	writeMu  sync.Mutex
}

func (e *smokeEnv) wsURL(roomID, token string) string {
	return "ws" + strings.TrimPrefix(e.srv.URL, "http") + "/ws/rooms/" + roomID + "/signal?token=" + token
}

// dialWS abre o WebSocket de sinalização; header pode trazer Origin.
func (e *smokeEnv) dialWS(name, roomID, token string, header http.Header) (*wsClient, *http.Response, error) {
	conn, resp, err := websocket.DefaultDialer.Dial(e.wsURL(roomID, token), header)
	if err != nil {
		return nil, resp, err
	}
	c := &wsClient{t: e.t, name: name, conn: conn, msgs: make(chan wsMsg, 512), closed: make(chan struct{})}
	go func() {
		defer close(c.closed)
		for {
			var m wsMsg
			if err := conn.ReadJSON(&m); err != nil {
				c.closeErr.Store(err)
				return
			}
			c.msgs <- m
		}
	}()
	e.t.Cleanup(func() { _ = conn.Close() })
	return c, resp, nil
}

func (e *smokeEnv) mustWS(name, roomID, token string) *wsClient {
	e.t.Helper()
	c, resp, err := e.dialWS(name, roomID, token, nil)
	if err != nil {
		code := 0
		if resp != nil {
			code = resp.StatusCode
		}
		e.t.Fatalf("WS %s: %v (HTTP %d)", name, err, code)
	}
	return c
}

func (c *wsClient) send(msgType string, payload any) {
	c.t.Helper()
	m := map[string]any{"type": msgType}
	if payload != nil {
		m["payload"] = payload
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if err := c.conn.WriteJSON(m); err != nil {
		c.t.Fatalf("%s: envio de %s falhou: %v", c.name, msgType, err)
	}
}

// expect espera a próxima mensagem do tipo pedido (descartando as demais) e a devolve.
func (c *wsClient) expect(msgType string, timeout time.Duration) wsMsg {
	c.t.Helper()
	m, ok := c.waitFor(func(m wsMsg) bool { return m.Type == msgType }, timeout)
	if !ok {
		c.t.Fatalf("%s: não recebeu %q em %s", c.name, msgType, timeout)
	}
	return m
}

// waitFor devolve a primeira mensagem que satisfaz pred dentro do prazo.
func (c *wsClient) waitFor(pred func(wsMsg) bool, timeout time.Duration) (wsMsg, bool) {
	deadline := time.After(timeout)
	for {
		select {
		case m := <-c.msgs:
			if pred(m) {
				return m, true
			}
		case <-c.closed:
			// esvazia o que já chegou antes do fechamento
			for {
				select {
				case m := <-c.msgs:
					if pred(m) {
						return m, true
					}
				default:
					return wsMsg{}, false
				}
			}
		case <-deadline:
			return wsMsg{}, false
		}
	}
}

// expectNone garante que nenhuma mensagem do tipo chega no período.
func (c *wsClient) expectNone(msgType string, d time.Duration) {
	c.t.Helper()
	if m, ok := c.waitFor(func(m wsMsg) bool { return m.Type == msgType }, d); ok {
		c.t.Fatalf("%s: recebeu %q inesperado: %s", c.name, msgType, m.Payload)
	}
}

// drain descarta mensagens pendentes.
func (c *wsClient) drain() {
	for {
		select {
		case <-c.msgs:
		default:
			return
		}
	}
}

// waitClosed espera o servidor fechar a conexão e devolve o close code (-1 se não houve close frame).
func (c *wsClient) waitClosed(timeout time.Duration) (int, bool) {
	select {
	case <-c.closed:
	case <-time.After(timeout):
		return 0, false
	}
	err, _ := c.closeErr.Load().(error)
	var ce *websocket.CloseError
	if errors.As(err, &ce) {
		return ce.Code, true
	}
	return -1, true
}

func (c *wsClient) isOpen() bool {
	select {
	case <-c.closed:
		return false
	default:
		return true
	}
}

func payloadField[T any](t *testing.T, m wsMsg) T {
	t.Helper()
	return mustDecode[T](t, m.Payload)
}

// ── WebRTC ──────────────────────────────────────────────────────────────────

type smokePublisher struct {
	pc   *webrtc.PeerConnection
	stop chan struct{}
	done chan struct{}
}

// startPublisher conecta o professor pelo WS (publish-request → offer → answer) e envia VP8 sintético a 30 FPS.
func startPublisher(t *testing.T, prof *wsClient) *smokePublisher {
	t.Helper()
	prof.send("publish-request", nil)
	prof.expect("publish-approved", 5*time.Second)

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("publisher PC: %v", err)
	}
	track, err := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8, ClockRate: 90000}, "video", "smoke")
	if err != nil {
		t.Fatalf("track: %v", err)
	}
	sender, err := pc.AddTrack(track)
	if err != nil {
		t.Fatalf("AddTrack: %v", err)
	}
	go func() {
		for {
			if _, _, e := sender.ReadRTCP(); e != nil {
				return
			}
		}
	}()
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatalf("CreateOffer: %v", err)
	}
	g := webrtc.GatheringCompletePromise(pc)
	_ = pc.SetLocalDescription(offer)
	<-g
	prof.send("offer", map[string]string{"sdp": pc.LocalDescription().SDP})
	ans := payloadField[struct {
		SDP string `json:"sdp"`
	}](t, prof.expect("answer", 10*time.Second))
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: ans.SDP}); err != nil {
		t.Fatalf("SetRemoteDescription publisher: %v", err)
	}

	p := &smokePublisher{pc: pc, stop: make(chan struct{}), done: make(chan struct{})}
	go func() {
		defer close(p.done)
		ticker := time.NewTicker(time.Second / 30)
		defer ticker.Stop()
		var seq uint16
		var ts uint32
		payload := make([]byte, 900)
		for {
			select {
			case <-p.stop:
				return
			case <-ticker.C:
			}
			for i := 0; i < 2; i++ {
				payload[0] = 0x00
				if i == 0 {
					payload[0] = 0x10
				}
				binary.BigEndian.PutUint64(payload[1:9], uint64(time.Now().UnixNano()))
				_ = track.WriteRTP(&rtp.Packet{Header: rtp.Header{Version: 2, PayloadType: 96, SequenceNumber: seq, Timestamp: ts, Marker: i == 1}, Payload: payload})
				seq++
			}
			ts += 3000
		}
	}()
	t.Cleanup(p.close)
	return p
}

func (p *smokePublisher) close() {
	select {
	case <-p.stop:
	default:
		close(p.stop)
		<-p.done
		_ = p.pc.Close()
	}
}

// subscribe faz o aluno assinar pelo WS (subscribe-request → offer → answer) e conta pacotes RTP recebidos.
func subscribe(t *testing.T, student *wsClient) (*webrtc.PeerConnection, *atomic.Int64) {
	t.Helper()
	student.send("subscribe-request", map[string]string{})
	off := payloadField[struct {
		SDP string `json:"sdp"`
	}](t, student.expect("offer", 10*time.Second))

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("subscriber PC: %v", err)
	}
	t.Cleanup(func() { _ = pc.Close() })
	var packets atomic.Int64
	pc.OnTrack(func(tr *webrtc.TrackRemote, rcv *webrtc.RTPReceiver) {
		go func() {
			for {
				if _, _, e := rcv.ReadRTCP(); e != nil {
					return
				}
			}
		}()
		for {
			if _, _, e := tr.ReadRTP(); e != nil {
				return
			}
			packets.Add(1)
		}
	})
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: off.SDP}); err != nil {
		t.Fatalf("SetRemoteDescription aluno: %v", err)
	}
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		t.Fatalf("CreateAnswer: %v", err)
	}
	g := webrtc.GatheringCompletePromise(pc)
	_ = pc.SetLocalDescription(answer)
	<-g
	student.send("answer", map[string]string{"sdp": pc.LocalDescription().SDP})
	return pc, &packets
}

func waitCount(n *atomic.Int64, want int64, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if n.Load() >= want {
			return true
		}
		time.Sleep(50 * time.Millisecond)
	}
	return n.Load() >= want
}
