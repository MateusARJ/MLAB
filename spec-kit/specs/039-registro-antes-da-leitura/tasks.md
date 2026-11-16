# Tasks: Registro do Cliente antes da Leitura

Feature: `039-registro-antes-da-leitura`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- antes de marcar `[x]`: `go test ./...` e `go vet ./...` em `apps/backend`, e `gofmt -l` vazio nos arquivos Go
  alterados;
- um commit atômico por task, com `Ref: T390x` e `Refs #114`.

### T3901 — Leitura do cliente só depois do registro
[x] T3901
Allowed Paths: `apps/backend/internal/signaling/client.go`, `apps/backend/internal/signaling/handler.go`,
`apps/backend/internal/signaling/handler_register_test.go`, `spec-kit/specs/039-registro-antes-da-leitura/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/message.go`,
`apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`, `apps/backend/cmd/**`, `apps/web/**`,
`apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [x] `newClient` inicia só o `writePump`; `serveWS` chama `startReading()` depois do `register` (RF-3901).
- [x] Cliente recusado continua recebendo `room-closed`/`4002` e o fechamento (RF-3902); ordem do registro inalterada
  (RF-3903).
- [x] `TestServeWS_PrimeiraMensagemDepoisDoRegistro` falha na `development` e passa com a correção.
- [x] No container Linux (`golang:1.26`): `go test -count=200 -run TestServeWS_ConexaoDuranteEncerramento
  ./internal/signaling/` sem falha e `go test -race ./internal/signaling/ ./cmd/server/` sem corrida (RNF-3901).
- [x] `go vet ./...` e `go test -count=1 ./...` verdes.

### T3902 — Converge
[x] T3902
Depends On: T3901
Allowed Paths: `spec-kit/specs/039-registro-antes-da-leitura/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-3902).
- [x] `npm run spec:check -- spec-kit/specs/039-registro-antes-da-leitura` com PASS.

### T3903 — Versão
[x] T3903
Depends On: T3902
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/039-registro-antes-da-leitura/tasks.md`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `packages/**/src/**`, `.github/**`
Checks:
- [x] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
