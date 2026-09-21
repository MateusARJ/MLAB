package auth

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Erros exportados do pacote auth.
var (
	ErrInvalidToken  = errors.New("token inválido ou expirado")
	ErrMissingSecret = errors.New("JWT_SECRET não configurado")
)

// jwtSecret lê a chave secreta da variável de ambiente.
// Nunca deve ser hardcoded.
func jwtSecret() ([]byte, error) {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		return nil, ErrMissingSecret
	}
	return []byte(s), nil
}

// professorTTL é a validade do token do professor (configurável via ENV).
func professorTTL() time.Duration {
	if v := os.Getenv("PROFESSOR_TOKEN_TTL_H"); v != "" {
		if d, err := time.ParseDuration(v + "h"); err == nil {
			return d
		}
	}
	return 8 * time.Hour
}

// studentTTL é a validade do token do aluno (configurável via ENV).
func studentTTL() time.Duration {
	if v := os.Getenv("STUDENT_TOKEN_TTL_H"); v != "" {
		if d, err := time.ParseDuration(v + "h"); err == nil {
			return d
		}
	}
	return 6 * time.Hour // duração de aula + margem
}

// ProfessorMapClaims monta os claims padronizados para o token do professor.
func ProfessorMapClaims(professorID, email string, name ...string) jwt.MapClaims {
	now := time.Now()
	exp := now.Add(professorTTL())
	claims := jwt.MapClaims{
		"sub":   professorID,
		"role":  string(RoleProfessor),
		"email": email,
		"iat":   now.Unix(),
		"exp":   exp.Unix(),
	}
	if len(name) > 0 && name[0] != "" {
		claims["name"] = name[0]
	}
	return claims
}

// StudentMapClaims monta os claims padronizados para o token do aluno.
// Exportado para ser usado pelo módulo room (T009) no endpoint /join.
func StudentMapClaims(participantID, name, studentID, roomID string) jwt.MapClaims {
	now := time.Now()
	exp := now.Add(studentTTL())
	return jwt.MapClaims{
		"sub":        participantID,
		"role":       string(RoleAluno),
		"name":       name,
		"student_id": studentID,
		"room_id":    roomID,
		"iat":        now.Unix(),
		"exp":        exp.Unix(),
	}
}

// SignToken assina um conjunto de claims e retorna o token string.
func SignToken(claims jwt.MapClaims) (string, error) {
	secret, err := jwtSecret()
	if err != nil {
		return "", err
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// SignProfessorToken gera um token JWT assinado para um professor.
func SignProfessorToken(professorID, email string, name ...string) (tokenStr string, expiresAt time.Time, err error) {
	claims := ProfessorMapClaims(professorID, email, name...)
	tokenStr, err = SignToken(claims)
	if err != nil {
		return "", time.Time{}, err
	}
	exp := time.Unix(int64(claims["exp"].(int64)), 0)
	return tokenStr, exp, nil
}

// ParseToken valida e parseia um JWT, retornando os claims.
func ParseToken(tokenStr string) (jwt.MapClaims, error) {
	secret, err := jwtSecret()
	if err != nil {
		return nil, err
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("algoritmo inesperado: %v", t.Header["alg"])
		}
		return secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))

	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// ClaimRole extrai o campo "role" de um conjunto de claims.
func ClaimRole(claims jwt.MapClaims) Role {
	if r, ok := claims["role"].(string); ok {
		return Role(r)
	}
	return ""
}

// ClaimSub extrai o campo "sub" (ID do participante/professor) de um conjunto de claims.
func ClaimSub(claims jwt.MapClaims) string {
	if s, ok := claims["sub"].(string); ok {
		return s
	}
	return ""
}

// ClaimRoomID extrai o campo "room_id" do token do aluno.
func ClaimRoomID(claims jwt.MapClaims) string {
	if r, ok := claims["room_id"].(string); ok {
		return r
	}
	return ""
}
