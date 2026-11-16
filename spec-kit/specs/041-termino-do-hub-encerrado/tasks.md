# Tasks: Término da Goroutine do Hub Encerrado

Feature: `041-termino-do-hub-encerrado`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- antes de marcar `[x]`: `go test ./...` e `go vet ./...` em `apps/backend`, e `gofmt -l` vazio nos arquivos Go
  alterados;
- um commit atômico por task, com `Ref: T410x` e `Refs #109`.

### T4101 — Término do hub e envios que não bloqueiam
[ ] T4101
Allowed Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/client.go`,
`apps/backend/internal/signaling/handler.go`, `apps/backend/internal/signaling/hub_lifecycle_test.go`,
`spec-kit/specs/041-termino-do-hub-encerrado/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/message.go`, `apps/backend/internal/room/**`,
`apps/backend/internal/webrtc/**`, `apps/backend/cmd/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`,
`package.json`
Checks:
- [ ] `run()` termina depois do encerramento e fecha `done` (RF-4101); `release()` libera o estado (RF-4102).
- [ ] `enroll`, `deliver`, `leave`, `sendSignal` e `BroadcastFileShared` não bloqueiam depois do término (RF-4103).
- [ ] Marcador mantido: `TestHandler_HandshakeComHubEncerrado` e `TestServeWS_ConexaoDuranteEncerramento` verdes
  (RF-4104).
- [ ] `TestServeWS_HubEncerradoNaoDeixaGoroutine` falha no código anterior e passa com a correção.
- [ ] No container Linux (`golang:1.26`): `go test -race ./internal/signaling/ ./cmd/server/` sem corrida (RNF-4101).
- [ ] `go vet ./...` e `go test -count=1 ./...` verdes.

### T4102 — Converge
[ ] T4102
Depends On: T4101
Allowed Paths: `spec-kit/specs/041-termino-do-hub-encerrado/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-4103).
- [ ] `npm run spec:check -- spec-kit/specs/041-termino-do-hub-encerrado` com PASS.

### T4103 — Versão
[ ] T4103
Depends On: T4102
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/041-termino-do-hub-encerrado/tasks.md`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
