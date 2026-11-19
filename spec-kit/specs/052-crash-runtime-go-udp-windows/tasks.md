# Tasks: Crash do Runtime Go na Leitura UDP do Windows

Feature: `052-crash-runtime-go-udp-windows`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `go vet ./...` e `go test ./...` em `apps/backend` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T520x`.

### T5201 — Go 1.26.11 no backend
[x] T5201
Allowed Paths: `apps/backend/go.mod`, `apps/backend/go.sum`, `spec-kit/specs/052-crash-runtime-go-udp-windows/tasks.md`
Prohibited Paths: `apps/backend/internal/**`, `apps/backend/cmd/**`, `apps/desktop/**`, `apps/web/**`, `packages/**`,
`.github/**`
Checks:
- [x] Diretiva `go 1.26.11` em `apps/backend/go.mod` (RF-5201).
- [x] `go version` do toolchain usado é 1.26.11 (`GOTOOLCHAIN=go1.26.11`); `go vet ./...` verde; `go test ./...`
  verde, exceto `TestLegacyProberDetectaNomeOcupado`, que falha igual na 1.26.0 porque outro MLab anuncia
  `mlab.local` na mesma LAN (192.168.1.78). Desvio não bloqueante registrado no converge (RNF-5201).
- [x] `go mod tidy` não alterou `go.sum` (RNF-5202).

### T5202 — Saída de crash no log persistente
[x] T5202
Depends On: T5201
Allowed Paths: `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/lifecycle.go`,
`apps/backend/cmd/server/lifecycle_test.go`, `spec-kit/specs/052-crash-runtime-go-udp-windows/tasks.md`
Prohibited Paths: `apps/backend/internal/**`, `apps/backend/go.mod`, `apps/desktop/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `setCrashLog` grava a saída de crash em append no `MLAB_LOG_FILE` (RF-5202).
- [x] Teste com subprocesso: `panic` no arquivo (em append) e no stderr (RF-5202).
- [x] Teste: caminho inválido devolve erro; `main` avisa e segue (RF-5203).
- [x] Nenhuma variável de ambiente gravada: a saída é só a do runtime (`CrashOptions` vazio) (RNF-5203).
- [x] `go vet ./...` verde; `go test ./cmd/server` verde com Go 1.26.11.

### T5203 — Converge
[x] T5203
Depends On: T5202
Allowed Paths: `spec-kit/specs/052-crash-runtime-go-udp-windows/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-5203).
- [x] `npm run spec:check -- spec-kit/specs/052-crash-runtime-go-udp-windows` com PASS.

### T5204 — Versão
[ ] T5204
Depends On: T5203
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/052-crash-runtime-go-udp-windows/tasks.md`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao 2.2.2`.
