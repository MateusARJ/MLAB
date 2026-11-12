package room

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MateusARJ/MLAB/apps/backend/internal/auth"
)

// filesFixture monta um servidor com uma sala criada pelo professor "prof-owner" e tokens prontos.
type filesFixture struct {
	mux          *http.ServeMux
	handler      *Handler
	roomID       string
	profToken    string
	studentToken string
}

func newFilesFixture(t *testing.T) *filesFixture {
	t.Helper()
	t.Setenv("JWT_SECRET", "test-secret-files-12345")

	handler := NewHandler(NewInMemoryStore())
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	handler.RegisterProtectedRoutes(mux, auth.Middleware)

	profToken, _, err := auth.SignProfessorToken("prof-owner", "Professor Arquivos")
	if err != nil {
		t.Fatalf("sign professor token: %v", err)
	}

	req := httptest.NewRequest("POST", "/rooms", bytes.NewReader([]byte(`{"title":"Turma Arquivos","max_participants":10}`)))
	req.Header.Set("Authorization", "Bearer "+profToken)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create room: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var created CreateRoomResponse
	_ = json.NewDecoder(rec.Body).Decode(&created)

	studentToken, err := auth.SignToken(auth.StudentMapClaims("aluno-1", "Aluno Um", "2025116TADS0001", created.RoomID))
	if err != nil {
		t.Fatalf("sign student token: %v", err)
	}

	return &filesFixture{mux: mux, handler: handler, roomID: created.RoomID, profToken: profToken, studentToken: studentToken}
}

func (f *filesFixture) upload(t *testing.T, name string, size int) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("file", name)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	_, _ = part.Write(bytes.Repeat([]byte("a"), size))
	_ = mw.Close()

	req := httptest.NewRequest("POST", "/rooms/"+f.roomID+"/files", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+f.profToken)
	rec := httptest.NewRecorder()
	f.mux.ServeHTTP(rec, req)
	return rec
}

func (f *filesFixture) uploadOK(t *testing.T, name string, size int) RoomFile {
	t.Helper()
	rec := f.upload(t, name, size)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload %s: expected 201, got %d: %s", name, rec.Code, rec.Body.String())
	}
	var rf RoomFile
	_ = json.NewDecoder(rec.Body).Decode(&rf)
	return rf
}

func (f *filesFixture) get(path, bearer string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", path, nil)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	rec := httptest.NewRecorder()
	f.mux.ServeHTTP(rec, req)
	return rec
}

func TestFiles_ListAndDownloadRequireRoomToken(t *testing.T) {
	f := newFilesFixture(t)
	rf := f.uploadOK(t, "apostila.pdf", 1024)
	listPath := "/rooms/" + f.roomID + "/files"

	otherRoomStudent, _ := auth.SignToken(auth.StudentMapClaims("aluno-x", "Intruso", "2025116TADS0099", "outra-sala"))
	otherProf, _, _ := auth.SignProfessorToken("outro-prof", "Outro")

	cases := []struct {
		name   string
		path   string
		bearer string
		want   int
	}{
		{"listar sem token", listPath, "", http.StatusUnauthorized},
		{"baixar sem token", rf.URL, "", http.StatusUnauthorized},
		{"listar com token inválido", listPath, "nao-e-um-jwt", http.StatusUnauthorized},
		{"listar com aluno de outra sala", listPath, otherRoomStudent, http.StatusForbidden},
		{"baixar com aluno de outra sala", rf.URL, otherRoomStudent, http.StatusForbidden},
		{"listar com professor que não é dono", listPath, otherProf, http.StatusForbidden},
		{"listar com aluno da sala", listPath, f.studentToken, http.StatusOK},
		{"baixar com aluno da sala", rf.URL, f.studentToken, http.StatusOK},
		{"listar com professor dono", listPath, f.profToken, http.StatusOK},
		{"baixar com professor dono", rf.URL, f.profToken, http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if rec := f.get(tc.path, tc.bearer); rec.Code != tc.want {
				t.Fatalf("expected %d, got %d: %s", tc.want, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestFiles_DownloadAcceptsQueryTokenAndSetsNosniff(t *testing.T) {
	f := newFilesFixture(t)
	rf := f.uploadOK(t, "pagina.html", 64)

	rec := f.get(rf.URL+"?token="+f.studentToken, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with ?token=, got %d: %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("expected X-Content-Type-Options nosniff, got %q", got)
	}
	if got := rec.Header().Get("Content-Disposition"); !strings.HasPrefix(got, "attachment;") {
		t.Errorf("expected attachment disposition, got %q", got)
	}
	if rec.Body.Len() != 64 {
		t.Errorf("expected 64 bytes, got %d", rec.Body.Len())
	}
}

func TestFiles_RoomLimits(t *testing.T) {
	t.Setenv(envRoomFilesMaxCount, "2")
	t.Setenv(envRoomFilesMaxMB, "1")
	f := newFilesFixture(t)

	f.uploadOK(t, "a.txt", 100)
	f.uploadOK(t, "b.txt", 100)
	if rec := f.upload(t, "c.txt", 100); rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("3rd file over count limit: expected 413, got %d: %s", rec.Code, rec.Body.String())
	}

	g := newFilesFixture(t)
	g.uploadOK(t, "grande-1.bin", 700<<10)
	if rec := g.upload(t, "grande-2.bin", 700<<10); rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("file over room byte limit: expected 413, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestFiles_FileAboveMaxSizeRejected(t *testing.T) {
	f := newFilesFixture(t)
	if rec := f.upload(t, "enorme.bin", int(maxFileBytes)+1); rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 for file above 50MB, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestFiles_ReleasedWhenRoomCloses(t *testing.T) {
	f := newFilesFixture(t)
	f.uploadOK(t, "material.pdf", 256)
	if n := len(f.handler.fileStore.List(f.roomID)); n != 1 {
		t.Fatalf("expected 1 file before close, got %d", n)
	}

	req := httptest.NewRequest("POST", "/rooms/"+f.roomID+"/close", nil)
	req.Header.Set("Authorization", "Bearer "+f.profToken)
	rec := httptest.NewRecorder()
	f.mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("close: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	if n := len(f.handler.fileStore.List(f.roomID)); n != 0 {
		t.Fatalf("expected files released after close, got %d", n)
	}
}

func TestFiles_ReleaseRoomFiles(t *testing.T) {
	f := newFilesFixture(t)
	f.uploadOK(t, "material.pdf", 256)
	f.handler.ReleaseRoomFiles(f.roomID)
	if n := len(f.handler.fileStore.List(f.roomID)); n != 0 {
		t.Fatalf("expected files released, got %d", n)
	}
}
