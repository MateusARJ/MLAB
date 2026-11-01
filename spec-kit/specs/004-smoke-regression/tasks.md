# Tasks: Matriz de Smoke de Regressão

Feature: `004-smoke-regression`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

Regra de cada task: suíte normal verde (`go test -count=1 ./...`, `npx turbo run test --force`) antes do `[x]`.

### T401 — Extrair a montagem do servidor para `newServer`
[x] T401
Allowed Paths: `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/main_test.go`
Prohibited Paths: `apps/backend/internal/**`, `apps/web/**`, `apps/desktop/**`
Checks:
- [x] `main()` só lê env, chama `newServer` e sobe o `http.Server`; mesmas rotas, middlewares e listeners.
- [x] Suíte Go completa verde (6/6 pacotes).

### T402 — Harness do smoke de backend
[x] T402
Depends On: T401
Allowed Paths: `apps/backend/cmd/server/smoke_test.go`, `apps/backend/cmd/server/smoke_helpers_test.go`, `apps/backend/package.json`
Prohibited Paths: `apps/backend/internal/**`, `apps/backend/cmd/server/main.go`
Checks:
- [x] Build tag `smoke`; `httptest.NewServer(newServer(...))`; faixa UDP 52000–52100.
- [x] Helpers: sessão do professor, criar sala, join, WS com leitura por tipo, publisher e assinante Pion pelo WS.
- [x] Script `test:smoke` em `apps/backend/package.json`.

### T403 — Casos do smoke de backend
[x] T403
Depends On: T402
Allowed Paths: `apps/backend/cmd/server/smoke_test.go`, `apps/backend/cmd/server/smoke_helpers_test.go`
Prohibited Paths: `apps/backend/internal/**`, `apps/backend/cmd/server/main.go`
Checks:
- [x] Subtestes A0, A3, A9, A10, A13, A14, A15, A18, A19, A20, S2, S6, S9 (RF-401).
- [x] A19 registra o resultado real (C-403): FALHA — nova entrada com a mesma matrícula não derruba a sessão anterior (RN-04 não implementada) e reconexão com o mesmo token fecha a antiga com 1005, não 4001.
- [x] `go test ./...` sem a tag continua igual.
- [x] Execução de 2026-11-01: 11/12 OK (A0, A3, A9, A10, A13, A14, A15, A18, A20, S6, S9); A19 FALHA.

### T404 — Configuração do Playwright
[ ] T404
Depends On: T403
Allowed Paths: `apps/web/playwright.config.ts`, `apps/web/package.json`, `apps/web/.gitignore`, `package-lock.json`
Prohibited Paths: `apps/web/src/**`, `apps/backend/**`, `apps/desktop/**`
Checks:
- [ ] `@playwright/test` como devDependency de `apps/web`; script `test:e2e`.
- [ ] `webServer` sobe backend (`go run`) e Vite; projetos desktop e mobile.
- [ ] Vitest não coleta `e2e/**`.

### T405 — Fixtures do E2E (professor simulado)
[ ] T405
Depends On: T404
Allowed Paths: `apps/web/e2e/**`
Prohibited Paths: `apps/web/src/**`, `apps/backend/**`
Checks:
- [ ] Sessão do professor e sala pela API.
- [ ] Publisher WebRTC numa segunda página (canvas + oscilador) sinalizando pelo WS do professor.

### T406 — Specs do E2E
[ ] T406
Depends On: T405
Allowed Paths: `apps/web/e2e/**`
Prohibited Paths: `apps/web/src/**`, `apps/backend/**`
Checks:
- [ ] A3, A9, A10, A13, A14, A15, A18 (cliente), A20 no desktop; A9, A10, A13 no mobile (RF-402).
- [ ] `npm run test:e2e -w @mlab/web` executado e resultado registrado.

### T407 — Roteiro manual
[x] T407
Allowed Paths: `docs/metrics/smoke-runbook.md`, `docs/metrics/smoke-manual.json`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] A1, A2, A4–A8, A11, A12, A16, A17 e confirmação em celular de A10/A13/A15 com passos, critério e evidência (RF-403).
- [x] `smoke-manual.json` modelo com os itens manuais em branco.

### T408 — Relatório consolidado
[ ] T408
Depends On: T403, T406, T407
Allowed Paths: `scripts/smoke-report.js`, `package.json`, `docs/metrics/smoke-2026-11.md`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`
Checks:
- [ ] `npm run smoke` roda smoke + E2E, lê o JSON manual e gera a matriz A0–A20 (RF-404).
- [ ] Relatório gerado com os resultados automáticos; itens manuais como "pendente" até o responsável preencher.

### T409 — Registro nos converges
[ ] T409
Depends On: T408
Allowed Paths: `docs/metrics/baseline-2026-11.md`, `spec-kit/specs/001-screen-share-core/converge.md`, `spec-kit/specs/002-security-hardening/converge.md`, `spec-kit/specs/002-security-hardening/tasks.md`, `spec-kit/specs/004-smoke-regression/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] Baseline aponta para o relatório; itens de smoke das tasks T201–T209 atualizados com o resultado real.
- [ ] Executada depois que o responsável preencher o roteiro manual.
