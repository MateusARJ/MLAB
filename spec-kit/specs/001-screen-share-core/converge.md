# Converge: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Mode: READ-ONLY sobre o código (só este arquivo é escrito)
Data: 2026-11-01
Commit avaliado: `4f3caad` (versão 1.5.7)
Status: OPEN

## Entradas

- `spec.md`, `clarify.md`, `plan.md`, `tasks.md` (T001–T033), `contracts/`
- código real em `apps/**` e `packages/**`
- testes: `go test -count=1 ./...` (6/6 pacotes OK), `turbo run test --force` (web 25/25, desktop 82/82) — ver `docs/metrics/baseline-2026-11.md`

## 1. Requisitos atendidos

| Requisito | Evidência |
|---|---|
| RF-01 papel via JWT | `internal/auth/jwt.go`, `middleware.go`; `auth_test.go`, `auth_security_test.go` |
| RF-02 / RN-09 só o professor publica | `internal/webrtc/sfu.go`; `sfu_security_test.go` |
| RF-03 aluno espectador | `apps/web/src/hooks/useWebRTCSubscriber.ts` (subscribe-only) |
| RF-04 / RF-26 / RF-27 captura tela cheia e janela | `apps/desktop/src/main/main.ts` (`get-screen-sources`), `hooks/useScreenCapture.ts`; `useScreenCapture.test.ts` |
| RF-05 / RF-06 / RF-29 SFU Pion, upstream único | `internal/webrtc/`, `hooks/useWebRTCPublisher.ts`; `sfu_test.go` |
| RF-07 estados da sala via WS | `internal/signaling/message.go` (`session-state`, `room-closed`) |
| RF-09 / RF-16 / RF-17 chat com papel e `sent_at` | `internal/chat/service.go`; `chat_test.go` |
| RF-10 / RF-20 / RN-10 áudio e mute independentes | `useScreenCapture.ts`, `useWebRTCPublisher.ts` |
| RF-11 / RN-02 Nome + Matrícula | `room/handler.go` (`joinRoom`), `apps/web/src/pages/Join.tsx`; `Join.test.tsx` |
| RF-13 / RF-14 / RN-05 link e operações REST do professor | `room/handler.go`; `room_security_test.go` |
| RF-15 encerramento da sala | `POST /rooms/{id}/close`, `room-closed` |
| RF-18 / RN-13 reconexão do professor 30s | `internal/signaling/hub.go`; `hub_test.go` |
| RF-19 / RN-14 backoff do aluno | `useWebRTCSubscriber.ts`; `useWebRTCSubscriber.test.ts` |
| RF-21 / RF-22 autoplay, fullscreen, PiP | `apps/web/src/pages/Room.tsx`; `Room.test.tsx` |
| RF-23 / RN-11 TURN HMAC-SHA1 | `internal/signaling/` (credenciais temporárias); `signaling_security_test.go` |
| RF-25 ICE restart | `useWebRTCSubscriber.ts` |
| RF-28 / RNF-18 / RN-19 gravação local .webm/.mp4 | `hooks/useLocalRecorder.ts`, IPC `save-recorded-video` |
| RN-03 / RN-04 isolamento por sala e sessão única (`4001`) | `signaling/handler.go`, `hub.go`; `signaling_security_test.go` |
| RN-07 / RN-08 capacidade (429) e sala encerrada (409) | `room/handler.go`; `room_test.go` |
| RN-12 / RN-20 troca de fonte sem desconectar | `replaceTrack` em `useWebRTCPublisher.ts` |
| RN-15 / RN-16 / RN-17 / RNF-17 rate limit e sanitização | `hub.go`, `chat/service.go`; `chat_security_test.go` |
| RNF-14 portas UDP 50000–50100 | `internal/webrtc/sfu.go` |
| RNF-16 SFU efêmero (sem mídia em disco) | `internal/webrtc/` (repasse RTP em memória) |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RF-24 verificação de permissões do SO | A tela `Permissions.tsx` (T029) foi removida em `4f3caad`. O processo principal ainda trata permissões (`setPermissionRequestHandler`, `main.ts:597`), mas não há verificação explícita antes da captura. Requisito precisa ser reescrito para o fluxo atual ou receber nova task. | `main.ts` |
| RF-08 / RNF-04 métricas | Coleta existe no cliente; não há exposição contínua no backend verificada nesta convergência. | `docs/metrics/validation_report.md` (declarado, não reexecutado) |
| RNF-01/02/03/08/09/15 metas de desempenho | Medições declaradas em `docs/metrics/validation_report.md`; não reexecutadas após os commits de 60 fps e drift compensation (`29c54d0`, `1ed55d1`). Princípio IV exige nova medição. | `docs/load-test/load_test.go` |
| RNF-05 segredos | `JWT_SECRET` com valor fixo de fallback em `cmd/server/main.go:24` e `apps/desktop/src/main/main.ts:537`. | encaminhado para 002/S1 |
| RNF-07 distribuição multiplataforma | Build Windows e Linux existentes (`scripts/build-linux-wsl.js`); macOS não verificado. | `.github/workflows/build-all.yml` |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| US-01 / RF-12 / RN-01 | Login por e-mail e senha, bcrypt | UI de login removida (`4f3caad`); desktop usa `POST /auth/session` só com nome, **sem nenhuma verificação**. Backend ainda mantém `/auth/login`, bcrypt e credenciais semeadas. | ADR 0006; emenda em F4; remoção do login em 002/S3; proteção da sessão em 002/S2 |
| RN-06 slug | aleatório `palavra-palavra-numero` | slug fixo derivado do professor e reutilizado (T032), link `/sala/{sala}/{prof}` | emenda em F4 |
| RN-18 | sem histórico retroativo de chat | `hub.go` envia `chat-history` (até 200 mensagens públicas) a quem entra | emenda: RN-18 movida e reescrita na 003 |
| Spec §2 "Não incluído: upload de arquivos" | fora do escopo | `room/files.go`: upload pelo professor, listagem e download | movido para 003 (US-16) |
| C-04 TURN | obrigatório | operação primária 100% LAN; TURN só quando configurado | ADR 0005 |
| C-01 / RNF-10 PostgreSQL | credenciais e persistência em PostgreSQL | todo estado em memória (`store_inmemory.go`, `room/store.go`) | ADR 0005 |
| RNF-02 / RNF-09 | 30 FPS; upload 3–6 Mbps | perfis 1080p@30 (4 Mbps) e 1080p@60 (6 Mbps); teto REMB 8 Mbps | emenda em F4 |
| `contracts/room-api.md` | rotas `/rooms/{id}/join` etc. | rotas extras: `/rooms/{sala}/{prof}/join`, `/rooms/{sala}/{prof}/info`, `/rooms/{id}/info`, `/rooms/active`, `/rooms/{id}/files*` | contrato atualizado em F4 (001 e 003) |
| `contracts/signaling.md` | conjunto original de mensagens | mensagens extras: `end-session`, `stream-pause`/`stream-paused`, `request-keyframe`, `raise-hand`/`lower-hand`/`hand-updated`, `pin-message`/`chat-message-pinned`, `chat-history`, `files-history`, `file-shared`, `participants-update`, `stream-started`, chat com `is_private`/`target_id` | `stream-*`, `request-keyframe`, `end-session`, `participants-update` em 001; o restante em 003 |
| `request-keyframe` | contrato: enviado pelo publisher | `hub.go` aceita de qualquer participante (aluno pode forçar keyframes repetidos) | aguarda decisão: proposta de task S9 na 002 |
| T014 / T029 | tasks `[x]` com arquivos `Login.tsx` e `Permissions.tsx` | arquivos apagados em `4f3caad` | T014 REMOVIDA (login descontinuado), T029 SUPERSEDED |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| Levantar/abaixar mão com fila ordenada | `hub.go`, `RoomHandRaise.test.tsx`, `hub_hand_test.go` | 003 / US-11 |
| Fixar mensagens (máx. 3 público e 3 por conversa privada) | `hub.go:28` (`maxPinnedMessages`) | 003 / US-12 |
| Chat privado aluno ↔ professor | `message.go` (`is_private`, `target_id`) | 003 / US-13 |
| Máscara de palavrões | `internal/chat/profanity.go`; `profanity_test.go` | 003 / US-14 |
| Histórico de chat para quem entra depois (200) | `hub.go:504` | 003 / US-15 |
| Compartilhamento de arquivos | `internal/room/files.go` | 003 / US-16 |
| Validação de matrícula por regex | `room/handler.go:20` | 003 / US-17 |
| Áudio interno do computador | commit `89e35c8` | 003 / US-18 |
| Overlay de anotações, lupa, duplo Ctrl | `annotationOverlayWindow.ts`, `doubleCtrlDetector.ts`, `FloatingAnnotationOverlay.tsx` | 003 / US-19 |
| Ocultação de cursor e tracker nativo de janelas | `cursorPresence.ts`, `nativeWindowTracker.ts`, `media/createCursorMaskedTrack.ts` | 003 / US-20 |
| Proteção de conteúdo e captura para área de transferência | IPC `set-content-protection`, `capture-window-to-clipboard` | 003 / US-21 |
| Link `mlab.local` / mDNS | `internal/room/mdns*.go`; `mdns_test.go` | 003 / US-22 |
| Detecção de IP físico e descarte de adaptadores virtuais | `internal/room/network.go`; `network_test.go` | ADR 0005 + 003 / US-22 |
| Pausa de transmissão e keyframe sob demanda | `stream-pause`, `request-keyframe` | emenda 001 (complementa RF-20 e RN-12) |

## 5. Testes faltantes

- Nenhum teste para endpoints de arquivos (`files.go`).
- Nenhum teste para o chat privado e para a fixação de mensagens no backend.
- Nenhum teste garante que `/auth/session` recusa requisições sem prova de origem (hoje aceita qualquer uma).
- Não há teste de liberação de memória dos arquivos ao encerrar a sala (hoje os arquivos nunca são liberados).
- Medições de desempenho não reexecutadas após `29c54d0` e `1ed55d1`.

## 6. Novas tasks necessárias

- 002/S1–S8 (`specs/002-security-hardening/`).
- 003/T301–T312 retroativas e tasks de teste para as lacunas acima.
- Reescrita de RF-24 conforme o fluxo atual de permissões.
- Reexecução de `docs/load-test/` e atualização de `docs/metrics/validation_report.md` (F6/R3).

## 7. Resultado

- [x] OPEN — há gaps registrados acima com encaminhamento definido.
- [ ] CONVERGED

Os gaps serão fechados pelas fases F3 a F6 de `spec-kit/docs/plano-remediacao-speckit-seguranca.md`.
