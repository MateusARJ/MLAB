# Tasks: Remoção da Claim `email` do JWT do Professor

Feature: `015-remove-claim-email`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados; ADR 0009 aprovada
Status: DONE

Regras:
- `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes antes do `[x]`;
- um commit atômico por task, com `Ref: T15x` e `Refs #42`.

### T151 — Emitir o token do professor sem `email`
[x] T151
Allowed Paths: `apps/backend/internal/auth/{jwt,handler,auth_test,auth_security_test}.go`,
`apps/backend/internal/room/{room_test,files_test,room_security_test}.go`
Prohibited Paths: `apps/backend/internal/room/{handler,store}.go`, `apps/backend/internal/signaling/**`,
`apps/backend/cmd/**`, `apps/backend/go.mod`, `apps/desktop/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] Assinaturas sem `email` (C-154); `handler.go` chama `SignProfessorToken(profID, name)`.
- [x] Todas as chamadas de `SignProfessorToken` e `ProfessorMapClaims` revisadas (nenhuma passa e-mail).
- [x] `TestSignAndParseProfessorToken` e `TestSessionEndpoint` exigem a ausência de `email` (RF-151).
- [x] `go vet ./...` e `go test -count=1 ./...` verdes.

### T152 — Remover o fallback do slug pelo e-mail
[x] T152
Depends On: T151
Allowed Paths: `apps/backend/internal/room/{handler,store,room_test}.go`
Prohibited Paths: `apps/backend/internal/auth/**`, `apps/backend/internal/signaling/**`, `apps/backend/cmd/**`,
`apps/backend/go.mod`, `apps/desktop/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] Ramo `claims["email"]` e `slugFromEmail` removidos; `TestSlugFromEmail` removido.
- [x] `TestCreateRoomFixedSlug` sem nome no token continua em `matematica/professor` (RF-152, C-152).
- [x] `go vet ./...` e `go test -count=1 ./...` verdes.

### T153 — Remover o fallback do nome pelo e-mail no signaling
[x] T153
Depends On: T151
Allowed Paths: `apps/backend/internal/signaling/handler.go`, `apps/backend/internal/signaling/handler_test.go`
Prohibited Paths: `apps/backend/internal/auth/**`, `apps/backend/internal/room/**`, `apps/backend/cmd/**`,
`apps/backend/go.mod`, `apps/desktop/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] Ramo `claims["email"]` removido de `extractName`.
- [x] Teste de `extractName`: com `name` → o nome; sem `name` e com `email` → `"Participante"` (RF-152, C-153).
- [x] `go vet ./...` e `go test -count=1 ./...` verdes.

### T154 — Incrementar a versão (PATCH)
[x] T154
Depends On: T151, T152, T153
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/backend/**` (exceto `apps/backend/package.json`), `apps/desktop/src/**`,
`apps/web/src/**`, `packages/*/src/**`
Checks:
- [x] `npm run bump -- patch` e `npm run version:check` com sucesso (1.10.0 → 1.10.1).

### T155 — Converge
[x] T155
Depends On: T151, T152, T153, T154
Allowed Paths: `spec-kit/specs/015-remove-claim-email/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`
Checks:
- [x] `git grep -n '"email"\|slugFromEmail' -- apps/backend` só encontra os testes do `/auth/login` removido, as
  asserções de ausência da claim e o caso "sem name e com email" de `TestExtractName`.
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH).
- [x] `npm run spec:check` com PASS.
