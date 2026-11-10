package room

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"sync"
	"time"
)

// Erros do store.
var (
	ErrRoomNotFound     = errors.New("sala não encontrada")
	ErrRoomClosed       = errors.New("sala já encerrada")
	ErrParticipantLimit = errors.New("sala cheia")
	ErrNotOwner         = errors.New("professor não é dono desta sala")
)

// Store é a interface de armazenamento do módulo room.
// Implementação única: inMemoryStore. O MLab não tem banco de dados; o estado vive em memória durante a
// execução do backend embarcado (ADR 0005).
type Store interface {
	// Sala
	CreateRoom(ctx context.Context, room *Room) error
	GetRoomByID(ctx context.Context, roomID string) (*Room, error)
	GetRoomBySlug(ctx context.Context, slug string) (*Room, error)
	GetRoomByOwnerID(ctx context.Context, ownerID string) (*Room, error)
	GetActiveRoom(ctx context.Context) (*Room, error)
	UpdateRoomStatus(ctx context.Context, roomID string, status Status, closedAt *time.Time) error
	DeleteRoom(ctx context.Context, roomID string) error

	// Participantes
	AddParticipant(ctx context.Context, p *Participant) error
	CountParticipants(ctx context.Context, roomID string) (int, error)
	// HasStudent indica se a matrícula já tem participante registrado na sala (RN-04).
	HasStudent(ctx context.Context, roomID, studentID string) (bool, error)
}

// ── InMemoryStore ─────────────────────────────────────────────────────────────

type inMemoryStore struct {
	mu           sync.RWMutex
	rooms        map[string]*Room          // por ID
	slugIndex    map[string]string         // slug → roomID
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
	if room.Slug != "" {
		s.slugIndex[room.Slug] = room.ID
	}
	if room.RoomSlug != "" && room.ProfessorSlug != "" {
		s.slugIndex[room.RoomSlug+"/"+room.ProfessorSlug] = room.ID
	}
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
	cleanSlug := strings.Trim(slug, "/")
	id, ok := s.slugIndex[cleanSlug]
	if !ok {
		for sKey, rID := range s.slugIndex {
			if strings.EqualFold(sKey, cleanSlug) {
				id = rID
				ok = true
				break
			}
		}
	}
	if !ok {
		for _, r := range s.rooms {
			if strings.EqualFold(r.Slug, cleanSlug) || (r.RoomSlug != "" && strings.EqualFold(r.RoomSlug, cleanSlug)) {
				id = r.ID
				ok = true
				break
			}
		}
	}
	if !ok {
		return nil, ErrRoomNotFound
	}
	r := s.rooms[id]
	copy := *r
	return &copy, nil
}

func (s *inMemoryStore) GetRoomByOwnerID(_ context.Context, ownerID string) (*Room, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.rooms {
		if r.OwnerID == ownerID {
			copy := *r
			return &copy, nil
		}
	}
	return nil, ErrRoomNotFound
}

// GetActiveRoom retorna a sala ativa de forma determinística (002-security-hardening/S5):
// prioriza salas em `publishing`; entre salas do mesmo status, vence a criada mais recentemente.
func (s *inMemoryStore) GetActiveRoom(_ context.Context) (*Room, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var best *Room
	for _, r := range s.rooms {
		if r.Status != StatusWaiting && r.Status != StatusPublishing {
			continue
		}
		if best == nil || activeRoomRank(r) > activeRoomRank(best) ||
			(activeRoomRank(r) == activeRoomRank(best) && r.CreatedAt.After(best.CreatedAt)) {
			best = r
		}
	}
	if best == nil {
		return nil, ErrRoomNotFound
	}
	copy := *best
	return &copy, nil
}

// activeRoomRank define a prioridade de uma sala ativa: publishing > waiting.
func activeRoomRank(r *Room) int {
	if r.Status == StatusPublishing {
		return 2
	}
	return 1
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
	if status == StatusClosed {
		// Ao encerrar a sala, remove imediatamente dos índices para que o link antigo dê 404
		if r.Slug != "" {
			delete(s.slugIndex, r.Slug)
		}
		if r.RoomSlug != "" && r.ProfessorSlug != "" {
			delete(s.slugIndex, r.RoomSlug+"/"+r.ProfessorSlug)
		}
	} else {
		if r.Slug != "" {
			s.slugIndex[r.Slug] = r.ID
		}
		if r.RoomSlug != "" && r.ProfessorSlug != "" {
			s.slugIndex[r.RoomSlug+"/"+r.ProfessorSlug] = r.ID
		}
	}
	return nil
}

func (s *inMemoryStore) DeleteRoom(_ context.Context, roomID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.rooms[roomID]
	if !ok {
		return nil
	}
	if r.Slug != "" {
		delete(s.slugIndex, r.Slug)
	}
	if r.RoomSlug != "" && r.ProfessorSlug != "" {
		delete(s.slugIndex, r.RoomSlug+"/"+r.ProfessorSlug)
	}
	delete(s.rooms, roomID)
	delete(s.participants, roomID)
	return nil
}

// AddParticipant registra o participante na sala. Se já existe um participante da mesma sala
// com a mesma matrícula (sem diferenciar maiúsculas), ele é substituído: é o mesmo aluno
// entrando de novo (RN-04), e não deve ocupar duas vagas.
func (s *inMemoryStore) AddParticipant(_ context.Context, p *Participant) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.participants[p.RoomID]
	if p.StudentID != "" {
		for i, existing := range list {
			if strings.EqualFold(existing.StudentID, p.StudentID) {
				list[i] = p
				return nil
			}
		}
	}
	s.participants[p.RoomID] = append(list, p)
	return nil
}

func (s *inMemoryStore) HasStudent(_ context.Context, roomID, studentID string) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if studentID == "" {
		return false, nil
	}
	for _, existing := range s.participants[roomID] {
		if strings.EqualFold(existing.StudentID, studentID) {
			return true, nil
		}
	}
	return false, nil
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

// removeAccents normaliza caracteres acentuados comuns.
func removeAccents(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch r {
		case 'á', 'à', 'ã', 'â', 'ä', 'Á', 'À', 'Ã', 'Â', 'Ä':
			b.WriteRune('a')
		case 'é', 'è', 'ê', 'ë', 'É', 'È', 'Ê', 'Ë':
			b.WriteRune('e')
		case 'í', 'ì', 'î', 'ï', 'Í', 'Ì', 'Î', 'Ï':
			b.WriteRune('i')
		case 'ó', 'ò', 'õ', 'ô', 'ö', 'Ó', 'Ò', 'Õ', 'Ô', 'Ö':
			b.WriteRune('o')
		case 'ú', 'ù', 'û', 'ü', 'Ú', 'Ù', 'Û', 'Ü':
			b.WriteRune('u')
		case 'ç', 'Ç':
			b.WriteRune('c')
		case 'ñ', 'Ñ':
			b.WriteRune('n')
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

// slugify transforma uma string qualquer (ex: "Algoritmos - Turma 04", "Prof. João")
// em um slug seguro e legível para URL (ex: "algoritmos-turma-04", "prof-joao").
func slugify(input string) string {
	input = removeAccents(strings.TrimSpace(strings.ToLower(input)))
	if input == "" {
		return ""
	}

	var b strings.Builder
	lastDash := false
	for _, r := range input {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
		} else {
			if !lastDash && b.Len() > 0 {
				b.WriteRune('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

// slugFromEmail gera um slug a partir da claim "email" do JWT do professor. Não existe login (ADR 0006): a
// claim tem valor fixo e serve só de fallback quando o nome do professor não vem na requisição nem no token.
func slugFromEmail(email string) string {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return "professor"
	}
	parts := strings.Split(email, "@")
	clean := slugify(parts[0])
	if clean == "" {
		return "professor"
	}
	return clean
}
