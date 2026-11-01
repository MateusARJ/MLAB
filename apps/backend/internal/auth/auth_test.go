package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestSignAndParseProfessorToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "super-secret-key-for-testing-12345")

	profID := "prof-001"
	email := "professor@screenshare.local"

	tokenStr, exp, err := SignProfessorToken(profID, email)
	if err != nil {
		t.Fatalf("SignProfessorToken failed: %v", err)
	}
	if tokenStr == "" {
		t.Fatal("expected non-empty token string")
	}
	if exp.Before(time.Now()) {
		t.Fatal("expected expiration in the future")
	}

	claims, err := ParseToken(tokenStr)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}

	if ClaimSub(claims) != profID {
		t.Errorf("expected sub %s, got %s", profID, ClaimSub(claims))
	}
	if ClaimRole(claims) != RoleProfessor {
		t.Errorf("expected role %s, got %s", RoleProfessor, ClaimRole(claims))
	}
	if claims["email"] != email {
		t.Errorf("expected email %s, got %v", email, claims["email"])
	}
}

func TestSignAndParseStudentToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "super-secret-key-for-testing-12345")

	studentID := "RA-2024-999"
	partID := "part-123"
	name := "Aluno da Silva"
	roomID := "room-charlie-delta"

	claims := StudentMapClaims(partID, name, studentID, roomID)
	tokenStr, err := SignToken(claims)
	if err != nil {
		t.Fatalf("SignToken failed: %v", err)
	}

	parsed, err := ParseToken(tokenStr)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}

	if ClaimSub(parsed) != partID {
		t.Errorf("expected sub %s, got %s", partID, ClaimSub(parsed))
	}
	if ClaimRole(parsed) != RoleAluno {
		t.Errorf("expected role %s, got %s", RoleAluno, ClaimRole(parsed))
	}
	if ClaimRoomID(parsed) != roomID {
		t.Errorf("expected room_id %s, got %s", roomID, ClaimRoomID(parsed))
	}
	if parsed["name"] != name {
		t.Errorf("expected name %s, got %v", name, parsed["name"])
	}
	if parsed["student_id"] != studentID {
		t.Errorf("expected student_id %s, got %v", studentID, parsed["student_id"])
	}
}

func TestParseToken_Expired(t *testing.T) {
	t.Setenv("JWT_SECRET", "super-secret-key-for-testing-12345")

	expiredClaims := jwt.MapClaims{
		"sub":  "user-1",
		"role": string(RoleAluno),
		"iat":  time.Now().Add(-2 * time.Hour).Unix(),
		"exp":  time.Now().Add(-1 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
	tokenStr, err := token.SignedString([]byte("super-secret-key-for-testing-12345"))
	if err != nil {
		t.Fatalf("failed to sign expired token: %v", err)
	}

	_, err = ParseToken(tokenStr)
	if err != ErrInvalidToken {
		t.Errorf("expected ErrInvalidToken for expired token, got: %v", err)
	}
}

func TestLoginEndpointRemoved(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler().RegisterRoutes(mux)

	body := strings.NewReader(`{"email":"professor@screenshare.local","password":"professor123"}`)
	req := httptest.NewRequest("POST", "/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for removed POST /auth/login, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMiddleware_ValidAndInvalid(t *testing.T) {
	t.Setenv("JWT_SECRET", "super-secret-key-for-testing-12345")

	tokenStr, _, err := SignProfessorToken("prof-test", "prof@test.com")
	if err != nil {
		t.Fatalf("SignProfessorToken failed: %v", err)
	}

	nextCalled := false
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok || ClaimSub(claims) != "prof-test" {
			t.Errorf("expected claims with sub prof-test in context")
		}
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	protected := Middleware(dummyHandler)

	// 1. Success case with Bearer token
	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", rec.Code)
	}
	if !nextCalled {
		t.Errorf("expected next handler to be called")
	}

	// 2. Missing token
	req = httptest.NewRequest("GET", "/protected", nil)
	rec = httptest.NewRecorder()
	protected.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for missing token, got %d", rec.Code)
	}

	// 3. Malformed / Invalid token
	req = httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalid-token-string")
	rec = httptest.NewRecorder()
	protected.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for invalid token, got %d", rec.Code)
	}
}

func TestRequireRole(t *testing.T) {
	t.Setenv("JWT_SECRET", "super-secret-key-for-testing-12345")

	profToken, _, _ := SignProfessorToken("prof-1", "prof@test.com")
	studClaims := StudentMapClaims("stud-1", "Aluno", "RA123", "room-1")
	studToken, _ := SignToken(studClaims)

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	requireProf := Middleware(RequireRole(RoleProfessor, dummyHandler))

	// Professor accessing professor route: OK
	req := httptest.NewRequest("POST", "/rooms", nil)
	req.Header.Set("Authorization", "Bearer "+profToken)
	rec := httptest.NewRecorder()
	requireProf.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for professor, got %d", rec.Code)
	}

	// Aluno accessing professor route: 403 Forbidden
	req = httptest.NewRequest("POST", "/rooms", nil)
	req.Header.Set("Authorization", "Bearer "+studToken)
	rec = httptest.NewRecorder()
	requireProf.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for student accessing professor route, got %d", rec.Code)
	}
}

func TestSessionEndpoint(t *testing.T) {
	t.Setenv("JWT_SECRET", "super-secret-key-for-testing-12345")
	t.Setenv(HostKeyEnv, "chave-de-host-de-teste")

	handler := NewHandler()
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// POST /auth/session com nome
	body := strings.NewReader(`{"name":"Prof. Carlos Eduardo"}`)
	req := httptest.NewRequest("POST", "/auth/session", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(HostKeyHeader, "chave-de-host-de-teste")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp SessionResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Token == "" {
		t.Error("expected non-empty token")
	}
	if resp.Name != "Prof. Carlos Eduardo" {
		t.Errorf("expected name 'Prof. Carlos Eduardo', got '%s'", resp.Name)
	}

	// Valida se o token gerado contém papel de professor e o nome
	claims, err := ParseToken(resp.Token)
	if err != nil {
		t.Fatalf("failed to parse returned token: %v", err)
	}
	if ClaimRole(claims) != RoleProfessor {
		t.Errorf("expected role %s, got %s", RoleProfessor, ClaimRole(claims))
	}
	if claims["name"] != "Prof. Carlos Eduardo" {
		t.Errorf("expected claim name 'Prof. Carlos Eduardo', got '%v'", claims["name"])
	}
}

func TestSessionEndpoint_RejectsWithoutValidHostKey(t *testing.T) {
	t.Setenv("JWT_SECRET", "super-secret-key-for-testing-12345")

	mux := http.NewServeMux()
	NewHandler().RegisterRoutes(mux)

	cases := []struct {
		name       string
		configured string
		header     string
	}{
		{name: "sem header", configured: "chave-correta", header: ""},
		{name: "header errado", configured: "chave-correta", header: "chave-errada"},
		{name: "prefixo da chave", configured: "chave-correta", header: "chave-corre"},
		{name: "backend sem chave configurada", configured: "", header: "qualquer-valor"},
		{name: "backend sem chave e sem header", configured: "", header: ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(HostKeyEnv, tc.configured)
			req := httptest.NewRequest("POST", "/auth/session", strings.NewReader(`{"name":"Intruso"}`))
			req.Header.Set("Content-Type", "application/json")
			if tc.header != "" {
				req.Header.Set(HostKeyHeader, tc.header)
			}
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != http.StatusForbidden {
				t.Fatalf("expected 403, got %d: %s", rec.Code, rec.Body.String())
			}
			if strings.Contains(rec.Body.String(), `"token"`) {
				t.Fatal("no token must be returned when the host key is invalid")
			}
		})
	}
}
