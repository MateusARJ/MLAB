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
Checks:
- [x] Tipos importados sem erro em `apps/desktop` — turbo run lint 5/5 OK.
- [x] Tipos importados sem erro em `apps/web` — turbo run lint 5/5 OK.
Nota: implementado antecipadamente dentro do T006 (packages/types/src/index.ts).

### T008 — apps/backend — módulo auth
[x] T008
Depends On: T007
Allowed Paths: `apps/backend/internal/auth/**`, `apps/backend/cmd/**`
Checks:
- [x] Código escrito conforme `contracts/auth.md` (model, jwt, handler, middleware, store).
- [x] `POST /auth/login` implementado com bcrypt + JWT HS256.
- [x] Token inválido retorna 401 (middleware.go).
- [ ] Testes unitários e de segurança (`auth_test.go`, `auth_security_test.go`): validação de JWT, senhas bcrypt e rejeição de tokens forjados/expirados (ADR 0003, ADR 0004).

### T009 — apps/backend — módulo room
[x] T009
Depends On: T008
Allowed Paths: `apps/backend/internal/room/**`
Checks:
- [x] `POST /rooms` — cria sala com slug legível, retorna link.
- [x] `GET /rooms/{id}/link` — professor obtém link (verifica propriedade).
- [x] `POST /rooms/{id}/join` — aluno recebe JWT, verifica limite e status.
- [x] `POST /rooms/{id}/close` — professor encerra sala (verifica propriedade).
- [x] Erros 401/403/404/409/429 implementados conforme contrato.
- [ ] Testes unitários e de segurança (`room_test.go`, `room_security_test.go`): gerador de slug e restrição de acesso por propriedade (`403 Forbidden`) (ADR 0003, ADR 0004).

### T010 — apps/backend — módulo signaling (WebSocket)
[x] T010
Depends On: T009
Allowed Paths: `apps/backend/internal/signaling/**`
Checks:
- [x] Upgrade WebSocket com JWT validation (query param `?token=`).
- [x] Hub por sala: register/unregister, broadcast, broadcastExcept.
- [x] Mensagens C→S: join via upgrade, offer, answer, ice-candidate, publish-request, subscribe-request, chat-message.
- [x] Mensagens S→C: session-state, publish-approved, participant-joined, participant-left, room-closed, ice-servers, error.
- [x] Rate limit de chat (5/5s, 30/60s) — sliding window no hub.
- [x] Reconexão do publisher: timer 30s → room-closed (§10a media-session.md).
- [x] TURN credentials temporárias (HMAC-SHA1, RFC 8489).
- [x] Interface SFU desacoplada — hub opera em stub até T011.
- [ ] Testes de integração e segurança (`hub_test.go`, `signaling_security_test.go`): upgrade WS, desconexão de sessão única (`4001 Duplicate Session`), rate limit e HMAC TURN (ADR 0003, ADR 0004).

### T011 — apps/backend — módulo webrtc (SFU Pion)
[x] T011
Depends On: T010
Allowed Paths: `apps/backend/internal/webrtc/**`
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
Checks:
- [x] Mensagem enviada por participante chega a todos com nome e papel `[Professor]` / `[Aluno]` (RF-09, RF-16).
- [x] Timestamp `sent_at` gerado no servidor e mensagens vazias descartadas (RF-17, RN-17).
- [x] Rate limit (5/5s, 30/60s) retorna erro `CHAT_RATE_LIMITED` sem desconectar usuário (RF-17, RN-15, RN-16).
- [x] Sanitização XSS aplicada antes do broadcast (RNF-17).
- [x] Testes unitários e de segurança (`chat_test.go`, `chat_security_test.go`): descarte de mensagens vazias e prevenção contra injeção de HTML/XSS (ADR 0003, ADR 0004).

### T013 — apps/desktop — scaffold Electron
[ ] T013
Depends On: T007
Allowed Paths: `apps/desktop/**`
Checks: `npm run dev` (desktop) abre janela Electron; contextBridge exposto corretamente; suíte de testes Vitest configurada.

### T014 — apps/desktop — UI Login
[ ] T014
Depends On: T013, T008
Allowed Paths: `apps/desktop/src/renderer/pages/Login.tsx`, `apps/desktop/src/renderer/services/**`
Checks:
- [ ] Professor faz login com credenciais válidas, obtém JWT de 8h e é redirecionado ao Dashboard (RF-12, RN-01).
- [ ] Testes de componente React (`Login.test.tsx`): renderização do formulário, validação de campos e erro de login.

### T015 — apps/desktop — UI Dashboard
[ ] T015
Depends On: T014, T009
Allowed Paths: `apps/desktop/src/renderer/pages/Dashboard.tsx`
Checks:
- [ ] Professor cria sala, obtém slug único e copia link de convite; sala aparece em status "waiting" (RF-13, RN-05, RN-06).
- [ ] Testes de componente React (`Dashboard.test.tsx`): cópia de link único e estado da sala.

### T016 — apps/desktop — UI Room (captura de tela, áudio, chat)
[ ] T016
Depends On: T015, T011, T012
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/hooks/**`
Checks:
- [ ] Checagem prévia de permissões do SO para tela e microfone (RF-24).
- [ ] Seletor nativo de monitores e janelas via `desktopCapturer` (RF-04).
- [ ] Toggle de mute de microfone e pausa de vídeo independentes (RF-20).
- [ ] Troca de fonte de captura mantém a mesma PeerConnection ativa (RN-12).
- [ ] Testes de componente e mocks (`Room.test.tsx`): mocks de `desktopCapturer` e IPC Electron.

### T017 — apps/web — scaffold Vite
[ ] T017
Depends On: T007
Allowed Paths: `apps/web/**`
Checks: `npm run dev` (web) abre no navegador sem erro; rota `/sala/:slug` existe; suíte de testes Vitest configurada.

### T018 — apps/web — página Join
[ ] T018
Depends On: T017, T009
Allowed Paths: `apps/web/src/pages/Join.tsx`, `apps/web/src/services/**`
Checks:
- [ ] Aluno informa Nome e Matrícula; campos vazios bloqueados (RF-11, RN-02).
- [ ] Sessão única por aluno: reconexão com mesmo aluno desconecta sessão anterior com `4001 Duplicate Session` (RN-04).
- [ ] Testes de componente React e segurança (`Join.test.tsx`): validação de formulário e tratamento de erro 4001.

### T019 — apps/web — página Room (player WebRTC + chat)
[ ] T019
Depends On: T018, T011, T012
Allowed Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/hooks/**`, `apps/web/src/components/**`
Checks:
- [ ] Aluno recebe vídeo e áudio do professor sem permissão de publicação (RF-03, RN-09).
- [ ] Autoplay Policy tratada com botão interativo "Clique para Ativar Som" (RF-21).
- [ ] Modos Fullscreen e Picture-in-Picture funcionais (RF-22).
- [ ] Monitoramento de `iceConnectionState` aciona ICE Restart em falhas de rota (RF-25).
- [ ] Reconexão do aluno com backoff exponencial 1s a 30s (RF-19, RN-14).
- [ ] Testes de componente React e mocks de mídia (`Room.test.tsx`): Autoplay fallback e chat sanitizado.

### T020 — Testes de carga (40 espectadores)
[ ] T020
Depends On: T019
Allowed Paths: `docs/load-test/**`
Checks: 40 clientes simulados assinam a stream; FPS ≥ 25, packet loss < 2%, RTT < 300ms, upload do professor fixo entre 3-6 Mbps e CPU do servidor < 15% (RF-08, RNF-01 a RNF-09, RNF-15).



### T021 — Medição de métricas e validação dos RNFs
[ ] T021
Depends On: T020
Allowed Paths: `docs/metrics/**`, `specs/001-screen-share-core/analyze.md`
Checks: todos os RNFs (01–07) têm evidência de medição; `analyze.md` atualizado com resultados reais.
