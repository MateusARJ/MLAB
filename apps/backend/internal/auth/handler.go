package auth

import (
	"crypto/subtle"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

// Handler agrupa os endpoints HTTP do pacote auth.
// Não existe login de professor (ADR 0006): a única emissão de token de professor é POST /auth/session.
type Handler struct{}

// NewHandler cria um novo Handler.
func NewHandler() *Handler {
	return &Handler{}
}

// RegisterRoutes registra os endpoints de auth no mux fornecido.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /auth/session", h.session)
}

// HostKeyHeader é o header que carrega a chave de host gerada pelo app desktop (ADR 0006).
const HostKeyHeader = "X-MLab-Host-Key"

// HostKeyEnv é a variável de ambiente com a chave de host da execução atual.
const HostKeyEnv = "MLAB_HOST_KEY"

// validHostKey confere, em tempo constante, se a requisição apresenta a chave de host configurada.
// Sem chave configurada no backend, nenhuma requisição é aceita (fail-closed).
func validHostKey(r *http.Request) bool {
	expected := os.Getenv(HostKeyEnv)
	if expected == "" {
		return false
	}
	got := r.Header.Get(HostKeyHeader)
	return subtle.ConstantTimeCompare([]byte(got), []byte(expected)) == 1
}

// session trata o POST /auth/session (identificação direta do professor sem necessidade de senha).
// Exige a chave de host gerada pelo app desktop nesta execução (ADR 0006).
//
// Contrato: contracts/auth.md → POST /auth/session
func (h *Handler) session(w http.ResponseWriter, r *http.Request) {
	if !validHostKey(r) {
		writeError(w, http.StatusForbidden, "sessão de professor permitida apenas pelo app MLab desta máquina")
		return
	}

	var req SessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Name = "Professor"
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Professor"
	}

	profID := newID()
	tokenStr, expiresAt, err := SignProfessorToken(profID, "professor@mlab.local", name)
	if err != nil {
		log.Printf("auth: SignProfessorToken: %v", err)
		writeError(w, http.StatusInternalServerError, "erro ao gerar token")
		return
	}

	writeJSON(w, http.StatusOK, SessionResponse{
		Token:     tokenStr,
		ExpiresAt: expiresAt.UTC().Format("2006-01-02T15:04:05Z"),
		Name:      name,
	})
}

// ── helpers ───────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("auth: writeJSON encode: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
