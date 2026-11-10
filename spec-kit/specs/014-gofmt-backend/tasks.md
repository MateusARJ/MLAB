# Tasks: Formatação do Backend com gofmt

Feature: `014-gofmt-backend`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes antes do `[x]`;
- um commit atômico por task, com `Ref: T14x` e `Refs #41`.

### T141 — Formatar o backend com gofmt
[ ] T141
Allowed Paths: `apps/backend/internal/chat/profanity.go`, `apps/backend/internal/room/{files,model,network,store}.go`,
`apps/backend/internal/signaling/{hub,hub_test,message}.go`, `apps/backend/internal/webrtc/room.go`
Prohibited Paths: demais `.go` de `apps/backend`, `apps/backend/go.mod`, `apps/backend/go.sum`, `apps/desktop/**`,
`apps/web/**`, `packages/**`, `package.json`
Checks:
- [ ] `gofmt -w` nos 9 arquivos; `git diff -w --stat` vazio (RNF-141).
- [ ] `gofmt -l` sobre os blobs de `HEAD` de todos os `.go` de `apps/backend` vazio (RF-141).
- [ ] `go build ./...`, `go vet ./...` e `go test -count=1 ./...` verdes.

### T142 — Converge
[ ] T142
Depends On: T141
Allowed Paths: `spec-kit/specs/014-gofmt-backend/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (nenhum).
- [ ] `npm run spec:check` com PASS.
