# Tasks: Formatação do Backend com gofmt

Feature: `014-gofmt-backend`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes antes do `[x]`;
- um commit atômico por task, com `Ref: T14x` e `Refs #41`.

### T141 — Formatar o backend com gofmt
[x] T141
Allowed Paths: `apps/backend/internal/chat/profanity.go`, `apps/backend/internal/room/{files,model,network,store}.go`,
`apps/backend/internal/signaling/{hub,hub_test,message}.go`, `apps/backend/internal/webrtc/room.go`
Prohibited Paths: demais `.go` de `apps/backend`, `apps/backend/go.mod`, `apps/backend/go.sum`, `apps/desktop/**`,
`apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] `gofmt -w` nos 9 arquivos; `git diff -w --ignore-blank-lines` vazio (RNF-141). Commit `9b8c4a4`.
- [x] `gofmt -l` sobre os blobs de `HEAD` de todos os `.go` de `apps/backend` vazio (RF-141).
- [x] `go build ./...`, `go vet ./...` e `go test -count=1 ./...` verdes (6 pacotes).

### T142 — Converge
[x] T142
Depends On: T141
Allowed Paths: `spec-kit/specs/014-gofmt-backend/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (nenhum).
- [x] `npm run spec:check` com PASS.
