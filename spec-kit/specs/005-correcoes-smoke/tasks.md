# Tasks: Correções da Matriz de Smoke e Remoção de Legado

Feature: `005-correcoes-smoke`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

Regra de cada task: suíte normal verde (`go test -count=1 ./...`, `npx turbo run test --force`) antes do `[x]`.

### T501 — Sessão única com 4001 no backend (#18)
[x] T501
Allowed Paths: `apps/backend/internal/signaling/**`, `apps/backend/internal/room/**`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`, `apps/web/**`, `apps/desktop/**`
Checks:
- [x] `closeWithCode` + `CloseDuplicateSession = 4001`; `writePump` envia o código só quando definido (RNF-501).
- [x] `onRegister` derruba com 4001 a conexão do mesmo `participant_id` e a de outro aluno com a mesma matrícula (C-501).
- [x] `AddParticipant` substitui a mesma matrícula; o join não barra a reentrada pelo limite (RF-502).
- [x] Testes unitários de hub e room; smoke A19 OK (`npm run test:smoke`, 12/12 PASS em 2026-11-01).

### T502 — Mensagem de sessão duplicada no web (#18)
[x] T502
Depends On: T501
Allowed Paths: `apps/web/src/hooks/**`, `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `apps/web/e2e/**`
Prohibited Paths: `apps/web/src/pages/Join.tsx`, `apps/backend/**`, `apps/desktop/**`
Checks:
- [x] Close 4001 → estado `duplicate`, sem reconexão; `Room.tsx` chama `onLeave` com a mensagem de C-502.
- [x] Teste unitário do hook (vitest verde, tsc ok).
- [x] E2E A19 no navegador: OK sem retry em 2026-11-02 (Microsoft Edge via `channel: 'msedge'`; o download do
  Chromium do Playwright falha nesta máquina).

### T503 — Aviso de limite do chat no web (#19)
[x] T503
Allowed Paths: `apps/web/src/hooks/**`, `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`
Prohibited Paths: `apps/web/src/pages/Join.tsx`, `apps/backend/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] `error`/`CHAT_RATE_LIMITED` → `chatNotice` (C-503), some após 5 s ou ao fechar; conexão mantida.
- [x] `Alert` acima do chat público e do privado.
- [x] Teste unitário do hook (vitest 35 verdes, tsc ok).
- [x] E2E A20: OK sem retry em 2026-11-02 (Microsoft Edge), depois da T507. Antes dela o teste falhava porque as
  mensagens saíam antes do WebSocket abrir e eram descartadas (issue #20).

### T504 — Remoção de legado no backend (#6)
[x] T504
Allowed Paths: `apps/backend/internal/auth/model.go`, `apps/backend/internal/chat/**`, `apps/backend/internal/room/store.go`, `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/room_test.go`, `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/hub_test.go`, `apps/backend/package.json`, `package-lock.json`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/jwt.go`, `apps/web/**`, `apps/desktop/**`
Checks:
- [x] Itens de backend do plan §3 removidos, cada um sem consumidor (RN-502).
- [x] Casos XSS de `chat_security_test.go` cobertos em `hub_test.go` (`TestHub_ChatMessage_XSSPayloads`).
- [x] `go vet ./...` (inclusive tags `smoke` e `loadtest`) e `go test ./...` verdes.

### T505 — Remoção de legado no front e nos pacotes (#6)
[x] T505
Allowed Paths: `packages/types/src/**`, `packages/ui/src/**`, `apps/desktop/src/renderer/hooks/index.ts`, `apps/web/src/services/api.ts`
Prohibited Paths: `apps/backend/**`, `apps/web/src/pages/Join.tsx`
Checks:
- [x] Itens de front do plan §3 removidos, cada um sem consumidor (RN-502).
- [x] `npx turbo run build --force` (5/5) e `npx turbo run test --force` (web 35, desktop 95, Go 6/6) verdes.

### T507 — Chat do aluno desabilitado até conectar (#20)
[x] T507
Depends On: T503
Allowed Paths: `apps/web/src/hooks/**`, `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`
Prohibited Paths: `apps/web/src/pages/Join.tsx`, `apps/web/e2e/**`, `apps/backend/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] Hook expõe `isChatReady`: falso até o `onopen` do WS corrente, falso no fechamento/reconexão (RF-506).
- [x] Input e botão dos chats público e privado desabilitados sem conexão; placeholder "Conectando ao chat..." (C-506).
- [x] Texto digitado preservado ao desabilitar/reabilitar.
- [x] Teste unitário do hook e de `Room` (vitest 38 verdes, tsc ok).
- [x] E2E A14 e A20 passam sem retry (2026-11-02, Microsoft Edge via `channel: 'msedge'`): A20 OK na suíte
  completa e isolado; A14 OK em 2 de 3 execuções isoladas. A falha restante do A14 (e as do A13) ocorre antes do
  chat: o aluno fica em `/entrar` com o `POST /rooms/{slug}/join` pendente — intermitente, já presente antes da
  T507 (A10 falhou no mesmo ponto em `fixtures.ts:144` na primeira execução) e fora do escopo desta task.

### T506 — Converge e relatório
[x] T506
Depends On: T501, T502, T503, T504, T505, T507
Allowed Paths: `docs/metrics/**`, `spec-kit/specs/005-correcoes-smoke/**`, `spec-kit/specs/001-screen-share-core/converge.md`, `spec-kit/specs/004-smoke-regression/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] Smoke e E2E reexecutados em 2026-11-02 (backend 12/12; E2E 12/12 no Edge, A14 flaky);
  `docs/metrics/smoke-2026-11.md` regenerado: 10 OK · 0 FALHA · 14 PENDENTE (manuais).
- [x] `001/converge.md` §6.3 registra que a RN-04 estava marcada concluída sem implementação e foi corrigida pela 005.
- [x] `converge.md` da 005 criado (CONVERGED).
