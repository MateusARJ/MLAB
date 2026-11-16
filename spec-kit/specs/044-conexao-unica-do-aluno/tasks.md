# Tasks: Uma Única Conexão de Sinalização por Entrada do Aluno

Feature: `044-conexao-unica-do-aluno`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- um commit atômico por task, com `Ref: T440x` e `Refs #127`.

### T4401 — Teste da montagem dupla do StrictMode
[x] T4401
Allowed Paths: `apps/web/src/hooks/useWebRTCSubscriber.test.ts`, `spec-kit/specs/044-conexao-unica-do-aluno/tasks.md`
Prohibited Paths: `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/main.tsx`, `apps/web/src/pages/**`,
`apps/web/e2e/**`, `apps/backend/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] Teste com `renderHook(..., { wrapper: React.StrictMode })` exige um único WebSocket criado e nenhum fechado
  (RF-4401).
- [x] Teste de desmontagem antes da conexão exige nenhum WebSocket criado (spec §9).
- [x] Os testes falham antes da T4402: "expected ... to have a length of 1 but got 2" (StrictMode) e "length of +0 but
  got 1" (desmontagem); os 14 demais verdes.

### T4402 — Abertura adiada e cancelável da conexão
[x] T4402
Depends On: T4401
Allowed Paths: `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/hooks/useWebRTCSubscriber.test.ts`,
`spec-kit/specs/044-conexao-unica-do-aluno/plan.md`, `spec-kit/specs/044-conexao-unica-do-aluno/tasks.md`
Prohibited Paths: `apps/web/src/main.tsx`, `apps/web/src/pages/**`, `apps/web/e2e/**`, `apps/backend/**`,
`apps/desktop/**`, `packages/**`
Checks:
- [x] O efeito agenda `connect()` num timer de 0 ms; o cleanup cancela o timer (RF-4401).
- [x] Tratamento do `4001`, `4002`, `1000`/`4004` e backoff inalterados; testes existentes verdes, ajustados só para
  avançar um tick pelo helper `renderSubscriber` (RF-4402).
- [x] `npx vitest run` em `apps/web`: 5 arquivos, 59 testes verdes; `npm run lint` (`tsc --noEmit`) verde.

### T4403 — Verificação e2e
[x] T4403
Depends On: T4402
Allowed Paths: `spec-kit/specs/044-conexao-unica-do-aluno/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] `npm run build` verde.
- [x] `cd apps/web && npx playwright test --repeat-each=3 --retries=0`: 39 passed, sem `4001` falso (RNF-4401).

### T4404 — Converge
[x] T4404
Depends On: T4403
Allowed Paths: `spec-kit/specs/044-conexao-unica-do-aluno/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-4402).
- [x] `npm run spec:check -- spec-kit/specs/044-conexao-unica-do-aluno` com PASS.
