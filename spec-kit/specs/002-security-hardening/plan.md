# Plan: Endurecimento de Segurança

Feature: `002-security-hardening`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-201 a C-205; C-204 decidida em 2026-11-01)
Detalhamento aprovado: `spec-kit/docs/plano-remediacao-speckit-seguranca.md` (fase F5)

## 1. Summary

Oito correções independentes (S1–S8 = T201–T208), cada uma em um commit, cada uma validada pela suíte completa.
Ordem: S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8. S3 vem depois de S2 porque ambas alteram `auth/handler.go` e
`services/auth.ts`. Emenda de 2026-11-01: S9 (= T209) acrescentada depois de S8, restrita a `internal/signaling/**`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Segredo JWT | `crypto/rand` 32 bytes por execução se `JWT_SECRET` ausente | ADR 0006 |
| Chave de host | `crypto.randomBytes(32)` no main do Electron / `scripts/dev.js`; `crypto/subtle.ConstantTimeCompare` no backend | ADR 0006 |
| Transporte da chave ao renderer | IPC `get-host-key` via `contextBridge` | `003/contracts/desktop-ipc.md` |
| Token em download | `Authorization: Bearer` ou `?token=` | C-205 |
| Limites de arquivos | 300 MB / 50 por sala, por ENV | C-202 |
| Origem | função única `isAllowedOrigin` usada por WebSocket e CORS | RNF-SEC-06 |
| Keyframe de aluno | token bucket por `Client` (rajada 3, recarga 1/s), estado acessado só pela goroutine do hub | C-204, RNF-SEC-09 |

## 3. Security

Cada task fecha uma falha registrada em `001/converge.md` §2–§3 e `001/analyze.md` §5.

## 4. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Chave de host não chega ao backend em algum modo de execução | professor não consegue abrir sessão | geração no main do Electron e no `dev.js`; teste de serviço; smoke A1 em dev e empacotado |
| Allowlist de origem recusa um cenário legítimo | aluno ou professor sem WebSocket | matriz de origens em teste; smoke A2, A9, A15–A17; correção acrescenta origem, nunca volta a `true` |
| Sandbox quebra preload | app sem API nativa | mover clipboard antes; gate C-203 |
| Links de download sem token | aluno não baixa | `?token=` no `href`; smoke A13 |
| Limite de keyframe corta recuperação legítima do aluno | vídeo do aluno demora a descongelar | rajada cobre o pedido duplo da conexão; recarga de 1/s acompanha o watchdog; a SFU ainda pede keyframe ao conectar o aluno e a cada 10 s; smoke A4/A10 |

## Scope Lock

### IN

- S1–S9 conforme `spec.md` §2 (inclui a remoção completa do login em S3 e o limite de keyframe em S9);
- testes automatizados de cada correção;
- atualização desta feature e de notas de vigência nos contratos já escritos.

### OUT

- mudança de UX; remoção de outra funcionalidade; troca de stack; persistência; renomear claims do JWT;
- bloquear `request-keyframe` de alunos; alterar o cooldown de PLI da SFU (C-204).

### Allowed Paths

- `apps/backend/cmd/server/**`
- `apps/backend/internal/auth/**`
- `apps/backend/internal/room/**`
- `apps/backend/internal/signaling/**`
- `apps/backend/go.mod`, `apps/backend/go.sum`
- `apps/desktop/src/main/**`
- `apps/desktop/src/renderer/services/**`
- `apps/desktop/src/renderer/pages/Room.tsx` (apenas chamadas `fetch` de arquivos)
- `apps/desktop/src/test/setup.ts`
- `apps/desktop/src/env.d.ts`
- `apps/web/src/services/**`
- `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/hooks/useWebRTCSubscriber.test.ts`
- `apps/web/src/pages/Room.tsx` (apenas `href` de download), `apps/web/src/pages/Room.test.tsx`
- `scripts/dev.js`, `turbo.json`
- `packages/types/src/index.ts`
- `README.md` (apenas seções de bcrypt/licenças)
- `spec-kit/specs/002-security-hardening/**`
- `spec-kit/specs/001-screen-share-core/contracts/signaling.md` (apenas nota de vigência de `request-keyframe`, S9)

### Prohibited Paths

- `apps/backend/internal/webrtc/**`
- `apps/backend/internal/chat/**`
- `apps/desktop/src/renderer/media/**`
- `packages/ui/**`
- `.github/workflows/**`
- `spec-kit/specs/001-screen-share-core/**` e `spec-kit/specs/003-classroom-interaction/**` (exceto notas de vigência já previstas nos contratos)

### Dependencies

- Nenhuma nova. Go: `crypto/rand`, `crypto/subtle` (stdlib). Node: `crypto` (stdlib).
- `golang.org/x/crypto` pode **sair** do `go.mod` em S3 se o bcrypt for o único uso.

### Non-Goals

- recriar conta ou senha de professor;
- autenticação de alunos além do JWT de sala existente;
- criptografia de arquivos em memória.

## 5. Constitution Check

- [x] Princípio I — spec aprovada.
- [x] Princípio II — todas as correções reforçam autorização no servidor, cobertas por teste.
- [x] Princípio III — SFU intocada (`internal/webrtc/**` proibido).
- [x] Princípio IV — sem metas de desempenho; carga revalidada em F6/R3.
- [x] Princípio V — contratos `auth.md`, `room-api.md`, `files.md`, `desktop-ipc.md` já descrevem o alvo com vigência.
- [x] Princípio VI — Scope Lock e paths por task.
- [x] Princípio VII — sem abstração nova além de `isAllowedOrigin` (dois consumidores reais).
- [ ] Princípio VIII — `converge.md` ao final.

## 6. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-01 | Plano de remediação aprovado integralmente | plano F5 |
| 2026-11-01 | `request-keyframe` fora do escopo até decisão | C-204 |
| 2026-11-01 | S9 aprovada: limite de frequência por aluno, sem bloqueio por papel | C-204, T209 |
