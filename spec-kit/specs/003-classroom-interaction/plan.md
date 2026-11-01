# Plan: Interação em Sala de Aula

Feature: `003-classroom-interaction`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-301 a C-306)

## 1. Summary

Plano retroativo. As funcionalidades já estão implementadas; este plano mapeia cada requisito para os módulos que o
implementam, define o Scope Lock para manutenções futuras e cria tarefas para as lacunas de teste encontradas.
Nenhuma tarefa deste plano altera comportamento.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Transporte das interações | mesmo WebSocket de sinalização da 001 | `001/contracts/signaling.md` |
| Estado | em memória no `Hub` da sala e no `FileStore` | ADR 0005 |
| Arquivos | REST multipart, servidos pelo backend embarcado | `contracts/files.md` |
| Overlay e atalhos | janela Electron transparente + `globalShortcut` | ADR 0002 |
| Duplo Ctrl e rastreamento nativo | `koffi` (FFI) com APIs nativas do SO | C-304 |
| mDNS | servidor mDNS próprio em Go, UDP 5353 | US-22 |

## 3. Mapa requisito → implementação

| RF | Backend | Desktop | Web |
|---|---|---|---|
| RF-301 mão | `internal/signaling/hub.go` (`onRaiseHand`, `onLowerHand`) | `renderer/pages/Room.tsx` (fila, toast) | `src/pages/Room.tsx` (botão) |
| RF-302 fixar | `hub.go` (`onPinMessage`, `maxPinnedMessages`) | `Room.tsx` | `Room.tsx` (somente leitura) |
| RF-303 chat privado | `hub.go` (`onChatMessage`) | `Room.tsx` | `Room.tsx` |
| RF-304 palavrões | `internal/chat/profanity.go` | — | — |
| RF-305 histórico | `hub.go` (`chatHistory`) | `Room.tsx` | `useWebRTCSubscriber.ts`, `Room.tsx` |
| RF-306 arquivos | `internal/room/files.go`, `handler.go` | `Room.tsx` (upload/lista) | `useWebRTCSubscriber.ts`, `Room.tsx` |
| RF-307 matrícula | `internal/room/handler.go` (`studentIDRegex`) | — | `src/pages/Join.tsx` |
| RF-308 áudio interno | — | `renderer/hooks/useScreenCapture.ts` | — |
| RF-309 anotação/lupa | — | `main/annotationOverlayWindow.ts`, `main/doubleCtrlDetector.ts`, `renderer/components/FloatingAnnotationOverlay.tsx` | — |
| RF-310 cursor/janelas | — | `main/cursorPresence.ts`, `main/nativeWindowTracker.ts`, `shared/cursorVisibility.ts`, `renderer/media/*` | — |
| RF-311 proteção/clipboard | — | `main/main.ts` (`set-content-protection`, `capture-window-to-clipboard`) | — |
| RF-312 mDNS/IP | `internal/room/mdns*.go`, `network.go` | — | — |

## 4. Security

- Toda permissão é verificada no servidor (`hub.go` checa o papel em `raise-hand`, `pin-message`, `stream-pause`, `end-session`).
- Chat privado nunca é entregue a outro aluno (RN-303).
- Listagem/download de arquivos sem autenticação e sem teto por sala: corrigido em `002-security-hardening`/S4.
- Renderer só acessa recursos nativos via `contextBridge` (`contracts/desktop-ipc.md`).

## 5. Performance / Observabilidade

- Histórico limitado a 200 mensagens; fixações a 3 por escopo.
- Arquivos em memória: limite por arquivo (50 MB) hoje; teto por sala em 002/S4.
- Overlay e rastreamento degradam sem derrubar a transmissão (RNF-303).

## 6. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Arquivos grandes esgotam a memória da máquina do professor | travamento da aula | teto por sala (002/S4) |
| Porta 5353 ocupada | `mlab.local` indisponível | link por IP continua funcionando (já implementado) |
| API nativa indisponível (Linux headless, permissões macOS) | sem cursor contextual / duplo Ctrl | retorno nulo tratado; botão e `Alt+Z` |
| Dicionário de palavrões incompleto | ofensas passam | dicionário versionado em `profanity.go` com testes |

## Scope Lock

### IN

- manutenção das funcionalidades RF-301 a RF-312 sem mudança de comportamento;
- testes que cubram as lacunas listadas em `tasks.md`;
- documentação desta feature.

### OUT

- novas funcionalidades de interação (exigem nova spec ou emenda desta);
- persistência de chat, arquivos ou fixações;
- upload por alunos; chat privado aluno ↔ aluno;
- mudanças de segurança (pertencem a `002-security-hardening`).

### Allowed Paths

- `apps/backend/internal/signaling/**`
- `apps/backend/internal/chat/**`
- `apps/backend/internal/room/**`
- `apps/desktop/src/main/**`
- `apps/desktop/src/renderer/**`
- `apps/desktop/src/shared/**`
- `apps/web/src/**`
- `packages/types/src/**`
- `packages/ui/src/**`
- `spec-kit/specs/003-classroom-interaction/**`

### Prohibited Paths

- `apps/backend/internal/webrtc/**`
- `apps/backend/internal/auth/**`
- `apps/backend/cmd/**`
- `spec-kit/specs/001-screen-share-core/**`, `spec-kit/specs/002-security-hardening/**`
- `.github/workflows/**`

### Dependencies

- Já existentes e aprovadas por esta feature: `koffi` (desktop, FFI nativo), `react-router-dom` (web), `@mlab/ui`, `@mlab/types`.
- Herdadas da 001: Go `gorilla/websocket`, `golang-jwt/jwt/v5`, `pion/webrtc/v3`; Electron, React, Vite, Vitest.
- Nenhuma dependência nova.

### Non-Goals

- moderação avançada (banir, silenciar aluno);
- anotações por alunos;
- histórico de mensagens privadas;
- sincronização do overlay de anotação como camada separada para os alunos (a anotação aparece porque faz parte da tela capturada).

## 7. Constitution Check

- [x] Princípio I — spec existe e está fechada (retroativa, sem requisito indefinido).
- [x] Princípio II — autorização no servidor documentada; lacunas de arquivos encaminhadas à 002.
- [x] Princípio III — nenhuma mudança na topologia SFU.
- [x] Princípio IV — sem metas de desempenho novas.
- [x] Princípio V — contratos `signaling-classroom`, `files`, `desktop-ipc` em READY.
- [x] Princípio VI — Scope Lock completo; todas as tasks com paths.
- [x] Princípio VII — nenhuma abstração nova.
- [ ] Princípio VIII — convergência: tasks de teste T313–T314 pendentes.

## 8. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-01 | Feature retroativa aprovada com o plano de remediação | plano F4.2 |
| 2026-11-01 | Histórico público de 200 mensagens substitui a RN-18 da 001 | C-301 |
| 2026-11-01 | Arquivos mantidos; limites e autenticação na 002/S4 | C-302, D6 |
