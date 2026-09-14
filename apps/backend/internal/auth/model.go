package auth

import "time"

// Role define o papel do participante no sistema.
type Role string

const (
	RoleProfessor Role = "professor"
	RoleAluno     Role = "aluno"
)

// Professor representa um professor cadastrado no sistema.
// O campo PasswordHash nunca é exposto ao cliente.
type Professor struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

// LoginRequest é o payload do POST /auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse é a resposta do POST /auth/login com sucesso.
type LoginResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"` // ISO 8601
}

// Claims são os dados embutidos no JWT do professor.
type Claims struct {
	Role  string `json:"role"`
	Email string `json:"email"`
}

// StudentClaims são os dados embutidos no JWT do aluno.
type StudentClaims struct {
	Role      string `json:"role"`
	Name      string `json:"name"`
	StudentID string `json:"student_id"`
	RoomID    string `json:"room_id"`
}
