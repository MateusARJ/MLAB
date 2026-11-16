# Tasks: Envio e Fechamento do Cliente sem Corrida

Feature: `038-envio-e-fechamento-do-cliente`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- antes de marcar `[x]`: `go test ./...` e `go vet ./...` em `apps/backend`, e `gofmt -l` vazio nos arquivos Go
  alterados;
- um commit atômico por task, com `Ref: T380x` e `Refs #111`.

### T3801 — Cliente serializa envio e fechamento
[x] T3801
Allowed Paths: `apps/backend/internal/signaling/client.go`, `apps/backend/internal/signaling/client_test.go`,
`spec-kit/specs/038-envio-e-fechamento-do-cliente/tasks.md`
Prohibited Paths: `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
`apps/backend/internal/signaling/message.go`, `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`,
`apps/backend/cmd/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [x] `safeSend` e `closeWithCode` sob o lock do cliente; envio depois do fechamento devolve `false` sem tocar no canal
  (RF-3801).
- [x] Buffer cheio continua descartando sem bloquear (RF-3802); fechamento idempotente com o primeiro close code
  (RF-3803).
- [x] Testes: envio depois do fechamento; envios concorrentes ao fechamento; buffer cheio; segundo fechamento sem efeito.
- [x] `go test -race ./internal/signaling/ ./cmd/server/` num container Linux (`golang:1.26`) sem corrida, incluindo
  `TestServeWS_ConexaoDuranteEncerramento` (RNF-3801): zero `DATA RACE` em 50 execuções. Na `development` @
  `a0b9243`, o mesmo teste acusa a race. O teste ainda falha às vezes por `i/o timeout`; a causa é outra (primeira
  mensagem descartada antes do registro), anterior a esta feature e registrada no #114.

### T3802 — Converge
[x] T3802
Depends On: T3801
Allowed Paths: `spec-kit/specs/038-envio-e-fechamento-do-cliente/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-3802).
- [x] `npm run spec:check -- spec-kit/specs/038-envio-e-fechamento-do-cliente` com PASS.

### T3803 — Versão
[ ] T3803
Depends On: T3802
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/038-envio-e-fechamento-do-cliente/tasks.md`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
