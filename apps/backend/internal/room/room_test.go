package room

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/screenshare/classroom/internal/auth"
)

// anuncioFalso é o nome mDNS "anunciado" nos testes do handler; vazio simula a falta de anúncio.
var anuncioFalso = "mlab.local"

// TestMain impede que o POST /rooms dos testes sonde a rede e ocupe a porta 5353: o claim e a leitura do nome usam
// anuncioFalso. Os testes de mDNS chamam ClaimMDNSName diretamente e não são afetados.
func TestMain(m *testing.M) {
	mdnsClaim = func(string) (string, error) {
		if anuncioFalso == "" {
			return "", errors.New("sem anúncio (teste)")
		}
		return anuncioFalso, nil
	}
	mdnsHost = func() string { return anuncioFalso }
	os.Exit(m.Run())
}

// comAnuncio troca o nome anunciado até o fim do teste.
func comAnuncio(t *testing.T, host string) {
	t.Helper()
	original := anuncioFalso
	anuncioFalso = host
	t.Cleanup(func() { anuncioFalso = original })
}

// TestBuildRoomLinksUsaNomeAnunciado cobre RF-123 e RF-126 da feature 012.
func TestBuildRoomLinksUsaNomeAnunciado(t *testing.T) {
	t.Setenv("NGROK_URL", "")
	t.Setenv("PUBLIC_URL", "")
	t.Setenv("BASE_URL", "")
	t.Setenv("WEB_PORT", "8080")

	h := NewHandler(NewInMemoryStore())
	room := &Room{ProfessorSlug: "silva"}
	ip := getOutboundIP()
	if ip == "" || ip == "127.0.0.1" {
		ip = "localhost"
	}
	ipLink := "http://" + ip + ":8080"

	cases := []struct {
		name, host, wantMDNS, wantLink string
	}{
		{"primeiro professor", "mlab.local", "http://mlab.local:8080", "http://mlab.local:8080"},
		{"segundo professor", "mlab-2.local", "http://mlab-2.local:8080", "http://mlab-2.local:8080"},
		{"sem anúncio", "", "", ipLink},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			comAnuncio(t, tc.host)
			got := h.buildRoomLinks(nil, room)
			if got.MDNSLink != tc.wantMDNS || got.ShortMDNSLink != tc.wantMDNS {
				t.Errorf("mdns_link = %q / short = %q, esperado %q", got.MDNSLink, got.ShortMDNSLink, tc.wantMDNS)
			}
			if got.Link != tc.wantLink {
				t.Errorf("link = %q, esperado %q", got.Link, tc.wantLink)
			}
			if got.IPLink != ipLink {
				t.Errorf("ip_link = %q, esperado %q", got.IPLink, ipLink)
			}
		})
	}

	t.Run("BASE_URL tem precedência no link", func(t *testing.T) {
		comAnuncio(t, "mlab-2.local")
		t.Setenv("BASE_URL", "https://aula.example.com/")
		got := h.buildRoomLinks(nil, room)
		if got.Link != "https://aula.example.com" || got.MDNSLink != "http://mlab-2.local:8080" {
			t.Errorf("link = %q, mdns_link = %q", got.Link, got.MDNSLink)
		}
	})
}

// TestCreateRoomDevolveNomeAnunciado cobre RF-123 e RF-126: a resposta do POST /rooms usa o nome escolhido no
// claim, e sem anúncio não traz mdns_link.
func TestCreateRoomDevolveNomeAnunciado(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-12345")
	t.Setenv("NGROK_URL", "")
	t.Setenv("PUBLIC_URL", "")
	t.Setenv("BASE_URL", "")
	if ip := getOutboundIP(); ip == "" || ip == "127.0.0.1" || ip == "localhost" {
		t.Skip("sem IP de LAN: o claim não é chamado")
	}

	for _, host := range []string{"mlab-2.local", ""} {
		t.Run("anúncio="+host, func(t *testing.T) {
			comAnuncio(t, host)
			mux := http.NewServeMux()
			h := NewHandler(NewInMemoryStore())
			h.RegisterRoutes(mux)
			h.RegisterProtectedRoutes(mux, auth.Middleware)
			token, _, err := auth.SignProfessorToken("prof-mdns", "prof@test.com", "Professor Silva")
			if err != nil {
				t.Fatal(err)
			}

			req := httptest.NewRequest("POST", "/rooms", bytes.NewReader([]byte(`{"title":"Turma"}`)))
			req.Header.Set("Authorization", "Bearer "+token)
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)
			if rec.Code != http.StatusCreated {
				t.Fatalf("esperava 201, obteve %d: %s", rec.Code, rec.Body.String())
			}

			var raw map[string]any
			_ = json.Unmarshal(rec.Body.Bytes(), &raw)
			if host == "" {
				if _, ok := raw["mdns_link"]; ok {
					t.Errorf("sem anúncio, mdns_link não deveria vir: %v", raw)
				}
				if link, _ := raw["link"].(string); link != raw["ip_link"] {
					t.Errorf("sem anúncio, link deveria ser o link por IP: link=%v ip_link=%v", raw["link"], raw["ip_link"])
				}
				return
			}
			if raw["mdns_link"] != "http://"+host+":"+getWebPort() {
				t.Errorf("mdns_link = %v, esperado o nome anunciado %s", raw["mdns_link"], host)
			}
		})
	}
}

func TestSlugify(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"Matemática Básica", "matematica-basica"},
		{"Algoritmos - Turma 04", "algoritmos-turma-04"},
		{"Prof. João Silva", "prof-joao-silva"},
		{"Aulas & Exercícios @ 2026!", "aulas-exercicios-2026"},
		{"", ""},
	}

	for _, c := range cases {
		got := slugify(c.input)
		if got != c.expected {
			t.Errorf("slugify(%q) = %q; want %q", c.input, got, c.expected)
		}
	}
}

func TestRoomLifecycle(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-12345")

	store := NewInMemoryStore()
	handler := NewHandler(store)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	handler.RegisterProtectedRoutes(mux, auth.Middleware)

	profToken, _, err := auth.SignProfessorToken("prof-owner", "prof@test.com", "Professor Silva")
	if err != nil {
		t.Fatalf("failed to sign professor token: %v", err)
	}

	// 1. Create Room (POST /rooms)
	createReqBody := []byte(`{"title": "Turma Alpha", "max_participants": 2}`)
	req := httptest.NewRequest("POST", "/rooms", bytes.NewReader(createReqBody))
	req.Header.Set("Authorization", "Bearer "+profToken)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var createResp CreateRoomResponse
	if err := json.NewDecoder(rec.Body).Decode(&createResp); err != nil {
		t.Fatalf("failed to decode CreateRoomResponse: %v", err)
	}
	if createResp.RoomID == "" || createResp.Slug != "turma-alpha/professor-silva" {
		t.Fatalf("expected Slug %q, got %q", "turma-alpha/professor-silva", createResp.Slug)
	}
	if createResp.Status != StatusWaiting {
		t.Errorf("expected status 'waiting', got %s", createResp.Status)
	}

	roomID := createResp.RoomID

	// 2. Get Link (GET /rooms/{roomId}/link)
	linkReq := httptest.NewRequest("GET", "/rooms/"+roomID+"/link", nil)
	linkReq.Header.Set("Authorization", "Bearer "+profToken)
	linkRec := httptest.NewRecorder()
	mux.ServeHTTP(linkRec, linkReq)

	if linkRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for getLink, got %d", linkRec.Code)
	}
	var linkResp LinkResponse
	_ = json.NewDecoder(linkRec.Body).Decode(&linkResp)
	if linkResp.Link == "" {
		t.Error("expected non-empty link in LinkResponse")
	}
	if linkResp.IPLink == "" || linkResp.MDNSLink != "http://mlab.local:"+getWebPort() {
		t.Errorf("expected ip_link and mdns_link with the announced name in LinkResponse: %+v", linkResp)
	}
	if strings.Contains(linkResp.IPLink, "/entrar") || strings.Contains(linkResp.MDNSLink, "/entrar") {
		t.Errorf("expected short root URLs without /entrar, got ip=%q mdns=%q", linkResp.IPLink, linkResp.MDNSLink)
	}

	// 2.1 Get Active Room (GET /rooms/active)
	activeReq := httptest.NewRequest("GET", "/rooms/active", nil)
	activeRec := httptest.NewRecorder()
	mux.ServeHTTP(activeRec, activeReq)
	if activeRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET /rooms/active, got %d: %s", activeRec.Code, activeRec.Body.String())
	}
	var activeMap map[string]any
	_ = json.NewDecoder(activeRec.Body).Decode(&activeMap)
	if activeMap["room_id"] != roomID {
		t.Errorf("expected active room_id %q, got %v", roomID, activeMap["room_id"])
	}
	if activeMap["ip_link"] == nil || activeMap["mdns_link"] == nil {
		t.Errorf("expected ip_link and mdns_link in active room response: %+v", activeMap)
	}

	// 3. Student 1 Joins via composite path (POST /rooms/{roomSlug}/{profSlug}/join)
	joinBody := []byte(`{"name": "Aluno 1", "student_id": "2025116TADS0001"}`)
	joinReq := httptest.NewRequest("POST", "/rooms/"+createResp.Slug+"/join", bytes.NewReader(joinBody))
	joinRec := httptest.NewRecorder()
	mux.ServeHTTP(joinRec, joinReq)

	if joinRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for student 1 join, got %d: %s", joinRec.Code, joinRec.Body.String())
	}
	var joinResp JoinResponse
	_ = json.NewDecoder(joinRec.Body).Decode(&joinResp)
	if joinResp.Token == "" || joinResp.ParticipantID == "" {
		t.Error("expected token and participant_id for student")
	}

	// 4. Student 2 Joins (reaches limit 2)
	joinBody2 := []byte(`{"name": "Aluno 2", "student_id": "2025116TADS0002"}`)
	joinReq2 := httptest.NewRequest("POST", "/rooms/"+roomID+"/join", bytes.NewReader(joinBody2))
	joinRec2 := httptest.NewRecorder()
	mux.ServeHTTP(joinRec2, joinReq2)
	if joinRec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for student 2 join, got %d", joinRec2.Code)
	}

	// 5. Student 3 tries to join -> 429 Too Many Requests
	joinBody3 := []byte(`{"name": "Aluno 3", "student_id": "2025116TADS0003"}`)
	joinReq3 := httptest.NewRequest("POST", "/rooms/"+roomID+"/join", bytes.NewReader(joinBody3))
	joinRec3 := httptest.NewRecorder()
	mux.ServeHTTP(joinRec3, joinReq3)
	if joinRec3.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 TooManyRequests when exceeding max_participants, got %d", joinRec3.Code)
	}

	// 5.1 Student 1 rejoins with the same matrícula (other case) on a full room -> 200 (RN-04, 005/T501)
	rejoinBody := []byte(`{"name": "Aluno 1", "student_id": "2025116tads0001"}`)
	rejoinReq := httptest.NewRequest("POST", "/rooms/"+roomID+"/join", bytes.NewReader(rejoinBody))
	rejoinRec := httptest.NewRecorder()
	mux.ServeHTTP(rejoinRec, rejoinReq)
	if rejoinRec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for a rejoin with the same matrícula on a full room, got %d: %s", rejoinRec.Code, rejoinRec.Body.String())
	}
	if n, _ := store.CountParticipants(context.Background(), roomID); n != 2 {
		t.Errorf("expected the rejoin to replace the previous participant (count 2), got %d", n)
	}

	// 6. Close Room (POST /rooms/{roomId}/close)
	closeReq := httptest.NewRequest("POST", "/rooms/"+roomID+"/close", nil)
	closeReq.Header.Set("Authorization", "Bearer "+profToken)
	closeRec := httptest.NewRecorder()
	mux.ServeHTTP(closeRec, closeReq)

	if closeRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for closeRoom, got %d: %s", closeRec.Code, closeRec.Body.String())
	}

	// 6.1 Check Active Room after close -> 404
	activeAfterCloseReq := httptest.NewRequest("GET", "/rooms/active", nil)
	activeAfterCloseRec := httptest.NewRecorder()
	mux.ServeHTTP(activeAfterCloseRec, activeAfterCloseReq)
	if activeAfterCloseRec.Code != http.StatusNotFound {
		t.Errorf("expected 404 NotFound for GET /rooms/active after close, got %d", activeAfterCloseRec.Code)
	}

	// 7. Student tries to join closed room -> 404 Not Found (link descartado)
	joinReqClosed := httptest.NewRequest("POST", "/rooms/"+roomID+"/join", bytes.NewReader(joinBody))
	joinRecClosed := httptest.NewRecorder()
	mux.ServeHTTP(joinRecClosed, joinReqClosed)
	if joinRecClosed.Code != http.StatusNotFound {
		t.Errorf("expected 404 NotFound when joining closed room, got %d", joinRecClosed.Code)
	}
}

func TestJoinValidation(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-12345")

	store := NewInMemoryStore()
	handler := NewHandler(store)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// Missing fields
	req := httptest.NewRequest("POST", "/rooms/room-123/join", bytes.NewReader([]byte(`{"name": "", "student_id": ""}`)))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for empty name and student_id, got %d", rec.Code)
	}

	// Invalid student_id formats (must contain numbers and up to 4 letters)
	invalidIDs := []string{
		"2024091812",       // apenas números
		"RA-101",           // hífen
		"2025116ABCDE0001", // 5 letras (excede limite de 4)
		"TADS20250000",     // letras no início
		"20250000TADS",     // letras no fim
		"   ",              // vazio
	}

	for _, invalidID := range invalidIDs {
		body := bytes.NewReader([]byte(`{"name": "Aluno Teste", "student_id": "` + invalidID + `"}`))
		reqInv := httptest.NewRequest("POST", "/rooms/room-123/join", body)
		recInv := httptest.NewRecorder()
		mux.ServeHTTP(recInv, reqInv)

		if recInv.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for invalid student_id %q, got %d", invalidID, recInv.Code)
		}
	}

	// Non-existent room with valid student_id
	validBody := bytes.NewReader([]byte(`{"name": "Teste", "student_id": "2025116TADS0000"}`))
	reqNotFound := httptest.NewRequest("POST", "/rooms/room-does-not-exist/join", validBody)
	recNotFound := httptest.NewRecorder()
	mux.ServeHTTP(recNotFound, reqNotFound)

	if recNotFound.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found for non-existent room, got %d", recNotFound.Code)
	}
}

func TestJoinRoomBySlug(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-12345")
	t.Setenv("WS_URL", "ws://localhost:8080")

	store := NewInMemoryStore()
	handler := NewHandler(store)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// Cria sala diretamente no store
	targetRoom := &Room{
		ID:              "canon-room-uuid-123",
		Slug:            "uniform-lima-4770/prof-1",
		RoomSlug:        "uniform-lima-4770",
		ProfessorSlug:   "prof-1",
		OwnerID:         "prof-1",
		Status:          StatusWaiting,
		MaxParticipants: 50,
		CreatedAt:       time.Now().UTC(),
	}
	if err := store.CreateRoom(context.Background(), targetRoom); err != nil {
		t.Fatalf("falha ao criar sala: %v", err)
	}

	// Aluno ingressa usando o SLUG na URL composta
	joinBody := []byte(`{"name": "Mateus de Araujo", "student_id": "2025116tads0039"}`)
	req := httptest.NewRequest("POST", "/rooms/uniform-lima-4770/prof-1/join", bytes.NewReader(joinBody))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for join via slug, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp JoinResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("falha ao decodificar JoinResponse: %v", err)
	}

	if resp.Token == "" {
		t.Error("esperava token JWT gerado para o aluno")
	}
	if resp.RoomID != "canon-room-uuid-123" {
		t.Errorf("esperava RoomID canon-room-uuid-123, obteve %s", resp.RoomID)
	}
	expectedWs := "ws://localhost:8080/ws/rooms/canon-room-uuid-123/signal"
	if resp.WsURL != expectedWs {
		t.Errorf("esperava WsURL %s, obteve %s", expectedWs, resp.WsURL)
	}
	if len(resp.IceServers) == 0 {
		t.Error("esperava IceServers configurados")
	}
}

func TestSlugFromEmail(t *testing.T) {
	cases := []struct {
		email    string
		expected string
	}{
		{"professor@screenshare.local", "professor"},
		{"carlos.silva@escola.com", "carlos-silva"},
		{"maria_oliveira@univ.edu.br", "maria-oliveira"},
		{"prof+test@domain.com", "prof-test"},
	}

	for _, c := range cases {
		got := slugFromEmail(c.email)
		if got != c.expected {
			t.Errorf("slugFromEmail(%q) = %q; want %q", c.email, got, c.expected)
		}
	}
}

func TestCreateRoomFixedSlug(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-12345")
	t.Setenv("BASE_URL", "http://localhost:3000")

	store := NewInMemoryStore()
	handler := NewHandler(store)
	mux := http.NewServeMux()
	handler.RegisterProtectedRoutes(mux, auth.Middleware)

	// Gera token de professor com email
	profClaims := auth.ProfessorMapClaims("prof-123", "professor@screenshare.local")
	profToken, err := auth.SignToken(profClaims)
	if err != nil {
		t.Fatalf("falha ao assinar token: %v", err)
	}

	// 1. Cria sala
	req := httptest.NewRequest("POST", "/rooms", bytes.NewReader([]byte(`{"title":"Matemática"}`)))
	req.Header.Set("Authorization", "Bearer "+profToken)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp CreateRoomResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode err: %v", err)
	}

	expectedSlug := "matematica/professor"
	if resp.Slug != expectedSlug {
		t.Errorf("esperava slug %q, obteve %q", expectedSlug, resp.Slug)
	}
	expectedLink := "http://localhost:3000"
	if resp.Link != expectedLink {
		t.Errorf("esperava Link %q, obteve %q", expectedLink, resp.Link)
	}

	// 2. Cria novamente com o mesmo professor -> invalida a anterior e cria uma nova sessão
	req2 := httptest.NewRequest("POST", "/rooms", bytes.NewReader([]byte(`{"title":"Matemática"}`)))
	req2.Header.Set("Authorization", "Bearer "+profToken)
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d", rec2.Code)
	}

	var resp2 CreateRoomResponse
	if err := json.NewDecoder(rec2.Body).Decode(&resp2); err != nil {
		t.Fatalf("decode err: %v", err)
	}

	if resp2.RoomID == resp.RoomID {
		t.Errorf("esperava novo RoomID exclusivo, obteve reuso de %q", resp.RoomID)
	}
	if resp2.Slug != expectedSlug {
		t.Errorf("esperava slug limpo %q, obteve %q", expectedSlug, resp2.Slug)
	}

	// 3. Garante que a sala anterior pelo ID foi deletada ou fechada
	oldRoom, errOld := store.GetRoomByID(context.Background(), resp.RoomID)
	if errOld == nil && oldRoom != nil {
		t.Errorf("esperava sala anterior removida do store, mas foi encontrada: %v", oldRoom)
	}
}

func TestCreateRoomNgrok(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret-12345")
	t.Setenv("NGROK_URL", "https://mlab-live.ngrok-free.app")

	store := NewInMemoryStore()
	handler := NewHandler(store)
	mux := http.NewServeMux()
	handler.RegisterProtectedRoutes(mux, auth.Middleware)

	profClaims := auth.ProfessorMapClaims("prof-ngrok", "professor.silva@screenshare.local")
	profToken, err := auth.SignToken(profClaims)
	if err != nil {
		t.Fatalf("falha ao assinar token: %v", err)
	}

	req := httptest.NewRequest("POST", "/rooms", bytes.NewReader([]byte(`{"title":"Matemática"}`)))
	req.Header.Set("Authorization", "Bearer "+profToken)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp CreateRoomResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode err: %v", err)
	}

	expectedLink := "https://mlab-live.ngrok-free.app"
	if resp.Link != expectedLink {
		t.Errorf("esperava Link com ngrok e link %q, obteve %q", expectedLink, resp.Link)
	}
}

func TestGetActiveRoom_Deterministic(t *testing.T) {
	ctx := context.Background()
	base := time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC)

	// Repete várias vezes para expor a ordem aleatória de iteração do map.
	for i := 0; i < 50; i++ {
		store := NewInMemoryStore()
		_ = store.CreateRoom(ctx, &Room{ID: "antiga-waiting", Slug: "a/p", Status: StatusWaiting, CreatedAt: base})
		_ = store.CreateRoom(ctx, &Room{ID: "nova-waiting", Slug: "b/p", Status: StatusWaiting, CreatedAt: base.Add(time.Minute)})
		_ = store.CreateRoom(ctx, &Room{ID: "fechada", Slug: "c/p", Status: StatusClosed, CreatedAt: base.Add(2 * time.Minute)})

		got, err := store.GetActiveRoom(ctx)
		if err != nil || got.ID != "nova-waiting" {
			t.Fatalf("iteração %d: esperado nova-waiting, obtido %+v (err=%v)", i, got, err)
		}

		_ = store.CreateRoom(ctx, &Room{ID: "transmitindo", Slug: "d/p", Status: StatusPublishing, CreatedAt: base.Add(-time.Hour)})
		got, err = store.GetActiveRoom(ctx)
		if err != nil || got.ID != "transmitindo" {
			t.Fatalf("iteração %d: esperado transmitindo (publishing tem prioridade), obtido %+v (err=%v)", i, got, err)
		}
	}
}

func TestGetActiveRoom_NoneActive(t *testing.T) {
	store := NewInMemoryStore()
	_ = store.CreateRoom(context.Background(), &Room{ID: "fechada", Slug: "c/p", Status: StatusClosed, CreatedAt: time.Now()})
	if _, err := store.GetActiveRoom(context.Background()); err != ErrRoomNotFound {
		t.Fatalf("expected ErrRoomNotFound, got %v", err)
	}
}
