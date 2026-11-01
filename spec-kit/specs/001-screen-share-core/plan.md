# Plan: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-01 a C-06 aprovados)

## 1. Summary

Implementar uma sala de transmissão onde o app desktop do professor (Electron) captura
a tela e o áudio e publica uma única upstream WebRTC para uma SFU em Go (Pion). O backend
Go controla identidade, salas, autorização, sinalização e chat de texto via WebSocket.
Os alunos acessam via web app (React + Vite) pelo link único, se identificam com Nome e
Matrícula e recebem a transmissão sem publicar mídia.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Repositório | Monorepo — Turborepo | ADR 0001 |
| App do Professor | Electron + React + TypeScript | ADR 0002 |
| Build desktop | electron-vite | ADR 0002 |
| Distribuição desktop | electron-builder | ADR 0002 |
| Web app dos alunos | React + TypeScript + Vite | — |
| Backend | Go | — |
| Sinalização + Chat | WebSocket (Go) | — |
| API de controle | HTTP/JSON (Go) | — |
| Autenticação | JWT; professor por sessão com chave de host, sem login | C-01, ADR 0006 |
| Mídia | WebRTC via SFU Pion | C-03 |
| Topologia | SFU | C-03 |
| TURN | opcional (coturn), habilitado por ENV fora da LAN | C-04, ADR 0005 |
| Limite da sala | 50 participantes (configurável via ENV) | C-02 |
| Persistência | nenhuma — estado em memória por execução do backend | ADR 0005 |
| Pacotes compartilhados | `packages/types` (DTOs), `packages/ui` (opcional) | — |
| Métricas | WebRTC stats + métricas do backend | — |

## 3. Architecture

```text
┌──────────────────────────────────┐
│     apps/desktop (Professor)     │
│  Electron + React + TypeScript   │
│                                  │
│  main process (Node.js):         │
│    desktopCapturer               │
│    IPC / contextBridge           │
│  renderer process (React):       │
│    Entrada, Dashboard, Room      │
│    useScreenShare, useWebRTC     │
└──────────────┬───────────────────┘
               │ WebRTC publish (tela + áudio)
               │ HTTP/WS (sessão, sala, sinalização, chat)
               ▼
┌──────────────────────────────────┐
│       apps/backend (Go)          │
│                                  │
│  internal/auth    → JWT          │
│  internal/room    → CRUD salas   │
│  internal/signaling → WebSocket  │
│  internal/chat    → mensagens    │
│  internal/webrtc  → SFU (Pion)  │
│                                  │
│  estado em memória (ADR 0005)    │
└──────────────┬───────────────────┘
               │ WebRTC subscribe (tela + áudio)
               │ HTTP/WSS (join, sinalização, chat)
               ▼
┌──────────────────────────────────┐
│      apps/web (Alunos)           │
│  React + TypeScript + Vite       │
│                                  │
│  /sala/:slug → Join (nome+mat.)  │
│  /sala/:slug/live → Room         │
│    VideoPlayer, ChatBox          │
│    useWebRTC (subscribe only)    │
│  Responsivo: desktop-first       │
└──────────────────────────────────┘

Infraestrutura:
  backend embarcado no app do professor (LAN offline — ADR 0005)
  TURN server (coturn) ← opcional, só para uso fora da LAN
```

## 4. Estrutura do Repositório

```text
screenshare/
├── turbo.json
├── package.json                    ← npm workspaces root
├── .gitignore
│
├── apps/
│   ├── desktop/                    ← App Electron do professor
│   │   ├── src/
│   │   │   ├── main/               ← main process
│   │   │   │   ├── main.ts
│   │   │   │   └── preload.ts      ← contextBridge (IPC seguro)
│   │   │   └── renderer/           ← React UI
│   │   │       ├── components/
│   │   │       ├── pages/
│   │   │       │   ├── Login.tsx
│   │   │       │   ├── Dashboard.tsx
│   │   │       │   └── Room.tsx
│   │   │       ├── hooks/
│   │   │       │   ├── useScreenShare.ts
│   │   │       │   ├── useAudio.ts
│   │   │       │   └── useWebRTC.ts
│   │   │       └── services/
│   │   │           ├── api.ts
│   │   │           └── signaling.ts
│   │   ├── electron.vite.config.ts
│   │   └── package.json
│   │
│   ├── web/                        ← Web app dos alunos
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── VideoPlayer.tsx
│   │   │   │   ├── ChatBox.tsx
│   │   │   │   └── StatusBanner.tsx
│   │   │   ├── pages/
│   │   │   │   ├── Join.tsx        ← nome + matrícula
│   │   │   │   └── Room.tsx        ← player + chat
│   │   │   ├── hooks/
│   │   │   │   ├── useWebRTC.ts    ← subscribe only
│   │   │   │   └── useChat.ts
│   │   │   └── services/
│   │   │       ├── api.ts
│   │   │       └── signaling.ts
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── backend/                    ← Go
│       ├── cmd/server/main.go
│       ├── internal/
│       │   ├── auth/
│       │   ├── room/
│       │   ├── signaling/
│       │   ├── chat/
│       │   └── webrtc/             ← SFU com Pion
│       ├── go.mod
│       ├── go.sum
│       └── package.json            ← wrapper de scripts para Turborepo
│
├── packages/
│   ├── types/                      ← DTOs TypeScript compartilhados
│   │   ├── src/
│   │   │   └── index.ts            ← Room, Participant, ChatMessage, eventos WS
│   │   └── package.json
│   └── ui/                         ← Componentes React (opcional)
│       └── package.json
│
└── docs/
    └── adrs/
        ├── 0001-monorepo-turborepo.md
        └── 0002-desktop-app-framework.md
```

## 5. Data Model

Ver `./data-model.md` (Status: READY).

Entidades: `Professor`, `Room`, `Participant`, `ChatMessage`, `Session`.

## 6. Contracts

Todos os contratos têm Status: READY:

- `contracts/auth.md` — JWT professor e aluno.
- `contracts/room-api.md` — CRUD de salas, link único, join.
- `contracts/signaling.md` — WebSocket: sinalização WebRTC + chat.
- `contracts/media-session.md` — semântica de publicação e assinatura.

## 7. Security

- JWT assinado com chave secreta de ENV; nunca hardcoded.
- Renderer do Electron não acessa Node.js diretamente; usa contextBridge.
- Somente professor autorizado publica tela e áudio.
- Alunos recebem permissão de subscribe; nunca de publish.
- Servidor valida JWT em toda conexão WebSocket antes de aceitar mensagens.
- Credenciais TURN geradas por tempo limitado no backend.
- Logs não expõem tokens completos.
- Nome e Matrícula são validados no servidor (campos não-vazios); UI não é fonte de verdade.

## 8. Performance and Observability

Metas iniciais (hipóteses até medição):

- resolução: até 1080p;
- FPS alvo: 30;
- upload do professor para SFU: ~3–6 Mbps;
- downstream da SFU para cada aluno: ~3 Mbps;
- teste mínimo de carga: 40 espectadores simultâneos.

Métricas mínimas por sessão:

- FPS recebido;
- bitrate;
- RTT;
- packet loss;
- tempo até primeiro frame (latência de entrada);
- quantidade de participantes ativos;
- CPU/RAM do backend durante testes de carga.

Não declarar meta atingida sem medição real.

## 9. Dependencies

### apps/desktop
- Electron (runtime Chromium embutido)
- electron-vite (build tool)
- electron-builder (distribuição)
- React + TypeScript
- `packages/types`
- `packages/ui` (opcional)

### apps/web
- React + TypeScript + Vite
- `packages/types`
- `packages/ui` (opcional)

### apps/backend
- Go
- Pion WebRTC (`github.com/pion/webrtc/v3`)
- JWT library (`github.com/golang-jwt/jwt/v5`)
- WebSocket library (`github.com/gorilla/websocket`)

### Infraestrutura
- Nenhuma infraestrutura obrigatória: o backend roda na máquina do professor (ADR 0005)
- coturn (TURN server) opcional, apenas para uso fora da rede local

## 10. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| NAT/firewall do aluno | aluno sem mídia | TURN obrigatório desde o primeiro deploy externo |
| SFU saturada | degradação de todos | teste de carga + métricas; limite de 50 por sala |
| permissões incorretas no Electron | publicação indevida ou acesso ao Node.js | contextBridge + validação server-side |
| Reconexão incompleta | aluno fica sem vídeo | state machine definida em `contracts/media-session.md` |
| Aluno entra com dados inválidos | sala poluída com nomes falsos | validação no servidor; campos obrigatórios |
| Chat com spam | sala degradada | rate limit server-side definido em `contracts/media-session.md` |

## 10a. Reconexão (State Machine)

A política completa está definida em `contracts/media-session.md`. Resumo para o plan:

### Professor perde conexão

- Backend detecta WebSocket fechado ou falha ICE.
- Backend emite `session-state: { status: "reconnecting" }` a todos os alunos (UI exibe banner).
- SFU mantém tracks de assinatura abertas por até `PUBLISHER_RECONNECT_TIMEOUT_S` segundos (padrão: 30s).
- Se reconectar dentro do timeout: tracks reativadas, alunos recebem `session-state: { status: "publishing" }`.
- Se timeout expirar: SFU encerra tracks, alunos recebem `room-closed` e vão para tela de espera.

### Aluno perde conexão

- Cliente detecta falha no ICE ou WebSocket e exibe indicador de reconexão.
- Cliente tenta reconexão com backoff exponencial (1s → 2s → 4s → ... → máx 30s).
- Ao reconectar: reenvia `join` + `subscribe-request` com o mesmo JWT (se ainda válido).
- Se JWT expirado: redireciona à página de identificação sem recriar a sala.

## 10b. Rate Limit do Chat

Aplicado server-side no módulo `internal/chat` (valores configuráveis via ENV):

| Janela | Limite | Ação |
|---|---|---|
| 5 segundos | 5 mensagens | `error: { code: "CHAT_RATE_LIMITED" }` |
| 1 minuto | 30 mensagens | `error: { code: "CHAT_RATE_LIMITED" }` |

- Não desconecta o participante; apenas recusa a mensagem.
- O cliente exibe feedback visual ao receber `CHAT_RATE_LIMITED`.
- ENVs: `CHAT_RATE_WINDOW_S`, `CHAT_RATE_MAX_PER_WINDOW`.


## Scope Lock

### IN

- entrada do professor no app Electron por nome, com sessão vinculada ao host (ADR 0006);
- criação/entrada de sala;
- geração de link único;
- captura de tela via desktopCapturer com separação estrita de Tela Cheia (display tracking) e Janela Específica (application isolation);
- gravação local opcional da aula pelo professor nos formatos .webm e .mp4 via MediaRecorder e diálogo nativo do SO;
- transmissão de áudio (microfone do professor);
- publicação ativa do desktop e assinatura WebRTC (SFU Pion);
- sinalização via WebSocket;
- identificação de aluno por Nome + Matrícula;
- chat de texto em tempo real;
- estados de conexão e reconexão;
- métricas mínimas de sessão;
- testes para 40+ espectadores.

### OUT

- câmera do professor ou alunos;
- microfone dos alunos;
- gravação ou retenção de mídia no servidor SFU (servidor permanece efêmero);
- transcodificação por aluno;
- painel administrativo completo;
- integração com banco de dados da instituição.

### Allowed Paths

- `apps/desktop/**`
- `apps/web/**`
- `apps/backend/**`
- `packages/types/**`
- `packages/ui/**`
- `spec-kit/specs/001-screen-share-core/**`
- `docs/**`, `spec-kit/docs/**`
- `spec-kit/.specify/**` somente para manutenção do kit

### Prohibited Paths

- `infra/production/**` até contrato de deploy existir;
- dependências não aprovadas neste plan;
- features fora desta spec (as features de interação de sala pertencem a `spec-kit/specs/003-classroom-interaction/**`);
- `spec-kit/specs/002-security-hardening/**` e `spec-kit/specs/003-classroom-interaction/**`.

### Dependencies aprovadas

- C-01: JWT (professor conforme ADR 0006).
- C-02: limite 50 configurável.
- C-03: Pion WebRTC.
- C-04: TURN (coturn) opcional (ADR 0005).
- ADR 0005: operação LAN offline; ADR 0006: sessão local do professor.
- C-05: Turborepo (ADR 0001).
- C-06: Electron (ADR 0002).

### Non-Goals

- videoconferência completa;
- distribuição P2P em mesh;
- gravação server-side em disco da SFU;
- edição/transcodificação por espectador;
- câmera do professor.

## 11. Constitution Check

- [x] Princípio I — especificação existe e está READY-FOR-PLAN.
- [x] Princípio II — autenticação JWT definida; server-side obrigatório.
- [x] Princípio III — SFU definida; P2P mesh rejeitado.
- [x] Princípio IV — métricas definidas; metas são hipóteses até medição.
- [x] Princípio V — todos os contratos estão em Status: READY.
- [x] Princípio VI — Scope Lock completo com paths e non-goals.
- [x] Princípio VII — complexidade restrita; sem abstrações sem consumidor.
- [ ] Princípio VIII — convergência em andamento: ver `converge.md` (Status: OPEN).

## 12. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-09-11 | Turborepo como estrutura do monorepo | ADR 0001 |
| 2026-09-11 | Electron como framework do app desktop | ADR 0002 |
| 2026-09-11 | JWT para autenticação | C-01 |
| 2026-09-11 | Limite 50 participantes configurável | C-02 |
| 2026-09-11 | Pion WebRTC como SFU | C-03 |
| 2026-09-11 | TURN obrigatório (coturn) | C-04 |
| 2026-11-01 | LAN offline, TURN opcional, estado em memória | ADR 0005 |
| 2026-11-01 | Login descontinuado; sessão do professor com chave de host | ADR 0006 |
