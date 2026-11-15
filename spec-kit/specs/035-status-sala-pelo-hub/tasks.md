# Tasks: Status da Sala Acompanha a Sessão do Hub

Feature: `035-status-sala-pelo-hub`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `go test -race ./...` e `go vet ./...` em `apps/backend`; `gofmt -l` vazio nos arquivos Go alterados antes de marcar
  `[x]`;
- um commit atômico por task, com `Ref: T350x` e `Refs #101`.

### T3501 — Contrato do `join` e do `/rooms/active`
[x] T3501
Allowed Paths: `spec-kit/specs/001-screen-share-core/contracts/room-api.md`,
`spec-kit/specs/035-status-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`, `spec-kit/specs/001-screen-share-core/spec.md`, `spec-kit/docs/adrs/**`
Checks:
- [x] `room_status` do `join`: `waiting | publishing | reconnecting` (RF-3502, RF-3504).
- [x] `/rooms/active`: ordem `publishing > reconnecting > waiting`, desempate pela mais recente (RF-3503).

### T3502 — Store registra o status da sessão
[ ] T3502
Depends On: T3501
Allowed Paths: `apps/backend/internal/room/model.go`, `apps/backend/internal/room/store.go`,
`apps/backend/internal/room/room_test.go`, `spec-kit/specs/035-status-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/signaling/**`,
`apps/backend/internal/webrtc/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [ ] `StatusReconnecting` no modelo.
- [ ] `SetSessionStatus`: troca só o `Status`; sala ausente → `ErrRoomNotFound`; sala `closed` → `ErrRoomClosed` sem
  alterar nada; `StatusClosed` recusado (RF-3501, RNF-3501).
- [ ] `GetActiveRoom` aceita `reconnecting`; ordem `publishing > reconnecting > waiting` (RF-3503).
- [ ] Testes: transições, guardas, prioridade com as três salas (estende `TestGetActiveRoom_Deterministic`).

### T3503 — Handler da sala sincroniza o status vindo do hub
[ ] T3503
Depends On: T3502
Allowed Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`,
`spec-kit/specs/035-status-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/backend/internal/room/store.go`, `apps/backend/internal/signaling/**`,
`apps/backend/internal/webrtc/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [ ] `SyncStatusFromSession(roomID, status)`: grava via `SetSessionStatus`; sala ausente ou `closed` ignorada em
  silêncio; outro erro no log (RF-3501, RNF-3501).
- [ ] Teste: depois da sincronização, `/info`, `join` e `/rooms/active` devolvem `publishing` e `reconnecting`; sala
  removida continua `404` (RF-3502, RNF-3501).

### T3504 — Hub avisa a mudança de status e o servidor liga o aviso ao store
[ ] T3504
Depends On: T3503
Allowed Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
`apps/backend/internal/signaling/hub_status_test.go`, `apps/backend/cmd/server/main.go`,
`spec-kit/specs/035-status-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/message.go`, `apps/backend/internal/room/**`,
`apps/backend/internal/webrtc/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [ ] `setStatus` substitui as atribuições de `publishing`/`reconnecting`; avisa só quando o status muda e nunca para
  `closed` (RF-3501).
- [ ] `newHub` recebe `hubCallbacks` opcional; testes existentes com `newHub(id, nil)` compilam sem mudança.
- [ ] `SetRoomStatusListener` no `signaling.Handler`; `main.go` liga a `roomHandler.SyncStatusFromSession`.
- [ ] `hub_status_test.go`: professor registra → `publishing`; publisher cai → `reconnecting`; volta → `publishing`;
  sem aviso repetido; encerramento não passa pelo callback (RF-3501, RNF-3502).

### T3505 — Tipo compartilhado
[ ] T3505
Depends On: T3504
Allowed Paths: `packages/types/src/index.ts`, `spec-kit/specs/035-status-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/**`, `packages/ui/**`, `package.json`
Checks:
- [ ] `RoomStatus` inclui `'reconnecting'` (RF-3504).
- [ ] Build de `packages/types` e typecheck do monorepo verdes.

### T3506 — Espelho e converge
[ ] T3506
Depends On: T3505
Allowed Paths: `docs/requirements/functionals/RF018-gestao-de-reconexao-do-professor-timeout-30s.md`,
`spec-kit/specs/001-screen-share-core/converge.md`, `spec-kit/specs/002-security-hardening/converge.md`,
`spec-kit/specs/035-status-sala-pelo-hub/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `RF018`: o status `reconnecting` também aparece nas respostas REST da sala.
- [ ] `001/converge.md` (RF-18) e `002/converge.md` (RNF-SEC-05) apontam os testes novos.
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-3504).
- [ ] `npm run spec:check -- spec-kit/specs/035-status-sala-pelo-hub` com PASS.

### T3507 — Versão
[ ] T3507
Depends On: T3506
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/035-status-sala-pelo-hub/tasks.md`
Prohibited Paths: `apps/**/src/**`, `apps/backend/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
