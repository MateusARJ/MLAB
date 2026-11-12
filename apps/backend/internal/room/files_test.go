package room

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
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

// uploadRaw envia um arquivo com conteúdo e Content-Type da parte escolhidos pelo teste (022).
func (f *filesFixture) uploadRaw(t *testing.T, name, partContentType string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="file"; filename="`+name+`"`)
	h.Set("Content-Type", partContentType)
	part, err := mw.CreatePart(h)
	if err != nil {
		t.Fatalf("create part: %v", err)
	}
	_, _ = part.Write(data)
	_ = mw.Close()

	req := httptest.NewRequest("POST", "/rooms/"+f.roomID+"/files", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+f.profToken)
	rec := httptest.NewRecorder()
	f.mux.ServeHTTP(rec, req)
	return rec
}

func (f *filesFixture) list(t *testing.T) []RoomFile {
	t.Helper()
	rec := f.get("/rooms/"+f.roomID+"/files", f.profToken)
	var files []RoomFile
	if err := json.NewDecoder(rec.Body).Decode(&files); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	return files
}

func TestFiles_BlockedTypesRejectedWith415(t *testing.T) {
	cases := []struct {
		name string
		data []byte
	}{
		{"setup.exe", []byte("qualquer conteudo")},
		{"instalar.MSI", []byte("qualquer conteudo")},
		{"rodar.bat", []byte("@echo off")},
		{"script.ps1", []byte("Write-Host oi")},
		{"atalho.lnk", []byte("L\x00\x00\x00")},
		{"setup.exe.", []byte("qualquer conteudo")},
		{"trabalho.pdf.exe", []byte("%PDF-1.7")},
		{"notas.pdf", []byte("MZ\x90\x00 executavel renomeado")},
		{"programa", []byte("\x7fELF\x02\x01")},
		{"app.zip", []byte{0xCF, 0xFA, 0xED, 0xFE, 0x07}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newFilesFixture(t)
			var shared []string
			f.handler.SetFileBroadcaster(func(_, _, name string, _ int64, _ string) { shared = append(shared, name) })

			rec := f.uploadRaw(t, tc.name, "application/pdf", tc.data)
			if rec.Code != http.StatusUnsupportedMediaType {
				t.Fatalf("expected 415, got %d: %s", rec.Code, rec.Body.String())
			}
			var body map[string]string
			_ = json.NewDecoder(rec.Body).Decode(&body)
			if body["error"] != errBlockedFileTypeMsg {
				t.Errorf("expected error %q, got %q", errBlockedFileTypeMsg, body["error"])
			}
			if files := f.list(t); len(files) != 0 {
				t.Errorf("blocked file must not be listed, got %+v", files)
			}
			if len(shared) != 0 {
				t.Errorf("blocked file must not be broadcast, got %v", shared)
			}
		})
	}
}

func TestFiles_AllowedTypesAcceptedWithServerContentType(t *testing.T) {
	cases := []struct {
		name, wantType string
		data           []byte
	}{
		{"apostila.pdf", "application/pdf", []byte("%PDF-1.7")},
		{"diagrama.png", "image/png", []byte("\x89PNG\r\n\x1a\n")},
		{"texto.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", []byte("PK\x03\x04")},
		// código-fonte é material de aula (C-2202, RN-2202)
		{"main.js", "application/octet-stream", []byte("console.log('oi')")},
		{"aula.py", "application/octet-stream", []byte("print('oi')")},
		{"app.ts", "application/octet-stream", []byte("export {}")},
		{"build.sh", "application/octet-stream", []byte("#!/bin/sh\necho oi")},
		{"Main.java", "application/octet-stream", []byte("class Main {}")},
		{"vazio.txt", "text/plain; charset=utf-8", nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newFilesFixture(t)
			// O Content-Type declarado pelo cliente é falso e deve ser ignorado (RF-2204).
			rec := f.uploadRaw(t, tc.name, "text/html", tc.data)
			if rec.Code != http.StatusCreated {
				t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
			}
			var rf RoomFile
			_ = json.NewDecoder(rec.Body).Decode(&rf)
			if rf.ContentType != tc.wantType {
				t.Errorf("upload content_type = %q, want %q", rf.ContentType, tc.wantType)
			}
			if files := f.list(t); len(files) != 1 || files[0].ContentType != tc.wantType {
				t.Errorf("list content_type = %+v, want %q", files, tc.wantType)
			}
		})
	}
}

func TestFiles_DownloadHeadersDefinedByServer(t *testing.T) {
	f := newFilesFixture(t)
	rec := f.uploadRaw(t, "revisão-ação.pdf", "text/html", []byte("%PDF-1.7 conteudo"))
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var rf RoomFile
	_ = json.NewDecoder(rec.Body).Decode(&rf)

	dl := f.get(rf.URL, f.studentToken)
	if dl.Code != http.StatusOK {
		t.Fatalf("download: expected 200, got %d", dl.Code)
	}
	want := map[string]string{
		"Content-Type":            "application/pdf",
		"Content-Disposition":     `attachment; filename="revis_o-a__o.pdf"; filename*=UTF-8''revis%C3%A3o-a%C3%A7%C3%A3o.pdf`,
		"X-Content-Type-Options":  "nosniff",
		"Content-Security-Policy": "sandbox",
		"Cache-Control":           "no-store",
	}
	for header, value := range want {
		if got := dl.Header().Get(header); got != value {
			t.Errorf("%s = %q, want %q", header, got, value)
		}
	}
	if dl.Body.String() != "%PDF-1.7 conteudo" {
		t.Errorf("unexpected body %q", dl.Body.String())
	}
}
