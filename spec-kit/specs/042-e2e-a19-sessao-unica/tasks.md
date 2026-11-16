# Tasks: E2E A19 com a Recusa da Matrícula Já Conectada

Feature: `042-e2e-a19-sessao-unica`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- um commit atômico por task, com `Ref: T420x` e `Refs #126`.

### T4201 — A19 com a recusa da ADR 0010
[ ] T4201
Allowed Paths: `apps/web/e2e/aluno.e2e.ts`, `spec-kit/specs/042-e2e-a19-sessao-unica/tasks.md`
Prohibited Paths: `apps/web/src/**`, `apps/web/e2e/fixtures.ts`, `apps/backend/**`, `apps/desktop/**`, `packages/**`,
`package.json`
Checks:
- [ ] A aba 2 só envia a entrada depois do `participant-joined` da matrícula da aba 1 no professor (RF-4201).
- [ ] A aba 2 fica em `/entrar` com o alerta "Esta matrícula já está conectada nesta transmissão." (RF-4202).
- [ ] A aba 1 continua em `/ao-vivo` (RF-4203).
- [ ] `npm run build` e `npx playwright test -g "A19" --repeat-each=3 --retries=0` em `apps/web` verdes (RNF-4201).
- [ ] `npm run test:e2e` em `apps/web` verde, ou falhas fora do A19 registradas como desvio.

### T4202 — Converge
[ ] T4202
Depends On: T4201
Allowed Paths: `spec-kit/specs/042-e2e-a19-sessao-unica/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (sem incremento, C-4202).
- [ ] `npm run spec:check -- spec-kit/specs/042-e2e-a19-sessao-unica` com PASS.
