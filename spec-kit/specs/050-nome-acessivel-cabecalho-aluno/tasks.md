# Tasks: Nome Acessível dos Botões do Cabeçalho do Aluno

Feature: `050-nome-acessivel-cabecalho-aluno`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `npx vitest run` e `npm run lint` em `apps/web` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T500x` e `Refs #149`.

### T5001 — Nome acessível dos botões Arquivos e Chat do cabeçalho
[x] T5001
Allowed Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`,
`spec-kit/specs/050-nome-acessivel-cabecalho-aluno/tasks.md`
Prohibited Paths: `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/e2e/**`, `apps/desktop/**`,
`apps/backend/**`, `packages/**`, `package.json`
Checks:
- [x] Botão de Arquivos com `aria-label` "Arquivos da aula" e contagem com unidade (RF-5001).
- [x] Botão de Chat com `aria-label` pelo rótulo da tela (celular: `title`; computador: "Chat") e não lidas com
  unidade e `99+` (RF-5002).
- [x] Selos desses botões com `aria-hidden="true"`; `title` sem mudança; nenhuma mudança visual (RF-5003, RNF-5001).
- [x] Testes novos no celular e no computador, com e sem contagem; testes existentes verdes (RNF-5002).

### T5002 — E2E A13 sem corrida
[x] T5002
Depends On: T5001
Allowed Paths: `apps/web/e2e/aluno.e2e.ts`, `spec-kit/specs/050-nome-acessivel-cabecalho-aluno/tasks.md`
Prohibited Paths: `apps/web/e2e/fixtures.ts`, `apps/web/src/**`, `apps/desktop/**`, `apps/backend/**`, `packages/**`
Checks:
- [x] A13 espera `{ name: /Arquivos da aula \(1 arquivo\)/i }` antes de clicar (RF-5004).
- [x] `npx playwright test -g "A13" --project=mobile --repeat-each=30 --retries=0` verde (RNF-5002).
- [x] Suíte e2e do aluno verde nos projetos `desktop` e `mobile`.

### T5003 — Converge
[ ] T5003
Depends On: T5002
Allowed Paths: `spec-kit/specs/050-nome-acessivel-cabecalho-aluno/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-5003).
- [ ] `npm run spec:check -- spec-kit/specs/050-nome-acessivel-cabecalho-aluno` com PASS.

### T5004 — Versão
[ ] T5004
Depends On: T5003
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/050-nome-acessivel-cabecalho-aluno/tasks.md`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao 2.2.1`.
