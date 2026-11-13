# Tasks: Matrícula Conectada Recusa Nova Entrada

Feature: `027-matricula-unica-na-transmissao`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados; ADR 0010 aprovada
Status: IN PROGRESS

Regras:
- `go test ./...` e `go vet ./...` em `apps/backend`; `go test -tags smoke -run TestSmoke ./cmd/server/` quando a task
  toca o join; `gofmt -l` vazio nos arquivos Go alterados; `npm run test -w apps/web` e `npm run lint` verdes antes de
  marcar `[x]`;
- um commit atômico por task, com `Ref: T270x` e `Refs #85`.

### T2701 — RN-04, contratos e espelho
[ ] T2701
Allowed Paths: `spec-kit/specs/001-screen-share-core/spec.md`,
`spec-kit/specs/001-screen-share-core/contracts/room-api.md`,
`spec-kit/specs/001-screen-share-core/contracts/signaling.md`,
`docs/requirements/business-rules/RN004-restricao-de-sessao-unica-por-aluno.md`
Prohibited Paths: `apps/**`, `packages/**`, `spec-kit/docs/adrs/**`, `package.json`
Checks:
- [ ] RN-04 da 001 com a redação da RN-2701 e referência à ADR 0010.
- [ ] `room-api.md`: `409 Student ID in use` no `join`, com a mensagem (RF-2701).
- [ ] `signaling.md`: seção de close codes com `4001` (mesmo participante) e `4002` (matrícula em uso) (RF-2703, RF-2704).
- [ ] Espelho `RN004` igual à RN-04.

### T2702 — Hub: recusa da matrícula em uso com 4002
[ ] T2702
Depends On: T2701
Allowed Paths: `apps/backend/internal/signaling/client.go`, `apps/backend/internal/signaling/hub.go`,
`apps/backend/internal/signaling/handler.go`, `apps/backend/internal/signaling/hub_session_test.go`
Prohibited Paths: `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`, `apps/backend/cmd/**`,
`apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [ ] Segundo aluno (outro `participant_id`, matrícula em outra caixa) recebe `4002 "Student ID In Use"`, não entra em
  `clients` e o primeiro segue aberto (RF-2703).
- [ ] Mesmo `participant_id` reconectando fecha o anterior com `4001` (RF-2704).
- [ ] Após `onUnregister`, `HasConnectedStudent` é falso e um novo aluno com a matrícula é registrado (RF-2705).
- [ ] Professor e matrículas diferentes não se afetam.
- [ ] `go test ./internal/signaling/...` e `go vet` verdes; `gofmt -l` vazio.

### T2703 — Join: 409 para matrícula conectada
[ ] T2703
Depends On: T2702
Allowed Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`,
`apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/smoke_test.go`, `scripts/smoke-report.js`
Prohibited Paths: `apps/backend/internal/room/store.go`, `apps/backend/internal/signaling/**`,
`apps/backend/internal/webrtc/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [ ] `join` com a matrícula conectada → `409` com a mensagem, sem registrar participante (RF-2701).
- [ ] Com a sala cheia e a matrícula conectada → `409` (RF-2702); só registrada (sem WS) → `200`.
- [ ] `main.go` liga o checker ao `signaling.Handler`.
- [ ] Smoke A19: segundo `join` com o WS do primeiro aberto → `409` e o primeiro WS segue aberto; mesmo token → `4001`.
- [ ] `go test ./...`, `go vet ./...` e o smoke verdes; `gofmt -l` vazio.

### T2704 — Web: aviso do 4002 e do 409
[ ] T2704
Depends On: T2703
Allowed Paths: `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/hooks/useWebRTCSubscriber.test.ts`,
`apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `apps/web/src/pages/Join.test.tsx`
Prohibited Paths: `apps/web/src/pages/Join.tsx`, `apps/web/src/App.tsx`, `apps/web/src/services/**`,
`apps/backend/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [ ] Close `4002` → `connectionStatus` `student-id-in-use`, sem nova conexão (RF-2706).
- [ ] `Room` chama `onLeave("Esta matrícula já está conectada nesta transmissão.")` nesse estado (RF-2706).
- [ ] `Join` mostra a mensagem do `409` (RF-2706).
- [ ] `npm run test -w apps/web` e `npm run lint` verdes.

### T2705 — Converge e versão
[ ] T2705
Depends On: T2704
Allowed Paths: `spec-kit/specs/027-matricula-unica-na-transmissao/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `apps/backend/cmd/**`, `packages/**/src/**`,
`.github/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (MINOR, C-2705).
- [ ] `npm run bump -- minor` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [ ] `npm run spec:check -- spec-kit/specs/027-matricula-unica-na-transmissao` com PASS.
