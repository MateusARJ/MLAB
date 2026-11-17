# Tasks: Formato Exato da Matrícula do Aluno

Feature: `046-formato-matricula`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- um commit atômico por task, com `Ref: T460x` e `Refs #134`.

### T4601 — Testes do formato e notas de emenda
[ ] T4601
Allowed Paths: `apps/backend/internal/room/room_test.go`, `apps/web/src/pages/Join.test.tsx`,
`spec-kit/specs/003-classroom-interaction/spec.md`, `spec-kit/specs/003-classroom-interaction/clarify.md`,
`spec-kit/specs/001-screen-share-core/contracts/room-api.md`, `spec-kit/specs/001-screen-share-core/contracts/auth.md`,
`docs/requirements/functionals/RF011-identificacao-obrigatoria-de-aluno-nome-e-matricula.md`,
`spec-kit/specs/046-formato-matricula/tasks.md`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/web/src/pages/Join.tsx`, `apps/desktop/**`,
`apps/backend/internal/signaling/**`, `packages/**`
Checks:
- [ ] `TestJoinValidation` recusa `2025116TADS0`, `202511TADS0000`, `2025116ADS0000`, `2025116TADS00000` (RF-4601).
- [ ] Teste do backend: `2025116tads0039` entra e o token traz `student_id` `2025116TADS0039` (RF-4602).
- [ ] `Join.test.tsx`: `2025116TADS0` mostra a mensagem nova sem chamar a API; minúsculas enviadas em maiúsculas
  (RF-4601 a RF-4603).
- [ ] Notas de emenda na RN-306 e na C-303 da 003, nos contratos e no RF011.

### T4602 — Backend
[ ] T4602
Depends On: T4601
Allowed Paths: `apps/backend/internal/room/handler.go`, `spec-kit/specs/046-formato-matricula/tasks.md`
Prohibited Paths: `apps/web/**`, `apps/desktop/**`, `apps/backend/internal/signaling/**`, `packages/**`
Checks:
- [ ] `studentIDRegex` com `^[0-9]{7}[A-Za-z]{4}[0-9]{4}$`; `TrimSpace` + `ToUpper`; mensagem do `400` (RF-4601 a
  RF-4603).
- [ ] `go test ./...` em `apps/backend` verde.

### T4603 — Web
[ ] T4603
Depends On: T4601
Allowed Paths: `apps/web/src/pages/Join.tsx`, `spec-kit/specs/046-formato-matricula/tasks.md`
Prohibited Paths: `apps/backend/**`, `apps/desktop/**`, `packages/**`
Checks:
- [ ] `STUDENT_ID_REGEX` igual à do backend; mensagem nova; envio em maiúsculas (RF-4601 a RF-4603).
- [ ] `npx vitest run` e `npm run lint` em `apps/web` verdes.

### T4604 — Converge
[ ] T4604
Depends On: T4602, T4603
Allowed Paths: `spec-kit/specs/046-formato-matricula/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-4603).
- [ ] `npm run spec:check` verde.
