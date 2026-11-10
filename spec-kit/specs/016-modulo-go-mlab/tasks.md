# Tasks: Nome do Módulo Go do Backend

Feature: `016-modulo-go-mlab`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes antes do `[x]`;
- um commit atômico por task, com `Ref: T16x` e `Refs #43`.

### T161 — Renomear o módulo Go e os imports
[ ] T161
Allowed Paths: `apps/backend/go.mod`, `apps/backend/cmd/server/main.go`,
`apps/backend/internal/room/{files,files_test,handler,room_security_test,room_test}.go`,
`apps/backend/internal/signaling/{handler,hub,signaling_security_test}.go`, `apps/backend/internal/webrtc/sfu.go`
Prohibited Paths: `apps/backend/go.sum`, demais `.go` de `apps/backend`, `docs/metrics/**`, `scripts/**`,
`apps/desktop/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [ ] `module github.com/MateusARJ/MLAB/apps/backend` no `go.mod`; imports trocados; `gofmt -l` vazio nos arquivos
  tocados.
- [ ] `git grep screenshare/classroom -- apps packages` vazio (RF-161); `go.sum` sem mudança.
- [ ] `go build ./...`, `go vet ./...` e `go test -count=1 ./...` verdes; `build:backend:win` gera o binário
  (RNF-161).

### T162 — Incrementar a versão (PATCH)
[ ] T162
Depends On: T161
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/backend/**`, `apps/desktop/src/**`, `apps/web/src/**`, `packages/*/src/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check` com sucesso.

### T163 — Converge
[ ] T163
Depends On: T161, T162
Allowed Paths: `spec-kit/specs/016-modulo-go-mlab/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH).
- [ ] `npm run spec:check` com PASS.
