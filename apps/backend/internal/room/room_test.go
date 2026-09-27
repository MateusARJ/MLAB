package room

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/screenshare/classroom/internal/auth"
)

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

func TestBuildLink(t *testing.T) {
	link := buildLink("http://localhost:5173", "algoritmos-turma-04/professor")
	expected := "http://localhost:5173/algoritmos-turma-04/professor/entrar"
	if link != expected {
		t.Errorf("expected %q, got %q", expected, link)
	}

	// Test trailing slash removal
	link2 := buildLink("https://mlab.edu.br/", "matematica/prof-carlos")
	expected2 := "https://mlab.edu.br/matematica/prof-carlos/entrar"
	if link2 != expected2 {
		t.Errorf("expected %q, got %q", expected2, link2)
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

	// 3. Student 1 Joins via composite path (POST /rooms/{roomSlug}/{profSlug}/join)
	joinBody := []byte(`{"name": "Aluno 1", "student_id": "RA-101"}`)
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
	joinBody2 := []byte(`{"name": "Aluno 2", "student_id": "RA-102"}`)
	joinReq2 := httptest.NewRequest("POST", "/rooms/"+roomID+"/join", bytes.NewReader(joinBody2))
	joinRec2 := httptest.NewRecorder()
	mux.ServeHTTP(joinRec2, joinReq2)
	if joinRec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for student 2 join, got %d", joinRec2.Code)
	}

	// 5. Student 3 tries to join -> 429 Too Many Requests
	joinBody3 := []byte(`{"name": "Aluno 3", "student_id": "RA-103"}`)
	joinReq3 := httptest.NewRequest("POST", "/rooms/"+roomID+"/join", bytes.NewReader(joinBody3))
	joinRec3 := httptest.NewRecorder()
	mux.ServeHTTP(joinRec3, joinReq3)
	if joinRec3.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 TooManyRequests when exceeding max_participants, got %d", joinRec3.Code)
	}

	// 6. Close Room (POST /rooms/{roomId}/close)
	closeReq := httptest.NewRequest("POST", "/rooms/"+roomID+"/close", nil)
	closeReq.Header.Set("Authorization", "Bearer "+profToken)
	closeRec := httptest.NewRecorder()
	mux.ServeHTTP(closeRec, closeReq)

	if closeRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for closeRoom, got %d: %s", closeRec.Code, closeRec.Body.String())
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

	// Non-existent room
	validBody := bytes.NewReader([]byte(`{"name": "Teste", "student_id": "RA-1"}`))
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
	expectedLink := "http://localhost:3000/matematica/professor/entrar"
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

	expectedLink := "https://mlab-live.ngrok-free.app/matematica/professor-silva/entrar"
	if resp.Link != expectedLink {
		t.Errorf("esperava Link com ngrok e link %q, obteve %q", expectedLink, resp.Link)
	}
}
