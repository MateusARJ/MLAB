package room

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"
)

// Erros do store.
var (
	ErrRoomNotFound       = errors.New("sala não encontrada")
	ErrRoomClosed         = errors.New("sala já encerrada")
	ErrParticipantLimit   = errors.New("sala cheia")
	ErrNotOwner           = errors.New("professor não é dono desta sala")
)

// Store é a interface de persistência do módulo room.
// Implementação concreta: inMemoryStore (dev) → PostgreSQL store (produção).
type Store interface {
	// Sala
	CreateRoom(ctx context.Context, room *Room) error
	GetRoomByID(ctx context.Context, roomID string) (*Room, error)
	GetRoomBySlug(ctx context.Context, slug string) (*Room, error)
	UpdateRoomStatus(ctx context.Context, roomID string, status Status, closedAt *time.Time) error

	// Participantes
	AddParticipant(ctx context.Context, p *Participant) error
	CountParticipants(ctx context.Context, roomID string) (int, error)
}

// ── InMemoryStore ─────────────────────────────────────────────────────────────

type inMemoryStore struct {
	mu           sync.RWMutex
	rooms        map[string]*Room        // por ID
	slugIndex    map[string]string       // slug → roomID
	participants map[string][]*Participant // roomID → lista
}

// NewInMemoryStore cria um store em memória para desenvolvimento.
func NewInMemoryStore() Store {
	return &inMemoryStore{
		rooms:        make(map[string]*Room),
		slugIndex:    make(map[string]string),
		participants: make(map[string][]*Participant),
	}
}

func (s *inMemoryStore) CreateRoom(_ context.Context, room *Room) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rooms[room.ID] = room
	s.slugIndex[room.Slug] = room.ID
	return nil
}

func (s *inMemoryStore) GetRoomByID(_ context.Context, roomID string) (*Room, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.rooms[roomID]
	if !ok {
		return nil, ErrRoomNotFound
	}
	copy := *r
	return &copy, nil
}

func (s *inMemoryStore) GetRoomBySlug(_ context.Context, slug string) (*Room, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.slugIndex[slug]
	if !ok {
		return nil, ErrRoomNotFound
	}
	r := s.rooms[id]
	copy := *r
	return &copy, nil
}

func (s *inMemoryStore) UpdateRoomStatus(_ context.Context, roomID string, status Status, closedAt *time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.rooms[roomID]
	if !ok {
		return ErrRoomNotFound
	}
	r.Status = status
	r.ClosedAt = closedAt
	return nil
}

func (s *inMemoryStore) AddParticipant(_ context.Context, p *Participant) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.participants[p.RoomID] = append(s.participants[p.RoomID], p)
	return nil
}

func (s *inMemoryStore) CountParticipants(_ context.Context, roomID string) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.participants[roomID]), nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// newID gera um ID hexadecimal aleatório de 16 bytes.
func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("room: falha ao gerar ID: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// slugWords é o vocabulário para geração de slugs legíveis.
var slugWords = []string{
	"alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
	"golf", "hotel", "india", "juliet", "kilo", "lima",
	"mango", "nova", "oscar", "papa", "quebec", "romeo",
	"sierra", "tango", "uniform", "victor", "whiskey", "xray",
	"yankee", "zulu",
}

// newSlug gera um slug legível do tipo "charlie-delta-7342".
func newSlug() string {
	pick := func() string {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(slugWords))))
		return slugWords[n.Int64()]
	}
	suffix, _ := rand.Int(rand.Reader, big.NewInt(9000))
	suffix = new(big.Int).Add(suffix, big.NewInt(1000))
	return fmt.Sprintf("%s-%s-%s", pick(), pick(), suffix.String())
}

// buildLink constrói a URL pública da sala.
func buildLink(baseURL, slug string) string {
	base := strings.TrimRight(baseURL, "/")
	return fmt.Sprintf("%s/sala/%s/entrar", base, slug)
}
