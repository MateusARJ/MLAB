# Tasks: Interação em Sala de Aula

Feature: `003-classroom-interaction`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE (T301–T314)

As tasks T301–T312 são **retroativas**: registram entregas já existentes, com a evidência que sustenta o `[x]`.
Elas não autorizam alteração de comportamento.

## Tarefas retroativas (concluídas)

### T301 — Levantar e abaixar a mão (RF-301, RN-301)
[x] T301
Allowed Paths: `apps/backend/internal/signaling/**`, `apps/desktop/src/renderer/**`, `apps/web/src/**`, `packages/types/src/**`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
Checks:
- [x] Evidência: `24532ae`, `2c4d040`, `15925bd`; `internal/signaling/hub_hand_test.go`; `apps/desktop/src/renderer/pages/RoomHandRaise.test.tsx`.

### T302 — Fixação de mensagens (RF-302, RN-302)
[x] T302
Allowed Paths: `apps/backend/internal/signaling/**`, `apps/desktop/src/renderer/**`, `apps/web/src/**`, `packages/types/src/**`, `packages/ui/src/**`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
Checks:
- [x] Evidência: `fbcd03f`, `aafe300`, `611990c`, `1627d99`; `hub_test.go` (`TestHub_PinMessage_RoleEnforcementLimitAndBroadcast`).

### T303 — Chat privado aluno ↔ professor (RF-303, RN-303)
[x] T303
Allowed Paths: `apps/backend/internal/signaling/**`, `apps/desktop/src/renderer/**`, `apps/web/src/**`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
Checks:
- [x] Evidência: `2a0e2c2`; `hub.go` (`onChatMessage`, ramo `IsPrivate`).
- [x] Teste de roteamento dedicado → T313.

### T304 — Máscara de palavrões (RF-304)
[x] T304
Allowed Paths: `apps/backend/internal/chat/**`, `apps/backend/internal/signaling/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`
Checks:
- [x] Evidência: `db27a16`, `972133e`; `internal/chat/profanity_test.go`.

### T305 — Histórico de chat público (RF-305, RN-304)
[x] T305
Allowed Paths: `apps/backend/internal/signaling/**`, `apps/desktop/src/renderer/**`, `apps/web/src/**`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
Checks:
- [x] Evidência: `hub.go` (`chatHistory`, limite 200); `hub_test.go` (`TestHub_ChatHistory_StoredAndSentOnRegister`).
- [x] Teste do limite de 200 → T314; exclusão de privadas → T313.

### T306 — Compartilhamento de arquivos (RF-306, RN-305)
[x] T306
Allowed Paths: `apps/backend/internal/room/**`, `apps/backend/internal/signaling/**`, `apps/desktop/src/renderer/**`, `apps/web/src/**`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
Checks:
- [x] Evidência: `internal/room/files.go`; `hub_test.go` (`TestHub_FilesHistory_StoredAndSentOnRegister`).
- [ ] Testes HTTP de upload/listagem/download, autenticação e limites → `002-security-hardening`/S4.

### T307 — Validação da matrícula (RF-307, RN-306)
[x] T307
Allowed Paths: `apps/backend/internal/room/**`, `apps/web/src/**`
Prohibited Paths: `apps/desktop/**`, `apps/backend/internal/signaling/**`
Checks:
- [x] Evidência: `bbd7caa`; `room_test.go` (`TestJoinValidation`, formatos inválidos).

### T308 — Áudio interno do computador (RF-308)
[x] T308
Allowed Paths: `apps/desktop/src/renderer/hooks/**`, `apps/desktop/src/renderer/pages/Room.tsx`
Prohibited Paths: `apps/backend/**`, `apps/web/**`
Checks:
- [x] Evidência: `89e35c8`, `2a0e2c2` (persistência do estado de áudio); `useScreenCapture.ts` (`systemAudioMuted`); `useScreenCapture.test.ts`.

### T309 — Overlay de anotação, lupa, spotlight e atalhos (RF-309)
[x] T309
Allowed Paths: `apps/desktop/src/main/**`, `apps/desktop/src/renderer/**`, `packages/types/src/**`, `packages/ui/src/**`
Prohibited Paths: `apps/backend/**`, `apps/web/**`
Checks:
- [x] Evidência: `1ac9de4`, `cc8727a`, `a179afb`, `5f963bc`, `e8a6df1`, `17aa66d`; `FloatingAnnotationOverlay.test.tsx`; `doubleCtrlDetector.test.ts`.

### T310 — Cursor contextual e rastreamento nativo de janelas (RF-310)
[x] T310
Allowed Paths: `apps/desktop/src/main/**`, `apps/desktop/src/renderer/media/**`, `apps/desktop/src/shared/**`, `packages/types/src/**`
Prohibited Paths: `apps/backend/**`, `apps/web/**`
Checks:
- [x] Evidência: `60043f8`, `9db5a84`, `cae96ca`, `10312a1`; `cursorVisibility.test.ts`; `nativeWindowTracker.test.ts`; `createCursorMaskedTrack.test.ts`.
- Nota (2026-11-02): o `29c54d0` removeu a ocultação do cursor do worker (regressão, issue #28). Restaurada no modo
  janela específica pela `007-mascara-cursor-janela` (T701–T703); tela cheia sem ocultação por emenda (C-702).
  Revalidação: smoke A12 (007/T705).

### T311 — Proteção de conteúdo e captura para a área de transferência (RF-311)
[x] T311
Allowed Paths: `apps/desktop/src/main/**`, `apps/desktop/src/renderer/**`
Prohibited Paths: `apps/backend/**`, `apps/web/**`
Checks:
- [x] Evidência: `82e8487`, `cc8727a`; IPC `set-content-protection`, `capture-window-to-clipboard` (`contracts/desktop-ipc.md`).
- [x] Validação manual: matriz de smoke A12 (`docs/metrics/baseline-2026-11.md`).

### T312 — Link `mlab.local` e IP físico (RF-312)
[x] T312
Allowed Paths: `apps/backend/internal/room/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `apps/backend/internal/webrtc/**`
Checks:
- [x] Evidência: `1c47cdb`, `f43a32b`; `mdns_test.go`; `network_test.go`.

---

## Tarefas de lacuna (pendentes)

### T313 — Teste de roteamento do chat privado
[x] T313
Depends On: T303
Allowed Paths: `apps/backend/internal/signaling/hub_test.go`
Prohibited Paths: `apps/backend/internal/signaling/hub.go`, `apps/**` (exceto o arquivo permitido)
Checks:
- [x] Mensagem privada de aluno chega ao professor e ao remetente, e **não** chega a outro aluno.
- [x] Mensagem privada do professor chega só ao `target_id` e ao remetente.
- [x] Mensagem privada não entra em `chatHistory`.
- [x] `go test -count=1 ./...` verde (`TestHub_PrivateChat_Routing`). Nenhuma mudança em código de produção.

### T314 — Teste do limite do histórico de chat
[x] T314
Depends On: T305
Allowed Paths: `apps/backend/internal/signaling/hub_test.go`
Prohibited Paths: `apps/backend/internal/signaling/hub.go`, `apps/**` (exceto o arquivo permitido)
Checks:
- [x] Após 201 mensagens públicas, `chatHistory` tem 200 e a mais antiga foi descartada.
- [x] `go test -count=1 ./...` verde (`TestHub_ChatHistory_KeepsLatest200`). Nenhuma mudança em código de produção.
