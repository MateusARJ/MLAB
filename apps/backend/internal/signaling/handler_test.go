package signaling

import (
	"testing"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
)

// TestExtractName cobre o nome exibido a partir dos claims (RF-152, ADR 0009): a claim email não é mais lida.
func TestExtractName(t *testing.T) {
	cases := []struct {
		desc   string
		claims map[string]any
		role   auth.Role
		want   string
	}{
		{"professor com name", map[string]any{"name": "Prof. Ana"}, auth.RoleProfessor, "Prof. Ana"},
		{"aluno com name", map[string]any{"name": "Aluno Silva"}, auth.RoleAluno, "Aluno Silva"},
		{"sem name e com email", map[string]any{"email": "professor@mlab.local"}, auth.RoleProfessor, "Participante"},
		{"name vazio", map[string]any{"name": ""}, auth.RoleProfessor, "Participante"},
		{"sem claims", map[string]any{}, auth.RoleAluno, "Participante"},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			if got := extractName(c.claims, c.role); got != c.want {
				t.Errorf("extractName(%v) = %q; want %q", c.claims, got, c.want)
			}
		})
	}
}
