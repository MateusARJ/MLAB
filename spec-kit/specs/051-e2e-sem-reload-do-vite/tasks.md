# Tasks: E2E sem Recarregamento do Vite

Feature: `051-e2e-sem-reload-do-vite`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- e2e do aluno verde antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T510x` e `Refs #153`.

### T5101 — Artefatos fora da observação do Vite
[x] T5101
Allowed Paths: `apps/web/playwright.config.ts`, `apps/web/vite.config.ts`, `apps/web/.gitignore`,
`scripts/smoke-report.js`, `spec-kit/specs/051-e2e-sem-reload-do-vite/tasks.md`
Prohibited Paths: `apps/web/src/**`, `apps/web/e2e/**`, `apps/desktop/**`, `apps/backend/**`, `packages/**`,
`package.json`
Checks:
- [x] `outputDir` em `test-results/e2e` e JSON em `test-results/e2e-results.json` (RF-5101).
- [x] `server.watch.ignored` com `**/test-results/**`, `**/e2e-results/**`, `**/playwright-report/**` (RF-5102).
- [x] `smoke-report.js` no novo caminho; `node --check` ok (RF-5103).
- [x] `test-results/` no `.gitignore` do web (RF-5105).

### T5102 — Teste de regressão I1
[x] T5102
Depends On: T5101
Allowed Paths: `apps/web/e2e/infra.e2e.ts`, `spec-kit/specs/051-e2e-sem-reload-do-vite/tasks.md`
Prohibited Paths: `apps/web/src/**`, `apps/web/e2e/aluno.e2e.ts`, `apps/web/e2e/fixtures.ts`, `apps/desktop/**`,
`apps/backend/**`, `packages/**`
Checks:
- [x] `I1` grava `.html` em `testInfo.outputDir` e em `e2e-results/` e não recebe `full-reload`; exige o frame
  `connected` do HMR (RF-5104).
- [x] `I1` falha com a configuração anterior (sem `server.watch.ignored`, gravando em `e2e-results/`).
- [x] A3 `desktop` 40/40, A10 `desktop`/`mobile` e A13 `mobile` repetidos sem retry, verdes (RNF-5101).
- [x] Suíte e2e completa verde nos dois projetos; HMR do `src/` funcionando (RNF-5102).

### T5103 — Converge
[x] T5103
Depends On: T5102
Allowed Paths: `spec-kit/specs/051-e2e-sem-reload-do-vite/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências (taxas antes/depois), desvios e impacto de versão (nenhum, C-5103).
- [x] `npm run spec:check -- spec-kit/specs/051-e2e-sem-reload-do-vite` com PASS.
