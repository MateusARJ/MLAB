package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// ErrProfessorNotFound é retornado quando nenhum professor é encontrado.
var ErrProfessorNotFound = errors.New("professor não encontrado")

// inMemoryStore é uma implementação em memória do Store para desenvolvimento.
// NÃO usar em produção — substituir pela implementação PostgreSQL em T009.
type inMemoryStore struct {
	mu         sync.RWMutex
	professors map[string]*Professor // chave: email
}

// NewInMemoryStore cria um store em memória com um professor padrão para testes.
//
// Credenciais padrão:
//
//	email:    professor@screenshare.local
//	senha:    professor123
//
// AVISO: credenciais de desenvolvimento — não usar em produção.
func NewInMemoryStore() Store {
	hash, _ := bcrypt.GenerateFromPassword([]byte("professor123"), bcrypt.DefaultCost)
	id := newID()

	s := &inMemoryStore{
		professors: make(map[string]*Professor),
	}
	defaultProf := &Professor{
		ID:           id,
		Email:        "professor@mlab.local",
		Name:         "Professor",
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
	}
	s.professors["professor@mlab.local"] = defaultProf
	s.professors["professor@screenshare.local"] = &Professor{
		ID:           id,
		Email:        "professor@screenshare.local",
		Name:         "Professor",
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
	}
	return s
}

// FindProfessorByEmail busca um professor pelo email.
// Retorna ErrProfessorNotFound se não existir.
func (s *inMemoryStore) FindProfessorByEmail(_ context.Context, email string) (*Professor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	prof, ok := s.professors[email]
	if !ok {
		return nil, ErrProfessorNotFound
	}
	// Retorna cópia para evitar mutação externa.
	copy := *prof
	return &copy, nil
}

// newID gera um ID hexadecimal aleatório de 16 bytes.
func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("auth: falha ao gerar ID: " + err.Error())
	}
	return hex.EncodeToString(b)
}
