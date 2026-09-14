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
- [ ] Teste de runtime — pendente instalação do Go 1.22+.

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
- [ ] Teste de runtime — pendente instalação do Go 1.22+.

### T010 — apps/backend — módulo signaling (WebSocket)
[ ] T010
Depends On: T009
Allowed Paths: `apps/backend/internal/signaling/**`
Checks: cliente conecta via WSS; mensagens `join`, `offer`, `answer`, `ice-candidate` são trocadas conforme `signaling.md`.

### T011 — apps/backend — módulo webrtc (SFU Pion)
[ ] T011
Depends On: T010
Allowed Paths: `apps/backend/internal/webrtc/**`
Checks: professor publica tela+áudio; 2 alunos recebem sem upstream individual do professor.

### T012 — apps/backend — módulo chat
[ ] T012
Depends On: T010
Allowed Paths: `apps/backend/internal/chat/**`
Checks: mensagem enviada por um participante chega a todos; rate limit retorna CHAT_RATE_LIMITED.

### T013 — apps/desktop — scaffold Electron
[ ] T013
Depends On: T007
Allowed Paths: `apps/desktop/**`
Checks: `npm run dev` (desktop) abre janela Electron; contextBridge exposto corretamente.

### T014 — apps/desktop — UI Login
[ ] T014
Depends On: T013, T008
Allowed Paths: `apps/desktop/src/renderer/pages/Login.tsx`, `apps/desktop/src/renderer/services/**`
Checks: professor faz login com credenciais válidas e é redirecionado ao Dashboard.

### T015 — apps/desktop — UI Dashboard
[ ] T015
Depends On: T014, T009
Allowed Paths: `apps/desktop/src/renderer/pages/Dashboard.tsx`
Checks: professor cria sala e copia link único; sala aparece em status "waiting".

### T016 — apps/desktop — UI Room (captura de tela, áudio, chat)
[ ] T016
Depends On: T015, T011, T012
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/hooks/**`
Checks: professor inicia captura; `desktopCapturer` stream publicado na SFU; áudio toggle funciona; chat envia e recebe mensagens.

### T017 — apps/web — scaffold Vite
[ ] T017
Depends On: T007
Allowed Paths: `apps/web/**`
Checks: `npm run dev` (web) abre no navegador sem erro; rota `/sala/:slug` existe.

### T018 — apps/web — página Join
[ ] T018
Depends On: T017, T009
Allowed Paths: `apps/web/src/pages/Join.tsx`, `apps/web/src/services/**`
Checks: aluno informa Nome e Matrícula; campos vazios bloqueados; JWT de aluno retornado e armazenado.

### T019 — apps/web — página Room (player WebRTC + chat)
[ ] T019
Depends On: T018, T011, T012
Allowed Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/hooks/**`, `apps/web/src/components/**`
Checks: aluno recebe vídeo e áudio do professor; chat funciona; indicador de reconexão exibido em falha de ICE.

### T020 — Testes de carga (40 espectadores)
[ ] T020
Depends On: T019
Allowed Paths: `docs/load-test/**`
Checks: 40 clientes simulados assinam a stream; FPS ≥ 25, packet loss < 2%, RTT < 300ms medidos e documentados.

### T021 — Medição de métricas e validação dos RNFs
[ ] T021
Depends On: T020
Allowed Paths: `docs/metrics/**`, `specs/001-screen-share-core/analyze.md`
Checks: todos os RNFs (01–07) têm evidência de medição; `analyze.md` atualizado com resultados reais.
