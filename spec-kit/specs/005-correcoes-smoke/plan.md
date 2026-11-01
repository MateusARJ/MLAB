# Plan: Correções da Matriz de Smoke e Remoção de Legado

Feature: `005-correcoes-smoke`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-501 a C-505)

## 1. Summary

1. **Sessão única (RF-501, RF-502)** — no backend, o `Client` ganha fechamento com código (`closeWithCode`), e o
   `writePump` envia `websocket.FormatCloseMessage(4001, "Duplicate Session")`. O `Hub.onRegister` derruba a conexão
   anterior do mesmo `participant_id` ou da mesma matrícula (C-501). O store substitui o participante de mesma
   matrícula em vez de acrescentar, e o join não barra a reentrada pelo limite da sala.
2. **4001 no web (RF-503)** — `useWebRTCSubscriber` expõe o estado `duplicate`; `Room.tsx` chama `onLeave` com a
   mensagem de C-502.
3. **Rate limit no web (RF-504)** — `useWebRTCSubscriber` trata `error`/`CHAT_RATE_LIMITED` e expõe `chatNotice`;
   `Room.tsx` mostra `Alert` (C-503).
4. **Legado (RF-505)** — remoção dos itens da seção 3, cada um com busca sem consumidor (RN-502).

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Close code | `websocket.FormatCloseMessage(4001, "Duplicate Session")`; demais fechamentos seguem com frame vazio | RF-501, RNF-501 |
| Chave da RN-04 | `participant_id` igual **ou** `strings.EqualFold(studentID)` entre alunos da sala | C-501 |
| Limpeza do hub | a conexão derrubada sai pelo `onUnregister` existente (participant-left + participants-update) | — |
| Store | `AddParticipant` substitui participante da mesma sala com a mesma matrícula; novo `HasStudent` para o join | RF-502 |
| Web 4001 | estado `duplicate` no hook, sem reconexão | C-502 |
| Web rate limit | `chatNotice` + `dismissChatNotice` no hook; `Alert` de `@mlab/ui`; timer de 5 s | C-503 |

## 3. Itens de legado (RF-505)

Backend:
- `internal/auth/model.go`: `Claims` (JWT do professor por e-mail, sem uso desde a ADR 0006). `StudentClaims` fica (C-504).
- `internal/chat/service.go`: `Message`, `Service`, `NewService`, `SanitizeAndFormat`, `ErrEmptyMessage` — usados só
  pelos próprios testes; o hub sanitiza por conta própria. `MaskProfanity` fica. Os casos XSS de
  `chat_security_test.go` migram para `internal/signaling/hub_test.go` antes da remoção.
- `internal/room/store.go`: `newShortSuffix`, `newSlug` + `slugWords`, `buildLink` (+ teste).
- `internal/room/mdns.go`: `GetActiveMDNSIP`.
- `internal/signaling/hub.go`: mensagem "SFU não inicializado (pendente T011)" → "SFU não inicializado".
- `apps/backend/package.json`: dependência npm `golang` (sem uso; o backend é compilado pelo Go).
- Mantido: `slugFromEmail` (o JWT do professor ainda tem a claim `email`, `auth/jwt.go:55`).

Front e pacotes:
- `packages/types`: `AuthResponse`, `JoinRequest`, `JoinResponse` (camelCase, substituídos por `SessionResponse` e
  `JoinRoom*`); cabeçalho "Populados em T007 ... scaffold".
- `packages/ui`: `Tabs.tsx`, `Loading.tsx` e re-exports de ícones sem consumidor (`WarningAlt`, `SendAlt`, `Send`,
  `Upload`, `ChevronRight`) — AGENTS.md §6 ("só entra se houver consumidor real").
- `apps/desktop/src/renderer/hooks/index.ts`: barrel sem importador.
- `apps/web/src/services/api.ts`: `getStoredStudentToken` e a gravação de `student_token` em `sessionStorage`, que
  ninguém lê.

## 4. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Matrícula compartilhada por engano derruba outro aluno | aluno sai da sala | comportamento exigido pela RN-04; mensagem clara (C-502) |
| Close code alterar outros fechamentos | reconexões indevidas no web | código só quando definido (RNF-501) |
| Remover export usado fora do grep | build quebrado | `turbo run build` e typecheck antes do commit |

## Scope Lock

### IN

- sessão única com 4001 no backend e tratamento no web;
- aviso de `CHAT_RATE_LIMITED` no web;
- remoção dos itens da seção 3;
- testes, relatório de smoke e converges.

### OUT

- qualquer mudança no fluxo da matrícula (C-504);
- SFU, persistência, CI;
- mover ou excluir `docs/metrics/` (C-505).

### Allowed Paths

- `apps/backend/internal/signaling/**`, `apps/backend/internal/room/**`, `apps/backend/internal/chat/**`,
  `apps/backend/internal/auth/model.go`
- `apps/backend/cmd/server/*_test.go`, `apps/backend/package.json`
- `apps/web/src/**`, `apps/web/e2e/**`
- `apps/desktop/src/renderer/hooks/index.ts`
- `packages/types/src/**`, `packages/ui/src/**`
- `package-lock.json`
- `docs/metrics/**`, `scripts/smoke-report.js`
- `spec-kit/specs/005-correcoes-smoke/**`, `spec-kit/specs/001-screen-share-core/converge.md`,
  `spec-kit/specs/004-smoke-regression/tasks.md`

### Prohibited Paths

- `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/jwt.go`, `apps/backend/cmd/server/main.go`
- `apps/web/src/pages/Join.tsx` (fluxo da matrícula)
- `apps/desktop/src/**` exceto `renderer/hooks/index.ts`
- `.github/workflows/**`, `spec-kit/docs/adrs/**`

### Dependencies

- Nenhuma nova. Removida: `golang` (npm) de `apps/backend/package.json`.
- Existentes: `gorilla/websocket`, `@mlab/ui` (`Alert`), `@mlab/types` (`ErrorPayload`).

### Non-Goals

- diferenciar homônimos, alterar a matrícula, novos códigos de erro;
- remover rotas `/sala/:slug` e atalhos Alt+Shift (ainda em uso);
- renomear `logout` no desktop.

## 5. Constitution Check

- [x] Princípio I — spec aprovada.
- [x] Princípio II — sessão única decidida no servidor.
- [x] Princípio III — SFU intocada.
- [x] Princípio IV — nenhuma meta de desempenho declarada.
- [x] Princípio V — contratos seguidos: `4001` já previsto na RN-04; a mensagem `error` já existe.
- [x] Princípio VI — Scope Lock e paths por task.
- [x] Princípio VII — sem abstração nova além de `closeWithCode` e `HasStudent`.
- [ ] Princípio VIII — converge ao final (T506).

## 6. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-01 | Matrícula mantida; sem ADR nova | C-504 |
| 2026-11-01 | `docs/metrics/` mantida | C-505 |
