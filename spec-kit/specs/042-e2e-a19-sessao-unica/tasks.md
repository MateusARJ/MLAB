# Tasks: E2E A19 com a Recusa da Matrícula Já Conectada

Feature: `042-e2e-a19-sessao-unica`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- um commit atômico por task, com `Ref: T420x` e `Refs #126`.

### T4201 — A19 com a recusa da ADR 0010
[x] T4201
Allowed Paths: `apps/web/e2e/aluno.e2e.ts`, `spec-kit/specs/042-e2e-a19-sessao-unica/tasks.md`
Prohibited Paths: `apps/web/src/**`, `apps/web/e2e/fixtures.ts`, `apps/backend/**`, `apps/desktop/**`, `packages/**`,
`package.json`
Checks:
- [x] A aba 2 só envia a entrada depois do `participant-joined` da matrícula da aba 1 no professor (RF-4201).
- [x] A aba 2 fica em `/entrar` com o alerta "Esta matrícula já está conectada nesta transmissão." (RF-4202).
- [x] A aba 1 continua em `/ao-vivo` (RF-4203).
- [x] `npm run build` e `npx playwright test -g "A19" --repeat-each=3 --retries=0` em `apps/web` verdes (RNF-4201).
- [x] `npm run test:e2e` em `apps/web`: 12 de 13 verdes, A19 incluído; o A13 (desktop) falhou de forma
  intermitente, sem relação com o A19, registrado como desvio #127.

### T4202 — Converge
[x] T4202
Depends On: T4201
Allowed Paths: `spec-kit/specs/042-e2e-a19-sessao-unica/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (sem incremento, C-4202).
- [x] `npm run spec:check -- spec-kit/specs/042-e2e-a19-sessao-unica` com PASS.
