package room

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/screenshare/classroom/internal/auth"
)

// TestRoomSecurity_AccessControl valida restrições de propriedade e papéis em salas (ADR 0004 §2.2.2).
func TestRoomSecurity_AccessControl(t *testing.T) {
	t.Setenv("JWT_SECRET", "security-test-secret-12345")

	store := NewInMemoryStore()
	handler := NewHandler(store)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	handler.RegisterProtectedRoutes(mux, auth.Middleware)

	// Cria uma sala cujo dono é prof-legitimo
	targetRoom := &Room{
		ID:              "room-sec-1",
		Slug:            "security-room-1234",
		OwnerID:         "prof-legitimo",
		Status:          StatusWaiting,
		MaxParticipants: 50,
		CreatedAt:       time.Now().UTC(),
	}
	if err := store.CreateRoom(nil, targetRoom); err != nil {
		t.Fatalf("failed to setup room in store: %v", err)
	}

	profLegitimoToken, _, _ := auth.SignProfessorToken("prof-legitimo")
	profAttackerToken, _, _ := auth.SignProfessorToken("prof-intruso")
	studClaims := auth.StudentMapClaims("student-1", "Aluno Teste", "RA-999", "room-sec-1")
	studToken, _ := auth.SignToken(studClaims)

	// 1. Aluno tentando chamar POST /rooms/{id}/close -> deve retornar 403 Forbidden
	reqCloseStudent := httptest.NewRequest("POST", "/rooms/room-sec-1/close", nil)
	reqCloseStudent.Header.Set("Authorization", "Bearer "+studToken)
	recCloseStudent := httptest.NewRecorder()
	mux.ServeHTTP(recCloseStudent, reqCloseStudent)

	if recCloseStudent.Code != http.StatusForbidden {
		t.Errorf("security violation: student was not forbidden from closing room, got %d", recCloseStudent.Code)
	}

	// 2. Professor invasor tentando fechar sala de outro professor -> 403 Forbidden
	reqCloseIntruso := httptest.NewRequest("POST", "/rooms/room-sec-1/close", nil)
	reqCloseIntruso.Header.Set("Authorization", "Bearer "+profAttackerToken)
	recCloseIntruso := httptest.NewRecorder()
	mux.ServeHTTP(recCloseIntruso, reqCloseIntruso)

	if recCloseIntruso.Code != http.StatusForbidden {
		t.Errorf("security violation: non-owner professor was able to close room, got %d", recCloseIntruso.Code)
	}

	// 3. Professor invasor tentando obter link de sala alheia -> 403 Forbidden
	reqLinkIntruso := httptest.NewRequest("GET", "/rooms/room-sec-1/link", nil)
	reqLinkIntruso.Header.Set("Authorization", "Bearer "+profAttackerToken)
	recLinkIntruso := httptest.NewRecorder()
	mux.ServeHTTP(recLinkIntruso, reqLinkIntruso)

	if recLinkIntruso.Code != http.StatusForbidden {
		t.Errorf("security violation: non-owner professor was able to get link of another room, got %d", recLinkIntruso.Code)
	}

	// 4. Acesso sem credenciais em rotas protegidas -> 401 Unauthorized
	reqNoAuth := httptest.NewRequest("POST", "/rooms", bytes.NewReader([]byte("{}")))
	recNoAuth := httptest.NewRecorder()
	mux.ServeHTTP(recNoAuth, reqNoAuth)

	if recNoAuth.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized without token, got %d", recNoAuth.Code)
	}

	// 5. Dono legítimo consegue obter link normalmente -> 200 OK
	reqLinkOwner := httptest.NewRequest("GET", "/rooms/room-sec-1/link", nil)
	reqLinkOwner.Header.Set("Authorization", "Bearer "+profLegitimoToken)
	recLinkOwner := httptest.NewRecorder()
	mux.ServeHTTP(recLinkOwner, reqLinkOwner)

	if recLinkOwner.Code != http.StatusOK {
		t.Errorf("expected 200 OK for legitimate room owner, got %d", recLinkOwner.Code)
	}
}
