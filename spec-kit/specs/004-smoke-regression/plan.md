# Plan: Matriz de Smoke de Regressão

Feature: `004-smoke-regression`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-401 a C-407)

## 1. Summary

Três camadas e um relatório:

1. **Smoke de backend (Go, build tag `smoke`)** — `httptest.NewServer` com o servidor real montado por `newServer`;
   clientes HTTP, WebSocket (`gorilla/websocket`) e WebRTC (Pion) no próprio teste.
2. **E2E do aluno (Playwright)** — backend (`go run`) + Vite; professor simulado por API e por um publisher WebRTC
   rodando numa segunda página do navegador (canvas + oscilador).
3. **Roteiro manual** — `docs/metrics/smoke-runbook.md`, com resultados em `docs/metrics/smoke-manual.json`.
4. **Relatório** — `scripts/smoke-report.js` junta as três fontes em `docs/metrics/smoke-2026-11.md`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Servidor em teste | `newServer(cfg)` extraído de `main()` | C-402 |
| Isolamento | build tag `smoke`; faixa UDP 52000–52100 | RNF-401, RNF-402 |
| WebSocket em Go | `github.com/gorilla/websocket` (já no `go.mod`) | — |
| Mídia em Go | Pion `TrackLocalStaticRTP` com VP8 sintético (padrão de `internal/webrtc/loadtest_test.go`) | — |
| E2E | `@playwright/test`, Chromium, projetos desktop e mobile | C-401 |
| Publisher no E2E | `RTCPeerConnection` + `canvas.captureStream()` via `page.evaluate`, sinalização pelo WS do professor | US-402 |
| Comandos | `test:smoke` (backend), `test:e2e` (web), `smoke` (raiz, relatório) | — |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Extração de `newServer` muda comportamento | regressão no app | extração mecânica; suíte Go completa antes do commit |
| Colisão de portas UDP com outros testes | resultados falsos | faixa própria; não rodar junto com `test:load` |
| WebRTC flakey em loopback no Playwright | E2E instável | esperas por estado (`videoWidth`, `currentTime`), sem `sleep` fixo; 1 retry |
| A18 leva 30 s | suíte lenta | subteste isolado; aceito (C-405) |

## Scope Lock

### IN

- extração de `newServer` em `apps/backend/cmd/server/main.go` (sem mudança de comportamento);
- testes de smoke do backend, E2E do web, roteiro manual, relatório e scripts de execução;
- registro dos resultados em `docs/metrics/**` e nos converges das features 001 e 002.

### OUT

- corrigir qualquer falha encontrada (incluindo A19/4001);
- alterar código de produção de `internal/**`, `apps/web/src/**`, `apps/desktop/src/**`;
- alterar `.github/workflows/**` (C-406).

### Allowed Paths

- `apps/backend/cmd/server/**`
- `apps/backend/package.json` (script `test:smoke`)
- `apps/web/e2e/**`, `apps/web/playwright.config.ts`, `apps/web/package.json`, `apps/web/.gitignore`
- `package.json`, `package-lock.json` (script `smoke` e lock da devDependency)
- `scripts/smoke-report.js`
- `docs/metrics/**`
- `spec-kit/specs/004-smoke-regression/**`
- `spec-kit/specs/001-screen-share-core/converge.md`, `spec-kit/specs/002-security-hardening/converge.md`,
  `spec-kit/specs/002-security-hardening/tasks.md` (só marcação dos itens de smoke)

### Prohibited Paths

- `apps/backend/internal/**` (exceto leitura)
- `apps/web/src/**`, `apps/desktop/**`, `packages/**`
- `.github/workflows/**`

### Dependencies

- Nova (C-401): `@playwright/test` (devDependency de `apps/web`) e Chromium do Playwright.
- Existentes: `gorilla/websocket`, `pion/webrtc/v3`, `pion/rtp` (backend).

### Non-Goals

- automação do Electron;
- medição de desempenho;
- CI.

## 4. Constitution Check

- [x] Princípio I — spec aprovada.
- [x] Princípio II — autorização no servidor verificada por teste (S2, S6, A13).
- [x] Princípio III — SFU intocada.
- [x] Princípio IV — nada de meta de desempenho declarada.
- [x] Princípio V — nenhum contrato alterado; os testes seguem os contratos existentes.
- [x] Princípio VI — Scope Lock e paths por task.
- [x] Princípio VII — sem abstração além de `newServer` e helpers de teste.
- [ ] Princípio VIII — converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-01 | Abordagem híbrida aprovada | plano aprovado |
| 2026-11-01 | Playwright só em `apps/web` | C-401 |
| 2026-11-01 | A19 registrado como falha conhecida | C-403 |
