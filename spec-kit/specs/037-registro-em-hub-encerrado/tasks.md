# Tasks: Conexão Recusada em Sala Encerrada pelo Hub

Feature: `037-registro-em-hub-encerrado`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `go test ./...` e `go vet ./...` em `apps/backend`; `gofmt -l` vazio nos arquivos Go alterados antes de marcar
  `[x]`;
- um commit atômico por task, com `Ref: T370x` e `Refs #107`.

### T3701 — Nota no contrato de sinalização
[x] T3701
Allowed Paths: `spec-kit/specs/001-screen-share-core/contracts/signaling.md`,
`spec-kit/specs/037-registro-em-hub-encerrado/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`, `spec-kit/specs/001-screen-share-core/spec.md`, `spec-kit/docs/adrs/**`
Checks:
- [x] Conexão a sala encerrada: `410` no handshake ou `room-closed` com fechamento sem código (RF-3701, RF-3704).
- [x] Nenhum tipo, campo ou código novo (RNF-3702).

### T3702 — Hub encerrado recusa registro
[x] T3702
Depends On: T3701
Allowed Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/hub_closed_test.go`,
`spec-kit/specs/037-registro-em-hub-encerrado/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/handler.go`, `apps/backend/internal/signaling/message.go`,
`apps/backend/internal/signaling/client.go`, `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`,
`apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [x] `onRegister` em hub `closed`: `room-closed`, conexão fechada, `clients`, `connectedStudents`, `publisherID` e
  status intactos (RF-3701).
- [x] Testes: aluno e professor depois de `onRoomClose`; professor recusado não muda o status, não é aprovado nem
  avisa o store; a sala segue sem clientes.

### T3703 — Handler não recria hub de sala encerrada
[x] T3703
Depends On: T3702
Allowed Paths: `apps/backend/internal/signaling/handler.go`, `apps/backend/internal/signaling/hub_status_test.go`,
`apps/backend/internal/signaling/hub_closed_test.go`, `spec-kit/specs/037-registro-em-hub-encerrado/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/message.go`,
`apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`, `apps/backend/cmd/**`, `apps/web/**`,
`apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [x] `getOrCreateHub` devolve `(hub, ok)`; hub `closed` → `ok=false`, sem criar (RF-3702).
- [x] Criação confere o store sob `h.mu`; sala ausente ou `closed` → `ok=false` (RF-3703, RNF-3701).
- [x] `serveWS` obtém o hub antes do upgrade e responde `410` sem hub (RF-3704).
- [x] Teste da 036 ajustado: depois do encerramento, `getOrCreateHub` recusa e não cria hub (C-3702).
- [x] Testes: sala fora do store não ganha hub; handshake `410` por `httptest` com hub encerrado.

### T3704 — Teste de ponta a ponta da corrida
[ ] T3704
Depends On: T3703
Allowed Paths: `apps/backend/internal/signaling/hub_closed_test.go`,
`spec-kit/specs/037-registro-em-hub-encerrado/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
`apps/backend/internal/room/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [ ] Clientes WebSocket reais conectando enquanto o hub encerra: cada um termina com `410` ou `room-closed`; nenhum
  fica registrado num hub vivo (US-3701, US-3702).
- [ ] `go test -count=20 -run` do teste estável.

### T3705 — Converge
[ ] T3705
Depends On: T3704
Allowed Paths: `spec-kit/specs/037-registro-em-hub-encerrado/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-3704).
- [ ] `npm run spec:check -- spec-kit/specs/037-registro-em-hub-encerrado` com PASS.

### T3706 — Versão
[ ] T3706
Depends On: T3705
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/037-registro-em-hub-encerrado/tasks.md`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
