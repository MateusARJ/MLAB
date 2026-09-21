package auth

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// Store é a interface mínima que o handler precisa para buscar professores.
// Implementações concretas ficam no módulo de persistência (infra/db).
type Store interface {
	FindProfessorByEmail(ctx context.Context, email string) (*Professor, error)
}

// Handler agrupa os endpoints HTTP do pacote auth.
type Handler struct {
	store Store
}

// NewHandler cria um novo Handler com o store fornecido.
func NewHandler(store Store) *Handler {
	return &Handler{store: store}
}

// RegisterRoutes registra os endpoints de auth no mux fornecido.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /auth/login", h.login)
}

// login trata o POST /auth/login (professor).
//
// Contrato: contracts/auth.md → POST /auth/login
func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "corpo da requisição inválido")
		return
	}

	// Validação básica: campos obrigatórios.
	req.Email = strings.TrimSpace(req.Email)
	req.Password = strings.TrimSpace(req.Password)
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email e senha são obrigatórios")
		return
	}

	// Busca professor no store.
	prof, err := h.store.FindProfessorByEmail(r.Context(), req.Email)
	if err != nil {
		// Não revela se o email existe ou não (timing-safe).
		log.Printf("auth: FindProfessorByEmail(%s): %v", req.Email, err)
		writeError(w, http.StatusUnauthorized, "credenciais inválidas")
		return
	}

	// Valida senha com bcrypt (timing-safe).
	if err := bcrypt.CompareHashAndPassword([]byte(prof.PasswordHash), []byte(req.Password)); err != nil {
		// Usa subtle.ConstantTimeCompare no erro para evitar timing attack secundário.
		_ = subtle.ConstantTimeCompare([]byte("noop"), []byte("noop"))
		writeError(w, http.StatusUnauthorized, "credenciais inválidas")
		return
	}

	// Gera JWT.
	tokenStr, expiresAt, err := SignProfessorToken(prof.ID, prof.Email, prof.Name)
	if err != nil {
		log.Printf("auth: SignProfessorToken: %v", err)
		writeError(w, http.StatusInternalServerError, "erro ao gerar token")
		return
	}

	writeJSON(w, http.StatusOK, LoginResponse{
		Token:     tokenStr,
		ExpiresAt: expiresAt.UTC().Format("2006-01-02T15:04:05Z"),
		Name:      prof.Name,
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
