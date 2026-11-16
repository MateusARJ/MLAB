package room

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
)

// Limites de arquivos (contracts/files.md — 003-classroom-interaction; 002-security-hardening/S4).
const (
	maxFileBytes             int64 = 50 << 20 // 50 MB por arquivo
	multipartOverheadBytes   int64 = 1 << 20  // margem para cabeçalhos multipart
	defaultRoomFilesMaxMB          = 300
	defaultRoomFilesMaxCount       = 50
	envRoomFilesMaxMB              = "MLAB_ROOM_FILES_MAX_MB"
	envRoomFilesMaxCount           = "MLAB_ROOM_FILES_MAX_COUNT"
)

// errRoomFilesLimit indica que a sala atingiu o teto de memória ou de quantidade de arquivos.
var errRoomFilesLimit = errors.New("limite de arquivos da sala atingido")

// RoomFile representa um arquivo compartilhado pelo professor com a turma.
type RoomFile struct {
	ID          string    `json:"id"`
	RoomID      string    `json:"room_id"`
	Name        string    `json:"name"`
	Size        int64     `json:"size"`
	ContentType string    `json:"content_type"`
	URL         string    `json:"url"`
	UploadedAt  time.Time `json:"uploaded_at"`
	Data        []byte    `json:"-"`
}

// FileBroadcasterFunc define a assinatura da função de broadcast para arquivos compartilhados.
type FileBroadcasterFunc func(roomID, id, name string, size int64, url string)

// FileStore armazena os arquivos das salas em memória de forma segura para concorrência,
// respeitando um teto de bytes e de quantidade por sala.
type FileStore struct {
	mu       sync.RWMutex
	files    map[string][]*RoomFile // roomID -> list of files
	maxBytes int64
	maxCount int
}

func newFileStore() *FileStore {
	return &FileStore{
		files:    make(map[string][]*RoomFile),
		maxBytes: int64(envInt(envRoomFilesMaxMB, defaultRoomFilesMaxMB)) << 20,
		maxCount: envInt(envRoomFilesMaxCount, defaultRoomFilesMaxCount),
	}
}

// envInt lê um inteiro positivo de uma variável de ambiente, com valor padrão.
func envInt(name string, def int) int {
	if v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(name))); err == nil && v > 0 {
		return v
	}
	return def
}

// Add guarda o arquivo se a sala ainda couber nos limites; caso contrário retorna errRoomFilesLimit.
func (fs *FileStore) Add(f *RoomFile) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	list := fs.files[f.RoomID]
	if len(list)+1 > fs.maxCount {
		return errRoomFilesLimit
	}
	var total int64
	for _, existing := range list {
		total += existing.Size
	}
	if total+f.Size > fs.maxBytes {
		return errRoomFilesLimit
	}
	fs.files[f.RoomID] = append(list, f)
	return nil
}

func (fs *FileStore) List(roomID string) []*RoomFile {
	fs.mu.RLock()
	defer fs.mu.RUnlock()
	list := fs.files[roomID]
	res := make([]*RoomFile, len(list))
	copy(res, list)
	return res
}

func (fs *FileStore) Get(roomID, fileID string) *RoomFile {
	fs.mu.RLock()
	defer fs.mu.RUnlock()
	for _, f := range fs.files[roomID] {
		if f.ID == fileID {
			return f
		}
	}
	return nil
}

// RemoveRoom libera da memória todos os arquivos de uma sala.
func (fs *FileStore) RemoveRoom(roomID string) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	delete(fs.files, roomID)
}

// ReleaseRoomFiles libera os arquivos de uma sala encerrada. Usado pelo encerramento via REST,
// pela substituição da sala do professor e pelo encerramento via WebSocket (hub de sinalização).
func (h *Handler) ReleaseRoomFiles(roomID string) {
	if h.fileStore != nil {
		h.fileStore.RemoveRoom(roomID)
	}
}

// ── Autorização de leitura ────────────────────────────────────────────────────

// fileAccessToken extrai o JWT do header Authorization (Bearer) ou do parâmetro ?token=,
// que permite links de download no navegador (contracts/files.md, C-205).
func fileAccessToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return r.URL.Query().Get("token")
}

// authorizeFileRead valida que o portador do token pertence à sala: aluno com room_id da sala
// ou professor dono. Retorna o ID canônico da sala, ou escreve o erro e retorna false.
func (h *Handler) authorizeFileRead(w http.ResponseWriter, r *http.Request) (string, bool) {
	tokenStr := fileAccessToken(r)
	if tokenStr == "" {
		writeError(w, http.StatusUnauthorized, "token de acesso ausente")
		return "", false
	}
	claims, err := auth.ParseToken(tokenStr)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "token inválido ou expirado")
		return "", false
	}

	identifier := r.PathValue("roomId")
	rm, err := h.store.GetRoomByID(r.Context(), identifier)
	if err != nil {
		rm, err = h.store.GetRoomBySlug(r.Context(), identifier)
	}
	if err != nil {
		writeError(w, http.StatusNotFound, "sala não encontrada")
		return "", false
	}

	switch auth.ClaimRole(claims) {
	case auth.RoleAluno:
		if auth.ClaimRoomID(claims) == rm.ID {
			return rm.ID, true
		}
	case auth.RoleProfessor:
		if auth.ClaimSub(claims) == rm.OwnerID {
			return rm.ID, true
		}
	}
	writeError(w, http.StatusForbidden, "token não pertence a esta sala")
	return "", false
}

// ── Handlers de Arquivos ──────────────────────────────────────────────────────

// uploadFile permite ao professor enviar arquivos para a turma.
// POST /rooms/{roomId}/files
func (h *Handler) uploadFile(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok || auth.ClaimRole(claims) != auth.RoleProfessor {
		writeError(w, http.StatusForbidden, "apenas professores podem enviar arquivos")
		return
	}

	roomID := r.PathValue("roomId")
	rm, err := h.store.GetRoomByID(r.Context(), roomID)
	if err != nil {
		writeError(w, http.StatusNotFound, "sala não encontrada")
		return
	}
	if rm.OwnerID != auth.ClaimSub(claims) {
		writeError(w, http.StatusForbidden, "você não é o dono desta sala")
		return
	}

	// Limita o corpo da requisição: 50 MB por arquivo + margem multipart.
	r.Body = http.MaxBytesReader(w, r.Body, maxFileBytes+multipartOverheadBytes)
	if err := r.ParseMultipartForm(maxFileBytes); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "arquivo acima do limite de 50MB")
			return
		}
		writeError(w, http.StatusBadRequest, "erro ao processar upload (máximo 50MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "campo 'file' ausente no formulário")
		return
	}
	defer file.Close()

	fileName := filepath.Base(header.Filename)
	if fileName == "" || fileName == "." {
		fileName = "arquivo"
	}

	// Executáveis e instaladores são recusados pela extensão antes de ler o conteúdo (022/RF-2201).
	if isBlockedExtension(fileName) {
		writeError(w, http.StatusUnsupportedMediaType, errBlockedFileTypeMsg)
		return
	}

	data, err := io.ReadAll(io.LimitReader(file, maxFileBytes+1))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "erro ao ler dados do arquivo")
		return
	}
	if int64(len(data)) > maxFileBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "arquivo acima do limite de 50MB")
		return
	}

	// Executável renomeado: a assinatura do conteúdo vale mais que o nome (022/RF-2202).
	if hasExecutableSignature(data) {
		writeError(w, http.StatusUnsupportedMediaType, errBlockedFileTypeMsg)
		return
	}

	fileID := newID()
	downloadURL := fmt.Sprintf("/rooms/%s/files/%s/download", roomID, fileID)

	roomFile := &RoomFile{
		ID:     fileID,
		RoomID: roomID,
		Name:   fileName,
		Size:   int64(len(data)),
		// Definido pelo servidor; o Content-Type declarado pelo cliente é ignorado (022/RF-2204, AGENTS §8).
		ContentType: serverContentType(fileName),
		URL:         downloadURL,
		UploadedAt:  time.Now().UTC(),
		Data:        data,
	}

	if h.fileStore != nil {
		if err := h.fileStore.Add(roomFile); err != nil {
			writeError(w, http.StatusRequestEntityTooLarge, "limite de arquivos da sala atingido")
			return
		}
	}

	// Notifica via WebSocket todos os participantes conectados na sala
	if h.fileBroadcaster != nil {
		h.fileBroadcaster(roomID, roomFile.ID, roomFile.Name, roomFile.Size, roomFile.URL)
	}

	log.Printf("room[%s]: arquivo '%s' (%d bytes) compartilhado pelo professor", roomID, fileName, len(data))
	writeJSON(w, http.StatusCreated, roomFile)
}

// listFiles lista todos os arquivos compartilhados na sala. Exige token da sala.
// GET /rooms/{roomId}/files
func (h *Handler) listFiles(w http.ResponseWriter, r *http.Request) {
	roomID, ok := h.authorizeFileRead(w, r)
	if !ok {
		return
	}
	if h.fileStore == nil {
		writeJSON(w, http.StatusOK, []*RoomFile{})
		return
	}

	files := h.fileStore.List(roomID)
	if files == nil {
		files = []*RoomFile{}
	}
	writeJSON(w, http.StatusOK, files)
}

// downloadFile entrega o conteúdo do arquivo para download. Exige token da sala.
// GET /rooms/{roomId}/files/{fileId}/download
func (h *Handler) downloadFile(w http.ResponseWriter, r *http.Request) {
	roomID, ok := h.authorizeFileRead(w, r)
	if !ok {
		return
	}
	fileID := r.PathValue("fileId")

	if h.fileStore == nil {
		http.NotFound(w, r)
		return
	}

	f := h.fileStore.Get(roomID, fileID)
	if f == nil {
		http.NotFound(w, r)
		return
	}

	// Headers definidos pelo servidor (contracts/files.md da 003; 022/RF-2205).
	w.Header().Set("Content-Disposition", contentDisposition(f.Name))
	w.Header().Set("Content-Type", serverContentType(f.Name))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "sandbox")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", f.Size))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(f.Data)
}
