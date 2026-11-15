# Tasks: Leitura Sincronizada do Status do Hub

Feature: `036-status-hub-sincronizado`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `go test ./...` e `go vet ./...` em `apps/backend`; `gofmt -l` vazio nos arquivos Go alterados antes de marcar
  `[x]`;
- um commit atômico por task, com `Ref: T360x` e `Refs #102`.

### T3601 — Status do hub com escrita e leitura sincronizadas
[x] T3601
Allowed Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
`spec-kit/specs/036-status-hub-sincronizado/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/message.go`, `apps/backend/internal/room/**`,
`apps/backend/internal/webrtc/**`, `apps/backend/cmd/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`,
`.github/**`, `package.json`
Checks:
- [x] `statusMu sync.RWMutex`; `writeStatus` é o único ponto que atribui `h.status` (RF-3601).
- [x] `setStatus`, `onPublisherTimeout` e `onRoomClose` usam `writeStatus`; callbacks fora do lock (RNF-3602).
- [x] `isClosed()` lê sob `RLock`; `getOrCreateHub` usa `hub.isClosed()` (RF-3601).
- [x] Testes existentes do pacote `signaling` verdes sem alteração (RNF-3602).

### T3602 — Teste do `getOrCreateHub` concorrente ao encerramento
[x] T3602
Depends On: T3601
Allowed Paths: `apps/backend/internal/signaling/hub_status_test.go`,
`spec-kit/specs/036-status-hub-sincronizado/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
`apps/backend/internal/room/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `.github/**`, `package.json`
Checks:
- [x] Goroutines chamam `getOrCreateHub` enquanto o hub processa o encerramento; depois dele, `getOrCreateHub`
  devolve um hub novo em `waiting` (US-3601, RF-3601).
- [x] `go test -count=50 -run` do teste novo estável.

### T3603 — `-race` na perna Linux do CI
[x] T3603
Depends On: T3602
Allowed Paths: `.github/workflows/build-all.yml`, `spec-kit/specs/036-status-hub-sincronizado/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`
Checks:
- [x] Passo `go test -race ./internal/signaling/ ./cmd/server/` em `apps/backend`, só em `ubuntu-latest`, depois dos
  testes automatizados (RNF-3601).
- [x] Sem `workflow_dispatch` manual (o job de release roda nele).

### T3604 — Converge
[ ] T3604
Depends On: T3603
Allowed Paths: `spec-kit/specs/036-status-hub-sincronizado/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios (janela TOCTOU, C-3602) e impacto de versão (PATCH, C-3604).
- [ ] `npm run spec:check -- spec-kit/specs/036-status-hub-sincronizado` com PASS.

### T3605 — Versão
[ ] T3605
Depends On: T3604
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/036-status-hub-sincronizado/tasks.md`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
