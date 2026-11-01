# Tasks: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

## Tarefas de decisão (concluídas)

### T001 — Fechar decisão de autenticação

[x] T001 [US-01, US-04]

Allowed Paths:
- `specs/001-screen-share-core/clarify.md`
- `specs/001-screen-share-core/spec.md`
- `specs/001-screen-share-core/plan.md`
- `specs/001-screen-share-core/contracts/**`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*

Checks:
- [x] C-01 respondida — JWT com Nome + Matrícula.
- [x] `contracts/auth.md` criado e em READY.

---

### T002 — Fechar limite de participantes

[x] T002 [US-06]

Allowed Paths:
- `specs/001-screen-share-core/clarify.md`
- `specs/001-screen-share-core/spec.md`
- `specs/001-screen-share-core/plan.md`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*

Checks:
- [x] C-02 respondida — 50 participantes, configurável.

---

### T003 — Escolher SFU

[x] T003 [US-06]

Allowed Paths:
- `specs/001-screen-share-core/clarify.md`
- `specs/001-screen-share-core/plan.md`
- `specs/001-screen-share-core/contracts/**`
- `docs/adrs/**`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*

Checks:
- [x] C-03 respondida — Pion WebRTC.
- [x] ADR não necessária para este item (Pion é a implementação inicial; mudança futura exigirá ADR).

---

### T004 — Fechar decisão de TURN

[x] T004 [US-06]

Depends On: T003

Allowed Paths:
- `specs/001-screen-share-core/clarify.md`
- `specs/001-screen-share-core/plan.md`
- `specs/001-screen-share-core/contracts/**`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*

Checks:
- [x] C-04 respondida — TURN obrigatório (coturn).
- [x] `contracts/signaling.md` atualizado com IceServers.

---

### T005a — Fechar estrutura do repositório (Turborepo)

[x] T005a [estrutural]

Allowed Paths:
- `specs/001-screen-share-core/clarify.md`
- `specs/001-screen-share-core/plan.md`
- `docs/adrs/**`
- `AGENTS.md`
- `.specify/memory/project-context.md`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*

Checks:
- [x] C-05 respondida — Turborepo.
- [x] ADR 0001 criada e aprovada.
- [x] `AGENTS.md` e `project-context.md` atualizados.

---

### T005b — Fechar framework do app desktop (Electron)

[x] T005b [estrutural]

Depends On: T005a

Allowed Paths:
- `specs/001-screen-share-core/clarify.md`
- `specs/001-screen-share-core/plan.md`
- `docs/adrs/**`
- `AGENTS.md`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*

Checks:
- [x] C-06 respondida — Electron.
- [x] ADR 0002 criada e aprovada.
- [x] `AGENTS.md` atualizado com fronteiras do Electron.

---

### T005 — Revalidar spec/plan/checklist/analyze

[x] T005 [revalidação completa]

Depends On: T001, T002, T003, T004, T005a, T005b

Allowed Paths:
- `specs/001-screen-share-core/**`
- `specs/001-screen-share-core/contracts/**`
- `specs/001-screen-share-core/plan.md`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*

Checks:
- [x] checklist APPROVED — `checklists/requirements.md` Status: APPROVED.
- [x] analyze PASS — `analyze.md` Status: PASS.
- [x] Todos os contratos em READY — auth, room-api, signaling, media-session.
- [x] plan.md sem itens PENDENTE — seções 10a e 10b adicionadas.

Itens executados em T005:
- `contracts/media-session.md` elevado de DRAFT para READY.
- Política de reconexão detalhada em `plan.md` (seção 10a).
- Rate limit do chat definido em `plan.md` (seção 10b) e `contracts/media-session.md`.

---

## Tarefas de implementação

Status: **UNLOCKED** — T005 concluída. As tarefas T006+ abaixo são válidas e devem
ser expandidas com Allowed Paths e checks explícitos antes de cada implementação.

### T006 — Scaffold do monorepo
[x] T006
Allowed Paths: `turbo.json`, `package.json`, `apps/**`, `packages/**`, `.gitignore`
Prohibited Paths: `specs/**`, `docs/**`
Checks:
- [x] `turbo run build` — 5/5 tasks, exit 0 (types, ui, backend, web, desktop).
- [x] Estrutura de pastas corresponde ao plan (apps/desktop, apps/web, apps/backend, packages/types, packages/ui).

### T007 — packages/types — DTOs compartilhados
[x] T007
Depends On: T006
Allowed Paths: `packages/types/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `apps/backend/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Tipos importados sem erro em `apps/desktop` — turbo run lint 5/5 OK.
- [x] Tipos importados sem erro em `apps/web` — turbo run lint 5/5 OK.
Nota: implementado antecipadamente dentro do T006 (packages/types/src/index.ts).

### T008 — apps/backend — módulo auth
[x] T008
> Nota: `POST /auth/login`, bcrypt e o store de professores são removidos em `002-security-hardening`/S3 (ADR 0006). Os demais itens desta task (JWT, middleware) permanecem válidos.
Depends On: T007
Allowed Paths: `apps/backend/internal/auth/**`, `apps/backend/cmd/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Código escrito conforme `contracts/auth.md` (model, jwt, handler, middleware, store).
- [x] `POST /auth/login` implementado com bcrypt + JWT HS256.
- [x] Token inválido retorna 401 (middleware.go).
- [x] Testes unitários e de segurança (`auth_test.go`, `auth_security_test.go`): validação de JWT, senhas bcrypt e rejeição de tokens forjados/expirados (ADR 0003, ADR 0004).

### T009 — apps/backend — módulo room
[x] T009
Depends On: T008
Allowed Paths: `apps/backend/internal/room/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] `POST /rooms` — cria sala com slug legível, retorna link.
- [x] `GET /rooms/{id}/link` — professor obtém link (verifica propriedade).
- [x] `POST /rooms/{id}/join` — aluno recebe JWT, verifica limite e status.
- [x] `POST /rooms/{id}/close` — professor encerra sala (verifica propriedade).
- [x] Erros 401/403/404/409/429 implementados conforme contrato.
- [x] Testes unitários e de segurança (`room_test.go`, `room_security_test.go`): gerador de slug e restrição de acesso por propriedade (`403 Forbidden`) (ADR 0003, ADR 0004).

### T010 — apps/backend — módulo signaling (WebSocket)
[x] T010
Depends On: T009
Allowed Paths: `apps/backend/internal/signaling/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Upgrade WebSocket com JWT validation (query param `?token=`).
- [x] Hub por sala: register/unregister, broadcast, broadcastExcept.
- [x] Mensagens C→S: join via upgrade, offer, answer, ice-candidate, publish-request, subscribe-request, chat-message.
- [x] Mensagens S→C: session-state, publish-approved, participant-joined, participant-left, room-closed, ice-servers, error.
- [x] Rate limit de chat (5/5s, 30/60s) — sliding window no hub.
- [x] Reconexão do publisher: timer 30s → room-closed (§10a media-session.md).
- [x] TURN credentials temporárias (HMAC-SHA1, RFC 8489).
- [x] Interface SFU desacoplada — hub opera em stub até T011.
- [x] Testes de integração e segurança (`hub_test.go`, `signaling_security_test.go`): upgrade WS, desconexão de sessão única (`4001 Duplicate Session`), rate limit e HMAC TURN (ADR 0003, ADR 0004).

### T011 — apps/backend — módulo webrtc (SFU Pion)
[x] T011
Depends On: T010
Allowed Paths: `apps/backend/internal/webrtc/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Professor publica tela + áudio em tracks independentes (RF-05, RF-10, RN-10).
- [x] SFU aloca portas UDP na faixa 50000–50100 (RNF-14).
- [x] 2+ alunos recebem downstream sem upstream adicional do professor (RF-06, RNF-09).
- [x] Mídia repassada em memória com zero gravação em disco (RNF-15, RNF-16).
- [x] Testes de unidade e segurança (`sfu_test.go`, `sfu_security_test.go`): isolamento de tracks por sala e rejeição de `publish-request` de alunos (ADR 0003, ADR 0004).

### T012 — apps/backend — módulo chat
[x] T012
Depends On: T010
Allowed Paths: `apps/backend/internal/chat/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Mensagem enviada por participante chega a todos com nome e papel `[Professor]` / `[Aluno]` (RF-09, RF-16).
- [x] Timestamp `sent_at` gerado no servidor e mensagens vazias descartadas (RF-17, RN-17).
- [x] Rate limit (5/5s, 30/60s) retorna erro `CHAT_RATE_LIMITED` sem desconectar usuário (RF-17, RN-15, RN-16).
- [x] Sanitização XSS aplicada antes do broadcast (RNF-17).
- [x] Testes unitários e de segurança (`chat_test.go`, `chat_security_test.go`): descarte de mensagens vazias e prevenção contra injeção de HTML/XSS (ADR 0003, ADR 0004).

### T013 — apps/desktop — scaffold Electron
[x] T013
Depends On: T007
Allowed Paths: `apps/desktop/**`
Prohibited Paths: `apps/web/**`, `apps/backend/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks: `npm run dev` (desktop) abre janela Electron; contextBridge exposto corretamente; suíte de testes Vitest configurada.

### T014 — apps/desktop — UI Login
[x] T014
> **REMOVIDA — feature descontinuada.** O login do professor foi descontinuado por decisão do produto (ADR 0006). `Login.tsx` e `Login.test.tsx` foram apagados em `4f3caad`; o backend residual é removido em `002-security-hardening`/S3. Mantida apenas como histórico.
Depends On: T013, T008
Allowed Paths: `apps/desktop/src/renderer/pages/Login.tsx`, `apps/desktop/src/renderer/services/**`
Prohibited Paths: `apps/web/**`, `apps/backend/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Professor faz login com credenciais válidas, obtém JWT de 8h e é redirecionado ao Dashboard (RF-12, RN-01).
- [x] Testes de componente React (`Login.test.tsx`): renderização do formulário, validação de campos e erro de login.

### T015 — apps/desktop — UI Dashboard
[x] T015
Depends On: T014, T009
Allowed Paths: `apps/desktop/src/renderer/pages/Dashboard.tsx`
Prohibited Paths: `apps/web/**`, `apps/backend/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Professor cria sala, obtém slug único e copia link de convite; sala aparece em status "waiting" (RF-13, RN-05, RN-06).
- [x] Testes de componente React (`Dashboard.test.tsx`): cópia de link único e estado da sala.

### T016 — apps/desktop — UI Room (captura de tela, áudio, chat)
[x] T016
Depends On: T015, T011, T012
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/hooks/**`
Prohibited Paths: `apps/web/**`, `apps/backend/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Checagem prévia de permissões do SO para tela e microfone (RF-24).
- [x] Seletor nativo de monitores e janelas via `desktopCapturer` (RF-04).
- [x] Toggle de mute de microfone e pausa de vídeo independentes (RF-20).
- [x] Troca de fonte de captura mantém a mesma PeerConnection ativa (RN-12).
- [x] Testes de componente e mocks (`Room.test.tsx`): mocks de `desktopCapturer` e IPC Electron.

### T017 — apps/web — scaffold Vite
[x] T017
Depends On: T007
Allowed Paths: `apps/web/**`
Prohibited Paths: `apps/desktop/**`, `apps/backend/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks: `npm run dev` (web) abre no navegador sem erro; rota `/sala/:slug` existe; suíte de testes Vitest configurada.

### T018 — apps/web — página Join
[x] T018
Depends On: T017, T009
Allowed Paths: `apps/web/src/pages/Join.tsx`, `apps/web/src/services/**`
Prohibited Paths: `apps/desktop/**`, `apps/backend/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Aluno informa Nome e Matrícula; campos vazios bloqueados (RF-11, RN-02).
- [x] Sessão única por aluno: reconexão com mesmo aluno desconecta sessão anterior com `4001 Duplicate Session` (RN-04).
- [x] Testes de componente React e segurança (`Join.test.tsx`): validação de formulário e tratamento de erro 4001.

### T019 — apps/web — página Room (player WebRTC + chat)
[x] T019
Depends On: T018, T011, T012
Allowed Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/hooks/**`, `apps/web/src/components/**`
Prohibited Paths: `apps/desktop/**`, `apps/backend/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Aluno recebe vídeo e áudio do professor sem permissão de publicação (RF-03, RN-09).
- [x] Autoplay Policy tratada com botão interativo "Clique para Ativar Som" (RF-21).
- [x] Modos Fullscreen e Picture-in-Picture funcionais (RF-22).
- [x] Monitoramento de `iceConnectionState` aciona ICE Restart em falhas de rota (RF-25).
- [x] Reconexão do aluno com backoff exponencial 1s a 30s (RF-19, RN-14).
- [x] Testes de componente React e mocks de mídia (`Room.test.tsx`): Autoplay fallback e chat sanitizado.

### T020 — Testes de carga (40 espectadores)
[x] T020
Depends On: T019
Allowed Paths: `docs/load-test/**`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks: 40 clientes simulados assinam a stream; FPS ≥ 25, packet loss < 2%, RTT < 300ms, upload do professor fixo entre 3-6 Mbps e CPU do servidor < 15% (RF-08, RNF-01 a RNF-09, RNF-15).

> **SUPERSEDED por T034 (2026-11-01).** O `load_test.go` desta task comparava valores fixos com as metas, sem subir o SFU (`converge.md` §2, C-07). Mantida como histórico; a evidência válida de carga é a da T034.

### T021 — Medição de métricas e validação dos RNFs
[x] T021
Depends On: T020
Allowed Paths: `docs/metrics/**`, `specs/001-screen-share-core/analyze.md`
Prohibited Paths: `apps/**`, `packages/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks: todos os RNFs (01–17) têm evidência de medição; relatório de homologação de critérios de aceite (CS-01 a CS-08) concluído em `docs/metrics/validation_report.md`.

---

## Novas tarefas: Captura Segregada e Gravação Local

### T022 — apps/desktop — IPC & Preload: separação de fontes e gravação local
[x] T022
Depends On: T016
Allowed Paths: `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/preload.ts`, `packages/types/src/index.ts`
Prohibited Paths: `apps/web/**`, `apps/backend/**`
Checks:
- [x] IPC `get-screen-sources` aceita parâmetro de tipo (`screen` | `window`) e retorna apenas as fontes correspondentes.
- [x] IPC `save-recorded-video` implementado com `dialog.showSaveDialog` e gravação segura em disco (`fs.promises.writeFile`).
- [x] Tipos exportados em `preload.ts` e `window.electronAPI`.

### T023 — apps/desktop — Hook useScreenCapture: modo Tela Cheia
[x] T023
Depends On: T022
Allowed Paths: `apps/desktop/src/renderer/hooks/useScreenCapture.ts`, `packages/types/src/index.ts`
Prohibited Paths: `apps/web/**`, `apps/backend/**`
Checks:
- [x] Captura do monitor inteiro com constraints 1080p e 30 FPS (`RF-26`).
- [x] Acompanha navegação pelo sistema operacional, múltiplas janelas e desktop.
- [x] Áudio do microfone mixado ao MediaStream com controle de mute.

### T024 — apps/desktop — Hook useScreenCapture: modo Janela Específica
[x] T024
Depends On: T022
Allowed Paths: `apps/desktop/src/renderer/hooks/useScreenCapture.ts`
Prohibited Paths: `apps/web/**`, `apps/backend/**`
Checks:
- [x] Captura restrita à janela da aplicação selecionada sem vazamento do desktop (`RF-27`).
- [x] Filtro para evitar captura recursiva do próprio app MLab.
- [x] Suporte à troca dinâmica de fonte mantendo a sessão ativa (`RN-12`, `RN-20`).

### T025 — apps/desktop — Hook useLocalRecorder: gravação local (.webm / .mp4)
[x] T025
Depends On: T022, T023, T024
Allowed Paths: `apps/desktop/src/renderer/hooks/useLocalRecorder.ts`, `apps/desktop/src/renderer/hooks/index.ts`
Prohibited Paths: `apps/web/**`, `apps/backend/**`
Checks:
- [x] Suporte à escolha prévia de gravar ou não gravar (`RNF-18`).
- [x] Suporte aos formatos `.webm` e `.mp4` via `MediaRecorder` (`RF-28`, `RNF-18`).
- [x] Controle de estados: `idle`, `recording`, `paused`, `stopped` e cronômetro em tempo real.
- [x] Ao encerrar a gravação, aciona o diálogo nativo e salva o arquivo em disco.

### T026 — apps/desktop — Hook useWebRTCPublisher: publicação ativa na SFU Pion
[x] T026
Depends On: T023, T024
Allowed Paths: `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`
Prohibited Paths: `apps/web/**`
Checks:
- [x] Conexão ao WebSocket `/ws/signaling?token=...` e emissão de `publish-request`.
- [x] Criação de RTCPeerConnection e envio de SDP offer com tracks de tela e microfone.
- [x] Recebimento de SDP answer da SFU e troca de candidatos ICE (`RF-29`).
- [x] Alunos conectados no `apps/web` recebem o stream de vídeo e áudio em tempo real.

### T027 — apps/desktop — UI Room: fluxo guiado de setup e controles
[x] T027
Depends On: T025, T026
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`
Prohibited Paths: `apps/web/**`, `apps/backend/**`
Checks:
- [x] Modal/etapa de setup antes da transmissão:
  1. Pergunta "Deseja gravar a aula?" [Sim / Não].
  2. Se Sim, seleção de formato [.webm / .mp4].
  3. Abas de modo de tela: [Tela Cheia] vs [Janela Específica].
  4. Seleção da fonte (thumbnail).
  5. Botão "Avançar / Iniciar Transmissão".
- [x] Durante a aula: exibição de timer REC (se habilitado), botões de pausar/salvar gravação, botões de mute/pausa de mídia e status de transmissão.
- [x] Menu nativo do Electron permanece intacto.

### T028 — apps/desktop — Testes automatizados e homologação
[x] T028
Depends On: T027
Allowed Paths: `apps/desktop/src/renderer/pages/Room.test.tsx`, `apps/desktop/src/test/setup.ts`
Prohibited Paths: `apps/web/**`, `apps/backend/**`
Checks:
- [x] Mocks atualizados em `setup.ts` para os novos canais IPC e `MediaRecorder`.
- [x] Testes de renderização de abas e fluxo de escolha de gravação em `Room.test.tsx`.
- [x] 100% dos testes passando (`npm run test`) e build limpo (`npm run build`).

### T029 — apps/desktop — Fluxo e aceite de permissões de microfone e captura de tela no pós-login do professor
[x] T029
> **SUPERSEDED.** A tela `Permissions.tsx` foi removida em `4f3caad`. O tratamento de permissões permanece no processo principal (`setPermissionRequestHandler`). RF-24 será reescrito para o fluxo atual (ver `converge.md` §2).
Depends On: T028
Allowed Paths: `apps/desktop/src/**`, `packages/types/src/index.ts`
Prohibited Paths: `apps/web/**`, `apps/backend/**`
Checks:
- [x] Handlers de permissão de sessão no Electron main (`setPermissionRequestHandler`, `setPermissionCheckHandler`, `setDisplayMediaRequestHandler`).
- [x] IPC handlers `check-media-permissions` e `request-media-permissions` expostos no contextBridge.
- [x] Tela intermediária `Permissions.tsx` após o login do professor para solicitação e teste de Microfone e Tela Cheia/Janelas.
- [x] Bloqueio de avanço para o Dashboard até que as permissões sejam validadas/concedidas.
- [x] Guia de instruções para configurações de privacidade do SO caso negado.
- [x] 100% dos testes passando e build limpo.

### T030 — apps/backend & apps/web — Ingresso de aluno via slug legível e retorno de parâmetros WebRTC
[x] T030
Depends On: T009, T018, T020
Allowed Paths: `apps/backend/internal/room/**`, `apps/web/src/**`, `packages/types/src/**`
Prohibited Paths: `apps/desktop/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] `POST /rooms/{id}/join` aceita tanto UUID quanto slug legível (ex: `uniform-lima-4770`).
- [x] `JoinResponse` inclui `room_id` (UUID canônico), `ws_url` (`ws://localhost:8080/ws/rooms/{room.ID}/signal`) e `ice_servers`.
- [x] Resposta de erro do backend capturada e exibida adequadamente no formulário de entrada do aluno em `apps/web`.
- [x] Testes unitários no backend validando ingresso via slug (`TestJoinRoomBySlug`) e contrato de retorno WebRTC.
- [x] 100% dos testes passando e build da monorepo concluído com sucesso.

### T031 — apps/web & apps/backend — Reprodução de vídeo no aluno e solicitação de keyframes via SFU
[x] T031
Depends On: T011, T019, T030
Allowed Paths: `apps/web/src/**`, `apps/backend/internal/webrtc/**`, `apps/backend/internal/signaling/**`
Prohibited Paths: `apps/desktop/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Hook `useWebRTCSubscriber` implementa máquina de estados de sinalização WebRTC completa (`subscribe-request`, `offer`, `answer`, `ice-candidate`, `ontrack`), recebendo e renderizando o stream de tela e áudio do professor.
- [x] Correção de tela preta via solicitação de IDR Keyframes (RTCP PLI) no SFU Pion de forma periódica e imediata ao ingresso de novos alunos.
- [x] Acumulação correta de tracks (`prev.addTrack`) na mesma MediaStream para evitar que a track de áudio sobrescreva a de vídeo.
- [x] Tratamento de Autoplay Policy dos navegadores e dispositivos móveis (`playsInline`, `autoPlay`, `muted`).

### T032 — apps/backend — Link fixo e permanente por professor
[x] T032
Depends On: T009, T013
Allowed Paths: `apps/backend/internal/room/**`, `apps/backend/internal/auth/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Slug da sala determinístico gerado a partir do email/login do professor (`slugFromEmail`, ex: `professor@screenshare.local` -> `professor`).
- [x] Reutilização da sala pré-existente no store (`GetRoomByOwnerID`) para manter link e identificador canônico fixos entre sessões.
- [x] Testes unitários validando geração de slug e reuso de sala.

### T033 — apps/backend & apps/web — Suporte a túnel ngrok e IP de rede local
[x] T033
Depends On: T032
Allowed Paths: `apps/backend/internal/**`, `apps/web/**`, `docs/requirements/**`
Prohibited Paths: `apps/desktop/**`, `packages/**`, `spec-kit/specs/**` *(registrado retroativamente em 2026-11-01 — ver `analyze.md` I-09)*
Checks:
- [x] Resolução automática de URL base e WebSocket via `NGROK_URL`, `PUBLIC_URL` e detecção de IP primário de rede (`getOutboundIP()`).
- [x] Suporte a NAT 1-to-1 IP no SFU Pion (`NAT_1TO1_IP` / `PUBLIC_IP`).
- [x] Vite escutando em `0.0.0.0` (`host: true`) com proxy reverso de `/rooms`, `/auth` e `/ws`.
- [x] 100% dos testes passando (`apps/backend`, `apps/web`, `apps/desktop`) e monorepo build com sucesso.


---

## Emenda de 2026-11-01: medição real de carga

### T034 — Teste de carga real do SFU (40 espectadores)
[ ] T034
Depends On: T020, T031
Allowed Paths: `apps/backend/internal/webrtc/loadtest_test.go`, `apps/backend/internal/webrtc/loadtest_cpu_*_test.go`, `apps/backend/package.json` (script `test:load`), `docs/load-test/**`, `docs/metrics/**`
Prohibited Paths: `apps/backend/internal/webrtc/*.go` que não sejam de teste, `apps/backend/internal/signaling/**`, `apps/desktop/**`, `apps/web/**`, `packages/**`
Checks:
- [ ] Teste com build tag `loadtest` sobe o `SFUService` real, um publisher Pion (VP8 sintético, 30 FPS, ~4 Mbps) e 40 assinantes Pion.
- [ ] Mede FPS, bitrate, perda pós-NACK, tempo de entrada, latência de encaminhamento, upload do publisher, CPU e memória do processo.
- [ ] Reprova se algum assinante ficar sem mídia, FPS mínimo < 25 ou perda ≥ 2%.
- [ ] `go test ./...` sem a tag continua igual (o teste não roda no dia a dia).
- [ ] `docs/load-test/load_test.go` (simulado) apagado; `docs/load-test/README.md` explica como rodar.
- [ ] Resultado da execução registrado em `docs/metrics/`, com o que foi e o que não foi medido.
