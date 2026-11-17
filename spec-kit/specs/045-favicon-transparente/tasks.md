# Tasks: Favicon do Aluno Igual ao Ícone do Header do Desktop

Feature: `045-favicon-transparente`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- um commit atômico por task, com `Ref: T450x` e `Refs #131`.

### T4501 — Teste do favicon transparente e notas de emenda
[x] T4501
Allowed Paths: `apps/web/src/favicon.test.ts`, `spec-kit/specs/025-favicon-web/spec.md`,
`spec-kit/specs/028-design-system-2/spec.md`, `spec-kit/specs/045-favicon-transparente/tasks.md`
Prohibited Paths: `apps/web/public/**`, `apps/web/index.html`, `apps/web/src/pages/**`, `apps/desktop/**`,
`apps/backend/**`, `packages/**`
Checks:
- [x] `favicon.test.ts` cita a 045 e exige `favicon-32.png` RGBA (IHDR byte 25 = 6) (RF-4501).
- [x] Asserções de links, tamanhos e apple-touch-icon RGB mantidas (RF-4502, RF-4503).
- [x] Notas de emenda na 025 (RF-2502) e na 028 (RF-2814) apontando para a 045 (C-4502).

### T4502 — PNGs com o mark do header
[x] T4502
Depends On: T4501
Allowed Paths: `apps/web/public/favicon-32.png`, `apps/web/public/apple-touch-icon.png`,
`spec-kit/specs/045-favicon-transparente/tasks.md`
Prohibited Paths: `apps/web/index.html`, `apps/web/public/MLAB-logo.png`, `apps/web/src/**`, `apps/desktop/**`,
`apps/backend/**`, `packages/**`
Checks:
- [x] `favicon-32.png` 32×32 RGBA, mark 32×22 centralizado, cantos com alfa 0 (RF-4501).
- [x] `apple-touch-icon.png` 180×180 RGB, fundo branco, mark 158×108 centralizado (RF-4502).
- [x] Gerados fora do repositório a partir do `mlab-logo-mark.png`, sem dependência nova (RNF-4501).
- [x] `npx vitest run` em `apps/web`: 5 arquivos, 60 testes verdes; `npm run lint` verde.
- [x] Conferência visual sobre os fundos de aba do Chrome (claro `#FFFFFF`, escuro `#35363A`) em 16, 32 e 96 px
  (RNF-4502).

### T4503 — Converge
[ ] T4503
Depends On: T4502
Allowed Paths: `spec-kit/specs/045-favicon-transparente/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-4503).
- [ ] `npm run spec:check -- spec-kit/specs/045-favicon-transparente` com PASS.
