# Tasks: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-T005

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

[ ] T005 [revalidação completa]

Depends On: T001, T002, T003, T004, T005a, T005b

Allowed Paths:
- `specs/001-screen-share-core/**`

Checks:
- [ ] checklist APPROVED — verificar `checklists/requirements.md`.
- [ ] analyze PASS — verificar `analyze.md`.
- [ ] Todos os contratos em READY.
- [ ] plan.md sem itens PENDENTE.

---

## Tarefas de implementação

As tarefas de implementação (T006+) DEVEM ser geradas após T005 passar e NUNCA antes.

Ordem prevista de geração (a confirmar após T005):

1. Scaffold do monorepo (turbo.json, package.json raiz, apps/, packages/).
2. `packages/types` — DTOs compartilhados.
3. `apps/backend` — módulo auth (JWT, login, join).
4. `apps/backend` — módulo room (CRUD, link único).
5. `apps/backend` — módulo signaling (WebSocket, sinalização WebRTC).
6. `apps/backend` — módulo webrtc (SFU Pion — publish/subscribe).
7. `apps/backend` — módulo chat (mensagens via WebSocket).
8. `apps/desktop` — scaffold Electron (main, preload, renderer).
9. `apps/desktop` — UI Login.
10. `apps/desktop` — UI Dashboard (criar sala, copiar link).
11. `apps/desktop` — UI Room (captura de tela, áudio, chat).
12. `apps/web` — scaffold Vite (Join, Room).
13. `apps/web` — página Join (Nome + Matrícula).
14. `apps/web` — página Room (player WebRTC, chat).
15. Testes de carga: 40 espectadores simultâneos.
16. Medição de métricas e validação dos RNFs.

Nenhuma tarefa de código é válida enquanto T005 não for concluída.
