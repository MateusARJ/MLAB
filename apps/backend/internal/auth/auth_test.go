package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
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

func TestInMemoryStore_FindProfessorByEmail(t *testing.T) {
	store := NewInMemoryStore()

	prof, err := store.FindProfessorByEmail(context.Background(), "professor@screenshare.local")
	if err != nil {
		t.Fatalf("expected to find default professor, got err: %v", err)
	}
	if prof.Email != "professor@screenshare.local" {
		t.Errorf("expected email professor@screenshare.local, got %s", prof.Email)
	}

	err = bcrypt.CompareHashAndPassword([]byte(prof.PasswordHash), []byte("professor123"))
	if err != nil {
		t.Errorf("expected password professor123 to match bcrypt hash, got %v", err)
	}

	_, err = store.FindProfessorByEmail(context.Background(), "inexistente@screenshare.local")
	if err != ErrProfessorNotFound {
		t.Errorf("expected ErrProfessorNotFound, got: %v", err)
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
