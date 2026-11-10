package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TestAuthSecurity_ForgedSecret valida que tokens assinados com segredos forjados
// são sumariamente rejeitados pelo ParseToken e pelo Middleware (ADR 0004 §2.2.1).
func TestAuthSecurity_ForgedSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "legitimate-backend-secret-key-12345")

	// Token gerado por atacante com outra chave
	attackerSecret := []byte("malicious-attacker-secret-key-99999")
	claims := jwt.MapClaims{
		"sub":  "attacker-01",
		"role": string(RoleProfessor),
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(2 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	forgedTokenStr, err := token.SignedString(attackerSecret)
	if err != nil {
		t.Fatalf("failed to create forged token: %v", err)
	}

	// 1. Verificação direta do ParseToken
	_, err = ParseToken(forgedTokenStr)
	if err == nil {
		t.Fatal("security violation: ParseToken accepted token signed with wrong secret key")
	}

	// 2. Verificação via Middleware HTTP
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	protected := Middleware(dummyHandler)

	req := httptest.NewRequest("GET", "/rooms", nil)
	req.Header.Set("Authorization", "Bearer "+forgedTokenStr)
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for forged token, got: %d", rec.Code)
	}
}

// TestAuthSecurity_ClaimManipulation valida que se o atacante manipular claims
// (ex: elevar aluno para professor) a assinatura é invalidada (ADR 0004 §2.2.1).
func TestAuthSecurity_ClaimManipulation(t *testing.T) {
	t.Setenv("JWT_SECRET", "legitimate-backend-secret-key-12345")

	// Gera token legítimo de aluno
	studClaims := StudentMapClaims("student-1", "Aluno Vulneravel", "RA-001", "room-1")
	tokenStr, err := SignToken(studClaims)
	if err != nil {
		t.Fatalf("SignToken failed: %v", err)
	}

	// Altera um caractere no payload do token JWT (segmento central base64)
	tamperedToken := tokenStr[:len(tokenStr)-5] + "A" + tokenStr[len(tokenStr)-4:]

	_, err = ParseToken(tamperedToken)
	if err == nil {
		t.Fatal("security violation: ParseToken accepted tampered JWT token payload")
	}
}

// TestAuthSecurity_AlgorithmNoneAttack valida que tokens com algoritmo "none"
// são rejeitados mesmo que não tenham assinatura (ADR 0004 §2.2.1).
func TestAuthSecurity_AlgorithmNoneAttack(t *testing.T) {
	t.Setenv("JWT_SECRET", "legitimate-backend-secret-key-12345")

	noneClaims := jwt.MapClaims{
		"sub":  "hacker",
		"role": string(RoleProfessor),
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(1 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodNone, noneClaims)
	noneTokenStr, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("failed to sign none token: %v", err)
	}

	_, err = ParseToken(noneTokenStr)
	if err == nil {
		t.Fatal("security violation: ParseToken accepted algorithm 'none' token")
	}
}

// TestAuthSecurity_MissingSecret verifica que a falta de JWT_SECRET
// impede emissão e validação sem falhar silenciosamente (fail-closed).
func TestAuthSecurity_MissingSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")

	_, _, err := SignProfessorToken("prof")
	if err != ErrMissingSecret {
		t.Errorf("expected ErrMissingSecret on sign without JWT_SECRET, got: %v", err)
	}

	_, err = ParseToken("dummy.token.here")
	if err != ErrMissingSecret {
		t.Errorf("expected ErrMissingSecret on parse without JWT_SECRET, got: %v", err)
	}
}
