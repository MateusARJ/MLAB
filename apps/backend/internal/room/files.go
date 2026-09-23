package room

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/screenshare/classroom/internal/auth"
)

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

// FileStore armazena os arquivos das salas em memória de forma segura para concorrência.
type FileStore struct {
	mu    sync.RWMutex
	files map[string][]*RoomFile // roomID -> list of files
}

func newFileStore() *FileStore {
	return &FileStore{
		files: make(map[string][]*RoomFile),
	}
}

func (fs *FileStore) Add(f *RoomFile) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	fs.files[f.RoomID] = append(fs.files[f.RoomID], f)
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

	// Limite de 50 MB por upload
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "erro ao processar upload (máximo 50MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "campo 'file' ausente no formulário")
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "erro ao ler dados do arquivo")
		return
	}

	fileName := filepath.Base(header.Filename)
	if fileName == "" || fileName == "." {
		fileName = "arquivo"
	}

	fileID := newID()
	downloadURL := fmt.Sprintf("/rooms/%s/files/%s/download", roomID, fileID)

	roomFile := &RoomFile{
		ID:          fileID,
		RoomID:      roomID,
		Name:        fileName,
		Size:        int64(len(data)),
		ContentType: header.Header.Get("Content-Type"),
		URL:         downloadURL,
		UploadedAt:  time.Now().UTC(),
		Data:        data,
	}

	if h.fileStore != nil {
		h.fileStore.Add(roomFile)
	}

	// Notifica via WebSocket todos os participantes conectados na sala
	if h.fileBroadcaster != nil {
		h.fileBroadcaster(roomID, roomFile.ID, roomFile.Name, roomFile.Size, roomFile.URL)
	}

	log.Printf("room[%s]: arquivo '%s' (%d bytes) compartilhado pelo professor", roomID, fileName, len(data))
	writeJSON(w, http.StatusCreated, roomFile)
}

// listFiles lista todos os arquivos compartilhados na sala.
// GET /rooms/{roomId}/files
func (h *Handler) listFiles(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("roomId")
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

// downloadFile entrega o conteúdo do arquivo para download.
// GET /rooms/{roomId}/files/{fileId}/download
func (h *Handler) downloadFile(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("roomId")
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

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", f.Name))
	if f.ContentType != "" {
		w.Header().Set("Content-Type", f.ContentType)
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}
	w.Header().Set("Content-Length", fmt.Sprintf("%d", f.Size))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(f.Data)
}
