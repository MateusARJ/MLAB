# Tasks: Encerramento da Sala pelo Hub Reflete no Store

Feature: `033-encerramento-sala-pelo-hub`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `go test ./...` e `go vet ./...` em `apps/backend`; `gofmt -l` vazio nos arquivos Go alterados antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T330x` e `Refs #94` ou `Refs #95`.

### T3301 — Contrato do `/info`
[x] T3301
Allowed Paths: `spec-kit/specs/001-screen-share-core/contracts/room-api.md`,
`spec-kit/specs/033-encerramento-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`, `spec-kit/specs/001-screen-share-core/spec.md`, `spec-kit/docs/adrs/**`
Checks:
- [x] `200` do `GET /rooms/{roomId}/info` sem `closed` (RF-3303).
- [x] Erros `404 "sala não encontrada"` e `404 "esta transmissão já foi encerrada"` documentados (RF-3303).
- [x] Commit com `Refs #95`.

### T3302 — Encerramento pelo hub atualiza o store
[x] T3302
Depends On: T3301
Allowed Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`,
`apps/backend/cmd/server/main.go`, `spec-kit/specs/033-encerramento-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`,
`apps/backend/internal/room/store.go`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [x] `CloseRoomFromSession`: sala aberta → `closed`, removida, arquivos liberados, mDNS parado (RF-3301).
- [x] Sala ausente ou já `closed`: só libera arquivos, sem parar o mDNS (RNF-3301, RNF-3302).
- [x] `main.go` liga o listener do hub a `CloseRoomFromSession`.
- [x] `TestCloseRoomFromSession`: depois da chamada, `join`, `/info` e `/rooms/active` → `404`; repetição não falha
  (RF-3302, RNF-3302).
- [x] `go test ./...`, `go vet ./...` verdes; `gofmt -l` vazio. Commit com `Refs #94`.

### T3303 — Smoke do timeout e do `end-session`
[x] T3303
Depends On: T3302
Allowed Paths: `apps/backend/cmd/server/smoke_test.go`, `spec-kit/specs/033-encerramento-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/backend/internal/**`, `apps/backend/cmd/server/main.go`, `apps/web/**`, `apps/desktop/**`,
`packages/**`, `package.json`
Checks:
- [x] A18: depois do `room-closed` do timeout, `join` e `/info` → `404` (RF-3302).
- [x] Subteste novo: `end-session` sem REST `close` → aluno recebe `room-closed`; `join` e `/info` → `404`
  (RF-3301, RF-3302).
- [x] `go test -tags smoke -run TestSmoke ./cmd/server/` verde.

### T3304 — Espelho e converge
[ ] T3304
Depends On: T3303
Allowed Paths: `docs/requirements/functionals/RF015-encerramento-de-sala-e-conexoes.md`,
`spec-kit/specs/001-screen-share-core/converge.md`, `spec-kit/specs/033-encerramento-sala-pelo-hub/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `RF015`: encerramento por `end-session` ou timeout também remove a sala do store.
- [ ] `001/converge.md`: evidências de RF-15, RF-18/RN-13 apontam os testes novos.
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-3305).
- [ ] `npm run spec:check -- spec-kit/specs/033-encerramento-sala-pelo-hub` com PASS.

### T3305 — Versão
[ ] T3305
Depends On: T3304
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/033-encerramento-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/**/src/**`, `apps/backend/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
