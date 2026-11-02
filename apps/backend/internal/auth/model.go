package auth

// Role define o papel do participante no sistema.
type Role string

const (
	RoleProfessor Role = "professor"
	RoleAluno     Role = "aluno"
)

// SessionRequest é o payload do POST /auth/session para identificação direta do professor.
type SessionRequest struct {
	Name string `json:"name"`
}

// SessionResponse é a resposta do POST /auth/session com sucesso.
type SessionResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"` // ISO 8601
	Name      string `json:"name,omitempty"`
}

// StudentClaims são os dados embutidos no JWT do aluno.
type StudentClaims struct {
	Role      string `json:"role"`
	Name      string `json:"name"`
	StudentID string `json:"student_id"`
	RoomID    string `json:"room_id"`
}
