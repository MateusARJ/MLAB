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
[ ] T502
Depends On: T501
Allowed Paths: `apps/web/src/hooks/**`, `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `apps/web/e2e/**`
Prohibited Paths: `apps/web/src/pages/Join.tsx`, `apps/backend/**`, `apps/desktop/**`
Checks:
- [ ] Close 4001 → estado `duplicate`, sem reconexão; `Room.tsx` chama `onLeave` com a mensagem de C-502.
- [ ] Teste unitário do hook; E2E A19 no navegador.

### T503 — Aviso de limite do chat no web (#19)
[ ] T503
Allowed Paths: `apps/web/src/hooks/**`, `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`
Prohibited Paths: `apps/web/src/pages/Join.tsx`, `apps/backend/**`, `apps/desktop/**`, `packages/**`
Checks:
- [ ] `error`/`CHAT_RATE_LIMITED` → `chatNotice` (C-503), some após 5 s ou ao fechar; conexão mantida.
- [ ] `Alert` acima do chat público e do privado.
- [ ] Teste unitário do hook; E2E A20 OK.

### T504 — Remoção de legado no backend (#6)
[x] T504
Allowed Paths: `apps/backend/internal/auth/model.go`, `apps/backend/internal/chat/**`, `apps/backend/internal/room/store.go`, `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/room_test.go`, `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/hub_test.go`, `apps/backend/package.json`, `package-lock.json`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/jwt.go`, `apps/web/**`, `apps/desktop/**`
Checks:
- [x] Itens de backend do plan §3 removidos, cada um sem consumidor (RN-502).
- [x] Casos XSS de `chat_security_test.go` cobertos em `hub_test.go` (`TestHub_ChatMessage_XSSPayloads`).
- [x] `go vet ./...` (inclusive tags `smoke` e `loadtest`) e `go test ./...` verdes.

### T505 — Remoção de legado no front e nos pacotes (#6)
[ ] T505
Allowed Paths: `packages/types/src/**`, `packages/ui/src/**`, `apps/desktop/src/renderer/hooks/index.ts`, `apps/web/src/services/api.ts`
Prohibited Paths: `apps/backend/**`, `apps/web/src/pages/Join.tsx`
Checks:
- [ ] Itens de front do plan §3 removidos, cada um sem consumidor (RN-502).
- [ ] `npx turbo run build test` verde.

### T506 — Converge e relatório
[ ] T506
Depends On: T501, T502, T503, T504, T505
Allowed Paths: `docs/metrics/**`, `spec-kit/specs/005-correcoes-smoke/**`, `spec-kit/specs/001-screen-share-core/converge.md`, `spec-kit/specs/004-smoke-regression/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] Smoke e E2E reexecutados; `docs/metrics/smoke-2026-11.md` regenerado com A19 e A20.
- [ ] `001/converge.md` registra que a RN-04 estava marcada concluída sem implementação e foi corrigida pela 005.
- [ ] `converge.md` da 005 criado.
