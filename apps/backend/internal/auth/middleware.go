package auth

import (
	"context"
	"net/http"
	"strings"
)

// contextKey é o tipo privado para chaves de contexto deste pacote.
type contextKey string

const claimsKey contextKey = "auth_claims"

// Middleware é um middleware HTTP que valida o Bearer JWT em rotas protegidas.
//
// Uso:
//
//	mux.Handle("GET /rooms", auth.Middleware(handler))
//
// Em caso de token ausente ou inválido, responde 401.
// Em caso de sucesso, injeta os claims no contexto da requisição.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenStr := extractBearer(r)
		if tokenStr == "" {
			writeError(w, http.StatusUnauthorized, "token de autenticação ausente")
			return
		}

		claims, err := ParseToken(tokenStr)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "token inválido ou expirado")
			return
		}

		// Injeta os claims no contexto para os handlers downstream.
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole é um middleware que verifica se o token tem o papel esperado.
// Deve ser usado APÓS Middleware.
//
//	mux.Handle("POST /rooms", auth.Middleware(auth.RequireRole(RoleProfessor, handler)))
func RequireRole(role Role, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "não autenticado")
			return
		}
		if ClaimRole(claims) != role {
			writeError(w, http.StatusForbidden, "permissão insuficiente")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ClaimsFromContext recupera os claims JWT do contexto da requisição.
// Retorna (nil, false) se o middleware não foi aplicado.
func ClaimsFromContext(ctx context.Context) (map[string]interface{}, bool) {
	v := ctx.Value(claimsKey)
	if v == nil {
		return nil, false
	}
	claims, ok := v.(map[string]interface{})
	return claims, ok
}

// extractBearer extrai o token do header Authorization: Bearer <token>.
func extractBearer(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(header, "Bearer ")
}
